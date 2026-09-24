// PATANG_VERSION: 1.6.0
// LAST_MAJOR_CHANGE: Input rewrite (pointerdown), kite diagonal physics, thin string, wind pill removed, procedural audio fallback
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
let celebration = null;
let resultReason = "";
let score = 0;
let tension = 0.2;
let crossed = false;
let crossTime = 0;

const player = { x:0, y:0, vx:70, vy:0, rotation:0 };
const ai = { x:0, y:0, vx:-48, vy:0, rotation:0 };
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

// Keep legacy HTML panels non-interactive; canvas owns the experience.
function disableDomPanels() {
  ["startScreen","levelScreen","pauseModal","resultModal","hud","statusBar"].forEach(id => {
    const node = document.getElementById(id);
    if (node) {
      node.classList.add("hidden");
      node.style.pointerEvents = "none";
    }
  });
}

// Resize the canvas buffer to the viewport.
function resizeCanvas() {
  canvas.width = Math.max(1, window.innerWidth);
  canvas.height = Math.max(1, window.innerHeight);
  canvas.style.width = window.innerWidth + "px";
  canvas.style.height = window.innerHeight + "px";
  recomputeLayout();
}

// Poll viewport size on every animation frame.
function pollCanvasSize() {
  if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
    resizeCanvas();
  }
}

// Precompute every interactive rectangle in canvas pixel-buffer coordinates.
function recomputeLayout() {
  const buttonY = H() - 112;
  zones.play.x = W() * 0.5 - 90;
  zones.play.y = H() * 0.68 - 30;
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

// Load the single painted scene with guarded fallback.
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

// Reset both kites to visible sky positions.
function resetKites() {
  player.x = W() * 0.34;
  player.y = H() * 0.31;
  player.vx = 70;
  player.vy = 0;
  player.rotation = 0;
  ai.x = W() * 0.70;
  ai.y = H() * 0.28;
  ai.vx = -48;
  ai.vy = 0;
  ai.rotation = 0;
}

// Start a round immediately on the same pointer frame.
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
}

// Create or resume Web Audio strictly from a user pointer gesture.
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

// Synthesize one short oscillator envelope without timers.
function synthTone(type, startHz, endHz, duration, volume) {
  if (!audioCtx) {
    return;
  }
  const now = audioCtx.currentTime;
  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(startHz, now);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, endHz), now + duration);
  gain.gain.setValueAtTime(Math.max(0.0001, volume), now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gain);
  gain.connect(audioCtx.destination);
  oscillator.start(now);
  oscillator.stop(now + duration);
}

// DHEEL procedural whoosh.
function soundDheel() {
  synthTone("sine", 300, 900, 0.16, 0.10);
}

// KHENCH procedural pluck.
function soundKhench() {
  synthTone("triangle", 720, 230, 0.13, 0.12);
}

// Kat gai procedural snap.
function soundKatGai() {
  synthTone("square", 1200, 420, 0.08, 0.10);
}

// Manja gaya procedural twang.
function soundManjaGaya() {
  synthTone("sawtooth", 480, 90, 0.30, 0.09);
}

// Apply one climb impulse and its exact-frame sound.
function doDheel() {
  if (mode !== "playing" || paused || celebration) {
    return;
  }
  player.vy -= 185;
  tension = Math.max(0.05, tension - 0.13);
  soundDheel();
  if (crossed && elapsed - crossTime < 0.8 && tension > 0.25) {
    triggerWin();
  }
}

// Apply one dive impulse and its exact-frame sound.
function doKhench() {
  if (mode !== "playing" || paused || celebration) {
    return;
  }
  player.vy += 185;
  tension = Math.min(1.15, tension + 0.17);
  soundKhench();
  if (tension > 1.05) {
    triggerLoss("snap");
  }
}

// Toggle pause from the shared pointer handler.
function togglePause() {
  if (mode === "playing") {
    paused = !paused;
  }
}

// Convert a pointer event to drawing-buffer coordinates.
function pointerPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x:(event.clientX - rect.left) * (canvas.width / rect.width),
    y:(event.clientY - rect.top) * (canvas.height / rect.height)
  };
}

// Test one precomputed rectangular zone.
function pointInZone(point, zone) {
  return point.x >= zone.x && point.x <= zone.x + zone.w &&
    point.y >= zone.y && point.y <= zone.y + zone.h;
}

// Resolve the hit name for the current state.
function hitName(point) {
  if (mode === "home" && pointInZone(point, zones.play)) {
    return "play";
  }
  if (mode === "playing" && pointInZone(point, zones.pause)) {
    return "pause";
  }
  if (mode === "playing" && !paused && pointInZone(point, zones.dheel)) {
    return "dheel";
  }
  if (mode === "playing" && !paused && pointInZone(point, zones.khench)) {
    return "khench";
  }
  return "none";
}

// Handle every mouse/touch/pen action through pointerdown only.
function handlePointerDown(event) {
  event.preventDefault();
  unlockAudio();
  const point = pointerPoint(event);
  const hit = hitName(point);
  console.log("pointerdown at " + Math.round(point.x) + ", " + Math.round(point.y) + ", hit: " + hit);
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

// Bounce one kite inside the visible sky play area.
function bounceKite(kite) {
  const minX = W() * 0.10;
  const maxX = W() * 0.90;
  const minY = H() * 0.10;
  const maxY = H() * 0.55;
  if (kite.x < minX) {
    kite.x = minX;
    kite.vx = Math.abs(kite.vx);
  }
  if (kite.x > maxX) {
    kite.x = maxX;
    kite.vx = -Math.abs(kite.vx);
  }
  if (kite.y < minY) {
    kite.y = minY;
    kite.vy = Math.abs(kite.vy) * 0.65;
  }
  if (kite.y > maxY) {
    kite.y = maxY;
    kite.vy = -Math.abs(kite.vy) * 0.65;
  }
}

// Update player with always-nonzero oscillating horizontal drift and tap-driven vertical velocity.
function updatePlayer(dt) {
  const drift = Math.sin(flightTime * 0.72);
  const direction = drift >= 0 ? 1 : -1;
  player.vx = direction * (24 + Math.abs(drift) * 72);
  player.vy *= Math.pow(0.32, dt);
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  bounceKite(player);
  player.rotation = Math.atan2(player.vy, player.vx) * 0.38;
}

// Update the rival kite on a visibly different diagonal path.
function updateAI(dt) {
  const drift = Math.sin(flightTime * 0.61 + 2.1);
  const direction = drift >= 0 ? 1 : -1;
  ai.vx = direction * (20 + Math.abs(drift) * 58);
  ai.vy = Math.cos(flightTime * 0.83) * 28;
  ai.x += ai.vx * dt;
  ai.y += ai.vy * dt;
  bounceKite(ai);
  ai.rotation = Math.atan2(ai.vy, ai.vx) * 0.38;
}

// Detect string crossing using fixed painted-hand anchors.
function updateCrossing() {
  const playerAnchor = {x:W() * 0.42, y:H() * 0.58};
  const rivalAnchor = {x:W() * 0.80, y:H() * 0.60};
  const nowCrossed = segmentsCross(playerAnchor, player, rivalAnchor, ai);
  if (nowCrossed && !crossed) {
    crossTime = elapsed;
  }
  crossed = nowCrossed;
}

// Test two line segments for crossing.
function segmentsCross(a, b, c, d) {
  const denominator = (a.x-b.x)*(c.y-d.y) - (a.y-b.y)*(c.x-d.x);
  if (Math.abs(denominator) < 0.001) {
    return false;
  }
  const t = ((a.x-c.x)*(c.y-d.y) - (a.y-c.y)*(c.x-d.x)) / denominator;
  const u = -((a.x-b.x)*(a.y-c.y) - (a.y-b.y)*(a.x-c.x)) / denominator;
  return t > 0 && t < 1 && u > 0 && u < 1;
}

// Begin a successful cut and fire kat-gai sound on this exact frame.
function triggerWin() {
  if (celebration) {
    return;
  }
  score = Math.round(1000 + currentLevel * 90 + (45 - elapsed) * 40);
  soundKatGai();
  celebration = {time:0, duration:0.8, loss:false};
}

// Begin a loss and fire the corresponding exact-frame sound.
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
  celebration = {time:0, duration:0.7, loss:true};
}

// Advance the state exclusively from the RAF loop.
function update(dt) {
  if (mode !== "playing" || paused) {
    return;
  }
  if (celebration) {
    celebration.time += dt;
    if (celebration.time >= celebration.duration) {
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
}

// Draw warm fallback while the scene PNG is unavailable.
function drawFallback() {
  ctx.fillStyle = "#c9784a";
  ctx.fillRect(0, 0, W(), H());
  ctx.fillStyle = "#fff2d2";
  ctx.font = "700 16px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(assetFailed ? "Scene unavailable" : "Loading scene…", W()/2, H()/2);
}

// Draw scene.png letterboxed with preserved aspect ratio.
function drawScene() {
  if (!assetsReady) {
    drawFallback();
    return;
  }
  const scale = Math.min(W()/sceneImage.naturalWidth, H()/sceneImage.naturalHeight);
  const drawW = sceneImage.naturalWidth * scale;
  const drawH = sceneImage.naturalHeight * scale;
  const drawX = (W() - drawW) / 2;
  const drawY = (H() - drawH) / 2;
  ctx.fillStyle = "#6f3f39";
  ctx.fillRect(0, 0, W(), H());
  ctx.drawImage(sceneImage, drawX, drawY, drawW, drawH);
}

// Draw the canvas-only home title and single-tap Play button.
function drawHome() {
  ctx.fillStyle = "rgba(23,32,68,0.72)";
  ctx.fillRect(0, 0, W(), H());
  ctx.fillStyle = "#fff2d2";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "900 " + Math.max(34, Math.min(64, W()*0.12)) + "px system-ui";
  ctx.fillText("PATANG", W()/2, H()*0.38);
  ctx.font = "600 16px system-ui";
  ctx.fillText("Rooftop Kite Duel", W()/2, H()*0.46);
  ctx.fillStyle = assetsReady ? "#d89424" : "#7d725f";
  ctx.beginPath();
  ctx.roundRect(zones.play.x, zones.play.y, zones.play.w, zones.play.h, 18);
  ctx.fill();
  ctx.fillStyle = "#172044";
  ctx.font = "900 20px system-ui";
  ctx.fillText(assetsReady ? "PLAY" : "LOADING…", zones.play.x + zones.play.w/2, zones.play.y + zones.play.h/2);
}

// Draw one rotated code kite.
function drawKite(kite, size, playerOwned) {
  ctx.save();
  ctx.translate(kite.x, kite.y);
  ctx.rotate(kite.rotation);
  if (playerOwned) {
    ctx.shadowColor = "#ff2b9d";
    ctx.shadowBlur = 12;
  }
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size*0.72, 0);
  ctx.lineTo(0, size);
  ctx.lineTo(-size*0.72, 0);
  ctx.closePath();
  ctx.fillStyle = playerOwned ? "#ff2b9d" : "#6b36a8";
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = playerOwned ? "#fff0fa" : "#55c978";
  ctx.lineWidth = playerOwned ? 3 : 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(0, size);
  ctx.moveTo(-size*0.72, 0);
  ctx.lineTo(size*0.72, 0);
  ctx.stroke();
  ctx.restore();
}

// Draw hair-thin manja before either kite.
function drawString() {
  ctx.save();
  ctx.strokeStyle = "rgba(255, 245, 220, 0.75)";
  ctx.lineWidth = 1;
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.moveTo(W()*0.42, H()*0.58);
  ctx.lineTo(player.x, player.y);
  ctx.stroke();
  ctx.restore();
}

// Draw both code kites over the manja.
function drawDuel() {
  drawString();
  const size = Math.max(25, Math.min(48, W()*0.065));
  drawKite(player, size, true);
  drawKite(ai, size*0.9, false);
}

// Draw one rounded HUD pill.
function drawPill(x, y, width, height, text) {
  ctx.fillStyle = "rgba(23,32,68,0.87)";
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, height/2);
  ctx.fill();
  ctx.fillStyle = "#fff2d2";
  ctx.font = "700 13px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + width/2, y + height/2);
}

// Draw one rectangular diamond-styled action button inside its exact hit rectangle.
function drawActionButton(zone, fill, arrow, label) {
  const cx = zone.x + zone.w/2;
  const cy = zone.y + zone.h/2;
  const size = 58;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.PI/4);
  ctx.fillStyle = fill;
  ctx.fillRect(-size/2, -size/2, size, size);
  ctx.rotate(-Math.PI/4);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "900 18px system-ui";
  ctx.fillText(arrow, 0, -8);
  ctx.font = "800 9px system-ui";
  ctx.fillText(label, 0, 11);
  ctx.restore();
}

// Draw Level left, Time center, Pause right, with no wind display.
function drawHUD() {
  drawPill(12, 16, 82, 36, "L" + currentLevel);
  drawPill(W()/2 - 52, 16, 104, 36, "00:" + String(Math.ceil(Math.max(0,45-elapsed))).padStart(2,"0"));
  ctx.fillStyle = "rgba(23,32,68,0.87)";
  ctx.beginPath();
  ctx.roundRect(zones.pause.x, zones.pause.y, zones.pause.w, zones.pause.h, 16);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 16px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(paused ? "▶" : "Ⅱ", zones.pause.x + zones.pause.w/2, zones.pause.y + zones.pause.h/2);
  drawActionButton(zones.dheel, "#2879d8", "↑", "DHEEL");
  drawActionButton(zones.khench, "#d94444", "↓", "KHENCH");
}

// Render the complete current frame with clearRect first.
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
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

// Main RAF loop owns all animation and visual lifetimes.
function gameLoop(now) {
  pollCanvasSize();
  const dt = Math.min(0.033, (now-lastTime)/1000 || 0);
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(gameLoop);
}

// Bind the one unified interactive event.
function bindEvents() {
  canvas.addEventListener("pointerdown", handlePointerDown, {passive:false});
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && mode === "playing") {
      paused = true;
    }
  });
}

// Initialize without creating AudioContext until a pointer gesture.
function init() {
  disableDomPanels();
  resizeCanvas();
  loadScene();
  bindEvents();
  requestAnimationFrame(gameLoop);
}

init();
