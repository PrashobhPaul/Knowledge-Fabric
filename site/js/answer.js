// =============================================================================
// Answer composer — query-focused extractive summarisation
// =============================================================================
//
// Replaces a "top-N sentences by query-term overlap, concatenated" composer.
// That approach fails in predictable ways on a personal corpus:
//
//   Q "where does Prashobh work currently"
//     -> a travel-video description, because it repeats "work" densely
//   Q "what are his skills"
//     -> the same skills sentence four times, lightly reworded
//   Q "what is Koode"
//     -> opened with an unrelated explainer that happened to share words
//
// The pipeline now is:
//
//   NLU  ->  evidence routing  ->  sentence scoring  ->  MMR  ->  assembly
//
// with a real confidence figure computed from the retrieval run rather than a
// constant. Each stage is separately inspectable, which is what makes the
// answer defensible in front of a technical audience.

import { analyseQuestion, rerankByIntent, anchorRecordTypes, termSatisfied } from './nlu.js?v=7';
import { relatedItems } from './related.js?v=1';
import { expandQuery } from './multilingual.js?v=1';
import { summarise } from './summarize.js?v=7';
import { computeConfidence } from './confidence.js?v=8';
import { composeResponse, composeNoAnswer } from './compose.js?v=8';

/**
 * @param {string} query
 * @param {Array} ranked      [{chunkIdx, score}]
 * @param {Array} chunks      index chunk array
 * @param {Object} cohesion   from cohereByDocument (retained for compatibility)
 * @param {Object} opts       { semantic, bm25, diagnostics }
 */
export function buildAnswer(query, ranked, chunks, cohesion = {}, opts = {}) {
  query = expandQuery(query).query;   // same expansion retrieval used
  const { semantic = null, bm25 = null, diagnostics = null } = opts;

  if (!ranked || !ranked.length) {
    return {
      answerHtml: 'No passage in the corpus matched that question.',
      citations: [], lowConfidence: true, confidence: null, analysis: null,
    };
  }

  const analysis = analyseQuestion(query);

  const idf = (term) => {
    if (!bm25 || !bm25.termId || !bm25.idf) return 1;
    const id = bm25.termId[term];
    return (id === undefined) ? 2.2 : (bm25.idf[id] ?? 1);
  };

  // Anchor records: for intents that strongly prefer one record type (the
  // one-paragraph summary for "who is", the contact record for "how do I
  // reach"), make sure those chunks are in the pool. Retrieval can miss them
  // when the question has no content words left after stopword removal.
  const anchors = anchorRecordTypes(analysis.intent);
  let pooled = ranked;
  if (anchors.length) {
    const present = new Set(ranked.map(r => r.chunkIdx));
    const floor = ranked.length ? ranked[Math.min(ranked.length - 1, 4)].score : 0.01;
    const extra = [];
    chunks.forEach((c, i) => {
      if (!present.has(i) && anchors.includes(c.meta && c.meta.record_type)) {
        extra.push({ chunkIdx: i, score: floor * 0.9, anchored: true });
      }
    });
    if (extra.length && extra.length <= 12) pooled = [...ranked, ...extra];
  }

  // Evidence routing runs here, on the retrieved pool, before summarisation.
  // Applying it later would be too late — the pool would already be full of
  // records that match the words but cannot answer the question.
  const routed = rerankByIntent(pooled, chunks, analysis.intent, { scope: analysis.scope });
  // Routed evidence first; the raw ranking only tops the pool up when routing
  // left it thin (a "short bio" question whose words retrieve YouTube Shorts).
  const routedIdx = new Set(routed.map(r => r.chunkIdx));
  const pool = routed.length >= 3 ? routed : [...routed, ...ranked.filter(r => !routedIdx.has(r.chunkIdx))];

  const summary = summarise(query, pool, chunks, { analysis, semantic, bm25 });

  // ---- nothing survived routing + quality filters --------------------------
  if (!summary.sentences.length) {
    const top = chunks[ranked[0].chunkIdx];
    const conf = computeConfidence({ analysis, ranked: pool, sentences: [], diagnostics, idf });
    return {
      answerHtml: composeNoAnswer(analysis, top.document_name, summary.rejected),
      citations: [{ num: 1, chunkIdx: ranked[0].chunkIdx, chunk: top, score: ranked[0].score, confidence: 0.2 }],
      lowConfidence: true,
      confidence: conf,
      analysis,
      summary,
      related: relatedItems({ citations: [], ranked, analysis, index: { chunks }, weak: true }),
    };
  }

  // ---- yes/no verdict ---------------------------------------------------------
  // A single evidence sentence must satisfy every predicate term for "yes".
  // Scattered partial matches across sentences are exactly how a dump fakes a
  // yes, so they count as "not directly".
  let verdict = null;
  if (analysis.polar && analysis.predicate.length) {
    const preds = analysis.predicate;
    const n = preds.length;
    const head = preds.find(p => p.head) || preds[0];
    // Per sentence: which terms it satisfies, and whether the head is among them.
    const scored = summary.sentences.map(s => {
      const sat = preds.filter(p => termSatisfied(s.text, p));
      return { s, sat, satHead: sat.includes(head), n: sat.length };
    });
    // "X or Y" needs the head plus either side, not both.
    const need = analysis.disjunctive ? Math.min(n, 2) : n;
    const full = scored.find(x => x.satHead && x.n >= need);
    const headAnywhere = scored.some(x => x.satHead);
    const bestN = Math.max(0, ...scored.map(x => x.n));
    // yes      — one sentence carries the head and every required term
    // partial  — the head is supported somewhere and most terms are met in one place
    // no       — the head (the thing actually asked) is nowhere in the evidence
    const kind = full ? 'yes'
      : (headAnywhere && bestN >= Math.ceil(n / 2)) ? 'partial'
      : 'no';
    const missing = full ? [] : preds.filter(p => !scored.some(x => x.sat.includes(p)));
    verdict = { kind, head: head.term, missing: missing.length ? missing : [head], satisfied: bestN, of: n };

    // Evidence discipline: a verdict is followed by the sentences that bear on
    // it, not by everything retrieval surfaced. Keep the most-satisfying
    // sentences; for a "no", the closest related material only.
    const keepN = kind === 'yes' ? 3 : 2;
    const threshold = kind === 'no' ? Math.max(1, bestN) : Math.max(1, Math.ceil(n / 2));
    let kept = scored.filter(x => x.n >= threshold || (kind !== 'no' && x.satHead));
    if (!kept.length) kept = scored.slice(0, 1);
    kept.sort((a, b) => (b.satHead - a.satHead) || (b.n - a.n) || (b.s.final - a.s.final));
    summary.sentences = kept.slice(0, keepN).map(x => x.s);
    // Reading order within what survived, by record then position.
    summary.sentences.sort((a, b) => a.chunkIdx - b.chunkIdx || (a.sentIdx || 0) - (b.sentIdx || 0));
  }

  // ---- citation numbering, in order of first appearance --------------------
  const citationsByChunk = new Map();
  for (const s of summary.sentences) {
    if (!citationsByChunk.has(s.chunkIdx)) {
      citationsByChunk.set(s.chunkIdx, {
        num: citationsByChunk.size + 1,
        chunkIdx: s.chunkIdx,
        chunk: s.chunk,
        score: s.final,
        signals: s.signals,
      });
    }
  }

  const citations = [...citationsByChunk.values()];
  const maxScore = Math.max(...citations.map(c => c.score), 1e-6);
  for (const c of citations) c.confidence = c.score / maxScore;

  const confidence = computeConfidence({
    analysis, ranked: pool, sentences: summary.sentences, diagnostics, idf,
  });

  // Compose the reply: opener, evidence connected by discourse markers, and a
  // closing note when there is something the reader should know about the
  // limits of the answer.
  const composed = composeResponse(analysis, summary.sentences, citations, confidence, summary, verdict);
  const weak = confidence.percent < 45 || (verdict && verdict.kind !== 'yes');

  return {
    answerHtml: composed.html,
    verdict,
    related: relatedItems({ citations, ranked, analysis, index: { chunks }, weak }),
    answerPlain: composed.plain,
    interpretation: labelFor(analysis),
    citations,
    lowConfidence: confidence.percent < 45,
    confidence,
    analysis,
    summary,
    primarySource: cohesion.dominantDoc || null,
  };
}

function labelFor(analysis) {
  const focus = analysis.focus.length
    ? analysis.focus.slice(0, 2).map(titleCase).join(' · ')
    : null;
  const intent = analysis.intent.name.replace(/_/g, ' ').toLowerCase();
  return `Interpreted as a <strong>${escapeHtml(intent)}</strong> question` +
         (focus ? ` about <strong>${escapeHtml(focus)}</strong>` : '') +
         ` — looking for ${escapeHtml(analysis.intent.wants || 'a direct answer')}.`;
}

function titleCase(s) {
  return String(s).replace(/\b\w/g, c => c.toUpperCase());
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
