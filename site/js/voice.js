// ============================================================================
// Voice — speak a question, hear the answer. Browser APIs only, no backend.
// ============================================================================
//
// Input : Web Speech API SpeechRecognition (Chrome, Edge, Safari) in the chosen
//         language (en-IN by default; ml-IN, te-IN, hi-IN selectable).
// Output: speechSynthesis with a voice matching the chosen language when the
//         device has one, else the nearest English voice — and the UI says which.
// The chosen language is a per-visitor convenience kept in localStorage.

import { LANGS, DEFAULT_LANG } from './multilingual.js?v=1';

const KEY = 'kf.lang';

export function currentLang() {
  try { const l = localStorage.getItem(KEY); return LANGS[l] ? l : DEFAULT_LANG; } catch { return DEFAULT_LANG; }
}
export function setLang(lang) {
  try { localStorage.setItem(KEY, LANGS[lang] ? lang : DEFAULT_LANG); } catch { /* private mode */ }
}

export function recognitionSupported() {
  return typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}
export function synthesisSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

/** Start one recognition in `lang`; resolves with the transcript or rejects with a reason. */
export function listen(lang) {
  return new Promise((resolve, reject) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return reject(new Error('unsupported'));
    const r = new SR();
    r.lang = (LANGS[lang] || LANGS[DEFAULT_LANG]).code;
    r.interimResults = false;
    r.maxAlternatives = 1;
    let done = false;
    r.onresult = (e) => { done = true; resolve(String(e.results[0][0].transcript || '').trim()); };
    r.onerror = (e) => { done = true; reject(new Error(e.error || 'error')); };
    r.onend = () => { if (!done) reject(new Error('no-speech')); };
    try { r.start(); } catch (err) { reject(err); }
  });
}

/** Best available voice for a language: exact code, same language, else English. */
export function pickVoice(lang) {
  if (!synthesisSupported()) return null;
  const voices = speechSynthesis.getVoices() || [];
  const code = (LANGS[lang] || LANGS[DEFAULT_LANG]).code.toLowerCase();
  return voices.find(v => v.lang.toLowerCase() === code)
      || voices.find(v => v.lang.toLowerCase().startsWith(lang))
      || voices.find(v => v.lang.toLowerCase() === 'en-in')
      || voices.find(v => v.lang.toLowerCase().startsWith('en'))
      || null;
}

/** Speak `text`; returns what voice was used and whether it fell back to English. */
export function speak(text, lang) {
  if (!synthesisSupported()) return { ok: false, reason: 'unsupported' };
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(String(text).slice(0, 1200));
  const v = pickVoice(lang);
  if (v) u.voice = v;
  u.lang = v ? v.lang : (LANGS[lang] || LANGS[DEFAULT_LANG]).code;
  u.rate = 0.98;
  speechSynthesis.speak(u);
  const fallback = lang !== 'en' && !(v && v.lang.toLowerCase().startsWith(lang));
  return { ok: true, voice: v ? v.name : null, fallback };
}
export function stopSpeaking() { if (synthesisSupported()) speechSynthesis.cancel(); }

/** Markup for the language picker, the mic and the speaker buttons. */
export function renderVoiceControls(lang = currentLang()) {
  const opts = Object.entries(LANGS).map(([k, v]) =>
    `<option value="${k}"${k === lang ? ' selected' : ''}>${v.native}</option>`).join('');
  return `
    <label class="voice-lang" title="Question and answer language">
      <span class="sr-only">Language</span>
      <select id="lang-select" aria-label="Language">${opts}</select>
    </label>
    <button type="button" class="voice-btn" id="mic-btn" aria-label="Ask by voice" title="Ask by voice">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/></svg>
    </button>`;
}

export function renderSpeakButton() {
  return `<button type="button" class="voice-btn voice-speak" id="answer-speak" aria-label="Read the answer aloud" title="Read the answer aloud">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14"/></svg>
      <span>Listen</span>
    </button>`;
}
