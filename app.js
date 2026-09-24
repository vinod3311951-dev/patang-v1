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

const COLORS = { white:"#fffdf4", gold:"#ffd65a", indigo:"#5c6cff", red:"#ff5364", jade:"#42d887", ink:"#172044" };
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

// Resize the canvas for crisp high-DPI drawing.
function resizeCanvas() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  canvas.style.width = innerWidth + "px";
  canvas.style.height = innerHeight + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (mode !== "playing") resetPositions();
}

// Return canvas CSS width.
function W() {
  return canvas.width / dpr;
}

// Return canvas CSS height.
function H() {
  return canvas.height / dpr;
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
  hud.classList.remove("hidden");
  statusBar.classList.remove("hidden");
  levelBadge.textContent = "L" + currentLevel;
  statusBar.textContent = "45s · Cross, KHENCH ↓, then DHEEL ↑";
  unlockAudio();
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
  if (mode !== "playing" || paused || celebration) return;
  unlockAudio();
  pointer.active = true;
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  pointer.lastY = event.clientY;
  canvas.setPointerCapture?.(event.pointerId);
}

// Handle pointer movement and gesture intent.
function pointerMove(event) {
  if (!pointer.active || mode !== "playing" || paused || celebration) return;
  const dy = event.clientY - pointer.lastY;
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  if (dy > 2) beginKhench();
  if (dy < -2) beginDheel();
  pointer.lastY = event.clientY;
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
  const p0 = { x:W() * 0.22, y:H() * 0.86 };
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
  const p0 = { x:W()*0.22, y:H()*0.86 };
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

// Draw the reusable India Frame scene with layered parallax and living motion.
function drawIndiaFrame(time) {
  drawSky(time);
  drawSun();
  const kiteOffset = player.x - W() * 0.31;
  drawFarCity(kiteOffset * 0.06);
  drawMidRooftops(kiteOffset * 0.12);
  drawForegroundRoof(kiteOffset * 0.20);
  drawClothesline(kiteOffset * 0.20);
  drawLooseManjha(kiteOffset * 0.20);
  drawAunty(sceneTime, kiteOffset * 0.20);
  drawChaiwala(sceneTime, kiteOffset * 0.12);
  drawKid(sceneTime, kiteOffset * 0.12);
  drawBirds(sceneTime);
  drawDustMotes();
}

// Draw a tintable sky.
function drawSky(time) {
  const g = ctx.createLinearGradient(0, 0, 0, H());
  if (time === "night") { g.addColorStop(0,"#101b4b"); g.addColorStop(1,"#4c3766"); }
  else if (time === "dawn") { g.addColorStop(0,"#536fa8"); g.addColorStop(1,"#f4b58a"); }
  else if (time === "noon") { g.addColorStop(0,"#397bd1"); g.addColorStop(1,"#9ed9ef"); }
  else { g.addColorStop(0,"#304d98"); g.addColorStop(0.55,"#7895ca"); g.addColorStop(1,"#f6b267"); }
  ctx.fillStyle = g;
  ctx.fillRect(0,0,W(),H());
}

// Draw golden-hour sun glow with a subtle eight-second pulse.
function drawSun() {
  const x=W()*0.18, y=H()*0.55;
  const pulse=1+Math.sin(sceneTime*Math.PI/4)*0.04;
  const radius=95*pulse;
  const g=ctx.createRadialGradient(x,y,4,x,y,radius);
  g.addColorStop(0,"#fff8c8cc"); g.addColorStop(1,"#ffd65a00");
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,radius,0,Math.PI*2); ctx.fill();
}

// Draw distant city silhouettes with six-percent kite parallax.
function drawFarCity(offset) {
  ctx.fillStyle="#26375b55";
  for(let x=-45;x<W()+45;x+=32){ const h=24+((x*7)%42+42)%42; ctx.fillRect(x+offset,H()*0.61-h,28,h); }
}

// Draw three mid-depth rooftops with twelve-percent kite parallax.
function drawMidRooftops(offset) {
  const roofs=[{x:-20,y:.66,w:.34},{x:.36*W(),y:.61,w:.28},{x:.7*W(),y:.68,w:.34}];
  roofs.forEach((r,i)=>{ const x=r.x+offset; const y=r.y*H(); const w=r.w*W(); ctx.fillStyle=i===1?"#8d604f":"#74564d"; ctx.fillRect(x,y,w,H()-y); ctx.fillStyle="#4a4a56"; ctx.fillRect(x+w*.58,y-32,38,32); ctx.fillStyle="#2d3246"; ctx.fillRect(x+w*.63,y-49,2,17); ctx.strokeStyle="#34364a"; ctx.lineWidth=2; ctx.beginPath();ctx.moveTo(x+w*.2,y);ctx.lineTo(x+w*.2,y-50);ctx.lineTo(x+w*.24,y-58);ctx.stroke(); });
}

// Draw foreground terrace with twenty-percent kite parallax.
function drawForegroundRoof(offset) {
  const y=H()*.82;
  ctx.fillStyle="#a46b50";ctx.fillRect(-40+offset,y,W()+80,H()-y);
  ctx.fillStyle="#70483f";ctx.fillRect(-40+offset,y-18,W()+80,18);
  ctx.fillStyle="#503a3d33";ctx.beginPath();ctx.moveTo(W()*.1+offset,y);ctx.lineTo(W()*.43+offset,H());ctx.lineTo(W()*.31+offset,H());ctx.closePath();ctx.fill();
}

// Draw four independently swaying cloth pieces tied to wind strength.
function drawClothesline(offset) {
  const y=H()*.73;
  const windScale=1+getLevelConfig(currentLevel).wind/45;
  const cloth=[{f:.14,p:.2,h:.71},{f:.24,p:1.7,h:.83},{f:.35,p:3.1,h:.64},{f:.47,p:4.8,h:.76}];
  ctx.strokeStyle="#3f3840";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(W()*.07+offset,y-55);ctx.quadraticCurveTo(W()*.34+offset,y-38,W()*.57+offset,y-52);ctx.stroke();
  cloth.forEach((c,i)=>{const angle=Math.sin(sceneTime*c.h+c.p)*(6*Math.PI/180)*windScale;const x=W()*c.f+offset;ctx.save();ctx.translate(x,y-48);ctx.rotate(angle);ctx.fillStyle=[COLORS.gold,COLORS.jade,COLORS.white,COLORS.red][i];ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(28,1);ctx.lineTo(25,41);ctx.lineTo(3,38);ctx.closePath();ctx.fill();ctx.restore();});
}

// Draw a loose rooftop manjha thread fluttering with the same wind.
function drawLooseManjha(offset) {
  const gust=wind.x/Math.max(8,getLevelConfig(currentLevel).wind);
  const x=W()*.61+offset,y=H()*.815;
  ctx.strokeStyle="#fffdf477";ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+18+gust*10,y-18,x+38+gust*16,y-5);ctx.stroke();
}

// Draw aunty's seven-second reach, clip, smooth, straighten and weight-shift cycle.
function drawAunty(t,offset) {
  const x=W()*.12+offset,y=H()*.82,cycle=(t%7)/7;
  const breathe=Math.sin(t*2.1)*1.2;
  let reach=0,smooth=0,shift=0;
  if(cycle<.2) reach=cycle/.2;
  else if(cycle<.35) reach=1;
  else if(cycle<.55){reach=1-(cycle-.35)/.2;smooth=(cycle-.35)/.2;}
  else if(cycle<.72) smooth=1-(cycle-.55)/.17;
  else shift=Math.sin((cycle-.72)/.28*Math.PI)*3;
  ctx.strokeStyle="#322f42";ctx.fillStyle="#7d3f57";ctx.lineWidth=5;ctx.beginPath();ctx.arc(x+shift,y-68+breathe,10,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.moveTo(x+shift,y-58+breathe);ctx.lineTo(x+shift,y-22);ctx.stroke();ctx.beginPath();ctx.moveTo(x+shift,y-49+breathe);ctx.lineTo(x+12+reach*14+smooth*4,y-57-reach*25+smooth*8);ctx.stroke();
}

// Draw chaiwala's nine-second stir-look-stir loop and soft circle steam.
function drawChaiwala(t,offset) {
  const x=W()*.49+offset,y=H()*.61,cycle=(t%9)/9;
  const looking=cycle>.42&&cycle<.62;
  const stir=(cycle<.32||(cycle>.68&&cycle<.94))?Math.sin(t*8)*4:0;
  ctx.fillStyle="#493b42";ctx.fillRect(x-26,y-20,58,20);ctx.beginPath();ctx.arc(x+(looking?3:0),y-43-(looking?2:0),6,0,Math.PI*2);ctx.fill();ctx.fillRect(x-5,y-37,10,18);
  ctx.strokeStyle="#493b42";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y-28);ctx.lineTo(x+17+stir,y-24);ctx.stroke();
  ctx.fillStyle="#d7c5a4";ctx.beginPath();ctx.ellipse(x+20,y-26,8,5,0,0,Math.PI*2);ctx.fill();
  for(let i=0;i<4;i+=1){const rise=(sceneTime*.18+i*.23)%1;const sx=x+20+Math.sin(sceneTime*1.3+i)*4;const sy=y-34-rise*38;ctx.globalAlpha=(1-rise)*.16;ctx.fillStyle=COLORS.white;ctx.beginPath();ctx.arc(sx,sy,3.5+Math.sin(sceneTime+i)*.8,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
}

// Draw kid with tiny irregular kite tugs and occasional sky-following head motion.
function drawKid(t,offset) {
  const x=W()*.79+offset,y=H()*.68;
  const tug=Math.sin(t*5.3)*2.2+Math.sin(t*8.7+1.4)*1.4;
  const look=Math.sin(t*.47)>0.72?-3:0;
  const arm=clamp((player.y/H()-.25)*22+tug,-7,15);
  ctx.fillStyle="#303247";ctx.beginPath();ctx.arc(x+look,y-35+look*.3,6,0,Math.PI*2);ctx.fill();ctx.fillRect(x-4,y-29,8,21);ctx.strokeStyle="#303247";ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x,y-24);ctx.lineTo(x-15,y-35+arm);ctx.stroke();
  drawKite(x-24,y-55+arm,8,COLORS.jade,Math.sin(t*2.2)*.08);
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

// Draw one diamond kite and tail.
function drawKite(x,y,size,color,tilt) {
  ctx.save();ctx.translate(x,y);ctx.rotate(tilt);ctx.fillStyle=color;ctx.strokeStyle=COLORS.white;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-size);ctx.lineTo(size*.8,0);ctx.lineTo(0,size);ctx.lineTo(-size*.8,0);ctx.closePath();ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(0,size);ctx.quadraticCurveTo(8,size+10,-3,size+18);ctx.stroke();ctx.restore();
}

// Draw strings, kites, crossing cue and tension meter.
function drawDuel() {
  const p0={x:W()*.22,y:H()*.86},a0={x:W()*.78,y:H()*.86};
  ctx.lineWidth=1.7;ctx.strokeStyle=COLORS.white;ctx.beginPath();ctx.moveTo(p0.x,p0.y);ctx.lineTo(player.x,player.y);ctx.stroke();
  if (!celebration || celebration.loss || celebration.time<.28){ctx.strokeStyle="#d8d9ff";ctx.beginPath();ctx.moveTo(a0.x,a0.y);ctx.lineTo(ai.x,ai.y);ctx.stroke();}
  const hit=segmentIntersection(p0,player,a0,ai);
  if(hit){ctx.fillStyle=COLORS.gold;ctx.shadowColor=COLORS.gold;ctx.shadowBlur=14;ctx.beginPath();ctx.arc(hit.x,hit.y,5,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}
  drawKite(player.x,player.y,24,COLORS.gold,player.vx*.0015);
  drawKite(ai.x,ai.y,24,COLORS.indigo,ai.vx*.0015);
  drawTensionMeter();
  if(pointer.active&&actionPhase==="khench"){ctx.strokeStyle=COLORS.red;ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(pointer.x,pointer.y);ctx.lineTo(player.x,player.y);ctx.stroke();}
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

// Draw timer and minimal gameplay text on canvas.
function drawCanvasHUD() {
  const remaining=Math.max(0,45-elapsed);
  ctx.fillStyle=COLORS.white;ctx.font="800 15px system-ui";ctx.textAlign="center";ctx.fillText(Math.ceil(remaining)+"s",W()/2,32+Math.max(0,parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sat"))||0));
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
  statusBar.textContent=Math.ceil(45-elapsed)+"s · "+(actionPhase==="khench"?"KHENCH ↓":actionPhase==="dheel"?"DHEEL ↑":"Cross the strings");
}

// Render the current canvas frame.
function draw() {
  drawIndiaFrame(timeOfDay);
  if(mode==="playing"||mode==="result"){drawDuel();drawCelebration();if(mode==="playing")drawCanvasHUD();}
}

// Main requestAnimationFrame loop owns all visual and ambient timing.
function gameLoop(now) {
  const dt=Math.min(.033,(now-lastTime)/1000||0);
  lastTime=now;
  update(dt);
  draw();
  requestAnimationFrame(gameLoop);
}

// Wire all UI and input events.
function bindEvents() {
  document.getElementById("playButton").addEventListener("click",()=>startGame(currentLevel));
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
  window.addEventListener("resize",resizeCanvas);
  document.addEventListener("visibilitychange",()=>{if(document.hidden&&mode==="playing")togglePause(true);});
}

// Initialize the game.
function init() {
  resizeCanvas();
  buildLevelGrid();
  bindEvents();
  muteButton.textContent=save.muted?"×":"♪";
  resetPositions();
  requestAnimationFrame(gameLoop);
}

init();
