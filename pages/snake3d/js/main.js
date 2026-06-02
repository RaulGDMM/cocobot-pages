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

    if(running && !gameOver && !paused) {
       if(now-lastMoveTime >= MOVE_INTERVAL) {
          // ─── AI MODE: step AI before player ───
          if(aiSnakes && aiSnakes.length > 0) stepAI();
          step();
          // ─── CORPSES: convert one segment per corpse per tick ───
          if(typeof processCorpses === 'function') processCorpses();
          lastMoveTime=now;
        }
       refreshSnake();
       // ─── AI MODE: refresh AI snake meshes ───
       refreshAISnakes();

       // ─── GRID SHRINK: process countdowns ───
       processShrinkCountdowns(now);
     }

    // Apple animation. Death apples are intentionally static: after several
    // enemy deaths they dominate apple count, and animating all of them every
    // frame burns CPU without changing gameplay.
     if(animatedAppleMeshIndices && animatedAppleMeshIndices.length) {
      for(var ai = 0; ai < animatedAppleMeshIndices.length; ai++) {
        var i = animatedAppleMeshIndices[ai];
        var mesh = appleMeshes[i];
        if(mesh && mesh.visible && mesh.userData.animate) {
          mesh.position.y = .25 + Math.sin(now*.003 + i)*.1;
          mesh.rotation.y = now*.002 + i;
        }
      }
    }

    tickParts(dt);
    updateCam(dt);
    tuneMobileRenderQuality(dt);
    renderer.render(scene, camera);
  } catch(e) {
    log('❌ Loop err f'+frameCount+': '+e.message); showErr(e.message);
  }
}

// ─── RESIZE ───
window.addEventListener('resize', function() {
  var w=window.innerWidth,h=window.innerHeight,a=w/h;
  camera.aspect = a; camera.updateProjectionMatrix();
  renderPixelRatioFloor = isMobileRenderTarget() ? 1 : getRenderPixelRatio();
  renderFpsSamples = [];
  applyRenderPixelRatio(getRenderPixelRatio());
  renderer.setSize(w,h);
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

   // ─── Update leaderboard AFTER aiSnakes is set ───
    if (typeof updateLeaderboard === 'function') updateLeaderboard();

    // ─── Periodic leaderboard update (every second) ───
    // Keeps the rank display fresh as AI snakes die and scores change.
    if (typeof _leaderboardTimer !== 'undefined') clearInterval(_leaderboardTimer);
    _leaderboardTimer = setInterval(function() {
      if (running && !gameOver && aiSnakes && aiSnakes.length > 0) {
        if (typeof updateLeaderboard === 'function') updateLeaderboard();
      }
    }, 1000);

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
