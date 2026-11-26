// ============================================================================
// Stage — the twin's body: renders the avatar and keeps it alive
// ============================================================================
//
// Works with any GLB that exposes ARKit blendshapes and Oculus visemes
// (Avaturn and Ready Player Me both do). The bundled avatar also carries an
// idle loop, which plays underneath everything below.
//
// Layers, applied every frame on top of the idle animation:
//   lips      15 Oculus visemes, driven by speaker.js (word timing from the
//             browser voice, or the spectrum of baked audio), with attack and
//             release so consonants snap and vowels open smoothly;
//   eyes      blinks (sometimes double), quick saccades, and a gaze that
//             follows the visitor's pointer;
//   head      slow idle drift, follows the pointer a little, beats with speech,
//             and nods or smiles at the start and end of an answer;
//   breath    a slow rise in the upper spine;
//   mood      at rest / listening / thinking / speaking — brows, smile, gaze and
//             the halo around the niche (CSS reads data-mood and --level).
//
// Without WebGL or a model the stage shows a portrait with a speaking ring:
// the conversation still works, only the face is flat.

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
const GLTF_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
const ROOM_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/environments/RoomEnvironment.js';

export const VISEMES = ['sil', 'PP', 'FF', 'TH', 'DD', 'kk', 'CH', 'SS', 'nn', 'RR', 'aa', 'E', 'I', 'O', 'U'];
// How far each viseme opens the jaw (adds to the model's own viseme shape).
const OPENNESS = { sil: 0, PP: 0, FF: 0.05, TH: 0.1, DD: 0.18, kk: 0.2, CH: 0.15, SS: 0.08, nn: 0.12, RR: 0.15, aa: 0.55, E: 0.35, I: 0.22, O: 0.45, U: 0.25 };

const MOODS = {
  idle:       { smile: 0.14, brow: 0.0,  label: 'At rest' },
  listening:  { smile: 0.1,  brow: 0.28, label: 'Listening' },
  thinking:   { smile: 0.04, brow: 0.42, label: 'Thinking' },
  speaking:   { smile: 0.2,  brow: 0.08, label: 'Speaking' },
  apologetic: { smile: 0.0,  brow: 0.55, label: 'Speaking' },
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

export async function createStage(host, { avatarUrl, photoUrl, name }) {
  const niche = host.closest('.stage-niche');
  const stateEl = niche ? niche.querySelector('.stage-state') : null;
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const stage = {
    mode: 'portrait', mouth: 0, mood: 'idle',
    _vis: { name: 'sil', w: 0, at: 0 },
    _gestures: [],
    setMouth(l) { stage.mouth = clamp(l || 0, 0, 1); },
    /** One viseme at a time; the renderer blends between them. */
    setViseme(v, w = 1) { stage._vis = { name: VISEMES.includes(v) ? v : 'aa', w: clamp(w, 0, 1), at: performance.now() }; },
    setMood(m) {
      stage.mood = MOODS[m] ? m : 'idle';
      host.dataset.mood = stage.mood;
      if (niche) niche.dataset.mood = stage.mood;
      if (stateEl) stateEl.textContent = MOODS[stage.mood].label;
    },
    /** 'nod' | 'smile' | 'tilt' — small, human punctuation around an answer. */
    gesture(kind) { stage._gestures.push({ kind, t0: performance.now() / 1000 }); },
  };
  host.innerHTML = '';
  stage.setMood('idle');

  // The halo breathes with the voice level whatever the renderer is (CSS reads
  // --level); written only when it changes, so a silent twin costs nothing.
  const halo = niche ? niche.querySelector('.niche-halo') : null;
  let shownLevel = -1;
  const levelLoop = () => {
    const l = Math.round(stage.mouth * 50) / 50;
    if (halo && l !== shownLevel) { halo.style.setProperty('--level', String(l)); shownLevel = l; }
    requestAnimationFrame(levelLoop);
  };
  levelLoop();

  const portrait = () => {
    host.innerHTML = `<div class="portrait">${photoUrl ? `<img src="${photoUrl}" alt="${name}" />` : `<span class="initials">${name.split(' ').map(w => w[0]).join('').slice(0, 2)}</span>`}<span class="ring"></span></div>`;
    const ring = host.querySelector('.ring');
    const tick = () => { ring.style.transform = `scale(${1 + stage.mouth * 0.25})`; ring.style.opacity = String(0.35 + stage.mouth * 0.65); requestAnimationFrame(tick); };
    tick();
    stage.mode = 'portrait';
    if (niche) niche.classList.remove('is-loading');
    return stage;
  };

  if (!avatarUrl) return portrait();
  if (niche) niche.classList.add('is-loading');
  let THREE, GLTFLoader, RoomEnvironment = null;
  try {
    THREE = await import(THREE_URL);
    ({ GLTFLoader } = await import(GLTF_URL));
    try { ({ RoomEnvironment } = await import(ROOM_URL)); } catch { RoomEnvironment = null; }
  } catch { return portrait(); }

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); } catch { host.innerHTML = ''; return portrait(); }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 1.6 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  if (RoomEnvironment) {
    try {
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
      scene.environmentIntensity = 0.55;
    } catch { /* lights alone are fine */ }
  }
  const camera = new THREE.PerspectiveCamera(22, 1, 0.05, 50);
  // A portrait lighting rig: warm champagne key, cool glacier rim, soft fill.
  scene.add(new THREE.HemisphereLight(0xe8ecf2, 0x0b0c0f, 0.55));
  const key = new THREE.DirectionalLight(0xffe4c0, 2.3); key.position.set(-1.2, 2.2, 2.4); scene.add(key);
  const fill = new THREE.DirectionalLight(0xdfe6ef, 0.55); fill.position.set(1.8, 1.2, 1.6); scene.add(fill);
  const rim = new THREE.DirectionalLight(0x9fdcf0, 2.4); rim.position.set(1.6, 2.0, -2.2); scene.add(rim);
  const rim2 = new THREE.DirectionalLight(0xf3d9a8, 1.3); rim2.position.set(-1.8, 1.6, -1.8); scene.add(rim2);

  let model = null, mixer = null, head = null, neck = null, spine = null;
  const morphs = new Map();   // name -> [{ inf, i }]
  const addMorph = (mesh) => {
    for (const [n, i] of Object.entries(mesh.morphTargetDictionary)) {
      if (!morphs.has(n)) morphs.set(n, []);
      morphs.get(n).push({ inf: mesh.morphTargetInfluences, i });
    }
  };
  const setMorph = (n, v) => { const list = morphs.get(n); if (list) for (const m of list) m.inf[m.i] = v; };
  const hasMorph = (n) => morphs.has(n);

  try {
    const gltf = await new Promise((res, rej) => new GLTFLoader().load(avatarUrl, res, undefined, rej));
    model = gltf.scene;
    scene.add(model);
    model.traverse((o) => {
      if (o.isMesh) {
        o.frustumCulled = false;
        if (o.morphTargetDictionary && o.morphTargetInfluences) addMorph(o);
        if (o.material && 'envMapIntensity' in o.material) o.material.envMapIntensity = 0.6;
      }
      if (o.isBone || o.type === 'Bone' || o.isObject3D) {
        if (/^head$/i.test(o.name) && !head) head = o;
        else if (/^neck$/i.test(o.name) && !neck) neck = o;
        else if (/^spine2$/i.test(o.name) && !spine) spine = o;
      }
    });
    if (gltf.animations && gltf.animations.length) {
      mixer = new THREE.AnimationMixer(model);
      const action = mixer.clipAction(gltf.animations[0]);
      action.play();
      mixer.update(0.5);
    }
  } catch { host.innerHTML = ''; return portrait(); }

  // ---- framing: head and shoulders, the head where the halo is ------------
  const headPos = new THREE.Vector3();
  const frame = () => {
    const w = host.clientWidth || 480, h = host.clientHeight || 560;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    model.updateMatrixWorld(true);
    if (head) head.getWorldPosition(headPos);
    else { const box = new THREE.Box3().setFromObject(model); headPos.set(0, box.max.y - 0.14, 0); }
    // Vertical span on screen, in metres: more of the shoulders when the niche is tall.
    const span = camera.aspect < 0.95 ? 0.66 : 0.6;
    const dist = (span / 2) / Math.tan((camera.fov * Math.PI / 180) / 2);
    const target = new THREE.Vector3(headPos.x, headPos.y + 0.06 - span * 0.12, headPos.z);
    camera.position.set(headPos.x, headPos.y + 0.06, headPos.z + dist);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  };
  frame();
  window.addEventListener('resize', frame, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(frame).observe(host);

  // ---- pointer gaze --------------------------------------------------------
  const gaze = { x: 0, y: 0, tx: 0, ty: 0, last: 0 };
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;   // on a phone he looks at you, not at your thumb
    const r = host.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height * 0.38;
    gaze.tx = clamp((e.clientX - cx) / (window.innerWidth * 0.5), -1, 1);
    gaze.ty = clamp((e.clientY - cy) / (window.innerHeight * 0.6), -1, 1);
    gaze.last = performance.now();
  }, { passive: true });

  // ---- animated state ------------------------------------------------------
  const S = {
    t: 0, vis: Object.fromEntries(VISEMES.map(v => [v, 0])), jaw: 0,
    smile: 0.14, brow: 0, browOuter: 0, squint: 0,
    yaw: 0, pitch: 0, roll: 0,
    eyeX: 0, eyeY: 0, sacX: 0, sacY: 0, nextSac: 0.8,
    blink: 0, blinkAt: 1.6 + Math.random() * 2, blinkPhase: -1, doubleBlink: false,
  };
  const qExtra = new THREE.Quaternion(), eExtra = new THREE.Euler(0, 0, 0, 'YXZ');

  const gestureOffsets = (now) => {
    let pitch = 0, roll = 0, smile = 0;
    stage._gestures = stage._gestures.filter(g => now - g.t0 < 2.2);
    for (const g of stage._gestures) {
      const p = now - g.t0;
      if (g.kind === 'nod' && p < 1.1) pitch += 0.075 * Math.sin(p * Math.PI * 2 * 1.8) * Math.exp(-p * 2.6) + 0.02 * Math.exp(-p * 3);
      if (g.kind === 'smile') smile += 0.42 * Math.sin(Math.min(1, p / 0.35) * Math.PI / 2) * Math.exp(-Math.max(0, p - 0.6) * 1.4);
      if (g.kind === 'tilt' && p < 1.6) roll += 0.06 * Math.sin(Math.min(1, p / 0.4) * Math.PI / 2) * Math.exp(-Math.max(0, p - 0.5) * 2);
    }
    return { pitch, roll, smile };
  };

  const update = (dt) => {
    S.t += dt;
    const t = S.t, now = performance.now() / 1000;
    const mood = MOODS[stage.mood] || MOODS.idle;
    if (mixer) mixer.update(dt);

    // ---- lips -------------------------------------------------------------
    const v = stage._vis;
    const age = (performance.now() - v.at) / 1000;
    const hold = age < 0.14 ? 1 : Math.exp(-(age - 0.14) * 9);
    let fromLevel = 0;
    if (age > 0.3 && stage.mouth > 0.03) fromLevel = stage.mouth;   // level-only drive (no viseme stream)
    let open = 0;
    for (const name of VISEMES) {
      let target = name === v.name ? v.w * hold : 0;
      if (fromLevel) target = name === 'aa' ? fromLevel * 0.75 : name === 'O' ? fromLevel * 0.25 : target;
      const cur = S.vis[name];
      S.vis[name] = damp(cur, target, target > cur ? 30 : 16, dt);
      open += S.vis[name] * OPENNESS[name];
    }
    for (const name of VISEMES) setMorph('viseme_' + name, S.vis[name]);
    S.jaw = damp(S.jaw, clamp(open * 0.35, 0, 0.3), 24, dt);
    setMorph('jawOpen', S.jaw);
    if (!hasMorph('viseme_aa')) setMorph('mouthOpen', clamp(open * 1.4, 0, 1));

    // ---- face: smile, brows ---------------------------------------------------
    const g = gestureOffsets(now);
    const talking = stage.mood === 'speaking' ? clamp(open * 2, 0, 1) : 0;
    S.smile = damp(S.smile, mood.smile + g.smile, 3, dt);
    setMorph('mouthSmileLeft', S.smile); setMorph('mouthSmileRight', S.smile * 0.96);
    setMorph('cheekSquintLeft', S.smile * 0.35); setMorph('cheekSquintRight', S.smile * 0.33);
    const browBeat = talking > 0.5 && Math.sin(t * 1.7) > 0.85 ? 0.25 : 0;
    S.brow = damp(S.brow, mood.brow + browBeat, 4, dt);
    setMorph('browInnerUp', S.brow);
    S.browOuter = damp(S.browOuter, stage.mood === 'listening' ? 0.18 : browBeat * 0.6, 4, dt);
    setMorph('browOuterUpLeft', S.browOuter); setMorph('browOuterUpRight', S.browOuter);
    S.squint = damp(S.squint, stage.mood === 'thinking' ? 0.22 : S.smile * 0.25, 3, dt);
    setMorph('eyeSquintLeft', S.squint); setMorph('eyeSquintRight', S.squint);

    // ---- eyes: saccades, gaze, blinks --------------------------------------
    const followPointer = performance.now() - gaze.last < 6000;
    gaze.x = damp(gaze.x, followPointer ? gaze.tx : 0, 4, dt);
    gaze.y = damp(gaze.y, followPointer ? gaze.ty : 0, 4, dt);
    S.nextSac -= dt;
    if (S.nextSac <= 0) {
      const thinking = stage.mood === 'thinking';
      S.sacX = thinking ? -0.35 + (Math.random() - 0.5) * 0.15 : (Math.random() - 0.5) * 0.28;
      S.sacY = thinking ? -0.38 : (Math.random() - 0.5) * 0.16;
      S.nextSac = 0.5 + Math.random() * (stage.mood === 'speaking' ? 1.4 : 2.4);
      if (Math.random() < 0.18 && S.blinkPhase < 0) S.blinkAt = 0;   // blinks ride on bigger saccades
    }
    S.eyeX = damp(S.eyeX, clamp(gaze.x * 0.75 + S.sacX, -1, 1), 38, dt);
    S.eyeY = damp(S.eyeY, clamp(gaze.y * 0.6 + S.sacY, -1, 1), 38, dt);
    const ex = S.eyeX, ey = S.eyeY;
    // the viewer's right is the avatar's left
    setMorph('eyeLookOutLeft', clamp(ex, 0, 1) * 0.7);  setMorph('eyeLookInRight', clamp(ex, 0, 1) * 0.7);
    setMorph('eyeLookInLeft', clamp(-ex, 0, 1) * 0.7);  setMorph('eyeLookOutRight', clamp(-ex, 0, 1) * 0.7);
    setMorph('eyeLookUpLeft', clamp(-ey, 0, 1) * 0.6);  setMorph('eyeLookUpRight', clamp(-ey, 0, 1) * 0.6);
    setMorph('eyeLookDownLeft', clamp(ey, 0, 1) * 0.55); setMorph('eyeLookDownRight', clamp(ey, 0, 1) * 0.55);

    S.blinkAt -= dt;
    if (S.blinkPhase < 0 && S.blinkAt <= 0) { S.blinkPhase = 0; S.doubleBlink = Math.random() < 0.14; }
    if (S.blinkPhase >= 0) {
      S.blinkPhase += dt;
      const p = S.blinkPhase;
      S.blink = p < 0.07 ? p / 0.07 : p < 0.1 ? 1 : p < 0.22 ? 1 - (p - 0.1) / 0.12 : 0;
      if (p >= 0.22) {
        S.blinkPhase = -1; S.blink = 0;
        S.blinkAt = S.doubleBlink ? 0.12 : 2.2 + Math.random() * 3.6;
        S.doubleBlink = false;
      }
    }
    setMorph('eyeBlinkLeft', S.blink); setMorph('eyeBlinkRight', S.blink);

    // ---- head and breath ---------------------------------------------------
    const idleYaw = Math.sin(t * 0.31) * 0.045 + Math.sin(t * 0.73 + 1.3) * 0.02;
    const idlePitch = Math.sin(t * 0.47 + 0.6) * 0.022 + Math.sin(t * 1.13) * 0.008;
    const idleRoll = Math.sin(t * 0.29 + 2.1) * 0.018;
    const beat = talking * (Math.sin(t * 7.3) * 0.012 + Math.sin(t * 3.1) * 0.01);
    const moodPitch = stage.mood === 'thinking' ? -0.06 : stage.mood === 'listening' ? 0.035 : 0;
    const moodRoll = stage.mood === 'listening' ? 0.07 : stage.mood === 'thinking' ? -0.03 : 0;
    const moodYaw = stage.mood === 'thinking' ? -0.08 : 0;
    S.yaw = damp(S.yaw, idleYaw + moodYaw + gaze.x * 0.3, 3, dt);
    S.pitch = damp(S.pitch, idlePitch + moodPitch + gaze.y * 0.16 + beat, 3.5, dt);
    S.roll = damp(S.roll, idleRoll + moodRoll, 2.5, dt);
    const pitch = S.pitch + g.pitch, roll = S.roll + g.roll;
    if (head) {
      eExtra.set(pitch, S.yaw, roll);
      qExtra.setFromEuler(eExtra);
      head.quaternion.multiply(qExtra);
      if (neck) { eExtra.set(pitch * 0.35, S.yaw * 0.35, roll * 0.3); qExtra.setFromEuler(eExtra); neck.quaternion.multiply(qExtra); }
    } else if (model) {
      model.rotation.y = S.yaw * 0.5;
    }
    if (spine) { eExtra.set(Math.sin(t * (Math.PI * 2 / 4.6)) * 0.012, 0, 0); qExtra.setFromEuler(eExtra); spine.quaternion.multiply(qExtra); }
  };

  // ---- render loop: only while visible ------------------------------------
  let visible = true, running = false, last = 0;
  const loop = (ts) => {
    if (!running) return;
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (ts - (last || ts)) / 1000) || 1 / 60;
    last = ts;
    update(reduce ? dt * 0.5 : dt);
    renderer.render(scene, camera);
  };
  const start = () => { if (running || !visible || document.hidden) return; running = true; last = 0; requestAnimationFrame(loop); };
  const stop = () => { running = false; };
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((es) => { visible = es[0].isIntersecting; visible ? start() : stop(); }, { threshold: 0.01 }).observe(host);
  }
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

  update(1 / 60);
  renderer.render(scene, camera);
  start();
  requestAnimationFrame(() => { host.classList.add('is-ready'); if (niche) { niche.classList.remove('is-loading'); niche.classList.add('is-ready'); } });
  stage.mode = '3d';
  host.dataset.mode = '3d';
  return stage;
}
