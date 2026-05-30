// ─── UI: Game Configuration Selectors ───
// ─── AI MODE ───

var uiState = {
  selectedColor: 'green',
  selectedMode: 'solo',
  selectedDifficulty: 'medium',
  selectedSizeMod: 0
};

// ─── Build color selector chips ───
function buildColorSelector(container) {
  var wrapper = document.createElement('div');
  wrapper.className = 'selector-row';
  wrapper.innerHTML = '<span class="selector-label">Color:</span>';

  SNAKE_COLOR_NAMES.forEach(function(colorName) {
    var chip = document.createElement('button');
    chip.className = 'color-chip' + (colorName === uiState.selectedColor ? ' selected' : '');
    chip.dataset.color = colorName;
    chip.innerHTML = '<span class="color-dot" style="background:' + SNAKE_COLORS[colorName] + '"></span>';
    chip.addEventListener('click', function() {
      wrapper.querySelectorAll('.color-chip').forEach(function(c) { c.classList.remove('selected'); });
      chip.classList.add('selected');
      uiState.selectedColor = colorName;
      updateHighScoreDisplay();
    });
    wrapper.appendChild(chip);
  });

  container.appendChild(wrapper);
}

// ─── Build mode selector chips ───
function buildModeSelector(container) {
  var wrapper = document.createElement('div');
  wrapper.className = 'selector-row';
  wrapper.innerHTML = '<span class="selector-label">Modo:</span>';

  var modeLabels = { solo: 'Solo', vs2: 'vs 2', vs3: 'vs 3', vs4: 'vs 4' };
  GAME_MODES.forEach(function(mode) {
    var chip = document.createElement('button');
    chip.className = 'mode-chip' + (mode === uiState.selectedMode ? ' selected' : '');
    chip.dataset.mode = mode;
    chip.textContent = modeLabels[mode];
    chip.addEventListener('click', function() {
      wrapper.querySelectorAll('.mode-chip').forEach(function(c) { c.classList.remove('selected'); });
      chip.classList.add('selected');
      uiState.selectedMode = mode;
      updateDifficultyVisibility();
      updateSizeDisplay();
      updateHighScoreDisplay();
    });
    wrapper.appendChild(chip);
  });

  container.appendChild(wrapper);
}

// ─── Build difficulty selector chips ───
function buildDifficultySelector(container) {
  var wrapper = document.createElement('div');
  wrapper.className = 'selector-row difficulty-row';
  wrapper.innerHTML = '<span class="selector-label">Dificultad:</span>';

  var diffLabels = { easy: 'Fácil', medium: 'Medio', hard: 'Difícil' };
  DIFFICULTIES.forEach(function(diff) {
    var chip = document.createElement('button');
    chip.className = 'diff-chip' + (diff === uiState.selectedDifficulty ? ' selected' : '');
    chip.dataset.difficulty = diff;
    chip.textContent = diffLabels[diff];
    chip.addEventListener('click', function() {
      wrapper.querySelectorAll('.diff-chip').forEach(function(c) { c.classList.remove('selected'); });
      chip.classList.add('selected');
      uiState.selectedDifficulty = diff;
      updateHighScoreDisplay();
    });
    wrapper.appendChild(chip);
  });

  container.appendChild(wrapper);
}

// ─── Build size selector (slider) ───
function buildSizeSelector(container) {
  var wrapper = document.createElement('div');
  wrapper.className = 'selector-row size-row';
  wrapper.innerHTML = '<span class="selector-label">Tamaño:</span>';

  var sliderContainer = document.createElement('div');
  sliderContainer.className = 'size-slider-container';

  var sizeLabel = document.createElement('span');
  sizeLabel.className = 'size-label';
  sliderContainer.appendChild(sizeLabel);

  var slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '-50';
  slider.max = '50';
  slider.step = '5';
  slider.value = '0';
  slider.className = 'size-slider';
  slider.addEventListener('input', function() {
    uiState.selectedSizeMod = parseInt(slider.value);
    updateSizeDisplay();
    updateHighScoreDisplay();
  });
  sliderContainer.appendChild(slider);

  wrapper.appendChild(sliderContainer);
  container.appendChild(wrapper);

  updateSizeDisplay();
}

// ─── Update size display label ───
function updateSizeDisplay() {
  var sizeLabel = document.querySelector('.size-label');
  if (!sizeLabel) return;

  var actualSize = resolveGridSize(uiState.selectedMode, uiState.selectedSizeMod);
  var modText = uiState.selectedSizeMod === 0 ? '' : (uiState.selectedSizeMod > 0 ? '+' + uiState.selectedSizeMod + '%' : uiState.selectedSizeMod + '%');

  sizeLabel.textContent = actualSize + ' × ' + actualSize + (modText ? ' (' + modText + ')' : '');
}

// ─── Update difficulty visibility (only in vs modes) ───
function updateDifficultyVisibility() {
  var diffRow = document.querySelector('.difficulty-row');
  if (!diffRow) return;
  diffRow.style.display = (uiState.selectedMode === 'solo') ? 'none' : 'flex';
}

// ─── Update high score display ───
function updateHighScoreDisplay() {
  var config = getGameConfig();
  var key = getHighScoreKey(config.mode, config.difficulty, config.gridSize);
  var hs = parseInt(localStorage.getItem(key) || '0');
  highScore = hs;
  if (highscoreEl) {
    highscoreEl.textContent = hs;
  }
}

// ─── Get current game config from UI state ───
function getGameConfig() {
  return {
    mode: uiState.selectedMode,
    difficulty: uiState.selectedDifficulty,
    color: uiState.selectedColor,
    gridSize: resolveGridSize(uiState.selectedMode, uiState.selectedSizeMod),
    gridSizeModifier: uiState.selectedSizeMod
  };
}

// ─── Initialize UI selectors ───
function initUISelectors() {
  var overlay = document.getElementById('overlay');
  if (!overlay) return;

  // Create selectors container
  var selectorsDiv = document.createElement('div');
  selectorsDiv.id = 'selectors';

  buildColorSelector(selectorsDiv);
  buildModeSelector(selectorsDiv);
  buildDifficultySelector(selectorsDiv);
  buildSizeSelector(selectorsDiv);

  // Insert selectors before the start button
  var startBtn = document.getElementById('start-btn');
  if (startBtn) {
    overlay.insertBefore(selectorsDiv, startBtn);
  }

  // Initial visibility state
  updateDifficultyVisibility();
  updateHighScoreDisplay();
}

// ─── Module exports (for testing — ignored in browser) ───
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    get uiState() { return uiState; },
    getGameConfig: getGameConfig,
    buildColorSelector: buildColorSelector,
    buildModeSelector: buildModeSelector,
    buildDifficultySelector: buildDifficultySelector,
    buildSizeSelector: buildSizeSelector,
    updateDifficultyVisibility: updateDifficultyVisibility,
    updateSizeDisplay: updateSizeDisplay,
    updateHighScoreDisplay: updateHighScoreDisplay,
    initUISelectors: initUISelectors
  };
}
