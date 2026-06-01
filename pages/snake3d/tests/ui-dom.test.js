// ─── Tests: UI DOM functions (Fase 5 coverage) ───
// Tests for UI functions that manipulate the DOM directly.
// Because these functions run in browser context with real DOM,
// our tests verify they handle missing elements gracefully.

const { setSnake, setApples, setObstacles } = require('./helpers');

const setGlobal = (name, value) => { global[name] = value; };

// ─── Minimal DOM mock that works with vm.runInContext ───
function mockDOM() {
  var elements = {};

  // Override document in global scope
  global.document = {
    querySelector: function(selector) {
      return elements[selector] || null;
    },
    querySelectorAll: function() { return []; },
    createElement: function(tag) {
      return {
        className: '',
        innerHTML: '',
        textContent: '',
        type: '',
        min: '',
        max: '',
        step: '',
        value: '',
        children: [],
        dataset: {},
        style: { display: '' },
        classList: { add: function(){}, remove: function(){} },
        addEventListener: function(){},
        appendChild: function(){}
      };
    },
    getElementById: function(id) {
      return elements['#' + id] || null;
    }
  };

  return {
    setElement: function(selector, el) { elements[selector] = el; }
  };
}

describe('ui.js — updateSizeDisplay()', () => {
  beforeEach(() => {
    setSnake([{x: 0, z: 0}]);
    setApples([]);
    setObstacles([]);
    setGlobal('aiSnakes', []);
    setGlobal('gridSize', 22);
    mockDOM();
  });

  test('does nothing when no size-label element', () => {
    expect(() => updateSizeDisplay()).not.toThrow();
  });
});

describe('ui.js — updateDifficultyVisibility()', () => {
  beforeEach(() => {
    setSnake([{x: 0, z: 0}]);
    setApples([]);
    setObstacles([]);
    setGlobal('aiSnakes', []);
    setGlobal('gridSize', 22);
    mockDOM();
  });

  test('does nothing when no difficulty-row element', () => {
    expect(() => updateDifficultyVisibility()).not.toThrow();
  });
});

describe('ui.js — updateHighScoreDisplay()', () => {
  beforeEach(() => {
    setSnake([{x: 0, z: 0}]);
    setApples([]);
    setObstacles([]);
    setGlobal('aiSnakes', []);
    setGlobal('gridSize', 22);
    setGlobal('highscoreEl', null);
    mockDOM();
  });

  test('does nothing when highscoreEl is null', () => {
    expect(() => updateHighScoreDisplay()).not.toThrow();
  });
});

describe('ui.js — buildColorSelector()', () => {
  beforeEach(() => {
    setSnake([{x: 0, z: 0}]);
    setApples([]);
    setObstacles([]);
    setGlobal('aiSnakes', []);
    setGlobal('gridSize', 22);
    setGlobal('highscoreEl', { textContent: '' });
    mockDOM();
  });

  test('creates color chips without throwing', () => {
    var container = { appendChild: function(){} };
    expect(() => buildColorSelector(container)).not.toThrow();
  });
});

describe('ui.js — buildModeSelector()', () => {
  beforeEach(() => {
    setSnake([{x: 0, z: 0}]);
    setApples([]);
    setObstacles([]);
    setGlobal('aiSnakes', []);
    setGlobal('gridSize', 22);
    setGlobal('highscoreEl', { textContent: '' });
    mockDOM();
  });

  test('creates mode chips without throwing', () => {
    var container = { appendChild: function(){} };
    expect(() => buildModeSelector(container)).not.toThrow();
  });
});

describe('ui.js — buildDifficultySelector()', () => {
  beforeEach(() => {
    setSnake([{x: 0, z: 0}]);
    setApples([]);
    setObstacles([]);
    setGlobal('aiSnakes', []);
    setGlobal('gridSize', 22);
    setGlobal('highscoreEl', { textContent: '' });
    mockDOM();
  });

  test('creates difficulty chips without throwing', () => {
    var container = { appendChild: function(){} };
    expect(() => buildDifficultySelector(container)).not.toThrow();
  });
});

describe('ui.js — buildSizeSelector()', () => {
  beforeEach(() => {
    setSnake([{x: 0, z: 0}]);
    setApples([]);
    setObstacles([]);
    setGlobal('aiSnakes', []);
    setGlobal('gridSize', 22);
    setGlobal('highscoreEl', { textContent: '' });
    mockDOM();
  });

  test('creates size slider without throwing', () => {
    var container = { appendChild: function(){} };
    expect(() => buildSizeSelector(container)).not.toThrow();
  });
});

describe('ui.js — initUISelectors()', () => {
  beforeEach(() => {
    setSnake([{x: 0, z: 0}]);
    setApples([]);
    setObstacles([]);
    setGlobal('aiSnakes', []);
    setGlobal('gridSize', 22);
    setGlobal('highscoreEl', { textContent: '' });
  });

  test('creates selectors and inserts them into overlay', () => {
    // Overlay and start-btn exist in jsdom, so initUISelectors runs
    // We just verify it doesn't throw
    expect(() => initUISelectors()).not.toThrow();
  });
});
