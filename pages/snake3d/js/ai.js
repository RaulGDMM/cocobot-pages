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
    floodFillDepth: 60,
    tailChasing: true,
    lookahead: true,
    bestApple: true,
    hunting: false,
    antiTrap: true,
    minSpaceFactor: 2.0,
    errorRate: 0.05,
    corneringRate: 0.30,
    spaceCheckRelaxation: 0.07,
    playerPerceptionRadius: 14,
    lookaheadSteps: 5,
    pathCutting: true,
    huntRadius: 10
  },
  hard: {
    bfsPathfinding: true,
    floodFillDepth: 150,
    tailChasing: true,
    lookahead: true,
    bestApple: true,
    hunting: true,
    antiTrap: true,
    minSpaceFactor: 2.2,
    errorRate: 0.0,
    corneringRate: 0.40,
    spaceCheckRelaxation: 0.00,
    playerPerceptionRadius: -1,
    lookaheadSteps: 8,
    adversarialPrediction: true,
    pathCutting: true,
    huntRadius: 12,
    contestApples: true
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

// ─── Deep escape routes (depth-2 flood fill anti-trap) ───
// Like countEscapeRoutes, but for each adjacent escape cell, also checks that
// IT has at least one escape route (depth-2). A dead-end corridor has 1 escape
// route at depth 1 but 0 at depth 2 — this function detects that.
// Returns the number of adjacent cells that lead to further escape.
function countDeepEscapeRoutes(x, z, snakeBody, blocked) {
  var deepCount = 0;
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
    // Depth-2 check: does this escape cell have at least 1 further escape?
    var hasFurtherEscape = false;
    for (var d2 = 0; d2 < DIRS.length; d2++) {
      var nnx = nx + DIRS[d2].x;
      var nnz = nz + DIRS[d2].z;
      if (nnx < gridMinX || nnx >= gridMaxX || nnz < gridMinZ || nnz >= gridMaxZ) continue;
      // Don't count going back to where we came from
      if (nnx === x && nnz === z) continue;
      var nkey = nnx + ',' + nnz;
      if (blocked[nkey]) continue;
      hasFurtherEscape = true;
      break;
    }
    if (hasFurtherEscape) deepCount++;
  }
  return deepCount;
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
function bestApple(aiSnake, blocked, diff, aiIndex) {
  if (!apples || apples.length === 0) return null;

  // Easy mode: just pick nearest
  if (!AI_STRATEGY[diff].bestApple) return nearestApple(aiSnake[0].x, aiSnake[0].z);

  var strat = AI_STRATEGY[diff] || {};

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

    // ─── Apple contention (identity-neutral) ───
    // The human player is treated as just one more snake — the SAME rules apply
    // to the player and to every other AI, with a position-based tie-break so no
    // snake gets special deference. Count nearby snakes that also want this
    // apple and whether any of them will clearly beat us to it.
    var appleContested = 0;
    var appleCloser = 0;
    var contenders = [];
    if (snake && snake.length > 0 && !(snake[0].x === head.x && snake[0].z === head.z)) {
      contenders.push(snake[0]);
    }
    if (aiSnakes) {
      for (var co = 0; co < aiSnakes.length; co++) {
        if (!aiSnakes[co].alive || co === aiIndex) continue;
        contenders.push(aiSnakes[co].snake[0]);
      }
    }
    for (var ct = 0; ct < contenders.length; ct++) {
      var ch = contenders[ct];
      var cDist = Math.abs(apple.x - ch.x) + Math.abs(apple.z - ch.z);
      if (cDist < 10) {
        appleContested++;
        // Strictly closer wins; on a tie the snake whose head sorts first by
        // (x, then z) wins — a neutral rule that never favors the player.
        if (cDist < manhattanDist ||
            (cDist === manhattanDist &&
             (ch.x < head.x || (ch.x === head.x && ch.z < head.z)))) {
          appleCloser++;
        }
      }
    }
    if (strat.contestApples) {
      // Aggressive (hard): compete with EVERYONE for apples. Only a mild nudge
      // away from apples a closer snake will clearly win — never a hard yield.
      score -= appleCloser * 60;
    } else {
      score -= appleContested * 30; // Moderate penalty for nearby snakes
      score -= appleCloser * 500;  // Heavy penalty — another snake gets it first
    }

    // ─── Space-post-check (anti-trap apple selection) ───
    // For reachable apples, check the space available AFTER reaching the apple.
    // An apple at a dead end or corner is dangerous — the snake eats it but
    // gets trapped. We simulate the snake at the apple position with +1 length
    // (since eating grows) and measure reachable space.
    // This is a TIEBREAKER between reachable apples of similar distance.
    if (reachable && path) {
      var simBody = [];
      // Simulate snake body after reaching apple: path positions become new body
      var pathLen = Math.min(path.length, aiSnake.length + 1);
      for (var pi = 0; pi < pathLen; pi++) {
        simBody.push({x: path[pi].x, z: path[pi].z});
      }
      // If path is shorter than snake, pad with original tail segments
      while (simBody.length < aiSnake.length + 1) {
        var tailIdx = aiSnake.length - (simBody.length - pathLen + 1);
        if (tailIdx >= 0 && tailIdx < aiSnake.length) {
          simBody.push({x: aiSnake[tailIdx].x, z: aiSnake[tailIdx].z});
        } else {
          break;
        }
      }
      var postSpace = countReachable(apple.x, apple.z, simBody, 30);
      if (postSpace < aiSnake.length) {
        // Apple leads to a trap — penalize heavily
        score -= 200;
      } else if (postSpace < aiSnake.length * 2) {
        // Tight space after apple — small penalty
        score -= 30;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      best = apple;
    }
  }

  return best;
}

// ─── Multi-tick lookahead ───
// Simulate N moves in a direction, check if result is good.
// Returns score: higher = better. Negative = death trap.
// Steps default to 5; hard mode uses 8 (AI_STRATEGY.hard.lookaheadSteps).
//
// The simulation follows a WALL-AWARE greedy path instead of a strict straight
// line: when the straight step is blocked (wall, obstacle, snake), it tries to
// turn (perpendicular) and keep going, mimicking how a snake actually hugs a
// wall to reach an edge apple. This fixes the classic bug where the AI treated
// "wall N cells ahead" as certain death and refused to approach apples near the
// board edges (turning away and looping forever nearby).
// A direction is only a death trap (-1000) when:
//   - the very first step is impossible (nowhere to go), or
//   - the greedy walk gets boxed in early AND the reachable space at the point
//     where it stops is smaller than the snake (a genuine dead end).
// Otherwise it evaluates:
//   - reachable space from final position (flood fill)
//   - escape routes from final position
//   - a penalty for stopping early (tighter = worse)
//   - distance to nearest apple (closer = better)
//   - wall proximity penalty (only when directly ON the edge)
function lookaheadScore(aiSnake, dir, steps, blocked) {
  steps = steps || 5;
  var simSnake = [];
  for (var i = 0; i < aiSnake.length; i++) simSnake.push({x: aiSnake[i].x, z: aiSnake[i].z});

  var cx = simSnake[0].x;
  var cz = simSnake[0].z;
  var dx = Math.round(Math.cos(dir));
  var dz = Math.round(Math.sin(dir));

  // Can the snake move into (nx,nz) given the current simulated body?
  // The tail cell vacates, so it never blocks (simSnake.length - 1).
  function walkable(nx, nz) {
    if (nx < gridMinX || nx >= gridMaxX || nz < gridMinZ || nz >= gridMaxZ) return false;
    if (blocked[nx + ',' + nz]) return false;
    for (var si = 0; si < simSnake.length - 1; si++) {
      if (simSnake[si].x === nx && simSnake[si].z === nz) return false;
    }
    return true;
  }

  var survived = 0;
  for (var s = 0; s < steps; s++) {
    var nx = cx + dx;
    var nz = cz + dz;

    // If straight ahead is blocked, try to turn (wall-following). Never a 180°
    // reversal — only the two perpendicular directions are considered.
    if (!walkable(nx, nz)) {
      var leftDx = dz, leftDz = -dx;   // 90° left
      var rightDx = -dz, rightDz = dx; // 90° right
      if (walkable(cx + leftDx, cz + leftDz)) {
        dx = leftDx; dz = leftDz;
      } else if (walkable(cx + rightDx, cz + rightDz)) {
        dx = rightDx; dz = rightDz;
      } else {
        break; // genuinely boxed in — no straight or lateral escape
      }
      nx = cx + dx;
      nz = cz + dz;
    }

    simSnake.unshift({x: nx, z: nz});
    simSnake.pop();
    cx = nx;
    cz = nz;
    survived++;
  }

  // Couldn't move at all → certain death this tick.
  if (survived === 0) return -1000;

  // Score based on final position
  var space = countReachable(cx, cz, simSnake, 40);
  var escapes = countEscapeRoutes(cx, cz, simSnake, blocked);

  // Boxed in early with little room left → genuine dead end / trap.
  if (survived < steps && space < aiSnake.length) return -800;

  var score = space + escapes * 5;

  // Penalize stopping before completing the full horizon (tighter path).
  score -= (steps - survived) * 8;

  // Apple proximity bonus — prefer directions that lead toward food
  var target = nearestApple(cx, cz);
  if (target) {
    var appleDist = Math.abs(target.x - cx) + Math.abs(target.z - cz);
    score -= appleDist * 0.5; // small bonus for being closer to apples
  }

  // Wall proximity penalty — very mild preference for center, but don't
  // discourage edge apples. Only penalize being directly ON the wall.
  var wallDist = Math.min(cx - gridMinX, gridMaxX - 1 - cx, cz - gridMinZ, gridMaxZ - 1 - cz);
  if (wallDist === 0) score -= 3; // tiny penalty for being on the very edge

  return score;
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
function aiEvaluateDirections(aiIndex, aiSnake, aiDir, perceptionRadius, strat) {
  var possibleDirs = [
    aiDir,
    aiDir - TURN_ANGLE,
    aiDir + TURN_ANGLE
  ];

  var safe = [];
  var head = aiSnake[0];

  // ─── Unified competitor model ───
  // From an AI's point of view, another AI is just another player: the player
  // and every other living AI are treated IDENTICALLY. We build one list of
  // "other snakes" and apply the SAME perception + collision-avoidance rules to
  // all of them, instead of special-casing the player.
  //   perceptionRadius: max Manhattan distance (to a snake's head) at which the
  //   AI perceives that snake. -1 = infinite (hard mode, always perceives).
  var otherSnakes = [];
  if (snake && snake.length > 0) {
    otherSnakes.push({ body: snake, head: snake[0], dir: direction });
  }
  if (aiSnakes) {
    for (var oi = 0; oi < aiSnakes.length; oi++) {
      if (oi === aiIndex) continue;
      if (!aiSnakes[oi].alive) continue;
      otherSnakes.push({ body: aiSnakes[oi].snake, head: aiSnakes[oi].snake[0], dir: aiSnakes[oi].direction });
    }
  }

  // A snake is "perceived" when its head is within perceptionRadius (same
  // handicap for the player and for other AIs).
  function perceives(otherHead) {
    if (perceptionRadius < 0) return true; // infinite vision
    return (Math.abs(otherHead.x - head.x) + Math.abs(otherHead.z - head.z)) <= perceptionRadius;
  }

  // Is there an apple at (x,z)? Small scan (apples are few, ≤ ~24).
  function appleAt(x, z) {
    if (!apples) return false;
    for (var ai = 0; ai < apples.length; ai++) {
      if (apples[ai] && apples[ai].x === x && apples[ai].z === z) return true;
    }
    return false;
  }

  // Safe directions, split into firm (preferred) and risky (used only as a
  // last resort): a risky direction either dives onto a contested apple or
  // heads straight into an oncoming snake's lane.
  var risky = [];

  // How many cells ahead we look for an oncoming head-on lane. Detecting the
  // confrontation early lets the snake peel away while a side escape still
  // exists, instead of discovering it one cell before impact (too late when
  // both snakes are long and boxed in — the classic "raced down the same row
  // of apples toward each other" death).
  var HEADON_LOOKAHEAD = 4;

  possibleDirs.forEach(function(dir) {
    var dx = Math.round(Math.cos(dir));
    var dz = Math.round(Math.sin(dir));
    var nx = head.x + dx;
    var nz = head.z + dz;

    if (nx < gridMinX || nx >= gridMaxX || nz < gridMinZ || nz >= gridMaxZ) return;
    if (aiSnake.some(function(s) { return s.x === nx && s.z === nz; })) return;
    if (obstacles.some(function(o) { return o.x === nx && o.z === nz; })) return;

    // Corpses (unconverted segments are solid) — O(1) via corpseSet
    if (corpseSet && corpseSet[nx + ',' + nz]) return;

    // ─── Other snakes (player + AIs), treated identically ───
    // For each perceived snake:
    //   1) its body is a solid obstacle,
    //   2) avoid racing into the same destination cell (head-on / perpendicular),
    //   3) avoid swapping cells with its head.
    var contested = false;
    for (var os = 0; os < otherSnakes.length; os++) {
      var other = otherSnakes[os];
      if (!perceives(other.head)) continue;

      var blocksBody = false;
      for (var bi = 0; bi < other.body.length; bi++) {
        if (other.body[bi].x === nx && other.body[bi].z === nz) { blocksBody = true; break; }
      }
      if (blocksBody) return;

      var ox = other.head.x + Math.round(Math.cos(other.dir));
      var oz = other.head.z + Math.round(Math.sin(other.dir));
      // Same destination — always avoid (head-on, perpendicular, or racing)
      if (nx === ox && nz === oz) return;
      // Swap: AI moves into the other's head while it moves into our cell
      if (nx === other.head.x && nz === other.head.z && ox === head.x && oz === head.z) return;

      // ─── Adversarial prediction (hard mode) ───
      // In hard mode, the AI considers that the opponent might TURN toward
      // our destination cell. If the opponent's head is adjacent to our target
      // cell AND the opponent could turn to reach it, mark as risky.
      if (strat && strat.adversarialPrediction) {
        if (!contested) {
          var oppToTargetDist = Math.abs(other.head.x - nx) + Math.abs(other.head.z - nz);
          if (oppToTargetDist === 1) {
            var oppDx = Math.round(Math.cos(other.dir));
            var oppDz = Math.round(Math.sin(other.dir));
            if (ox === nx && oz === nz) { contested = true; }
            else {
              var oppLeftDx = -oppDz, oppLeftDz = oppDx;
              if (other.head.x + oppLeftDx === nx && other.head.z + oppLeftDz === nz) {
                contested = true;
              } else {
                var oppRightDx = oppDz, oppRightDz = -oppDx;
                if (other.head.x + oppRightDx === nx && other.head.z + oppRightDz === nz) {
                  contested = true;
                }
              }
            }
          }
        }
      }

      // ─── Proximity avoidance (hard mode) ───
      // REMOVED: marking all directions near opponents as "risky" made the AI
      // too passive — it kept fleeing instead of competing. The adversarial
      // prediction above (dist=1 + can-turn-to-reach) already handles the real
      // collision risk. The fallback scoring has a softer proximity factor.

      // ─── Oncoming head-on lane (early warning) ───
      // If the opponent's head lies straight ahead along this candidate's
      // direction (same lane), within HEADON_LOOKAHEAD cells, AND it is moving
      // toward us (opposite heading), continuing here marches into a head-on.
      // Mark it risky so we peel away NOW while a side route is still open.
      if (!contested) {
        var odx = Math.round(Math.cos(other.dir));
        var odz = Math.round(Math.sin(other.dir));
        var oncoming = (odx === -dx && odz === -dz); // exactly opposite heading
        if (oncoming) {
          // Vector from our candidate cell to the opponent head.
          var rx = other.head.x - nx;
          var rz = other.head.z - nz;
          // Must be on the same lane (no lateral offset) and ahead of us.
          var sameLane = (dx !== 0) ? (rz === 0 && rx * dx > 0)
                                    : (rx === 0 && rz * dz > 0);
          if (sameLane) {
            var ahead = Math.abs(rx) + Math.abs(rz);
            if (ahead <= HEADON_LOOKAHEAD) contested = true;
          }
        }
      }


      // ─── Contested apple (soft) ───
      // The two snakes that collide head-on "trying to grab the same apple"
      // are BOTH one step away from that apple cell. The current-direction
      // prediction above misses this because the opponent may turn toward the
      // apple this very tick. So: if this candidate cell holds an apple and the
      // opponent's head is also adjacent to it, only ONE snake should dive in.
      // The other yields. The tie-break is identity-neutral (head coordinates),
      // so the player and AIs are treated exactly the same.
      if (!contested &&
          (Math.abs(other.head.x - nx) + Math.abs(other.head.z - nz)) === 1 &&
          appleAt(nx, nz)) {
        // Yield when the opponent's head sorts before ours (lower x, then z).
        if (other.head.x < head.x ||
            (other.head.x === head.x && other.head.z < head.z)) {
          contested = true;
        }
      }
    }

    if (contested) risky.push(dir);
    else safe.push(dir);
  });

  // Prefer firm directions; only fall back to contested ones if nothing else
  // is available (yielding must never strand the snake with zero options).
  return safe.length > 0 ? safe : risky;
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
// Actively try to block and corner smaller snakes.
// Two modes:
//   1. Tail-chase: position behind the target (original behavior)
//   2. Path-cut: move to intercept the target's escape route, trapping it
//      against a wall, obstacle, or the AI's own body.
function aiCorneringStrategy(aiIndex, diff) {
  var ai = aiSnakes[aiIndex];
  if (!ai || !ai.alive) return null;

  var strat = AI_STRATEGY[diff];
  var corneringRate = strat.corneringRate || 0;
  if (Math.random() > corneringRate) return null;
  // Need at least one aggressive strategy active
  if (!strat.hunting && !strat.pathCutting) return null;

  var targets = [];
  if (snake.length > 0) targets.push({snake: snake, isPlayer: true});
  for (var i = 0; i < aiSnakes.length; i++) {
    if (i === aiIndex) continue;
    if (!aiSnakes[i].alive) continue;
    targets.push({snake: aiSnakes[i].snake, isPlayer: false});
  }
  if (targets.length === 0) return null;

  // Blocked set must EXCLUDE this AI's own snake — otherwise bfsPath (used by
  // path-cutting and tail-chase below) starts on a blocked cell (our own head)
  // and returns null every time, silently disabling all hunting. bfsPath is
  // given ai.snake as snakeBody, so our own body is still avoided correctly.
  var blocked = buildBlockedSet(ai.id);
  var huntRadius = strat.huntRadius || 10;

  // Is another snake head (not us, not the snake we're currently cutting) right
  // next to a cell? Two hunters converging on the same interception point crash
  // into each other — the main cause of hard-mode AI deaths. The player counts
  // the same as any AI here (no special treatment).
  function otherHunterNear(x, z, targetBody) {
    if (snake && snake.length > 0 && snake !== targetBody) {
      if (Math.abs(snake[0].x - x) + Math.abs(snake[0].z - z) <= 2) return true;
    }
    for (var h = 0; h < aiSnakes.length; h++) {
      if (h === aiIndex || !aiSnakes[h].alive) continue;
      if (aiSnakes[h].snake === targetBody) continue;
      var oh = aiSnakes[h].snake[0];
      if (Math.abs(oh.x - x) + Math.abs(oh.z - z) <= 2) return true;
    }
    return false;
  }

  for (var t = 0; t < targets.length; t++) {
    var target = targets[t];
    // Hunt snakes that are not longer than us. The human player gets NO special
    // treatment — it is just another snake subject to the same length rule.
    if (target.snake.length > ai.snake.length) continue;

    var targetHead = target.snake[0];
    var targetTail = target.snake[target.snake.length - 1];
    // Get target direction
    var targetDir = direction; // default to player
    if (!target.isPlayer) {
      for (var fi = 0; fi < aiSnakes.length; fi++) {
        if (aiSnakes[fi].snake === target.snake) { targetDir = aiSnakes[fi].direction; break; }
      }
    }

    var dx = targetHead.x - ai.snake[0].x;
    var dz = targetHead.z - ai.snake[0].z;
    var dist = Math.abs(dx) + Math.abs(dz);

    // Only hunt if close enough (hard mode hunts from farther via huntRadius)
    if (dist >= huntRadius) continue;

    // ─── One hunter per target ───
    // If another alive AI is closer to this target, let THEM handle it. Piling
    // several hunters onto the same snake makes them converge on the same cells
    // and collide with each other — the dominant cause of hard-mode deaths.
    // Ties break by index so exactly one AI claims the target.
    var someoneCloser = false;
    for (var hj = 0; hj < aiSnakes.length; hj++) {
      if (hj === aiIndex || !aiSnakes[hj].alive) continue;
      if (aiSnakes[hj].snake === target.snake) continue; // the target isn't its own hunter
      var hjHead = aiSnakes[hj].snake[0];
      var hjDist = Math.abs(hjHead.x - targetHead.x) + Math.abs(hjHead.z - targetHead.z);
      if (hjDist < dist || (hjDist === dist && hj < aiIndex)) { someoneCloser = true; break; }
    }
    if (someoneCloser) continue;

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

    // ─── Mode 2: Path-cutting (intercept escape route) ───
    // Predicts where the target is heading and moves to cut off its escape.
    // ONLY fires when the target is already cornered near a wall/obstacle —
    // that's a low-risk trap. Cutting across open space was disabled: it made
    // the AI turn sharply toward its prey, and those turns were unpredictable
    // to the other snakes' collision avoidance, causing frequent mutual head-on
    // and side collisions (hard-mode snakes dying en masse). Survival first.
    var canCut = nearWall || nearObstacle;
    if (strat.pathCutting && canCut) {
      var cutStep = aiPathCutStep(ai.snake, targetHead, targetDir, target.snake, blocked);
      if (cutStep) {
        // Safety: near a wall/obstacle cutting is space-constrained so 1 escape
        // route is acceptable; in the open we require 2 so we're not one closing
        // lane from death. Also require space, and crucially that no OTHER
        // hunter (any snake head that isn't our target) sits next to the
        // interception cell — two snakes converging there just collide, which
        // was the main cause of hard-mode deaths.
        var cutEscapes = countEscapeRoutes(cutStep.x, cutStep.z, ai.snake, blocked);
        var cutSpace = countReachable(cutStep.x, cutStep.z, ai.snake, 30);
        var minCutEscapes = (nearWall || nearObstacle) ? 1 : 2;
        if (cutEscapes >= minCutEscapes &&
            cutSpace >= Math.floor(ai.snake.length / 2) &&
            !otherHunterNear(cutStep.x, cutStep.z, target.snake)) {
          log('AI ' + aiIndex + ' CUTTING OFF target at (' + targetHead.x + ',' + targetHead.z + ')');
          return cutStep;
        }
      }
    }

    // ─── Mode 1: Tail-chase (original behavior, requires hunting flag) ───
    if (strat.hunting && (nearWall || nearObstacle)) {
      var pathToTail = bfsPath(
        ai.snake[0].x, ai.snake[0].z,
        targetTail.x, targetTail.z,
        blocked, ai.snake, gridSize * gridSize
      );
      if (pathToTail && pathToTail.length > 1) {
        var huntNextX = pathToTail[1].x;
        var huntNextZ = pathToTail[1].z;
        var huntEscapes = countEscapeRoutes(huntNextX, huntNextZ, ai.snake, blocked);
        var huntSpace = countReachable(huntNextX, huntNextZ, ai.snake, 30);
        if (huntEscapes >= 2 && huntSpace > ai.snake.length) {
          log('AI ' + aiIndex + ' hunting target at (' + targetHead.x + ',' + targetHead.z + ')');
          return pathToTail[1];
        }
      }
    }
  }
  return null;
}

// ─── Path-cutting step calculation ───
// Predicts where the target is heading and finds the best interception point.
// The AI moves to a cell that blocks the target's forward path, forcing it
// to turn toward a wall/obstacle where it has less room to escape.
// aiSnake: array of {x,z} segments (ai.snake)
function aiPathCutStep(aiSnake, targetHead, targetDir, targetBody, blocked) {
  var headX = aiSnake[0].x;
  var headZ = aiSnake[0].z;
  var tDx = Math.round(Math.cos(targetDir));
  var tDz = Math.round(Math.sin(targetDir));

  // Project the target's path 2-7 steps forward
  var bestCut = null;
  var bestCutScore = -Infinity;

  for (var steps = 2; steps <= 7; steps++) {
    var tx = targetHead.x + tDx * steps;
    var tz = targetHead.z + tDz * steps;

    // Skip if projected position is off-board (target will hit wall)
    if (tx < gridMinX || tx >= gridMaxX || tz < gridMinZ || tz >= gridMaxZ) break;

    // Find the best cell to intercept: we try both perpendicular and frontal
    // interception points.
    // Perpendicular: get to a cell adjacent to the target's forward path,
    //   blocking its lateral escape.
    // Frontal: get to a cell directly in the target's path, forcing it to
    //   turn or stop. This is the classic "cut across the nose" move.
    var candidates = [];
    // Perpendicular offsets
    for (var offset = -1; offset <= 1; offset += 2) {
      var cx = tx + (tDx !== 0 ? 0 : offset);
      var cz = tz + (tDz !== 0 ? 0 : offset);
      candidates.push({x: cx, z: cz, type: 'perp'});
    }
    // Frontal: the cell directly in the target's path (ahead of it)
    candidates.push({x: tx, z: tz, type: 'frontal'});

    for (var ci = 0; ci < candidates.length; ci++) {
      var cx = candidates[ci].x;
      var cz = candidates[ci].z;
      var cutType = candidates[ci].type;

      // Must be on-board
      if (cx < gridMinX || cx >= gridMaxX || cz < gridMinZ || cz >= gridMaxZ) continue;
      // Must not be blocked
      if (blocked[cx + ',' + cz]) continue;
      // Must not be on target's body
      var onBody = false;
      for (var bi = 0; bi < targetBody.length; bi++) {
        if (targetBody[bi].x === cx && targetBody[bi].z === cz) { onBody = true; break; }
      }
      if (onBody) continue;

      // BFS from AI head to this interception cell
      var path = bfsPath(headX, headZ, cx, cz, blocked, aiSnake, gridSize * gridSize);
      if (!path || path.length <= 1) continue;

      // Score: prefer cells that are closer to the target's projected path
      // (tighter trap) and reachable in fewer steps (faster intercept).
      var aiDist = path.length - 1; // steps to reach intercept point
      var targetDist = steps; // steps for target to reach projected position
      // The intercept works if AI arrives at most 3 steps after the target
      // (the target has to turn, lose momentum, and find a new escape route)
      if (aiDist > targetDist + 3) continue;

      var score = 100 - aiDist * 10; // closer intercept = better
      // Bonus for cutting closer to the target's head (tighter trap)
      score += (7 - steps) * 3;

      if (score > bestCutScore) {
        bestCutScore = score;
        bestCut = path[1]; // next step toward intercept point
      }
    }
  }

  return bestCut;
}

// ─── Detect if AI is stuck in a loop ───
// Returns true if the AI head has visited very few unique positions in recent ticks.
// Two detection modes:
//   1. Tight loop: ≤3 unique positions in 8 ticks (classic 2-cell ping-pong)
//   2. Circular loop: head revisits a position from ~4 ticks ago (4-cell circles)
function aiIsStuck(ai) {
  if (!ai.stuckHistory || ai.stuckHistory.length < 8) return false;
  // Take the last 8 positions
  var recent = ai.stuckHistory.slice(-8);
  var unique = {};
  for (var i = 0; i < recent.length; i++) {
    var key = recent[i].x + ',' + recent[i].z;
    unique[key] = true;
  }
  var uniqueCount = Object.keys(unique).length;
  // Mode 1: tight loop — ≤3 unique positions in 8 ticks
  if (uniqueCount <= 3) return true;

  // Mode 2: circular loop — head is at the same position as 4 ticks ago,
  // and the positions in between form a small cycle (≤5 unique in last 8)
  if (recent.length >= 8) {
    var fourTicksAgo = recent[recent.length - 5];
    var current = recent[recent.length - 1];
    if (fourTicksAgo.x === current.x && fourTicksAgo.z === current.z && uniqueCount <= 5) {
      return true;
    }
  }
  return false;
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
    if (ai.stuckHistory.length > 10) ai.stuckHistory.shift();
  }

  // ─── If stuck, force a random safe direction to break the loop ───
  if (aiIsStuck(ai)) {
    var stratStuck = AI_STRATEGY[diff] || AI_STRATEGY.medium;
    var safe = aiEvaluateDirections(aiIndex, ai.snake, ai.direction, stratStuck.playerPerceptionRadius, stratStuck);
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
    // If only one safe direction, we're in a narrow corridor or constrained space.
    // Reset history to avoid false positives, but add a small random jitter:
    // occasionally skip a tick (keep current direction but mark for re-evaluation
    // next tick with fresh randomness). This breaks deterministic loops even
    // when errorRate is 0 (hard mode).
    if (safe.length === 1) {
      log('AI ' + aiIndex + ' stuck in corridor — resetting history');
      ai.stuckHistory = [];
      // 15% chance to pick the risky direction instead of the only safe one,
      // but only if risky directions exist (from aiEvaluateDirections fallback).
      // This is the ONLY randomness in hard mode, and only fires when stuck.
      if (Math.random() < 0.15) {
        // Re-evaluate getting risky directions (the function returns safe || risky)
        var allDirs = aiEvaluateDirections(aiIndex, ai.snake, ai.direction, stratStuck.playerPerceptionRadius, stratStuck);
        // allDirs is already the safe array; we need to check if there are
        // other cardinal directions not in safe that are still on the board.
        var cardinal = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
        var risky = cardinal.filter(function(d) {
          if (d === safe[0]) return false;
          // Check it's not a 180° reversal
          if (Math.abs(Math.cos(d - ai.direction) + 1) < 0.01) return false;
          // Check it's on the board
          var nx = ai.snake[0].x + Math.round(Math.cos(d));
          var nz = ai.snake[0].z + Math.round(Math.sin(d));
          if (nx < gridMinX || nx >= gridMaxX || nz < gridMinZ || nz >= gridMaxZ) return false;
          return true;
        });
        if (risky.length > 0) {
          var escapeDir = risky[Math.floor(Math.random() * risky.length)];
          log('AI ' + aiIndex + ' stuck — forcing risky escape to ' + escapeDir);
          return escapeDir;
        }
      }
    }
  }

  var strat = AI_STRATEGY[diff] || AI_STRATEGY.medium;
  var safe = aiEvaluateDirections(aiIndex, ai.snake, ai.direction, strat.playerPerceptionRadius, strat);
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
    var targetApple = bestApple(ai.snake, blocked, diff, aiIndex);
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
            // Collect ALL safeWithSpace directions that match the BFS next step
            // and pass anti-trap + lookahead filters. If lookahead is enabled,
            // pick the one with the best lookahead score (positive tiebreaker).
            var bfsCandidates = [];
            for (var s = 0; s < safeWithSpace.length; s++) {
              var nx = ai.snake[0].x + Math.round(Math.cos(safeWithSpace[s]));
              var nz = ai.snake[0].z + Math.round(Math.sin(safeWithSpace[s]));
              if (nx === nextStep.x && nz === nextStep.z) {
                // Anti-trap: verify escape routes — but SKIP when apple is very close (≤2 steps)
                if (strat.antiTrap) {
                  var manhattanToApple = Math.abs(nextStep.x - targetApple.x) + Math.abs(nextStep.z - targetApple.z);
                  if (manhattanToApple > 2) {
                    // Use deep escape routes for harder difficulties —
                    // countDeepEscapeRoutes detects dead-end corridors that
                    // countEscapeRoutes would miss (depth-1 only).
                    var useDeep = strat.adversarialPrediction; // hard mode
                    var escapes = useDeep
                      ? countDeepEscapeRoutes(nx, nz, ai.snake, blocked)
                      : countEscapeRoutes(nx, nz, ai.snake, blocked);
                    var nearEdge = (nx <= gridMinX + 1 || nx >= gridMaxX - 1 ||
                                    nz <= gridMinZ + 1 || nz >= gridMaxZ - 1);
                    // Hard mode with deep routes: require >= 1 deep escape even at edges
                    var minEscapes = nearEdge ? 1 : 2;
                    if (useDeep) minEscapes = nearEdge ? 1 : 1;
                    if (escapes < minEscapes) continue;
                  }
                }
                // Lookahead: filter death traps AND collect score for tiebreaking
                var laScoreVal = 0;
                if (strat.lookahead) {
                  var laSteps = strat.lookaheadSteps || 5;
                  laScoreVal = lookaheadScore(ai.snake, safeWithSpace[s], laSteps, blocked);
                  if (laScoreVal < -500) continue;
                }
                bfsCandidates.push({dir: safeWithSpace[s], laScore: laScoreVal});
              }
            }
            if (bfsCandidates.length > 0) {
              // Pick the candidate with the best lookahead score
              bfsCandidates.sort(function(a, b) { return b.laScore - a.laScore; });
              return snapToCardinal(bfsCandidates[0].dir);
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

  // Build list of nearby opponent heads for proximity avoidance
  // Only consider VERY close opponents (≤3 cells) — we don't want the AI
  // fleeing from every snake on the board, just avoiding point-blank collisions.
  var nearbyHeads = [];
  if (strat.adversarialPrediction) {
    if (snake && snake.length > 0) {
      var pDist = Math.abs(snake[0].x - ai.snake[0].x) + Math.abs(snake[0].z - ai.snake[0].z);
      if (pDist <= 3) nearbyHeads.push(snake[0]);
    }
    if (aiSnakes) {
      for (var ni = 0; ni < aiSnakes.length; ni++) {
        if (ni === aiIndex || !aiSnakes[ni].alive) continue;
        var nHead = aiSnakes[ni].snake[0];
        var nDist = Math.abs(nHead.x - ai.snake[0].x) + Math.abs(nHead.z - ai.snake[0].z);
        if (nDist <= 3) nearbyHeads.push(nHead);
      }
    }
  }

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

    // ─── Proximity avoidance: soft bonus for moving AWAY from very close heads ───
    // Only applies when opponents are point-blank (≤3 cells). The weight is
    // deliberately small (*3) so it acts as a tiebreaker, not a dominant
    // force — the AI should still compete for apples and hunt, just not
    // run head-first into another snake.
    if (strat.adversarialPrediction && nearbyHeads.length > 0) {
      for (var nh = 0; nh < nearbyHeads.length; nh++) {
        var distBefore = Math.abs(nearbyHeads[nh].x - ai.snake[0].x) + Math.abs(nearbyHeads[nh].z - ai.snake[0].z);
        var distAfter = Math.abs(nearbyHeads[nh].x - nx) + Math.abs(nearbyHeads[nh].z - nz);
        score += (distAfter - distBefore) * 3;
      }
    }

    // ─── Lookahead as positive scoring in fallback ───
    // In hard mode, use lookahead score to break ties between otherwise
    // similar directions. This prevents the AI from picking a direction that
    // looks good now but leads to a trap 5-8 steps later.
    if (strat.lookahead) {
      var laSteps = strat.lookaheadSteps || 5;
      var laScore = lookaheadScore(ai.snake, safeWithSpace[s], laSteps, blocked);
      if (laScore < -500) continue; // Skip death-trap directions
      score += laScore * 0.3; // Weighted as tiebreaker, not dominant
    }

    // ─── Wall avoidance proactivo ───
    // Very mild penalty — only when directly on the edge. We don't want to
    // discourage the AI from going for edge apples.
    var wallDist = Math.min(nx - gridMinX, gridMaxX - 1 - nx, nz - gridMinZ, gridMaxZ - 1 - nz);
    if (wallDist === 0) score -= 3; // tiny penalty for being on the very edge

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
      destinations.push({type: 'player', x: px, z: pz, cx: snake[0].x, cz: snake[0].z, dir: direction, prevDir: playerPrevDirection});
    }

    // AI destinations
    for (var i = 0; i < aiSnakes.length; i++) {
      var ai = aiSnakes[i];
      if (!ai.alive) continue;
      var ax = ai.snake[0].x + Math.round(Math.cos(ai.direction));
      var az = ai.snake[0].z + Math.round(Math.sin(ai.direction));
      destinations.push({type: 'ai', index: i, x: ax, z: az, cx: ai.snake[0].x, cz: ai.snake[0].z, dir: ai.direction, prevDir: ai.prevDirection});
    }

    // Check all pairs for collision at same destination
    var handled = {};
    var collisions = [];

    for (var a = 0; a < destinations.length; a++) {
      for (var b = a + 1; b < destinations.length; b++) {
        var da = destinations[a];
        var db = destinations[b];
        // Same destination collision
        if (da.x === db.x && da.z === db.z) {
          if (!handled[a] && !handled[b]) {
            handled[a] = true;
            handled[b] = true;
            collisions.push([da, db]);
          }
        }
        // Swap collision: A moves to B's current cell, B moves to A's current cell
        else if (!handled[a] && !handled[b] && da.x === db.cx && da.z === db.cz && db.x === da.cx && db.z === da.cz) {
          handled[a] = true;
          handled[b] = true;
          collisions.push([da, db]);
        }
      }
    }

  if (collisions.length === 0) return false;

  var colorNames = {green: 'verde', red: 'roja', blue: 'azul', yellow: 'amarilla', cyan: 'cyan', purple: 'púrpura', orange: 'naranja', salmon: 'salmón'};

  // Helper: get snake name for messages
  function getName(s) {
    if (s.type === 'player') return 'Tú';
    return 'serpiente ' + (colorNames[aiSnakes[s.index].color] || aiSnakes[s.index].color);
  }

  // Helper: determine which snake(s) die based on direction comparison.
  // Keep the original collision semantics; only display true opposite-heading
  // crashes as "head-on". Side/rear-end collisions still use the old internal
  // 'headon' cause for scoring/timing behavior, but show a normal collision
  // message via displayCause.
  function resolveCollision(s1, s2) {
    var cosAngle = Math.cos(s1.dir - s2.dir);
    var relDir = getRelativeDirection(s1.dir, s2.dir);

    if (relDir === 'opposite') {
      // True head-on: both die
      log('💥💥 HEAD-ON: ' + getName(s1) + ' vs ' + getName(s2) + ' at (' + s1.x + ',' + s1.z + ')');
      killSnake(s1, 'headon', 'headon');
      killSnake(s2, 'headon', 'headon');
      return;
    }

    if (relDir === 'same') {
      // Same direction: the trailing one dies (the one behind)
      // Compute current positions from destination and direction
      var p1x = s1.x - Math.round(Math.cos(s1.dir));
      var p1z = s1.z - Math.round(Math.sin(s1.dir));
      var p2x = s2.x - Math.round(Math.cos(s2.dir));
      var p2z = s2.z - Math.round(Math.sin(s2.dir));
      // The one further behind (opposite to movement direction) is trailing
      var behind1 = -(p1x * Math.cos(s1.dir) + p1z * Math.sin(s1.dir));
      var behind2 = -(p2x * Math.cos(s2.dir) + p2z * Math.sin(s2.dir));
      var victim = behind1 > behind2 ? s1 : s2;
      var survivor = behind1 > behind2 ? s2 : s1;
      log('🔀 SAME-DIR RACE: ' + getName(victim) + ' behind ' + getName(survivor) + ' at (' + s1.x + ',' + s1.z + ')');
      killSnake(victim, 'headon', 'ai');
      return;
    }

    // Perpendicular: only the one that turned dies
    var s1Turned = s1.dir !== s1.prevDir;
    var s2Turned = s2.dir !== s2.prevDir;

    if (s1Turned && !s2Turned) {
      log('↩️ SIDE COLLISION: ' + getName(s1) + ' turned into ' + getName(s2) + ' at (' + s1.x + ',' + s1.z + ')');
      killSnake(s1, 'headon', 'ai');
    } else if (s2Turned && !s1Turned) {
      log('↩️ SIDE COLLISION: ' + getName(s2) + ' turned into ' + getName(s1) + ' at (' + s1.x + ',' + s1.z + ')');
      killSnake(s2, 'headon', 'ai');
    } else {
      // Both turned or both went straight — both die, as before, but this is
      // not a true opposite-heading head-on for display purposes.
      log('↩️ SIDE COLLISION: ' + getName(s1) + ' vs ' + getName(s2) + ' at (' + s1.x + ',' + s1.z + ')');
      killSnake(s1, 'headon', 'ai');
      killSnake(s2, 'headon', 'ai');
    }
  }

  function killSnake(s, cause, displayCause) {
    if (s.type === 'player') {
      die(displayCause || cause);
    } else if (s.type === 'ai') {
      aiDie(s.index, cause, displayCause || cause);
    }
  }

  // Process each collision
  for (var c = 0; c < collisions.length; c++) {
    var pair = collisions[c];
    resolveCollision(pair[0], pair[1]);
  }

  // Show a summary message based on what happened
  var anyHeadOn = false;
  var headOnNames = [];
  for (var c = 0; c < collisions.length; c++) {
    var s1 = collisions[c][0], s2 = collisions[c][1];
    var relDir = getRelativeDirection(s1.dir, s2.dir);
    if (relDir === 'opposite') {
      anyHeadOn = true;
      headOnNames.push(getName(s1));
      headOnNames.push(getName(s2));
    }
  }

  if (anyHeadOn) {
    var nameStr = headOnNames.join(', ');
    var deadCount = headOnNames.length;
    var msg = '💥💥 ¡Choque de cabezas entre ' + nameStr + '! 😵 ' + deadCount + ' eliminadas — puntos repartidos 🎯';
    var el = document.getElementById('ai-death-msg');
    if (el) {
      el.textContent = msg;
      el.classList.add('visible');
      clearTimeout(el._hideTimer);
      el._hideTimer = setTimeout(function() {
        el.classList.remove('visible');
      }, 5000);
    }
  }

  return true;
}

// ─── Determine relative direction between two snakes ───
// Returns: 'opposite', 'same', or 'perpendicular'
function getRelativeDirection(dir1, dir2) {
  var cosAngle = Math.cos(dir1 - dir2);
  if (cosAngle > 0.9) return 'same';
  if (cosAngle < -0.9) return 'opposite';
  return 'perpendicular';
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
      prevDirection: initDir,
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

    // Save direction before AI decides (for collision fault determination)
    ai.prevDirection = ai.direction;

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
function aiDie(aiIndex, cause, displayCause) {
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

  // Show death message. displayCause lets collision handling keep the original
  // internal cause while avoiding a head-on message for side/rear-end hits.
  showAiDeathMessage(ai, displayCause || cause);

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
    countDeepEscapeRoutes,
    aiPathCutStep,
    AI_STRATEGY,
    DIRS,
    processCorpses,
    CORPSE_CONVERSION_BATCH
  };
}
