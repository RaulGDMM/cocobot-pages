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
// Used by BFS, flood fill, etc.
//
// PERFORMANCE: building this set involves string concatenation over every
// snake segment, obstacle and corpse cell. With 8 snakes + a 50-segment
// corpse, a single AI decision rebuilds it ~5 times (countReachable per
// direction, bfsPathToTail, etc.), and there are 8 decisions per tick.
// To avoid that O(n) recompute storm we cache the result during stepAI:
//   • _blockedCacheEnabled is turned on only inside stepAI.
//   • The cache is marked dirty at the start of each snake's turn (the only
//     moment the board changes — a snake moved/died), so every decision still
//     sees an up-to-date set with identical contents to a fresh build.
//   • Callers that MUTATE the set (add their own body) must clone it first
//     via cloneBlocked(), since the cached object is shared and read-only.
// Outside stepAI (tests, ad-hoc calls) caching stays off → always fresh.
var _blockedCache = null;
var _blockedCacheEnabled = false;
var _blockedCacheDirty = true;

function _computeBlockedSet(excludeSnake) {
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
  // Corpses (unconverted segments are solid obstacles) — O(1) via corpseSet
  if (corpseSet) {
    for (var key in corpseSet) {
      blocked[key] = true;
    }
  }
  return blocked;
}

function buildBlockedSet(excludeSnake) {
  // The excludeSnake variant is rare and not cacheable — always fresh.
  if (excludeSnake !== undefined && excludeSnake !== null) {
    return _computeBlockedSet(excludeSnake);
  }
  if (_blockedCacheEnabled) {
    if (_blockedCacheDirty || !_blockedCache) {
      _blockedCache = _computeBlockedSet();
      _blockedCacheDirty = false;
    }
    return _blockedCache;
  }
  return _computeBlockedSet();
}

// Shallow clone of a blocked set. Used by callers that need to add their own
// body cells without polluting the shared per-tick cache.
function cloneBlocked(b) {
  var o = {};
  for (var k in b) o[k] = true;
  return o;
}

// Cache lifecycle helpers — used by stepAI to bound the cache to a single tick.
function enableBlockedCache() { _blockedCacheEnabled = true; _blockedCacheDirty = true; }
function disableBlockedCache() { _blockedCacheEnabled = false; _blockedCache = null; _blockedCacheDirty = true; }
function invalidateBlockedCache() { _blockedCacheDirty = true; }

// ─── BFS pathfinding ───
// Find shortest path from (sx,sz) to (tx,tz) avoiding blocked cells
// Returns array of {x,z} positions (including start and target), or null
function bfsPath(sx, sz, tx, tz, blocked, snakeBody, maxSteps) {
  maxSteps = maxSteps || (gridSize * gridSize);
  var startKey = sx + ',' + sz;
  if (blocked[startKey]) return null;

  // Precompute snake-body occupancy once (excluding the tail, which vacates).
  // Replaces the O(body) snakeBody.some() scan that ran on every cell
  // expansion — a major cost once snakes grow long after several deaths.
  var bodySet = null;
  if (snakeBody && snakeBody.length > 1) {
    bodySet = {};
    for (var b = 0; b < snakeBody.length - 1; b++) {
      bodySet[snakeBody[b].x + ',' + snakeBody[b].z] = true;
    }
  }

  var queue = [{x: sx, z: sz}];
  var qHead = 0; // index pointer — O(1) dequeue instead of Array.shift() (O(n))
  var visited = {};
  var parent = {};
  visited[startKey] = true;
  var steps = 0;

  while (qHead < queue.length && steps < maxSteps) {
    var curr = queue[qHead++];
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
      // Snake body blocks movement except the tail cell (it will vacate).
      if (bodySet && bodySet[key]) continue;
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
  // Use the shared cached blocked set directly and track this snake's body in
  // a small separate set. This avoids cloning the (potentially large) blocked
  // map on every call — countReachable runs several times per snake per tick.
  var blocked = buildBlockedSet();
  var bodySet = null;
  if (snakeBody && snakeBody.length > 1) {
    bodySet = {};
    for (var i = 0; i < snakeBody.length - 1; i++) {
      bodySet[snakeBody[i].x + ',' + snakeBody[i].z] = true;
    }
  }

  var visited = {};
  var queue = [{x: x, z: z}];
  var qHead = 0; // O(1) dequeue instead of Array.shift()
  visited[x + ',' + z] = true;
  var count = 0;

  while (qHead < queue.length && count < maxSteps) {
    var curr = queue[qHead++];
    count++;
    for (var d = 0; d < DIRS.length; d++) {
      var nx = curr.x + DIRS[d].x;
      var nz = curr.z + DIRS[d].z;
      var key = nx + ',' + nz;
      if (nx < gridMinX || nx >= gridMaxX || nz < gridMinZ || nz >= gridMaxZ) continue;
      if (blocked[key] || (bodySet && bodySet[key]) || visited[key]) continue;
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
  // Clone the cached blocked set — we add own body cells below.
  var blocked = cloneBlocked(buildBlockedSet());
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

  // Easy mode: just pick nearest
  if (!AI_STRATEGY[diff].bestApple) return nearestApple(aiSnake[0].x, aiSnake[0].z);

  // ─── PERFORMANCE: select 5 closest candidates (O(n) partial selection) ───
  // Running a full BFS per apple is expensive. With 50+ death apples,
  // doing 50+ BFS calls per AI snake per tick kills the framerate.
  // Use partial selection to find the 5 closest without storing/sorting all.
  var MAX_CANDIDATES = 5;
  var hx = aiSnake[0].x, hz = aiSnake[0].z;
  var top = [];
  for (var c = 0; c < apples.length; c++) {
    var cand = apples[c];
    if (!cand) continue;
    var dist = Math.abs(cand.x - hx) + Math.abs(cand.z - hz);
    var inserted = false;
    for (var t = 0; t < top.length; t++) {
      if (dist < top[t].dist) {
        top.splice(t, 0, {apple: cand, dist: dist});
        inserted = true;
        break;
      }
    }
    if (!inserted && top.length < MAX_CANDIDATES) {
      top.push({apple: cand, dist: dist});
    }
    if (top.length > MAX_CANDIDATES) {
      top.length = MAX_CANDIDATES;
    }
  }
  if (top.length === 0) return null;

  var best = null;
  var bestScore = -Infinity;
  var head = aiSnake[0];

  for (var i = 0; i < top.length; i++) {
    var apple = top[i].apple;
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
  if (!shrinkCountdowns || shrinkCountdowns.length === 0) {
    return false;
  }
  for (var i = 0; i < shrinkCountdowns.length; i++) {
    var cd = shrinkCountdowns[i];
    var b = calcShrinkBoundsFromCurrent(cd);
    if (x < b.newMinX || x >= b.newMaxX || z < b.newMinZ || z >= b.newMaxZ) {
      return true;
    }
  }
  return false;
}

// ─── Debug: log shrink state ───
function logShrinkState(label) {
  if (!shrinkCountdowns || shrinkCountdowns.length === 0) {
    log('['+label+'] NO countdowns active (shrinkCountdowns='+(shrinkCountdowns?shrinkCountdowns.length:'null')+')');
    return;
  }
  for (var i = 0; i < shrinkCountdowns.length; i++) {
    var cd = shrinkCountdowns[i];
    var b = calcShrinkBoundsFromCurrent(cd);
    var elapsed = (performance.now() - cd.startTime) / 1000;
    log('['+label+'] cd['+i+']: elapsed='+elapsed.toFixed(1)+'s/'+(cd.duration/1000)+'s shrink='+cd.shrinkAmount+' offset=('+cd.offsetX+','+cd.offsetZ+') safe=('+b.newMinX+','+b.newMinZ+')-('+b.newMaxX+','+b.newMaxZ+') grid=('+gridMinX+','+gridMinZ+')-('+gridMaxX+','+gridMaxZ+')');
  }
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

    // Corpses (unconverted segments are solid) — O(1) via corpseSet
    if (corpseSet && corpseSet[nx + ',' + nz]) return;

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
  // Track own body (excluding tail) in a small set instead of copying the
  // entire blocked map on every call. minSafeSpace runs once per candidate
  // direction per snake, so the per-call copy was pure overhead.
  var bodySet = null;
  if (snakeBody && snakeBody.length > 1) {
    bodySet = {};
    for (var i = 0; i < snakeBody.length - 1; i++) {
      bodySet[snakeBody[i].x + ',' + snakeBody[i].z] = true;
    }
  }

  var visited = {};
  var queue = [{x: nx, z: nz}];
  var qHead = 0; // O(1) dequeue instead of Array.shift()
  visited[nx + ',' + nz] = true;
  var count = 0;

  while (qHead < queue.length && count < minSpace + 10) {
    var curr = queue[qHead++];
    count++;
    for (var d = 0; d < DIRS.length; d++) {
      var nnx = curr.x + DIRS[d].x;
      var nnz = curr.z + DIRS[d].z;
      var key = nnx + ',' + nnz;
      if (nnx < gridMinX || nnx >= gridMaxX || nnz < gridMinZ || nnz >= gridMaxZ) continue;
      if (blocked[key] || (bodySet && bodySet[key]) || visited[key]) continue;
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
  // Clone the cached set so adding this snake's body doesn't pollute the cache.
  var blocked = cloneBlocked(buildBlockedSet());
  for (var i = 1; i < ai.snake.length; i++) {
    blocked[ai.snake[i].x + ',' + ai.snake[i].z] = true;
  }

  // ─── CRITICAL: If AI head is in shrink danger zone, prioritize ESCAPE ───
  // When the countdown is active and the AI is in the red zone, survival is
  // the ONLY priority. Skip apple-seeking and hunting strategies entirely.
  var headInShrinkZone = cellInShrinkZone(ai.snake[0].x, ai.snake[0].z);
  if (headInShrinkZone) {
    logShrinkState('ESCAPE AI '+aiIndex+' head=('+ai.snake[0].x+','+ai.snake[0].z+')');
  }
  if (headInShrinkZone) {
    // Force survival mode: pick direction that gets OUT of the shrink zone
    var bestEscapeScore = -Infinity;
    var bestEscapeDir = safe[0];

    // Compute the "tightest" future safe zone across all countdowns.
    // We want to move toward the CENTER of that zone.
    var safeCenterX = 0, safeCenterZ = 0;
    var tightMinX = gridMinX, tightMaxX = gridMaxX;
    var tightMinZ = gridMinZ, tightMaxZ = gridMaxZ;
    for (var ci = 0; ci < shrinkCountdowns.length; ci++) {
      var cb = calcShrinkBoundsFromCurrent(shrinkCountdowns[ci]);
      if (cb.newMinX > tightMinX) tightMinX = cb.newMinX;
      if (cb.newMaxX < tightMaxX) tightMaxX = cb.newMaxX;
      if (cb.newMinZ > tightMinZ) tightMinZ = cb.newMinZ;
      if (cb.newMaxZ < tightMaxZ) tightMaxZ = cb.newMaxZ;
    }
    safeCenterX = (tightMinX + tightMaxX) / 2;
    safeCenterZ = (tightMinZ + tightMaxZ) / 2;

    for (var s = 0; s < safe.length; s++) {
      var nx = ai.snake[0].x + Math.round(Math.cos(safe[s]));
      var nz = ai.snake[0].z + Math.round(Math.sin(safe[s]));
      var score = 0;

      // HUGE bonus for moving to a SAFE cell (outside shrink zone)
      if (!cellInShrinkZone(nx, nz)) {
        score += 2000;
      }

      // CRITICAL: distance to safe zone center is the DOMINANT factor.
      // Moving toward center beats everything — space is just a tiebreaker.
      var distBefore = Math.abs(ai.snake[0].x - safeCenterX) + Math.abs(ai.snake[0].z - safeCenterZ);
      var distAfter = Math.abs(nx - safeCenterX) + Math.abs(nz - safeCenterZ);
      score += (distBefore - distAfter) * 500; // Closer to center = much higher score

      // Space is a secondary tiebreaker — avoid dead ends but don't override direction
      var space = countReachable(nx, nz, ai.snake, strat.floodFillDepth || 50);
      score += space;

      // Escape routes: small bonus
      var escapes = countEscapeRoutes(nx, nz, ai.snake, blocked);
      score += escapes * 5;

      if (score > bestEscapeScore) {
        bestEscapeScore = score;
        bestEscapeDir = safe[s];
      }
    }
    log('AI ' + aiIndex + ' in shrink zone — escaping');
    return snapToCardinal(bestEscapeDir);
  }

  // ─── PROACTIVE REPOSITIONING: move toward safe zone while countdown is active ───
  // Don't wait until the head is in danger or urgency is high. As soon as a
  // countdown starts, if the AI is far from the safe zone center, it should
  // start drifting toward it. This prevents losing body segments at shrink time.
  if (shrinkActive) {
    // Compute the "tightest" future safe zone across all countdowns
    var safeCenterX = 0, safeCenterZ = 0;
    var tightMinX = gridMinX, tightMaxX = gridMaxX;
    var tightMinZ = gridMinZ, tightMaxZ = gridMaxZ;
    for (var ci = 0; ci < shrinkCountdowns.length; ci++) {
      var cb = calcShrinkBoundsFromCurrent(shrinkCountdowns[ci]);
      if (cb.newMinX > tightMinX) tightMinX = cb.newMinX;
      if (cb.newMaxX < tightMaxX) tightMaxX = cb.newMaxX;
      if (cb.newMinZ > tightMinZ) tightMinZ = cb.newMinZ;
      if (cb.newMaxZ < tightMaxZ) tightMaxZ = cb.newMaxZ;
    }
    safeCenterX = (tightMinX + tightMaxX) / 2;
    safeCenterZ = (tightMinZ + tightMaxZ) / 2;

    // Check if any body segment is in the shrink zone
    var bodyInShrinkZone = false;
    for (var bi = 1; bi < ai.snake.length; bi++) {
      if (cellInShrinkZone(ai.snake[bi].x, ai.snake[bi].z)) {
        bodyInShrinkZone = true;
        break;
      }
    }

    // Distance from head to safe zone center
    var headDistToCenter = Math.abs(ai.snake[0].x - safeCenterX) + Math.abs(ai.snake[0].z - safeCenterZ);
    // Safe zone half-diagonal — how far from center is still "safe"
    var safeZoneHalfW = (tightMaxX - tightMinX) / 4;
    var safeZoneHalfH = (tightMaxZ - tightMinZ) / 4;

    // Trigger proactive repositioning if:
    // 1. Body is in danger zone (immediate), OR
    // 2. Head is far from safe center (more than 1/4 of safe zone dimension)
    var needsReposition = bodyInShrinkZone ||
      headDistToCenter > (safeZoneHalfW + safeZoneHalfH);

    if (needsReposition) {
      var bestPreScore = -Infinity;
      var bestPreDir = safe[0];

      for (var s = 0; s < safe.length; s++) {
        var nx = ai.snake[0].x + Math.round(Math.cos(safe[s]));
        var nz = ai.snake[0].z + Math.round(Math.sin(safe[s]));
        var score = 0;

        // Direction toward safe center — dominant factor
        var distBefore = Math.abs(ai.snake[0].x - safeCenterX) + Math.abs(ai.snake[0].z - safeCenterZ);
        var distAfter = Math.abs(nx - safeCenterX) + Math.abs(nz - safeCenterZ);
        var dirWeight = bodyInShrinkZone ? 400 : 200;
        score += (distBefore - distAfter) * dirWeight;

        // Strong penalty for moving INTO shrink zone
        if (cellInShrinkZone(nx, nz)) {
          score -= 1500;
        }

        // Space and escapes as tiebreakers — keep it safe
        var space = countReachable(nx, nz, ai.snake, strat.floodFillDepth || 50);
        score += space;
        var escapes = countEscapeRoutes(nx, nz, ai.snake, blocked);
        score += escapes * 5;

        if (score > bestPreScore) {
          bestPreScore = score;
          bestPreDir = safe[s];
        }
      }

      var reason = bodyInShrinkZone ? 'body in shrink zone' : 'far from safe center (dist=' + headDistToCenter.toFixed(0) + ')';
      log('AI ' + aiIndex + ' proactively repositioning (' + reason + ')');
      return snapToCardinal(bestPreDir);
    }
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

  // When shrink countdown is active, directions leading into the danger zone
  // are excluded from safeWithSpace — survival takes priority over everything.
  var shrinkActive = !!(shrinkCountdowns && shrinkCountdowns.length > 0);
  if (shrinkActive) {
    logShrinkState('aiDecide AI '+aiIndex);
  } else {
    log('[aiDecide AI '+aiIndex+'] shrinkActive=FALSE countdowns='+(shrinkCountdowns?shrinkCountdowns.length:0));
  }

  for (var s = 0; s < safe.length; s++) {
    var nx = ai.snake[0].x + Math.round(Math.cos(safe[s]));
    var nz = ai.snake[0].z + Math.round(Math.sin(safe[s]));

    // HARD BLOCK: if shrink is active and direction leads into danger zone, skip
    if (shrinkActive && cellInShrinkZone(nx, nz)) continue;

    if (minSafeSpace(nx, nz, ai.snake, blocked, minSpace)) {
      safeWithSpace.push(safe[s]);
    } else if (spaceRelaxation > 0 && Math.random() < spaceRelaxation) {
      // Human-like mistake: accept tight space direction
      safeWithSpace.push(safe[s]);
    }
  }

  // If shrink blocked ALL space-safe directions, fall back to safe dirs
  // that are OUTSIDE the shrink zone (even if tight on space)
  if (safeWithSpace.length === 0 && shrinkActive) {
    for (var s = 0; s < safe.length; s++) {
      var nx = ai.snake[0].x + Math.round(Math.cos(safe[s]));
      var nz = ai.snake[0].z + Math.round(Math.sin(safe[s]));
      if (!cellInShrinkZone(nx, nz)) {
        safeWithSpace.push(safe[s]);
      }
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
      // HARD BLOCK: if shrink is active and direction leads into danger zone, skip entirely
      if (shrinkActive && cellInShrinkZone(nx, nz)) continue;
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
      // Skip if target apple is in shrink danger zone — survival first
      if (!cellInShrinkZone(targetApple.x, targetApple.z)) {
        var path = bfsPath(
          ai.snake[0].x, ai.snake[0].z,
          targetApple.x, targetApple.z,
          blocked, ai.snake, gridSize * gridSize
        );
        if (path && path.length > 1) {
          // Verify the ENTIRE path doesn't go through shrink zone
          var pathThroughShrink = false;
          for (var p = 1; p < path.length; p++) {
            if (cellInShrinkZone(path[p].x, path[p].z)) {
              pathThroughShrink = true;
              break;
            }
          }
          if (!pathThroughShrink) {
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

// ─── Detect and handle head-on collisions ───
// Called BEFORE stepAI() and step() to find pairs of snakes that would move
// into the same cell. Both die. Returns true if any collision occurred.
function detectAndHandleHeadOnCollisions() {
  if (!aiSnakes || aiSnakes.length === 0) return false;

  var destinations = [];

  // Player destination (only if alive and not spectating)
  if (snake.length > 0 && !gameOver) {
    var px = snake[0].x + Math.round(Math.cos(direction));
    var pz = snake[0].z + Math.round(Math.sin(direction));
    destinations.push({type: 'player', x: px, z: pz});
  }

  // AI destinations
  for (var i = 0; i < aiSnakes.length; i++) {
    var ai = aiSnakes[i];
    if (!ai.alive) continue;
    var ax = ai.snake[0].x + Math.round(Math.cos(ai.direction));
    var az = ai.snake[0].z + Math.round(Math.sin(ai.direction));
    destinations.push({type: 'ai', index: i, x: ax, z: az});
  }

  // Check all pairs for head-on collision
  var handled = {};
  var collisions = [];

  for (var a = 0; a < destinations.length; a++) {
    for (var b = a + 1; b < destinations.length; b++) {
      var da = destinations[a];
      var db = destinations[b];
      if (da.x === db.x && da.z === db.z) {
        if (!handled[a] && !handled[b]) {
          handled[a] = true;
          handled[b] = true;
          collisions.push([da, db]);
        }
      }
    }
  }

  if (collisions.length === 0) return false;

  var colorNames = {green: 'verde', red: 'roja', blue: 'azul', yellow: 'amarilla', cyan: 'cyan', purple: 'púrpura', orange: 'naranja', salmon: 'salmón'};

  // Collect all collision info for the message, then kill snakes
  var allNames = [];
  var totalPoints = 0;
  var allDiedAIIndices = [];

  for (var c = 0; c < collisions.length; c++) {
    var pair = collisions[c];
    var s1 = pair[0], s2 = pair[1];

    if (s1.type === 'player') allNames.push('Tú');
    else allNames.push('serpiente ' + (colorNames[aiSnakes[s1.index].color] || aiSnakes[s1.index].color));

    if (s2.type === 'player') allNames.push('Tú');
    else allNames.push('serpiente ' + (colorNames[aiSnakes[s2.index].color] || aiSnakes[s2.index].color));

    if (s1.type === 'ai') allDiedAIIndices.push(s1.index);
    if (s2.type === 'ai') allDiedAIIndices.push(s2.index);

    log('💥💥 HEAD-ON at (' + s1.x + ',' + s1.z + ')');

    // Kill both snakes
    if (s1.type === 'player') {
      die('headon');
    } else if (s1.type === 'ai') {
      aiDie(s1.index, 'headon');
    }

    if (s2.type === 'player') {
      die('headon');
    } else if (s2.type === 'ai') {
      aiDie(s2.index, 'headon');
    }
  }

  // Count surviving snakes for points
  var livingCount = 0;
  var hasPlayerDeath = allNames.indexOf('Tú') !== -1;
  if (!hasPlayerDeath) {
    // Both AI died — player is alive
    livingCount = 1;
  }
  for (var li = 0; li < aiSnakes.length; li++) {
    if (aiSnakes[li].alive && allDiedAIIndices.indexOf(li) === -1) livingCount++;
  }

  totalPoints = (DEATH_POINTS + KILLER_BONUS) * 2 * collisions.length * livingCount;

  // Show joint head-on collision message AFTER individual death messages
  var nameStr = allNames.join(', ');
  var deadCount = collisions.length * 2;
  var msg = '💥💥 ¡Choque de cabezas entre ' + nameStr + '! 😵 ' + deadCount + ' eliminadas — ' + totalPoints + ' puntos repartidos 🎯';
  var el = document.getElementById('ai-death-msg');
  if (el) {
    el.textContent = msg;
    el.classList.add('visible');
    clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(function() {
      el.classList.remove('visible');
    }, 5000);
  }

  return true;
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

  // Enable the per-tick blocked-set cache for the whole AI phase. Each snake's
  // turn marks it dirty so decisions still see fresh positions, but the
  // expensive recompute happens at most once per snake instead of ~5 times.
  enableBlockedCache();

  aiSnakes.forEach(function(ai, index) {
    if (!ai.alive) return;

    // Board changed since the previous snake moved — refresh the cache.
    invalidateBlockedCache();

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

    // Check collision with corpses (unconverted segments) — O(1) via corpseSet
    if (corpseSet && corpseSet[nx+','+nz]) {
      log('AI ' + index + ' hit corpse at (' + nx + ',' + nz + ')');
      aiDie(index, 'corpse');
      return;
    }

    // Move forward
    ai.snake.unshift({x: nx, z: nz});

    // Check apple eating via O(1) position → index lookup. This matters after
    // multiple deaths, when the board can contain 100+ death apples.
    var ate = false;
    var appleIndexAtHead = (typeof getAppleIndexAt === 'function') ? getAppleIndexAt(nx, nz) : -1;
    if (appleIndexAtHead >= 0) {
        ai.score++;
        ate = true;
        var eatenApple = apples[appleIndexAtHead];
        var newA = (typeof replacementForEatenApple === 'function') ? replacementForEatenApple(eatenApple) : spawnOneApple();
        if (typeof replaceAppleAt === 'function') replaceAppleAt(appleIndexAtHead, newA);
        else { apples[appleIndexAtHead] = newA; if (typeof updateAppleSet === 'function') updateAppleSet(eatenApple, newA, appleIndexAtHead); appleDirty = true; }
        log('AI ' + index + ' ate apple at (' + nx + ',' + nz + ')');
        // Directional eat sound based on AI position relative to player
        if (snake.length > 0) {
          var playerHead = snake[0];
          var panX = (nx - playerHead.x) / Math.max(half, 1);
          sfxAiEat(panX);
        }
    }

    if (!ate) ai.snake.pop();
  });

  // Disable the cache outside the AI phase so other callers always see fresh
  // data (corpse conversion, player step, tests, etc.).
  disableBlockedCache();
}

// ─── DEATH POINTS ───
// When a snake dies, living snakes earn points.
// Killer gets extra bonus.
var DEATH_POINTS = 5;
var KILLER_BONUS = 5; // extra points for the killer (total = DEATH_POINTS + KILLER_BONUS)

// ─── Calculate rankings for all snakes ───
// Returns array of {name, color, score, alive, isPlayer, rank} sorted by rank.
// Tiebreaker: alive > dead, then earlier death order.
function calcRankings() {
  var all = [];

  // Player
  all.push({
    name: 'Tú',
    color: playerColor,
    score: score,
    alive: !gameOver && snake && snake.length > 0,
    isPlayer: true
  });

  // AI snakes
  if (aiSnakes) {
    var colorNames = {green: 'verde', red: 'roja', blue: 'azul', yellow: 'amarilla', cyan: 'cyan', purple: 'púrpura', orange: 'naranja', salmon: 'salmón'};
    for (var i = 0; i < aiSnakes.length; i++) {
      var ai = aiSnakes[i];
      all.push({
        name: colorNames[ai.color] || ai.color,
        color: ai.color,
        score: ai.score,
        alive: ai.alive,
        isPlayer: false
      });
    }
  }

  // Sort: score DESC, alive first, then by original order (death order tiebreaker)
  var originalIndex = 0;
  for (var j = 0; j < all.length; j++) {
    all[j]._orig = j;
  }
  all.sort(function(a, b) {
    if (b.score !== a.score) return b.score - a.score;
    if (a.alive !== b.alive) return b.alive ? 1 : -1; // alive first
    return a._orig - b._orig; // earlier = better (died first or is player)
  });

  // Assign ranks
  for (var k = 0; k < all.length; k++) {
    all[k].rank = k + 1;
  }

  // Clean up temp property
  for (var m = 0; m < all.length; m++) {
    delete all[m]._orig;
  }

  return all;
}

// ─── Get player's current rank ───
function getPlayerRank() {
  var rankings = calcRankings();
  for (var i = 0; i < rankings.length; i++) {
    if (rankings[i].isPlayer) return rankings[i].rank;
  }
  return rankings.length; // fallback
}

// ─── Distribute death points to living snakes ───
// cause: 'wall', 'self', 'obstacle', 'corpse' → all living get DEATH_POINTS
//        'player' → player gets DEATH_POINTS + KILLER_BONUS, others get DEATH_POINTS
//        'ai' → killer AI gets DEATH_POINTS + KILLER_BONUS, others get DEATH_POINTS
function distributeDeathPoints(deadIndex, cause) {
  var killerIndex = -1;

  if (cause === 'player') {
    // Player is the killer
  } else if (cause === 'ai') {
    // Find which AI the dead one hit
    var deadHead = aiSnakes[deadIndex].snake[0];
    for (var i = 0; i < aiSnakes.length; i++) {
      if (i === deadIndex) continue;
      var other = aiSnakes[i];
      if (!other.alive) continue;
      if (other.snake.some(function(s) { return s.x === deadHead.x && s.z === deadHead.z; })) {
        killerIndex = i;
        break;
      }
    }
  }

  // Give points to all living snakes
  if (!gameOver && snake && snake.length > 0) {
    if (cause === 'player') {
      score += DEATH_POINTS + KILLER_BONUS;
    } else {
      score += DEATH_POINTS;
    }
    scoreEl.textContent = score;
  }

  if (aiSnakes) {
    for (var j = 0; j < aiSnakes.length; j++) {
      if (j === deadIndex) continue;
      if (!aiSnakes[j].alive) continue;
      if (j === killerIndex) {
        aiSnakes[j].score += DEATH_POINTS + KILLER_BONUS;
      } else {
        aiSnakes[j].score += DEATH_POINTS;
      }
    }
  }

  // Update leaderboard
  updateLeaderboard();
}

// ─── AI snake dies ───
// The dead body stays visible on the board and converts to apples
// segment by segment, starting from the head, one per tick.
function aiDie(aiIndex, cause) {
  var ai = aiSnakes[aiIndex];
  if (!ai || !ai.alive) return;

  // ─── Distribute death points BEFORE marking as dead ───
  distributeDeathPoints(aiIndex, cause);

  ai.alive = false;

  // ─── Keep body visible as corpse, darken materials ───
  if (ai.groupData) {
    var gd = ai.groupData;
    // Darken head and body to look like a corpse
    if (gd.headM && gd.headM.material) {
      gd.headM.material.emissiveIntensity = 0;
      gd.headM.material.opacity = 0.4;
      gd.headM.material.transparent = true;
    }
    if (gd.bodyMs) {
      for (var b = 0; b < gd.bodyMs.length; b++) {
        if (gd.bodyMs[b].material) {
          gd.bodyMs[b].material.emissiveIntensity = 0;
          gd.bodyMs[b].material.opacity = 0.4;
          gd.bodyMs[b].material.transparent = true;
        }
      }
    }
  }

  // ─── Register corpse for gradual conversion ───
  // Each tick, one segment (head-first) converts to an apple.
  corpses.push({
    segments: ai.snake.slice(),  // copy of body segments
    convertIndex: 0,             // next segment to convert (0 = head)
    groupData: ai.groupData,     // mesh group for hiding segments
    color: ai.color
  });

  // ─── Populate corpseSet for O(1) collision lookups ───
  if (typeof addToCorpseSet === 'function') addToCorpseSet(ai.snake);

  // Particles
  if (ai.snake.length) {
    burst(ai.snake[0].x, ai.snake[0].z, 0xff4444, 8);
  }

  // Show death message
  showAiDeathMessage(ai, cause);

  // ─── Trigger grid shrink on AI death ───
  maybeTriggerShrink();

  log('AI ' + aiIndex + ' died (' + cause + ') — body: ' + ai.snake.length + ' segments converting');
}

// ─── Process corpses: convert segments to apples ───
// Each tick, CORPSE_CONVERSION_BATCH segments (head → tail) turn into apples.
// The segment mesh is hidden, revealing the apple underneath.
// Batch conversion reduces the number of ticks with appleDirty=true,
// cutting down on refreshApples() calls and associated frame stalls.
var CORPSE_CONVERSION_BATCH = 1; // one segment per tick — progressive head→tail conversion

function processCorpses() {
  for (var c = corpses.length - 1; c >= 0; c--) {
    var corpse = corpses[c];
    if (corpse.convertIndex >= corpse.segments.length) {
      // All segments converted — remove corpse
      if (corpse.groupData && corpse.groupData.group) {
        corpse.groupData.group.visible = false;
      }
      corpses.splice(c, 1);
      continue;
    }

    // Convert up to CORPSE_CONVERSION_BATCH segments this tick
    var batchStart = corpse.convertIndex;
    for (var b = 0; b < CORPSE_CONVERSION_BATCH; b++) {
      if (corpse.convertIndex >= corpse.segments.length) break;

      var seg = corpse.segments[corpse.convertIndex];
      if (seg && seg.x >= gridMinX && seg.x < gridMaxX && seg.z >= gridMinZ && seg.z < gridMaxZ) {
        var segKey = seg.x + ',' + seg.z;
        // One apple per cell is enough. If another corpse/apple already owns
        // this position, avoid piling duplicate apple entries on the same tile.
        if (!appleSet || !appleSet[segKey]) {
          var newApple = {x: seg.x, z: seg.z, fromDeath: true};
          apples.push(newApple);
          if (typeof addToAppleSet === 'function') addToAppleSet(newApple, apples.length - 1);
          appleDirty = true;
        }

        // Hide the converted segment mesh
        if (corpse.groupData) {
          if (corpse.convertIndex === 0 && corpse.groupData.headM) {
            corpse.groupData.headM.visible = false;
          } else if (corpse.convertIndex < corpse.groupData.bodyMs.length) {
            corpse.groupData.bodyMs[corpse.convertIndex].visible = false;
          }
        }
        // NOTE: burst() removed — particle effects per segment caused GC spikes
        // during mass death events (50+ segments × 3 particles = 150 allocations)
      }

      corpse.convertIndex++;
    }
    // Update corpseSet: remove converted segments (batchStart → convertIndex)
    if (corpse.convertIndex > batchStart && typeof removeFromCorpseSet === 'function') {
      removeFromCorpseSet(corpse.segments, batchStart, corpse.convertIndex);
    }
  }
}

// ─── Show AI death message on screen ───
function showAiDeathMessage(ai, cause) {
  var colorNames = {green: 'verde', red: 'roja', blue: 'azul', yellow: 'amarilla', cyan: 'cyan', purple: 'púrpura', orange: 'naranja', salmon: 'salmón'};
  var colorName = colorNames[ai.color] || ai.color;

  var msg = '';
  var pointsEarned = DEATH_POINTS;
  var isKiller = false;

  if (cause === 'player') {
    // Player killed this AI
    pointsEarned = DEATH_POINTS + KILLER_BONUS;
    isKiller = true;
    msg = '💥 ¡La serpiente ' + colorName + ' chocó contra ti! + ' + pointsEarned + ' puntos 🎉';
  } else if (cause === 'wall') {
    msg = '🧱 La serpiente ' + colorName + ' se estrelló contra la pared... + ' + pointsEarned + ' puntos 🍀';
  } else if (cause === 'self') {
    msg = '🔄 ¡La serpiente ' + colorName + ' se mordió a sí misma! + ' + pointsEarned + ' puntos 😂';
  } else if (cause === 'obstacle') {
    msg = '🪨 La serpiente ' + colorName + ' chocó contra un obstáculo + ' + pointsEarned + ' puntos 💪';
  } else if (cause === 'corpse') {
    msg = '💀 La serpiente ' + colorName + ' chocó contra un cadáver + ' + pointsEarned + ' puntos 🦴';
  } else if (cause === 'ai') {
    msg = '⚔️ La serpiente ' + colorName + ' fue eliminada por otra serpiente + ' + pointsEarned + ' puntos 🔥';
  } else if (cause === 'headon') {
    msg = '💥 La serpiente ' + colorName + ' murió en choque de cabezas 😵💫';
  }

  var el = document.getElementById('ai-death-msg');
  if (el) {
    el.textContent = msg;
    el.classList.add('visible');
    // Auto-hide after 3 seconds
    clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(function() {
      el.classList.remove('visible');
    }, 5000);
  }
}

// ─── Refresh AI snake meshes ───
function refreshAISnakes() {
  if (!aiSnakes || !aiSnakes.length) return;

  aiSnakes.forEach(function(ai, index) {
    if (!ai.alive || !ai.groupData || !ai.groupData.bodyMs || !ai.groupData.bodyMs.length) return;
    ai.groupData.direction = ai.direction;
    refreshSnake(ai.snake, ai.groupData);
  });
}

// ─── Module exports (for testing — ignored in browser) ───
if(typeof module !== 'undefined' && module.exports) {
  module.exports = {
    snapToCardinal,
    buildBlockedSet,
    cloneBlocked,
    enableBlockedCache,
    disableBlockedCache,
    invalidateBlockedCache,
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
    DIRS,
    processCorpses,
    CORPSE_CONVERSION_BATCH
  };
}
