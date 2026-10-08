import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { BODIES, MOONS, KIRKWOOD, STR } from './data.js';

// ══════════════════════════════════════════════════════════════
//  CONSTANTES
// ══════════════════════════════════════════════════════════════
const AU_PER_KM = 1 / 149597870.7;
const J2000 = 2451545.0;
const DEG = Math.PI / 180;
// modo cómodo (s=1,d=1): radios ∝ r^0.555 anclados a Tierra=0.09 ua-escena;
// distancias ∝ 2.05·r^0.55+0.5 (Neptuno→14, Mercurio→1.7). s=0,d=0 = 1:1 real.
const SIZE_G_TRUE = AU_PER_KM, SIZE_G_COMF = 0.000698, SIZE_P_COMF = 0.555;
const DIST_A_COMF = 2.05, DIST_K_COMF = 0.55, DIST_B_COMF = 0.5;

let lang = (navigator.language || 'es').toLowerCase().startsWith('es') ? 'es' : 'en';
let T = STR[lang];

const scale = { s: 1, d: 1 };   // 0 = real 1:1 · 1 = cómodo
const sizeScale = (rKm) => {
  const G = Math.pow(SIZE_G_TRUE, 1 - scale.s) * Math.pow(SIZE_G_COMF, scale.s);
  const p = 1 - (1 - SIZE_P_COMF) * scale.s;
  return G * Math.pow(rKm, p);
};
const distA = () => 1 + (DIST_A_COMF - 1) * scale.d;
const distK = () => 1 - (1 - DIST_K_COMF) * scale.d;
const distB = () => DIST_B_COMF * scale.d;
const sceneR = (rAU) => distA() * Math.pow(rAU, distK()) + distB();
const radCompress = (rAU) => rAU < 1e-9 ? 1 : sceneR(rAU) / rAU;

// ══════════════════════════════════════════════════════════════
//  KEPLER (elementos J2000 + tasas/siglo, JPL)
// ══════════════════════════════════════════════════════════════
function elementsAt(el, Tc) {
  return { a: el[0] + el[6] * Tc, e: el[1] + el[7] * Tc, i: (el[2] + el[8] * Tc) * DEG,
           L: (el[3] + el[9] * Tc) * DEG, w: (el[4] + el[10] * Tc) * DEG, O: (el[5] + el[11] * Tc) * DEG };
}
function solveE(M, e) {
  let E = M + e * Math.sin(M);
  for (let k = 0; k < 8; k++) { const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E)); E -= dE; if (Math.abs(dE) < 1e-12) break; }
  return E;
}
function keplerXYZ(el, jd, out) {
  const { a, e, i, L, w, O } = elementsAt(el, (jd - J2000) / 36525);
  let M = (L - w) % (2 * Math.PI); if (M > Math.PI) M -= 2 * Math.PI; if (M < -Math.PI) M += 2 * Math.PI;
  const E = solveE(M, e);
  const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const om = w - O, co = Math.cos(om), so = Math.sin(om), cO = Math.cos(O), sO = Math.sin(O), ci = Math.cos(i), si = Math.sin(i);
  const X = (co * cO - so * sO * ci) * xp + (-so * cO - co * sO * ci) * yp;
  const Y = (co * sO + so * cO * ci) * xp + (-so * sO + co * cO * ci) * yp;
  const Z = (so * si) * xp + (co * si) * yp;
  out = out || new THREE.Vector3();
  return out.set(X, Z, -Y);   // eclíptica → escena (plano orbital = XZ, norte = +Y)
}
function bodyScenePos(body, jd) {
  const v = keplerXYZ(body.el, jd);
  return v.multiplyScalar(radCompress(v.length()));
}

// ══════════════════════════════════════════════════════════════
//  FECHA
// ══════════════════════════════════════════════════════════════
function jdToDate(jd) {
  const z = Math.floor(jd + 0.5), f = jd + 0.5 - z;
  const al = Math.floor((z - 1867216.25) / 36524.25), a = z + 1 + al - Math.floor(al / 4);
  const b = a + 1524, c = Math.floor((b - 122.1) / 365.25), dd = Math.floor(365.25 * c), ee = Math.floor((b - dd) / 30.6001);
  const day = b - dd - Math.floor(30.6001 * ee) + f;
  const mon = ee < 14 ? ee - 1 : ee - 13;
  return { y: mon > 2 ? c - 4716 : c - 4715, m: mon, d: Math.floor(day) };
}
const MON = { es:['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'],
              en:['January','February','March','April','May','June','July','August','September','October','November','December'] };
const fmtDate = (jd) => { const t = jdToDate(jd); return `${t.d} ${MON[lang][t.m - 1]} ${t.y}`; };

// ══════════════════════════════════════════════════════════════
//  RENDERER
// ══════════════════════════════════════════════════════════════
let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); }
catch (e) { document.getElementById('nowebgl').style.display = 'flex'; throw e; }
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 1e-5, 6000);
// near dinámico: el rango real/escena es enorme → near/far se recalcula cada frame
camera.position.set(0, 9, 21);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.055;
controls.minDistance = 1e-4; controls.maxDistance = 2500;
controls.zoomSpeed = 0.85; controls.rotateSpeed = 0.6;
scene.add(new THREE.AmbientLight(0x2a3a55, 0.5));

// ══════════════════════════════════════════════════════════════
//  TEXTURAS
// ══════════════════════════════════════════════════════════════
const manager = new THREE.LoadingManager();
const loader = new THREE.TextureLoader(manager);
const texCache = {};
function tex(url, srgb = true) {
  if (texCache[url]) return texCache[url];
  const t = loader.load(url);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  t.wrapS = THREE.RepeatWrapping;
  return (texCache[url] = t);
}
function radialSprite(stops) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  stops.forEach(([o, col]) => grd.addColorStop(o, col));
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const glowTex = radialSprite([[0,'rgba(255,236,190,1)'],[0.18,'rgba(255,196,110,0.75)'],[0.45,'rgba(255,140,60,0.20)'],[1,'rgba(255,120,40,0)']]);
const dotTex  = radialSprite([[0,'rgba(255,255,255,1)'],[0.4,'rgba(255,244,214,0.55)'],[1,'rgba(255,240,200,0)']]);

// ══════════════════════════════════════════════════════════════
//  FONDO ESTELAR (va con la cámara: cielo infinito)
// ══════════════════════════════════════════════════════════════
const skyGroup = new THREE.Group(); scene.add(skyGroup);
skyGroup.add(new THREE.Mesh(new THREE.SphereGeometry(1600, 48, 24),
  new THREE.MeshBasicMaterial({ map: tex('textures/stars_bg.jpg'), side: THREE.BackSide, depthWrite: false })));

function makeStarField(count, rMin, rMax, sMin, sMax, tint) {
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), sz = new Float32Array(count);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    const r = rMin + Math.pow(Math.random(), 0.5) * (rMax - rMin);
    pos[i*3] = r*s*Math.cos(th); pos[i*3+1] = r*u; pos[i*3+2] = r*s*Math.sin(th);
    c.setHSL(tint + (Math.random()-0.5)*0.14, 0.45*Math.random(), 0.62 + 0.3*Math.random());
    col[i*3]=c.r; col[i*3+1]=c.g; col[i*3+2]=c.b;
    sz[i] = sMin + Math.pow(Math.random(), 3) * (sMax - sMin);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { uTex: { value: dotTex } }, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, vertexColors: true,
    vertexShader: `attribute float aSize; varying vec3 vC;
      void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0);
        gl_PointSize = min(aSize * (260.0 / -mv.z), 2.6); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D uTex; varying vec3 vC;
      void main(){ gl_FragColor = vec4(vC,1.0) * texture2D(uTex, gl_PointCoord); }`,
  });
  return new THREE.Points(g, m);
}
skyGroup.add(makeStarField(9000, 900, 1500, 0.7, 5.5, 0.09));
skyGroup.add(makeStarField(2600, 1200, 1550, 1.2, 9.0, 0.58));

// ══════════════════════════════════════════════════════════════
//  CUERPOS
// ══════════════════════════════════════════════════════════════
const pickMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
const registry = [];
const byKey = {};
const unitSphere = new THREE.SphereGeometry(1, 96, 48);

function atmosphere(R, color, strength) {
  const m = new THREE.ShaderMaterial({
    uniforms: { uC: { value: new THREE.Color(color) }, uS: { value: strength } },
    transparent: true, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
    vertexShader: `varying vec3 vN; varying vec3 vP;
      void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vP = mv.xyz;
        gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uC; uniform float uS; varying vec3 vN; varying vec3 vP;
      void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(-vP))), 2.6);
        gl_FragColor = vec4(uC, f*uS); }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1.06, 48, 24), m);
  mesh.userData.isAtmo = true; mesh.scale.setScalar(R); return mesh;
}
function ringGeo(inner, outer) {
  const geo = new THREE.RingGeometry(inner, outer, 256, 1);
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) { const r = Math.hypot(p.getX(i), p.getY(i)); uv.setXY(i, (r - inner) / (outer - inner), 0.5); }
  return geo;
}

// el Sol se encoge solo en modo cómodo (en 1:1 conserva su radio verdadero)
const starK = () => 0.45 + 0.55 * (1 - scale.s);
// radio orbital máximo de cada planeta según su luna más lejana (evita invadir vecinos)
const MOON_SPAN = {};
MOONS.forEach(m => { MOON_SPAN[m.parent] = Math.max(MOON_SPAN[m.parent] || 0, m.aKm * AU_PER_KM); });

function buildBody(def, parentRec) {
  const group = new THREE.Group();
  const R = def.kind === 'star' ? sizeScale(def.rKm) * starK() : sizeScale(def.rKm);
  let mat;
  if (def.kind === 'star') mat = new THREE.MeshBasicMaterial({ map: tex(def.tex) });
  else if (def.plain || !def.tex) mat = new THREE.MeshStandardMaterial({ color: def.tint ?? def.color ?? 0xffffff, roughness: 0.95 });
  else {
    mat = new THREE.MeshStandardMaterial({ map: tex(def.tex), roughness: 1, metalness: 0 });
    if (def.extra?.bump) { mat.bumpMap = tex(def.extra.bump, false); mat.bumpScale = 0.05; }
    if (def.extra?.spec) { mat.roughnessMap = tex(def.extra.spec, false); }
    if (def.extra?.night) { mat.emissiveMap = tex(def.extra.night); mat.emissive = new THREE.Color(0xffd9a0); mat.emissiveIntensity = 0.5; }
  }
  const mesh = new THREE.Mesh(unitSphere, mat);
  mesh.scale.setScalar(R); mesh.rotation.z = -(def.tilt || 0) * DEG;
  group.add(mesh);

  const extras = [];
  if (def.key === 'earth') {
    const cl = new THREE.Mesh(unitSphere, new THREE.MeshBasicMaterial({ map: tex(def.extra.clouds), transparent: true,
      opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
    cl.rotation.z = mesh.rotation.z; group.add(cl); extras.push({ o: cl, k: 1.014 }); def._clouds = cl;
    const at = atmosphere(R, 0x5b9bd5, 0.9); group.add(at); extras.push({ o: at, k: 1 });
  }
  const atmoDef = { venus:[0xe8c98a,0.7], mars:[0xc98a6a,0.3], titan:[0xd59a4a,0.8], uranus:[0x8fd6dd,0.45], neptune:[0x4f7fd6,0.5] };
  if (atmoDef[def.key]) { const at = atmosphere(R, atmoDef[def.key][0], atmoDef[def.key][1]); group.add(at); extras.push({ o: at, k: 1 }); }
  let ringMesh = null;
  if (def.ring) {
    ringMesh = new THREE.Mesh(ringGeo(R * def.ring.inner, R * def.ring.outer),
      new THREE.MeshBasicMaterial({ map: tex(def.ring.tex), transparent: true, side: THREE.DoubleSide,
        opacity: def.ring.op ?? 1, depthWrite: false }));
    ringMesh.rotation.x = Math.PI / 2; ringMesh.rotation.y = 0;
    const holder = new THREE.Group(); holder.rotation.z = -(def.tilt || 0) * DEG; holder.add(ringMesh);
    group.add(holder); def._ringHolder = holder;
  }
  let glow1 = null, glow2 = null;
  if (def.kind === 'star') {
    group.add(new THREE.PointLight(0xfff2dc, 3.0, 0, 0));
    glow1 = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffd9a0, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false }));
    glow1.scale.setScalar(R * 4.2); group.add(glow1);
    glow2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffb060, transparent: true,
      opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow2.scale.setScalar(R * 12); group.add(glow2);
  }
  const pick = new THREE.Mesh(unitSphere, pickMat); pick.scale.setScalar(Math.max(R, 0.02)); group.add(pick);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, transparent: true, opacity: 0,
    color: def.kind === 'moon' ? 0xbfd0e0 : 0xffe9c0, blending: THREE.AdditiveBlending, depthWrite: false }));
  group.add(halo);

  const label = document.createElement('div');
  label.className = 'label' + (def.kind === 'moon' ? ' moon' : '');
  label.textContent = T.names[def.key] || def.key;
  document.getElementById('labels').appendChild(label);

  const rec = { def, group, mesh, pick, halo, label, R, extras, ringMesh, glow1, glow2, moons: [], parentRec };
  group.userData.rec = rec;
  if (parentRec) { parentRec.group.add(group); parentRec.moons.push(rec); }
  else scene.add(group);
  registry.push(rec); byKey[def.key] = rec;
  return rec;
}

// ══════════════════════════════════════════════════════════════
//  CINTURONES (vertex shader kepleriano)
// ══════════════════════════════════════════════════════════════
const BELT_VS = `
attribute float aA; attribute float aE; attribute float aInc; attribute float aN; attribute float aPh;
attribute vec3 aCol; attribute float aSize;
uniform float uT; uniform float uA; uniform float uK; uniform float uB;
varying vec3 vC; varying float vA;
void main(){
  float n = 1.0 / sqrt(aA*aA*aA);
  float M = aPh + uT * n;
  M = mod(M + 3.14159265, 6.2831853) - 3.14159265;
  float E = M + aE * sin(M);
  for (int i = 0; i < 4; i++){ E = E - (E - aE*sin(E) - M) / (1.0 - aE*cos(E)); }
  float xp = aA * (cos(E) - aE);
  float yp = aA * sqrt(1.0 - aE*aE) * sin(E);
  vec3 p = vec3(xp, 0.0, -yp);
  float r = length(p);
  float ci = cos(aInc), si = sin(aInc), cn = cos(aN), sn = sin(aN);
  vec3 q = vec3(p.x, p.y*ci - p.z*si, p.y*si + p.z*ci);
  q = vec3(q.x*cn - q.z*sn, q.y, q.x*sn + q.z*cn);
  q *= (uA * pow(r, uK) + uB) / max(r, 1e-6);
  vC = aCol;
  vec4 mv = modelViewMatrix * vec4(q, 1.0);
  vA = clamp(1.0 - (-mv.z) / 1400.0, 0.12, 1.0);
  gl_PointSize = min(aSize * (60.0 / -mv.z), 3.0);
  gl_Position = projectionMatrix * mv;
}`;
const BELT_FS = `uniform sampler2D uTex; varying vec3 vC; varying float vA;
void main(){ gl_FragColor = vec4(vC, vA) * texture2D(uTex, gl_PointCoord); }`;

function makeBelt(count, aSampler, eMax, incMax, tint, sMin, sMax) {
  const P = (k) => new Float32Array(count * k);
  const a = P(1), e = P(1), inc = P(1), n = P(1), ph = P(1), col = P(3), sz = P(1);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    a[i] = aSampler(); e[i] = Math.pow(Math.random(), 1.7) * eMax;
    inc[i] = (Math.random()*2-1) * incMax; n[i] = Math.random()*Math.PI*2; ph[i] = Math.random()*Math.PI*2;
    c.setHSL(tint + (Math.random()-0.5)*0.10, 0.30+Math.random()*0.30, 0.42+Math.random()*0.40);
    col[i*3]=c.r; col[i*3+1]=c.g; col[i*3+2]=c.b;
    sz[i] = sMin + Math.pow(Math.random(), 2.5) * (sMax - sMin);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count*3), 3));
  g.setAttribute('aA', new THREE.BufferAttribute(a,1)); g.setAttribute('aE', new THREE.BufferAttribute(e,1));
  g.setAttribute('aInc', new THREE.BufferAttribute(inc,1)); g.setAttribute('aN', new THREE.BufferAttribute(n,1));
  g.setAttribute('aPh', new THREE.BufferAttribute(ph,1)); g.setAttribute('aCol', new THREE.BufferAttribute(col,3));
  g.setAttribute('aSize', new THREE.BufferAttribute(sz,1));
  const m = new THREE.ShaderMaterial({ uniforms: { uT:{value:0}, uA:{value:1}, uK:{value:1}, uB:{value:0}, uTex:{value:dotTex} },
    vertexShader: BELT_VS, fragmentShader: BELT_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; return pts;
}
const sampleKirkwood = () => {
  const allowed = []; let prev = 2.06;
  for (const [g0, g1] of KIRKWOOD) { if (g0 > prev) allowed.push([prev, g0]); prev = Math.max(prev, g1); }
  allowed.push([prev, 3.27]);
  const tot = allowed.reduce((s, [x, y]) => s + (y - x), 0);
  let r = Math.random() * tot;
  for (const [x, y] of allowed) { if (r < y - x) return x + r; r -= (y - x); }
  return 2.7;
};
const belt = makeBelt(7000, sampleKirkwood, 0.20, 0.20, 0.075, 0.35, 1.3);
const kuiper = makeBelt(11000, () => 38 + Math.pow(Math.random(), 0.75) * 22, 0.16, 0.52, 0.58, 0.3, 1.1);
scene.add(belt); scene.add(kuiper);

// ══════════════════════════════════════════════════════════════
//  ÓRBITAS
// ══════════════════════════════════════════════════════════════
const orbitGroup = new THREE.Group(); scene.add(orbitGroup);
const ORBIT_COLORS = { mercury:0x9c8f7a, venus:0xd9b877, earth:0x6fa8dc, mars:0xc96a4b, jupiter:0xd8b98a,
  saturn:0xdcc48a, uranus:0x8fd6dd, neptune:0x5f86d6, pluto:0xb9a08a, ceres:0x8f8f8f, haumea:0xb0a894,
  quaoar:0x9a6a52, makemake:0xa8704a, eris:0xc0c0c0 };
function orbitLine(def, color) {
  const N = 720, pos = new Float32Array(N * 3), v = new THREE.Vector3();
  const el = elementsAt(def.el, (simTime - J2000) / 36525);
  for (let i = 0; i < N; i++) {
    const M = (i / N) * 2 * Math.PI, E = solveE(M, el.e);
    const xp = el.a * (Math.cos(E) - el.e), yp = el.a * Math.sqrt(1 - el.e * el.e) * Math.sin(E);
    const om = el.w - el.O, co = Math.cos(om), so = Math.sin(om), cO = Math.cos(el.O), sO = Math.sin(el.O), ci = Math.cos(el.i), si = Math.sin(el.i);
    const X = (co*cO - so*sO*ci)*xp + (-so*cO - co*sO*ci)*yp;
    const Y = (co*sO + so*cO*ci)*xp + (-so*sO + co*cO*ci)*yp;
    const Z = (so*si)*xp + (co*si)*yp;
    v.set(X, Z, -Y); v.multiplyScalar(radCompress(v.length()));
    pos[i*3]=v.x; pos[i*3+1]=v.y; pos[i*3+2]=v.z;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.LineLoop(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.34, depthWrite: false }));
}

// ══════════════════════════════════════════════════════════════
//  CONSTRUCCIÓN
// ══════════════════════════════════════════════════════════════
let simTime = J2000 + (Date.now() / 86400000 - 10957.5);
let rate = 7;   // 1 s = 1 semana: el movimiento es perceptible desde el primer segundo
BODIES.forEach(d => { const rec = buildBody(d, null);
  if (d.el) { rec.orbit = orbitLine(d, ORBIT_COLORS[d.key] ?? 0x888888); orbitGroup.add(rec.orbit); } });
MOONS.forEach(m => {
  m.kind = 'moon';
  const par = byKey[m.parent];
  const rec = buildBody(m, par);
  rec.moonDef = m; rec.parentRec = par;
  const pivot = new THREE.Group();
  par.group.add(pivot); pivot.add(rec.group);
  rec.pivot = pivot;
  const N = 192, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { const th = (i / N) * Math.PI * 2; pos[i*3]=Math.cos(th); pos[i*3+1]=0; pos[i*3+2]=-Math.sin(th); }
  const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  rec.orbit = new THREE.LineLoop(gg, new THREE.LineBasicMaterial({ color: 0x8899aa, transparent: true, opacity: 0.22, depthWrite: false }));
  pivot.add(rec.orbit);
});

// ══════════════════════════════════════════════════════════════
//  ESCALA
// ══════════════════════════════════════════════════════════════
function rebuildScale() {
  registry.forEach(rec => {
    const d = rec.def;
    const R = d.kind === 'star' ? sizeScale(d.rKm) * starK() : sizeScale(d.rKm);
    rec.R = R; rec.mesh.scale.setScalar(R); rec.pick.scale.setScalar(Math.max(R, 0.02));
    rec.extras.forEach(x => x.o.scale.setScalar(R * x.k));
    if (d._ringHolder) { const rm = d._ringHolder.children[0];
      rm.geometry.dispose(); rm.geometry = ringGeo(R * d.ring.inner, R * d.ring.outer); }
    if (rec.glow1) rec.glow1.scale.setScalar(R * 4.2);
    if (rec.glow2) rec.glow2.scale.setScalar(R * 12);
  });
  MOONS.forEach(m => {
    const rec = byKey[m.key]; if (!rec) return;
    rec.mesh.scale.setScalar(rec.R); rec.pick.scale.setScalar(Math.max(rec.R, 0.008));
    const par = rec.parentRec;
    const parR = par.R;
    // presupuesto de espacio: la órbita lunar no puede invadir al planeta vecino
    const parAU = par.def.el ? par.def.el[0] : 0;
    const nextAU = BODIES.filter(b => b.el && b.el[0] > parAU * 1.01).reduce((m2, b) => Math.min(m2, b.el[0]), parAU * 1.35 + 6);
    const gap = Math.max(parR * 2.4, (sceneR(nextAU) - sceneR(parAU)) * 0.32);
    const au = m.aKm * AU_PER_KM;
    const f = au / (MOON_SPAN[par.def.key] || au);           // órbita relativa dentro del hueco
    rec.moonOrbitR = Math.max(parR * 2.0 + f * gap, parR + rec.R * 1.8);
    rec.orbit.scale.setScalar(rec.moonOrbitR);
  });
  registry.forEach(rec => { if (rec.def.el) {
    if (rec.orbit) { orbitGroup.remove(rec.orbit); rec.orbit.geometry.dispose(); }
    rec.orbit = orbitLine(rec.def, ORBIT_COLORS[rec.def.key] ?? 0x888888); orbitGroup.add(rec.orbit); } });
  [belt, kuiper].forEach(b => { b.material.uniforms.uA.value = distA(); b.material.uniforms.uK.value = distK(); b.material.uniforms.uB.value = distB(); });
}

const _v = new THREE.Vector3();
function updateBodies() {
  registry.forEach(rec => {
    const d = rec.def;
    if (d.kind !== 'star' && d.el) rec.group.position.copy(bodyScenePos(d, simTime));
    const days = (simTime - J2000) * 365.25;
    if (d.rotH) rec.mesh.rotation.y = (days / (d.rotH / 24)) * Math.PI * 2;
    if (d._clouds) d._clouds.rotation.y = rec.mesh.rotation.y * 1.08;
  });
  MOONS.forEach(m => {
    const rec = byKey[m.key]; if (!rec || !rec.pivot) return;
    const inc = (m.inc || 0) * DEG, node = (m.node || 0) * DEG;
    const th = (simTime * 365.25 / m.per) * Math.PI * 2 + (m.phase || 0) * DEG;
    const dir = m.retro ? -1 : 1;
    _v.set(Math.cos(th * dir) * rec.moonOrbitR, 0, -Math.sin(th * dir) * rec.moonOrbitR);
    const ci = Math.cos(inc), si = Math.sin(inc);
    const y = _v.y * ci - _v.z * si, z = _v.y * si + _v.z * ci;
    const cn = Math.cos(node), sn = Math.sin(node);
    rec.group.position.set(_v.x * cn - z * sn, y, _v.x * sn + z * cn);
    rec.pivot.rotation.set(0, 0, m.ecliptic ? 0 : -(rec.parentRec.def.tilt || 0) * DEG);
    rec.mesh.rotation.y = m.rotH ? (simTime * 365.25 / (m.rotH / 24)) * Math.PI * 2 : th * dir;
  });
  const days = (simTime - J2000) * 365.25;
  belt.material.uniforms.uT.value = days;
  kuiper.material.uniforms.uT.value = days;
}

// ══════════════════════════════════════════════════════════════
//  CÁMARA · FOCUS · TOUR
// ══════════════════════════════════════════════════════════════
let focus = null, follow = false, fly = null, tour = null;
const worldOf = (rec) => rec.group.getWorldPosition(new THREE.Vector3());
const frameDist = (rec) => Math.max(rec.R * 5.2, 0.015);
function flyTo(rec, dur = 1.5) {
  const target = worldOf(rec), d = frameDist(rec);
  const dir = camera.position.clone().sub(controls.target);
  if (dir.lengthSq() < 1e-9) dir.set(0.4, 0.3, 1);
  dir.normalize();
  fly = { t: 0, dur, p0: camera.position.clone(), t0: controls.target.clone(),
          off: dir.multiplyScalar(d), d0: camera.position.distanceTo(controls.target), d1: d, rec };
  focus = rec; follow = true; showInfo(rec);
  $('i-follow').classList.add('on');
}
function overview() {
  follow = false; focus = null; hideInfo();
  const span = sceneR(30.07);
  fly = { t: 0, dur: 1.6, p0: camera.position.clone(), t0: controls.target.clone(),
          p1: new THREE.Vector3(0, span * 0.5, span * 1.2), t1: new THREE.Vector3(0, 0, 0), rec: null };
}

// ══════════════════════════════════════════════════════════════
//  UI
// ══════════════════════════════════════════════════════════════
const $ = (id) => document.getElementById(id);
const labelsHost = $('labels');
function applyI18n() {
  T = STR[lang];
  document.querySelectorAll('#speedpresets .btn').forEach(b => {
    const r = parseFloat(b.dataset.rate);
    b.textContent = r === 0 ? '⏸' : (T.speed[r] || b.textContent);
  });
  $('langalt').textContent = lang === 'es' ? 'EN' : 'ES';
  document.querySelectorAll('[data-i18n]').forEach(el => { const k = el.dataset.i18n; if (T[k]) el.innerHTML = T[k]; });
  $('intro-desc').innerHTML = T.desc;
  $('langcur').textContent = lang.toUpperCase();
  registry.forEach(r => r.label.textContent = T.names[r.def.key] || r.def.key);
  registry.forEach(r => { r.label.style.display = 'block'; r._lw = r.label.offsetWidth || 70; r.label.style.display = 'none'; });
  buildBodyButtons();
  if (infoRec) showInfo(infoRec);
  updateHUD();
}
function buildBodyButtons() {
  const host = $('bodies'); host.innerHTML = '';
  BODIES.concat(MOONS).forEach(d => {
    const b = document.createElement('button');
    b.className = 'btn' + (d.kind === 'moon' ? ' moonbtn' : '');
    b.textContent = T.names[d.key]; b.onclick = () => { stopTour(); flyTo(byKey[d.key]); };
    host.appendChild(b);
  });
}
let infoRec = null;
function showInfo(rec) {
  infoRec = rec; const d = rec.def;
  $('info').classList.add('show');
  $('i-name').textContent = T.names[d.key] || d.key;
  $('i-kind').textContent = T.kind[d.kind] + (d.parent ? ' · ' + (T.names[d.parent] || d.parent) : '');
  const rows = $('i-rows'); rows.innerHTML = '';
  const addRow = (k, v) => { const r = document.createElement('div'); r.className = 'row'; r.innerHTML = `<span>${k}</span><span>${v}</span>`; rows.appendChild(r); };
  (d.data || []).forEach(([k, lEs, vEs, lEn, vEn]) => addRow(lang === 'es' ? lEs : lEn, lang === 'es' ? vEs : vEn));
  if (d.el) {
    const pos = keplerXYZ(d.el, simTime);
    addRow(T.jd, simTime.toFixed(2));
    addRow('ua', pos.length().toFixed(3));
    addRow(lang === 'es' ? 'años desde J2000' : 'years since J2000', ((simTime - J2000) / 365.25).toFixed(2));
  }
  $('i-fact').textContent = d.fact?.[lang] || '';
}
$('i-close').onclick = () => { hideInfo(); follow = false; };
$('i-follow').onclick = () => { follow = !follow; $('i-follow').classList.toggle('on', follow); };
$('i-over').onclick = () => overview();
function hideInfo() { $('info').classList.remove('show'); infoRec = null; }

$('dockhead').onclick = () => { $('dock').classList.toggle('closed'); $('docktick').textContent = $('dock').classList.contains('closed') ? '▸' : '▾'; };
$('sizeSlider').oninput = (e) => { scale.s = parseFloat(e.target.value); rebuildScale(); updateHUD(); };
$('distSlider').oninput = (e) => { scale.d = parseFloat(e.target.value); rebuildScale(); updateHUD(); };
document.querySelectorAll('#speedpresets .btn').forEach(b => b.onclick = () => {
  document.querySelectorAll('#speedpresets .btn').forEach(x => x.classList.remove('on'));
  b.classList.add('on'); rate = parseFloat(b.dataset.rate);
  if (rate > 0) $('timeSlider').value = Math.log10(rate);
  updateHUD();
});
// deslizador de tiempo: escala logarítmica 1 min/s → 10 años/s
$('timeSlider').oninput = (e) => {
  rate = Math.pow(10, parseFloat(e.target.value));
  const near = [...document.querySelectorAll('#speedpresets .btn')].find(x => x.dataset.rate > 0 &&
    Math.abs(Math.log10(parseFloat(x.dataset.rate)) - parseFloat(e.target.value)) < 0.02);
  document.querySelectorAll('#speedpresets .btn').forEach(x => x.classList.remove('on'));
  if (near) near.classList.add('on');
  updateHUD();
};
$('trueScale').onclick = () => {
  scale.s = 0; scale.d = 0; $('sizeSlider').value = 0; $('distSlider').value = 0;
  rebuildScale(); updateHUD(); toast(T.toastReal);
  fly = { t: 0, dur: 1.8, p0: camera.position.clone(), t0: controls.target.clone(),
          p1: new THREE.Vector3(0, 30.07 * 0.3, 30.07 * 0.75), t1: new THREE.Vector3(0, 0, 0), rec: null };
  follow = false; focus = null; hideInfo();
};
$('viewSystem').onclick = () => overview();
$('tourBtn').onclick = () => (tour ? stopTour() : startTour());
$('ckOrbits').onchange = (e) => { orbitGroup.visible = e.target.checked; MOONS.forEach(m => { const r = byKey[m.key]; if (r) r.orbit.visible = e.target.checked && $('ckMoons').checked; }); };
$('ckLabels').onchange = (e) => labelsHost.style.display = e.target.checked ? '' : 'none';
$('ckBelt').onchange = (e) => belt.visible = e.target.checked;
$('ckKuiper').onchange = (e) => kuiper.visible = e.target.checked;
$('ckMoons').onchange = (e) => MOONS.forEach(m => { const r = byKey[m.key]; if (r) { r.pivot.visible = e.target.checked; r.orbit.visible = e.target.checked && $('ckOrbits').checked; } });
$('ckStars').onchange = (e) => skyGroup.visible = e.target.checked;
$('langbtn').onclick = () => { lang = lang === 'es' ? 'en' : 'es'; applyI18n(); };

const audio = $('audio');
$('mbtn').onclick = () => { if (audio.paused) { audio.play().then(() => $('mbtn').textContent = '♫').catch(() => {}); } else { audio.pause(); $('mbtn').textContent = '♪'; } };
$('mvol').oninput = (e) => audio.volume = parseFloat(e.target.value);
audio.volume = 0.6;

let toastEl = null, toastTimer = null;
function toast(msg) {
  if (!toastEl) { toastEl = document.createElement('div');
    Object.assign(toastEl.style, { position:'fixed', left:'50%', top:'82px', transform:'translateX(-50%)',
      background:'rgba(8,11,20,.9)', border:'1px solid rgba(201,161,92,.35)', color:'#e9e2cf',
      font:'10px/1.6 IBM Plex Mono, monospace', letterSpacing:'.12em', padding:'9px 16px', zIndex:'40',
      maxWidth:'min(560px,86vw)', textAlign:'center', backdropFilter:'blur(6px)', transition:'opacity .5s' });
    document.body.appendChild(toastEl); }
  toastEl.textContent = msg; toastEl.style.opacity = '1';
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.style.opacity = '0', 6500);
}

const TOUR = ['sun','mercury','venus','earth','moon','mars','jupiter','io','europa','ganymede','callisto','saturn','titan','uranus','neptune','triton','pluto','charon','ceres','eris'];
function startTour() { tour = { i: -1, wait: 0 }; $('tourBtn').classList.add('on'); $('tourBtn').textContent = lang === 'es' ? '■ Alto' : '■ Stop'; toast(T.tourOn); }
function stopTour() { tour = null; $('tourBtn').classList.remove('on'); $('tourBtn').textContent = T.tour; }
function stepTour(dt) {
  if (!tour || fly) return;
  tour.wait -= dt; if (tour.wait > 0) return;
  tour.i = (tour.i + 1) % TOUR.length;
  const rec = byKey[TOUR[tour.i]]; if (!rec) return;
  flyTo(rec, 2.2); tour.wait = 5;
}

function rateLabel(r) {
  if (r === 0) return T.speed[0];
  const rk = Object.keys(T.speed).map(Number).find(k => k > 0 && Math.abs(k - r) / k < 0.02);
  if (rk !== undefined) return T.speed[rk];
  const es = lang === 'es';
  const f = (v, u) => `1 s = ${v < 10 ? v.toFixed(1) : Math.round(v)} ${u}`;
  if (r * 86400 < 60)      return f(r * 86400, es ? 's' : 's');
  if (r * 1440  < 60)      return f(r * 1440,  es ? 'min' : 'min');
  if (r * 24    < 1.2)     return f(r * 24,    es ? 'h' : 'h');
  if (r         < 30.4)    return f(r,         es ? 'días' : 'days');
  if (r         < 365.25)  return f(r / 30.4,  es ? 'meses' : 'months');
  return f(r / 365.25, es ? 'años' : 'years');
}
function updateHUD() {
  $('simdate').textContent = fmtDate(simTime);
  $('simrate').textContent = rateLabel(rate);
  $('timeval').textContent = rateLabel(rate).replace(/^1 s = /, '');
  const infl = sizeScale(6371) / (AU_PER_KM * 6371);
  $('sizeval').textContent = scale.s < 0.005 ? T.real : (lang === 'es' ? `×${infl.toFixed(1)} en la Tierra` : `×${infl.toFixed(1)} at Earth`);
  $('distval').textContent = scale.d < 0.005 ? T.real
    : `${T.comp} ${Math.round(sceneR(30.07) / 30.07 * 100)}%`;
  $('trueScale').classList.toggle('on', scale.s < 0.005 && scale.d < 0.005);
}

// ══════════════════════════════════════════════════════════════
//  PICKING
// ══════════════════════════════════════════════════════════════
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let down = null;
renderer.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; if (tour) stopTour(); });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!down) return;
  if (Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6 && performance.now() - down.t < 450) {
    ndc.x = (e.clientX / innerWidth) * 2 - 1; ndc.y = -(e.clientY / innerHeight) * 2 + 1;
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(registry.map(r => r.pick), false)[0];
    if (hit) { const rec = hit.object.parent.userData.rec; if (rec) { stopTour(); flyTo(rec); } }
  }
  down = null;
});
addEventListener('keydown', (e) => {
  if (e.key === ' ') { e.preventDefault(); rate = rate > 0 ? 0 : 7;
    if (rate > 0) $('timeSlider').value = Math.log10(rate);
    document.querySelectorAll('#speedpresets .btn').forEach(x => x.classList.toggle('on', parseFloat(x.dataset.rate) === rate)); updateHUD(); }
  if (e.key === 'Escape') { stopTour(); overview(); }
  if (e.key.toLowerCase() === 't') startTour();
});
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// ══════════════════════════════════════════════════════════════
//  ETIQUETAS + HALOS
// ══════════════════════════════════════════════════════════════
const proj = new THREE.Vector3();
function updateLabels() {
  const moonsOn = $('ckMoons').checked;
  const items = [];
  registry.forEach(rec => {
    const d = rec.def;
    const wp = worldOf(rec);
    proj.copy(wp).project(camera);
    const dist = camera.position.distanceTo(wp);
    const wpp = 2 * Math.tan(camera.fov * DEG / 2) * dist / innerHeight;
    const apparent = rec.R / Math.max(wpp, 1e-12);
    const px = (proj.x * 0.5 + 0.5) * innerWidth, py = (-proj.y * 0.5 + 0.5) * innerHeight;
    const onScreen = proj.z < 1 && px > -60 && px < innerWidth + 60 && py > -30 && py < innerHeight + 40;
    const el = rec.label;
    // lunas: solo con zoom real o cuando su planeta está en foco
    const focused = focus && (focus === rec || focus === rec.parentRec);
    let show = onScreen && d.kind !== 'moon' && d.kind !== 'star';
    if (d.kind === 'moon') show = onScreen && moonsOn && (apparent > 7 || focused);
    if (d.kind === 'star') show = onScreen;
    items.push({ rec, el, show, dist, px, py, apparent, pri: d.kind === 'star' ? 0 : (d.kind === 'moon' ? 2 : 1) });
    const want = (apparent < 2.2 && onScreen) ? 0.75 : 0;
    rec.halo.material.opacity += (want - rec.halo.material.opacity) * 0.15;
    rec.halo.scale.setScalar(Math.max(rec.R * 2.2, wpp * 9));
    rec.pick.scale.setScalar(Math.max(rec.R * 1.6, wpp * 14));
  });
  // greedy anti-colisión: los cercanos y prioritarios ganan
  items.sort((a, b) => (a.pri - b.pri) || (a.dist - b.dist));
  const taken = [];
  for (const it of items) {
    if (!it.show) { it.el.style.display = 'none'; continue; }
    if (it.rec._lw == null) { it.el.style.display = 'block'; it.rec._lw = it.el.offsetWidth || 70; it.el.style.display = 'none'; }
    const w = it.rec._lw, h = 17, x = it.px, y = it.py - 24;
    const clash = taken.some(t => Math.abs(t.x - x) < (t.w + w) / 2 + 4 && Math.abs(t.y - y) < h);
    if (clash && it.rec.def.kind !== 'star') { it.el.style.display = 'none'; continue; }
    taken.push({ x, y, w });
    it.el.style.display = ''; it.el.style.left = it.px + 'px'; it.el.style.top = it.py + 'px';
  }
}

// ══════════════════════════════════════════════════════════════
//  LOOP
// ══════════════════════════════════════════════════════════════
let last = performance.now(), started = false;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  simTime += rate * dt;   // simTime es día juliano; rate = días por segundo real (vivo también bajo la intro)
  updateBodies();

  if (fly) {
    fly.t = Math.min(1, fly.t + dt / fly.dur);
    const k = fly.t < 0.5 ? 4 * fly.t ** 3 : 1 - Math.pow(-2 * fly.t + 2, 3) / 2;
    if (fly.rec) {
      const tgt = worldOf(fly.rec);
      controls.target.lerpVectors(fly.t0, tgt, k);
      const dist = THREE.MathUtils.lerp(fly.d0, fly.d1, k);
      camera.position.copy(tgt).add(fly.off.clone().setLength(dist));
    } else {
      controls.target.lerpVectors(fly.t0, fly.t1, k);
      camera.position.lerpVectors(fly.p0, fly.p1, k);
    }
    if (fly.t >= 1) fly = null;
  } else if (follow && focus) {
    const wp = worldOf(focus);
    camera.position.add(wp.clone().sub(controls.target));
    controls.target.copy(wp);
  }
  stepTour(dt);
  controls.update();
  // near dinámico: el rango de la escena va de 1e-4 (1:1 pegado a un astro) a miles
  const camDist = camera.position.distanceTo(controls.target);
  const wantNear = Math.max(1e-6, camDist * 0.0008);
  if (Math.abs(camera.near - wantNear) / wantNear > 0.25) {
    camera.near = wantNear; camera.far = Math.max(6000, camDist * 12);
    camera.updateProjectionMatrix();
  }
  skyGroup.position.copy(camera.position);
  updateLabels();
  updateHUD();
  renderer.render(scene, camera);
}

// ══════════════════════════════════════════════════════════════
//  ARRANQUE
// ══════════════════════════════════════════════════════════════
let loadDone = false;
manager.onProgress = (url, a, b) => { const p = (a / b) * 100; $('loadfill').style.width = p + '%'; $('loadpct').textContent = Math.round(p) + '%'; };
manager.onLoad = () => { loadDone = true; $('loadfill').style.width = '100%'; $('loadpct').textContent = '100%'; setTimeout(() => $('load').classList.add('hide'), 300); };
setTimeout(() => { if (!loadDone) $('load').classList.add('hide'); }, 9000);

$('enter').onclick = () => {
  $('intro').classList.add('hide'); started = true;
  audio.play().then(() => $('mbtn').textContent = '♫').catch(() => {});
  const span = sceneR(30.07);
  fly = { t: 0, dur: 3.6, p0: camera.position.clone(), t0: controls.target.clone(),
          p1: new THREE.Vector3(0, span * 0.42, span * 1.15), t1: new THREE.Vector3(0, 0, 0), rec: null };
  setTimeout(() => toast(T.toastComfort), 2800);
};

window.__sim = { THREE, camera, controls, scene, byKey, registry, worldOf, sceneR, scale, keplerXYZ,
  get simTime(){ return simTime; }, set simTime(v){ simTime = v; },
  get rate(){ return rate; }, set rate(v){ rate = v; }, get focus(){ return focus; },
  stats: () => ({ drawCalls: renderer.info.render.calls, tris: renderer.info.render.triangles,
                  geometries: renderer.info.memory.geometries, programs: renderer.info.programs.length }) };

rebuildScale();
applyI18n();
updateHUD();
requestAnimationFrame(loop);
