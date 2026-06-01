// ─── buildBlockedSet caching tests ───
// The per-tick cache must:
//   • return identical contents to a fresh build,
//   • never let callers mutate the shared cached object,
//   • refresh when invalidated (a snake moved/died),
//   • stay disabled outside the AI phase so ad-hoc callers see fresh data.

const { setSnake, setApples, setObstacles } = require('./helpers');

function keysOf(obj) { return Object.keys(obj).sort(); }

describe('ai.js — cloneBlocked()', () => {
  test('produces an independent copy with the same keys', () => {
    var src = { '1,1': true, '2,3': true };
    var copy = cloneBlocked(src);
    expect(keysOf(copy)).toEqual(keysOf(src));
    // Mutating the copy must not affect the source
    copy['9,9'] = true;
    expect(src['9,9']).toBe(undefined);
  });

  test('handles an empty set', () => {
    expect(cloneBlocked({})).toEqual({});
  });
});

describe('ai.js — buildBlockedSet() caching', () => {
  beforeEach(() => {
    setObstacles([]);
    setApples([]);
    setSnake([]);
    aiSnakes = [];
    corpseSet = {};
    disableBlockedCache(); // ensure a clean state between tests
  });

  test('returns fresh data when cache disabled (default outside stepAI)', () => {
    setSnake([{ x: 1, z: 1 }]);
    var a = buildBlockedSet();
    setSnake([{ x: 2, z: 2 }]);
    var b = buildBlockedSet();
    // No caching → reflects the latest board immediately
    expect(a['1,1']).toBe(true);
    expect(b['2,2']).toBe(true);
    expect(b['1,1']).toBe(undefined);
  });

  test('cached result has identical contents to a fresh compute', () => {
    setSnake([{ x: 0, z: 0 }, { x: 0, z: 1 }]);
    setObstacles([{ x: 5, z: 5 }]);
    corpseSet = { '7,7': true };
    var fresh = buildBlockedSet(); // disabled → fresh
    enableBlockedCache();
    var cached = buildBlockedSet();
    expect(keysOf(cached)).toEqual(keysOf(fresh));
    disableBlockedCache();
  });

  test('while enabled and not invalidated, returns the same object (no recompute)', () => {
    enableBlockedCache();
    var first = buildBlockedSet();
    var second = buildBlockedSet();
    expect(second).toBe(first); // same reference → served from cache
    disableBlockedCache();
  });

  test('does not pick up board changes until invalidated', () => {
    setSnake([{ x: 1, z: 1 }]);
    enableBlockedCache();
    var before = buildBlockedSet();
    expect(before['1,1']).toBe(true);
    // Change the board WITHOUT invalidating
    setSnake([{ x: 3, z: 3 }]);
    var stillCached = buildBlockedSet();
    expect(stillCached['1,1']).toBe(true); // stale, as designed within a turn
    // Invalidate → next build reflects the change
    invalidateBlockedCache();
    var refreshed = buildBlockedSet();
    expect(refreshed['3,3']).toBe(true);
    expect(refreshed['1,1']).toBe(undefined);
    disableBlockedCache();
  });

  test('callers cloning the cache cannot corrupt it', () => {
    setSnake([{ x: 4, z: 4 }]);
    enableBlockedCache();
    var shared = buildBlockedSet();
    var mine = cloneBlocked(shared);
    mine['99,99'] = true; // a caller adds its own body
    var sharedAgain = buildBlockedSet();
    expect(sharedAgain['99,99']).toBe(undefined); // cache untouched
    disableBlockedCache();
  });

  test('disableBlockedCache clears the cached object', () => {
    enableBlockedCache();
    var cached = buildBlockedSet();
    setSnake([{ x: 8, z: 8 }]);
    disableBlockedCache();
    var fresh = buildBlockedSet();
    expect(fresh).not.toBe(cached);
    expect(fresh['8,8']).toBe(true);
  });

  test('excludeSnake variant always computes fresh even when caching is on', () => {
    aiSnakes = [
      { id: 0, alive: true, snake: [{ x: 1, z: 0 }] },
      { id: 1, alive: true, snake: [{ x: 2, z: 0 }] }
    ];
    enableBlockedCache();
    var all = buildBlockedSet();
    var without0 = buildBlockedSet(0);
    expect(all['1,0']).toBe(true);
    expect(without0['1,0']).toBe(undefined); // snake 0 excluded
    expect(without0['2,0']).toBe(true);
    disableBlockedCache();
  });
});

describe('ai.js — stepAI() leaves cache disabled afterwards', () => {
  beforeEach(() => {
    setObstacles([]);
    setApples([{ x: 15, z: 15 }]);
    setSnake([{ x: 0, z: 0 }]);
    corpseSet = {};
    gameMode = 'vs2';
    difficulty = 'medium';
  });

  test('cache is off after stepAI returns (fresh data for other systems)', () => {
    aiSnakes = [{
      id: 0, alive: true, color: 'red', direction: 0,
      snake: [{ x: 5, z: 5 }, { x: 4, z: 5 }, { x: 3, z: 5 }],
      groupData: { headM: { material: {} }, bodyMs: [], group: { visible: true } },
      score: 0
    }];
    stepAI();
    // After stepAI, the cache must be disabled: a board change is seen immediately.
    setSnake([{ x: 9, z: 9 }]);
    var a = buildBlockedSet();
    setSnake([{ x: 10, z: 10 }]);
    var b = buildBlockedSet();
    expect(a['9,9']).toBe(true);
    expect(b['10,10']).toBe(true);
    expect(b['9,9']).toBe(undefined);
  });
});
