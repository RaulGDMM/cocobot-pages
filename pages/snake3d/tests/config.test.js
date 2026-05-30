// ─── Tests: config.js (baseline) ───
// Tests for existing config constants and utility functions.

describe('config.js', () => {
  describe('grid and movement constants', () => {
    test('GRID_SIZE is 22', () => {
      expect(GRID_SIZE).toBe(22);
    });

    test('MOVE_INTERVAL is 200ms', () => {
      expect(MOVE_INTERVAL).toBe(200);
    });

    test('TURN_ANGLE is 90 degrees (π/2)', () => {
      expect(TURN_ANGLE).toBeCloseTo(Math.PI / 2);
    });

    test('half is GRID_SIZE / 2', () => {
      expect(half).toBe(GRID_SIZE / 2);
      expect(half).toBe(11);
    });
  });

  describe('apple constants', () => {
    test('NUM_APPLES is 3', () => {
      expect(NUM_APPLES).toBe(3);
    });
  });

  describe('obstacle constants', () => {
    test('OBSTACLE_SPAWN_EVERY is 3', () => {
      expect(OBSTACLE_SPAWN_EVERY).toBe(3);
    });

    test('OBSTACLE_MIN_DIST_SNAKE is 6', () => {
      expect(OBSTACLE_MIN_DIST_SNAKE).toBe(6);
    });

    test('OBSTACLE_MIN_DIST_EACH is 3', () => {
      expect(OBSTACLE_MIN_DIST_EACH).toBe(3);
    });

    test('OBSTACLE_MIN_DIST_APPLE is 3', () => {
      expect(OBSTACLE_MIN_DIST_APPLE).toBe(3);
    });

    test('MAX_OBSTACLES is 30', () => {
      expect(MAX_OBSTACLES).toBe(30);
    });
  });

  describe('logging functions', () => {
    test('log is a function', () => {
      expect(typeof log).toBe('function');
    });

    test('log appends to logs array', () => {
      const before = logs.length;
      log('test message');
      expect(logs.length).toBe(before + 1);
      expect(logs[logs.length - 1]).toContain('test message');
    });

    test('log updates debug element text', () => {
      log('debug check');
      expect(document.getElementById('debug').textContent).toContain('debug check');
    });

    test('log caps at 80 entries', () => {
      // Fill up to 80
      for (let i = 0; i < 100; i++) {
        log('fill ' + i);
      }
      expect(logs.length).toBe(80);
      // Oldest entries should have been shifted out
      expect(logs[0]).toContain('fill 20');
    });

    test('showErr is a function', () => {
      expect(typeof showErr).toBe('function');
    });

    test('showErr displays message and shows err-box', () => {
      const errBox = document.getElementById('err-box');
      showErr('test error');
      expect(errBox.textContent).toBe('test error');
      expect(errBox.style.display).toBe('block');
    });

    test('showErr hides err-box when message is empty', () => {
      const errBox = document.getElementById('err-box');
      showErr('temp');
      showErr('');
      expect(errBox.textContent).toBe('');
      expect(errBox.style.display).toBe('none');
    });

    test('showErr hides err-box when message is falsy', () => {
      const errBox = document.getElementById('err-box');
      showErr('temp');
      showErr(null);
      expect(errBox.style.display).toBe('none');
    });
  });

  describe('error handler', () => {
    test('window.onerror is configured', () => {
      expect(typeof window.onerror).toBe('function');
    });
  });
});
