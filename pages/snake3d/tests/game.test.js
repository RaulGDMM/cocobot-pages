// ─── Tests: game.js — step(), die(), colisiones ───

const { setSnake, setApples, setObstacles } = require('./helpers');

const setGlobal = (name, value) => { global[name] = value; };

// ─── step() — movimiento y colisiones ───
describe('game.js — step()', () => {
  beforeEach(() => {
    setSnake([{x: -5, z: 0}, {x: -6, z: 0}, {x: -7, z: 0}, {x: -8, z: 0}]);
    setApples([{x: 3, z: 0}]);
    setObstacles([]);
    setGlobal('direction', 0);
    setGlobal('gridSize', 22);
    setGlobal('half', 11);
    setGlobal('gameOver', false);
    setGlobal('score', 0);
    setGlobal('aiSnakes', []);
    setGlobal('corpses', []);
    setGlobal('appleMeshes', []);
  });

  test('serpiente avanza en dirección correcta', () => {
    var headX = snake[0].x;
    step();
    expect(snake[0].x).toBe(headX + 1); // direction 0 = +X
  });

  test('serpiente mantiene longitud sin comer', () => {
    var len = snake.length;
    step();
    expect(snake.length).toBe(len);
  });

  test('serpiente crece al comer manzana', () => {
    // Posicionar serpiente para comer manzana en (3,0)
    setSnake([{x: 2, z: 0}, {x: 1, z: 0}, {x: 0, z: 0}, {x: -1, z: 0}]);
    setGlobal('direction', 0);
    var len = snake.length;
    step();
    expect(snake.length).toBe(len + 1);
    expect(score).toBe(1);
  });

  test('no hace nada si gameOver=true', () => {
    setGlobal('gameOver', true);
    var len = snake.length;
    step();
    expect(snake.length).toBe(len); // unchanged
  });
});

// ─── die() — causa de muerte ───
describe('game.js — die(cause)', () => {
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
    setGlobal('corpses', []);
  });

  test('die("wall") muestra mensaje de pared', () => {
    die('wall');
    expect(gameOver).toBe(true);
    expect(finalScoreEl.textContent).toContain('pared');
  });

  test('die("self") muestra mensaje de auto-colisión', () => {
    die('self');
    expect(gameOver).toBe(true);
    expect(finalScoreEl.textContent).toContain('mordido');
  });

  test('die("obstacle") muestra mensaje de obstáculo', () => {
    die('obstacle');
    expect(gameOver).toBe(true);
    expect(finalScoreEl.textContent).toContain('obstáculo');
  });

  test('die("corpse") muestra mensaje de cadáver', () => {
    die('corpse');
    expect(gameOver).toBe(true);
    expect(finalScoreEl.textContent).toContain('cadáver');
  });

  test('die("ai") muestra mensaje de serpiente enemiga', () => {
    die('ai');
    expect(gameOver).toBe(true);
    expect(finalScoreEl.textContent).toContain('enemiga');
  });

  test('die() sin causa muestra "Game Over"', () => {
    die();
    expect(gameOver).toBe(true);
    expect(finalScoreEl.textContent).toContain('Game Over');
  });

  test('die() actualiza high score si se supera', () => {
    setGlobal('score', 10);
    setGlobal('highScore', 5);
    die('wall');
    expect(highScore).toBe(10);
  });

  test('die() no cambia high score si no se supera', () => {
    setGlobal('score', 2);
    setGlobal('highScore', 5);
    die('wall');
    expect(highScore).toBe(5);
  });

  test('die() incrementa contador de partidas', () => {
    setGlobal('totalGames', 10);
    die('wall');
    expect(totalGames).toBe(11);
  });

  test('die() muestra puntuación en finalScoreEl', () => {
    setGlobal('score', 7);
    die('wall');
    expect(finalScoreEl.textContent).toContain('7');
  });

  test('die() muestra puntuación con emoji 🍎', () => {
    setGlobal('score', 3);
    die('self');
    expect(finalScoreEl.textContent).toContain('🍎');
  });

  test('die() guarda high score en key específica del modo', () => {
    setGlobal('score', 10);
    setGlobal('highScore', 5);
    setGlobal('gameMode', 'vs2');
    setGlobal('difficulty', 'hard');
    setGlobal('gridSize', 28);
    die('wall');
    var key = getHighScoreKey('vs2', 'hard', 28);
    expect(localStorage.getItem(key)).toBe('10');
  });
});

// ─── step() — colisiones con paredes ───
describe('game.js — step() wall collision', () => {
  beforeEach(() => {
    setSnake([{x: 10, z: 0}, {x: 9, z: 0}]);
    setApples([]);
    setObstacles([]);
    setGlobal('direction', 0);
    setGlobal('gridSize', 22);
    setGlobal('half', 11);
    setGlobal('gameOver', false);
    setGlobal('score', 0);
    setGlobal('aiSnakes', []);
    setGlobal('corpses', []);
    setGlobal('appleMeshes', []);
  });

  test('chocar contra pared derecha mata', () => {
    setSnake([{x: 10, z: 0}, {x: 9, z: 0}]);
    setGlobal('direction', 0); // facing +X, wall at x=11
    step();
    expect(gameOver).toBe(true);
  });

  test('chocar contra pared izquierda mata', () => {
    setSnake([{x: -11, z: 0}, {x: -10, z: 0}]);
    setGlobal('direction', Math.PI); // facing -X, wall at x=-12
    step();
    expect(gameOver).toBe(true);
  });

  test('chocar contra pared superior mata', () => {
    setSnake([{x: 0, z: -11}, {x: 0, z: -10}]);
    setGlobal('direction', -Math.PI / 2); // facing -Z, wall at z=-12
    step();
    expect(gameOver).toBe(true);
  });

  test('chocar contra pared inferior mata', () => {
    setSnake([{x: 0, z: 10}, {x: 0, z: 9}]);
    setGlobal('direction', Math.PI / 2); // facing +Z
    step();
    expect(gameOver).toBe(true);
  });
});

// ─── step() — colisión con cuerpo propio ───
describe('game.js — step() self collision', () => {
  beforeEach(() => {
    setApples([]);
    setObstacles([]);
    setGlobal('direction', 0);
    setGlobal('gridSize', 22);
    setGlobal('half', 11);
    setGlobal('gameOver', false);
    setGlobal('score', 0);
    setGlobal('aiSnakes', []);
    setGlobal('corpses', []);
    setGlobal('appleMeshes', []);
  });

  test('chocar contra cuerpo propio mata', () => {
    // U-shape: head at (0,0), body wraps around
    setSnake([
      {x: 0, z: 0},
      {x: 0, z: 1},
      {x: 1, z: 1},
      {x: 1, z: 0} // body at (1,0) — in front of head
    ]);
    setGlobal('direction', 0);
    step();
    expect(gameOver).toBe(true);
  });
});

// ─── step() — colisión con obstáculos ───
describe('game.js — step() obstacle collision', () => {
  beforeEach(() => {
    setSnake([{x: 0, z: 0}, {x: -1, z: 0}]);
    setApples([]);
    setGlobal('direction', 0);
    setGlobal('gridSize', 22);
    setGlobal('half', 11);
    setGlobal('gameOver', false);
    setGlobal('score', 0);
    setGlobal('aiSnakes', []);
    setGlobal('corpses', []);
    setGlobal('appleMeshes', []);
  });

  test('chocar contra obstáculo mata', () => {
    setObstacles([{x: 1, z: 0}]);
    step();
    expect(gameOver).toBe(true);
  });

  test('evita obstáculo si no está en el camino', () => {
    setObstacles([{x: 5, z: 5}]);
    step();
    expect(gameOver).toBe(false);
    expect(snake[0].x).toBe(1);
  });
});

// ─── step() — colisión con IA ───
describe('game.js — step() AI body collision', () => {
  beforeEach(() => {
    setSnake([{x: 0, z: 0}, {x: -1, z: 0}]);
    setApples([]);
    setObstacles([]);
    setGlobal('direction', 0);
    setGlobal('gridSize', 22);
    setGlobal('half', 11);
    setGlobal('gameOver', false);
    setGlobal('score', 0);
    setGlobal('corpses', []);
    setGlobal('appleMeshes', []);
  });

  test('chocar contra cuerpo de IA mata al jugador', () => {
    setGlobal('aiSnakes', [{
      alive: true,
      snake: [{x: 1, z: 0}, {x: 2, z: 0}]
    }]);
    step();
    expect(gameOver).toBe(true);
  });

  test('no choca con IA muerta', () => {
    setGlobal('aiSnakes', [{
      alive: false,
      snake: [{x: 1, z: 0}, {x: 2, z: 0}]
    }]);
    step();
    expect(gameOver).toBe(false);
    expect(snake[0].x).toBe(1);
  });

  test('no choca con IA lejana', () => {
    setGlobal('aiSnakes', [{
      alive: true,
      snake: [{x: 10, z: 10}, {x: 11, z: 10}]
    }]);
    step();
    expect(gameOver).toBe(false);
  });
});

// ─── step() — colisión con cadáveres ───
describe('game.js — step() corpse collision', () => {
  beforeEach(() => {
    setSnake([{x: 0, z: 0}, {x: -1, z: 0}]);
    setApples([]);
    setObstacles([]);
    setGlobal('direction', 0);
    setGlobal('gridSize', 22);
    setGlobal('half', 11);
    setGlobal('gameOver', false);
    setGlobal('score', 0);
    setGlobal('aiSnakes', []);
    setGlobal('appleMeshes', []);
  });

  test('chocar contra cadáver mata', () => {
    setGlobal('corpses', [{x: 1, z: 0}, {x: 2, z: 0}]);
    step();
    expect(gameOver).toBe(true);
  });

  test('no choca con cadáver lejano', () => {
    setGlobal('corpses', [{x: 10, z: 10}]);
    step();
    expect(gameOver).toBe(false);
  });

  test('funciona con corpses undefined', () => {
    setGlobal('corpses', undefined);
    expect(() => step()).not.toThrow();
  });
});

// ─── turnL() / turnR() ───
describe('game.js — turnL() / turnR()', () => {
  beforeEach(() => {
    setGlobal('direction', 0);
    setGlobal('running', true);
    setGlobal('gameOver', false);
  });

  test('turnL cambia dirección a la izquierda', () => {
    turnL();
    expect(direction).toBeCloseTo(-Math.PI / 2);
  });

  test('turnR cambia dirección a la derecha', () => {
    turnR();
    expect(direction).toBeCloseTo(Math.PI / 2);
  });

  test('turnL no hace nada si gameOver', () => {
    setGlobal('gameOver', true);
    turnL();
    expect(direction).toBe(0);
  });

  test('turnR no hace nada si no running', () => {
    setGlobal('running', false);
    turnR();
    expect(direction).toBe(0);
  });
});
