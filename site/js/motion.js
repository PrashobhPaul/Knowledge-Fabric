// ============================================================================
// Motion — the page answers the pointer
// ============================================================================
//
//   tilt + sheen   cards and secondary buttons lean toward the pointer a few
//                  degrees and catch a soft champagne highlight where it is;
//   magnetic       primary buttons drift toward a nearby pointer and press in;
//   parallax       background, graph and the twin's niche sit at three depths;
//   reveal         sections come into focus as they enter the viewport;
//   countUp        numbers roll to their value instead of appearing.
//
// Everything is delegated from document, so cards rendered later (answers,
// related videos, traces) join in without wiring. Nothing here changes layout:
// only transform, opacity and filter move. Touch devices and visitors who
// prefer reduced motion get the static page.

const TILT = [
  '.risk-card', '.pillar', '.insights-stats .tile', '.src-card', '.related-card', '.health-score-card',
  '.chip', '.stage-btn', '.sc-btn:not(.sc-primary)', '.why-btn', '.ghost-btn', '.trace-row', '.gv-chip',
  '.lineage-paragraph', '.evidence', '.tl-event', '.voice-btn',
].join(',');
const SHEEN_ONLY = ['.explain-panel', '.insights-stage', '.graph-value', '.derivation-panel', '.sc-figure', '.sc-code'].join(',');
const REVEAL_GROUPS = [
  '.story-head > *', '.answer-stage', '.explain-stage > .explain-panel', '.health-score-card',
  '.health-risk-grid > .risk-card', '.health-derive-wrap', '.insights-stats > .tile', '.source-strip > .src-card',
  '.insights-stage', '.pillars-list > .pillar', '.footer-inner > *',
];

const mq = (q) => (window.matchMedia ? window.matchMedia(q).matches : false);
export const reducedMotion = () => mq('(prefers-reduced-motion: reduce)');
const finePointer = () => mq('(hover: hover) and (pointer: fine)');

let io = null;

export function initMotion() {
  const root = document.documentElement;
  if (reducedMotion()) return;
  if ('IntersectionObserver' in window) root.classList.add('fx-ready');
  if (finePointer()) { bindTilt(); bindMagnetic(); }
  bindParallax();
}

// ---------------------------------------------------------------------------
// Tilt + sheen
// ---------------------------------------------------------------------------
function bindTilt() {
  let current = null, raf = 0, last = null;

  const prime = (el, tilt) => {
    if (el.dataset.fx) return;
    el.dataset.fx = '1';
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.classList.add('fx-sheen');
    if (tilt) el.classList.add('fx-tilt');
  };
  const release = (el) => {
    if (!el) return;
    el.classList.remove('is-tilting');
    el.style.removeProperty('--rx'); el.style.removeProperty('--ry');
  };
  const apply = () => {
    raf = 0;
    if (!current || !last) return;
    const r = current.getBoundingClientRect();
    const x = (last.clientX - r.left) / r.width, y = (last.clientY - r.top) / r.height;
    current.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
    current.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
    if (current.classList.contains('fx-tilt')) {
      // Smaller things lean further; a wide card barely moves.
      const max = Math.max(1.2, Math.min(7, 1400 / Math.max(r.width, 120)));
      current.style.setProperty('--rx', `${((0.5 - y) * max).toFixed(2)}deg`);
      current.style.setProperty('--ry', `${((x - 0.5) * max).toFixed(2)}deg`);
      current.classList.add('is-tilting');
    }
  };

  document.addEventListener('pointermove', (e) => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    const t = e.target instanceof Element ? e.target : null;
    let el = t && t.closest(TILT);
    let tilt = !!el;
    if (!el) { el = t && t.closest(SHEEN_ONLY); tilt = false; }
    if (el !== current) { release(current); current = el; if (el) prime(el, tilt); }
    last = e;
    if (current && !raf) raf = requestAnimationFrame(apply);
  }, { passive: true });
  document.addEventListener('pointerleave', () => { release(current); current = null; });
  window.addEventListener('blur', () => { release(current); current = null; });
}

// ---------------------------------------------------------------------------
// Magnetic primary buttons
// ---------------------------------------------------------------------------
function bindMagnetic() {
  let raf = 0, last = null;
  const update = () => {
    raf = 0;
    if (!last) return;
    for (const el of document.querySelectorAll('.fx-magnetic')) {
      const r = el.getBoundingClientRect();
      if (!r.width || r.bottom < 0 || r.top > window.innerHeight) continue;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const dx = last.clientX - cx, dy = last.clientY - cy;
      const reach = Math.max(r.width, r.height) / 2 + 46;
      const d = Math.hypot(dx, dy);
      if (d < reach && !el.disabled) {
        const pull = 1 - d / reach;
        el.style.setProperty('--mgx', `${(dx * 0.22 * pull).toFixed(2)}px`);
        el.style.setProperty('--mgy', `${(dy * 0.32 * pull).toFixed(2)}px`);
      } else if (el.style.getPropertyValue('--mgx')) {
        el.style.removeProperty('--mgx'); el.style.removeProperty('--mgy');
      }
    }
  };
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    last = e;
    if (!raf) raf = requestAnimationFrame(update);
  }, { passive: true });
}

// ---------------------------------------------------------------------------
// Parallax: background, graph and niche at three depths
// ---------------------------------------------------------------------------
function bindParallax() {
  const targets = () => [document.querySelector('.ambient-canvas'), document.querySelector('.stage-niche'), document.querySelector('.galaxy-frame')].filter(Boolean);
  let els = targets();
  const st = { x: 0, y: 0, tx: 0, ty: 0, shift: 0, raf: 0 };
  const fine = finePointer();
  const tick = () => {
    st.raf = 0;
    st.x += (st.tx - st.x) * 0.08;
    st.y += (st.ty - st.y) * 0.08;
    const hero = document.getElementById('hero');
    const heroH = hero ? hero.offsetHeight : window.innerHeight;
    const sy = window.scrollY;
    st.shift = sy < heroH ? sy : heroH;
    if (!els.length) els = targets();
    for (const el of els) {
      el.style.setProperty('--px', st.x.toFixed(4));
      el.style.setProperty('--py', st.y.toFixed(4));
      el.style.setProperty('--hero-shift', `${st.shift.toFixed(1)}px`);
    }
    if (Math.abs(st.tx - st.x) > 0.001 || Math.abs(st.ty - st.y) > 0.001) st.raf = requestAnimationFrame(tick);
  };
  const kick = () => { if (!st.raf) st.raf = requestAnimationFrame(tick); };
  if (fine) {
    window.addEventListener('pointermove', (e) => {
      st.tx = (e.clientX / window.innerWidth) * 2 - 1;
      st.ty = (e.clientY / window.innerHeight) * 2 - 1;
      kick();
    }, { passive: true });
  }
  window.addEventListener('scroll', () => { if (window.scrollY < window.innerHeight * 1.5) kick(); }, { passive: true });
}

// ---------------------------------------------------------------------------
// Reveal on scroll
// ---------------------------------------------------------------------------
export function observeReveals(root = document) {
  if (!document.documentElement.classList.contains('fx-ready')) return;
  if (!io) {
    io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    }, { threshold: 0, rootMargin: '0px 0px -8% 0px' });
  }
  for (const sel of REVEAL_GROUPS) {
    const els = [...root.querySelectorAll(sel)];
    els.forEach((el, i) => {
      if (el.classList.contains('reveal')) return;
      el.classList.add('reveal');
      el.style.setProperty('--i', String(Math.min(i, 6)));
      io.observe(el);
    });
  }
}

// ---------------------------------------------------------------------------
// Numbers roll to their value
// ---------------------------------------------------------------------------
export function countUp(el, to, { decimals = 0, suffix = '', duration = 1100, from = null } = {}) {
  if (!el) return;
  const target = Number(to);
  if (!Number.isFinite(target)) { el.textContent = String(to); return; }
  const start = from != null ? from : (parseFloat(el.dataset.value || '0') || 0);
  el.dataset.value = String(target);
  if (reducedMotion()) { el.textContent = target.toFixed(decimals) + suffix; return; }
  const t0 = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - t0) / duration);
    const eased = 1 - Math.pow(1 - p, 4);
    el.textContent = (start + (target - start) * eased).toFixed(decimals) + suffix;
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
