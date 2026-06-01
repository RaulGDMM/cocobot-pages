// ─── SNAKE 3D MESH ───
// ─── AI MODE: multi-snake support ───

var sGroup = new THREE.Group(); scene.add(sGroup);

// Shared geometries (reused across snakes)
var hGeo = new THREE.BoxGeometry(.8, .5, .8);
var bGeo = new THREE.BoxGeometry(.7, .45, .7);

// Legacy globals (used by game.js)
var headM = null;
var bodyMs = [];

// Player snake group data (persists across games)
var playerGroupData = null;

// ─── Build snake mesh ───
// Usage: buildSnake(color)  → returns { group, headM, bodyMs } for any snake
// Always uses multi-snake mode (wraps in a group)
function buildSnake(color) {
  var snakeColor = SNAKE_COLORS[color] || SNAKE_COLORS.green;

  var headMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(snakeColor),
    emissive: new THREE.Color(snakeColor).multiplyScalar(0.6).getHex(),
    emissiveIntensity: .35
  });
  var bodyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(snakeColor).multiplyScalar(0.7),
    emissive: new THREE.Color(snakeColor).multiplyScalar(0.2).getHex(),
    emissiveIntensity: .15
  });

  var head = new THREE.Mesh(hGeo, headMat);
  head.position.y = .25;

  var bodies = [];
  for(var i = 0; i < 200; i++) {
    var m = new THREE.Mesh(bGeo, bodyMat);
    m.position.y = .225; m.visible = false;
    bodies.push(m);
  }

  var group = new THREE.Group();
  group.add(head);
  bodies.forEach(function(b) { group.add(b); });
  sGroup.add(group);

  // Also set legacy globals for backward compat with game.js / refreshSnake()
  headM = head;
  bodyMs = bodies;

  return { group: group, headM: head, bodyMs: bodies, _meshSig: null };
}

function snakeMeshSignature(snakeData, dir) {
  if (!snakeData || !snakeData.length) return 'empty';
  var head = snakeData[0];
  var neck = snakeData.length > 1 ? snakeData[1] : head;
  var tail = snakeData[snakeData.length - 1];
  return snakeData.length + '|' + head.x + ',' + head.z + '|' + neck.x + ',' + neck.z + '|' + tail.x + ',' + tail.z + '|' + dir;
}

// ─── Refresh snake mesh ───
// Usage: refreshSnake()                       → uses playerGroupData
// Usage: refreshSnake(snakeData, groupData)   → multi-snake mode
function refreshSnake(snakeData, groupData) {
  if (snakeData === undefined) {
    // Legacy / player mode: use playerGroupData
    var gd = playerGroupData;
    if(!gd || !gd.headM || !gd.bodyMs || !gd.bodyMs.length || !snake || !snake.length) return;
    headM = gd.headM;
    bodyMs = gd.bodyMs;
    var playerSig = snakeMeshSignature(snake, direction);
    if (gd._meshSig === playerSig) return;
    gd._meshSig = playerSig;
    headM.position.set(gw(snake[0].x), .25, gw(snake[0].z));
    headM.rotation.y = -direction;
    for(var i = 1; i < snake.length; i++) {
      if(i < bodyMs.length) {
        bodyMs[i].visible = true;
        bodyMs[i].position.set(gw(snake[i].x), .225, gw(snake[i].z));
        var frac = i / Math.max(snake.length, 1);
        var s = 1 - frac * .4;
        bodyMs[i].scale.set(s, 1, s);
      }
    }
    for(var i = snake.length; i < bodyMs.length; i++) bodyMs[i].visible = false;
    return;
  }

  // Multi-snake mode
  if(!snakeData || !snakeData.length || !groupData || !groupData.bodyMs || !groupData.bodyMs.length) return;
  var head = groupData.headM;
  var bodies = groupData.bodyMs;
  var dir = groupData.direction || 0;

  var sig = snakeMeshSignature(snakeData, dir);
  if (groupData._meshSig === sig) return;
  groupData._meshSig = sig;

  head.position.set(gw(snakeData[0].x), .25, gw(snakeData[0].z));
  head.rotation.y = -dir;

  for(var i = 1; i < snakeData.length; i++) {
    if(i < bodies.length) {
      bodies[i].visible = true;
      bodies[i].position.set(gw(snakeData[i].x), .225, gw(snakeData[i].z));
      var frac = i / Math.max(snakeData.length, 1);
      var s = 1 - frac * .4;
      bodies[i].scale.set(s, 1, s);
    }
  }
  for(var i = snakeData.length; i < bodies.length; i++) bodies[i].visible = false;
}
