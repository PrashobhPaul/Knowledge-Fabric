// ============================================================================
// Readiness rings — concentric arcs, one per health metric
// ============================================================================
//
// Five numbers as nested arcs: outermost is the broadest measure, innermost the
// most specific. One shape, read in a single glance from across a room (the
// real viewing condition on a screen share); arc lengths compare directly; and
// it scales to any width without reflowing.
//
// Behaviour, all of it optional:
//   * on reveal the arcs sweep to their values on a stagger and the centre
//     score counts up (motion.js plays [data-play] / [data-count]);
//   * a slow glint travels each filled arc — light moving over brushed metal —
//     drawn with a dash on a duplicate path, so the unfilled track never lights;
//   * the legend is a row of buttons: hover or focus spotlights one ring, a tap
//     pins it and opens its formula and inputs underneath.
// The numbers are always present as text, and reduced-motion visitors get the
// settled chart with no glint.
//
// Pure inline SVG. No chart library, no canvas.

// Champagne, glacier, platinum, rose gold, jade — the page's metals, lifted to
// read clearly on obsidian (every "to" stop clears 10:1 against #08090B).
const RING_COLORS = {
  coverage:     { from: '#C9A26A', to: '#F7E4BE', glow: 'rgba(233, 205, 150, 0.45)' },
  connectivity: { from: '#4FAFCF', to: '#CDF2FF', glow: 'rgba(147, 214, 234, 0.45)' },
  provenance:   { from: '#A9AFB8', to: '#FFFFFF', glow: 'rgba(236, 237, 239, 0.35)' },
  extraction:   { from: '#CF8A70', to: '#F8D2C2', glow: 'rgba(222, 160, 136, 0.42)' },
  freshness:    { from: '#45B487', to: '#C2F2D9', glow: 'rgba(140, 203, 174, 0.45)' },
};
const FALLBACK = { from: '#C9A26A', to: '#F7E4BE', glow: 'rgba(233, 205, 150, 0.45)' };

// Arcs run 270° with the gap at the bottom, so a full measure still reads as a
// measure rather than a closed circle.
const SWEEP = 270;
const START_ANGLE = 135;   // clockwise from 3 o'clock, i.e. bottom-left

function polar(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx, cy, r, startDeg, sweepDeg) {
  const a = polar(cx, cy, r, startDeg);
  const b = polar(cx, cy, r, startDeg + sweepDeg);
  const largeArc = sweepDeg > 180 ? 1 : 0;
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

const BAND_WORD = { strong: 'Strong', adequate: 'Adequate', weak: 'Needs work', critical: 'Critical' };

function fmtInput(v) {
  if (v && typeof v === 'object') return Object.entries(v).map(([k, n]) => `${k.replace(/_/g, ' ')} ${n}`).join(', ');
  return typeof v === 'number' ? v.toLocaleString() : String(v);
}
function humanKey(k) {
  const s = k.replace(/([A-Z])/g, ' $1').toLowerCase().trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * @param {Object} health  from computeHealth()
 * @returns {string} markup
 */
export function renderMaturityRings(health) {
  if (!health || !health.metrics || !health.metrics.length) return '';

  const SIZE = 260;
  const cx = SIZE / 2, cy = SIZE / 2;
  const OUTER = 118, STEP = 17, WIDTH = 11;

  const metrics = health.metrics;
  const rings = metrics.map((m, i) => {
    const r = OUTER - i * STEP;
    const pct = Math.max(0, Math.min(100, m.value)) / 100;
    const len = (2 * Math.PI * r) * (SWEEP / 360);
    const c = RING_COLORS[m.key] || FALLBACK;
    return { m, r, pct, len, fill: len * pct, c, i, id: `mr-grad-${m.key}` };
  });

  const defs = rings.map(r => `
    <linearGradient id="${r.id}" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${r.c.from}" />
      <stop offset="100%" stop-color="${r.c.to}" />
    </linearGradient>`).join('');

  // Each track is tinted with its own ring's colour, faintly, so the empty
  // part of a measure still belongs to it.
  const tracks = rings.map(r => `
    <path class="mr-track" d="${arcPath(cx, cy, r.r, START_ANGLE, SWEEP)}"
          stroke="${r.c.to}" stroke-width="${WIDTH}" data-key="${r.m.key}" />`).join('');

  const arcs = rings.map(r => `
    <path class="mr-arc" data-key="${r.m.key}" d="${arcPath(cx, cy, r.r, START_ANGLE, SWEEP)}"
          stroke="url(#${r.id})" stroke-width="${WIDTH}"
          stroke-dasharray="${r.len.toFixed(1)}"
          data-tip="${escapeHtml(r.m.plainLabel || r.m.label)}: ${r.m.value} of 100. ${escapeHtml(r.m.plainWhat || '')}"
          style="--mr-len:${r.len.toFixed(1)};--mr-off:${(r.len * (1 - r.pct)).toFixed(1)};--mr-delay:${200 + r.i * 140}ms;--mr-glow:${r.c.glow}">
      <title>${escapeHtml(r.m.plainLabel || r.m.label)}: ${r.m.value} out of 100</title>
    </path>`).join('');

  // A short bright dash that travels the filled length of each arc, then rests.
  const GL = 16;
  const glints = rings.filter(r => r.fill > GL * 1.5).map(r => `
    <path class="mr-glint" data-key="${r.m.key}" d="${arcPath(cx, cy, r.r, START_ANGLE, SWEEP)}"
          stroke-width="${WIDTH - 5}" stroke-dasharray="${GL} ${(r.len * 2).toFixed(0)}"
          style="--g0:${GL};--g1:${(-(r.fill - GL * 0.9)).toFixed(1)};--gdur:${(5.6 + r.i * 0.9).toFixed(1)}s;--gdelay:${(2.2 + r.i * 0.7).toFixed(1)}s" />`).join('');

  // End-caps mark where each arc stops, so five values locate instantly.
  const caps = rings.map(r => {
    const p = polar(cx, cy, r.r, START_ANGLE + SWEEP * r.pct);
    return `<circle class="mr-cap" data-key="${r.m.key}" cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="3.4"
              fill="${r.c.to}" style="--mr-delay:${1300 + r.i * 140}ms" />`;
  }).join('');

  // Quarter ticks on the outer bezel: 0, 25, 50, 75, 100.
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => {
    const a = polar(cx, cy, OUTER + 10, START_ANGLE + SWEEP * f);
    const b = polar(cx, cy, OUTER + 14, START_ANGLE + SWEEP * f);
    return `<line class="mr-tick" x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" />`;
  }).join('');

  const legend = rings.map(r => `
    <li style="--mr-delay:${900 + r.i * 90}ms">
      <button type="button" class="mr-legend-item" data-key="${r.m.key}" aria-pressed="false"
              aria-controls="mr-detail" style="--mr-color:${r.c.to}">
        <span class="mr-swatch" style="background:linear-gradient(135deg, ${r.c.from}, ${r.c.to})"></span>
        <span class="mr-legend-label">${escapeHtml(r.m.plainLabel || r.m.label)}</span>
        <span class="mr-legend-bar" aria-hidden="true"><span class="js-grow" style="--v:${r.pct.toFixed(3)};background:linear-gradient(90deg, ${r.c.from}, ${r.c.to})"></span></span>
        <span class="mr-legend-val" data-count="${r.m.value}">${r.m.value}</span>
      </button>
    </li>`).join('');

  // One detail block per ring, pre-rendered and toggled: the plain meaning, the
  // formula and the raw inputs it was computed from.
  const details = rings.map(r => {
    const inputs = Object.entries(r.m.inputs || {})
      .filter(([k]) => !/Reason$/.test(k))
      .slice(0, 5)
      .map(([k, v]) => `<span class="mr-in"><span class="mr-in-k">${escapeHtml(humanKey(k))}</span> <b>${escapeHtml(fmtInput(v))}</b></span>`).join('');
    return `
      <div class="mr-detail-item" data-key="${r.m.key}" hidden>
        <div class="mr-detail-head">
          <span class="mr-swatch" style="background:linear-gradient(135deg, ${r.c.from}, ${r.c.to})"></span>
          <span class="mr-detail-name">${escapeHtml(r.m.plainLabel || r.m.label)}</span>
          <span class="mr-detail-val">${r.m.value}<small>/100</small></span>
          <span class="mr-band mr-band-${r.m.band}">${BAND_WORD[r.m.band] || r.m.band}</span>
        </div>
        <p class="mr-detail-what">${escapeHtml(r.m.plainWhat || r.m.meaning)}</p>
        <code class="mr-detail-formula">${escapeHtml(r.m.formula)}</code>
        <div class="mr-detail-inputs">${inputs}</div>
      </div>`;
  }).join('');

  return `
    <div class="maturity-rings" data-play>
      <div class="mr-chart">
        <svg viewBox="-8 -8 ${SIZE + 16} ${SIZE + 16}" role="img"
             aria-label="Knowledge readiness ${health.overall} out of 100, across ${metrics.length} measures: ${
               rings.map(r => `${escapeHtml(r.m.plainLabel || r.m.label)} ${r.m.value}`).join(', ')}">
          <defs>${defs}</defs>
          <g class="mr-ticks">${ticks}</g>
          <g class="mr-tracks">${tracks}</g>
          <g class="mr-arcs">${arcs}</g>
          <g class="mr-glints" aria-hidden="true">${glints}</g>
          <g class="mr-caps">${caps}</g>
        </svg>
        <div class="mr-center">
          <span class="mr-score" id="health-score-num" data-count="${health.overall}">${health.overall}</span>
          <span class="mr-suffix">of 100</span>
          <span class="mr-band mr-band-${health.band}">${BAND_WORD[health.band] || health.band}</span>
        </div>
      </div>
      <ul class="mr-legend" aria-label="Readiness measures">${legend}</ul>
      <div class="mr-detail" id="mr-detail" aria-live="polite">
        <p class="mr-detail-hint">Select a measure to see its formula and inputs. The score is their unweighted mean.</p>
        ${details}
      </div>
    </div>`;
}

/** Wire hover spotlight and tap-to-pin detail. Safe to call after every render. */
export function bindMaturityRings(host) {
  const root = host && host.querySelector('.maturity-rings');
  if (!root || root._bound) return;
  root._bound = true;
  const items = [...root.querySelectorAll('.mr-legend-item')];
  const hint = root.querySelector('.mr-detail-hint');
  let pinned = null;

  const spotlight = (key) => {
    if (key) root.dataset.focus = key; else delete root.dataset.focus;
  };
  const pin = (key) => {
    pinned = pinned === key ? null : key;
    for (const b of items) b.setAttribute('aria-pressed', String(b.dataset.key === pinned));
    for (const d of root.querySelectorAll('.mr-detail-item')) d.hidden = d.dataset.key !== pinned;
    if (hint) hint.hidden = Boolean(pinned);
    spotlight(pinned);
  };

  for (const b of items) {
    b.addEventListener('pointerenter', () => spotlight(b.dataset.key));
    b.addEventListener('pointerleave', () => spotlight(pinned));
    b.addEventListener('focus', () => spotlight(b.dataset.key));
    b.addEventListener('blur', () => spotlight(pinned));
    b.addEventListener('click', () => pin(b.dataset.key));
  }
  for (const a of root.querySelectorAll('.mr-arc')) {
    a.addEventListener('pointerenter', () => spotlight(a.dataset.key));
    a.addEventListener('pointerleave', () => spotlight(pinned));
    a.addEventListener('click', () => pin(a.dataset.key));
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
