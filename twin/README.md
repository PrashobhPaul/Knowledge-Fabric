# The twin — a speaking, 3D Prashobh on top of the Knowledge Fabric

Live at **https://prashobhpaul.github.io/Prashobh_Knowledge_Factory/twin/** (same GitHub Pages site as the fabric, no extra hosting).

| Layer | What it is | Where |
|---|---|---|
| Brain | The fabric's retrieval, verdicts, citations and languages — unchanged | `site/js/` |
| Persona | Rule-based rewrite of the cited sentences from "he" to "I". No model, no new facts | `site/twin/persona.js` |
| Face | Any GLB with ARKit/Oculus visemes; mouth follows the audio, blinks, idle head motion; portrait fallback | `site/twin/stage.js` |
| Voice | Your cloned voice via a Cloudflare Worker that holds the key; browser voice until then | `twin/worker/` |
| Ears | Mic input in English, Malayalam, Telugu or Hindi (Web Speech API) | `site/js/voice.js` |

Everything you need to change is in **`site/twin/config.js`**.

## Make the avatar (Ready Player Me, website only — about 10 minutes)
1. Go to **readyplayer.me** → **Create avatar** (no account needed; an account lets you edit later).
2. Choose **Take a photo** or **Upload a photo** — use a front-facing, evenly lit photo of your face.
3. Adjust hair, glasses, outfit; click **Next / Done**. The page shows your avatar and a link such as
   `https://models.readyplayer.me/68a1…c3.glb` (also under **My avatars → ⋯ → Copy avatar link**).
4. Add the mouth shapes to the link — this is what makes the lips move:
   `https://models.readyplayer.me/<id>.glb?morphTargets=ARKit,Oculus%20Visemes`
5. On GitHub open `site/twin/config.js` → pencil icon → set `avatarUrl: '<that link>'` → **Commit changes** to `main`.
   The deploy runs itself; reload `/twin/`.

Optional: for a photo while the model loads, set `photoUrl` to any image URL (for example the portrait on your website).

## Give it your voice
Follow `twin/worker/README.md` (ElevenLabs clone + a 5-line Cloudflare Worker, all from the dashboards). Until then the twin uses the browser's voice and says so.

## Why it cannot hallucinate
The twin never composes text. The fabric picks sentences that answer the question, cites them, and the persona layer only swaps pronouns and verb forms ("Prashobh Paul worked at" → "I worked at"). Open **Sources** under any reply, or **Full answer with lineage** to see the same evidence on the fabric page.
