// ─── CONTROLS ───
log('9. Controls ready');
document.addEventListener('keydown', function(e) {
  if(e.key==='ArrowLeft'||e.key==='a'||e.key==='A'){e.preventDefault();turnL();}
  if(e.key==='ArrowRight'||e.key==='d'||e.key==='D'){e.preventDefault();turnR();}
});
document.getElementById('tz-left').addEventListener('touchstart',function(e){e.preventDefault();turnL();},{passive:false});
document.getElementById('tz-right').addEventListener('touchstart',function(e){e.preventDefault();turnR();},{passive:false});
