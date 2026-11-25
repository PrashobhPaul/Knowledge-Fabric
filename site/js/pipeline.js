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
import { matchCanon, applyCanon, suggestCanon } from './canon.js?v=1';
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
export function answerQuestion(question, ctx) {
  const { index, bm25, chunks } = ctx;
  const bankMatch = matchQuestionBank(question, { vocab: bm25.termId });
  let retrievalQuery = (bankMatch && bankMatch.score >= BANK_STRONG) ? bankMatch.question : question;
  let result = retrieve(retrievalQuery, ctx);
  if (result.lowConfidence && retrievalQuery === question && bankMatch && bankMatch.score >= BANK_RESCUE) {
    const rescued = retrieve(bankMatch.question, ctx);
    if (!rescued.lowConfidence) { result = rescued; retrievalQuery = bankMatch.question; }
  }
  // Curated layer: by meaning when the question vector and canon vectors exist,
  // else by words (synonyms, typo tolerance, cue keywords).
  const byVector = ctx.qvec ? matchCanonByVector(ctx.qvec, ctx.vectors || undefined) : null;
  const canonMatch = byVector && index.canon.find(e => e.id === byVector.id)
    ? { entry: index.canon.find(e => e.id === byVector.id), score: byVector.score, via: 'embedding' }
    : matchCanon(question, index.canon);
  if (canonMatch) {
    result = applyCanon(result, canonMatch, chunks);
    result.related = relatedItems({ citations: result.citations, ranked: [], analysis: result.analysis, index: { chunks }, weak: false });
  } else if (result.lowConfidence) {
    const near = suggestCanon(question, index.canon, 3);
    result = { ...result,
      answerHtml: `<p class="answer-opener">I do not have a direct answer to that on record.</p>`
        + `<p class="answer-body">Nothing in my website, resume, GitHub, YouTube or LinkedIn answers it directly, so I will not guess.</p>`
        + (near.length ? `<p class="answer-closing">Closest things I can answer:</p><div class="near-canon">${near.map(q => `<button type="button" class="chip near-chip" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>` : ''),
      citations: result.citations.slice(0, 1), noAnswer: true, related: [],
      summary: { ...(result.summary || {}), sentences: [] } };
  }
  return { ...result, retrievalQuery, bankMatch, canonMatch: canonMatch ? { id: canonMatch.entry.id, score: canonMatch.score, via: canonMatch.via || 'lexical' } : null };
}
