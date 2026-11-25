// ============================================================================
// Twin voice worker — Cloudflare Worker that speaks in the owner's cloned voice
// ============================================================================
//
// The static site must never hold the ElevenLabs key, so this tiny worker
// does: it receives {text, voiceId, lang}, calls ElevenLabs with the key kept
// as a Worker secret, caches each spoken sentence (same text → same audio,
// no second charge) and streams MP3 back with CORS limited to the site.
//
// Secrets / variables to set in the Cloudflare dashboard (Settings → Variables):
//   ELEVENLABS_API_KEY   secret   your ElevenLabs API key
//   ALLOWED_ORIGIN       text     https://prashobhpaul.github.io
//   ALLOWED_VOICES       text     comma-separated voice ids this worker may use
//
// Model: eleven_multilingual_v2 speaks English, Malayalam, Telugu and Hindi
// with the same cloned voice.

const MAX_CHARS = 1500;

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': origin && origin === env.ALLOWED_ORIGIN ? origin : env.ALLOWED_ORIGIN || '',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return new Response('POST {text, voiceId, lang}', { status: 405, headers: cors });
    if (!env.ELEVENLABS_API_KEY) return new Response('worker not configured', { status: 500, headers: cors });

    let body;
    try { body = await request.json(); } catch { return new Response('bad json', { status: 400, headers: cors }); }
    const text = String(body.text || '').trim().slice(0, MAX_CHARS);
    const voiceId = String(body.voiceId || '');
    const allowed = (env.ALLOWED_VOICES || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!text) return new Response('empty text', { status: 400, headers: cors });
    if (!/^[A-Za-z0-9]{10,40}$/.test(voiceId) || (allowed.length && !allowed.includes(voiceId))) {
      return new Response('voice not allowed', { status: 403, headers: cors });
    }

    // Cache by (voice, text): the same sentence is never synthesised twice.
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${voiceId}\n${text}`));
    const hex = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
    const cacheKey = new Request(`https://twin-voice.cache/${voiceId}/${hex}.mp3`);
    const cache = caches.default;
    const hit = await cache.match(cacheKey);
    if (hit) return new Response(hit.body, { headers: { ...cors, 'Content-Type': 'audio/mpeg', 'X-Cache': 'HIT' } });

    const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_64`, {
      method: 'POST',
      headers: { 'xi-api-key': env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true },
      }),
    });
    if (!upstream.ok) return new Response(`tts failed: ${upstream.status}`, { status: 502, headers: cors });

    const audio = await upstream.arrayBuffer();
    const res = new Response(audio, { headers: { ...cors, 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=2592000', 'X-Cache': 'MISS' } });
    ctx.waitUntil(cache.put(cacheKey, res.clone()));
    return res;
  },
};
