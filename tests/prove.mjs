// =============================================================================
// Proof of accuracy and consistency — one command, one report
// =============================================================================
//
// Runs the production answer path (site/js/pipeline.js answerQuestion, the code
// visitors run) against the built index, exactly as tests/qa_eval.mjs does, and
// proves six things about it:
//
//   1. Accuracy              every tests/qa_*.json set, every check it carries
//   2. Determinism           every interview question, three runs, one answer
//   3. Context independence  every interview question after unrelated questions
//   4. Paraphrase consistency every phrasing of a curated answer lands on it
//   5. Grounding             cited answers, resolved evidence, no client names
//   6. Performance           answer latency and index size
//
// Writes tests/reports/PROOF.md (for people) and tests/reports/proof.json (for
// diffs and the growth report) and exits 1 if any check fails.
//
// Usage:
//   node tests/prove.mjs                     prove the index as built
//   node tests/prove.mjs --build             rebuild the index first, and time it
//   node tests/prove.mjs --json F --md F     write the reports somewhere else

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawnSync } from 'child_process';
import { performance } from 'perf_hooks';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const TESTS = path.join(ROOT, 'tests');
const arg = (name, dflt) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : dflt; };
const JSON_OUT = path.resolve(ROOT, arg('--json', 'tests/reports/proof.json'));
const MD_OUT = path.resolve(ROOT, arg('--md', 'tests/reports/PROOF.md'));
const P95_LIMIT_MS = 250;
// Unrelated questions a visitor might have asked just before: a product, travel
// videos, the career. Each names something a pronoun could wrongly latch onto.
const PREVIOUS = ['What is Koode?', 'Which videos have you made about Spiti?', 'What did you do at TCS?'];
const CLIENT = /\b(Southwest|PwC|American Express|Amex)\b/i;

// ------------------------------------------------------------------ build (optional)
let build = null;
if (process.argv.includes('--build')) {
  const t0 = performance.now();
  const py = process.env.PYTHON || 'python';
  const res = spawnSync(py, ['-m', 'pipeline.build_index', '--source', 'docs_source', '--knowledge', 'knowledge_sources',
    '--out', 'site/data/index.json', '--semantic-out', 'site/data/semantic.json'], { cwd: ROOT, encoding: 'utf8' });
  const seconds = (performance.now() - t0) / 1000;
  if (res.status !== 0) { console.error(res.stdout, res.stderr); console.error('build failed'); process.exit(2); }
  const unresolved = (res.stdout.match(/(\d+) unresolved evidence links/) || [])[1];
  build = { seconds: +seconds.toFixed(2), command: 'python -m pipeline.build_index', unresolved_reported: unresolved == null ? null : Number(unresolved) };
  console.log(`build: ${build.seconds}s`);
}

// ------------------------------------------------------------------ load, exactly like qa_eval.mjs
const indexPath = path.join(SITE, 'data/index.json'), semPath = path.join(SITE, 'data/semantic.json');
if (!fs.existsSync(indexPath)) { console.error('index.json missing — run: python -m pipeline.build_index (or node tests/prove.mjs --build)'); process.exit(2); }
const idx = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
const sem = JSON.parse(fs.readFileSync(semPath, 'utf8'));
const { BM25 } = await import(path.join(SITE, 'js/search.js'));
const { SemanticIndex } = await import(path.join(SITE, 'js/semantic.js'));
const { answerQuestion } = await import(path.join(SITE, 'js/pipeline.js'));
const ctx = { index: idx, bm25: new BM25(idx.bm25), bm25Payload: idx.bm25, semantic: new SemanticIndex(sem), chunks: idx.chunks, filters: {}, qvec: null };

const plain = (h) => String(h).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const sha = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const idOf = (r) => r.canonMatch ? r.canonMatch.id : (r.noAnswer ? 'NO-ANSWER' : 'RETRIEVAL');
const HONEST = /do not have a direct answer|private, so it is not on record/;
const latencies = [];
let firstCallMs = null;
function ask(q, prev = null, timed = false) {
  const t0 = performance.now();
  const r = answerQuestion(q, { ...ctx, prev });
  const ms = performance.now() - t0;
  if (timed) { latencies.push(ms); if (firstCallMs === null) firstCallMs = ms; }
  return { r, got: idOf(r), text: plain(r.answerHtml), ms };
}
const fmt = (n) => Number(n).toLocaleString('en-US');
const ratio = (a, b) => b ? `${fmt(a)}/${fmt(b)}` : '—';
const pct = (a, b) => b ? `${(100 * a / b).toFixed(1)}%` : '—';
const verdict = (ok) => ok ? 'PASS' : 'FAIL';

const SETS = fs.readdirSync(TESTS).filter(f => /^qa_.*\.json$/.test(f)).sort()
  .map(f => ({ file: f, data: JSON.parse(fs.readFileSync(path.join(TESTS, f), 'utf8')) }));
const isInterview = (f) => /^qa_interview_/.test(f);

// =============================================================================
// 1. Accuracy — the same rules as qa_eval.mjs, counted check by check
// =============================================================================
const accuracy = [];
const served = [];                 // every response, for grounding
const fingerprints = {};           // set -> per-question answer fingerprint, for before/after diffs
for (const { file, data } of SETS) {
  const row = { set: file, questions: 0, passed: 0, id: [0, 0], must: [0, 0], must_all: [0, 0], rubric_points: [0, 0], cite: [0, 0], no_answer: [0, 0], failures: [] };
  fingerprints[file] = [];
  for (const c of data.cases) {
    const { r, got, text, ms } = ask(c.q, c.prev || null, true);
    served.push({ q: c.q, r, got, text });
    fingerprints[file].push(`${got}#${sha(r.answerHtml).slice(0, 12)}`);
    row.questions++;
    const why = [];
    if (c.cite) {
      const urls = [...(r.citations || []).map(x => x.chunk.url || ''), ...(r.related || []).map(x => x.url || ''), r.answerHtml || ''].join(' ');
      const ok = !r.noAnswer && urls.includes(c.cite);
      row.cite[1]++; if (ok) row.cite[0]++; else why.push(`does not cite ${c.cite}`);
    } else {
      const want = Array.isArray(c.id) ? c.id : [c.id];
      const ok = want.includes(got) || (c.kind === 'variant' && got.split('+').some(x => want.includes(x)));
      row.id[1]++; if (ok) row.id[0]++; else why.push(`got ${got}, want ${want.join('|')}`);
      if (c.must) { const okm = text.includes(c.must); row.must[1]++; if (okm) row.must[0]++; else why.push(`lacks "${c.must}"`); }
      if (c.must_all && c.must_all.length) {
        const lacking = c.must_all.filter(t => !text.toLowerCase().includes(String(t).toLowerCase()));
        row.must_all[1]++; if (!lacking.length) row.must_all[0]++; else why.push(`misses rubric ${lacking.join(', ')}`);
        row.rubric_points[1] += c.must_all.length; row.rubric_points[0] += c.must_all.length - lacking.length;
      }
    }
    if (why.length) row.failures.push(`"${c.q}" → ${why.join('; ')}`); else row.passed++;
  }
  for (const q of data.no_answer || []) {
    const { r, got, text } = ask(q, null, true);
    served.push({ q, r, got, text });
    fingerprints[file].push(`${got}#${sha(r.answerHtml).slice(0, 12)}`);
    row.questions++;
    row.no_answer[1]++;
    if (r.noAnswer && HONEST.test(text)) { row.no_answer[0]++; row.passed++; }
    else row.failures.push(`"${q}" should be declined honestly → ${got}`);
  }
  accuracy.push(row);
}
const accTotal = accuracy.reduce((t, r) => {
  for (const k of ['questions', 'passed']) t[k] += r[k];
  for (const k of ['id', 'must', 'must_all', 'rubric_points', 'cite', 'no_answer']) { t[k][0] += r[k][0]; t[k][1] += r[k][1]; }
  return t;
}, { questions: 0, passed: 0, id: [0, 0], must: [0, 0], must_all: [0, 0], rubric_points: [0, 0], cite: [0, 0], no_answer: [0, 0] });
const accOk = accTotal.passed === accTotal.questions;
console.log(`1 accuracy        ${accTotal.passed}/${accTotal.questions}`);

// =============================================================================
// 0. The interview brief itself: every question in it is asked, and passes
// =============================================================================
const normQ = (s) => String(s).toLowerCase().replace(/\s+/g, ' ').trim();
const interviewCases = SETS.filter(s => isInterview(s.file)).flatMap(s => s.data.cases.map(c => ({ ...c, set: s.file })));
const briefQs = [];
const briefPath = path.join(TESTS, 'interview_brief.md');
if (fs.existsSync(briefPath)) {
  for (const l of fs.readFileSync(briefPath, 'utf8').split('\n')) {
    const m = l.match(/^\s*(?:-|\d+\.)\s+(.*[?.])\s*$/);
    if (m) briefQs.push(m[1].replace(/^(Advanced|Probe):\s*/, ''));
  }
}
const failedQs = new Set(accuracy.flatMap(r => r.failures.map(f => normQ(f.slice(1, f.indexOf('" →'))))));
const brief = briefQs.map(q => {
  const c = interviewCases.find(x => normQ(x.q) === normQ(q));
  return { q, set: c ? c.set : null, id: c ? c.id : null, asked: !!c, passed: !!c && !failedQs.has(normQ(c.q)) };
});
const briefOk = brief.every(b => b.asked && b.passed);
console.log(`0 brief coverage  ${brief.filter(b => b.asked && b.passed).length}/${brief.length}`);

// =============================================================================
// 2. Determinism — three runs, three orders, one answer
// =============================================================================
// Run 1 in file order, run 2 in reverse, run 3 in a fixed shuffle: no answer may
// depend on what was asked before it or on what the caches hold.
function shuffled(xs, seed = 20261126) {
  const a = [...xs]; let s = seed;
  for (let i = a.length - 1; i > 0; i--) { s = (s * 1103515245 + 12345) % 2147483648; const j = s % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const order = interviewCases.map((_, i) => i);
const runs = [order, [...order].reverse(), shuffled(order)].map(seq => {
  const out = new Array(interviewCases.length);
  for (const i of seq) { const { r, got } = ask(interviewCases[i].q); out[i] = { got, hash: sha(r.answerHtml) }; }
  return out;
});
const determinism = interviewCases.map((c, i) => {
  const ids = new Set(runs.map(x => x[i].got)), hashes = new Set(runs.map(x => x[i].hash));
  return { q: c.q, set: c.set, ids: [...ids], hashes: hashes.size, ok: ids.size === 1 && hashes.size === 1 };
});
const detOk = determinism.every(d => d.ok);
console.log(`2 determinism     ${determinism.filter(d => d.ok).length}/${determinism.length}`);

// =============================================================================
// 3. Context independence — a follow-up position must not change the answer
// =============================================================================
const context = interviewCases.map((c, i) => {
  const cold = runs[0][i];
  const after = PREVIOUS.map(p => { const { r, got } = ask(c.q, p); return { prev: p, got, sameText: sha(r.answerHtml) === cold.hash }; });
  return { q: c.q, set: c.set, cold: cold.got, after, ok: after.every(a => a.got === cold.got) };
});
const ctxPairs = context.reduce((n, c) => n + c.after.length, 0);
const ctxSame = context.reduce((n, c) => n + c.after.filter(a => a.got === c.cold).length, 0);
const ctxSameText = context.reduce((n, c) => n + c.after.filter(a => a.sameText).length, 0);
const ctxOk = context.every(c => c.ok);
console.log(`3 context         ${ctxSame}/${ctxPairs}`);

// =============================================================================
// 4. Paraphrase consistency — every phrasing of a curated answer lands on it
// =============================================================================
const canonIds = new Set(idx.canon.map(e => e.id));
const groups = new Map();
let multiExpect = 0;
for (const { file, data } of SETS) for (const c of data.cases) {
  if (c.cite) continue;
  if (Array.isArray(c.id)) { multiExpect++; continue; }      // several answers accepted by design: not one target
  if (!canonIds.has(c.id)) continue;
  const key = normQ(c.q) + '|' + (c.prev || '');
  const g = groups.get(c.id) || { id: c.id, phrasings: new Map() };
  if (!g.phrasings.has(key)) g.phrasings.set(key, { q: c.q, prev: c.prev || null, kind: c.kind || '', sets: [] });
  g.phrasings.get(key).sets.push(file);
  groups.set(c.id, g);
}
const paraphrase = [...groups.values()].filter(g => g.phrasings.size >= 2).map(g => {
  const misses = [];
  for (const p of g.phrasings.values()) {
    const { got } = ask(p.q, p.prev);
    if (!(got === g.id || (p.kind === 'variant' && got.split('+').includes(g.id)))) misses.push(`"${p.q}" → ${got}`);
  }
  return { id: g.id, phrasings: g.phrasings.size, sets: [...new Set([...g.phrasings.values()].flatMap(p => p.sets))].length, landed: g.phrasings.size - misses.length, misses, ok: !misses.length };
}).sort((a, b) => (b.phrasings - a.phrasings) || a.id.localeCompare(b.id));
const paraOk = paraphrase.every(p => p.ok);
const paraPhrasings = paraphrase.reduce((n, p) => n + p.phrasings, 0);
console.log(`4 paraphrase      ${paraphrase.filter(p => p.ok).length}/${paraphrase.length} answers · ${paraPhrasings} phrasings`);

// =============================================================================
// 5. Grounding — cited, proven, confidential
// =============================================================================
const canonById = new Map(idx.canon.map(e => [e.id, e]));
const curatedResp = served.filter(s => s.r.canonMatch && s.got.split('+').every(id => canonById.has(id)));
const proofIds = (id) => new Set(id.split('+').flatMap(x => (canonById.get(x).evidence || []).flatMap(ev => ev.chunk_ids || [])));
const groundIssues = [];
let curatedCited = 0, curatedProven = 0;
for (const s of curatedResp) {
  const cites = s.r.citations || [];
  if (cites.length) curatedCited++; else groundIssues.push(`curated answer without a citation: "${s.q}" → ${s.got}`);
  const proofs = proofIds(s.got);
  if (cites.some(c => proofs.has(c.chunkIdx))) curatedProven++; else groundIssues.push(`curated answer not cited by its own evidence: "${s.q}" → ${s.got}`);
}
const answered = served.filter(s => !s.r.noAnswer && !s.r.smallTalk);
const answeredCited = answered.filter(s => (s.r.citations || []).length > 0).length;
for (const s of answered) if (!(s.r.citations || []).length) groundIssues.push(`answer without a citation: "${s.q}" → ${s.got}`);
const leaks = served.filter(s => CLIENT.test(s.text));
for (const s of leaks) groundIssues.push(`client name in the answer to "${s.q}"`);
const canonLeaks = idx.canon.filter(e => CLIENT.test(e.answer || '') || CLIENT.test(JSON.stringify(e.i18n || {})));
for (const e of canonLeaks) groundIssues.push(`client name in curated answer ${e.id}`);
const entriesProven = idx.canon.filter(e => (e.evidence || []).some(ev => (ev.chunk_ids || []).length)).length;
const unresolved = idx.canon_unresolved || [];
for (const u of unresolved) groundIssues.push(`unresolved evidence link: ${u}`);
for (const e of idx.canon) if (!(e.evidence || []).some(ev => (ev.chunk_ids || []).length)) groundIssues.push(`curated answer ${e.id} has no resolved evidence`);
const servedIds = new Set(curatedResp.flatMap(s => s.got.split('+')));
const grounding = {
  canon_entries: idx.canon.length, entries_with_resolved_evidence: entriesProven, unresolved_links: unresolved.length,
  curated_responses: curatedResp.length, curated_ids_served: servedIds.size, curated_cited: curatedCited, curated_cited_by_own_evidence: curatedProven,
  answered_responses: answered.length, answered_cited: answeredCited,
  responses_scanned_for_client_names: served.length, client_name_leaks: leaks.length + canonLeaks.length,
  issues: groundIssues,
};
const groundOk = !groundIssues.length;
console.log(`5 grounding       ${groundOk ? 'ok' : groundIssues.length + ' issues'}`);

// =============================================================================
// 6. Performance — what a visitor waits for, and what they download
// =============================================================================
const sorted = [...latencies].sort((a, b) => a - b);
const q = (p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))];
const perf = {
  questions: sorted.length,
  p50_ms: +q(0.5).toFixed(2), p95_ms: +q(0.95).toFixed(2), max_ms: +sorted[sorted.length - 1].toFixed(2),
  mean_ms: +(sorted.reduce((a, b) => a + b, 0) / sorted.length).toFixed(2), first_call_ms: +firstCallMs.toFixed(2),
  p95_limit_ms: P95_LIMIT_MS,
  index: { chunks: idx.chunks.length, canon_entries: idx.canon.length, documents: (idx.stats || {}).document_count, vocab: (idx.stats || {}).vocab_size,
           index_json_bytes: fs.statSync(indexPath).size, semantic_json_bytes: fs.statSync(semPath).size },
  build,
};
const perfOk = perf.p95_ms <= P95_LIMIT_MS;
console.log(`6 performance     p50 ${perf.p50_ms}ms · p95 ${perf.p95_ms}ms · max ${perf.max_ms}ms`);

// =============================================================================
// Reports
// =============================================================================
const allOk = accOk && briefOk && detOk && ctxOk && paraOk && groundOk && perfOk;
let commit = '';
try { commit = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).stdout.trim(); } catch { /* not a checkout */ }
const report = {
  generated_at: new Date().toISOString(), commit, node: process.version, passed: allOk,
  summary: {
    accuracy: { passed: accTotal.passed, questions: accTotal.questions, ok: accOk },
    brief: { asked: brief.filter(b => b.asked).length, passed: brief.filter(b => b.asked && b.passed).length, questions: brief.length, ok: briefOk },
    determinism: { passed: determinism.filter(d => d.ok).length, questions: determinism.length, runs: 3, ok: detOk },
    context: { passed: ctxSame, pairs: ctxPairs, same_text: ctxSameText, previous: PREVIOUS, ok: ctxOk },
    paraphrase: { answers: paraphrase.length, passed: paraphrase.filter(p => p.ok).length, phrasings: paraPhrasings, ok: paraOk },
    grounding: { ok: groundOk, issues: groundIssues.length },
    performance: { p50_ms: perf.p50_ms, p95_ms: perf.p95_ms, max_ms: perf.max_ms, ok: perfOk },
  },
  accuracy: accuracy.map(r => ({ ...r, ok: r.passed === r.questions })), accuracy_total: accTotal,
  brief, determinism: determinism.filter(d => !d.ok),
  context: context.filter(c => !c.ok), paraphrase, grounding, performance: perf, fingerprints,
};
fs.mkdirSync(path.dirname(JSON_OUT), { recursive: true });
fs.writeFileSync(JSON_OUT, JSON.stringify(report, null, 1) + '\n');

const md = [];
const kb = (b) => `${(b / 1024 / 1024).toFixed(2)} MB`;
md.push('# Eidolon — proof of accuracy and consistency', '');
md.push(`Generated ${report.generated_at.slice(0, 10)}${commit ? ` at commit \`${commit}\`` : ''} by \`node tests/prove.mjs\` (Node ${process.version}). **Overall: ${allOk ? 'PASS' : 'FAIL'}.**`, '');
md.push('## How to read this', '');
md.push('- Every number comes from running the real answer path, `answerQuestion()` in `site/js/pipeline.js` (the code visitors run in the browser), against the real built index `site/data/index.json`, the way `tests/qa_eval.mjs` and the integration test run it (the optional in-browser embedding rescue is off). No model, network or randomness is involved.');
md.push('- Each section is one claim. **PASS** means it held for every question; one **FAIL** makes the script exit 1, which fails the CI check on the pull request.');
md.push('- `a/b` means a of b checks held. A question carries every check its test set gives it: the expected answer id, a `must` fact, `must_all` rubric points, a source it must `cite`, or an honest no-answer.');
md.push('- Latency is measured in Node on the machine that ran the proof; a browser on a phone is slower, but the work is the same. Failures, if any, are listed under their section; full detail is in `tests/reports/proof.json`.');
md.push('');
md.push('## Summary', '');
md.push('| # | Claim | Result | Evidence |', '|---|---|---|---|');
md.push(`| 1 | Accuracy: every question in every \`tests/qa_*.json\` set | ${verdict(accOk)} | ${ratio(accTotal.passed, accTotal.questions)} questions across ${SETS.length} sets |`);
md.push(`| 1a | The interview brief (\`tests/interview_brief.md\`) is asked in full | ${verdict(briefOk)} | ${ratio(brief.filter(b => b.asked && b.passed).length, brief.length)} brief questions asked verbatim and passed |`);
md.push(`| 2 | Determinism: same question, same answer | ${verdict(detOk)} | ${ratio(determinism.filter(d => d.ok).length, determinism.length)} interview questions identical over 3 runs (id and text hash) |`);
md.push(`| 3 | Context independence: a previous question does not change the answer | ${verdict(ctxOk)} | ${ratio(ctxSame, ctxPairs)} follow-up positions land on the cold answer |`);
md.push(`| 4 | Paraphrase consistency: every phrasing lands on its answer | ${verdict(paraOk)} | ${ratio(paraphrase.filter(p => p.ok).length, paraphrase.length)} curated answers, ${fmt(paraPhrasings)} distinct phrasings |`);
md.push(`| 5 | Grounding: cited, proven, confidential | ${verdict(groundOk)} | ${ratio(curatedProven, curatedResp.length)} curated answers served are cited by their own evidence · ${unresolved.length} unresolved links · ${leaks.length + canonLeaks.length} client-name leaks |`);
md.push(`| 6 | Performance: p95 ≤ ${P95_LIMIT_MS} ms | ${verdict(perfOk)} | p50 ${perf.p50_ms} ms · p95 ${perf.p95_ms} ms · max ${perf.max_ms} ms over ${fmt(perf.questions)} questions |`);
md.push('');

md.push('## 1. Accuracy', '');
md.push('Same rules as `node tests/qa_eval.mjs <set>`: the expected answer (a wording variant may add a second answer, never lose the expected one), the `must` fact verbatim, every `must_all` rubric point, the `cite`d source among the citations, and an honest "not on record" for questions it must decline.', '');
md.push('| Set | Questions | Expected answer | `must` fact | `must_all` rubric (points) | `cite` | Honest no-answer | Passed | Result |', '|---|---:|---:|---:|---:|---:|---:|---:|---|');
for (const r of accuracy) md.push(`| \`${r.set}\` | ${fmt(r.questions)} | ${ratio(...r.id)} | ${ratio(...r.must)} | ${r.must_all[1] ? `${ratio(...r.must_all)} (${ratio(...r.rubric_points)})` : '—'} | ${ratio(...r.cite)} | ${ratio(...r.no_answer)} | ${pct(r.passed, r.questions)} | ${verdict(r.passed === r.questions)} |`);
const t = accTotal;
md.push(`| **Total** | **${fmt(t.questions)}** | **${ratio(...t.id)}** | **${ratio(...t.must)}** | **${ratio(...t.must_all)} (${ratio(...t.rubric_points)})** | **${ratio(...t.cite)}** | **${ratio(...t.no_answer)}** | **${pct(t.passed, t.questions)}** | **${verdict(accOk)}** |`);
const accFails = accuracy.flatMap(r => r.failures.map(f => `${r.set}: ${f}`));
if (accFails.length) md.push('', '**Failures**', '', ...accFails.slice(0, 40).map(f => `- ${f}`));
md.push('');
md.push(`**Interview brief.** ${fmt(brief.length)} questions, scenarios and "never skip" items are read from \`tests/interview_brief.md\`; ${fmt(brief.filter(b => b.asked).length)} are asked verbatim in \`qa_interview_s1/s2/s3.json\` and ${fmt(brief.filter(b => b.asked && b.passed).length)} pass every rubric point. The interview sets add paraphrases, and \`qa_interview_heldout.json\` holds questions written after the answers, as a check against tuning to the wording.`);
const briefMiss = brief.filter(b => !(b.asked && b.passed));
if (briefMiss.length) md.push('', ...briefMiss.map(b => `- ${b.asked ? 'FAILS' : 'NOT ASKED'}: ${b.q}`));
md.push('');

md.push('## 2. Determinism', '');
md.push(`Every interview question (${fmt(determinism.length)}) answered three times in one process: run 1 in file order, run 2 in reverse order, run 3 in a fixed shuffled order, so an answer cannot depend on what was asked before it or on warm caches. The answer id and the SHA-256 of the full answer HTML must be identical across the runs.`, '');
md.push('| Set | Questions | Same id ×3 | Same text hash ×3 | Result |', '|---|---:|---:|---:|---|');
for (const f of [...new Set(interviewCases.map(c => c.set))]) {
  const ds = determinism.filter(d => d.set === f);
  md.push(`| \`${f}\` | ${ds.length} | ${ratio(ds.filter(d => d.ids.length === 1).length, ds.length)} | ${ratio(ds.filter(d => d.hashes === 1).length, ds.length)} | ${verdict(ds.every(d => d.ok))} |`);
}
for (const d of determinism.filter(d => !d.ok)) md.push(`- FAIL: "${d.q}" → ids ${d.ids.join(', ')}, ${d.hashes} distinct texts`);
md.push('');

md.push('## 3. Context independence', '');
md.push(`Every interview question asked again as a follow-up (\`ctx.prev\`) after each of three unrelated questions, chosen because each names something a pronoun could wrongly attach to. It must land on the same answer as when asked cold.`, '');
md.push('| Previous question | Same answer as cold | Same text as cold |', '|---|---:|---:|');
for (const p of PREVIOUS) {
  const xs = context.map(c => ({ c, a: c.after.find(a => a.prev === p) }));
  md.push(`| "${p}" | ${ratio(xs.filter(x => x.a.got === x.c.cold).length, xs.length)} | ${ratio(xs.filter(x => x.a.sameText).length, xs.length)} |`);
}
md.push(`| **All** | **${ratio(ctxSame, ctxPairs)}** | **${ratio(ctxSameText, ctxPairs)}** |`);
for (const c of context.filter(c => !c.ok)) md.push(`- FAIL: "${c.q}" cold ${c.cold}; ${c.after.filter(a => a.got !== c.cold).map(a => `after "${a.prev}" → ${a.got}`).join('; ')}`);
md.push('');

md.push('## 4. Paraphrase consistency', '');
md.push(`Test phrasings from all sets grouped by the one curated answer they expect (questions that accept several answers by design, ${fmt(multiExpect)}, are left out). Every curated answer with two or more distinct phrasings is listed; all of its phrasings must land on it.`, '');
const buckets = [[2, 3], [4, 6], [7, 10], [11, 1e9]];
md.push('| Phrasings per answer | Answers | Phrasings | All landed |', '|---|---:|---:|---:|');
for (const [lo, hi] of buckets) {
  const xs = paraphrase.filter(p => p.phrasings >= lo && p.phrasings <= hi);
  if (xs.length) md.push(`| ${hi > 1e8 ? `${lo}+` : `${lo}–${hi}`} | ${xs.length} | ${fmt(xs.reduce((n, p) => n + p.phrasings, 0))} | ${ratio(xs.filter(p => p.ok).length, xs.length)} |`);
}
md.push(`| **All** | **${paraphrase.length}** | **${fmt(paraPhrasings)}** | **${ratio(paraphrase.filter(p => p.ok).length, paraphrase.length)}** |`, '');
md.push('<details><summary>Every answer and its phrasings</summary>', '');
md.push('| Curated answer | Phrasings | Sets | Landed | Result |', '|---|---:|---:|---:|---|');
for (const p of paraphrase) md.push(`| \`${p.id}\` | ${p.phrasings} | ${p.sets} | ${ratio(p.landed, p.phrasings)} | ${verdict(p.ok)} |`);
md.push('', '</details>');
for (const p of paraphrase.filter(p => !p.ok)) md.push(`- FAIL \`${p.id}\`: ${p.misses.join('; ')}`);
md.push('');

md.push('## 5. Grounding', '');
md.push('| Check | Result |', '|---|---|');
md.push(`| Curated answers in the index whose evidence resolved to at least one record | ${ratio(entriesProven, idx.canon.length)} |`);
md.push(`| Evidence links the build could not resolve | ${unresolved.length} |`);
md.push(`| Curated answers served in this run (${servedIds.size} distinct) with at least one citation | ${ratio(curatedCited, curatedResp.length)} |`);
md.push(`| ...cited by a record from their own evidence list | ${ratio(curatedProven, curatedResp.length)} |`);
md.push(`| All answers served (curated, video, repository, retrieval; small talk and declines excluded) with a citation | ${ratio(answeredCited, answered.length)} |`);
md.push(`| Served answers containing a client name (Southwest, PwC, American Express, Amex) | ${leaks.length} of ${fmt(served.length)} |`);
md.push(`| Curated answers in the index (and their translations) containing a client name | ${canonLeaks.length} of ${idx.canon.length} |`);
if (groundIssues.length) md.push('', ...groundIssues.slice(0, 40).map(i => `- FAIL: ${i}`));
md.push('');

md.push('## 6. Performance', '');
md.push('| Measure | Value |', '|---|---|');
md.push(`| Questions timed (one \`answerQuestion\` call each) | ${fmt(perf.questions)} |`);
md.push(`| p50 / p95 / max latency | ${perf.p50_ms} ms / ${perf.p95_ms} ms / ${perf.max_ms} ms |`);
md.push(`| Mean latency · first (cold) call | ${perf.mean_ms} ms · ${perf.first_call_ms} ms |`);
md.push(`| p95 limit | ${P95_LIMIT_MS} ms (${verdict(perfOk)}) |`);
md.push(`| Index: chunks · curated answers · documents · vocabulary | ${fmt(perf.index.chunks)} · ${fmt(perf.index.canon_entries)} · ${fmt(perf.index.documents)} · ${fmt(perf.index.vocab)} |`);
md.push(`| \`site/data/index.json\` · \`semantic.json\` | ${fmt(perf.index.index_json_bytes)} bytes (${kb(perf.index.index_json_bytes)}) · ${fmt(perf.index.semantic_json_bytes)} bytes (${kb(perf.index.semantic_json_bytes)}) |`);
md.push(`| Build time | ${build ? `${build.seconds} s (\`--build\`)` : 'not measured (run with `--build`)'} |`);
md.push('');
fs.mkdirSync(path.dirname(MD_OUT), { recursive: true });
fs.writeFileSync(MD_OUT, md.join('\n'));

console.log(`\n${allOk ? 'PROOF PASSED' : 'PROOF FAILED'} → ${path.relative(ROOT, MD_OUT)}, ${path.relative(ROOT, JSON_OUT)}`);
process.exit(allOk ? 0 : 1);
