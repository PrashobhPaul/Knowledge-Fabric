// ============================================================================
// Answer pipeline — the one path from a question to an answer
// ============================================================================
//
// Used by the page (main.js) AND by the golden Q&A tests, so what is tested is
// exactly what visitors get: retrieval, the bank assist, the curated canon
// (by meaning when vectors are present, by words otherwise) and the honest
// fallback that never shows a collage of unrelated sentences.

import { cohereByDocument, tokenize } from './search.js?v=5';
import { hybridSearch } from './hybrid.js?v=3';
import { buildAnswer } from './answer.js?v=8';
import { matchQuestionBank } from './questionbank.js?v=3';
import { matchCanon, applyCanon, suggestCanon, contentWords, isImperativeTask, focus, smallTalk, resolveFollowUp, canonDecline } from './canon.js?v=1';
import { expandQuery } from './multilingual.js?v=1';
import { relatedItems } from './related.js?v=1';
import { matchCanonByVector, chunkRun } from './nlu_semantic.js?v=1';

const BANK_STRONG = 0.7, BANK_RESCUE = 0.45;
const esc = (t) => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function retrieve(q, ctx) {
  const { bm25, semantic, chunks, filters = {}, qvec = null, vectors = null } = ctx;
  const h = hybridSearch(q, { bm25, semantic, chunks, filters, topK: 20, extraRun: qvec ? chunkRun(qvec, vectors || undefined) : null });
  const ranked = h.results.length ? h.results.map(r => ({ chunkIdx: r.chunkIdx, score: r.score, _fusion: r })) : bm25.search(q, 20);
  const cohesion = cohereByDocument(ranked, chunks, { queryTerms: tokenize(q), bm25Index: bm25 });
  return { ranked, cohesion, retrieval: { mode: h.mode, ...h.diagnostics },
           ...buildAnswer(q, ranked, chunks, cohesion, { semantic, bm25: ctx.bm25Payload || null, diagnostics: h.diagnostics }) };
}

/**
 * @param {string} question
 * @param {Object} ctx  { index, bm25, bm25Payload, semantic, chunks, filters, qvec, vectors }
 */
/**
 * A retrieval answer is only worth showing when the corpus actually knows the
 * question's words and the evidence is not at the confidence floor. A word the
 * corpus has never seen ("weather") means the question is about something else.
 */
/** Indic-script questions are matched through the lexicon's English forms. */
function canonQuestion(question) {
  const ex = expandQuery(question);
  return ex.lang === 'en' || !ex.added.length ? question : 'your ' + ex.added.join(' ');
}

// Proper names the corpus uses ("Tabo", "Manali", "Qualizeal"): capitalised
// mid-sentence and never written in lower case. Built once per corpus.
const NAMES = new WeakMap();
function corpusNames(chunks) {
  let n = NAMES.get(chunks);
  if (n) return n;
  const caps = new Set(), lower = new Set();
  for (const c of chunks) {
    const t = String(c.text || '');
    for (const m of t.matchAll(/(?<=[a-z0-9,;:)] )([A-Z][\p{L}0-9]+)/gu)) caps.add(m[1].toLowerCase());
    for (const m of t.matchAll(/(?:^|[\s(])([a-z][\p{L}0-9]+)/gu)) lower.add(m[1]);
  }
  n = new Set([...caps].filter(w => w.length >= 3 && !lower.has(w)));
  NAMES.set(chunks, n);
  return n;
}

function weakRetrieval(question, result, bm25, chunks) {
  if (isImperativeTask(question)) return true;
  const pct = result.confidence ? result.confidence.percent : 0;
  if (pct < 50) return true;
  // A question that is not about him ("Who won the 2022 World Cup?") needs evidence
  // that covers most of what it asks, or it is about someone else.
  const aboutHim = /\b(you|your|yours|yourself|u|ur|prashobh|paul|he|his|him|himself)\b/i.test(question);
  if (!aboutHim && (/^\s*who\b/i.test(question) || (result.summary && result.summary.coverage < 0.67))) return true;
  // Not about him and naming nothing of his ("What is the meaning of life?"): not his to answer.
  if (!aboutHim && chunks && expandQuery(question).lang === 'en') {
    const names = corpusNames(chunks);
    if (!tokenize(question).some(w => names.has(w))) return true;
  }
  const vocab = bm25.termId || {};
  const known = (w) => w in vocab || w.replace(/(es|s)$/, '') in vocab || (w + 's') in vocab;
  return contentWords(question).some(w => w.length >= 4 && /^[a-z]+$/.test(w) && !known(w));
}

// Personal data that is private by design: said plainly, never guessed at.
const PRIVATE = /\b((home|house|residential|postal|street) address|salary|ctc|income|net worth|bank account|account number|password|aadhaa?r|pan (number|card)|passport number|blood group|religion|caste|political party)\b/i;

export function answerQuestion(asked, ctx) {
  const { index, bm25, chunks } = ctx;
  // Conversation first: greetings and introductions are not the question, small
  // talk gets a reply, and "it" means the previous question's subject.
  const talk = smallTalk(asked);
  let question = resolveFollowUp(focus(asked), ctx.prev || null, index.canon);
  const bankMatch = matchQuestionBank(question, { vocab: bm25.termId });
  let retrievalQuery = (bankMatch && bankMatch.score >= BANK_STRONG) ? bankMatch.question : question;
  let result = retrieve(retrievalQuery, ctx);
  if (result.lowConfidence && retrievalQuery === question && bankMatch && bankMatch.score >= BANK_RESCUE) {
    const rescued = retrieve(bankMatch.question, ctx);
    if (!rescued.lowConfidence) { result = rescued; retrievalQuery = bankMatch.question; }
  }
  if (talk) {
    const near = suggestCanon('', index.canon, 3);
    return { ...result, answerHtml: `<p class="answer-body">${esc(talk.text)}</p>`
      + `<div class="near-canon">${near.map(q => `<button type="button" class="chip near-chip" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>`,
      citations: [], related: [], smallTalk: talk.kind, summary: { ...(result.summary || {}), sentences: [] },
      canon: { id: 'smalltalk', answer: talk.text, sentences: [talk.text], evidence: [] },
      retrievalQuery, bankMatch: null, canonMatch: { id: 'smalltalk', score: 1, via: 'conversation' } };
  }
  if (PRIVATE.test(question)) {
    return { ...result, answerHtml: `<p class="answer-opener">That is private, so it is not on record.</p>`
      + `<p class="answer-body">For anything professional, the contact form on prashobhpaul.com reaches me directly.</p>`,
      citations: [], noAnswer: true, private: true, related: [], summary: { ...(result.summary || {}), sentences: [] },
      retrievalQuery, bankMatch, canonMatch: null };
  }
  // Curated layer. The word matcher runs first: it is the one the golden rounds
  // test, and it alone knows the career timeline, several-questions-in-one,
  // comparisons and the deliberate declines. Meaning (embeddings) only rescues
  // a question it found nothing for.
  const decline = canonDecline(question, index.canon);
  const lexical = decline ? null : matchCanon(canonQuestion(question), index.canon, { timeline: index.timeline });
  const byVector = (!decline && !lexical && ctx.qvec) ? matchCanonByVector(ctx.qvec, ctx.vectors || undefined, { threshold: 0.6, margin: 0.04 }) : null;
  const vEntry = byVector ? index.canon.find(e => e.id === byVector.id) : null;
  const canonMatch = lexical || (vEntry ? { entry: vEntry, score: byVector.score, via: 'embedding' } : null);
  if (canonMatch) {
    result = applyCanon(result, canonMatch, chunks);
    result.related = relatedItems({ citations: result.citations, ranked: [], analysis: result.analysis, index: { chunks }, weak: false });
  } else if (result.lowConfidence || decline === 'dangling' || weakRetrieval(question, result, bm25, chunks)) {
    const near = suggestCanon(question, index.canon, 3);
    result = { ...result,
      answerHtml: `<p class="answer-opener">I do not have a direct answer to that on record.</p>`
        + `<p class="answer-body">Nothing in my website, resume, GitHub, YouTube or LinkedIn answers it directly, so I will not guess.</p>`
        + (near.length ? `<p class="answer-closing">Closest things I can answer:</p><div class="near-canon">${near.map(q => `<button type="button" class="chip near-chip" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>` : ''),
      citations: result.citations.slice(0, 1), noAnswer: true, related: [],
      summary: { ...(result.summary || {}), sentences: [] } };
  }
  return { ...result, resolvedQuestion: question, retrievalQuery, bankMatch, canonMatch: canonMatch ? { id: canonMatch.entry.id, score: canonMatch.score, via: canonMatch.via || 'lexical' } : null };
}
