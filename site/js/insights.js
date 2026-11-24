// ============================================================================
// Insights dashboard — knowledge density heatmap, interactive word cloud, timeline
// ============================================================================

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
// Tab switching
// ===========================================================================
function setupTabs() {
  const tabs = document.querySelectorAll('#insight-tabs .tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      tabs.forEach(t => t.classList.toggle('is-active', t === tab));
      document.querySelectorAll('.insight-panel').forEach(p => {
        p.classList.toggle('is-active', p.dataset.panel === target);
      });
    });
  });
}

// ===========================================================================
// Heatmap — knowledge density by document
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

  // 391 documents rendered as 391 bars turned this panel into an endless scroll,
  // which buried every section below it. Show the meaningful head of the
  // distribution, summarise the tail, and let the reader expand on demand.
  const INITIAL = 12;
  const head = rows.slice(0, INITIAL);
  const tail = rows.slice(INITIAL);
  const tailChunks = tail.reduce((a, r) => a + r.chunks, 0);

  const rowHtml = (r, hidden) => {
    const pct = Math.max(8, Math.round((r.density / max) * 100));
    return `
      <div class="hm-row${hidden ? ' hm-row-extra' : ''}"${hidden ? ' hidden' : ''}>
        <span class="hm-label" title="${escapeHtml(r.name)}">${escapeHtml(stripExt(r.name))}</span>
        <div class="hm-track">
          <div class="hm-fill" style="width:${pct}%">
            <span class="hm-value">${r.chunks}c · ${r.entities}e</span>
          </div>
        </div>
      </div>`;
  };

  const html = `
    <div class="heatmap">
      <p class="heatmap-intro">
        Where your knowledge concentrates. Each bar is one document, sized by how much
        retrievable material it contributes — the densest ${INITIAL} are shown first.
      </p>
      ${head.map(r => rowHtml(r, false)).join('')}
      ${tail.length ? tail.map(r => rowHtml(r, true)).join('') : ''}
      ${tail.length ? `
        <button class="hm-toggle" id="hm-toggle" type="button"
                aria-expanded="false" aria-controls="panel-heatmap"
                data-more="Show all ${rows.length} documents"
                data-less="Show top ${INITIAL} only">
          <span class="hm-toggle-label">Show all ${rows.length} documents</span>
          <span class="hm-toggle-sub">${tail.length} more · ${tailChunks.toLocaleString()} passages</span>
        </button>` : ''}
    </div>`;
  panel.innerHTML = html;

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
// Word cloud — top entities, sized by mention count, clickable
// ===========================================================================
function renderWordCloud() {
  const panel = document.getElementById('panel-cloud');
  const top = [..._index.entities]
    .sort((a, b) => b.mention_count - a.mention_count)
    .slice(0, 30);

  if (top.length === 0) {
    panel.innerHTML = '<p class="heatmap-intro">No entities surfaced yet.</p>';
    return;
  }

  const max = top[0].mention_count;
  const min = top[top.length - 1].mention_count;
  const range = Math.max(max - min, 1);

  panel.innerHTML = `
    <p class="heatmap-intro">Top concepts in the corpus — click to focus the graph.</p>
    <div class="wordcloud">
      ${top.map(e => {
        const t = (e.mention_count - min) / range;
        const size = 14 + Math.round(t * 22);  // 14px → 36px
        const opacity = 0.6 + t * 0.4;
        return `<button class="wc-word" data-eid="${e.id}" style="font-size:${size}px;opacity:${opacity.toFixed(2)}">${escapeHtml(e.name)}</button>`;
      }).join('')}
    </div>`;

  panel.querySelectorAll('.wc-word').forEach(btn => {
    btn.addEventListener('click', () => _onEntityClick(parseInt(btn.dataset.eid, 10)));
  });
}

// ===========================================================================
// Timeline — knowledge growth across records, from the REAL resolved dates
// (pipeline/docmeta.py). Undated records are excluded rather than invented.
// ===========================================================================
function renderTimeline() {
  const panel = document.getElementById('panel-timeline');
  const docs = _index.documents;
  if (docs.length === 0) {
    panel.innerHTML = '<p class="heatmap-intro">No documents indexed.</p>';
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
    m.names.push(stripExt(d.name));
  }
  for (const m of months) {
    if (m.docCount) events.push({ month: m.label, docs: m.names.slice(0, 4), more: Math.max(0, m.names.length - 4), chunks: m.chunkCount });
  }

  const maxBar = Math.max(...months.map(m => m.chunkCount), 1);

  panel.innerHTML = `
    <p class="heatmap-intro">Knowledge growth — records dated per month, from each source's own timestamps (videos published, repositories pushed, resume saved, site crawled).</p>
    <div class="timeline">
      <div class="tl-axis">
        <span>${months[0].label}</span>
        <span>${months[Math.floor(months.length / 2)].label}</span>
        <span>${months[months.length - 1].label}</span>
      </div>
      <div class="tl-bars">
        ${months.map(m => {
          const h = Math.max(4, Math.round((m.chunkCount / maxBar) * 90));
          return `<div class="tl-bar" style="height:${h}px" title="${m.label}: ${m.chunkCount} chunks"></div>`;
        }).join('')}
      </div>
      <div class="tl-events">
        ${events.slice(-4).reverse().map(e => `
          <div class="tl-event">
            <span class="tl-event-date">${e.month}</span>
            <span class="tl-event-text">${escapeHtml(e.docs.join(', '))}${e.more ? ` +${e.more} more` : ''}</span>
            <span class="tl-event-count">+${e.chunks} chunks</span>
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
      label: `${names[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`,
      docCount: 0,
      chunkCount: 0,
      names: [],
    });
  }
  return out;
}

function stripExt(name) {
  return name.replace(/\.(pdf|docx?|md|markdown|txt)$/i, '').replace(/_/g, ' ');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
