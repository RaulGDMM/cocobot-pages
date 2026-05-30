// ─── GAME LOGIC ───
function initGame() {
  log('=== initGame() ===');

  // ─── AI MODE: rebuild board with dynamic grid size ───
  half = gridSize / 2;
  rebuildBoard(gridSize);

  snake=[]; direction=0; score=0; gameOver=false;
  obstacles=[]; apples=[];
  scoreEl.textContent='0';
  snake.push({x:-5,z:0}); snake.push({x:-6,z:0});
  snake.push({x:-7,z:0}); snake.push({x:-8,z:0});
  log('Snake data: ' + snake.length + ' segments');
  buildSnake();
  log('buildSnake done: headM=' + (headM ? 'OK' : 'NULL') + ', bodyMs=' + bodyMs.length);
  buildObstacles(); buildApples();
  refreshObstacles();
  initApples();
  log('Apples: ' + apples.filter(Boolean).length + '/' + apples.length);
  refreshSnake();
  log('refreshSnake done: head at (' + (headM ? headM.position.x : 'NULL') + ',' + (headM ? headM.position.z : 'NULL') + ')');
  headSmoothX = gw(-5);
  headSmoothZ = gw(0);
  camSmoothX = gw(-5) - 5;
  camSmoothZ = gw(0);
  lookSmoothX = gw(-5) + 3;
  lookSmoothZ = gw(0);
  log('Snake: '+snake.length+' seg, dir=0, grid=' + gridSize + ', half=' + half);
}

function turnL(){if(!running||gameOver)return;direction-=TURN_ANGLE;sfxTurn();}
function turnR(){if(!running||gameOver)return;direction+=TURN_ANGLE;sfxTurn();}

function step() {
  if(gameOver) return;
  var h=snake[0];
  var nx=h.x+Math.round(Math.cos(direction));
  var nz=h.z+Math.round(Math.sin(direction));
  if(nx<-half||nx>=half||nz<-half||nz>=half){log('Wall hit ('+nx+','+nz+')');die();return;}
  if(snake.some(function(s){return s.x===nx&&s.z===nz;})){log('Self hit ('+nx+','+nz+')');die();return;}
  if(obstacles.some(function(o){return o.x===nx&&o.z===nz;})){log('Obstacle hit ('+nx+','+nz+')');die();return;}
  // ─── AI MODE: collision with AI snake bodies ───
  if(aiSnakes) {
    for(var k = 0; k < aiSnakes.length; k++) {
      if(!aiSnakes[k].alive) continue;
      var aiBody = aiSnakes[k].snake;
      for(var j = 0; j < aiBody.length; j++) {
        if(aiBody[j].x === nx && aiBody[j].z === nz) {
          log('Hit AI#'+k+' body at ('+nx+','+nz+')');
          die('ai');
          return;
        }
      }
    }
  }
  // ─── AI MODE: collision with corpses ───
  if(corpses) {
    for(var c = 0; c < corpses.length; c++) {
      var corpse = corpses[c];
      for(var ci = 0; ci < corpse.snake.length; ci++) {
        if(corpse.snake[ci].x === nx && corpse.snake[ci].z === nz) {
          log('Hit corpse at ('+nx+','+nz+')');
          die();
          return;
        }
      }
    }
  }
  snake.unshift({x:nx,z:nz});
  var ate = false;
  for(var i = 0; i < apples.length; i++) {
    if(apples[i] && nx===apples[i].x && nz===apples[i].z) {
      score++; scoreEl.textContent=score; ate=true;
      sfxEat(); burst(apples[i].x, apples[i].z, 0xff6644, 10);
      log('Eat apple at ('+apples[i].x+','+apples[i].z+') score='+score);
      var newA = spawnOneApple();
      apples[i] = newA;
      if(score % OBSTACLE_SPAWN_EVERY === 0) spawnObstacle();
      break;
    }
  }
  if(!ate) snake.pop();
  refreshApples();
}

function die() {
  log('GAME OVER score='+score);
  gameOver=true; running=false; sfxDie();
  if(snake.length) burst(snake[0].x,snake[0].z,0xff0000,12);
  if(score>highScore){highScore=score;localStorage.setItem('snake3d_hs',highScore);highscoreEl.textContent=highScore;}
  totalGames++;
  localStorage.setItem('snake3d_games', totalGames);
  gamesCountEl.textContent = totalGames;
  finalScoreEl.textContent='Puntuación: '+score+' 🍎';
  finalScoreEl.style.display='block';
  startBtn.textContent='REINTENTAR';
  overlay.classList.remove('hidden');
  hintL.style.opacity='1'; hintR.style.opacity='1';
}

// ─── CAMERA (framerate-independent, head-interpolated) ───
var isMobile = window.innerWidth < 600;
var CAM_SMOOTH_SPEED = 8; // smoothing factor (higher = faster follow)
var HEAD_SMOOTH_SPEED = 12; // head position smoothing (higher = snappier)
var headSmoothX = 0, headSmoothZ = 0; // interpolated head position for camera
function updateCam(dt) {
  if(!snake.length) return;
  var camDist = isMobile ? 7 : 5;
  var camHeight = isMobile ? 6 : 4.5;
  var lookAhead = isMobile ? 4 : 3;
  var dx = Math.cos(direction);
  var dz = Math.sin(direction);
  // Smooth head position (interpolate between grid cells)
  var headTargetX = gw(snake[0].x);
  var headTargetZ = gw(snake[0].z);
  var headFactor = 1 - Math.exp(-HEAD_SMOOTH_SPEED * dt);
  headSmoothX += (headTargetX - headSmoothX) * headFactor;
  headSmoothZ += (headTargetZ - headSmoothZ) * headFactor;
  // Camera follows smoothed head
  var idealX = headSmoothX - dx * camDist;
  var idealZ = headSmoothZ - dz * camDist;
  var factor = 1 - Math.exp(-CAM_SMOOTH_SPEED * dt);
  camSmoothX += (idealX - camSmoothX) * factor;
  camSmoothZ += (idealZ - camSmoothZ) * factor;
  camera.position.x = camSmoothX;
  camera.position.y = camHeight;
  camera.position.z = camSmoothZ;
  var targetLookX = headSmoothX + dx * lookAhead;
  var targetLookZ = headSmoothZ + dz * lookAhead;
  lookSmoothX += (targetLookX - lookSmoothX) * factor;
  lookSmoothZ += (targetLookZ - lookSmoothZ) * factor;
  camera.lookAt(lookSmoothX, 0, lookSmoothZ);
  pLight.position.set(headSmoothX, 5, headSmoothZ);
}
