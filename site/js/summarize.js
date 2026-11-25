// ============================================================================
// Query-focused extractive summarisation
// ============================================================================
//
// What was shipping before: take the top sentences by raw query-term overlap and
// concatenate them. That produces the observed failures —
//
//   * the same intended-use statement repeated four times with minor wording
//     differences, because exact-string dedup does not catch near-duplicates;
//   * an unrelated AI explainer opening an answer about a project, because it is
//     long, shares a few words, and nothing scored it as off-topic;
//   * "The sponsor determined the following substances did not cause
//     interference at the concentrations listed below:" with no list, because
//     the sentence that scored well was a lead-in to a table.
//
// This module scores sentences on six independent signals, then selects with
// Maximal Marginal Relevance so each added sentence must contribute something
// the answer does not already contain. That is what removes the repetition and
// forces coverage of different facets of the question.
//
//   MMR:  argmax [ λ · relevance(s) − (1−λ) · max similarity(s, already chosen) ]
//
// λ = 0.72 — relevance-leaning, but enough diversity pressure that a paraphrase
// of an already-selected sentence cannot win.

import { evidencePrior, contentTokens, META_SITE_RE, familyMembers, focusMatches } from './nlu.js?v=7';

const MMR_LAMBDA = 0.72;
const MAX_SENTENCES = 5;
const MIN_SENTENCE_CHARS = 30;
const MAX_ANSWER_CHARS = 900;

// Sentence kinds that are never answer material, whatever they score.
const REJECTED_KINDS = new Set(['header', 'fragment', 'equation', 'legal']);

// For these intents a table IS the answer — an interference limits table or a
// specification block is exactly what was asked for. Blanket-rejecting tables
// was removing the only passage that could satisfy the question.
const TABLE_ADMITTING_INTENTS = new Set(['SKILLS', 'METRICS', 'COMPARISON', 'CONTACT', 'TEMPORAL']);

// ---------------------------------------------------------------------------
// Similarity helpers
// ---------------------------------------------------------------------------
function tokenSet(text) { return new Set(contentTokens(text)); }

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Containment — catches the "same statement, extra clause" case that Jaccard
 *  under-weights when one sentence is much longer than the other. */
function containment(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / Math.min(a.size, b.size);
}

function redundancy(a, b) {
  return Math.max(jaccard(a, b), containment(a, b) * 0.95);
}

// ---------------------------------------------------------------------------
// Sentence candidate extraction
// ---------------------------------------------------------------------------
function sentencesOf(chunk) {
  // Build-time sentence layer: offsets + kind + quality. Fall back to a naive
  // split for any index built before the sentence layer existed.
  if (Array.isArray(chunk.sents) && chunk.sents.length) {
    return chunk.sents.map((s, i) => ({
      text: chunk.text.substr(s.o, s.l).trim(),
      kind: s.k, quality: s.q, position: i, total: chunk.sents.length,
    }));
  }
  const parts = String(chunk.text || '').split(/(?<=[.!?])\s+/);
  return parts.map((t, i) => ({
    text: t.trim(), kind: 'prose', quality: 0.6, position: i, total: parts.length,
  }));
}

// ---------------------------------------------------------------------------
// Relevance scoring — six signals, each independently defensible
// ---------------------------------------------------------------------------
// Records that are read as a whole once their opening line answers: the role
// line is followed by its duties, the project line by what it does. Those
// continuation sentences share no words with the question — by design, they
// are the detail the question's words could not name.
const WHOLE_RECORD_TYPES = new Set(['role', 'engagement', 'project', 'career_project', 'event', 'repository', 'post', 'video']);

function scoreSentence(sent, ctx, opts = {}) {
  const { queryTokens, idf, intent, focus, semantic } = ctx;
  const sTokens = tokenSet(sent.text);
  if (!sTokens.size) return null;

  // 1. IDF-weighted query coverage. Raw overlap counts treat "the meter" and
  //    "hematocrit" as equally informative; IDF does not.
  let covered = 0, totalWeight = 0;
  for (const t of queryTokens) {
    const w = idf(t);
    totalWeight += w;
    if (sTokens.has(t)) covered += w;
  }
  const coverage = totalWeight > 0 ? covered / totalWeight : 0;

  // 2. Semantic similarity to the question — bridges vocabulary mismatch, so a
  //    sentence saying "renal" can answer a question saying "kidney".
  let semSim = 0;
  if (semantic && semantic.enabled && ctx.queryVec) {
    const v = semantic.embed(sent.text);
    if (v) {
      let dot = 0;
      for (let i = 0; i < v.length; i++) dot += v[i] * ctx.queryVec[i];
      semSim = Math.max(0, dot);
    }
  }

  // 3. Intent cue match — does this sentence look like the *kind* of statement
  //    the question asked for. Cues are weighted: a sentence that STATES the
  //    fact ("is intended for ...") must outrank one that merely MENTIONS the
  //    concept ("...equivalent in terms of intended use...").
  let cueScore = 0;
  for (const entry of (intent.answerCues || [])) {
    const [re, w] = Array.isArray(entry) ? entry : [entry, 0.6];
    if (re.test(sent.text)) cueScore = Math.max(cueScore, w);
  }
  let cue = Math.min(1, cueScore);

  // Sentences about the website's assistant describe the site, not the person —
  // a distraction from every question.
  if (META_SITE_RE.test(sent.text)) {
    cue *= 0.25;
  }

  // 4. Focus — is this sentence about the thing that was asked about?
  //
  // This is a gate, not a nudge. "What did he do at Tech Mahindra?" must not be
  // answered from the Yash Technologies record: excellent cue match, excellent
  // quality, wrong employer. A sentence that names a competing member of the
  // same entity family while never naming the one asked about is answering a
  // different question.
  let focusHit = 0;
  let focusConflict = 1.0;
  if (opts.rescueFocus) {
    focusHit = 1;                       // its record's opening line named the focus
  } else if (focus.length) {
    const low = sent.text.toLowerCase();
    focusHit = focus.some(f => focusMatches(low, f)) ? 1 : 0;
    // The question named something; a sentence that never mentions it is
    // weaker evidence even without a competing entity present.
    if (!focusHit) focusConflict = Math.min(focusConflict, 0.7);

    for (const family of ['organization', 'project', 'place']) {
      const asked = focus.filter(f => familyMembers(f, family).length);
      if (!asked.length) continue;
      const present = familyMembers(sent.text, family);
      if (!present.length) continue;
      const mentionsAsked = present.some(p => asked.some(a => a.includes(p) || p.includes(a)));
      if (!mentionsAsked) focusConflict = Math.min(focusConflict, 0.15);
    }
  }

  // 5. Intrinsic sentence quality from the build-time classifier.
  const quality = sent.quality ?? 0.5;

  // 6. Position prior — the opening sentences of a passage carry its topic
  //    statement more often than the tail does.
  const position = 1 - Math.min(1, sent.position / Math.max(sent.total, 1)) * 0.35;

  if (coverage === 0 && semSim < 0.2 && cueScore === 0 && !opts.rescueCoverage) return null;
  // A rescued continuation inherits part of its record's lead-line coverage.
  const coverageEff = Math.max(coverage, opts.rescueCoverage || 0);

  let metaPenalty = 1.0;
  if (META_SITE_RE.test(sent.text)) metaPenalty = 0.55;
  if (sent.text.length > 380) metaPenalty *= 0.6;   // a list dump, not a statement

  const relevance = metaPenalty * focusConflict * (
      0.26 * coverageEff +
      0.22 * semSim +
      0.18 * cue +
      0.16 * focusHit +
      0.12 * quality +
      0.06 * position);

  return {
    ...sent,
    tokens: sTokens,
    relevance,
    signals: {
      rescued: !!opts.rescueCoverage,
      coverage: +coverage.toFixed(3),
      semantic: +semSim.toFixed(3),
      cue: +cue.toFixed(3),
      focus: focusHit,
      focusConflict: +focusConflict.toFixed(2),
      quality: +quality.toFixed(3),
      position: +position.toFixed(3),
    },
  };
}

// ---------------------------------------------------------------------------
// Presentation cleanup
// ---------------------------------------------------------------------------
function polish(text) {
  let t = text.trim()
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:)])/g, '$1')
    .replace(/\(\s+/g, '(')
    .replace(/^[•\-–—*]\s*/, '')
    .replace(/^\d{1,3}\s+(?=[A-Z])/, '');       // stray leading page number
  if (t && !/[.!?:]$/.test(t)) t += '.';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** A sentence that promises a list it does not contain ("...as follows:",
 *  "...listed below:") is a lead-in to a table that did not survive extraction.
 *  Presenting it alone reads as a broken answer. */
function isDanglingLeadIn(text) {
  return /(as follows|listed below|shown below|following (substances|table|list)|below)\s*:?\s*$/i.test(text.trim());
}

/** Sentences that describe the document rather than its subject: "This section
 *  introduces the meter and covers requirements, tests performed...". They score
 *  well on coverage because they enumerate topic words, and they answer nothing. */
function isMetaNavigational(text) {
  const t = text.trim();
  if (/^(this|the following)\s+(section|chapter|manual|guide|document|appendix|part)\b/i.test(t)) return true;
  if (/\b(covers|describes|introduces|explains|outlines|provides an overview)\b/i.test(t)
      && /\b(section|chapter|manual|guide|document|appendix)\b/i.test(t)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------
/**
 * @returns {{sentences:Array, coverage:number, facets:number, rejected:number}}
 */
export function summarise(query, ranked, chunks, opts = {}) {
  const { analysis, semantic, bm25, maxSentences = MAX_SENTENCES } = opts;
  const scope = analysis.scope || null;
  // A scoped question ("currently") wants ONE record read in full, not five
  // records skimmed. Fewer, deeper sentences.
  const cohesive = !analysis.wantsList;
  const intent = analysis.intent;
  const queryTokens = analysis.terms;
  const focus = analysis.focus;

  // IDF from the shipped BM25 table — same weighting the retriever used.
  const idf = (term) => {
    if (!bm25 || !bm25.termId || !bm25.idf) return 1;
    const id = bm25.termId[term];
    return (id === undefined) ? 2.2 : (bm25.idf[id] ?? 1);
  };

  const queryVec = (semantic && semantic.enabled) ? semantic.embed(query) : null;
  const ctx = { queryTokens, idf, intent, focus, semantic, queryVec };

  // ---- candidate pool, weighted by evidence prior --------------------------
  const candidates = [];
  let rejected = 0;

  for (const r of ranked.slice(0, 20)) {
    const chunk = chunks[r.chunkIdx];
    if (!chunk) continue;
<<<<<<< HEAD
    let prior = evidencePrior(chunk, intent, scope);
    if (prior < 0.12) { rejected++; continue; }   // routed out by intent or scope
    // Evidence in the question's own language (a Malayalam title, a Telugu
    // transcript) answers a Malayalam or Telugu question better than a
    // translation ever could — and the fabric never translates.
    const qLang = analysis.lang || 'en';
    if (qLang !== 'en' && (chunk.meta && chunk.meta.lang) === qLang) prior *= 1.6;
=======
    const prior = evidencePrior(chunk, intent, scope);
    if (prior < 0.12) { rejected++; continue; }   // routed out by intent or scope
>>>>>>> dc289be67e7a0eeef540fe78096c081a23ca5af1

    const admitted = [];
    for (const sent of sentencesOf(chunk)) {
      if (sent.text.length < MIN_SENTENCE_CHARS) continue;
      const tablesOk = TABLE_ADMITTING_INTENTS.has(intent.name);
      if (REJECTED_KINDS.has(sent.kind)) { rejected++; continue; }
      if (sent.kind === 'table' && !tablesOk) { rejected++; continue; }
      if (isDanglingLeadIn(sent.text)) { rejected++; continue; }
      if (/\?\s*$/.test(sent.text)) { rejected++; continue; }   // a question is never an answer
      if (isMetaNavigational(sent.text)) { rejected++; continue; }
      admitted.push({ sent, scored: scoreSentence(sent, ctx) });
    }

    // Whole-record reading: when a record's opening line answers the question
    // well, its continuation sentences are admitted too (list questions excepted —
    // they want breadth across records, not depth in one).
    const rt = (chunk.meta && chunk.meta.record_type) || '';
    if (cohesive && WHOLE_RECORD_TYPES.has(rt)) {
      const lead = admitted.find(x => x.scored && x.sent.position === 0);
      if (lead && lead.scored.signals.coverage >= 0.5) {
        // Every continuation sentence is re-read as part of the record: it
        // inherits the lead's focus (the record IS about the thing asked) and,
        // if it has no query words of its own, a share of the lead's coverage.
        for (const x of admitted) {
          if (x === lead) continue;
          x.scored = scoreSentence(x.sent, ctx, { rescueCoverage: lead.scored.signals.coverage * 0.6,
                                                  rescueFocus: !!lead.scored.signals.focus });
        }
      }
    }

    for (const { scored } of admitted) {
      if (!scored) continue;
      candidates.push({
        ...scored,
        chunkIdx: r.chunkIdx,
        chunk,
        prior,
        // Retrieval score is a weak prior here: it ranks passages, not sentences.
        final: scored.relevance * prior * (0.85 + 0.15 * Math.min(1, r.score * 8)),
      });
    }
  }

  if (!candidates.length) return { sentences: [], coverage: 0, facets: 0, rejected };

  // Focus gate. When the question names something and at least two candidate
  // sentences mention it, sentences that never mention it are not evidence for
  // this question — they are evidence for some other question that shares words.
  if (focus.length) {
    const hits = candidates.filter(c => c.signals.focus);
    if (hits.length >= 2) {
      rejected += candidates.length - hits.length;
      candidates.length = 0;
      candidates.push(...hits);
    }
  }

  candidates.sort((a, b) => b.final - a.final);
  const best = candidates[0].final;

  // ---- MMR selection -------------------------------------------------------
  const selected = [];
  const pool = candidates.slice(0, 60);
  let chars = 0;

  while (selected.length < maxSentences && pool.length) {
    let bestIdx = -1, bestScore = -Infinity;

    // Cross-source availability: a fabric answer should not be one record read
    // five sentences deep while a strong second source (the GitHub side of a
    // website project, the resume behind a profile line) waits unused. Once
    // the lead record has had three sentences, it yields to such a source.
    const leadIdx = selected.length ? selected[0].chunkIdx : -1;
    const fromLead = selected.filter(s => s.chunkIdx === leadIdx).length;
    const leadSource = selected.length ? selected[0].chunk.source_type : null;
    const crossReady = fromLead >= 3 && pool.some(c => c.chunk.source_type !== leadSource && c.final >= 0.6 * best);

    for (let i = 0; i < pool.length; i++) {
      const cand = pool[i];
      if (crossReady && cand.chunkIdx === leadIdx) continue;
      let maxSim = 0;
      for (const chosen of selected) {
        const sim = redundancy(cand.tokens, chosen.tokens);
        if (sim > maxSim) maxSim = sim;
      }
      // Record cohesion: once a record is answering, its next sentences
      // (responsibilities after the role line) outrank a different record's
      // opening line — unless the question asked for a list across records.
      // The boost lasts for three sentences of the lead record; after that,
      // other records (the GitHub side of a project, a second source) compete
      // on their own merits — depth first, but never only one voice.
      const fromLead = selected.length ? selected.filter(s => s.chunkIdx === selected[0].chunkIdx).length : 0;
      const cohesion = (cohesive && selected.length && selected[0].chunkIdx === cand.chunkIdx && fromLead < 3) ? 1.45 : 1.0;
      const mmr = MMR_LAMBDA * cand.final * cohesion - (1 - MMR_LAMBDA) * maxSim;
      if (mmr > bestScore) { bestScore = mmr; bestIdx = i; }
    }
    if (bestIdx < 0) break;

    const pick = pool.splice(bestIdx, 1)[0];
    // Relevance floor, relative to the best candidate. Once the strong evidence
    // is used up, padding the reply with sentences a third as relevant makes
    // it longer and worse — a two-sentence answer beats a five-sentence drift.
    // A question with no content words ("Who is Prashobh?") cannot discriminate
    // by coverage, so the floor is relaxed and the summary records carry it.
    let floor = queryTokens.length ? 0.4 : 0.2;
    // The record that opened the answer may continue with sentences that
    // share none of the question's words (a role line, then its duties).
    // Those are the detail the reader came for, so the floor drops for them.
    if (cohesive && selected.length && pick.chunkIdx === selected[0].chunkIdx) floor *= 0.35;
    if (selected.length >= 1 && pick.final < floor * best) break;
    // Hard redundancy floor — a near-paraphrase adds nothing, whatever MMR says.
    const dup = selected.some(s => redundancy(pick.tokens, s.tokens) > 0.62);
    if (dup) { rejected++; continue; }

    const text = polish(pick.text);
    if (chars + text.length > MAX_ANSWER_CHARS && selected.length >= 2) break;

    selected.push({ ...pick, display: text });
    chars += text.length;
  }

  // ---- ordering: group by document, preserve original reading order --------
  // Documents are ordered by their strongest sentence, so the comparator is a
  // total order: every sentence of a record stays together, in reading order,
  // and the discourse markers between them refer to the right record.
  const docBest = new Map();
  for (const s of selected) {
    const d = s.chunk.document_id;
    docBest.set(d, Math.max(docBest.get(d) ?? -Infinity, s.final));
  }
  selected.sort((a, b) => {
    const da = a.chunk.document_id, db = b.chunk.document_id;
    if (da !== db) {
      const diff = docBest.get(db) - docBest.get(da);   // strongest document first
      return diff !== 0 ? diff : String(da).localeCompare(String(db));
    }
    return a.position - b.position;                     // then natural order within it
  });

  // ---- how much of the question did we actually cover ---------------------
  const answered = new Set();
  for (const s of selected) for (const t of queryTokens) if (s.tokens.has(t)) answered.add(t);
  const coverage = queryTokens.length ? answered.size / queryTokens.length : 0;
  const facets = new Set(selected.map(s => s.chunk.document_id)).size;

  return { sentences: selected, coverage, facets, rejected, candidateCount: candidates.length, candidates };
}
