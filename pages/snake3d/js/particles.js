// ─── PARTICLES (object pool) ───
// Pre-allocated pool to avoid GC spikes from create/destroy cycles.
// Each burst reuses idle meshes instead of allocating new ones.
var parts = [];
var partMat = new THREE.MeshBasicMaterial({color:0xffaa00, transparent:true});
var partGeo = new THREE.SphereGeometry(.05, 4, 4);
var _partPool = []; // idle meshes ready for reuse
var MAX_PARTICLES = 200; // pool size cap

// Pre-allocate pool on init
function initParticles() {
  for(var i = 0; i < MAX_PARTICLES; i++) {
    var m = new THREE.Mesh(partGeo, partMat.clone());
    m.visible = false;
    scene.add(m);
    _partPool.push(m);
  }
}
initParticles();

function burst(x, z, col, n) {
  n = n || 8;
  for(var i = 0; i < n; i++) {
    // Reuse from pool, or skip if exhausted
    var m = _partPool.pop();
    if(!m) break;
    m.visible = true;
    m.position.set(gw(x), .3, gw(z));
    m.material.color.setHex(col); m.material.opacity = 1;
    m.scale.setScalar(1);
    m.userData = {vx:(Math.random()-.5)*.2, vy:Math.random()*.1+.05, vz:(Math.random()-.5)*.2, life:1};
    parts.push(m);
  }
}
function tickParts(dt) {
  for(var i=parts.length-1; i>=0; i--) {
    var p=parts[i]; p.userData.life -= dt*2.5;
    p.position.x+=p.userData.vx; p.position.y+=p.userData.vy; p.position.z+=p.userData.vz;
    p.userData.vy -= dt*.3;
    p.material.opacity = Math.max(0, p.userData.life);
    p.scale.setScalar(Math.max(.01, p.userData.life));
    if(p.userData.life<=0) {
      p.visible = false;
      p.material.opacity = 0;
      _partPool.push(p); // return to pool instead of dispose
      parts.splice(i,1);
    }
  }
}

log('5. Scene ready');
