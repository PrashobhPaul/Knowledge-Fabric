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
  '.risk-card', '.pillar', '.insights-stats .tile', '.src-card', '.related-card',
  '.chip', '.stage-btn', '.sc-btn:not(.sc-primary)', '.why-btn', '.ghost-btn', '.trace-row', '.gv-chip',
  '.lineage-paragraph', '.evidence', '.tl-event', '.voice-btn', '.cred-fact',
].join(',');
// The readiness card holds an interactive chart, so it catches light but does
// not lean: a tilting target under the pointer makes small legends hard to hit.
const SHEEN_ONLY = ['.explain-panel', '.insights-stage', '.graph-value', '.derivation-panel', '.sc-figure', '.sc-code', '.health-score-card'].join(',');
const REVEAL_GROUPS = [
  '.story-head > *', '.answer-stage', '.explain-stage > .explain-panel', '.health-score-card',
  '.health-risk-grid > .risk-card', '.health-derive-wrap', '.insights-stats > .tile', '.source-strip > .src-card',
  '.insights-stage', '.pillars-list > .pillar', '.footer-inner > *', '.cred-sig', '.cred-facts > .cred-fact',
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
export function countUp(el, to, { decimals = 0, suffix = '', prefix = '', duration = 1100, from = null, group = false } = {}) {
  if (!el) return;
  const target = Number(to);
  if (!Number.isFinite(target)) { el.textContent = String(to); return; }
  const start = from != null ? from : (parseFloat(el.dataset.value || '0') || 0);
  el.dataset.value = String(target);
  const fmt = (v) => prefix + (group
    ? v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : v.toFixed(decimals)) + suffix;
  if (reducedMotion()) { el.textContent = fmt(target); return; }
  const token = (el._countToken = (el._countToken || 0) + 1);
  const t0 = performance.now();
  const step = (now) => {
    if (token !== el._countToken) return;          // a newer count took over
    const p = Math.min(1, (now - t0) / duration);
    const eased = 1 - Math.pow(1 - p, 4);
    el.textContent = fmt(start + (target - start) * eased);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ---------------------------------------------------------------------------
// Metrics come alive when they are seen
// ---------------------------------------------------------------------------
//
// Any element rendered with one of these hooks animates the first time it is
// on screen, and again whenever it is re-rendered (every answer re-renders its
// metrics, so they replay with the new data):
//
//   [data-count]          number rolls up from 0 (data-decimals, data-suffix,
//                         data-prefix, data-group="1" for thousands separators)
//   .js-grow / .js-grow-y bar scales from 0 to --v along x / y
//   .js-draw              SVG stroke draws on (pathLength="1")
//   .js-rise              fades up into place (stagger with --i)
//   [data-play]           container gets .is-live (CSS does the rest)
//
// The final value is always in the markup, so reduced-motion visitors, no-JS
// readers and the tests see the real number; only transform, opacity and the
// text node change, so nothing reflows around them.
const METRIC_SEL = '[data-count], .js-grow, .js-grow-y, .js-draw, .js-rise, [data-play]';
let metricIO = null;
// A bar held at scale ~0 has (almost) no area, and Chrome does not reliably
// report it as intersecting. Bars are therefore watched through their track:
// the track is observed, and the bars inside it play when it comes into view.
const viaProxy = new WeakMap();
function watchTarget(el) {
  return (el.classList.contains('js-grow') || el.classList.contains('js-grow-y')) && el.parentElement ? el.parentElement : el;
}

function primeCount(el) {
  const n = Number(el.dataset.count);
  if (!Number.isFinite(n)) return;
  // Hold the final width so the number rolling up never nudges its neighbours.
  const w = el.getBoundingClientRect().width;
  if (w && getComputedStyle(el).display !== 'block') el.style.minWidth = `${Math.ceil(w)}px`;
  el.textContent = formatCount(el, 0);
}
function formatCount(el, v) {
  const d = Number(el.dataset.decimals || 0);
  const s = el.dataset.group === '1'
    ? v.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d })
    : v.toFixed(d);
  return (el.dataset.prefix || '') + s + (el.dataset.suffix || '');
}
function playMetric(el) {
  el.classList.add('is-live');
  if (el.hasAttribute('data-count')) {
    const n = Number(el.dataset.count);
    if (Number.isFinite(n)) {
      countUp(el, n, {
        from: 0,
        decimals: Number(el.dataset.decimals || 0),
        suffix: el.dataset.suffix || '',
        prefix: el.dataset.prefix || '',
        group: el.dataset.group === '1',
        duration: Number(el.dataset.duration || 0) || Math.min(1800, 900 + Math.log10(Math.abs(n) + 1) * 260),
      });
    }
  }
}
function armMetric(el) {
  if (el._armed) return;
  el._armed = true;
  if (!document.documentElement.classList.contains('fx-ready')) { el.classList.add('is-live'); return; }
  if (el.hasAttribute('data-count')) primeCount(el);
  const t = watchTarget(el);
  if (t !== el) {
    const list = viaProxy.get(t) || [];
    list.push(el);
    viaProxy.set(t, list);
  }
  metricIO.observe(t);
}
function scanMetrics(root) {
  if (root.nodeType !== 1) return;
  if (root.matches(METRIC_SEL)) armMetric(root);
  root.querySelectorAll(METRIC_SEL).forEach(armMetric);
}

export function initMetrics() {
  if (!('IntersectionObserver' in window) || reducedMotion()) {
    // Static page: everything simply shows its final state.
    document.documentElement.classList.add('fx-static');
    return;
  }
  metricIO = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      metricIO.unobserve(e.target);
      const proxied = viaProxy.get(e.target);
      if (proxied) {
        viaProxy.delete(e.target);
        for (const el of proxied) playMetric(el);
        // The track may itself be a metric (e.g. a [data-count]); play it too.
        if (e.target._armed) playMetric(e.target);
      } else {
        playMetric(e.target);
      }
    }
  }, { threshold: 0.2, rootMargin: '0px 0px -4% 0px' });
  scanMetrics(document.body);
  new MutationObserver((muts) => {
    for (const m of muts) for (const n of m.addedNodes) scanMetrics(n);
  }).observe(document.body, { childList: true, subtree: true });
}

/** Play a block's metrics again (a tab shown, a card flipped). */
export function replay(root) {
  if (!root || !metricIO) return;
  const els = root.matches && root.matches(METRIC_SEL) ? [root, ...root.querySelectorAll(METRIC_SEL)] : [...root.querySelectorAll(METRIC_SEL)];
  for (const el of els) {
    el.classList.remove('is-live');
    if (el.hasAttribute('data-count')) el.textContent = formatCount(el, 0);
  }
  // The block is on screen by definition (a tab just shown, a card just turned),
  // so play directly. Two frames: the reset state must paint before it moves.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    for (const el of els) { el._armed = true; metricIO.unobserve(watchTarget(el)); viaProxy.delete(watchTarget(el)); playMetric(el); }
  }));
}

// ---------------------------------------------------------------------------
// Tooltips — one floating label, delegated from [data-tip]
// ---------------------------------------------------------------------------
//
// Hover or keyboard focus shows it; on touch, a tap on a [data-tip] element
// that is not otherwise interactive toggles it. It is positioned with a
// transform only and described to assistive tech through aria-describedby.
export function initTips() {
  const tip = document.createElement('div');
  tip.id = 'fx-tip';
  tip.className = 'fx-tip';
  tip.setAttribute('role', 'tooltip');
  document.body.appendChild(tip);
  let owner = null;

  const place = (el) => {
    const r = el.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    let x = r.left + r.width / 2 - t.width / 2;
    x = Math.max(10, Math.min(vw - t.width - 10, x));
    let y = r.top - t.height - 10;
    const below = y < 70;
    if (below) y = r.bottom + 10;
    tip.dataset.side = below ? 'below' : 'above';
    tip.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
  };
  const show = (el) => {
    const text = el.getAttribute('data-tip');
    if (!text) return;
    if (owner && owner !== el) owner.removeAttribute('aria-describedby');
    owner = el;
    tip.textContent = text;
    el.setAttribute('aria-describedby', 'fx-tip');
    tip.classList.add('is-on');
    place(el);
  };
  const hide = () => {
    if (owner) owner.removeAttribute('aria-describedby');
    owner = null;
    tip.classList.remove('is-on');
  };

  document.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') return;
    const el = e.target instanceof Element ? e.target.closest('[data-tip]') : null;
    if (el) show(el); else if (owner) hide();
  }, { passive: true });
  document.addEventListener('focusin', (e) => {
    const el = e.target instanceof Element ? e.target.closest('[data-tip]') : null;
    if (el) show(el); else hide();
  });
  document.addEventListener('focusout', () => hide());
  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    const el = e.target instanceof Element ? e.target.closest('[data-tip]') : null;
    if (!el) { hide(); return; }
    if (owner === el) hide(); else show(el);
  }, { passive: true });
  window.addEventListener('scroll', () => { if (owner) hide(); }, { passive: true });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
}
