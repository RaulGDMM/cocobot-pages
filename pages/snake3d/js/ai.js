// ─── AI OPPONENTS ───
// AI snake logic: movement, collision, death → apples, difficulty levels
//
// Strategies (activated per difficulty):
//   Easy:   flood fill (shallow) + apple attraction
//   Medium: BFS pathfinding + flood fill + tail-chasing
//   Hard:   BFS + flood fill + tail-chasing + lookahead + hunting + anti-trap

// ─── Difficulty strategy config ───
// Controls which strategies each difficulty level uses
var AI_STRATEGY = {
  easy: {
    bfsPathfinding: false,
    floodFillDepth: 15,
    tailChasing: false,
    lookahead: false,
    bestApple: false,
    hunting: false,
    antiTrap: true,
    minSpaceFactor: 1.5,
    errorRate: 0.38,
    corneringRate: 0.00,
    spaceCheckRelaxation: 0.25,
    playerPerceptionRadius: 5
  },
  medium: {
    bfsPathfinding: true,
    floodFillDepth: 40,
    tailChasing: true,
    lookahead: false,
    bestApple: true,
    hunting: false,
    antiTrap: true,
    minSpaceFactor: 1.7,
    errorRate: 0.10,
    corneringRate: 0.40,
    spaceCheckRelaxation: 0.07,
    playerPerceptionRadius: 14
  },
  hard: {
    bfsPathfinding: true,
    floodFillDepth: 120,
    tailChasing: true,
    lookahead: true,
    bestApple: true,
    hunting: true,
    antiTrap: true,
    minSpaceFactor: 1.3,
    errorRate: 0.02,
    corneringRate: 0.85,
    spaceCheckRelaxation: 0.00,
    playerPerceptionRadius: -1
  }
};

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

// ─── Direction vectors ───
var DIRS = [{x:1,z:0},{x:-1,z:0},{x:0,z:1},{x:0,z:-1}];

// ─── Build blocked cells lookup ───
// Returns an object with "x,z" keys for all occupied cells
// Used by BFS, flood fill, etc. — build once per tick
function buildBlockedSet(excludeSnake) {
  var blocked = {};
  // Player snake
  if (snake.length) {
    for (var i = 0; i < snake.length; i++) blocked[snake[i].x + ',' + snake[i].z] = true;
  }
  // Obstacles
  for (var i = 0; i < obstacles.length; i++) blocked[obstacles[i].x + ',' + obstacles[i].z] = true;
  // Other AI snakes
  if (aiSnakes) {
    for (var i = 0; i < aiSnakes.length; i++) {
      if (!aiSnakes[i].alive) continue;
      if (aiSnakes[i].id === excludeSnake) continue;
      for (var j = 0; j < aiSnakes[i].snake.length; j++) {
        blocked[aiSnakes[i].snake[j].x + ',' + aiSnakes[i].snake[j].z] = true;
      }
    }
  }
  return blocked;
}

// ─── BFS pathfinding ───
// Find shortest path from (sx,sz) to (tx,tz) avoiding blocked cells
// Returns array of {x,z} positions (including start and target), or null
function bfsPath(sx, sz, tx, tz, blocked, snakeBody, maxSteps) {
  maxSteps = maxSteps || (gridSize * gridSize);
  var startKey = sx + ',' + sz;
  if (blocked[startKey]) return null;

  var queue = [{x: sx, z: sz}];
  var visited = {};
  var parent = {};
  visited[startKey] = true;
  var steps = 0;

  while (queue.length > 0 && steps < maxSteps) {
    var curr = queue.shift();
    steps++;
    if (curr.x === tx && curr.z === tz) {
      // Reconstruct path
      var path = [];
      var key = tx + ',' + tz;
      while (key) {
        var pos = key.split(',');
        path.unshift({x: parseInt(pos[0]), z: parseInt(pos[1])});
        key = parent[key];
      }
      return path;
    }

    for (var d = 0; d < DIRS.length; d++) {
      var nx = curr.x + DIRS[d].x;
      var nz = curr.z + DIRS[d].z;
      var key = nx + ',' + nz;
      if (nx < gridMinX || nx >= gridMaxX || nz < gridMinZ || nz >= gridMaxZ) continue;
      if (blocked[key] || visited[key]) continue;
      // For snake body, allow moving to the tail (it will move away)
      if (snakeBody && snakeBody.length > 0) {
        var tail = snakeBody[snakeBody.length - 1];
        if (nx === tail.x && nz === tail.z) {
          // Allow moving to tail position — it will vacate
        } else if (snakeBody.some(function(s) { return s.x === nx && s.z === nz; })) {
          continue;
        }
      }
      visited[key] = true;
      parent[key] = curr.x + ',' + curr.z;
      queue.push({x: nx, z: nz});
    }
  }
  return null;
}

// ─── Count reachable cells using BFS (flood fill) ───
// Returns number of reachable cells from (x,z)
function countReachable(x, z, snakeBody, maxSteps) {
  maxSteps = maxSteps || 50;
  var blocked = buildBlockedSet();
  // Add own snake body (excluding tail which will move)
  if (snakeBody && snakeBody.length > 1) {
    for (var i = 0; i < snakeBody.length - 1; i++) {
      blocked[snakeBody[i].x + ',' + snakeBody[i].z] = true;
    }
  }

  var visited = {};
  var queue = [{x: x, z: z}];
  visited[x + ',' + z] = true;
  var count = 0;

  while (queue.length > 0 && count < maxSteps) {
    var curr = queue.shift();
    count++;
    for (var d = 0; d < DIRS.length; d++) {
      var nx = curr.x + DIRS[d].x;
      var nz = curr.z + DIRS[d].z;
      var key = nx + ',' + nz;
      if (nx < gridMinX || nx >= gridMaxX || nz < gridMinZ || nz >= gridMaxZ) continue;
      if (blocked[key] || visited[key]) continue;
      visited[key] = true;
      queue.push({x: nx, z: nz});
    }
  }
  return count;
}

// ─── Count escape routes from a position ───
// Returns number of safe adjacent cells (for anti-trapping)
function countEscapeRoutes(x, z, snakeBody, blocked) {
  var count = 0;
  for (var d = 0; d < DIRS.length; d++) {
    var nx = x + DIRS[d].x;
    var nz = z + DIRS[d].z;
    if (nx < gridMinX || nx >= gridMaxX || nz < gridMinZ || nz >= gridMaxZ) continue;
    var key = nx + ',' + nz;
    if (blocked[key]) continue;
    // Check snake body (allow tail)
    if (snakeBody && snakeBody.length > 0) {
      var isBody = false;
      for (var i = 0; i < snakeBody.length - 1; i++) {
        if (snakeBody[i].x === nx && snakeBody[i].z === nz) { isBody = true; break; }
      }
      if (isBody) continue;
    }
    count++;
  }
  return count;
}

// ─── BFS path to own tail (tail-chasing) ───
// When no path to apple, chase own tail to survive
function bfsPathToTail(aiSnake) {
  if (!aiSnake || aiSnake.length < 2) return null;
  var tail = aiSnake[aiSnake.length - 1];
  var blocked = buildBlockedSet();
  // Block own body except head (start) and tail (target)
  for (var i = 1; i < aiSnake.length - 1; i++) {
    blocked[aiSnake[i].x + ',' + aiSnake[i].z] = true;
  }
  return bfsPath(aiSnake[0].x, aiSnake[0].z, tail.x, tail.z, blocked, null, gridSize * gridSize);
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

// ─── Strategic apple selection ───
// Choose the best apple considering reachability and space after reaching it
function bestApple(aiSnake, blocked, diff) {
  if (!apples || apples.length === 0) return null;

  var candidates = [];
  for (var i = 0; i < apples.length; i++) {
    if (!apples[i]) continue;
    candidates.push(apples[i]);
  }
  if (candidates.length === 0) return null;

  // Easy mode: just pick nearest
  if (!AI_STRATEGY[diff].bestApple) return nearestApple(aiSnake[0].x, aiSnake[0].z);

  // ─── PERFORMANCE: limit to 5 closest candidates ───
  // Running a full BFS per apple is expensive. With 50+ death apples,
  // doing 50+ BFS calls per AI snake per tick kills the framerate.
  // Sort by distance, take the 5 closest, and only run BFS on those.
  var MAX_CANDIDATES = 5;
  if (candidates.length > MAX_CANDIDATES) {
    candidates.sort(function(a, b) {
      var da = Math.abs(a.x - aiSnake[0].x) + Math.abs(a.z - aiSnake[0].z);
      var db = Math.abs(b.x - aiSnake[0].x) + Math.abs(b.z - aiSnake[0].z);
      return da - db;
    });
    candidates.length = MAX_CANDIDATES;
  }

  var best = null;
  var bestScore = -Infinity;
  var head = aiSnake[0];

  for (var i = 0; i < candidates.length; i++) {
    var apple = candidates[i];
    var manhattanDist = Math.abs(apple.x - head.x) + Math.abs(apple.z - head.z);

    // Check if reachable via BFS
    var path = bfsPath(head.x, head.z, apple.x, apple.z, blocked, aiSnake, gridSize * gridSize);
    var reachable = path !== null;

    // Score: prioritize reachable apples, then distance only.
    // Space after reaching is NOT factored in — it caused the AI to
    // systematically avoid edge apples because walls naturally limit
    // reachable cells. The AI should take the nearest reachable apple.
    var score = 0;
    if (reachable) {
      score += 1000; // Reachable is much better
      score -= manhattanDist; // Shorter path is better
    } else {
      score -= manhattanDist * 2; // Penalize unreachable but still consider distance
    }

    if (score > bestScore) {
      bestScore = score;
      best = apple;
    }
  }

  return best;
}

// ─── Multi-tick lookahead ───
// Simulate N moves in a direction, check if result is good
// Returns score: higher = better
function lookaheadScore(aiSnake, dir, steps, blocked) {
  steps = steps || 5;
  var simSnake = [];
  for (var i = 0; i < aiSnake.length; i++) simSnake.push(aiSnake[i]);

  var cx = simSnake[0].x;
  var cz = simSnake[0].z;

  for (var s = 0; s < steps; s++) {
    var nx = cx + Math.round(Math.cos(dir));
    var nz = cz + Math.round(Math.sin(dir));

    // Wall check
    if (nx < gridMinX || nx >= gridMaxX || nz < gridMinZ || nz >= gridMaxZ) return -1000;

    // Self check
    if (simSnake.some(function(seg) { return seg.x === nx && seg.z === nz; })) return -1000;

    // Blocked check
    var key = nx + ',' + nz;
    if (blocked[key]) return -1000;

    simSnake.unshift({x: nx, z: nz});
    simSnake.pop();
    cx = nx;
    cz = nz;
  }

  // Score based on final position
  var space = countReachable(cx, cz, simSnake, 30);
  var escapes = countEscapeRoutes(cx, cz, simSnake, blocked);
  return space + escapes * 5;
}

// ─── Check if a cell is in a shrink danger zone ───
// Returns true if the cell is OUTSIDE the future safe zone of any active countdown
function cellInShrinkZone(x, z) {
  if (!shrinkCountdowns || shrinkCountdowns.length === 0) return false;
  for (var i = 0; i < shrinkCountdowns.length; i++) {
    var cd = shrinkCountdowns[i];
    var b = calcShrinkBoundsFromCurrent(cd);
    if (x < b.newMinX || x >= b.newMaxX || z < b.newMinZ || z >= b.newMaxZ) {
      return true;
    }
  }
  return false;
}

// ─── Evaluate safe directions for an AI snake ───
// perceptionRadius: max Manhattan distance at which the AI "sees" the player.
//   -1 = infinite (hard mode, always sees player).
//   Positive number = limited perception (easy/medium).
function aiEvaluateDirections(aiIndex, aiSnake, aiDir, perceptionRadius) {
  var possibleDirs = [
    aiDir,
    aiDir - TURN_ANGLE,
    aiDir + TURN_ANGLE
  ];

  var safe = [];
  var head = aiSnake[0];

  // ─── Player perception: does the AI "see" the player? ───
  var canSeePlayer = (perceptionRadius < 0); // -1 = infinite vision
  if (!canSeePlayer && snake.length > 0) {
    var manhattanToPlayer = Math.abs(snake[0].x - head.x) + Math.abs(snake[0].z - head.z);
    canSeePlayer = (manhattanToPlayer <= perceptionRadius);
  }

  possibleDirs.forEach(function(dir) {
    var nx = head.x + Math.round(Math.cos(dir));
    var nz = head.z + Math.round(Math.sin(dir));

    if (nx < gridMinX || nx >= gridMaxX || nz < gridMinZ || nz >= gridMaxZ) return;
    if (aiSnake.some(function(s) { return s.x === nx && s.z === nz; })) return;
    if (obstacles.some(function(o) { return o.x === nx && o.z === nz; })) return;
    // Player snake: only treated as obstacle if AI can "see" it
    if (canSeePlayer && snake.some(function(s) { return s.x === nx && s.z === nz; })) return;
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

// ─── Check if a position is near a board edge ───
// Used to relax space requirements near walls where space is naturally constrained
function isNearEdge(x, z, margin) {
  margin = margin || 3;
  return (x <= gridMinX + margin || x >= gridMaxX - margin ||
          z <= gridMinZ + margin || z >= gridMaxZ - margin);
}

// ─── Minimum safe space check ───
// Returns true if moving to (nx,nz) would leave enough reachable space
// for the snake to survive. This is the KEY anti-coiling mechanism.
// Near board edges, space requirements are relaxed since walls naturally
// constrain movement — without this, the AI would loop endlessly near edges.
function minSafeSpace(nx, nz, snakeBody, blocked, minSpace) {
  // Quick check: count reachable space from this position
  var bodyBlocked = {};
  for (var k in blocked) bodyBlocked[k] = true;
  // Add own body (excluding tail)
  if (snakeBody && snakeBody.length > 1) {
    for (var i = 0; i < snakeBody.length - 1; i++) {
      bodyBlocked[snakeBody[i].x + ',' + snakeBody[i].z] = true;
    }
  }

  var visited = {};
  var queue = [{x: nx, z: nz}];
  visited[nx + ',' + nz] = true;
  var count = 0;

  while (queue.length > 0 && count < minSpace + 10) {
    var curr = queue.shift();
    count++;
    for (var d = 0; d < DIRS.length; d++) {
      var nnx = curr.x + DIRS[d].x;
      var nnz = curr.z + DIRS[d].z;
      var key = nnx + ',' + nnz;
      if (nnx < gridMinX || nnx >= gridMaxX || nnz < gridMinZ || nnz >= gridMaxZ) continue;
      if (bodyBlocked[key] || visited[key]) continue;
      visited[key] = true;
      queue.push({x: nnx, z: nnz});
    }
  }

  // Near edges, relax the requirement — walls naturally limit space.
  // Margin: ~5 for grid 22, ~8 for grid 40. Must leave a center zone
  // so the full check still applies in the middle of the board.
  var half = Math.floor((gridMaxX - gridMinX) / 2);
  var edgeMargin = Math.min(Math.ceil(half / 2.5), half - 2);
  edgeMargin = Math.max(edgeMargin, 4);
  if (isNearEdge(nx, nz, edgeMargin)) {
    return count >= Math.floor(minSpace * 0.5);
  }
  return count >= minSpace;
}

// ─── Cornering/hunting strategy ───
// Actively try to block and corner smaller snakes
function aiCorneringStrategy(aiIndex, diff) {
  var ai = aiSnakes[aiIndex];
  if (!ai || !ai.alive) return null;

  var corneringRate = AI_STRATEGY[diff].corneringRate || 0;
  if (Math.random() > corneringRate) return null;
  if (!AI_STRATEGY[diff].hunting) return null;

  var targets = [];
  if (snake.length > 0) targets.push({snake: snake, isPlayer: true});
  for (var i = 0; i < aiSnakes.length; i++) {
    if (i === aiIndex) continue;
    if (!aiSnakes[i].alive) continue;
    targets.push({snake: aiSnakes[i].snake, isPlayer: false});
  }
  if (targets.length === 0) return null;

  for (var t = 0; t < targets.length; t++) {
    var target = targets[t];
    // Only hunt snakes that are equal or smaller
    if (target.snake.length > ai.snake.length + 2) continue;

    var targetHead = target.snake[0];
    var targetTail = target.snake[target.snake.length - 1];

    // Check if target is near a wall or obstacle — good hunting opportunity
    var nearWall = (
      targetHead.x <= gridMinX + 3 || targetHead.x >= gridMaxX - 3 ||
      targetHead.z <= gridMinZ + 3 || targetHead.z >= gridMaxZ - 3
    );

    var nearObstacle = false;
    for (var o = 0; o < obstacles.length; o++) {
      var odx = Math.abs(obstacles[o].x - targetHead.x);
      var odz = Math.abs(obstacles[o].z - targetHead.z);
      if (odx + odz < 4) { nearObstacle = true; break; }
    }

    if (nearWall || nearObstacle) {
      var dx = targetHead.x - ai.snake[0].x;
      var dz = targetHead.z - ai.snake[0].z;
      var dist = Math.abs(dx) + Math.abs(dz);
      // Only hunt if close enough
      if (dist < 10) {
        // Try to position behind the target (near its tail)
        var blocked = buildBlockedSet();
        var pathToTail = bfsPath(
          ai.snake[0].x, ai.snake[0].z,
          targetTail.x, targetTail.z,
          blocked, ai.snake, gridSize * gridSize
        );
        if (pathToTail && pathToTail.length > 1) {
          log('AI ' + aiIndex + ' hunting target at (' + targetHead.x + ',' + targetHead.z + ')');
          return pathToTail[1]; // Next step toward tail
        }
      }
    }
  }
  return null;
}

// ─── Detect if AI is stuck in a loop ───
// Returns true if the AI head has visited very few unique positions in recent ticks
function aiIsStuck(ai) {
  if (!ai.stuckHistory || ai.stuckHistory.length < 6) return false;
  // Count unique positions in the history
  var unique = {};
  for (var i = 0; i < ai.stuckHistory.length; i++) {
    var key = ai.stuckHistory[i].x + ',' + ai.stuckHistory[i].z;
    unique[key] = true;
  }
  var uniqueCount = Object.keys(unique).length;
  // If the AI has visited <= 2 unique positions in 6 ticks, it's stuck
  return uniqueCount <= 2;
}

// ─── Decide direction for AI snake based on difficulty ───
// Main decision function — integrates all strategies
function aiDecideDirection(aiIndex, diff) {
  var ai = aiSnakes[aiIndex];
  if (!ai || !ai.alive) return ai.direction;

  // ─── Track position history for stuck detection ───
  // Only add to history if the head actually moved (avoids false positives in static scenarios)
  if (!ai.stuckHistory) ai.stuckHistory = [];
  var head = ai.snake[0];
  var lastPos = ai.stuckHistory.length > 0 ? ai.stuckHistory[ai.stuckHistory.length - 1] : null;
  if (!lastPos || lastPos.x !== head.x || lastPos.z !== head.z) {
    ai.stuckHistory.push({x: head.x, z: head.z});
    if (ai.stuckHistory.length > 6) ai.stuckHistory.shift();
  }

  // ─── If stuck, force a random safe direction to break the loop ───
  if (aiIsStuck(ai)) {
    var stratStuck = AI_STRATEGY[diff] || AI_STRATEGY.medium;
    var safe = aiEvaluateDirections(aiIndex, ai.snake, ai.direction, stratStuck.playerPerceptionRadius);
    if (safe.length > 1) {
      // Pick a random safe direction (not the current one)
      var newDirs = safe.filter(function(d) { return d !== ai.direction; });
      if (newDirs.length > 0) {
        var chosen = newDirs[Math.floor(Math.random() * newDirs.length)];
        log('AI ' + aiIndex + ' stuck — forcing random direction');
        ai.stuckHistory = []; // Reset history
        return chosen;
      }
    }
    // If only one safe direction, reset history to avoid false positives
    ai.stuckHistory = [];
  }

  var strat = AI_STRATEGY[diff] || AI_STRATEGY.medium;
  var safe = aiEvaluateDirections(aiIndex, ai.snake, ai.direction, strat.playerPerceptionRadius);
  if (safe.length === 0) return ai.direction;

  // ─── Build blocked set ───
  var blocked = buildBlockedSet();
  for (var i = 1; i < ai.snake.length; i++) {
    blocked[ai.snake[i].x + ',' + ai.snake[i].z] = true;
  }

  // ─── CRITICAL: Filter safe directions by minimum reachable space ───
  // This is the main anti-coiling mechanism. The AI will NOT commit to a
  // direction unless it has enough reachable space to survive.
  var minSpace = Math.ceil(ai.snake.length * (strat.minSpaceFactor || 2.0));
  var safeWithSpace = [];

  // ─── Space check relaxation (human-like imperfection) ───
  // In easy/medium, the AI occasionally accepts a direction with tight space,
  // mimicking a human player who misjudges risk. Hard mode stays 100% rigorous.
  var spaceRelaxation = strat.spaceCheckRelaxation || 0;

  for (var s = 0; s < safe.length; s++) {
    var nx = ai.snake[0].x + Math.round(Math.cos(safe[s]));
    var nz = ai.snake[0].z + Math.round(Math.sin(safe[s]));
    if (minSafeSpace(nx, nz, ai.snake, blocked, minSpace)) {
      safeWithSpace.push(safe[s]);
    } else if (spaceRelaxation > 0 && Math.random() < spaceRelaxation) {
      // Human-like mistake: accept tight space direction
      safeWithSpace.push(safe[s]);
    }
  }

  // If NO direction has enough space, fall back to safe directions
  // and pick the one with the most reachable space (survival mode)
  if (safeWithSpace.length === 0) {
    var bestSpace = -1;
    var bestDir = safe[0];
    for (var s = 0; s < safe.length; s++) {
      var nx = ai.snake[0].x + Math.round(Math.cos(safe[s]));
      var nz = ai.snake[0].z + Math.round(Math.sin(safe[s]));
      var space = countReachable(nx, nz, ai.snake, strat.floodFillDepth || 50);
      // Penalize shrink danger zone in survival mode
      if (cellInShrinkZone(nx, nz)) space -= 20;
      if (space > bestSpace) {
        bestSpace = space;
        bestDir = safe[s];
      }
    }
    return snapToCardinal(bestDir);
  }

  // If only 1 direction has enough space, take it
  if (safeWithSpace.length === 1) return snapToCardinal(safeWithSpace[0]);

  // Random error based on difficulty (only among space-safe directions)
  var errorRate = strat.errorRate;
  if (Math.random() < errorRate) {
    return snapToCardinal(safeWithSpace[Math.floor(Math.random() * safeWithSpace.length)]);
  }

  // ─── Strategy 1: Hunting (hard only) ───
  var huntTarget = aiCorneringStrategy(aiIndex, diff);
  if (huntTarget) {
    for (var s = 0; s < safeWithSpace.length; s++) {
      var nx = ai.snake[0].x + Math.round(Math.cos(safeWithSpace[s]));
      var nz = ai.snake[0].z + Math.round(Math.sin(safeWithSpace[s]));
      if (nx === huntTarget.x && nz === huntTarget.z) {
        return snapToCardinal(safeWithSpace[s]);
      }
    }
  }

  // ─── Strategy 2: BFS pathfinding to best apple ───
  if (strat.bfsPathfinding) {
    var targetApple = bestApple(ai.snake, blocked, diff);
    if (targetApple) {
      var path = bfsPath(
        ai.snake[0].x, ai.snake[0].z,
        targetApple.x, targetApple.z,
        blocked, ai.snake, gridSize * gridSize
      );
      if (path && path.length > 1) {
        var nextStep = path[1];
        for (var s = 0; s < safeWithSpace.length; s++) {
          var nx = ai.snake[0].x + Math.round(Math.cos(safeWithSpace[s]));
          var nz = ai.snake[0].z + Math.round(Math.sin(safeWithSpace[s]));
          if (nx === nextStep.x && nz === nextStep.z) {
            // Anti-trap: verify escape routes — but SKIP when apple is very close (≤2 steps)
            // This prevents the AI from refusing to take the last step to an edge apple
            if (strat.antiTrap) {
              var manhattanToApple = Math.abs(nextStep.x - targetApple.x) + Math.abs(nextStep.z - targetApple.z);
              if (manhattanToApple > 2) {
                var escapes = countEscapeRoutes(nx, nz, ai.snake, blocked);
                // Near edges, 1 escape is acceptable (wall constrains movement naturally)
                var nearEdge = (nx <= gridMinX + 1 || nx >= gridMaxX - 1 ||
                                nz <= gridMinZ + 1 || nz >= gridMaxZ - 1);
                if (escapes < (nearEdge ? 1 : 2)) continue;
              }
            }
            // Lookahead: verify future positions
            if (strat.lookahead) {
              var laScore = lookaheadScore(ai.snake, safeWithSpace[s], 5, blocked);
              if (laScore < -500) continue;
            }
            return snapToCardinal(safeWithSpace[s]);
          }
        }
      }
    }
  }

  // ─── Strategy 3: Tail-chasing (survival mode) ───
  if (strat.tailChasing) {
    var tailPath = bfsPathToTail(ai.snake);
    if (tailPath && tailPath.length > 1) {
      var tailNext = tailPath[1];
      for (var s = 0; s < safeWithSpace.length; s++) {
        var nx = ai.snake[0].x + Math.round(Math.cos(safeWithSpace[s]));
        var nz = ai.snake[0].z + Math.round(Math.sin(safeWithSpace[s]));
        if (nx === tailNext.x && nz === tailNext.z) {
          return snapToCardinal(safeWithSpace[s]);
        }
      }
    }
  }

  // ─── Fallback: score directions — APPLE DISTANCE first, space second ───
  // CRITICAL: apple distance MUST dominate. If space dominates (like *3 or *10),
  // the AI will always prefer center directions and never take edge apples.
  var bestScore = -Infinity;
  var bestDir = safeWithSpace[0];
  var target = nearestApple(ai.snake[0].x, ai.snake[0].z);

  for (var s = 0; s < safeWithSpace.length; s++) {
    var nx = ai.snake[0].x + Math.round(Math.cos(safeWithSpace[s]));
    var nz = ai.snake[0].z + Math.round(Math.sin(safeWithSpace[s]));

    var score = 0;

    // PRIMARY: distance to nearest apple (lower = better)
    // This is the main driver — the AI should move toward the apple.
    if (target) {
      var distToApple = Math.abs(target.x - nx) + Math.abs(target.z - nz);
      score -= distToApple * 5; // Strong apple attraction
    }

    // SECONDARY: space is a tiebreaker, NOT the main driver
    // A small multiplier ensures space matters but doesn't override apple distance.
    var space = countReachable(nx, nz, ai.snake, strat.floodFillDepth || 50);
    score += space;

    // Prefer directions with more escape routes (small bonus)
    var escapes = countEscapeRoutes(nx, nz, ai.snake, blocked);
    score += escapes;

    // ─── Penalize shrink danger zone ───
    if (cellInShrinkZone(nx, nz)) {
      score -= 500; // Strong penalty to avoid cells that will disappear
    }

    if (score > bestScore) {
      bestScore = score;
      bestDir = safeWithSpace[s];
    }
  }

  return snapToCardinal(bestDir);
}

// ─── Initialize AI snakes ───
function initAI() {
  log('=== initAI() mode=' + gameMode + ' diff=' + difficulty + ' ===');
  aiSnakes = [];

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
    if (nx < gridMinX || nx >= gridMaxX || nz < gridMinZ || nz >= gridMaxZ) {
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
        appleDirty = true;
        if (typeof rebuildAppleSet === 'function') rebuildAppleSet();
        // Deduplicate in case a duplicate was spawned at the same position
        if (typeof deduplicateApples === 'function') deduplicateApples();
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

  // ─── Hide AI snake mesh group so the dead body disappears ───
  if (ai.groupData && ai.groupData.group) {
    ai.groupData.group.visible = false;
  }

  // ─── Convert body to apples (collectible by anyone) ───
  // Every segment becomes an apple. Use addToAppleSet() for O(1)
  // per-apple hash update. Do NOT call refreshApples() here — the
  // game loop will call it on the next tick when appleDirty is true.
  var appleCount = 0;
  for (var i = ai.snake.length - 1; i >= 0; i--) {
    var seg = ai.snake[i];
    if (seg.x >= gridMinX && seg.x < gridMaxX && seg.z >= gridMinZ && seg.z < gridMaxZ) {
      var newApple = {x: seg.x, z: seg.z, fromDeath: true};
      apples.push(newApple);
      if (typeof addToAppleSet === 'function') addToAppleSet(newApple);
      appleCount++;
    }
  }
  if (appleCount > 0) {
    log('AI ' + aiIndex + ' body → ' + appleCount + ' apples');
    appleDirty = true;
  }

  // Particles
  if (ai.snake.length) {
    burst(ai.snake[0].x, ai.snake[0].z, 0xff4444, 8);
  }

  // Show death message
  showAiDeathMessage(ai, cause);

  // ─── Trigger grid shrink on AI death ───
  maybeTriggerShrink();

  log('AI ' + aiIndex + ' died (' + cause + ')');
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

// ─── Module exports (for testing — ignored in browser) ───
if(typeof module !== 'undefined' && module.exports) {
  module.exports = {
    snapToCardinal,
    buildBlockedSet,
    bfsPath,
    countReachable,
    countEscapeRoutes,
    bfsPathToTail,
    nearestApple,
    bestApple,
    lookaheadScore,
    aiEvaluateDirections,
    aiDecideDirection,
    aiCorneringStrategy,
    minSafeSpace,
    cellInShrinkZone,
    aiIsStuck,
  isNearEdge,
    AI_STRATEGY,
    DIRS
  };
}
