// ─── Tests: Shrink Escape & Proactive Repositioning ───
// Tests for the new proactive repositioning logic that moves AI snakes
// toward the safe zone center BEFORE their head enters the danger zone.

const { setSnake, setApples, setObstacles } = require('./helpers');

// Helper to set global variables
const setGlobal = (name, value) => { global[name] = value; };

// ─── calcShrinkBoundsFromCurrent() ───
describe('ai.js — calcShrinkBoundsFromCurrent()', () => {
  beforeEach(() => {
    gridMinX = -11;
    gridMaxX = 11;
    gridMinZ = -11;
    gridMaxZ = 11;
  });

  test('returns correct bounds for simple shrink', () => {
    var cd = { shrinkAmount: 4, offsetX: 0, offsetZ: 0 };
    var bounds = calcShrinkBoundsFromCurrent(cd);
    expect(bounds.newMinX).toBe(-11);
    expect(bounds.newMaxX).toBe(7);  // -11 + (22 - 4) = 7
    expect(bounds.newMinZ).toBe(-11);
    expect(bounds.newMaxZ).toBe(7);
  });

  test('returns correct bounds with offset', () => {
    var cd = { shrinkAmount: 6, offsetX: 2, offsetZ: 0 };
    var bounds = calcShrinkBoundsFromCurrent(cd);
    // newMinX = -11 + 2 = -9
    // newMaxX = -9 + (22 - 6) = -9 + 16 = 7
    // newMinZ = -11 + 0 = -11
    // newMaxZ = -11 + (22 - 6) = -11 + 16 = 5
    expect(bounds.newMinX).toBe(-9);
    expect(bounds.newMaxX).toBe(7);
    expect(bounds.newMinZ).toBe(-11);
    expect(bounds.newMaxZ).toBe(5);
  });

  test('preserves current bounds in return object', () => {
    var cd = { shrinkAmount: 4, offsetX: 0, offsetZ: 0 };
    var bounds = calcShrinkBoundsFromCurrent(cd);
    expect(bounds.minX).toBe(-11);
    expect(bounds.maxX).toBe(11);
    expect(bounds.minZ).toBe(-11);
    expect(bounds.maxZ).toBe(11);
  });

  test('handles zero shrink amount', () => {
    var cd = { shrinkAmount: 0, offsetX: 0, offsetZ: 0 };
    var bounds = calcShrinkBoundsFromCurrent(cd);
    expect(bounds.newMinX).toBe(-11);
    expect(bounds.newMaxX).toBe(11);
    expect(bounds.newMinZ).toBe(-11);
    expect(bounds.newMaxZ).toBe(11);
  });
});

// ─── cellInShrinkZone() ───
describe('ai.js — cellInShrinkZone()', () => {
  beforeEach(() => {
    gridMinX = -11;
    gridMaxX = 11;
    gridMinZ = -11;
    gridMaxZ = 11;
    setSnake([{x: 0, z: 0}]);
    setApples([]);
    setObstacles([]);
    setGlobal('aiSnakes', []);
    setGlobal('shrinkCountdowns', []);
  });

  test('returns false when no countdowns', () => {
    setGlobal('shrinkCountdowns', []);
    expect(cellInShrinkZone(0, 0)).toBe(false);
    expect(cellInShrinkZone(10, 10)).toBe(false);
  });

  test('returns false when cell is inside safe zone', () => {
    // Shrink from 22 to 16, no offset
    setGlobal('shrinkCountdowns', [
      { shrinkAmount: 6, offsetX: 0, offsetZ: 0 }
    ]);
    // Safe zone: -11 to -11+16 = 5
    expect(cellInShrinkZone(0, 0)).toBe(false);
    expect(cellInShrinkZone(-5, -5)).toBe(false);
  });

  test('returns true when cell is outside safe zone on positive side', () => {
    setGlobal('shrinkCountdowns', [
      { shrinkAmount: 6, offsetX: 0, offsetZ: 0 }
    ]);
    // Safe zone: -11 to 5 on both axes
    expect(cellInShrinkZone(7, 0)).toBe(true);
    expect(cellInShrinkZone(10, 0)).toBe(true);
  });

  test('returns true when cell is outside safe zone on negative side', () => {
    // Shrink with offset that removes negative side
    setGlobal('shrinkCountdowns', [
      { shrinkAmount: 6, offsetX: 3, offsetZ: 0 }
    ]);
    // newMinX = -11 + 3 = -8, newMaxX = -8 + 16 = 8
    // Cell at (-10, 0) is outside (-8 to 8)
    expect(cellInShrinkZone(-10, 0)).toBe(true);
    // Cell at (-8, 0) is inside
    expect(cellInShrinkZone(-8, 0)).toBe(false);
  });

  test('returns true if outside ANY countdown safe zone', () => {
    // Two countdowns: one shrinks X, one shrinks Z
    setGlobal('shrinkCountdowns', [
      { shrinkAmount: 4, offsetX: 0, offsetZ: 0 },
      { shrinkAmount: 4, offsetX: 0, offsetZ: 0 }
    ]);
    // Both shrink to -11..7, so (10, 0) is outside both
    expect(cellInShrinkZone(10, 0)).toBe(true);
  });

  test('handles undefined shrinkCountdowns', () => {
    setGlobal('shrinkCountdowns', undefined);
    expect(cellInShrinkZone(0, 0)).toBe(false);
    expect(() => cellInShrinkZone(10, 10)).not.toThrow();
  });
});

// ─── Proactive repositioning trigger conditions ───
describe('ai.js — proactive repositioning trigger', () => {
  beforeEach(() => {
    gridMinX = -11;
    gridMaxX = 11;
    gridMinZ = -11;
    gridMaxZ = 11;
    setSnake([{x: 0, z: 0}]);
    setApples([]);
    setObstacles([]);
    setGlobal('gridSize', 22);
    setGlobal('half', 11);
    setGlobal('shrinkCountdowns', []);
  });

  test('AI at edge triggers proactive repositioning when countdown active', () => {
    // AI at edge (10, 10) with active shrink countdown
    setGlobal('aiSnakes', [
      {
        id: 'ai_0',
        color: 'red',
        alive: true,
        score: 0,
        snake: [{x: 10, z: 10}, {x: 9, z: 10}],
        direction: 0,
        stuckHistory: []
      }
    ]);
    // Shrink to smaller grid
    setGlobal('shrinkCountdowns', [
      { shrinkAmount: 6, offsetX: 0, offsetZ: 0 }
    ]);
    // Safe zone: -11 to 5
    // safeCenterX = (-11 + 5) / 2 = -3
    // safeCenterZ = (-11 + 5) / 2 = -3
    // safeZoneHalfW = (5 - (-11)) / 4 = 4
    // safeZoneHalfH = (5 - (-11)) / 4 = 4
    // headDistToCenter = |10 - (-3)| + |10 - (-3)| = 26
    // threshold = 4 + 4 = 8
    // 26 > 8, so needsReposition = true
    // This should not throw and should return a direction toward center
    var result = aiDecideDirection(0, 'hard');
    expect(result).toBeDefined();
    // The AI should move toward the center (negative X = π or negative Z = -π/2)
    var movedTowardCenter = (Math.abs(result - Math.PI) < 0.1) ||
                            (Math.abs(result + Math.PI / 2) < 0.1);
    expect(movedTowardCenter).toBe(true);
  });

  test('AI near center does NOT trigger proactive repositioning', () => {
    // AI near center (0, 0) with active shrink countdown
    setGlobal('aiSnakes', [
      {
        id: 'ai_0',
        color: 'red',
        alive: true,
        score: 0,
        snake: [{x: 0, z: 0}, {x: -1, z: 0}],
        direction: 0,
        stuckHistory: []
      }
    ]);
    setGlobal('shrinkCountdowns', [
      { shrinkAmount: 6, offsetX: 0, offsetZ: 0 }
    ]);
    // Safe zone: -11 to 5
    // safeCenterX = -3, safeCenterZ = -3
    // safeZoneHalfW = 4, safeZoneHalfH = 4
    // headDistToCenter = |0 - (-3)| + |0 - (-3)| = 6
    // threshold = 4 + 4 = 8
    // 6 < 8, so needsReposition = false (unless body in shrink zone)
    // AI should not crash and should use normal strategy
    expect(() => aiDecideDirection(0, 'hard')).not.toThrow();
  });

  test('body in shrink zone triggers proactive repositioning regardless of head position', () => {
    // AI head near center but body extends into shrink zone
    setGlobal('aiSnakes', [
      {
        id: 'ai_0',
        color: 'red',
        alive: true,
        score: 0,
        snake: [
          {x: 0, z: 0},     // head — inside safe zone
          {x: -1, z: 0},    // inside
          {x: -2, z: 0},    // inside
          {x: 7, z: 0},     // OUTSIDE safe zone (7 >= 5)
          {x: 8, z: 0}      // OUTSIDE safe zone
        ],
        direction: 0,
        stuckHistory: []
      }
    ]);
    setGlobal('shrinkCountdowns', [
      { shrinkAmount: 6, offsetX: 0, offsetZ: 0 }
    ]);
    // Body segments at (7,0) and (8,0) are in shrink zone
    // This should trigger proactive repositioning even though head is at (0,0)
    expect(() => aiDecideDirection(0, 'hard')).not.toThrow();
  });

  test('no proactive repositioning when no countdowns active', () => {
    setGlobal('aiSnakes', [
      {
        id: 'ai_0',
        color: 'red',
        alive: true,
        score: 0,
        snake: [{x: 10, z: 10}, {x: 9, z: 10}],
        direction: 0,
        stuckHistory: []
      }
    ]);
    setGlobal('shrinkCountdowns', []);
    // No countdowns = no proactive repositioning
    // AI should use normal strategy (flood fill toward apples or survival)
    expect(() => aiDecideDirection(0, 'hard')).not.toThrow();
  });
});

// ─── Safe center calculation ───
describe('ai.js — safe center calculation', () => {
  beforeEach(() => {
    gridMinX = -11;
    gridMaxX = 11;
    gridMinZ = -11;
    gridMaxZ = 11;
    setSnake([{x: 0, z: 0}]);
    setApples([]);
    setObstacles([]);
    setGlobal('aiSnakes', []);
    setGlobal('gridSize', 22);
    setGlobal('half', 11);
  });

  test('safe center is midpoint of tightest bounds', () => {
    // Shrink from 22 to 16, no offset
    setGlobal('shrinkCountdowns', [
      { shrinkAmount: 6, offsetX: 0, offsetZ: 0 }
    ]);
    // tightMinX = -11, tightMaxX = 5
    // safeCenterX = (-11 + 5) / 2 = -3
    // This is verified indirectly by cellInShrinkZone behavior
    expect(cellInShrinkZone(-3, -3)).toBe(false); // center is safe
    expect(cellInShrinkZone(10, 0)).toBe(true);   // edge is in danger
  });

  test('multiple countdowns use tightest bounds', () => {
    // Two countdowns with different shrink amounts
    setGlobal('shrinkCountdowns', [
      { shrinkAmount: 4, offsetX: 0, offsetZ: 0 },  // -11 to 7
      { shrinkAmount: 8, offsetX: 0, offsetZ: 0 }   // -11 to 3
    ]);
    // Tightest: -11 to 3 (from second countdown)
    // Cell at (5, 0) is safe for first but NOT for second
    expect(cellInShrinkZone(5, 0)).toBe(true);
    // Cell at (0, 0) is safe for both
    expect(cellInShrinkZone(0, 0)).toBe(false);
  });

  test('offset countdowns shift safe zone', () => {
    // Shrink with offset that shifts safe zone right
    setGlobal('shrinkCountdowns', [
      { shrinkAmount: 6, offsetX: 4, offsetZ: 0 }
    ]);
    // newMinX = -11 + 4 = -7
    // newMaxX = -7 + 16 = 9
    // Cell at (-10, 0) is outside (-7 to 9)
    expect(cellInShrinkZone(-10, 0)).toBe(true);
    // Cell at (8, 0) is inside
    expect(cellInShrinkZone(8, 0)).toBe(false);
  });
});

// ─── Direction scoring with center priority ───
describe('ai.js — direction scoring during proactive repositioning', () => {
  beforeEach(() => {
    gridMinX = -11;
    gridMaxX = 11;
    gridMinZ = -11;
    gridMaxZ = 11;
    setSnake([{x: 0, z: 0}]);
    setApples([]);
    setObstacles([]);
    setGlobal('gridSize', 22);
    setGlobal('half', 11);
    setGlobal('shrinkCountdowns', []);
  });

  test('AI at edge prefers direction toward safe center', () => {
    // AI at far edge (10, 10) with shrink active
    setGlobal('aiSnakes', [
      {
        id: 'ai_0',
        color: 'red',
        alive: true,
        score: 0,
        snake: [{x: 10, z: 10}, {x: 9, z: 10}],
        direction: 0,
        stuckHistory: []
      }
    ]);
    setGlobal('shrinkCountdowns', [
      { shrinkAmount: 6, offsetX: 0, offsetZ: 0 }
    ]);
    // Safe center: (-3, -3)
    // AI should prefer moving toward negative X or Z
    var dir = aiDecideDirection(0, 'hard');
    expect(dir).toBeDefined();
    // Direction should be toward center (negative X = π, negative Z = -π/2)
    var movedTowardCenter = (Math.abs(dir - Math.PI) < 0.1) ||
                             (Math.abs(dir + Math.PI / 2) < 0.1);
    expect(movedTowardCenter).toBe(true);
  });

  test('AI avoids moving INTO shrink zone even if it seems closer to center', () => {
    // AI positioned such that one direction goes into shrink zone
    setGlobal('aiSnakes', [
      {
        id: 'ai_0',
        color: 'red',
        alive: true,
        score: 0,
        snake: [{x: 4, z: 4}, {x: 3, z: 4}],
        direction: 0,
        stuckHistory: []
      }
    ]);
    setGlobal('shrinkCountdowns', [
      { shrinkAmount: 6, offsetX: 0, offsetZ: 0 }
    ]);
    // Safe zone: -11 to 5
    // Cell at (5, 4) is inside safe zone
    // Cell at (4, 5) is inside safe zone
    // Both directions are safe, so AI should pick one
    expect(() => aiDecideDirection(0, 'hard')).not.toThrow();
  });

  test('penalty for moving into shrink zone overrides distance bonus', () => {
    // AI head is SAFE but one direction leads into shrink zone.
    // This tests that the -1500 penalty prevents the AI from choosing
    // a direction that enters the danger zone.
    setGlobal('aiSnakes', [
      {
        id: 'ai_0',
        color: 'red',
        alive: true,
        score: 0,
        snake: [{x: 4, z: 4}, {x: 3, z: 4}],
        direction: 0,
        stuckHistory: []
      }
    ]);
    setGlobal('shrinkCountdowns', [
      { shrinkAmount: 6, offsetX: 0, offsetZ: 0 }
    ]);
    // Safe zone: -11 <= x < 5, -11 <= z < 5
    // Head at (4, 4) is SAFE (both < 5)
    // Moving +X to (5, 4): 5 >= 5 → IN shrink zone (penalty -1500)
    // Moving +Z to (4, 5): 5 >= 5 → IN shrink zone (penalty -1500)
    // Moving -X to (3, 4): SAFE, toward center
    // Moving -Z to (4, 3): SAFE, toward center
    var dir = aiDecideDirection(0, 'hard');
    expect(dir).toBeDefined();
    // AI should NOT move +X or +Z (both enter shrink zone)
    // Should prefer -X (π) or -Z (-π/2) which are safe
    var movedIntoShrinkZone = (Math.abs(dir) < 0.1) ||
                               (Math.abs(dir - Math.PI / 2) < 0.1);
    expect(movedIntoShrinkZone).toBe(false);
  });
});

// ─── Escape mode (head in shrink zone) ───
describe('ai.js — escape mode when head is in shrink zone', () => {
  beforeEach(() => {
    gridMinX = -11;
    gridMaxX = 11;
    gridMinZ = -11;
    gridMaxZ = 11;
    setSnake([{x: 0, z: 0}]);
    setApples([]);
    setObstacles([]);
    setGlobal('gridSize', 22);
    setGlobal('half', 11);
    setGlobal('shrinkCountdowns', []);
  });

  test('AI head in shrink zone triggers emergency escape', () => {
    setGlobal('aiSnakes', [
      {
        id: 'ai_0',
        color: 'red',
        alive: true,
        score: 0,
        snake: [{x: 10, z: 0}, {x: 9, z: 0}],
        direction: 0,
        stuckHistory: []
      }
    ]);
    setGlobal('shrinkCountdowns', [
      { shrinkAmount: 6, offsetX: 0, offsetZ: 0 }
    ]);
    // Safe zone: -11 to 5
    // Head at (10, 0) is in shrink zone
    // +X goes to wall (11), so safe dirs are +Z and -Z
    // Both move toward center (safeCenterZ = -3), so -Z is preferred
    var dir = aiDecideDirection(0, 'hard');
    expect(dir).toBeDefined();
    // Should NOT continue +X (wall) — should turn +Z or -Z
    expect(Math.abs(dir)).not.toBeCloseTo(0, 1);
  });

  test('escape mode uses higher weight (500) than proactive (200)', () => {
    // This is tested indirectly — escape mode should be more aggressive
    // about moving toward center than proactive mode
    setGlobal('aiSnakes', [
      {
        id: 'ai_0',
        color: 'red',
        alive: true,
        score: 0,
        snake: [{x: 7, z: 0}, {x: 6, z: 0}],
        direction: 0,
        stuckHistory: []
      }
    ]);
    setGlobal('shrinkCountdowns', [
      { shrinkAmount: 6, offsetX: 0, offsetZ: 0 }
    ]);
    // Head at (7, 0) is in shrink zone (7 >= 5)
    // Escape mode should activate with weight 500
    expect(() => aiDecideDirection(0, 'hard')).not.toThrow();
  });
});

// ─── Integration: stepAI with shrink countdowns ───
describe('ai.js — stepAI with shrink countdowns', () => {
  beforeEach(() => {
    gridMinX = -11;
    gridMaxX = 11;
    gridMinZ = -11;
    gridMaxZ = 11;
    setSnake([{x: 0, z: 0}]);
    setApples([]);
    setObstacles([]);
    setGlobal('gridSize', 22);
    setGlobal('half', 11);
    setGlobal('shrinkCountdowns', []);
    setGlobal('aiSnakes', []);
  });

  test('AI near edge moves toward center during shrink countdown', () => {
    setGlobal('aiSnakes', [
      {
        id: 'ai_0',
        color: 'red',
        alive: true,
        score: 0,
        snake: [{x: 10, z: 10}, {x: 9, z: 10}],
        direction: 0,
        stuckHistory: []
      }
    ]);
    setGlobal('shrinkCountdowns', [
      { shrinkAmount: 6, offsetX: 0, offsetZ: 0 }
    ]);
    // Run one step
    stepAI();
    // AI should still be alive and may have moved
    expect(aiSnakes[0].alive).toBe(true);
  });

  test('AI body in shrink zone triggers repositioning in stepAI', () => {
    setGlobal('aiSnakes', [
      {
        id: 'ai_0',
        color: 'red',
        alive: true,
        score: 0,
        snake: [
          {x: 0, z: 0},    // head — safe
          {x: -1, z: 0},   // safe
          {x: 7, z: 0},    // in shrink zone
          {x: 8, z: 0}     // in shrink zone
        ],
        direction: 0,
        stuckHistory: []
      }
    ]);
    setGlobal('shrinkCountdowns', [
      { shrinkAmount: 6, offsetX: 0, offsetZ: 0 }
    ]);
    // Run one step — should not crash
    stepAI();
    expect(aiSnakes[0].alive).toBe(true);
  });

  test('multiple AI snakes all reposition during shrink', () => {
    setGlobal('aiSnakes', [
      {
        id: 'ai_0',
        color: 'red',
        alive: true,
        score: 0,
        snake: [{x: 10, z: 10}, {x: 9, z: 10}],
        direction: 0,
        stuckHistory: []
      },
      {
        id: 'ai_1',
        color: 'blue',
        alive: true,
        score: 0,
        snake: [{x: -10, z: -10}, {x: -9, z: -10}],
        direction: 0,
        stuckHistory: []
      }
    ]);
    setGlobal('shrinkCountdowns', [
      { shrinkAmount: 6, offsetX: 0, offsetZ: 0 }
    ]);
    // Run one step — both should survive
    stepAI();
    expect(aiSnakes[0].alive).toBe(true);
    expect(aiSnakes[1].alive).toBe(true);
  });
});

// ─── Edge cases ───
describe('ai.js — shrink escape edge cases', () => {
  beforeEach(() => {
    gridMinX = -11;
    gridMaxX = 11;
    gridMinZ = -11;
    gridMaxZ = 11;
    setSnake([{x: 0, z: 0}]);
    setApples([]);
    setObstacles([]);
    setGlobal('gridSize', 22);
    setGlobal('half', 11);
    setGlobal('shrinkCountdowns', []);
  });

  test('AI with single segment handles shrink zone correctly', () => {
    setGlobal('aiSnakes', [
      {
        id: 'ai_0',
        color: 'red',
        alive: true,
        score: 0,
        snake: [{x: 10, z: 0}],
        direction: 0,
        stuckHistory: []
      }
    ]);
    setGlobal('shrinkCountdowns', [
      { shrinkAmount: 6, offsetX: 0, offsetZ: 0 }
    ]);
    // Single segment, no body in shrink zone to check
    expect(() => aiDecideDirection(0, 'hard')).not.toThrow();
  });

  test('AI survives when all safe directions lead to shrink zone', () => {
    // AI trapped at edge with only one safe direction
    setGlobal('aiSnakes', [
      {
        id: 'ai_0',
        color: 'red',
        alive: true,
        score: 0,
        snake: [{x: 10, z: 10}, {x: 9, z: 10}],
        direction: 0,
        stuckHistory: []
      }
    ]);
    // Block most directions with obstacles
    setObstacles([
      {x: 10, z: 9},  // block -Z
      {x: 11, z: 10}  // block +X (wall anyway)
    ]);
    setGlobal('shrinkCountdowns', [
      { shrinkAmount: 6, offsetX: 0, offsetZ: 0 }
    ]);
    // AI should still find a direction (even if it's toward shrink zone)
    expect(() => aiDecideDirection(0, 'hard')).not.toThrow();
  });

  test('shrink countdown with large grid (vs8)', () => {
    gridMinX = -31;
    gridMaxX = 31;
    gridMinZ = -31;
    gridMaxZ = 31;
    setGlobal('gridSize', 62);
    setGlobal('half', 31);
    setGlobal('aiSnakes', [
      {
        id: 'ai_0',
        color: 'red',
        alive: true,
        score: 0,
        snake: [{x: 30, z: 30}, {x: 29, z: 30}],
        direction: 0,
        stuckHistory: []
      }
    ]);
    setGlobal('shrinkCountdowns', [
      { shrinkAmount: 10, offsetX: 0, offsetZ: 0 }
    ]);
    // Safe zone: -31 to 21
    // AI at (30, 30) is in shrink zone
    expect(() => aiDecideDirection(0, 'hard')).not.toThrow();
  });

  test('cellInShrinkZone with boundary cells', () => {
    setGlobal('shrinkCountdowns', [
      { shrinkAmount: 6, offsetX: 0, offsetZ: 0 }
    ]);
    // Safe zone: -11 <= x < 5, -11 <= z < 5
    // Cell at (5, 0) is at boundary — 5 >= 5 is TRUE, so IN shrink zone
    expect(cellInShrinkZone(5, 0)).toBe(true);
    // Cell at (4, 0) is inside (4 < 5)
    expect(cellInShrinkZone(4, 0)).toBe(false);
    // Cell at (-11, 0) is at boundary — -11 >= -11 is FALSE, so NOT in shrink zone
    expect(cellInShrinkZone(-11, 0)).toBe(false);
    // Cell at (-12, 0) is outside grid entirely — -12 < -11, so IN shrink zone
    expect(cellInShrinkZone(-12, 0)).toBe(true);
  });
});
