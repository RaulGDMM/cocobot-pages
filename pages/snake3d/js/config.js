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

// ─── Module exports (for testing — ignored in browser) ───
if(typeof module !== 'undefined' && module.exports) {
  module.exports = { log, showErr, get logs() { return logs; } };
}
