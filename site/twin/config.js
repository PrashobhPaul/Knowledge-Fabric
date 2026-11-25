// ============================================================================
// Twin configuration — the only file to edit to make the twin look and sound
// like Prashobh. Everything else (the knowledge, the answers, the citations)
// comes from the Knowledge Fabric at ../data/.
// ============================================================================
export const TWIN_CONFIG = {
  ownerName: 'Prashobh Paul',
  shortName: 'Prashobh',

  // 3D avatar (.glb). Ready Player Me → "Create from photo" → copy the avatar
  // URL and keep the morph-target suffix so the mouth can move:
  //   https://models.readyplayer.me/<id>.glb?morphTargets=ARKit,Oculus%20Visemes
  // Any GLB with ARKit/Oculus visemes, a "jawOpen"/"mouthOpen" morph or a jaw
  // bone works. Empty = no model yet: the stage shows the portrait fallback.
  avatarUrl: '',

  // Portrait shown while no avatar is configured (or if WebGL is unavailable).
  photoUrl: '',

  // Your own voice. A tiny worker (see /twin/worker) holds the ElevenLabs key
  // and your cloned voice id; the page never sees the key. Empty = the browser's
  // built-in voice is used (no cloning, no cost) until the worker is deployed.
  ttsEndpoint: '',          // e.g. https://twin-voice.<you>.workers.dev/speak
  voiceId: '',              // ElevenLabs voice id of the clone (multilingual_v2 model)

  // Idle lines the twin can say when greeting a visitor. First person, facts only.
  greeting: 'Hi, I am Prashobh. Ask me about my work, my projects, or my travels — every answer is traced to a source.',

  // Default answer/voice language; visitors can switch (en, ml, te, hi).
  defaultLang: 'en',

  // How many sentences are spoken aloud (the panel always shows the full answer).
  spokenSentences: 3,
};
