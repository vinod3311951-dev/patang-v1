// PATANG_VERSION: 1.4.0
// LAST_MAJOR_CHANGE: Hybrid PNG backgrounds + code-drawn kite foreground
"use strict";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const hud = document.getElementById("hud");
const statusBar = document.getElementById("statusBar");
const startScreen = document.getElementById("startScreen");
const levelScreen = document.getElementById("levelScreen");
const levelGrid = document.getElementById("levelGrid");
const pauseModal = document.getElementById("pauseModal");
const resultModal = document.getElementById("resultModal");
const resultTitle = document.getElementById("resultTitle");
const resultDetail = document.getElementById("resultDetail");
const resultStars = document.getElementById("resultStars");
const levelBadge = document.getElementById("levelBadge");
const muteButton = document.getElementById("muteButton");

const COLORS = { cream:"#f0e6d2", marigold:"#d89424", terracotta:"#b65a3a", vermillion:"#c94732", navy:"#172044", blue:"#496a8f", mutedGold:"#d7ad55" };
const SAVE_KEY = "patang";
let save = loadSave();
let currentLevel = 1;
let mode = "home";
let paused = false;
let lastTime = performance.now();
let elapsed = 0;
let score = 0;
let tension = 0;
let khenchTime = 0;
let crossed = false;
let crossTime = 0;
let actionPhase = "none";
let resultReason = "";
let celebration = null;
let particles = [];
let pointer = { active:false, x:0, y:0, lastY:0 };
let player = { x:0, y:0, vx:0, vy:0 };
let ai = { x:0, y:0, vx:0, vy:0, state:"watch", decisionAt:0, tension:0 };
let wind = { x:0, y:0, phase:0 };
let audioCtx = null;
let windOsc = null;
let windGain = null;
let sceneTime = 0;
let ambientSchedule = {};
let dustMotes = [];
let nextDustAt = 2.5;
let timeOfDay = "golden";
let birds = [];
let dpr = 1;
let assetsReady = false;
let assetFailures = 0;
let loadedAssets = 0;
let hudHitZones = {};
// Asset path relative to repo root: public/assets/bg-sky.png
const skyImage = new Image();
// Asset path relative to repo root: public/assets/bg-rooftop.png
const rooftopImage = new Image();

// Load persistent settings and progress.
function loadSave() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}");
    return { muted:!!parsed.muted, stars:parsed.stars || {}, highScore:Number(parsed.highScore) || 0 };
  } catch (error) {
    return { muted:false, stars:{}, highScore:0 };
  }
}

// Persist settings and progress.
function saveGame() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}

// Recompute positions that depend on the current canvas dimensions.
function recomputeLayout() {
  if (mode !== "playing") resetPositions();
}

// Resize the canvas buffer to the viewport.
function resizeCanvas() {
  dpr = 1;
  canvas.width = Math.max(1, window.innerWidth);
  canvas.height = Math.max(1, window.innerHeight);
  canvas.style.width = window.innerWidth + "px";
  canvas.style.height = window.innerHeight + "px";
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  recomputeLayout();
}

// Poll viewport size from requestAnimationFrame to prevent stale blank buffers.
function pollCanvasSize() {
  if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) resizeCanvas();
}

// Return canvas width in drawing-buffer pixels.
function W() {
  return canvas.width;
}

// Return canvas height in drawing-buffer pixels.
function H() {
  return canvas.height;
}

// Convert pointer coordinates through the canvas pixel buffer, not CSS size.
function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x:(event.clientX - rect.left) * (canvas.width / rect.width),
    y:(event.clientY - rect.top) * (canvas.height / rect.height)
  };
}

// Mark one required PNG as loaded and enable gameplay only when both succeeded.
function assetLoaded() {
  loadedAssets += 1;
  if (loadedAssets === 2 && assetFailures === 0) assetsReady = true;
}

// Record a PNG load failure while keeping the warm fallback visible.
function assetFailed() {
  assetFailures += 1;
  assetsReady = false;
}

// Load the two repository-local painted scene assets.
function loadAssets() {
  skyImage.onload = assetLoaded;
  skyImage.onerror = assetFailed;
  rooftopImage.onload = assetLoaded;
  rooftopImage.onerror = assetFailed;
  skyImage.src = "public/assets/bg-sky.png";
  rooftopImage.src = "public/assets/bg-rooftop.png";
}

// Build the open 100-level selector.
function buildLevelGrid() {
  levelGrid.innerHTML = "";
  for (let level = 1; level <= 100; level += 1) {
    const button = document.createElement("button");
    const stars = save.stars[String(level)] || 0;
    button.className = "level-tile";
    button.innerHTML = level + "<span>" + "★".repeat(stars) + "☆".repeat(3 - stars) + "</span>";
    button.addEventListener("click", () => startGame(level));
    levelGrid.appendChild(button);
  }
}

// Compute all difficulty values from level number.
function getLevelConfig(level) {
  const t = (level - 1) / 99;
  const base = 900 + (level - 1) * 90;
  return {
    reactionMs: 400 - 200 * t,
    aiSpeed: 72 + 88 * t,
    wind: 8 + 30 * t,
    snapSeconds: 3.1 - 1.15 * t,
    cutWindow: 1.15 - 0.42 * t,
    thresholds:[base, base * 1.35, base * 1.75]
  };
}

// Reset kite positions.
function resetPositions() {
  player.x = W() * 0.31;
  player.y = H() * 0.43;
  player.vx = 0;
  player.vy = 0;
  ai.x = W() * 0.69;
  ai.y = H() * 0.43;
  ai.vx = 0;
  ai.vy = 0;
}

// Initialize one duel.
function startGame(level) {
  if (!assetsReady) return;
  unlockAudio();
  currentLevel = Math.max(1, Math.min(100, level));
  mode = "playing";
  paused = false;
  elapsed = 0;
  score = 0;
  tension = 0;
  khenchTime = 0;
  crossed = false;
  crossTime = 0;
  actionPhase = "none";
  celebration = null;
  particles = [];
  ai.state = "watch";
  ai.decisionAt = 0;
  resetAmbientSchedule();
  resetPositions();
  hideAllPanels();
  hud.classList.add("hidden");
  statusBar.classList.add("hidden");
  levelBadge.textContent = "L" + currentLevel;
  statusBar.textContent = "45s · Cross, KHENCH ↓, then DHEEL ↑";
  speakHindi("Khench", false);
}

// Hide menus and modals for active play.
function hideAllPanels() {
  startScreen.classList.add("hidden");
  levelScreen.classList.add("hidden");
  pauseModal.classList.add("hidden");
  resultModal.classList.add("hidden");
}

// Return to home.
function goHome() {
  mode = "home";
  paused = false;
  hud.classList.add("hidden");
  statusBar.classList.add("hidden");
  pauseModal.classList.add("hidden");
  resultModal.classList.add("hidden");
  levelScreen.classList.add("hidden");
  startScreen.classList.remove("hidden");
}

// Show all levels.
function showLevels() {
  mode = "levels";
  hud.classList.add("hidden");
  statusBar.classList.add("hidden");
  startScreen.classList.add("hidden");
  resultModal.classList.add("hidden");
  buildLevelGrid();
  levelScreen.classList.remove("hidden");
}

// Toggle pause state.
function togglePause(force) {
  if (mode !== "playing") return;
  paused = typeof force === "boolean" ? force : !paused;
  pauseModal.classList.toggle("hidden", !paused);
}

// Toggle all game audio.
function toggleMute() {
  save.muted = !save.muted;
  muteButton.textContent = save.muted ? "×" : "♪";
  saveGame();
  if (save.muted && speechSynthesis) speechSynthesis.cancel();
  updateWindAudio();
}

// Create or resume Web Audio after user gesture.
function unlockAudio() {
  if (save.muted) return;
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    createWindHum();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
}

// Create the continuous very quiet oscillator-only wind bed.
function createWindHum() {
  if (!audioCtx || windOsc) return;
  windOsc = audioCtx.createOscillator();
  windGain = audioCtx.createGain();
  const lfo = audioCtx.createOscillator();
  const lfoGain = audioCtx.createGain();
  windOsc.type = "sine";
  windOsc.frequency.value = 120;
  windGain.gain.value = save.muted ? 0 : 0.018;
  lfo.frequency.value = 0.3;
  lfoGain.gain.value = 0.009;
  lfo.connect(lfoGain);
  lfoGain.connect(windGain.gain);
  windOsc.connect(windGain);
  windGain.connect(audioCtx.destination);
  windOsc.start();
  lfo.start();
}

// Apply mute state to wind audio.
function updateWindAudio() {
  if (!windGain || !audioCtx) return;
  windGain.gain.setTargetAtTime(save.muted ? 0 : 0.018, audioCtx.currentTime, 0.04);
}

// Play one oscillator tone with optional frequency glide.
function tone(type, from, to, duration, gain, delay = 0) {
  if (save.muted || !audioCtx) return;
  const now = audioCtx.currentTime + delay;
  const osc = audioCtx.createOscillator();
  const amp = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), now + duration);
  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.exponentialRampToValueAtTime(gain, now + Math.min(0.04, duration * 0.25));
  amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(amp);
  amp.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.03);
}

// Play one or two oscillator-only bird calls with an occasional answer.
function soundBirds() {
  const answer = Math.sin(sceneTime * 1.73) > 0.25;
  tone("sine", 2200, 2750, 0.09, 0.018);
  if (answer) tone("sine", 2350, 2800, 0.09, 0.016, 0.2);
}

// Play two distant wood chops.
function soundWood() {
  tone("triangle", 180, 155, 0.2, 0.016);
  tone("triangle", 180, 150, 0.2, 0.014, 0.3);
}

// Play a faint cow-like glissando.
function soundCow() {
  tone("sine", 220, 140, 0.6, 0.011);
}

// Play two distant monkey-like chirps.
function soundMonkey() {
  tone("sine", 900, 620, 0.12, 0.011);
  tone("sine", 900, 590, 0.13, 0.01, 0.17);
}

// Play low distant traffic using an oscillator envelope.
function soundTraffic() {
  if (save.muted || !audioCtx) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const amp = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.value = 60;
  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.linearRampToValueAtTime(0.009, now + 2);
  amp.gain.setValueAtTime(0.009, now + 4);
  amp.gain.linearRampToValueAtTime(0.0001, now + 6);
  osc.connect(amp);
  amp.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 6.05);
}

// Play a rare low-volume water splash.
function soundWater() {
  tone("triangle", 470, 540, 0.2, 0.009);
  tone("triangle", 530, 460, 0.16, 0.006, 0.03);
}

// Play a broom-like triangle sweep.
function soundBroom() {
  tone("triangle", 500, 250, 0.3, 0.009);
}

// Play a very distant temple bell with detune shimmer.
function soundBell() {
  tone("sine", 550, 548, 2, 0.008);
  tone("sine", 554, 551, 1.8, 0.003);
}

// Play a faint synthetic rooftop chuckle.
function soundLaughter() {
  tone("sine", 700, 680, 0.1, 0.008);
  tone("sine", 800, 770, 0.1, 0.007, 0.11);
  tone("sine", 750, 720, 0.12, 0.006, 0.22);
}

// Play the cut ping and ring.
function soundCut() {
  tone("triangle", 900, 1400, 0.06, 0.06);
  tone("triangle", 1400, 1390, 0.4, 0.035, 0.04);
}

// Return a deterministic-looking interval within a sound's required range.
function ambientInterval(minimum, maximum, salt) {
  const wave = (Math.sin(sceneTime * 0.371 + salt * 2.17) + 1) * 0.5;
  return minimum + (maximum - minimum) * wave;
}

// Reset independent game-loop ambient clocks.
function resetAmbientSchedule() {
  ambientSchedule = {
    birds: sceneTime + ambientInterval(8, 15, 1),
    broom: sceneTime + ambientInterval(20, 30, 2),
    traffic: sceneTime + ambientInterval(15, 25, 3),
    cow: sceneTime + ambientInterval(60, 90, 4),
    monkey: sceneTime + ambientInterval(90, 120, 5),
    bell: sceneTime + ambientInterval(150, 180, 6),
    laughter: sceneTime + ambientInterval(30, 45, 7),
    wood: sceneTime + ambientInterval(25, 40, 8),
    water: sceneTime + ambientInterval(90, 120, 9)
  };
}

// Fire due ambient events from scene time only.
function updateAmbient() {
  const specs = {
    birds:[8,15,soundBirds,1], broom:[20,30,soundBroom,2], traffic:[15,25,soundTraffic,3],
    cow:[60,90,soundCow,4], monkey:[90,120,soundMonkey,5], bell:[150,180,soundBell,6],
    laughter:[30,45,soundLaughter,7], wood:[25,40,soundWood,8], water:[90,120,soundWater,9]
  };
  Object.keys(specs).forEach(name => {
    if (sceneTime < ambientSchedule[name]) return;
    const spec = specs[name];
    spec[2]();
    ambientSchedule[name] = sceneTime + ambientInterval(spec[0], spec[1], spec[3] + sceneTime * 0.01);
  });
}

// Speak a Hindi line with graceful silent fallback.
function speakHindi(text, cancelFirst = true) {
  if (save.muted || !("speechSynthesis" in window)) return;
  const voices = speechSynthesis.getVoices();
  const voice = voices.find(item => item.lang && item.lang.toLowerCase().startsWith("hi"));
  if (!voice) return;
  if (cancelFirst) speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.lang = "hi-IN";
  utterance.rate = 1.03;
  utterance.volume = 0.9;
  speechSynthesis.speak(utterance);
}

// Handle pointer start.
function pointerDown(event) {
  unlockAudio();
  const point = canvasPoint(event);
  if (handleCanvasButton(point.x, point.y)) return;
  if (mode !== "playing" || paused || celebration || !assetsReady) return;
  pointer.active = true;
  pointer.x = point.x;
  pointer.y = point.y;
  pointer.lastY = point.y;
  canvas.setPointerCapture?.(event.pointerId);
}

// Handle pointer movement and gesture intent.
function pointerMove(event) {
  if (!pointer.active || mode !== "playing" || paused || celebration) return;
  const point = canvasPoint(event);
  const dy = point.y - pointer.lastY;
  pointer.x = point.x;
  pointer.y = point.y;
  if (dy > 2) beginKhench();
  if (dy < -2) beginDheel();
  pointer.lastY = point.y;
}

// Handle pointer release as DHEEL.
function pointerUp() {
  if (!pointer.active) return;
  pointer.active = false;
  if (mode === "playing" && !paused && !celebration) beginDheel();
}

// Enter KHENCH state.
function beginKhench() {
  if (actionPhase !== "khench") speakHindi("Khench");
  actionPhase = "khench";
}

// Enter DHEEL state and test a valid cut.
function beginDheel() {
  if (actionPhase === "khench") {
    speakHindi("Dheel");
    const config = getLevelConfig(currentLevel);
    if (crossed && elapsed - crossTime <= config.cutWindow && tension > 0.36 && tension < 0.94) {
      triggerWin();
      return;
    }
  }
  actionPhase = "dheel";
}

// Update player kite with lag and wind resistance.
function updatePlayer(dt) {
  const targetX = pointer.active ? clamp(pointer.x, W() * 0.12, W() * 0.58) : player.x;
  const targetY = pointer.active ? clamp(pointer.y - 70, H() * 0.16, H() * 0.68) : player.y;
  const config = getLevelConfig(currentLevel);
  player.vx += (targetX - player.x) * 4.2 * dt;
  player.vy += (targetY - player.y) * 4.2 * dt;
  player.vx += wind.x * dt;
  player.vy += wind.y * dt;
  player.vx *= Math.pow(0.12, dt);
  player.vy *= Math.pow(0.12, dt);
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  player.x = clamp(player.x, W() * 0.1, W() * 0.61);
  player.y = clamp(player.y, H() * 0.13, H() * 0.7);
  if (actionPhase === "khench") {
    tension = Math.min(1.15, tension + dt * (0.46 + config.wind / 100));
    khenchTime += dt;
  } else {
    tension = Math.max(0.08, tension - dt * 0.7);
    khenchTime = Math.max(0, khenchTime - dt * 1.2);
  }
  if (khenchTime > config.snapSeconds) triggerLoss("snap");
}

// Update bounded deterministic-looking wind.
function updateWind(dt) {
  const config = getLevelConfig(currentLevel);
  wind.phase += dt * (0.55 + currentLevel / 180);
  wind.x = Math.sin(wind.phase * 1.17) * config.wind;
  wind.y = Math.cos(wind.phase * 0.83) * config.wind * 0.42;
}

// Update fair AI using only visible player/game state.
function updateAI(dt) {
  const config = getLevelConfig(currentLevel);
  ai.decisionAt -= dt * 1000;
  if (ai.decisionAt <= 0) {
    const vulnerable = tension > 0.7 || player.y > H() * 0.52;
    const canPressure = Math.abs(ai.y - player.y) < H() * 0.18;
    if (vulnerable && canPressure) ai.state = "cross";
    else if (crossed && tension > 0.55) ai.state = "evade";
    else ai.state = elapsed % 5 < 2.4 ? "probe" : "watch";
    ai.decisionAt = config.reactionMs * (0.9 + Math.random() * 0.2);
  }
  let tx = W() * 0.69;
  let ty = H() * 0.39 + Math.sin(elapsed * 0.85) * H() * 0.09;
  if (ai.state === "cross") {
    tx = W() * 0.47;
    ty = player.y + Math.sin(elapsed * 2) * 28;
    ai.tension = Math.min(1, ai.tension + dt * 0.7);
  } else if (ai.state === "evade") {
    tx = W() * 0.82;
    ty = clamp(player.y - 120, H() * 0.17, H() * 0.61);
    ai.tension = Math.max(0.1, ai.tension - dt);
  } else {
    ai.tension = Math.max(0.15, ai.tension - dt * 0.35);
  }
  const dx = tx - ai.x;
  const dy = ty - ai.y;
  const distance = Math.hypot(dx, dy) || 1;
  ai.x += dx / distance * Math.min(config.aiSpeed * dt, distance);
  ai.y += dy / distance * Math.min(config.aiSpeed * dt, distance);
  if (ai.x > W() + 65) triggerLoss("escape");
}

// Detect string crossing from rooftop anchors to kites.
function updateCrossing() {
  const p0 = { x:W() * 0.42, y:H() * 0.62 };
  const a0 = { x:W() * 0.78, y:H() * 0.86 };
  const hit = segmentIntersection(p0, player, a0, ai);
  if (hit && !crossed) {
    crossed = true;
    crossTime = elapsed;
  }
  if (!hit) crossed = false;
}

// Find intersection of two line segments.
function segmentIntersection(a, b, c, d) {
  const den = (a.x-b.x)*(c.y-d.y) - (a.y-b.y)*(c.x-d.x);
  if (Math.abs(den) < 0.001) return null;
  const t = ((a.x-c.x)*(c.y-d.y) - (a.y-c.y)*(c.x-d.x)) / den;
  const u = -((a.x-b.x)*(a.y-c.y) - (a.y-b.y)*(a.x-c.x)) / den;
  if (t > 0 && t < 1 && u > 0 && u < 1) return { x:a.x+t*(b.x-a.x), y:a.y+t*(b.y-a.y) };
  return null;
}

// Begin the authoritative cut celebration.
function triggerWin() {
  if (celebration || mode !== "playing") return;
  score = Math.max(0, Math.round(1200 + currentLevel * 95 + (45 - elapsed) * 45 + (1 - Math.abs(tension - 0.62)) * 500));
  celebration = { time:0, duration:1.35 };
  spawnCutParticles();
  soundCut();
  speakHindi("Woh kaata!");
}

// Begin a loss state.
function triggerLoss(reason) {
  if (celebration || mode !== "playing") return;
  resultReason = reason;
  celebration = { time:0, duration:0.7, loss:true };
  if (reason === "snap") speakHindi("Sara maanja gaya");
  if (reason === "escape") speakHindi("Meri patang gai");
  if (reason === "timer") speakHindi("Kat gae");
}

// Spawn indigo particles along the cut region.
function spawnCutParticles() {
  const p0 = { x:W()*0.42, y:H()*0.62 };
  const a0 = { x:W()*0.78, y:H()*0.86 };
  const hit = segmentIntersection(p0, player, a0, ai) || { x:(player.x+ai.x)/2, y:(player.y+ai.y)/2 };
  for (let i = 0; i < 30; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 35 + Math.random() * 120;
    particles.push({ x:hit.x, y:hit.y, vx:Math.cos(angle)*speed, vy:Math.sin(angle)*speed, life:0.65+Math.random()*0.45 });
  }
}

// Update celebration and particles.
function updateCelebration(dt) {
  if (!celebration) return;
  celebration.time += dt;
  particles.forEach(p => { p.x += p.vx*dt; p.y += p.vy*dt; p.vy += 35*dt; p.life -= dt; });
  particles = particles.filter(p => p.life > 0);
  if (!celebration.loss && celebration.time > 0.3) {
    ai.x += 85 * dt;
    ai.y += Math.sin(celebration.time * 9) * 22 * dt;
  }
  if (celebration.time >= celebration.duration) finishResult(!celebration.loss);
}

// Finalize stars/save and open result modal.
function finishResult(win) {
  const config = getLevelConfig(currentLevel);
  let stars = 0;
  if (win) {
    if (score >= config.thresholds[0]) stars = 1;
    if (score >= config.thresholds[1]) stars = 2;
    if (score >= config.thresholds[2]) stars = 3;
    save.stars[String(currentLevel)] = Math.max(save.stars[String(currentLevel)] || 0, stars);
    save.highScore = Math.max(save.highScore, score);
    saveGame();
  }
  mode = "result";
  celebration = null;
  hud.classList.add("hidden");
  statusBar.classList.add("hidden");
  resultTitle.textContent = win ? "WOH KAATA!" : "Round Over";
  resultDetail.textContent = win ? "Score " + score : lossDetail(resultReason);
  resultStars.textContent = win ? "★".repeat(stars) + "☆".repeat(3-stars) : "☆☆☆";
  resultModal.classList.remove("hidden");
}

// Return a neutral visible loss explanation without duplicating voice lines.
function lossDetail(reason) {
  if (reason === "snap") return "Your line snapped.";
  if (reason === "escape") return "The rival escaped.";
  return "Time ran out.";
}

// Draw the warm fallback while PNG assets are loading or unavailable.
function drawAssetFallback() {
  ctx.fillStyle = "#c9784a";
  ctx.fillRect(0, 0, W(), H());
  ctx.fillStyle = COLORS.cream;
  ctx.font = "700 16px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(assetFailures ? "Scene assets unavailable" : "Loading rooftop…", W() / 2, H() / 2);
}

// Draw the opaque painted sky layer from the repository asset.
function drawSkyAsset() {
  ctx.drawImage(skyImage, 0, 0, W(), H());
}

// Draw the transparent painted rooftop layer, scaled to width and anchored bottom.
function drawRooftopAsset() {
  const scale = W() / rooftopImage.naturalWidth;
  const height = rooftopImage.naturalHeight * scale;
  ctx.drawImage(rooftopImage, 0, H() - height, W(), height);
}

// Draw the hybrid India Frame using PNG layers only.
function drawIndiaFrame() {
  if (!assetsReady) {
    drawAssetFallback();
    return;
  }
  drawSkyAsset();
  drawRooftopAsset();
}

// Draw birds with a two-frame four-hertz flap and vertical dip.
function drawBirds(t) {
  if(!birds.length) birds=[{o:0,y:.2,s:10},{o:170,y:.27,s:8},{o:330,y:.17,s:11}];
  ctx.strokeStyle="#263047aa";ctx.lineWidth=2;
  const up=Math.floor(t*8)%2===0;
  birds.forEach((b,i)=>{const x=((t*b.s+b.o)%(W()+100))-50;const dip=up?0:2.5;const y=H()*b.y+dip;const wing=up?-6:4;ctx.beginPath();ctx.moveTo(x-8,y+wing);ctx.lineTo(x,y);ctx.lineTo(x+8,y+wing);ctx.stroke();});
}

// Spawn and update very faint dust motes from scene time.
function updateDustMotes(dt) {
  if(sceneTime>=nextDustAt&&dustMotes.length<2){dustMotes.push({x:-4,y:H()*(.25+.45*((Math.sin(sceneTime*1.7)+1)/2)),vx:5+3*((Math.sin(sceneTime*.9)+1)/2),life:7});nextDustAt=sceneTime+3.5+2.5*((Math.sin(sceneTime*.61)+1)/2);}
  dustMotes.forEach(m=>{m.x+=m.vx*dt;m.y+=Math.sin(sceneTime*.8+m.x*.02)*.15;m.life-=dt;});
  dustMotes=dustMotes.filter(m=>m.life>0&&m.x<W()+8);
}

// Draw low-alpha drifting dust motes.
function drawDustMotes() {
  ctx.fillStyle="#fff7c933";
  dustMotes.forEach(m=>{ctx.beginPath();ctx.arc(m.x,m.y,1.4,0,Math.PI*2);ctx.fill();});
}

// Draw a classic code-rendered Indian patang with curved lower edges and tasselled tail.
function drawKite(x, y, size, variant, tilt) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  const left = variant === "rival" ? COLORS.blue : COLORS.vermillion;
  const right = variant === "rival" ? COLORS.terracotta : COLORS.marigold;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.72, -size * 0.04);
  ctx.quadraticCurveTo(size * 0.55, size * 0.55, 0, size * 1.18);
  ctx.quadraticCurveTo(-size * 0.55, size * 0.55, -size * 0.72, -size * 0.04);
  ctx.closePath();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = left;
  ctx.fillRect(-size, -size * 1.2, size, size * 2.5);
  ctx.fillStyle = right;
  ctx.fillRect(0, -size * 1.2, size, size * 2.5);
  ctx.restore();
  ctx.strokeStyle = COLORS.cream;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, size * 1.18);
  ctx.quadraticCurveTo(size * .25, size * 1.55, -size * .08, size * 1.9);
  ctx.stroke();
  [1.38,1.62,1.84].forEach((factor,index) => {
    const ty = size * factor;
    ctx.fillStyle = index % 2 ? COLORS.marigold : COLORS.vermillion;
    ctx.beginPath();
    ctx.moveTo(-4, ty);
    ctx.lineTo(4, ty + 2);
    ctx.lineTo(0, ty + 8);
    ctx.closePath();
    ctx.fill();
  });
  ctx.restore();
}

// Draw player and rival strings, code kites, crossing cue and tension meter.
function drawDuel() {
  const p0={x:W()*.42,y:H()*.62},a0={x:W()*.78,y:H()*.70};
  ctx.lineWidth=1.4;
  ctx.strokeStyle=COLORS.cream;
  ctx.beginPath();
  ctx.moveTo(p0.x,p0.y);
  ctx.quadraticCurveTo((p0.x+player.x)/2,(p0.y+player.y)/2+8,player.x,player.y);
  ctx.stroke();
  if (!celebration || celebration.loss || celebration.time<.28){
    ctx.strokeStyle=COLORS.cream;
    ctx.globalAlpha=.72;
    ctx.beginPath();
    ctx.moveTo(a0.x,a0.y);
    ctx.lineTo(ai.x,ai.y);
    ctx.stroke();
    ctx.globalAlpha=1;
  }
  const hit=segmentIntersection(p0,player,a0,ai);
  if(hit){ctx.fillStyle=COLORS.marigold;ctx.shadowColor=COLORS.marigold;ctx.shadowBlur=12;ctx.beginPath();ctx.arc(hit.x,hit.y,5,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}
  const size=Math.max(24,Math.min(54,W()*.065));
  const playerTilt=clamp(player.vx*.003-player.vy*.0015,-.55,.55);
  const aiTilt=clamp(ai.vx*.003-ai.vy*.0015,-.55,.55);
  drawKite(player.x,player.y,size,"player",playerTilt);
  drawKite(ai.x,ai.y,size*.88,"rival",aiTilt);
  drawTensionMeter();
}

// Draw canvas tension meter.
function drawTensionMeter() {
  const x=(player.x+ai.x)/2-55,y=Math.min(player.y,ai.y)-48,w=110;
  ctx.fillStyle="#17204499";ctx.fillRect(x,y,w,8);
  ctx.fillStyle=actionPhase==="khench"?COLORS.red:COLORS.jade;ctx.fillRect(x,y,w*clamp(tension,0,1),8);
  if(actionPhase==="khench"){ctx.globalAlpha=.25+.2*Math.sin(elapsed*15);ctx.strokeStyle=COLORS.red;ctx.lineWidth=3;ctx.strokeRect(x-3,y-3,w+6,14);ctx.globalAlpha=1;}
}

// Draw celebration desaturation, particles and WOH KAATA typography.
function drawCelebration() {
  if (!celebration || celebration.loss) return;
  const t=celebration.time;
  if(t<.25){ctx.fillStyle="rgba(90,90,90,.34)";ctx.fillRect(0,0,W(),H());}
  particles.forEach(p=>{ctx.globalAlpha=clamp(p.life*1.5,0,1);ctx.fillStyle=COLORS.indigo;ctx.fillRect(p.x,p.y,4,4);});ctx.globalAlpha=1;
  if(t>.18&&t<1.2){const q=(t-.18)/1.02;ctx.save();ctx.translate(W()/2,H()*.38-q*55);ctx.rotate(-8*Math.PI/180);ctx.globalAlpha=1-q;ctx.font="900 "+Math.min(58,W()*.13)+"px system-ui";ctx.textAlign="center";ctx.lineWidth=8;ctx.strokeStyle=COLORS.white;ctx.strokeText("WOH KAATA!",0,0);ctx.fillStyle=COLORS.gold;ctx.fillText("WOH KAATA!",0,0);ctx.restore();}
}

// Draw a rounded HUD pill.
function drawPill(x, y, width, height, text) {
  ctx.fillStyle=COLORS.navy;
  ctx.beginPath();
  ctx.roundRect(x,y,width,height,height/2);
  ctx.fill();
  ctx.fillStyle=COLORS.cream;
  ctx.font="700 13px system-ui";
  ctx.textAlign="center";
  ctx.textBaseline="middle";
  ctx.fillText(text,x+width/2,y+height/2);
}

// Draw one diamond action button.
function drawDiamondButton(cx, cy, size, fill, label) {
  ctx.save();
  ctx.translate(cx,cy);
  ctx.rotate(Math.PI/4);
  ctx.fillStyle=fill;
  ctx.beginPath();
  ctx.roundRect(-size/2,-size/2,size,size,8);
  ctx.fill();
  ctx.rotate(-Math.PI/4);
  ctx.fillStyle=COLORS.cream;
  ctx.font="800 11px system-ui";
  ctx.textAlign="center";
  ctx.textBaseline="middle";
  ctx.fillText(label,0,0);
  ctx.restore();
}

// Draw one circular HUD button.
function drawCircleButton(cx, cy, radius, label) {
  ctx.fillStyle=COLORS.navy;
  ctx.beginPath();
  ctx.arc(cx,cy,radius,0,Math.PI*2);
  ctx.fill();
  ctx.fillStyle=COLORS.cream;
  ctx.font="800 16px system-ui";
  ctx.textAlign="center";
  ctx.textBaseline="middle";
  ctx.fillText(label,cx,cy);
}

// Draw the complete in-canvas gameplay HUD.
function drawCanvasHUD() {
  const top=18;
  drawPill(14,top,104,36,"Level "+currentLevel+"  ★★★");
  const windWidth=Math.min(126,W()*.30);
  const windX=W()/2-windWidth/2;
  drawPill(windX,top,windWidth,36,"WIND");
  const windRatio=clamp(Math.abs(wind.x)/Math.max(1,getLevelConfig(currentLevel).wind),0,1);
  ctx.fillStyle=COLORS.cream;ctx.globalAlpha=.3;ctx.fillRect(windX+18,top+26,windWidth-36,3);ctx.globalAlpha=1;
  ctx.fillStyle=COLORS.marigold;ctx.fillRect(windX+18,top+26,(windWidth-36)*windRatio,3);
  const timeWidth=94;
  drawPill(W()-154,top,timeWidth,36,"Time 00:"+String(Math.ceil(Math.max(0,45-elapsed))).padStart(2,"0"));
  drawCircleButton(W()-32,top+18,18,"Ⅱ");
  const by=H()-62;
  drawDiamondButton(54,by,52,COLORS.vermillion,"KHENCH");
  drawDiamondButton(118,by,52,COLORS.blue,"DHEEL");
  drawCircleButton(W()-78,by,22,save.muted?"×":"♪");
  drawCircleButton(W()-28,by,22,"★");
  hudHitZones={
    pause:{x:W()-32,y:top+18,r:24},
    mute:{x:W()-78,y:by,r:27},
    star:{x:W()-28,y:by,r:27},
    khench:{x:54,y:by,r:38},
    dheel:{x:118,y:by,r:38}
  };
}

// Handle in-canvas HUD controls.
function handleCanvasButton(x,y) {
  if(mode!=="playing"||!assetsReady) return false;
  const hit=name=>{const z=hudHitZones[name];return z&&Math.hypot(x-z.x,y-z.y)<=z.r;};
  if(hit("pause")){togglePause();return true;}
  if(hit("mute")){toggleMute();return true;}
  if(hit("khench")){beginKhench();return true;}
  if(hit("dheel")){beginDheel();return true;}
  if(hit("star")) return true;
  return false;
}

// Clamp a number.
function clamp(value,min,max) {
  return Math.max(min,Math.min(max,value));
}

// Advance all gameplay systems.
function update(dt) {
  if(paused) return;
  sceneTime += dt;
  updateDustMotes(dt);
  if(mode!=="playing") return;
  if(celebration){updateCelebration(dt);return;}
  elapsed+=dt;
  if(elapsed>=45){triggerLoss("timer");return;}
  updateWind(dt);
  updatePlayer(dt);
  updateAI(dt);
  updateCrossing();
  updateAmbient();

}

// Render the current canvas frame.
function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  drawIndiaFrame();
  if(!assetsReady) return;
  if(mode==="playing"||mode==="result"){
    drawDuel();
    drawCelebration();
    if(mode==="playing") drawCanvasHUD();
  }
  drawBirds(sceneTime);
  drawDustMotes();
}

// Main requestAnimationFrame loop owns all visual and ambient timing.
function gameLoop(now) {
  pollCanvasSize();
  const dt=Math.min(.033,(now-lastTime)/1000||0);
  lastTime=now;
  update(dt);
  draw();
  requestAnimationFrame(gameLoop);
}

// Wire all UI and input events.
function bindEvents() {
  document.getElementById("playButton").addEventListener("click",()=>{unlockAudio();startGame(currentLevel);});
  document.getElementById("levelsButton").addEventListener("click",showLevels);
  document.getElementById("levelBackButton").addEventListener("click",goHome);
  document.getElementById("pauseButton").addEventListener("click",()=>togglePause());
  document.getElementById("resumeButton").addEventListener("click",()=>togglePause(false));
  document.getElementById("homeButton").addEventListener("click",goHome);
  document.getElementById("retryButton").addEventListener("click",()=>startGame(currentLevel));
  document.getElementById("resultLevelsButton").addEventListener("click",showLevels);
  muteButton.addEventListener("click",toggleMute);
  canvas.addEventListener("pointerdown",pointerDown);
  canvas.addEventListener("pointermove",pointerMove);
  canvas.addEventListener("pointerup",pointerUp);
  canvas.addEventListener("pointercancel",pointerUp);
  document.addEventListener("visibilitychange",()=>{if(document.hidden&&mode==="playing")togglePause(true);});
}

// Initialize the game.
function init() {
  resizeCanvas();
  loadAssets();
  buildLevelGrid();
  bindEvents();
  muteButton.textContent=save.muted?"×":"♪";
  resetPositions();
  requestAnimationFrame(gameLoop);
}

init();
