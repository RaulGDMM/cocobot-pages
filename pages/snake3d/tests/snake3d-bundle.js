// ─── Snake3D Bundle for Jest ───
// Auto-generated from js/*.js. DO NOT edit manually.
// Loaded via vm.runInContext in jest.setup.js.

// === config.js ===
// ─── CONFIG ───
var GRID_SIZE = 22;
var MOVE_INTERVAL = 200;
var TURN_ANGLE = Math.PI / 2;
var half = GRID_SIZE / 2;
var NUM_APPLES = 3;
var OBSTACLE_SPAWN_EVERY = 3;
var OBSTACLE_MIN_DIST_SNAKE = 6;
var OBSTACLE_MIN_DIST_EACH = 3;
var OBSTACLE_MIN_DIST_APPLE = 3;
var MAX_OBSTACLES = 30;

// ─── AI MODE ───
// Snake colors: player picks one, AI get random from remaining
var SNAKE_COLORS = {
  green: '#00cc44',
  red: '#cc2222',
  blue: '#2266cc',
  yellow: '#ccaa00'
};
var SNAKE_COLOR_NAMES = ['green', 'red', 'blue', 'yellow'];

// Game modes: solo, vs2, vs3, vs4
var GAME_MODES = ['solo', 'vs2', 'vs3', 'vs4'];

// Mode → base grid size multiplier
var MODE_GRID_MULTIPLIER = {
  solo: 1.0,
  vs2: 1.25,
  vs3: 1.50,
  vs4: 1.75
};

// Difficulty levels
var DIFFICULTIES = ['easy', 'medium', 'hard'];

// AI error rates per difficulty (probability of choosing random safe direction)
var AI_ERROR_RATE = {
  easy: 0.10,
  medium: 0.02,
  hard: 0.005
};

// AI cornering aggression per difficulty (probability per tick)
var AI_CORNERING_RATE = {
  easy: 0.00,
  medium: 0.70,
  hard: 0.95
};

// Grid size limits
var GRID_MIN = 16;
var GRID_MAX = 50;

// Number of AI snakes per mode
var AI_COUNT = {
  solo: 0,
  vs2: 1,
  vs3: 2,
  vs4: 3
};

// ─── AI MODE: resolveGridSize(mode, percentageModifier) ───
// mode: 'solo'|'vs2'|'vs3'|'vs4'
// percentageModifier: -50 to +50 (integer, step 5)
// Returns clamped EVEN integer between GRID_MIN and GRID_MAX
// (even grids ensure half is integer → cells align with snake positions)
function resolveGridSize(mode, percentageModifier) {
  var base = Math.round(22 * (MODE_GRID_MULTIPLIER[mode] || 1.0));
  var result = base + Math.round(base * (percentageModifier || 0) / 100);
  // Force even: odd grids cause half-integer boundaries → visual misalignment
  if (result % 2 !== 0) result += 1;
  if (result < GRID_MIN) result = GRID_MIN;
  if (result > GRID_MAX) result = GRID_MAX;
  // Clamp to even after boundary check too
  if (result % 2 !== 0) result -= 1;
  return result;
}

// ─── AI MODE: getHighScoreKey(mode, difficulty, gridSize) ───
function getHighScoreKey(mode, difficulty, gridSize) {
  return 'snake3d_hs_' + mode + '_' + gridSize + '_' + difficulty;
}

// ─── LOGGING (must be early — all modules use log/showErr) ───
var dbg = document.getElementById('debug');
var errBox = document.getElementById('err-box');
var logs = [];
function log(msg) {
  var ts = new Date().toLocaleTimeString();
  logs.push('[' + ts + '] ' + msg);
  if(logs.length > 80) logs.shift();
  dbg.textContent = logs.join('\n');
  console.log('[Snake3D]', msg);
}
function showErr(msg) { errBox.textContent = msg; errBox.style.display = msg ? 'block' : 'none'; }

window.onerror = function(msg) { showErr('ERROR: '+msg); log('❌ onerror: '+msg); return true; };

log('1. Script starting...');
if(typeof THREE === 'undefined') { showErr('Three.js no cargó'); throw new Error('Three.js not loaded'); }
log('2. Three.js v' + THREE.REVISION);


// === state.js ===
// ─── STATE ───
var snake = [];
var direction = 0;
var apples = [];
var obstacles = [];
var score = 0;
// ─── AI MODE: highScore loaded dynamically per mode (initialized to 0) ───
var highScore = 0;
var totalGames = parseInt(localStorage.getItem('snake3d_games') || '0');
var running = false;
var lastMoveTime = 0;
var gameOver = false;
var camSmoothX = 0, camSmoothZ = 0;
var lookSmoothX = 0, lookSmoothZ = 0;

// ─── AI MODE ───
var gameMode = 'solo';
var difficulty = 'medium';
var playerColor = 'green';
var gridSize = GRID_SIZE;
var gridSizeModifier = 0;
var aiSnakes = [];
var corpses = [];
var corpseGroup = null;
var corpseMeshes = [];

// ─── DOM ───
var canvas = document.getElementById('game-canvas');
var scoreEl = document.getElementById('score');
var highscoreEl = document.getElementById('highscore');
var overlay = document.getElementById('overlay');
var startBtn = document.getElementById('start-btn');
var finalScoreEl = document.getElementById('final-score');
var hintL = document.getElementById('hint-l');
var hintR = document.getElementById('hint-r');
var gamesCountEl = document.getElementById('games-count');
highscoreEl.textContent = highScore;
gamesCountEl.textContent = totalGames;


// === audio.js ===
// ─── AUDIO (SFX) ───
var actx = null;
function initAudio() {
  if(!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){} }
  if(actx && actx.state === 'suspended') actx.resume();
}
function tone(f,d,t,v) {
  if(!actx) return;
  try {
    var o=actx.createOscillator(), g=actx.createGain();
    o.type=t||'square'; o.frequency.value=f;
    g.gain.value=v||.08; g.gain.exponentialRampToValueAtTime(.001,actx.currentTime+d);
    o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime+d);
  } catch(e){}
}
function sfxEat(){tone(587,.1,'square',.08);setTimeout(function(){tone(784,.12,'square',.08)},70);}
function sfxTurn(){tone(440,.03,'sine',.03);}
function sfxDie(){tone(180,.3,'sawtooth',.08);setTimeout(function(){tone(120,.4,'sawtooth',.06)},150);}
function sfxObstacle(){tone(220,.15,'square',.1);setTimeout(function(){tone(330,.2,'square',.08)},100);}

// ─── Directional AI eat sound ───
// Pan the sound based on AI position relative to player head
// pan: -1 (left) to +1 (right), 0 = center
function sfxAiEat(pan) {
  if(!actx) return;
  pan = Math.max(-1, Math.min(1, pan || 0));
  try {
    var o1=actx.createOscillator(), p1=actx.createStereoPanner(), g1=actx.createGain();
    o1.type='triangle'; o1.frequency.value=440;
    p1.pan.value=pan;
    g1.gain.value=.06; g1.gain.exponentialRampToValueAtTime(.001,actx.currentTime+.08);
    o1.connect(p1); p1.connect(g1); g1.connect(actx.destination); o1.start(); o1.stop(actx.currentTime+.08);

    var o2=actx.createOscillator(), p2=actx.createStereoPanner(), g2=actx.createGain();
    o2.type='triangle'; o2.frequency.value=660;
    p2.pan.value=pan;
    g2.gain.value=.06; g2.gain.exponentialRampToValueAtTime(.001,actx.currentTime+.15);
    o2.connect(p2); p2.connect(g2); g2.connect(actx.destination); o2.start(actx.currentTime+.06); o2.stop(actx.currentTime+.15);
  } catch(e){}
}

// ─── MUSIC PLAYER ───
var playlist = [
  {name: '🐍 Super Serpiente', file: 'music/retro-1.mp3'},
  {name: '🐍 Cobra Turbo', file: 'music/retro-2.mp3'},
  {name: '🐍 Pitón Retro', file: 'music/retro-3.mp3'},
  {name: '🐍 Víbora Eléctrica', file: 'music/retro-4.mp3'},
  {name: '🐍 Anaconda Arcade', file: 'music/retro-5.mp3'},
  {name: '🐍 Serpiente Loca', file: 'music/retro-6.mp3'},
  {name: '🐍 Boa Neon', file: 'music/retro-7.mp3'},
  {name: '🐍 Mamba Digital', file: 'music/retro-8.mp3'},
  {name: '🐍 Aspic Pixel', file: 'music/retro-9-v2.mp3'},
  {name: '🐍 Natrix Chiptune', file: 'music/retro-10.mp3'}
];
var currentTrack = 0;
var musicEl = null;
var musicPlaying = false;
var userPausedMusic = false;
var musicPlayerEl = null;
var mpPlayBtn = null;
var mpTrackEl = null;
var mpNumEl = null;

function initMusic() {
  musicEl = document.createElement('audio');
  musicEl.preload = 'auto';
  musicEl.volume = 0.4;
  musicPlayerEl = document.getElementById('music-player');
  mpPlayBtn = document.getElementById('mp-play');
  mpTrackEl = document.getElementById('mp-track');
  mpNumEl = document.getElementById('mp-num');

  currentTrack = Math.floor(Math.random() * playlist.length);
  musicEl.src = playlist[currentTrack].file;
  updateTrackDisplay();
  log('🎵 Ready: ' + playlist[currentTrack].name + ' (' + (currentTrack + 1) + '/' + playlist.length + ') — press ▶ to play');

  document.getElementById('mp-prev').addEventListener('click', function(e) { e.stopPropagation(); prevTrack(); });
  mpPlayBtn.addEventListener('click', function(e) { e.stopPropagation(); toggleMusic(); });
  document.getElementById('mp-next').addEventListener('click', function(e) { e.stopPropagation(); nextTrack(); });

  musicEl.addEventListener('ended', function() {
    log('🎵 Track ended, playing next');
    nextTrack();
  });

  musicEl.addEventListener('error', function(e) {
    log('❌ Music error: ' + (musicEl.error ? musicEl.error.message : 'unknown'));
  });

  log('🎵 Music player initialized with ' + playlist.length + ' tracks');
}

function updateTrackDisplay() {
  var track = playlist[currentTrack];
  mpTrackEl.textContent = track.name;
  mpNumEl.textContent = (currentTrack + 1) + '/' + playlist.length;
}

function shufflePlaylist() {
  for(var i = playlist.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = playlist[i];
    playlist[i] = playlist[j];
    playlist[j] = temp;
  }
  currentTrack = 0;
  log('🎵 Playlist shuffled, first track: ' + playlist[0].name);
}

function pickRandomTrack() {
  currentTrack = Math.floor(Math.random() * playlist.length);
  musicEl.src = playlist[currentTrack].file + '?t=' + Date.now();
  log('🎵 Picked random track: ' + playlist[currentTrack].name + ' (' + (currentTrack + 1) + '/' + playlist.length + ')');
}

function playTrack(index) {
  if(!musicEl) return;
  currentTrack = ((index % playlist.length) + playlist.length) % playlist.length;
  var track = playlist[currentTrack];
  musicEl.src = track.file + '?t=' + Date.now();
  musicEl.load();
  var playPromise = musicEl.play();
  if(playPromise) {
    playPromise.then(function() {
      musicPlaying = true;
      mpPlayBtn.textContent = '⏸';
      mpTrackEl.textContent = track.name;
      mpNumEl.textContent = (currentTrack + 1) + '/' + playlist.length;
      log('🎵 Playing: ' + track.name + ' (' + (currentTrack + 1) + '/' + playlist.length + ')');
    }).catch(function(e) {
      log('⚠️ Music play failed: ' + e.message);
    });
  }
}

function toggleMusic() {
  if(!musicEl) return;
  if(musicPlaying) {
    musicEl.pause();
    musicPlaying = false;
    userPausedMusic = true;
    mpPlayBtn.textContent = '▶';
    log('🎵 Music paused by user');
  } else {
    userPausedMusic = false;
    musicEl.play().then(function() {
      musicPlaying = true;
      mpPlayBtn.textContent = '⏸';
      log('🎵 Music resumed');
    }).catch(function(e) {
      log('⚠️ Music resume failed: ' + e.message);
    });
  }
}

function nextTrack() {
  playTrack(currentTrack + 1);
}

function prevTrack() {
  if(musicEl && musicEl.currentTime > 3) {
    musicEl.currentTime = 0;
    log('🎵 Restarted: ' + playlist[currentTrack].name);
  } else {
    playTrack(currentTrack - 1);
  }
}

function startMusic() {
  // No-op: music only plays when user presses ▶
}

function stopMusic() {
  if(musicEl && musicPlaying) {
    musicEl.pause();
    musicEl.currentTime = 0;
    musicPlaying = false;
    mpPlayBtn.textContent = '▶';
    log('🎵 Music stopped');
  }
}


// === scene.js ===
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

function rebuildBoard(gs) {
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
  _floorMesh.rotation.x = -Math.PI/2; _floorMesh.position.y = -.02; scene.add(_floorMesh);

  // Walls
  var wm = new THREE.MeshStandardMaterial({color:0x1a2a4a, transparent:true, opacity:.35});
  var w1=new THREE.Mesh(new THREE.BoxGeometry(gs+.3,.4,.15),wm); w1.position.set(0,.2,-h); scene.add(w1); _wallMeshes.push(w1);
  var w2=new THREE.Mesh(new THREE.BoxGeometry(gs+.3,.4,.15),wm); w2.position.set(0,.2,h); scene.add(w2); _wallMeshes.push(w2);
  var w3=new THREE.Mesh(new THREE.BoxGeometry(.15,.4,gs+.3),wm); w3.position.set(-h,.2,0); scene.add(w3); _wallMeshes.push(w3);
  var w4=new THREE.Mesh(new THREE.BoxGeometry(.15,.4,gs+.3),wm); w4.position.set(h,.2,0); scene.add(w4); _wallMeshes.push(w4);

  // Camera position based on grid size
  var camDist = gs * 0.6;
  camera.position.set(-camDist, camDist * 0.7, camDist * 0.4);
  camera.lookAt(0, 0, 0);

  log('Board rebuilt: ' + gs + 'x' + gs);
}

// Initial board build
rebuildBoard(GRID_SIZE);

// Cell centering
var CELL_CENTER = 0.5;
function gw(g) { return g + CELL_CENTER; }


// === snake.js ===
// ─── SNAKE 3D MESH ───
// ─── AI MODE: multi-snake support ───

var sGroup = new THREE.Group(); scene.add(sGroup);

// Shared geometries (reused across snakes)
var hGeo = new THREE.BoxGeometry(.8, .5, .8);
var bGeo = new THREE.BoxGeometry(.7, .45, .7);

// Legacy globals (used by game.js)
var headM = null;
var bodyMs = [];

// Player snake group data (persists across games)
var playerGroupData = null;

// ─── Build snake mesh ───
// Usage: buildSnake(color)  → returns { group, headM, bodyMs } for any snake
// Always uses multi-snake mode (wraps in a group)
function buildSnake(color) {
  var snakeColor = SNAKE_COLORS[color] || SNAKE_COLORS.green;

  var headMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(snakeColor),
    emissive: new THREE.Color(snakeColor).multiplyScalar(0.6).getHex(),
    emissiveIntensity: .35
  });
  var bodyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(snakeColor).multiplyScalar(0.7),
    emissive: new THREE.Color(snakeColor).multiplyScalar(0.2).getHex(),
    emissiveIntensity: .15
  });

  var head = new THREE.Mesh(hGeo, headMat);
  head.position.y = .25;

  var bodies = [];
  for(var i = 0; i < 200; i++) {
    var m = new THREE.Mesh(bGeo, bodyMat);
    m.position.y = .225; m.visible = false;
    bodies.push(m);
  }

  var group = new THREE.Group();
  group.add(head);
  bodies.forEach(function(b) { group.add(b); });
  sGroup.add(group);

  // Also set legacy globals for backward compat with game.js / refreshSnake()
  headM = head;
  bodyMs = bodies;

  return { group: group, headM: head, bodyMs: bodies };
}

// ─── Refresh snake mesh ───
// Usage: refreshSnake()                       → uses playerGroupData
// Usage: refreshSnake(snakeData, groupData)   → multi-snake mode
function refreshSnake(snakeData, groupData) {
  if (snakeData === undefined) {
    // Legacy / player mode: use playerGroupData
    var gd = playerGroupData;
    if(!gd || !gd.headM || !gd.bodyMs || !gd.bodyMs.length || !snake || !snake.length) return;
    headM = gd.headM;
    bodyMs = gd.bodyMs;
    headM.position.set(gw(snake[0].x), .25, gw(snake[0].z));
    headM.rotation.y = -direction;
    for(var i = 1; i < snake.length; i++) {
      if(i < bodyMs.length) {
        bodyMs[i].visible = true;
        bodyMs[i].position.set(gw(snake[i].x), .225, gw(snake[i].z));
        var frac = i / Math.max(snake.length, 1);
        var s = 1 - frac * .4;
        bodyMs[i].scale.set(s, 1, s);
      }
    }
    for(var i = snake.length; i < bodyMs.length; i++) bodyMs[i].visible = false;
    return;
  }

  // Multi-snake mode
  if(!snakeData || !snakeData.length || !groupData || !groupData.bodyMs || !groupData.bodyMs.length) return;
  var head = groupData.headM;
  var bodies = groupData.bodyMs;
  var dir = groupData.direction || 0;

  head.position.set(gw(snakeData[0].x), .25, gw(snakeData[0].z));
  head.rotation.y = -dir;

  for(var i = 1; i < snakeData.length; i++) {
    if(i < bodies.length) {
      bodies[i].visible = true;
      bodies[i].position.set(gw(snakeData[i].x), .225, gw(snakeData[i].z));
      var frac = i / Math.max(snakeData.length, 1);
      var s = 1 - frac * .4;
      bodies[i].scale.set(s, 1, s);
    }
  }
  for(var i = snakeData.length; i < bodies.length; i++) bodies[i].visible = false;
}


// === apples.js ===
// ─── APPLES ───
var appleGroup = new THREE.Group(); scene.add(appleGroup);
var appleMeshes = [];
var appleGeo = new THREE.SphereGeometry(.25, 10, 10);
var appleMat = new THREE.MeshStandardMaterial({color:0xff2233, emissive:0x881122, emissiveIntensity:.5});

function buildApples() {
  while(appleGroup.children.length) { var c=appleGroup.children[0]; appleGroup.remove(c); }
  appleMeshes = [];
  for(var i = 0; i < NUM_APPLES; i++) {
    var g = new THREE.Group();
    var m = new THREE.Mesh(appleGeo, appleMat);
    g.add(m);
    var gl = new THREE.PointLight(0xff3344, .3, 3); g.add(gl);
    appleGroup.add(g);
    appleMeshes.push(g);
    g.visible = false;
  }
}

function isOccupied(x, z) {
  if(snake.some(function(s){return s.x===x&&s.z===z;})) return true;
  if(apples.some(function(a){return a&&a.x===x&&a.z===z;})) return true;
  if(obstacles.some(function(o){return o.x===x&&o.z===z;})) return true;
  // ─── AI MODE: include AI snakes and corpses ───
  if(aiSnakes) {
    for(var i = 0; i < aiSnakes.length; i++) {
      var ai = aiSnakes[i];
      if(ai.alive && ai.snake.some(function(s){return s.x===x&&s.z===z;})) return true;
    }
  }
  if(corpses) {
    if(corpses.some(function(c){return c.x===x&&c.z===z;})) return true;
  }
  return false;
}

function spawnOneApple() {
  for(var tries = 0; tries < 200; tries++) {
    var x = Math.floor(Math.random()*gridSize)-half;
    var z = Math.floor(Math.random()*gridSize)-half;
    if(!isOccupied(x,z)) return {x:x, z:z};
  }
  return null;
}

function refreshApples() {
  if (!appleMeshes || !appleMeshes.length) return;
  for(var i = 0; i < NUM_APPLES; i++) {
    if (i >= appleMeshes.length) break;
    if(i < apples.length && apples[i]) {
      appleMeshes[i].visible = true;
      appleMeshes[i].position.set(gw(apples[i].x), .25, gw(apples[i].z));
    } else {
      appleMeshes[i].visible = false;
    }
  }
}

function initApples() {
  apples = [];
  for(var i = 0; i < NUM_APPLES; i++) {
    var a = spawnOneApple();
    if(a) apples.push(a);
  }
  refreshApples();
  log('Apples: ' + apples.length + ' spawned');
}


// === obstacles.js ===
// ─── OBSTACLES ───
var obsGroup = new THREE.Group(); scene.add(obsGroup);
var obsMeshes = [];
var obsGeo = new THREE.BoxGeometry(.8, .7, .8);
var obsMat = new THREE.MeshStandardMaterial({color:0x664444, emissive:0x331111, emissiveIntensity:.2, roughness:.6});

function buildObstacles() {
  while(obsGroup.children.length) { var c=obsGroup.children[0]; obsGroup.remove(c); }
  obsMeshes = [];
  for(var i = 0; i < MAX_OBSTACLES; i++) {
    var m = new THREE.Mesh(obsGeo, obsMat);
    m.position.y = .35; m.visible = false; obsGroup.add(m); obsMeshes.push(m);
  }
}

function refreshObstacles() {
  for(var i = 0; i < MAX_OBSTACLES; i++) {
    if(i < obstacles.length) {
      obsMeshes[i].visible = true;
      obsMeshes[i].position.set(gw(obstacles[i].x), .35, gw(obstacles[i].z));
    } else {
      obsMeshes[i].visible = false;
    }
  }
}

function isSafeForObstacle(x, z) {
  for(var i = 0; i < snake.length; i++) {
    var dx = snake[i].x - x, dz = snake[i].z - z;
    if(Math.abs(dx) + Math.abs(dz) < OBSTACLE_MIN_DIST_SNAKE) return false;
  }
  for(var i = 0; i < obstacles.length; i++) {
    var dx = obstacles[i].x - x, dz = obstacles[i].z - z;
    if(Math.abs(dx) + Math.abs(dz) < OBSTACLE_MIN_DIST_EACH) return false;
  }
  for(var i = 0; i < apples.length; i++) {
    if(!apples[i]) continue;
    var dx = apples[i].x - x, dz = apples[i].z - z;
    if(Math.abs(dx) + Math.abs(dz) < OBSTACLE_MIN_DIST_APPLE) return false;
  }
  // ─── AI MODE: keep distance from AI snakes too ───
  if(aiSnakes) {
    for(var i = 0; i < aiSnakes.length; i++) {
      var ai = aiSnakes[i];
      if(!ai.alive) continue;
      for(var j = 0; j < ai.snake.length; j++) {
        var dx = ai.snake[j].x - x, dz = ai.snake[j].z - z;
        if(Math.abs(dx) + Math.abs(dz) < OBSTACLE_MIN_DIST_SNAKE) return false;
      }
    }
  }
  if(isOccupied(x, z)) return false;
  return true;
}

function spawnObstacle() {
  if(obstacles.length >= MAX_OBSTACLES) return;
  for(var tries = 0; tries < 300; tries++) {
    var x = Math.floor(Math.random()*gridSize)-half;
    var z = Math.floor(Math.random()*gridSize)-half;
    if(isSafeForObstacle(x, z)) {
      obstacles.push({x:x, z:z});
      refreshObstacles();
      log('Obstacle spawned at ('+x+','+z+') — total: '+obstacles.length);
      sfxObstacle();
      return;
    }
  }
  log('⚠️ Could not place obstacle');
}


// === particles.js ===
// ─── PARTICLES ───
var parts = [];
var partMat = new THREE.MeshBasicMaterial({color:0xffaa00, transparent:true});
var partGeo = new THREE.SphereGeometry(.05, 4, 4);
function burst(x, z, col, n) {
  for(var i = 0; i < (n||8); i++) {
    var m = new THREE.Mesh(partGeo, partMat.clone());
    m.position.set(gw(x), .3, gw(z));
    m.material.color.setHex(col); m.material.opacity = 1;
    m.userData = {vx:(Math.random()-.5)*.2, vy:Math.random()*.1+.05, vz:(Math.random()-.5)*.2, life:1};
    scene.add(m); parts.push(m);
  }
}
function tickParts(dt) {
  for(var i=parts.length-1; i>=0; i--) {
    var p=parts[i]; p.userData.life -= dt*2.5;
    p.position.x+=p.userData.vx; p.position.y+=p.userData.vy; p.position.z+=p.userData.vz;
    p.userData.vy -= dt*.3;
    p.material.opacity = Math.max(0, p.userData.life);
    p.scale.setScalar(Math.max(.01, p.userData.life));
    if(p.userData.life<=0) { scene.remove(p); p.material.dispose(); parts.splice(i,1); }
  }
}

log('5. Scene ready');


// === ai.js ===
// ─── AI OPPONENTS ───
// AI snake logic: movement, collision, corpses, difficulty levels

// ─── Snap angle to nearest cardinal direction ───
// Cardinal directions: 0 (right/+X), π/2 (down/+Z), π (left/-X), -π/2 (up/-Z)
function snapToCardinal(angle) {
  var cardinal = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  var best = cardinal[0];
  var bestDiff = Infinity;
  for (var i = 0; i < cardinal.length; i++) {
    var diff = angle - cardinal[i];
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) < bestDiff) {
      bestDiff = Math.abs(diff);
      best = cardinal[i];
    }
  }
  return best;
}

// ─── Count reachable cells from (x,z) using BFS ───
// Used to evaluate how much open space a direction offers
function countReachable(x, z, snakeBody, maxSteps) {
  maxSteps = maxSteps || 30;
  var visited = {};
  var queue = [{x: x, z: z}];
  visited[x + ',' + z] = true;
  var count = 0;
  var dirs = [{x:1,z:0},{x:-1,z:0},{x:0,z:1},{x:0,z:-1}];

  // Build obstacle/corpse lookup for fast access
  var blocked = {};
  for (var i = 0; i < snakeBody.length; i++) blocked[snakeBody[i].x + ',' + snakeBody[i].z] = true;
  for (var i = 0; i < obstacles.length; i++) blocked[obstacles[i].x + ',' + obstacles[i].z] = true;
  if (corpses) for (var i = 0; i < corpses.length; i++) blocked[corpses[i].x + ',' + corpses[i].z] = true;
  // Other snakes
  if (snake.length) for (var i = 0; i < snake.length; i++) blocked[snake[i].x + ',' + snake[i].z] = true;
  if (aiSnakes) {
    for (var i = 0; i < aiSnakes.length; i++) {
      if (!aiSnakes[i].alive) continue;
      for (var j = 0; j < aiSnakes[i].snake.length; j++) {
        blocked[aiSnakes[i].snake[j].x + ',' + aiSnakes[i].snake[j].z] = true;
      }
    }
  }

  while (queue.length > 0 && count < maxSteps) {
    var curr = queue.shift();
    count++;
    for (var d = 0; d < dirs.length; d++) {
      var nx = curr.x + dirs[d].x;
      var nz = curr.z + dirs[d].z;
      var key = nx + ',' + nz;
      if (nx < -half || nx >= half || nz < -half || nz >= half) continue;
      if (blocked[key] || visited[key]) continue;
      visited[key] = true;
      queue.push({x: nx, z: nz});
    }
  }
  return count;
}

// ─── Initialize AI snakes ───
function initAI() {
  log('=== initAI() mode=' + gameMode + ' diff=' + difficulty + ' ===');
  aiSnakes = [];
  corpses = [];
  corpseMeshes = [];

  // Clean up old corpse meshes
  if (corpseGroup) {
    while (corpseGroup.children.length) {
      var c = corpseGroup.children[0]; corpseGroup.remove(c);
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    }
  }
  corpseGroup = new THREE.Group(); scene.add(corpseGroup);

  var count = AI_COUNT[gameMode] || 0;
  if (count === 0) return;

  // Get available colors (exclude player color)
  var availableColors = SNAKE_COLOR_NAMES.filter(function(c) { return c !== playerColor; });
  for (var i = availableColors.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = availableColors[i]; availableColors[i] = availableColors[j]; availableColors[j] = tmp;
  }

  var spawnAngles = [];
  for (var i = 0; i < count; i++) {
    spawnAngles.push((Math.PI * 2 / count) * i + Math.PI / 4);
  }

  for (var i = 0; i < count; i++) {
    var angle = spawnAngles[i];
    var dist = Math.floor(gridSize * 0.35);
    var sx = Math.round(Math.cos(angle) * dist);
    var sz = Math.round(Math.sin(angle) * dist);
    sx = Math.max(-half + 2, Math.min(half - 2, sx));
    sz = Math.max(-half + 2, Math.min(half - 2, sz));

    var snakeData = [];
    for (var j = 0; j < 4; j++) {
      snakeData.push({x: sx - j, z: sz});
    }

    var initDir = snapToCardinal(Math.atan2(-sz, -sx));

    aiSnakes.push({
      id: 'ai_' + i,
      snake: snakeData,
      direction: initDir,
      color: availableColors[i] || 'red',
      alive: true,
      score: 0,
      groupData: null
    });

    log('AI ' + i + ': color=' + availableColors[i] + ' spawn=(' + sx + ',' + sz + ') dir=' + initDir);
  }
}

// ─── Evaluate safe directions for an AI snake ───
function aiEvaluateDirections(aiIndex, aiSnake, aiDir) {
  var possibleDirs = [
    aiDir,
    aiDir - TURN_ANGLE,
    aiDir + TURN_ANGLE
  ];

  var safe = [];
  var head = aiSnake[0];

  possibleDirs.forEach(function(dir) {
    var nx = head.x + Math.round(Math.cos(dir));
    var nz = head.z + Math.round(Math.sin(dir));

    if (nx < -half || nx >= half || nz < -half || nz >= half) return;
    if (aiSnake.some(function(s) { return s.x === nx && s.z === nz; })) return;
    if (obstacles.some(function(o) { return o.x === nx && o.z === nz; })) return;
    if (corpses && corpses.some(function(c) { return c.x === nx && c.z === nz; })) return;
    if (snake.some(function(s) { return s.x === nx && s.z === nz; })) return;
    if (aiSnakes) {
      for (var i = 0; i < aiSnakes.length; i++) {
        if (i === aiIndex) continue;
        var other = aiSnakes[i];
        if (!other.alive) continue;
        if (other.snake.some(function(s) { return s.x === nx && s.z === nz; })) return;
      }
    }

    safe.push(dir);
  });

  return safe;
}

// ─── Find nearest apple to a position ───
function nearestApple(x, z) {
  var best = null;
  var bestDist = Infinity;
  for (var i = 0; i < apples.length; i++) {
    if (!apples[i]) continue;
    var dx = apples[i].x - x;
    var dz = apples[i].z - z;
    var dist = Math.abs(dx) + Math.abs(dz);
    if (dist < bestDist) {
      bestDist = dist;
      best = apples[i];
    }
  }
  return best;
}

// ─── Decide direction for AI snake based on difficulty ───
function aiDecideDirection(aiIndex, diff) {
  var ai = aiSnakes[aiIndex];
  if (!ai || !ai.alive) return ai.direction;

  var safe = aiEvaluateDirections(aiIndex, ai.snake, ai.direction);
  if (safe.length === 0) return ai.direction;
  if (safe.length === 1) return snapToCardinal(safe[0]);

  // Random error based on difficulty
  var errorRate = AI_ERROR_RATE[diff] || AI_ERROR_RATE.medium;
  if (Math.random() < errorRate) {
    return snapToCardinal(safe[Math.floor(Math.random() * safe.length)]);
  }

  // Score each safe direction: prefer more open space + closer to apple
  var bestDir = safe[0];
  var bestScore = -Infinity;
  var apple = nearestApple(ai.snake[0].x, ai.snake[0].z);

  safe.forEach(function(dir) {
    var nx = ai.snake[0].x + Math.round(Math.cos(dir));
    var nz = ai.snake[0].z + Math.round(Math.sin(dir));

    // Flood-fill: count reachable open space from this position
    var space = countReachable(nx, nz, ai.snake, 25);

    // Apple attraction (smaller distance = better)
    var appleDist = apple ? (Math.abs(apple.x - nx) + Math.abs(apple.z - nz)) : 999;

    // Combined score: space is primary (avoids self-trapping), apple is secondary
    var score = space * 3 - appleDist;

    if (score > bestScore) {
      bestScore = score;
      bestDir = dir;
    }
  });

  return snapToCardinal(bestDir);
}

// ─── Cornering strategy (medium/hard difficulty) ───
function aiCorneringStrategy(aiIndex, diff) {
  var ai = aiSnakes[aiIndex];
  if (!ai || !ai.alive) return false;

  var corneringRate = AI_CORNERING_RATE[diff] || 0;
  if (Math.random() > corneringRate) return false;

  var targets = [];
  if (snake.length > 0) targets.push({snake: snake, isPlayer: true});
  for (var i = 0; i < aiSnakes.length; i++) {
    if (i === aiIndex) continue;
    if (!aiSnakes[i].alive) continue;
    targets.push({snake: aiSnakes[i].snake, isPlayer: false});
  }
  if (targets.length === 0) return false;

  for (var t = 0; t < targets.length; t++) {
    var target = targets[t];
    if (target.snake.length >= ai.snake.length) continue;
    var targetHead = target.snake[0];
    var nearWall = (
      targetHead.x <= -half + 3 || targetHead.x >= half - 3 ||
      targetHead.z <= -half + 3 || targetHead.z >= half - 3
    );
    if (nearWall) {
      var dx = targetHead.x - ai.snake[0].x;
      var dz = targetHead.z - ai.snake[0].z;
      var dist = Math.abs(dx) + Math.abs(dz);
      if (dist < 8) {
        log('AI cornering target at (' + targetHead.x + ',' + targetHead.z + ')');
        return true;
      }
    }
  }
  return false;
}

// ─── Step all AI snakes ───
function stepAI() {
  if (!aiSnakes || aiSnakes.length === 0) return;

  aiSnakes.forEach(function(ai, index) {
    if (!ai.alive) return;

    ai.direction = aiDecideDirection(index, difficulty);

    var head = ai.snake[0];
    var nx = head.x + Math.round(Math.cos(ai.direction));
    var nz = head.z + Math.round(Math.sin(ai.direction));

    // Check wall collision
    if (nx < -half || nx >= half || nz < -half || nz >= half) {
      log('AI ' + index + ' hit wall at (' + nx + ',' + nz + ')');
      aiDie(index, 'wall');
      return;
    }

    // Check self collision
    if (ai.snake.some(function(s) { return s.x === nx && s.z === nz; })) {
      log('AI ' + index + ' hit self at (' + nx + ',' + nz + ')');
      aiDie(index, 'self');
      return;
    }

    // Check obstacle collision
    if (obstacles.some(function(o) { return o.x === nx && o.z === nz; })) {
      log('AI ' + index + ' hit obstacle at (' + nx + ',' + nz + ')');
      aiDie(index, 'obstacle');
      return;
    }

    // Check corpse collision
    if (corpses && corpses.some(function(c) { return c.x === nx && c.z === nz; })) {
      log('AI ' + index + ' hit corpse at (' + nx + ',' + nz + ')');
      aiDie(index, 'corpse');
      return;
    }

    // Check collision with player snake
    if (snake.some(function(s) { return s.x === nx && s.z === nz; })) {
      log('AI ' + index + ' hit player at (' + nx + ',' + nz + ')');
      aiDie(index, 'player');
      return;
    }

    // Check collision with other AI snakes
    for (var i = 0; i < aiSnakes.length; i++) {
      if (i === index) continue;
      var other = aiSnakes[i];
      if (!other.alive) continue;
      if (other.snake.some(function(s) { return s.x === nx && s.z === nz; })) {
        log('AI ' + index + ' hit AI ' + i + ' at (' + nx + ',' + nz + ')');
        aiDie(index, 'ai');
        return;
      }
    }

    // Move forward
    ai.snake.unshift({x: nx, z: nz});

    // Check apple eating
    var ate = false;
    for (var i = 0; i < apples.length; i++) {
      if (apples[i] && nx === apples[i].x && nz === apples[i].z) {
        ai.score++;
        ate = true;
        var newA = spawnOneApple();
        apples[i] = newA;
        log('AI ' + index + ' ate apple at (' + nx + ',' + nz + ')');
        // Directional eat sound based on AI position relative to player
        if (snake.length > 0) {
          var playerHead = snake[0];
          var panX = (nx - playerHead.x) / Math.max(half, 1);
          sfxAiEat(panX);
        }
        break;
      }
    }

    if (!ate) ai.snake.pop();
  });
}

// ─── AI snake dies ───
function aiDie(aiIndex, cause) {
  var ai = aiSnakes[aiIndex];
  if (!ai || !ai.alive) return;

  ai.alive = false;

  // Convert body to corpse with color
  if (!corpses) corpses = [];
  var corpseColor = ai.color;
  ai.snake.forEach(function(seg) {
    corpses.push({x: seg.x, z: seg.z, color: corpseColor});
  });

  // Create visual corpse meshes (darkened version of snake color)
  var baseColor = SNAKE_COLORS[corpseColor] || SNAKE_COLORS.red;
  var corpseMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(baseColor).multiplyScalar(0.35),
    emissive: new THREE.Color(baseColor).multiplyScalar(0.1).getHex(),
    emissiveIntensity: .1,
    roughness: .8
  });
  var corpseGeo = new THREE.BoxGeometry(.6, .3, .6);

  ai.snake.forEach(function(seg) {
    var m = new THREE.Mesh(corpseGeo, corpseMat);
    m.position.set(gw(seg.x), .15, gw(seg.z));
    corpseGroup.add(m);
    corpseMeshes.push(m);
  });

  // Particles
  if (ai.snake.length) {
    burst(ai.snake[0].x, ai.snake[0].z, 0xff4444, 8);
  }

  // Show death message
  showAiDeathMessage(ai, cause);

  log('AI ' + aiIndex + ' died (' + cause + ') — ' + corpses.length + ' corpse segments');
}

// ─── Show AI death message on screen ───
function showAiDeathMessage(ai, cause) {
  var colorNames = {green: 'verde', red: 'roja', blue: 'azul', yellow: 'amarilla'};
  var colorName = colorNames[ai.color] || 'desconocida';

  var causeMsg = '';
  if (cause === 'wall') causeMsg = 'contra la pared';
  else if (cause === 'self') causeMsg = 'contra sí misma';
  else if (cause === 'obstacle') causeMsg = 'contra un obstáculo';
  else if (cause === 'corpse') causeMsg = 'contra un cadáver';
  else if (cause === 'player') causeMsg = 'contra el jugador';
  else if (cause === 'ai') causeMsg = 'contra otra serpiente';

  var msg = '💀 Serpiente ' + colorName + ' ha muerto por chocarse ' + causeMsg;

  var el = document.getElementById('ai-death-msg');
  if (el) {
    el.textContent = msg;
    el.classList.add('visible');
    // Auto-hide after 3 seconds
    clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(function() {
      el.classList.remove('visible');
    }, 3000);
  }
}

// ─── Refresh AI snake meshes ───
function refreshAISnakes() {
  if (!aiSnakes || !aiSnakes.length) return;

  aiSnakes.forEach(function(ai, index) {
    if (!ai.alive || !ai.groupData || !ai.groupData.bodyMs || !ai.groupData.bodyMs.length) return;
    refreshSnake(ai.snake, ai.groupData);
  });
}


// === ui.js ===
// ─── UI: Game Configuration Selectors ───
// ─── AI MODE ───

var uiState = {
  selectedColor: 'green',
  selectedMode: 'solo',
  selectedDifficulty: 'medium',
  selectedSizeMod: 0
};

// ─── Build color selector chips ───
function buildColorSelector(container) {
  var wrapper = document.createElement('div');
  wrapper.className = 'selector-row';
  wrapper.innerHTML = '<span class="selector-label">Color:</span>';

  SNAKE_COLOR_NAMES.forEach(function(colorName) {
    var chip = document.createElement('button');
    chip.className = 'color-chip' + (colorName === uiState.selectedColor ? ' selected' : '');
    chip.dataset.color = colorName;
    chip.innerHTML = '<span class="color-dot" style="background:' + SNAKE_COLORS[colorName] + '"></span>';
    chip.addEventListener('click', function() {
      wrapper.querySelectorAll('.color-chip').forEach(function(c) { c.classList.remove('selected'); });
      chip.classList.add('selected');
      uiState.selectedColor = colorName;
      updateHighScoreDisplay();
    });
    wrapper.appendChild(chip);
  });

  container.appendChild(wrapper);
}

// ─── Build mode selector chips ───
function buildModeSelector(container) {
  var wrapper = document.createElement('div');
  wrapper.className = 'selector-row';
  wrapper.innerHTML = '<span class="selector-label">Modo:</span>';

  var modeLabels = { solo: 'Solo', vs2: 'vs 2', vs3: 'vs 3', vs4: 'vs 4' };
  GAME_MODES.forEach(function(mode) {
    var chip = document.createElement('button');
    chip.className = 'mode-chip' + (mode === uiState.selectedMode ? ' selected' : '');
    chip.dataset.mode = mode;
    chip.textContent = modeLabels[mode];
    chip.addEventListener('click', function() {
      wrapper.querySelectorAll('.mode-chip').forEach(function(c) { c.classList.remove('selected'); });
      chip.classList.add('selected');
      uiState.selectedMode = mode;
      updateDifficultyVisibility();
      updateSizeDisplay();
      updateHighScoreDisplay();
    });
    wrapper.appendChild(chip);
  });

  container.appendChild(wrapper);
}

// ─── Build difficulty selector chips ───
function buildDifficultySelector(container) {
  var wrapper = document.createElement('div');
  wrapper.className = 'selector-row difficulty-row';
  wrapper.innerHTML = '<span class="selector-label">Dificultad:</span>';

  var diffLabels = { easy: 'Fácil', medium: 'Medio', hard: 'Difícil' };
  DIFFICULTIES.forEach(function(diff) {
    var chip = document.createElement('button');
    chip.className = 'diff-chip' + (diff === uiState.selectedDifficulty ? ' selected' : '');
    chip.dataset.difficulty = diff;
    chip.textContent = diffLabels[diff];
    chip.addEventListener('click', function() {
      wrapper.querySelectorAll('.diff-chip').forEach(function(c) { c.classList.remove('selected'); });
      chip.classList.add('selected');
      uiState.selectedDifficulty = diff;
      updateHighScoreDisplay();
    });
    wrapper.appendChild(chip);
  });

  container.appendChild(wrapper);
}

// ─── Build size selector (slider) ───
function buildSizeSelector(container) {
  var wrapper = document.createElement('div');
  wrapper.className = 'selector-row size-row';
  wrapper.innerHTML = '<span class="selector-label">Tamaño:</span>';

  var sliderContainer = document.createElement('div');
  sliderContainer.className = 'size-slider-container';

  var sizeLabel = document.createElement('span');
  sizeLabel.className = 'size-label';
  sliderContainer.appendChild(sizeLabel);

  var slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '-50';
  slider.max = '50';
  slider.step = '5';
  slider.value = '0';
  slider.className = 'size-slider';
  slider.addEventListener('input', function() {
    uiState.selectedSizeMod = parseInt(slider.value);
    updateSizeDisplay();
    updateHighScoreDisplay();
  });
  sliderContainer.appendChild(slider);

  wrapper.appendChild(sliderContainer);
  container.appendChild(wrapper);

  updateSizeDisplay();
}

// ─── Update size display label ───
function updateSizeDisplay() {
  var sizeLabel = document.querySelector('.size-label');
  if (!sizeLabel) return;

  var actualSize = resolveGridSize(uiState.selectedMode, uiState.selectedSizeMod);
  var modText = uiState.selectedSizeMod === 0 ? '' : (uiState.selectedSizeMod > 0 ? '+' + uiState.selectedSizeMod + '%' : uiState.selectedSizeMod + '%');

  sizeLabel.textContent = actualSize + ' × ' + actualSize + (modText ? ' (' + modText + ')' : '');
}

// ─── Update difficulty visibility (only in vs modes) ───
function updateDifficultyVisibility() {
  var diffRow = document.querySelector('.difficulty-row');
  if (!diffRow) return;
  diffRow.style.display = (uiState.selectedMode === 'solo') ? 'none' : 'flex';
}

// ─── Update high score display ───
function updateHighScoreDisplay() {
  var config = getGameConfig();
  var key = getHighScoreKey(config.mode, config.difficulty, config.gridSize);
  var hs = parseInt(localStorage.getItem(key) || '0');
  highScore = hs;
  if (highscoreEl) {
    highscoreEl.textContent = hs;
  }
}

// ─── Get current game config from UI state ───
function getGameConfig() {
  return {
    mode: uiState.selectedMode,
    difficulty: uiState.selectedDifficulty,
    color: uiState.selectedColor,
    gridSize: resolveGridSize(uiState.selectedMode, uiState.selectedSizeMod),
    gridSizeModifier: uiState.selectedSizeMod
  };
}

// ─── Initialize UI selectors ───
function initUISelectors() {
  var overlay = document.getElementById('overlay');
  if (!overlay) return;

  // Create selectors container
  var selectorsDiv = document.createElement('div');
  selectorsDiv.id = 'selectors';

  buildColorSelector(selectorsDiv);
  buildModeSelector(selectorsDiv);
  buildDifficultySelector(selectorsDiv);
  buildSizeSelector(selectorsDiv);

  // Insert selectors before the start button
  var startBtn = document.getElementById('start-btn');
  if (startBtn) {
    overlay.insertBefore(selectorsDiv, startBtn);
  }

  // Initial visibility state
  updateDifficultyVisibility();
  updateHighScoreDisplay();
}

// ─── Module exports (for testing — ignored in browser) ───
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    get uiState() { return uiState; },
    getGameConfig: getGameConfig,
    buildColorSelector: buildColorSelector,
    buildModeSelector: buildModeSelector,
    buildDifficultySelector: buildDifficultySelector,
    buildSizeSelector: buildSizeSelector,
    updateDifficultyVisibility: updateDifficultyVisibility,
    updateSizeDisplay: updateSizeDisplay,
    updateHighScoreDisplay: updateHighScoreDisplay,
    initUISelectors: initUISelectors
  };
}


// === game.js ===
// ─── GAME LOGIC ───
function initGame() {
  log('=== initGame() ===');

  // ─── AI MODE: rebuild board with dynamic grid size ───
  half = gridSize / 2;
  rebuildBoard(gridSize);

  // Clear old snake groups from sGroup
   while(sGroup.children.length) { var c = sGroup.children[0]; sGroup.remove(c); }
   // Clear old corpse meshes
   if(corpseGroup) { while(corpseGroup.children.length) { var cc = corpseGroup.children[0]; corpseGroup.remove(cc); } }

  snake=[]; direction=0; score=0; gameOver=false;
  obstacles=[]; apples=[];
  scoreEl.textContent='0';
  snake.push({x:-5,z:0}); snake.push({x:-6,z:0});
  snake.push({x:-7,z:0}); snake.push({x:-8,z:0});
  log('Snake data: ' + snake.length + ' segments');
   playerGroupData = buildSnake(playerColor);
   log('buildSnake done: headM=' + (headM ? 'OK' : 'NULL') + ', bodyMs=' + bodyMs.length);
  buildObstacles(); buildApples();
  refreshObstacles();
  initApples();
  log('Apples: ' + apples.filter(Boolean).length + '/' + apples.length);
  refreshSnake();
  log('refreshSnake done: head at (' + (headM ? headM.position.x : 'NULL') + ',' + (headM ? headM.position.z : 'NULL') + ')');
  headSmoothX = gw(-5);
  headSmoothZ = gw(0);
  camSmoothX = gw(-5) - 5;
  camSmoothZ = gw(0);
  lookSmoothX = gw(-5) + 3;
  lookSmoothZ = gw(0);
  log('Snake: '+snake.length+' seg, dir=0, grid=' + gridSize + ', half=' + half);
}

function turnL(){if(!running||gameOver)return;direction-=TURN_ANGLE;sfxTurn();}
function turnR(){if(!running||gameOver)return;direction+=TURN_ANGLE;sfxTurn();}

function step() {
  if(gameOver) return;
  var h=snake[0];
  var nx=h.x+Math.round(Math.cos(direction));
  var nz=h.z+Math.round(Math.sin(direction));
  if(nx<-half||nx>=half||nz<-half||nz>=half){log('Wall hit ('+nx+','+nz+')');die('wall');return;}
   if(snake.some(function(s){return s.x===nx&&s.z===nz;})){log('Self hit ('+nx+','+nz+')');die('self');return;}
   if(obstacles.some(function(o){return o.x===nx&&o.z===nz;})){log('Obstacle hit ('+nx+','+nz+')');die('obstacle');return;}
  // ─── AI MODE: collision with AI snake bodies ───
  if(aiSnakes) {
    for(var k = 0; k < aiSnakes.length; k++) {
      if(!aiSnakes[k].alive) continue;
      var aiBody = aiSnakes[k].snake;
      for(var j = 0; j < aiBody.length; j++) {
        if(aiBody[j].x === nx && aiBody[j].z === nz) {
          log('Hit AI#'+k+' body at ('+nx+','+nz+')');
          die('ai');
          return;
        }
      }
    }
  }
  // ─── AI MODE: collision with corpses ───
   if(corpses) {
     for(var c = 0; c < corpses.length; c++) {
       if(corpses[c].x === nx && corpses[c].z === nz) {
         log('Hit corpse at ('+nx+','+nz+')');
         die('corpse');
         return;
       }
     }
   }
  snake.unshift({x:nx,z:nz});
  var ate = false;
  for(var i = 0; i < apples.length; i++) {
    if(apples[i] && nx===apples[i].x && nz===apples[i].z) {
      score++; scoreEl.textContent=score; ate=true;
      sfxEat(); burst(apples[i].x, apples[i].z, 0xff6644, 10);
      log('Eat apple at ('+apples[i].x+','+apples[i].z+') score='+score);
      var newA = spawnOneApple();
      apples[i] = newA;
      if(score % OBSTACLE_SPAWN_EVERY === 0) spawnObstacle();
      break;
    }
  }
  if(!ate) snake.pop();
  refreshApples();
}

function die(cause) {
  log('GAME OVER score='+score+' cause='+(cause||'unknown'));
  gameOver=true; running=false; sfxDie();
  if(snake.length) burst(snake[0].x,snake[0].z,0xff0000,12);
  // ─── AI MODE: save high score per mode/difficulty/gridSize ───
  var hsKey = getHighScoreKey(gameMode, difficulty, gridSize);
  if(score>highScore){highScore=score;localStorage.setItem(hsKey,highScore);highscoreEl.textContent=highScore;}
  totalGames++;
  localStorage.setItem('snake3d_games', totalGames);
  gamesCountEl.textContent = totalGames;
  // Death cause message
  var causeMsg = '';
  if(cause === 'wall') causeMsg = 'Has chocado contra la pared';
  else if(cause === 'self') causeMsg = 'Te has mordido a ti mismo';
  else if(cause === 'obstacle') causeMsg = 'Has chocado contra un obstáculo';
  else if(cause === 'corpse') causeMsg = 'Has chocado contra un cadáver';
  else if(cause === 'ai') causeMsg = 'Una serpiente enemiga te ha alcanzado';
  finalScoreEl.textContent = 'Puntuación: ' + score + ' 🍎\n' + (causeMsg || 'Game Over');
  finalScoreEl.style.display='block';
  startBtn.textContent='REINTENTAR';
  overlay.classList.remove('hidden');
  hintL.style.opacity='1'; hintR.style.opacity='1';
}

// ─── CAMERA (framerate-independent, head-interpolated) ───
var isMobile = window.innerWidth < 600;
var CAM_SMOOTH_SPEED = 8; // smoothing factor (higher = faster follow)
var HEAD_SMOOTH_SPEED = 12; // head position smoothing (higher = snappier)
var headSmoothX = 0, headSmoothZ = 0; // interpolated head position for camera
function updateCam(dt) {
  if(!snake.length) return;
  var camDist = isMobile ? 7 : 5;
  var camHeight = isMobile ? 6 : 4.5;
  var lookAhead = isMobile ? 4 : 3;
  var dx = Math.cos(direction);
  var dz = Math.sin(direction);
  // Smooth head position (interpolate between grid cells)
  var headTargetX = gw(snake[0].x);
  var headTargetZ = gw(snake[0].z);
  var headFactor = 1 - Math.exp(-HEAD_SMOOTH_SPEED * dt);
  headSmoothX += (headTargetX - headSmoothX) * headFactor;
  headSmoothZ += (headTargetZ - headSmoothZ) * headFactor;
  // Camera follows smoothed head
  var idealX = headSmoothX - dx * camDist;
  var idealZ = headSmoothZ - dz * camDist;
  var factor = 1 - Math.exp(-CAM_SMOOTH_SPEED * dt);
  camSmoothX += (idealX - camSmoothX) * factor;
  camSmoothZ += (idealZ - camSmoothZ) * factor;
  camera.position.x = camSmoothX;
  camera.position.y = camHeight;
  camera.position.z = camSmoothZ;
  var targetLookX = headSmoothX + dx * lookAhead;
  var targetLookZ = headSmoothZ + dz * lookAhead;
  lookSmoothX += (targetLookX - lookSmoothX) * factor;
  lookSmoothZ += (targetLookZ - lookSmoothZ) * factor;
  camera.lookAt(lookSmoothX, 0, lookSmoothZ);
  pLight.position.set(headSmoothX, 5, headSmoothZ);
}


// === controls.js ===
// ─── CONTROLS ───
log('9. Controls ready');
document.addEventListener('keydown', function(e) {
  if(e.key==='ArrowLeft'||e.key==='a'||e.key==='A'){e.preventDefault();turnL();}
  if(e.key==='ArrowRight'||e.key==='d'||e.key==='D'){e.preventDefault();turnR();}
});
document.getElementById('tz-left').addEventListener('touchstart',function(e){e.preventDefault();turnL();},{passive:false});
document.getElementById('tz-right').addEventListener('touchstart',function(e){e.preventDefault();turnR();},{passive:false});


