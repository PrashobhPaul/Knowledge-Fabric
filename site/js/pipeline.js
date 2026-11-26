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
import { matchCanon, applyCanon, suggestCanon, contentWords, isImperativeTask, focus, smallTalk, resolveFollowUp, canonDecline, codeCardHtml, sameWord } from './canon.js?v=1';
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
  if (ex.lang === 'en' || !ex.added.length) return question;
  // keep names written in Latin script ("Koode యాప్ ఏమిటి?")
  const latin = String(question).match(/[A-Za-z][A-Za-z.]*(?:\s+[A-Z][A-Za-z.]*)*/g) || [];
  // "നിങ്ങൾ ആരാണ്?" / "आप कौन हैं?": nothing but "you" and "who" means "Who are you?"
  if (!latin.length && ex.added.includes('who is') && ex.added.every(w => /^(you|your|who is|what is)$/.test(w))) return 'Who are you?';
  return 'your ' + [...ex.added, ...latin].join(' ');
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
  // Naming nothing in the corpus ("What is the meaning of life?", "What car do
  // you drive?"): the words occur in my READMEs and notes, but not as an answer.
  // Personal questions are answered by the curated layer or not at all.
  if (chunks && expandQuery(question).lang === 'en') {
    const names = corpusNames(chunks);
    if (!tokenize(question).some(w => names.has(w))) return true;
  }
  const vocab = bm25.termId || {};
  const known = (w) => w in vocab || w.replace(/(es|s)$/, '') in vocab || (w + 's') in vocab;
  return contentWords(question).some(w => w.length >= 4 && /^[a-z]+$/.test(w) && !known(w));
}

// Personal data that is private by design: said plainly, never guessed at.
const PRIVATE = /\b((home|house|residential|postal|street) address|salary|ctc|income|net worth|bank account|bank details|bank info|card details|credit card|debit card|upi id|account number|password|aadhaa?r|pan (number|card)|passport number|blood group|religion|caste|political party)\b/i;

// "Show me your Python code", "How did you write the Koode tracking?": a real
// excerpt from his public repositories, with a permalink to the lines.
const CODE_Q = /\b(code|coding|source code|snippet|implementation|implemented|py file|python file|script|function|github code|show me how you (built|wrote|implemented))\b/i;
const LANG_Q = { python: /\bpython\b/i, kotlin: /\bkotlin\b|\bandroid code\b/i, typescript: /\btypescript\b|\breact\b/i, javascript: /\bjavascript\b|\bjs\b/i };
const sq = (t) => String(t).toLowerCase().replace(/[^a-z0-9]/g, '');
export function pickCode(question, chunks, project = '') {
  if (!CODE_Q.test(question) || isImperativeTask(question)) return null;   // "Write me a function" is an errand
  const q = sq(question), words = new Set(tokenize(question));
  let best = null, bestScore = 0;
  for (const c of chunks) {
    const m = c.meta || {};
    if (m.record_type !== 'code') continue;
    let sc = 0;
    if (project && sq(m.project) === sq(project)) sc += 4;
    else if (project) continue;
    if (sq(m.repository).length > 3 && q.includes(sq(m.repository))) sc += 4;
    if (sq(m.project).length > 3 && q.includes(sq(m.project))) sc += 4;
    if (LANG_Q[m.language] && LANG_Q[m.language].test(question)) sc += 3;
    const repoWords = tokenize(String(m.repository || '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' '));
    for (const w of repoWords) if (w.length > 3 && words.has(w)) sc += 2;
    const near = (a, b) => a === b || (a.length >= 5 && b.length >= 5 && a.slice(0, 5) === b.slice(0, 5));
    for (const t of [...(m.symbols || []), ...String(m.path || '').split(/[\/._-]/)])
      for (const w of tokenize(t.replace(/([a-z])([A-Z])/g, '$1 $2'))) if (w.length > 3 && [...words].some(q => near(q, w))) sc += 1;
    if (/agent|pipeline|engine|scorer|graph|index/i.test(m.path || '')) sc += 0.5;
    if (sc > bestScore) { bestScore = sc; best = c; }
  }
  if (!best || bestScore < 3) return null;
  const m = best.meta;
  return { repo: m.repository, path: m.path, url: best.url, language: m.language, excerpt: String(m.excerpt || '').split('\n').slice(0, 40).join('\n'), chunk: best };
}

// ---------------------------------------------------------------------------
// Catalogue lookup: "Do you have a video about Peace at 14,000 ft?", "What is your
// TripWise project on GitHub?" — the visitor names one item; answer with exactly it.
// ---------------------------------------------------------------------------
const MEDIA_Q = /\b(videos?|vlogs?|shorts?|clips?|watch|youtube|repos?|repository|github|project)\b/i;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const when = (iso) => { const [y, m] = String(iso || '').split('-'); return y && m ? `${MONTHS[Number(m) - 1]} ${y}` : (y || ''); };
const titleWords = (t) => tokenize(String(t).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ')).filter(w => w.length > 1);
export function lookupTitle(question, chunks) {
  if (!MEDIA_Q.test(question)) return null;
  const qw = new Set(titleWords(question)), q = sq(question);
  let best = null, bestScore = 0;
  const hits = [];
  for (const c of chunks) {
    const m = c.meta || {};
    if (m.record_type !== 'video' && m.record_type !== 'repository') continue;
    const name = m.record_type === 'video' ? (c.document_name || '') : String(c.document_name || '').replace(/^GitHub · /, '');
    // Score against the whole title and its main part ("Peace at 14,000 ft | Chandratal | Spiti").
    const segs = [name, ...String(name).split(/\s*(?:\|\|?|#|•|—|–|:| - )\s*/)].filter(x => titleWords(x).length);
    let score = 0, tw = [];
    for (const [k, sg] of segs.entries()) {
      const w = [...new Set(titleWords(sg))];
      // the whole title outranks a part of it, so near-identical titles stay apart
      const sc = (w.filter(x => qw.has(x)).length / w.length) * (k === 0 ? 1 : 0.9) + (k === 0 ? 0.001 * w.length : 0);
      if (sc > score || (sc === score && w.length > tw.length)) { score = sc; tw = w; }
    }
    if (!tw.length) continue;
    if (m.record_type === 'repository' && sq(name).length >= 4 && q.includes(sq(name))) score = Math.max(score, 1);
    if (tw.length < 2 && m.record_type === 'video') score *= 0.6;          // one-word titles are too easy to hit
    if (m.record_type === 'video' && score >= 0.75) hits.push(c);
    if (score > bestScore || (score === bestScore && best && (m.views || 0) > ((best.meta || {}).views || 0))) { bestScore = score; best = c; }
  }
  if (!best || bestScore < 0.75) return null;
  // "Which videos cover Tabo Monastery?": every matching video, most watched first.
  if (/\b(videos|vlogs|shorts|clips)\b/i.test(question)) {
    // every video whose title carries all the topic words asked about
    const topic = titleWords(question).filter(w => !/^(which|what|videos?|vlogs?|shorts?|clips?|cover|covers|about|on|of|have|you|your|do|any|made|show|me|list|all|the|is|are)$/.test(w));
    if (topic.length) for (const c of chunks) {
      const m = c.meta || {};
      if (m.record_type === 'video' && !hits.includes(c) && topic.every(w => titleWords(c.document_name || '').includes(w))) hits.push(c);
    }
  }
  if (/\b(videos|vlogs|shorts|clips)\b/i.test(question) && hits.length >= 2) {
    const list = hits.sort((a, b) => ((b.meta || {}).views || 0) - ((a.meta || {}).views || 0)).slice(0, 6);
    const names = list.map(c => `“${c.document_name.replace(/\s+/g, ' ').trim()}”`);
    const text = `I have ${list.length === hits.length ? list.length : `${hits.length}, here are the top ${list.length}`} videos on that on The Canvas of Earth: `
      + `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}. Each one plays right here.`;
    return { kind: 'videos', chunk: list[0], chunks: list, text };
  }
  const m = best.meta || {};
  if (m.record_type === 'video') {
    const where = (m.places || []).filter(Boolean).slice(0, 2).join(', ');
    const text = `Yes. “${best.document_name.replace(/\s+/g, ' ').trim()}” is on my channel, The Canvas of Earth`
      + `${m.format === 'short' ? ', as a short' : ''}${where ? `, filmed in ${where}` : ''}`
      + `${m.published ? `, published in ${when(m.published)}` : ''}${m.views ? `, with ${Number(m.views).toLocaleString('en-IN')} views` : ''}. It plays right here.`;
    return { kind: 'video', chunk: best, text };
  }
  const repo = String(best.document_name || '').replace(/^GitHub · /, '');
  const readme = chunks.find(c => (c.meta || {}).record_type === 'readme_section' && (c.meta || {}).repository === repo);
  const lead = readme ? String(readme.text).replace(/^[^.]*?—\s*[^.]*\.\s*/, '').split(/(?<=[.!?])\s/).slice(0, 2).join(' ') : '';
  const lang = m.language ? `, written mainly in ${m.language}` : '';
  const upd = m.pushed ? `, last updated in ${when(m.pushed)}` : '';
  const text = `${repo} is one of my public GitHub repositories${lang}${upd}.` + (lead ? ` ${lead}` : (m.description ? ` ${m.description}.` : ''));
  return { kind: 'repository', chunk: best, text: text.replace(/\.\./g, '.') };
}

// ---------------------------------------------------------------------------
// Video moments: "What does Om Mani Padme Hum mean?" is explained in my Key
// Monastery video at 4:12. A chapter (or transcript window) that covers the
// question is quoted in my own words, cited at that second, and plays inline.
// ---------------------------------------------------------------------------
const GENERIC = new Set(['explain', 'explained', 'video', 'videos', 'tell', 'about', 'say', 'said', 'talk', 'describe', 'story', 'behind', 'there', 'why', 'how', 'who', 'what', 'when', 'where']);
const covered = (words, text) => { const tw = tokenize(text); return words.filter(w => tw.some(t => sameWord(w, t))).length; };
export function findMoment(question, chunks) {
  const words = [...new Set(contentWords(question).filter(w => !GENERIC.has(w) && w.length > 1))];
  if (words.length < 2) return null;
  const names = corpusNames(chunks);
  let best = null;
  for (const c of chunks) {
    const m = c.meta || {};
    if (m.record_type !== 'chapter' && m.record_type !== 'transcript') continue;
    const t = String(c.text || '');
    const title = (t.match(/the chapter '(.+?)' begins/) || [])[1] || '';
    const cov = covered(words, t) / words.length, th = covered(words, title);
    if (cov < 0.75 || !(th >= 1 || cov === 1)) continue;
    // it must be about something named ("Om Mani Padme Hum", "Key Monastery"), not "first job"
    // a corpus-wide name, or a word this very record writes as a name mid-sentence ("…landmarks of Spiti Valley—Key Monastery")
    const caps = [...t.matchAll(/(?<=[a-z0-9,;:)—–-] ?)([A-Z][\p{L}]+)/gu)].map(x => x[1].toLowerCase());
    if (!words.some(w => (names.has(w) && tokenize(t).some(x => sameWord(w, x))) || caps.some(x => sameWord(w, x)))) continue;
    // a focused chapter beats a long transcript window that merely contains the words
    const sc = cov + 0.1 * th + (m.record_type === 'chapter' ? 0.05 : 0) + 0.2 * (1 - Math.min(1, t.length / 1200));
    if (!best || sc > best.sc) best = { sc, cov, th, chunk: c, title, words };
  }
  if (!best) return null;
  const t = String(best.chunk.text);
  const video = (t.match(/in the video '(.+?)'/) || [])[1] || best.chunk.document_name || '';
  const at = (t.match(/^At (\d+:\d{2})/) || [])[1] || '';
  const body = t.replace(/^At [^,]+, the chapter '.+?' begins\.\s*/, '').replace(/^At [^.]*?\.\s*/, '').trim();
  // quote from the first sentence that touches the question, four sentences at most
  const sents = body.split(/(?<=[.!?])\s+(?=[A-Z"“'])/);
  const first = Math.max(0, sents.findIndex(x => covered(best.words, x) > 0));
  const said = sents.slice(first, first + 4).join(' ');
  return { ...best, video, at, said };
}
const momentCard = (mo, idxOf) => `<div class="showcase"><div class="sc-cta"><a class="sc-btn sc-primary moment-play" href="${esc(mo.chunk.url)}" data-cite="${idxOf}" target="_blank" rel="noopener">▶ Watch me explain it${mo.at ? ` · from ${esc(mo.at)}` : ''}</a></div></div>`;

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
  const code = pickCode(question, chunks, canonMatch ? (canonMatch.entry.project || '') : '');
  // A named item wins when the visitor asks for the video or the repo itself; a
  // project with a curated answer keeps it otherwise.
  const explicit = /\b(videos?|vlogs?|shorts?|clips?|watch|github|repos?|repository)\b/i.test(question);
  const item = decline || (canonMatch && !explicit) ? null : lookupTitle(question, chunks);
  if (item) {
    const idxOf = chunks.indexOf(item.chunk);
    const cite = { num: 1, chunkIdx: idxOf, chunk: item.chunk, score: 1, confidence: 1, why: item.chunk.document_name };
    result = { ...result,
      answerHtml: `<p class="answer-body answer-canon">${esc(item.text)} <sup class="cite-ref" data-cite="1">[1]</sup></p>`
        + (item.kind === 'repository' ? `<div class="showcase"><div class="sc-cta"><a class="sc-btn sc-primary" href="${esc(item.chunk.url)}" target="_blank" rel="noopener">View ${esc(item.chunk.document_name.replace(/^GitHub · /, ''))} on GitHub</a></div></div>` : ''),
      citations: item.chunks
        ? item.chunks.map((ch, i) => ({ num: i + 1, chunkIdx: chunks.indexOf(ch), chunk: ch, score: 1, confidence: 1, why: ch.document_name }))
        : [cite, ...(result.citations || []).filter(c => c.chunkIdx !== idxOf).slice(0, 2).map((c, i) => ({ ...c, num: i + 2 }))],
      summary: { ...(result.summary || {}), sentences: [{ text: item.text, display: item.text, chunkIdx: idxOf, chunk: item.chunk, final: 1, position: 0, tokens: new Set(), signals: {} }] },
      canon: { id: 'catalogue', answer: item.text, sentences: [item.text], evidence: [] },
      lowConfidence: false, verdict: null, catalogue: item.kind };
    result.related = relatedItems({ citations: result.citations, ranked: [], analysis: result.analysis, index: { chunks }, weak: false });
    return { ...result, answerLang: (result.canon && result.canon.lang) || 'en', resolvedQuestion: question, retrievalQuery, bankMatch, canonMatch: { id: 'catalogue', score: 1, via: item.kind }, code: null };
  }
  // Answer language: the script the question was written in, else the visitor's chosen language.
  const scriptLang = expandQuery(asked).lang;
  const answerLang = scriptLang !== 'en' ? scriptLang : (ctx.answerLang || 'en');
  // A video moment leads when it covers the question better than the curated answer does.
  const moment = decline ? null : findMoment(question, chunks);
  const canonCov = canonMatch && moment ? covered(moment.words, canonMatch.entry.answer) / moment.words.length : 0;
  // Lead with the moment only when its chapter title names what was asked; a strong
  // curated answer keeps the lead otherwise, with the moment beneath it.
  const momentLeads = !!(moment && moment.said && !code && (!canonMatch
    || (canonMatch.score < 0.75 && moment.th >= 2 && moment.cov >= canonCov)));
  if (momentLeads) {
    const ci = chunks.indexOf(moment.chunk);
    const cite = { num: 1, chunkIdx: ci, chunk: moment.chunk, score: 1, confidence: 1, why: `${moment.video}${moment.at ? ' at ' + moment.at : ''}` };
    const opener = `I explain this in my video “${moment.video}”${moment.at ? `, at ${moment.at}` : ''}:`;
    result = { ...result,
      answerHtml: `<p class="answer-opener">${esc(opener)}</p><p class="answer-body answer-canon">${esc(moment.said)} <sup class="cite-ref" data-cite="1" title="${esc(cite.why)}">[1]</sup></p>` + momentCard(moment, 1),
      citations: [cite, ...(result.citations || []).filter(c => c.chunkIdx !== ci).slice(0, 2).map((c, i) => ({ ...c, num: i + 2 }))],
      summary: { ...(result.summary || {}), sentences: [opener, ...moment.said.split(/(?<=[.!?])\s+/)].map((x, i) => ({ text: x, display: x, chunkIdx: ci, chunk: moment.chunk, final: 1, position: i, tokens: new Set(), signals: {} })) },
      canon: { id: 'moment', answer: moment.said, sentences: [opener, ...moment.said.split(/(?<=[.!?])\s+/)], evidence: [], lang: 'en' },
      lowConfidence: false, verdict: null, moment: { url: moment.chunk.url, at: moment.at } };
    result.related = relatedItems({ citations: result.citations, ranked: [], analysis: result.analysis, index: { chunks }, weak: false });
    return { ...result, answerLang: 'en', resolvedQuestion: question, retrievalQuery, bankMatch, canonMatch: { id: 'moment', score: moment.cov, via: 'video' }, code: null };
  }
  if (canonMatch) {
    result = applyCanon(result, { ...canonMatch, lang: answerLang }, chunks, index.showcase || {});
    if (moment && !(result.answerHtml || '').includes(moment.chunk.url))     // the curated answer leads; the video moment backs it
      result.answerHtml = result.answerHtml.replace('<p class="answer-closing">Curated answer.', momentCard(moment, 0) + '<p class="answer-closing">Curated answer.');
    if (code && !(result.answerHtml || '').includes(code.url)) result.answerHtml = result.answerHtml.replace('<p class="answer-closing">Curated answer.', codeCardHtml(code, true) + '<p class="answer-closing">Curated answer.');
    result.related = relatedItems({ citations: result.citations, ranked: [], analysis: result.analysis, index: { chunks }, weak: false });
  } else if (code) {
    // A developer question with no curated answer: the code itself is the answer.
    result = { ...result, answerHtml: `<p class="answer-opener">Here is how I wrote it, straight from my GitHub:</p>` + codeCardHtml(code, true),
      citations: [{ num: 1, chunkIdx: chunks.indexOf(code.chunk), chunk: code.chunk, score: 1, confidence: 1, why: `${code.repo}/${code.path}` }],
      summary: { ...(result.summary || {}), sentences: [{ text: `Here is how I wrote it, in ${code.repo}.`, display: `Here is how I wrote it, in ${code.repo}.`, chunkIdx: chunks.indexOf(code.chunk), chunk: code.chunk, final: 1, position: 0, tokens: new Set(), signals: {} }] },
      lowConfidence: false, verdict: null, codeAnswer: true };
  } else if (result.lowConfidence || decline === 'dangling' || weakRetrieval(question, result, bm25, chunks)) {
    const near = suggestCanon(question, index.canon, 3);
    result = { ...result,
      answerHtml: `<p class="answer-opener">I do not have a direct answer to that on record.</p>`
        + `<p class="answer-body">Nothing in my website, resume, GitHub, YouTube or LinkedIn answers it directly, so I will not guess.</p>`
        + (near.length ? `<p class="answer-closing">Closest things I can answer:</p><div class="near-canon">${near.map(q => `<button type="button" class="chip near-chip" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>` : ''),
      citations: result.citations.slice(0, 1), noAnswer: true, related: [],
      summary: { ...(result.summary || {}), sentences: [] } };
  }
  return { ...result, answerLang: (result.canon && result.canon.lang) || 'en', resolvedQuestion: question, retrievalQuery, bankMatch, canonMatch: canonMatch ? { id: canonMatch.entry.id, score: canonMatch.score, via: canonMatch.via || 'lexical' } : (result.codeAnswer ? { id: 'code', score: 1, via: 'code' } : null), code: code ? { repo: code.repo, path: code.path, url: code.url } : null };
}
