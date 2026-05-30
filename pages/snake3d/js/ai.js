// ─── AI OPPONENTS ───
// AI snake logic: movement, collision, corpses, difficulty levels

// ─── Snap angle to nearest cardinal direction ───
// Cardinal directions: 0 (right/+X), π/2 (down/+Z), π (left/-X), -π/2 (up/-Z)
function snapToCardinal(angle) {
  var cardinal = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  var best = cardinal[0];
  var bestDiff = Infinity;
  for (var i = 0; i < cardinal.length; i++) {
    var diff = angle - cardinal[i];
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) < bestDiff) {
      bestDiff = Math.abs(diff);
      best = cardinal[i];
    }
  }
  return best;
}

// ─── Count reachable cells from (x,z) using BFS ───
// Used to evaluate how much open space a direction offers
function countReachable(x, z, snakeBody, maxSteps) {
  maxSteps = maxSteps || 30;
  var visited = {};
  var queue = [{x: x, z: z}];
  visited[x + ',' + z] = true;
  var count = 0;
  var dirs = [{x:1,z:0},{x:-1,z:0},{x:0,z:1},{x:0,z:-1}];

  // Build obstacle/corpse lookup for fast access
  var blocked = {};
  for (var i = 0; i < snakeBody.length; i++) blocked[snakeBody[i].x + ',' + snakeBody[i].z] = true;
  for (var i = 0; i < obstacles.length; i++) blocked[obstacles[i].x + ',' + obstacles[i].z] = true;
  if (corpses) for (var i = 0; i < corpses.length; i++) blocked[corpses[i].x + ',' + corpses[i].z] = true;
  // Other snakes
  if (snake.length) for (var i = 0; i < snake.length; i++) blocked[snake[i].x + ',' + snake[i].z] = true;
  if (aiSnakes) {
    for (var i = 0; i < aiSnakes.length; i++) {
      if (!aiSnakes[i].alive) continue;
      for (var j = 0; j < aiSnakes[i].snake.length; j++) {
        blocked[aiSnakes[i].snake[j].x + ',' + aiSnakes[i].snake[j].z] = true;
      }
    }
  }

  while (queue.length > 0 && count < maxSteps) {
    var curr = queue.shift();
    count++;
    for (var d = 0; d < dirs.length; d++) {
      var nx = curr.x + dirs[d].x;
      var nz = curr.z + dirs[d].z;
      var key = nx + ',' + nz;
      if (nx < -half || nx >= half || nz < -half || nz >= half) continue;
      if (blocked[key] || visited[key]) continue;
      visited[key] = true;
      queue.push({x: nx, z: nz});
    }
  }
  return count;
}

// ─── Initialize AI snakes ───
function initAI() {
  log('=== initAI() mode=' + gameMode + ' diff=' + difficulty + ' ===');
  aiSnakes = [];
  corpses = [];
  corpseMeshes = [];

  // Clean up old corpse meshes
  if (corpseGroup) {
    while (corpseGroup.children.length) {
      var c = corpseGroup.children[0]; corpseGroup.remove(c);
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    }
  }
  corpseGroup = new THREE.Group(); scene.add(corpseGroup);

  var count = AI_COUNT[gameMode] || 0;
  if (count === 0) return;

  // Get available colors (exclude player color)
  var availableColors = SNAKE_COLOR_NAMES.filter(function(c) { return c !== playerColor; });
  for (var i = availableColors.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = availableColors[i]; availableColors[i] = availableColors[j]; availableColors[j] = tmp;
  }

  var spawnAngles = [];
  for (var i = 0; i < count; i++) {
    spawnAngles.push((Math.PI * 2 / count) * i + Math.PI / 4);
  }

  for (var i = 0; i < count; i++) {
    var angle = spawnAngles[i];
    var dist = Math.floor(gridSize * 0.35);
    var sx = Math.round(Math.cos(angle) * dist);
    var sz = Math.round(Math.sin(angle) * dist);
    sx = Math.max(-half + 2, Math.min(half - 2, sx));
    sz = Math.max(-half + 2, Math.min(half - 2, sz));

    var snakeData = [];
    for (var j = 0; j < 4; j++) {
      snakeData.push({x: sx - j, z: sz});
    }

    var initDir = snapToCardinal(Math.atan2(-sz, -sx));

    aiSnakes.push({
      id: 'ai_' + i,
      snake: snakeData,
      direction: initDir,
      color: availableColors[i] || 'red',
      alive: true,
      score: 0,
      groupData: null
    });

    log('AI ' + i + ': color=' + availableColors[i] + ' spawn=(' + sx + ',' + sz + ') dir=' + initDir);
  }
}

// ─── Evaluate safe directions for an AI snake ───
function aiEvaluateDirections(aiIndex, aiSnake, aiDir) {
  var possibleDirs = [
    aiDir,
    aiDir - TURN_ANGLE,
    aiDir + TURN_ANGLE
  ];

  var safe = [];
  var head = aiSnake[0];

  possibleDirs.forEach(function(dir) {
    var nx = head.x + Math.round(Math.cos(dir));
    var nz = head.z + Math.round(Math.sin(dir));

    if (nx < -half || nx >= half || nz < -half || nz >= half) return;
    if (aiSnake.some(function(s) { return s.x === nx && s.z === nz; })) return;
    if (obstacles.some(function(o) { return o.x === nx && o.z === nz; })) return;
    if (corpses && corpses.some(function(c) { return c.x === nx && c.z === nz; })) return;
    if (snake.some(function(s) { return s.x === nx && s.z === nz; })) return;
    if (aiSnakes) {
      for (var i = 0; i < aiSnakes.length; i++) {
        if (i === aiIndex) continue;
        var other = aiSnakes[i];
        if (!other.alive) continue;
        if (other.snake.some(function(s) { return s.x === nx && s.z === nz; })) return;
      }
    }

    safe.push(dir);
  });

  return safe;
}

// ─── Find nearest apple to a position ───
function nearestApple(x, z) {
  var best = null;
  var bestDist = Infinity;
  for (var i = 0; i < apples.length; i++) {
    if (!apples[i]) continue;
    var dx = apples[i].x - x;
    var dz = apples[i].z - z;
    var dist = Math.abs(dx) + Math.abs(dz);
    if (dist < bestDist) {
      bestDist = dist;
      best = apples[i];
    }
  }
  return best;
}

// ─── Decide direction for AI snake based on difficulty ───
function aiDecideDirection(aiIndex, diff) {
  var ai = aiSnakes[aiIndex];
  if (!ai || !ai.alive) return ai.direction;

  var safe = aiEvaluateDirections(aiIndex, ai.snake, ai.direction);
  if (safe.length === 0) return ai.direction;
  if (safe.length === 1) return snapToCardinal(safe[0]);

  // Random error based on difficulty
  var errorRate = AI_ERROR_RATE[diff] || AI_ERROR_RATE.medium;
  if (Math.random() < errorRate) {
    return snapToCardinal(safe[Math.floor(Math.random() * safe.length)]);
  }

  // Score each safe direction: prefer more open space + closer to apple
  var bestDir = safe[0];
  var bestScore = -Infinity;
  var apple = nearestApple(ai.snake[0].x, ai.snake[0].z);

  safe.forEach(function(dir) {
    var nx = ai.snake[0].x + Math.round(Math.cos(dir));
    var nz = ai.snake[0].z + Math.round(Math.sin(dir));

    // Flood-fill: count reachable open space from this position
    var space = countReachable(nx, nz, ai.snake, 25);

    // Apple attraction (smaller distance = better)
    var appleDist = apple ? (Math.abs(apple.x - nx) + Math.abs(apple.z - nz)) : 999;

    // Combined score: space is primary (avoids self-trapping), apple is secondary
    var score = space * 3 - appleDist;

    if (score > bestScore) {
      bestScore = score;
      bestDir = dir;
    }
  });

  return snapToCardinal(bestDir);
}

// ─── Cornering strategy (medium/hard difficulty) ───
function aiCorneringStrategy(aiIndex, diff) {
  var ai = aiSnakes[aiIndex];
  if (!ai || !ai.alive) return false;

  var corneringRate = AI_CORNERING_RATE[diff] || 0;
  if (Math.random() > corneringRate) return false;

  var targets = [];
  if (snake.length > 0) targets.push({snake: snake, isPlayer: true});
  for (var i = 0; i < aiSnakes.length; i++) {
    if (i === aiIndex) continue;
    if (!aiSnakes[i].alive) continue;
    targets.push({snake: aiSnakes[i].snake, isPlayer: false});
  }
  if (targets.length === 0) return false;

  for (var t = 0; t < targets.length; t++) {
    var target = targets[t];
    if (target.snake.length >= ai.snake.length) continue;
    var targetHead = target.snake[0];
    var nearWall = (
      targetHead.x <= -half + 3 || targetHead.x >= half - 3 ||
      targetHead.z <= -half + 3 || targetHead.z >= half - 3
    );
    if (nearWall) {
      var dx = targetHead.x - ai.snake[0].x;
      var dz = targetHead.z - ai.snake[0].z;
      var dist = Math.abs(dx) + Math.abs(dz);
      if (dist < 8) {
        log('AI cornering target at (' + targetHead.x + ',' + targetHead.z + ')');
        return true;
      }
    }
  }
  return false;
}

// ─── Step all AI snakes ───
function stepAI() {
  if (!aiSnakes || aiSnakes.length === 0) return;

  aiSnakes.forEach(function(ai, index) {
    if (!ai.alive) return;

    ai.direction = aiDecideDirection(index, difficulty);

    var head = ai.snake[0];
    var nx = head.x + Math.round(Math.cos(ai.direction));
    var nz = head.z + Math.round(Math.sin(ai.direction));

    // Check wall collision
    if (nx < -half || nx >= half || nz < -half || nz >= half) {
      log('AI ' + index + ' hit wall at (' + nx + ',' + nz + ')');
      aiDie(index, 'wall');
      return;
    }

    // Check self collision
    if (ai.snake.some(function(s) { return s.x === nx && s.z === nz; })) {
      log('AI ' + index + ' hit self at (' + nx + ',' + nz + ')');
      aiDie(index, 'self');
      return;
    }

    // Check obstacle collision
    if (obstacles.some(function(o) { return o.x === nx && o.z === nz; })) {
      log('AI ' + index + ' hit obstacle at (' + nx + ',' + nz + ')');
      aiDie(index, 'obstacle');
      return;
    }

    // Check corpse collision
    if (corpses && corpses.some(function(c) { return c.x === nx && c.z === nz; })) {
      log('AI ' + index + ' hit corpse at (' + nx + ',' + nz + ')');
      aiDie(index, 'corpse');
      return;
    }

    // Check collision with player snake
    if (snake.some(function(s) { return s.x === nx && s.z === nz; })) {
      log('AI ' + index + ' hit player at (' + nx + ',' + nz + ')');
      aiDie(index, 'player');
      return;
    }

    // Check collision with other AI snakes
    for (var i = 0; i < aiSnakes.length; i++) {
      if (i === index) continue;
      var other = aiSnakes[i];
      if (!other.alive) continue;
      if (other.snake.some(function(s) { return s.x === nx && s.z === nz; })) {
        log('AI ' + index + ' hit AI ' + i + ' at (' + nx + ',' + nz + ')');
        aiDie(index, 'ai');
        return;
      }
    }

    // Move forward
    ai.snake.unshift({x: nx, z: nz});

    // Check apple eating
    var ate = false;
    for (var i = 0; i < apples.length; i++) {
      if (apples[i] && nx === apples[i].x && nz === apples[i].z) {
        ai.score++;
        ate = true;
        var newA = spawnOneApple();
        apples[i] = newA;
        log('AI ' + index + ' ate apple at (' + nx + ',' + nz + ')');
        // Directional eat sound based on AI position relative to player
        if (snake.length > 0) {
          var playerHead = snake[0];
          var panX = (nx - playerHead.x) / Math.max(half, 1);
          sfxAiEat(panX);
        }
        break;
      }
    }

    if (!ate) ai.snake.pop();
  });
}

// ─── AI snake dies ───
function aiDie(aiIndex, cause) {
  var ai = aiSnakes[aiIndex];
  if (!ai || !ai.alive) return;

  ai.alive = false;

  // Convert body to corpse with color
  if (!corpses) corpses = [];
  var corpseColor = ai.color;
  ai.snake.forEach(function(seg) {
    corpses.push({x: seg.x, z: seg.z, color: corpseColor});
  });

  // Create visual corpse meshes (darkened version of snake color)
  var baseColor = SNAKE_COLORS[corpseColor] || SNAKE_COLORS.red;
  var corpseMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(baseColor).multiplyScalar(0.35),
    emissive: new THREE.Color(baseColor).multiplyScalar(0.1).getHex(),
    emissiveIntensity: .1,
    roughness: .8
  });
  var corpseGeo = new THREE.BoxGeometry(.6, .3, .6);

  ai.snake.forEach(function(seg) {
    var m = new THREE.Mesh(corpseGeo, corpseMat);
    m.position.set(gw(seg.x), .15, gw(seg.z));
    corpseGroup.add(m);
    corpseMeshes.push(m);
  });

  // Particles
  if (ai.snake.length) {
    burst(ai.snake[0].x, ai.snake[0].z, 0xff4444, 8);
  }

  // Show death message
  showAiDeathMessage(ai, cause);

  log('AI ' + aiIndex + ' died (' + cause + ') — ' + corpses.length + ' corpse segments');
}

// ─── Show AI death message on screen ───
function showAiDeathMessage(ai, cause) {
  var colorNames = {green: 'verde', red: 'roja', blue: 'azul', yellow: 'amarilla'};
  var colorName = colorNames[ai.color] || 'desconocida';

  var causeMsg = '';
  if (cause === 'wall') causeMsg = 'contra la pared';
  else if (cause === 'self') causeMsg = 'contra sí misma';
  else if (cause === 'obstacle') causeMsg = 'contra un obstáculo';
  else if (cause === 'corpse') causeMsg = 'contra un cadáver';
  else if (cause === 'player') causeMsg = 'contra el jugador';
  else if (cause === 'ai') causeMsg = 'contra otra serpiente';

  var msg = '💀 Serpiente ' + colorName + ' ha muerto por chocarse ' + causeMsg;

  var el = document.getElementById('ai-death-msg');
  if (el) {
    el.textContent = msg;
    el.classList.add('visible');
    // Auto-hide after 3 seconds
    clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(function() {
      el.classList.remove('visible');
    }, 3000);
  }
}

// ─── Refresh AI snake meshes ───
function refreshAISnakes() {
  if (!aiSnakes || !aiSnakes.length) return;

  aiSnakes.forEach(function(ai, index) {
    if (!ai.alive || !ai.groupData || !ai.groupData.bodyMs || !ai.groupData.bodyMs.length) return;
    refreshSnake(ai.snake, ai.groupData);
  });
}
