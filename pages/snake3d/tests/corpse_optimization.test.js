// ─── Corpse optimization tests ───
// Tests for: CORPSE_CONVERSION_BATCH, corpseSet hash, no burst on conversion

const { setSnake, setApples, setObstacles } = require('./helpers');

// ─── CORPSE_CONVERSION_BATCH ───
describe('ai.js — CORPSE_CONVERSION_BATCH', () => {
  test('CORPSE_CONVERSION_BATCH is 1 (progressive segment conversion)', () => {
    expect(CORPSE_CONVERSION_BATCH).toBe(1);
  });

  test('processCorpses converts CORPSE_CONVERSION_BATCH segments per tick', () => {
    corpses = [];
    setApples([]);
    setSnake([{x: 0, z: 0}]);
    setObstacles([]);

    // Create a corpse with 10 segments
    corpses.push({
      segments: [
        {x: 10, z: 0}, {x: 9, z: 0}, {x: 8, z: 0}, {x: 7, z: 0}, {x: 6, z: 0},
        {x: 5, z: 0}, {x: 4, z: 0}, {x: 3, z: 0}, {x: 2, z: 0}, {x: 1, z: 0}
      ],
      convertIndex: 0,
      groupData: {
        headM: { visible: true },
        bodyMs: Array(200).fill({ visible: true })
      },
      color: 'red'
    });

    // Each tick: should convert 1 segment
    processCorpses();
    expect(corpses[0].convertIndex).toBe(1);
    expect(apples.filter(Boolean).length).toBe(1);

    processCorpses();
    expect(corpses[0].convertIndex).toBe(2);
    expect(apples.filter(Boolean).length).toBe(2);

    processCorpses();
    expect(corpses[0].convertIndex).toBe(3);
    expect(apples.filter(Boolean).length).toBe(3);

    // After 10 ticks, corpse should be fully converted
    for (var i = 0; i < 7; i++) processCorpses();
    expect(corpses[0].convertIndex).toBe(10);
    expect(apples.filter(Boolean).length).toBe(10);

    // Next tick: corpse removed
    processCorpses();
    expect(corpses.length).toBe(0);
  });

  test('processCorpses handles out-of-bounds segments', () => {
    corpses = [];
    setApples([]);
    setSnake([{x: 0, z: 0}]);
    setObstacles([]);

    // Create a corpse where some segments are out of bounds
    corpses.push({
      segments: [
        {x: 999, z: 0},  // out of bounds
        {x: 5, z: 0},    // in bounds
        {x: 4, z: 0},    // in bounds
        {x: 3, z: 0},    // in bounds
      ],
      convertIndex: 0,
      groupData: {
        headM: { visible: true },
        bodyMs: Array(200).fill({ visible: true })
      },
      color: 'red'
    });

    processCorpses();
    // Should have converted 1 segment (out of bounds — no apple created)
    expect(corpses[0].convertIndex).toBe(1);
    expect(apples.filter(Boolean).length).toBe(0);
  });

  test('processCorpses does not duplicate apples on an occupied corpse cell', () => {
    corpses = [];
    setApples([{x: 5, z: 0, fromDeath: true}]);
    setSnake([{x: 0, z: 0}]);
    setObstacles([]);

    corpses.push({
      segments: [{x: 5, z: 0}],
      convertIndex: 0,
      groupData: {
        headM: { visible: true },
        bodyMs: Array(200).fill({ visible: true })
      },
      color: 'red'
    });

    processCorpses();
    expect(corpses[0].convertIndex).toBe(1);
    expect(apples.filter(Boolean).length).toBe(1);
    expect(appleSet['5,0']).toBe(true);
  });
});

// ─── corpseSet hash ───
describe('apples.js — corpseSet hash', () => {
  beforeEach(() => {
    corpses = [];
    setSnake([]);
    setApples([]);
    setObstacles([]);
  });

  test('corpseSet is an object', () => {
    expect(typeof corpseSet).toBe('object');
  });

  test('corpseSet is empty when no corpses', () => {
    rebuildCorpseSet();
    expect(Object.keys(corpseSet).length).toBe(0);
  });

  test('addToCorpseSet adds all segments', () => {
    var segments = [
      {x: 5, z: 0}, {x: 4, z: 0}, {x: 3, z: 0}
    ];
    addToCorpseSet(segments);
    expect(corpseSet['5,0']).toBe(true);
    expect(corpseSet['4,0']).toBe(true);
    expect(corpseSet['3,0']).toBe(true);
    expect(corpseSet['2,0']).toBe(undefined);
  });

  test('removeFromCorpseSet removes converted segments', () => {
    var segments = [
      {x: 5, z: 0}, {x: 4, z: 0}, {x: 3, z: 0}, {x: 2, z: 0}
    ];
    addToCorpseSet(segments);
    expect(Object.keys(corpseSet).length).toBe(4);

    // Remove first 2 segments (indices 0-1)
    removeFromCorpseSet(segments, 0, 2);
    expect(corpseSet['5,0']).toBe(undefined);
    expect(corpseSet['4,0']).toBe(undefined);
    expect(corpseSet['3,0']).toBe(true);
    expect(corpseSet['2,0']).toBe(true);
  });

  test('rebuildCorpseSet rebuilds from corpses array', () => {
    corpses = [{
      segments: [
        {x: 1, z: 1}, {x: 2, z: 2}, {x: 3, z: 3}, {x: 4, z: 4}
      ],
      convertIndex: 2  // first 2 already converted
    }];
    rebuildCorpseSet();
    // Only unconverted segments should be in corpseSet
    expect(corpseSet['1,1']).toBe(undefined);
    expect(corpseSet['2,2']).toBe(undefined);
    expect(corpseSet['3,3']).toBe(true);
    expect(corpseSet['4,4']).toBe(true);
  });

  test('rebuildCorpseSet handles empty corpses array', () => {
    corpses = [];
    corpseSet['1,1'] = true; // dirty state
    rebuildCorpseSet();
    expect(Object.keys(corpseSet).length).toBe(0);
  });
});

// ─── isOccupied uses corpseSet ───
describe('apples.js — isOccupied() with corpseSet', () => {
  beforeEach(() => {
    corpses = [];
    setSnake([]);
    setApples([]);
    setObstacles([]);
  });

  test('isOccupied returns true for corpse segment in corpseSet', () => {
    corpseSet['7,3'] = true;
    expect(isOccupied(7, 3)).toBe(true);
    expect(isOccupied(0, 0)).toBe(false);
  });

  test('isOccupied returns false when corpseSet is empty', () => {
    corpseSet = {};
    expect(isOccupied(7, 3)).toBe(false);
  });

  test('isOccupied checks corpseSet independently of corpses array', () => {
    // Even if corpses array has data, isOccupied uses corpseSet
    corpses = [{
      segments: [{x: 1, z: 1}, {x: 2, z: 2}],
      convertIndex: 0
    }];
    // But corpseSet doesn't have these
    corpseSet = {};
    expect(isOccupied(1, 1)).toBe(false);

    // After adding to corpseSet
    addToCorpseSet(corpses[0].segments);
    expect(isOccupied(1, 1)).toBe(true);
    expect(isOccupied(2, 2)).toBe(true);
  });
});

// ─── buildBlockedSet uses corpseSet ───
describe('ai.js — buildBlockedSet() with corpseSet', () => {
  beforeEach(() => {
    corpses = [];
    setSnake([{x: 0, z: 0}]);
    setApples([]);
    setObstacles([]);
  });

  test('buildBlockedSet includes corpseSet entries', () => {
    corpseSet = {};
    addToCorpseSet([{x: 5, z: 5}, {x: 6, z: 6}]);
    var blocked = buildBlockedSet();
    expect(blocked['5,5']).toBe(true);
    expect(blocked['6,6']).toBe(true);
  });

  test('buildBlockedSet works with empty corpseSet', () => {
    corpseSet = {};
    var blocked = buildBlockedSet();
    expect(blocked['0,0']).toBe(true);  // player snake
    expect(blocked['5,5']).toBe(undefined);
  });
});

// ─── aiDie populates corpseSet ───
describe('ai.js — aiDie() populates corpseSet', () => {
  beforeEach(() => {
    corpses = [];
    aiSnakes = [{
      id: 0,
      alive: true,
      snake: [
        {x: 5, z: 0}, {x: 4, z: 0}, {x: 3, z: 0},
        {x: 2, z: 0}, {x: 1, z: 0}
      ],
      direction: 0,
      score: 0,
      color: 'red',
      groupData: {
        headM: { material: { emissiveIntensity: 1 } },
        bodyMs: Array(200).fill({ material: { emissiveIntensity: 1 } }),
        group: { visible: true }
      }
    }];
    setSnake([{x: 0, z: 0}]);
    setApples([]);
    setObstacles([]);
    corpseSet = {};
  });

  test('aiDie adds corpse segments to corpseSet', () => {
    aiDie(0, 'wall');
    expect(corpseSet['5,0']).toBe(true);
    expect(corpseSet['4,0']).toBe(true);
    expect(corpseSet['3,0']).toBe(true);
    expect(corpseSet['2,0']).toBe(true);
    expect(corpseSet['1,0']).toBe(true);
  });

  test('corpseSet has correct number of entries after death', () => {
    aiDie(0, 'wall');
    expect(Object.keys(corpseSet).length).toBe(5);
  });
});

// ─── processCorpses updates corpseSet ───
describe('ai.js — processCorpses() updates corpseSet', () => {
  beforeEach(() => {
    corpses = [];
    setApples([]);
    setSnake([{x: 0, z: 0}]);
    setObstacles([]);
    corpseSet = {};
  });

  test('processCorpses removes converted segments from corpseSet', () => {
    var segments = [
      {x: 5, z: 0}, {x: 4, z: 0}, {x: 3, z: 0}, {x: 2, z: 0}, {x: 1, z: 0}
    ];
    addToCorpseSet(segments);
    expect(Object.keys(corpseSet).length).toBe(5);

    corpses.push({
      segments: segments,
      convertIndex: 0,
      groupData: {
        headM: { visible: true },
        bodyMs: Array(200).fill({ visible: true })
      },
      color: 'red'
    });

    // One tick: converts 1 segment (batch = 1)
    processCorpses();
    // Converted segment should be removed from corpseSet
    expect(corpseSet['5,0']).toBe(undefined);
    // Remaining segments should still be in corpseSet
    var remainingKeys = Object.keys(corpseSet);
    expect(remainingKeys.length).toBe(4);
  });
});

// ─── No burst() calls during corpse conversion ───
describe('ai.js — no burst() during corpse conversion', () => {
  beforeEach(() => {
    corpses = [];
    setApples([]);
    setSnake([{x: 0, z: 0}]);
    setObstacles([]);
    corpseSet = {};
    parts.length = 0;
  });

  test('processCorpses does not create particle bursts', () => {
    var segments = [
      {x: 5, z: 0}, {x: 4, z: 0}, {x: 3, z: 0},
      {x: 2, z: 0}, {x: 1, z: 0}
    ];
    addToCorpseSet(segments);

    corpses.push({
      segments: segments,
      convertIndex: 0,
      groupData: {
        headM: { visible: true },
        bodyMs: Array(200).fill({ visible: true })
      },
      color: 'red'
    });

    var partsBefore = parts.length;
    processCorpses();
    // No particles should be created by processCorpses
    expect(parts.length).toBe(partsBefore);
  });
});

// ─── Death apples do NOT use point lights ───
// Each apple mesh used to carry a THREE.PointLight, but that was removed
// because dozens of simultaneous death apples would cause the forward renderer
// to re-shade every object against every light, stalling frames.
// Death apples (fromDeath) render the sphere but NO light.
describe('apples.js — death apples have no point light overhead', () => {
  beforeEach(() => {
    setSnake([{x: 0, z: 0}]);
    setObstacles([]);
    corpseSet = {};
    buildApples(); // rebuild the apple mesh pool fresh
  });

  test('buildApples does not add point lights to apple meshes', () => {
    expect(appleMeshes.length).toBeGreaterThan(0);
    for (var i = 0; i < appleMeshes.length; i++) {
      // No userData.light — that was removed for performance
      expect(appleMeshes[i].userData.light).toBeUndefined();
    }
  });

  test('refreshApples works with normal apples without lights', () => {
    setApples([{x: 1, z: 1}, {x: 2, z: 2}]);
    appleDirty = true;
    refreshApples();
    expect(appleMeshes[0].visible).toBe(true);
    expect(appleMeshes[1].visible).toBe(true);
  });

  test('refreshApples works with death apples without lights', () => {
    setApples([{x: 1, z: 1, fromDeath: true}, {x: 2, z: 2, fromDeath: true}]);
    appleDirty = true;
    refreshApples();
    // Sphere still visible (the apple is on the board)
    expect(appleMeshes[0].visible).toBe(true);
    expect(appleMeshes[1].visible).toBe(true);
  });

  test('a mix of normal and death apples works without lights', () => {
    setApples([{x: 1, z: 1}, {x: 2, z: 2, fromDeath: true}, {x: 3, z: 3}]);
    appleDirty = true;
    refreshApples();
    expect(appleMeshes[0].visible).toBe(true);
    expect(appleMeshes[1].visible).toBe(true);
    expect(appleMeshes[2].visible).toBe(true);
  });

  test('many simultaneous death apples do not add point lights', () => {
    var many = [];
    for (var i = 0; i < 60; i++) many.push({x: i % 20, z: Math.floor(i / 20), fromDeath: true});
    setApples(many);
    appleDirty = true;
    refreshApples();
    // Count visible meshes — all should be visible as spheres
    var visible = 0;
    for (var j = 0; j < appleMeshes.length; j++) {
      if (appleMeshes[j].visible) visible++;
    }
    expect(visible).toBe(60); // all 60 death apples are visible as spheres
    // No lights added — that's the whole point
    var lights = 0;
    for (var k = 0; k < appleMeshes.length; k++) {
      if (appleMeshes[k].userData && appleMeshes[k].userData.light) lights++;
    }
    expect(lights).toBe(0);
  });
});
