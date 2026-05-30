// ─── SNAKE 3D MESH ───
var sGroup = new THREE.Group(); scene.add(sGroup);
var hGeo = new THREE.BoxGeometry(.8, .5, .8);
var hMat = new THREE.MeshStandardMaterial({color:0x00ff88, emissive:0x00aa44, emissiveIntensity:.35});
var bGeo = new THREE.BoxGeometry(.7, .45, .7);
var bMat = new THREE.MeshStandardMaterial({color:0x00cc66, emissive:0x004422, emissiveIntensity:.15});
var headM = null;
var bodyMs = [];

function buildSnake() {
  while(sGroup.children.length) { var c=sGroup.children[0]; sGroup.remove(c); c.geometry&&c.geometry.dispose(); }
  bodyMs = [];
  headM = new THREE.Mesh(hGeo, hMat); headM.position.y = .25; sGroup.add(headM);
  for(var i = 0; i < 200; i++) {
    var m = new THREE.Mesh(bGeo, bMat);
    m.position.y = .225; m.visible = false; sGroup.add(m); bodyMs.push(m);
  }
}

function refreshSnake() {
  if(!snake.length) return;
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
}
