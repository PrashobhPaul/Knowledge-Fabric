// ============================================================================
// Twin configuration — the avatar and voice of the Knowledge Fabric's owner.
// Edit this file on GitHub; nothing else needs to change.
// ============================================================================
export const TWIN_CONFIG = {
  ownerName: 'Prashobh Paul',

  // 3D avatar (.glb) with ARKit / Oculus viseme morph targets, so the mouth can
  // move with the audio. The bundled model is the reference avatar; replace it
  // with one made from your photo (Avaturn or Ready Player Me — see twin/README.md):
  //   https://models.readyplayer.me/<id>.glb?morphTargets=ARKit,Oculus%20Visemes
  avatarUrl: 'assets/avatar.glb',

  // Portrait shown if the model cannot load (no WebGL, blocked CDN).
  photoUrl: '',

  // Baked audio in your own voice (one-time ElevenLabs clone + bake, no runtime
  // API). Folder holding manifest.json and <sha1>.mp3 files; see twin/README.md.
  voiceDir: 'voice',

  // Spoken when a visitor presses "Say hello".
  greeting: 'Hi, I am Prashobh. Ask me about my work, my projects, or my travels. Every answer I give is traced to a source.',

  // How many sentences of an answer are spoken aloud (the panel shows all).
  spokenSentences: 3,
  // Answers are read aloud automatically; visitors can mute.
  autoSpeak: true,
};
