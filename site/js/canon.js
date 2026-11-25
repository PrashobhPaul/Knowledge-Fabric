// ============================================================================
// Canon — the curated answers, in the owner's own words, with their proofs
// ============================================================================
//
// knowledge_sources/profile/canon.yaml holds the major questions answered the
// way the owner answers them. The build resolves each evidence link to the
// records that prove it, and ships `index.canon`. At answer time a question that
// matches a canon entry gets the canon answer verbatim, cited with those proof
// records — and the retrieval result stays underneath as corroboration.

import { tokenize } from './search.js?v=5';

const STOP = new Set(['the', 'is', 'are', 'was', 'were', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by',
  'and', 'or', 'do', 'does', 'did', 'what', 'which', 'how', 'who', 'where', 'when', 'tell', 'me', 'about', 'i', 'you',
  'your', 'his', 'he', 'him', 'prashobh', 'paul', 'prashobhs', 's', 'can', 'could', 'would', 'should', 'has', 'have', 'had',
  'any', 'some', 'all', 'please', 'give', 'show']);
function stem(t) {
  if (t.length <= 3) return t;
  if (t.endsWith('ies') && t.length > 4) t = t.slice(0, -3) + 'y';
  else if (/(ches|shes|xes|zes|sses)$/.test(t)) t = t.slice(0, -2);
  else if (t.endsWith('s') && !t.endsWith('ss')) t = t.slice(0, -1);
  if (t.endsWith('ing') && t.length > 5) t = t.slice(0, -3);
  else if (t.endsWith('ed') && t.length > 4) t = t.slice(0, -2);
  return t;
}
const setOf = (q) => new Set(tokenize(String(q)).filter(t => !STOP.has(t)).map(stem));
function sim(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0; for (const t of a) if (b.has(t)) inter++;
  return inter / Math.sqrt(a.size * b.size);
}

/** Best canon entry for a question, or null. Exact variant match wins; else cosine over content stems. */
export function matchCanon(question, canon, { threshold = 0.66 } = {}) {
  if (!Array.isArray(canon) || !canon.length) return null;
  const norm = (s) => String(s).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  const qn = norm(question);
  for (const e of canon) if ((e.questions || []).some(v => norm(v) === qn)) return { entry: e, score: 1 };
  const qs = setOf(question);
  let best = null, bestScore = 0;
  for (const e of canon) for (const v of e.questions || []) {
    const s = sim(qs, setOf(v));
    if (s > bestScore) { bestScore = s; best = e; }
  }
  return best && bestScore >= threshold ? { entry: best, score: bestScore } : null;
}

export function splitSentences(text) {
  return String(text).split(/(?<=[.!?])\s+(?=[A-Z"'(])/).map(s => s.trim()).filter(Boolean);
}

const esc = (t) => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Replace a retrieval result's answer with the canon answer, cited by its proof
 * records. The retrieval citations are kept after the proofs as corroboration.
 */
export function applyCanon(result, match, chunks) {
  const { entry } = match;
  const citations = [];
  const seen = new Set();
  const addCite = (idx, why) => {
    if (idx == null || seen.has(idx) || !chunks[idx]) return;
    seen.add(idx);
    citations.push({ num: citations.length + 1, chunkIdx: idx, chunk: chunks[idx], score: 1, confidence: 1, why });
  };
  for (const ev of entry.evidence || []) for (const idx of (ev.chunk_ids || []).slice(0, 1)) addCite(idx, ev.why);
  for (const c of (result.citations || []).slice(0, 3)) addCite(c.chunkIdx, '');
  const sentences = splitSentences(entry.answer);
  const refs = citations.filter(c => c.why).map(c => `<sup class="cite-ref" data-cite="${c.num}" title="${esc(c.why)}">[${c.num}]</sup>`).join('');
  const html =
    `<p class="answer-opener">In Prashobh's own words:</p>` +
    `<p class="answer-body answer-canon">${esc(entry.answer)} ${refs}</p>` +
    `<p class="answer-closing">Curated answer. Each proof below is a record from the website, resume, GitHub, YouTube or LinkedIn; the fabric's own retrieval is listed after them.</p>`;
  return {
    ...result,
    answerHtml: html,
    citations,
    canon: { id: entry.id, answer: entry.answer, sentences, evidence: entry.evidence, score: match.score },
    summary: { ...(result.summary || {}), sentences: sentences.map((s, i) => ({ text: s, display: s, chunkIdx: citations[0] ? citations[0].chunkIdx : 0, chunk: citations[0] ? citations[0].chunk : chunks[0], final: 1, position: i, tokens: new Set(), signals: {} })) },
    lowConfidence: false,
    verdict: null,
  };
}
