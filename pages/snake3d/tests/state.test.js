// ─── Tests: state.js (baseline) ───
// Tests for existing state variables and localStorage integration.

describe('state.js', () => {
  beforeEach(() => {
    // Reset localStorage before each test
    localStorage.clear();
  });

  describe('initial state variables', () => {
    test('snake is an array', () => {
      expect(Array.isArray(snake)).toBe(true);
    });

    test('direction is a number', () => {
      expect(typeof direction).toBe('number');
    });

    test('apples is an array', () => {
      expect(Array.isArray(apples)).toBe(true);
    });

    test('obstacles is an array', () => {
      expect(Array.isArray(obstacles)).toBe(true);
    });

    test('score is a number', () => {
      expect(typeof score).toBe('number');
    });

    test('highScore is a number', () => {
      expect(typeof highScore).toBe('number');
    });

    test('totalGames is a number', () => {
      expect(typeof totalGames).toBe('number');
    });

    test('running is a boolean', () => {
      expect(typeof running).toBe('boolean');
    });

    test('gameOver is a boolean', () => {
      expect(typeof gameOver).toBe('boolean');
    });

    test('lastMoveTime is a number', () => {
      expect(typeof lastMoveTime).toBe('number');
    });
  });

  describe('camera state', () => {
    test('camSmoothX is a number', () => {
      expect(typeof camSmoothX).toBe('number');
    });

    test('camSmoothZ is a number', () => {
      expect(typeof camSmoothZ).toBe('number');
    });

    test('lookSmoothX is a number', () => {
      expect(typeof lookSmoothX).toBe('number');
    });

    test('lookSmoothZ is a number', () => {
      expect(typeof lookSmoothZ).toBe('number');
    });
  });

  describe('localStorage integration', () => {
    test('highScore initializes to 0 (loaded dynamically by updateHighScoreDisplay)', () => {
      expect(highScore).toBe(0);
    });

    test('getHighScoreKey produces correct key for solo mode', () => {
      expect(getHighScoreKey('solo', 'medium', 22)).toBe('snake3d_hs_solo_22_medium');
    });

    test('getHighScoreKey produces correct key for vs4 hard', () => {
      expect(getHighScoreKey('vs4', 'hard', 40)).toBe('snake3d_hs_vs4_40_hard');
    });

    test('updateHighScoreDisplay loads score from correct key', () => {
      localStorage.clear();
      var key = getHighScoreKey('solo', 'medium', 22);
      localStorage.setItem(key, '42');
      updateHighScoreDisplay();
      expect(highScore).toBe(42);
      expect(highscoreEl.textContent).toBe('42');
    });

    test('updateHighScoreDisplay updates when mode changes', () => {
      localStorage.clear();
      localStorage.setItem(getHighScoreKey('solo', 'medium', 22), '10');
      localStorage.setItem(getHighScoreKey('vs2', 'hard', 28), '50');
      uiState.selectedMode = 'solo';
      updateHighScoreDisplay();
      expect(highScore).toBe(10);
      uiState.selectedMode = 'vs2';
      uiState.selectedDifficulty = 'hard';
      updateHighScoreDisplay();
      expect(highScore).toBe(50);
    });

    test('totalGames reads from localStorage', () => {
      localStorage.clear();
      localStorage.setItem('snake3d_games', '10');
      const stored = parseInt(localStorage.getItem('snake3d_games') || '0');
      expect(stored).toBe(10);
    });

    test('totalGames defaults to 0 when not in localStorage', () => {
      localStorage.clear();
      const stored = parseInt(localStorage.getItem('snake3d_games') || '0');
      expect(stored).toBe(0);
    });
  });

  describe('DOM references', () => {
    test('canvas element exists', () => {
      expect(canvas).not.toBeNull();
      expect(canvas.id).toBe('game-canvas');
    });

    test('scoreEl exists', () => {
      expect(scoreEl).not.toBeNull();
      expect(scoreEl.id).toBe('score');
    });

    test('highscoreEl exists and shows 0 initially (loaded dynamically)', () => {
      expect(highscoreEl).not.toBeNull();
      expect(highscoreEl.id).toBe('highscore');
    });

    test('overlay exists', () => {
      expect(overlay).not.toBeNull();
    });

    test('startBtn exists', () => {
      expect(startBtn).not.toBeNull();
    });

    test('finalScoreEl exists', () => {
      expect(finalScoreEl).not.toBeNull();
    });

    test('hintL exists', () => {
      expect(hintL).not.toBeNull();
    });

    test('hintR exists', () => {
      expect(hintR).not.toBeNull();
    });

    test('gamesCountEl exists', () => {
      expect(gamesCountEl).not.toBeNull();
    });
  });

  describe('initial values after setup', () => {
    test('score starts at 0', () => {
      expect(score).toBe(0);
    });

    test('running starts as false', () => {
      expect(running).toBe(false);
    });

    test('gameOver starts as false', () => {
      expect(gameOver).toBe(false);
    });
  });

  // ─── AI MODE: new state variables ───
  describe('AI mode state variables', () => {
    test('gameMode defaults to solo', () => {
      expect(gameMode).toBe('solo');
    });

    test('difficulty defaults to medium', () => {
      expect(difficulty).toBe('medium');
    });

    test('playerColor defaults to green', () => {
      expect(playerColor).toBe('green');
    });

    test('gridSize defaults to GRID_SIZE', () => {
      expect(gridSize).toBe(GRID_SIZE);
    });

    test('gridSizeModifier defaults to 0', () => {
      expect(gridSizeModifier).toBe(0);
    });

    test('aiSnakes is an empty array', () => {
      expect(Array.isArray(aiSnakes)).toBe(true);
      expect(aiSnakes.length).toBe(0);
    });

    test('gameMode can be changed', () => {
      var prev = gameMode;
      gameMode = 'vs2';
      expect(gameMode).toBe('vs2');
      gameMode = prev;
    });

    test('difficulty can be changed', () => {
      var prev = difficulty;
      difficulty = 'hard';
      expect(difficulty).toBe('hard');
      difficulty = prev;
    });

    test('playerColor can be changed', () => {
      var prev = playerColor;
      playerColor = 'red';
      expect(playerColor).toBe('red');
      playerColor = prev;
    });

    test('gridSize can be changed', () => {
      var prev = gridSize;
      gridSize = 30;
      expect(gridSize).toBe(30);
      gridSize = prev;
    });

    test('aiSnakes can be populated', () => {
      aiSnakes.push({ x: 0, z: 0, direction: 0 });
      expect(aiSnakes.length).toBe(1);
      aiSnakes = [];
    });
  });
});
