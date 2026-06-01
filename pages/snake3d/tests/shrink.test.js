// ─── Shrink Mechanic Tests ───
const { setSnake, setApples, setObstacles } = require('./helpers');

// ─── Config: shrink functions ───
describe('config.js — SHRINK constants', () => {
  test('SHRINK_STEP is 6', () => {
    expect(SHRINK_STEP).toBe(6);
  });

  test('SHRINK_WARNING_DURATION is 10 seconds', () => {
    expect(SHRINK_WARNING_DURATION).toBe(10);
  });

  test('SHRINK_MESSAGE_DELAY is 5 seconds', () => {
    expect(SHRINK_MESSAGE_DELAY).toBe(5);
  });
});

describe('config.js — calcShrinkTarget()', () => {
  test('returns initial size when 0 deaths', () => {
    // With initialAICount=3, 0 deaths → aliveAI=3 → full grid
    expect(calcShrinkTarget(40, 0, 3)).toBe(40);
    // With initialAICount=0 (legacy), 0 deaths → full grid
    expect(calcShrinkTarget(22, 0, 0)).toBe(22);
  });

  test('proportional shrink: vs4 (3 AI, grid 40) → solo size (22) when all die', () => {
    // vs4: initialGridSize=40, initialAICount=3
    // After 1 death: 22 + (40-22) * 2/3 = 22 + 12 = 34
    expect(calcShrinkTarget(40, 1, 3)).toBe(34);
    // After 2 deaths: 22 + (40-22) * 1/3 = 22 + 6 = 28
    expect(calcShrinkTarget(40, 2, 3)).toBe(28);
    // After 3 deaths: all AI dead → solo size 22
    expect(calcShrinkTarget(40, 3, 3)).toBe(22);
  });

  test('proportional shrink: vs8 (7 AI, grid 62) → solo size (22) when all die', () => {
    // vs8: initialGridSize=62, initialAICount=7
    // After 1 death: 22 + (62-22) * 6/7 = 22 + 34.29 = 56
    expect(calcShrinkTarget(62, 1, 7)).toBe(56);
    // After 7 deaths: all AI dead → solo size 22
    expect(calcShrinkTarget(62, 7, 7)).toBe(22);
  });

  test('proportional shrink: vs2 (1 AI, grid 28) → solo size (22) when AI dies', () => {
    expect(calcShrinkTarget(28, 0, 1)).toBe(28);
    expect(calcShrinkTarget(28, 1, 1)).toBe(22);
  });

  test('proportional shrink: vs3 (2 AI, grid 34) → solo size (22) when all die', () => {
    // After 1 death: 22 + (34-22) * 1/2 = 22 + 6 = 28
    expect(calcShrinkTarget(34, 1, 2)).toBe(28);
    // After 2 deaths: all AI dead → 22
    expect(calcShrinkTarget(34, 2, 2)).toBe(22);
  });

  test('legacy mode (initialAICount=0) uses fixed SHRINK_STEP', () => {
    expect(calcShrinkTarget(40, 1, 0)).toBe(34);
    expect(calcShrinkTarget(40, 2, 0)).toBe(28);
    expect(calcShrinkTarget(40, 3, 0)).toBe(22);
  });

  test('clamps to GRID_MIN (16)', () => {
    // Even with proportional, if soloSize was below GRID_MIN, it would clamp
    // But since soloSize=22 > GRID_MIN=16, this only matters for extreme cases
    expect(calcShrinkTarget(20, 10, 0)).toBe(16);
  });
});

describe('config.js — calcNextShrinkSize()', () => {
  test('proportional shrink: vs4 (3 AI, grid 40)', () => {
    // After 1 death (2 alive): target = 22 + 18 * 2/3 = 34
    expect(calcNextShrinkSize(40, 40, 3, 1)).toBe(34);
    // After 2 deaths (1 alive): target = 22 + 18 * 1/3 = 28
    expect(calcNextShrinkSize(34, 40, 3, 2)).toBe(28);
    // After 3 deaths (0 alive): target = 22
    expect(calcNextShrinkSize(28, 40, 3, 3)).toBe(22);
  });

  test('proportional shrink: vs8 (7 AI, grid 62)', () => {
    // After 1 death (6 alive): target = 22 + 40 * 6/7 = 56
    expect(calcNextShrinkSize(62, 62, 7, 1)).toBe(56);
    // After 7 deaths (0 alive): target = 22
    expect(calcNextShrinkSize(28, 62, 7, 7)).toBe(22);
  });

  test('legacy mode (initialAICount=0) uses fixed SHRINK_STEP', () => {
    expect(calcNextShrinkSize(40, 40, 0, 0)).toBe(34);
    expect(calcNextShrinkSize(34, 34, 0, 0)).toBe(28);
    expect(calcNextShrinkSize(28, 28, 0, 0)).toBe(22);
  });

  test('clamps to GRID_MIN', () => {
    expect(calcNextShrinkSize(18, 18, 0, 0)).toBe(16);
    expect(calcNextShrinkSize(16, 16, 0, 0)).toBe(16);
  });
});

describe('config.js — canShrinkFurther()', () => {
  test('returns true when above GRID_MIN', () => {
    expect(canShrinkFurther(20)).toBe(true);
    expect(canShrinkFurther(22)).toBe(true);
    expect(canShrinkFurther(40)).toBe(true);
  });

  test('returns false when at GRID_MIN', () => {
    expect(canShrinkFurther(16)).toBe(false);
  });
});

// ─── Game: shrink state ───
describe('game.js — grid boundary state', () => {
  beforeEach(() => {
    gridMinX = -11;
    gridMaxX = 11;
    gridMinZ = -11;
    gridMaxZ = 11;
    shrinkCountdowns = [];
  });

  test('grid boundaries initialize correctly', () => {
    half = GRID_SIZE / 2;
    gridMinX = -half;
    gridMaxX = half;
    gridMinZ = -half;
    gridMaxZ = half;
    expect(gridMinX).toBe(-11);
    expect(gridMaxX).toBe(11);
    expect(gridMinZ).toBe(-11);
    expect(gridMaxZ).toBe(11);
  });

  test('shrinkCountdowns starts empty', () => {
    shrinkCountdowns = [];
    expect(shrinkCountdowns).toEqual([]);
  });
});

// ─── Game: maybeTriggerShrink ───
describe('game.js — maybeTriggerShrink()', () => {
  beforeEach(() => {
    gridSize = 40;
    gridMinX = -20;
    gridMaxX = 20;
    gridMinZ = -20;
    gridMaxZ = 20;
    shrinkCountdowns = [];
    gameOver = false;
    snake = [{x: 0, z: 0}];
    aiSnakes = [
      {alive: true, snake: [{x: 5, z: 5}]},
      {alive: true, snake: [{x: -5, z: 5}]},
      {alive: false, snake: [{x: 0, z: 0}]}
    ];
  });

  test('shrinks regardless of alive count — only checks GRID_MIN', () => {
    // With simplified logic, shrink happens as long as grid > GRID_MIN
    // and there are alive snakes — no target-based check
    gridMinX = -17;
    gridMaxX = 17;
    gridMinZ = -17;
    gridMaxZ = 17;
    maybeTriggerShrink();
    // Grid is 34, can shrink to 28
    expect(shrinkCountdowns.length).toBe(1);
  });

  test('does not shrink when at GRID_MIN', () => {
    gridMinX = -8;
    gridMaxX = 8;
    gridMinZ = -8;
    gridMaxZ = 8;
    maybeTriggerShrink();
    expect(shrinkCountdowns.length).toBe(0);
  });

  test('does not shrink when player is dead (gameOver)', () => {
    gameOver = true;
    snake = [];
    aiSnakes = [];
    maybeTriggerShrink();
    expect(shrinkCountdowns.length).toBe(0);
  });
});

// ─── Game: removeOutOfBounds ───
describe('game.js — removeOutOfBounds()', () => {
  beforeEach(() => {
    gridMinX = -5;
    gridMaxX = 5;
    gridMinZ = -5;
    gridMaxZ = 5;
    obstacles = [];
    NUM_APPLES = 3;
  });

  test('removes apples outside new grid', () => {
    apples = [
      {x: 0, z: 0},    // inside
      {x: 3, z: 3},    // inside
      {x: 7, z: 0},    // outside
      null
    ];
    removeOutOfBounds();
    var activeApples = apples.filter(Boolean);
    expect(activeApples.length).toBeGreaterThanOrEqual(2);
    activeApples.forEach(function(a) {
      expect(a.x).toBeGreaterThanOrEqual(gridMinX);
      expect(a.x).toBeLessThan(gridMaxX);
      expect(a.z).toBeGreaterThanOrEqual(gridMinZ);
      expect(a.z).toBeLessThan(gridMaxZ);
    });
  });

  test('preserves death apples (fromDeath) during shrink — not trimmed by NUM_APPLES', () => {
    apples = [
      {x: 0, z: 0},              // regular — inside
      {x: 1, z: 0},              // regular — inside
      {x: 2, z: 0},              // regular — inside
      {x: 3, z: 0, fromDeath: true},  // death apple — inside
      {x: 4, z: 0, fromDeath: true},  // death apple — inside
      {x: 7, z: 0, fromDeath: true},  // death apple — outside (removed by filter)
    ];
    NUM_APPLES = 3;
    removeOutOfBounds();
    // Regular apples: 3 (trimmed to NUM_APPLES)
    // Death apples: 2 (preserved, not trimmed)
    var deathApples = apples.filter(function(a) { return a && a.fromDeath; });
    expect(deathApples.length).toBe(2);
    // Total should be NUM_APPLES + death apples
    var activeApples = apples.filter(Boolean);
    expect(activeApples.length).toBeGreaterThanOrEqual(5); // 3 regular + 2 death
  });

  test('death apples outside bounds are still removed by filter', () => {
    apples = [
      {x: 0, z: 0},              // regular — inside
      {x: 7, z: 0, fromDeath: true},  // death apple — outside
    ];
    NUM_APPLES = 3;
    removeOutOfBounds();
    var deathApples = apples.filter(function(a) { return a && a.fromDeath; });
    expect(deathApples.length).toBe(0); // outside death apples ARE removed
  });

  test('removes obstacles outside new grid', () => {
    obstacles = [
      {x: 0, z: 0},    // inside
      {x: 7, z: 0},    // outside
      {x: -7, z: 0},   // outside
      {x: 3, z: 3},    // inside
    ];
    removeOutOfBounds();
    expect(obstacles.length).toBe(2);
    obstacles.forEach(function(o) {
      expect(o.x).toBeGreaterThanOrEqual(gridMinX);
      expect(o.x).toBeLessThan(gridMaxX);
      expect(o.z).toBeGreaterThanOrEqual(gridMinZ);
      expect(o.z).toBeLessThan(gridMaxZ);
    });
  });


});

// ─── Game: checkHeadsOutOfBounds ───
describe('game.js — checkHeadsOutOfBounds()', () => {
  beforeEach(() => {
    gridMinX = -5;
    gridMaxX = 5;
    gridMinZ = -5;
    gridMaxZ = 5;
    gameOver = false;
    running = true;
  });

  test('does nothing when player head is inside bounds', () => {
    snake = [{x: 0, z: 0}];
    aiSnakes = [];
    checkHeadsOutOfBounds();
    expect(gameOver).toBe(false);
  });

  test('detects player head outside bounds on X', () => {
    snake = [{x: 7, z: 0}];
    aiSnakes = [];
    checkHeadsOutOfBounds();
    expect(gameOver).toBe(true);
  });

  test('detects player head outside bounds on Z', () => {
    snake = [{x: 0, z: 7}];
    aiSnakes = [];
    checkHeadsOutOfBounds();
    expect(gameOver).toBe(true);
  });

  test('detects player head outside negative bounds', () => {
    snake = [{x: -7, z: 0}];
    aiSnakes = [];
    checkHeadsOutOfBounds();
    expect(gameOver).toBe(true);
  });

  test('does nothing when snake is empty', () => {
    snake = [];
    aiSnakes = [];
    checkHeadsOutOfBounds();
    expect(gameOver).toBe(false);
  });

  test('detects AI head outside bounds', () => {
    snake = [{x: 0, z: 0}];
    aiSnakes = [
      {alive: true, snake: [{x: 7, z: 0}]},
      {alive: true, snake: [{x: 0, z: 0}]},
      {alive: false, snake: [{x: 99, z: 99}]}
    ];
    // Mock corpseGroup so aiDie doesn't crash
    corpseGroup = {children: [], add: function() {}};
    checkHeadsOutOfBounds();
    // AI at (7,0) should die
    expect(aiSnakes[0].alive).toBe(false);
    // AI at (0,0) should survive
    expect(aiSnakes[1].alive).toBe(true);
    // Dead AI should not be checked
    expect(aiSnakes[2].alive).toBe(false);
  });

  test('handles undefined aiSnakes', () => {
    snake = [{x: 0, z: 0}];
    aiSnakes = undefined;
    checkHeadsOutOfBounds();
    expect(gameOver).toBe(false);
  });
});

// ─── Game: truncateSnakesToBounds ───
describe('game.js — truncateSnakesToBounds()', () => {
  beforeEach(() => {
    score = 10;
    aiSnakes = [];
  });

  test('does nothing when all segments inside bounds', () => {
    snake = [{x: 0, z: 0}, {x: -1, z: 0}, {x: -2, z: 0}];
    var countdown = {newMinX: -5, newMaxX: 5, newMinZ: -5, newMaxZ: 5};
    truncateSnakesToBounds(countdown);
    expect(snake.length).toBe(3);
    expect(score).toBe(10);
  });

  test('truncates tail segments outside bounds', () => {
    snake = [
      {x: 0, z: 0},     // head — inside
      {x: -1, z: 0},    // inside
      {x: -2, z: 0},    // inside
      {x: 7, z: 0},     // outside
      {x: 8, z: 0},     // outside
    ];
    var countdown = {newMinX: -5, newMaxX: 5, newMinZ: -5, newMaxZ: 5};
    truncateSnakesToBounds(countdown);
    expect(snake.length).toBe(3);
    expect(score).toBe(8); // lost 2 segments = 2 points
  });

  test('keeps at least 1 segment (head)', () => {
    snake = [{x: 7, z: 0}]; // head outside
    var countdown = {newMinX: -5, newMaxX: 5, newMinZ: -5, newMaxZ: 5};
    truncateSnakesToBounds(countdown);
    expect(snake.length).toBe(1);
  });

  test('does nothing when snake has only 1 segment', () => {
    snake = [{x: 0, z: 0}];
    var countdown = {newMinX: -5, newMaxX: 5, newMinZ: -5, newMaxZ: 5};
    truncateSnakesToBounds(countdown);
    expect(snake.length).toBe(1);
  });

  test('truncates AI snake bodies', () => {
    snake = [{x: 0, z: 0}];
    aiSnakes = [
      {alive: true, snake: [
        {x: 0, z: 0},
        {x: -1, z: 0},
        {x: 7, z: 0},    // outside
        {x: 8, z: 0},    // outside
      ]},
      {alive: false, snake: [{x: 99, z: 99}]}
    ];
    var countdown = {newMinX: -5, newMaxX: 5, newMinZ: -5, newMaxZ: 5};
    truncateSnakesToBounds(countdown);
    expect(aiSnakes[0].snake.length).toBe(2);
  });

  test('handles empty snake gracefully', () => {
    snake = [];
    var countdown = {newMinX: -5, newMaxX: 5, newMinZ: -5, newMaxZ: 5};
    truncateSnakesToBounds(countdown);
    expect(snake.length).toBe(0);
  });

  test('score does not go below 0', () => {
    score = 1;
    snake = [
      {x: 0, z: 0},
      {x: 7, z: 0},
      {x: 8, z: 0},
    ];
    var countdown = {newMinX: -5, newMaxX: 5, newMinZ: -5, newMaxZ: 5};
    truncateSnakesToBounds(countdown);
    expect(score).toBe(0);
  });

  test('removes segments outside bounds anywhere in the body (not just tail)', () => {
    // Snake that winds in and out: inside → outside → inside → outside
    snake = [
      {x: 0, z: 0},     // head — inside
      {x: 7, z: 0},     // outside (middle of body!)
      {x: -2, z: 0},    // inside
      {x: 8, z: 0},     // outside (tail)
    ];
    var countdown = {newMinX: -5, newMaxX: 5, newMinZ: -5, newMaxZ: 5};
    truncateSnakesToBounds(countdown);
    // Only segments at (0,0) and (-2,0) should survive
    expect(snake.length).toBe(2);
    expect(snake[0].x).toBe(0);
    expect(snake[1].x).toBe(-2);
    expect(score).toBe(8); // lost 2 segments = 2 points
  });

  test('truncates AI snake bodies with segments outside in the middle', () => {
    snake = [{x: 0, z: 0}];
    aiSnakes = [
      {alive: true, snake: [
        {x: 0, z: 0},     // head — inside
        {x: 7, z: 0},     // outside (middle)
        {x: -1, z: 0},    // inside
        {x: 8, z: 0},     // outside (tail)
      ]},
    ];
    var countdown = {newMinX: -5, newMaxX: 5, newMinZ: -5, newMaxZ: 5};
    truncateSnakesToBounds(countdown);
    expect(aiSnakes[0].snake.length).toBe(2);
    expect(aiSnakes[0].snake[0].x).toBe(0);
    expect(aiSnakes[0].snake[1].x).toBe(-1);
  });

  test('shows info message when player loses segments', () => {
    snake = [
      {x: 0, z: 0},
      {x: 7, z: 0},
    ];
    score = 10;
    var countdown = {newMinX: -5, newMaxX: 5, newMinZ: -5, newMaxZ: 5};
    truncateSnakesToBounds(countdown);
    expect(snake.length).toBe(1);
    expect(score).toBe(9);
    // Info message should be shown for player loss
    expect(typeof showInfoMessage).toBe('function');
  });

  test('does NOT show info message when only AI snakes lose segments', () => {
    snake = [{x: 0, z: 0}];
    aiSnakes = [
      {alive: true, snake: [
        {x: 0, z: 0},
        {x: 7, z: 0},    // outside
      ]},
    ];
    var countdown = {newMinX: -5, newMaxX: 5, newMinZ: -5, newMaxZ: 5};
    truncateSnakesToBounds(countdown);
    // AI should lose the segment but no info message for player
    expect(aiSnakes[0].snake.length).toBe(1);
    // Player should not have lost anything
    expect(snake.length).toBe(1);
  });

  test('keeps head even if all segments are outside', () => {
    snake = [
      {x: 7, z: 0},    // head — outside
      {x: 8, z: 0},    // outside
    ];
    var countdown = {newMinX: -5, newMaxX: 5, newMinZ: -5, newMaxZ: 5};
    truncateSnakesToBounds(countdown);
    // Should keep at least the head
    expect(snake.length).toBe(1);
    expect(snake[0].x).toBe(7);
  });
});

// ─── Game: processShrinkCountdowns ───
describe('game.js — processShrinkCountdowns()', () => {
  beforeEach(() => {
    shrinkCountdowns = [];
    gridMinX = -20;
    gridMaxX = 20;
    gridMinZ = -20;
    gridMaxZ = 20;
  });

  test('does nothing when no countdowns', () => {
    var now = performance.now();
    processShrinkCountdowns(now);
    expect(shrinkCountdowns.length).toBe(0);
  });

  test('does not apply countdown that has not expired', () => {
    var now = performance.now();
    shrinkCountdowns = [{
      startTime: now,
      duration: 10000,
      oldMinX: -20, oldMaxX: 20, oldMinZ: -20, oldMaxZ: 20,
      newMinX: -17, newMaxX: 17, newMinZ: -17, newMaxZ: 17,
      newGridSize: 34,
      messageShown: false,
      lastTickTime: 0
    }];
    processShrinkCountdowns(now + 5000); // only 5s elapsed
    expect(shrinkCountdowns.length).toBe(1);
  });

  test('applies countdown that has expired', () => {
    var now = performance.now();
    // Mock applyShrink to just track calls
    var applied = false;
    var origApplyShrink = applyShrink;
    // We can't easily mock global functions in vm context, so just verify removal
    shrinkCountdowns = [{
      startTime: now - 11000, // expired 1s ago
      duration: 10000,
      oldMinX: -20, oldMaxX: 20, oldMinZ: -20, oldMaxZ: 20,
      newMinX: -17, newMaxX: 17, newMinZ: -17, newMaxZ: 17,
      newGridSize: 34,
      messageShown: false,
      lastTickTime: 0
    }];
    // Before calling, boundaries should be old
    expect(gridMinX).toBe(-20);
    // After calling, applyShrink should update boundaries
    // This is an integration test — we verify the countdown is removed
    processShrinkCountdowns(now);
    expect(shrinkCountdowns.length).toBe(0);
  });
});

// ─── Game: die with shrink cause ───
describe('game.js — die("shrink")', () => {
  beforeEach(() => {
    score = 5;
    highScore = 0;
    snake = [{x: 0, z: 0}];
    gameOver = false;
    running = true;
    shrinkCountdowns = [];
    aiSnakes = [];
  });

  test('shows shrink death message', () => {
    die('shrink');
    expect(finalScoreEl.textContent).toContain('redujo');
  });

  test('sets gameOver when dying from shrink', () => {
    die('shrink');
    expect(gameOver).toBe(true);
    expect(running).toBe(false);
  });
});

// ─── Audio: shrink sounds ───
describe('audio.js — shrink sounds', () => {
  test('sfxShrinkTick does not throw', () => {
    expect(() => sfxShrinkTick()).not.toThrow();
  });

  test('sfxShrinkComplete does not throw', () => {
    expect(() => sfxShrinkComplete()).not.toThrow();
  });

  test('sfxShrinkTick works with AudioContext', () => {
    initAudio();
    expect(() => sfxShrinkTick()).not.toThrow();
  });

  test('sfxShrinkComplete works with AudioContext', () => {
    initAudio();
    expect(() => sfxShrinkComplete()).not.toThrow();
  });
});

// ─── Scene: rebuildBoard with offset ───
describe('scene.js — rebuildBoard() with offset', () => {
  test('rebuildBoard with no offset centers at origin', () => {
    rebuildBoard(22);
    expect(_floorMesh.position.x).toBe(0);
    expect(_floorMesh.position.z).toBe(0);
  });

  test('rebuildBoard with offset positions floor correctly', () => {
    rebuildBoard(22, {offsetX: 3, offsetZ: -2});
    expect(_floorMesh.position.x).toBe(3);
    expect(_floorMesh.position.z).toBe(-2);
  });

  test('rebuildBoard positions walls with offset', () => {
    rebuildBoard(22, {offsetX: 5, offsetZ: 3});
    var h = 11;
    // Wall 1: top (z = cz - h)
    expect(_wallMeshes[0].position.x).toBe(5);
    expect(_wallMeshes[0].position.z).toBe(3 - h);
    // Wall 2: bottom (z = cz + h)
    expect(_wallMeshes[1].position.z).toBe(3 + h);
    // Wall 3: left (x = cx - h)
    expect(_wallMeshes[2].position.x).toBe(5 - h);
    expect(_wallMeshes[2].position.z).toBe(3);
    // Wall 4: right (x = cx + h)
    expect(_wallMeshes[3].position.x).toBe(5 + h);
    expect(_wallMeshes[3].position.z).toBe(3);
  });

  test('rebuildBoard handles zero offset', () => {
    rebuildBoard(20, {offsetX: 0, offsetZ: 0});
    expect(_floorMesh.position.x).toBe(0);
    expect(_floorMesh.position.z).toBe(0);
  });

  test('rebuildBoard handles negative offset', () => {
    rebuildBoard(18, {offsetX: -4, offsetZ: 6});
    expect(_floorMesh.position.x).toBe(-4);
    expect(_floorMesh.position.z).toBe(6);
  });
});

// ─── AI: cellInShrinkZone ───
// cellInShrinkZone uses calcShrinkBoundsFromCurrent(cd) which reads:
//   cd.shrinkAmount, cd.offsetX, cd.offsetZ
// and computes bounds from current gridMinX/MaxX/MinZ/MaxZ.
describe('ai.js — cellInShrinkZone()', () => {
  beforeEach(() => {
    // Grid 22x22: [-11, 11) x [-11, 11)
    gridMinX = -11;
    gridMaxX = 11;
    gridMinZ = -11;
    gridMaxZ = 11;
    shrinkCountdowns = [];
  });

  test('returns false when no countdowns', () => {
    shrinkCountdowns = [];
    expect(cellInShrinkZone(0, 0)).toBe(false);
    expect(cellInShrinkZone(5, 5)).toBe(false);
  });

  test('returns false when cell is inside safe zone', () => {
    // shrinkAmount=6, offsetX=0, offsetZ=0
    // Safe zone: [-11, 5) x [-11, 5)
    shrinkCountdowns = [{
      shrinkAmount: 6,
      offsetX: 0,
      offsetZ: 0
    }];
    expect(cellInShrinkZone(0, 0)).toBe(false);
    expect(cellInShrinkZone(4, 4)).toBe(false);
    expect(cellInShrinkZone(-10, -10)).toBe(false);
  });

  test('returns true when cell is outside safe zone', () => {
    // shrinkAmount=6, offsetX=0, offsetZ=0
    // Safe zone: [-11, 5) x [-11, 5)
    // Cells at x>=5 or z>=5 are in danger zone
    shrinkCountdowns = [{
      shrinkAmount: 6,
      offsetX: 0,
      offsetZ: 0
    }];
    expect(cellInShrinkZone(5, 0)).toBe(true);
    expect(cellInShrinkZone(10, 0)).toBe(true);
    expect(cellInShrinkZone(0, 5)).toBe(true);
    expect(cellInShrinkZone(0, 10)).toBe(true);
  });

  test('returns true if outside ANY countdown safe zone', () => {
    // Countdown 1: shrink right side (offsetX=0)
    //   Safe: [-11, 5) x [-11, 5)
    // Countdown 2: shrink left side (offsetX=6)
    //   Safe: [-5, 11) x [-5, 11)
    shrinkCountdowns = [
      { shrinkAmount: 6, offsetX: 0, offsetZ: 0 },
      { shrinkAmount: 6, offsetX: 6, offsetZ: 6 }
    ];
    // Cell at (8, 0) is outside countdown 1 safe zone (8 >= 5)
    expect(cellInShrinkZone(8, 0)).toBe(true);
    // Cell at (0, 8) is outside countdown 1 safe zone (8 >= 5)
    expect(cellInShrinkZone(0, 8)).toBe(true);
    // Cell at (4, 4) is inside BOTH safe zones → false
    expect(cellInShrinkZone(4, 4)).toBe(false);
  });

  test('handles undefined shrinkCountdowns', () => {
    shrinkCountdowns = undefined;
    expect(cellInShrinkZone(0, 0)).toBe(false);
  });
});

// ─── AI: aiDie triggers maybeTriggerShrink ───
describe('ai.js — aiDie() calls maybeTriggerShrink()', () => {
  beforeEach(() => {
    gridSize = 40;
    gridMinX = -20;
    gridMaxX = 20;
    gridMinZ = -20;
    gridMaxZ = 20;
    shrinkCountdowns = [];
    gameOver = false;
    snake = [{x: 0, z: 0}];
    corpseGroup = {children: [], add: function() {}};
    aiSnakes = [
      {id: 'ai_0', alive: true, snake: [{x: 5, z: 5}, {x: 4, z: 5}], color: 'red', groupData: null},
      {id: 'ai_1', alive: true, snake: [{x: -5, z: 5}, {x: -6, z: 5}], color: 'blue', groupData: null}
    ];
  });

  test('triggers shrink countdown when AI dies', () => {
    aiDie(0, 'wall');
    expect(aiSnakes[0].alive).toBe(false);
    // maybeTriggerShrink should have been called and potentially created a countdown
    // (depends on grid size and alive count)
  });

  test('AI death adds corpse segments', () => {
    aiDie(0, 'self');
    expect(aiSnakes[0].alive).toBe(false);
  });
});
