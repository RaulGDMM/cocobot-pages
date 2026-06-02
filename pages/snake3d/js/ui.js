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

  var group = document.createElement('div');
  group.className = 'chip-group';

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
    group.appendChild(chip);
  });

  wrapper.appendChild(group);
  container.appendChild(wrapper);
}

// ─── Build mode selector chips ───
function buildModeSelector(container) {
  var wrapper = document.createElement('div');
  wrapper.className = 'selector-row';
  wrapper.innerHTML = '<span class="selector-label">Modo:</span>';

  var modeLabels = { solo: 'Solo', vs2: 'vs 2', vs3: 'vs 3', vs4: 'vs 4', vs5: 'vs 5', vs6: 'vs 6', vs7: 'vs 7', vs8: 'vs 8' };
  var group = document.createElement('div');
  group.className = 'chip-group';
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
    group.appendChild(chip);
  });

  wrapper.appendChild(group);
  container.appendChild(wrapper);
}

// ─── Build difficulty selector chips ───
function buildDifficultySelector(container) {
  var wrapper = document.createElement('div');
  wrapper.className = 'selector-row difficulty-row';
  wrapper.innerHTML = '<span class="selector-label">Dificultad:</span>';

  var diffLabels = { easy: 'Fácil', medium: 'Medio', hard: 'Difícil' };
  var group = document.createElement('div');
  group.className = 'chip-group';
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
    group.appendChild(chip);
  });

  wrapper.appendChild(group);
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
  diffRow.style.display = (uiState.selectedMode === 'solo') ? 'none' : 'grid';
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

  // ─── Score box: click to toggle leaderboard (event delegation on document) ───
  // Using document-level delegation so it survives innerHTML replacements.
  document.addEventListener('click', function(e) {
    var target = e.target;
    var scoreBox = document.getElementById('score-box');
    var lb = document.getElementById('leaderboard-dropdown');
    if (!scoreBox || !lb) return;

    if (scoreBox.contains(target)) {
      e.stopPropagation();
      lb.classList.toggle('visible');
    } else if (lb.classList.contains('visible') && !lb.contains(target)) {
      lb.classList.remove('visible');
    }
  });

  // ─── Prevent touch on score-box from reaching touch zones ───
  // On mobile, tapping the score-box would trigger tz-left/tz-right
  // and turn the snake. Stop propagation on touchstart.
  var sb = document.getElementById('score-box');
  if (sb) {
    sb.addEventListener('touchstart', function(e) {
      e.stopPropagation();
    }, {passive: true});
  }

  // ─── Same for leaderboard dropdown when visible ───
  var lb = document.getElementById('leaderboard-dropdown');
  if (lb) {
    lb.addEventListener('touchstart', function(e) {
      e.stopPropagation();
    }, {passive: true});
  }
}

// ─── Update leaderboard dropdown ───
function updateLeaderboard() {
  var lb = document.getElementById('leaderboard-dropdown');
  if (!lb) return;

  // ─── Solo mode: hide leaderboard, show plain score ───
  if (!aiSnakes || aiSnakes.length === 0) {
    lb.classList.remove('visible');
    lb.innerHTML = '';
    if (scoreEl && scoreBoxEl) {
      scoreBoxEl.innerHTML = '🍎 <span id="score">' + score + '</span>';
    }
    return;
  }

  var rankings = calcRankings();
  if (!rankings || rankings.length === 0) return;

  var colorHex = {green: '#44ff44', red: '#ff4444', blue: '#4488ff', yellow: '#ffdd44', cyan: '#44ffff', purple: '#cc44ff', orange: '#ff8844', salmon: '#ff8888'};

  var html = '<div class="lb-title">📊 Clasificación</div>';
  for (var i = 0; i < rankings.length; i++) {
    var r = rankings[i];
    var isPlayer = r.isPlayer ? ' player' : '';
    var isDead = !r.alive ? ' lb-dead' : '';
    var dotColor = colorHex[r.color] || '#888888';
    var rankEmoji = r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : r.rank;
    var statusEmoji = r.alive ? '🟢' : '💀';
    html += '<div class="lb-row' + isPlayer + isDead + '">';
    html += '<span class="lb-rank">' + rankEmoji + '</span>';
    html += '<span class="lb-dot" style="background:' + dotColor + '"></span>';
    html += '<span class="lb-name">' + r.name + ' ' + statusEmoji + '</span>';
    html += '<span class="lb-score">' + r.score + '</span>';
    html += '</div>';
  }
  lb.innerHTML = html;

  // Update score box to show rank + expand arrow
  var playerRank = getPlayerRank();
  if (scoreEl && scoreBoxEl) {
    var total = rankings.length;
    var rankStr = playerRank === 1 ? '🥇' : playerRank === 2 ? '🥈' : playerRank === 3 ? '🥉' : playerRank + 'º';
    scoreBoxEl.innerHTML = '🍎 <span id="score">' + score + '</span> <span style="color:#ffaa00;font-size:.8em">(' + rankStr + '/' + total + ')</span> <span class="lb-arrow" style="color:#556677;font-size:.7em">▼</span>';
  }
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
