// ─── CONTROLS ───
log('9. Controls ready');
document.addEventListener('keydown', function(e) {
  if(e.key==='ArrowLeft'||e.key==='a'||e.key==='A'){e.preventDefault();turnL();}
  if(e.key==='ArrowRight'||e.key==='d'||e.key==='D'){e.preventDefault();turnR();}
  // ─── Pause toggle (P or Escape) ───
  if(e.key==='p'||e.key==='P'||e.key==='Escape'){e.preventDefault();togglePause();}
  // ─── Fullscreen toggle (F) ───
  if(e.key==='f'||e.key==='F'){e.preventDefault();toggleFullscreen();}
});
document.getElementById('tz-left').addEventListener('touchstart',function(e){e.preventDefault();turnL();},{passive:false});
document.getElementById('tz-right').addEventListener('touchstart',function(e){e.preventDefault();turnR();},{passive:false});

// ─── PAUSE ───
var _pauseOverlay = null;
var _pauseText = null;
function togglePause() {
  if (!running || (gameOver && !spectating)) return;
  paused = !paused;
  var btn = document.getElementById('pause-btn');
  if (btn) btn.textContent = paused ? '▶' : '⏸';
  if (paused) {
    if (!_pauseOverlay) {
      _pauseOverlay = document.createElement('div');
      _pauseOverlay.id = 'pause-overlay';
      _pauseText = document.createElement('div');
      _pauseText.className = 'pause-text';
      _pauseText.textContent = '⏸ PAUSA';
      _pauseOverlay.appendChild(_pauseText);
      document.body.appendChild(_pauseOverlay);
    }
    _pauseOverlay.classList.add('visible');
    log('⏸ PAUSED');
  } else {
    if (_pauseOverlay) _pauseOverlay.classList.remove('visible');
    lastMoveTime = performance.now();
    log('▶ RESUMED');
  }
}

// ─── FULLSCREEN ───
function toggleFullscreen() {
  var btn = document.getElementById('fullscreen-btn');
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().then(function() {
      if (btn) btn.textContent = '⛶';
      log('⛶ Fullscreen ON');
    }).catch(function() {
      log('⚠️ Fullscreen not available');
    });
  } else {
    document.exitFullscreen().then(function() {
      if (btn) btn.textContent = '⛶';
      log('⛶ Fullscreen OFF');
    });
  }
}
document.addEventListener('fullscreenchange', function() {
  var btn = document.getElementById('fullscreen-btn');
  if (btn) btn.textContent = document.fullscreenElement ? '⛶' : '⛶';
});

// ─── Button event listeners ───
document.getElementById('pause-btn').addEventListener('click', togglePause);
document.getElementById('fullscreen-btn').addEventListener('click', toggleFullscreen);
