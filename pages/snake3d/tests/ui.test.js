// ─── Tests: ui.js (Fase 2) ───
// Tests for UI configuration functions.

describe('ui.js', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset UI state
    uiState.selectedColor = 'green';
    uiState.selectedMode = 'solo';
    uiState.selectedDifficulty = 'medium';
    uiState.selectedSizeMod = 0;
  });

  describe('getGameConfig()', () => {
    test('returns solo mode with defaults', () => {
      var config = getGameConfig();
      expect(config.mode).toBe('solo');
      expect(config.difficulty).toBe('medium');
      expect(config.color).toBe('green');
      expect(config.gridSize).toBe(22);
      expect(config.gridSizeModifier).toBe(0);
    });

    test('returns correct gridSize for vs2', () => {
      uiState.selectedMode = 'vs2';
      var config = getGameConfig();
      expect(config.mode).toBe('vs2');
      expect(config.gridSize).toBe(28);
    });

    test('returns correct gridSize for vs3 (even)', () => {
      uiState.selectedMode = 'vs3';
      var config = getGameConfig();
      expect(config.gridSize).toBe(34);
    });

    test('returns correct gridSize for vs4 (even)', () => {
      uiState.selectedMode = 'vs4';
      var config = getGameConfig();
      expect(config.gridSize).toBe(40);
    });

    test('applies size modifier +50% (even)', () => {
      uiState.selectedMode = 'solo';
      uiState.selectedSizeMod = 50;
      var config = getGameConfig();
      expect(config.gridSize).toBe(34);
      expect(config.gridSizeModifier).toBe(50);
    });

    test('applies size modifier -50%', () => {
      uiState.selectedMode = 'solo';
      uiState.selectedSizeMod = -50;
      var config = getGameConfig();
      expect(config.gridSize).toBe(16);
      expect(config.gridSizeModifier).toBe(-50);
    });

    test('respects color selection', () => {
      uiState.selectedColor = 'red';
      var config = getGameConfig();
      expect(config.color).toBe('red');
    });

    test('respects difficulty selection', () => {
      uiState.selectedMode = 'vs3';
      uiState.selectedDifficulty = 'hard';
      var config = getGameConfig();
      expect(config.difficulty).toBe('hard');
    });

    test('vs4 +50% clamps to 50', () => {
      uiState.selectedMode = 'vs4';
      uiState.selectedSizeMod = 50;
      var config = getGameConfig();
      expect(config.gridSize).toBe(50);
    });

    test('all modes with -50% respect GRID_MIN', () => {
      GAME_MODES.forEach(function(mode) {
        uiState.selectedMode = mode;
        uiState.selectedSizeMod = -50;
        var config = getGameConfig();
        expect(config.gridSize).toBeGreaterThanOrEqual(GRID_MIN);
      });
    });
  });

  describe('uiState defaults', () => {
    test('uiState has correct initial values', () => {
      expect(uiState.selectedColor).toBe('green');
      expect(uiState.selectedMode).toBe('solo');
      expect(uiState.selectedDifficulty).toBe('medium');
      expect(uiState.selectedSizeMod).toBe(0);
    });

    test('uiState is mutable', () => {
      uiState.selectedColor = 'blue';
      expect(uiState.selectedColor).toBe('blue');
      uiState.selectedColor = 'green';
    });
  });

  describe('getGameConfig() edge cases', () => {
    test('mode change updates gridSize automatically (even)', () => {
      uiState.selectedMode = 'solo';
      expect(getGameConfig().gridSize).toBe(22);

      uiState.selectedMode = 'vs4';
      expect(getGameConfig().gridSize).toBe(40);
    });

    test('size modifier affects all modes (even)', () => {
      uiState.selectedSizeMod = 50;
      uiState.selectedMode = 'solo';
      expect(getGameConfig().gridSize).toBe(34);

      uiState.selectedMode = 'vs2';
      expect(getGameConfig().gridSize).toBe(42);

      uiState.selectedMode = 'vs3';
      expect(getGameConfig().gridSize).toBe(50);
    });
  });
});
