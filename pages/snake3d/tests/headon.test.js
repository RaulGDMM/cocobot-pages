// ─── Tests: Head-on collision detection ───
// Tests for detectAndHandleHeadOnCollisions() and related behavior.

const { setSnake, setApples, setObstacles } = require('./helpers');

const setGlobal = (name, value) => { global[name] = value; };

// ─── detectAndHandleHeadOnCollisions() ───
describe('ai.js — detectAndHandleHeadOnCollisions()', () => {
  beforeEach(() => {
    setSnake([{x: 0, z: 0}, {x: -1, z: 0}]);
    setApples([]);
    setObstacles([]);
    setGlobal('direction', 0); // player facing +X
    setGlobal('gameOver', false);
    setGlobal('score', 0);
    setGlobal('highScore', 0);
    setGlobal('totalGames', 0);
    setGlobal('gridSize', 22);
    setGlobal('half', 11);
    setGlobal('gridMinX', -11);
    setGlobal('gridMaxX', 11);
    setGlobal('gridMinZ', -11);
    setGlobal('gridMaxZ', 11);
    setGlobal('corpses', []);
    setGlobal('corpseSet', {});
    setGlobal('aiSnakes', []);
    setGlobal('playerColor', 'green');
    setGlobal('gameMode', 'vs2');
    setGlobal('difficulty', 'medium');
    setGlobal('spectating', false);
    setGlobal('running', true);
    setGlobal('shrinkCountdowns', []);
  });

  test('returns false when no AI snakes', () => {
    setGlobal('aiSnakes', []);
    var result = detectAndHandleHeadOnCollisions();
    expect(result).toBe(false);
  });

  test('returns false when no head-on collision', () => {
    // Player at (0,0) facing +X → dest (1,0)
    // AI at (5,0) facing +X → dest (6,0)
    setGlobal('aiSnakes', [{
      id: 'ai_0',
      alive: true,
      snake: [{x: 5, z: 0}, {x: 4, z: 0}],
      direction: 0, // facing +X
      color: 'red',
      score: 0,
      groupData: null
    }]);
    var result = detectAndHandleHeadOnCollisions();
    expect(result).toBe(false);
    // Neither should die
    expect(gameOver).toBe(false);
    expect(aiSnakes[0].alive).toBe(true);
  });

  test('player vs AI head-on: both die', () => {
    // Player at (0,0) facing +X → dest (1,0)
    // AI at (2,0) facing -X → dest (1,0)
    setGlobal('direction', 0);
    setGlobal('aiSnakes', [{
      id: 'ai_0',
      alive: true,
      snake: [{x: 2, z: 0}, {x: 3, z: 0}],
      direction: Math.PI, // facing -X
      color: 'red',
      score: 0,
      groupData: null
    }]);

    var result = detectAndHandleHeadOnCollisions();
    expect(result).toBe(true);
    expect(gameOver).toBe(true); // player died
    expect(aiSnakes[0].alive).toBe(false); // AI died
  });

  test('AI vs AI head-on: both die, player survives', () => {
    // Player far away at (0,0) facing +X → dest (1,0)
    // AI0 at (5,0) facing +X → dest (6,0)
    // AI1 at (7,0) facing -X → dest (6,0)
    setSnake([{x: 0, z: 0}, {x: -1, z: 0}]);
    setGlobal('direction', 0);
    setGlobal('aiSnakes', [
      {
        id: 'ai_0',
        alive: true,
        snake: [{x: 5, z: 0}, {x: 4, z: 0}],
        direction: 0, // facing +X → dest (6,0)
        color: 'red',
        score: 0,
        groupData: null
      },
      {
        id: 'ai_1',
        alive: true,
        snake: [{x: 7, z: 0}, {x: 8, z: 0}],
        direction: Math.PI, // facing -X → dest (6,0)
        color: 'blue',
        score: 0,
        groupData: null
      }
    ]);

    var result = detectAndHandleHeadOnCollisions();
    expect(result).toBe(true);
    expect(gameOver).toBe(false); // player survives
    expect(aiSnakes[0].alive).toBe(false); // AI0 died
    expect(aiSnakes[1].alive).toBe(false); // AI1 died
  });

  test('dead AI is not considered for collision', () => {
    // Player at (0,0) facing +X → dest (1,0)
    // AI at (2,0) facing -X → dest (1,0), but already dead
    setGlobal('aiSnakes', [{
      id: 'ai_0',
      alive: false,
      snake: [{x: 2, z: 0}, {x: 3, z: 0}],
      direction: Math.PI,
      color: 'red',
      score: 0,
      groupData: null
    }]);

    var result = detectAndHandleHeadOnCollisions();
    expect(result).toBe(false);
    expect(gameOver).toBe(false);
  });

  test('dead player is not considered for collision', () => {
    setGlobal('gameOver', true);
    setSnake([{x: 0, z: 0}, {x: -1, z: 0}]);
    setGlobal('aiSnakes', [{
      id: 'ai_0',
      alive: true,
      snake: [{x: 2, z: 0}, {x: 3, z: 0}],
      direction: Math.PI,
      color: 'red',
      score: 0,
      groupData: null
    }]);

    var result = detectAndHandleHeadOnCollisions();
    expect(result).toBe(false);
  });

  test('creates corpse entries for dead AI snakes', () => {
    setGlobal('corpses', []);
    setGlobal('aiSnakes', [{
      id: 'ai_0',
      alive: true,
      snake: [{x: 2, z: 0}, {x: 3, z: 0}],
      direction: Math.PI,
      color: 'red',
      score: 0,
      groupData: null
    }]);

    detectAndHandleHeadOnCollisions();
    expect(corpses.length).toBeGreaterThan(0);
  });

  test('shows head-on collision message with emojis', () => {
    setGlobal('aiSnakes', [{
      id: 'ai_0',
      alive: true,
      snake: [{x: 2, z: 0}, {x: 3, z: 0}],
      direction: Math.PI,
      color: 'red',
      score: 0,
      groupData: null
    }]);

    detectAndHandleHeadOnCollisions();

    var msgEl = document.getElementById('ai-death-msg');
    expect(msgEl.textContent).toContain('Choque de cabezas');
    expect(msgEl.textContent).toContain('💥💥');
    expect(msgEl.textContent).toContain('😵');
    expect(msgEl.textContent).toContain('eliminadas');
  });

  test('AI vs AI message shows both AI colors', () => {
    setSnake([{x: 0, z: 0}, {x: -1, z: 0}]);
    setGlobal('direction', 0);
    setGlobal('aiSnakes', [
      {
        id: 'ai_0',
        alive: true,
        snake: [{x: 5, z: 0}, {x: 4, z: 0}],
        direction: 0,
        color: 'red',
        score: 0,
        groupData: null
      },
      {
        id: 'ai_1',
        alive: true,
        snake: [{x: 7, z: 0}, {x: 8, z: 0}],
        direction: Math.PI,
        color: 'blue',
        score: 0,
        groupData: null
      }
    ]);

    detectAndHandleHeadOnCollisions();

    var msgEl = document.getElementById('ai-death-msg');
    expect(msgEl.textContent).toContain('roja');
    expect(msgEl.textContent).toContain('azul');
  });

  test('player vs AI message shows "Tú"', () => {
    setGlobal('aiSnakes', [{
      id: 'ai_0',
      alive: true,
      snake: [{x: 2, z: 0}, {x: 3, z: 0}],
      direction: Math.PI,
      color: 'red',
      score: 0,
      groupData: null
    }]);

    detectAndHandleHeadOnCollisions();

    var msgEl = document.getElementById('ai-death-msg');
    expect(msgEl.textContent).toContain('Tú');
  });

  test('collision on Z axis works', () => {
    // Player at (0,0) facing +Z → dest (0,1)
    // AI at (0,2) facing -Z → dest (0,1)
    setGlobal('direction', Math.PI / 2);
    setGlobal('aiSnakes', [{
      id: 'ai_0',
      alive: true,
      snake: [{x: 0, z: 2}, {x: 0, z: 3}],
      direction: -Math.PI / 2, // facing -Z
      color: 'red',
      score: 0,
      groupData: null
    }]);

    var result = detectAndHandleHeadOnCollisions();
    expect(result).toBe(true);
    expect(gameOver).toBe(true);
    expect(aiSnakes[0].alive).toBe(false);
  });

  test('diagonal positions do not collide', () => {
    // Player at (0,0) facing +X → dest (1,0)
    // AI at (2,1) facing -X → dest (1,1)
    setGlobal('direction', 0);
    setGlobal('aiSnakes', [{
      id: 'ai_0',
      alive: true,
      snake: [{x: 2, z: 1}, {x: 3, z: 1}],
      direction: Math.PI,
      color: 'red',
      score: 0,
      groupData: null
    }]);

    var result = detectAndHandleHeadOnCollisions();
    expect(result).toBe(false);
    expect(gameOver).toBe(false);
    expect(aiSnakes[0].alive).toBe(true);
  });

  test('three snakes converging on same cell: first pair collides', () => {
    // Player at (0,0) facing +X → dest (1,0)
    // AI0 at (2,0) facing -X → dest (1,0)
    // AI1 at (4,0) facing -X → dest (3,0) (no collision)
    setGlobal('direction', 0);
    setGlobal('aiSnakes', [
      {
        id: 'ai_0',
        alive: true,
        snake: [{x: 2, z: 0}, {x: 3, z: 0}],
        direction: Math.PI,
        color: 'red',
        score: 0,
        groupData: null
      },
      {
        id: 'ai_1',
        alive: true,
        snake: [{x: 4, z: 0}, {x: 5, z: 0}],
        direction: Math.PI,
        color: 'blue',
        score: 0,
        groupData: null
      }
    ]);

    var result = detectAndHandleHeadOnCollisions();
    expect(result).toBe(true);
    expect(gameOver).toBe(true); // player died in head-on with AI0
    expect(aiSnakes[0].alive).toBe(false); // AI0 died
    expect(aiSnakes[1].alive).toBe(true); // AI1 survives (not involved)
  });

  test('perpendicular clash is a normal side collision, not a head-on', () => {
    // Player at (0,0) facing +X and went straight → dest (1,0)
    // AI at (1,1) facing -Z having just turned → dest (1,0)
    // They meet perpendicular: the AI ran into the side, so it dies as an
    // ordinary collision and NO head-on message is shown.
    setSnake([{x: 0, z: 0}, {x: -1, z: 0}]);
    setGlobal('direction', 0);
    setGlobal('playerPrevDirection', 0); // player went straight
    setGlobal('aiSnakes', [{
      id: 'ai_0',
      alive: true,
      snake: [{x: 1, z: 1}, {x: 1, z: 2}],
      direction: -Math.PI / 2, // facing -Z → dest (1,0)
      prevDirection: 0,         // was facing +X → it turned
      color: 'red',
      score: 0,
      groupData: null
    }]);

    var result = detectAndHandleHeadOnCollisions();
    expect(result).toBe(true);
    expect(gameOver).toBe(false);          // player survives (didn't turn)
    expect(aiSnakes[0].alive).toBe(false); // the AI that turned dies

    var msgEl = document.getElementById('ai-death-msg');
    expect(msgEl.textContent).not.toContain('Choque de cabezas');
  });

  test('ambiguous perpendicular AI clash kills only one snake', () => {
    // Two AIs enter the same cell perpendicularly without either having just
    // turned. This is a side collision, not a front-to-front crash, so it
    // should not remove both snakes and schedule a double-shrink cascade.
    setSnake([]);
    setGlobal('aiSnakes', [
      {
        id: 'ai_0',
        alive: true,
        snake: [{x: 0, z: 1}, {x: 0, z: 2}],
        direction: -Math.PI / 2, // facing -Z → dest (0,0)
        prevDirection: -Math.PI / 2,
        color: 'blue',
        score: 0,
        groupData: null
      },
      {
        id: 'ai_1',
        alive: true,
        snake: [{x: -1, z: 0}, {x: -2, z: 0}],
        direction: 0, // facing +X → dest (0,0)
        prevDirection: 0,
        color: 'salmon',
        score: 0,
        groupData: null
      }
    ]);

    var result = detectAndHandleHeadOnCollisions();
    var aliveCount = aiSnakes.filter(function(ai) { return ai.alive; }).length;

    expect(result).toBe(true);
    expect(aliveCount).toBe(1);

    var msgEl = document.getElementById('ai-death-msg');
    expect(msgEl.textContent).not.toContain('Choque de cabezas');
  });
});

// ─── showAiDeathMessage() — headon cause ───
describe('ai.js — showAiDeathMessage() headon cause', () => {
  var deathMsgEl;

  beforeEach(() => {
    deathMsgEl = document.getElementById('ai-death-msg');
    deathMsgEl.classList.remove('visible');
    clearTimeout(deathMsgEl._hideTimer);
  });

  test('shows headon death message with emojis', () => {
    showAiDeathMessage({color: 'red'}, 'headon');
    expect(deathMsgEl.textContent).toContain('roja');
    expect(deathMsgEl.textContent).toContain('choque de cabezas');
    expect(deathMsgEl.textContent).toContain('💥');
    expect(deathMsgEl.textContent).toContain('😵💫');
  });

  test('headon message does not show points', () => {
    showAiDeathMessage({color: 'blue'}, 'headon');
    expect(deathMsgEl.textContent).not.toContain('puntos');
  });

  test('headon message adds visible class', () => {
    showAiDeathMessage({color: 'green'}, 'headon');
    expect(deathMsgEl.classList.contains('visible')).toBe(true);
  });
});

// ─── die() — headon cause ───
describe('game.js — die("headon")', () => {
  beforeEach(() => {
    setSnake([{x: 0, z: 0}, {x: -1, z: 0}]);
    setApples([]);
    setObstacles([]);
    setGlobal('score', 5);
    setGlobal('highScore', 3);
    setGlobal('totalGames', 10);
    setGlobal('gameOver', false);
    setGlobal('running', true);
    setGlobal('aiSnakes', []);
  });

  test('die("headon") shows head-on collision message', () => {
    die('headon');
    expect(gameOver).toBe(true);
    expect(finalScoreEl.textContent).toContain('Choque de cabezas');
  });

  test('die("headon") sets gameOver', () => {
    die('headon');
    expect(gameOver).toBe(true);
  });

  test('die("headon") sets running to false', () => {
    die('headon');
    expect(running).toBe(false);
  });
});

// ─── Integration: stepAI after head-on collision ───
describe('ai.js — stepAI() after head-on collision', () => {
  beforeEach(() => {
    setSnake([{x: -5, z: 0}, {x: -6, z: 0}]);
    setApples([{x: 3, z: 0}]);
    setObstacles([]);
    setGlobal('direction', 0);
    setGlobal('gameOver', false);
    setGlobal('score', 0);
    setGlobal('gridSize', 22);
    setGlobal('half', 11);
    setGlobal('gridMinX', -11);
    setGlobal('gridMaxX', 11);
    setGlobal('gridMinZ', -11);
    setGlobal('gridMaxZ', 11);
    setGlobal('difficulty', 'hard');
    setGlobal('corpses', []);
    setGlobal('corpseSet', {});
    setGlobal('playerColor', 'green');
    setGlobal('gameMode', 'vs4');
  });

  test('surviving AI still moves after head-on kills another AI', () => {
    // AI0 and AI1 will collide head-on
    // AI2 is far away and should survive
    setGlobal('aiSnakes', [
      {
        id: 'ai_0',
        alive: true,
        snake: [{x: 5, z: 0}, {x: 4, z: 0}],
        direction: 0,
        color: 'red',
        score: 0,
        groupData: null
      },
      {
        id: 'ai_1',
        alive: true,
        snake: [{x: 7, z: 0}, {x: 8, z: 0}],
        direction: Math.PI,
        color: 'blue',
        score: 0,
        groupData: null
      },
      {
        id: 'ai_2',
        alive: true,
        snake: [{x: -3, z: 5}, {x: -4, z: 5}],
        direction: 0,
        color: 'yellow',
        score: 0,
        groupData: null
      }
    ]);

    // Simulate: head-on detection runs first, kills AI0 and AI1
    detectAndHandleHeadOnCollisions();

    // AI0 and AI1 should be dead
    expect(aiSnakes[0].alive).toBe(false);
    expect(aiSnakes[1].alive).toBe(false);

    // AI2 should still be alive
    expect(aiSnakes[2].alive).toBe(true);

    // stepAI should skip dead snakes and move AI2
    var ai2HeadBefore = {x: aiSnakes[2].snake[0].x, z: aiSnakes[2].snake[0].z};
    stepAI();

    // AI2 should have moved (or at least not crashed)
    expect(aiSnakes[2].alive).toBe(true);
  });
});
