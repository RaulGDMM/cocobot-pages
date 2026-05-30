// ─── APPLES ───
var appleGroup = new THREE.Group(); scene.add(appleGroup);
var appleMeshes = [];
var appleGeo = new THREE.SphereGeometry(.25, 10, 10);
var appleMat = new THREE.MeshStandardMaterial({color:0xff2233, emissive:0x881122, emissiveIntensity:.5});

function buildApples() {
  while(appleGroup.children.length) { var c=appleGroup.children[0]; appleGroup.remove(c); }
  appleMeshes = [];
  for(var i = 0; i < NUM_APPLES; i++) {
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
  return false;
}

function spawnOneApple() {
  for(var tries = 0; tries < 200; tries++) {
    var x = Math.floor(Math.random()*GRID_SIZE)-half;
    var z = Math.floor(Math.random()*GRID_SIZE)-half;
    if(!isOccupied(x,z)) return {x:x, z:z};
  }
  return null;
}

function refreshApples() {
  for(var i = 0; i < NUM_APPLES; i++) {
    if(i < apples.length && apples[i]) {
      appleMeshes[i].visible = true;
      appleMeshes[i].position.set(gw(apples[i].x), .25, gw(apples[i].z));
    } else {
      appleMeshes[i].visible = false;
    }
  }
}

function initApples() {
  apples = [];
  for(var i = 0; i < NUM_APPLES; i++) {
    var a = spawnOneApple();
    if(a) apples.push(a);
  }
  refreshApples();
  log('Apples: ' + apples.length + ' spawned');
}
