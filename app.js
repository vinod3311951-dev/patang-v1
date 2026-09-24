// PATANG_VERSION: 1.7.0
// LAST_MAJOR_CHANGE: Danger bar game loop, canvas text prompts, AI aggression, string anchor fix, audio confirmation
"use strict";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const sceneImage = new Image();
const zones = {play:{x:0,y:0,w:0,h:0},dheel:{x:0,y:0,w:0,h:0},khench:{x:0,y:0,w:0,h:0},pause:{x:0,y:0,w:0,h:0}};
const promptQueue = [];
const player = {x:0,y:0,vx:100,vy:0,rotation:0,direction:1};
const ai = {x:0,y:0,vx:-60,vy:0,rotation:0,tension:0.3,state:"neutral",nextDiveAt:10,diveTime:0,trail:[]};

let assetsReady = false;
let assetFailed = false;
let mode = "home";
let paused = false;
let currentLevel = 1;
let elapsed = 0;
let levelTimeLeft = 58;
let lastTime = performance.now();
let flightTime = 0;
let tension = 0.3;
let tensionZone = "safe";
let audioCtx = null;
let ambientSource = null;
let ambientGain = null;
let nextBirdAt = 0;
let warningPulseAt = 0;
let dangerPulseAt = 0;
let STRING_WIDTH = 1;

// Return canvas width.
function W() {
  return canvas.width;
}

// Return canvas height.
function H() {
  return canvas.height;
}

// Disable legacy DOM interaction.
function disableDomPanels() {
  ["startScreen","levelScreen","pauseModal","resultModal","hud","statusBar"].forEach(id => {
    const node = document.getElementById(id);
    if (node) {
      node.classList.add("hidden");
      node.style.pointerEvents = "none";
    }
  });
}

// Resize drawing buffer.
function resizeCanvas() {
  canvas.width = Math.max(1,window.innerWidth);
  canvas.height = Math.max(1,window.innerHeight);
  canvas.style.width = window.innerWidth+"px";
  canvas.style.height = window.innerHeight+"px";
  recomputeLayout();
}

// Poll size every RAF tick.
function pollCanvasSize() {
  if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
    resizeCanvas();
  }
}

// Precompute layout and physical-pixel string width.
function recomputeLayout() {
  STRING_WIDTH = 1/window.devicePixelRatio;
  const buttonY = H()-112;
  zones.play = {x:W()*0.5-90,y:H()*0.68-30,w:180,h:60};
  zones.dheel = {x:24,y:buttonY,w:88,h:88};
  zones.khench = {x:128,y:buttonY,w:88,h:88};
  zones.pause = {x:W()-58,y:12,w:46,h:46};
  if (mode !== "playing") {
    resetKites();
  }
}

// Load the single scene asset with fallback state.
function loadScene() {
  sceneImage.onload = () => {
    assetsReady = true;
    assetFailed = false;
  };
  sceneImage.onerror = () => {
    assetsReady = false;
    assetFailed = true;
  };
  sceneImage.src = "public/assets/scene.png";
}

// Return level duration with twenty-second floor.
function levelDuration(level) {
  return Math.max(20,60-level*2);
}

// Reset player and AI positions.
function resetKites() {
  player.x = W()*0.34;
  player.y = H()*0.38;
  player.vx = 105;
  player.vy = 0;
  player.rotation = 0;
  player.direction = 1;
  ai.x = W()*0.72;
  ai.y = H()*0.30;
  ai.vx = -60;
  ai.vy = 0;
  ai.rotation = 0;
  ai.tension = 0.3;
  ai.state = "neutral";
  ai.diveTime = 0;
  ai.trail.length = 0;
  ai.nextDiveAt = flightTime+8+Math.random()*6;
}

// Begin gameplay.
function startGame() {
  if (!assetsReady) {
    return;
  }
  mode = "playing";
  paused = false;
  elapsed = 0;
  flightTime = 0;
  tension = 0.3;
  tensionZone = "safe";
  levelTimeLeft = levelDuration(currentLevel);
  promptQueue.length = 0;
  resetKites();
  recomputeLayout();
  startAmbient();
}

// Initialize or resume Web Audio during pointer gesture.
function unlockAudio() {
  if (!audioCtx) {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (AudioCtor) {
      audioCtx = new AudioCtor();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

// Create noise buffer.
function makeNoiseBuffer(seconds,brown) {
  const length = Math.max(1,Math.floor(audioCtx.sampleRate*seconds));
  const buffer = audioCtx.createBuffer(1,length,audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i=0;i<length;i+=1) {
    const white = Math.random()*2-1;
    last = brown ? (last+0.02*white)/1.02 : white;
    data[i] = brown ? last*3.5 : white;
  }
  return buffer;
}

// Start brown-noise ambience.
function startAmbient() {
  if (!audioCtx || ambientSource || paused || mode !== "playing") {
    return;
  }
  ambientSource = audioCtx.createBufferSource();
  ambientGain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();
  ambientSource.buffer = makeNoiseBuffer(2,true);
  ambientSource.loop = true;
  filter.type = "lowpass";
  filter.frequency.value = 400;
  ambientGain.gain.value = 0.03;
  ambientSource.connect(filter);
  filter.connect(ambientGain);
  ambientGain.connect(audioCtx.destination);
  ambientSource.start();
  nextBirdAt = flightTime+3+Math.random()*6;
  console.log("AMBIENT: started");
}

// Stop ambient layer.
function stopAmbient() {
  if (ambientSource) {
    ambientSource.stop();
    ambientSource.disconnect();
    ambientSource = null;
  }
  if (ambientGain) {
    ambientGain.disconnect();
    ambientGain = null;
  }
}

// Play a short oscillator envelope.
function playTone(name,type,hz,duration,gain,endHz) {
  console.log("SFX: "+name);
  if (!audioCtx) {
    return;
  }
  const now = audioCtx.currentTime;
  const oscillator = audioCtx.createOscillator();
  const amp = audioCtx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(hz,now);
  if (endHz) {
    oscillator.frequency.exponentialRampToValueAtTime(endHz,now+duration);
  }
  amp.gain.setValueAtTime(gain,now);
  amp.gain.exponentialRampToValueAtTime(0.0001,now+duration);
  oscillator.connect(amp);
  amp.connect(audioCtx.destination);
  oscillator.start(now);
  oscillator.stop(now+duration);
}

// Play DHEEL noise whoosh.
function soundDheel() {
  console.log("SFX: dheel");
  if (!audioCtx) {
    return;
  }
  const now = audioCtx.currentTime;
  const source = audioCtx.createBufferSource();
  const filter = audioCtx.createBiquadFilter();
  const amp = audioCtx.createGain();
  source.buffer = makeNoiseBuffer(0.10,false);
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(650,now);
  filter.frequency.exponentialRampToValueAtTime(1500,now+0.08);
  amp.gain.setValueAtTime(0.16,now);
  amp.gain.exponentialRampToValueAtTime(0.0001,now+0.08);
  source.connect(filter);
  filter.connect(amp);
  amp.connect(audioCtx.destination);
  source.start(now);
  source.stop(now+0.09);
}

// Play KHENCH pluck.
function soundKhench() {
  playTone("khench","triangle",220,0.10,0.18);
}

// Play kat-gai snap.
function soundKatGai() {
  console.log("SFX: kat gai");
  if (!audioCtx) {
    return;
  }
  const now = audioCtx.currentTime;
  [400,600].forEach((hz,index) => {
    const oscillator = audioCtx.createOscillator();
    const amp = audioCtx.createGain();
    const start = now+index*0.045;
    oscillator.type = "square";
    oscillator.frequency.value = hz;
    amp.gain.setValueAtTime(0.16,start);
    amp.gain.exponentialRampToValueAtTime(0.0001,start+0.035);
    oscillator.connect(amp);
    amp.connect(audioCtx.destination);
    oscillator.start(start);
    oscillator.stop(start+0.04);
  });
}

// Play manja-gaya twang.
function soundManjaGaya() {
  console.log("SFX: manja gaya");
  if (!audioCtx) {
    return;
  }
  const now = audioCtx.currentTime;
  const oscillator = audioCtx.createOscillator();
  const vibrato = audioCtx.createOscillator();
  const vibratoGain = audioCtx.createGain();
  const amp = audioCtx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = 180;
  vibrato.frequency.value = 7;
  vibratoGain.gain.value = 7;
  vibrato.connect(vibratoGain);
  vibratoGain.connect(oscillator.frequency);
  amp.gain.setValueAtTime(0.18,now);
  amp.gain.exponentialRampToValueAtTime(0.0001,now+0.30);
  oscillator.connect(amp);
  amp.connect(audioCtx.destination);
  oscillator.start(now);
  vibrato.start(now);
  oscillator.stop(now+0.31);
  vibrato.stop(now+0.31);
}

// Play bird chirp.
function soundBird() {
  if (!audioCtx) {
    return;
  }
  const now = audioCtx.currentTime;
  const oscillator = audioCtx.createOscillator();
  const amp = audioCtx.createGain();
  oscillator.frequency.setValueAtTime(1900,now);
  oscillator.frequency.exponentialRampToValueAtTime(3100,now+0.10);
  oscillator.frequency.exponentialRampToValueAtTime(2200,now+0.20);
  amp.gain.setValueAtTime(0.05,now);
  amp.gain.exponentialRampToValueAtTime(0.0001,now+0.22);
  oscillator.connect(amp);
  amp.connect(audioCtx.destination);
  oscillator.start(now);
  oscillator.stop(now+0.23);
}

// Play tension warning pulse.
function soundWarningPulse() {
  playTone("tension warning","sine",80,0.16,0.04);
}

// Play tension danger pulse.
function soundDangerPulse() {
  playTone("tension danger","square",120,0.12,0.06);
}

// Play ascending level-clear chime.
function soundLevelClear() {
  console.log("SFX: level clear");
  if (!audioCtx) {
    return;
  }
  const now = audioCtx.currentTime;
  [[523.25,0],[659.25,0.2]].forEach(([hz,offset]) => {
    const oscillator = audioCtx.createOscillator();
    const amp = audioCtx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = hz;
    amp.gain.setValueAtTime(0.12,now+offset);
    amp.gain.exponentialRampToValueAtTime(0.0001,now+offset+0.2);
    oscillator.connect(amp);
    amp.connect(audioCtx.destination);
    oscillator.start(now+offset);
    oscillator.stop(now+offset+0.2);
  });
}

// Play descending fail tones.
function soundLevelFail() {
  console.log("SFX: level fail");
  if (!audioCtx) {
    return;
  }
  const now = audioCtx.currentTime;
  [[392,0],[261.63,0.2]].forEach(([hz,offset]) => {
    const oscillator = audioCtx.createOscillator();
    const amp = audioCtx.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.value = hz;
    amp.gain.setValueAtTime(0.10,now+offset);
    amp.gain.exponentialRampToValueAtTime(0.0001,now+offset+0.2);
    oscillator.connect(amp);
    amp.connect(audioCtx.destination);
    oscillator.start(now+offset);
    oscillator.stop(now+offset+0.2);
  });
}

// Queue a canvas prompt.
function pushPrompt(text,color,duration) {
  promptQueue.push({text:text,color:color,timeLeft:duration,duration:duration});
}

// Update prompt lifetimes.
function updatePrompts(dt) {
  for (let i=promptQueue.length-1;i>=0;i-=1) {
    promptQueue[i].timeLeft -= dt;
    if (promptQueue[i].timeLeft <= 0) {
      promptQueue.splice(i,1);
    }
  }
}

// Apply DHEEL climb and risk.
function doDheel() {
  if (mode !== "playing" || paused) {
    return;
  }
  player.vy -= 190;
  tension = Math.min(1,tension+0.035);
  soundDheel();
  pushPrompt("DHEEL","#75bfff",0.7);
}

// Apply KHENCH dive and tension relief.
function doKhench() {
  if (mode !== "playing" || paused) {
    return;
  }
  player.vy += 175;
  tension = Math.max(0,tension-0.08);
  soundKhench();
  pushPrompt("KHENCH","#ff8585",0.7);
}

// Toggle pause and ambience.
function togglePause() {
  if (mode !== "playing") {
    return;
  }
  paused = !paused;
  if (paused) {
    stopAmbient();
  } else {
    startAmbient();
  }
}

// Convert pointer coordinates to canvas buffer.
function pointerPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {x:(event.clientX-rect.left)*(canvas.width/rect.width),y:(event.clientY-rect.top)*(canvas.height/rect.height)};
}

// Test a rectangular hit zone.
function pointInZone(point,zone) {
  return point.x>=zone.x && point.x<=zone.x+zone.w && point.y>=zone.y && point.y<=zone.y+zone.h;
}

// Resolve pointer hit.
function hitName(point) {
  if (mode==="home" && pointInZone(point,zones.play)) {
    return "play";
  }
  if (mode==="playing" && pointInZone(point,zones.pause)) {
    return "pause";
  }
  if (mode==="playing" && !paused && pointInZone(point,zones.dheel)) {
    return "dheel";
  }
  if (mode==="playing" && !paused && pointInZone(point,zones.khench)) {
    return "khench";
  }
  return "none";
}

// Handle unified pointer input and audio unlock.
function handlePointerDown(event) {
  event.preventDefault();
  unlockAudio();
  const point = pointerPoint(event);
  const hit = hitName(point);
  console.log("pointerdown at "+Math.round(point.x)+", "+Math.round(point.y)+", hit: "+hit);
  if (hit==="play") {
    startGame();
  } else if (hit==="pause") {
    togglePause();
  } else if (hit==="dheel") {
    doDheel();
  } else if (hit==="khench") {
    doKhench();
  }
}

// Update strong horizontal player flight.
function updatePlayer(dt) {
  const minX = W()*0.15;
  const maxX = W()*0.85;
  if (player.x<=minX) {
    player.direction = 1;
  }
  if (player.x>=maxX) {
    player.direction = -1;
  }
  const speed = 95+35*(0.5+0.5*Math.sin(flightTime*0.55));
  const target = player.direction*speed;
  player.vx += (target-player.vx)*(1-Math.exp(-dt*3));
  if (Math.abs(player.vx)<60) {
    player.vx = 60*(player.vx<0?-1:1);
  }
  player.vy *= Math.pow(0.34,dt);
  player.x += player.vx*dt;
  player.y += player.vy*dt;
  player.x = Math.max(W()*0.14,Math.min(W()*0.86,player.x));
  player.y = Math.max(H()*0.12,Math.min(H()*0.68,player.y));
  player.rotation = Math.atan2(player.vy,player.vx);
}

// Start an AI attack.
function beginAIDive() {
  ai.state = "dive";
  ai.diveTime = 0;
  ai.trail.length = 0;
}

// Update AI neutral/dive/return state machine.
function updateAI(dt) {
  ai.diveTime += dt;
  if (ai.state==="neutral" && flightTime>=ai.nextDiveAt) {
    beginAIDive();
  }
  let targetX = W()*0.72;
  let targetY = H()*0.30;
  let speed = 80;
  if (ai.state==="dive") {
    targetX = player.x;
    targetY = player.y;
    speed = 190;
    ai.trail.push({x:ai.x,y:ai.y,life:0.28});
    if (ai.trail.length>8) {
      ai.trail.shift();
    }
    if (Math.hypot(ai.x-player.x,ai.y-player.y)<40) {
      tension = Math.min(1,tension+0.3);
      ai.tension = Math.min(1,ai.tension+0.2);
      ai.state = "return";
    } else if (ai.diveTime>2.4) {
      ai.state = "return";
    }
  } else if (ai.state==="return" && Math.hypot(ai.x-targetX,ai.y-targetY)<30) {
    ai.state = "neutral";
    ai.nextDiveAt = flightTime+8+Math.random()*6;
  }
  const dx = targetX-ai.x;
  const dy = targetY-ai.y;
  const length = Math.max(1,Math.hypot(dx,dy));
  ai.vx = dx/length*speed;
  ai.vy = dy/length*speed;
  ai.x += ai.vx*dt;
  ai.y += ai.vy*dt;
  ai.rotation = Math.atan2(ai.vy,ai.vx);
  for (let i=ai.trail.length-1;i>=0;i-=1) {
    ai.trail[i].life -= dt;
    if (ai.trail[i].life<=0) {
      ai.trail.splice(i,1);
    }
  }
}

// Update tension from altitude and passive pressure.
function updateTension(dt) {
  const ratio = player.y/H();
  tension += 0.02*dt;
  if (ratio<0.25) {
    tension += 0.11*dt;
  } else if (ratio>0.60) {
    tension += 0.10*dt;
  } else if (ratio>=0.25 && ratio<=0.55) {
    tension -= 0.07*dt;
  }
  tension = Math.max(0,Math.min(1,tension));
  const nextZone = tension>=0.85 ? "danger" : tension>=0.60 ? "warning" : "safe";
  if (nextZone!==tensionZone) {
    if (nextZone==="warning") {
      pushPrompt("SAVADHAN","#FFC107",1.0);
    }
    if (nextZone==="danger") {
      pushPrompt("KHATRA","#F44336",1.2);
    }
    tensionZone = nextZone;
  }
  if (tension>=1) {
    cutPlayerKite();
  }
}

// Reset after a cut while preserving level timer.
function cutPlayerKite() {
  soundKatGai();
  soundLevelFail();
  pushPrompt("KAT GAI!","#ff3030",1.5);
  tension = 0.3;
  tensionZone = "safe";
  player.x = W()*0.50;
  player.y = H()*0.38;
  player.vx = 105;
  player.vy = 0;
}

// Complete and advance the level.
function clearLevel() {
  soundLevelClear();
  pushPrompt("LEVEL CLEAR","#4CAF50",2.0);
  currentLevel += 1;
  levelTimeLeft = levelDuration(currentLevel);
  tension = 0.3;
  tensionZone = "safe";
  resetKites();
}

// Update RAF-owned audio timers.
function updateAudioTimers() {
  if (flightTime>=nextBirdAt) {
    soundBird();
    nextBirdAt = flightTime+3+Math.random()*6;
  }
  if (tensionZone==="warning" && flightTime>=warningPulseAt) {
    soundWarningPulse();
    warningPulseAt = flightTime+0.8;
  }
  if (tensionZone==="danger" && flightTime>=dangerPulseAt) {
    soundDangerPulse();
    dangerPulseAt = flightTime+0.4;
  }
}

// Advance gameplay.
function update(dt) {
  updatePrompts(dt);
  if (mode!=="playing" || paused) {
    return;
  }
  elapsed += dt;
  flightTime += dt;
  levelTimeLeft -= dt;
  updatePlayer(dt);
  updateAI(dt);
  updateTension(dt);
  updateAudioTimers();
  if (levelTimeLeft<=0) {
    clearLevel();
  }
}

// Draw warm scene fallback.
function drawFallback() {
  ctx.fillStyle = "#c9784a";
  ctx.fillRect(0,0,W(),H());
  ctx.fillStyle = "#fff2d2";
  ctx.font = "700 16px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(assetFailed?"Scene unavailable":"Loading scene…",W()/2,H()/2);
}

// Draw scene preserving aspect ratio.
function drawScene() {
  if (!assetsReady) {
    drawFallback();
    return;
  }
  const scale = Math.min(W()/sceneImage.naturalWidth,H()/sceneImage.naturalHeight);
  const dw = sceneImage.naturalWidth*scale;
  const dh = sceneImage.naturalHeight*scale;
  ctx.fillStyle = "#6f3f39";
  ctx.fillRect(0,0,W(),H());
  ctx.drawImage(sceneImage,(W()-dw)/2,(H()-dh)/2,dw,dh);
}

// Draw canvas home.
function drawHome() {
  ctx.fillStyle = "rgba(23,32,68,0.72)";
  ctx.fillRect(0,0,W(),H());
  ctx.fillStyle = "#fff2d2";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "900 "+Math.max(34,Math.min(64,W()*0.12))+"px system-ui";
  ctx.fillText("PATANG",W()/2,H()*0.38);
  ctx.font = "600 16px system-ui";
  ctx.fillText("Rooftop Kite Duel",W()/2,H()*0.46);
  ctx.fillStyle = assetsReady?"#d89424":"#7d725f";
  ctx.beginPath();
  ctx.roundRect(zones.play.x,zones.play.y,zones.play.w,zones.play.h,18);
  ctx.fill();
  ctx.fillStyle = "#172044";
  ctx.font = "900 20px system-ui";
  ctx.fillText(assetsReady?"PLAY":"LOADING…",zones.play.x+zones.play.w/2,zones.play.y+zones.play.h/2);
}

// Draw player string from painted hand.
function drawString() {
  ctx.save();
  ctx.strokeStyle = "rgba(255, 240, 210, 0.55)";
  ctx.lineWidth = STRING_WIDTH;
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.moveTo(W()*0.435,H()*0.735);
  ctx.lineTo(player.x,player.y);
  ctx.stroke();
  ctx.restore();
}

// Draw AI motion trail only during attack.
function drawAITrail() {
  if (ai.state!=="dive") {
    return;
  }
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.28)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ai.trail.forEach((point,index) => {
    if (index===0) {
      ctx.moveTo(point.x,point.y);
    } else {
      ctx.lineTo(point.x,point.y);
    }
  });
  ctx.stroke();
  ctx.restore();
}

// Draw one rotated kite.
function drawKite(kite,size,playerOwned) {
  ctx.save();
  ctx.translate(kite.x,kite.y);
  ctx.rotate(kite.rotation);
  if (playerOwned) {
    ctx.shadowColor = "#ff2b9d";
    ctx.shadowBlur = 12;
  } else if (ai.state==="dive") {
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 8;
  }
  ctx.beginPath();
  ctx.moveTo(0,-size);
  ctx.lineTo(size*0.72,0);
  ctx.lineTo(0,size);
  ctx.lineTo(-size*0.72,0);
  ctx.closePath();
  ctx.fillStyle = playerOwned?"#ff2b9d":"#6b36a8";
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = playerOwned?"#fff0fa":"#55c978";
  ctx.lineWidth = playerOwned?3:2;
  ctx.stroke();
  ctx.restore();
}

// Draw duel in correct layering order.
function drawDuel() {
  drawString();
  drawAITrail();
  const size = Math.max(25,Math.min(48,W()*0.065));
  drawKite(player,size,true);
  drawKite(ai,size*0.9,false);
}

// Draw HUD pill.
function drawPill(x,y,width,height,text) {
  ctx.fillStyle = "rgba(23,32,68,0.87)";
  ctx.beginPath();
  ctx.roundRect(x,y,width,height,height/2);
  ctx.fill();
  ctx.fillStyle = "#fff2d2";
  ctx.font = "700 13px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text,x+width/2,y+height/2);
}

// Draw action button.
function drawActionButton(zone,fill,arrow,label) {
  const cx = zone.x+zone.w/2;
  const cy = zone.y+zone.h/2;
  ctx.save();
  ctx.translate(cx,cy);
  ctx.rotate(Math.PI/4);
  ctx.fillStyle = fill;
  ctx.fillRect(-29,-29,58,58);
  ctx.rotate(-Math.PI/4);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "900 18px system-ui";
  ctx.fillText(arrow,0,-8);
  ctx.font = "800 9px system-ui";
  ctx.fillText(label,0,11);
  ctx.restore();
}

// Draw danger bar.
function drawDangerBar() {
  const y = H()*0.09;
  const width = W();
  ctx.fillStyle = "#4CAF50";
  ctx.fillRect(0,y,width*0.60,8);
  ctx.fillStyle = "#FFC107";
  ctx.fillRect(width*0.60,y,width*0.25,8);
  ctx.fillStyle = "#F44336";
  ctx.fillRect(width*0.85,y,width*0.15,8);
  const markerX = tension*width;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(markerX-1,y-2,2,12);
}

// Draw gameplay HUD.
function drawHUD() {
  drawPill(12,16,82,36,"L"+currentLevel);
  drawPill(W()/2-52,16,104,36,String(Math.max(0,Math.ceil(levelTimeLeft)))+"s");
  ctx.fillStyle = "rgba(23,32,68,0.87)";
  ctx.beginPath();
  ctx.roundRect(zones.pause.x,zones.pause.y,zones.pause.w,zones.pause.h,16);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "800 16px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(paused?"▶":"Ⅱ",zones.pause.x+zones.pause.w/2,zones.pause.y+zones.pause.h/2);
  drawDangerBar();
  drawActionButton(zones.dheel,"#2879d8","↑","DHEEL");
  drawActionButton(zones.khench,"#d94444","↓","KHENCH");
}

// Draw queued prompts with fade.
function drawPrompts() {
  promptQueue.forEach((prompt,index) => {
    const alpha = Math.max(0,Math.min(1,prompt.timeLeft/Math.min(0.35,prompt.duration)));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = prompt.color;
    ctx.font = "900 32px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(prompt.text,W()/2,H()*0.35+index*36);
    ctx.restore();
  });
}

// Render frame with clearRect first.
function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  drawScene();
  if (mode==="home") {
    drawHome();
    return;
  }
  if (!assetsReady) {
    return;
  }
  drawDuel();
  drawHUD();
  drawPrompts();
}

// RAF game loop.
function gameLoop(now) {
  pollCanvasSize();
  const dt = Math.min(0.033,(now-lastTime)/1000||0);
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(gameLoop);
}

// Bind unified pointer input.
function bindEvents() {
  canvas.addEventListener("pointerdown",handlePointerDown,{passive:false});
  document.addEventListener("visibilitychange",() => {
    if (document.hidden && mode==="playing") {
      paused = true;
      stopAmbient();
    }
  });
}

// Initialize game.
function init() {
  disableDomPanels();
  resizeCanvas();
  loadScene();
  bindEvents();
  requestAnimationFrame(gameLoop);
}

init();
