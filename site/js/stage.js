// ============================================================================
// Stage — renders the avatar and moves its mouth, eyes and head
// ============================================================================
//
// Works with any GLB that exposes ARKit / Oculus viseme morph targets
// (Ready Player Me does), a "jawOpen" / "mouthOpen" morph, or a jaw bone.
// Mouth level (0..1) comes from the audio analyser in twin.js. Without a model
// or WebGL the stage shows a portrait with a speaking ring — the conversation
// still works, only the face is flat.

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
const GLTF_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';

const MOODS = {
  idle:       { smile: 0.15, brow: 0,    ring: 'idle' },
  listening:  { smile: 0.10, brow: 0.3,  ring: 'listening' },
  thinking:   { smile: 0.05, brow: 0.5,  ring: 'thinking' },
  speaking:   { smile: 0.35, brow: 0.1,  ring: 'speaking' },
  apologetic: { smile: 0.0,  brow: 0.6,  ring: 'speaking' },
};

export async function createStage(host, { avatarUrl, photoUrl, name }) {
  const stage = { mode: 'portrait', mouth: 0, mood: 'idle', setMouth(l) { stage.mouth = l; }, setMood(m) { stage.mood = MOODS[m] ? m : 'idle'; host.dataset.mood = stage.mood; } };
  host.innerHTML = '';
  host.dataset.mood = 'idle';

  const portrait = () => {
    host.innerHTML = `<div class="portrait">${photoUrl ? `<img src="${photoUrl}" alt="${name}" />` : `<span class="initials">${name.split(' ').map(w => w[0]).join('').slice(0, 2)}</span>`}<span class="ring"></span></div>`;
    const ring = host.querySelector('.ring');
    const tick = () => { ring.style.transform = `scale(${1 + stage.mouth * 0.25})`; ring.style.opacity = String(0.35 + stage.mouth * 0.65); requestAnimationFrame(tick); };
    tick();
    stage.mode = 'portrait';
    return stage;
  };

  if (!avatarUrl) return portrait();
  let THREE, GLTFLoader;
  try {
    THREE = await import(THREE_URL);
    ({ GLTFLoader } = await import(GLTF_URL));
  } catch { return portrait(); }

  const canvas = document.createElement('canvas');
  host.appendChild(canvas);
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch { return portrait(); }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  camera.position.set(0, 1.55, 1.15);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x334466, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(1.5, 2.5, 2); scene.add(key);
  const rim = new THREE.DirectionalLight(0x6fa8ff, 0.8); rim.position.set(-2, 1.5, -1.5); scene.add(rim);

  const resize = () => { const w = host.clientWidth || 480, h = host.clientHeight || 560; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  resize(); window.addEventListener('resize', resize);

  let model = null, morphs = [], jaw = null, jawRest = 0, head = null;
  const idx = (mesh, names) => { for (const n of names) if (mesh.morphTargetDictionary[n] !== undefined) return mesh.morphTargetDictionary[n]; return -1; };
  try {
    const gltf = await new Promise((res, rej) => new GLTFLoader().load(avatarUrl, res, undefined, rej));
    model = gltf.scene; scene.add(model);
    model.traverse((o) => {
      if (o.isMesh && o.morphTargetDictionary && o.morphTargetInfluences) {
        morphs.push({ mesh: o,
          open: idx(o, ['viseme_aa', 'jawOpen', 'mouthOpen', 'viseme_O']),
          wide: idx(o, ['viseme_E', 'viseme_I', 'mouthStretchLeft']),
          smileL: idx(o, ['mouthSmileLeft']), smileR: idx(o, ['mouthSmileRight']),
          blinkL: idx(o, ['eyeBlinkLeft']), blinkR: idx(o, ['eyeBlinkRight']),
          browL: idx(o, ['browInnerUp']) });
      }
      if (o.isBone && /jaw/i.test(o.name) && !jaw) { jaw = o; jawRest = o.rotation.x; }
      if (/^head$/i.test(o.name) && !head) head = o;
    });
    // Frame the face: look at the head if there is one, else the model's top.
    const box = new THREE.Box3().setFromObject(model);
    const top = box.max.y;
    const target = head ? head.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(0, top - 0.12, 0);
    camera.position.set(target.x, target.y + 0.02, target.z + 0.62);
    camera.lookAt(target);
  } catch { host.innerHTML = ''; return portrait(); }

  let t = 0, blink = 2 + Math.random() * 3, blinkT = 0;
  const animate = () => {
    requestAnimationFrame(animate);
    t += 1 / 60;
    const mood = MOODS[stage.mood] || MOODS.idle;
    const open = Math.min(1, stage.mouth * 1.3);
    for (const m of morphs) {
      const inf = m.mesh.morphTargetInfluences;
      if (m.open >= 0) inf[m.open] += (open - inf[m.open]) * 0.5;
      if (m.wide >= 0) inf[m.wide] += (open * 0.35 - inf[m.wide]) * 0.4;
      if (m.smileL >= 0) inf[m.smileL] += (mood.smile - inf[m.smileL]) * 0.08;
      if (m.smileR >= 0) inf[m.smileR] += (mood.smile - inf[m.smileR]) * 0.08;
      if (m.browL >= 0) inf[m.browL] += (mood.brow - inf[m.browL]) * 0.08;
      // Blink every few seconds.
      blinkT += 1 / 60;
      const b = blinkT > blink ? Math.max(0, 1 - Math.abs((blinkT - blink) * 10 - 1)) : 0;
      if (blinkT > blink + 0.25) { blinkT = 0; blink = 2 + Math.random() * 4; }
      if (m.blinkL >= 0) inf[m.blinkL] = b;
      if (m.blinkR >= 0) inf[m.blinkR] = b;
    }
    if (jaw && !morphs.some(m => m.open >= 0)) jaw.rotation.x = jawRest + open * 0.25;
    if (head) { head.rotation.y = Math.sin(t * 0.6) * 0.06 + (stage.mood === 'listening' ? 0.08 : 0); head.rotation.x = Math.sin(t * 0.9) * 0.02 + (stage.mood === 'thinking' ? -0.05 : 0); }
    else if (model) model.rotation.y = Math.sin(t * 0.6) * 0.04;
    renderer.render(scene, camera);
  };
  animate();
  stage.mode = '3d';
  return stage;
}
