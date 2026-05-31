// ─── THREE.JS SCENE SETUP ───
var renderer;
try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'default' }); }
catch(e) { showErr('WebGL: '+e.message); log('❌ '+e.message); throw e; }
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
log('3. Renderer OK ' + window.innerWidth + 'x' + window.innerHeight);

var scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a12);
scene.fog = new THREE.Fog(0x0a0a12, 12, 28);

var aspect = window.innerWidth / window.innerHeight;
var FOV = 55;
var camera = new THREE.PerspectiveCamera(FOV, aspect, 0.1, 200);

scene.add(new THREE.AmbientLight(0x4466aa, .7));
var sun = new THREE.DirectionalLight(0xffffff, 1.0);
sun.position.set(10, 25, 10);
sun.castShadow = false;
scene.add(sun);
var pLight = new THREE.PointLight(0x00ccff, .4, 25);
scene.add(pLight);

// ─── AI MODE: dynamic board ───
var _floorMesh = null;
var _wallMeshes = [];

function rebuildBoard(gs, opts) {
  // opts: { offsetX, offsetZ } — center offset for the board
  // When grid shrinks with offset, the board center shifts
  var cx = (opts && opts.offsetX) || 0;
  var cz = (opts && opts.offsetZ) || 0;

  // Remove old floor
  if (_floorMesh) { scene.remove(_floorMesh); if(_floorMesh.geometry) _floorMesh.geometry.dispose(); if(_floorMesh.material.map) _floorMesh.material.map.dispose(); if(_floorMesh.material) _floorMesh.material.dispose(); }
  // Remove old walls
  _wallMeshes.forEach(function(w) { scene.remove(w); if(w.geometry) w.geometry.dispose(); });
  _wallMeshes = [];

  var h = gs / 2;

  // Fog
  scene.fog = new THREE.Fog(0x0a0a12, gs * 0.5, gs * 1.3);

  // Floor — checkerboard texture
  var floorCanvas = document.createElement('canvas');
  floorCanvas.width = 256; floorCanvas.height = 256;
  var fctx = floorCanvas.getContext('2d');
  var sq = 256 / gs;
  for(var fy = 0; fy < gs; fy++) {
    for(var fx = 0; fx < gs; fx++) {
      fctx.fillStyle = (fx + fy) % 2 === 0 ? '#111122' : '#0c0c18';
      fctx.fillRect(fx * sq, fy * sq, sq + .5, sq + .5);
    }
  }
  var floorTex = new THREE.CanvasTexture(floorCanvas);
  floorTex.wrapS = floorTex.wrapT = THREE.ClampToEdgeWrapping;
  _floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(gs, gs), new THREE.MeshStandardMaterial({map:floorTex, roughness:.9}));
  _floorMesh.rotation.x = -Math.PI/2; _floorMesh.position.set(cx, -.02, cz); scene.add(_floorMesh);

  // Walls — positioned at grid boundaries with offset
  var wm = new THREE.MeshStandardMaterial({color:0x1a2a4a, transparent:true, opacity:.35});
  var w1=new THREE.Mesh(new THREE.BoxGeometry(gs+.3,.4,.15),wm); w1.position.set(cx,.2,cz-h); scene.add(w1); _wallMeshes.push(w1);
  var w2=new THREE.Mesh(new THREE.BoxGeometry(gs+.3,.4,.15),wm); w2.position.set(cx,.2,cz+h); scene.add(w2); _wallMeshes.push(w2);
  var w3=new THREE.Mesh(new THREE.BoxGeometry(.15,.4,gs+.3),wm); w3.position.set(cx-h,.2,cz); scene.add(w3); _wallMeshes.push(w3);
  var w4=new THREE.Mesh(new THREE.BoxGeometry(.15,.4,gs+.3),wm); w4.position.set(cx+h,.2,cz); scene.add(w4); _wallMeshes.push(w4);

  // Camera position based on grid size (don't change during game — camera follows snake)
  // Only set initial camera if not already tracking
  var camDist = gs * 0.6;

  log('Board rebuilt: ' + gs + 'x' + gs + ' offset=(' + cx + ',' + cz + ')');
}

// Initial board build
rebuildBoard(GRID_SIZE);

// Cell centering
var CELL_CENTER = 0.5;
function gw(g) { return g + CELL_CENTER; }
