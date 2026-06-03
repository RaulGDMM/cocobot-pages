// ─── GAME LOGIC ───
function initGame() {
  log('=== initGame() ===');

  // ─── AI MODE: rebuild board with dynamic grid size ───
  half = gridSize / 2;
  rebuildBoard(gridSize);

  // ─── GRID BOUNDARIES: initialize ───
  gridMinX = -half;
  gridMaxX = half;
  gridMinZ = -half;
   gridMaxZ = half;
   shrinkCountdowns = [];
      _shrinkFlashOn = false;
     // Clear shrink flash meshes from previous game
     if (_shrinkFlashGroup) {
       while (_shrinkFlashGroup.children.length) {
         var fc = _shrinkFlashGroup.children[0];
         _shrinkFlashGroup.remove(fc);
         if (fc.material) fc.material.dispose();
       }
       _shrinkFlashGroup = null;
     }
     _shrinkFlashGeo = null;

  // ─── Proportional scaling: update GRID_SIZE for dynamic grid ───
   GRID_SIZE = gridSize;
   NUM_APPLES = calcNumApples(GRID_SIZE);
   MAX_OBSTACLES = calcMaxObstacles(GRID_SIZE);
   OBSTACLE_SPAWN_EVERY = calcObstacleSpawnEvery(GRID_SIZE);
   log('Scaled: apples=' + NUM_APPLES + ', maxObs=' + MAX_OBSTACLES + ', spawnEvery=' + OBSTACLE_SPAWN_EVERY);

  // Clear old snake groups from sGroup
    while(sGroup.children.length) { var c = sGroup.children[0]; sGroup.remove(c); }

   snake=[]; direction=0; score=0; gameOver=false;
        obstacles=[]; apples=[]; corpses=[];
        if(typeof corpseSet !== 'undefined') corpseSet = {};
  scoreEl.textContent='0';
  snake.push({x:-5,z:0}); snake.push({x:-6,z:0});
  snake.push({x:-7,z:0}); snake.push({x:-8,z:0});
  log('Snake data: ' + snake.length + ' segments');
   playerGroupData = buildSnake(playerColor);
   log('buildSnake done: headM=' + (headM ? 'OK' : 'NULL') + ', bodyMs=' + bodyMs.length);
  buildObstacles(); buildApples();
  refreshObstacles();
  initApples();
  log('Apples: ' + apples.filter(Boolean).length + '/' + apples.length);
  refreshSnake();
  log('refreshSnake done: head at (' + (headM ? headM.position.x : 'NULL') + ',' + (headM ? headM.position.z : 'NULL') + ')');
  headSmoothX = gw(-5);
  headSmoothZ = gw(0);
  camSmoothX = gw(-5) - 5;
  camSmoothZ = gw(0);
  lookSmoothX = gw(-5) + 3;
  lookSmoothZ = gw(0);
  log('Snake: '+snake.length+' seg, dir=0, grid=' + gridSize + ', half=' + half);

   // ─── Store initial grid size for proportional shrinking ───
      _initialGridSize = gridSize;
     }

function turnL(){if(!running||gameOver)return;direction-=TURN_ANGLE;sfxTurn();}
function turnR(){if(!running||gameOver)return;direction+=TURN_ANGLE;sfxTurn();}

function step() {
  if(gameOver) return;
  var h=snake[0];
  var nx=h.x+Math.round(Math.cos(direction));
  var nz=h.z+Math.round(Math.sin(direction));
  if(nx<gridMinX||nx>=gridMaxX||nz<gridMinZ||nz>=gridMaxZ){log('Wall hit ('+nx+','+nz+')');die('wall');return;}
   if(snake.some(function(s){return s.x===nx&&s.z===nz;})){log('Self hit ('+nx+','+nz+')');die('self');return;}
   if(obstacles.some(function(o){return o.x===nx&&o.z===nz;})){log('Obstacle hit ('+nx+','+nz+')');die('obstacle');return;}
  // ─── AI MODE: collision with AI snake bodies ───
    if(aiSnakes) {
      for(var k = 0; k < aiSnakes.length; k++) {
        if(!aiSnakes[k].alive) continue;
        var aiBody = aiSnakes[k].snake;
        for(var j = 0; j < aiBody.length; j++) {
          if(aiBody[j].x === nx && aiBody[j].z === nz) {
            log('Hit AI#'+k+' body at ('+nx+','+nz+')');
            die('ai');
            return;
          }
        }
      }
    }
   // ─── CORPSE: collision with dead snake bodies — O(1) via corpseSet ───
     if(corpseSet && corpseSet[nx+','+nz]) {
       log('Hit corpse at ('+nx+','+nz+')');
       die('corpse');
       return;
     }
   snake.unshift({x:nx,z:nz});
  var ate = false;
  var appleIndexAtHead = (typeof getAppleIndexAt === 'function') ? getAppleIndexAt(nx, nz) : -1;
  if(appleIndexAtHead >= 0) {
        score++; scoreEl.textContent=score; ate=true;
        var eatenApple = apples[appleIndexAtHead];
        sfxEat(); burst(eatenApple.x, eatenApple.z, 0xff6644, 10);
          log('Eat apple at ('+eatenApple.x+','+eatenApple.z+') score='+score);
          var newA = (typeof replacementForEatenApple === 'function') ? replacementForEatenApple(eatenApple) : spawnOneApple();
          if (typeof replaceAppleAt === 'function') replaceAppleAt(appleIndexAtHead, newA);
          else { apples[appleIndexAtHead] = newA; if (typeof updateAppleSet === 'function') updateAppleSet(eatenApple, newA, appleIndexAtHead); appleDirty = true; }
           if(score % OBSTACLE_SPAWN_EVERY === 0) spawnObstacle();
           // Update leaderboard after score change
           if (typeof updateLeaderboard === 'function') updateLeaderboard();
    }
  if(!ate) snake.pop();
  refreshApples();
}

function die(cause) {
  log('GAME OVER score='+score+' cause='+(cause||'unknown'));
  gameOver=true; sfxDie();

  if(snake.length) burst(snake[0].x,snake[0].z,0xff0000,12);
  // ─── AI MODE: save high score per mode/difficulty/gridSize ───
  var hsKey = getHighScoreKey(gameMode, difficulty, gridSize);
  if(score>highScore){highScore=score;localStorage.setItem(hsKey,highScore);highscoreEl.textContent=highScore;}
  totalGames++;
  localStorage.setItem('snake3d_games', totalGames);
  gamesCountEl.textContent = totalGames;
  // Death cause message
  var causeMsg = '';
  if(cause === 'wall') causeMsg = 'Has chocado contra la pared';
  else if(cause === 'self') causeMsg = 'Te has mordido a ti mismo';
  else if(cause === 'obstacle') causeMsg = 'Has chocado contra un obstáculo';
  else if(cause === 'ai') causeMsg = 'Una serpiente enemiga te ha alcanzado';
  else if(cause === 'corpse') causeMsg = 'Has chocado contra un cadáver';
  else if(cause === 'shrink') causeMsg = '¡El tablero se redujo y te dejó fuera!';
  else if(cause === 'headon') causeMsg = '💥 Choque de cabezas — ambas eliminadas';

  // ─── SPECTATOR MODE: check if any AI is still alive ───
  var aliveAI = 0;
  if (aiSnakes) {
    for (var v = 0; v < aiSnakes.length; v++) {
      if (aiSnakes[v].alive) aliveAI++;
    }
  }

  if (aliveAI > 0) {
    // ─── Enter spectator mode ───
    spectating = true;
    running = true;
    playerDeathPos = snake[0] ? {x: snake[0].x, z: snake[0].z} : null;

    // Choose the closest alive AI to follow
    followAIIndex = -1;
    var bestDist = Infinity;
    if (aiSnakes && playerDeathPos) {
      for (var w = 0; w < aiSnakes.length; w++) {
        if (!aiSnakes[w].alive) continue;
        var d = Math.abs(aiSnakes[w].snake[0].x - playerDeathPos.x) + Math.abs(aiSnakes[w].snake[0].z - playerDeathPos.z);
        if (d < bestDist) { bestDist = d; followAIIndex = w; }
      }
    }
    if (followAIIndex < 0 && aiSnakes) {
      for (var x = 0; x < aiSnakes.length; x++) {
        if (aiSnakes[x].alive) { followAIIndex = x; break; }
      }
    }

    // ─── Convert player body to corpse (same as AI) ───
    if (playerGroupData) {
      var pgd = playerGroupData;
      if (pgd.headM && pgd.headM.material) {
        pgd.headM.material.emissiveIntensity = 0;
        pgd.headM.material.opacity = 0.4;
        pgd.headM.material.transparent = true;
      }
      if (pgd.bodyMs) {
        for (var b = 0; b < pgd.bodyMs.length; b++) {
          if (pgd.bodyMs[b].material) {
            pgd.bodyMs[b].material.emissiveIntensity = 0;
            pgd.bodyMs[b].material.opacity = 0.4;
            pgd.bodyMs[b].material.transparent = true;
          }
        }
      }
    }
    corpses.push({
      segments: snake.slice(),
      convertIndex: 0,
      groupData: playerGroupData,
      color: playerColor
    });
    if (typeof addToCorpseSet === 'function') addToCorpseSet(snake);
    // Clear player snake so AI pathfinding and collision no longer treat
    // the dead body as a "living" player. Unconverted segments remain as
    // obstacles via corpseSet; converted segments become eatable apples.
    snake.length = 0;

    // ─── Trigger grid shrink on player death (same as AI death) ───
    maybeTriggerShrink(true);

    // ─── Show spectator UI (HUD button + brief message, no overlay) ───
    var rankings = calcRankings();
    var playerRank = 0;
    for (var r = 0; r < rankings.length; r++) {
      if (rankings[r].isPlayer) { playerRank = rankings[r].rank; break; }
    }
    var total = rankings.length;
    var rankEmoji = playerRank === 1 ? '🏆' : playerRank === 2 ? '🥈' : playerRank === 3 ? '🥉' : playerRank + 'º';

    // Brief death message via info-msg
    showInfoMessage('💀 Has muerto — 👁 Espectador (' + rankEmoji + '/' + total + ')');

    // Show spectate button in HUD
    var specBtn = document.getElementById('spectate-btn');
    if (specBtn) specBtn.style.display = '';
    hintL.style.opacity = '0'; hintR.style.opacity = '0';

    // Hide overlay — game continues visible
    overlay.classList.add('hidden');

    // Update leaderboard so click targets work
    if (typeof updateLeaderboard === 'function') updateLeaderboard();
    log('👁 SPECTATOR MODE — following AI ' + followAIIndex);
  } else {
    // ─── Normal game over (no AI alive) ───
    running = false;
    // Stop periodic leaderboard update
    if (typeof _leaderboardTimer !== 'undefined') clearInterval(_leaderboardTimer);

    // ─── AI MODE: show final ranking ───
    var rankingMsg = '';
    if (aiSnakes && aiSnakes.length > 0) {
      var rankings = calcRankings();
      var playerRank = 0;
      for (var r = 0; r < rankings.length; r++) {
        if (rankings[r].isPlayer) { playerRank = rankings[r].rank; break; }
      }
      var total = rankings.length;
      var rankEmoji = playerRank === 1 ? '🏆' : playerRank === 2 ? '🥈' : playerRank === 3 ? '🥉' : playerRank + 'º';
      rankingMsg = 'Posición: ' + rankEmoji + ' de ' + total + ' — ' + score + ' puntos';
    }

    var emoji = (aiSnakes && aiSnakes.length > 0) ? (playerRank === 1 ? '🏆' : '💀') : '💀';
    finalScoreEl.textContent = emoji + ' ' + (rankingMsg || 'Puntuación: ' + score + ' 🍎') + '\n' + (causeMsg || 'Game Over');
    finalScoreEl.style.display='block';
    startBtn.textContent='REINTENTAR';
    overlay.classList.remove('hidden');
    overlay.classList.remove('spectator');
    hintL.style.opacity='1'; hintR.style.opacity='1';
  }

  // ─── Ensure apples are rendered before game over overlay ───
  // If an AI died in stepAI() this tick, appleDirty is true but refreshApples()
  // was skipped because die() returned early from step(). Render now so the
  // death apples are visible on the game over screen.
  if (typeof refreshApples === 'function') refreshApples();
  }

// ─── GRID SHRINKING ───

// Check if a snake death should trigger a grid shrink
// Called when an AI snake dies or the player dies.
// playerDied: true when called from die() — counts the player as one death
//             for the proportional shrink formula.
function maybeTriggerShrink(playerDied) {
  // Don't shrink if the player is dead and NOT in spectator mode
  if (gameOver && !spectating) return;

  // Count alive AI snakes
  var aliveCount = 0;
  if (snake && snake.length > 0) aliveCount++;
  if (aiSnakes) {
    for (var i = 0; i < aiSnakes.length; i++) {
      if (aiSnakes[i].alive) aliveCount++;
    }
  }

  // If no snakes alive, don't shrink
  if (aliveCount === 0) return;

  // Calculate current grid size from boundaries
  var currentGridSize = gridMaxX - gridMinX;

  // Don't shrink if already at minimum
  if (!canShrinkFurther(currentGridSize)) return;

  // Check if there's already an active countdown — don't stack too many
  if (shrinkCountdowns && shrinkCountdowns.length >= 2) return;

  // Count deaths for proportional shrink
  var deaths = 0;
  var initialAICount = aiSnakes ? aiSnakes.length : 0;
  if (aiSnakes) {
    for (var i = 0; i < aiSnakes.length; i++) {
      if (!aiSnakes[i].alive) deaths++;
    }
  }
  // Include the player death in the count
  if (playerDied) deaths++;

  // Calculate next shrink step (proportional)
  var nextSize = calcNextShrinkSize(currentGridSize, initialAICount, deaths, !playerDied);
  if (nextSize >= currentGridSize) return;

  triggerShrinkCountdown(nextSize);
}

// Start a shrink countdown with random offset
// IMPORTANT: boundaries are calculated at EXECUTION time, not creation time.
// This ensures multiple simultaneous countdowns each shrink from the CURRENT grid.
function triggerShrinkCountdown(targetGridSize) {
  var currentSize = gridMaxX - gridMinX;
  var shrinkAmount = currentSize - targetGridSize;

  // Calculate random offset for the new grid within the old grid
  var maxOffset = shrinkAmount;
  var offsetX = Math.floor(Math.random() * (maxOffset + 1));
  var offsetZ = Math.floor(Math.random() * (maxOffset + 1));

  var countdown = {
    startTime: performance.now(),
    duration: SHRINK_WARNING_DURATION * 1000, // ms
    shrinkAmount: shrinkAmount,
    offsetX: offsetX,
    offsetZ: offsetZ,
    messageShown: false,
    lastTickTime: 0
  };

  shrinkCountdowns.push(countdown);

  log('⚠️ SHRINK: -' + shrinkAmount + ' cells, offset=(' + offsetX + ',' + offsetZ +
      ') in ' + SHRINK_WARNING_DURATION + 's');
}

// Calculate the disappearing cells for a countdown from CURRENT grid state
// Returns { minX, maxX, minZ, maxZ, newMinX, newMaxX, newMinZ, newMaxZ }
function calcShrinkBoundsFromCurrent(cd) {
  var curMinX = gridMinX;
  var curMaxX = gridMaxX;
  var curMinZ = gridMinZ;
  var curMaxZ = gridMaxZ;
  var amt = cd.shrinkAmount;
  var newMinX = curMinX + cd.offsetX;
  var newMaxX = newMinX + (curMaxX - curMinX - amt);
  var newMinZ = curMinZ + cd.offsetZ;
  var newMaxZ = newMinZ + (curMaxZ - curMinZ - amt);
  return {
    minX: curMinX, maxX: curMaxX, minZ: curMinZ, maxZ: curMaxZ,
    newMinX: newMinX, newMaxX: newMaxX, newMinZ: newMinZ, newMaxZ: newMaxZ
  };
}

// Build a lookup of all disappearing cells across all active countdowns
function getAllDisappearingCells() {
  var cells = {};
  shrinkCountdowns.forEach(function(cd) {
    var b = calcShrinkBoundsFromCurrent(cd);
    for (var x = b.minX; x < b.maxX; x++) {
      for (var z = b.minZ; z < b.maxZ; z++) {
        if (x < b.newMinX || x >= b.newMaxX || z < b.newMinZ || z >= b.newMaxZ) {
          cells[x + ',' + z] = true;
        }
      }
    }
  });
  return cells;
}

// Shared flash geometry/material
var _shrinkFlashGroup = null;
var _shrinkFlashGeo = null;

// Update flash meshes to match current disappearing cells
function updateShrinkFlashMeshes(disappearing) {
  if (!_shrinkFlashGroup) {
    _shrinkFlashGroup = new THREE.Group();
    scene.add(_shrinkFlashGroup);
  }
  if (!_shrinkFlashGeo) {
    _shrinkFlashGeo = new THREE.BoxGeometry(0.9, 0.05, 0.9);
  }

  // Build current mesh lookup
  var currentMeshes = {};
  _shrinkFlashGroup.children.forEach(function(m) {
    var key = Math.round(m.position.x - 0.5) + ',' + Math.round(m.position.z - 0.5);
    currentMeshes[key] = m;
  });

  // Add meshes for new disappearing cells
  for (var key in disappearing) {
    if (!currentMeshes[key]) {
      var mat = new THREE.MeshStandardMaterial({
        color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.5,
        transparent: true, opacity: 0, depthWrite: false
      });
      var mesh = new THREE.Mesh(_shrinkFlashGeo, mat);
      var parts = key.split(',');
      mesh.position.set(gw(parseInt(parts[0])), 0.01, gw(parseInt(parts[1])));
      _shrinkFlashGroup.add(mesh);
      currentMeshes[key] = mesh;
    }
  }

  // Remove meshes for cells that are no longer disappearing
  for (var key in currentMeshes) {
    if (!disappearing[key]) {
      var m = currentMeshes[key];
      _shrinkFlashGroup.remove(m);
      if (m.material) m.material.dispose();
    }
  }
}

// Process shrink countdowns each frame
function processShrinkCountdowns(now) {
  // Update flash visuals
  updateShrinkFlashes(now);

  // Check for completed countdowns
  var completed = [];
  for (var i = shrinkCountdowns.length - 1; i >= 0; i--) {
    var elapsed = now - shrinkCountdowns[i].startTime;
    if (elapsed >= shrinkCountdowns[i].duration) {
      completed.push(shrinkCountdowns[i]);
      shrinkCountdowns.splice(i, 1);
    }
  }

  // Apply completed countdowns
  for (var i = 0; i < completed.length; i++) {
    applyShrink(completed[i]);
  }
}

// Update shrink flash visuals each frame
function updateShrinkFlashes(now) {
  if (!shrinkCountdowns || shrinkCountdowns.length === 0) {
    // Clear all flash meshes
    if (_shrinkFlashGroup) {
      while (_shrinkFlashGroup.children.length) {
        var c = _shrinkFlashGroup.children[0];
        _shrinkFlashGroup.remove(c);
        if (c.material) c.material.dispose();
      }
    }
    return;
  }

  // Get all disappearing cells from current grid state
  var disappearingCells = getAllDisappearingCells();

  // Sync flash meshes with disappearing cells
  updateShrinkFlashMeshes(disappearingCells);

  // Calculate flash timing from the earliest finishing countdown
    var earliestEnd = Infinity;
    shrinkCountdowns.forEach(function(cd) {
      var end = cd.startTime + cd.duration;
      if (end < earliestEnd) earliestEnd = end;
    });

    var timeToEarliestEnd = Math.max(0, (earliestEnd - now) / 1000);
    // Gentle easing: starts at ~0.8 Hz, accelerates slowly to ~3 Hz at the end
    var progress = 1 - (timeToEarliestEnd / SHRINK_WARNING_DURATION);
    var flashSpeed = 0.8 + 2.2 * progress * progress * progress;
    var flashPhase = Math.sin(now * 0.001 * flashSpeed);
    var flashOpacity = flashPhase > 0 ? Math.min(0.7, flashPhase * 0.7) : 0;

  // Update flash mesh opacities
  if (_shrinkFlashGroup) {
    _shrinkFlashGroup.children.forEach(function(m) {
      m.material.opacity = flashOpacity;
      m.material.emissiveIntensity = flashOpacity * 1.5;
    });
  }

  // Play tick sound on each flash ON transition (global, not per-countdown)
    var anyFlashOn = flashOpacity > 0.3;
    if (anyFlashOn && !_shrinkFlashOn) {
      sfxShrinkTick();
    }
    _shrinkFlashOn = anyFlashOn;

  // Show warning message in last 5 seconds
  shrinkCountdowns.forEach(function(cd) {
    var elapsed = (now - cd.startTime) / 1000;
    var remaining = (cd.duration / 1000) - elapsed;
    if (remaining <= SHRINK_MESSAGE_DELAY && remaining > 0 && !cd.messageShown) {
      cd.messageShown = true;
      showShrinkWarning(Math.ceil(remaining));
    }
  });
}

// Show on-screen shrink warning message
var _shrinkMsgEl = null;
function showShrinkWarning(seconds) {
  if (!_shrinkMsgEl) {
    _shrinkMsgEl = document.getElementById('shrink-warning');
  }
  if (_shrinkMsgEl) {
    _shrinkMsgEl.textContent = '⚠️ ¡El tablero se reduce en ' + seconds + 's!';
    _shrinkMsgEl.classList.add('visible');
    clearTimeout(_shrinkMsgEl._hideTimer);
    _shrinkMsgEl._hideTimer = setTimeout(function() {
      if (_shrinkMsgEl) _shrinkMsgEl.classList.remove('visible');
    }, 3000);
  }
}

// Apply a completed shrink countdown
// IMPORTANT: calculates boundaries from CURRENT grid state at execution time
function applyShrink(countdown) {
  // Calculate new boundaries from current grid
  var bounds = calcShrinkBoundsFromCurrent(countdown);

  log('🔻 APPLYING SHRINK: ' + (bounds.maxX - bounds.minX) +
      ' → ' + (bounds.newMaxX - bounds.newMinX) + ' offset=(' +
      (bounds.newMinX - bounds.minX) + ',' +
      (bounds.newMinZ - bounds.minZ) + ')');

  // Truncate snake bodies BEFORE updating boundaries
  truncateSnakesToBounds(bounds);

  // Update grid boundaries
  gridMinX = bounds.newMinX;
  gridMaxX = bounds.newMaxX;
  gridMinZ = bounds.newMinZ;
  gridMaxZ = bounds.newMaxZ;

  // Update GRID_SIZE for proportional scaling (apples, obstacles)
  var newGridSize = bounds.newMaxX - bounds.newMinX;
  var oldGridSize = GRID_SIZE;
  GRID_SIZE = newGridSize;
  half = GRID_SIZE / 2;
  // Recalculate proportional values
  NUM_APPLES = calcNumApples(GRID_SIZE);
  MAX_OBSTACLES = calcMaxObstacles(GRID_SIZE);
  OBSTACLE_SPAWN_EVERY = calcObstacleSpawnEvery(GRID_SIZE);
  log('  Scaled: apples=' + NUM_APPLES + ', maxObs=' + MAX_OBSTACLES + ', spawnEvery=' + OBSTACLE_SPAWN_EVERY);

  // Rebuild board visuals with offset
   var boardOffsetX = (bounds.newMinX + bounds.newMaxX) / 2;
   var boardOffsetZ = (bounds.newMinZ + bounds.newMaxZ) / 2;
   rebuildBoard(newGridSize, { offsetX: boardOffsetX, offsetZ: boardOffsetZ });

  // Remove elements outside new grid
  removeOutOfBounds();

  // Check if any snake heads are outside (they die)
  checkHeadsOutOfBounds();

  // Play shrink complete sound
  sfxShrinkComplete();

  log('✅ Grid shrunk to ' + newGridSize + 'x' + newGridSize +
      ' bounds=(' + gridMinX + ',' + gridMaxX + ',' + gridMinZ + ',' + gridMaxZ + ')');
}

// Remove apples, obstacles outside new grid; adjust counts to new grid size
function removeOutOfBounds() {
  // ── Apples ──
  var before = apples.length;
  apples = apples.filter(function(a) {
    return a && a.x >= gridMinX && a.x < gridMaxX && a.z >= gridMinZ && a.z < gridMaxZ;
  });

  // Separate death apples from regular ones — death apples are NOT trimmed
  var deathApples = [];
  var regularApples = [];
  for (var i = 0; i < apples.length; i++) {
    if (apples[i] && apples[i].fromDeath) {
      deathApples.push(apples[i]);
    } else {
      regularApples.push(apples[i]);
    }
  }

  // Trim only regular apples to NUM_APPLES
  while (regularApples.length > NUM_APPLES) regularApples.pop();

  // Rebuild apples array: regular apples + death apples
  apples = regularApples.concat(deathApples);

  // Pad regular portion to NUM_APPLES
  while (apples.length < NUM_APPLES + deathApples.length) apples.push(null);

  // Keep spawnOneApple() aware of the compacted apple list before refilling
  // null slots; otherwise multiple refills in one shrink can reuse a cell.
  if (typeof rebuildAppleSet === 'function') rebuildAppleSet();

  // Spawn missing apples (only in null slots of the regular portion)
  for (var i = 0; i < apples.length; i++) {
    if (!apples[i]) {
      apples[i] = spawnOneApple();
      if (typeof addToAppleSet === 'function') addToAppleSet(apples[i], i);
    }
  }
  // Remove any duplicates that may have been created during spawn
   if (typeof deduplicateApples === 'function') deduplicateApples();
     // deduplicateApples() already calls rebuildAppleSet() internally — no need to call again
     log('  Apples: ' + before + ' → ' + apples.filter(Boolean).length + ' (target: ' + NUM_APPLES + ' regular + ' + deathApples.length + ' death)');
     appleDirty = true;

  // ── Obstacles ──
  var beforeObs = obstacles.length;
  obstacles = obstacles.filter(function(o) {
    return o.x >= gridMinX && o.x < gridMaxX && o.z >= gridMinZ && o.z < gridMaxZ;
  });
  // Trim excess obstacles if MAX_OBSTACLES decreased after shrink
  while (obstacles.length > MAX_OBSTACLES) obstacles.pop();
  log('  Obstacles: ' + beforeObs + ' → ' + obstacles.length + ' (max: ' + MAX_OBSTACLES + ')');

    // ── Refresh visuals so meshes update (guard: may not exist in tests) ──
   if (typeof refreshApples === 'function' && appleMeshes && appleMeshes.length) refreshApples();
   if (typeof refreshObstacles === 'function' && obsMeshes && obsMeshes.length) refreshObstacles();
  }

// Check if snake heads are outside new grid bounds
function checkHeadsOutOfBounds() {
  // Player snake
  if (snake && snake.length > 0) {
    var head = snake[0];
    if (head.x < gridMinX || head.x >= gridMaxX || head.z < gridMinZ || head.z >= gridMaxZ) {
      log('💀 Player head out of bounds at (' + head.x + ',' + head.z + ')');
      die('shrink');
      return;
    }
  }

  // AI snakes
  if (aiSnakes) {
    for (var i = 0; i < aiSnakes.length; i++) {
      var ai = aiSnakes[i];
      if (!ai.alive) continue;
      var aiHead = ai.snake[0];
      if (aiHead.x < gridMinX || aiHead.x >= gridMaxX || aiHead.z < gridMinZ || aiHead.z >= gridMaxZ) {
        log('💀 AI ' + i + ' head out of bounds at (' + aiHead.x + ',' + aiHead.z + ')');
        aiDie(i, 'shrink');
      }
    }
  }
}

// Truncate snake bodies that extend outside new grid
// bounds: { newMinX, newMaxX, newMinZ, newMaxZ }
function truncateSnakesToBounds(bounds) {
  var playerLost = 0;

  // Player snake — filter ALL segments outside new bounds
  if (snake && snake.length > 0) {
    var before = snake.length;
    var newSnake = [];
    for (var i = 0; i < snake.length; i++) {
      if (snake[i].x >= bounds.newMinX && snake[i].x < bounds.newMaxX &&
          snake[i].z >= bounds.newMinZ && snake[i].z < bounds.newMaxZ) {
        newSnake.push(snake[i]);
      }
    }
    // Keep at least the head (index 0) even if somehow outside — die() handles that
    if (newSnake.length < 1) newSnake = [snake[0]];
    playerLost = before - newSnake.length;
    snake.length = 0;
    for (var i = 0; i < newSnake.length; i++) snake.push(newSnake[i]);
    if (playerLost > 0) {
      score = Math.max(0, score - playerLost);
      scoreEl.textContent = score;
      log('  Player snake truncated: ' + before + ' → ' + snake.length + ' (lost ' + playerLost + ', score: ' + score + ')');
    }
  }

  // AI snakes — filter ALL segments outside new bounds
  if (aiSnakes) {
    for (var i = 0; i < aiSnakes.length; i++) {
      var ai = aiSnakes[i];
      if (!ai.alive) continue;
      var before = ai.snake.length;
      var newSnake = [];
      for (var j = 0; j < ai.snake.length; j++) {
        if (ai.snake[j].x >= bounds.newMinX && ai.snake[j].x < bounds.newMaxX &&
            ai.snake[j].z >= bounds.newMinZ && ai.snake[j].z < bounds.newMaxZ) {
          newSnake.push(ai.snake[j]);
        }
      }
      if (newSnake.length < 1) newSnake = [ai.snake[0]];
      var lost = before - newSnake.length;
      ai.snake.length = 0;
      for (var j = 0; j < newSnake.length; j++) ai.snake.push(newSnake[j]);
      if (lost > 0) {
        log('  AI ' + i + ' truncated: ' + before + ' → ' + ai.snake.length + ' (lost ' + lost + ')');
      }
    }
  }

  // Corpses — remove segments outside new bounds
   if (corpses) {
     for (var c = 0; c < corpses.length; c++) {
       var before = corpses[c].segments.length;
       // Adjust convertIndex if segments before it were removed
       var newSegments = [];
       var convertedCount = 0;
       for (var j = 0; j < corpses[c].segments.length; j++) {
         var seg = corpses[c].segments[j];
         if (j < corpses[c].convertIndex) {
           convertedCount++;
           continue; // already converted, skip
         }
         if (seg.x >= bounds.newMinX && seg.x < bounds.newMaxX &&
             seg.z >= bounds.newMinZ && seg.z < bounds.newMaxZ) {
           newSegments.push(seg);
         }
       }
       corpses[c].segments = newSegments;
       corpses[c].convertIndex = 0; // reset since we rebuilt the array
       if (before - convertedCount - newSegments.length > 0) {
         log('  Corpse ' + c + ' truncated: ' + (before - convertedCount) + ' → ' + newSegments.length);
       }
     }
     // Rebuild corpseSet after truncation (segments removed, indices reset)
     if (typeof rebuildCorpseSet === 'function') rebuildCorpseSet();
   }

  // Show info message ONLY if the player lost segments
  if (playerLost > 0) {
    showInfoMessage('⚠️ Has perdido ' + playerLost + (playerLost === 1 ? ' segmento del cuerpo' : ' segmentos del cuerpo') + ' por la reducción del tablero (-' + playerLost + ' puntos)');
  }
}

// ─── Show info message on screen ───
function showInfoMessage(msg) {
  var el = document.getElementById('info-msg');
  if (el) {
    el.innerHTML = msg;
    el.classList.add('visible');
    clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(function() {
      el.classList.remove('visible');
    }, 5000);
  }
}

// ─── CAMERA (framerate-independent, head-interpolated) ───
var isMobile = window.innerWidth < 600;
var CAM_SMOOTH_SPEED = 8; // smoothing factor (higher = faster follow)
var HEAD_SMOOTH_SPEED = 12; // head position smoothing (higher = snappier)
var headSmoothX = 0, headSmoothZ = 0; // interpolated head position for camera
function updateCam(dt) {
  var camDist = isMobile ? 7 : 5;
  var camHeight = isMobile ? 6 : 4.5;
  var lookAhead = isMobile ? 4 : 3;
  var headTargetX, headTargetZ, dirX, dirZ;

  if (spectating && followAIIndex >= 0 && aiSnakes && aiSnakes[followAIIndex]) {
    var ai = aiSnakes[followAIIndex];
    if (ai.alive && ai.snake && ai.snake.length > 0) {
      headTargetX = gw(ai.snake[0].x);
      headTargetZ = gw(ai.snake[0].z);
      dirX = Math.cos(ai.direction);
      dirZ = Math.sin(ai.direction);
    } else {
      // The followed AI died — pick the next closest alive AI
      spectateRechooseTarget();
      if (followAIIndex >= 0 && aiSnakes && aiSnakes[followAIIndex] && aiSnakes[followAIIndex].alive) {
        var ai2 = aiSnakes[followAIIndex];
        headTargetX = gw(ai2.snake[0].x);
        headTargetZ = gw(ai2.snake[0].z);
        dirX = Math.cos(ai2.direction);
        dirZ = Math.sin(ai2.direction);
      } else {
        return;
      }
    }
  } else if (snake && snake.length > 0) {
    headTargetX = gw(snake[0].x);
    headTargetZ = gw(snake[0].z);
    dirX = Math.cos(direction);
    dirZ = Math.sin(direction);
  } else {
    return;
  }

  // Smooth head position (interpolate between grid cells)
  var headFactor = 1 - Math.exp(-HEAD_SMOOTH_SPEED * dt);
  headSmoothX += (headTargetX - headSmoothX) * headFactor;
  headSmoothZ += (headTargetZ - headSmoothZ) * headFactor;
  // Camera follows smoothed head
  var idealX = headSmoothX - dirX * camDist;
  var idealZ = headSmoothZ - dirZ * camDist;
  var factor = 1 - Math.exp(-CAM_SMOOTH_SPEED * dt);
  camSmoothX += (idealX - camSmoothX) * factor;
  camSmoothZ += (idealZ - camSmoothZ) * factor;
  camera.position.x = camSmoothX;
  camera.position.y = camHeight;
  camera.position.z = camSmoothZ;
  var targetLookX = headSmoothX + dirX * lookAhead;
  var targetLookZ = headSmoothZ + dirZ * lookAhead;
  lookSmoothX += (targetLookX - lookSmoothX) * factor;
  lookSmoothZ += (targetLookZ - lookSmoothZ) * factor;
  camera.lookAt(lookSmoothX, 0, lookSmoothZ);
  pLight.position.set(headSmoothX, 5, headSmoothZ);
}

// ─── Rechoose spectate target: closest alive AI to player death position ───
function spectateRechooseTarget() {
  if (!aiSnakes) { followAIIndex = -1; return; }
  var ref = playerDeathPos || {x: 0, z: 0};
  var bestDist = Infinity;
  followAIIndex = -1;
  for (var i = 0; i < aiSnakes.length; i++) {
    if (!aiSnakes[i].alive) continue;
    var d = Math.abs(aiSnakes[i].snake[0].x - ref.x) + Math.abs(aiSnakes[i].snake[0].z - ref.z);
    if (d < bestDist) { bestDist = d; followAIIndex = i; }
  }
  // Update leaderboard to reflect new target
  if (typeof updateLeaderboard === 'function') updateLeaderboard();
}
