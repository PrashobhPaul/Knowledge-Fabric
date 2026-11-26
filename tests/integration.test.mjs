// =============================================================================
// Integration test — runs the REAL browser modules against the REAL built index
// =============================================================================
//
// The Python suite tests algorithms; the evaluation harness reimplements BM25 in
// Python. Neither executes site/js against site/data. Field renames do not fail
// loudly in JavaScript — they fail as `undefined` several call frames later. The
// only test that catches a pipeline<->browser contract break is one that runs
// the real thing end to end.
//
// Usage:  node tests/integration.test.mjs        (exit 0 = pass)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');

let passed = 0, failed = 0;
const failures = [];

function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failed++;
    failures.push([name, err.message]);
    console.log(`  FAIL  ${name}\n          ${err.message}`);
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

// ---------------------------------------------------------------- load
const indexPath = path.join(SITE, 'data/index.json');
const semPath = path.join(SITE, 'data/semantic.json');
if (!fs.existsSync(indexPath)) {
  console.error('index.json missing — run: python -m pipeline.build_index');
  process.exit(2);
}
const idx = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
const semPayload = fs.existsSync(semPath) ? JSON.parse(fs.readFileSync(semPath, 'utf8')) : { enabled: false };

const { BM25, cohereByDocument, tokenize } = await import(path.join(SITE, 'js/search.js'));
const { buildAnswer } = await import(path.join(SITE, 'js/answer.js'));
const { SemanticIndex } = await import(path.join(SITE, 'js/semantic.js'));
const { hybridSearch, reciprocalRankFusion } = await import(path.join(SITE, 'js/hybrid.js'));
const { matchQuestionBank, QUESTION_BANK } = await import(path.join(SITE, 'js/questionbank.js'));
const { analyseQuestion } = await import(path.join(SITE, 'js/nlu.js'));
const { computeHealth, renderHealthDerivation, healthNarrative } = await import(path.join(SITE, 'js/health.js'));
const ringsMod = await import(path.join(SITE, 'js/rings.js'));
const { renderConfidenceBreakdown } = await import(path.join(SITE, 'js/confidence.js'));
const { cleanSentence } = await import(path.join(SITE, 'js/compose.js'));
const { BRAND } = await import(path.join(SITE, 'js/brand.js'));
const { explainGraphContribution, renderGraphContribution, renderMiniGraph, graphPurposeCopy } =
  await import(path.join(SITE, 'js/graphvalue.js'));
const { suggest: taSuggest } = await import(path.join(SITE, 'js/typeahead.js'));

const bm25 = new BM25(idx.bm25);
const semantic = new SemanticIndex(semPayload);
const BANK = QUESTION_BANK.map(q => (typeof q === 'string' ? q : (q.question || q.q || q.text))).filter(Boolean);
const CSS = fs.readFileSync(path.join(SITE, 'styles/main.css'), 'utf8');
const HTML = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');

function retrieve(q) {
  const h = hybridSearch(q, { bm25, semantic, chunks: idx.chunks, filters: {}, topK: 20 });
  const rawRanked = h.results.length
    ? h.results.map(r => ({ chunkIdx: r.chunkIdx, score: r.score, _fusion: r }))
    : bm25.search(q, 20);
  const cohesion = cohereByDocument(rawRanked, idx.chunks, { queryTerms: tokenize(q), bm25Index: bm25 });
  const built = buildAnswer(q, rawRanked, idx.chunks, cohesion,
    { semantic, bm25: idx.bm25, diagnostics: h.diagnostics });
  return { ranked: rawRanked, cohesion, retrieval: { mode: h.mode, ...h.diagnostics }, ...built };
}
function ask(question) {
  const bankMatch = matchQuestionBank(question, { vocab: bm25.termId });
  let rq = (bankMatch && bankMatch.score >= 0.7) ? bankMatch.question : question;
  let result = retrieve(rq);
  if (result.lowConfidence && rq === question && bankMatch && bankMatch.score >= 0.45) {
    const rescued = retrieve(bankMatch.question);
    if (!rescued.lowConfidence) result = rescued;
  }
  const trace = result.citations.map(c => c.chunk.id);
  return { ...result, trace };
}
const plain = (r) => String(r.answerHtml).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

// =============================================================================
console.log('\n=== RETRIEVAL CONTRACT ===');

check('BM25 emits chunkIdx', () => {
  const hits = bm25.search('agentic ai architect', 5);
  assert(hits.length > 0, 'no BM25 hits');
  assert('chunkIdx' in hits[0], `BM25 hit keys: ${Object.keys(hits[0])}`);
});

check('SemanticIndex emits chunkIdx (same key as BM25)', () => {
  if (!semantic.enabled) return;
  const hits = semantic.search('agentic ai architect', 5);
  assert(hits.length > 0, 'no semantic hits');
  assert('chunkIdx' in hits[0], `semantic hit keys: ${Object.keys(hits[0])}`);
});

check('every chunkIdx resolves to a real chunk', () => {
  for (const hit of bm25.search('qualizeal', 20)) assert(idx.chunks[hit.chunkIdx] !== undefined, `chunks[${hit.chunkIdx}] undefined`);
  if (semantic.enabled) for (const hit of semantic.search('qualizeal', 20)) assert(idx.chunks[hit.chunkIdx] !== undefined);
});

check('RRF does not collapse a run into one bucket', () => {
  const lex = bm25.search('project', 20);
  const fused = reciprocalRankFusion([{ retriever: 'bm25', results: lex }], { topK: 20 });
  assert(fused.length === Math.min(lex.length, 20), `fused ${fused.length} from ${lex.length} inputs`);
  assert(fused.every(f => f.chunkIdx !== undefined), 'fused entry missing chunkIdx');
});

check('retrievers agree on ids (agreement > 0)', () => {
  if (!semantic.enabled) return;
  const h = hybridSearch('agentic ai multi-agent systems', { bm25, semantic, chunks: idx.chunks, filters: {}, topK: 20 });
  assert(h.diagnostics.agreement > 0, 'zero agreement means the two retrievers are keyed differently');
});

console.log('\n=== INDEX CONTRACT (fields the UI indexes) ===');

for (const field of ['id', 'name', 'kind', 'mention_count', 'chunk_ids', 'document_ids', 'sources', 'cross_source']) {
  check(`entity.${field} present`, () => assert(idx.entities[0][field] !== undefined, `entity is missing ${field}`));
}

check('entity.chunk_ids resolve to real chunks', () => {
  const chunksById = new Map(idx.chunks.map(c => [c.id, c]));
  for (const e of idx.entities.slice(0, 80)) for (const cid of e.chunk_ids) assert(chunksById.has(cid), `entity ${e.id} -> bad chunk ${cid}`);
});

check('relationship endpoints all exist (no dangling graph edges)', () => {
  const ids = new Set(idx.entities.map(e => e.id));
  for (const r of idx.relationships) {
    assert(ids.has(r.source), `edge source ${r.source} not in entities`);
    assert(ids.has(r.target), `edge target ${r.target} not in entities`);
  }
});

check('every chunk carries a source type and most carry a verifiable URL', () => {
  const types = new Set(idx.chunks.map(c => c.source_type));
  assert(types.size >= 3, `only ${[...types]} source types indexed`);
  const withUrl = idx.chunks.filter(c => c.url).length;
  assert(withUrl / idx.chunks.length > 0.8, `only ${withUrl}/${idx.chunks.length} chunks have a provenance URL`);
});

check('the Factory handshake is present and names every connector', () => {
  assert(Array.isArray(idx.sources) && idx.sources.length >= 3, 'index.sources missing');
  for (const s of idx.sources) {
    assert(s.source_type && s.system && typeof s.records === 'number', `malformed source ${JSON.stringify(s)}`);
    assert(['knowledge_factory', 'repository'].includes(s.synced_by), `unknown synced_by ${s.synced_by}`);
  }
  assert(idx.sources.some(s => s.synced_by === 'knowledge_factory'), 'no source is marked as Factory-synced');
});

console.log('\n=== THE FABRIC: CROSS-SOURCE JOINS ===');

check('at least one entity joins two or more source systems', () => {
  const cross = idx.entities.filter(e => e.cross_source);
  assert(cross.length >= 5, `only ${cross.length} cross-source entities`);
  for (const e of cross) assert(e.sources.length >= 2, `${e.name} flagged cross_source with ${e.sources.length} source`);
});

check('a project on the website and its GitHub repository are one node', () => {
  const inv = idx.entities.filter(e => e.kind === 'Project' && /invest/i.test(e.name));
  assert(inv.length === 1, `Invest.IQ resolved to ${inv.length} nodes: ${inv.map(e => e.name)}`);
  assert(inv[0].sources.includes('website') && inv[0].sources.includes('github'),
    `Invest.IQ sources are ${inv[0].sources}`);
});

check('the current employer is observed in the resume, the website and the profile', () => {
  const q = idx.entities.find(e => e.kind === 'Organization' && e.name === 'Qualizeal');
  assert(q, 'no Qualizeal node');
  assert(q.sources.length >= 2, `Qualizeal seen in only ${q.sources}`);
});

check('typed edges dominate co-occurrence', () => {
  const typed = idx.relationships.filter(r => r.type !== 'CO_OCCURS').length;
  assert(typed > idx.relationships.length * 0.5, `${typed}/${idx.relationships.length} typed edges`);
  const types = new Set(idx.relationships.map(r => r.type));
  for (const t of ['WORKED_AT', 'BUILT', 'USES', 'SKILLED_IN', 'PUBLISHED', 'FILMED_AT'])
    assert(types.has(t), `no ${t} edges`);
});

console.log('\n=== END-TO-END ANSWER PATH ===');

check('a plain question produces a cited answer', () => {
  const r = ask('Where does Prashobh work currently?');
  assert(r.answerHtml && r.answerHtml.length > 50, 'empty answer');
  assert(r.citations.length > 0, 'no citations');
  assert(r.citations.every(c => c.chunk), 'citation missing chunk');
});

check('EVERY question bank entry answers without throwing', () => {
  assert(BANK.length > 0, 'question bank empty');
  const broken = [];
  for (const q of BANK) {
    try {
      const r = ask(q);
      if (!r.answerHtml || !r.citations.length) broken.push(`${q} -> no answer`);
    } catch (err) {
      broken.push(`${q} -> THREW ${err.message}`);
    }
  }
  assert(broken.length === 0, `${broken.length}/${BANK.length} bank questions broken:\n          ` + broken.slice(0, 5).join('\n          '));
});

check('degenerate and empty queries degrade without throwing', () => {
  for (const q of ['the', '', '   ', 'asdfghjkl qwertyuiop', '!!!', 'a']) {
    const r = ask(q);
    assert(typeof r.answerHtml === 'string', `"${q}" produced no answerHtml`);
  }
});

check('exact name lookup still works (lexical path intact)', () => {
  const r = ask('Koode');
  assert(r.citations.length > 0, 'no citations for exact project name');
  assert(/koode/i.test(plain(r)), 'answer does not mention Koode');
});

console.log('\n=== NLU ROUTING ===');

check('intent classification separates question types', () => {
  const expect = {
    'Where does Prashobh work currently?': 'CAREER',
    'What are Prashobh’s core skills?': 'SKILLS',
    'What is Koode?': 'PROJECTS',
    'Where did Prashobh study?': 'EDUCATION',
    'What services does Prashobh offer?': 'SERVICES',
    'How can I contact Prashobh?': 'CONTACT',
    'What videos has Prashobh made about Spiti Valley?': 'YOUTUBE',
    'Who is Prashobh Paul?': 'WHO',
    'What languages does Prashobh speak?': 'LANGUAGES',
  };
  for (const [q, want] of Object.entries(expect)) {
    const got = analyseQuestion(q).intent.name;
    assert(got === want, `"${q}" -> ${got}, expected ${want}`);
  }
});

check('naming an employer makes it a career question even when the verb is "build"', () => {
  assert(analyseQuestion('What did Prashobh build at Brane Enterprises?').intent.name === 'CAREER');
});

check('"short bio" is not a YouTube Shorts question', () => {
  assert(analyseQuestion('Give me a short bio of Prashobh.').intent.name !== 'YOUTUBE');
});

check('focus entities are extracted with the longest match', () => {
  const a = analyseQuestion('What videos has Prashobh made about Spiti Valley?');
  assert(a.focus.includes('spiti valley') && !a.focus.includes('spiti'), `focus was ${JSON.stringify(a.focus)}`);
});

check('travel videos never answer a career question', () => {
  for (const q of ['Where does Prashobh work currently?', 'What did Prashobh do at Tech Mahindra?',
                   'What is Prashobh’s experience in healthcare NLP?']) {
    const r = ask(q);
    for (const c of r.citations) {
      const rt = (c.chunk.meta && c.chunk.meta.record_type) || '';
      assert(rt !== 'video', `a video was cited for: ${q}`);
    }
  }
});

check('a question about one employer is not answered with another', () => {
  const r = ask('What did Prashobh do at Tech Mahindra?');
  const t = plain(r).toLowerCase();
  assert(/tech mahindra/.test(t), 'answer never names Tech Mahindra');
  const body = t.split(':').slice(1).join(':');
  assert(!/primera medical|yash technologies|brane enterprises/.test(body.split('.')[0]),
    'first sentence is about a different employer');
});

check('a project question draws on BOTH the website and GitHub', () => {
  const r = ask('What is Koode?');
  const srcs = new Set(r.citations.map(c => c.chunk.source_type));
  // The website text is drawn from the README, so the composer may keep only one
  // of two near-identical sentences; the GitHub record must still be top evidence.
  const top = new Set(r.ranked.slice(0, 5).map(x => idx.chunks[x.chunkIdx].source_type));
  assert(srcs.has('website') && (srcs.has('github') || top.has('github')), `sources were ${[...srcs]}; top-5 ${[...top]}`);
});

check('questions in FAQ text are never presented as answers', () => {
  for (const q of ['How does Prashobh choose an architecture?', 'What does Prashobh think of LangChain?']) {
    const sents = (ask(q).summary?.sentences || []).map(s => s.display);
    for (const s of sents) assert(!/\?\s*$/.test(s), `question echoed as evidence: "${s}"`);
  }
});

check('no sentence is repeated within an answer', () => {
  const r = ask('What services does Prashobh offer?');
  const norm = (r.summary?.sentences || []).map(s => s.display.toLowerCase().replace(/[^a-z0-9 ]/g, '').slice(0, 70));
  assert(new Set(norm).size === norm.length, 'duplicate sentences survived MMR');
});

check('the pronoun "I" is never lower-cased after a discourse marker', () => {
  for (const q of BANK.slice(0, 20)) assert(!/\bi (built|live|architect|lead|advise)\b/.test(plain(ask(q))), `"i" leaked in: ${q}`);
});

console.log('\n=== CONFIDENCE IS DERIVED, NOT CONSTANT ===');

check('confidence varies across questions', () => {
  const vals = BANK.slice(0, 12).map(q => ask(q).confidence?.percent ?? -1);
  assert(new Set(vals).size > 6, `confidences cluster: ${vals.join(',')}`);
});

check('confidence exposes all five signals with weights summing to 1', () => {
  const c = ask('What is Koode?').confidence;
  for (const k of ['retrievalMargin', 'retrieverAgreement', 'queryCoverage', 'sourceConsensus', 'evidenceQuality']) {
    assert(c.signals[k] && typeof c.signals[k].value === 'number', `missing signal ${k}`);
    assert(c.signals[k].how && c.signals[k].why, `${k} has no derivation text`);
  }
  const w = Object.values(c.signals).reduce((a, s) => a + s.contribution, 0);
  assert(Math.abs(w - 1) < 0.01, `signal weights sum to ${w}`);
});

check('a nonsense question yields low confidence, not a confident wrong answer', () => {
  const r = ask('asdfghjkl qwertyuiop zxcvbnm');
  assert((r.confidence?.percent ?? 0) < 40, `nonsense scored ${r.confidence?.percent}%`);
});

check('bank questions answer well, but nothing is pinned', () => {
  const vals = BANK.map(q => ask(q).confidence?.exact ?? 0);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  assert(mean >= 55, `bank mean is ${mean.toFixed(1)}% — the tested set should answer well`);
  assert(new Set(vals).size > vals.length * 0.8, 'bank scores are suspiciously uniform');
  assert(vals.some(v => v < 70), 'every bank question scores high — nothing discriminates');
  const a = ask('What is Koode?').confidence.exact, b = ask('What is Koode?').confidence.exact;
  assert(a === b, 'confidence is not deterministic');
});

check('confidence panel leads with a plain verdict and nests formulas', () => {
  const html = renderConfidenceBreakdown(ask('What is Koode?').confidence);
  assert(/class="conf-verdict"/.test(html), 'no plain verdict');
  assert(/<details class="tech-detail">/.test(html), 'formulas not nested');
});

console.log('\n=== KNOWLEDGE HEALTH IS EXPLAINABLE ===');

check('every health metric ships a formula, inputs and plain-language framing', () => {
  const h = computeHealth(idx);
  assert(h.metrics.length >= 5, 'expected 5 metrics');
  for (const m of h.metrics) {
    assert(m.formula && m.inputs && Object.keys(m.inputs).length, `${m.label} lacks derivation`);
    assert(m.plainLabel && m.plainWhat && m.plainRisk, `${m.key} has no business framing`);
    assert(m.value >= 0 && m.value <= 100, `${m.label} out of range: ${m.value}`);
  }
  const n = healthNarrative(h);
  assert(!/undefined/.test(n.headline + n.weakest + n.strongest), 'undefined in narrative');
  const html = renderHealthDerivation(h);
  assert(/<details class="tech-detail">/.test(html) && /<code>/.test(html), 'formulas missing or not nested');
});

check('document dates carry provenance and no source-specific leftovers', () => {
  const dated = idx.documents.filter(d => d.date_date);
  assert(dated.length > idx.documents.length * 0.8, `only ${dated.length}/${idx.documents.length} records dated`);
  for (const d of dated) {
    assert(d.date_method && d.date_method !== 'unknown', `${d.name} dated without a method`);
    assert(d.date_method !== 'fda_decision_date', 'stale date method name');
    assert(typeof d.date_confidence === 'number' && d.date_explanation, `${d.name} lacks confidence/explanation`);
  }
  assert(idx.documents.some(d => d.source_type === 'youtube' && d.date_method === 'source_timestamp'), 'videos not dated from their publish timestamp');
});

check('health renders as concentric rings, one per metric', () => {
  const h = computeHealth(idx);
  const svg = ringsMod.renderMaturityRings(h);
  assert((svg.match(/class="mr-arc"/g) || []).length === h.metrics.length, 'one arc per metric expected');
  assert(svg.includes(`>${h.overall}<`), 'overall score missing from the centre');
});

console.log('\n=== BRANDING & GRAPH VALUE ===');

check('the fabric is about the subject, built by the subject, and says so', () => {
  assert(BRAND.footerBrand.includes('Prashobh Paul'), 'subject missing from footer');
  assert(!/nova|qualizeal ai-coe|demonstration/i.test(BRAND.footerBrand), `stale attribution: ${BRAND.footerBrand}`);
  assert(/data-brand=/.test(HTML), 'markup does not use the brand binding');
  assert(!/Nova\s*Biomedical|StatStrip|lactate|creatinine/i.test(HTML), 'stale corpus references in markup');
  assert(!/Nova\s*Biomedical/i.test(CSS), 'a style rule is keyed to a client name');
});

check('graph has a standing purpose statement with real numbers', () => {
  const p = graphPurposeCopy(idx);
  assert(p.stat > 0 && p.stat2 > 0, `graph stats empty: ${p.stat}/${p.stat2}`);
  assert(!/undefined|NaN|regulatory/i.test(p.body), `placeholder or stale copy in: ${p.body}`);
});

check('a multi-source answer explains what the graph contributed', () => {
  const r = ask('What is Koode?');
  const c = explainGraphContribution(r.citations, idx, r.analysis);
  assert(c, 'no contribution computed for a multi-document answer');
  assert(c.bridges.length > 0, 'no bridging concepts identified');
  const html = renderGraphContribution(c, idx);
  assert(/keyword|share/i.test(html), 'the story never contrasts with keyword search');
  const hub = (html.match(/mg-hub-label">\s*([^<]+)/) || [])[1]?.trim();
  if (hub) assert(hub === c.primary.name, `diagram shows "${hub}" but prose names "${c.primary.name}"`);
  assert(!/regulatory/i.test(html), 'stale source class in graph-value copy');
});

check('single-document answers claim no graph contribution', () => {
  assert(explainGraphContribution([{ chunk: idx.chunks[0] }], idx, null) === null);
});

console.log('\n=== TYPEAHEAD, CHIPS, SOURCES ===');

check('suggestions come only from the tested question bank', () => {
  const set = new Set(BANK);
  for (const probe of ['what', 'koode', 'where', 'video', 'a', 'skills']) {
    for (const r of taSuggest(probe, BANK)) assert(set.has(r.question), `"${r.question}" is not in the bank`);
  }
});

check('hero chips land on different intents and are all in the bank', () => {
  const js = fs.readFileSync(path.join(SITE, 'js/main.js'), 'utf8');
  const block = js.slice(js.indexOf('const PRESET_QUESTIONS'), js.indexOf('];', js.indexOf('const PRESET_QUESTIONS')));
  const qs = [...block.matchAll(/'([^']+\?)'/g)].map(m => m[1]);
  assert(qs.length >= 3, 'no preset chips found');
  const intents = new Set(qs.map(q => analyseQuestion(q).intent.name));
  assert(intents.size === qs.length, `chips repeat intents (${[...intents].join(', ')})`);
  for (const q of qs) assert(BANK.includes(q), `chip "${q}" is not in the tested bank`);
});

check('the source strip (Factory ↔ Fabric handshake) is wired', () => {
  assert(/id="source-strip"/.test(HTML), 'no source strip in markup');
  const js = fs.readFileSync(path.join(SITE, 'js/main.js'), 'utf8');
  assert(/renderSourceStrip/.test(js) && /last_synced/.test(js), 'source strip never rendered');
});

check('lineage links each citation back to its source URL', () => {
  const lj = fs.readFileSync(path.join(SITE, 'js/lineage.js'), 'utf8');
  assert(/lineage-link/.test(lj) && /c\.url/.test(lj), 'lineage does not link out to the source');
});

check('LinkedIn posts and events are first-class', () => {
  assert(idx.chunks.some(c => c.source_type === 'linkedin' && c.meta.record_type === 'post'), 'no LinkedIn post indexed');
  assert(idx.chunks.some(c => c.meta.record_type === 'event'), 'no event indexed');
  assert(analyseQuestion('What has Prashobh posted about on LinkedIn?').intent.name === 'POSTS');
  assert(analyseQuestion('What events has Prashobh attended?').intent.name === 'EVENTS');
  const r = ask('What does Prashobh say about knowledge factories and ontologies?');
  assert(r.citations.some(c => c.chunk.meta.record_type === 'post'), 'a question about his writing did not cite a post');
  const e = ask('What events has Prashobh attended?');
  assert(e.citations.some(c => c.chunk.meta.record_type === 'event'), 'an events question did not cite an event');
});

check('bank exercises the full NLU router', () => {
  const seen = new Set(BANK.map(q => analyseQuestion(q).intent.name));
  assert(seen.size >= 10, `only ${seen.size} intents represented: ${[...seen].join(', ')}`);
  const general = BANK.filter(q => analyseQuestion(q).intent.name === 'GENERAL').length;
  assert(general / BANK.length < 0.12, `${general}/${BANK.length} questions fall through to GENERAL`);
});

console.log('\n=== FEEDBACK LOOP: TRACES, FLAGS, CURATOR ===');
const { recordTrace, flagUrl, renderFlagBox } = await import(path.join(SITE, 'js/traces.js'));

check('the index ships the curator ledger summary', () => {
  assert(idx.flags && idx.flags.summary, 'index.flags missing — build_index did not read the ledger');
  for (const k of ['open', 'resolved', 'regressed']) assert(typeof idx.flags.summary[k] === 'number', `summary.${k} missing`);
});

check('every resolved flag still answers (the fix stays fixed)', () => {
  const resolved = (idx.flags.items || []).filter(f => f.status === 'resolved');
  for (const f of resolved) {
    const r = ask(f.question);
    assert(r.citations.length > 0 && !r.lowConfidence, `resolved flag regressed: "${f.question}" (${r.confidence?.percent}%)`);
  }
  assert((idx.flags.items || []).every(f => f.status !== 'regressed'), 'ledger reports a regressed flag');
});

check('a flag link is a pre-filled GitHub issue carrying the trace, with no token', () => {
  const r = ask('Which conference talks has Prashobh given?');
  const t = { t: new Date().toISOString(), q: 'Which conference talks has Prashobh given?', intent: r.analysis.intent.name,
              focus: r.analysis.focus, confidence: r.confidence.percent, band: r.confidence.band, low: r.lowConfidence,
              mode: 'hybrid', sources: [], cited: [], caveats: [] };
  const url = flagUrl(t, 'missing');
  assert(url.startsWith('https://github.com/PrashobhPaul/Prashobh_Knowledge_Factory/issues/new?'), url);
  const p = new URL(url).searchParams;
  assert(p.get('template') === 'knowledge_flag.yml' && p.get('labels') === 'knowledge-flag', 'template/label missing');
  assert(p.get('question') === t.q, 'question not carried');
  assert(JSON.parse(p.get('trace')).intent === t.intent, 'trace not carried');
  assert(!/token|secret/i.test(url), 'a credential leaked into the flag URL');
});

check('a weak answer gets the flag box opened for it', () => {
  const weak = renderFlagBox({ t: '', q: 'x', intent: 'GENERAL', focus: [], confidence: 20, band: 'very low', low: true, mode: 'hybrid', sources: [], cited: [], caveats: [] });
  assert(/flag-box-weak/.test(weak) && /looks like a gap/.test(weak), 'weak answer not flagged');
  const strong = renderFlagBox({ t: '', q: 'x', intent: 'GENERAL', focus: [], confidence: 80, band: 'high', low: false, mode: 'hybrid', sources: [], cited: [], caveats: [] });
  assert(!/flag-box-weak/.test(strong), 'strong answer treated as a gap');
});

check('the issue form, curator workflow and curator module exist and agree on the label', () => {
  const form = fs.readFileSync(path.join(ROOT, '.github/ISSUE_TEMPLATE/knowledge_flag.yml'), 'utf8');
  const wf = fs.readFileSync(path.join(ROOT, '.github/workflows/curator.yml'), 'utf8');
  const cur = fs.readFileSync(path.join(ROOT, 'knowledge_factory/curator.py'), 'utf8');
  for (const s of [form, wf, cur]) assert(/knowledge-flag/.test(s), 'label mismatch across form, workflow and curator');
  assert(/never invents/.test(cur), 'curator must not invent facts');
});

// =============================================================================
console.log('\n=== ANSWER MATURITY: SCOPE, VERDICTS, JOINS, TIMESTAMPS ===');

check('"currently" scopes a career question to the current role only', () => {
  const r = ask('Where does Prashobh work currently?');
  assert(r.analysis.scope === 'current', `scope was ${r.analysis.scope}`);
  const text = plain(r);
  assert(/Qualizeal/.test(text), 'current employer missing');
  for (const past of ['Primera', 'Brane', 'Yash', 'Tech Mahindra', 'Tata']) {
    assert(!new RegExp(past).test(text), `past employer leaked into a current-role answer: ${past}`);
  }
  assert(/spearheading|driving|leading/i.test(text), 'responsibilities not read from the role record');
  assert(!/LinkedIn/.test(text), 'a LinkedIn post leaked into the career answer');
});

check('a yes/no question gets a verdict, and "no" still offers the nearest material', () => {
  const r = ask('Does Prashobh teach AI on YouTube?');
  assert(r.verdict && r.verdict.kind === 'no', `verdict was ${r.verdict && r.verdict.kind}`);
  assert(/^\s*No\./.test(plain(r)), 'answer does not open with the verdict');
  const sents = r.summary.sentences;
  assert(sents.length <= 2, `a "no" dumped ${sents.length} sentences`);
  assert(sents.every(s => s.chunk.source_type === 'youtube'), 'a YouTube question answered from elsewhere');
  const rel = r.related || [];
  assert(rel.length > 0 && rel[0].kind === 'video' && /AI Tour/i.test(rel[0].title), `related did not lead with the AI Tour video: ${rel.map(c => c.title)}`);
  assert(/youtube\.com\/watch\?v=/.test(rel[0].url), 'related video card has no YouTube link');
});

check('a yes/no question answered by the sources gets "Yes" with the evidence sentence', () => {
  for (const q of ['Did Prashobh attend the Microsoft AI Tour?', 'Does Prashobh work on AI-driven SDLC?', 'Can I hire Prashobh for consulting?']) {
    const r = ask(q);
    assert(r.verdict && r.verdict.kind === 'yes', `"${q}" verdict was ${r.verdict && r.verdict.kind}`);
    assert(/^\s*Yes\./.test(plain(r)), `"${q}" does not open with Yes`);
  }
});

check('opinion and comparison questions are never forced into yes/no', () => {
  const r = ask('Is MCP better than A2A?');
  assert(!r.verdict, 'a comparison got a verdict');
  assert(!/^\s*(Yes|No)\./.test(plain(r)), 'comparison answered as yes/no');
});

check('a topic question maps to the project on the website AND its GitHub repository', () => {
  const r = ask('Tell me about the Knowledge Fabric project and its code.');
  const srcs = new Set(r.citations.map(c => c.chunk.source_type));
  // The website text is drawn from the README, so the composer may keep only one
  // of two near-identical sentences; the GitHub record must still be top evidence.
  const top = new Set(r.ranked.slice(0, 5).map(x => idx.chunks[x.chunkIdx].source_type));
  assert(srcs.has('website') && (srcs.has('github') || top.has('github')), `sources were ${[...srcs]}; top-5 ${[...top]}`);
  const rel = r.related || [];
  assert(rel.some(c => c.kind === 'repository' && /github\.com\/PrashobhPaul\/Knowledge-Fabric/.test(c.url)), 'repository card missing');
  assert(rel.some(c => c.kind === 'project' && /prashobhpaul/.test(c.url)), 'website/live project card missing');
});

check('a video-level question cites a chapter or transcript window with a timestamped URL', () => {
  const r = ask('What does Prashobh say about the history of Key Monastery?');
  const deep = r.citations.filter(c => ['chapter', 'transcript'].includes((c.chunk.meta || {}).record_type));
  assert(deep.length > 0, `no chapter/transcript cited: ${r.citations.map(c => (c.chunk.meta || {}).record_type)}`);
  assert(deep.every(c => /&t=\d+s$/.test(c.chunk.url)), `timestamp missing from ${deep.map(c => c.chunk.url)}`);
  assert(deep.every(c => c.chunk.meta.t_label), 'chapter/transcript lacks a readable time label');
});

check('chapter lists are records, not prose: no "0:00 –" dumps inside video text', () => {
  const vids = idx.chunks.filter(c => (c.meta || {}).record_type === 'video');
  const dumps = vids.filter(c => /\b\d{1,2}:\d{2}\s*[–\-—]?\s*[A-Z][^.]{3,40}\s+\d{1,2}:\d{2}\b/.test(c.text));
  assert(dumps.length === 0, `${dumps.length} video records still carry a chapter list in prose`);
  assert(idx.chunks.some(c => (c.meta || {}).record_type === 'chapter'), 'no chapter records built');
  assert(idx.chunks.some(c => (c.meta || {}).record_type === 'transcript'), 'no transcript records built');
});

check('discourse markers never double up ("However, however")', () => {
  for (const q of BANK) {
    const text = plain(ask(q));
    assert(!/\b(However|Separately|Specifically|Elsewhere),?\s+(however|separately|specifically|elsewhere)\b/i.test(text), `doubled marker in "${q}"`);
  }
});

const { renderRelated } = await import(path.join(SITE, 'js/related.js'));
check('the related strip renders openable cards and is wired into the page', () => {
  const html = renderRelated([{ kind: 'video', title: 'T', url: 'https://www.youtube.com/watch?v=x&t=61s', sub: 'YouTube · ▶ 1:01', thumbnail: '' }]);
  assert(/related-card/.test(html) && /t=61s/.test(html), 'card not rendered with its timestamped link');
  assert(/id="answer-related"/.test(HTML), 'index.html lacks the related container');
  assert(/\.related-card/.test(CSS), 'related cards unstyled');
});

// =============================================================================
console.log('\n=== MULTILINGUAL & VOICE: ENGLISH DEFAULT, MALAYALAM / TELUGU / HINDI ===');
const ml = await import(path.join(SITE, 'js/multilingual.js'));
const voice = await import(path.join(SITE, 'js/voice.js'));

check('tokenisers keep Malayalam, Telugu and Hindi words whole', () => {
  const toks = tokenize('ജീവിതയാത്ര The Journey Of Life ప్రయాణం यात्रा');
  assert(toks.includes('ജീവിതയാത്ര'), `Malayalam token shredded: ${toks}`);
  assert(toks.includes('ప్రయాణం') && toks.includes('यात्रा'), `Telugu/Hindi tokens missing: ${toks}`);
});

check('a Malayalam question retrieves the Malayalam-titled video', () => {
  const r = ask('ജീവിതയാത്ര വീഡിയോ');
  assert(r.analysis.lang === 'ml', `lang detected as ${r.analysis.lang}`);
  const hit = r.ranked.slice(0, 5).some(x => /ജീവിതയാത്ര/.test(idx.chunks[x.chunkIdx].text));
  assert(hit, 'Malayalam title not in the top results');
  assert(r.citations.some(c => (c.chunk.meta || {}).lang === 'ml'), 'Malayalam evidence not cited');
});

check('the lexicon carries Indic-script names onto English records', () => {
  const ex = ml.expandQuery('പ്രശോഭ് ഇപ്പോൾ എവിടെ ജോലി ചെയ്യുന്നു?');
  assert(ex.lang === 'ml' && ex.added.includes('prashobh') && ex.added.includes('where'), JSON.stringify(ex));
  const r = ask('പ്രശോഭ് ഇപ്പോൾ എവിടെ ജോലി ചെയ്യുന്നു?');
  assert(/Qualizeal/.test(plain(r)), 'Malayalam "where does he work now" did not reach Qualizeal');
  const hi = ml.expandQuery('प्रशोभ कहाँ काम करता है?');
  assert(hi.lang === 'hi' && hi.added.includes('prashobh'), JSON.stringify(hi));
  assert(ml.expandQuery('Where does Prashobh work?').added.length === 0, 'English questions are never expanded');
});

check('English is the default language and the five languages carry BCP-47 codes', () => {
  assert(ml.DEFAULT_LANG === 'en');
  for (const [k, v] of Object.entries(ml.LANGS)) assert(new RegExp(`^${k}-IN$`).test(v.code), `${k} code ${v.code}`);
  assert(Object.keys(ml.LANGS).join() === 'en,ml,te,ta,hi');
});

check('voice controls and the listen button are wired into the page', () => {
  const html = voice.renderVoiceControls('ml');
  assert(/id="lang-select"/.test(html) && /id="mic-btn"/.test(html) && /value="ml" selected/.test(html), 'controls not rendered');
  assert(/id="answer-speak"/.test(voice.renderSpeakButton()), 'listen button not rendered');
  assert(/id="voice-controls"/.test(HTML) && /id="answer-voice"/.test(HTML), 'index.html lacks the voice containers');
  assert(/\.voice-btn/.test(CSS), 'voice controls unstyled');
});

check('an Indic-script question answered from English evidence says so; same-language evidence needs no note', () => {
  assert(/Malayalam/.test(ml.languageNote('ml', ['en'])), 'no note for English-only evidence');
  assert(ml.languageNote('ml', ['ml', 'en']) === null && ml.languageNote('en', ['en']) === null, 'note shown when not needed');
});

// =============================================================================
console.log('\n=== THE TWIN: FIRST PERSON, NO NEW FACTS, ONE SITE ===');
const persona = await import(path.join(SITE, 'js/persona.js'));

check('the persona rewrites cited sentences into the first person without touching the facts', () => {
  const s = persona.toFirstPerson("Prashobh Paul has worked at Qualizeal as AI Architect in the AI Center of Excellence (AI-CoE) / AI Think Tank since January 2026 (current role), based in Hyderabad, India.");
  assert(/^I have worked at Qualizeal as AI Architect/.test(s), s);
  assert(!/Prashobh/.test(s) && /Hyderabad, India/.test(s) && /January 2026/.test(s), s);
  const v = persona.toFirstPerson("'Key Monastery Explained' is a YouTube Short published on The Canvas of Earth by Prashobh Paul on 17 December 2025 with a duration of 6 minutes 1 seconds.");
  assert(/I published on The Canvas of Earth on 17 December 2025/.test(v), v);
  const m = persona.toFirstPerson("The website adds that he also takes on consulting and advisory engagements for teams and enterprises.");
  assert(/^I also take on consulting/.test(m), m);
  assert(persona.toFirstPerson("Prashobh's skills include Python.") === 'My skills include Python.');
});

check('a twin reply is the fabric answer in the first person, with the same citations', () => {
  const r = ask('Where does Prashobh work currently?');
  const reply = persona.firstPersonAnswer(r, { spokenSentences: 2 });
  assert(/I have worked at Qualizeal/.test(reply.text), reply.text);
  assert(!/\b(he|his|Prashobh)\b/.test(reply.text), `third person survived: ${reply.text}`);
  const no = persona.firstPersonAnswer(ask('Does Prashobh teach AI on YouTube?'));
  assert(/^No, not that I have on record/.test(no.text), no.text);
});

check('the avatar stage sits in the hero beside the graph, with an inline video player, on ONE site', () => {
  const hero = HTML.slice(HTML.indexOf('id="hero"'), HTML.indexOf('id="section-answer"'));
  assert(/id="twin-stage"/.test(hero) && /id="galaxy"/.test(hero), 'stage and graph are not both in the hero');
  assert(!/hero-title/.test(hero), 'the hero write-up was not removed');
  assert(/id="answer-player"/.test(HTML) && /id="twin-mute"/.test(HTML) && /id="twin-greet"/.test(HTML), 'player / stage controls missing');
  assert(!fs.existsSync(path.join(SITE, 'twin')), 'a second twin site still exists');
  assert(/grid-template-columns: 1fr 1fr/.test(CSS.slice(CSS.indexOf('Hero: avatar'))), 'hero is not a 50/50 grid');
});

check('the bundled avatar carries mouth shapes and the voice is baked, never called live', () => {
  const glb = fs.readFileSync(path.join(SITE, 'assets/avatar.glb'));
  assert(glb.length > 1e6 && glb.includes('viseme_aa') && glb.includes('jawOpen'), 'avatar lacks viseme morph targets');
  const bake = fs.readFileSync(path.join(ROOT, 'scripts/voice_bake.mjs'), 'utf8');
  assert(/ELEVENLABS_API_KEY/.test(bake) && /sha1/.test(bake) && !/sk_[a-f0-9]{20}/.test(bake), 'bake script misconfigured or leaks a key');
  for (const f of ['js/speaker.js', 'js/stage.js', 'js/twinconfig.js']) assert(fs.existsSync(path.join(SITE, f)), `${f} missing`);
  const main = fs.readFileSync(path.join(SITE, 'js/main.js'), 'utf8');
  assert(!/api\.elevenlabs\.io|ttsEndpoint/.test(main), 'the live site must not call a TTS API');
  assert(/youtube-nocookie\.com\/embed/.test(main) && /data-video/.test(fs.readFileSync(path.join(SITE, 'js/related.js'), 'utf8')), 'inline video player not wired');
  assert(fs.existsSync(path.join(ROOT, '.github/workflows/voice.yml')), 'voice bake workflow missing');
});

// =============================================================================
console.log('\n=== CANON: THE OWNER\'S OWN ANSWERS, EACH WITH PROOF ===');
const canonMod = await import(path.join(SITE, 'js/canon.js'));
const semNLU = await import(path.join(SITE, 'js/nlu_semantic.js'));

check('the index ships the curated canon and every evidence link resolved to a record', () => {
  assert(Array.isArray(idx.canon) && idx.canon.length >= 25, `canon has ${idx.canon && idx.canon.length} entries`);
  assert((idx.canon_unresolved || []).length === 0, `unresolved evidence: ${idx.canon_unresolved}`);
  for (const e of idx.canon) {
    assert(e.questions.length && e.answer.length > 80, `${e.id} is thin`);
    assert(e.evidence.length && e.evidence.every(ev => ev.chunk_ids.length), `${e.id} has evidence without a proof record`);
  }
});

check('the major questions land on the canon and are answered in the owner\'s words with proofs from several sources', () => {
  const cases = [
    ['Where does Prashobh work currently?', 'current-role', /I work at Qualizeal as an AI Architect/],
    ['What projects has Prashobh built?', 'projects', /RVonWheelz.*Koode.*Pachaka Lokam.*Invest\.IQ/],
    ['Do you teach AI?', 'training', /Yes, I do\./],
    ['Which companies have you worked for?', 'career-history', /Tech Mahindra/],
    ['What is the Key Monastery video about?', 'key-monastery', /eleventh century/],
  ];
  for (const [q, id, re] of cases) {
    const m = canonMod.matchCanon(q, idx.canon);
    assert(m && m.entry.id === id, `"${q}" matched ${m && m.entry.id}`);
    const r = canonMod.applyCanon(ask(q), m, idx.chunks);
    assert(re.test(r.canon.answer), `${id}: answer text unexpected`);
    assert(r.citations.length >= 2, `${id}: fewer than two proofs`);
    assert(/In Prashobh's own words/.test(plain(r)), 'canon answer not framed as the owner\'s words');
  }
  const proj = canonMod.applyCanon(ask('What projects has Prashobh built?'), canonMod.matchCanon('What projects has Prashobh built?', idx.canon), idx.chunks);
  const srcs = new Set(proj.citations.map(c => c.chunk.source_type));
  assert(srcs.has('github') && srcs.has('website'), `projects proofs came from ${[...srcs]}`);
});

check('everyday phrasings, typos and synonyms still reach the right curated answer', () => {
  const cases = [
    ['How may kids do you have?', 'family'], ['Are you married?', 'family'], ['Where are you from?', 'origins'],
    ['What did you do at TCS?', 'tcs-story'], ['Which team do you support in IPL?', 'teams'],
    ['What is your proudest achievement?', 'proudest'], ['What does CogniFlow do?', 'cogniflow'],
    ['When is your birthday?', 'birthday'], ['Who inspired you?', 'mentors'], ['What camera do you use?', 'youtube-why'],
  ];
  for (const [q, id] of cases) {
    const m = canonMod.matchCanon(q, idx.canon);
    assert(m && m.entry.id === id, `"${q}" → ${m ? m.entry.id : 'no match'}`);
  }
  assert(idx.canon.length >= 45, `canon has ${idx.canon.length}`);
  assert(canonMod.suggestCanon('what is your blood group', idx.canon).length >= 1, 'no suggestions for an unanswered question');
});

check('semantic NLU: cosine matching with margin, and a chunk run from vectors', () => {
  const v = (...xs) => { const n = Math.hypot(...xs); return xs.map(x => x / n); };
  const vectors = { canon: [
    { id: 'youtube-why', vectors: [v(1, 0.2, 0), v(0.9, 0.3, 0)] },
    { id: 'favourite-project', vectors: [v(0, 1, 0.1)] },
  ], chunks: [v(1, 0, 0), v(0, 1, 0), v(0.7, 0.7, 0)] };
  const q = v(0.95, 0.25, 0.02);
  const m = semNLU.matchCanonByVector(q, vectors);
  assert(m && m.id === 'youtube-why' && m.score > 0.9, JSON.stringify(m));
  assert(semNLU.matchCanonByVector(v(0, 0, 1), vectors) === null, 'unrelated vector should not match');
  assert(semNLU.matchCanonByVector(v(1, 1, 0), { canon: [{ id: 'a', vectors: [v(1, 0, 0)] }, { id: 'b', vectors: [v(0, 1, 0)] }] }) === null, 'a tie must not pick a side');
  const run = semNLU.chunkRun(q, vectors, 2);
  assert(run.length === 2 && run[0].chunkIdx === 0, JSON.stringify(run));
  assert(!semNLU.modelReady() && semNLU.embed('x') instanceof Promise, 'embed must be safe before the model loads');
  const hy = fs.readFileSync(path.join(SITE, 'js/hybrid.js'), 'utf8');
  assert(/extraRun/.test(hy) && /retriever: 'embedding'/.test(hy), 'embedding run not fused');
  assert(/pipeline\.embed/.test(fs.readFileSync(path.join(ROOT, '.github/workflows/deploy.yml'), 'utf8')), 'deploy does not compute vectors');
});

check('questions the owner has not curated still go through the fabric', () => {
  assert(canonMod.matchCanon('What is the capital of France?', idx.canon) === null, 'off-topic question matched the canon');
  assert(canonMod.matchCanon('Which videos are about Manali?', idx.canon) === null || canonMod.matchCanon('Which videos are about Manali?', idx.canon).score < 1, 'unexpected exact match');
});

// =============================================================================
console.log('\n=== GOLDEN Q&A: THE PRODUCTION ANSWER PATH, QUESTION BY QUESTION ===');
const { answerQuestion } = await import(path.join(SITE, 'js/pipeline.js'));
const GOLD = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/qa_gold.json'), 'utf8'));
const pipeCtx = { index: idx, bm25, bm25Payload: idx.bm25, semantic, chunks: idx.chunks, filters: {}, qvec: null };

check('every golden question lands on the expected curated answer, in the owner\'s words, with proofs and key facts', () => {
  const misses = [];
  for (const c of GOLD.cases) {
    const r = answerQuestion(c.q, pipeCtx);
    if (!r.canonMatch || r.canonMatch.id !== c.id) { misses.push(`"${c.q}" → ${r.canonMatch ? r.canonMatch.id : (r.noAnswer ? 'no-answer' : 'retrieval')}`); continue; }
    if (!/In Prashobh's own words/.test(plain(r)) || r.citations.length < 1) misses.push(`"${c.q}" matched but not framed/cited`);
    if (c.must && !plain(r).includes(c.must)) misses.push(`"${c.q}" lacks "${c.must}"`);
  }
  assert(GOLD.cases.length >= 200, `golden set shrank to ${GOLD.cases.length}`);
  assert(misses.length === 0, `${misses.length}/${GOLD.cases.length} golden questions off target:\n          ` + misses.join('\n          '));
});

check('questions with no answer on record say so instead of showing a collage', () => {
  for (const q of GOLD.no_answer) {
    const r = answerQuestion(q, pipeCtx);
    assert(r.noAnswer, `"${q}" was answered (${r.canonMatch ? r.canonMatch.id : 'retrieval'})`);
    assert(/do not have a direct answer|private, so it is not on record/.test(plain(r)) && (r.summary.sentences || []).length === 0, `"${q}" fallback not honest`);
  }
});

// Rounds 2–7: unseen, harder questions written after the golden set — paraphrases,
// typos and shorthand, Indic scripts, several questions in one, comparisons,
// career before/after, follow-ups that say "it", small talk, privacy and errands.
const ROUNDS = ['qa_round2.json', 'qa_round3.json', 'qa_round4.json', 'qa_round5.json', 'qa_round6.json', 'qa_round7.json', 'qa_round8.json', 'qa_interview_s1.json', 'qa_interview_s2.json', 'qa_interview_s3.json', 'qa_interview_heldout.json', 'qa_lang.json']
  .map(f => [f, JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', f), 'utf8'))]);
check('every harder round (multi-part, comparisons, follow-ups, Indic, typos) answers as the owner would', () => {
  const misses = [];
  let n = 0;
  for (const [f, G] of ROUNDS) for (const c of G.cases) {
    n++;
    const r = answerQuestion(c.q, { ...pipeCtx, prev: c.prev || null });
    const got = r.canonMatch ? r.canonMatch.id : (r.noAnswer ? 'NO-ANSWER' : 'RETRIEVAL');
    const want = Array.isArray(c.id) ? c.id : [c.id];
    if (!want.includes(got)) misses.push(`${f}: "${c.q}" → ${got} (want ${want.join('|')})`);
    else if (c.must && !plain(r).includes(c.must)) misses.push(`${f}: "${c.q}" lacks "${c.must}"`);
    else if ((c.must_all || []).some(t => !plain(r).toLowerCase().includes(String(t).toLowerCase())))
      misses.push(`${f}: "${c.q}" misses rubric points ${(c.must_all || []).filter(t => !plain(r).toLowerCase().includes(String(t).toLowerCase())).join(', ')}`);
  }
  assert(n >= 240, `the harder rounds shrank to ${n} questions`);
  assert(misses.length === 0, `${misses.length}/${n} off target:\n          ` + misses.join('\n          '));
});

// Coverage: every curated question in five wordings, every video and every public
// repo by name (tests/gen_coverage.py regenerates it from the index).
check('coverage: every wording of every curated question, every video and every repo, answered and cited', () => {
  const COV = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/qa_coverage.json'), 'utf8'));
  const misses = [];
  for (const c of COV.cases) {
    const r = answerQuestion(c.q, pipeCtx);
    const got = r.canonMatch ? r.canonMatch.id : (r.noAnswer ? 'NO-ANSWER' : 'RETRIEVAL');
    if (c.cite) {
      const urls = [...(r.citations || []).map(x => x.chunk.url || ''), ...(r.related || []).map(x => x.url || ''), r.answerHtml || ''].join(' ');
      if (r.noAnswer || !urls.includes(c.cite)) misses.push(`"${c.q}" does not cite ${c.cite}`);
    } else if (!got.split('+').includes(c.id)) misses.push(`"${c.q}" → ${got} (want ${c.id})`);
  }
  assert(COV.cases.length >= 800, `coverage shrank to ${COV.cases.length}`);
  assert(misses.length === 0, `${misses.length}/${COV.cases.length} off:\n          ` + misses.slice(0, 15).join('\n          '));
});

check('voice in and out in English, Malayalam, Telugu, Tamil and Hindi; core answers translated in all four', () => {
  const { LANGS, detectScript } = ml;
  for (const [k, code] of [['en', 'en-IN'], ['ml', 'ml-IN'], ['te', 'te-IN'], ['ta', 'ta-IN'], ['hi', 'hi-IN']])
    assert(LANGS[k] && LANGS[k].code === code, `language ${k} missing`);
  assert(detectScript('நீங்கள் யார்?') === 'ta' && detectScript('आप कौन हैं?') === 'hi', 'script detection');
  const core = ['who', 'current-role', 'family', 'location', 'origins', 'education', 'projects', 'koode', 'pachaka-lokam', 'skills', 'youtube', 'contact'];
  for (const id of core) {
    const e = idx.canon.find(x => x.id === id);
    for (const l of ['ml', 'te', 'ta', 'hi']) assert(e && e.i18n && e.i18n[l] && detectScript(e.i18n[l]) === l, `${id} has no ${l} translation`);
  }
  const r = answerQuestion('நீங்கள் எங்கே வேலை செய்கிறீர்கள்?', pipeCtx);
  assert(r.answerLang === 'ta' && /lang="ta"/.test(r.answerHtml) && /answer-original/.test(r.answerHtml), 'a Tamil question is answered in Tamil, with the English original');
});

check('off-topic questions, errands and private details in the harder rounds are declined honestly', () => {
  const misses = [];
  for (const [f, G] of ROUNDS) for (const q of G.no_answer) {
    const r = answerQuestion(q, pipeCtx);
    if (!r.noAnswer) misses.push(`${f}: "${q}" → ${r.canonMatch ? r.canonMatch.id : 'retrieval'}`);
  }
  assert(misses.length === 0, misses.join('\n          '));
});

check('a pronoun whose subject the question names in an earlier clause is answered; a bare one is still declined', () => {
  for (const q of ['What is self-attention and how is it different from attention?', 'What is self-attention, and how does it differ from attention?']) {
    const r = answerQuestion(q, pipeCtx);
    assert(r.canonMatch && r.canonMatch.id === 'iv1-transformer', `"${q}" → ${r.canonMatch ? r.canonMatch.id : (r.noAnswer ? 'NO-ANSWER' : 'retrieval')}`);
  }
  for (const q of ['Who built it?', 'Who designed and built it?', 'What time is it?', 'Is it open source?']) {
    assert(answerQuestion(q, pipeCtx).noAnswer, `"${q}" was answered, but "it" points at nothing`);
  }
});

check('client names stay confidential in every curated answer, note and indexed record', () => {
  const CLIENT = /Southwest|PwC|Pricewaterhouse|American Express|\bAmex\b/i;
  const canonText = JSON.stringify(idx.canon);
  assert(!CLIENT.test(canonText), 'a client name is in the canon');
  const leak = idx.chunks.find(c => CLIENT.test(c.text || '') || CLIENT.test(c.title || '') || CLIENT.test(JSON.stringify(c.meta || {})));
  assert(!leak, `a client name is in the index: ${leak && (leak.text || '').slice(0, 120)}`);
  assert(!CLIENT.test(JSON.stringify(idx.graph || idx.entities || {})), 'a client name is in the graph');
  for (const f of fs.readdirSync(path.join(ROOT, 'docs_source/notes'), { recursive: true })) {
    if (!String(f).endsWith('.md')) continue;
    const t = fs.readFileSync(path.join(ROOT, 'docs_source/notes', String(f)), 'utf8');
    assert(!/Southwest|PwC|American Express/i.test(t), `client name in ${f}`);
  }
});

check('every deploy cache-busts the modules, so visitors never run a stale matcher', () => {
  const wf = fs.readFileSync(path.join(ROOT, '.github/workflows/deploy.yml'), 'utf8');
  assert(/Cache-bust/.test(wf) && /GITHUB_SHA/.test(wf), 'deploy does not stamp module versions');
  const at = (s) => wf.indexOf(s);
  assert(at('run: node tests/prove.mjs') > at('node tests/integration.test.mjs') && at('run: node tests/prove.mjs') > at('python -m eval.evaluate --gate')
    && at('run: node tests/prove.mjs') < at('upload-pages-artifact') && at('node tests/integration.test.mjs') > 0,
    'deploy must run the proof after the integration and eval gates and before the Pages upload');
  const main = fs.readFileSync(path.join(SITE, 'js/main.js'), 'utf8');
  assert(/from '\.\/pipeline\.js/.test(main) && !/matchCanon\(/.test(main), 'the page must use the shared pipeline');
});

console.log('\n' + '='.repeat(62));
console.log(`  ${passed} passed, ${failed} failed`);
console.log('='.repeat(62));
if (failed) {
  console.log('\nfailures:');
  for (const [n, m] of failures) console.log(`  ${n}\n    ${m}`);
  process.exit(1);
}
