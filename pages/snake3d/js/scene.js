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
camera.position.set(-12, 10, 6);
camera.lookAt(-7, 0, 0);

scene.add(new THREE.AmbientLight(0x4466aa, .7));
var sun = new THREE.DirectionalLight(0xffffff, 1.0);
sun.position.set(10, 25, 10);
sun.castShadow = false;
scene.add(sun);
var pLight = new THREE.PointLight(0x00ccff, .4, 25);
scene.add(pLight);

// Floor — checkerboard texture
var floorCanvas = document.createElement('canvas');
floorCanvas.width = 256; floorCanvas.height = 256;
var fctx = floorCanvas.getContext('2d');
var sq = 256 / GRID_SIZE;
for(var fy = 0; fy < GRID_SIZE; fy++) {
  for(var fx = 0; fx < GRID_SIZE; fx++) {
    fctx.fillStyle = (fx + fy) % 2 === 0 ? '#111122' : '#0c0c18';
    fctx.fillRect(fx * sq, fy * sq, sq + .5, sq + .5);
  }
}
var floorTex = new THREE.CanvasTexture(floorCanvas);
floorTex.wrapS = floorTex.wrapT = THREE.ClampToEdgeWrapping;
var flr = new THREE.Mesh(new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE), new THREE.MeshStandardMaterial({map:floorTex, roughness:.9}));
flr.rotation.x = -Math.PI/2; flr.position.y = -.02; scene.add(flr);

// Walls
var wm = new THREE.MeshStandardMaterial({color:0x1a2a4a, transparent:true, opacity:.35});
var hw = half;
var w1=new THREE.Mesh(new THREE.BoxGeometry(GRID_SIZE+.3,.4,.15),wm); w1.position.set(0,.2,-hw); scene.add(w1);
var w2=new THREE.Mesh(new THREE.BoxGeometry(GRID_SIZE+.3,.4,.15),wm); w2.position.set(0,.2,hw); scene.add(w2);
var w3=new THREE.Mesh(new THREE.BoxGeometry(.15,.4,GRID_SIZE+.3),wm); w3.position.set(-hw,.2,0); scene.add(w3);
var w4=new THREE.Mesh(new THREE.BoxGeometry(.15,.4,GRID_SIZE+.3),wm); w4.position.set(hw,.2,0); scene.add(w4);
log('4. Floor+walls OK');

// Cell centering
var CELL_CENTER = 0.5;
function gw(g) { return g + CELL_CENTER; }
