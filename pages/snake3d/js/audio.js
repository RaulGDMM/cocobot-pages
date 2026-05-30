// ─── AUDIO (SFX) ───
var actx = null;
function initAudio() {
  if(!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){} }
  if(actx && actx.state === 'suspended') actx.resume();
}
function tone(f,d,t,v) {
  if(!actx) return;
  try {
    var o=actx.createOscillator(), g=actx.createGain();
    o.type=t||'square'; o.frequency.value=f;
    g.gain.value=v||.08; g.gain.exponentialRampToValueAtTime(.001,actx.currentTime+d);
    o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime+d);
  } catch(e){}
}
function sfxEat(){tone(587,.1,'square',.08);setTimeout(function(){tone(784,.12,'square',.08)},70);}
function sfxTurn(){tone(440,.03,'sine',.03);}
function sfxDie(){tone(180,.3,'sawtooth',.08);setTimeout(function(){tone(120,.4,'sawtooth',.06)},150);}
function sfxObstacle(){tone(220,.15,'square',.1);setTimeout(function(){tone(330,.2,'square',.08)},100);}

// ─── MUSIC PLAYER ───
var playlist = [
  {name: '🐍 Super Serpiente', file: 'music/retro-1.mp3'},
  {name: '🐍 Cobra Turbo', file: 'music/retro-2.mp3'},
  {name: '🐍 Pitón Retro', file: 'music/retro-3.mp3'},
  {name: '🐍 Víbora Eléctrica', file: 'music/retro-4.mp3'},
  {name: '🐍 Anaconda Arcade', file: 'music/retro-5.mp3'},
  {name: '🐍 Serpiente Loca', file: 'music/retro-6.mp3'},
  {name: '🐍 Boa Neon', file: 'music/retro-7.mp3'},
  {name: '🐍 Mamba Digital', file: 'music/retro-8.mp3'},
  {name: '🐍 Aspic Pixel', file: 'music/retro-9-v2.mp3'},
  {name: '🐍 Natrix Chiptune', file: 'music/retro-10.mp3'}
];
var currentTrack = 0;
var musicEl = null;
var musicPlaying = false;
var userPausedMusic = false;
var musicPlayerEl = null;
var mpPlayBtn = null;
var mpTrackEl = null;
var mpNumEl = null;

function initMusic() {
  musicEl = document.createElement('audio');
  musicEl.preload = 'auto';
  musicEl.volume = 0.4;
  musicPlayerEl = document.getElementById('music-player');
  mpPlayBtn = document.getElementById('mp-play');
  mpTrackEl = document.getElementById('mp-track');
  mpNumEl = document.getElementById('mp-num');

  currentTrack = Math.floor(Math.random() * playlist.length);
  musicEl.src = playlist[currentTrack].file;
  updateTrackDisplay();
  log('🎵 Ready: ' + playlist[currentTrack].name + ' (' + (currentTrack + 1) + '/' + playlist.length + ') — press ▶ to play');

  document.getElementById('mp-prev').addEventListener('click', function(e) { e.stopPropagation(); prevTrack(); });
  mpPlayBtn.addEventListener('click', function(e) { e.stopPropagation(); toggleMusic(); });
  document.getElementById('mp-next').addEventListener('click', function(e) { e.stopPropagation(); nextTrack(); });

  musicEl.addEventListener('ended', function() {
    log('🎵 Track ended, playing next');
    nextTrack();
  });

  musicEl.addEventListener('error', function(e) {
    log('❌ Music error: ' + (musicEl.error ? musicEl.error.message : 'unknown'));
  });

  log('🎵 Music player initialized with ' + playlist.length + ' tracks');
}

function updateTrackDisplay() {
  var track = playlist[currentTrack];
  mpTrackEl.textContent = track.name;
  mpNumEl.textContent = (currentTrack + 1) + '/' + playlist.length;
}

function shufflePlaylist() {
  for(var i = playlist.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = playlist[i];
    playlist[i] = playlist[j];
    playlist[j] = temp;
  }
  currentTrack = 0;
  log('🎵 Playlist shuffled, first track: ' + playlist[0].name);
}

function pickRandomTrack() {
  currentTrack = Math.floor(Math.random() * playlist.length);
  musicEl.src = playlist[currentTrack].file + '?t=' + Date.now();
  log('🎵 Picked random track: ' + playlist[currentTrack].name + ' (' + (currentTrack + 1) + '/' + playlist.length + ')');
}

function playTrack(index) {
  if(!musicEl) return;
  currentTrack = ((index % playlist.length) + playlist.length) % playlist.length;
  var track = playlist[currentTrack];
  musicEl.src = track.file + '?t=' + Date.now();
  musicEl.load();
  var playPromise = musicEl.play();
  if(playPromise) {
    playPromise.then(function() {
      musicPlaying = true;
      mpPlayBtn.textContent = '⏸';
      mpTrackEl.textContent = track.name;
      mpNumEl.textContent = (currentTrack + 1) + '/' + playlist.length;
      log('🎵 Playing: ' + track.name + ' (' + (currentTrack + 1) + '/' + playlist.length + ')');
    }).catch(function(e) {
      log('⚠️ Music play failed: ' + e.message);
    });
  }
}

function toggleMusic() {
  if(!musicEl) return;
  if(musicPlaying) {
    musicEl.pause();
    musicPlaying = false;
    userPausedMusic = true;
    mpPlayBtn.textContent = '▶';
    log('🎵 Music paused by user');
  } else {
    userPausedMusic = false;
    musicEl.play().then(function() {
      musicPlaying = true;
      mpPlayBtn.textContent = '⏸';
      log('🎵 Music resumed');
    }).catch(function(e) {
      log('⚠️ Music resume failed: ' + e.message);
    });
  }
}

function nextTrack() {
  playTrack(currentTrack + 1);
}

function prevTrack() {
  if(musicEl && musicEl.currentTime > 3) {
    musicEl.currentTime = 0;
    log('🎵 Restarted: ' + playlist[currentTrack].name);
  } else {
    playTrack(currentTrack - 1);
  }
}

function startMusic() {
  // No-op: music only plays when user presses ▶
}

function stopMusic() {
  if(musicEl && musicPlaying) {
    musicEl.pause();
    musicEl.currentTime = 0;
    musicPlaying = false;
    mpPlayBtn.textContent = '▶';
    log('🎵 Music stopped');
  }
}
