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

// ---------------------------------------------------------------------------
// Voice choice: the twin is a man, so a male voice is preferred in every
// language — but language comes first. A voice that cannot read the script is
// useless, so a female voice in the right language beats a male voice in the
// wrong one; a female voice is only ever the graceful fallback, never forced.
// Gender is read from well-known voice names (Microsoft, Apple, Google,
// Android) and any "male"/"female" hint in the name or voiceURI.
// ---------------------------------------------------------------------------
const MALE_HINT = /\b(male|man|guy|ravi|rishi|hemant|prabhat|madhur|midhun|mohan|valluvar|kumar|arjun|aarav|prakash|daniel|david|mark|george|james|richard|thomas|oliver|arthur|aaron|alex|fred|gordon|ralph|lee|tom|eddy|reed|rocko|ryan|christopher|eric|roger|brian|andrew|william|liam|connor|mitchell|guy|steffan|davis|tony|jason|matthew|joey|justin|kevin|russell|raj|neel)\b/i;
const FEMALE_HINT = /\b(female|woman|zira|susan|samantha|victoria|karen|moira|tessa|fiona|veena|lekha|heera|kalpana|swara|neerja|sobhana|shruti|pallavi|aria|jenny|sonia|libby|hazel|catherine|allison|ava|kate|serena|nicky|joanna|salli|kimberly|ivy|emma|amy|olivia|natasha|clara|sara|grandma|shelley|sandy|flo|martha|ananya|aditi|raveena|kajal|isha|kiara|vani|gauri|michelle|elizabeth|nancy|jane|michelle|ana|emily|linda)\b/i;
const GOOGLE_FEMALE = /^google (us english|हिन्दी|bahasa|español|français|deutsch|italiano|日本語|한국의|nederlands|polski|português|русский|普通话|粤語|國語)/i;

/** 'male' | 'female' | null, from a SpeechSynthesisVoice's name and URI. */
export function voiceGender(v) {
  if (!v) return null;
  const text = `${v.name || ''} ${v.voiceURI || ''}`;
  if (/\bfemale\b/i.test(text)) return 'female';
  if (/\bmale\b/i.test(text)) return 'male';
  if (GOOGLE_FEMALE.test(v.name || '')) return 'female';
  if (FEMALE_HINT.test(text)) return 'female';
  if (MALE_HINT.test(text)) return 'male';
  return null;
}

/** Score every installed voice for `lang`; highest wins. Exported for tests. */
export function rankVoices(voices, lang) {
  const code = (LANGS[lang] || LANGS[DEFAULT_LANG]).code.toLowerCase();
  const base = code.split('-')[0];
  return (voices || []).map((v) => {
    const vl = String(v.lang || '').toLowerCase().replace('_', '-');
    let score = 0;
    if (vl === code) score += 200;
    else if (vl.split('-')[0] === base) score += 150;
    else if (vl.startsWith('en')) score += 20;          // last resort: read it in English
    else score -= 500;
    if (base === 'en' && vl === 'en-in') score += 12;    // his own accent first
    if (base === 'en' && vl === 'en-gb') score += 6;
    const g = voiceGender(v);
    if (g === 'male') score += 40;
    if (g === 'female') score -= 40;
    if (/natural|neural|online|premium|enhanced/i.test(v.name || '')) score += 15;
    if (v.localService) score += 3;
    return { v, score, gender: g };
  }).sort((a, b) => b.score - a.score);
}

let voiceCache = null;
function installedVoices() {
  if (!synthesisSupported()) return [];
  const list = speechSynthesis.getVoices() || [];
  if (list.length) voiceCache = list;
  return voiceCache || list;
}
if (typeof window !== 'undefined' && synthesisSupported()) {
  // Chrome fills the voice list asynchronously; warm it so the first answer
  // is not spoken by whatever default the browser happens to pick.
  try { installedVoices(); speechSynthesis.addEventListener('voiceschanged', installedVoices); } catch { /* old Safari */ }
}

/** Best available voice for a language: right language first, then male, then quality. */
export function pickVoice(lang) {
  const ranked = rankVoices(installedVoices(), lang);
  return ranked.length && ranked[0].score > -100 ? ranked[0].v : null;
}

/** Utterance settings for the chosen voice: a touch lower when gender is unknown. */
export function voiceTuning(v) {
  const g = voiceGender(v);
  return { rate: 0.98, pitch: g === 'female' ? 1 : g === 'male' ? 0.98 : 0.92 };
}

/** Speak `text`; returns what voice was used and whether it fell back to English. */
export function speak(text, lang) {
  if (!synthesisSupported()) return { ok: false, reason: 'unsupported' };
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(String(text).slice(0, 1200));
  const v = pickVoice(lang);
  if (v) u.voice = v;
  u.lang = v ? v.lang : (LANGS[lang] || LANGS[DEFAULT_LANG]).code;
  const tune = voiceTuning(v);
  u.rate = tune.rate; u.pitch = tune.pitch;
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
