// ─── APPLES ───
var appleGroup = new THREE.Group(); scene.add(appleGroup);
var appleMeshes = [];
var appleGeo = new THREE.SphereGeometry(.25, 10, 10);
var appleMat = new THREE.MeshStandardMaterial({color:0xff2233, emissive:0x881122, emissiveIntensity:.5});

function buildApples() {
  while(appleGroup.children.length) { var c=appleGroup.children[0]; appleGroup.remove(c); }
  appleMeshes = [];
  var numApples = calcNumApples(GRID_SIZE);
  for(var i = 0; i < numApples; i++) {
    var g = new THREE.Group();
    var m = new THREE.Mesh(appleGeo, appleMat);
    g.add(m);
    var gl = new THREE.PointLight(0xff3344, .3, 3); g.add(gl);
    appleGroup.add(g);
    appleMeshes.push(g);
    g.visible = false;
  }
}

function isOccupied(x, z) {
  if(snake.some(function(s){return s.x===x&&s.z===z;})) return true;
  if(apples.some(function(a){return a&&a.x===x&&a.z===z;})) return true;
  if(obstacles.some(function(o){return o.x===x&&o.z===z;})) return true;
  // ─── AI MODE: include AI snakes ───
  if(aiSnakes) {
    for(var i = 0; i < aiSnakes.length; i++) {
      var ai = aiSnakes[i];
      if(ai.alive && ai.snake.some(function(s){return s.x===x&&s.z===z;})) return true;
    }
  }
  return false;
}

function spawnOneApple() {
  for(var tries = 0; tries < 200; tries++) {
    var x = gridMinX + Math.floor(Math.random() * (gridMaxX - gridMinX));
    var z = gridMinZ + Math.floor(Math.random() * (gridMaxZ - gridMinZ));
    if(!isOccupied(x,z)) return {x:x, z:z};
  }
  return null;
}

function refreshApples() {
  if (!appleMeshes || !appleMeshes.length) return;
  var totalApples = apples.length;
  var rendered = 0;
  for(var i = 0; i < totalApples; i++) {
    if(i >= appleMeshes.length) {
      // Create extra mesh for death apples beyond the initial pool
      var g = new THREE.Group();
      var m = new THREE.Mesh(appleGeo, appleMat);
      g.add(m);
      var gl = new THREE.PointLight(0xff3344, .3, 3); g.add(gl);
      appleGroup.add(g);
      appleMeshes.push(g);
    }
    if(apples[i]) {
      appleMeshes[i].visible = true;
      appleMeshes[i].position.set(gw(apples[i].x), .25, gw(apples[i].z));
      rendered++;
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
  refreshApples();
  log('Apples: ' + apples.length + ' spawned (target: ' + numApples + ')');
}

// ─── Module exports (for testing — ignored in browser) ───
if(typeof module !== 'undefined' && module.exports) {
  module.exports = { isOccupied, spawnOneApple, refreshApples, initApples, deduplicateApples };
}
