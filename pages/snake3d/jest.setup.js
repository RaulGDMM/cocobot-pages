// ─── Jest Setup for Snake3D ───
// Uses vm.runInContext to execute bundled source so `var` declarations
// become true globals (simulating browser <script> behavior).

const fs = require('fs');
const vm = require('vm');
const path = require('path');

// ─── Mock Three.js ───
class MockVector3 {
  constructor(x=0,y=0,z=0) { this.x=x; this.y=y; this.z=z; }
  set(x,y,z) { this.x=x; this.y=y; this.z=z; return this; }
  setScalar(s) { this.x=s; this.y=s; this.z=s; return this; }
  copy(v) { this.x=v.x; this.y=v.y; this.z=v.z; return this; }
}

global.THREE = {
  REVISION: '128',
  Group: class Group {
    constructor() { this.children = []; this.position = new MockVector3(); }
    add(c) { this.children.push(c); }
    remove(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); }
  },
  Scene: class Scene {
    constructor() { this.children = []; this.background = null; this.fog = null; }
    add(c) { this.children.push(c); }
    remove(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); }
  },
  Color: class Color { constructor() {} },
  Fog: class Fog { constructor() {} },
  Vector3: MockVector3,
  PerspectiveCamera: class PerspectiveCamera {
    constructor() { this.position = new MockVector3(); this.aspect = 1; }
    lookAt() {}
    updateProjectionMatrix() {}
  },
  AmbientLight: class AmbientLight { constructor() {} },
  DirectionalLight: class DirectionalLight {
    constructor() { this.position = new MockVector3(); this.castShadow = false; }
  },
  PointLight: class PointLight {
    constructor() { this.position = new MockVector3(); }
  },
  WebGLRenderer: class WebGLRenderer {
    constructor(opts) { this.domElement = opts && opts.canvas || document.createElement('canvas'); }
    setPixelRatio() {}
    setSize() {}
    render() {}
  },
  CanvasTexture: class CanvasTexture {
    constructor() { this.wrapS = 1000; this.wrapT = 1000; }
  },
  Mesh: class Mesh {
    constructor(geometry, material) {
      this.position = new MockVector3();
      this.visible = true;
      this.rotation = new MockVector3();
      this.scale = new MockVector3(1,1,1);
      this.material = material || null;
      this.geometry = geometry || null;
      this.userData = {};
    }
    dispose() {}
  },
  MeshStandardMaterial: class MeshStandardMaterial {
    constructor() {
      this.color = {setHex:()=>{}};
      this.emissive = {setHex:()=>{}};
      this.emissiveIntensity = 0;
      this.opacity = 1;
      this.transparent = false;
      this.map = null;
      this.roughness = 1;
    }
    clone() {
      const m = new MeshStandardMaterial();
      m.opacity = this.opacity;
      m.transparent = this.transparent;
      m.color = {setHex:()=>{}};
      m.emissive = {setHex:()=>{}};
      m.emissiveIntensity = this.emissiveIntensity;
      return m;
    }
    dispose() {}
  },
  MeshBasicMaterial: class MeshBasicMaterial {
    constructor() {
      this.color = {setHex:()=>{}};
      this.opacity = 1;
      this.transparent = false;
    }
    clone() {
      const m = new MeshBasicMaterial();
      m.opacity = this.opacity;
      m.transparent = this.transparent;
      m.color = {setHex:()=>{}};
      return m;
    }
    dispose() {}
  },
  SphereGeometry: class SphereGeometry { constructor() {} dispose() {} },
  BoxGeometry: class BoxGeometry { constructor() {} dispose() {} },
  PlaneGeometry: class PlaneGeometry { constructor() {} dispose() {} },
  ClampToEdgeWrapping: 1000,
};

// ─── Mock Canvas 2D context ───
const MockCanvasCtx = {
  fillStyle: '', fillRect: ()=>{}, strokeStyle: '', strokeRect: ()=>{},
  createLinearGradient: ()=>({addColorStop:()=>{}}),
  arc: ()=>{}, beginPath: ()=>{}, closePath: ()=>{}, fill: ()=>{}, stroke: ()=>{},
  save: ()=>{}, restore: ()=>{}, translate: ()=>{}, rotate: ()=>{}, scale: ()=>{},
  measureText: ()=>({width:0}), drawImage: ()=>{}, clip: ()=>{},
  setTransform: ()=>{}, transform: ()=>{}, rect: ()=>{},
};
const origCreateElement = document.createElement.bind(document);
document.createElement = function(tag) {
  const el = origCreateElement(tag);
  if (tag === 'canvas') {
    el.getContext = () => MockCanvasCtx;
    el.width = 256; el.height = 256;
  }
  return el;
};

// ─── Mock DOM elements ───
function mockEl(id, tag = 'div') {
  const el = document.createElement(tag);
  el.id = id;
  document.body.appendChild(el);
  return el;
}

mockEl('debug');
mockEl('err-box');
mockEl('game-canvas', 'canvas');
mockEl('score');
mockEl('highscore');
mockEl('overlay');
mockEl('start-btn', 'button');
mockEl('final-score');
mockEl('hint-l');
mockEl('hint-r');
mockEl('games-count');
mockEl('music-player');
mockEl('mp-prev', 'button');
mockEl('mp-play', 'button');
mockEl('mp-next', 'button');
mockEl('mp-track');
mockEl('mp-num');
mockEl('tz-left');
mockEl('tz-right');

// ─── Mock window properties ───
Object.defineProperty(window, 'innerWidth', { value: 1280, writable: true, configurable: true });
Object.defineProperty(window, 'innerHeight', { value: 720, writable: true, configurable: true });
Object.defineProperty(window, 'devicePixelRatio', { value: 1, writable: true, configurable: true });

if (!global.performance) {
  global.performance = { now: () => Date.now() };
}
if (!global.requestAnimationFrame) {
  global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
}

// ─── Mock AudioContext ───
global.AudioContext = class {
  constructor() { this.state = 'running'; }
  createOscillator() { return { type: 'square', frequency: {value:0}, start:()=>{}, stop:()=>{}, connect:()=>{} }; }
  createGain() { return { gain: {value:0, exponentialRampToValueAtTime:()=>{}}, connect:()=>{} }; }
  get currentTime() { return 0; }
  destination = {};
  resume() {}
};
global.webkitAudioContext = global.AudioContext;

// ─── Mock localStorage ───
const store = {};
global.localStorage = {
  getItem: (k) => store[k] !== undefined ? store[k] : null,
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
  clear: () => { for (const k in store) delete store[k]; },
  get length() { return Object.keys(store).length; },
  key: (i) => Object.keys(store)[i] || null,
};

// ─── Suppress console output during tests ───
console.log = () => {};
console.error = () => {};

// ─── Load bundled source with vm.runInContext ───
// This makes all `var` declarations become properties of the sandbox context.
const bundlePath = path.join(__dirname, 'tests', 'snake3d-bundle.js');
const bundleCode = fs.readFileSync(bundlePath, 'utf8');

// Create a sandbox context with all the mocks
const ctx = vm.createContext({
  document,
  window,
  console,
  Math,
  Date,
  Array,
  Object,
  String,
  Number,
  Boolean,
  Function,
  JSON,
  parseInt,
  parseFloat,
  setTimeout,
  setInterval,
  clearTimeout,
  clearInterval,
  THREE,
  localStorage,
  AudioContext,
  webkitAudioContext: AudioContext,
  performance: global.performance,
  requestAnimationFrame: global.requestAnimationFrame,
});

// Execute bundle in the sandbox
vm.runInContext(bundleCode, ctx, { filename: 'snake3d-bundle.js' });

// ─── Wire ctx properties to global ───
// All `var` declarations in the bundle become properties of ctx.
// We wire them to global so tests can read/write them.
const skipKeys = new Set([
  'module', 'exports', 'require', '__filename', '__dirname',
  'document', 'window', 'console', 'Math', 'Date', 'Array',
  'Object', 'String', 'Number', 'Boolean', 'Function', 'JSON',
  'parseInt', 'parseFloat', 'setTimeout', 'setInterval',
  'clearTimeout', 'clearInterval', 'THREE', 'localStorage',
  'AudioContext', 'webkitAudioContext', 'performance',
  'requestAnimationFrame', 'globalThis',
]);

for (const key of Object.keys(ctx)) {
  if (skipKeys.has(key)) continue;
  try {
    Object.defineProperty(global, key, {
      get: () => ctx[key],
      set: (v) => { ctx[key] = v; },
      configurable: true,
      enumerable: true,
    });
  } catch(e) {
    // Some properties may not be configurable
  }
}

// ─── Helper: set global variable ───
global.setGlobal = function(name, value) {
  ctx[name] = value;
};
