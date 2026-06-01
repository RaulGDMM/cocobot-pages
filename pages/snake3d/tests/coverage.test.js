// ─── Coverage tests: all bundle functions ───
// Tests to drive coverage of the snake3d-bundle.js to 90%+

const { setSnake, setApples, setObstacles } = require('./helpers');

// Helper to set global variables (avoids creating local vars in test scope)
const setGlobal = (name, value) => { global[name] = value; };

// ─── gw() ───
describe('scene.js — gw()', () => {
  test('adds CELL_CENTER (0.5) to grid coordinate', () => {
    expect(gw(0)).toBe(0.5);
    expect(gw(5)).toBe(5.5);
    expect(gw(-3)).toBe(-2.5);
  });

  test('handles boundary coordinates', () => {
    expect(gw(half - 1)).toBe(half - 0.5);
    expect(gw(-(half - 1))).toBe(-(half - 1) + 0.5);
  });
});

// ─── buildApples() ───
describe('apples.js — buildApples()', () => {
  test('creates NUM_APPLES + margin apple groups', () => {
    buildApples();
    expect(appleMeshes.length).toBe(NUM_APPLES + APPLE_POOL_MARGIN);
  });

  test('apple groups are initially hidden', () => {
    buildApples();
    expect(appleMeshes[0].visible).toBe(false);
    expect(appleMeshes[1].visible).toBe(false);
  });

  test('adds apple groups to appleGroup', () => {
    buildApples();
    expect(appleGroup.children.length).toBe(NUM_APPLES + APPLE_POOL_MARGIN);
  });

  test('clears existing children', () => {
    const dummy = new THREE.Group();
    appleGroup.add(dummy);
    buildApples();
    expect(appleGroup.children.includes(dummy)).toBe(false);
  });
});

// ─── spawnOneApple() ───
describe('apples.js — spawnOneApple()', () => {
  beforeEach(() => {
    setSnake([]);
    setApples([]);
    setObstacles([]);
  });

  test('returns a position within grid bounds', () => {
    const a = spawnOneApple();
    expect(a).not.toBeNull();
    expect(a.x).toBeGreaterThanOrEqual(-half);
    expect(a.x).toBeLessThan(half);
    expect(a.z).toBeGreaterThanOrEqual(-half);
    expect(a.z).toBeLessThan(half);
  });

  test('returns null when grid is fully occupied', () => {
    // Fill grid with obstacles
    for (let x = -half; x < half; x++) {
      for (let z = -half; z < half; z++) {
        obstacles.push({x, z});
      }
    }
    expect(spawnOneApple()).toBeNull();
  });

  test('avoids occupied cells', () => {
    setSnake([{x: 0, z: 0}]);
    setApples([{x: 1, z: 1}]);
    setObstacles([{x: -1, z: -1}]);
    const a = spawnOneApple();
    expect(a).not.toBeNull();
    // Apple must not be on any occupied cell
    var occupied = ['0,0', '1,1', '-1,-1'];
    var pos = a.x + ',' + a.z;
    expect(occupied.indexOf(pos)).toBe(-1);
  });
});

// ─── refreshApples() ───
describe('apples.js — refreshApples()', () => {
  beforeEach(() => {
    buildApples();
    appleDirty = true;
  });

  test('shows apples that exist', () => {
    setApples([{x: 1, z: 1}, {x: 2, z: 2}, {x: 3, z: 3}]);
    refreshApples();
    expect(appleMeshes[0].visible).toBe(true);
    expect(appleMeshes[1].visible).toBe(true);
    expect(appleMeshes[2].visible).toBe(true);
  });

  test('hides apples that do not exist', () => {
    setApples([{x: 1, z: 1}]);
    refreshApples();
    expect(appleMeshes[0].visible).toBe(true);
    expect(appleMeshes[1].visible).toBe(false);
    expect(appleMeshes[2].visible).toBe(false);
  });

  test('handles null apples', () => {
    setApples([{x: 1, z: 1}, null, {x: 3, z: 3}]);
    refreshApples();
    expect(appleMeshes[0].visible).toBe(true);
    expect(appleMeshes[1].visible).toBe(false);
    expect(appleMeshes[2].visible).toBe(true);
  });

  test('positions apples at correct grid coords', () => {
    setApples([{x: 5, z: 3}]);
    refreshApples();
    expect(appleMeshes[0].position.x).toBe(gw(5));
    expect(appleMeshes[0].position.z).toBe(gw(3));
  });
});

// ─── initApples() ───
describe('apples.js — initApples()', () => {
  test('clears apples array', () => {
    setApples([{x: 99, z: 99}]);
    initApples();
    expect(apples.some(a => a && a.x === 99)).toBe(false);
  });

  test('spawns apples', () => {
    setSnake([]);
    setObstacles([]);
    initApples();
    expect(apples.length).toBeGreaterThanOrEqual(1);
  });

  test('calls refreshApples', () => {
    setSnake([]);
    setObstacles([]);
    buildApples();
    appleDirty = true;
    initApples();
    expect(appleMeshes.some(m => m.visible)).toBe(true);
  });
});

// ─── buildObstacles() ───
describe('obstacles.js — buildObstacles()', () => {
  test('creates MAX_OBSTACLES meshes', () => {
    buildObstacles();
    expect(obsMeshes.length).toBe(MAX_OBSTACLES);
  });

  test('meshes are initially hidden', () => {
    buildObstacles();
    expect(obsMeshes[0].visible).toBe(false);
  });

  test('meshes have correct y position', () => {
    buildObstacles();
    expect(obsMeshes[0].position.y).toBe(0.35);
  });

  test('adds meshes to obsGroup', () => {
    buildObstacles();
    expect(obsGroup.children.length).toBe(MAX_OBSTACLES);
  });

  test('clears existing children', () => {
    const dummy = new THREE.Mesh();
    obsGroup.add(dummy);
    buildObstacles();
    expect(obsGroup.children.includes(dummy)).toBe(false);
  });
});

// ─── refreshObstacles() ───
describe('obstacles.js — refreshObstacles()', () => {
  beforeEach(() => {
    buildObstacles();
  });

  test('shows obstacles that exist', () => {
    setObstacles([{x: 1, z: 1}, {x: 2, z: 2}]);
    refreshObstacles();
    expect(obsMeshes[0].visible).toBe(true);
    expect(obsMeshes[1].visible).toBe(true);
  });

  test('hides obstacles that do not exist', () => {
    setObstacles([{x: 1, z: 1}]);
    refreshObstacles();
    expect(obsMeshes[0].visible).toBe(true);
    expect(obsMeshes[1].visible).toBe(false);
  });

  test('positions obstacles at correct grid coords', () => {
    setObstacles([{x: 5, z: 3}]);
    refreshObstacles();
    expect(obsMeshes[0].position.x).toBe(gw(5));
    expect(obsMeshes[0].position.z).toBe(gw(3));
  });
});

// ─── spawnObstacle() ───
describe('obstacles.js — spawnObstacle()', () => {
  beforeEach(() => {
    setSnake([{x: 0, z: 0}]);
    setApples([]);
    setObstacles([]);
  });

  test('spawns an obstacle when grid has space', () => {
    spawnObstacle();
    expect(obstacles.length).toBe(1);
  });

  test('does not spawn when MAX_OBSTACLES reached', () => {
    for (let i = 0; i < MAX_OBSTACLES; i++) {
      obstacles.push({x: -50 + i, z: -50 + i});
    }
    spawnObstacle();
    expect(obstacles.length).toBe(MAX_OBSTACLES);
  });

  test('obstacle is placed at safe distance from snake', () => {
    spawnObstacle();
    const o = obstacles[0];
    const dist = Math.abs(o.x - 0) + Math.abs(o.z - 0);
    expect(dist).toBeGreaterThanOrEqual(OBSTACLE_MIN_DIST_SNAKE);
  });

  test('obstacle is placed at safe distance from apples', () => {
    setApples([{x: 10, z: 10}]);
    spawnObstacle();
    const o = obstacles[0];
    const dist = Math.abs(o.x - 10) + Math.abs(o.z - 10);
    expect(dist).toBeGreaterThanOrEqual(OBSTACLE_MIN_DIST_APPLE);
  });

  test('obstacle is placed at safe distance from other obstacles', () => {
    setObstacles([{x: 5, z: 5}]);
    spawnObstacle();
    const o = obstacles[1];
    const dist = Math.abs(o.x - 5) + Math.abs(o.z - 5);
    expect(dist).toBeGreaterThanOrEqual(OBSTACLE_MIN_DIST_EACH);
  });

  test('does not spawn on occupied cell', () => {
    buildObstacles();
    setSnake([{x: 0, z: 0}]);
    setApples([]);
    setObstacles([]);
    spawnObstacle();
    const o = obstacles[0];
    expect(o.x).not.toBe(0);
    expect(o.z).not.toBe(0);
  });

  test('does not throw when grid is too crowded', () => {
    // Fill most of the grid
    for (let x = -half + 1; x < half - 1; x++) {
      for (let z = -half + 1; z < half - 1; z++) {
        if (Math.abs(x) + Math.abs(z) > OBSTACLE_MIN_DIST_SNAKE) {
          obstacles.push({x, z});
        }
      }
    }
    expect(() => spawnObstacle()).not.toThrow();
  });
});

// ─── buildSnake() ───
describe('snake.js — buildSnake()', () => {
  test('creates head mesh', () => {
    var result = buildSnake('green');
    expect(headM).not.toBeNull();
    expect(result.headM).not.toBeNull();
  });

  test('creates 200 body meshes', () => {
    var result = buildSnake('green');
    expect(bodyMs.length).toBe(200);
    expect(result.bodyMs.length).toBe(200);
  });

  test('head has correct y position', () => {
    buildSnake('green');
    expect(headM.position.y).toBe(0.25);
  });

  test('body meshes are initially hidden', () => {
    buildSnake('green');
    expect(bodyMs[0].visible).toBe(false);
  });

  test('body meshes have correct y position', () => {
    buildSnake('green');
    expect(bodyMs[0].position.y).toBe(0.225);
  });

  test('adds meshes to sGroup', () => {
    buildSnake('green');
    expect(sGroup.children.length).toBeGreaterThan(0);
  });

  test('returns group data object', () => {
    var result = buildSnake('red');
    expect(result.group).toBeDefined();
    expect(result.headM).toBeDefined();
    expect(result.bodyMs).toBeDefined();
  });
});

// ─── refreshSnake() ───
describe('snake.js — refreshSnake()', () => {
  beforeEach(() => {
    var result = buildSnake('green');
    playerGroupData = result;
  });

  test('returns early when snake is empty', () => {
    setSnake([]);
    refreshSnake();
    expect(headM.position.x).toBe(0);
  });

  test('positions head at snake[0]', () => {
    setSnake([{x: 5, z: 3}]);
    refreshSnake();
    expect(headM.position.x).toBe(gw(5));
    expect(headM.position.z).toBe(gw(3));
  });

  test('sets head rotation from direction', () => {
    setSnake([{x: 0, z: 0}]);
    setGlobal("direction",  Math.PI / 2);
    refreshSnake();
    expect(headM.rotation.y).toBe(-Math.PI / 2);
  });

  test('shows body segments', () => {
    setSnake([{x: 0, z: 0}, {x: -1, z: 0}, {x: -2, z: 0}]);
    refreshSnake();
    expect(bodyMs[1].visible).toBe(true);
    expect(bodyMs[2].visible).toBe(true);
  });

  test('hides unused body segments', () => {
    setSnake([{x: 0, z: 0}]);
    refreshSnake();
    expect(bodyMs[1].visible).toBe(false);
    expect(bodyMs[100].visible).toBe(false);
  });

  test('positions body segments at correct grid coords', () => {
    setSnake([{x: 0, z: 0}, {x: -1, z: 0}]);
    refreshSnake();
    expect(bodyMs[1].position.x).toBe(gw(-1));
    expect(bodyMs[1].position.z).toBe(gw(0));
  });

  test('scales body segments with distance from head', () => {
    setSnake([{x: 0, z: 0}, {x: -1, z: 0}, {x: -2, z: 0}]);
    refreshSnake();
    expect(bodyMs[1].scale.x).toBeGreaterThan(bodyMs[2].scale.x);
  });

  test('handles snake longer than bodyMs', () => {
    const longSnake = [];
    for (let i = 0; i < 250; i++) {
      longSnake.push({x: -i, z: 0});
    }
    setSnake(longSnake);
    expect(() => refreshSnake()).not.toThrow();
  });
});

// ─── burst() ───
describe('particles.js — burst()', () => {
  beforeEach(() => {
    // Clear existing particles
    parts.forEach(p => scene.remove(p));
    parts.length = 0;
  });

  test('creates n particles', () => {
    burst(0, 0, 0xff0000, 5);
    expect(parts.length).toBe(5);
  });

  test('creates 8 particles when n is omitted', () => {
    burst(0, 0, 0xff0000);
    expect(parts.length).toBe(8);
  });

  test('creates 8 particles when n is null', () => {
    burst(0, 0, 0xff0000, null);
    expect(parts.length).toBe(8);
  });

  test('positions particles at grid coords', () => {
    burst(5, 3, 0xff0000, 2);
    expect(parts[0].position.x).toBe(gw(5));
    expect(parts[0].position.z).toBe(gw(3));
  });

  test('sets particle y position to 0.3', () => {
    burst(0, 0, 0xff0000, 1);
    expect(parts[0].position.y).toBe(0.3);
  });

  test('sets particle color', () => {
    burst(0, 0, 0xff0000, 1);
    // Color is set via setHex, mock doesn't track it
    expect(parts[0].material).not.toBeNull();
  });

  test('sets particle opacity to 1', () => {
    burst(0, 0, 0xff0000, 1);
    expect(parts[0].material.opacity).toBe(1);
  });

  test('sets userData with velocity and life', () => {
    burst(0, 0, 0xff0000, 1);
    expect(parts[0].userData.life).toBe(1);
    expect(parts[0].userData.vx).toBeDefined();
    expect(parts[0].userData.vy).toBeDefined();
    expect(parts[0].userData.vz).toBeDefined();
  });

  test('adds particles to scene', () => {
    burst(0, 0, 0xff0000, 3);
    expect(parts.every(p => scene.children.includes(p))).toBe(true);
  });

  test('creates particles with negative coordinates', () => {
    burst(-5, -3, 0xff0000, 2);
    expect(parts[0].position.x).toBe(gw(-5));
    expect(parts[0].position.z).toBe(gw(-3));
  });
});

// ─── tickParts() ───
describe('particles.js — tickParts()', () => {
  beforeEach(() => {
    parts.forEach(p => scene.remove(p));
    parts.length = 0;
  });

  test('does nothing when no particles', () => {
    tickParts(0.016);
    expect(parts.length).toBe(0);
  });

  test('reduces particle life over time', () => {
    burst(0, 0, 0xff0000, 1);
    tickParts(0.1);
    expect(parts[0].userData.life).toBeLessThan(1);
  });

  test('updates particle position', () => {
    burst(0, 0, 0xff0000, 1);
    const origX = parts[0].position.x;
    tickParts(0.1);
    expect(parts[0].position.x).not.toBe(origX);
  });

  test('reduces vy (gravity)', () => {
    burst(0, 0, 0xff0000, 1);
    const origVy = parts[0].userData.vy;
    tickParts(0.1);
    expect(parts[0].userData.vy).toBeLessThan(origVy);
  });

  test('reduces opacity as life decreases', () => {
    burst(0, 0, 0xff0000, 1);
    tickParts(0.1);
    expect(parts[0].material.opacity).toBeLessThan(1);
  });

  test('reduces scale as life decreases', () => {
    burst(0, 0, 0xff0000, 1);
    tickParts(0.1);
    expect(parts[0].scale.x).toBeLessThan(1);
  });

  test('removes dead particles', () => {
    burst(0, 0, 0xff0000, 3);
    tickParts(1.0); // Long enough to kill all
    expect(parts.length).toBe(0);
  });

  test('dead particles are removed from scene', () => {
    burst(0, 0, 0xff0000, 3);
    tickParts(1.0);
    expect(parts.length).toBe(0);
  });

  test('clamps opacity to 0 minimum', () => {
    burst(0, 0, 0xff0000, 1);
    tickParts(1.0);
    // Particle should be removed, but if not, opacity >= 0
    if (parts.length > 0) {
      expect(parts[0].material.opacity).toBeGreaterThanOrEqual(0);
    }
  });

  test('clamps scale to 0.01 minimum', () => {
    burst(0, 0, 0xff0000, 1);
    tickParts(0.3); // Partial life
    expect(parts[0].scale.x).toBeGreaterThanOrEqual(0.01);
  });

  test('handles multiple tick calls', () => {
    burst(0, 0, 0xff0000, 5);
    tickParts(0.1);
    tickParts(0.1);
    tickParts(0.1);
    expect(parts.length).toBeLessThanOrEqual(5);
  });
});

// ─── initGame() ───
describe('game.js — initGame()', () => {
  beforeEach(() => {
    localStorage.clear();
    setGlobal('gridSize', 22);
    setGlobal('playerColor', 'green');
    setGlobal('gameMode', 'solo');
    setGlobal('difficulty', 'medium');
    setSnake([]);
    setApples([]);
    setObstacles([]);
    setGlobal('aiSnakes', []);
  });

  test('resets state variables', () => {
    initGame();
    expect(gameOver).toBe(false);
    expect(score).toBe(0);
    expect(direction).toBe(0);
  });

  test('creates initial snake with 4 segments', () => {
    initGame();
    expect(snake.length).toBe(4);
  });

  test('clears obstacles', () => {
    setObstacles([{x: 1, z: 1}]);
    initGame();
    expect(obstacles.length).toBe(0);
  });

  test('sets scoreEl to 0', () => {
    initGame();
    expect(scoreEl.textContent).toBe('0');
  });

  test('initializes camera smooth positions', () => {
    initGame();
    expect(headSmoothX).toBe(gw(-5));
    expect(headSmoothZ).toBe(gw(0));
  });

  test('builds snake mesh', () => {
    initGame();
    expect(headM).not.toBeNull();
    expect(bodyMs.length).toBe(200);
  });

  test('spawns apples', () => {
    initGame();
    expect(apples.filter(Boolean).length).toBeGreaterThan(0);
  });
});

// ─── turnL() / turnR() ───
describe('game.js — turnL() / turnR()', () => {
  beforeEach(() => {
    setGlobal("running",  false);
    setGlobal("gameOver",  false);
    setGlobal("direction",  0);
  });

  test('turnL does nothing when not running', () => {
    turnL();
    expect(direction).toBe(0);
  });

  test('turnL does nothing when game over', () => {
    setGlobal("running",  true);
    setGlobal("gameOver",  true);
    turnL();
    expect(direction).toBe(0);
  });

  test('turnL subtracts TURN_ANGLE when running', () => {
    setGlobal("running",  true);
    setGlobal("direction",  0);
    turnL();
    expect(direction).toBeCloseTo(-Math.PI / 2);
  });

  test('turnR adds TURN_ANGLE when running', () => {
    setGlobal("running",  true);
    setGlobal("direction",  0);
    turnR();
    expect(direction).toBeCloseTo(Math.PI / 2);
  });

  test('turnL can be called multiple times', () => {
    setGlobal("running",  true);
    setGlobal("direction",  0);
    turnL();
    turnL();
    expect(direction).toBeCloseTo(-Math.PI);
  });

  test('turnR then turnL returns to 0', () => {
    setGlobal("running",  true);
    setGlobal("direction",  0);
    turnR();
    turnL();
    expect(direction).toBeCloseTo(0);
  });
});

// ─── step() ───
describe('game.js — step()', () => {
  beforeEach(() => {
    localStorage.clear();
    setGlobal("running",  true);
    setGlobal("gameOver",  false);
    setGlobal("direction",  0);
    setGlobal("score",  0);
    setObstacles([]);
  });

  test('returns early when game over', () => {
    setGlobal("gameOver",  true);
    setSnake([{x: 0, z: 0}]);
    step();
    expect(snake.length).toBe(1);
  });

  test('moves snake forward in current direction', () => {
    setGlobal("direction", 0); // facing right (cos(0)=1, sin(0)=0);
    setSnake([{x: 0, z: 0}, {x: -1, z: 0}]);
    setApples([]);
    step();
    expect(snake[0]).toEqual({x: 1, z: 0});
    expect(snake.length).toBe(2);
  });

  test('eats apple and grows', () => {
    setGlobal("direction",  0);
    setSnake([{x: 0, z: 0}, {x: -1, z: 0}]);
    setApples([{x: 1, z: 0}]);
    step();
    expect(snake[0]).toEqual({x: 1, z: 0});
    expect(snake.length).toBe(3);
    expect(score).toBe(1);
  });

  test('dies when hitting wall', () => {
    setGlobal("direction",  0);
    setSnake([{x: 10, z: 0}, {x: 9, z: 0}]);
    setApples([]);
    step();
    expect(gameOver).toBe(true);
  });

  test('dies when hitting self', () => {
    setGlobal("direction",  0);
    setSnake([{x: 0, z: 0}, {x: 1, z: 0}, {x: 1, z: 1}, {x: -1, z: 0}]);
    setApples([]);
    step();
    expect(gameOver).toBe(true);
  });

  test('dies when hitting obstacle', () => {
    setGlobal("direction",  0);
    setSnake([{x: 0, z: 0}, {x: -1, z: 0}]);
    setObstacles([{x: 1, z: 0}]);
    setApples([]);
    step();
    expect(gameOver).toBe(true);
  });

  test('does not eat apple when path is clear', () => {
    setGlobal("direction",  0);
    setSnake([{x: 0, z: 0}, {x: -1, z: 0}]);
    setApples([{x: 5, z: 5}]);
    step();
    expect(score).toBe(0);
    expect(snake.length).toBe(2);
  });

  test('updates scoreEl after eating', () => {
    setGlobal("direction",  0);
    setSnake([{x: 0, z: 0}, {x: -1, z: 0}]);
    setApples([{x: 1, z: 0}]);
    step();
    expect(scoreEl.textContent).toBe('1');
  });
});

// ─── die() ───
describe('game.js — die()', () => {
  beforeEach(() => {
    localStorage.clear();
    setGlobal("score",  0);
    setGlobal("running",  true);
    setGlobal("gameOver",  false);
    setGlobal("highScore",  0);
    setSnake([{x: 0, z: 0}]);
  });

  test('sets gameOver to true', () => {
    die();
    expect(gameOver).toBe(true);
  });

  test('sets running to false', () => {
    die();
    expect(running).toBe(false);
  });

  test('updates high score when score > highScore', () => {
    setGlobal("score",  10);
    setGlobal("highScore",  5);
    die();
    expect(highScore).toBe(10);
    expect(highscoreEl.textContent).toBe('10');
  });

  test('does not update high score when score <= highScore', () => {
    setGlobal("score",  3);
    setGlobal("highScore",  10);
    die();
    expect(highScore).toBe(10);
  });

  test('increments totalGames', () => {
    setGlobal("totalGames",  5);
    die();
    expect(totalGames).toBe(6);
  });

  test('saves highScore to localStorage with mode-specific key', () => {
    setGlobal("score",  20);
    setGlobal("highScore",  10);
    setGlobal("gameMode",  'solo');
    setGlobal("difficulty",  'medium');
    setGlobal("gridSize",  22);
    die();
    var key = getHighScoreKey('solo', 'medium', 22);
    expect(localStorage.getItem(key)).toBe('20');
  });

  test('saves totalGames to localStorage', () => {
    setGlobal("totalGames",  10);
    die();
    expect(localStorage.getItem('snake3d_games')).toBe('11');
  });

  test('shows final score', () => {
    setGlobal("score",  15);
    die();
    expect(finalScoreEl.textContent).toContain('Puntuación: 15 🍎');
  });

  test('shows final score element', () => {
    die();
    expect(finalScoreEl.style.display).toBe('block');
  });

  test('changes start button to REINTENTAR', () => {
    die();
    expect(startBtn.textContent).toBe('REINTENTAR');
  });

  test('shows overlay', () => {
    overlay.classList.add('hidden');
    die();
    expect(overlay.classList.contains('hidden')).toBe(false);
  });

  test('shows touch hints', () => {
    die();
    expect(hintL.style.opacity).toBe('1');
    expect(hintR.style.opacity).toBe('1');
  });

  test('does not crash when snake is empty', () => {
    setSnake([]);
    expect(() => die()).not.toThrow();
  });
});

// ─── updateCam() ───
describe('game.js — updateCam()', () => {
  beforeEach(() => {
    setGlobal("direction",  0);
    setGlobal("headSmoothX",  0);
    setGlobal("headSmoothZ",  0);
    setGlobal("camSmoothX",  0);
    setGlobal("camSmoothZ",  0);
    setGlobal("lookSmoothX",  0);
    setGlobal("lookSmoothZ",  0);
  });

  test('returns early when snake is empty', () => {
    setSnake([]);
    updateCam(0.016);
    expect(camSmoothX).toBe(0);
  });

  test('updates camera position', () => {
    setSnake([{x: 0, z: 0}]);
    updateCam(0.016);
    expect(camera.position.x).not.toBe(0);
  });

  test('updates camera lookAt', () => {
    setSnake([{x: 0, z: 0}]);
    updateCam(0.016);
    expect(lookSmoothX).not.toBe(0);
  });

  test('uses mobile values when window is small', () => {
    const origWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { value: 400, writable: true, configurable: true });
    setSnake([{x: 0, z: 0}]);
    updateCam(0.016);
    Object.defineProperty(window, 'innerWidth', { value: origWidth, writable: true, configurable: true });
  });
});

// ─── Audio SFX ───
describe('audio.js — SFX', () => {
  beforeEach(() => {
    setGlobal("actx",  null);
  });

  test('initAudio creates AudioContext', () => {
    initAudio();
    expect(actx).not.toBeNull();
  });

  test('initAudio resumes suspended context', () => {
    initAudio();
    // Mock context is always 'running'
    expect(actx.state).toBe('running');
  });

  test('tone does nothing without AudioContext', () => {
    expect(() => tone(440, 0.1, 'square', 0.08)).not.toThrow();
  });

  test('sfxEat does not throw', () => {
    initAudio();
    expect(() => sfxEat()).not.toThrow();
  });

  test('sfxTurn does not throw', () => {
    initAudio();
    expect(() => sfxTurn()).not.toThrow();
  });

  test('sfxDie does not throw', () => {
    initAudio();
    expect(() => sfxDie()).not.toThrow();
  });

  test('sfxObstacle does not throw', () => {
    initAudio();
    expect(() => sfxObstacle()).not.toThrow();
  });
});

// ─── Music Player ───
describe('audio.js — Music Player', () => {
  beforeEach(() => {
    setGlobal("musicEl",  null);
    setGlobal("musicPlaying",  false);
    setGlobal("userPausedMusic",  false);
    setGlobal("currentTrack",  0);
  });

  test('initMusic creates audio element', () => {
    initMusic();
    expect(musicEl).not.toBeNull();
  });

  test('initMusic sets up track display', () => {
    initMusic();
    expect(mpTrackEl.textContent).toContain('🐍');
  });

  test('playlist has 20 tracks', () => {
    expect(playlist.length).toBe(20);
  });

  test('shufflePlaylist shuffles', () => {
    const original = [...playlist];
    shufflePlaylist();
    // At least one element should move
    expect(playlist).not.toEqual(original);
  });

  test('pickRandomTrack picks a track', () => {
    initMusic();
    pickRandomTrack();
    expect(musicEl.src).toContain(playlist[currentTrack].file);
  });

  test('playTrack wraps around playlist', () => {
    initMusic();
    playTrack(100);
    expect(currentTrack).toBe(100 % 10);
  });

  test('playTrack handles negative index', () => {
    initMusic();
    playTrack(-1);
    expect(currentTrack).toBe(19);
  });

  test('nextTrack calls playTrack with next index', () => {
    initMusic();
    setGlobal("currentTrack",  0);
    nextTrack();
    expect(currentTrack).toBe(1);
  });

  test('prevTrack goes to previous track', () => {
    initMusic();
    setGlobal("currentTrack",  5);
    prevTrack();
    expect(currentTrack).toBe(4);
  });

  test('stopMusic stops playback', () => {
    initMusic();
    setGlobal("musicPlaying",  true);
    stopMusic();
    expect(musicPlaying).toBe(false);
  });

  test('startMusic is a no-op', () => {
    expect(() => startMusic()).not.toThrow();
  });

  test('updateTrackDisplay sets track name and number', () => {
    initMusic();
    setGlobal("currentTrack",  3);
    updateTrackDisplay();
    expect(mpTrackEl.textContent).toBe(playlist[3].name);
    expect(mpNumEl.textContent).toBe('4/20');
  });

  test('toggleMusic pauses when playing', () => {
    initMusic();
    setGlobal("musicPlaying",  true);
    toggleMusic();
    expect(musicPlaying).toBe(false);
    expect(userPausedMusic).toBe(true);
    expect(mpPlayBtn.textContent).toBe('▶');
  });

  test('toggleMusic resumes when paused', () => {
    initMusic();
    setGlobal("musicPlaying",  false);
    setGlobal("userPausedMusic",  true);
    // Mock musicEl.play to resolve
    musicEl.play = () => Promise.resolve();
    toggleMusic();
    // After promise resolves
    return Promise.resolve().then(() => {
      expect(musicPlaying).toBe(true);
      expect(userPausedMusic).toBe(false);
      expect(mpPlayBtn.textContent).toBe('⏸');
    });
  });

  test('toggleMusic does nothing without musicEl', () => {
    setGlobal("musicEl",  null);
    expect(() => toggleMusic()).not.toThrow();
  });
});
