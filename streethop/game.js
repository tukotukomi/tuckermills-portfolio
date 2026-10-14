// Betty Lou's Street Hop: a Crossy Road-style hopper.
// One cell = one world unit. Row r sits at z = -r, so "forward" is -z.
// Playable columns are -COLS..COLS. The world is drawn wider than that, and
// the cells outside the playable strip are shaded darker, like Crossy Road.
import * as THREE from 'three';

// ---------- tuning ----------
const COLS = 4;                 // playable columns either side of centre
const VIS = 16;                 // columns drawn either side
const SPAN = 2 * VIS + 10;      // loop length that moving things wrap around
const AHEAD = 20, BEHIND = 17;  // rows kept around the camera
const HOP_T = 0.13;             // seconds per hop
const CAM_OFF = new THREE.Vector3(2.4, 10, 6.6); // behind-right, looking down
const HAWK_DIST = 6.6;          // how far behind the camera Betty Lou can fall
const RAINBOW = [0xff4b4b, 0xff9a2e, 0xffd93b, 0x5fd35f, 0x46a6ff, 0x9b6bff];
const GREENS = [0x5cb83a, 0x4faa38, 0x68c444, 0x55b03f];

const rand = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rand(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const diff = r => clamp(r / 160, 0, 1);

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
};

// ---------- renderer / scene ----------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2f6e3a);
const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, -60, 120);

const hemi = new THREE.HemisphereLight(0xfff4ec, 0x7d6fa8, 1.15);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff3dc, 2.9);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 60 });
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);
const SUN_OFF = new THREE.Vector3(-5, 12, 4);

// ---------- cel shading ----------
// Lighting snaps to flat bands via a toon gradient, then a screen-space pass
// draws ink outlines wherever depth or surface direction jumps.
function ramp(levels) {
  const t = new THREE.DataTexture(new Uint8Array(levels), levels.length, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}
// Two looks: "cel" (soft three-band toon, plum ink) and "bold" (hard two-tone
// shadows that match the unlit sides, thick black ink, punchier colour).
const LOOKS = {
  cel: { ramp: ramp([95, 175, 255]), sky: 0xfff4ec, ground: 0x7d6fa8, hemi: 1.15, sun: 2.9, ink: 0x2b1d33, inkMix: 0.9, line: 1, sat: 1 },
  bold: { ramp: ramp([0, 255]), sky: 0xfff6f0, ground: 0xfff6f0, hemi: 2.1, sun: 1.5, ink: 0x000000, inkMix: 1, line: 1.6, sat: 1.3 },
};
const toons = [];
let look = LOOKS.cel;
const toon = opts => {
  const m = new THREE.MeshToonMaterial({ gradientMap: look.ramp, ...opts });
  toons.push(m);
  return m;
};

const INK = new THREE.Color(0x2b1d33);
const rtColor = new THREE.WebGLRenderTarget(1, 1, { samples: 4 });
rtColor.texture.colorSpace = THREE.SRGBColorSpace;
const rtNormal = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
rtNormal.depthTexture = new THREE.DepthTexture(1, 1);
const normalMat = new THREE.MeshNormalMaterial();
const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const postMat = new THREE.ShaderMaterial({
  uniforms: {
    tColor: { value: rtColor.texture },
    tNormal: { value: rtNormal.texture },
    tDepth: { value: rtNormal.depthTexture },
    texel: { value: new THREE.Vector2() },
    texelN: { value: new THREE.Vector2() },
    depthRange: { value: camera.far - camera.near },
    ink: { value: INK },
    inkMix: { value: 0.9 },
    sat: { value: 1 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
  fragmentShader: `
    uniform sampler2D tColor, tNormal, tDepth;
    uniform vec2 texel, texelN;  // silhouette lines vs thinner interior lines
    uniform float depthRange;
    uniform vec3 ink;
    uniform float inkMix, sat;
    varying vec2 vUv;
    float D(vec2 uv) { return texture2D(tDepth, uv).x * depthRange; }
    vec3 N(vec2 uv) { return texture2D(tNormal, uv).xyz; }
    void main() {
      vec3 col = texture2D(tColor, vUv).rgb;
      col = max(mix(vec3(dot(col, vec3(0.2126, 0.7152, 0.0722))), col, sat), 0.);
      vec2 dx = vec2(texel.x, 0.), dy = vec2(0., texel.y);
      float dc = D(vUv);
      // second difference: flat (even sloped) ground cancels out, steps don't
      float de = max(abs(D(vUv - dx) + D(vUv + dx) - 2. * dc), abs(D(vUv - dy) + D(vUv + dy) - 2. * dc));
      vec3 nc = N(vUv);
      vec2 nx = vec2(texelN.x, 0.), ny = vec2(0., texelN.y);
      float ne = max(max(distance(nc, N(vUv + nx)), distance(nc, N(vUv - nx))),
                     max(distance(nc, N(vUv + ny)), distance(nc, N(vUv - ny))));
      float edge = max(smoothstep(0.04, 0.09, de), smoothstep(0.25, 0.45, ne));
      gl_FragColor = vec4(mix(col, ink, edge * inkMix), 1.);
      #include <colorspace_fragment>
    }`,
  depthTest: false,
  depthWrite: false,
});
const postQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat);
renderer.shadowMap.autoUpdate = false;

function renderCel() {
  renderer.shadowMap.needsUpdate = true;
  renderer.setRenderTarget(rtColor);
  renderer.render(scene, camera);
  const bg = scene.background;
  scene.overrideMaterial = normalMat;
  scene.background = null;
  renderer.setRenderTarget(rtNormal);
  renderer.render(scene, camera);
  scene.overrideMaterial = null;
  scene.background = bg;
  renderer.setRenderTarget(null);
  renderer.render(postQuad, postCam);
}
let lineScale = 1;
function resizeCel() {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  rtColor.setSize(size.x, size.y);
  rtNormal.setSize(size.x, size.y);
  // lines about 2 CSS px wide on phones, never thinner than one pixel
  const dpr = renderer.getPixelRatio();
  const px = Math.max(1, dpr * lineScale), pn = Math.max(1, dpr * Math.min(lineScale, 1));
  postMat.uniforms.texel.value.set(px / size.x, px / size.y);
  postMat.uniforms.texelN.value.set(pn / size.x, pn / size.y);
}
function applyLook(name) {
  const L = look = LOOKS[name] || LOOKS.cel;
  for (const m of toons) m.gradientMap = L.ramp;
  hemi.color.setHex(L.sky);
  hemi.groundColor.setHex(L.ground);
  hemi.intensity = L.hemi;
  sun.intensity = L.sun;
  INK.setHex(L.ink);
  postMat.uniforms.inkMix.value = L.inkMix;
  postMat.uniforms.sat.value = L.sat;
  lineScale = L.line;
  resizeCel();
}

// ---------- voxel builder: many boxes -> one vertex-coloured mesh ----------
const FACES = [
  { n: [1, 0, 0], c: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]] },
  { n: [-1, 0, 0], c: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]] },
  { n: [0, 1, 0], c: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]] },
  { n: [0, -1, 0], c: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] },
  { n: [0, 0, 1], c: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
  { n: [0, 0, -1], c: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]] },
];
const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _c = new THREE.Color();
const _q = new THREE.Quaternion(), _e = new THREE.Euler();
const VMAT = toon({ vertexColors: true });

class VB {
  constructor() { this.p = []; this.n = []; this.c = []; this.i = []; }
  box(w, h, d, x, y, z, color, rx = 0, ry = 0, rz = 0) {
    _c.set(color);
    const rot = rx || ry || rz;
    if (rot) _q.setFromEuler(_e.set(rx, ry, rz));
    for (const f of FACES) {
      const base = this.p.length / 3;
      _n.fromArray(f.n);
      if (rot) _n.applyQuaternion(_q);
      for (const k of f.c) {
        _v.set(k[0] * w / 2, k[1] * h / 2, k[2] * d / 2);
        if (rot) _v.applyQuaternion(_q);
        this.p.push(_v.x + x, _v.y + y, _v.z + z);
        this.n.push(_n.x, _n.y, _n.z);
        this.c.push(_c.r, _c.g, _c.b);
      }
      this.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    return this;
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.i);
    g.computeBoundingSphere();
    return g;
  }
  mesh(mat = VMAT) {
    const m = new THREE.Mesh(this.geometry(), mat);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }
}
const shade = (hex, f) => new THREE.Color(hex).multiplyScalar(f).getHex();

// ---------- models ----------
function buildGirl() {
  const SKIN = 0xffd3b4, DENIM = 0x3e6fd8, DENIM_D = 0x2c56b0, SHIRT = 0xff8fc8;
  const group = new THREE.Group();
  const inner = new THREE.Group();
  group.add(inner);
  const b = new VB();
  for (const s of [-1, 1]) {
    b.box(0.14, 0.08, 0.2, s * 0.09, 0.04, -0.02, 0xffffff);      // sneakers
    b.box(0.15, 0.02, 0.21, s * 0.09, 0.005, -0.02, 0xff5fa2);    // soles
    b.box(0.15, 0.05, 0.15, s * 0.09, 0.1, 0, DENIM_D);           // rolled cuffs
    b.box(0.14, 0.14, 0.14, s * 0.09, 0.19, 0, DENIM);            // legs
    b.box(0.09, 0.1, 0.12, s * 0.225, 0.5, 0, SHIRT);             // sleeves
    b.box(0.08, 0.12, 0.09, s * 0.225, 0.39, 0, SKIN);            // hands
    b.box(0.05, 0.02, 0.27, s * 0.11, 0.565, 0, DENIM);           // straps over shoulders
    b.box(0.05, 0.13, 0.02, s * 0.11, 0.5, 0.13, DENIM);          // straps, back
    b.box(0.035, 0.035, 0.02, s * 0.09, 0.535, -0.15, 0xffd23f);  // buttons
    b.box(0.06, 0.09, 0.02, s * 0.09, 0.79, -0.205, 0x222222);    // eyes
    b.box(0.025, 0.03, 0.01, s * 0.09 + 0.012, 0.815, -0.217, 0xffffff);
    b.box(0.08, 0.04, 0.02, s * 0.15, 0.715, -0.203, 0xff9eb5);   // cheeks
    b.box(0.04, 0.24, 0.4, s * 0.23, 0.86, 0.01, s < 0 ? RAINBOW[0] : RAINBOW[5]); // side hair
  }
  b.box(0.36, 0.2, 0.26, 0, 0.35, 0, DENIM);       // overalls
  b.box(0.34, 0.11, 0.24, 0, 0.5, 0, SHIRT);       // shirt
  b.box(0.22, 0.13, 0.03, 0, 0.49, -0.13, DENIM);  // bib
  b.box(0.1, 0.06, 0.02, 0, 0.48, -0.148, DENIM_D);// bib pocket
  b.box(0.42, 0.38, 0.4, 0, 0.78, 0, SKIN);        // head
  b.box(0.07, 0.025, 0.02, 0, 0.69, -0.203, 0xc2475f); // smile
  const w = 0.47 / 6;
  RAINBOW.forEach((col, i) => {                    // rainbow hair, striped side to side
    const x = -0.235 + w * (i + 0.5);
    b.box(w, 0.08, 0.46, x, 1.0, 0.01, col);
    b.box(w, 0.32, 0.06, x, 0.83, 0.225, col);
    b.box(w, 0.08, 0.04, x, 0.93, -0.215, col);
  });
  inner.add(b.mesh());

  // High pigtails: their own meshes so they can bounce.
  const tails = [];
  for (const s of [-1, 1]) {
    const t = new VB();
    t.box(0.11, 0.1, 0.11, 0, 0, 0, 0xff5fa2);
    [[0.07, 0.09, 0.14], [0.15, 0.13, 0.135], [0.23, 0.12, 0.125], [0.29, 0.06, 0.115], [0.32, -0.03, 0.105], [0.33, -0.13, 0.095]]
      .forEach(([x, y, sz], i) => t.box(sz, sz, sz, s * x, y, 0, RAINBOW[i]));
    const m = t.mesh();
    m.position.set(s * 0.24, 1.0, 0.04);
    m.userData.side = s;
    inner.add(m);
    tails.push(m);
  }
  group.scale.setScalar(1.3);
  group.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { group, inner, tails };
}

function buildTractor(col, hub, wagon) {
  const b = new VB();
  const dark = 0x2a2a2a;
  b.box(1.5, 0.14, 0.42, 0.15, 0.32, 0, 0x3a3a3a);
  b.box(0.85, 0.38, 0.5, 0.45, 0.56, 0, col);
  b.box(0.86, 0.025, 0.12, 0.45, 0.76, 0, hub);
  b.box(0.62, 0.42, 0.66, -0.35, 0.6, 0, col);
  b.box(0.52, 0.36, 0.6, -0.35, 0.99, 0, 0xbfe9ff);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.06, 0.42, 0.06, -0.35 + sx * 0.28, 1.0, sz * 0.31, col);
  b.box(0.76, 0.07, 0.76, -0.35, 1.24, 0, 0xffffff);
  for (const s of [-1, 1]) {
    b.box(0.62, 0.62, 0.2, -0.4, 0.31, s * 0.38, dark);
    b.box(0.26, 0.26, 0.04, -0.4, 0.31, s * 0.49, hub);
    b.box(0.34, 0.34, 0.14, 0.68, 0.17, s * 0.3, dark);
    b.box(0.14, 0.14, 0.03, 0.68, 0.17, s * 0.38, hub);
    b.box(0.03, 0.08, 0.08, 0.885, 0.63, s * 0.17, 0xfff3a0);
  }
  b.box(0.03, 0.26, 0.36, 0.88, 0.55, 0, 0x444444);
  b.box(0.07, 0.38, 0.07, 0.55, 0.92, 0.12, 0x555555);
  b.box(0.1, 0.04, 0.1, 0.55, 1.12, 0.12, 0x333333);
  let minX = -0.75;
  if (wagon) {
    const hay = 0xe8c45c, band = 0xc9a23e;
    b.box(0.3, 0.05, 0.06, -0.85, 0.3, 0, 0x555555);
    b.box(1.25, 0.12, 0.74, -1.6, 0.42, 0, 0x9c6b3c);
    for (const s of [-1, 1]) {
      b.box(0.32, 0.32, 0.12, -1.6, 0.16, s * 0.36, dark);
      b.box(1.25, 0.14, 0.04, -1.6, 0.54, s * 0.36, 0x8a5a33);
    }
    for (const x of [-1.3, -1.9]) {
      b.box(0.55, 0.4, 0.6, x, 0.68, 0, hay);
      b.box(0.04, 0.42, 0.62, x, 0.68, 0, band);
    }
    b.box(0.55, 0.36, 0.6, -1.6, 1.06, 0, hay);
    b.box(0.04, 0.38, 0.62, -1.6, 1.06, 0, band);
    minX = -2.22;
  }
  const g = b.geometry();
  g.translate(-(minX + 0.95) / 2, 0, 0);
  return g;
}

function buildCow() {
  const b = new VB();
  const W = 0xfafafa, K = 0x222222, PINK = 0xffb3c6;
  b.box(0.95, 0.5, 0.56, 0, 0.62, 0, W);
  b.box(0.3, 0.24, 0.02, -0.15, 0.66, 0.285, K);
  b.box(0.2, 0.18, 0.02, 0.25, 0.56, 0.285, K);
  b.box(0.24, 0.2, 0.02, 0.2, 0.6, -0.285, K);
  b.box(0.26, 0.18, 0.02, -0.22, 0.62, -0.285, K);
  b.box(0.3, 0.02, 0.25, 0.05, 0.875, 0.05, K);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    b.box(0.13, 0.38, 0.13, sx * 0.33, 0.19, sz * 0.19, W);
    b.box(0.14, 0.06, 0.14, sx * 0.33, 0.03, sz * 0.19, 0x444444);
  }
  b.box(0.18, 0.08, 0.18, -0.2, 0.34, 0, PINK);
  b.box(0.36, 0.36, 0.36, 0.6, 0.86, 0, W);
  b.box(0.1, 0.18, 0.3, 0.82, 0.78, 0, PINK);
  b.box(0.12, 0.12, 0.12, 0.54, 0.6, 0, 0xffcf3a); // bell
  for (const s of [-1, 1]) {
    b.box(0.02, 0.04, 0.04, 0.875, 0.8, s * 0.07, 0x9b4a5e);
    b.box(0.04, 0.06, 0.06, 0.785, 0.95, s * 0.12, K);
    b.box(0.06, 0.12, 0.06, 0.58, 1.08, s * 0.13, 0xfff1cc);
    b.box(0.06, 0.08, 0.16, 0.56, 0.97, s * 0.25, W);
  }
  b.box(0.04, 0.3, 0.04, -0.49, 0.62, 0, W);
  b.box(0.07, 0.08, 0.07, -0.49, 0.45, 0, K);
  const g = b.geometry();
  g.translate(-0.12, 0, 0);
  return g;
}

function buildBull() {
  const b = new VB();
  const B = 0x4a2a1c, HORN = 0xfff1d6;
  b.box(1.0, 0.56, 0.6, 0, 0.64, 0, B);
  b.box(0.5, 0.14, 0.5, 0.15, 0.97, 0, shade(B, 1.15));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    b.box(0.15, 0.38, 0.15, sx * 0.34, 0.19, sz * 0.2, B);
    b.box(0.16, 0.06, 0.16, sx * 0.34, 0.03, sz * 0.2, 0x111111);
  }
  b.box(0.4, 0.38, 0.4, 0.64, 0.78, 0, B);
  b.box(0.1, 0.2, 0.32, 0.87, 0.72, 0, 0xc9a07a);
  b.box(0.03, 0.1, 0.14, 0.925, 0.6, 0, 0xffd23f);
  for (const s of [-1, 1]) {
    b.box(0.08, 0.08, 0.22, 0.62, 0.98, s * 0.27, HORN);
    b.box(0.07, 0.18, 0.07, 0.62, 1.08, s * 0.38, HORN);
    b.box(0.04, 0.06, 0.07, 0.83, 0.88, s * 0.13, 0xff2020);
  }
  b.box(0.04, 0.3, 0.04, -0.52, 0.66, 0, B);
  const g = b.geometry();
  g.translate(-0.1, 0, 0);
  return g;
}

function buildLog(len) {
  const b = new VB();
  b.box(len, 0.3, 0.66, 0, 0, 0, 0x8a5a33);
  b.box(len - 0.1, 0.02, 0.36, 0, 0.155, 0.02, 0x9c6a3e);
  for (const s of [-1, 1]) {
    b.box(0.04, 0.26, 0.6, s * len / 2, 0, 0, 0xd9b27c);
    b.box(0.045, 0.1, 0.22, s * len / 2, 0, 0, 0xb88a52);
  }
  b.box(0.12, 0.12, 0.12, len * 0.2, 0.08, 0.36, 0x7a4c2a);
  return b.geometry();
}

// A mother goose leading three goslings, all one mover.
function buildGeese() {
  const b = new VB();
  const goose = (x, s, body, bill) => {
    b.box(0.42 * s, 0.3 * s, 0.3 * s, x, 0.26 * s, 0, body);
    b.box(0.14 * s, 0.1 * s, 0.26 * s, x - 0.22 * s, 0.33 * s, 0, body);   // tail
    b.box(0.1 * s, 0.34 * s, 0.1 * s, x + 0.17 * s, 0.52 * s, 0, body);    // neck
    b.box(0.18 * s, 0.14 * s, 0.13 * s, x + 0.2 * s, 0.7 * s, 0, body);    // head
    b.box(0.12 * s, 0.05 * s, 0.07 * s, x + 0.33 * s, 0.68 * s, 0, bill);
    for (const z of [-1, 1]) {
      b.box(0.03 * s, 0.03 * s, 0.02 * s, x + 0.25 * s, 0.73 * s, z * 0.066 * s, 0x111111);
      b.box(0.05 * s, 0.12 * s, 0.05 * s, x, 0.06 * s, z * 0.08 * s, 0xff9a2e);
      b.box(0.3 * s, 0.14 * s, 0.03 * s, x - 0.02 * s, 0.3 * s, z * 0.16 * s, shade(body, 0.85)); // wings
    }
  };
  goose(0.75, 1.15, 0xffffff, 0xff9a2e);
  goose(0.05, 0.62, 0xffe46b, 0xff9a2e);
  goose(-0.4, 0.62, 0xffe46b, 0xff9a2e);
  goose(-0.85, 0.62, 0xffe46b, 0xff9a2e);
  return b.geometry();
}

function buildCombine() {
  const b = new VB();
  const R = 0x2f9a3a, Y = 0xffd23f, dark = 0x2a2a2a;
  b.box(1.5, 0.75, 0.82, -0.25, 0.7, 0, R);               // body
  b.box(0.6, 0.12, 0.84, -0.25, 1.1, 0, Y);               // stripe
  b.box(0.52, 0.5, 0.6, 0.25, 1.32, 0, 0xbfe9ff);         // cab glass
  b.box(0.6, 0.07, 0.68, 0.25, 1.6, 0, 0xffffff);
  b.box(0.42, 0.42, 0.42, -0.65, 1.28, 0, R);             // grain tank
  b.box(0.9, 0.12, 0.12, -0.75, 1.55, 0.3, Y, 0, 0, 0.35); // unloading auger
  for (const s of [-1, 1]) {
    b.box(0.66, 0.66, 0.2, 0.15, 0.33, s * 0.44, dark);
    b.box(0.28, 0.28, 0.04, 0.15, 0.33, s * 0.55, Y);
    b.box(0.4, 0.4, 0.16, -0.75, 0.2, s * 0.4, dark);
  }
  b.box(0.12, 0.3, 1.9, 0.75, 0.32, 0, Y);                // header bar, wider than the lane
  b.box(0.32, 0.06, 1.9, 0.86, 0.12, 0, Y);
  for (let z = -0.85; z <= 0.86; z += 0.17) b.box(0.18, 0.04, 0.05, 1.06, 0.12, z, 0xb0b0b0); // teeth
  b.box(0.06, 0.4, 0.06, -0.2, 1.35, -0.25, 0x555555);    // exhaust
  const g = b.geometry();
  g.translate(-0.05, 0, 0);
  return g;
}
function buildReel() {
  const b = new VB();
  b.box(0.06, 0.06, 1.8, 0, 0, 0, 0xd63a2f);
  for (let i = 0; i < 4; i++) b.box(0.05, 0.42, 0.05, 0, 0, 0, 0xd63a2f, i * Math.PI / 4, 0, 0);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    b.box(0.05, 0.05, 1.8, 0, Math.sin(a) * 0.2, 0, 0xffd23f);
    b.box(0.05, 0.05, 1.8, Math.cos(a) * 0.2, 0, 0, 0xffd23f);
  }
  return b.geometry();
}

// Crop duster biplane: flies low along its lane, wings overhang the lanes either side.
function buildPlane() {
  const b = new VB();
  const Y = 0xffcf2a, R = 0xe2412f;
  b.box(1.3, 0.3, 0.32, 0, 0.75, 0, Y);                   // fuselage
  b.box(0.3, 0.26, 0.3, 0.6, 0.75, 0, R);                 // cowling
  b.box(0.42, 0.06, 2.1, 0.2, 0.62, 0, Y);                // lower wing
  b.box(0.42, 0.06, 2.1, 0.25, 1.08, 0, R);               // upper wing
  for (const s of [-1, 1]) {
    b.box(0.04, 0.42, 0.04, 0.25, 0.85, s * 0.85, 0x8a5a33);
    b.box(0.12, 0.12, 0.08, 0.3, 0.28, s * 0.22, 0x2a2a2a); // wheels
    b.box(0.04, 0.3, 0.04, 0.3, 0.45, s * 0.18, 0x555555);
  }
  b.box(0.32, 0.08, 0.7, -0.55, 0.82, 0, R);              // tail plane
  b.box(0.3, 0.32, 0.06, -0.58, 0.98, 0, R);              // fin
  b.box(0.22, 0.16, 0.24, 0.05, 0.96, 0, 0x6b4a8a);       // pilot (goggles)
  b.box(0.06, 0.06, 0.26, 0.15, 0.99, 0, 0x111111);
  b.box(0.5, 0.06, 0.2, -0.1, 0.56, 0, 0xbfbfbf);         // spray boom
  return b.geometry();
}
function buildProp() {
  const b = new VB();
  b.box(0.04, 0.6, 0.08, 0, 0, 0, 0x333333);
  b.box(0.05, 0.1, 0.1, 0, 0, 0, 0xcccccc);
  return b.geometry();
}

const KAYAKS = [0xff4b4b, 0xffcf2a, 0x46a6ff, 0xff8fc8];
function buildKayak(len, col) {
  const b = new VB();
  b.box(len, 0.22, 0.5, 0, 0, 0, col);
  for (const s of [-1, 1]) b.box(0.3, 0.16, 0.3, s * (len / 2 + 0.12), -0.02, 0, col); // pointed ends
  b.box(len - 0.3, 0.03, 0.34, 0, 0.115, 0, shade(col, 1.15));
  for (let i = 0; i < len - 1; i++) {                     // cockpits
    const x = -(len - 2) / 2 + i;
    b.box(0.5, 0.04, 0.32, x, 0.125, 0, 0x4a3a66);
  }
  b.box(0.06, 0.04, 0.9, 0.15, 0.16, 0, 0x8a5a33, 0, 0.5, 0); // paddle across the deck
  for (const s of [-1, 1]) b.box(0.14, 0.03, 0.2, 0.15 + s * 0.22, 0.16, s * 0.4, 0xffffff, 0, 0.5, 0);
  return b.geometry();
}

const GEO = {};
const LEN = { cow: 1.35, bull: 1.45, log2: 2, log3: 3, log4: 4, geese: 2.2, combine: 2.6, plane: 1.6 };
const TRACTORS = [[0xd63a2f, 0xffd23f], [0x3aa340, 0xffd23f], [0x3b7be0, 0xffffff], [0xff8a2a, 0x333333]];
TRACTORS.forEach((_, i) => { LEN['tractor' + i] = 1.7; LEN['wagon' + i] = 3.15; });
KAYAKS.forEach((_, i) => { LEN['kayak2_' + i] = 2.2; LEN['kayak3_' + i] = 3.2; });
function geo(kind) {
  if (GEO[kind]) return GEO[kind];
  let g;
  if (kind.startsWith('tractor')) { const [c, h] = TRACTORS[+kind.slice(7)]; g = buildTractor(c, h, false); }
  else if (kind.startsWith('wagon')) { const [c, h] = TRACTORS[+kind.slice(5)]; g = buildTractor(c, h, true); }
  else if (kind.startsWith('kayak')) g = buildKayak(+kind[5], KAYAKS[+kind.slice(7)]);
  else if (kind === 'cow') g = buildCow();
  else if (kind === 'bull') g = buildBull();
  else if (kind === 'geese') g = buildGeese();
  else if (kind === 'combine') g = buildCombine();
  else if (kind === 'plane') g = buildPlane();
  else if (kind === 'reel') g = buildReel();
  else if (kind === 'prop') g = buildProp();
  else g = buildLog(LEN[kind]);
  return (GEO[kind] = g);
}
// Spinning parts attached to some movers: [geometry kind, x, y, axis]
const SPINNERS = { combine: ['reel', 0.9, 0.5, 'z'], plane: ['prop', 0.77, 0.75, 'x'] };

// Sunflowers are the collectible. Built standing on the ground at the origin.
const FLOWER_GEO = (() => {
  const b = new VB();
  b.box(0.06, 0.5, 0.06, 0, 0.25, 0, 0x3f8f2f);
  b.box(0.18, 0.04, 0.1, 0.1, 0.22, 0, 0x4faa38, 0, 0, 0.4);
  b.box(0.18, 0.04, 0.1, -0.1, 0.32, 0, 0x4faa38, 0, 0, -0.4);
  b.box(0.42, 0.42, 0.06, 0, 0.66, 0.02, 0xffcc1a);
  b.box(0.42, 0.42, 0.06, 0, 0.66, 0.02, 0xffb000, 0, 0, Math.PI / 4);
  b.box(0.2, 0.2, 0.1, 0, 0.66, 0.04, 0x7a4a1c);
  b.box(0.08, 0.08, 0.02, -0.03, 0.69, 0.095, 0x5a3412);
  return b.geometry();
})();
const FLOWER_MAT = toon({ vertexColors: true, emissive: 0x3a2400 });

function buildHawk() {
  const group = new THREE.Group();
  const b = new VB();
  const BR = 0x7a4a2a, DK = 0x5a3520, Y = 0xffc21a;
  b.box(0.7, 0.5, 1.1, 0, 0, 0, BR);
  b.box(0.5, 0.2, 0.8, 0, -0.25, 0, 0xe8d3b0);
  b.box(0.5, 0.45, 0.45, 0, 0.15, -0.7, 0xffffff);
  b.box(0.18, 0.16, 0.25, 0, 0.1, -1.0, Y);
  b.box(0.12, 0.1, 0.1, 0, 0.0, -1.1, Y);
  for (const s of [-1, 1]) {
    b.box(0.02, 0.1, 0.1, s * 0.255, 0.22, -0.78, 0x111111);
    b.box(0.03, 0.04, 0.16, s * 0.26, 0.29, -0.78, DK);
    b.box(0.1, 0.28, 0.1, s * 0.15, -0.42, -0.1, Y);
  }
  b.box(0.5, 0.1, 0.55, 0, 0.05, 0.78, DK);
  group.add(b.mesh());
  const wings = [];
  for (const s of [-1, 1]) {
    const wv = new VB();
    wv.box(1.3, 0.08, 0.72, s * 0.65, 0, 0, BR);
    wv.box(0.45, 0.07, 0.6, s * 1.5, 0, 0.05, DK);
    const m = wv.mesh();
    m.position.set(s * 0.35, 0.15, 0);
    group.add(m);
    wings.push(m);
  }
  group.scale.setScalar(1.35);
  return { group, wings };
}

// ---------- audio (tiny synth, no files) ----------
const sfx = (() => {
  let ctx = null, master = null, noiseBuf = null;
  let muted = store.get('bl-mute', false);
  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.55;
      master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
  }
  function tone(f0, f1, dur, type = 'square', vol = 0.15, delay = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, type, freq, delay = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf;
    f.type = type;
    f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(master);
    s.start(t);
    s.stop(t + dur);
  }
  return {
    ensure,
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      store.set('bl-mute', muted);
      if (master) master.gain.value = muted ? 0 : 0.55;
      return muted;
    },
    hop() { tone(440, 760, 0.07, 'square', 0.06); },
    bump() { tone(220, 150, 0.07, 'square', 0.07); },
    coin() { tone(988, null, 0.08, 'square', 0.07); tone(1319, null, 0.2, 'square', 0.07, 0.08); },
    squash() { noise(0.3, 0.5, 'lowpass', 700); tone(180, 60, 0.3, 'sawtooth', 0.12); },
    splash() { noise(0.55, 0.45, 'bandpass', 1400); tone(600, 180, 0.25, 'sine', 0.1); },
    moo() { tone(150, 105, 0.7, 'sawtooth', 0.07); tone(152, 108, 0.7, 'triangle', 0.12); },
    ding() { tone(1500, null, 0.14, 'triangle', 0.12); },
    snort() { noise(0.35, 0.35, 'bandpass', 500); tone(90, 60, 0.3, 'sawtooth', 0.1); },
    screech() { tone(2300, 1200, 0.55, 'sawtooth', 0.05); tone(2000, 1400, 0.45, 'square', 0.03, 0.05); },
    launch() { tone(300, 1200, 0.4, 'square', 0.07); },
    honk() { tone(420, 330, 0.18, 'sawtooth', 0.09); tone(430, 340, 0.2, 'sawtooth', 0.09, 0.2); },
    buzz() { tone(110, 120, 0.45, 'sawtooth', 0.025); },
    chomp() { noise(0.4, 0.4, 'bandpass', 900); tone(140, 70, 0.35, 'square', 0.08); },
  };
})();

// ---------- particles ----------
const PGEO = new THREE.BoxGeometry(1, 1, 1);
const pmats = {};
const pmat = c => (pmats[c] ||= toon({ color: c }));
const parts = [];
function burst(x, y, z, colors, n, spd = 3, up = 4, size = 0.12, life = 0.7) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(PGEO, pmat(pick(colors)));
    const s = size * rand(0.7, 1.3);
    m.scale.setScalar(s);
    m.position.set(x, y, z);
    scene.add(m);
    parts.push({ m, s, vx: rand(-1, 1) * spd, vy: rand(0.4, 1) * up, vz: rand(-1, 1) * spd, life, max: life });
  }
}
function updateParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.vy -= 14 * dt;
    p.m.position.x += p.vx * dt;
    p.m.position.y += p.vy * dt;
    p.m.position.z += p.vz * dt;
    p.life -= dt;
    p.m.scale.setScalar(p.s * Math.max(0, p.life / p.max));
    if (p.life <= 0) { scene.remove(p.m); parts.splice(i, 1); }
  }
}

// ---------- lanes ----------
const lanes = new Map();
let genRow = 0, queue = [];

function strip(vb, top, color, dark) {
  const inner = 2 * COLS + 1, outer = VIS - COLS;
  vb.box(inner, 1, 1, 0, top - 0.5, 0, color);
  for (const s of [-1, 1]) vb.box(outer, 1, 1, s * (COLS + 0.5 + outer / 2), top - 0.5, 0, dark);
}
const LANE_Y = { grass: 0, forest: 0, road: -0.02, pasture: 0, bull: 0, wheat: 0, crops: 0, water: 0.05, pads: -0.15 };

function tree(vb, x) {
  const h = pick([0.5, 0.8, 1.1, 1.4]), g = pick(GREENS);
  vb.box(0.28, 0.3, 0.28, x, 0.15, 0, 0x8a5a33);
  vb.box(0.8, h, 0.8, x, 0.3 + h / 2, 0, g);
  if (Math.random() < 0.22) {
    for (let i = 0; i < 3; i++) {
      vb.box(0.1, 0.1, 0.04, x + rand(-0.28, 0.28), 0.3 + rand(0.12, h - 0.08), 0.41, 0xff3b3b);
      vb.box(0.04, 0.1, 0.1, x + 0.41, 0.3 + rand(0.12, h - 0.08), rand(-0.28, 0.28), 0xff3b3b);
    }
  }
}
function bush(vb, x) {
  vb.box(0.72, 0.42, 0.62, x, 0.21, 0, 0x4fae3f);
  vb.box(0.46, 0.2, 0.4, x - 0.05, 0.52, 0, 0x5cbf48);
}
function hay(vb, x) {
  vb.box(0.76, 0.55, 0.6, x, 0.275, 0, 0xe8c45c);
  for (const s of [-1, 1]) vb.box(0.78, 0.57, 0.06, x, 0.275, s * 0.17, 0xc9a23e);
  vb.box(0.5, 0.04, 0.4, x, 0.565, 0, 0xf2d37a);
}
function rock(vb, x) {
  vb.box(0.62, 0.32, 0.55, x, 0.16, 0, 0x9aa0a6);
  vb.box(0.36, 0.16, 0.32, x - 0.06, 0.4, 0.02, 0xb4babf);
}
function pumpkin(vb, x) {
  vb.box(0.56, 0.42, 0.56, x, 0.21, 0, 0xf08a24);
  vb.box(0.58, 0.36, 0.1, x, 0.21, 0, 0xd8741a);
  vb.box(0.08, 0.16, 0.08, x, 0.5, 0, 0x4c7a2a);
  vb.box(0.16, 0.03, 0.1, x + 0.1, 0.5, 0, 0x5fa83a);
}
function flowers(vb, x) {
  for (let i = 0; i < ri(1, 3); i++) {
    const fx = x + rand(-0.35, 0.35), fz = rand(-0.35, 0.35);
    vb.box(0.04, 0.12, 0.04, fx, 0.06, fz, 0x3f8f2f);
    vb.box(0.15, 0.07, 0.15, fx, 0.15, fz, pick([0xff6fae, 0xffd93b, 0xffffff, 0xb48cff]));
  }
}
function blocker(vb, x, outer) {
  const k = Math.random();
  if (outer) return k < 0.85 ? tree(vb, x) : bush(vb, x);
  if (k < 0.5) tree(vb, x);
  else if (k < 0.65) hay(vb, x);
  else if (k < 0.77) rock(vb, x);
  else if (k < 0.89) pumpkin(vb, x);
  else bush(vb, x);
}

// Which playable columns of this grass lane can Betty Lou actually stand in
// and get onward from, given how she could have arrived from the lane before?
function reachOf(blocked, prev) {
  const free = c => Math.abs(c) <= COLS && !blocked.has(c);
  const stack = [];
  for (let c = -COLS; c <= COLS; c++) {
    if (!free(c)) continue;
    if (prev && prev.type === 'grass' && !prev.reach.has(c)) continue;
    if (prev && prev.type === 'pads' && !prev.padCols.has(c)) continue;
    stack.push(c);
  }
  const reach = new Set();
  while (stack.length) {
    const c = stack.pop();
    if (reach.has(c)) continue;
    reach.add(c);
    for (const n of [c - 1, c + 1]) if (free(n) && !reach.has(n)) stack.push(n);
  }
  return reach;
}

function addSunflower(lane, c) {
  const m = new THREE.Mesh(FLOWER_GEO, FLOWER_MAT);
  m.position.set(c, LANE_Y[lane.type], 0);
  m.castShadow = true;
  lane.group.add(m);
  lane.coins.push({ c, m });
}

function addMovers(lane, kindFn, gapMin, gapMax, y = 0) {
  let x = -SPAN / 2 + rand(gapMin, gapMax);
  for (;;) {
    const kind = kindFn(), len = LEN[kind];
    if (x + len > SPAN / 2) break;
    lane.movers.push(spawnMover(lane, kind, x + len / 2, y));
    x += len + rand(gapMin, gapMax);
  }
  const shift = rand(0, SPAN);
  for (const m of lane.movers) { m.x += shift; wrap(m); m.mesh.position.x = m.x; }
}
function spawnMover(lane, kind, x, y = 0) {
  const mesh = new THREE.Mesh(geo(kind), VMAT);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.set(x, y, 0);
  if (lane.dir < 0) mesh.rotation.y = Math.PI;
  let spin = null;
  if (SPINNERS[kind]) {
    const [part, px, py, axis] = SPINNERS[kind];
    spin = new THREE.Mesh(geo(part), VMAT);
    spin.position.set(px, py, 0);
    spin.castShadow = true;
    spin.userData.axis = axis;
    mesh.add(spin);
  }
  lane.group.add(mesh);
  return { kind, len: LEN[kind], x, y, mesh, spin, active: true, bob: 0, phase: rand(0, 6), buzz: 0 };
}
function wrap(m) {
  const half = SPAN / 2;
  while (m.x - m.len / 2 > half) m.x -= SPAN;
  while (m.x + m.len / 2 < -half) m.x += SPAN;
}

function nextType(r, prev) {
  if (!queue.length) {
    const d = diff(r), last = prev.type;
    let t;
    if (last !== 'grass' && Math.random() < 0.45) t = 'grass';
    else {
      const w = [['grass', 0.2], ['road', 0.24 + 0.05 * d], ['pasture', 0.16], ['water', 0.2], ['bull', 0.08 + 0.05 * d],
        ['wheat', 0.1], ['crops', r > 15 ? 0.07 + 0.05 * d : 0]];
      let k = Math.random() * w.reduce((s, x) => s + x[1], 0);
      t = w.find(x => (k -= x[1]) < 0)[0];
      if (t === last && t !== 'grass') t = 'grass';
    }
    if (t === 'grass') queue = Array(ri(1, 3)).fill('grass');
    else if (t === 'road') queue = Array(ri(1, 2 + Math.round(2 * d))).fill('road');
    else if (t === 'pasture') queue = Array(ri(1, 2)).fill('pasture');
    else if (t === 'bull') queue = Array(ri(1, d > 0.4 ? 2 : 1)).fill('bull');
    else if (t === 'wheat') queue = Array(ri(1, 2)).fill('wheat');
    else if (t === 'crops') queue = ['crops'];
    else if (last === 'grass' && Math.random() < 0.3) queue = ['pads', 'grass'];
    else queue = Array(ri(1, 2 + Math.round(d))).fill('water');
  }
  return queue.shift();
}

function addLane(r) {
  const prev = lanes.get(r - 1) || null;
  const type = r < 0 ? 'forest' : r < 5 ? 'grass' : nextType(r, prev);
  const lane = {
    r, type, movers: [], blocked: new Set(), reach: new Set(), coins: [],
    dir: Math.random() < 0.5 ? 1 : -1, speed: 0, group: new THREE.Group(),
  };
  lane.group.position.z = -r;
  const vb = new VB();
  const d = diff(r);

  if (type === 'forest' || type === 'grass') {
    const c = Math.abs(r) % 2 === 0 ? 0xaee667 : 0xa2dc5c;
    strip(vb, 0, c, shade(c, 0.74));
    for (let x = -VIS; x <= VIS; x++) {
      if (Math.abs(x) <= COLS) continue;
      if (type === 'forest' || Math.random() < 0.7) blocker(vb, x, true);
      else if (Math.random() < 0.4) flowers(vb, x);
    }
    if (type === 'forest') {
      for (let x = -COLS; x <= COLS; x++) { blocker(vb, x, true); lane.blocked.add(x); }
    } else {
      const forced = new Set(prev && prev.type === 'pads' ? prev.padCols : []);
      if (r === 0) forced.add(0);
      let blocked = new Set(), reach = new Set();
      for (let attempt = 0; attempt < 14 && !reach.size; attempt++) {
        blocked = new Set();
        const n = r < 3 ? ri(0, 2) : ri(1, 3 + Math.round(d * 1.5));
        for (let k = 0; k < n; k++) {
          const x = ri(-COLS, COLS);
          if (forced.has(x) || (r < 3 && Math.abs(x) < 2)) continue;
          blocked.add(x);
        }
        reach = reachOf(blocked, prev);
      }
      if (!reach.size) { blocked = new Set(); reach = reachOf(blocked, prev); }
      lane.blocked = blocked;
      lane.reach = reach;
      for (let x = -COLS; x <= COLS; x++) {
        if (blocked.has(x)) blocker(vb, x, false);
        else if (Math.random() < 0.18) flowers(vb, x);
      }
      if (r > 3 && Math.random() < 0.16 && reach.size) addSunflower(lane, pick([...reach]));
    }
  } else if (type === 'road') {
    strip(vb, -0.02, 0x5f5c66, shade(0x5f5c66, 0.72));
    if (prev && prev.type === 'road') {
      for (let x = -VIS; x <= VIS; x += 2) {
        vb.box(0.7, 0.02, 0.08, x, -0.01, 0.5, Math.abs(x) <= COLS ? 0xf4f4f4 : 0xa8a8a8);
      }
    }
    lane.speed = rand(1.5, 2.9) * (1 + 0.7 * d);
    const color = ri(0, TRACTORS.length - 1);
    addMovers(lane, () => (Math.random() < 0.25 ? 'wagon' : 'tractor') + (Math.random() < 0.5 ? color : ri(0, TRACTORS.length - 1)), 3, 7.5 - 2 * d);
    if (Math.random() < 0.1) addSunflower(lane, ri(-COLS, COLS));
  } else if (type === 'pasture') {
    strip(vb, 0, 0xcfa66b, shade(0xcfa66b, 0.72));
    for (let i = 0; i < 14; i++) {
      const x = rand(-VIS, VIS);
      vb.box(0.14, 0.01, 0.1, x, 0.005, rand(-0.35, 0.35), Math.abs(x) <= COLS + 0.5 ? 0xb58e58 : 0x8a6c43);
    }
    const k = Math.random();
    if (d > 0.2 && k < 0.3) {
      lane.speed = rand(5, 6.5) * (1 + 0.3 * d);
      addMovers(lane, () => 'bull', 9, 15);
    } else if (k < 0.62) {
      lane.speed = rand(1.1, 1.7) * (1 + 0.4 * d);
      addMovers(lane, () => 'geese', 2.8, 6);
    } else {
      lane.speed = rand(0.6, 1.15) * (1 + 0.4 * d);
      addMovers(lane, () => 'cow', 2.4, 5.5);
    }
  } else if (type === 'bull') {
    strip(vb, 0, 0xb86b45, shade(0xb86b45, 0.72));
    for (const z of [-0.28, 0.28]) {
      vb.box(2 * COLS + 1, 0.012, 0.07, 0, 0.006, z, 0x9a5434);
      for (const s of [-1, 1]) vb.box(VIS - COLS, 0.012, 0.07, s * (COLS + 0.5 + (VIS - COLS) / 2), 0.006, z, 0x6e3c25);
    }
    lane.lightMat = toon({ color: 0x661111, emissive: 0x000000 });
    for (const s of [-1, 1]) {
      const x = s * (COLS + 0.85);
      vb.box(0.1, 1.15, 0.1, x, 0.575, 0.44, 0xdddddd);
      vb.box(0.44, 0.3, 0.04, x, 1.2, 0.44, 0xffd23f);
      vb.box(0.46, 0.32, 0.03, x, 1.2, 0.425, 0x222222);
      vb.box(0.05, 0.13, 0.02, x, 1.23, 0.465, 0x222222);
      vb.box(0.05, 0.05, 0.02, x, 1.12, 0.465, 0x222222);
      const light = new THREE.Mesh(PGEO, lane.lightMat);
      light.scale.set(0.2, 0.2, 0.08);
      light.position.set(x, 0.82, 0.5);
      lane.group.add(light);
    }
    lane.speed = 19 + 5 * d;
    for (let i = 0; i < 3; i++) {
      const m = spawnMover(lane, 'bull', 999);
      m.active = false;
      m.mesh.visible = false;
      lane.movers.push(m);
    }
    lane.stamp = { state: 'wait', t: rand(1.5, 4), ding: 0 };
  } else if (type === 'wheat') {
    strip(vb, 0, 0xe9c46a, shade(0xe9c46a, 0.74));
    for (let x = -VIS; x <= VIS; x++) {                   // stubble tufts, purely decoration
      for (let i = 0; i < 2; i++) {
        const tx = x + rand(-0.4, 0.4), tz = rand(-0.38, 0.38);
        vb.box(0.05, rand(0.08, 0.16), 0.05, tx, 0.06, tz, Math.abs(tx) <= COLS + 0.5 ? 0xd4a83f : 0xa88430);
      }
    }
    lane.speed = rand(0.9, 1.5) * (1 + 0.5 * d);
    addMovers(lane, () => 'combine', 5, 9 - 2 * d);
    if (Math.random() < 0.12) addSunflower(lane, ri(-COLS, COLS));
  } else if (type === 'crops') {
    strip(vb, 0, 0x8a5e3c, shade(0x8a5e3c, 0.72));
    for (const z of [-0.3, 0.3]) {
      vb.box(2 * VIS + 1, 0.03, 0.18, 0, 0.015, z, 0x6e4a2e);  // furrows
      for (let x = -VIS; x <= VIS; x++) {
        const out = Math.abs(x) > COLS;
        vb.box(0.26, 0.18, 0.2, x + 0.25, 0.09, z, out ? 0x3f8a33 : 0x5cbf48);  // cabbages
        vb.box(0.16, 0.06, 0.12, x + 0.25, 0.2, z, out ? 0x56a845 : 0x8fe070);
      }
    }
    lane.speed = rand(6.5, 8.5) * (1 + 0.25 * d);
    addMovers(lane, () => 'plane', 14, 24);
  } else if (type === 'water' || type === 'pads') {
    strip(vb, -0.22, 0x56c3ee, shade(0x56c3ee, 0.74));
    if (type === 'water') {
      if (prev && prev.type === 'water') lane.dir = -prev.dir;
      if (Math.random() < 0.35) {
        // a flotilla of kayaks: quicker than logs, and shorter
        lane.speed = rand(1.4, 2.3) * (1 + 0.4 * d);
        const col = ri(0, KAYAKS.length - 1);
        addMovers(lane, () => 'kayak' + (Math.random() < 0.6 ? 2 : 3) + '_' + (Math.random() < 0.5 ? col : ri(0, KAYAKS.length - 1)), 1.3, 2.4 + d, -0.1);
      } else {
        lane.speed = rand(0.9, 1.9) * (1 + 0.45 * d);
        const lens = d > 0.5 ? ['log2', 'log2', 'log3'] : ['log2', 'log3', 'log3', 'log4'];
        addMovers(lane, () => pick(lens), 1.2, 2.4 + d, -0.1);
      }
    } else {
      const cands = [...prev.reach];
      lane.padCols = new Set();
      const want = Math.min(cands.length, ri(2, 4));
      while (lane.padCols.size < want) lane.padCols.add(pick(cands));
      for (const x of lane.padCols) {
        vb.box(0.74, 0.05, 0.74, x, -0.18, 0, 0x3fae49);
        vb.box(0.2, 0.06, 0.12, x + 0.2, -0.18, 0.28, 0x56c3ee);
        if (Math.random() < 0.5) vb.box(0.16, 0.1, 0.16, x - 0.15, -0.11, -0.15, 0xff8fc8);
      }
    }
  }

  lane.static = vb.mesh();
  lane.group.add(lane.static);
  scene.add(lane.group);
  lanes.set(r, lane);
}

function removeLane(lane) {
  scene.remove(lane.group);
  lane.static.geometry.dispose();
  if (lane.lightMat) {
    lane.lightMat.dispose();
    toons.splice(toons.indexOf(lane.lightMat), 1);
  }
  lanes.delete(lane.r);
}

function updateLane(lane, dt, time) {
  if (lane.type === 'bull') return updateStampede(lane, dt);
  for (const m of lane.movers) {
    m.x += lane.dir * lane.speed * dt;
    wrap(m);
    m.mesh.position.x = m.x;
    if (m.spin) m.spin.rotation[m.spin.userData.axis] += dt * (m.kind === 'plane' ? 40 : -5);
    if (m.kind === 'cow' || m.kind === 'bull') {
      m.mesh.position.y = Math.abs(Math.sin(time * lane.speed * 5 + m.phase)) * 0.05;
    } else if (m.kind === 'geese') {
      m.mesh.rotation.x = Math.sin(time * 14 + m.phase) * 0.08;   // waddle
      m.mesh.position.y = Math.abs(Math.sin(time * 14 + m.phase)) * 0.03;
    } else if (m.kind === 'plane') {
      m.mesh.position.y = Math.sin(time * 3 + m.phase) * 0.05;
      if (Math.abs(m.x) < VIS && Math.random() < dt * 25) {
        burst(m.x - lane.dir * 0.4, 0.5, -lane.r + rand(-0.5, 0.5), [0xf3f0d0, 0xdff5c8], 1, 0.4, 0.3, 0.18, 0.9);
      }
      m.buzz -= dt;
      if (m.buzz <= 0 && game.state === 'play' && Math.abs(lane.r - P.r) < 4 && Math.abs(m.x - P.x) < 9) {
        m.buzz = 0.45;
        sfx.buzz();
      }
    } else if (lane.type === 'water') {
      m.bob = Math.max(0, m.bob - dt * 0.6);
      m.mesh.position.y = m.y - Math.sin(m.bob * 40) * m.bob * 0.6 + Math.sin(time * 2 + m.phase) * 0.012;
    } else {
      m.mesh.position.y = Math.sin(time * 40 + m.phase) * 0.008;
    }
  }
}

function updateStampede(lane, dt) {
  const s = lane.stamp;
  s.t -= dt;
  if (s.state === 'wait') {
    if (s.t <= 0) { s.state = 'warn'; s.t = 1.5; s.ding = 0; }
  } else if (s.state === 'warn') {
    lane.lightMat.emissive.setHex(Math.floor(s.t * 7) % 2 ? 0xff2020 : 0x000000);
    s.ding -= dt;
    if (s.ding <= 0) {
      s.ding = 0.38;
      if (Math.abs(lane.r - P.r) < 8 && game.state === 'play') sfx.ding();
    }
    if (s.t <= 0) {
      s.state = 'charge';
      lane.lightMat.emissive.setHex(0xff2020);
      const n = ri(1, diff(lane.r) > 0.3 ? 3 : 2);
      lane.movers.forEach((m, i) => {
        m.active = i < n;
        m.mesh.visible = m.active;
        m.x = -lane.dir * (VIS + 2 + i * 1.9);
        m.mesh.position.x = m.x;
      });
      if (Math.abs(lane.r - P.r) < 8) sfx.snort();
    }
  } else {
    let any = false;
    for (const m of lane.movers) {
      if (!m.active) continue;
      m.x += lane.dir * lane.speed * dt;
      m.mesh.position.x = m.x;
      m.mesh.position.y = Math.abs(Math.sin(m.x * 2)) * 0.08;
      if (lane.dir * m.x > VIS + 3) { m.active = false; m.mesh.visible = false; }
      else {
        any = true;
        if (Math.random() < dt * 30 && Math.abs(m.x) < VIS) {
          burst(m.x - lane.dir * 0.7, 0.1, -lane.r + rand(-0.3, 0.3), [0xc89a6a, 0xa87a4a], 1, 0.6, 2.5, 0.14, 0.5);
        }
      }
    }
    if (!any) {
      s.state = 'wait';
      s.t = rand(2.5, 6);
      lane.lightMat.emissive.setHex(0x000000);
    }
  }
}

// ---------- player ----------
const P = {};
const game = { state: 'title', score: 0, top: store.get('bl-top', 0), coins: store.get('bl-coins', 0), camX: 0, camZ: 0, time: 0 };
let hawk = null;

function resetPlayer() {
  if (P.model) scene.remove(P.model.group);
  Object.assign(P, {
    x: 0, z: 0, y: 0, r: 0, hop: null, queue: null, log: null, alive: true,
    face: Math.PI + 0.36, faceTarget: Math.PI + 0.36, held: false, sy: 1,
    tailAng: 0, tailVel: 0, death: null, deathT: 0, vx: 0, vy: 0, vz: 0,
    model: buildGirl(),
  });
  scene.add(P.model.group);
}

function laneAt(r) { return lanes.get(r); }

function move(dx, dr) {
  if (game.state === 'title') startGame();
  if (game.state !== 'play' || !P.alive) return;
  if (P.hop) { P.queue = [dx, dr]; return; }
  P.faceTarget = dr > 0 ? 0 : dr < 0 ? Math.PI : dx < 0 ? Math.PI / 2 : -Math.PI / 2;
  const tr = P.r + dr;
  const lane = laneAt(tr);
  if (!lane) return;
  const land = lane.type !== 'water';
  let tx = P.x + dx;
  if (land) tx = Math.round(tx);
  const blocked = Math.abs(tx) > COLS + (land ? 0 : 0.49) || ((lane.type === 'grass' || lane.type === 'forest') && lane.blocked.has(tx));
  if (blocked) {
    P.hop = { fx: P.x, fz: P.z, fy: P.y, tx: P.x, tz: P.z, ty: P.y, t: 0, fromR: P.r, toR: P.r, h: 0.15, bump: true };
    sfx.bump();
    return;
  }
  P.hop = { fx: P.x, fz: P.z, fy: P.y, tx, tz: -tr, ty: LANE_Y[lane.type], t: 0, fromR: P.r, toR: tr, h: 0.42 };
  P.log = null;
  P.tailVel += 9;
  sfx.hop();
}

function land() {
  const h = P.hop;
  P.hop = null;
  P.x = h.tx; P.z = h.tz; P.y = h.ty; P.r = h.toR;
  if (h.bump) { if (P.queue) { const q = P.queue; P.queue = null; move(...q); } return; }
  const lane = laneAt(P.r);
  if (lane.type === 'water') {
    const m = lane.movers.find(m => Math.abs(m.x - P.x) < m.len / 2 + 0.12);
    if (!m) return die('splash');
    const left = m.x - m.len / 2;
    const off = clamp(Math.floor(P.x - left) + 0.5, 0.5, m.len - 0.5);
    P.x = left + off;
    P.log = m;
    m.bob = 0.12;
  } else if (lane.type === 'pads' && !lane.padCols.has(P.x)) {
    return die('splash');
  }
  const coin = lane.coins.find(c => c.c === P.x);
  if (coin) {
    lane.group.remove(coin.m);
    lane.coins.splice(lane.coins.indexOf(coin), 1);
    game.coins++;
    store.set('bl-coins', game.coins);
    sfx.coin();
    burst(P.x, 0.6, P.z, [0xffd23f, 0xffe680, 0xffffff], 10, 1.5, 4, 0.08, 0.5);
    hud();
  }
  if (P.r > game.score) { game.score = P.r; hud(); }
  if (P.queue) { const q = P.queue; P.queue = null; move(...q); }
}

const DEATH_MSG = {
  squash: 'Flattened by a tractor!',
  bonk: 'Bonked by a cow!',
  launch: 'Launched by a bull!',
  splash: "Splash! Betty Lou can't swim!",
  swept: 'Swept down the creek!',
  hawk: 'Snatched by a hawk!',
  goose: 'Chased off by geese!',
  harvest: 'Baled up by a combine!',
  dusted: 'Buzzed by a crop duster!',
};
// Which death each moving thing causes, and which animation each death uses.
const HIT_BY = { bull: 'launch', cow: 'bonk', geese: 'goose', combine: 'harvest', plane: 'dusted' };
const FLAT = new Set(['squash', 'harvest']), KNOCK = new Set(['bonk', 'goose']), FLY = new Set(['launch', 'dusted']);

function die(kind, mover, lane) {
  if (!P.alive) return;
  P.alive = false;
  P.death = kind;
  P.deathT = 0;
  P.hop = null;
  P.queue = null;
  P.log = null;
  game.state = 'dead';
  const { inner } = P.model;
  if (FLAT.has(kind)) {
    P.y = LANE_Y[lane.type];
    inner.scale.set(1.35, 0.12, 1.35);
    if (kind === 'harvest') {
      sfx.chomp();
      burst(P.x, 0.3, P.z, [0xe9c46a, 0xf2d37a, 0xc9a23e, ...RAINBOW], 22, 2.5, 5, 0.1, 0.8);
    } else {
      sfx.squash();
      burst(P.x, 0.2, P.z, [0xff8fc8, 0x3e6fd8, ...RAINBOW], 14, 2.5, 3, 0.1, 0.6);
    }
  } else if (KNOCK.has(kind)) {
    P.y = 0;
    P.vx = lane.dir;
    if (kind === 'goose') {
      sfx.honk();
      burst(P.x, 0.6, P.z, [0xffffff, 0xf2f2f2, 0xffe46b], 14, 1.5, 3, 0.09, 1.0);
    } else {
      sfx.moo();
      burst(P.x, 1.1, P.z, [0xffd93b, 0xffffff], 8, 1.2, 3, 0.1, 0.8);
    }
  } else if (FLY.has(kind)) {
    if (kind === 'dusted') {
      P.vx = lane.dir * 5; P.vy = 7; P.vz = rand(-1, 1);
      sfx.launch();
      burst(P.x, 0.7, P.z, [0xf3f0d0, 0xdff5c8, 0xffffff], 18, 2, 2, 0.2, 1.0);
    } else {
      P.vx = lane.dir * 7; P.vy = 11; P.vz = rand(-1.5, 1.5);
      sfx.launch();
      burst(P.x, 0.3, P.z, [0xc89a6a, 0xa87a4a], 12, 2, 3, 0.15, 0.7);
    }
  } else if (kind === 'splash' || kind === 'swept') {
    sfx.splash();
    burst(P.x, 0, P.z, [0xffffff, 0xbfe9ff, 0x56c3ee], 18, 1.8, 5, 0.12, 0.7);
  } else if (kind === 'hawk') {
    sfx.screech();
    hawk = buildHawk();
    hawk.group.rotation.y = Math.PI;
    hawk.t = 0;
    scene.add(hawk.group);
  }
  if (game.score > game.top) { game.top = game.score; store.set('bl-top', game.top); game.record = true; }
  setTimeout(gameOver, kind === 'hawk' ? 1500 : 1100);
}

function updatePlayer(dt) {
  const { group, inner, tails } = P.model;

  if (P.alive) {
    if (P.hop) {
      const h = P.hop;
      h.t += dt / HOP_T;
      const t = Math.min(1, h.t);
      P.x = lerp(h.fx, h.tx, t);
      P.z = lerp(h.fz, h.tz, t);
      P.y = lerp(h.fy, h.ty, t) + Math.sin(Math.PI * t) * h.h;
      if (h.t >= 1) land();
    } else if (P.log) {
      const lane = laneAt(P.r);
      P.x += lane.dir * lane.speed * dt;
      P.y = LANE_Y.water + P.log.mesh.position.y - P.log.y;
      if (Math.abs(P.x) > COLS + 1.1) die('swept');
    }
  }

  // collisions with traffic
  if (P.alive && game.state === 'play') {
    const row = P.hop ? (P.hop.t > 0.5 ? P.hop.toR : P.hop.fromR) : P.r;
    const lane = laneAt(row);
    if (lane && (lane.movers.length && lane.type !== 'water')) {
      for (const m of lane.movers) {
        if (!m.active) continue;
        if (Math.abs(m.x - P.x) < m.len / 2 + 0.2) {
          if (P.hop) { P.x = Math.round(P.hop.t > 0.5 ? P.hop.tx : P.hop.fx); P.z = -row; }
          P.r = row;
          die(HIT_BY[m.kind] || 'squash', m, lane);
          break;
        }
      }
    }
    if (P.alive && P.z - game.camZ > HAWK_DIST) die('hawk');
  }

  // death animations
  if (!P.alive) {
    P.deathT += dt;
    const t = P.deathT;
    if (FLY.has(P.death)) {
      P.vy -= 22 * dt;
      P.x += P.vx * dt; P.y += P.vy * dt; P.z += P.vz * dt;
      inner.rotation.x += 13 * dt;
      inner.rotation.z += 7 * dt;
    } else if (KNOCK.has(P.death)) {
      inner.rotation.z = lerp(inner.rotation.z, -P.vx * Math.PI / 2, Math.min(1, dt * 14));
      if (t < 0.35) P.x += P.vx * 2.5 * dt;
    } else if (P.death === 'splash' || P.death === 'swept') {
      P.y = lerp(P.y, -1.3, Math.min(1, dt * 4));
    } else if (P.death === 'hawk' && hawk) {
      hawk.t += dt;
      const ht = hawk.t;
      if (ht < 0.55) {
        const k = ht / 0.55, e = 1 - (1 - k) * (1 - k);
        hawk.group.position.set(P.x, lerp(4, 1.6, e), P.z + lerp(-16, 0, e));
      } else {
        const k = (ht - 0.55) / 0.9;
        hawk.group.position.set(P.x, 1.6 + k * 4, P.z + k * 18);
        P.y = hawk.group.position.y - 1.25;
        group.position.z = hawk.group.position.z;
      }
      const flap = Math.sin(ht * 22) * 0.7;
      hawk.wings[0].rotation.z = -flap;
      hawk.wings[1].rotation.z = flap;
    }
  }

  // squash & stretch, facing, pigtail bounce
  const syT = !P.alive && FLAT.has(P.death) ? 0.12 : P.held && P.alive ? 0.78 : P.hop && !P.hop.bump ? 1.12 : 1;
  if (!FLAT.has(P.death)) {
    P.sy = lerp(P.sy, syT, Math.min(1, dt * 25));
    inner.scale.set(1 + (1 - P.sy) * 0.5, P.sy, 1 + (1 - P.sy) * 0.5);
  }
  let da = P.faceTarget - P.face;
  da = Math.atan2(Math.sin(da), Math.cos(da));
  P.face += da * Math.min(1, dt * 20);
  P.tailVel += (-70 * P.tailAng - 7 * P.tailVel) * dt;
  P.tailAng += P.tailVel * dt;
  const idle = Math.sin(game.time * 3) * 0.04;
  for (const t of tails) t.rotation.z = t.userData.side * (P.tailAng * 0.12 + idle);

  group.position.set(P.x, P.y, P.z);
  group.rotation.y = P.face;
}

// ---------- camera ----------
function resize() {
  const w = window.innerWidth, h = window.innerHeight, a = w / h;
  renderer.setSize(w, h, false);
  resizeCel();
  let halfW, halfH;
  if (a < 1) { halfW = 4.7; halfH = halfW / a; }
  else { halfH = 6.2; halfW = Math.min(halfH * a, 11); halfH = halfW / a; }
  Object.assign(camera, { left: -halfW, right: halfW, top: halfH, bottom: -halfH });
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

const _t = new THREE.Vector3();
function updateCamera(dt) {
  if (game.state === 'play') game.camZ -= (0.34 + 0.3 * diff(P.r)) * dt;
  const desired = P.z - 3;
  if (P.alive && desired < game.camZ) game.camZ += (desired - game.camZ) * Math.min(1, dt * 5);
  if (P.alive) game.camX += (clamp(P.x, -2.5, 2.5) * 0.6 - game.camX) * Math.min(1, dt * 3);
  _t.set(game.camX, 0, game.camZ);
  camera.position.copy(_t).add(CAM_OFF);
  camera.lookAt(_t);
  sun.position.copy(_t).add(SUN_OFF);
  sun.target.position.copy(_t);
}

function ensureLanes() {
  const camRow = Math.round(-game.camZ);
  while (genRow <= camRow + AHEAD) addLane(genRow++);
  for (const lane of [...lanes.values()]) if (lane.r < camRow - BEHIND) removeLane(lane);
}

// ---------- flow ----------
const $ = id => document.getElementById(id);
function hud() {
  $('score').textContent = game.score;
  $('top').textContent = 'TOP ' + game.top;
  $('coinN').textContent = game.coins;
}

function newWorld() {
  for (const lane of [...lanes.values()]) removeLane(lane);
  for (const p of parts) scene.remove(p.m);
  parts.length = 0;
  if (hawk) { scene.remove(hawk.group); hawk = null; }
  queue = [];
  genRow = -BEHIND - 3;
  game.score = 0;
  game.record = false;
  game.camX = 0;
  game.camZ = -3;
  resetPlayer();
  ensureLanes();
  hud();
}

function startGame() {
  game.state = 'play';
  document.body.classList.remove('title', 'show-logo');
}

function gameOver() {
  game.state = 'over';
  document.body.classList.add('over');
  $('overMsg').textContent = DEATH_MSG[P.death] || 'Oh no!';
  const over = $('over');
  over.classList.toggle('record', !!game.record);
  over.classList.add('show');
  hud();
}

function restart() {
  $('over').classList.remove('show');
  document.body.classList.remove('over');
  document.body.classList.add('title');
  game.state = 'title';
  newWorld();
}

// ---------- input: tap = hop forward, swipe = direction ----------
let press = null;
window.addEventListener('pointerdown', e => {
  if (e.target.closest('button')) return;
  sfx.ensure();
  press = { x: e.clientX, y: e.clientY, id: e.pointerId };
  if (game.state === 'title' || game.state === 'play') P.held = true;
});
window.addEventListener('pointerup', e => {
  if (!press || e.pointerId !== press.id) return;
  const dx = e.clientX - press.x, dy = e.clientY - press.y;
  press = null;
  P.held = false;
  if (game.state !== 'title' && game.state !== 'play') return;
  if (Math.hypot(dx, dy) < 24) move(0, 1);
  else if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1, 0);
  else move(0, dy < 0 ? 1 : -1);
});
window.addEventListener('pointercancel', () => { press = null; P.held = false; });
document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('contextmenu', e => e.preventDefault());

const KEYS = {
  ArrowUp: [0, 1], KeyW: [0, 1], ArrowDown: [0, -1], KeyS: [0, -1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0],
};
window.addEventListener('keydown', e => {
  sfx.ensure();
  if (game.state === 'over' && (e.code === 'Space' || e.code === 'Enter')) { restart(); return; }
  if (e.code === 'Space' && !e.repeat) { move(0, 1); e.preventDefault(); return; }
  const k = KEYS[e.code];
  if (k && !e.repeat) { move(...k); e.preventDefault(); }
});

$('play').addEventListener('click', () => { sfx.ensure(); restart(); });
// Look: ?look=bold in the URL wins, otherwise the last one picked on this device.
let lookName = new URLSearchParams(location.search).get('look') || store.get('bl-look', 'cel');
if (!LOOKS[lookName]) lookName = 'cel';
applyLook(lookName);
const lookBtn = $('look');
lookBtn.classList.toggle('bold', lookName === 'bold');
lookBtn.addEventListener('click', () => {
  lookName = lookName === 'bold' ? 'cel' : 'bold';
  store.set('bl-look', lookName);
  applyLook(lookName);
  lookBtn.classList.toggle('bold', lookName === 'bold');
});
const soundBtn = $('sound');
soundBtn.classList.toggle('muted', sfx.muted);
soundBtn.addEventListener('click', () => { sfx.ensure(); soundBtn.classList.toggle('muted', sfx.toggle()); });

// ---------- main loop ----------
let last = performance.now();
function step(dt) {
  game.time += dt;
  for (const lane of lanes.values()) {
    updateLane(lane, dt, game.time);
    for (const c of lane.coins) {
      c.m.rotation.y = Math.sin(game.time * 1.6 + c.c) * 0.7;
      c.m.position.y = LANE_Y[lane.type] + Math.abs(Math.sin(game.time * 3 + c.c)) * 0.06;
    }
  }
  updatePlayer(dt);
  updateCamera(dt);
  ensureLanes();
  updateParts(dt);
  renderCel();
}
function frame(now) {
  step(Math.min(0.05, (now - last) / 1000));
  last = now;
  requestAnimationFrame(frame);
}

resize();
newWorld();
document.body.classList.add('title', 'show-logo');
requestAnimationFrame(frame);
if (new URLSearchParams(location.search).has('debug')) window.__hop = { P, game, lanes, move, step };
