// ─── Optimization tests ───
// Tests for performance optimizations: apple hash set, candidate limiting, death apple throttling

const { setSnake, setApples, setObstacles } = require('./helpers');

// ─── Apple hash set (appleSet) ───
describe('apples.js — appleSet hash set', () => {
  beforeEach(() => {
    setSnake([]);
    setObstacles([]);
  });

  test('appleSet is rebuilt after setApples', () => {
    setApples([{x: 1, z: 2}, {x: 3, z: 4}]);
    expect(appleSet['1,2']).toBe(true);
    expect(appleSet['3,4']).toBe(true);
    expect(appleSet['5,5']).toBe(undefined);
  });

  test('appleSet is empty when no apples', () => {
    setApples([]);
    var keys = Object.keys(appleSet);
    expect(keys.length).toBe(0);
  });

  test('appleSet handles null apples in array', () => {
    setApples([{x: 1, z: 1}, null, {x: 3, z: 3}]);
    expect(appleSet['1,1']).toBe(true);
    expect(appleSet['3,3']).toBe(true);
    // null should not create a key
    expect(appleSet['undefined,undefined']).toBe(undefined);
  });

  test('rebuildAppleSet syncs with apples array', () => {
    setApples([{x: 0, z: 0}]);
    expect(appleSet['0,0']).toBe(true);
    // Manually change apples array
    apples.length = 0;
    apples.push({x: 5, z: 5});
    // appleSet is still stale
    expect(appleSet['0,0']).toBe(true);
    expect(appleSet['5,5']).toBe(undefined);
    // Rebuild fixes it
    rebuildAppleSet();
    expect(appleSet['0,0']).toBe(undefined);
    expect(appleSet['5,5']).toBe(true);
  });

  test('isOccupied uses appleSet for O(1) lookup', () => {
    setApples([{x: 7, z: -3}]);
    expect(isOccupied(7, -3)).toBe(true);
    expect(isOccupied(0, 0)).toBe(false);
  });

  test('appleSet updated after deduplicateApples', () => {
    setApples([{x: 1, z: 1}, {x: 1, z: 1}, {x: 2, z: 2}]);
    var removed = deduplicateApples();
    expect(removed).toBe(1);
    expect(appleSet['1,1']).toBe(true);
    expect(appleSet['2,2']).toBe(true);
  });

  test('addToAppleSet adds incrementally without full rebuild', () => {
    setApples([{x: 1, z: 1}]);
    expect(appleSet['1,1']).toBe(true);
    // Add a new apple to the array manually
    apples.push({x: 5, z: 5});
    // appleSet doesn't have it yet
    expect(appleSet['5,5']).toBe(undefined);
    // Incremental add
    addToAppleSet({x: 5, z: 5});
    expect(appleSet['5,5']).toBe(true);
    // Original still there
    expect(appleSet['1,1']).toBe(true);
  });

  test('addToAppleSet ignores null', () => {
    setApples([]);
    addToAppleSet(null);
    expect(Object.keys(appleSet).length).toBe(0);
  });
});

// ─── APPLE_POOL_MARGIN ───
describe('apples.js — APPLE_POOL_MARGIN', () => {
  test('APPLE_POOL_MARGIN is 100', () => {
    expect(APPLE_POOL_MARGIN).toBe(100);
  });
});

// ─── Dirty flag (appleDirty) ───
describe('apples.js — appleDirty flag', () => {
  beforeEach(() => {
    buildApples();
    setSnake([]);
    setObstacles([]);
  });

  test('refreshApples does nothing when dirty flag is false', () => {
    setApples([{x: 1, z: 1}]);
    appleDirty = false;
    refreshApples();
    // Mesh should stay hidden because dirty was false
    expect(appleMeshes[0].visible).toBe(false);
  });

  test('refreshApples clears dirty flag after running', () => {
    setApples([{x: 1, z: 1}]);
    appleDirty = true;
    refreshApples();
    expect(appleDirty).toBe(false);
  });

  test('refreshApples shows apples when dirty flag is true', () => {
    setApples([{x: 1, z: 1}, {x: 2, z: 2}]);
    appleDirty = true;
    refreshApples();
    expect(appleMeshes[0].visible).toBe(true);
    expect(appleMeshes[1].visible).toBe(true);
    expect(appleMeshes[2].visible).toBe(false);
  });
});

// ─── bestApple() candidate limiting ───
describe('ai.js — bestApple() candidate limiting', () => {
  beforeEach(() => {
    setSnake([{x: 0, z: 0}, {x: -1, z: 0}]);
    setObstacles([]);
  });

  test('bestApple returns an apple when few candidates', () => {
    setApples([{x: 2, z: 0}]);
    var blocked = buildBlockedSet();
    var result = bestApple([{x: 0, z: 0}, {x: -1, z: 0}], blocked, 'medium');
    expect(result).not.toBeNull();
  });

  test('bestApple works with many apples (performance test)', () => {
    var manyApples = [];
    for (var i = 0; i < 60; i++) {
      manyApples.push({x: i % 10, z: Math.floor(i / 10)});
    }
    setApples(manyApples);
    var blocked = buildBlockedSet();
    // Should not throw or hang even with 60 apples
    var result = bestApple([{x: 0, z: 0}, {x: -1, z: 0}], blocked, 'medium');
    expect(result).not.toBeNull();
  });
});

// ─── Death apple throttling (every 2nd segment) ───
describe('ai.js — death apple throttling', () => {
  beforeEach(() => {
    aiSnakes = [{
      id: 0,
      alive: true,
      snake: [
        {x: 5, z: 0}, {x: 4, z: 0}, {x: 3, z: 0},
        {x: 2, z: 0}, {x: 1, z: 0}, {x: 0, z: 0},
        {x: -1, z: 0}, {x: -2, z: 0}, {x: -3, z: 0}, {x: -4, z: 0}
      ],
      direction: 0,
      score: 0,
      groupData: { group: { visible: true } }
    }];
    setSnake([{x: 0, z: 0}]);
    setApples([]);
    setObstacles([]);
  });

  test('aiDie converts body to apples synchronously', () => {
    var applesBefore = apples.length;
    aiDie(0, 'wall');
    var newApples = apples.length - applesBefore;
    // 10 segments → 10 apples (all segments)
    expect(newApples).toBe(10);
  });

  test('death apples update appleSet incrementally', () => {
    rebuildAppleSet();
    aiDie(0, 'wall');
    // After death, appleSet should have the new apples
    var applePositions = apples.map(function(a) { return a.x + ',' + a.z; });
    for (var i = 0; i < applePositions.length; i++) {
      expect(appleSet[applePositions[i]]).toBe(true);
    }
  });

  test('death apples are within grid bounds', () => {
    aiDie(0, 'wall');
    for (var i = 0; i < apples.length; i++) {
      if (!apples[i]) continue;
      expect(apples[i].x).toBeGreaterThanOrEqual(gridMinX);
      expect(apples[i].x).toBeLessThan(gridMaxX);
      expect(apples[i].z).toBeGreaterThanOrEqual(gridMinZ);
      expect(apples[i].z).toBeLessThan(gridMaxZ);
    }
  });

  test('dead AI group is hidden', () => {
    aiDie(0, 'wall');
    expect(aiSnakes[0].groupData.group.visible).toBe(false);
  });

  test('appleDirty is set to true after death', () => {
    appleDirty = false;
    aiDie(0, 'wall');
    expect(appleDirty).toBe(true);
  });

  test('multiple AI deaths preserve all death apples', () => {
    // Add a second AI snake
    aiSnakes.push({
      id: 1,
      alive: true,
      snake: [
        {x: 10, z: 0}, {x: 9, z: 0}, {x: 8, z: 0},
        {x: 7, z: 0}, {x: 6, z: 0}
      ],
      direction: 0,
      score: 0,
      groupData: { group: { visible: true } }
    });

    // Kill first AI
    aiDie(0, 'wall');
    var applesAfterFirst = apples.length;

    // Kill second AI
    aiDie(1, 'wall');
    var applesAfterSecond = apples.length;

    // Both deaths should have added apples
    expect(applesAfterSecond).toBeGreaterThan(applesAfterFirst);
    // All death apples should still be present
    expect(appleDirty).toBe(true);
  });
});
