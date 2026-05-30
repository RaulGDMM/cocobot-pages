// ─── Tests: config.js (baseline) ───
// Tests for existing config constants and utility functions.

describe('config.js', () => {
  describe('grid and movement constants', () => {
    test('GRID_SIZE is 22', () => {
      expect(GRID_SIZE).toBe(22);
    });

    test('MOVE_INTERVAL is 200ms', () => {
      expect(MOVE_INTERVAL).toBe(200);
    });

    test('TURN_ANGLE is 90 degrees (π/2)', () => {
      expect(TURN_ANGLE).toBeCloseTo(Math.PI / 2);
    });

    test('half is GRID_SIZE / 2', () => {
      expect(half).toBe(GRID_SIZE / 2);
      expect(half).toBe(11);
    });
  });

  describe('apple constants', () => {
    test('NUM_APPLES is 3', () => {
      expect(NUM_APPLES).toBe(3);
    });
  });

  describe('obstacle constants', () => {
    test('OBSTACLE_SPAWN_EVERY is 3', () => {
      expect(OBSTACLE_SPAWN_EVERY).toBe(3);
    });

    test('OBSTACLE_MIN_DIST_SNAKE is 6', () => {
      expect(OBSTACLE_MIN_DIST_SNAKE).toBe(6);
    });

    test('OBSTACLE_MIN_DIST_EACH is 3', () => {
      expect(OBSTACLE_MIN_DIST_EACH).toBe(3);
    });

    test('OBSTACLE_MIN_DIST_APPLE is 3', () => {
      expect(OBSTACLE_MIN_DIST_APPLE).toBe(3);
    });

    test('MAX_OBSTACLES is 30', () => {
      expect(MAX_OBSTACLES).toBe(30);
    });
  });

  describe('logging functions', () => {
    test('log is a function', () => {
      expect(typeof log).toBe('function');
    });

    test('log appends to logs array', () => {
      const before = logs.length;
      log('test message');
      expect(logs.length).toBe(before + 1);
      expect(logs[logs.length - 1]).toContain('test message');
    });

    test('log updates debug element text', () => {
      log('debug check');
      expect(document.getElementById('debug').textContent).toContain('debug check');
    });

    test('log caps at 80 entries', () => {
      // Fill up to 80
      for (let i = 0; i < 100; i++) {
        log('fill ' + i);
      }
      expect(logs.length).toBe(80);
      // Oldest entries should have been shifted out
      expect(logs[0]).toContain('fill 20');
    });

    test('showErr is a function', () => {
      expect(typeof showErr).toBe('function');
    });

    test('showErr displays message and shows err-box', () => {
      const errBox = document.getElementById('err-box');
      showErr('test error');
      expect(errBox.textContent).toBe('test error');
      expect(errBox.style.display).toBe('block');
    });

    test('showErr hides err-box when message is empty', () => {
      const errBox = document.getElementById('err-box');
      showErr('temp');
      showErr('');
      expect(errBox.textContent).toBe('');
      expect(errBox.style.display).toBe('none');
    });

    test('showErr hides err-box when message is falsy', () => {
      const errBox = document.getElementById('err-box');
      showErr('temp');
      showErr(null);
      expect(errBox.style.display).toBe('none');
    });
  });

  describe('error handler', () => {
    test('window.onerror is configured', () => {
      expect(typeof window.onerror).toBe('function');
    });
  });

  // ─── AI MODE: SNAKE_COLORS ───
  describe('SNAKE_COLORS', () => {
    test('has 4 color definitions', () => {
      expect(Object.keys(SNAKE_COLORS).length).toBe(4);
    });

    test('has green, red, blue, yellow', () => {
      expect(SNAKE_COLORS.green).toBe('#00cc44');
      expect(SNAKE_COLORS.red).toBe('#cc2222');
      expect(SNAKE_COLORS.blue).toBe('#2266cc');
      expect(SNAKE_COLORS.yellow).toBe('#ccaa00');
    });

    test('SNAKE_COLOR_NAMES has 4 entries', () => {
      expect(SNAKE_COLOR_NAMES.length).toBe(4);
      expect(SNAKE_COLOR_NAMES).toEqual(['green', 'red', 'blue', 'yellow']);
    });
  });

  // ─── AI MODE: GAME_MODES ───
  describe('GAME_MODES', () => {
    test('has 4 modes', () => {
      expect(GAME_MODES.length).toBe(4);
      expect(GAME_MODES).toEqual(['solo', 'vs2', 'vs3', 'vs4']);
    });
  });

  // ─── AI MODE: DIFFICULTIES ───
  describe('DIFFICULTIES', () => {
    test('has 3 difficulty levels', () => {
      expect(DIFFICULTIES.length).toBe(3);
      expect(DIFFICULTIES).toEqual(['easy', 'medium', 'hard']);
    });
  });

  // ─── AI MODE: AI_COUNT ───
  describe('AI_COUNT', () => {
    test('solo has 0 AI', () => {
      expect(AI_COUNT.solo).toBe(0);
    });
    test('vs2 has 1 AI', () => {
      expect(AI_COUNT.vs2).toBe(1);
    });
    test('vs3 has 2 AI', () => {
      expect(AI_COUNT.vs3).toBe(2);
    });
    test('vs4 has 3 AI', () => {
      expect(AI_COUNT.vs4).toBe(3);
    });
  });

  // ─── AI MODE: AI_ERROR_RATE ───
  describe('AI_ERROR_RATE', () => {
    test('easy has 10% error rate', () => {
      expect(AI_ERROR_RATE.easy).toBe(0.10);
    });
    test('medium has 2% error rate', () => {
      expect(AI_ERROR_RATE.medium).toBe(0.02);
    });
    test('hard has 0.5% error rate', () => {
      expect(AI_ERROR_RATE.hard).toBe(0.005);
    });
  });

  // ─── AI MODE: AI_CORNERING_RATE ───
  describe('AI_CORNERING_RATE', () => {
    test('easy has 0% cornering', () => {
      expect(AI_CORNERING_RATE.easy).toBe(0.00);
    });
    test('medium has 70% cornering', () => {
      expect(AI_CORNERING_RATE.medium).toBe(0.70);
    });
    test('hard has 95% cornering', () => {
      expect(AI_CORNERING_RATE.hard).toBe(0.95);
    });
  });

  // ─── AI MODE: GRID limits ───
  describe('GRID_MIN and GRID_MAX', () => {
    test('GRID_MIN is 16', () => {
      expect(GRID_MIN).toBe(16);
    });
    test('GRID_MAX is 50', () => {
      expect(GRID_MAX).toBe(50);
    });
  });

  // ─── AI MODE: resolveGridSize() ───
  describe('resolveGridSize(mode, percentageModifier)', () => {
    test('solo base (modifier 0) returns 22', () => {
      expect(resolveGridSize('solo', 0)).toBe(22);
    });
    test('vs2 base (modifier 0) returns 28', () => {
      expect(resolveGridSize('vs2', 0)).toBe(28);
    });
    test('vs3 base (modifier 0) returns 34 (even)', () => {
      expect(resolveGridSize('vs3', 0)).toBe(34);
    });
    test('vs4 base (modifier 0) returns 40 (even)', () => {
      expect(resolveGridSize('vs4', 0)).toBe(40);
    });

    // Modifier +50%
    test('solo +50% returns 34 (even)', () => {
      expect(resolveGridSize('solo', 50)).toBe(34);
    });
    test('vs2 +50% returns 42', () => {
      expect(resolveGridSize('vs2', 50)).toBe(42);
    });
    test('vs3 +50% clamps to 50', () => {
      expect(resolveGridSize('vs3', 50)).toBe(50);
    });
    test('vs4 +50% clamps to 50', () => {
      expect(resolveGridSize('vs4', 50)).toBe(50);
    });

    // Modifier -50%
    test('solo -50% clamps to 16', () => {
      expect(resolveGridSize('solo', -50)).toBe(16);
    });
    test('vs2 -50% clamps to 16', () => {
      expect(resolveGridSize('vs2', -50)).toBe(16);
    });
    test('vs3 -50% returns 18 (even)', () => {
      expect(resolveGridSize('vs3', -50)).toBe(18);
    });
    test('vs4 -50% returns 20', () => {
      expect(resolveGridSize('vs4', -50)).toBe(20);
    });

    // Intermediate modifiers
    test('solo +25% returns 28', () => {
      expect(resolveGridSize('solo', 25)).toBe(28);
    });
    test('solo -25% returns 18 (even)', () => {
      expect(resolveGridSize('solo', -25)).toBe(18);
    });
    test('vs2 +10% returns 32 (even)', () => {
      expect(resolveGridSize('vs2', 10)).toBe(32);
    });
    test('vs3 -10% returns 30', () => {
      expect(resolveGridSize('vs3', -10)).toBe(30);
    });

    // Edge cases
    test('unknown mode defaults to solo multiplier', () => {
      expect(resolveGridSize('unknown', 0)).toBe(22);
    });
    test('modifier beyond range clamps to 50', () => {
      expect(resolveGridSize('vs2', 100)).toBe(50);
    });
    test('undefined modifier defaults to 0', () => {
      expect(resolveGridSize('solo', undefined)).toBe(22);
    });
  });

  // ─── AI MODE: getHighScoreKey() ───
  describe('getHighScoreKey(mode, difficulty, gridSize)', () => {
    test('solo easy 22', () => {
      expect(getHighScoreKey('solo', 'easy', 22)).toBe('snake3d_hs_solo_22_easy');
    });
    test('vs4 hard 39', () => {
      expect(getHighScoreKey('vs4', 'hard', 39)).toBe('snake3d_hs_vs4_39_hard');
    });
    test('vs2 medium 28', () => {
      expect(getHighScoreKey('vs2', 'medium', 28)).toBe('snake3d_hs_vs2_28_medium');
    });
    test('different grid sizes produce different keys', () => {
      expect(getHighScoreKey('solo', 'easy', 22)).not.toEqual(
        getHighScoreKey('solo', 'easy', 28)
      );
    });
    test('different difficulties produce different keys', () => {
      expect(getHighScoreKey('solo', 'easy', 22)).not.toEqual(
        getHighScoreKey('solo', 'hard', 22)
      );
    });
    test('different modes produce different keys', () => {
      expect(getHighScoreKey('solo', 'medium', 22)).not.toEqual(
        getHighScoreKey('vs2', 'medium', 28)
      );
    });
  });
});
