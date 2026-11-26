// ============================================================================
// Corpus views — density bars, concept cloud, timeline
// ============================================================================
//
// Every bar grows from zero and every count rolls up when the view is seen, and
// again each time its tab is opened (motion.js replay). Bars scale with
// transform only, so they animate on the compositor without reflowing labels.

import { replay } from './motion.js?v=2';

let _index = null;
let _onEntityClick = null;

export function initInsights(index, callbacks = {}) {
  _index = index;
  _onEntityClick = callbacks.onEntityClick || (() => {});

  renderHeatmap();
  renderWordCloud();
  renderTimeline();
  setupTabs();
}

// ===========================================================================
// Tabs — ARIA tabs with arrow-key movement
// ===========================================================================
function setupTabs() {
  const tabs = [...document.querySelectorAll('#insight-tabs .tab')];
  const activate = (tab, focus = false) => {
    const target = tab.dataset.tab;
    for (const t of tabs) {
      const on = t === tab;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    }
    document.querySelectorAll('.insight-panel').forEach(p => {
      const on = p.dataset.panel === target;
      p.classList.toggle('is-active', on);
      if (on) replay(p);
    });
    if (focus) tab.focus();
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => activate(tab));
    tab.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (e.key === 'Home') { e.preventDefault(); activate(tabs[0], true); }
      else if (e.key === 'End') { e.preventDefault(); activate(tabs[tabs.length - 1], true); }
      else if (d) { e.preventDefault(); activate(tabs[(i + d + tabs.length) % tabs.length], true); }
    });
  });
}

// ===========================================================================
// Density — how much retrievable material each record contributes
// ===========================================================================
function renderHeatmap() {
  const panel = document.getElementById('panel-heatmap');
  const rows = _index.documents.map(doc => {
    const chunks = _index.chunks.filter(c => c.document_id === doc.id);
    const entities = new Set();
    for (const c of chunks) for (const eid of (c.entities || [])) entities.add(eid);
    const density = chunks.length * 0.6 + entities.size * 0.8;
    return { name: doc.name, chunks: chunks.length, entities: entities.size, density };
  });

  const max = Math.max(...rows.map(r => r.density), 1);
  rows.sort((a, b) => b.density - a.density);

  // Hundreds of records as hundreds of bars buried every section below. Show
  // the meaningful head of the distribution, summarise the tail, expand on demand.
  const INITIAL = 12;
  const head = rows.slice(0, INITIAL);
  const tail = rows.slice(INITIAL);
  const tailChunks = tail.reduce((a, r) => a + r.chunks, 0);

  const rowHtml = (r, i, hidden) => {
    const v = Math.max(0.04, r.density / max);
    return `
      <div class="hm-row${hidden ? ' hm-row-extra' : ''}"${hidden ? ' hidden' : ''} tabindex="0"
           data-tip="${escapeHtml(stripExt(r.name))}: ${r.chunks} passage${r.chunks === 1 ? '' : 's'}, ${r.entities} concept${r.entities === 1 ? '' : 's'}">
        <span class="hm-label">${escapeHtml(stripExt(r.name))}</span>
        <span class="hm-track"><span class="hm-fill js-grow" style="--v:${v.toFixed(3)};--d:${Math.min(i, 11) * 45}ms"></span></span>
        <span class="hm-value"><b data-count="${r.chunks}">${r.chunks}</b> · ${r.entities}</span>
      </div>`;
  };

  panel.innerHTML = `
    <div class="heatmap">
      <div class="heatmap-head">
        <p class="heatmap-intro">Where the material runs deepest. Each bar is one record, sized by the passages and
        concepts it contributes; the densest ${INITIAL} come first.</p>
        <span class="hm-legend" aria-hidden="true"><b>passages</b> · concepts</span>
      </div>
      ${head.map((r, i) => rowHtml(r, i, false)).join('')}
      ${tail.length ? tail.map((r, i) => rowHtml(r, i, true)).join('') : ''}
      ${tail.length ? `
        <button class="hm-toggle" id="hm-toggle" type="button"
                aria-expanded="false" aria-controls="panel-heatmap"
                data-more="Show all ${rows.length} records"
                data-less="Show the top ${INITIAL} only">
          <span class="hm-toggle-label">Show all ${rows.length} records</span>
          <span class="hm-toggle-sub">${tail.length} more, ${tailChunks.toLocaleString()} passages</span>
        </button>` : ''}
    </div>`;

  const toggle = panel.querySelector('#hm-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      panel.querySelectorAll('.hm-row-extra').forEach(el => { el.hidden = expanded; });
      toggle.setAttribute('aria-expanded', String(!expanded));
      toggle.querySelector('.hm-toggle-label').textContent =
        expanded ? toggle.dataset.more : toggle.dataset.less;
      if (expanded) toggle.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }
}

// ===========================================================================
// Concept cloud — top concepts, sized by mentions, each opens in the graph
// ===========================================================================
function renderWordCloud() {
  const panel = document.getElementById('panel-cloud');
  const top = [..._index.entities]
    .sort((a, b) => b.mention_count - a.mention_count)
    .slice(0, 30);

  if (top.length === 0) {
    panel.innerHTML = '<p class="heatmap-intro">No concepts have been extracted yet. They appear once the index is built.</p>';
    return;
  }

  const max = top[0].mention_count;
  const min = top[top.length - 1].mention_count;
  const range = Math.max(max - min, 1);

  panel.innerHTML = `
    <p class="heatmap-intro">The ${top.length} concepts mentioned most. Select one to find it in the graph.</p>
    <div class="wordcloud">
      ${top.map((e, i) => {
        const t = (e.mention_count - min) / range;
        const size = 14 + Math.round(t * 22);  // 14px → 36px
        const opacity = 0.62 + t * 0.38;
        return `<button class="wc-word js-rise" data-eid="${e.id}" data-tip="${escapeHtml(e.kind)} · ${e.mention_count} mentions"
                  style="font-size:${size}px;--o:${opacity.toFixed(2)};--i:${i % 12}">${escapeHtml(e.name)}</button>`;
      }).join('')}
    </div>`;

  panel.querySelectorAll('.wc-word').forEach(btn => {
    btn.addEventListener('click', () => _onEntityClick(parseInt(btn.dataset.eid, 10)));
  });
}

// ===========================================================================
// Timeline — records dated per month, from the REAL resolved dates
// (pipeline/docmeta.py). Undated records are excluded rather than invented.
// ===========================================================================
function renderTimeline() {
  const panel = document.getElementById('panel-timeline');
  const docs = _index.documents;
  if (docs.length === 0) {
    panel.innerHTML = '<p class="heatmap-intro">No records are indexed yet.</p>';
    return;
  }

  const months = makeMonthBuckets(14);
  const byLabel = new Map(months.map(m => [m.key, m]));
  const events = [];
  for (const d of docs) {
    if (!d.date_date) continue;
    const dt = new Date(d.date_date);
    const key = `${dt.getFullYear()}-${dt.getMonth()}`;
    const m = byLabel.get(key);
    if (!m) continue;
    m.docCount++;
    m.chunkCount += d.chunk_count || 0;
    m.types.set(d.source_type, (m.types.get(d.source_type) || 0) + 1);
    // Readable titles only: no file paths, no emoji.
    const nm = stripExt(d.name).replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').replace(/\s+/g, ' ').trim();
    if (nm && !/[\/\\]/.test(nm)) m.names.push(nm);
  }
  for (const m of months) {
    if (!m.docCount) continue;
    const kinds = [...m.types.entries()].sort((a, b) => b[1] - a[1])
      .map(([t, c]) => `${c} ${(TYPE_WORD[t] || ['record', 'records'])[c === 1 ? 0 : 1]}`);
    events.push({ month: m.long, summary: kinds.slice(0, 3).join(', ') + (kinds.length > 3 ? `, and ${kinds.length - 3} more kind${kinds.length - 3 === 1 ? '' : 's'}` : ''),
                  sample: m.names.slice(0, 6), chunks: m.chunkCount, records: m.docCount });
  }

  const maxBar = Math.max(...months.map(m => m.chunkCount), 1);
  const total = months.reduce((a, m) => a + m.docCount, 0);

  panel.innerHTML = `
    <p class="heatmap-intro">Records added per month over the last ${months.length} months, dated by each source’s own
    timestamp: video published, repository pushed, resume saved, page crawled. <b data-count="${total}">${total}</b> records in the window.</p>
    <div class="timeline">
      <div class="tl-bars" role="img" aria-label="Passages added per month, ${months[0].long} to ${months[months.length - 1].long}">
        ${months.map((m, i) => {
          const v = Math.max(0.04, m.chunkCount / maxBar);
          return `<span class="tl-col" tabindex="0" data-tip="${m.long}: ${m.docCount} record${m.docCount === 1 ? '' : 's'}, ${m.chunkCount} passage${m.chunkCount === 1 ? '' : 's'}">
                    <span class="tl-bar js-grow-y${m.chunkCount ? '' : ' is-empty'}" style="--v:${v.toFixed(3)};--d:${i * 40}ms"></span>
                  </span>`;
        }).join('')}
      </div>
      <div class="tl-axis">
        <span>${months[0].label}</span>
        <span>${months[Math.floor(months.length / 2)].label}</span>
        <span>${months[months.length - 1].label}</span>
      </div>
      <div class="tl-events">
        ${events.slice(-4).reverse().map(e => `
          <div class="tl-event"${e.sample.length ? ` tabindex="0" data-tip="Including ${escapeHtml(e.sample.join('; '))}"` : ''}>
            <span class="tl-event-date">${e.month}</span>
            <span class="tl-event-text">${escapeHtml(e.summary)}</span>
            <span class="tl-event-count">+<b data-count="${e.chunks}">${e.chunks}</b> passages</span>
          </div>`).join('')}
      </div>
    </div>`;
}

// ===========================================================================
// Helpers
// ===========================================================================
function makeMonthBuckets(count) {
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();
  const out = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: `${names[d.getMonth()]} ’${String(d.getFullYear()).slice(-2)}`,
      long: `${names[d.getMonth()]} ${d.getFullYear()}`,
      docCount: 0,
      chunkCount: 0,
      names: [],
      types: new Map(),
    });
  }
  return out;
}

const TYPE_WORD = {
  canon: ['answer in his own words', 'answers in his own words'], document: ['resume section', 'resume sections'],
  profile: ['profile record', 'profile records'], website: ['website page', 'website pages'],
  youtube: ['video', 'videos'], github: ['GitHub record', 'GitHub records'], linkedin: ['LinkedIn post', 'LinkedIn posts'],
};

function stripExt(name) {
  return name.replace(/\.(pdf|docx?|md|markdown|txt)$/i, '').replace(/_/g, ' ');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
