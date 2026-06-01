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

  test('getAppleIndexAt returns index without scanning callers manually', () => {
    setApples([{x: 1, z: 1}, {x: 8, z: -2}, {x: 3, z: 3}]);
    expect(getAppleIndexAt(8, -2)).toBe(1);
    expect(getAppleIndexAt(9, 9)).toBe(-1);
  });

  test('replaceAppleAt updates appleSet and appleIndex incrementally', () => {
    setApples([{x: 1, z: 1}, {x: 2, z: 2}, {x: 3, z: 3}]);
    var old = replaceAppleAt(1, {x: 9, z: 9});
    expect(old).toEqual({x: 2, z: 2});
    expect(appleSet['2,2']).toBe(undefined);
    expect(appleSet['9,9']).toBe(true);
    expect(getAppleIndexAt(9, 9)).toBe(1);
  });

  test('replaceAppleAt handles null replacement as removal', () => {
    setApples([{x: 1, z: 1}, {x: 2, z: 2}]);
    replaceAppleAt(0, null);
    expect(appleSet['1,1']).toBe(undefined);
    expect(getAppleIndexAt(1, 1)).toBe(-1);
    expect(getAppleIndexAt(2, 2)).toBe(1);
  });

  test('spawnOneApple respects apples added incrementally before rebuild', () => {
    setApples([]);
    apples.push({x: 0, z: 0});
    addToAppleSet(apples[0], 0);
    var originalRandom = Math.random;
    var calls = 0;
    Math.random = function() {
      calls++;
      // First attempt: (0,0), already occupied by the incrementally added apple.
      // Second attempt: (1,1), available.
      return calls <= 2 ? 0.5 : 0.55;
    };
    try {
      var spawned = spawnOneApple();
      expect(spawned).toEqual({x: 1, z: 1});
    } finally {
      Math.random = originalRandom;
    }
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

  test('refreshApples only marks normal apples for per-frame animation', () => {
    setApples([{x: 1, z: 1}, {x: 2, z: 2, fromDeath: true}, {x: 3, z: 3}]);
    appleDirty = true;
    refreshApples();
    expect(animatedAppleMeshIndices).toEqual([0, 2]);
    expect(appleMeshes[0].userData.animate).toBe(true);
    expect(appleMeshes[1].userData.animate).toBe(false);
    expect(appleMeshes[2].userData.animate).toBe(true);
  });
});

// ─── Snake mesh refresh cache ───
describe('snake.js — refreshSnake mesh signature cache', () => {
  beforeEach(() => {
    setSnake([]);
    setObstacles([]);
    setApples([]);
  });

  test('player refresh skips body work when snake signature is unchanged', () => {
    playerGroupData = buildSnake('green');
    setSnake([{x: 0, z: 0}, {x: -1, z: 0}, {x: -2, z: 0}]);
    direction = 0;
    var bodySetCalls = 0;
    playerGroupData.bodyMs[1].position.set = function(x, y, z) { bodySetCalls++; this.x = x; this.y = y; this.z = z; return this; };

    refreshSnake();
    refreshSnake();

    expect(bodySetCalls).toBe(1);
  });

  test('player refresh updates again after movement changes signature', () => {
    playerGroupData = buildSnake('green');
    setSnake([{x: 0, z: 0}, {x: -1, z: 0}]);
    direction = 0;
    var bodySetCalls = 0;
    playerGroupData.bodyMs[1].position.set = function(x, y, z) { bodySetCalls++; this.x = x; this.y = y; this.z = z; return this; };

    refreshSnake();
    setSnake([{x: 1, z: 0}, {x: 0, z: 0}]);
    refreshSnake();

    expect(bodySetCalls).toBe(2);
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
    corpses = [];
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

  test('aiDie creates corpse for gradual conversion', () => {
    var corpsesBefore = corpses.length;
    aiDie(0, 'wall');
    // Death creates a corpse entry
    expect(corpses.length).toBe(corpsesBefore + 1);
    // Corpse has all segments
    expect(corpses[corpses.length - 1].segments.length).toBe(10);
    expect(corpses[corpses.length - 1].convertIndex).toBe(0);
  });

  test('death apples update appleSet incrementally', () => {
    rebuildAppleSet();
    aiDie(0, 'wall');
    // No apples added on death (corpse mode) — appleSet unchanged
    expect(apples.length).toBe(0);
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

  test('dead AI group stays visible as corpse', () => {
    aiDie(0, 'wall');
    // Body stays visible (darkened) as corpse
    expect(aiSnakes[0].groupData.group.visible).toBe(true);
  });

  test('appleDirty is NOT set on death (set on conversion)', () => {
    appleDirty = false;
    aiDie(0, 'wall');
    // No apples created on death, so appleDirty stays false
    expect(appleDirty).toBe(false);
  });

  test('multiple AI deaths create multiple corpses', () => {
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
    var corpsesAfterFirst = corpses.length;

    // Kill second AI
    aiDie(1, 'wall');
    var corpsesAfterSecond = corpses.length;

    // Both deaths should have created corpses
    expect(corpsesAfterSecond).toBeGreaterThan(corpsesAfterFirst);
    expect(corpsesAfterSecond).toBe(2);
  });

 });

// ─── Particle object pool ───
describe('particles.js — object pool', () => {
  beforeEach(() => {
    // Reset pool and active particles before each test
    parts.length = 0;
    _partPool.length = 0;
    // Rebuild pool from scratch (all meshes that were in scene)
    // Since we can't easily re-add, just repopulate
    for (var i = 0; i < MAX_PARTICLES; i++) {
      var m = new THREE.Mesh(partGeo, partMat.clone());
      m.visible = false;
      scene.add(m);
      _partPool.push(m);
    }
  });

  test('MAX_PARTICLES is defined', () => {
    expect(MAX_PARTICLES).toBe(200);
  });

  test('_partPool is an array', () => {
    expect(Array.isArray(_partPool)).toBe(true);
  });

  test('_partPool has MAX_PARTICLES meshes pre-allocated', () => {
    expect(_partPool.length).toBe(MAX_PARTICLES);
  });

  test('burst returns meshes to pool instead of destroying', () => {
    var poolBefore = _partPool.length;
    burst(0, 0, 0xff0000, 10);
    // Pool should have 10 fewer meshes
    expect(_partPool.length).toBe(poolBefore - 10);
    // Active particles should be 10
    expect(parts.length).toBe(10);
  });

  test('tickParts returns expired particles to pool', () => {
    burst(0, 0, 0xff0000, 5);
    var poolBefore = _partPool.length;
    // Simulate all particles expiring
    for (var i = 0; i < parts.length; i++) {
      parts[i].userData.life = 0;
    }
    tickParts(0.016);
    // Pool should have 5 more meshes
    expect(_partPool.length).toBe(poolBefore + 5);
    // Active particles should be 0
    expect(parts.length).toBe(0);
  });

  test('burst skips if pool is exhausted', () => {
    // Exhaust the pool
    _partPool.length = 0;
    burst(0, 0, 0xff0000, 10);
    // No particles created because pool is empty
    expect(parts.length).toBe(0);
    // Restore pool
    _partPool.length = MAX_PARTICLES;
  });
});

// ─── updateAppleSet (incremental hash update) ───
describe('apples.js — updateAppleSet()', () => {
  beforeEach(() => {
    setSnake([]);
    setObstacles([]);
  });

  test('updateAppleSet removes old and adds new', () => {
    setApples([{x: 1, z: 2}]);
    expect(appleSet['1,2']).toBe(true);
    updateAppleSet({x: 1, z: 2}, {x: 3, z: 4});
    expect(appleSet['1,2']).toBe(undefined);
    expect(appleSet['3,4']).toBe(true);
  });

  test('updateAppleSet handles null old apple', () => {
    setApples([]);
    updateAppleSet(null, {x: 5, z: 5});
    expect(appleSet['5,5']).toBe(true);
  });

  test('updateAppleSet handles null new apple', () => {
    setApples([{x: 1, z: 1}]);
    updateAppleSet({x: 1, z: 1}, null);
    expect(appleSet['1,1']).toBe(undefined);
  });

  test('updateAppleSet handles both null', () => {
    setApples([]);
    updateAppleSet(null, null);
    expect(Object.keys(appleSet).length).toBe(0);
  });
});

// ─── bestApple() partial selection ───
describe('ai.js — bestApple() partial selection', () => {
  beforeEach(() => {
    setSnake([{x: 0, z: 0}, {x: -1, z: 0}]);
    setObstacles([]);
  });

  test('bestApple selects from closest candidates with many apples', () => {
    var manyApples = [];
    for (var i = 0; i < 60; i++) {
      manyApples.push({x: i % 10, z: Math.floor(i / 10)});
    }
    setApples(manyApples);
    var blocked = buildBlockedSet();
    var result = bestApple([{x: 0, z: 0}, {x: -1, z: 0}], blocked, 'medium');
    expect(result).not.toBeNull();
    // Should pick one of the closest apples
    var dist = Math.abs(result.x) + Math.abs(result.z);
    expect(dist).toBeLessThan(15); // reasonable distance for nearest
  });

  test('bestApple returns nearest apple when few candidates', () => {
    setApples([{x: 2, z: 0}, {x: 10, z: 0}]);
    var blocked = buildBlockedSet();
    var result = bestApple([{x: 0, z: 0}, {x: -1, z: 0}], blocked, 'medium');
    expect(result).not.toBeNull();
    expect(result.x).toBe(2);
    expect(result.z).toBe(0);
  });

  test('bestApple partial selection preserves order by distance', () => {
    // Create apples at known distances
    setApples([
      {x: 10, z: 0}, {x: 20, z: 0}, {x: 30, z: 0},
      {x: 1, z: 0}, {x: 50, z: 0}, {x: 2, z: 0},
      {x: 100, z: 0}, {x: 3, z: 0}, {x: 15, z: 0},
      {x: 4, z: 0}, {x: 25, z: 0}
    ]);
    var blocked = buildBlockedSet();
    var result = bestApple([{x: 0, z: 0}, {x: -1, z: 0}], blocked, 'medium');
    expect(result).not.toBeNull();
    // Should pick one of the closest (1, 2, or 3)
    var dist = Math.abs(result.x) + Math.abs(result.z);
    expect(dist).toBeLessThanOrEqual(3);
  });
});
