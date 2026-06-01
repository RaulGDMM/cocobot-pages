// ─── APPLES ───
var appleGroup = new THREE.Group(); scene.add(appleGroup);
var appleMeshes = [];
var appleGeo = new THREE.SphereGeometry(.25, 10, 10);
var appleMat = new THREE.MeshStandardMaterial({color:0xff2233, emissive:0x881122, emissiveIntensity:.5});

// Extra margin for death apples (snake bodies converted to apples).
// Reduced from 200 to 100 — we only spawn every 2nd segment on death.
var APPLE_POOL_MARGIN = 100;

// ─── Apple position hash set for O(1) lookup ───
// Maintained as "x,z" → true. Rebuilt whenever apples change.
var appleSet = {};
function rebuildAppleSet() {
  appleSet = {};
  for (var i = 0; i < apples.length; i++) {
    if (apples[i]) appleSet[apples[i].x + ',' + apples[i].z] = true;
  }
}
// Incremental add — avoids iterating the entire array on death spikes.
function addToAppleSet(a) {
  if (a) appleSet[a.x + ',' + a.z] = true;
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
    var gl = new THREE.PointLight(0xff3344, .3, 3); g.add(gl);
    // Keep a direct reference to the point light so refreshApples() can toggle
    // it without scanning children. Death apples disable their light to avoid
    // dozens of simultaneous point lights when a snake corpse converts.
    g.userData.light = gl;
    appleGroup.add(g);
    appleMeshes.push(g);
    g.visible = false;
  }
}

function isOccupied(x, z) {
  if(snake.some(function(s){return s.x===x&&s.z===z;})) return true;
  // O(1) apple lookup via hash set instead of O(n) array scan
  if(appleSet[x + ',' + z]) return true;
  if(obstacles.some(function(o){return o.x===x&&o.z===z;})) return true;
  // ─── AI MODE: include AI snakes ───
   if(aiSnakes) {
     for(var i = 0; i < aiSnakes.length; i++) {
       var ai = aiSnakes[i];
       if(ai.alive && ai.snake.some(function(s){return s.x===x&&s.z===z;})) return true;
     }
   }
   // ─── CORPSES: O(1) lookup via corpseSet hash ───
   if(corpseSet[x + ',' + z]) return true;
   return false;
}

// Incremental appleSet update — replace old apple with new one in the hash.
// This avoids the expensive rebuildAppleSet() call on every eat.
function updateAppleSet(oldApple, newApple) {
  if (oldApple) delete appleSet[oldApple.x + ',' + oldApple.z];
  if (newApple) appleSet[newApple.x + ',' + newApple.z] = true;
}

function spawnOneApple() {
  for(var tries = 0; tries < 200; tries++) {
    var x = gridMinX + Math.floor(Math.random() * (gridMaxX - gridMinX));
    var z = gridMinZ + Math.floor(Math.random() * (gridMaxZ - gridMinZ));
    if(!isOccupied(x,z)) return {x:x, z:z};
  }
  return null;
}

// Dirty flag — set whenever apples change (eat, death, shrink).
// refreshApples() only iterates meshes when this is true.
var appleDirty = false;

function refreshApples() {
  if (!appleDirty || !appleMeshes || !appleMeshes.length) return;
  appleDirty = false;
  var totalApples = Math.min(apples.length, appleMeshes.length);
  for(var i = 0; i < totalApples; i++) {
    if(apples[i]) {
      appleMeshes[i].visible = true;
      appleMeshes[i].position.set(gw(apples[i].x), .25, gw(apples[i].z));
      // Death apples render the sphere but disable their point light. Without
      // this, a converting corpse would switch on dozens of point lights at
      // once, forcing THREE.js to re-shade every object against every light.
      var light = appleMeshes[i].userData && appleMeshes[i].userData.light;
      if (light) light.visible = !apples[i].fromDeath;
    } else {
      appleMeshes[i].visible = false;
    }
  }
  // Hide any unused meshes
  for(var i = totalApples; i < appleMeshes.length; i++) {
    appleMeshes[i].visible = false;
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
  var numApples = calcNumApples(GRID_SIZE);
  for(var i = 0; i < numApples; i++) {
    var a = spawnOneApple();
    if(a) apples.push(a);
  }
  rebuildAppleSet();
  appleDirty = true;
  refreshApples();
  log('Apples: ' + apples.length + ' spawned (target: ' + numApples + ')');
}

// ─── Module exports (for testing — ignored in browser) ───
if(typeof module !== 'undefined' && module.exports) {
  module.exports = { isOccupied, spawnOneApple, refreshApples, initApples, deduplicateApples, rebuildAppleSet, addToAppleSet, updateAppleSet, appleSet, APPLE_POOL_MARGIN, corpseSet, rebuildCorpseSet, removeFromCorpseSet, addToCorpseSet };
}
