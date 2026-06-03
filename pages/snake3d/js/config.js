// ─── CONFIG ───
var GRID_SIZE = 22;
var MOVE_INTERVAL = 200;
var TURN_ANGLE = Math.PI / 2;
var half = GRID_SIZE / 2;
// Base values for standard grid (22×22 = 484 cells)
var NUM_APPLES = 3;
var OBSTACLE_SPAWN_EVERY = 3;
var OBSTACLE_MIN_DIST_SNAKE = 6;
var OBSTACLE_MIN_DIST_EACH = 3;
var OBSTACLE_MIN_DIST_APPLE = 3;
var MAX_OBSTACLES = 30;

// ─── Proportional scaling based on grid size ───
// Reference: standard solo grid (22×22 = 484 cells)
var STANDARD_GRID_CELLS = 484;

// Calculate number of apples proportional to grid area
// Base: 3 apples for 484 cells, minimum 3
function calcNumApples(gridSize) {
  var cells = gridSize * gridSize;
  var result = Math.round(3 * (cells / STANDARD_GRID_CELLS));
  return Math.max(3, result);
}

// Calculate max obstacles proportional to grid area
// Base: 30 obstacles for 484 cells, minimum 5
function calcMaxObstacles(gridSize) {
  var cells = gridSize * gridSize;
  var result = Math.round(30 * (cells / STANDARD_GRID_CELLS));
  return Math.max(5, result);
}

// Calculate obstacle spawn frequency (score interval)
// Base: every 3 points for 484 cells, minimum 1
function calcObstacleSpawnEvery(gridSize) {
  var cells = gridSize * gridSize;
  var result = Math.round(3 * (STANDARD_GRID_CELLS / cells));
  return Math.max(1, result);
}

// ─── AI MODE ───
// Snake colors: player picks one, AI get random from remaining
var SNAKE_COLORS = {
  green: '#00cc44',
  red: '#cc2222',
  blue: '#2266cc',
  yellow: '#ccaa00',
  cyan: '#00cccc',
  purple: '#aa22cc',
  orange: '#cc6600',
  salmon: '#ff6666'
  };
  var SNAKE_COLOR_NAMES = ['green', 'red', 'blue', 'yellow', 'cyan', 'purple', 'orange', 'salmon'];

// Game modes: solo, vs2, vs3, vs4, vs5, vs6, vs7, vs8
var GAME_MODES = ['solo', 'vs2', 'vs3', 'vs4', 'vs5', 'vs6', 'vs7', 'vs8'];

// Mode → base grid size multiplier
// Linear +0.25 per mode. Base grid 22:
//   solo=22, vs2=28, vs3=34, vs4=38, vs5=44, vs6=50, vs7=56, vs8=60
var MODE_GRID_MULTIPLIER = {
  solo: 1.0,
  vs2: 1.25,
  vs3: 1.50,
  vs4: 1.75,
  vs5: 2.00,
  vs6: 2.25,
  vs7: 2.50,
  vs8: 2.75
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
var GRID_MAX = 66;

// ─── GRID SHRINKING ───
// Proportional shrinking: when all AI snakes die, grid returns to solo size (22).
// Each AI death shrinks the grid by (initialGridSize - 22) / initialAICount.
// The step is computed dynamically based on the mode and number of AI snakes.
// Legacy SHRINK_STEP kept for backward compat with tests using solo/vs2/vs3.
var SHRINK_STEP = 6;
// Duration of shrink warning countdown in seconds
var SHRINK_WARNING_DURATION = 10;
// Show on-screen message after this many seconds (halfway)
var SHRINK_MESSAGE_DELAY = 5;

// Calculate target grid size after N deaths from initial size.
// Uses proportional formula: target = 22 + (initialGridSize - 22) * aliveAI / initialAICount.
// When all AI die (deaths >= initialAICount), returns solo size (22).
// Forces even result for cell alignment.
// Clamped to [GRID_MIN, initialGridSize].
function calcShrinkTarget(initialGridSize, deaths, initialAICount) {
  if (initialAICount <= 0) {
    // Legacy: no AI, use fixed step
    var result = initialGridSize - (deaths * SHRINK_STEP);
    return Math.max(GRID_MIN, result);
  }
  var soloSize = 22;
  var aliveAI = initialAICount - deaths;
  if (aliveAI <= 0) return Math.max(GRID_MIN, soloSize);
  var result = Math.round(soloSize + (initialGridSize - soloSize) * aliveAI / initialAICount);
  // Force even
  if (result % 2 !== 0) result += 1;
  return Math.max(GRID_MIN, Math.min(result, initialGridSize));
}

// Calculate next shrink target from current state.
// currentGridSize: the grid size at time of call
// initialAICount: number of AI snakes at game start
// deaths: total deaths (AI deaths + player death if applicable)
// playerAlive: whether the player snake is still alive
// Returns the target grid size after this death, or GRID_MIN if all snakes dead.
function calcNextShrinkSize(currentGridSize, initialAICount, deaths, playerAlive) {
  if (initialAICount <= 0) {
    // Legacy: no AI, use fixed step
    var result = currentGridSize - SHRINK_STEP;
    return Math.max(GRID_MIN, result);
  }
  var soloSize = 22;
  var totalSnakes = initialAICount + 1; // AI + player
  var aliveAI = initialAICount - (deaths - (playerAlive ? 0 : 1));
  if (aliveAI < 0) aliveAI = 0;
  var totalAlive = aliveAI + (playerAlive ? 1 : 0);
  if (totalAlive <= 0) return Math.max(GRID_MIN, soloSize);
  // Proportional: each death shrinks grid by (currentGridSize - soloSize) / totalSnakes
  var result = Math.round(soloSize + (currentGridSize - soloSize) * totalAlive / totalSnakes);
  // Force even
  if (result % 2 !== 0) result += 1;
  return Math.max(GRID_MIN, Math.min(result, currentGridSize));
}

// Check if further shrinking is possible
function canShrinkFurther(currentGridSize) {
  return currentGridSize > GRID_MIN;
}

// Number of AI snakes per mode
var AI_COUNT = {
  solo: 0,
  vs2: 1,
  vs3: 2,
  vs4: 3,
  vs5: 4,
  vs6: 5,
  vs7: 6,
  vs8: 7
};

// ─── AI MODE: resolveGridSize(mode, percentageModifier) ───
// mode: 'solo'|'vs2'|'vs3'|'vs4'|'vs5'|'vs6'|'vs7'|'vs8'
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
  module.exports = { log, showErr, get logs() { return logs; },
    calcShrinkTarget, calcNextShrinkSize, canShrinkFurther,
    SHRINK_STEP, SHRINK_WARNING_DURATION, SHRINK_MESSAGE_DELAY
  };
}
