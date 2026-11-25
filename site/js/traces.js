// ============================================================================
// Traces & flags — the records agents leave behind
// ============================================================================
//
// In the knowledge-factory loop, every answer is a trace (what was asked, what
// the system read, how sure it was) and a weak answer is a flag (a gap for the
// curator). This is a static site with no backend, so:
//
//   traces  live in the visitor's browser (localStorage), shown in a panel so a
//           reviewer can see how the fabric is being used in this session;
//   flags   are GitHub Issues. "Flag this answer" opens a pre-filled issue form
//           (label `knowledge-flag`) carrying the trace, and the curator
//           workflow reads those issues on a schedule.
//
// Nothing here leaves the browser unless the visitor clicks the flag link.

const KEY = 'kf.traces.v1';
const MAX_TRACES = 40;
const LOW_BAND = 45;

export const FLAG_REPO = 'PrashobhPaul/Prashobh_Knowledge_Factory';

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (_) { return []; }
}
function save(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX_TRACES))); } catch (_) { /* private mode */ }
}

/** Record one answer. Returns the trace. */
export function recordTrace({ question, result, retrievalMode }) {
  const conf = result.confidence ? result.confidence.percent : 0;
  const trace = {
    t: new Date().toISOString(),
    q: question,
    intent: result.analysis ? result.analysis.intent.name : 'GENERAL',
    focus: result.analysis ? result.analysis.focus : [],
    confidence: conf,
    band: result.confidence ? result.confidence.band : 'none',
    low: Boolean(result.lowConfidence),
    mode: retrievalMode || 'lexical',
    sources: [...new Set(result.citations.map(c => c.chunk.source_type))],
    cited: result.citations.slice(0, 4).map(c => ({
      doc: c.chunk.document_name, type: (c.chunk.meta && c.chunk.meta.record_type) || '', url: c.chunk.url || '',
    })),
    caveats: result.confidence ? result.confidence.caveats.slice(0, 3) : [],
  };
  const list = load();
  list.push(trace);
  save(list);
  return trace;
}

export function allTraces() { return load(); }
export function clearTraces() { save([]); }

/** Pre-filled GitHub issue URL for a trace. Query string only: no API, no token. */
export function flagUrl(trace, kind = 'missing') {
  const params = new URLSearchParams({
    template: 'knowledge_flag.yml',
    title: `[flag] ${trace.q}`.slice(0, 120),
    labels: 'knowledge-flag',
    question: trace.q,
    kind: kind === 'wrong' ? 'wrong — the answer was incorrect or about something else'
        : kind === 'outdated' ? 'outdated — the answer was true once but is no longer'
        : 'missing — the sources do not cover this',
    confidence: `${trace.confidence.toFixed ? trace.confidence.toFixed(1) : trace.confidence}%`,
    trace: JSON.stringify({ when: trace.t, intent: trace.intent, focus: trace.focus, mode: trace.mode,
                            sources: trace.sources, cited: trace.cited, caveats: trace.caveats }, null, 1),
  });
  return `https://github.com/${FLAG_REPO}/issues/new?${params.toString()}`;
}

/** The flag affordance beside an answer. Auto-opened (expanded) when the answer is weak. */
export function renderFlagBox(trace) {
  const weak = trace.low || trace.confidence < LOW_BAND;
  const lead = weak
    ? `This looks like a gap: confidence ${trace.confidence.toFixed(1)}%. Flag it and the curator will check it on the next run.`
    : `Wrong or out of date? Flag it — the curator re-checks every flag against the freshly synced sources.`;
  return `
    <div class="flag-box${weak ? ' flag-box-weak' : ''}" data-weak="${weak}">
      <span class="flag-lead">${escapeHtml(lead)}</span>
      <span class="flag-actions">
        <a class="flag-btn" target="_blank" rel="noreferrer" href="${escapeHtml(flagUrl(trace, 'missing'))}">Flag as missing</a>
        <a class="flag-btn flag-btn-ghost" target="_blank" rel="noreferrer" href="${escapeHtml(flagUrl(trace, 'wrong'))}">wrong</a>
        <a class="flag-btn flag-btn-ghost" target="_blank" rel="noreferrer" href="${escapeHtml(flagUrl(trace, 'outdated'))}">outdated</a>
      </span>
    </div>`;
}

/** The traces panel: this browser's recent questions, weakest first on request. */
export function renderTraces(list, { onAsk } = {}) {
  const host = document.getElementById('traces-body');
  if (!host) return;
  if (!list.length) {
    host.innerHTML = `<p class="traces-empty">No traces yet in this browser. Every question you ask is recorded here — what was asked, what the fabric read, and how sure it was.</p>`;
    return;
  }
  const weak = list.filter(t => t.low || t.confidence < LOW_BAND).length;
  const rows = [...list].reverse().map((t, i) => `
    <div class="trace-row" data-band="${escapeHtml(t.band)}">
      <div class="trace-head">
        <button class="trace-q" data-q="${escapeHtml(t.q)}" title="Ask again">${escapeHtml(t.q)}</button>
        <span class="trace-conf">${t.confidence.toFixed ? t.confidence.toFixed(1) : t.confidence}%</span>
      </div>
      <div class="trace-meta">
        <span class="trace-tag">${escapeHtml(t.intent.toLowerCase().replace(/_/g, ' '))}</span>
        <span class="trace-tag">${escapeHtml(t.mode)}</span>
        ${t.sources.map(s => `<span class="trace-tag trace-src">${escapeHtml(s)}</span>`).join('')}
        <span class="trace-when">${new Date(t.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        ${(t.low || t.confidence < LOW_BAND)
          ? `<a class="trace-flag" target="_blank" rel="noreferrer" href="${escapeHtml(flagUrl(t))}">flag ↗</a>` : ''}
      </div>
    </div>`).join('');
  host.innerHTML = `
    <div class="traces-summary">
      <span><b>${list.length}</b> question${list.length === 1 ? '' : 's'} this browser</span>
      <span><b>${weak}</b> weak answer${weak === 1 ? '' : 's'} worth flagging</span>
      <button class="traces-clear" id="traces-clear" type="button">clear</button>
    </div>
    ${rows}`;
  host.querySelectorAll('.trace-q').forEach(b => b.addEventListener('click', () => onAsk && onAsk(b.dataset.q)));
  const clr = host.querySelector('#traces-clear');
  if (clr) clr.addEventListener('click', () => { clearTraces(); renderTraces([], { onAsk }); });
}

/** Open gaps from the curator ledger shipped in the index — the "flags" board. */
export function renderGapBoard(flags) {
  const host = document.getElementById('gaps-body');
  if (!host) return;
  if (!flags || !flags.summary) {
    host.innerHTML = `<p class="traces-empty">The curator has not run yet. Flags you open on GitHub appear here after its next run.</p>`;
    return;
  }
  const s = flags.summary;
  const items = (flags.items || []).slice(0, 8);
  host.innerHTML = `
    <div class="traces-summary">
      <span><b>${s.open}</b> open gap${s.open === 1 ? '' : 's'}</span>
      <span><b>${s.resolved}</b> resolved by sync</span>
      ${s.regressed ? `<span class="gap-regressed"><b>${s.regressed}</b> regressed</span>` : ''}
      ${flags.generated_at ? `<span class="trace-when">curated ${new Date(flags.generated_at).toLocaleDateString()}</span>` : ''}
    </div>
    ${items.length ? items.map(f => `
      <div class="trace-row" data-status="${escapeHtml(f.status)}">
        <div class="trace-head">
          <a class="trace-q" href="${escapeHtml(f.url || '#')}" target="_blank" rel="noreferrer">${escapeHtml(f.question)}</a>
          <span class="gap-status gap-${escapeHtml(f.status)}">${escapeHtml(f.status)}</span>
        </div>
        <div class="trace-meta">
          <span class="trace-tag">${escapeHtml(f.kind || 'missing')}</span>
          <span class="trace-tag">answerability ${(f.score * 100).toFixed(0)}%</span>
          ${f.nearest ? `<span class="trace-when">nearest: ${escapeHtml(f.nearest)}</span>` : ''}
        </div>
      </div>`).join('')
    : `<p class="traces-empty">No open gaps. Every flagged question is now answerable.</p>`}`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
