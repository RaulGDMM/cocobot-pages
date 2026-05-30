// ─── SNAKE 3D MESH ───
// ─── AI MODE: multi-snake support ───

var sGroup = new THREE.Group(); scene.add(sGroup);

// Shared geometries (reused across snakes)
var hGeo = new THREE.BoxGeometry(.8, .5, .8);
var bGeo = new THREE.BoxGeometry(.7, .45, .7);

// Legacy globals (used by game.js in solo mode)
var hMat = new THREE.MeshStandardMaterial({color:0x00ff88, emissive:0x00aa44, emissiveIntensity:.35});
var bMat = new THREE.MeshStandardMaterial({color:0x00cc66, emissive:0x004422, emissiveIntensity:.15});
var headM = null;
var bodyMs = [];

// Snake groups indexed by snake ID (multi-snake mode)
var snakeGroups = {};  // { id: { group, headM, bodyMs } }

// ─── Build snake mesh ───
// Usage: buildSnake()           → legacy mode, sets headM/bodyMs globals
// Usage: buildSnake(color)      → returns { group, headM, bodyMs } for multi-snake
function buildSnake(color) {
  var isMulti = (typeof color === 'string');

  // Materials
  var headMat, bodyMat;
  if (isMulti) {
    var snakeColor = SNAKE_COLORS[color] || SNAKE_COLORS.green;
    var emissive = new THREE.Color(snakeColor).multiplyScalar(0.6).getHex();
    headMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(snakeColor),
      emissive: emissive,
      emissiveIntensity: .35
    });
    bodyMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(snakeColor).multiplyScalar(0.7),
      emissive: new THREE.Color(snakeColor).multiplyScalar(0.2).getHex(),
      emissiveIntensity: .15
    });
  } else {
    // Legacy: clear existing and use global materials
    while(sGroup.children.length) {
      var c = sGroup.children[0]; sGroup.remove(c);
      if (c.geometry) c.geometry.dispose();
    }
    headMat = hMat;
    bodyMat = bMat;
  }

  var head = new THREE.Mesh(hGeo, headMat);
  head.position.y = .25;

  var bodies = [];
  for(var i = 0; i < 200; i++) {
    var m = new THREE.Mesh(bGeo, bodyMat);
    m.position.y = .225; m.visible = false;
    bodies.push(m);
  }

  if (isMulti) {
    // Multi-snake: wrap in a group
    var group = new THREE.Group();
    group.add(head);
    bodies.forEach(function(b) { group.add(b); });
    sGroup.add(group);
    return { group: group, headM: head, bodyMs: bodies };
  } else {
    // Legacy: add directly to sGroup, set globals
    sGroup.add(head);
    bodies.forEach(function(b) { sGroup.add(b); });
    headM = head;
    bodyMs = bodies;
    return;
  }
}

// ─── Refresh snake mesh ───
// Usage: refreshSnake()                       → legacy mode, uses snake/direction globals
// Usage: refreshSnake(snakeData, groupData)   → multi-snake mode
function refreshSnake(snakeData, groupData) {
  // Legacy mode: no arguments
  if (snakeData === undefined) {
    if(!snake || !snake.length || !headM || !bodyMs || !bodyMs.length) return;
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
