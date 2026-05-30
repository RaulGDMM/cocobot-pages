// ─── PARTICLES ───
var parts = [];
var partMat = new THREE.MeshBasicMaterial({color:0xffaa00, transparent:true});
var partGeo = new THREE.SphereGeometry(.05, 4, 4);
function burst(x, z, col, n) {
  for(var i = 0; i < (n||8); i++) {
    var m = new THREE.Mesh(partGeo, partMat.clone());
    m.position.set(gw(x), .3, gw(z));
    m.material.color.setHex(col); m.material.opacity = 1;
    m.userData = {vx:(Math.random()-.5)*.2, vy:Math.random()*.1+.05, vz:(Math.random()-.5)*.2, life:1};
    scene.add(m); parts.push(m);
  }
}
function tickParts(dt) {
  for(var i=parts.length-1; i>=0; i--) {
    var p=parts[i]; p.userData.life -= dt*2.5;
    p.position.x+=p.userData.vx; p.position.y+=p.userData.vy; p.position.z+=p.userData.vz;
    p.userData.vy -= dt*.3;
    p.material.opacity = Math.max(0, p.userData.life);
    p.scale.setScalar(Math.max(.01, p.userData.life));
    if(p.userData.life<=0) { scene.remove(p); p.material.dispose(); parts.splice(i,1); }
  }
}

log('5. Scene ready');
