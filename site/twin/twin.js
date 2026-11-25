// ============================================================================
// Twin — the 3D, speaking face of the Knowledge Fabric
// ============================================================================
//
// Brain : the fabric modules in ../js (same retrieval, verdicts, citations,
//         languages as the main page). Nothing here invents facts.
// Face  : a GLB avatar (three.js) whose mouth follows the audio that is playing;
//         portrait fallback when no model is configured or WebGL is missing.
// Voice : the owner's cloned voice through the worker in /twin/worker when
//         configured, else the browser's own voice. Mic input via voice.js.

import { TWIN_CONFIG as CFG } from './config.js?v=1';
import { firstPersonAnswer, noAnswerLine } from './persona.js?v=1';
import { BM25, cohereByDocument, tokenize } from '../js/search.js?v=5';
import { SemanticIndex } from '../js/semantic.js?v=3';
import { hybridSearch } from '../js/hybrid.js?v=3';
import { buildAnswer } from '../js/answer.js?v=8';
import { matchQuestionBank, QUESTION_BANK } from '../js/questionbank.js?v=3';
import { LANGS } from '../js/multilingual.js?v=1';
import { currentLang, setLang, listen, recognitionSupported, synthesisSupported, pickVoice } from '../js/voice.js?v=1';
import { createStage } from './stage.js?v=1';

const state = { index: null, bm25: null, semantic: null, stage: null, audioCtx: null, busy: false };
const $ = (id) => document.getElementById(id);
const esc = (t) => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------------------------------------------------------------- brain
async function loadBrain() {
  const idx = await (await fetch('../data/index.json', { cache: 'no-cache' })).json();
  state.index = idx;
  state.bm25 = new BM25(idx.bm25);
  try {
    const sem = await (await fetch('../data/semantic.json', { cache: 'no-cache' })).json();
    state.semantic = new SemanticIndex(sem);
  } catch { state.semantic = null; }
}

function retrieve(q) {
  const h = hybridSearch(q, { bm25: state.bm25, semantic: state.semantic, chunks: state.index.chunks, filters: {}, topK: 20 });
  const ranked = h.results.length ? h.results.map(r => ({ chunkIdx: r.chunkIdx, score: r.score, _fusion: r })) : state.bm25.search(q, 20);
  const cohesion = cohereByDocument(ranked, state.index.chunks, { queryTerms: tokenize(q), bm25Index: state.bm25 });
  return { ranked, ...buildAnswer(q, ranked, state.index.chunks, cohesion, { semantic: state.semantic, bm25: state.index.bm25, diagnostics: h.diagnostics }) };
}

export function answer(question) {
  const bank = matchQuestionBank(question, { vocab: state.bm25.termId });
  let rq = (bank && bank.score >= 0.7) ? bank.question : question;
  let r = retrieve(rq);
  if (r.lowConfidence && rq === question && bank && bank.score >= 0.45) {
    const rescued = retrieve(bank.question);
    if (!rescued.lowConfidence) r = rescued;
  }
  return r;
}

// ---------------------------------------------------------------- voice out
async function speakText(text, lang, onLevel, onEnd) {
  if (CFG.ttsEndpoint && CFG.voiceId) {
    try {
      const res = await fetch(CFG.ttsEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceId: CFG.voiceId, lang }) });
      if (res.ok) { await playBlob(await res.blob(), onLevel, onEnd); return { provider: 'clone' }; }
    } catch { /* fall through to the browser voice */ }
  }
  if (!synthesisSupported()) { onEnd(); return { provider: 'none' }; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const v = pickVoice(lang);
  if (v) u.voice = v;
  u.lang = v ? v.lang : LANGS[lang].code;
  // No audio stream from the browser voice: the mouth follows word boundaries.
  let timer = null;
  u.onstart = () => { timer = setInterval(() => onLevel(0.35 + Math.random() * 0.45), 90); };
  u.onboundary = () => onLevel(0.8);
  u.onend = u.onerror = () => { clearInterval(timer); onLevel(0); onEnd(); };
  speechSynthesis.speak(u);
  return { provider: 'browser', voice: v ? v.name : null, fallback: lang !== 'en' && !(v && v.lang.toLowerCase().startsWith(lang)) };
}

function playBlob(blob, onLevel, onEnd) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    const ctx = state.audioCtx || (state.audioCtx = new (window.AudioContext || window.webkitAudioContext)());
    const src = ctx.createMediaElementSource(audio);
    const analyser = ctx.createAnalyser(); analyser.fftSize = 512;
    src.connect(analyser); analyser.connect(ctx.destination);
    const buf = new Uint8Array(analyser.frequencyBinCount);
    let raf;
    const tick = () => {
      analyser.getByteFrequencyData(buf);
      // Speech energy lives in the lower bins; normalise to 0..1.
      let sum = 0; for (let i = 2; i < 40; i++) sum += buf[i];
      onLevel(Math.min(1, (sum / 38) / 140));
      raf = requestAnimationFrame(tick);
    };
    audio.onplay = () => { ctx.resume(); tick(); };
    audio.onended = audio.onerror = () => { cancelAnimationFrame(raf); onLevel(0); URL.revokeObjectURL(url); onEnd(); resolve(); };
    audio.play().catch(() => { onEnd(); resolve(); });
  });
}

// ---------------------------------------------------------------- UI
function renderSources(citations) {
  const seen = new Set(); const items = [];
  for (const c of citations) {
    const ch = c.chunk; const m = ch.meta || {};
    const key = ch.url || ch.document_name; if (seen.has(key)) continue; seen.add(key);
    const where = m.t_label ? ` · ▶ ${m.t_label}` : '';
    items.push(`<li><a href="${esc(ch.url || '#')}" target="_blank" rel="noreferrer">${esc(ch.document_name)}</a><span>${esc(ch.source_type)}${where}</span></li>`);
  }
  return items.join('');
}

function addBubble(role, html) {
  const log = $('twin-log');
  const el = document.createElement('div');
  el.className = `bubble ${role}`;
  el.innerHTML = html;
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
  return el;
}

async function ask(question, { spoken = false } = {}) {
  if (state.busy || !question.trim()) return;
  state.busy = true;
  const lang = currentLang();
  addBubble('you', esc(question));
  state.stage.setMood('thinking');
  const r = answer(question);
  const hasEvidence = r.summary && r.summary.sentences && r.summary.sentences.length;
  const reply = hasEvidence ? firstPersonAnswer(r, { spokenSentences: CFG.spokenSentences }) : { text: noAnswerLine(lang), spoken: noAnswerLine(lang) };
  const conf = r.confidence ? `${r.confidence.percent.toFixed(0)}%` : '—';
  const bubble = addBubble('me', `<p>${esc(reply.text)}</p>
    <div class="meta"><span class="conf" title="Derived confidence">${esc(conf)}</span>
      ${hasEvidence ? `<details><summary>Sources (${r.citations.length})</summary><ul class="sources">${renderSources(r.citations)}</ul></details>` : ''}
      <a class="full" href="../?q=${encodeURIComponent(question)}" target="_blank" rel="noreferrer">Full answer with lineage ↗</a></div>`);
  state.stage.setMood(hasEvidence ? (r.verdict && r.verdict.kind === 'no' ? 'apologetic' : 'speaking') : 'apologetic');
  const info = await speakText(reply.spoken, lang, (lvl) => state.stage.setMouth(lvl), () => state.stage.setMood('idle'));
  if (info && info.provider === 'browser' && info.fallback) {
    bubble.querySelector('.meta').insertAdjacentHTML('beforeend', `<span class="note">No ${esc(LANGS[lang].label)} voice on this device — spoken in English</span>`);
  }
  state.busy = false;
}

function wireUI() {
  const input = $('twin-input'); const form = $('twin-form'); const mic = $('twin-mic'); const sel = $('twin-lang');
  sel.innerHTML = Object.entries(LANGS).map(([k, v]) => `<option value="${k}"${k === currentLang() ? ' selected' : ''}>${v.native}</option>`).join('');
  sel.addEventListener('change', () => setLang(sel.value));
  form.addEventListener('submit', (e) => { e.preventDefault(); const q = input.value.trim(); input.value = ''; ask(q); });
  if (!recognitionSupported()) { mic.disabled = true; mic.title = 'Voice input is not supported in this browser'; }
  mic.addEventListener('click', async () => {
    if (mic.dataset.listening === 'true') return;
    mic.dataset.listening = 'true'; state.stage.setMood('listening');
    try { const heard = await listen(currentLang()); if (heard) ask(heard, { spoken: true }); }
    catch { state.stage.setMood('idle'); }
    finally { mic.dataset.listening = 'false'; }
  });
  const chips = $('twin-chips');
  for (const q of ['Where do you work currently?', 'What projects have you built?', 'Did you attend the Microsoft AI Tour?', 'What is the Key Monastery video about?']) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = q; b.addEventListener('click', () => ask(q)); chips.appendChild(b);
  }
  $('twin-greet').addEventListener('click', () => {
    state.stage.setMood('speaking');
    speakText(CFG.greeting, currentLang(), (l) => state.stage.setMouth(l), () => state.stage.setMood('idle'));
  });
}

// ---------------------------------------------------------------- boot
(async function boot() {
  $('twin-status').textContent = 'Loading the knowledge…';
  state.stage = await createStage($('twin-stage'), { avatarUrl: CFG.avatarUrl, photoUrl: CFG.photoUrl, name: CFG.ownerName });
  try {
    await loadBrain();
    wireUI();
    const n = state.index.chunks.length;
    $('twin-status').textContent = `${n} knowledge records · ${CFG.ttsEndpoint && CFG.voiceId ? 'own voice' : 'browser voice'} · ${state.stage.mode === '3d' ? '3D avatar' : 'portrait (add an avatar URL in twin/config.js)'}`;
    $('twin-form').hidden = false;
  } catch (err) {
    $('twin-status').textContent = `Could not load the knowledge: ${err.message}`;
  }
})();
