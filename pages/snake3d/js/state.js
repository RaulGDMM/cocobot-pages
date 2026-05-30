// ─── STATE ───
var snake = [];
var direction = 0;
var apples = [];
var obstacles = [];
var score = 0;
var highScore = parseInt(localStorage.getItem('snake3d_hs') || '0');
var totalGames = parseInt(localStorage.getItem('snake3d_games') || '0');
var running = false;
var lastMoveTime = 0;
var gameOver = false;
var camSmoothX = 0, camSmoothZ = 0;
var lookSmoothX = 0, lookSmoothZ = 0;

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
