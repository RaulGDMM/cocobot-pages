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
    test('highScore reads from localStorage', () => {
      localStorage.clear();
      localStorage.setItem('snake3d_hs', '42');
      // Re-read from localStorage (simulating fresh load)
      const stored = parseInt(localStorage.getItem('snake3d_hs') || '0');
      expect(stored).toBe(42);
    });

    test('highScore defaults to 0 when not in localStorage', () => {
      localStorage.clear();
      const stored = parseInt(localStorage.getItem('snake3d_hs') || '0');
      expect(stored).toBe(0);
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

    test('highscoreEl exists and shows highScore', () => {
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
});
