// ─── OBSTACLES ───
var obsGroup = new THREE.Group(); scene.add(obsGroup);
var obsMeshes = [];
var obsGeo = new THREE.BoxGeometry(.8, .7, .8);
var obsMat = new THREE.MeshStandardMaterial({color:0x664444, emissive:0x331111, emissiveIntensity:.2, roughness:.6});

function buildObstacles() {
  while(obsGroup.children.length) { var c=obsGroup.children[0]; obsGroup.remove(c); }
  obsMeshes = [];
  var maxObs = calcMaxObstacles(GRID_SIZE);
  for(var i = 0; i < maxObs; i++) {
    var m = new THREE.Mesh(obsGeo, obsMat);
    m.position.y = .35; m.visible = false; obsGroup.add(m); obsMeshes.push(m);
  }
}

function refreshObstacles() {
  var maxObs = calcMaxObstacles(GRID_SIZE);
  for(var i = 0; i < maxObs; i++) {
    if(i < obstacles.length) {
      obsMeshes[i].visible = true;
      obsMeshes[i].position.set(gw(obstacles[i].x), .35, gw(obstacles[i].z));
    } else {
      obsMeshes[i].visible = false;
    }
  }
}

function isSafeForObstacle(x, z) {
  for(var i = 0; i < snake.length; i++) {
    var dx = snake[i].x - x, dz = snake[i].z - z;
    if(Math.abs(dx) + Math.abs(dz) < OBSTACLE_MIN_DIST_SNAKE) return false;
  }
  for(var i = 0; i < obstacles.length; i++) {
    var dx = obstacles[i].x - x, dz = obstacles[i].z - z;
    if(Math.abs(dx) + Math.abs(dz) < OBSTACLE_MIN_DIST_EACH) return false;
  }
  for(var i = 0; i < apples.length; i++) {
    if(!apples[i]) continue;
    var dx = apples[i].x - x, dz = apples[i].z - z;
    if(Math.abs(dx) + Math.abs(dz) < OBSTACLE_MIN_DIST_APPLE) return false;
  }
  // ─── AI MODE: keep distance from AI snakes too ───
  if(aiSnakes) {
    for(var i = 0; i < aiSnakes.length; i++) {
      var ai = aiSnakes[i];
      if(!ai.alive) continue;
      for(var j = 0; j < ai.snake.length; j++) {
        var dx = ai.snake[j].x - x, dz = ai.snake[j].z - z;
        if(Math.abs(dx) + Math.abs(dz) < OBSTACLE_MIN_DIST_SNAKE) return false;
      }
    }
  }
  if(isOccupied(x, z)) return false;
  return true;
}

function spawnObstacle() {
  var maxObs = calcMaxObstacles(GRID_SIZE);
  if(obstacles.length >= maxObs) return;
  for(var tries = 0; tries < 300; tries++) {
    var x = gridMinX + Math.floor(Math.random() * (gridMaxX - gridMinX));
    var z = gridMinZ + Math.floor(Math.random() * (gridMaxZ - gridMinZ));
    if(isSafeForObstacle(x, z)) {
      obstacles.push({x:x, z:z});
      refreshObstacles();
      log('Obstacle spawned at ('+x+','+z+') — total: '+obstacles.length);
      sfxObstacle();
      return;
    }
  }
  log('⚠️ Could not place obstacle');
}

// ─── Module exports (for testing — ignored in browser) ───
if(typeof module !== 'undefined' && module.exports) {
  module.exports = { isSafeForObstacle, spawnObstacle, refreshObstacles };
}
