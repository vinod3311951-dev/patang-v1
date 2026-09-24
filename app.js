// PATANG_VERSION: 5.0.0
// LAST_MAJOR_CHANGE: Full clean rebuild — conservative cut detection, dt clamp, explicit resets, no roundRect, HTML audio only
"use strict";

const canvas = document.getElementById("gameCanvas") || document.querySelector("canvas");
const ctx = canvas.getContext("2d");

const scene = new Image();
scene.src = "public/assets/scene.png";
let sceneReady = false;
scene.onload = function () { sceneReady = true; recomputeLayout(); };
scene.onerror = function () { sceneReady = false; };

let W = 0, H = 0, lastCssW = 0, lastCssH = 0;
let coverX = 0, coverY = 0, coverW = 0, coverH = 0;
let boyHandX = 0, boyHandY = 0;
let dheelZone = null, khenchZone = null, pauseZone = null;

let level = 1;
let gameState = "playing";
let paused = false;
let stateTimer = 0;
let cutVictim = "";
let failReason = "";
let levelTimeLeft = 60;
let spawnGrace = 2;
let aiHuntingTimer = 8;
let aiRetreatTimer = 0;
let aiAttackTimer = 0;
let manja = 0.3;
let lastPluckTime = -999;
let elapsed = 0;
let lastTimestamp = 0;
let frameCount = 0;
let currentDt = 0;

const player = { x: 0, y: 0, vx: 0, vy: 0 };
const ai = { x: 0, y: 0, vx: 0, vy: 0 };

let audioWater = null, audioSparrow = null, audioCrow = null, audioPluck = null;
let voiceDheel = null, voiceKhench = null, voiceKatGai = null, voiceManjaGaya = null;
let audioReady = false;
let sparrowCountdown = 5;
let crowCountdown = 15;

const prompts = [];
let confetti = [];
let stars = [];

// Build a rounded rectangle path without ctx.roundRect.
function roundedPath(x, y, w, h, r) {
  const q = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + q, y);
  ctx.lineTo(x + w - q, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + q);
  ctx.lineTo(x + w, y + h - q);
  ctx.quadraticCurveTo(x + w, y + h, x + w - q, y + h);
  ctx.lineTo(x + q, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - q);
  ctx.lineTo(x, y + q);
  ctx.quadraticCurveTo(x, y, x + q, y);
  ctx.closePath();
}

// Return the exact duration for a level.
function getLevelDuration(n) {
  return Math.max(30, 62 - n * 2);
}

// Keep a scalar inside a range.
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// Return a random value in a range.
function randomRange(lo, hi) {
  return lo + Math.random() * (hi - lo);
}

// Recompute canvas size, cover-fit scene geometry, origins, and hit zones.
function recomputeLayout() {
  const rect = canvas.getBoundingClientRect();
  const cssW = Math.max(1, Math.round(rect.width || window.innerWidth));
  const cssH = Math.max(1, Math.round(rect.height || window.innerHeight));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const newW = Math.max(1, Math.round(cssW * dpr));
  const newH = Math.max(1, Math.round(cssH * dpr));
  const oldW = W || newW;
  const oldH = H || newH;

  if (canvas.width !== newW || canvas.height !== newH) {
    canvas.width = newW;
    canvas.height = newH;
  }

  W = canvas.width;
  H = canvas.height;
  lastCssW = cssW;
  lastCssH = cssH;

  const sceneAspect = 1536 / 864;
  const canvasAspect = W / H;
  if (canvasAspect < sceneAspect) {
    coverH = H;
    coverW = H * sceneAspect;
    coverX = (W - coverW) / 2;
    coverY = 0;
  } else {
    coverW = W;
    coverH = W / sceneAspect;
    coverX = 0;
    coverY = (H - coverH) / 2;
  }

  boyHandX = 0.53 * W;
  boyHandY = 0.60 * H;

  const buttonW = Math.min(0.34 * W, 210 * dpr);
  const buttonH = Math.min(0.085 * H, 74 * dpr);
  const buttonY = H - buttonH - 0.035 * H;
  const side = 0.055 * W;
  const pad = 8 * dpr;

  dheelZone = { x: side - pad, y: buttonY - pad, w: buttonW + pad * 2, h: buttonH + pad * 2 };
  khenchZone = { x: W - side - buttonW - pad, y: buttonY - pad, w: buttonW + pad * 2, h: buttonH + pad * 2 };
  pauseZone = { x: W - 0.055 * W - 40 * dpr - pad, y: 0.035 * H - pad, w: 40 * dpr + pad * 2, h: 40 * dpr + pad * 2 };

  if (oldW !== W || oldH !== H) {
    if (player.x || player.y) {
      player.x = clamp(player.x * W / oldW, 0.15 * W, 0.88 * W);
      player.y = clamp(player.y * H / oldH, 0.14 * H, 0.48 * H);
      ai.x = clamp(ai.x * W / oldW, 0.10 * W, 0.88 * W);
      ai.y = clamp(ai.y * H / oldH, 0.10 * H, 0.55 * H);
      enforceSpawnSeparation();
    }
  }
}

// Poll CSS dimensions from RAF and recompute when they change.
function pollResize() {
  const rect = canvas.getBoundingClientRect();
  const cw = Math.max(1, Math.round(rect.width || window.innerWidth));
  const ch = Math.max(1, Math.round(rect.height || window.innerHeight));
  if (cw !== lastCssW || ch !== lastCssH) recomputeLayout();
}

// Ensure spawn/layout separation is at least 35 percent of canvas width.
function enforceSpawnSeparation() {
  const minD = 0.35 * W;
  let dx = ai.x - player.x;
  let dy = ai.y - player.y;
  let d = Math.hypot(dx, dy);
  if (d >= minD) return;
  if (d < 0.001) { dx = -1; dy = 0; d = 1; }
  const need = minD - d;
  ai.x += dx / d * need;
  ai.y += dy / d * need;
  ai.x = clamp(ai.x, 0.10 * W, 0.88 * W);
  ai.y = clamp(ai.y, 0.10 * H, 0.55 * H);
  dx = ai.x - player.x;
  dy = ai.y - player.y;
  d = Math.hypot(dx, dy);
  if (d < minD) {
    ai.x = 0.10 * W;
    ai.y = 0.10 * H;
  }
}

// Explicitly reset every level-scoped gameplay value.
function resetLevel() {
  player.x = 0.62 * W;
  player.y = 0.30 * H;
  player.vx = 0;
  player.vy = 0;
  ai.x = 0.22 * W;
  ai.y = 0.22 * H;
  ai.vx = 0;
  ai.vy = 0;
  manja = 0.3;
  levelTimeLeft = getLevelDuration(level);
  spawnGrace = 2.0;
  aiHuntingTimer = 8.0;
  aiRetreatTimer = 0;
  aiAttackTimer = 0;
  lastPluckTime = 0;
  cutVictim = "";
  failReason = "";
  stateTimer = 0;
  enforceSpawnSeparation();
}

// Add a prompt to the on-canvas queue.
function queuePrompt(text, color, duration) {
  prompts.push({ text: text, color: color, timeLeft: duration, duration: duration });
}

// Update queued prompt timers.
function updatePrompts(dt) {
  for (let i = prompts.length - 1; i >= 0; i--) {
    prompts[i].timeLeft -= dt;
    if (prompts[i].timeLeft <= 0) prompts.splice(i, 1);
  }
}

// Create all HTML Audio objects after the first user gesture.
function initAudio() {
  if (audioReady) return;
  audioReady = true;
  audioWater = new Audio("public/assets/water.mp3");
  audioWater.loop = true;
  audioWater.volume = 0.30;
  audioSparrow = new Audio("public/assets/sparrow.mp3");
  audioSparrow.volume = 0.45;
  audioCrow = new Audio("public/assets/crow.mp3");
  audioCrow.volume = 0.40;
  audioPluck = new Audio("public/assets/pluck.mp3");
  audioPluck.volume = 0.50;
  voiceDheel = makeOptionalVoice("public/assets/dheel.mp3");
  voiceKhench = makeOptionalVoice("public/assets/khench.mp3");
  voiceKatGai = makeOptionalVoice("public/assets/kat-gai.mp3");
  voiceManjaGaya = makeOptionalVoice("public/assets/manja-gaya.mp3");
  audioWater.play().catch(function () {});
}

// Create an optional voice Audio safely.
function makeOptionalVoice(src) {
  try {
    const a = new Audio(src);
    if (a) a.volume = 0.65;
    a.addEventListener("error", function () { a._missing = true; }, { once: true });
    return a;
  } catch (e) {
    return null;
  }
}

// Play an optional voice if it exists and has not failed.
function playVoice(a) {
  try {
    if (!a || a._missing) return;
    a.currentTime = 0;
    a.play().catch(function () {});
  } catch (e) {}
}

// Play the shared pluck with a pitch variation.
function playPluck(rate) {
  if (!audioPluck) return;
  try {
    audioPluck.pause();
    audioPluck.playbackRate = rate;
    audioPluck.currentTime = 0;
    audioPluck.play().catch(function () {});
  } catch (e) {}
}

// Update ambient bird scheduling using only RAF time.
function updateAmbient(dt) {
  if (!audioReady) return;
  sparrowCountdown -= dt;
  crowCountdown -= dt;
  if (sparrowCountdown <= 0) {
    try { audioSparrow.currentTime = 0; audioSparrow.play().catch(function () {}); } catch (e) {}
    sparrowCountdown = randomRange(4, 9);
  }
  if (crowCountdown <= 0) {
    try { audioCrow.currentTime = 0; audioCrow.play().catch(function () {}); } catch (e) {}
    crowCountdown = randomRange(12, 25);
  }
}

// Test whether a point is inside a rectangle.
function hit(z, x, y) {
  return z && x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h;
}

// Apply the DHEEL impulse.
function doDheel() {
  if (gameState !== "playing" || paused) return;
  player.vy = -200;
  manja = clamp(manja + 0.10, 0, 1);
  queuePrompt("DHEEL", "#00BFFF", 0.8);
  playPluck(1.30);
  playVoice(voiceDheel);
}

// Apply the KHENCH impulse.
function doKhench() {
  if (gameState !== "playing" || paused) return;
  player.vy = 200;
  manja = clamp(manja - 0.05, 0, 1);
  queuePrompt("KHENCH", "#FF3B30", 0.8);
  playPluck(0.80);
  playVoice(voiceKhench);
}

// Handle all pointer input through one canvas listener.
function onPointerDown(ev) {
  ev.preventDefault();
  initAudio();
  const rect = canvas.getBoundingClientRect();
  const x = (ev.clientX - rect.left) * canvas.width / rect.width;
  const y = (ev.clientY - rect.top) * canvas.height / rect.height;
  if (hit(pauseZone, x, y)) { paused = !paused; return; }
  if (hit(dheelZone, x, y)) { doDheel(); return; }
  if (hit(khenchZone, x, y)) { doKhench(); }
}

// Return orientation for three points.
function orient(ax, ay, bx, by, cx, cy) {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

// Return true when two closed line segments intersect.
function segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  const o1 = orient(ax, ay, bx, by, cx, cy);
  const o2 = orient(ax, ay, bx, by, dx, dy);
  const o3 = orient(cx, cy, dx, dy, ax, ay);
  const o4 = orient(cx, cy, dx, dy, bx, by);
  const eps = 0.0001;
  if (((o1 > eps && o2 < -eps) || (o1 < -eps && o2 > eps)) &&
      ((o3 > eps && o4 < -eps) || (o3 < -eps && o4 > eps))) return true;
  return false;
}

// Resolve a string crossing conservatively.
function checkStringCrossing() {
  const kiteDistance = Math.hypot(player.x - ai.x, player.y - ai.y);
  if (kiteDistance > 0.35 * canvas.width) return;
  if (!segmentsIntersect(boyHandX, boyHandY, player.x, player.y, ai.x, ai.y, canvas.width, canvas.height)) return;
  const playerStringLength = Math.hypot(player.x - boyHandX, player.y - boyHandY);
  if (playerStringLength < 0.15 * canvas.height) return;
  const aiSharpness = Math.min(0.85, 0.30 + (level - 1) * 0.04);
  if (manja >= aiSharpness + 0.08) {
    cutAI();
    return;
  }
  if (manja <= aiSharpness - 0.08) {
    cutPlayer();
    return;
  }
  if (elapsed - lastPluckTime >= 0.6) {
    playPluck(1.00);
    lastPluckTime = elapsed;
  }
  pushKitesApart();
}

// Separate kites slightly after a neutral string contact.
function pushKitesApart() {
  let dx = player.x - ai.x;
  let dy = player.y - ai.y;
  let d = Math.hypot(dx, dy);
  if (d < 0.001) { dx = 1; dy = 0; d = 1; }
  const push = 0.018 * W;
  player.x = clamp(player.x + dx / d * push, 0.15 * W, 0.88 * W);
  player.y = clamp(player.y + dy / d * push, 0.14 * H, 0.48 * H);
  ai.x = clamp(ai.x - dx / d * push, 0.10 * W, 0.88 * W);
  ai.y = clamp(ai.y - dy / d * push, 0.10 * H, 0.55 * H);
}

// Cut the AI string and enter katching.
function cutAI() {
  queuePrompt("KAT GAI!", "#FF0000", 1.2);
  playPluck(1.60);
  playVoice(voiceKatGai);
  beginKatching("ai");
}

// Cut the player string and enter katching.
function cutPlayer() {
  queuePrompt("KAT GAI!", "#FF0000", 1.2);
  playPluck(1.60);
  playVoice(voiceManjaGaya);
  beginKatching("player");
}

// Begin the 1.5 second katching state.
function beginKatching(victim) {
  gameState = "katching";
  cutVictim = victim;
  stateTimer = 1.5;
}

// Begin a level failure.
function beginLevelFail(reason) {
  if (gameState !== "playing") return;
  gameState = "levelFail";
  failReason = reason || "LEVEL FAIL";
  stateTimer = 2.0;
  queuePrompt(failReason === "TIME OUT" ? "TIME OUT" : "LEVEL FAIL", "#FF1744", 1.2);
  playPluck(0.55);
}

// Create the level-clear particle bumper.
function makeClearParticles() {
  confetti = [];
  stars = [];
  for (let i = 0; i < 24; i++) {
    confetti.push({ x: Math.random() * W, y: -Math.random() * H * 0.25, vy: randomRange(70, 180), spin: randomRange(-5, 5), a: randomRange(0, Math.PI * 2), life: 1 });
  }
  for (let i = 0; i < 8; i++) {
    const a = Math.PI * 2 * i / 8;
    stars.push({ x: W * 0.5, y: H * 0.5, vx: Math.cos(a) * randomRange(70, 150), vy: Math.sin(a) * randomRange(70, 150), life: 1 });
  }
}

// Enter level clear and initialize its bumper.
function beginLevelClear() {
  gameState = "levelClear";
  stateTimer = 2.5;
  queuePrompt("LEVEL CLEAR", "#00FF00", 1.2);
  makeClearParticles();
  playPluck(1.60);
}

// Update player motion, AI behavior, sharpness, timer, and crossing.
function updatePlaying(dt) {
  levelTimeLeft -= dt;
  if (levelTimeLeft <= 0) {
    levelTimeLeft = 0;
    beginLevelFail("TIME OUT");
    return;
  }

  spawnGrace = Math.max(0, spawnGrace - dt);
  aiHuntingTimer = Math.max(0, aiHuntingTimer - dt);

  player.vx = 70 * Math.sin(elapsed * 0.7);
  player.vy *= Math.pow(0.94, dt * 60);
  player.x += player.vx * dt;
  player.y += player.vy * dt;

  const pxMin = 0.15 * W, pxMax = 0.88 * W;
  const pyMin = 0.14 * H, pyMax = 0.48 * H;
  if (player.x < pxMin) { player.x = pxMin; player.vx = Math.abs(player.vx); }
  if (player.x > pxMax) { player.x = pxMax; player.vx = -Math.abs(player.vx); }
  player.y = clamp(player.y, pyMin, pyMax);

  if (player.y < 0.28 * H) manja += 0.35 * dt;
  else if (player.y > 0.42 * H) manja -= 0.25 * dt;
  else manja -= 0.05 * dt;
  manja = clamp(manja, 0, 1);

  updateAI(dt);

  if (spawnGrace <= 0) checkStringCrossing();
}

// Update AI drift, hunt, failed-attempt retreat, and speed cap.
function updateAI(dt) {
  if (aiHuntingTimer > 0) {
    ai.vx = 40 * Math.sin(elapsed * 0.53);
    ai.vy = 20 * Math.sin(elapsed * 0.79 + 1.4);
  } else if (aiRetreatTimer > 0) {
    aiRetreatTimer = Math.max(0, aiRetreatTimer - dt);
    let dx = ai.x - player.x;
    let dy = ai.y - player.y;
    let d = Math.hypot(dx, dy) || 1;
    ai.vx = dx / d * 45;
    ai.vy = dy / d * 45;
    if (aiRetreatTimer <= 0) aiAttackTimer = 0;
  } else {
    aiAttackTimer += dt;
    let dx = player.x - ai.x;
    let dy = player.y - ai.y;
    let d = Math.hypot(dx, dy) || 1;
    ai.vx = dx / d * 55;
    ai.vy = dy / d * 55;
    if (aiAttackTimer >= 4) {
      aiAttackTimer = 0;
      aiRetreatTimer = 3;
      queuePrompt("SAVADHAN", "#FFD700", 0.8);
    } else if (d < 0.22 * W && aiAttackTimer > 0.8 && aiAttackTimer < 0.85) {
      queuePrompt("KHATRA", "#FF4500", 0.8);
    }
  }

  const speed = Math.hypot(ai.vx, ai.vy);
  if (speed > 70) {
    ai.vx = ai.vx / speed * 70;
    ai.vy = ai.vy / speed * 70;
  }

  ai.x += ai.vx * dt;
  ai.y += ai.vy * dt;
  ai.x = clamp(ai.x, 0.10 * W, 0.88 * W);
  ai.y = clamp(ai.y, 0.10 * H, 0.55 * H);
}

// Update the katching transition timer.
function updateKatching(dt) {
  stateTimer -= dt;
  if (stateTimer > 0) return;
  if (cutVictim === "ai") beginLevelClear();
  else {
    gameState = "levelFail";
    stateTimer = 2.0;
    failReason = "LEVEL FAIL";
    queuePrompt("LEVEL FAIL", "#FF1744", 1.2);
    playPluck(0.55);
  }
}

// Update clear bumper and advance through a full reset.
function updateLevelClear(dt) {
  stateTimer -= dt;
  for (let i = 0; i < confetti.length; i++) {
    confetti[i].y += confetti[i].vy * dt;
    confetti[i].a += confetti[i].spin * dt;
    confetti[i].life = clamp(stateTimer / 2.5, 0, 1);
  }
  for (let i = 0; i < stars.length; i++) {
    stars[i].x += stars[i].vx * dt;
    stars[i].y += stars[i].vy * dt;
    stars[i].life = clamp(stateTimer / 2.5, 0, 1);
  }
  if (stateTimer <= 2.0 && stateTimer + dt > 2.0) playPluck(1.90);
  if (stateTimer <= 0) {
    level += 1;
    resetLevel();
    gameState = "playing";
  }
}

// Update fail timer and restart the same level through a full reset.
function updateLevelFail(dt) {
  stateTimer -= dt;
  if (stateTimer <= 0) {
    resetLevel();
    gameState = "playing";
  }
}

// Draw the cover-fit background and fallback.
function drawBackground() {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#C88A4A";
  ctx.fillRect(0, 0, W, H);
  if (sceneReady) ctx.drawImage(scene, coverX, coverY, coverW, coverH);
}

// Draw the warm-white painted-thread cover.
function drawThreadCover() {
  ctx.save();
  ctx.strokeStyle = "rgba(255, 250, 235, 0.95)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(boyHandX, boyHandY);
  ctx.lineTo(0.53 * W, 0.40 * H);
  ctx.stroke();
  ctx.restore();
}

// Draw both kite strings.
function drawStrings() {
  ctx.save();
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ai.x, ai.y);
  ctx.lineTo(W, H);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(boyHandX, boyHandY);
  ctx.lineTo(player.x, player.y);
  ctx.stroke();
  ctx.restore();
}

// Draw a rotated diamond kite.
function drawDiamond(k, size, fill, stroke, lineWidth, glow) {
  ctx.save();
  ctx.translate(k.x, k.y);
  ctx.rotate(Math.atan2(k.vy, k.vx || 0.0001));
  if (glow) {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 20);
    g.addColorStop(0, "rgba(255,20,147,0.45)");
    g.addColorStop(1, "rgba(255,20,147,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.85 + 20, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.5);
  ctx.lineTo(size * 0.42, 0);
  ctx.lineTo(0, size * 0.5);
  ctx.lineTo(-size * 0.42, 0);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  ctx.restore();
}

// Draw AI and player kites in required order.
function drawKites() {
  drawDiamond(ai, 0.11 * W, "#7B2FBE", "#4CAF50", 2, false);
  drawDiamond(player, 0.14 * W, "#FF1493", "#FFFFFF", 3, true);
}

// Draw one dark HUD pill.
function drawPill(x, y, w, h, text) {
  ctx.save();
  roundedPath(x, y, w, h, h * 0.45);
  ctx.fillStyle = "#1a2340";
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold " + Math.max(14, Math.round(h * 0.45)) + "px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + w * 0.5, y + h * 0.52);
  ctx.restore();
}

// Format seconds as MM:SS.
function formatTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return String(m).padStart(2, "0") + ":" + String(r).padStart(2, "0");
}

// Draw top HUD and pause control.
function drawHUD() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const y = 0.035 * H;
  const h = 40 * dpr;
  drawPill(0.055 * W, y, 62 * dpr, h, "L" + level);
  drawPill(W * 0.5 - 48 * dpr, y, 96 * dpr, h, formatTime(levelTimeLeft));
  const px = W - 0.055 * W - 40 * dpr;
  ctx.save();
  roundedPath(px, y, 40 * dpr, 40 * dpr, 9 * dpr);
  ctx.fillStyle = "#1a2340";
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  if (paused) {
    ctx.beginPath();
    ctx.moveTo(px + 14 * dpr, y + 10 * dpr);
    ctx.lineTo(px + 30 * dpr, y + 20 * dpr);
    ctx.lineTo(px + 14 * dpr, y + 30 * dpr);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillRect(px + 12 * dpr, y + 10 * dpr, 5 * dpr, 20 * dpr);
    ctx.fillRect(px + 23 * dpr, y + 10 * dpr, 5 * dpr, 20 * dpr);
  }
  ctx.restore();
}

// Return MANJA fill color from yellow through orange to red.
function manjaColor(v) {
  if (v < 0.5) {
    const t = v * 2;
    return "rgb(255," + Math.round(215 - 80 * t) + ",0)";
  }
  const t = (v - 0.5) * 2;
  return "rgb(255," + Math.round(135 * (1 - t)) + ",0)";
}

// Draw MANJA label and bar.
function drawManja() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const x = 0.055 * W;
  const y = 0.035 * H + 52 * dpr;
  const labelW = 62 * dpr;
  const barW = Math.min(190 * dpr, 0.46 * W);
  const barH = 24 * dpr;
  ctx.save();
  ctx.fillStyle = "#FFFFFF";
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 3;
  ctx.font = "bold " + 13 * dpr + "px Arial Black, Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.strokeText("MANJA", x, y + barH * 0.5);
  ctx.fillText("MANJA", x, y + barH * 0.5);
  roundedPath(x + labelW, y, barW, barH, 8 * dpr);
  ctx.fillStyle = "#1a2340";
  ctx.fill();
  if (manja > 0) {
    roundedPath(x + labelW + 3 * dpr, y + 3 * dpr, Math.max(1, (barW - 6 * dpr) * manja), barH - 6 * dpr, 5 * dpr);
    ctx.fillStyle = manjaColor(manja);
    ctx.fill();
  }
  ctx.restore();
}

// Draw the active prompt queue.
function drawPrompts() {
  if (!prompts.length) return;
  const p = prompts[0];
  const alpha = clamp(p.timeLeft / Math.min(0.35, p.duration), 0, 1);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = "bold 26px Arial Black, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#000000";
  ctx.shadowColor = "#000000";
  ctx.shadowBlur = 8;
  ctx.strokeText(p.text, 0.5 * W, 0.20 * H);
  ctx.fillStyle = p.color;
  ctx.fillText(p.text, 0.5 * W, 0.20 * H);
  ctx.restore();
}

// Draw one rectangular action button.
function drawActionButton(z, fill, arrow, label) {
  const pad = 8 * Math.min(window.devicePixelRatio || 1, 2);
  const x = z.x + pad, y = z.y + pad, w = z.w - pad * 2, h = z.h - pad * 2;
  ctx.save();
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold " + Math.max(18, Math.round(h * 0.31)) + "px Arial Black, Arial, sans-serif";
  ctx.fillText(arrow + "  " + label, x + w * 0.5, y + h * 0.52);
  ctx.restore();
}

// Draw both bottom controls.
function drawButtons() {
  drawActionButton(dheelZone, "#0878D1", "↑", "DHEEL");
  drawActionButton(khenchZone, "#D62828", "↓", "KHENCH");
}

// Draw a five-point star.
function drawStar(x, y, radius, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? radius : radius * 0.45;
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const px = Math.cos(a) * r, py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = "#FFD700";
  ctx.fill();
  ctx.restore();
}

// Draw the full level-clear bumper.
function drawLevelClearBumper() {
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = "#1a2340";
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
  for (let i = 0; i < confetti.length; i++) {
    const p = confetti[i];
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.a);
    ctx.fillStyle = i % 3 === 0 ? "#FFD700" : (i % 3 === 1 ? "#FF1493" : "#00BFFF");
    ctx.fillRect(-5, -10, 10, 20);
    ctx.restore();
  }
  for (let i = 0; i < stars.length; i++) drawStar(stars[i].x, stars[i].y, 12, stars[i].life);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 64px Arial Black, Arial, sans-serif";
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#000000";
  ctx.strokeText("LEVEL CLEAR", W * 0.5, H * 0.44);
  ctx.fillStyle = "#FFD700";
  ctx.fillText("LEVEL CLEAR", W * 0.5, H * 0.44);
  ctx.font = "bold 28px Arial Black, Arial, sans-serif";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText("L" + level + " COMPLETE", W * 0.5, H * 0.53);
  ctx.restore();
}

// Draw fail/katching dark emphasis without DOM.
function drawStateOverlay() {
  if (gameState !== "levelFail" && gameState !== "katching") return;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// Draw the mandatory temporary QA line last.
function drawDebug() {
  const line = "state:" + gameState +
    " frames:" + frameCount +
    " timer:" + levelTimeLeft.toFixed(1) +
    " dt:" + currentDt.toFixed(3) +
    " ma:" + manja.toFixed(2) +
    " px:" + (player.x | 0) +
    " py:" + (player.y | 0) +
    " ax:" + (ai.x | 0) +
    " ay:" + (ai.y | 0);
  ctx.save();
  ctx.font = "12px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const tw = ctx.measureText(line).width + 8;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, tw, 17);
  ctx.fillStyle = "#00FF00";
  ctx.fillText(line, 4, 2);
  ctx.restore();
}

// Render the exact required frame stack.
function render() {
  drawBackground();
  drawThreadCover();
  drawStrings();
  drawKites();
  drawHUD();
  drawManja();
  drawPrompts();
  drawButtons();
  drawStateOverlay();
  if (gameState === "levelClear") drawLevelClearBumper();
  drawDebug();
}

// Main RAF loop with dt clamped to 0.05 seconds.
function gameLoop(timestamp) {
  const rawDt = lastTimestamp ? (timestamp - lastTimestamp) / 1000 : 0;
  const dt = Math.min(0.05, Math.max(0, rawDt));
  currentDt = dt;
  lastTimestamp = timestamp;
  frameCount += 1;
  try {
    pollResize();
    if (!paused) {
      elapsed += dt;
      updateAmbient(dt);
      updatePrompts(dt);
      if (gameState === "playing") updatePlaying(dt);
      else if (gameState === "katching") updateKatching(dt);
      else if (gameState === "levelClear") updateLevelClear(dt);
      else if (gameState === "levelFail") updateLevelFail(dt);
    }
    render();
  } catch (err) {
    console.error("PATANG v5 frame error:", err);
  }
  requestAnimationFrame(gameLoop);
}

canvas.style.touchAction = "none";
canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
recomputeLayout();
resetLevel();
requestAnimationFrame(gameLoop);
