#!/usr/bin/env node
// ============================================================================
// Voice bake — synthesise every sentence the twin can say, ONCE, in the
// owner's cloned voice, and store the audio in the repository.
// ============================================================================
//
// Why: the site is static and must not call a paid API per visitor. The set of
// sentences the twin can speak is finite (the fabric's evidence sentences,
// rewritten to the first person by persona.js), so they are baked ahead of
// time. A sentence already baked is never synthesised again; a knowledge
// refresh only bakes what is new. Run from GitHub Actions (voice.yml) with the
// ElevenLabs key and voice id as secrets, within a character budget per run.
//
//   node scripts/voice_bake.mjs --budget 60000 [--dry-run]
//
// Env: ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID
// Out: site/voice/<sha1>.mp3 + site/voice/manifest.json

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const OUT = path.join(SITE, 'voice');
const { toFirstPerson, verdictLine, noAnswerLine } = await import(path.join(SITE, 'js/persona.js'));
const { TWIN_CONFIG } = await import(path.join(SITE, 'js/twinconfig.js'));

const args = process.argv.slice(2);
const budget = Number((args[args.indexOf('--budget') + 1]) || 60000);
const dry = args.includes('--dry-run');
const KEY = process.env.ELEVENLABS_API_KEY, VOICE = process.env.ELEVENLABS_VOICE_ID;
if (!dry && (!KEY || !VOICE)) { console.error('ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID are required (or use --dry-run)'); process.exit(2); }

// Spoken-first priority: what a visitor is most likely to hear.
const PRIORITY = ['person_summary', 'person_about', 'role', 'engagement', 'project', 'service', 'education', 'event',
  'faq', 'skill_group', 'career_project', 'contact', 'languages', 'working_style', 'personal', 'repository', 'post',
  'video', 'channel', 'chapter', 'transcript', 'web_paragraph', 'document_paragraph'];

const sha1 = (t) => crypto.createHash('sha1').update(String(t).replace(/\s+/g, ' ').trim()).digest('hex');
const idx = JSON.parse(fs.readFileSync(path.join(SITE, 'data/index.json'), 'utf8'));
fs.mkdirSync(OUT, { recursive: true });
const manifestPath = path.join(OUT, 'manifest.json');
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { voice: VOICE || '', sentences: {} };

// Collect candidate lines: fixed lines first, then evidence sentences by priority.
const lines = [TWIN_CONFIG.greeting, verdictLine({ kind: 'yes' }), verdictLine({ kind: 'partial' }), verdictLine({ kind: 'no' }), noAnswerLine()];
// Curated answers first: they are what visitors hear most, verbatim.
for (const e of idx.canon || []) for (const s of String(e.answer).split(/(?<=[.!?])\s+(?=[A-Z"'(])/)) lines.push(s.trim());
const byType = new Map();
for (const c of idx.chunks) {
  const rt = (c.meta || {}).record_type || 'other';
  const sents = Array.isArray(c.sents) && c.sents.length ? c.sents.map(s => c.text.substr(s.o, s.l).trim()) : [c.text];
  for (const s of sents) {
    if (s.length < 30 || /\?\s*$/.test(s)) continue;
    const fp = toFirstPerson(s);
    if (fp) (byType.get(rt) || byType.set(rt, []).get(rt)).push(fp);
  }
}
for (const rt of PRIORITY) for (const s of byType.get(rt) || []) lines.push(s);
for (const [rt, arr] of byType) if (!PRIORITY.includes(rt)) lines.push(...arr);

const todo = [];
const seen = new Set();
for (const s of lines) {
  const h = sha1(s);
  if (seen.has(h) || manifest.sentences[h]) continue;
  seen.add(h); todo.push({ h, s });
}
let used = 0, done = 0;
console.log(`baked already: ${Object.keys(manifest.sentences).length} · candidates: ${todo.length} · budget: ${budget} chars`);
for (const { h, s } of todo) {
  if (used + s.length > budget) break;
  if (dry) { used += s.length; done++; continue; }
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_22050_32`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text: s, model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true } }),
  });
  if (!r.ok) { console.error(`stop: ${r.status} ${await r.text()}`); break; }
  fs.writeFileSync(path.join(OUT, `${h}.mp3`), Buffer.from(await r.arrayBuffer()));
  manifest.sentences[h] = { chars: s.length, baked: new Date().toISOString().slice(0, 10) };
  used += s.length; done++;
  if (done % 25 === 0) fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
}
manifest.voice = VOICE || manifest.voice;
if (!dry) fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
console.log(`${dry ? 'would bake' : 'baked'} ${done} sentences · ${used} chars · remaining ${todo.length - done}`);
