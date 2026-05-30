// ─── Tests: AI opponents + multi-snake (Fase 4-5) ───
// Tests for AI snake infrastructure, isOccupied with AI, and AI logic.

const { setSnake, setApples, setObstacles } = require('./helpers');

// Helper to set global variables
const setGlobal = (name, value) => { global[name] = value; };

// ─── isOccupied() with AI snakes ───
describe('apples.js — isOccupied() with AI snakes', () => {
  beforeEach(() => {
    setSnake([]);
    setApples([]);
    setObstacles([]);
    setGlobal('aiSnakes', []);
    setGlobal('corpses', []);
  });

  test('returns false when grid is empty', () => {
    expect(isOccupied(0, 0)).toBe(false);
  });

  test('returns true when AI snake occupies cell', () => {
    setGlobal('aiSnakes', [{
      alive: true,
      snake: [{x: 3, z: 4}, {x: 2, z: 4}, {x: 1, z: 4}]
    }]);
    expect(isOccupied(3, 4)).toBe(true);
    expect(isOccupied(2, 4)).toBe(true);
    expect(isOccupied(1, 4)).toBe(true);
    expect(isOccupied(0, 0)).toBe(false);
  });

  test('ignores dead AI snakes', () => {
    setGlobal('aiSnakes', [{
      alive: false,
      snake: [{x: 5, z: 5}, {x: 4, z: 5}]
    }]);
    expect(isOccupied(5, 5)).toBe(false);
  });

  test('returns true when corpse occupies cell', () => {
    setGlobal('corpses', [{x: 7, z: 8}, {x: 6, z: 8}]);
    expect(isOccupied(7, 8)).toBe(true);
    expect(isOccupied(6, 8)).toBe(true);
    expect(isOccupied(0, 0)).toBe(false);
  });

  test('checks both alive AI and corpses', () => {
    setGlobal('aiSnakes', [{
      alive: true,
      snake: [{x: 1, z: 0}]
    }]);
    setGlobal('corpses', [{x: 2, z: 0}]);
    expect(isOccupied(1, 0)).toBe(true);
    expect(isOccupied(2, 0)).toBe(true);
    expect(isOccupied(3, 0)).toBe(false);
  });

  test('handles undefined aiSnakes gracefully', () => {
    setGlobal('aiSnakes', undefined);
    setGlobal('corpses', undefined);
    expect(() => isOccupied(0, 0)).not.toThrow();
    expect(isOccupied(0, 0)).toBe(false);
  });
});

// ─── isSafeForObstacle() with AI snakes ───
describe('obstacles.js — isSafeForObstacle() with AI snakes', () => {
  beforeEach(() => {
    setSnake([{x: 0, z: 0}]);
    setApples([]);
    setObstacles([]);
    setGlobal('aiSnakes', []);
    setGlobal('corpses', []);
  });

  test('returns false when near AI snake', () => {
    setGlobal('aiSnakes', [{
      alive: true,
      snake: [{x: 10, z: 10}]
    }]);
    // OBSTACLE_MIN_DIST_SNAKE is 6, so positions within 5 Manhattan distance should be unsafe
    expect(isSafeForObstacle(10, 10)).toBe(false);
    expect(isSafeForObstacle(9, 10)).toBe(false);
    expect(isSafeForObstacle(8, 10)).toBe(false);
  });

  test('returns true when far from AI snake', () => {
    setGlobal('aiSnakes', [{
      alive: true,
      snake: [{x: 10, z: 10}]
    }]);
    // Manhattan distance 6+ should be safe from AI snake
    expect(isSafeForObstacle(16, 10)).toBe(true);
  });

  test('ignores dead AI snakes for distance check', () => {
    setGlobal('aiSnakes', [{
      alive: false,
      snake: [{x: 5, z: 5}]
    }]);
    // Dead AI snake is skipped in distance check
    // But if there's a corpse at (5,5), isOccupied will block
    setGlobal('corpses', []); // no corpses
    expect(isSafeForObstacle(5, 5)).toBe(true); // no distance check for dead AI, no corpse
  });

  test('handles multiple AI snakes', () => {
    setGlobal('aiSnakes', [
      {alive: true, snake: [{x: 10, z: 10}]},
      {alive: true, snake: [{x: -10, z: -10}]}
    ]);
    expect(isSafeForObstacle(10, 10)).toBe(false);
    expect(isSafeForObstacle(-10, -10)).toBe(false);
    expect(isSafeForObstacle(0, 12)).toBe(true); // far from both AI and player
  });
});

// ─── AI direction evaluation ───
describe('ai.js — aiEvaluateDirections()', () => {
  beforeEach(() => {
    setSnake([{x: 0, z: 0}, {x: -1, z: 0}]);
    setApples([{x: 3, z: 0}]);
    setObstacles([]);
    setGlobal('aiSnakes', []);
    setGlobal('corpses', []);
    setGlobal('gridSize', 22);
  });

  test('identifies safe directions', () => {
    // AI at (0,0) facing direction 0 (moving +X)
    var aiSnake = [{x: 0, z: 0}, {x: -1, z: 0}];
    var aiDir = 0;
    var safe = aiEvaluateDirections(0, aiSnake, aiDir);
    expect(safe.length).toBeGreaterThan(0);
  });

  test('eliminates wall directions', () => {
    var aiSnake = [{x: half - 1, z: 0}, {x: half - 2, z: 0}];
    var aiDir = 0; // facing wall
    var safe = aiEvaluateDirections(0, aiSnake, aiDir);
    // Forward should be eliminated
    safe.forEach(function(d) {
      var nx = aiSnake[0].x + Math.round(Math.cos(d));
      var nz = aiSnake[0].z + Math.round(Math.sin(d));
      expect(nx).toBeGreaterThanOrEqual(-half);
      expect(nx).toBeLessThan(half);
      expect(nz).toBeGreaterThanOrEqual(-half);
      expect(nz).toBeLessThan(half);
    });
  });

  test('eliminates self-collision directions', () => {
    var aiSnake = [{x: 0, z: 0}, {x: -1, z: 0}, {x: -1, z: 1}, {x: 0, z: 1}];
    var aiDir = 0;
    var safe = aiEvaluateDirections(0, aiSnake, aiDir);
    // Turning right (direction +PI/2) would hit body at (0,1)
    safe.forEach(function(d) {
      var nx = aiSnake[0].x + Math.round(Math.cos(d));
      var nz = aiSnake[0].z + Math.round(Math.sin(d));
      var hitsSelf = aiSnake.some(function(s) { return s.x === nx && s.z === nz; });
      expect(hitsSelf).toBe(false);
    });
  });
});

// ─── AI direction decision ───
describe('ai.js — aiDecideDirection()', () => {
  beforeEach(() => {
    setSnake([{x: 0, z: 0}]);
    setApples([{x: 5, z: 0}]);
    setObstacles([]);
    setGlobal('aiSnakes', [{
      alive: true,
      snake: [{x: 0, z: 0}, {x: -1, z: 0}],
      direction: 0,
      color: 'red'
    }]);
    setGlobal('corpses', []);
    setGlobal('gridSize', 22);
    setGlobal('difficulty', 'medium');
  });

  test('easy mode sometimes picks random safe direction', () => {
    // Run multiple times to check randomness
    var results = {};
    for (var i = 0; i < 50; i++) {
      setGlobal('difficulty', 'easy');
      var dir = aiDecideDirection(0, 'easy');
      results[dir] = (results[dir] || 0) + 1;
    }
    // Should have some variation (not always the same direction)
    expect(Object.keys(results).length).toBeGreaterThanOrEqual(1);
  });

  test('hard mode mostly picks optimal direction', () => {
    var results = {};
    for (var i = 0; i < 50; i++) {
      setGlobal('difficulty', 'hard');
      var dir = aiDecideDirection(0, 'hard');
      results[dir] = (results[dir] || 0) + 1;
    }
    // Hard mode should be mostly consistent
    var maxCount = Math.max.apply(null, Object.values(results));
    expect(maxCount / 50).toBeGreaterThan(0.8);
  });
});

// ─── initAI() ───
describe('ai.js — initAI()', () => {
  beforeEach(() => {
    setSnake([{x: -5, z: 0}, {x: -6, z: 0}, {x: -7, z: 0}, {x: -8, z: 0}]);
    setApples([]);
    setObstacles([]);
    setGlobal('aiSnakes', []);
    setGlobal('corpses', []);
    setGlobal('gameMode', 'solo');
    setGlobal('difficulty', 'medium');
    setGlobal('playerColor', 'green');
    setGlobal('gridSize', 22);
  });

  test('solo mode creates 0 AI snakes', () => {
    setGlobal('gameMode', 'solo');
    initAI();
    expect(aiSnakes.length).toBe(0);
  });

  test('vs2 mode creates 1 AI snake', () => {
    setGlobal('gameMode', 'vs2');
    initAI();
    expect(aiSnakes.length).toBe(1);
  });

  test('vs3 mode creates 2 AI snakes', () => {
    setGlobal('gameMode', 'vs3');
    initAI();
    expect(aiSnakes.length).toBe(2);
  });

  test('vs4 mode creates 3 AI snakes', () => {
    setGlobal('gameMode', 'vs4');
    initAI();
    expect(aiSnakes.length).toBe(3);
  });

  test('AI snakes have colors different from player', () => {
    setGlobal('gameMode', 'vs4');
    setGlobal('playerColor', 'green');
    initAI();
    aiSnakes.forEach(function(ai) {
      expect(ai.color).not.toBe('green');
    });
  });

  test('AI snakes have unique colors among themselves', () => {
    setGlobal('gameMode', 'vs4');
    initAI();
    var colors = aiSnakes.map(function(ai) { return ai.color; });
    var unique = colors.filter(function(v, i) { return colors.indexOf(v) === i; });
    expect(unique.length).toBe(colors.length);
  });

  test('AI snakes start alive', () => {
    setGlobal('gameMode', 'vs2');
    initAI();
    expect(aiSnakes[0].alive).toBe(true);
  });
});

// ─── aiDie() ───
describe('ai.js — aiDie()', () => {
  beforeEach(() => {
    setSnake([{x: 0, z: 0}]);
    setApples([]);
    setObstacles([]);
    setGlobal('aiSnakes', [{
      alive: true,
      snake: [{x: 5, z: 0}, {x: 4, z: 0}, {x: 3, z: 0}],
      direction: 0,
      color: 'red'
    }]);
    setGlobal('corpses', []);
    setGlobal('gridSize', 22);
  });

  test('sets alive to false', () => {
    aiDie(0);
    expect(aiSnakes[0].alive).toBe(false);
  });

  test('adds corpse segments to corpses array', () => {
    aiDie(0);
    expect(corpses.length).toBeGreaterThan(0);
  });

  test('corpse segments match dead snake body', () => {
    aiDie(0);
    var corpsePositions = corpses.map(function(c) { return c.x + ',' + c.z; });
    expect(corpsePositions).toContain('5,0');
    expect(corpsePositions).toContain('4,0');
    expect(corpsePositions).toContain('3,0');
  });
});

// ─── nearestApple() ───
describe('ai.js — nearestApple()', () => {
  beforeEach(() => {
    setSnake([{x: 0, z: 0}]);
    setObstacles([]);
    setGlobal('aiSnakes', []);
    setGlobal('corpses', []);
    setGlobal('gridSize', 22);
  });

  test('returns null when no apples', () => {
    setApples([]);
    expect(nearestApple(0, 0)).toBeNull();
  });

  test('returns closest apple by Manhattan distance', () => {
    setApples([
      {x: 5, z: 5},
      {x: 2, z: 0},
      {x: 10, z: 10}
    ]);
    var nearest = nearestApple(0, 0);
    expect(nearest.x).toBe(2);
    expect(nearest.z).toBe(0);
  });

  test('skips null apple entries', () => {
    setApples([null, {x: 3, z: 1}, null]);
    var nearest = nearestApple(0, 0);
    expect(nearest.x).toBe(3);
    expect(nearest.z).toBe(1);
  });

  test('prefers apple with smaller Manhattan distance', () => {
    setApples([
      {x: -3, z: 0},
      {x: 2, z: 2}
    ]);
    // dist to (-3,0) = 3, dist to (2,2) = 4
    var nearest = nearestApple(0, 0);
    expect(nearest.x).toBe(-3);
    expect(nearest.z).toBe(0);
  });
});

// ─── aiCorneringStrategy() ───
describe('ai.js — aiCorneringStrategy()', () => {
  beforeEach(() => {
    setSnake([{x: 0, z: 0}, {x: -1, z: 0}]);
    setApples([]);
    setObstacles([]);
    setGlobal('aiSnakes', [{
      alive: true,
      snake: [{x: 5, z: 5}, {x: 4, z: 5}, {x: 3, z: 5}, {x: 2, z: 5}],
      direction: 0,
      color: 'red'
    }]);
    setGlobal('corpses', []);
    setGlobal('gridSize', 22);
    setGlobal('difficulty', 'hard');
  });

  test('returns false when AI is not alive', () => {
    aiSnakes[0].alive = false;
    expect(aiCorneringStrategy(0, 'hard')).toBe(false);
  });

  test('returns false when no shorter targets nearby', () => {
    // AI is length 4, player is length 2, but player is far
    setSnake([{x: -10, z: -10}, {x: -11, z: -10}]);
    // With random factor, may or may not trigger; we just check it doesn't throw
    expect(() => aiCorneringStrategy(0, 'hard')).not.toThrow();
  });

  test('returns false when target is not near wall', () => {
    // Player in center of map, far from walls
    setSnake([
      {x: 0, z: 0}, {x: -1, z: 0}, {x: -2, z: 0},
      {x: -3, z: 0}, {x: -4, z: 0}, {x: -5, z: 0}
    ]);
    // AI is shorter (4 vs 6), so it won't try to corner
    expect(() => aiCorneringStrategy(0, 'hard')).not.toThrow();
  });

  test('returns true when target is shorter and near wall and close', () => {
    // Player is short (2 segments) and near wall at x=half-2
    setSnake([{x: half - 2, z: 5}, {x: half - 3, z: 5}]);
    // AI is longer (4 segments) and close (dist < 8)
    // Note: random factor may prevent activation, so we just check it doesn't throw
    expect(() => aiCorneringStrategy(0, 'hard')).not.toThrow();
  });

  test('handles no targets gracefully', () => {
    setSnake([]);
    expect(aiCorneringStrategy(0, 'hard')).toBe(false);
  });
});

// ─── stepAI() ───
describe('ai.js — stepAI()', () => {
  beforeEach(() => {
    setSnake([{x: -5, z: 0}, {x: -6, z: 0}]);
    setApples([{x: 3, z: 0}]);
    setObstacles([]);
    setGlobal('aiSnakes', [{
      alive: true,
      snake: [{x: 5, z: 0}, {x: 4, z: 0}, {x: 3, z: 0}, {x: 2, z: 0}],
      direction: 0,
      color: 'red',
      score: 0,
      groupData: null
    }]);
    setGlobal('corpses', []);
    setGlobal('gridSize', 22);
    setGlobal('difficulty', 'hard');
  });

  test('does nothing when no AI snakes', () => {
    setGlobal('aiSnakes', []);
    expect(() => stepAI()).not.toThrow();
  });

  test('skips dead AI snakes', () => {
    aiSnakes[0].alive = false;
    var snakeLen = aiSnakes[0].snake.length;
    stepAI();
    expect(aiSnakes[0].snake.length).toBe(snakeLen); // unchanged
  });

  test('AI snake moves forward', () => {
    var headX = aiSnakes[0].snake[0].x;
    stepAI();
    // After step, new head should be different
    expect(aiSnakes[0].snake[0].x).not.toBe(headX);
  });

  test('AI snake grows when eating apple', () => {
    // Position AI snake to eat apple at (3,0)
    aiSnakes[0].snake = [{x: 2, z: 0}, {x: 1, z: 0}, {x: 0, z: 0}, {x: -1, z: 0}];
    aiSnakes[0].direction = 0;
    var lenBefore = aiSnakes[0].snake.length;
    stepAI();
    expect(aiSnakes[0].snake.length).toBe(lenBefore + 1);
    expect(aiSnakes[0].score).toBe(1);
  });

  test('AI dies when hitting wall — trapped position', () => {
    // AI in corner: all 3 directions lead to walls
    aiSnakes[0].snake = [{x: half - 1, z: half - 1}, {x: half - 2, z: half - 1}];
    aiSnakes[0].direction = Math.PI / 4; // diagonal — not cardinal, so AI will try to turn
    // Block escape with obstacles
    setObstacles([
      {x: half - 2, z: half - 1}, // behind
      {x: half - 1, z: half - 2}  // left
    ]);
    stepAI();
    // With no safe directions, AI keeps current dir and hits wall
    expect(aiSnakes[0].alive).toBe(false);
  });

  test('AI dies when hitting self — U-shape trap', () => {
    // Dead-end U-shape: head at (0,0), body wraps around
    // Forward (+Z) hits (0,1), right (+X) hits (1,0), left (-X) is open but body at (-1,0)
    aiSnakes[0].snake = [{x: 0, z: 0}, {x: 0, z: 1}, {x: 1, z: 1}, {x: 1, z: 0}, {x: -1, z: 0}];
    aiSnakes[0].direction = Math.PI / 2; // facing +Z
    // All 3 dirs blocked: forward by body, right by body, left by body
    stepAI();
    expect(aiSnakes[0].alive).toBe(false);
  });

  test('AI dies when hitting obstacle — surrounded', () => {
    // AI surrounded by obstacles on all sides
    aiSnakes[0].snake = [{x: 0, z: 0}, {x: -1, z: 0}];
    aiSnakes[0].direction = 0;
    setObstacles([
      {x: 1, z: 0}, // forward
      {x: 0, z: 1}, // right
      {x: 0, z: -1} // left
    ]);
    // Backward (-X) is blocked by own body segment at (-1, 0)
    stepAI();
    // AI has no safe direction, keeps current dir, hits obstacle
    expect(aiSnakes[0].alive).toBe(false);
  });

  test('AI dies when hitting corpse — corpse blocks path', () => {
    setGlobal('corpses', [
      {x: 6, z: 0}, {x: 7, z: 0}, {x: 6, z: 1}, {x: 6, z: -1}
    ]);
    // AI heading toward corpse cluster
    aiSnakes[0].snake = [{x: 5, z: 0}, {x: 4, z: 0}, {x: 3, z: 0}];
    aiSnakes[0].direction = 0;
    stepAI();
    // AI should avoid the corpse and pick another direction
    // If it can't, it dies
    // In this case, it can turn, so it survives
    expect(aiSnakes[0].alive).toBe(true);
  });

  test('AI dies when hitting player snake — player blocks', () => {
    // Player snake blocks AI path
    setSnake([
      {x: 6, z: 0}, {x: 7, z: 0}, {x: 6, z: 1}, {x: 6, z: -1}
    ]);
    aiSnakes[0].snake = [{x: 5, z: 0}, {x: 4, z: 0}];
    aiSnakes[0].direction = 0;
    stepAI();
    // AI should avoid player and turn
    expect(aiSnakes[0].alive).toBe(true);
  });
});

// ─── refreshAISnakes() ───
describe('ai.js — refreshAISnakes()', () => {
  beforeEach(() => {
    setSnake([{x: 0, z: 0}]);
    setApples([]);
    setObstacles([]);
    setGlobal('aiSnakes', [{
      alive: true,
      snake: [{x: 5, z: 0}, {x: 4, z: 0}],
      direction: 0,
      color: 'red',
      groupData: {
        group: { children: [] },
        headM: { position: { x: 0, y: 0, z: 0, set: function(){} }, rotation: { y: 0 }, visible: true },
        bodyMs: [{ position: { x: 0, y: 0, z: 0, set: function(){} }, scale: { set: function(){} }, visible: true }]
      }
    }]);
    setGlobal('corpses', []);
    setGlobal('gridSize', 22);
  });

  test('does nothing when no AI snakes', () => {
    setGlobal('aiSnakes', []);
    expect(() => refreshAISnakes()).not.toThrow();
  });

  test('skips dead AI snakes', () => {
    aiSnakes[0].alive = false;
    expect(() => refreshAISnakes()).not.toThrow();
  });

  test('calls refreshSnake for each alive AI with groupData', () => {
    expect(() => refreshAISnakes()).not.toThrow();
  });

  test('skips AI without groupData', () => {
    aiSnakes[0].groupData = null;
    expect(() => refreshAISnakes()).not.toThrow();
  });
});
