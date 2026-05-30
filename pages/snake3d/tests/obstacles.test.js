// ─── Tests: obstacles.js — isSafeForObstacle() (baseline) ───
// Tests for the existing isSafeForObstacle() function.
// Uses Manhattan distance (|dx| + |dz|) for proximity checks.

const { setSnake, setApples, setObstacles } = require('./helpers');

describe('obstacles.js — isSafeForObstacle()', () => {
  beforeEach(() => {
    setSnake([]);
    setApples([]);
    setObstacles([]);
  });

  describe('empty grid', () => {
    test('returns true when nothing is on the grid', () => {
      expect(isSafeForObstacle(0, 0)).toBe(true);
      expect(isSafeForObstacle(5, 5)).toBe(true);
    });
  });

  describe('snake proximity (OBSTACLE_MIN_DIST_SNAKE = 6)', () => {
    test('returns false when too close to snake (Manhattan distance < 6)', () => {
      setSnake([{x: 0, z: 0}]);
      // Manhattan distance = 5 → too close
      expect(isSafeForObstacle(3, 2)).toBe(false);
      // Manhattan distance = 5 → too close
      expect(isSafeForObstacle(5, 0)).toBe(false);
      // Manhattan distance = 4 → too close
      expect(isSafeForObstacle(2, 2)).toBe(false);
    });

    test('returns true when at exactly the minimum distance (6)', () => {
      setSnake([{x: 0, z: 0}]);
      // Manhattan distance = 6 → OK (not < 6)
      expect(isSafeForObstacle(6, 0)).toBe(true);
      expect(isSafeForObstacle(0, 6)).toBe(true);
      expect(isSafeForObstacle(3, 3)).toBe(true);
    });

    test('returns true when far from snake', () => {
      setSnake([{x: 0, z: 0}]);
      expect(isSafeForObstacle(10, 10)).toBe(true);
    });

    test('returns false when too close to any snake segment', () => {
      setSnake([
        {x: 0, z: 0},
        {x: -1, z: 0},
        {x: -2, z: 0},
      ]);
      expect(isSafeForObstacle(2, 0)).toBe(false);  // dist 2 from head
      expect(isSafeForObstacle(-1, 3)).toBe(false); // dist 3 from segment
    });

    test('checks Manhattan distance correctly (not Euclidean)', () => {
      setSnake([{x: 0, z: 0}]);
      // |4| + |1| = 5 < 6 → too close
      expect(isSafeForObstacle(4, 1)).toBe(false);
      // |5| + |1| = 6 → OK
      expect(isSafeForObstacle(5, 1)).toBe(true);
    });

    test('handles negative coordinates', () => {
      setSnake([{x: -5, z: -5}]);
      // |-5 - (-3)| + |-5 - (-3)| = 2 + 2 = 4 < 6 → too close
      expect(isSafeForObstacle(-3, -3)).toBe(false);
      // |-5 - 1| + |-5 - 1| = 6 + 6 = 12 → OK
      expect(isSafeForObstacle(1, 1)).toBe(true);
    });
  });

  describe('obstacle proximity (OBSTACLE_MIN_DIST_EACH = 3)', () => {
    test('returns false when too close to existing obstacle (Manhattan < 3)', () => {
      setObstacles([{x: 5, z: 5}]);
      // dist = 2 → too close
      expect(isSafeForObstacle(5, 3)).toBe(false);
      // dist = 2 → too close
      expect(isSafeForObstacle(3, 5)).toBe(false);
      // dist = 1 → too close
      expect(isSafeForObstacle(5, 4)).toBe(false);
    });

    test('returns true when at exactly the minimum distance (3)', () => {
      setObstacles([{x: 5, z: 5}]);
      // dist = 3 → OK
      expect(isSafeForObstacle(5, 2)).toBe(true);
      expect(isSafeForObstacle(2, 5)).toBe(true);
      expect(isSafeForObstacle(8, 5)).toBe(true);
    });

    test('returns false when too close to any existing obstacle', () => {
      setObstacles([
        {x: 0, z: 0},
        {x: 10, z: 10},
      ]);
      expect(isSafeForObstacle(1, 0)).toBe(false);   // close to first
      expect(isSafeForObstacle(10, 11)).toBe(false); // close to second
      expect(isSafeForObstacle(5, 5)).toBe(true);    // far from both
    });
  });

  describe('apple proximity (OBSTACLE_MIN_DIST_APPLE = 3)', () => {
    test('returns false when too close to apple (Manhattan < 3)', () => {
      setApples([{x: 3, z: 3}]);
      // dist = 2 → too close
      expect(isSafeForObstacle(3, 1)).toBe(false);
      // dist = 1 → too close
      expect(isSafeForObstacle(4, 3)).toBe(false);
    });

    test('returns true when at exactly the minimum distance (3)', () => {
      setApples([{x: 3, z: 3}]);
      // dist = 3 → OK
      expect(isSafeForObstacle(3, 0)).toBe(true);
      expect(isSafeForObstacle(6, 3)).toBe(true);
    });

    test('handles null apples', () => {
      setApples([{x: 0, z: 0}, null, {x: 10, z: 10}]);
      // Close to first apple
      expect(isSafeForObstacle(1, 0)).toBe(false);
      // Far from all real apples
      expect(isSafeForObstacle(5, 5)).toBe(true);
    });

    test('returns false when too close to any apple', () => {
      setApples([
        {x: 0, z: 0},
        {x: 5, z: 5},
        {x: -3, z: -3},
      ]);
      expect(isSafeForObstacle(1, 0)).toBe(false);    // close to first
      expect(isSafeForObstacle(5, 4)).toBe(false);    // close to second
      expect(isSafeForObstacle(-3, -1)).toBe(false);  // close to third
      expect(isSafeForObstacle(7, 7)).toBe(true);     // far from all
    });
  });

  describe('occupied cell check', () => {
    test('returns false when cell is occupied by snake', () => {
      setSnake([{x: 4, z: 4}]);
      // Far enough from snake (dist = 0, but occupied check catches it)
      // Actually dist 0 < 6, so snake proximity catches it first
      expect(isSafeForObstacle(4, 4)).toBe(false);
    });

    test('returns false when cell is occupied by obstacle', () => {
      setObstacles([{x: 10, z: 10}]);
      // Place at same spot — occupied check
      expect(isSafeForObstacle(10, 10)).toBe(false);
    });

    test('returns false when cell is occupied by apple', () => {
      setApples([{x: 7, z: 7}]);
      expect(isSafeForObstacle(7, 7)).toBe(false);
    });
  });

  describe('combined conditions', () => {
    test('returns false when too close to snake even if far from others', () => {
      setSnake([{x: 0, z: 0}]);
      setApples([{x: 20, z: 20}]);
      setObstacles([{x: 30, z: 30}]);
      expect(isSafeForObstacle(3, 2)).toBe(false); // close to snake
    });

    test('returns false when too close to obstacle even if far from snake', () => {
      setSnake([{x: -20, z: -20}]);
      setObstacles([{x: 5, z: 5}]);
      setApples([{x: 30, z: 30}]);
      expect(isSafeForObstacle(5, 4)).toBe(false); // close to obstacle
    });

    test('returns false when too close to apple even if far from others', () => {
      setSnake([{x: -20, z: -20}]);
      setApples([{x: 5, z: 5}]);
      setObstacles([{x: 30, z: 30}]);
      expect(isSafeForObstacle(5, 4)).toBe(false); // close to apple
    });

    test('returns true when far from everything', () => {
      setSnake([{x: 0, z: 0}]);
      setApples([{x: 10, z: 10}]);
      setObstacles([{x: -10, z: -10}]);
      // Far from snake (dist=14), far from apple (dist=10), far from obstacle (dist=18)
      expect(isSafeForObstacle(10, -10)).toBe(true);
    });

    test('complex scenario with multiple entities', () => {
      setSnake([{x: 0, z: 0}, {x: -1, z: 0}, {x: -2, z: 0}]);
      setApples([{x: 8, z: 8}, {x: -8, z: 8}, {x: 8, z: -8}]);
      setObstacles([{x: -8, z: -8}, {x: 15, z: 15}]);

      // Too close to snake head
      expect(isSafeForObstacle(2, 0)).toBe(false);
      // Too close to apple
      expect(isSafeForObstacle(8, 7)).toBe(false);
      // Too close to obstacle
      expect(isSafeForObstacle(-8, -6)).toBe(false);
      // Safe position
      expect(isSafeForObstacle(5, -5)).toBe(true);
    });
  });

  describe('edge cases', () => {
    test('handles origin (0,0)', () => {
      setSnake([{x: 10, z: 10}]);
      setApples([{x: -10, z: -10}]);
      setObstacles([{x: 20, z: 20}]);
      expect(isSafeForObstacle(0, 0)).toBe(true);
    });

    test('handles boundary of grid', () => {
      setSnake([{x: 0, z: 0}]);
      // Edge of grid (half = 11, so half-1 = 10)
      expect(isSafeForObstacle(10, 10)).toBe(true);
    });

    test('handles large negative coordinates', () => {
      setSnake([{x: -10, z: -10}]);
      // |-10 - (-5)| + |-10 - (-5)| = 5+5 = 10 >= 6 → true
      expect(isSafeForObstacle(-5, -5)).toBe(true);
    });

    test('handles single snake segment', () => {
      setSnake([{x: 0, z: 0}]);
      expect(isSafeForObstacle(0, 5)).toBe(false); // dist = 5 < 6
      expect(isSafeForObstacle(0, 6)).toBe(true);  // dist = 6 >= 6
    });
  });
});
