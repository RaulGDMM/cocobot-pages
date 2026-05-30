// ─── WebGL context loss ───
canvas.addEventListener('webglcontextlost', function(e) {
  e.preventDefault(); log('⚠️ WebGL LOST'); showErr('WebGL perdido...'); running = false;
});
canvas.addEventListener('webglcontextrestored', function(e) {
  log('✅ WebGL RESTORED'); showErr('');
  if(!running && !gameOver) { try { buildSnake(); refreshSnake(); refreshApples(); refreshObstacles(); log('Scene rebuilt'); } catch(err) { log('❌ Rebuild: '+err.message); } }
  else if(running) { lastMoveTime = performance.now(); log('Context restored — continuing'); }
});

// ─── ANIMATION LOOP ───
var frameCount = 0;
log('6. Starting loop...');
function loop(now) {
  requestAnimationFrame(loop);
  frameCount++;
  try {
    var dt = Math.min((now-(loop._p||now))/1000, .05);
    loop._p = now;
    if(frameCount===1) log('7. First frame OK');
    if(frameCount===60) log('8. 60 frames OK, waiting for JUGAR');

    if(running && !gameOver) {
      if(now-lastMoveTime >= MOVE_INTERVAL) {
        // ─── AI MODE: step AI before player ───
        if(aiSnakes && aiSnakes.length > 0) stepAI();
        step();
        lastMoveTime=now;
      }
      refreshSnake();
      // ─── AI MODE: refresh AI snake meshes ───
      refreshAISnakes();
    }

    // Apple animation
     if(appleMeshes && appleMeshes.length) {
      for(var i = 0; i < appleMeshes.length; i++) {
        if(appleMeshes[i].visible) {
          appleMeshes[i].position.y = .25 + Math.sin(now*.003 + i)*.1;
          appleMeshes[i].rotation.y = now*.002 + i;
        }
      }
    }

    tickParts(dt);
    updateCam(dt);
    renderer.render(scene, camera);
  } catch(e) {
    log('❌ Loop err f'+frameCount+': '+e.message); showErr(e.message);
  }
}

// ─── RESIZE ───
window.addEventListener('resize', function() {
  var w=window.innerWidth,h=window.innerHeight,a=w/h;
  camera.aspect = a; camera.updateProjectionMatrix(); renderer.setSize(w,h);
});

// ─── START ───
startBtn.addEventListener('click', function() {
  log('▶ CLICK ' + startBtn.textContent);
  initAudio();

  // ─── AI MODE: read config from UI ───
  var config = getGameConfig();
  gameMode = config.mode;
  difficulty = config.difficulty;
  playerColor = config.color;
  gridSize = config.gridSize;
  gridSizeModifier = config.gridSizeModifier;
  log('Config: mode=' + gameMode + ' diff=' + difficulty + ' color=' + playerColor + ' grid=' + gridSize);

  overlay.classList.add('hidden');
  hintL.style.opacity='0'; hintR.style.opacity='0';
  initGame();

  // ─── AI MODE: initialize AI snakes ───
  initAI();
  // Build AI snake meshes
  if(aiSnakes) {
    aiSnakes.forEach(function(ai, i) {
      ai.groupData = buildSnake(ai.color);
    });
  }

  running=true;
  lastMoveTime = performance.now();
  log('RUNNING! MOVE_INTERVAL='+MOVE_INTERVAL+'ms');
});

// ─── INIT ───
buildSnake(); buildObstacles(); buildApples();
initMusic();
initUISelectors();
requestAnimationFrame(loop);
log('✅ INIT COMPLETE');
