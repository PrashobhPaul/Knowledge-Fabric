// Golden Q&A evaluator: runs every question through the production pipeline and
// prints misses with the top candidates, so the matcher can be tuned against evidence.
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const SITE = path.join(ROOT, 'site');
const idx = JSON.parse(fs.readFileSync(path.join(SITE, 'data/index.json'), 'utf8'));
const sem = JSON.parse(fs.readFileSync(path.join(SITE, 'data/semantic.json'), 'utf8'));
const { BM25 } = await import(path.join(SITE, 'js/search.js')); const { SemanticIndex } = await import(path.join(SITE, 'js/semantic.js'));
const { answerQuestion } = await import(path.join(SITE, 'js/pipeline.js')); const { rankCanon } = await import(path.join(SITE, 'js/canon.js'));
const G = JSON.parse(fs.readFileSync(path.join(ROOT, process.argv[2] || 'tests/qa_gold.json'), 'utf8'));
const ctx = { index: idx, bm25: new BM25(idx.bm25), bm25Payload: idx.bm25, semantic: new SemanticIndex(sem), chunks: idx.chunks, filters: {}, qvec: null };
const plain = (h) => String(h).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
let ok = 0; const misses = [];
for (const c of G.cases) {
  const r = answerQuestion(c.q, { ...ctx, prev: c.prev || null }); const got = r.canonMatch ? r.canonMatch.id : (r.noAnswer ? 'NO-ANSWER' : 'RETRIEVAL');
  const text = plain(r.answerHtml).toLowerCase();
  const lacking = (c.must_all || []).filter(t => !text.includes(String(t).toLowerCase()));   // rubric points the answer must cover
  const factOk = (!c.must || plain(r.answerHtml).includes(c.must)) && !lacking.length;
  if (c.cite) {   // the answer must cite (or offer) this exact source
    const urls = [...(r.citations || []).map(x => x.chunk.url || ''), ...(r.related || []).map(x => x.url || ''), r.answerHtml || ''].join(' ');
    if (!r.noAnswer && urls.includes(c.cite)) ok++;
    else misses.push(`${c.q}  →  ${got} (does not cite ${c.cite})`);
    continue;
  }
  const want = Array.isArray(c.id) ? c.id : [c.id];
  // A wording variant may add a second relevant answer, never lose the expected one.
  const gotOk = want.includes(got) || (c.kind === 'variant' && got.split('+').some(x => want.includes(x)));
  if (gotOk && factOk) ok++;
  else misses.push(`${c.q}  →  ${got}${factOk ? '' : ' (missing "' + c.must + '")'}  [want ${c.id}]  top: ${(rankCanon ? rankCanon(c.q, idx.canon).slice(0, 3).map(x => x.id + ':' + x.score.toFixed(2)).join(' ') : '')}`);
}
let na = 0; for (const q of G.no_answer) { const r = answerQuestion(q, ctx); if (r.noAnswer) na++; else misses.push(`NO-ANSWER expected: ${q} → ${r.canonMatch ? r.canonMatch.id + ':' + r.canonMatch.score.toFixed(2) : 'retrieval'}`); }
console.log(`canon ${ok}/${G.cases.length} · no-answer ${na}/${G.no_answer.length}`);
for (const m of misses) console.log('  MISS', m);
process.exit(misses.length ? 1 : 0);
