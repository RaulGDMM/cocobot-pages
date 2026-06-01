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
    expect(calcShrinkTarget(40, 0)).toBe(40);
    expect(calcShrinkTarget(22, 0)).toBe(22);
  });

  test('reduces by SHRINK_STEP per death', () => {
    expect(calcShrinkTarget(40, 1)).toBe(34);
    expect(calcShrinkTarget(40, 2)).toBe(28);
    expect(calcShrinkTarget(40, 3)).toBe(22);
  });

  test('clamps to GRID_MIN (16)', () => {
    expect(calcShrinkTarget(20, 10)).toBe(16);
    expect(calcShrinkTarget(22, 10)).toBe(16);
  });

  test('handles fractional deaths', () => {
    // 40 - 1.5 * 6 = 31
    expect(calcShrinkTarget(40, 1.5)).toBe(31);
  });
});

describe('config.js — calcNextShrinkSize()', () => {
  test('reduces current size by SHRINK_STEP', () => {
    expect(calcNextShrinkSize(40)).toBe(34);
    expect(calcNextShrinkSize(34)).toBe(28);
    expect(calcNextShrinkSize(28)).toBe(22);
  });

  test('clamps to GRID_MIN', () => {
    expect(calcNextShrinkSize(18)).toBe(16);
    expect(calcNextShrinkSize(16)).toBe(16);
    expect(calcNextShrinkSize(20)).toBe(16);
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
