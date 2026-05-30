// ─── AI OPPONENTS ───
// AI snake logic: movement, collision, corpses, difficulty levels

// ─── Snap angle to nearest cardinal direction ───
// Cardinal directions: 0 (right/+X), π/2 (down/+Z), π (left/-X), -π/2 (up/-Z)
function snapToCardinal(angle) {
  var cardinal = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  var best = cardinal[0];
  var bestDiff = Infinity;
  for (var i = 0; i < cardinal.length; i++) {
    // Normalize difference to [-π, π]
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

// ─── Initialize AI snakes ───
function initAI() {
  log('=== initAI() mode=' + gameMode + ' diff=' + difficulty + ' ===');
  aiSnakes = [];
  corpses = [];

  var count = AI_COUNT[gameMode] || 0;
  if (count === 0) return;

  // Get available colors (exclude player color)
  var availableColors = SNAKE_COLOR_NAMES.filter(function(c) { return c !== playerColor; });
  // Shuffle
  for (var i = availableColors.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = availableColors[i]; availableColors[i] = availableColors[j]; availableColors[j] = tmp;
  }

  // Spawn positions: distribute around the grid
  var spawnAngles = [];
  for (var i = 0; i < count; i++) {
    spawnAngles.push((Math.PI * 2 / count) * i + Math.PI / 4);
  }

  for (var i = 0; i < count; i++) {
    var angle = spawnAngles[i];
    var dist = Math.floor(gridSize * 0.35);
    var sx = Math.round(Math.cos(angle) * dist);
    var sz = Math.round(Math.sin(angle) * dist);
    // Clamp to grid
    sx = Math.max(-half + 2, Math.min(half - 2, sx));
    sz = Math.max(-half + 2, Math.min(half - 2, sz));

    var snakeData = [];
    for (var j = 0; j < 4; j++) {
      snakeData.push({x: sx - j, z: sz});
    }

    // Snap initial direction to cardinal so AI moves in grid-aligned steps
    var initDir = snapToCardinal(Math.atan2(-sz, -sx));

    aiSnakes.push({
      id: 'ai_' + i,
      snake: snakeData,
      direction: initDir,
      color: availableColors[i] || 'red',
      alive: true,
      score: 0,
      groupData: null // will be set by buildSnake
    });

    log('AI ' + i + ': color=' + availableColors[i] + ' spawn=(' + sx + ',' + sz + ') dir=' + initDir);
  }
}

// ─── Evaluate safe directions for an AI snake ───
// Returns array of safe direction values
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

    // Wall check
    if (nx < -half || nx >= half || nz < -half || nz >= half) return;

    // Self collision
    if (aiSnake.some(function(s) { return s.x === nx && s.z === nz; })) return;

    // Obstacle check
    if (obstacles.some(function(o) { return o.x === nx && o.z === nz; })) return;

    // Corpse check
    if (corpses && corpses.some(function(c) { return c.x === nx && c.z === nz; })) return;

    // Collision with player snake
    if (snake.some(function(s) { return s.x === nx && s.z === nz; })) return;

    // Collision with other AI snakes
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
  if (safe.length === 0) return ai.direction; // no safe move, will die

  // Random error based on difficulty
  var errorRate = AI_ERROR_RATE[diff] || AI_ERROR_RATE.medium;
  if (Math.random() < errorRate) {
    return snapToCardinal(safe[Math.floor(Math.random() * safe.length)]);
  }

  // Find nearest apple
  var apple = nearestApple(ai.snake[0].x, ai.snake[0].z);
  if (!apple) {
    // No apples — pick direction that keeps most space
    return snapToCardinal(safe[0]);
  }

  // Score each safe direction by distance to apple
  var bestDir = safe[0];
  var bestDist = Infinity;
  safe.forEach(function(dir) {
    var nx = ai.snake[0].x + Math.round(Math.cos(dir));
    var nz = ai.snake[0].z + Math.round(Math.sin(dir));
    var dist = Math.abs(apple.x - nx) + Math.abs(apple.z - nz);
    if (dist < bestDist) {
      bestDist = dist;
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

  // Check if any other snake (player or AI) is nearby and shorter
  var targets = [];
  if (snake.length > 0) {
    targets.push({snake: snake, isPlayer: true});
  }
  for (var i = 0; i < aiSnakes.length; i++) {
    if (i === aiIndex) continue;
    if (!aiSnakes[i].alive) continue;
    targets.push({snake: aiSnakes[i].snake, isPlayer: false});
  }

  if (targets.length === 0) return false;

  // Find closest target that is shorter
  for (var t = 0; t < targets.length; t++) {
    var target = targets[t];
    if (target.snake.length >= ai.snake.length) continue;

    // Check if target is near a wall
    var targetHead = target.snake[0];
    var nearWall = (
      targetHead.x <= -half + 3 || targetHead.x >= half - 3 ||
      targetHead.z <= -half + 3 || targetHead.z >= half - 3
    );

    if (nearWall) {
      // Try to position between target and nearest exit
      var dx = targetHead.x - ai.snake[0].x;
      var dz = targetHead.z - ai.snake[0].z;
      var dist = Math.abs(dx) + Math.abs(dz);
      if (dist < 8) {
        log('AI cornering target at (' + targetHead.x + ',' + targetHead.z + ')');
        return true; // activate cornering
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

    // Decide direction
    ai.direction = aiDecideDirection(index, difficulty);

    // Calculate new head position
    var head = ai.snake[0];
    var nx = head.x + Math.round(Math.cos(ai.direction));
    var nz = head.z + Math.round(Math.sin(ai.direction));

    // Check wall collision
    if (nx < -half || nx >= half || nz < -half || nz >= half) {
      log('AI ' + index + ' hit wall at (' + nx + ',' + nz + ')');
      aiDie(index);
      return;
    }

    // Check self collision
    if (ai.snake.some(function(s) { return s.x === nx && s.z === nz; })) {
      log('AI ' + index + ' hit self at (' + nx + ',' + nz + ')');
      aiDie(index);
      return;
    }

    // Check obstacle collision
    if (obstacles.some(function(o) { return o.x === nx && o.z === nz; })) {
      log('AI ' + index + ' hit obstacle at (' + nx + ',' + nz + ')');
      aiDie(index);
      return;
    }

    // Check corpse collision
    if (corpses && corpses.some(function(c) { return c.x === nx && c.z === nz; })) {
      log('AI ' + index + ' hit corpse at (' + nx + ',' + nz + ')');
      aiDie(index);
      return;
    }

    // Check collision with player snake
    if (snake.some(function(s) { return s.x === nx && s.z === nz; })) {
      log('AI ' + index + ' hit player at (' + nx + ',' + nz + ')');
      aiDie(index);
      return;
    }

    // Check collision with other AI snakes
    for (var i = 0; i < aiSnakes.length; i++) {
      if (i === index) continue;
      var other = aiSnakes[i];
      if (!other.alive) continue;
      if (other.snake.some(function(s) { return s.x === nx && s.z === nz; })) {
        log('AI ' + index + ' hit AI ' + i + ' at (' + nx + ',' + nz + ')');
        aiDie(index);
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
        // Respawn apple
        var newA = spawnOneApple();
        apples[i] = newA;
        log('AI ' + index + ' ate apple at (' + nx + ',' + nz + ')');
        break;
      }
    }

    if (!ate) ai.snake.pop();
  });
}

// ─── AI snake dies ───
function aiDie(aiIndex) {
  var ai = aiSnakes[aiIndex];
  if (!ai || !ai.alive) return;

  ai.alive = false;

  // Convert body to corpse
  if (!corpses) corpses = [];
  ai.snake.forEach(function(seg) {
    corpses.push({x: seg.x, z: seg.z});
  });

  // Particles
  if (ai.snake.length) {
    burst(ai.snake[0].x, ai.snake[0].z, 0xff4444, 8);
  }

  log('AI ' + aiIndex + ' died — ' + corpses.length + ' corpse segments');
}

// ─── Refresh AI snake meshes ───
function refreshAISnakes() {
  if (!aiSnakes || !aiSnakes.length) return;

  aiSnakes.forEach(function(ai, index) {
    if (!ai.alive || !ai.groupData || !ai.groupData.bodyMs || !ai.groupData.bodyMs.length) return;
    refreshSnake(ai.snake, ai.groupData);
  });
}
