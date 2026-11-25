# Twin voice worker — your own voice, without exposing a key

The twin page (`/twin/`) speaks with the browser's voice until this worker is
deployed. Once it is, every sentence is spoken in your cloned voice, in English,
Malayalam, Telugu or Hindi, and cached so no sentence is paid for twice.

## 1. Clone your voice (ElevenLabs, website only)
1. Sign in at elevenlabs.io → **Voices** → **Add a new voice** → *Instant Voice Clone*
   (or *Professional* for best quality, which needs ~30 min of audio).
2. Upload 1–3 minutes of clean speech. Good sources: the narration from your
   YouTube explainers (for example the Key Monastery video), recorded without
   background music. Confirm it is your own voice.
3. Open the new voice → copy its **Voice ID**.
4. **Profile → API keys** → create a key with *Text to Speech* permission only.

## 2. Deploy the worker (Cloudflare dashboard, no command line)
1. dash.cloudflare.com → **Workers & Pages** → **Create** → **Create Worker** → name it `twin-voice` → **Deploy**.
2. **Edit code** → replace the contents with `twin/worker/elevenlabs-proxy.js` from this repository → **Deploy**.
3. **Settings → Variables and Secrets** → add:
   - `ELEVENLABS_API_KEY` (type *Secret*) — the API key
   - `ALLOWED_ORIGIN` — `https://prashobhpaul.github.io`
   - `ALLOWED_VOICES` — the Voice ID
4. Note the worker URL, e.g. `https://twin-voice.<account>.workers.dev`.

## 3. Point the twin at it (GitHub website)
Open `site/twin/config.js` in the repository → pencil icon → set

```js
ttsEndpoint: 'https://twin-voice.<account>.workers.dev',
voiceId: '<the Voice ID>',
```

→ **Commit changes** to `main`. The Pages deploy runs itself; the twin now
speaks in your voice. Remove either value to fall back to the browser voice.

## Cost and safety
- Each distinct sentence is synthesised once and cached at the edge.
- The worker only accepts the voice ids you list and only answers your site's origin.
- Rotate the key from the ElevenLabs dashboard at any time; nothing is stored in the repository.
