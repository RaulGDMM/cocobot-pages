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
    test('has 8 color definitions', () => {
      expect(Object.keys(SNAKE_COLORS).length).toBe(8);
    });

    test('has green, red, blue, yellow, cyan, purple, orange, salmon', () => {
      expect(SNAKE_COLORS.green).toBe('#00cc44');
      expect(SNAKE_COLORS.red).toBe('#cc2222');
      expect(SNAKE_COLORS.blue).toBe('#2266cc');
      expect(SNAKE_COLORS.yellow).toBe('#ccaa00');
      expect(SNAKE_COLORS.cyan).toBe('#00cccc');
      expect(SNAKE_COLORS.purple).toBe('#aa22cc');
      expect(SNAKE_COLORS.orange).toBe('#cc6600');
      expect(SNAKE_COLORS.salmon).toBe('#ff6666');
    });

    test('SNAKE_COLOR_NAMES has 8 entries', () => {
      expect(SNAKE_COLOR_NAMES.length).toBe(8);
      expect(SNAKE_COLOR_NAMES).toEqual(['green', 'red', 'blue', 'yellow', 'cyan', 'purple', 'orange', 'salmon']);
    });
  });

  // ─── AI MODE: GAME_MODES ───
  describe('GAME_MODES', () => {
    test('has 8 modes', () => {
      expect(GAME_MODES.length).toBe(8);
      expect(GAME_MODES).toEqual(['solo', 'vs2', 'vs3', 'vs4', 'vs5', 'vs6', 'vs7', 'vs8']);
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
    test('vs5 has 4 AI', () => {
      expect(AI_COUNT.vs5).toBe(4);
    });
    test('vs6 has 5 AI', () => {
      expect(AI_COUNT.vs6).toBe(5);
    });
    test('vs7 has 6 AI', () => {
      expect(AI_COUNT.vs7).toBe(6);
    });
    test('vs8 has 7 AI', () => {
      expect(AI_COUNT.vs8).toBe(7);
    });
  });

  // ─── AI MODE: AI_STRATEGY (replaces AI_ERROR_RATE / AI_CORNERING_RATE) ───
  describe('AI_STRATEGY', () => {
    test('has 3 difficulty levels', () => {
      expect(Object.keys(AI_STRATEGY).length).toBe(3);
      expect(AI_STRATEGY.easy).toBeDefined();
      expect(AI_STRATEGY.medium).toBeDefined();
      expect(AI_STRATEGY.hard).toBeDefined();
    });

    test('easy: no BFS, no tail-chasing, no lookahead, no hunting', () => {
      expect(AI_STRATEGY.easy.bfsPathfinding).toBe(false);
      expect(AI_STRATEGY.easy.tailChasing).toBe(false);
      expect(AI_STRATEGY.easy.lookahead).toBe(false);
      expect(AI_STRATEGY.easy.hunting).toBe(false);
    });

    test('medium: BFS + tail-chasing + anti-trap', () => {
      expect(AI_STRATEGY.medium.bfsPathfinding).toBe(true);
      expect(AI_STRATEGY.medium.tailChasing).toBe(true);
      expect(AI_STRATEGY.medium.antiTrap).toBe(true);
      expect(AI_STRATEGY.medium.lookahead).toBe(false);
      expect(AI_STRATEGY.medium.hunting).toBe(false);
    });

    test('hard: all strategies enabled', () => {
      expect(AI_STRATEGY.hard.bfsPathfinding).toBe(true);
      expect(AI_STRATEGY.hard.tailChasing).toBe(true);
      expect(AI_STRATEGY.hard.lookahead).toBe(true);
      expect(AI_STRATEGY.hard.hunting).toBe(true);
      expect(AI_STRATEGY.hard.antiTrap).toBe(true);
      expect(AI_STRATEGY.hard.bestApple).toBe(true);
    });

    test('error rates: easy > medium > hard', () => {
      expect(AI_STRATEGY.easy.errorRate).toBeGreaterThan(AI_STRATEGY.medium.errorRate);
      expect(AI_STRATEGY.medium.errorRate).toBeGreaterThan(AI_STRATEGY.hard.errorRate);
    });

    test('flood fill depth: easy < medium < hard', () => {
      expect(AI_STRATEGY.easy.floodFillDepth).toBeLessThan(AI_STRATEGY.medium.floodFillDepth);
      expect(AI_STRATEGY.medium.floodFillDepth).toBeLessThan(AI_STRATEGY.hard.floodFillDepth);
    });
  });

  // ─── AI MODE: GRID limits ───
  describe('GRID_MIN and GRID_MAX', () => {
    test('GRID_MIN is 16', () => {
      expect(GRID_MIN).toBe(16);
    });
    test('GRID_MAX is 66', () => {
      expect(GRID_MAX).toBe(66);
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
    test('vs5 base (modifier 0) returns 44', () => {
      expect(resolveGridSize('vs5', 0)).toBe(44);
    });
    test('vs6 base (modifier 0) returns 50', () => {
      expect(resolveGridSize('vs6', 0)).toBe(50);
    });
    test('vs7 base (modifier 0) returns 56 (even)', () => {
      expect(resolveGridSize('vs7', 0)).toBe(56);
    });
    test('vs8 base (modifier 0) returns 62 (even)', () => {
      expect(resolveGridSize('vs8', 0)).toBe(62);
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
    test('vs4 +50% returns 60 (even)', () => {
      expect(resolveGridSize('vs4', 50)).toBe(60);
    });
    test('vs5 +50% clamps to 66', () => {
      expect(resolveGridSize('vs5', 50)).toBe(66);
    });
    test('vs6 +50% clamps to 66', () => {
      expect(resolveGridSize('vs6', 50)).toBe(66);
    });
    test('vs7 +50% clamps to 66', () => {
      expect(resolveGridSize('vs7', 50)).toBe(66);
    });
    test('vs8 +50% clamps to 66', () => {
      expect(resolveGridSize('vs8', 50)).toBe(66);
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
    test('vs5 -50% returns 22', () => {
      expect(resolveGridSize('vs5', -50)).toBe(22);
    });
    test('vs6 -50% returns 26 (even)', () => {
      expect(resolveGridSize('vs6', -50)).toBe(26);
    });
    test('vs7 -50% returns 28', () => {
      expect(resolveGridSize('vs7', -50)).toBe(28);
    });
    test('vs8 -50% returns 32', () => {
      expect(resolveGridSize('vs8', -50)).toBe(32);
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
    test('modifier beyond range clamps to GRID_MAX (66)', () => {
      expect(resolveGridSize('vs8', 100)).toBe(66);
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

  // ─── Proportional scaling: STANDARD_GRID_CELLS ───
  describe('STANDARD_GRID_CELLS', () => {
    test('is 484 (22×22)', () => {
      expect(STANDARD_GRID_CELLS).toBe(484);
    });
  });

  // ─── Proportional scaling: calcNumApples(gridSize) ───
  describe('calcNumApples(gridSize)', () => {
    test('is a function', () => {
      expect(typeof calcNumApples).toBe('function');
    });

    test('standard grid (22) returns 3 apples', () => {
      expect(calcNumApples(22)).toBe(3);
    });

    test('vs2 grid (28) returns 5 apples', () => {
      // 28² = 784, 784/484 = 1.62, 3 × 1.62 = 4.86 → 5
      expect(calcNumApples(28)).toBe(5);
    });

    test('vs3 grid (34) returns 7 apples', () => {
      // 34² = 1156, 1156/484 = 2.39, 3 × 2.39 = 7.17 → 7
      expect(calcNumApples(34)).toBe(7);
    });

    test('vs4 grid (40) returns 10 apples', () => {
      // 40² = 1600, 1600/484 = 3.31, 3 × 3.31 = 9.92 → 10
      expect(calcNumApples(40)).toBe(10);
    });

    test('small grid (16) returns minimum 3', () => {
      // 16² = 256, 256/484 = 0.53, 3 × 0.53 = 1.58 → 2, but min is 3
      expect(calcNumApples(16)).toBe(3);
    });

    test('large grid (66) returns 26 apples', () => {
      // 66² = 4356, 4356/484 = 9.0, 3 × 9.0 = 27
      // round(3 * 4356/484) = round(27.0) = 27
      expect(calcNumApples(66)).toBe(27);
    });

    test('returns at least 3 for any grid size', () => {
      for (var g = GRID_MIN; g <= GRID_MAX; g++) {
        expect(calcNumApples(g)).toBeGreaterThanOrEqual(3);
      }
    });

    test('scales monotonically (larger grid ≥ smaller grid)', () => {
      var prev = calcNumApples(GRID_MIN);
      for (var g = GRID_MIN + 1; g <= GRID_MAX; g++) {
        var curr = calcNumApples(g);
        expect(curr).toBeGreaterThanOrEqual(prev);
        prev = curr;
      }
    });
  });

  // ─── Proportional scaling: calcMaxObstacles(gridSize) ───
  describe('calcMaxObstacles(gridSize)', () => {
    test('is a function', () => {
      expect(typeof calcMaxObstacles).toBe('function');
    });

    test('standard grid (22) returns 30 obstacles', () => {
      expect(calcMaxObstacles(22)).toBe(30);
    });

    test('vs2 grid (28) returns 47 obstacles', () => {
      // 28² = 784, 784/484 = 1.62, 30 × 1.62 = 48.5 → 49
      // round(30 * 784/484) = round(48.512) = 49
      expect(calcMaxObstacles(28)).toBe(49);
    });

    test('vs3 grid (34) returns 72 obstacles', () => {
      // 34² = 1156, 1156/484 = 2.39, 30 × 2.39 = 71.7 → 72
      expect(calcMaxObstacles(34)).toBe(72);
    });

    test('vs4 grid (40) returns 99 obstacles', () => {
      // 40² = 1600, 1600/484 = 3.31, 30 × 3.31 = 99.38 → 99
      expect(calcMaxObstacles(40)).toBe(99);
    });

    test('small grid (16) returns minimum 5', () => {
      // 16² = 256, 256/484 = 0.53, 30 × 0.53 = 15.8 → 16, above min
      expect(calcMaxObstacles(16)).toBeGreaterThanOrEqual(5);
    });

    test('large grid (66) returns 270 obstacles', () => {
      // 66² = 4356, 4356/484 = 9.0, 30 × 9.0 = 270
      expect(calcMaxObstacles(66)).toBe(270);
    });

    test('returns at least 5 for any grid size', () => {
      for (var g = GRID_MIN; g <= GRID_MAX; g++) {
        expect(calcMaxObstacles(g)).toBeGreaterThanOrEqual(5);
      }
    });

    test('scales monotonically (larger grid ≥ smaller grid)', () => {
      var prev = calcMaxObstacles(GRID_MIN);
      for (var g = GRID_MIN + 1; g <= GRID_MAX; g++) {
        var curr = calcMaxObstacles(g);
        expect(curr).toBeGreaterThanOrEqual(prev);
        prev = curr;
      }
    });
  });

  // ─── Proportional scaling: calcObstacleSpawnEvery(gridSize) ───
  describe('calcObstacleSpawnEvery(gridSize)', () => {
    test('is a function', () => {
      expect(typeof calcObstacleSpawnEvery).toBe('function');
    });

    test('standard grid (22) returns 3', () => {
      expect(calcObstacleSpawnEvery(22)).toBe(3);
    });

    test('vs2 grid (28) returns 2', () => {
      // 484/784 = 0.617, 3 × 0.617 = 1.85 → 2
      expect(calcObstacleSpawnEvery(28)).toBe(2);
    });

    test('vs3 grid (34) returns 1 (minimum)', () => {
      // 484/1156 = 0.419, 3 × 0.419 = 1.26 → 1
      expect(calcObstacleSpawnEvery(34)).toBe(1);
    });

    test('vs4 grid (40) returns 1 (minimum)', () => {
      // 484/1600 = 0.303, 3 × 0.303 = 0.908 → 1
      expect(calcObstacleSpawnEvery(40)).toBe(1);
    });

    test('large grid (66) returns 1 (minimum)', () => {
      expect(calcObstacleSpawnEvery(66)).toBe(1);
    });

    test('small grid (16) returns 6', () => {
      // 484/256 = 1.89, 3 × 1.89 = 5.67 → 6
      expect(calcObstacleSpawnEvery(16)).toBe(6);
    });

    test('returns at least 1 for any grid size', () => {
      for (var g = GRID_MIN; g <= GRID_MAX; g++) {
        expect(calcObstacleSpawnEvery(g)).toBeGreaterThanOrEqual(1);
      }
    });

    test('scales inversely monotonically (larger grid ≤ smaller grid)', () => {
      var prev = calcObstacleSpawnEvery(GRID_MIN);
      for (var g = GRID_MIN + 1; g <= GRID_MAX; g++) {
        var curr = calcObstacleSpawnEvery(g);
        expect(curr).toBeLessThanOrEqual(prev);
        prev = curr;
      }
    });
  });

  // ─── Proportional scaling: combined table sanity ───
  describe('proportional scaling table sanity', () => {
    var scenarios = [
      { mode: 'solo', grid: 22, apples: 3, maxObs: 30, spawnEvery: 3 },
      { mode: 'vs2', grid: 28, apples: 5, maxObs: 49, spawnEvery: 2 },
      { mode: 'vs3', grid: 34, apples: 7, maxObs: 72, spawnEvery: 1 },
      { mode: 'vs4', grid: 40, apples: 10, maxObs: 99, spawnEvery: 1 },
      { mode: 'vs5', grid: 44, apples: 12, maxObs: 120, spawnEvery: 1 },
      { mode: 'vs6', grid: 50, apples: 15, maxObs: 155, spawnEvery: 1 },
      { mode: 'vs7', grid: 56, apples: 19, maxObs: 194, spawnEvery: 1 },
      { mode: 'vs8', grid: 62, apples: 24, maxObs: 238, spawnEvery: 1 },
    ];

    scenarios.forEach(function(s) {
      test(s.mode + ' (grid ' + s.grid + '): apples=' + s.apples + ', maxObs=' + s.maxObs + ', spawnEvery=' + s.spawnEvery, () => {
        expect(calcNumApples(s.grid)).toBe(s.apples);
        expect(calcMaxObstacles(s.grid)).toBe(s.maxObs);
        expect(calcObstacleSpawnEvery(s.grid)).toBe(s.spawnEvery);
      });
    });
  });
});
