// ============================================================================
// Speaker — plays an answer in the owner's voice and drives the avatar's mouth
// ============================================================================
//
// Order of preference per sentence:
//   1. Baked audio: voice/<sha1(sentence)>.mp3 produced once by scripts/voice_bake.mjs
//      with the owner's cloned voice. Zero runtime API calls, zero cost per visit.
//   2. The browser's own voice (speechSynthesis) for sentences not baked yet,
//      male by default in every language (voice.js pickVoice).
//
// Lip sync:
//   * Browser voice — each word boundary event (charIndex/charLength) is turned
//     into a short run of visemes from its letters and played across the word's
//     expected duration, so the mouth shapes follow the words being spoken.
//     Many voices (Google's network voices, some Android/iOS ones) never fire
//     boundary events; then the whole sentence is scheduled from a speaking-rate
//     estimate, and it re-syncs the moment a real boundary arrives.
//   * Baked audio — a Web Audio analyser splits the spectrum into bands: loud
//     low energy opens rounded vowels, mid energy open vowels, high energy the
//     fricatives, silence closes the lips.
// onViseme(name, weight) feeds stage.setViseme; onLevel(0..1) feeds the halo
// and the portrait ring.

import { LANGS, DEFAULT_LANG } from './multilingual.js?v=1';
import { pickVoice, voiceTuning, synthesisSupported } from './voice.js?v=2';

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

/** Speak sentences in order. onViseme/onLevel drive the mouth; resolves when done. */
export async function speak(sentences, { lang = DEFAULT_LANG, onLevel = () => {}, onViseme = () => {}, onStart = () => {} } = {}) {
  if (state.muted || !sentences.length) return { spoken: 0, baked: 0 };
  stop();
  const my = ++state.token;
  let spoken = 0, baked = 0, started = false;
  for (const s of sentences) {
    if (my !== state.token) break;
    const h = await sha1(s);
    const entry = state.manifest && state.manifest.sentences && state.manifest.sentences[h];
    if (!started) { started = true; onStart(); }
    if (entry) { await playFile(`${state.dir}/${h}.mp3`, onLevel, onViseme, my); baked++; }
    else await speakBrowser(s, lang, onLevel, onViseme, my);
    spoken++;
  }
  onLevel(0); onViseme('sil', 0);
  return { spoken, baked };
}

// ---------------------------------------------------------------------------
// Letters → visemes (Oculus set). Rough English rules: good enough that the
// lips close on p/b/m, bite on f/v, round on o/u/w and open on a.
// ---------------------------------------------------------------------------
const DIGRAPHS = [
  ['tch', 'CH'], ['sch', 'SS'], ['th', 'TH'], ['sh', 'CH'], ['ch', 'CH'], ['ph', 'FF'], ['gh', 'sil'], ['ck', 'kk'],
  ['ng', 'nn'], ['qu', 'kk'], ['oo', 'U'], ['ou', 'O'], ['ow', 'O'], ['ee', 'I'], ['ea', 'I'], ['ai', 'E'], ['ay', 'E'],
  ['oa', 'O'], ['au', 'O'], ['aw', 'O'], ['oi', 'O'], ['oy', 'O'], ['ie', 'I'], ['ei', 'E'], ['wh', 'U'],
];
const SINGLE = {
  a: 'aa', e: 'E', i: 'I', o: 'O', u: 'U', y: 'I',
  p: 'PP', b: 'PP', m: 'PP', f: 'FF', v: 'FF', t: 'DD', d: 'DD', n: 'nn', l: 'nn', r: 'RR',
  k: 'kk', g: 'kk', c: 'kk', q: 'kk', x: 'SS', s: 'SS', z: 'SS', j: 'CH', w: 'U', h: 'sil',
};
const VOWELS = new Set(['aa', 'E', 'I', 'O', 'U']);
// Indic scripts: vowel signs and independent vowels carry the mouth shape;
// labials close it. Everything else reads as an open-mid syllable.
const INDIC_VOWEL = [
  [/[ാആॆाआాఆாஆ]/, 'aa'], [/[ിീഇഈिीइईిీఇఈிீஇஈ]/, 'I'],
  [/[ുൂഉഊुूउऊుూఉఊுூஉஊ]/, 'U'], [/[െേഎഏेैएऐెేఎఏெேஎஏ]/, 'E'],
  [/[ൊോഒഓोौओऔొోఒఓொோஒஓ]/, 'O'], [/[പബഭമपफबभमప-మபம]/, 'PP'],
  [/[ഫവफवవவ]/, 'FF'],
];

export function wordToVisemes(word) {
  const w = String(word || '').toLowerCase();
  const out = [];
  if (/[ऀ-ൿ]/.test(w)) {
    for (const ch of w) {
      let v = null;
      for (const [re, vis] of INDIC_VOWEL) if (re.test(ch)) { v = vis; break; }
      if (!v && /[ऀ-ൿ]/.test(ch) && !/[्്్்ംंంஂ]/.test(ch)) v = out.length % 2 ? 'E' : 'aa';
      if (v && out[out.length - 1] !== v) out.push(v);
    }
    return out.length ? out : ['aa'];
  }
  let i = 0;
  while (i < w.length) {
    let hit = null;
    for (const [dg, v] of DIGRAPHS) if (w.startsWith(dg, i)) { hit = [dg.length, v]; break; }
    if (!hit) {
      const ch = w[i];
      let v = SINGLE[ch] || null;
      if (ch === 'c' && /[eiy]/.test(w[i + 1] || '')) v = 'SS';
      if (ch === 'e' && i === w.length - 1 && w.length > 2) v = null;   // silent final e
      if (/[0-9]/.test(ch)) v = 'aa';
      hit = [1, v];
    }
    if (hit[1] && hit[1] !== 'sil' && out[out.length - 1] !== hit[1]) out.push(hit[1]);
    i += hit[0];
  }
  return out.length ? out : ['sil'];
}

/** Rough duration of a word at a speaking rate, in seconds. */
function wordSeconds(word, rate) {
  const syll = Math.max(1, (String(word).toLowerCase().match(/[aeiouy]+|[ऀ-ൿ]{2}/g) || []).length);
  return (0.11 + syll * 0.17) / Math.max(0.5, rate || 1);
}

// A tiny scheduler: a queue of { at (ms), v, w } played on animation frames.
function makeLipQueue(onViseme, onLevel, my) {
  const q = { items: [], raf: 0, alive: true };
  const tick = () => {
    if (!q.alive || my !== state.token) { q.alive = false; return; }
    const now = performance.now();
    while (q.items.length && q.items[0].at <= now) {
      const it = q.items.shift();
      onViseme(it.v, it.w);
      onLevel(VOWELS.has(it.v) ? 0.55 + it.w * 0.45 : it.v === 'PP' ? 0.08 : 0.3);
    }
    q.raf = requestAnimationFrame(tick);
  };
  q.raf = requestAnimationFrame(tick);
  q.clear = () => { q.items.length = 0; };
  q.planWord = (word, startMs, durS) => {
    const vis = wordToVisemes(word);
    const step = (durS * 1000) / (vis.length + 0.6);
    vis.forEach((v, k) => q.items.push({ at: startMs + k * step, v, w: VOWELS.has(v) ? 0.78 + Math.random() * 0.22 : 0.85 }));
    q.items.push({ at: startMs + vis.length * step + step * 0.3, v: 'sil', w: 0.2 });
  };
  q.planText = (text, startMs, rate) => {
    let t = startMs;
    for (const m of String(text).matchAll(/[^\s]+/g)) {
      const word = m[0].replace(/[^\p{L}\p{N}'-]/gu, '');
      if (!word) continue;
      const d = wordSeconds(word, rate);
      q.planWord(word, t, d);
      t += d * 1000 + (/[,;:]$/.test(m[0]) ? 180 : /[.!?।]$/.test(m[0]) ? 320 : 40) / Math.max(0.5, rate);
    }
    q.items.sort((a, b) => a.at - b.at);
  };
  q.stop = () => { q.alive = false; cancelAnimationFrame(q.raf); onViseme('sil', 0); onLevel(0); };
  return q;
}

function playFile(url, onLevel, onViseme, my) {
  return new Promise((resolve) => {
    const audio = new Audio(url);
    audio.crossOrigin = 'anonymous';
    state.current = audio;
    let raf = null;
    try {
      const ctx = state.ctx || (state.ctx = new (window.AudioContext || window.webkitAudioContext)());
      const src = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser(); analyser.fftSize = 512; analyser.smoothingTimeConstant = 0.5;
      src.connect(analyser); analyser.connect(ctx.destination);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const band = (a, b) => { let s = 0; for (let i = a; i < b; i++) s += buf[i]; return s / (b - a); };
      const tick = () => {
        if (my !== state.token) return;
        analyser.getByteFrequencyData(buf);
        const low = band(2, 9), mid = band(9, 28), high = band(28, 90);
        const level = Math.min(1, ((low + mid) / 2) / 140);
        onLevel(level);
        if (level < 0.08) onViseme('sil', 0.4);
        else if (high > mid * 0.9 && high > 45) onViseme('SS', Math.min(1, high / 120));
        else if (low > mid * 1.25) onViseme(level > 0.5 ? 'O' : 'U', level);
        else onViseme(level > 0.45 ? 'aa' : 'E', level);
        raf = requestAnimationFrame(tick);
      };
      audio.onplay = () => { ctx.resume(); tick(); };
    } catch { /* no Web Audio: play without mouth tracking */ }
    const done = () => { if (raf) cancelAnimationFrame(raf); onLevel(0); onViseme('sil', 0); state.current = null; resolve(); };
    audio.onended = done; audio.onerror = done;
    audio.play().catch(done);
  });
}

function speakBrowser(text, lang, onLevel, onViseme, my) {
  return new Promise((resolve) => {
    if (!synthesisSupported()) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice(lang);
    if (v) u.voice = v;
    u.lang = v ? v.lang : (LANGS[lang] || LANGS[DEFAULT_LANG]).code;
    const tune = voiceTuning(v);
    u.rate = tune.rate; u.pitch = tune.pitch;

    const lips = makeLipQueue(onViseme, onLevel, my);
    let boundaries = 0, started = false, finished = false;
    const begin = () => {
      if (started) return;
      started = true;
      // Procedural plan for the whole sentence; replaced word by word if the
      // voice reports boundaries.
      lips.planText(text, performance.now() + 60, u.rate);
    };
    u.onstart = begin;
    u.onboundary = (e) => {
      if (my !== state.token) return;
      if (e.name && e.name !== 'word') return;
      begin();
      boundaries++;
      const from = e.charIndex || 0;
      const len = e.charLength || (text.slice(from).match(/^[^\s]+/) || [''])[0].length;
      const word = text.substr(from, len).replace(/[^\p{L}\p{N}'-]/gu, '');
      lips.clear();
      if (word) lips.planWord(word, performance.now(), wordSeconds(word, u.rate));
    };
    // Some engines never fire onstart; if the engine reports it is speaking, begin anyway.
    const watchdog = setTimeout(() => { if (!started && speechSynthesis.speaking) begin(); }, 900);
    const end = () => {
      if (finished) return;
      finished = true;
      clearTimeout(watchdog);
      lips.stop();
      resolve({ boundaries });
    };
    u.onend = end;
    u.onerror = end;
    speechSynthesis.speak(u);
  });
}
