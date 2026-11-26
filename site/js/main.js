// ============================================================================
// Eidolon — main entry (runs on the Knowledge Fabric engine)
// ============================================================================

import { BM25, cohereByDocument, tokenize } from './search.js?v=5';
import { buildAnswer } from './answer.js?v=5';
import { KnowledgeGraph } from './graph.js?v=6';
import { initInsights } from './insights.js?v=6';
import { initLineage, renderLineage } from './lineage.js?v=6';
import { initExplain, openExplain } from './explain.js?v=6';
import { matchQuestionBank, QUESTION_BANK } from './questionbank.js?v=5';
import { Typeahead } from './typeahead.js?v=12';
import { loadSemanticIndex } from './semantic.js?v=6';
import { hybridSearch, explainRanking } from './hybrid.js?v=6';
import { renderConfidenceBreakdown } from './confidence.js?v=8';
import { computeHealth, renderHealthDerivation, healthNarrative } from './health.js?v=10';
import { renderMaturityRings, bindMaturityRings } from './rings.js?v=13';
import { BRAND, applyBrand } from './brand.js?v=11';
import { explainGraphContribution, renderGraphContribution, graphPurposeCopy }
  from './graphvalue.js?v=10';
import { recordTrace, allTraces, renderTraces, renderFlagBox, renderGapBoard } from './traces.js?v=3';
import { renderRelated } from './related.js?v=1';
import { languageNote, LANGS } from './multilingual.js?v=1';
import { TWIN_CONFIG } from './twinconfig.js?v=1';
import { createStage } from './stage.js?v=2';
import { firstPersonAnswer, verdictLine, noAnswerLine } from './persona.js?v=1';
import * as speaker from './speaker.js?v=2';
import { answerQuestion } from './pipeline.js?v=2';
import * as semNLU from './nlu_semantic.js?v=1';
import { currentLang, setLang, listen, speak, recognitionSupported, synthesisSupported, renderVoiceControls, renderSpeakButton } from './voice.js?v=2';
import { startAmbient } from './ambient.js?v=1';
import { initMotion, observeReveals, countUp, initMetrics, initTips, replay } from './motion.js?v=2';
import { flipCard, breakdown, initFlips } from './flip.js?v=1';
import { credibilityFacts } from './cred.js?v=1';

const INDEX_URL = 'data/index.json';

// ============================================================================
// Global state
// ============================================================================
const state = {
  index: null,
  bm25: null,
  graph: null,
  chunks: [],
  chunksById: new Map(),
  entitiesById: new Map(),
  lastQuery: null,
  lastResult: null,
};

// ============================================================================
// Boot
// ============================================================================
async function boot() {
  // The living background and the page's response to the pointer come first:
  // they need nothing from the index, so the page is alive while it loads.
  state.ambient = startAmbient(document.getElementById('ambient-canvas'));
  initMotion();
  initMetrics();   // numbers, bars and arcs play when they come into view
  initTips();
  initFlips();
  applyBrand(document);

  // The twin: avatar on the stage, baked voice manifest, stage controls.
  const stageHost = document.getElementById('twin-stage');
  if (stageHost) {
    createStage(stageHost, { avatarUrl: TWIN_CONFIG.avatarUrl, photoUrl: TWIN_CONFIG.photoUrl, name: TWIN_CONFIG.ownerName })
      .then(st => { state.stage = st; setTwinStatus(); });
    speaker.loadVoiceManifest(TWIN_CONFIG.voiceDir).then(setTwinStatus);
    // Semantic NLU warms in the background; lexical matching serves meanwhile.
    semNLU.loadVectors().then(v => { if (v) semNLU.warmModel().then(setTwinStatus); });
    wireStageActions();
  }
  try {
    // 'no-cache' forces the browser to revalidate the index with the server on
    // every load, so a freshly-deployed corpus (new documents) shows up without
    // needing a manual hard refresh. A 304 keeps it fast when nothing changed.
    const res = await fetch(INDEX_URL, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Failed to load index: ${res.status}`);
    state.index = await res.json();
  } catch (err) {
    showFatalError(err.message);
    return;
  }

  state.chunks = state.index.chunks;
  state.chunksById = new Map(state.chunks.map(c => [c.id, c]));
  state.entitiesById = new Map(state.index.entities.map(e => [e.id, e]));
  state.bm25 = new BM25(state.index.bm25);
  state.semantic = null;
  state.retrievalMode = 'lexical';
  state.filters = {};

  // Semantic layer loads after first paint. The app is fully usable on BM25
  // alone while this is in flight, then silently upgrades to hybrid.
  loadSemanticIndex().then(sem => {
    state.semantic = sem;
    if (sem.enabled) {
      state.retrievalMode = 'hybrid';
      console.info(`[fabric] semantic layer online — ${sem.method}, ${sem.dims}d, ` +
                   `${(sem.explainedVariance * 100).toFixed(1)}% variance`);
    }
    updateRetrievalBadge();
  });

  renderCredibility();
  renderCommandTiles();
  renderHealthExplainer();
  renderMaturityScore();
  renderKnowledgeRisk();
  renderLineageDemo();
  populateSuggestions();
  setupGalaxy();
  setupCopilot();
  setupSuggestions();
  setupTypeahead();
  setupDerivationToggles();

  initLineage({ onChunkClick: id => showChunkDetail(state.chunksById.get(id)) });
  renderTraces(allTraces(), { onAsk: q => ask(q) });
  renderGapBoard(state.index.flags || null);
  initExplain(state.index);
  // A concept chosen in the corpus view is shown where it lives: in the graph.
  initInsights(state.index, { onEntityClick: (id) => {
    showEntityDetail(id);
    const frame = document.querySelector('.galaxy-frame');
    if (frame) frame.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } });

  // Seed Section 2 + Section 3 with a real demo answer so a director scrolling
  // past the hero immediately sees the product working, not an empty stage.
  // First user click runs through the normal ask() flow and overwrites this.
  seedDemoAnswer();

  // Sections come into focus as they scroll in (rendered content included).
  observeReveals();
}

// Curated demo questions — hand-vetted to return strong, fully-cited answers
// that also light up the knowledge graph and lineage. When this list is
// non-empty it takes precedence over the auto-generated "What is <doc>?"
// suggestions, so a demo always opens on its best foot. Each still runs
// through the real ask() pipeline, so citations, graph, and lineage stay in
// sync — nothing here is a canned answer. Empty the array to fall back to the
// corpus-derived suggestions.
// Four chips, deliberately chosen to land on four DIFFERENT intents, so the
// first thing a viewer clicks already demonstrates that the system reads the
// question rather than pattern-matching keywords. Each scores above 60% on the
// current corpus — measured, not asserted.
//
const PRESET_QUESTIONS = [
  'Where does Prashobh work currently?',                 // CAREER
  'What projects has Prashobh built?',                   // PROJECTS
  'Which agent frameworks does Prashobh use?',           // SKILLS
  'What videos has Prashobh made about Spiti Valley?',   // YOUTUBE
];

// The questions to surface as chips / seed the demo answer: curated presets
// when defined, otherwise generated generically from the indexed documents.
function demoQuestions() {
  return PRESET_QUESTIONS.length ? PRESET_QUESTIONS.slice() : generateSuggestedQuestions();
}

// Pick a strong demo question so a director scrolling past the hero
// immediately sees the product working, not an empty stage. First user click
// runs through ask() and overwrites this.
function seedDemoAnswer() {
  const demoQ = demoQuestions()[0];
  if (!demoQ) return;
  // Run on next tick to let Galaxy finish first render
  setTimeout(() => ask(demoQ, { silent: true }), 350);
}

function showFatalError(message) {
  const html = `
    <div class="stage-error" role="alert">
      <p class="stage-error-title">The knowledge index didn’t load.</p>
      <p class="stage-error-body">Refresh the page to try again. If you are running Eidolon locally, build the index first with <code>python -m pipeline.build_index</code>.</p>
      <p class="stage-error-detail">${escapeHtml(message)}</p>
    </div>`;
  const empty = document.getElementById('answer-stage-empty');
  if (empty) { empty.innerHTML = html; empty.removeAttribute('aria-busy'); }
  const status = document.getElementById('galaxy-status');
  if (status) status.textContent = 'Graph unavailable until the index loads.';
  document.getElementById('messages').innerHTML = html;
}

// ============================================================================
// Corpus tiles — five headline counts, each one a flip card with its working
// ============================================================================
const SOURCE_LABEL = { document: 'Resume', profile: 'Profile', canon: 'Own words', website: 'Website',
                       youtube: 'YouTube', github: 'GitHub', linkedin: 'LinkedIn' };
const SOURCE_SYSTEM = { canon: 'Written by Prashobh', document: 'Resume and notes', profile: 'Structured profile',
                        website: 'prashobhpaul.com', youtube: 'The Canvas of Earth', github: 'github.com/PrashobhPaul',
                        linkedin: 'Posts and events' };
const SOURCE_ORDER = ['document', 'profile', 'canon', 'website', 'youtube', 'github', 'linkedin'];

// One consistent line-icon set (1.6 stroke, 24 grid) for the source systems.
const SOURCE_ICON = {
  document: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 16h5"/>',
  profile:  '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="11" r="2.2"/><path d="M5.8 16.2c.6-1.6 1.8-2.4 3.2-2.4s2.6.8 3.2 2.4M14 10h4M14 13.5h3"/>',
  canon:    '<path d="M7 7h4v4c0 3-1.5 5-4 6M14 7h4v4c0 3-1.5 5-4 6"/>',
  website:  '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.6 5.4 3.6 8.5s-1.1 5.9-3.6 8.5c-2.5-2.6-3.6-5.4-3.6-8.5s1.1-5.9 3.6-8.5z"/>',
  youtube:  '<rect x="3" y="6" width="18" height="12" rx="3.5"/><path d="M10.5 9.5v5l4.3-2.5z"/>',
  github:   '<circle cx="6.5" cy="6" r="2"/><circle cx="6.5" cy="18" r="2"/><circle cx="17.5" cy="9" r="2"/><path d="M6.5 8v8M17.5 11c0 3.5-4.5 3-9.5 5.5"/>',
  linkedin: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M8 10.5V16M8 7.6v.1M11.5 16v-3.2c0-1.5.9-2.4 2.1-2.4s2 .9 2 2.4V16M11.5 10.5V16"/>',
};
function sourceIcon(type) {
  const p = SOURCE_ICON[type] || '<circle cx="12" cy="12" r="3"/>';
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
}

// The index lists one row per connector run, so the curated answers arrive as
// five "Canon" rows and GitHub as two. A reader thinks in source systems: merge
// rows of the same type, add their records, keep the latest sync.
function mergedSources() {
  const by = new Map();
  for (const s of state.index.sources || []) {
    const t = s.source_type;
    if (!by.has(t)) by.set(t, { ...s, records: 0, systems: new Set() });
    const m = by.get(t);
    m.records += s.records || 0;
    m.chunks = Math.max(m.chunks || 0, s.chunks || 0);
    m.systems.add(s.system);
    if ((s.last_synced || '') > (m.last_synced || '')) m.last_synced = s.last_synced;
    if (s.status === 'error') m.status = 'error';
    if (s.synced_by === 'knowledge_factory') m.synced_by = 'knowledge_factory';
  }
  return [...by.values()].sort((a, b) => SOURCE_ORDER.indexOf(a.source_type) - SOURCE_ORDER.indexOf(b.source_type));
}

function countBy(list, key) {
  const m = new Map();
  for (const x of list) { const k = key(x); m.set(k, (m.get(k) || 0) + 1); }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function renderCommandTiles() {
  const host = document.getElementById('cmd-tiles');
  if (!host) return;
  const idx = state.index;
  const s = idx.stats;
  const sources = mergedSources();
  const top = (pairs, n, labelOf = k => k) => {
    const head = pairs.slice(0, n).map(([k, v]) => ({ label: labelOf(k), value: v }));
    const rest = pairs.slice(n).reduce((a, [, v]) => a + v, 0);
    if (rest) head.push({ label: 'Other', value: rest });
    return head;
  };
  const docsByType = countBy(idx.documents, d => d.source_type);
  const entsByKind = countBy(idx.entities, e => e.kind);
  const relsByKind = countBy(idx.relationships, r => r.kind);
  const cooc = (relsByKind.find(([k]) => k === 'CO_OCCURS') || [, 0])[1];
  const chunksByType = countBy(state.chunks, c => c.source_type);
  const typed = relsByKind.filter(([k]) => k !== 'CO_OCCURS');
  const KIND_WORD = { ABOUT: 'About', FILMED_AT: 'Filmed at', DOCUMENTED_IN: 'Documented in', USES: 'Uses', SKILLED_IN: 'Skilled in' };

  const tiles = [
    { key: 'documents', label: 'Records', value: s.document_count, delta: `from ${sources.length} source systems`,
      method: 'One record per item a source produced: a resume section, a video, a repository file, an answer in his own words.',
      rows: top(docsByType, 4, t => SOURCE_LABEL[t] || t) },
    { key: 'entities', label: 'Concepts', value: s.entity_count, delta: 'people, projects, skills, places',
      method: 'Named concepts found in the passages at build time and typed by the ontology. Each is one node in the graph.',
      rows: top(entsByKind, 4) },
    { key: 'relationships', label: 'Links', value: s.relationship_count, delta: 'between concepts',
      method: `${(s.relationship_count - cooc).toLocaleString()} typed links (uses, built, filmed at…) plus ${cooc.toLocaleString()} pairs seen together in at least two passages.`,
      rows: [...typed.slice(0, 3).map(([k, v]) => ({ label: KIND_WORD[k] || k.toLowerCase().replace(/_/g, ' '), value: v })),
             { label: 'Seen together', value: cooc }] },
    { key: 'chunks', label: 'Passages', value: s.chunk_count, delta: 'each one citable',
      method: 'Records split into passages small enough to quote. Retrieval ranks these; every citation points at one.',
      rows: top(chunksByType, 4, t => SOURCE_LABEL[t] || t) },
    { key: 'domains', label: 'Sources', value: sources.length, delta: 'systems in the index',
      method: 'Distinct source systems feeding the index. The Knowledge Factory syncs the live ones; the rest are kept in the repository.',
      rows: sources.map(x => ({ label: SOURCE_LABEL[x.source_type] || x.source_type, value: x.records })), unit: 'records' },
  ];

  host.innerHTML = tiles.map(t => flipCard({
    cls: 'tile',
    attrs: { 'data-key': t.key },
    front: `
      <span class="tile-label">${t.label}</span>
      <span class="tile-value" id="tile-${t.key}" data-count="${t.value}" data-group="1">${Number(t.value).toLocaleString()}</span>
      <span class="tile-delta">${escapeHtml(t.delta)}</span>
      ${mixBar(t.rows)}`,
    back: `
      <span class="flip-method">${escapeHtml(t.method)}</span>
      ${breakdown(t.rows)}`,
  })).join('');
  renderSourceStrip(sources);
}

// A thin stacked bar: what a count is made of, in four champagne-to-platinum
// steps. It grows in from the left when the tile is seen.
function mixBar(rows) {
  const total = rows.reduce((a, r) => a + r.value, 0) || 1;
  const segs = rows.slice(0, 5).map((r, i) =>
    `<span class="mix-seg" style="flex:${r.value};--k:${i}"></span>`).join('');
  const top = rows[0];
  return `<span class="tile-mix" aria-hidden="true"><span class="tile-mix-bar js-grow">${segs}</span></span>
    <span class="tile-mix-k">${escapeHtml(top.label)} ${Math.round((top.value / total) * 100)}%</span>`;
}

// The Factory ↔ Fabric handshake, made visible: which source systems feed this
// fabric, how many records each contributed, and when the Factory last synced it.
function renderSourceStrip(sources = mergedSources()) {
  const host = document.getElementById('source-strip');
  if (!host || !state.index.sources) return;
  const fmt = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  host.innerHTML = sources.map(s => {
    let sync;
    if (s.synced_by !== 'knowledge_factory') {
      sync = `<span class="src-sync" data-status="committed">Kept in the repository</span>`;
    } else if (!s.last_synced) {
      sync = `<span class="src-sync" data-status="committed">Synced at build</span>`;
    } else {
      sync = `<span class="src-sync" data-status="${escapeHtml(s.status)}">Synced ${escapeHtml(fmt(s.last_synced))}</span>`;
    }
    const system = SOURCE_SYSTEM[s.source_type] || [...s.systems].join(', ');
    return `<div class="src-card" data-source="${escapeHtml(s.source_type)}" data-tip="${escapeHtml(system)}: ${s.records.toLocaleString()} records, ${Number(s.chunks).toLocaleString()} passages">
      <span class="src-icon" aria-hidden="true">${sourceIcon(s.source_type)}</span>
      <span class="src-label">${escapeHtml(SOURCE_LABEL[s.source_type] || s.source_type)}</span>
      <span class="src-system">${escapeHtml(system)}</span>
      <span class="src-count"><span><b data-count="${s.records}" data-group="1">${s.records.toLocaleString()}</b> records</span><span><b data-count="${s.chunks}" data-group="1">${Number(s.chunks).toLocaleString()}</b> passages</span></span>
      ${sync}
    </div>`;
  }).join('');
}

// The signature band under the hero: who he is, in six facts from the index.
function renderCredibility() {
  const host = document.getElementById('cred-facts');
  if (!host) return;
  const { current, facts } = credibilityFacts(state.index);
  const roleEl = document.getElementById('cred-role');
  if (roleEl && current) {
    roleEl.textContent = `${current.role} at ${current.organization}` + (current.location ? `, ${current.location.replace(/, India$/, '')}` : '');
  }
  host.innerHTML = facts.map((f, i) => `
    <li class="cred-fact" tabindex="0" data-tip="${escapeHtml(f.tip)}" style="--i:${i}">
      <span class="cred-num"><span data-count="${f.value}">${f.value}</span>${f.suffix ? `<span class="cred-suffix">${f.suffix}</span>` : ''}</span>
      <span class="cred-label">${escapeHtml(f.label)}</span>
    </li>`).join('');
}

// ============================================================================
// Suggested questions — derived generically from the document names in the
// indexed corpus. Each unique source document becomes a "What is <name>?"
// prompt after its document-type suffixes (IFU, instruction/reference manual,
// etc.) are stripped, so the chips always track whatever corpus is loaded.
// ============================================================================
function deriveDocumentTopics() {
  const seen = new Set();
  const topics = [];
  for (const name of [...new Set(state.chunks.map(c => c.document_name))].sort()) {
    const topic = name
      .replace(/\.[^.]+$/, '')                                     // drop extension
      .replace(/[_-]+/g, ' ')                                      // separators → spaces
      .replace(/\b(IFU|EN|Instruction|Instructions|Reference|Manual|for|Use)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const key = topic.toLowerCase();
    if (topic && !seen.has(key)) { seen.add(key); topics.push(topic); }
  }
  return topics;
}

function generateSuggestedQuestions() {
  const questions = deriveDocumentTopics().map(t => `What is ${t}?`);
  // Pad to four with corpus-relevant prompts when there are only a few docs.
  const extras = [
    'Who is Prashobh Paul?',
    'What skills does Prashobh have?',
    'What is The Canvas of Earth?',
  ];
  for (const e of extras) { if (questions.length >= 4) break; questions.push(e); }
  return questions.slice(0, 4);
}

function populateSuggestions() {
  const container = document.getElementById('suggestions');
  if (!container) return;
  const qs = demoQuestions();
  container.innerHTML = '';
  for (const q of qs) {
    const btn = document.createElement('button');
    btn.className = 'chip';
    btn.textContent = q;
    container.appendChild(btn);
  }
}

// Section headings that mark reference lists and link pages rather than
// substance. Used only to pick a representative passage for the lineage preview.
const BOILER_RE = /\b(evidence|references|channels|sources|press|recognitions?|insights|blogs?|whitepapers?|reports?|videos?|youtube|linkedin|twitter|official|version|tone)\b/i;
function isBoilerplate(section_path) {
  return (section_path || []).some(s => BOILER_RE.test(s));
}

// What the graph contributed to the answer just produced.
function renderGraphValue(citations, analysis) {
  const host = document.getElementById('graph-value-wrap');
  if (!host || !state.index) return;
  try {
    const contribution = explainGraphContribution(citations, state.index, analysis);
    if (!contribution) { host.hidden = true; host.innerHTML = ''; return; }
    host.innerHTML = renderGraphContribution(contribution, state.index);
    host.hidden = false;
    state.graphContribution = contribution;
  } catch (err) {
    host.hidden = true;
    console.warn('[fabric] graph contribution unavailable:', err.message);
  }
}

function renderHealthExplainer() {
  const host = document.getElementById('health-derivation');
  if (!state.index) return;
  try {
    const health = computeHealth(state.index);
    if (host) host.innerHTML = renderHealthDerivation(health);
    state.health = health;

    // Business-language verdict above the numbers.
    const n = healthNarrative(health);
    const vEl = document.getElementById('health-verdict');
    if (vEl) {
      vEl.innerHTML =
        `<p class="health-verdict-line">${n.headline}</p>` +
        `<p class="health-verdict-detail">${n.weakest}</p>`;
    }
  } catch (err) {
    console.warn('[fabric] health derivation failed:', err.message);
  }
}

function renderMaturityScore() {
  // One concentric ring chart, built from health.metrics directly, so it can
  // never drift from the model. It plays (arcs sweep, score counts) when it is
  // scrolled into view — motion.js watches its [data-play] root.
  const host = document.getElementById('health-rings');
  if (!host || !state.index) return;
  try {
    const health = state.health || computeHealth(state.index);
    state.health = health;
    state.maturity = { overall: health.overall };
    host.innerHTML = renderMaturityRings(health);
    host.removeAttribute('aria-busy');
    bindMaturityRings(host);
  } catch (err) {
    console.warn('[fabric] maturity rings unavailable:', err.message);
  }
}

// ============================================================================
// Knowledge risk — four counts that matter, each a flip card whose back shows
// the method and the real inputs. Where health.js already computes a risk, the
// card reads it from there, so the card and the "show the working" panel can
// never disagree.
// ============================================================================
const SENT_KIND = { fragment: 'Fragments', equation: 'Code and equations', header: 'Headers', table: 'Table rows', legal: 'Legal text' };

function computeRisk() {
  const chunks = state.chunks;
  const entities = state.index.entities || [];
  const docs = state.index.documents || [];

  // 1. Boilerplate: sentences the build-time classifier (pipeline/textnorm.py)
  //    rejected as answer material. The previous card matched section headings
  //    against words like "videos" and "sources", which counted 112 YouTube
  //    records and a PhD section as boilerplate — a number that did not survive
  //    its own explanation.
  const kinds = new Map();
  let sents = 0;
  for (const c of chunks) for (const x of (c.sents || [])) { sents++; if (x.k !== 'prose') kinds.set(x.k, (kinds.get(x.k) || 0) + 1); }
  const debris = [...kinds.values()].reduce((a, v) => a + v, 0);
  const boilerPct = Math.round((debris / Math.max(sents, 1)) * 100);

  // 2. Lone-source topics: top-level section headings found in one record only.
  const topByDoc = new Map();
  for (const c of chunks) {
    const t = (c.section_path || [])[0];
    if (!t) continue;
    if (!topByDoc.has(t)) topByDoc.set(t, new Set());
    topByDoc.get(t).add(c.document_id);
  }
  const loneTopics = [...topByDoc.values()].filter(x => x.size === 1).length;

  // 3. Singleton concepts: mentioned in one passage only.
  const single = entities.filter(e => (e.mention_count || 0) <= 1);

  // 4. Isolated records: share no concept with any other record.
  const linked = new Set();
  for (const e of entities) { const ds = e.document_ids || []; if (ds.length >= 2) for (const d of ds) linked.add(d); }
  const isolated = docs.filter(d => !linked.has(d.id));

  return {
    boilerPct, debris, sents, kinds: [...kinds.entries()].sort((a, b) => b[1] - a[1]),
    loneTopics, topSections: topByDoc.size,
    singletons: single.length, totalEntities: entities.length, singleKinds: countBy(single, e => e.kind),
    isolatedDocs: isolated.length, totalDocs: docs.length, isolatedTypes: countBy(isolated, d => d.source_type),
  };
}

function renderKnowledgeRisk() {
  const r = computeRisk();
  state.risk = r;
  const body = document.getElementById('risk-body');
  if (!body) return;
  const n = (v) => Number(v).toLocaleString();
  const top = (pairs, k, labelOf = x => x) => {
    const rows = pairs.slice(0, k).map(([key, v]) => ({ label: labelOf(key), value: v }));
    const rest = pairs.slice(k).reduce((a, [, v]) => a + v, 0);
    if (rest) rows.push({ label: 'Other', value: rest });
    return rows;
  };
  const TONE_WORD = { low: 'Healthy', medium: 'Watch', high: 'Act on' };

  const card = ({ key, value, suffix = '', label, sub, tone, method, rows, rule, part, whole, of }) => flipCard({
    cls: 'risk-card',
    attrs: { 'data-tone': tone, 'data-key': key },
    front: `
      <span class="risk-card-top">
        <span class="risk-card-value" data-count="${value}"${suffix ? ` data-suffix="${suffix}"` : ''} data-group="1">${n(value)}${suffix}</span>
        <span class="risk-tone">${TONE_WORD[tone]}</span>
      </span>
      <span class="risk-card-label">${label}</span>
      <span class="risk-card-sub">${sub}</span>
      <span class="risk-meter" aria-hidden="true"><span class="js-grow" style="--v:${Math.max(0.01, Math.min(1, part / Math.max(whole, 1))).toFixed(3)}"></span></span>
      <span class="risk-meter-k">${n(part)} of ${n(whole)} ${of}</span>`,
    back: `
      <span class="flip-method">${method}</span>
      ${breakdown(rows)}
      <span class="flip-rule">${rule}</span>`,
  });

  const boilerTone = r.boilerPct > 40 ? 'high' : r.boilerPct > 20 ? 'medium' : 'low';
  const loneTone = r.loneTopics > 10 ? 'medium' : 'low';
  const singleTone = r.singletons > r.totalEntities * 0.3 ? 'medium' : 'low';
  const isoTone = r.isolatedDocs > 5 ? 'high' : r.isolatedDocs > 0 ? 'medium' : 'low';

  body.innerHTML = [
    card({ key: 'boilerplate', value: r.boilerPct, suffix: '%', tone: boilerTone,
      label: 'of sentences are boilerplate',
      sub: 'Fragments, code, tables and headers: indexed for search, never quoted.',
      method: `Every sentence is classified when the index is built. <b>${n(r.debris)}</b> of <b>${n(r.sents)}</b> failed the prose test.`,
      rows: r.kinds.map(([k, v]) => ({ label: SENT_KIND[k] || k, value: v })),
      part: r.debris, whole: r.sents, of: 'sentences',
      rule: 'Green under 20%, amber to 40%, red above.' }),
    card({ key: 'lone', value: r.loneTopics, tone: loneTone,
      label: 'single-source topics',
      sub: 'Top-level sections that appear in only one record.',
      method: `Each passage’s top-level section heading, grouped by the records it appears in. <b>${n(r.loneTopics)}</b> of <b>${n(r.topSections)}</b> headings have exactly one.`,
      rows: [{ label: 'One record', value: r.loneTopics }, { label: 'Two or more', value: r.topSections - r.loneTopics }],
      part: r.loneTopics, whole: r.topSections, of: 'top-level topics',
      rule: 'Amber above 10: one edit to that record and the topic is gone.' }),
    card({ key: 'singletons', value: r.singletons, tone: singleTone,
      label: 'concepts mentioned once',
      sub: 'Named in a single passage, so one revision could erase them.',
      method: `Concepts whose mention count is one. <b>${n(r.singletons)}</b> of <b>${n(r.totalEntities)}</b> graph concepts, by type:`,
      rows: top(r.singleKinds, 3),
      part: r.singletons, whole: r.totalEntities, of: 'concepts',
      rule: 'Amber when more than 30% of all concepts.' }),
    card({ key: 'isolated', value: r.isolatedDocs, tone: isoTone,
      label: 'records linked to nothing',
      sub: 'They share no concept with any other record, so no answer can combine them.',
      method: `Records missing from every concept that spans two or more records. <b>${n(r.isolatedDocs)}</b> of <b>${n(r.totalDocs)}</b>, by source:`,
      rows: top(r.isolatedTypes, 3, t => SOURCE_LABEL[t] || t),
      part: r.isolatedDocs, whole: r.totalDocs, of: 'records',
      rule: 'Red above 5: these can only answer questions that name them.' }),
  ].join('');
}

// ============================================================================
// Source Lineage demo state — populate with a representative real chunk so the
// user sees the lineage UX before asking anything.
// ============================================================================
function renderLineageDemo() {
  const chunks = state.chunks;
  // Pick a non-boilerplate, reasonably substantive chunk to demo with
  const candidate = chunks.find(c =>
    !isBoilerplate(c.section_path) &&
    (c.text || '').length > 80 &&
    (c.section_path || []).length >= 1
  ) || chunks[0];
  if (!candidate) return;

  const statsEl = document.getElementById('lineage-demo-stats');
  if (statsEl) {
    const st = state.index.stats;
    statsEl.innerHTML = `
      <div class="lineage-demo-stat">
        <span class="lineage-demo-stat-val" data-count="${st.document_count}" data-group="1">${st.document_count.toLocaleString()}</span>
        <span class="lineage-demo-stat-label">Records</span>
      </div>
      <div class="lineage-demo-stat">
        <span class="lineage-demo-stat-val" data-count="${st.chunk_count}" data-group="1">${st.chunk_count.toLocaleString()}</span>
        <span class="lineage-demo-stat-label">Citable passages</span>
      </div>
      <div class="lineage-demo-stat">
        <span class="lineage-demo-stat-val" data-count="100" data-suffix="%">100%</span>
        <span class="lineage-demo-stat-label">Quoted verbatim</span>
      </div>
    `;
  }

  const crumbEl = document.getElementById('lineage-demo-breadcrumb');
  if (crumbEl) {
    const docShort = stripExt(candidate.document_name || '');
    const sectionTrail = (candidate.section_path || []).slice(0, 3);
    const parts = [
      `<span class="crumb-cite">[1]</span>`,
      `<span class="crumb-doc">${escapeHtml(docShort)}</span>`,
      `<span class="crumb-sep">›</span>`,
      `<span>${escapeHtml(whereLabel(candidate))}</span>`,
    ];
    for (const s of sectionTrail) {
      parts.push(`<span class="crumb-sep">›</span><span>${escapeHtml(s)}</span>`);
    }
    crumbEl.innerHTML = parts.join('');
  }

  const exEl = document.getElementById('lineage-demo-excerpt');
  if (exEl) {
    const sentence = (candidate.text || '').split(/(?<=[.!?])\s+/)[0] || candidate.text || '';
    const snippet = sentence.length > 240 ? sentence.slice(0, 237) + '…' : sentence;
    exEl.textContent = '“' + snippet + '”';
  }
}

// ============================================================================
// Knowledge Galaxy (graph)
// ============================================================================
function setupGalaxy() {
  const container = document.getElementById('galaxy');
  state.graph = new KnowledgeGraph(container, state.index);
  state.graph.render();
  state.graph.onEntityClick = showEntityDetail;

  document.getElementById('galaxy-detail-close').addEventListener('click', () => {
    document.getElementById('galaxy-detail').hidden = true;
  });

  setIdleGalaxyStatus();
}

// ============================================================================
// AI Copilot — chat
// ============================================================================
function setupCopilot() {
  const form = document.getElementById('composer-form');
  const input = document.getElementById('composer-input');
  const submit = document.getElementById('composer-submit');

  // Voice in: pick a language (English by default), press the mic, the heard
  // question is typed into the box and asked — and the answer is read back.
  const vc = document.getElementById('voice-controls');
  if (vc) {
    vc.innerHTML = renderVoiceControls(currentLang());
    const sel = vc.querySelector('#lang-select');
    const mic = vc.querySelector('#mic-btn');
    sel.addEventListener('change', () => setLang(sel.value));
    if (!recognitionSupported()) { mic.disabled = true; mic.title = 'This browser doesn’t support voice input'; }
    mic.addEventListener('click', async () => {
      if (mic.dataset.listening === 'true') return;
      mic.dataset.listening = 'true';
      if (state.stage) { speaker.stop(); state.stage.setMood('listening'); state.stage.gesture('tilt'); }
      const placeholder = input.placeholder;
      input.placeholder = `Listening (${LANGS[currentLang()].native})…`;
      try {
        const heard = await listen(currentLang());
        if (heard) { input.value = heard; state.spokenQuestion = true; form.dispatchEvent(new Event('submit')); }
      } catch (err) {
        input.placeholder = err.message === 'not-allowed' ? 'Microphone access is blocked. Allow it in the address bar.' : 'Didn’t catch that. Try again.';
        setTimeout(() => { input.placeholder = placeholder; }, 2500);
        if (state.stage) state.stage.setMood('idle');
        return;
      } finally { mic.dataset.listening = 'false'; }
      input.placeholder = placeholder;
    });
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return;
    // The box keeps the question. Clearing it left the reader with an answer and
    // no visible record of what produced it — and made re-asking a variant mean
    // retyping from scratch.
    submit.disabled = true;
    input.blur();
    await ask(q);
    submit.disabled = false;
    input.select();
  });
}

function setupDerivationToggles() {
  const pairs = [['confidence-why-toggle', 'confidence-why'],
                 ['health-why-toggle', 'health-derivation']];
  for (const [btnId, panelId] of pairs) {
    const btn = document.getElementById(btnId);
    const panel = document.getElementById(panelId);
    if (!btn || !panel) continue;
    btn.addEventListener('click', () => {
      const open = !panel.hidden;
      panel.hidden = open;
      btn.setAttribute('aria-expanded', String(!open));
      const label = btn.querySelector('.why-label') || btn;
      label.textContent = open ? btn.dataset.closed || label.textContent
                               : btn.dataset.open || label.textContent;
      if (!open) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }
}

// The question bank drives the typeahead. Every suggestion is a question we have
// tested, so a reviewer poking at this on their phone mid-call is steered toward
// known-good answers instead of finding an edge case live.
function bankQuestions() {
  return QUESTION_BANK
    .map(q => (typeof q === 'string' ? q : (q.question || q.q || q.text)))
    .filter(Boolean);
}

function setupTypeahead() {
  const bank = bankQuestions();
  state.typeaheads = [];

  for (const [inputId, formId] of [['composer-input', 'composer-form'],
                                   ['sticky-ask-input', 'sticky-ask-form']]) {
    const input = document.getElementById(inputId);
    if (!input) continue;
    const ta = new Typeahead(input, bank, (question) => {
      const form = document.getElementById(formId);
      if (form) form.dispatchEvent(new Event('submit'));
      else askFromInput(input);
    });
    state.typeaheads.push(ta);
  }
}

function askFromInput(input) {
  const q = input.value.trim();
  if (q) ask(q);
}

function setupSuggestions() {
  document.querySelectorAll('#suggestions .chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById('composer-input');
      const question = btn.textContent.trim();
      // Put the question IN the box and leave it there. Previously the value was
      // set and cleared on submit within the same tick, so the user never saw
      // what had been asked — the answer appeared with an empty box above it.
      input.value = question;
      input.classList.add('is-autofilled');
      setTimeout(() => input.classList.remove('is-autofilled'), 700);
      document.getElementById('composer-form').dispatchEvent(new Event('submit'));
    });
  });
}

// ============================================================================
// Ask flow — orchestrates all four panes
// ============================================================================

// Run one retrieval + answer build for a query string. Pure (no DOM), so ask()
// can call it more than once (e.g. a bank-canonicalized retry).
function retrieve(q) {
  // Hybrid when the semantic layer is loaded, pure BM25 before that. Identical
  // downstream contract either way, so answer building never has to care.
  const hybrid = hybridSearch(q, {
    bm25: state.bm25,
    semantic: state.semantic,
    chunks: state.chunks,
    filters: state.filters,
    topK: 20,
    extraRun: state.qvec ? semNLU.chunkRun(state.qvec) : null,
  });

  // `chunkIdx` is the retrieval key every downstream consumer indexes on
  // (cohereByDocument, buildAnswer, explain). Preserve it exactly.
  const rawRanked = hybrid.results.length
    ? hybrid.results.map(r => ({ chunkIdx: r.chunkIdx, score: r.score, _fusion: r }))
    : state.bm25.search(q, 20);

  const cohesion = cohereByDocument(rawRanked, state.chunks, {
    queryTerms: tokenize(q),
    bm25Index: state.bm25,
  });

  // Answer from the FULL retrieved pool, not cohesion.ranked.
  //
  // cohereByDocument was built for a handful of documents, where collapsing
  // results onto the single dominant one helped. Across five source systems it
  // collapses 20 retrieved passages to as few as one — before intent routing
  // can look at them — so the summariser would have nothing left to work with.
  //
  // Cohesion is still used for its document-level signals (dominant document,
  // filename match); it is no longer allowed to gate the evidence pool.
  const built = buildAnswer(q, rawRanked, state.chunks, cohesion, {
    semantic: state.semantic,
    bm25: state.index.bm25,
    diagnostics: hybrid.diagnostics,
  });
  return {
    ranked: cohesion.ranked,
    cohesion,
    retrieval: {
      mode: hybrid.mode,
      latencyMs: hybrid.latencyMs,
      ...hybrid.diagnostics,
    },
    ...built,
  };
}

// Surfaces the active retrieval mode. Showing 'lexical' vs 'hybrid' honestly
// matters more than showing 'hybrid' always — a demo that overstates itself is
// the fastest way to lose a technical audience.
function updateRetrievalBadge() {
  const el = document.getElementById('retrieval-mode-badge');
  if (!el) return;
  const sem = state.semantic;
  el.removeAttribute('title');
  if (sem && sem.enabled) {
    el.textContent = 'Hybrid search';
    el.dataset.mode = 'hybrid';
    el.dataset.tip = `Keyword (BM25) and meaning (${sem.method}, ${sem.dims} dimensions) ranked together by reciprocal rank fusion. ` +
                     `${(sem.explainedVariance * 100).toFixed(1)}% of variance retained.`;
  } else {
    el.textContent = 'Keyword search';
    el.dataset.mode = 'lexical';
    el.dataset.tip = sem ? `Ranking by BM25 keywords only. The semantic layer is unavailable: ${sem.reason}` : 'Ranking by BM25 keywords while the semantic layer loads.';
  }
}

async function ask(question, opts = {}) {
  const silent = opts.silent === true;
  if (!silent) {
    clearCopilotEmpty();
    appendUserMessage(question);
  }

  // The twin looks up and thinks while the answer is assembled.
  if (!silent && state.stage) { speaker.stop(); state.stage.setMood('thinking'); }
  await new Promise(r => setTimeout(r, silent ? 80 : 420));

  // Retrieve with a curated-question-bank assist. We first try to match the
  // user's wording to a vetted bank question:
  //   - strong match (same question, high similarity)  → answer the canonical
  //     phrasing directly (more consistent retrieval);
  //   - otherwise                                       → live search on the
  //     raw query (the general case);
  //   - if that live search is weak but a bank question is a decent match     → retry with the canonical question as a rescue.
  // Either way the pipeline runs for real, so citations/graph/lineage stay in
  // sync — the bank only canonicalizes the query, never a canned answer.
  // Semantic NLU: embed the question with the same model the Factory used.
  state.qvec = semNLU.modelReady() ? await semNLU.embed(question) : null;
  // One shared pipeline (site and golden tests): retrieval, bank assist, canon, honest fallback.
  let result = answerQuestion(question, { index: state.index, bm25: state.bm25, bm25Payload: state.index.bm25,
    semantic: state.semantic, chunks: state.chunks, filters: state.filters, qvec: state.qvec,
    prev: state.lastQuery || null, answerLang: currentLang() });   // the previous question, for follow-ups ("who built it?")
  const retrievalQuery = result.retrievalQuery;
  const { ranked, cohesion, answerHtml, citations, lowConfidence } = result;

  const trace = state.graph.highlightTrace(citations.map(c => c.chunk.id));

  state.lastQuery = question;
  state.lastResult = { ranked, citations, answerHtml, trace, cohesion, lowConfidence,
                       confidence: result.confidence, analysis: result.analysis,
                       summary: result.summary };

  populateAnswerStage(question, answerHtml, citations, ranked, trace, cohesion);
  const rel = document.getElementById('answer-related');
  if (rel) {
    const label = result.verdict && result.verdict.kind !== 'yes' ? 'You may be looking for' : 'Explore';
    rel.innerHTML = renderRelated(result.related || [], { label });
    rel.hidden = !(result.related && result.related.length);
  }
  // The twin speaks the answer in the first person (cited sentences, rewritten
  // from "he" to "I" by rules), in the owner's baked voice when available.
  {
    const hasEvidence = result.summary && result.summary.sentences && result.summary.sentences.length;
    const reply = result.canon ? { sentences: result.canon.sentences }
                : hasEvidence ? firstPersonAnswer(result, { spokenSentences: TWIN_CONFIG.spokenSentences })
                              : { sentences: [noAnswerLine()], spoken: noAnswerLine() };
    // A curated answer is spoken in full — it is exactly what the owner would say.
    const lines = result.canon ? reply.sentences
      : [result.verdict ? verdictLine(result.verdict) : '', ...reply.sentences.slice(0, TWIN_CONFIG.spokenSentences)].filter(Boolean);
    const voiceEl = document.getElementById('answer-voice');
    if (voiceEl) {
      const esc = (t) => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
      voiceEl.innerHTML = renderSpeakButton()
        + `<span class="answer-voice-status"><span class="answer-voice-k">In his voice</span>“${esc(lines.join(' '))}”</span>`;
      voiceEl.hidden = false;
      voiceEl.querySelector('#answer-speak').addEventListener('click', () => sayLines(lines, result.answerLang || currentLang()));
    }
    const player = document.getElementById('answer-player');
    if (player) { player.innerHTML = ''; player.hidden = true; }
    if (!silent && TWIN_CONFIG.autoSpeak && !speaker.isMuted()) sayLines(lines, result.answerLang || currentLang());
    else if (!silent && state.stage) { state.stage.setMood('idle'); state.stage.gesture(result.lowConfidence ? 'tilt' : 'nod'); }
  }
  if (!silent && state.ambient) state.ambient.pulse(0.9);
  renderGraphValue(citations, result.analysis);
  // Leave a trace; offer a flag. The seeded demo answer is not a visitor action.
  if (!silent) {
    const t = recordTrace({ question, result, retrievalMode: state.retrievalMode });
    renderTraces(allTraces(), { onAsk: q => ask(q) });
    const fb = document.getElementById('answer-flag');
    if (fb) { fb.innerHTML = renderFlagBox(t); fb.hidden = false; }
  }
  if (!silent) appendAssistantMessage(question, answerHtml, citations, ranked, trace);
  renderLineage(question, answerHtml, citations);
  updateCopilotMetrics(citations, trace, ranked, cohesion);
  updateGalaxyStatus(trace);

  // Scroll policy:
  //   - Seeded demo answer (silent): never scroll. User loads fresh, sees hero.
  //   - First real ask via hero composer: smooth-scroll to answer section.
  //   - Subsequent asks (sticky bar): only scroll if the answer is NOT already
  //     visible. Don't yank the user if they're already looking at it.
  if (!silent) {
    const target = document.getElementById('section-answer');
    if (target) {
      const r = target.getBoundingClientRect();
      const viewportH = window.innerHeight;
      const stickyOffset = 130; // navbar + sticky-ask combined
      // Answer is "visible enough" if top is within viewport (allowing for sticky)
      const isVisible = r.top >= stickyOffset && r.top < viewportH * 0.75;
      const isAbove = r.bottom < stickyOffset;
      // Scroll only if user is above the answer (still in hero) or it's offscreen below
      if (!isVisible && (r.top > viewportH * 0.75 || isAbove)) {
        setTimeout(() => {
          window.scrollTo({
            top: target.offsetTop - stickyOffset + 10,
            behavior: 'smooth',
          });
        }, 200);
      }
    }
  }
}

// Populate Section 2 — Live Answer stage with the latest Q/A
function populateAnswerStage(question, answerHtml, citations, ranked, trace, cohesion) {
  const emptyEl = document.getElementById('answer-stage-empty');
  const liveEl = document.getElementById('answer-stage-live');
  if (!liveEl) return;
  if (emptyEl) emptyEl.hidden = true;
  liveEl.hidden = false;

  // Quick "refreshing" flash so the user sees the answer is being replaced —
  // without this, asking a second question with similar-length answer can
  // look like nothing happened.
  liveEl.classList.remove('is-refreshing');
  void liveEl.offsetWidth; // force reflow
  liveEl.classList.add('is-refreshing');
  setTimeout(() => liveEl.classList.remove('is-refreshing'), 600);

  const qEl = document.getElementById('answer-stage-question');
  const aEl = document.getElementById('answer-stage-text');
  if (qEl) qEl.textContent = question;
  if (aEl) {
    aEl.innerHTML = answerHtml;
    // Paragraphs of the new answer come into focus one after another.
    aEl.classList.remove('is-entering');
    void aEl.offsetWidth;
    aEl.classList.add('is-entering');
    clearTimeout(aEl._enterT);
    aEl._enterT = setTimeout(() => aEl.classList.remove('is-entering'), 1800);
    // Inline citation refs → open chunk detail
    aEl.querySelectorAll('.cite-ref').forEach(ref => {
      ref.addEventListener('click', () => {
        const n = parseInt(ref.dataset.cite, 10);
        const cite = citations.find(c => c.num === n);
        if (cite) showChunkDetail(cite.chunk);
      });
    });
  }

  // Metrics row
  // Derived confidence from the retrieval run. cohesion.confidence is no longer
  // used: it contained a `docNameMatch ? 0.75` floor that fired on nearly every
  // query, which is why every answer in the last demo reported exactly 75%.
  const confObj = state.lastResult?.confidence || null;
  const conf = confObj ? confObj.percent
    : (citations[0]?.confidence ? Math.round(citations[0].confidence * 100) : 0);
  const confFillEl = document.getElementById('answer-stage-conf-fill');
  const confValEl = document.getElementById('answer-stage-conf-val');
  const srcEl = document.getElementById('answer-stage-sources');
  const pathsEl = document.getElementById('answer-stage-paths');
  if (confFillEl) {
    // Scale, not width: the bar grows on the compositor and re-grows per answer.
    confFillEl.style.setProperty('--v', '0');
    requestAnimationFrame(() => requestAnimationFrame(() => confFillEl.style.setProperty('--v', String(Math.max(0, Math.min(1, conf / 100))))));
  }
  if (confValEl) {
    if (typeof conf === 'number') countUp(confValEl, conf, { decimals: 2, suffix: '%', duration: 1300, from: 0 });
    else confValEl.textContent = `${conf}%`;
    confValEl.dataset.band = confObj ? confObj.band : '';
  }
  // The breakdown follows its toggle: re-rendered for every answer, but only
  // shown when the reader has asked to see the scoring.
  const confWhy = document.getElementById('confidence-why');
  const confToggle = document.getElementById('confidence-why-toggle');
  if (confWhy && confObj) {
    confWhy.innerHTML = renderConfidenceBreakdown(confObj);
    confWhy.hidden = !(confToggle && confToggle.getAttribute('aria-expanded') === 'true');
  }
  if (srcEl) countUp(srcEl, citations.length, { duration: 900 });
  if (pathsEl) countUp(pathsEl, Math.max(1, trace.edgeCount), { duration: 1200 });
}

function updateCopilotMetrics(citations, trace, ranked, cohesion) {
  const metricsEl = document.getElementById('copilot-metrics');
  metricsEl.hidden = false;
  // Confidence shown to the user reflects retrieval distinctness, not the
  // intra-result normalized score (which is misleadingly always 100% for the
  // top citation). Distinctness = how strongly the query points to one area.
  const conf = cohesion?.confidence != null
    ? Math.round(cohesion.confidence * 100)
    : (citations[0]?.confidence ? Math.round(citations[0].confidence * 100) : 0);
  document.getElementById('m-conf').textContent = `${conf}%`;
  document.getElementById('m-sources').textContent = citations.length;
  document.getElementById('m-rels').textContent = trace.edgeCount;
  document.getElementById('m-paths').textContent = Math.max(1, trace.edgeCount);
}

// At rest the chip answers "what is this map?" with the two numbers that make
// the case: how many concepts join records, and how many join different source
// systems (resume, website, YouTube, GitHub). Those are the graph's reason for existing, stated in
// the corpus's own figures rather than in a floating explainer panel.
function setIdleGalaxyStatus() {
  const el = document.getElementById('galaxy-status');
  const wrap = document.getElementById('galaxy-status-wrap');
  if (!el || !state.index) return;
  try {
    const p = graphPurposeCopy(state.index);
    el.innerHTML =
      `<span class="gs-tag">Knowledge graph</span>` +
      `<span class="gs-pair" tabindex="0" data-tip="Concepts that appear in two or more records. Search finds shared words; these find a shared subject."><b data-count="${p.stat}">${p.stat}</b> shared concepts</span>` +
      `<span class="gs-pair" tabindex="0" data-tip="Concepts found in two or more source systems: resume, website, YouTube, GitHub. They are what let one answer draw on all of them."><b data-count="${p.stat2}">${p.stat2}</b> join separate sources</span>`;
    if (wrap) wrap.dataset.state = 'idle';
  } catch (_) {
    el.textContent = `${state.index.stats.entity_count} entities · ` +
                     `${state.index.stats.relationship_count} relationships`;
  }
}

// While an answer is live the same chip reports what the graph DID.
function updateGalaxyStatus(trace) {
  const el = document.getElementById('galaxy-status');
  const wrap = document.getElementById('galaxy-status-wrap');
  if (trace.activeEntities.length === 0) {
    el.textContent = 'No concepts matched. Try naming a project, skill or place.';
    if (wrap) wrap.dataset.state = 'empty';
    return;
  }
  el.innerHTML =
    `<span class="gs-tag gs-tag-live">This answer</span>` +
    `<span class="gs-pair" data-tip="Concepts named in the cited passages, lit gold in the graph."><b data-count="${trace.activeEntities.length}">${trace.activeEntities.length}</b> concepts lit</span>` +
    `<span class="gs-pair" data-tip="Concepts one link away from those, shown in platinum."><b data-count="${trace.neighborCount}">${trace.neighborCount}</b> neighbours</span>` +
    `<span class="gs-pair" data-tip="Links the graph walked to connect them."><b data-count="${trace.edgeCount}">${trace.edgeCount}</b> links</span>`;
  if (wrap) wrap.dataset.state = 'live';
}

// ============================================================================
// Message rendering
// ============================================================================
function clearCopilotEmpty() {
  const empty = document.querySelector('.copilot-empty');
  if (empty) empty.remove();
}

function appendUserMessage(text) {
  const tpl = document.getElementById('tpl-user-msg').content.cloneNode(true);
  tpl.querySelector('.msg-bubble').textContent = text;
  document.getElementById('messages').appendChild(tpl);
  scrollMessages();
}

function appendAssistantMessage(question, answerHtml, citations, ranked, trace) {
  const tpl = document.getElementById('tpl-assistant-msg').content.cloneNode(true);
  const root = tpl.querySelector('.msg-assistant');
  root.querySelector('.answer-text').innerHTML = answerHtml;

  // Confidence bar
  const topConf = citations[0]?.confidence ?? 0;
  const pct = Math.round(topConf * 100);
  root.querySelector('.ac-fill').style.width = `${pct}%`;
  root.querySelector('.ac-value').textContent = `${pct}%`;

  // Explain Answer button — opens overlay with reasoning pipeline
  root.querySelector('.action-explain').addEventListener('click', () => {
    openExplain({
      question,
      ranked,
      citations,
      traceEntities: trace.activeEntities,
      traceEdges: trace.edgeCount,
      answerHtml,
    });
  });

  // Inline [#N] citation refs → chunk detail in galaxy detail card
  root.querySelectorAll('.cite-ref').forEach(ref => {
    ref.addEventListener('click', () => {
      const n = parseInt(ref.dataset.cite, 10);
      const cite = citations.find(c => c.num === n);
      if (cite) showChunkDetail(cite.chunk);
    });
  });

  document.getElementById('messages').appendChild(tpl);
  scrollMessages();

  // Also expose the global "Explain Answer" button in the lineage pane header
  const explainBtn = document.getElementById('explain-btn');
  explainBtn.hidden = false;
  explainBtn.onclick = () => openExplain({
    question, ranked, citations,
    traceEntities: trace.activeEntities,
    traceEdges: trace.edgeCount,
    answerHtml,
  });
}

function scrollMessages() {
  const el = document.getElementById('messages');
  el.scrollTop = el.scrollHeight;
}

// ============================================================================
// Galaxy detail card — entity and chunk views
// ============================================================================
function showChunkDetail(chunk) {
  if (!chunk) return;
  const sectionPath = chunk.section_path?.length ? chunk.section_path.join(' › ') : '—';
  const entities = (chunk.entities || []).map(id => state.entitiesById.get(id)).filter(Boolean);

  const html = `
    <div class="entity-card-eyebrow">Source passage</div>
    <div class="entity-card-title">${escapeHtml(stripExt(chunk.document_name))}</div>
    <div class="entity-card-meta">
      <div class="kv"><span class="k">Where</span><span class="v v-small">${escapeHtml(whereLabel(chunk))}</span></div>
      <div class="kv kv-wide"><span class="k">Section</span><span class="v v-path">${escapeHtml(sectionPath)}</span></div>
      ${chunk.url ? `<div class="kv"><span class="k">Source</span><a class="v v-small entity-card-link" href="${escapeHtml(chunk.url)}" target="_blank" rel="noreferrer">Open ↗</a></div>` : ''}
    </div>
    <div class="entity-card-section">
      <h4>Full passage</h4>
      <div class="evidence evidence-full">
        <div class="evidence-text">${escapeHtml(chunk.text)}</div>
      </div>
    </div>
    ${entities.length ? `
    <div class="entity-card-section">
      <h4>Concepts in this passage</h4>
      <div class="entity-card-pills">
        ${entities.map(e => `<button class="pill pill-accent" data-eid="${e.id}">${escapeHtml(e.name)}</button>`).join('')}
      </div>
    </div>` : ''}`;

  openGalaxyDetail(html);
  bindDetailLinks();
}

function showEntityDetail(entityId) {
  const e = state.entitiesById.get(entityId);
  if (!e) return;
  state.graph.focusEntity(entityId);

  const chunks = e.chunk_ids
    .map(id => state.chunksById.get(id))
    .filter(Boolean)
    .slice(0, 4);

  const docs = new Set(chunks.map(c => c.document_name));

  const related = [];
  for (const r of state.index.relationships) {
    if (r.source === entityId) related.push({ id: r.target, weight: r.weight });
    else if (r.target === entityId) related.push({ id: r.source, weight: r.weight });
  }
  related.sort((a, b) => b.weight - a.weight);
  const relatedTop = related.slice(0, 8).map(r => state.entitiesById.get(r.id)).filter(Boolean);

  // Premium entity card: Purpose (most-cited excerpt) · Dependencies (related entities)
  // · Appears In (documents) · Evidence (chunks)
  const purposeChunk = chunks[0];
  const purpose = purposeChunk?.paragraph_excerpt || purposeChunk?.text?.slice(0, 200) || '';

  const html = `
    <div class="entity-card-eyebrow">${escapeHtml(e.kind)}</div>
    <div class="entity-card-title">${escapeHtml(e.name)}</div>
    <div class="entity-card-meta">
      <div class="kv"><span class="k">Mentions</span><span class="v" data-count="${e.mention_count}">${e.mention_count}</span></div>
      <div class="kv"><span class="k">Records</span><span class="v" data-count="${new Set(e.document_ids || []).size}">${new Set(e.document_ids || []).size}</span></div>
      <div class="kv"><span class="k">Passages</span><span class="v" data-count="${e.chunk_ids.length}">${e.chunk_ids.length}</span></div>
      <div class="kv"><span class="k">Links</span><span class="v" data-count="${related.length}">${related.length}</span></div>
    </div>

    ${purpose ? `
    <div class="entity-card-section">
      <h4>First mention</h4>
      <p class="entity-card-quote">${escapeHtml(purpose)}</p>
    </div>` : ''}

    ${relatedTop.length ? `
    <div class="entity-card-section">
      <h4>Related concepts</h4>
      <div class="entity-card-pills">
        ${relatedTop.map(r => `<button class="pill" data-eid="${r.id}">${escapeHtml(r.name)}</button>`).join('')}
      </div>
    </div>` : ''}

    ${docs.size ? `
    <div class="entity-card-section">
      <h4>Appears in</h4>
      <div class="entity-card-pills">
        ${[...docs].map(d => `<span class="pill pill-accent pill-static">${escapeHtml(stripExt(d))}</span>`).join('')}
      </div>
    </div>` : ''}

    <div class="entity-card-section">
      <h4>Evidence</h4>
      ${chunks.map(c => {
        const section = c.section_path?.length ? c.section_path.join(' › ') : '';
        return `
          <div class="evidence" data-cid="${c.id}">
            <div class="evidence-meta">
              <span class="doc">${escapeHtml(stripExt(c.document_name))}</span>
              <span class="sep">·</span>
              <span>${escapeHtml(whereLabel(c))}</span>
              ${section ? `<span class="sep">·</span><span class="evidence-section">${escapeHtml(section)}</span>` : ''}
            </div>
            <div class="evidence-text">${escapeHtml(c.text)}</div>
          </div>`;
      }).join('')}
    </div>`;

  openGalaxyDetail(html);
  bindDetailLinks();
}

function bindDetailLinks() {
  document.querySelectorAll('#galaxy-detail [data-eid]').forEach(el => {
    el.addEventListener('click', () => showEntityDetail(parseInt(el.dataset.eid, 10)));
  });
  document.querySelectorAll('#galaxy-detail [data-cid]').forEach(el => {
    el.addEventListener('click', () => showChunkDetail(state.chunksById.get(parseInt(el.dataset.cid, 10))));
  });
}

function openGalaxyDetail(html) {
  document.getElementById('galaxy-detail-body').innerHTML = html;
  document.getElementById('galaxy-detail').hidden = false;
}

// ============================================================================
// Util
// ============================================================================
function stripExt(name) {
  return name.replace(/\.(pdf|docx?|md|markdown|txt)$/i, '').replace(/_/g, ' ');
}

// Where a passage sits, in the terms of its own source: a page and paragraph
// for the resume, a timestamp for a video, the record type for everything else.
const WHERE_WORD = { profile: 'Profile record', canon: 'His own answer', website: 'Website section',
                     youtube: 'YouTube video', github: 'GitHub repository', linkedin: 'LinkedIn post' };
function whereLabel(c) {
  const m = c.meta || {};
  if (c.source_type === 'document') return `Page ${c.page || 1}` + (c.paragraph_indices && c.paragraph_indices.length ? `, ¶${c.paragraph_indices.map(i => i + 1).join(', ¶')}` : '');
  if (m.t_label) return `YouTube at ${m.t_label}`;
  return WHERE_WORD[c.source_type] || 'Record';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ============================================================================
// Bootstrap (wait for vis-network)
// ============================================================================
// The graph library comes from a CDN. If that CDN is slow or blocked, the
// answers, lineage, health and insights must still work — the galaxy degrades
// to a notice rather than taking the whole page down with it.
window.addEventListener('DOMContentLoaded', () => {
  if (typeof vis !== 'undefined') { boot(); return; }
  const started = Date.now();
  const check = setInterval(() => {
    if (typeof vis !== 'undefined' || Date.now() - started > 4000) {
      clearInterval(check);
      if (typeof vis === 'undefined') console.warn('[fabric] vis-network unavailable — booting without the galaxy');
      boot();
    }
  }, 50);
});


// ---------------------------------------------------------------------------
// The twin: speaking, mood, inline video
// ---------------------------------------------------------------------------
function setTwinStatus() {
  const el = document.getElementById('twin-status');
  if (!el) return;
  const parts = [];
  if (state.stage && state.stage.mode !== '3d') parts.push(['muted', 'Portrait view', 'The 3D avatar could not load here, so a portrait stands in.']);
  if (semNLU.modelReady()) parts.push(['live', 'Understands paraphrase', 'A small language model on this page matches your wording to his answers by meaning.']);
  const n = speaker.bakedCount();
  parts.push(n ? ['live', 'His recorded voice', `${n} lines recorded in Prashobh’s own voice.`]
               : ['muted', 'Browser voice', 'Replies are read by your browser’s voice until his recorded voice is available.']);
  el.innerHTML = parts.map(([tone, text, tip]) =>
    `<span class="stage-light" data-tone="${tone}" tabindex="0" data-tip="${escapeHtml(tip)}">${escapeHtml(text)}</span>`).join('');
}

function wireStageActions() {
  const greet = document.getElementById('twin-greet');
  const mute = document.getElementById('twin-mute');
  let muted = false;
  try { muted = localStorage.getItem('kf.mute') === '1'; } catch { /* private mode */ }
  speaker.setMuted(muted);
  // A toggle keeps one label; its pressed state and icon say which way it is.
  const paint = () => {
    mute.setAttribute('aria-pressed', String(muted));
    mute.classList.toggle('is-muted', muted);
    mute.dataset.tip = muted ? 'Answers are not read aloud.' : 'Answers are read aloud as they arrive.';
  };
  paint();
  mute.addEventListener('click', () => { muted = !muted; speaker.setMuted(muted); try { localStorage.setItem('kf.mute', muted ? '1' : '0'); } catch { /* noop */ } paint(); });
  greet.addEventListener('click', () => sayLines([TWIN_CONFIG.greeting]));
  // A suggested question chip asks it.
  document.addEventListener('click', (e) => {
    const chip = e.target.closest('.near-chip');
    if (chip) { const input = document.getElementById('composer-input'); if (input) input.value = chip.dataset.q; ask(chip.dataset.q); }
  });
  // A related video card plays here, at its timestamp, instead of leaving the page.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-video]');
    if (!a) return;
    e.preventDefault();
    openPlayer(a.dataset.video, Number(a.dataset.t) || 0, a.querySelector('.related-title')?.textContent || '');
  });
}

// While the avatar is still streaming in, the voice goes ahead without a face.
const NO_STAGE = { setMood() {}, gesture() {}, setViseme() {}, setMouth() {} };

function sayLines(lines, lang = currentLang()) {
  const st = state.stage || NO_STAGE;
  if (!lines.length) return;
  if (speaker.isMuted()) { st.setMood('idle'); st.gesture('nod'); return; }
  const my = (state.sayToken = (state.sayToken || 0) + 1);
  // A small nod as he begins, a smile as he finishes: punctuation, not theatre.
  st.setMood('speaking');
  st.gesture('nod');
  speaker.speak(lines, {
    lang,
    onStart: () => st.gesture('smile'),
    onViseme: (v, w) => st.setViseme && st.setViseme(v, w),
    onLevel: (l) => { st.setMouth(l); if (state.ambient && l > 0.5) state.ambient.setEnergy(l * 0.35); },
  }).then(() => {
    if (my !== state.sayToken) return;
    st.setMood('idle');
    st.gesture('smile');
  });
}

function openPlayer(videoId, t, title) {
  const host = document.getElementById('answer-player');
  if (!host) return;
  speaker.stop();
  const safe = String(videoId).replace(/[^A-Za-z0-9_-]/g, '');
  host.innerHTML = `<div class="player-frame">
      <iframe src="https://www.youtube-nocookie.com/embed/${safe}?start=${Math.max(0, t | 0)}&autoplay=1&rel=0" title="${title.replace(/"/g, '&quot;')}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe>
      <button type="button" class="player-close" aria-label="Close video">✕</button>
    </div><p class="player-title">${title.replace(/</g, '&lt;')}${t ? ` · from ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` : ''}</p>`;
  host.hidden = false;
  host.querySelector('.player-close').addEventListener('click', () => { host.innerHTML = ''; host.hidden = true; });
  host.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
