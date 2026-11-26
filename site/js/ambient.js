// ============================================================================
// Ambient — the living background
// ============================================================================
//
// A single full-screen fragment shader: a slowly folding sheet of dark silk,
// lit like brushed metal. Champagne and platinum highlights travel across the
// folds; a cool glacier rim appears only faintly. It is deliberately cheap:
//
//   * rendered at a fraction of the screen's resolution and scaled up by CSS
//     (the field is soft, so nobody can tell), capped at ~30 frames a second;
//   * paused whenever the tab is hidden;
//   * one static frame for visitors who prefer reduced motion;
//   * if WebGL is missing or the context is lost, the canvas simply never
//     fades in and the CSS gradient on <body> is what they see.
//
// The page can make the field breathe — pulse() briefly quickens and brightens
// it when an answer lands, and the twin's voice level feeds setEnergy().

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2  uRes;
uniform float uTime;
uniform vec2  uPointer;   // -1..1, smoothed
uniform float uScroll;    // page scroll in viewport heights
uniform float uEnergy;    // 0..1, answer pulses and the twin's voice

// 2D simplex noise (Ashima Arts / Stefan Gustavson, MIT)
vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

// The silk: broad, low-frequency folds; only three octaves, so the light
// reads as long ribbons rather than marble veining.
float fbm3(vec2 p) {
  float s = 0.0, a = 0.55;
  mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 3; i++) { s += a * snoise(p); p = r * p * 1.9; a *= 0.45; }
  return s;
}
float silk(vec2 p, vec2 r) { return fbm3(p * 0.46 + 1.5 * r); }

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = frag / uRes;
  vec2 p = (frag - 0.5 * uRes) / uRes.y;
  p.y -= uScroll * 0.18;

  float t = uTime * (0.022 + 0.03 * uEnergy);

  // two passes of domain warping give long, folded ribbons
  vec2 q = vec2(fbm3(p * 0.42 + vec2(0.0, t)), fbm3(p * 0.42 + vec2(5.2, 1.3 - t)));
  vec2 r = vec2(fbm3(p * 0.55 + 1.4 * q + vec2(1.7, 9.2) + 0.6 * t),
                fbm3(p * 0.55 + 1.4 * q + vec2(8.3, 2.8) - 0.5 * t));

  float e = 0.012;
  float h  = silk(p, r);
  float hx = silk(p + vec2(e, 0.0), r);
  float hy = silk(p + vec2(0.0, e), r);
  vec3 n = normalize(vec3((h - hx) / e * 0.42, (h - hy) / e * 0.42, 1.0));

  // key light from the upper right, nudged by the pointer
  vec3 L = normalize(vec3(0.5 + 0.35 * uPointer.x, 0.62 + 0.25 * uPointer.y, 0.7));
  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 H = normalize(L + V);
  float diff = max(dot(n, L), 0.0);
  float spec = pow(max(dot(n, H), 0.0), 14.0);
  float sheen = pow(1.0 - max(dot(n, V), 0.0), 1.6);

  // where the light may fall: a broad pool top-right, a smaller one low-left,
  // and a soft glow that follows the pointer
  float pool = smoothstep(1.25, 0.0, length(p - vec2(0.85, 0.5)))
             + 0.5 * smoothstep(1.0, 0.0, length(p - vec2(-0.95, -0.6)));
  pool += 0.28 * smoothstep(0.7, 0.0, length(p - uPointer * vec2(0.85, 0.5)));
  pool *= 0.45 + 0.55 * smoothstep(0.15, 0.9, abs(p.x));   // keep the reading column calm
  pool = clamp(pool, 0.0, 1.2);

  vec3 obsidian  = vec3(0.026, 0.029, 0.036);
  vec3 graphite  = vec3(0.07, 0.076, 0.09);
  vec3 champagne = vec3(0.93, 0.80, 0.57);
  vec3 platinum  = vec3(0.80, 0.83, 0.87);
  vec3 glacier   = vec3(0.55, 0.82, 0.92);

  float metalMix = smoothstep(-0.3, 0.4, fbm3(p * 0.35 + vec2(t * 0.5, -t * 0.3)));
  vec3 metal = mix(platinum, champagne, metalMix);

  vec3 col = mix(obsidian, graphite, smoothstep(-0.7, 0.8, h) * (0.4 + 0.6 * diff));
  col += metal * spec * (0.2 + 0.16 * uEnergy) * pool;
  col += metal * sheen * 0.08 * pool;
  col += glacier * pow(max(-n.x, 0.0), 2.0) * 0.03 * (1.0 - metalMix) * pool;

  // vignette and a breath of energy
  float vig = smoothstep(1.3, 0.2, length((uv - 0.5) * vec2(1.2, 1.0)));
  col *= 0.5 + 0.5 * vig;
  col *= 1.0 + 0.12 * uEnergy;

  // dither: kills banding in the near-blacks
  col += (hash(frag + fract(uTime)) - 0.5) / 255.0 * 1.5;
  gl_FragColor = vec4(col, 1.0);
}
`;

export function startAmbient(canvas, opts = {}) {
  const api = { live: false, pulse() {}, setEnergy() {}, setPointer() {}, stop() {} };
  if (!canvas) return api;
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let gl = null;
  try {
    gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false,
                                      premultipliedAlpha: false, preserveDrawingBuffer: false,
                                      powerPreference: 'low-power' });
  } catch { gl = null; }
  if (!gl) return api;

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn('[ambient]', gl.getShaderInfoLog(s)); return null; }
    return s;
  };
  const vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return api;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return api;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U = {};
  for (const n of ['uRes', 'uTime', 'uPointer', 'uScroll', 'uEnergy']) U[n] = gl.getUniformLocation(prog, n);

  // Resolution: a fraction of CSS pixels — the field is soft, so it upscales cleanly.
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  const scale = opts.scale || (small ? 0.34 : 0.5);
  const maxPixels = small ? 180000 : 520000;
  const resize = () => {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    let cw = Math.max(64, Math.round(w * scale)), ch = Math.max(64, Math.round(h * scale));
    const over = (cw * ch) / maxPixels;
    if (over > 1) { const k = Math.sqrt(over); cw = Math.round(cw / k); ch = Math.round(ch / k); }
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; gl.viewport(0, 0, cw, ch); }
  };

  const state = { t: 7.3, energy: 0, energyTarget: 0, px: 0, py: 0, tx: 0, ty: 0, scroll: 0, raf: 0, last: 0, acc: 0, running: false };
  const FRAME = 1000 / (small ? 24 : 30);

  const draw = () => {
    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    gl.uniform1f(U.uTime, state.t);
    gl.uniform2f(U.uPointer, state.px, state.py);
    gl.uniform1f(U.uScroll, state.scroll);
    gl.uniform1f(U.uEnergy, state.energy);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const loop = (now) => {
    state.raf = requestAnimationFrame(loop);
    const dt = Math.min(100, now - (state.last || now));
    state.last = now;
    state.acc += dt;
    if (state.acc < FRAME) return;
    const step = state.acc / 1000;
    state.acc = 0;
    state.t += step;
    state.px += (state.tx - state.px) * Math.min(1, step * 2.2);
    state.py += (state.ty - state.py) * Math.min(1, step * 2.2);
    state.energy += (state.energyTarget - state.energy) * Math.min(1, step * 1.8);
    state.energyTarget *= Math.pow(0.35, step);       // pulses fade on their own
    state.scroll = window.scrollY / Math.max(1, window.innerHeight);
    draw();
  };

  const start = () => {
    if (state.running || reduce) return;
    state.running = true; state.last = 0; state.acc = FRAME;
    state.raf = requestAnimationFrame(loop);
  };
  const halt = () => { state.running = false; cancelAnimationFrame(state.raf); };

  resize();
  draw();
  requestAnimationFrame(() => { canvas.parentElement && canvas.parentElement.classList.add('is-live'); });
  api.live = true;

  window.addEventListener('resize', () => { resize(); if (reduce) draw(); }, { passive: true });
  document.addEventListener('visibilitychange', () => (document.hidden ? halt() : start()));
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); halt(); canvas.parentElement && canvas.parentElement.classList.remove('is-live'); });
  if (!reduce) {
    window.addEventListener('pointermove', (e) => {
      state.tx = (e.clientX / window.innerWidth) * 2 - 1;
      state.ty = -((e.clientY / window.innerHeight) * 2 - 1);
    }, { passive: true });
  }
  if (!document.hidden) start();

  api.pulse = (amount = 1) => { state.energyTarget = Math.min(1.2, state.energyTarget + amount); };
  api.setEnergy = (v) => { state.energyTarget = Math.max(state.energyTarget, Math.min(1, v)); };
  api.stop = halt;
  return api;
}
