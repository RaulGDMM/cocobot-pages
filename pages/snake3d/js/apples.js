// ─── APPLES ───
var appleGroup = new THREE.Group(); scene.add(appleGroup);
var appleMeshes = [];
var animatedAppleMeshIndices = [];
var appleGeo = new THREE.SphereGeometry(.25, 10, 10);
var appleMat = new THREE.MeshStandardMaterial({color:0xff2233, emissive:0x881122, emissiveIntensity:.5});

// Extra margin for death apples (snake bodies converted to apples).
// Reduced from 200 to 100 — we only spawn every 2nd segment on death.
var APPLE_POOL_MARGIN = 100;

// ─── Apple position hash set for O(1) lookup ───
// Maintained as "x,z" → true. Rebuilt whenever apples change.
var appleSet = {};
// Maintained as "x,z" → first index in apples[]. Used when a snake eats.
// This avoids scanning all death apples every time any snake moves onto food.
var appleIndex = {};
function appleKey(x, z) { return x + ',' + z; }
function rebuildAppleSet() {
  appleSet = {};
  appleIndex = {};
  for (var i = 0; i < apples.length; i++) {
    if (apples[i]) {
      var key = appleKey(apples[i].x, apples[i].z);
      appleSet[key] = true;
      if (appleIndex[key] === undefined) appleIndex[key] = i;
    }
  }
}
// Incremental add — avoids iterating the entire array on death spikes.
function addToAppleSet(a, index) {
  if (!a) return;
  var key = appleKey(a.x, a.z);
  appleSet[key] = true;
  if (index === undefined) index = apples.length - 1;
  if (index >= 0 && appleIndex[key] === undefined) appleIndex[key] = index;
}

function findAppleIndexForKey(key) {
  for (var i = 0; i < apples.length; i++) {
    if (!apples[i]) continue;
    if (appleKey(apples[i].x, apples[i].z) === key) return i;
  }
  return -1;
}

function removeFromAppleSet(a, index) {
  if (!a) return;
  var key = appleKey(a.x, a.z);
  if (index === undefined || appleIndex[key] === index) {
    delete appleIndex[key];
    var fallback = findAppleIndexForKey(key);
    if (fallback >= 0) {
      appleIndex[key] = fallback;
    } else {
      delete appleSet[key];
    }
  }
}

// ─── Corpse position hash set for O(1) lookup ───
// Maintained as "x,z" → true. Covers unconverted corpse segments.
// Updated incrementally when corpses are created and segments convert.
// This replaces the O(n) linear scan in isOccupied() and buildBlockedSet().
var corpseSet = {};
function rebuildCorpseSet() {
  corpseSet = {};
  if (corpses) {
    for (var i = 0; i < corpses.length; i++) {
      for (var j = corpses[i].convertIndex; j < corpses[i].segments.length; j++) {
        var seg = corpses[i].segments[j];
        corpseSet[seg.x + ',' + seg.z] = true;
      }
    }
  }
}
// Remove segments that were just converted (called from processCorpses)
function removeFromCorpseSet(segments, fromIndex, toIndex) {
  for (var j = fromIndex; j < toIndex && j < segments.length; j++) {
    delete corpseSet[segments[j].x + ',' + segments[j].z];
  }
}
// Add a new corpse's segments (called from aiDie)
function addToCorpseSet(segments) {
  for (var j = 0; j < segments.length; j++) {
    corpseSet[segments[j].x + ',' + segments[j].z] = true;
  }
}

function buildApples() {
  while(appleGroup.children.length) { var c=appleGroup.children[0]; appleGroup.remove(c); }
  appleMeshes = [];
  var numApples = calcNumApples(GRID_SIZE) + APPLE_POOL_MARGIN;
  for(var i = 0; i < numApples; i++) {
    var g = new THREE.Group();
    var m = new THREE.Mesh(appleGeo, appleMat);
     g.add(m);
     appleGroup.add(g);
    appleMeshes.push(g);
    g.visible = false;
  }
}

function isOccupied(x, z) {
  if(snake.some(function(s){return s.x===x&&s.z===z;})) return true;
  // O(1) apple lookup via hash set instead of O(n) array scan
  if(appleSet[appleKey(x, z)]) return true;
  if(obstacles.some(function(o){return o.x===x&&o.z===z;})) return true;
  // ─── AI MODE: include AI snakes ───
   if(aiSnakes) {
     for(var i = 0; i < aiSnakes.length; i++) {
       var ai = aiSnakes[i];
       if(ai.alive && ai.snake.some(function(s){return s.x===x&&s.z===z;})) return true;
     }
   }
   // ─── CORPSES: O(1) lookup via corpseSet hash ───
   if(corpseSet[appleKey(x, z)]) return true;
   return false;
}

// Incremental appleSet update — replace old apple with new one in the hash.
// This avoids the expensive rebuildAppleSet() call on every eat.
function updateAppleSet(oldApple, newApple, index) {
  if (index === undefined) {
    if (oldApple) {
      delete appleSet[appleKey(oldApple.x, oldApple.z)];
      delete appleIndex[appleKey(oldApple.x, oldApple.z)];
    }
    if (newApple) {
      var newKey = appleKey(newApple.x, newApple.z);
      appleSet[newKey] = true;
      var found = findAppleIndexForKey(newKey);
      if (found >= 0) appleIndex[newKey] = found;
    }
    return;
  }
  removeFromAppleSet(oldApple, index);
  if (newApple) addToAppleSet(newApple, index);
}

function getAppleIndexAt(x, z) {
  var key = appleKey(x, z);
  var index = appleIndex[key];
  if (index !== undefined && apples[index] && apples[index].x === x && apples[index].z === z) return index;
  index = findAppleIndexForKey(key);
  if (index >= 0) {
    appleIndex[key] = index;
    appleSet[key] = true;
    return index;
  }
  delete appleIndex[key];
  delete appleSet[key];
  return -1;
}

function removeAppleAt(index) {
  if (index < 0 || index >= apples.length) return null;
  var oldApple = apples[index];
  var oldKey = oldApple ? appleKey(oldApple.x, oldApple.z) : null;
  var lastIndex = apples.length - 1;
  var movedApple = apples[lastIndex];

  if (oldKey) {
    delete appleSet[oldKey];
    delete appleIndex[oldKey];
  }

  if (index !== lastIndex) {
    apples[index] = movedApple;
  }
  apples.pop();

  if (movedApple && index !== lastIndex) {
    var movedKey = appleKey(movedApple.x, movedApple.z);
    appleSet[movedKey] = true;
    appleIndex[movedKey] = index;
  }

  if (oldKey && !appleSet[oldKey]) {
    var fallback = findAppleIndexForKey(oldKey);
    if (fallback >= 0) {
      appleSet[oldKey] = true;
      appleIndex[oldKey] = fallback;
    }
  }

  appleDirty = true;
  return oldApple;
}

function replaceAppleAt(index, newApple) {
  if (index < 0 || index >= apples.length) return null;
  if (!newApple) return removeAppleAt(index);
  var oldApple = apples[index];
  apples[index] = newApple;
  updateAppleSet(oldApple, newApple, index);
  appleDirty = true;
  return oldApple;
}

function replacementForEatenApple(eatenApple) {
  // Corpse apples are bonus food created at body segment positions. When eaten
  // they should disappear; respawning them elsewhere makes apples appear in
  // places where no snake body ever was.
  if (eatenApple && eatenApple.fromDeath) return null;
  return spawnOneApple();
}

function buildSpawnOccupiedSet() {
  var occupied = {};
  for (var i = 0; i < snake.length; i++) occupied[appleKey(snake[i].x, snake[i].z)] = true;
  for (var o = 0; o < obstacles.length; o++) occupied[appleKey(obstacles[o].x, obstacles[o].z)] = true;
  if (aiSnakes) {
    for (var a = 0; a < aiSnakes.length; a++) {
      var ai = aiSnakes[a];
      if (!ai.alive) continue;
      for (var s = 0; s < ai.snake.length; s++) occupied[appleKey(ai.snake[s].x, ai.snake[s].z)] = true;
    }
  }
  for (var ck in corpseSet) occupied[ck] = true;
  for (var ak in appleSet) occupied[ak] = true;
  return occupied;
}

function spawnOneApple() {
  var occupied = buildSpawnOccupiedSet();
  for(var tries = 0; tries < 200; tries++) {
    var x = gridMinX + Math.floor(Math.random() * (gridMaxX - gridMinX));
    var z = gridMinZ + Math.floor(Math.random() * (gridMaxZ - gridMinZ));
    if(!occupied[appleKey(x, z)]) return {x:x, z:z};
  }
  return null;
}

// Dirty flag — set whenever apples change (eat, death, shrink).
// refreshApples() only iterates meshes when this is true.
var appleDirty = false;

function refreshApples() {
  if (!appleDirty || !appleMeshes || !appleMeshes.length) return;
  appleDirty = false;
  animatedAppleMeshIndices = [];
  var totalApples = Math.min(apples.length, appleMeshes.length);
  for(var i = 0; i < totalApples; i++) {
    if(apples[i]) {
      appleMeshes[i].visible = true;
       appleMeshes[i].position.set(gw(apples[i].x), .25, gw(apples[i].z));
       appleMeshes[i].userData.animate = !apples[i].fromDeath;
      if (!apples[i].fromDeath) animatedAppleMeshIndices.push(i);
    } else {
      appleMeshes[i].visible = false;
      appleMeshes[i].userData.animate = false;
    }
  }
  // Hide any unused meshes
  for(var i = totalApples; i < appleMeshes.length; i++) {
    appleMeshes[i].visible = false;
    appleMeshes[i].userData.animate = false;
  }
}

// Remove duplicate apples at the same position, keeping the first occurrence
// Returns the number of duplicates removed
function deduplicateApples() {
  var seen = {};
  var unique = [];
  for(var i = 0; i < apples.length; i++) {
    if(!apples[i]) {
      unique.push(null);
      continue;
    }
    var key = apples[i].x + ',' + apples[i].z;
    if(seen[key]) {
      // Duplicate — skip it
    } else {
      seen[key] = true;
      unique.push(apples[i]);
    }
  }
  var removed = apples.length - unique.length;
  // Replace global array contents
  apples.length = 0;
  for(var i = 0; i < unique.length; i++) {
    apples.push(unique[i]);
  }
  rebuildAppleSet();
  if(removed > 0) {
    log('Deduplicated apples: removed ' + removed + ' ghosts');
  }
  return removed;
}

function initApples() {
  apples = [];
  rebuildAppleSet();
  var numApples = calcNumApples(GRID_SIZE);
  for(var i = 0; i < numApples; i++) {
    var a = spawnOneApple();
    if(a) {
      apples.push(a);
      addToAppleSet(a, apples.length - 1);
    }
  }
  rebuildAppleSet();
  appleDirty = true;
  refreshApples();
  log('Apples: ' + apples.length + ' spawned (target: ' + numApples + ')');
}

// ─── Module exports (for testing — ignored in browser) ───
if(typeof module !== 'undefined' && module.exports) {
  module.exports = { isOccupied, spawnOneApple, refreshApples, initApples, deduplicateApples, rebuildAppleSet, addToAppleSet, updateAppleSet, getAppleIndexAt, removeAppleAt, replaceAppleAt, replacementForEatenApple, appleSet, appleIndex, animatedAppleMeshIndices, APPLE_POOL_MARGIN, corpseSet, rebuildCorpseSet, removeFromCorpseSet, addToCorpseSet };
}
