// ─── Tests: apples.js — isOccupied() (baseline) ───
// Tests for the existing isOccupied() function.
// This function checks if a grid cell is occupied by snake, apple, or obstacle.

const { setSnake, setApples, setObstacles } = require('./helpers');

describe('apples.js — isOccupied()', () => {
  // Helper to reset state before each test
  beforeEach(() => {
    setSnake([]);
    setApples([]);
    setObstacles([]);
  });

  describe('empty grid', () => {
    test('returns false when nothing is on the grid', () => {
      expect(isOccupied(0, 0)).toBe(false);
      expect(isOccupied(5, 5)).toBe(false);
      expect(isOccupied(-3, 2)).toBe(false);
    });
  });

  describe('snake occupancy', () => {
    test('returns true when snake head is at (x,z)', () => {
      setSnake([{x: 3, z: 4}]);
      expect(isOccupied(3, 4)).toBe(true);
    });

    test('returns true when snake body segment is at (x,z)', () => {
      setSnake([{x: 0, z: 0}, {x: 1, z: 0}, {x: 2, z: 0}]);
      expect(isOccupied(1, 0)).toBe(true);
      expect(isOccupied(2, 0)).toBe(true);
    });

    test('returns false when snake is at different position', () => {
      setSnake([{x: 5, z: 5}]);
      expect(isOccupied(3, 4)).toBe(false);
    });

    test('returns true for any segment in a multi-segment snake', () => {
      setSnake([
        {x: 0, z: 0},
        {x: -1, z: 0},
        {x: -2, z: 0},
        {x: -3, z: 0},
      ]);
      expect(isOccupied(0, 0)).toBe(true);
      expect(isOccupied(-1, 0)).toBe(true);
      expect(isOccupied(-2, 0)).toBe(true);
      expect(isOccupied(-3, 0)).toBe(true);
      expect(isOccupied(-4, 0)).toBe(false);
    });

    test('respects different x and z independently', () => {
      setSnake([{x: 3, z: 4}]);
      expect(isOccupied(3, 4)).toBe(true);  // exact match
      expect(isOccupied(3, 5)).toBe(false); // same x, different z
      expect(isOccupied(4, 4)).toBe(false); // different x, same z
    });
  });

  describe('apple occupancy', () => {
    test('returns true when apple is at (x,z)', () => {
      setApples([{x: 7, z: -3}]);
      expect(isOccupied(7, -3)).toBe(true);
    });

    test('returns false when apple is at different position', () => {
      setApples([{x: 7, z: -3}]);
      expect(isOccupied(0, 0)).toBe(false);
    });

    test('returns true for any apple in a multi-apple grid', () => {
      setApples([
        {x: 1, z: 2},
        {x: -3, z: 4},
        {x: 5, z: -1},
      ]);
      expect(isOccupied(1, 2)).toBe(true);
      expect(isOccupied(-3, 4)).toBe(true);
      expect(isOccupied(5, -1)).toBe(true);
      expect(isOccupied(0, 0)).toBe(false);
    });

    test('handles null apples in the array', () => {
      setApples([{x: 2, z: 2}, null, {x: -1, z: -1}]);
      expect(isOccupied(2, 2)).toBe(true);
      expect(isOccupied(-1, -1)).toBe(true);
      expect(isOccupied(0, 0)).toBe(false);
    });
  });

  describe('obstacle occupancy', () => {
    test('returns true when obstacle is at (x,z)', () => {
      setObstacles([{x: -2, z: 6}]);
      expect(isOccupied(-2, 6)).toBe(true);
    });

    test('returns false when obstacle is at different position', () => {
      setObstacles([{x: -2, z: 6}]);
      expect(isOccupied(0, 0)).toBe(false);
    });

    test('returns true for any obstacle in a multi-obstacle grid', () => {
      setObstacles([
        {x: 0, z: 0},
        {x: 3, z: 3},
        {x: -5, z: -5},
      ]);
      expect(isOccupied(0, 0)).toBe(true);
      expect(isOccupied(3, 3)).toBe(true);
      expect(isOccupied(-5, -5)).toBe(true);
      expect(isOccupied(1, 1)).toBe(false);
    });
  });

  describe('combined occupancy', () => {
    test('returns true when snake, apple, and obstacle all occupy different cells', () => {
      setSnake([{x: 0, z: 0}]);
      setApples([{x: 1, z: 1}]);
      setObstacles([{x: 2, z: 2}]);
      expect(isOccupied(0, 0)).toBe(true);
      expect(isOccupied(1, 1)).toBe(true);
      expect(isOccupied(2, 2)).toBe(true);
      expect(isOccupied(3, 3)).toBe(false);
    });

    test('returns true when multiple entities share the same cell', () => {
      setSnake([{x: 5, z: 5}]);
      setApples([{x: 5, z: 5}]);
      setObstacles([{x: 5, z: 5}]);
      expect(isOccupied(5, 5)).toBe(true);
    });

    test('returns false for empty cell with entities elsewhere', () => {
      setSnake([{x: -10, z: -10}]);
      setApples([{x: 10, z: 10}]);
      setObstacles([{x: 0, z: 100}]);
      expect(isOccupied(5, 5)).toBe(false);
    });

    test('handles large grid with many entities', () => {
      setSnake([{x: 0, z: 0}, {x: 1, z: 0}, {x: 2, z: 0}]);
      setApples([{x: -5, z: 5}, {x: 5, z: -5}, {x: 3, z: 3}]);
      setObstacles([{x: -3, z: -3}, {x: 7, z: 7}]);
      // Occupied cells
      expect(isOccupied(0, 0)).toBe(true);
      expect(isOccupied(1, 0)).toBe(true);
      expect(isOccupied(-5, 5)).toBe(true);
      expect(isOccupied(7, 7)).toBe(true);
      // Empty cells
      expect(isOccupied(4, 4)).toBe(false);
      expect(isOccupied(-1, -1)).toBe(false);
    });
  });

  describe('edge cases', () => {
    test('handles negative coordinates', () => {
      setSnake([{x: -10, z: -10}]);
      expect(isOccupied(-10, -10)).toBe(true);
      expect(isOccupied(-10, -9)).toBe(false);
    });

    test('handles zero coordinates', () => {
      setSnake([{x: 0, z: 0}]);
      expect(isOccupied(0, 0)).toBe(true);
    });

    test('handles boundary coordinates', () => {
      setSnake([{x: half - 1, z: half - 1}]);
      expect(isOccupied(half - 1, half - 1)).toBe(true);
    });
  });
});
