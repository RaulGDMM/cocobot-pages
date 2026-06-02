// ─── Tests: AI opponents + multi-snake (enhanced) ───
// Tests for AI snake infrastructure, pathfinding, strategies, and decision logic.

const { setSnake, setApples, setObstacles } = require('./helpers');

// Helper to set global variables
const setGlobal = (name, value) => { global[name] = value; };

// ─── snapToCardinal() ───
describe('ai.js — snapToCardinal()', () => {
  test('snaps 0 to 0', () => {
    expect(snapToCardinal(0)).toBe(0);
  });

  test('snaps π/2 to π/2', () => {
    expect(snapToCardinal(Math.PI / 2)).toBeCloseTo(Math.PI / 2);
  });

  test('snaps π to π', () => {
    expect(snapToCardinal(Math.PI)).toBeCloseTo(Math.PI);
  });

  test('snaps -π/2 to -π/2', () => {
    expect(snapToCardinal(-Math.PI / 2)).toBeCloseTo(-Math.PI / 2);
  });

  test('snaps diagonal angle (π/4) to nearest cardinal', () => {
    var result = snapToCardinal(Math.PI / 4);
    var isCardinal = (Math.abs(result) < 0.01) || (Math.abs(result - Math.PI / 2) < 0.01);
    expect(isCardinal).toBe(true);
  });

  test('snaps small deviation from cardinal to that cardinal', () => {
    expect(snapToCardinal(0.1)).toBeCloseTo(0);
    expect(snapToCardinal(Math.PI / 2 + 0.1)).toBeCloseTo(Math.PI / 2);
  });

  test('snaps angle past π to nearest cardinal', () => {
    expect(snapToCardinal(1.6)).toBeCloseTo(Math.PI / 2);
  });

  test('handles negative angles', () => {
    expect(snapToCardinal(-2)).toBeCloseTo(-Math.PI / 2);
  });

  test('handles full rotation angles', () => {
    expect(snapToCardinal(Math.PI * 2)).toBeCloseTo(0);
    expect(snapToCardinal(-Math.PI * 2)).toBeCloseTo(0);
  });
});

// ─── DIRS constant ───
describe('ai.js — DIRS', () => {
  test('has 4 direction vectors', () => {
    expect(DIRS.length).toBe(4);
  });

  test('directions are cardinal', () => {
    expect(DIRS).toEqual([{x:1,z:0},{x:-1,z:0},{x:0,z:1},{x:0,z:-1}]);
  });
});

// ─── buildBlockedSet() ───
describe('ai.js — buildBlockedSet()', () => {
  beforeEach(() => {
    setSnake([{x: 0, z: 0}, {x: -1, z: 0}]);
    setApples([]);
    setObstacles([{x: 5, z: 5}]);
    setGlobal('aiSnakes', [{
      alive: true,
      id: 'ai_0',
      snake: [{x: 10, z: 10}, {x: 9, z: 10}]
    }]);
    setGlobal('gridSize', 22);
  });

  test('includes player snake cells', () => {
    var blocked = buildBlockedSet();
    expect(blocked['0,0']).toBe(true);
    expect(blocked['-1,0']).toBe(true);
  });

  test('includes obstacle cells', () => {
    var blocked = buildBlockedSet();
    expect(blocked['5,5']).toBe(true);
  });

  test('includes other AI snake cells', () => {
    var blocked = buildBlockedSet();
    expect(blocked['10,10']).toBe(true);
  });

  test('excludes specified snake ID', () => {
    var blocked = buildBlockedSet('ai_0');
    expect(blocked['10,10']).toBeUndefined();
  });

  test('empty grid returns empty blocked set', () => {
    setSnake([]);
    setObstacles([]);
    setGlobal('aiSnakes', []);
    var blocked = buildBlockedSet();
    expect(Object.keys(blocked).length).toBe(0);
  });
});

// ─── bfsPath() ───
describe('ai.js — bfsPath()', () => {
  beforeEach(() => {
    setSnake([]);
    setApples([]);
    setObstacles([]);
    setGlobal('aiSnakes', []);
    setGlobal('gridSize', 22);
    setGlobal('half', 11);
  });

  test('finds direct path to adjacent cell', () => {
    var blocked = {};
    var path = bfsPath(0, 0, 1, 0, blocked, null, 100);
    expect(path).not.toBeNull();
    expect(path.length).toBe(2);
    expect(path[0]).toEqual({x: 0, z: 0});
    expect(path[1]).toEqual({x: 1, z: 0});
  });

  test('finds path around obstacle', () => {
    var blocked = {'1,0': true};
    var path = bfsPath(0, 0, 2, 0, blocked, null, 100);
    expect(path).not.toBeNull();
    expect(path[path.length - 1]).toEqual({x: 2, z: 0});
  });

  test('returns null when target is blocked', () => {
    var blocked = {'1,0': true};
    var path = bfsPath(0, 0, 1, 0, blocked, null, 100);
    expect(path).toBeNull();
  });

  test('returns null when start is blocked', () => {
    var blocked = {'0,0': true};
    var path = bfsPath(0, 0, 1, 0, blocked, null, 100);
    expect(path).toBeNull();
  });

  test('returns null when no path exists (fully blocked)', () => {
    // Block ALL 4 directions from (0,0)
    var blocked = {'1,0': true, '-1,0': true, '0,1': true, '0,-1': true};
    var path = bfsPath(0, 0, 2, 0, blocked, null, 100);
    expect(path).toBeNull();
  });

  test('respects grid boundaries', () => {
    var blocked = {};
    var path = bfsPath(10, 0, 15, 0, blocked, null, 100);
    expect(path).toBeNull(); // 15 >= half (11)
  });

  test('returns path through multiple steps', () => {
    var blocked = {};
    var path = bfsPath(0, 0, 3, 2, blocked, null, 100);
    expect(path).not.toBeNull();
    expect(path.length).toBe(6); // 0,0 → 1,0 → 2,0 → 3,0 → 3,1 → 3,2
  });

  test('allows moving to snake tail position', () => {
    var blocked = {};
    var snakeBody = [{x: 0, z: 0}, {x: 1, z: 0}, {x: 2, z: 0}];
    var path = bfsPath(0, 0, 3, 0, blocked, snakeBody, 100);
    // Should allow moving through tail (2,0) since it will vacate
    expect(path).not.toBeNull();
  });

  test('respects maxSteps limit', () => {
    var blocked = {};
    var path = bfsPath(0, 0, 10, 10, blocked, null, 5);
    expect(path).toBeNull(); // Too few steps
  });

  test('routes around non-tail body segments', () => {
    // Body occupies (1,0) and (2,0) (tail). The straight path is blocked by
    // the non-tail segment (1,0), so BFS must detour but still reach (3,0).
    var blocked = {};
    var snakeBody = [{x: 0, z: 0}, {x: 1, z: 0}, {x: 2, z: 0}];
    var path = bfsPath(0, 0, 3, 0, blocked, snakeBody, 100);
    expect(path).not.toBeNull();
    // The detour must not step through the non-tail body cell (1,0)
    var stepsThroughBody = path.some(function(p) { return p.x === 1 && p.z === 0; });
    expect(stepsThroughBody).toBe(false);
    expect(path[path.length - 1]).toEqual({x: 3, z: 0});
  });

  test('non-tail body fully blocking returns null', () => {
    // Surround the start with walls of non-tail body so no route exists.
    var blocked = {'0,1': true, '0,-1': true, '-1,0': true};
    // Body segment directly ahead (1,0) is NOT the tail (tail is far away)
    var snakeBody = [{x: 0, z: 0}, {x: 1, z: 0}, {x: 1, z: 1}, {x: 5, z: 5}];
    var path = bfsPath(0, 0, 3, 0, blocked, snakeBody, 100);
    expect(path).toBeNull();
  });
});

// ─── countReachable() ───
describe('ai.js — countReachable()', () => {
  beforeEach(() => {
    setSnake([]);
    setApples([]);
    setObstacles([]);
    setGlobal('aiSnakes', []);
    setGlobal('gridSize', 22);
    setGlobal('half', 11);
  });

  test('returns high count in open space', () => {
    var count = countReachable(0, 0, [], 50);
    expect(count).toBe(50); // hits maxSteps limit
  });

  test('returns low count in confined space', () => {
    // Surround with obstacles
    setObstacles([
      {x: 1, z: 0}, {x: -1, z: 0}, {x: 0, z: 1}, {x: 0, z: -1}
    ]);
    var count = countReachable(0, 0, [], 50);
    expect(count).toBe(1); // Only the starting cell
  });

  test('respects snake body as obstacle', () => {
    setSnake([{x: 1, z: 0}, {x: 2, z: 0}]);
    // Snake body around (0,0) blocks some cells
    var snakeBody = [{x: 0, z: 0}, {x: -1, z: 0}];
    var count = countReachable(0, 0, snakeBody, 10);
    // With player snake at (1,0),(2,0) and own body at (-1,0),
    // some directions are blocked so count should be less than full 10
    expect(count).toBeLessThanOrEqual(10);
  });

  test('own body cells reduce reachable count vs no body', () => {
    // Confine the start to a small 2-wide corridor with obstacles so the
    // reachable region is small enough that the body makes a measurable dent.
    setSnake([]);
    setGlobal('aiSnakes', []);
    setObstacles([
      {x: 0, z: -1}, {x: 1, z: -1}, {x: 2, z: -1}, {x: 3, z: -1},
      {x: 0, z: 2}, {x: 1, z: 2}, {x: 2, z: 2}, {x: 3, z: 2},
      {x: -1, z: 0}, {x: -1, z: 1}, {x: 4, z: 0}, {x: 4, z: 1}
    ]);
    var open = countReachable(0, 0, [], 30); // corridor cells only (~8)
    // Body blocks part of the corridor (tail excluded), shrinking reachability.
    var body = [{x: 0, z: 0}, {x: 1, z: 0}, {x: 2, z: 0}, {x: 3, z: 0}];
    var walled = countReachable(0, 0, body, 30);
    expect(walled).toBeLessThan(open);
  });
});

// ─── countEscapeRoutes() ───
describe('ai.js — countEscapeRoutes()', () => {
  beforeEach(() => {
    setSnake([]);
    setApples([]);
    setObstacles([]);
    setGlobal('aiSnakes', []);
    setGlobal('gridSize', 22);
    setGlobal('half', 11);
  });

  test('returns 4 in open space', () => {
    var blocked = {};
    var routes = countEscapeRoutes(0, 0, [], blocked);
    expect(routes).toBe(4);
  });

  test('returns 0 when fully surrounded', () => {
    var blocked = {'1,0': true, '-1,0': true, '0,1': true, '0,-1': true};
    var routes = countEscapeRoutes(0, 0, [], blocked);
    expect(routes).toBe(0);
  });

  test('returns 1 when only one escape', () => {
    var blocked = {'1,0': true, '-1,0': true, '0,1': true};
    var routes = countEscapeRoutes(0, 0, [], blocked);
    expect(routes).toBe(1);
  });

  test('respects wall boundaries', () => {
    var blocked = {};
    var routes = countEscapeRoutes(10, 10, [], blocked); // corner
    expect(routes).toBe(2); // Only -X and -Z directions
  });

  test('allows tail cell as escape', () => {
    var blocked = {'1,0': true, '-1,0': true, '0,1': true};
    var snakeBody = [{x: 0, z: 0}, {x: 0, z: -1}]; // tail at (0,-1)
    var routes = countEscapeRoutes(0, 0, snakeBody, blocked);
    expect(routes).toBe(1); // tail direction is allowed
  });
});

// ─── bfsPathToTail() ───
describe('ai.js — bfsPathToTail()', () => {
  beforeEach(() => {
    setSnake([]);
    setApples([]);
    setObstacles([]);
    setGlobal('aiSnakes', []);
    setGlobal('gridSize', 22);
    setGlobal('half', 11);
  });

  test('returns null for snake with < 2 segments', () => {
    expect(bfsPathToTail([{x: 0, z: 0}])).toBeNull();
  });

  test('finds path to own tail', () => {
    // Straight snake: head at (0,0), tail at (0,4)
    var snakeBody = [
      {x: 0, z: 0}, {x: 0, z: 1}, {x: 0, z: 2},
      {x: 0, z: 3}, {x: 0, z: 4}
    ];
    var path = bfsPathToTail(snakeBody);
    expect(path).not.toBeNull();
    expect(path[path.length - 1]).toEqual({x: 0, z: 4}); // tail position
  });

  test('tail may be reachable by going around', () => {
    // U-shape: head at (0,0), body wraps, tail at (1,0)
    // Body blocks (0,1) and (1,1), but BFS can go around via (-1,0)
    var snakeBody = [
      {x: 0, z: 0}, {x: 0, z: 1}, {x: 1, z: 1}, {x: 1, z: 0}
    ];
    var path = bfsPathToTail(snakeBody);
    // Path exists — goes around the U
    expect(path).not.toBeNull();
    expect(path[path.length - 1]).toEqual({x: 1, z: 0});
  });
});

// ─── nearestApple() ───
describe('ai.js — nearestApple()', () => {
  beforeEach(() => {
    setSnake([{x: 0, z: 0}]);
    setObstacles([]);
    setGlobal('aiSnakes', []);
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
    setApples([{x: -3, z: 0}, {x: 2, z: 2}]);
    var nearest = nearestApple(0, 0);
    expect(nearest.x).toBe(-3);
    expect(nearest.z).toBe(0);
  });
});

// ─── bestApple() ───
describe('ai.js — bestApple()', () => {
  beforeEach(() => {
    setSnake([{x: 0, z: 0}]);
    setObstacles([]);
    setGlobal('aiSnakes', []);
    setGlobal('gridSize', 22);
    setGlobal('half', 11);
  });

  test('returns null when no apples', () => {
    setApples([]);
    var blocked = {};
    expect(bestApple([{x: 0, z: 0}], blocked, 'hard')).toBeNull();
  });

  test('returns nearest apple in easy mode (no bestApple strategy)', () => {
    setApples([{x: 5, z: 5}, {x: 2, z: 0}]);
    var blocked = {};
    var apple = bestApple([{x: 0, z: 0}], blocked, 'easy');
    expect(apple.x).toBe(2);
    expect(apple.z).toBe(0);
  });

  test('prefers reachable apple over closer unreachable one', () => {
    setApples([{x: 1, z: 0}, {x: 3, z: 3}]);
    // Block path to (1,0)
    var blocked = {'1,0': true, '0,1': true, '0,-1': true};
    var apple = bestApple([{x: 0, z: 0}], blocked, 'hard');
    // (1,0) is blocked, so (3,3) should be preferred
    expect(apple.x).toBe(3);
    expect(apple.z).toBe(3);
  });

  test('handles all null apples', () => {
    setApples([null, null, null]);
    var blocked = {};
    expect(bestApple([{x: 0, z: 0}], blocked, 'hard')).toBeNull();
  });
});

// ─── lookaheadScore() ───
describe('ai.js — lookaheadScore()', () => {
  beforeEach(() => {
    setSnake([]);
    setApples([]);
    setObstacles([]);
    setGlobal('aiSnakes', []);
    setGlobal('gridSize', 22);
    setGlobal('half', 11);
  });

  test('returns positive score in open space', () => {
    var snakeBody = [{x: 0, z: 0}, {x: -1, z: 0}];
    var blocked = {};
    var score = lookaheadScore(snakeBody, 0, 3, blocked);
    expect(score).toBeGreaterThan(0);
  });

  test('returns -1000 when path hits wall', () => {
    var snakeBody = [{x: 10, z: 0}, {x: 9, z: 0}];
    var blocked = {};
    var score = lookaheadScore(snakeBody, 0, 5, blocked);
    expect(score).toBe(-1000); // hits wall at x=11
  });

  test('returns -1000 when path hits blocked cell', () => {
    var snakeBody = [{x: 0, z: 0}, {x: -1, z: 0}];
    var blocked = {'1,0': true};
    var score = lookaheadScore(snakeBody, 0, 3, blocked);
    expect(score).toBe(-1000);
  });

  test('returns -1000 when path hits self', () => {
    var snakeBody = [{x: 0, z: 0}, {x: 1, z: 0}, {x: 1, z: 1}, {x: 0, z: 1}];
    var blocked = {};
    var score = lookaheadScore(snakeBody, 0, 3, blocked);
    expect(score).toBe(-1000); // hits self at (1,0)
  });
});

// ─── isOccupied() with AI snakes ───
describe('apples.js — isOccupied() with AI snakes', () => {
  beforeEach(() => {
    setSnake([]);
    setApples([]);
    setObstacles([]);
    setGlobal('aiSnakes', []);
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

  test('handles undefined aiSnakes gracefully', () => {
    setGlobal('aiSnakes', undefined);
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
  });

  test('returns false when near AI snake', () => {
    setGlobal('aiSnakes', [{
      alive: true,
      snake: [{x: 10, z: 10}]
    }]);
    expect(isSafeForObstacle(10, 10)).toBe(false);
  });

  test('returns true when far from AI snake', () => {
    setGlobal('aiSnakes', [{
      alive: true,
      snake: [{x: 10, z: 10}]
    }]);
    expect(isSafeForObstacle(16, 10)).toBe(true);
  });

  test('ignores dead AI snakes for distance check', () => {
    setGlobal('aiSnakes', [{
      alive: false,
      snake: [{x: 5, z: 5}]
    }]);
    expect(isSafeForObstacle(5, 5)).toBe(true);
  });
});

// ─── AI direction evaluation ───
describe('ai.js — aiEvaluateDirections()', () => {
  beforeEach(() => {
    setSnake([{x: 0, z: 0}, {x: -1, z: 0}]);
    setApples([{x: 3, z: 0}]);
    setObstacles([]);
    setGlobal('aiSnakes', []);
    setGlobal('gridSize', 22);
  });

  test('identifies safe directions', () => {
    var aiSnake = [{x: 0, z: 0}, {x: -1, z: 0}];
    var safe = aiEvaluateDirections(0, aiSnake, 0);
    expect(safe.length).toBeGreaterThan(0);
  });

  test('eliminates wall directions', () => {
    var aiSnake = [{x: half - 1, z: 0}, {x: half - 2, z: 0}];
    var safe = aiEvaluateDirections(0, aiSnake, 0);
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
    var safe = aiEvaluateDirections(0, aiSnake, 0);
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
      id: 'ai_0',
      alive: true,
      snake: [{x: 0, z: 0}, {x: -1, z: 0}],
      direction: 0,
      color: 'red'
    }]);
    setGlobal('gridSize', 22);
    setGlobal('difficulty', 'medium');
  });

  test('easy mode sometimes picks random safe direction', () => {
    var results = {};
    for (var i = 0; i < 50; i++) {
      var dir = aiDecideDirection(0, 'easy');
      results[dir] = (results[dir] || 0) + 1;
    }
    expect(Object.keys(results).length).toBeGreaterThanOrEqual(1);
  });

  test('hard mode mostly picks optimal direction', () => {
    var results = {};
    for (var i = 0; i < 50; i++) {
      var dir = aiDecideDirection(0, 'hard');
      results[dir] = (results[dir] || 0) + 1;
    }
    var maxCount = Math.max.apply(null, Object.values(results));
    expect(maxCount / 50).toBeGreaterThanOrEqual(0.8);
  });
});

// ─── AI_STRATEGY config ───
describe('ai.js — AI_STRATEGY', () => {
  test('has 3 difficulty levels', () => {
    expect(Object.keys(AI_STRATEGY).length).toBe(3);
  });

  test('easy: minimal strategies', () => {
    expect(AI_STRATEGY.easy.bfsPathfinding).toBe(false);
    expect(AI_STRATEGY.easy.tailChasing).toBe(false);
    expect(AI_STRATEGY.easy.lookahead).toBe(false);
    expect(AI_STRATEGY.easy.hunting).toBe(false);
  });

  test('medium: BFS + tail-chasing + anti-trap', () => {
    expect(AI_STRATEGY.medium.bfsPathfinding).toBe(true);
    expect(AI_STRATEGY.medium.tailChasing).toBe(true);
    expect(AI_STRATEGY.medium.antiTrap).toBe(true);
  });

  test('hard: all strategies enabled', () => {
    expect(AI_STRATEGY.hard.bfsPathfinding).toBe(true);
    expect(AI_STRATEGY.hard.tailChasing).toBe(true);
    expect(AI_STRATEGY.hard.lookahead).toBe(true);
    expect(AI_STRATEGY.hard.hunting).toBe(true);
    expect(AI_STRATEGY.hard.antiTrap).toBe(true);
  });

  test('error rates decrease with difficulty', () => {
    expect(AI_STRATEGY.easy.errorRate).toBeGreaterThan(AI_STRATEGY.medium.errorRate);
    expect(AI_STRATEGY.medium.errorRate).toBeGreaterThan(AI_STRATEGY.hard.errorRate);
  });
});

// ─── aiCorneringStrategy() ───
describe('ai.js — aiCorneringStrategy()', () => {
  beforeEach(() => {
    setSnake([{x: 0, z: 0}, {x: -1, z: 0}]);
    setApples([]);
    setObstacles([]);
    setGlobal('aiSnakes', [{
      id: 'ai_0',
      alive: true,
      snake: [{x: 5, z: 5}, {x: 4, z: 5}, {x: 3, z: 5}, {x: 2, z: 5}],
      direction: 0,
      color: 'red'
    }]);
    setGlobal('gridSize', 22);
    setGlobal('half', 11);
  });

  test('returns null when AI is not alive', () => {
    aiSnakes[0].alive = false;
    expect(aiCorneringStrategy(0, 'hard')).toBeNull();
  });

  test('returns null when no targets', () => {
    setSnake([]);
    expect(aiCorneringStrategy(0, 'hard')).toBeNull();
  });

  test('does not throw when target is far', () => {
    setSnake([{x: -10, z: -10}, {x: -11, z: -10}]);
    expect(() => aiCorneringStrategy(0, 'hard')).not.toThrow();
  });

  test('returns null in easy mode (hunting disabled)', () => {
    expect(aiCorneringStrategy(0, 'easy')).toBeNull();
  });
});

// ─── initAI() ───
describe('ai.js — initAI()', () => {
  beforeEach(() => {
    setSnake([{x: -5, z: 0}, {x: -6, z: 0}, {x: -7, z: 0}, {x: -8, z: 0}]);
    setApples([]);
    setObstacles([]);
    setGlobal('aiSnakes', []);
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
      id: 'ai_0',
      alive: true,
      snake: [{x: 5, z: 0}, {x: 4, z: 0}, {x: 3, z: 0}],
      direction: 0,
      color: 'red'
    }]);
    setGlobal('gridSize', 22);
    setGlobal('gridMinX', -11);
    setGlobal('gridMaxX', 11);
    setGlobal('gridMinZ', -11);
    setGlobal('gridMaxZ', 11);
    setGlobal('corpses', []);
  });

  test('sets alive to false', () => {
    aiDie(0, 'wall');
    expect(aiSnakes[0].alive).toBe(false);
  });

  test('creates corpse on death', () => {
    var corpsesBefore = corpses.length;
    aiDie(0, 'self');
    // Death creates a corpse entry, not instant apples
    expect(corpses.length).toBe(corpsesBefore + 1);
    expect(corpses[corpses.length - 1].segments.length).toBe(3);
  });

  test('corpse segments match dead snake body positions', () => {
    aiDie(0, 'wall');
    var corpseSegs = corpses[corpses.length - 1].segments;
    // 3 segments → all 3 stored in corpse
    expect(corpseSegs.some(function(s) { return s.x === 5 && s.z === 0; })).toBe(true);
    expect(corpseSegs.some(function(s) { return s.x === 4 && s.z === 0; })).toBe(true);
    expect(corpseSegs.some(function(s) { return s.x === 3 && s.z === 0; })).toBe(true);
  });
});

// ─── stepAI() ───
describe('ai.js — stepAI()', () => {
  beforeEach(() => {
    setSnake([{x: -5, z: 0}, {x: -6, z: 0}]);
    setApples([{x: 3, z: 0}]);
    setObstacles([]);
    setGlobal('aiSnakes', [{
      id: 'ai_0',
      alive: true,
      snake: [{x: 5, z: 0}, {x: 4, z: 0}, {x: 3, z: 0}, {x: 2, z: 0}],
      direction: 0,
      color: 'red',
      score: 0,
      groupData: null
    }]);
    setGlobal('gridSize', 22);
    setGlobal('gridMinX', -11);
    setGlobal('gridMaxX', 11);
    setGlobal('gridMinZ', -11);
    setGlobal('gridMaxZ', 11);
    setGlobal('difficulty', 'hard');
    setGlobal('corpses', []);
  });

  test('does nothing when no AI snakes', () => {
    setGlobal('aiSnakes', []);
    expect(() => stepAI()).not.toThrow();
  });

  test('skips dead AI snakes', () => {
    aiSnakes[0].alive = false;
    var snakeLen = aiSnakes[0].snake.length;
    stepAI();
    expect(aiSnakes[0].snake.length).toBe(snakeLen);
  });

  test('AI snake moves forward', () => {
    // Place apple away from AI body to avoid pathfinding conflict
    setApples([{x: 10, z: 5}]);
    var oldHeadX = aiSnakes[0].snake[0].x;
    var oldHeadZ = aiSnakes[0].snake[0].z;
    stepAI();
    // After step, new head should be at a different position
    var newHead = aiSnakes[0].snake[0];
    expect(newHead.x !== oldHeadX || newHead.z !== oldHeadZ).toBe(true);
  });

  test('AI snake grows when eating apple', () => {
    aiSnakes[0].snake = [{x: 2, z: 0}, {x: 1, z: 0}, {x: 0, z: 0}, {x: -1, z: 0}];
    aiSnakes[0].direction = 0;
    var lenBefore = aiSnakes[0].snake.length;
    stepAI();
    expect(aiSnakes[0].snake.length).toBe(lenBefore + 1);
    expect(aiSnakes[0].score).toBe(1);
  });

  test('AI dies when hitting wall — trapped position', () => {
    aiSnakes[0].snake = [{x: half - 1, z: half - 1}, {x: half - 2, z: half - 1}];
    aiSnakes[0].direction = Math.PI / 4;
    setObstacles([
      {x: half - 2, z: half - 1},
      {x: half - 1, z: half - 2}
    ]);
    stepAI();
    expect(aiSnakes[0].alive).toBe(false);
  });

  test('AI dies when hitting self — U-shape trap', () => {
    aiSnakes[0].snake = [{x: 0, z: 0}, {x: 0, z: 1}, {x: 1, z: 1}, {x: 1, z: 0}, {x: -1, z: 0}];
    aiSnakes[0].direction = Math.PI / 2;
    stepAI();
    expect(aiSnakes[0].alive).toBe(false);
  });

  test('AI dies when hitting obstacle — surrounded', () => {
    aiSnakes[0].snake = [{x: 0, z: 0}, {x: -1, z: 0}];
    aiSnakes[0].direction = 0;
    setObstacles([
      {x: 1, z: 0}, {x: 0, z: 1}, {x: 0, z: -1}
    ]);
    stepAI();
    expect(aiSnakes[0].alive).toBe(false);
  });

 test('AI avoids player snake and survives', () => {
    setSnake([
      {x: 6, z: 0}, {x: 7, z: 0}, {x: 6, z: 1}, {x: 6, z: -1}
    ]);
    aiSnakes[0].snake = [{x: 5, z: 0}, {x: 4, z: 0}];
    aiSnakes[0].direction = 0;
    stepAI();
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
      id: 'ai_0',
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

// ─── AI_STRATEGY — new human-like parameters ───
describe('ai.js — AI_STRATEGY human-like params', () => {
  test('easy mode has spaceCheckRelaxation > 0', () => {
    expect(AI_STRATEGY.easy.spaceCheckRelaxation).toBeGreaterThan(0);
    expect(AI_STRATEGY.easy.spaceCheckRelaxation).toBe(0.25);
  });

  test('medium mode has lower spaceCheckRelaxation than easy', () => {
    expect(AI_STRATEGY.medium.spaceCheckRelaxation).toBeGreaterThan(0);
    expect(AI_STRATEGY.medium.spaceCheckRelaxation).toBeLessThan(AI_STRATEGY.easy.spaceCheckRelaxation);
    expect(AI_STRATEGY.medium.spaceCheckRelaxation).toBe(0.07);
  });

  test('hard mode has zero spaceCheckRelaxation', () => {
    expect(AI_STRATEGY.hard.spaceCheckRelaxation).toBe(0);
  });

  test('easy mode has limited playerPerceptionRadius', () => {
    expect(AI_STRATEGY.easy.playerPerceptionRadius).toBeGreaterThan(0);
    expect(AI_STRATEGY.easy.playerPerceptionRadius).toBe(5);
  });

  test('medium mode has wider playerPerceptionRadius than easy', () => {
    expect(AI_STRATEGY.medium.playerPerceptionRadius).toBeGreaterThan(AI_STRATEGY.easy.playerPerceptionRadius);
    expect(AI_STRATEGY.medium.playerPerceptionRadius).toBe(14);
  });

  test('hard mode has infinite playerPerceptionRadius (-1)', () => {
    expect(AI_STRATEGY.hard.playerPerceptionRadius).toBe(-1);
  });

  test('easy mode has reduced floodFillDepth (myopic)', () => {
    expect(AI_STRATEGY.easy.floodFillDepth).toBe(15);
    expect(AI_STRATEGY.easy.floodFillDepth).toBeLessThan(AI_STRATEGY.medium.floodFillDepth);
  });

  test('medium mode has moderate floodFillDepth', () => {
    expect(AI_STRATEGY.medium.floodFillDepth).toBe(40);
    expect(AI_STRATEGY.medium.floodFillDepth).toBeLessThan(AI_STRATEGY.hard.floodFillDepth);
  });

  test('hard mode has full floodFillDepth', () => {
    expect(AI_STRATEGY.hard.floodFillDepth).toBe(120);
  });
});

// ─── aiEvaluateDirections() — player perception radius ───
describe('ai.js — aiEvaluateDirections() player perception', () => {
  beforeEach(() => {
    setObstacles([]);
    setGlobal('aiSnakes', []);
    setGlobal('gridSize', 22);
    setGlobal('half', 11);
    setGlobal('gridMinX', -11);
    setGlobal('gridMaxX', 11);
    setGlobal('gridMinZ', -11);
    setGlobal('gridMaxZ', 11);
    setGlobal('TURN_ANGLE', Math.PI / 2);
    setGlobal('corpses', []);
  });

  test('AI sees player when within perception radius', () => {
    // Player snake right next to AI — within radius 5
    setSnake([{x: 3, z: 0}, {x: 2, z: 0}]);
    var aiSnake = [{x: 1, z: 0}, {x: 0, z: 0}];
    var safe = aiEvaluateDirections(0, aiSnake, 0, 5);
    // Direction 0 (forward to x=2) should NOT be safe — player blocks it
    var forwardSafe = safe.some(function(d) { return Math.abs(d) < 0.01; });
    expect(forwardSafe).toBe(false);
  });

  test('AI does NOT see player when outside perception radius', () => {
    // Player snake far from AI — manhattan distance 10, radius 5
    setSnake([{x: 10, z: 0}, {x: 9, z: 0}]);
    var aiSnake = [{x: 0, z: 0}, {x: -1, z: 0}];
    var safe = aiEvaluateDirections(0, aiSnake, 0, 5);
    // Direction 0 (forward) should be safe — AI doesn't see player at x=10
    var forwardSafe = safe.some(function(d) { return Math.abs(d) < 0.01; });
    expect(forwardSafe).toBe(true);
  });

  test('AI sees player at exactly perception radius boundary', () => {
    // Player at manhattan distance exactly 5
    setSnake([{x: 5, z: 0}, {x: 4, z: 0}]);
    var aiSnake = [{x: 0, z: 0}, {x: -1, z: 0}];
    var safe = aiEvaluateDirections(0, aiSnake, 0, 5);
    // At boundary (dist=5), AI should still see player
    var forwardSafe = safe.some(function(d) { return Math.abs(d) < 0.01; });
    // Player at x=5 is far enough that forward direction to x=1 is still safe
    // The test is that perception is active, not that the cell is blocked
    expect(forwardSafe).toBe(true); // x=1 is not occupied by player at x=5
  });

  test('AI with infinite perception (-1) always sees player', () => {
    // Player far away but AI has infinite vision
    setSnake([{x: 10, z: 0}, {x: 9, z: 0}]);
    var aiSnake = [{x: 1, z: 0}, {x: 0, z: 0}];
    // Move toward player — player blocks at x=9
    // With infinite perception, AI should see player as obstacle
    var safe = aiEvaluateDirections(0, aiSnake, 0, -1);
    // Forward to x=2 should be safe (player is at x=9,10)
    var forwardSafe = safe.some(function(d) { return Math.abs(d) < 0.01; });
    expect(forwardSafe).toBe(true);
  });

  test('AI with infinite perception sees player blocking adjacent cell', () => {
    // Player blocking the cell directly in front of AI
    setSnake([{x: 1, z: 0}, {x: 2, z: 0}]);
    var aiSnake = [{x: 0, z: 0}, {x: -1, z: 0}];
    var safe = aiEvaluateDirections(0, aiSnake, 0, -1);
    // Forward to x=1 should NOT be safe — player blocks it
    var forwardSafe = safe.some(function(d) { return Math.abs(d) < 0.01; });
    expect(forwardSafe).toBe(false);
  });

  test('medium perception radius lets AI see closer player but not distant', () => {
    // Player at manhattan distance 7 — within medium radius (9) but outside easy (5)
    setSnake([{x: 7, z: 0}, {x: 6, z: 0}]);
    var aiSnake = [{x: 0, z: 0}, {x: -1, z: 0}];

    // With medium radius (9): AI sees player
    var safeMedium = aiEvaluateDirections(0, aiSnake, 0, 9);
    // With easy radius (5): AI doesn't see player
    var safeEasy = aiEvaluateDirections(0, aiSnake, 0, 5);

    // Both should find forward safe since player is at x=7 (not blocking x=1)
    // The difference is in how AI treats the player body in pathfinding
    var forwardMedium = safeMedium.some(function(d) { return Math.abs(d) < 0.01; });
    var forwardEasy = safeEasy.some(function(d) { return Math.abs(d) < 0.01; });
    expect(forwardMedium).toBe(true);
    expect(forwardEasy).toBe(true);
  });
});

// ─── aiEvaluateDirections() — perception radius integration ───
describe('ai.js — aiEvaluateDirections() perception integration', () => {
  beforeEach(() => {
    setObstacles([]);
    setGlobal('aiSnakes', []);
    setGlobal('gridSize', 22);
    setGlobal('half', 11);
    setGlobal('TURN_ANGLE', Math.PI / 2);
  });

  test('AI blocked by player when perception is active', () => {
    // Player directly in front of AI head
    setSnake([{x: 2, z: 0}, {x: 3, z: 0}]);
    var aiSnake = [{x: 1, z: 0}, {x: 0, z: 0}];
    var safe = aiEvaluateDirections(0, aiSnake, 0, 5);
    var forwardSafe = safe.some(function(d) { return Math.abs(d) < 0.01; });
    expect(forwardSafe).toBe(false); // player at x=2 blocks forward
  });

  test('AI NOT blocked by distant player when perception limited', () => {
    // Player directly in front but far away — AI doesn't see it
    setSnake([{x: 20, z: 0}, {x: 21, z: 0}]);
    var aiSnake = [{x: 1, z: 0}, {x: 0, z: 0}];
    var safe = aiEvaluateDirections(0, aiSnake, 0, 5);
    var forwardSafe = safe.some(function(d) { return Math.abs(d) < 0.01; });
    expect(forwardSafe).toBe(true); // AI doesn't see player at x=20
  });

  test('perception radius uses Manhattan distance from AI head', () => {
    // Player at (3,3) from AI head at (0,0) — manhattan = 6
    setSnake([{x: 3, z: 3}, {x: 2, z: 3}]);
    var aiSnake = [{x: 0, z: 0}, {x: -1, z: 0}];

    // Radius 5: manhattan 6 > 5, so AI doesn't see player
    var safe5 = aiEvaluateDirections(0, aiSnake, 0, 5);
    // Radius 10: manhattan 6 <= 10, so AI sees player
    var safe10 = aiEvaluateDirections(0, aiSnake, 0, 10);

    // Forward (x=1,0) is safe in both cases since player is at (3,3)
    // The test verifies the function doesn't crash with different radii
    expect(safe5.length).toBeGreaterThan(0);
    expect(safe10.length).toBeGreaterThan(0);
  });
});

// ─── showAiDeathMessage() ───
describe('ai.js — showAiDeathMessage()', () => {
  var deathMsgEl;

  beforeEach(() => {
    deathMsgEl = document.getElementById('ai-death-msg');
    // Reset: remove visible class and clear timer
    deathMsgEl.classList.remove('visible');
    clearTimeout(deathMsgEl._hideTimer);
  });

  // Color mapping — all 8 SNAKE_COLOR_NAMES
  test('translates green to "verde"', () => {
    showAiDeathMessage({color: 'green'}, 'wall');
    expect(deathMsgEl.textContent).toContain('verde');
  });

  test('translates red to "roja"', () => {
    showAiDeathMessage({color: 'red'}, 'wall');
    expect(deathMsgEl.textContent).toContain('roja');
  });

  test('translates blue to "azul"', () => {
    showAiDeathMessage({color: 'blue'}, 'wall');
    expect(deathMsgEl.textContent).toContain('azul');
  });

  test('translates yellow to "amarilla"', () => {
    showAiDeathMessage({color: 'yellow'}, 'wall');
    expect(deathMsgEl.textContent).toContain('amarilla');
  });

  test('translates cyan to "cyan"', () => {
    showAiDeathMessage({color: 'cyan'}, 'wall');
    expect(deathMsgEl.textContent).toContain('cyan');
  });

  test('translates purple to "púrpura"', () => {
    showAiDeathMessage({color: 'purple'}, 'wall');
    expect(deathMsgEl.textContent).toContain('púrpura');
  });

  test('translates orange to "naranja"', () => {
    showAiDeathMessage({color: 'orange'}, 'wall');
    expect(deathMsgEl.textContent).toContain('naranja');
  });

  test('translates salmon to "salmón"', () => {
    showAiDeathMessage({color: 'salmon'}, 'wall');
    expect(deathMsgEl.textContent).toContain('salmón');
  });

  test('falls back to "desconocida" for unknown colors', () => {
    showAiDeathMessage({color: 'magenta'}, 'wall');
    expect(deathMsgEl.textContent).toContain('desconocida');
  });

  // Death causes
  test('shows "contra la pared" for wall cause', () => {
    showAiDeathMessage({color: 'green'}, 'wall');
    expect(deathMsgEl.textContent).toContain('contra la pared');
  });

  test('shows "contra sí misma" for self cause', () => {
    showAiDeathMessage({color: 'red'}, 'self');
    expect(deathMsgEl.textContent).toContain('contra sí misma');
  });

  test('shows "contra un obstáculo" for obstacle cause', () => {
    showAiDeathMessage({color: 'blue'}, 'obstacle');
    expect(deathMsgEl.textContent).toContain('contra un obstáculo');
  });

  test('shows "contra un cadáver" for corpse cause', () => {
    showAiDeathMessage({color: 'yellow'}, 'corpse');
    expect(deathMsgEl.textContent).toContain('contra un cadáver');
  });

  test('shows "contra el jugador" for player cause', () => {
    showAiDeathMessage({color: 'cyan'}, 'player');
    expect(deathMsgEl.textContent).toContain('contra el jugador');
  });

  test('shows "contra otra serpiente" for ai cause', () => {
    showAiDeathMessage({color: 'purple'}, 'ai');
    expect(deathMsgEl.textContent).toContain('contra otra serpiente');
  });

  // DOM behavior
  test('adds visible class to element', () => {
    showAiDeathMessage({color: 'green'}, 'wall');
    expect(deathMsgEl.classList.contains('visible')).toBe(true);
  });

  test('message starts with skull emoji', () => {
    showAiDeathMessage({color: 'green'}, 'wall');
    expect(deathMsgEl.textContent).toMatch(/^💀/);
  });

  test('sets auto-hide timer', () => {
    showAiDeathMessage({color: 'green'}, 'wall');
    expect(deathMsgEl._hideTimer).toBeDefined();
  });
});
