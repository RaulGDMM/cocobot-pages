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
var paused = false;
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

// ─── GRID BOUNDARIES (for dynamic shrinking) ───
// Initially equal to -half / half. Updated when grid shrinks.
var gridMinX = -half;
var gridMaxX = half;   // exclusive
var gridMinZ = -half;
var gridMaxZ = half;   // exclusive

// ─── SHRINK COUNTDOWNS ───
// Array of independent countdowns. Each has:
//   startTime, duration, oldMinX/MaxX/MinZ/MaxZ, newMinX/MaxX/MinZ/MaxZ
//   newGridSize, messageShown (bool), flashPhase (number)
var shrinkCountdowns = [];

// ─── SHRINK FLASH STATE (global, not per-countdown) ───
// Tracks whether the flash is currently ON for tick sound deduplication
var _shrinkFlashOn = false;

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

// ─── Module exports (for testing — ignored in browser) ───
if(typeof module !== 'undefined' && module.exports) {
  module.exports = {
    get snake() { return snake; }, set snake(v) { /* global, can't reassign */ },
    get direction() { return direction; },
    get apples() { return apples; },
    get obstacles() { return obstacles; },
    get score() { return score; }, set score(v) { global.score = v; },
    get highScore() { return highScore; }, set highScore(v) { global.highScore = v; },
    get totalGames() { return totalGames; }, set totalGames(v) { global.totalGames = v; },
    get running() { return running; }, set running(v) { global.running = v; },
    get gameOver() { return gameOver; }, set gameOver(v) { global.gameOver = v; },
    get lastMoveTime() { return lastMoveTime; },
    get camSmoothX() { return camSmoothX; },
    get camSmoothZ() { return camSmoothZ; },
    get lookSmoothX() { return lookSmoothX; },
    get lookSmoothZ() { return lookSmoothZ; },
  };
}
