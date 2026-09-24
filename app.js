// PATANG_VERSION: 1.6.1
// LAST_MAJOR_CHANGE: Strong kite horizontal drift, Web Audio fix + ambient loop
"use strict";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const sceneImage = new Image();

let assetsReady = false;
let assetFailed = false;
let mode = "home";
let paused = false;
let currentLevel = 1;
let elapsed = 0;
let lastTime = performance.now();
let flightTime = 0;
let audioCtx = null;
let ambientSource = null;
let ambientGain = null;
let nextBirdAt = 0;
let celebration = null;
let resultReason = "";
let score = 0;
let tension = 0.2;
let crossed = false;
let crossTime = 0;

const player = {x:0,y:0,vx:90,vy:0,rotation:0,turnDirection:1,turnBlend:1};
const ai = {x:0,y:0,vx:-75,vy:0,rotation:0};
const zones = {
  play:{x:0,y:0,w:0,h:0},
  dheel:{x:0,y:0,w:0,h:0},
  khench:{x:0,y:0,w:0,h:0},
  pause:{x:0,y:0,w:0,h:0}
};

// Return drawing-buffer width.
function W() {
  return canvas.width;
}

// Return drawing-buffer height.
function H() {
  return canvas.height;
}

// Keep legacy HTML panels non-interactive.
function disableDomPanels() {
  ["startScreen","levelScreen","pauseModal","resultModal","hud","statusBar"].forEach(id => {
    const node = document.getElementById(id);
    if (node) {
      node.classList.add("hidden");
      node.style.pointerEvents = "none";
    }
  });
}

// Resize canvas buffer to viewport.
function resizeCanvas() {
  canvas.width = Math.max(1, window.innerWidth);
  canvas.height = Math.max(1, window.innerHeight);
  canvas.style.width = window.innerWidth + "px";
  canvas.style.height = window.innerHeight + "px";
  recomputeLayout();
}

// Poll viewport size every RAF tick.
function pollCanvasSize() {
  if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
    resizeCanvas();
  }
}

// Precompute all hit rectangles in canvas pixels.
function recomputeLayout() {
  const buttonY = H() - 112;
  zones.play.x = W()*0.5 - 90;
  zones.play.y = H()*0.68 - 30;
  zones.play.w = 180;
  zones.play.h = 60;
  zones.dheel.x = 24;
  zones.dheel.y = buttonY;
  zones.dheel.w = 88;
  zones.dheel.h = 88;
  zones.khench.x = 128;
  zones.khench.y = buttonY;
  zones.khench.w = 88;
  zones.khench.h = 88;
  zones.pause.x = W() - 58;
  zones.pause.y = 12;
  zones.pause.w = 46;
  zones.pause.h = 46;
  if (mode !== "playing") {
    resetKites();
  }
}

// Load scene.png with guarded fallback.
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

// Reset kite physics.
function resetKites() {
  player.x = W()*0.28;
  player.y = H()*0.31;
  player.vx = 90;
  player.vy = 0;
  player.rotation = 0;
  player.turnDirection = 1;
  player.turnBlend = 1;
  ai.x = W()*0.72;
  ai.y = H()*0.28;
  ai.vx = -75;
  ai.vy = 0;
  ai.rotation = 0;
}

// Start a round on the pointer frame.
function startGame() {
  if (!assetsReady) {
    return;
  }
  mode = "playing";
  paused = false;
  elapsed = 0;
  flightTime = 0;
  celebration = null;
  resultReason = "";
  score = 0;
  tension = 0.2;
  crossed = false;
  crossTime = 0;
  resetKites();
  recomputeLayout();
  startAmbient();
}

// Create/resume AudioContext inside the pointer gesture before any SFX.
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

// Create a reusable noise buffer.
function makeNoiseBuffer(seconds, brown) {
  const length = Math.max(1, Math.floor(audioCtx.sampleRate*seconds));
  const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i=0; i<length; i+=1) {
    const white = Math.random()*2-1;
    last = brown ? (last + 0.02*white)/1.02 : white;
    data[i] = brown ? last*3.5 : white;
  }
  return buffer;
}

// Start continuous brown-noise ambience.
function startAmbient() {
  if (!audioCtx || ambientSource) {
    return;
  }
  ambientSource = audioCtx.createBufferSource();
  ambientGain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();
  ambientSource.buffer = makeNoiseBuffer(2, true);
  ambientSource.loop = true;
  filter.type = "lowpass";
  filter.frequency.value = 400;
  ambientGain.gain.value = 0.03;
  ambientSource.connect(filter);
  filter.connect(ambientGain);
  ambientGain.connect(audioCtx.destination);
  ambientSource.start();
  nextBirdAt = flightTime + 3 + Math.random()*6;
  console.log("AMBIENT: started");
}

// Stop ambient layer immediately on pause/home.
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

// Play white-noise bandpass whoosh for DHEEL.
function soundDheel() {
  console.log("SFX: dheel");
  if (!audioCtx) {
    return;
  }
  const now = audioCtx.currentTime;
  const source = audioCtx.createBufferSource();
  const filter = audioCtx.createBiquadFilter();
  const gain = audioCtx.createGain();
  source.buffer = makeNoiseBuffer(0.1, false);
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(650, now);
  filter.frequency.exponentialRampToValueAtTime(1500, now+0.08);
  filter.Q.value = 0.8;
  gain.gain.setValueAtTime(0.16, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now+0.08);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  source.start(now);
  source.stop(now+0.09);
}

// Play 220Hz triangle pluck for KHENCH.
function soundKhench() {
  console.log("SFX: khench");
  if (!audioCtx) {
    return;
  }
  const now = audioCtx.currentTime;
  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  oscillator.type = "triangle";
  oscillator.frequency.value = 220;
  gain.gain.setValueAtTime(0.18, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now+0.10);
  oscillator.connect(gain);
  gain.connect(audioCtx.destination);
  oscillator.start(now);
  oscillator.stop(now+0.11);
}

// Play two sharp square bursts for kat gai.
function soundKatGai() {
  console.log("SFX: kat gai");
  if (!audioCtx) {
    return;
  }
  const now = audioCtx.currentTime;
  [400,600].forEach((frequency,index) => {
    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const start = now + index*0.045;
    oscillator.type = "square";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.16, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start+0.035);
    oscillator.connect(gain);
    gain.connect(audioCtx.destination);
    oscillator.start(start);
    oscillator.stop(start+0.04);
  });
}

// Play 180Hz sine twang with vibrato for manja gaya.
function soundManjaGaya() {
  console.log("SFX: manja gaya");
  if (!audioCtx) {
    return;
  }
  const now = audioCtx.currentTime;
  const oscillator = audioCtx.createOscillator();
  const vibrato = audioCtx.createOscillator();
  const vibratoGain = audioCtx.createGain();
  const gain = audioCtx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = 180;
  vibrato.type = "sine";
  vibrato.frequency.value = 7;
  vibratoGain.gain.value = 7;
  vibrato.connect(vibratoGain);
  vibratoGain.connect(oscillator.frequency);
  gain.gain.setValueAtTime(0.18, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now+0.30);
  oscillator.connect(gain);
  gain.connect(audioCtx.destination);
  oscillator.start(now);
  vibrato.start(now);
  oscillator.stop(now+0.31);
  vibrato.stop(now+0.31);
}

// Play one RAF-scheduled bird sweep.
function soundBird() {
  if (!audioCtx) {
    return;
  }
  const now = audioCtx.currentTime;
  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(1900, now);
  oscillator.frequency.exponentialRampToValueAtTime(3100, now+0.10);
  oscillator.frequency.exponentialRampToValueAtTime(2200, now+0.20);
  gain.gain.setValueAtTime(0.05, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now+0.22);
  oscillator.connect(gain);
  gain.connect(audioCtx.destination);
  oscillator.start(now);
  oscillator.stop(now+0.23);
}

// Schedule bird chirps only from RAF game time.
function updateAmbient() {
  if (!ambientSource || paused || mode !== "playing") {
    return;
  }
  if (flightTime >= nextBirdAt) {
    soundBird();
    nextBirdAt = flightTime + 3 + Math.random()*6;
  }
}

// Apply DHEEL impulse.
function doDheel() {
  if (mode !== "playing" || paused || celebration) {
    return;
  }
  player.vy -= 185;
  tension = Math.max(0.05, tension-0.13);
  soundDheel();
  if (crossed && elapsed-crossTime < 0.8 && tension > 0.25) {
    triggerWin();
  }
}

// Apply KHENCH impulse.
function doKhench() {
  if (mode !== "playing" || paused || celebration) {
    return;
  }
  player.vy += 185;
  tension = Math.min(1.15, tension+0.17);
  soundKhench();
  if (tension > 1.05) {
    triggerLoss("snap");
  }
}

// Toggle pause and stop/restart ambient.
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

// Convert pointer event to drawing-buffer coordinates.
function pointerPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x:(event.clientX-rect.left)*(canvas.width/rect.width),
    y:(event.clientY-rect.top)*(canvas.height/rect.height)
  };
}

// Test precomputed rectangle.
function pointInZone(point, zone) {
  return point.x >= zone.x && point.x <= zone.x+zone.w &&
    point.y >= zone.y && point.y <= zone.y+zone.h;
}

// Resolve pointer target.
function hitName(point) {
  if (mode === "home" && pointInZone(point,zones.play)) {
    return "play";
  }
  if (mode === "playing" && pointInZone(point,zones.pause)) {
    return "pause";
  }
  if (mode === "playing" && !paused && pointInZone(point,zones.dheel)) {
    return "dheel";
  }
  if (mode === "playing" && !paused && pointInZone(point,zones.khench)) {
    return "khench";
  }
  return "none";
}

// Handle every touch/mouse/pen action and unlock audio first.
function handlePointerDown(event) {
  event.preventDefault();
  if (!audioCtx) {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (AudioCtor) {
      audioCtx = new AudioCtor();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  const point = pointerPoint(event);
  const hit = hitName(point);
  console.log("pointerdown at "+Math.round(point.x)+", "+Math.round(point.y)+", hit: "+hit);
  if (hit === "play") {
    startGame();
  } else if (hit === "pause") {
    togglePause();
  } else if (hit === "dheel") {
    doDheel();
  } else if (hit === "khench") {
    doKhench();
  }
}

// Smoothly reverse horizontal travel near 15/85 percent boundaries.
function updateHorizontalVelocity(dt) {
  const minX = W()*0.15;
  const maxX = W()*0.85;
  if (player.x <= minX) {
    player.turnDirection = 1;
  } else if (player.x >= maxX) {
    player.turnDirection = -1;
  }
  const sineBoost = 0.5 + 0.5*Math.sin(flightTime*0.55);
  const targetSpeed = player.turnDirection*(92 + sineBoost*58);
  const response = 1-Math.exp(-dt*2.6);
  player.vx += (targetSpeed-player.vx)*response;
  if (Math.abs(player.vx) < 60) {
    player.vx = 60*(player.vx < 0 ? -1 : 1);
  }
}

// Keep kite inside visible sky vertically.
function constrainVertical(kite) {
  const minY = H()*0.10;
  const maxY = H()*0.55;
  if (kite.y < minY) {
    kite.y = minY;
    kite.vy = Math.abs(kite.vy)*0.65;
  }
  if (kite.y > maxY) {
    kite.y = maxY;
    kite.vy = -Math.abs(kite.vy)*0.65;
  }
}

// Update the player's actual drawn x/y from the same vx/vy physics.
function updatePlayer(dt) {
  updateHorizontalVelocity(dt);
  player.vy *= Math.pow(0.32,dt);
  player.x += player.vx*dt;
  player.y += player.vy*dt;
  player.x = Math.max(W()*0.14,Math.min(W()*0.86,player.x));
  constrainVertical(player);
  player.rotation = Math.atan2(player.vy,player.vx);
}

// Update rival kite.
function updateAI(dt) {
  ai.vx = -75 + Math.sin(flightTime*0.6)*15;
  ai.vy = Math.cos(flightTime*0.83)*28;
  ai.x += ai.vx*dt;
  ai.y += ai.vy*dt;
  if (ai.x < W()*0.48) {
    ai.x = W()*0.82;
  }
  constrainVertical(ai);
  ai.rotation = Math.atan2(ai.vy,ai.vx);
}

// Detect virtual string crossing.
function updateCrossing() {
  const a = {x:W()*0.42,y:H()*0.58};
  const c = {x:W()*0.80,y:H()*0.60};
  const now = segmentsCross(a,player,c,ai);
  if (now && !crossed) {
    crossTime = elapsed;
  }
  crossed = now;
}

// Test two segments.
function segmentsCross(a,b,c,d) {
  const den = (a.x-b.x)*(c.y-d.y)-(a.y-b.y)*(c.x-d.x);
  if (Math.abs(den)<0.001) {
    return false;
  }
  const t = ((a.x-c.x)*(c.y-d.y)-(a.y-c.y)*(c.x-d.x))/den;
  const u = -((a.x-b.x)*(a.y-c.y)-(a.y-b.y)*(a.x-c.x))/den;
  return t>0 && t<1 && u>0 && u<1;
}

// Trigger successful cut.
function triggerWin() {
  if (celebration) {
    return;
  }
  score = Math.round(1000+currentLevel*90+(45-elapsed)*40);
  soundKatGai();
  celebration = {time:0,duration:0.8,loss:false};
}

// Trigger loss.
function triggerLoss(reason) {
  if (celebration) {
    return;
  }
  resultReason = reason;
  if (reason === "snap") {
    soundManjaGaya();
  } else {
    soundKatGai();
  }
  celebration = {time:0,duration:0.7,loss:true};
}

// Advance gameplay and RAF-owned ambient schedule.
function update(dt) {
  if (mode !== "playing" || paused) {
    return;
  }
  if (celebration) {
    celebration.time += dt;
    if (celebration.time >= celebration.duration) {
      stopAmbient();
      mode = "home";
      celebration = null;
      recomputeLayout();
    }
    return;
  }
  elapsed += dt;
  flightTime += dt;
  if (elapsed >= 45) {
    triggerLoss("timer");
    return;
  }
  updatePlayer(dt);
  updateAI(dt);
  updateCrossing();
  updateAmbient();
}

// Draw warm load/error fallback.
function drawFallback() {
  ctx.fillStyle = "#c9784a";
  ctx.fillRect(0,0,W(),H());
  ctx.fillStyle = "#fff2d2";
  ctx.font = "700 16px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(assetFailed ? "Scene unavailable" : "Loading scene…",W()/2,H()/2);
}

// Draw scene.png with preserved aspect ratio.
function drawScene() {
  if (!assetsReady) {
    drawFallback();
    return;
  }
  const scale = Math.min(W()/sceneImage.naturalWidth,H()/sceneImage.naturalHeight);
  const drawW = sceneImage.naturalWidth*scale;
  const drawH = sceneImage.naturalHeight*scale;
  ctx.fillStyle = "#6f3f39";
  ctx.fillRect(0,0,W(),H());
  ctx.drawImage(sceneImage,(W()-drawW)/2,(H()-drawH)/2,drawW,drawH);
}

// Draw canvas-only home.
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
  ctx.fillStyle = assetsReady ? "#d89424" : "#7d725f";
  ctx.beginPath();
  ctx.roundRect(zones.play.x,zones.play.y,zones.play.w,zones.play.h,18);
  ctx.fill();
  ctx.fillStyle = "#172044";
  ctx.font = "900 20px system-ui";
  ctx.fillText(assetsReady ? "PLAY" : "LOADING…",zones.play.x+zones.play.w/2,zones.play.y+zones.play.h/2);
}

// Draw a rotated code kite.
function drawKite(kite,size,playerOwned) {
  ctx.save();
  ctx.translate(kite.x,kite.y);
  ctx.rotate(kite.rotation);
  if (playerOwned) {
    ctx.shadowColor = "#ff2b9d";
    ctx.shadowBlur = 12;
  }
  ctx.beginPath();
  ctx.moveTo(0,-size);
  ctx.lineTo(size*0.72,0);
  ctx.lineTo(0,size);
  ctx.lineTo(-size*0.72,0);
  ctx.closePath();
  ctx.fillStyle = playerOwned ? "#ff2b9d" : "#6b36a8";
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = playerOwned ? "#fff0fa" : "#55c978";
  ctx.lineWidth = playerOwned ? 3 : 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0,-size);
  ctx.lineTo(0,size);
  ctx.moveTo(-size*0.72,0);
  ctx.lineTo(size*0.72,0);
  ctx.stroke();
  ctx.restore();
}

// Draw hair-thin player string before kites.
function drawString() {
  ctx.save();
  ctx.strokeStyle = "rgba(255, 245, 220, 0.75)";
  ctx.lineWidth = 1;
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.moveTo(W()*0.42,H()*0.58);
  ctx.lineTo(player.x,player.y);
  ctx.stroke();
  ctx.restore();
}

// Draw string then kites at their actual physics positions.
function drawDuel() {
  drawString();
  const size = Math.max(25,Math.min(48,W()*0.065));
  drawKite(player,size,true);
  drawKite(ai,size*0.9,false);
}

// Draw rounded HUD pill.
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
  const size = 58;
  ctx.save();
  ctx.translate(cx,cy);
  ctx.rotate(Math.PI/4);
  ctx.fillStyle = fill;
  ctx.fillRect(-size/2,-size/2,size,size);
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

// Draw gameplay HUD.
function drawHUD() {
  drawPill(12,16,82,36,"L"+currentLevel);
  drawPill(W()/2-52,16,104,36,"00:"+String(Math.ceil(Math.max(0,45-elapsed))).padStart(2,"0"));
  ctx.fillStyle = "rgba(23,32,68,0.87)";
  ctx.beginPath();
  ctx.roundRect(zones.pause.x,zones.pause.y,zones.pause.w,zones.pause.h,16);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "800 16px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(paused ? "▶" : "Ⅱ",zones.pause.x+zones.pause.w/2,zones.pause.y+zones.pause.h/2);
  drawActionButton(zones.dheel,"#2879d8","↑","DHEEL");
  drawActionButton(zones.khench,"#d94444","↓","KHENCH");
}

// Render current frame with clearRect first.
function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  drawScene();
  if (mode === "home") {
    drawHome();
    return;
  }
  if (!assetsReady) {
    return;
  }
  drawDuel();
  drawHUD();
}

// RAF loop owns animation and ambient timing.
function gameLoop(now) {
  pollCanvasSize();
  const dt = Math.min(0.033,(now-lastTime)/1000||0);
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(gameLoop);
}

// Bind one unified pointer input.
function bindEvents() {
  canvas.addEventListener("pointerdown",handlePointerDown,{passive:false});
  document.addEventListener("visibilitychange",() => {
    if (document.hidden && mode === "playing") {
      paused = true;
      stopAmbient();
    }
  });
}

// Initialize without creating audio before gesture.
function init() {
  disableDomPanels();
  resizeCanvas();
  loadScene();
  bindEvents();
  requestAnimationFrame(gameLoop);
}

init();
