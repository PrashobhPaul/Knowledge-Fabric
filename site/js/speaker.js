// ============================================================================
// Speaker — plays an answer in the owner's voice and drives the avatar's mouth
// ============================================================================
//
// Order of preference per sentence:
//   1. Baked audio: voice/<sha1(sentence)>.mp3 produced once by scripts/voice_bake.mjs
//      with the owner's cloned voice. Zero runtime API calls, zero cost per visit.
//   2. The browser's own voice (speechSynthesis) for sentences not baked yet.
// Mouth level (0..1) is read from a Web Audio analyser for real audio, and
// approximated from word boundaries for the browser voice.

import { LANGS, DEFAULT_LANG } from './multilingual.js?v=1';
import { pickVoice, synthesisSupported } from './voice.js?v=1';

const state = { manifest: null, dir: 'voice', ctx: null, current: null, muted: false, token: 0 };

export async function loadVoiceManifest(dir = 'voice') {
  state.dir = dir;
  try {
    const r = await fetch(`${dir}/manifest.json`, { cache: 'no-cache' });
    state.manifest = r.ok ? await r.json() : { sentences: {} };
  } catch { state.manifest = { sentences: {} }; }
  return state.manifest;
}
export function bakedCount() { return state.manifest ? Object.keys(state.manifest.sentences || {}).length : 0; }
export function setMuted(m) { state.muted = !!m; if (m) stop(); }
export function isMuted() { return state.muted; }

export async function sha1(text) {
  const norm = String(text).replace(/\s+/g, ' ').trim();
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(norm));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function stop() {
  state.token++;
  if (state.current) { try { state.current.pause(); } catch { /* noop */ } state.current = null; }
  if (synthesisSupported()) speechSynthesis.cancel();
}

/** Speak sentences in order. onLevel(0..1) drives the mouth; resolves when done. */
export async function speak(sentences, { lang = DEFAULT_LANG, onLevel = () => {}, onStart = () => {} } = {}) {
  if (state.muted || !sentences.length) return { spoken: 0, baked: 0 };
  stop();
  const my = ++state.token;
  let spoken = 0, baked = 0, started = false;
  for (const s of sentences) {
    if (my !== state.token) break;
    const h = await sha1(s);
    const entry = state.manifest && state.manifest.sentences && state.manifest.sentences[h];
    if (!started) { started = true; onStart(); }
    if (entry) { await playFile(`${state.dir}/${h}.mp3`, onLevel, my); baked++; }
    else await speakBrowser(s, lang, onLevel, my);
    spoken++;
  }
  onLevel(0);
  return { spoken, baked };
}

function playFile(url, onLevel, my) {
  return new Promise((resolve) => {
    const audio = new Audio(url);
    audio.crossOrigin = 'anonymous';
    state.current = audio;
    let raf = null;
    try {
      const ctx = state.ctx || (state.ctx = new (window.AudioContext || window.webkitAudioContext)());
      const src = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser(); analyser.fftSize = 512;
      src.connect(analyser); analyser.connect(ctx.destination);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (my !== state.token) return;
        analyser.getByteFrequencyData(buf);
        let sum = 0; for (let i = 2; i < 40; i++) sum += buf[i];
        onLevel(Math.min(1, (sum / 38) / 140));
        raf = requestAnimationFrame(tick);
      };
      audio.onplay = () => { ctx.resume(); tick(); };
    } catch { /* no Web Audio: play without mouth tracking */ }
    const done = () => { if (raf) cancelAnimationFrame(raf); onLevel(0); state.current = null; resolve(); };
    audio.onended = done; audio.onerror = done;
    audio.play().catch(done);
  });
}

function speakBrowser(text, lang, onLevel, my) {
  return new Promise((resolve) => {
    if (!synthesisSupported()) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice(lang);
    if (v) u.voice = v;
    u.lang = v ? v.lang : (LANGS[lang] || LANGS[DEFAULT_LANG]).code;
    let timer = null;
    u.onstart = () => { timer = setInterval(() => { if (my === state.token) onLevel(0.3 + Math.random() * 0.5); }, 90); };
    u.onboundary = () => onLevel(0.85);
    u.onend = u.onerror = () => { clearInterval(timer); onLevel(0); resolve(); };
    speechSynthesis.speak(u);
  });
}
