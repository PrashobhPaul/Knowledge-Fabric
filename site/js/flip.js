// ============================================================================
// Flip cards — every metric card can show its working
// ============================================================================
//
// A number on a card is a claim. Tap (or Enter / Space) turns the card over to
// the method, the inputs and the counts it was computed from; the next tap
// turns it back. The card is a real <button> with aria-pressed, the hidden face
// is aria-hidden, and the face that turns up is announced through a polite
// live region. Both faces share one grid cell, so the card is always as tall as
// its taller face and flipping never moves anything around it.

import { replay } from './motion.js?v=2';

const ICON_TURN = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/></svg>`;

/**
 * @param {Object} o
 * @param {string} o.cls      extra classes for the card (keeps legacy hooks such as risk-card / tile)
 * @param {string} o.front    trusted HTML for the front face
 * @param {string} o.back     trusted HTML for the back face (method, inputs, counts)
 * @param {Object} [o.attrs]  extra attributes for the button (data-tone, data-key, id…)
 */
export function flipCard({ cls = '', front, back, attrs = {} }) {
  const extra = Object.entries(attrs).map(([k, v]) => ` ${k}="${esc(v)}"`).join('');
  return `
    <button type="button" class="flip-card ${cls}" aria-pressed="false"${extra}>
      <span class="flip-inner">
        <span class="flip-face flip-front">
          ${front}
          <span class="flip-hint" aria-hidden="true">${ICON_TURN}<span>How it’s calculated</span></span>
        </span>
        <span class="flip-face flip-back" aria-hidden="true">
          <span class="flip-back-head">How it’s calculated</span>
          ${back}
          <span class="flip-hint flip-hint-back" aria-hidden="true">${ICON_TURN}<span>Back</span></span>
        </span>
      </span>
    </button>`;
}

/** A labelled list of counts with proportional micro-bars, for a card's back. */
export function breakdown(rows, { total = null, unit = '' } = {}) {
  const max = Math.max(1, ...rows.map(r => r.value));
  return `<span class="flip-rows">${rows.map(r => `
    <span class="flip-row">
      <span class="flip-row-k">${esc(r.label)}</span>
      <span class="flip-row-bar"><span class="js-grow" style="--v:${(r.value / max).toFixed(3)}"></span></span>
      <span class="flip-row-v" data-count="${r.value}" data-group="1">${Number(r.value).toLocaleString()}</span>
    </span>`).join('')}
  </span>${total != null ? `<span class="flip-total">${esc(total)}${unit ? ' ' + esc(unit) : ''}</span>` : ''}`;
}

let bound = false;
export function initFlips() {
  if (bound) return;
  bound = true;
  let live = document.getElementById('fx-live');
  if (!live) {
    live = document.createElement('div');
    live.id = 'fx-live';
    live.className = 'sr-only';
    live.setAttribute('aria-live', 'polite');
    document.body.appendChild(live);
  }
  document.addEventListener('click', (e) => {
    const card = e.target instanceof Element ? e.target.closest('.flip-card') : null;
    if (!card) return;
    const flipped = card.getAttribute('aria-pressed') !== 'true';
    card.setAttribute('aria-pressed', String(flipped));
    card.classList.toggle('is-flipped', flipped);
    const front = card.querySelector('.flip-front');
    const back = card.querySelector('.flip-back');
    front.setAttribute('aria-hidden', String(flipped));
    back.setAttribute('aria-hidden', String(!flipped));
    const face = flipped ? back : front;
    if (flipped) replay(back);
    // Announce the face that turned up, minus the "How it's calculated / Back" chrome.
    const clone = face.cloneNode(true);
    clone.querySelectorAll('.flip-hint').forEach(n => n.remove());
    live.textContent = clone.textContent.replace(/\s+/g, ' ').trim();
  });
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
