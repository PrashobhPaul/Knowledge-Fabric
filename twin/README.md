# The twin — your 3D, speaking self inside the Knowledge Fabric

The avatar lives in the hero of **https://prashobhpaul.github.io/Prashobh_Knowledge_Factory/** (left), beside the knowledge graph (right). Every answer is read aloud in the first person; the mouth follows the audio. Nothing is generated: the fabric's cited sentences are rewritten from "he" to "I" by rules (`site/js/persona.js`).

Everything owner-specific is in **`site/js/twinconfig.js`**.

## 1. Your face (10 minutes, website only)
The bundled `site/assets/avatar.glb` is the reference model with mouth shapes. Replace it with one made from your photo:
- **Avaturn** (avaturn.me → create from a selfie → export GLB with blendshapes), or
- **Ready Player Me** (readyplayer.me → Create avatar → Upload a photo → copy the link and append `?morphTargets=ARKit,Oculus%20Visemes`).

Then on GitHub: `site/js/twinconfig.js` → pencil → `avatarUrl: '<link or assets/your-file.glb>'` → Commit to `main`. (To host the file in the repo, upload it to `site/assets/` via *Add file → Upload files*.)

## 2. Your voice, paid once (no API calls on the live site)
1. ElevenLabs → **Voices → Add → Instant Voice Clone** → upload 1–3 minutes of your clean narration (your YouTube explainers work) → copy the **Voice ID**. Create an API key (Text to Speech only).
2. GitHub → **Settings → Secrets and variables → Actions** → add `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID`.
3. **Actions → "Voice bake" → Run workflow** with a character budget (your plan's monthly quota). It synthesises the sentences the twin can say, commits the MP3s to `site/voice/`, and the site deploys. Already-baked sentences are never paid for again; after a knowledge refresh, run it once more for the new ones.
4. Cancel the ElevenLabs plan when the bake is complete. Sentences not yet baked fall back to the browser voice, and the status line under the avatar says how many are in your voice.

## 3. Videos
A cited or related YouTube video plays inside the answer, at the cited second, instead of leaving the page.
