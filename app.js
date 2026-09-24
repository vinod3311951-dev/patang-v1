
// ============================================================
// PATANG v6.0 — COMPLETE app.js
// Indian Kite Fighting Game
// ============================================================

// 1. MODULE-LEVEL VARIABLES

let canvas = null;
let ctx = null;
let W = 0;
let H = 0;

let sceneImage = null;
let sceneReady = false;

let gameState = "home";
let level = 1;
const MAX_LEVEL = 105;
const ROUND_SECONDS = 15;
let levelTimeLeft = ROUND_SECONDS;
let playerActionScore = 0;
let contactTime = 0;
let roundSeed = 0;

let frameCount = 0;
let lastTime = performance.now();
let lastDt = 0;
let timeAccumulator = 0;
let sineAccumulator = 0;

const player = {
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  size: 0
};

const ai = {
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  size: 0,
  huntTimer: 1.8,
  retreatTimer: 0
};

let manja = 0.3;
let spawnGrace = 2;
let stateTimer = 0;

let aiWasCut = false;
let playerCut = false;
let paused = false;

let lastPluckTime = -100;
let scheduledClearPluckAt = -1;
let failReason = "LEVEL FAIL";

let promptQueue = [];

let aiSparrowTimer = 4;
let aiCrowTimer = 12;

let audioWater = null;
let audioSparrow = null;
let audioCrow = null;
let audioPluck = null;
let audioDheel = null;
let audioKhench = null;
let audioKatGai = null;
let audioManjaGaya = null;

let audioInitialized = false;

let dheelZone = null;
let khenchZone = null;
let pauseZone = null;
let pauseHomeZone = null;
let homePlayZone = null;
let homeLevelsZone = null;
let terminalZones = [];
let battleZones = [];
let selectorBackZone = null;
let selectedTerminal = 0;
const TERMINALS = [
  { name: "UDAAN", from: 1, to: 15 },
  { name: "DHEEL", from: 16, to: 30 },
  { name: "PECH", from: 31, to: 45 },
  { name: "MANJHA", from: 46, to: 60 },
  { name: "KHENCH", from: 61, to: 75 },
  { name: "KAATEH", from: 76, to: 90 },
  { name: "PATANGBAAZ", from: 91, to: 105 }
];

let boyHandX = 0;
let boyHandY = 0;

let coverX = 0;
let coverY = 0;
let coverW = 0;
let coverH = 0;

let initialized = false;

// ============================================================
// 2. UTILITY FUNCTIONS
// ============================================================

function roundedRectPath(c, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));

  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y);
  c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r);
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r);
  c.quadraticCurveTo(x, y, x + r, y);
  c.closePath();
}

function inZone(x, y, zone) {
  if (!zone) return false;

  return (
    x >= zone.x &&
    x <= zone.x + zone.w &&
    y >= zone.y &&
    y <= zone.y + zone.h
  );
}

function segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  const epsilon = 0.000001;

  const o1 =
    (bx - ax) * (cy - ay) -
    (by - ay) * (cx - ax);

  const o2 =
    (bx - ax) * (dy - ay) -
    (by - ay) * (dx - ax);

  const o3 =
    (dx - cx) * (ay - cy) -
    (dy - cy) * (ax - cx);

  const o4 =
    (dx - cx) * (by - cy) -
    (dy - cy) * (bx - cx);

  if (
    ((o1 > epsilon && o2 < -epsilon) ||
      (o1 < -epsilon && o2 > epsilon)) &&
    ((o3 > epsilon && o4 < -epsilon) ||
      (o3 < -epsilon && o4 > epsilon))
  ) {
    return true;
  }

  function onSegment(px, py, qx, qy, rx, ry) {
    return (
      qx >= Math.min(px, rx) - epsilon &&
      qx <= Math.max(px, rx) + epsilon &&
      qy >= Math.min(py, ry) - epsilon &&
      qy <= Math.max(py, ry) + epsilon
    );
  }

  if (
    Math.abs(o1) <= epsilon &&
    onSegment(ax, ay, cx, cy, bx, by)
  ) {
    return true;
  }

  if (
    Math.abs(o2) <= epsilon &&
    onSegment(ax, ay, dx, dy, bx, by)
  ) {
    return true;
  }

  if (
    Math.abs(o3) <= epsilon &&
    onSegment(cx, cy, ax, ay, dx, dy)
  ) {
    return true;
  }

  if (
    Math.abs(o4) <= epsilon &&
    onSegment(cx, cy, bx, by, dx, dy)
  ) {
    return true;
  }

  return false;
}

// ============================================================
// 3. AUDIO
// ============================================================

function initAudio() {
  if (audioInitialized) return;

  audioInitialized = true;

  // Eight independent HTML Audio elements.
  // The four action variants reuse the existing pluck asset.

  audioWater = new Audio("public/assets/water.mp3");
  audioWater.volume = 0.20;
  audioWater.loop = true;
  audioWater.preload = "auto";

  // Keep the water bed independent from bird/action sounds.
  // Some mobile browsers can occasionally stop a looping media element;
  // restart only this dedicated element if that happens unexpectedly.
  audioWater.addEventListener("ended", function () {
    if (!paused && audioInitialized) {
      audioWater.currentTime = 0;
      audioWater.play().catch(() => {});
    }
  });

  audioSparrow = new Audio("public/assets/sparrow.mp3");
  audioSparrow.volume = 0.24;
  audioSparrow.preload = "auto";

  audioCrow = new Audio("public/assets/crow.mp3");
  audioCrow.volume = 0.22;
  audioCrow.preload = "auto";

  audioPluck = new Audio("public/assets/pluck.mp3");
  audioPluck.volume = 0.48;
  audioPluck.preload = "auto";

  audioDheel = new Audio("public/assets/pluck.mp3");
  audioDheel.volume = 0.28;
  audioDheel.playbackRate = 1.30;
  audioDheel.preload = "auto";

  audioKhench = new Audio("public/assets/pluck.mp3");
  audioKhench.volume = 0.28;
  audioKhench.playbackRate = 0.80;
  audioKhench.preload = "auto";

  audioKatGai = new Audio("public/assets/pluck.mp3");
  audioKatGai.volume = 0.35;
  audioKatGai.playbackRate = 1.60;
  audioKatGai.preload = "auto";

  audioManjaGaya = new Audio("public/assets/pluck.mp3");
  audioManjaGaya.volume = 0.30;
  audioManjaGaya.playbackRate = 0.55;
  audioManjaGaya.preload = "auto";

  aiSparrowTimer = 0.8;
  aiCrowTimer = 12 + Math.random() * 13;

  try {
    audioWater.play().catch(() => {});
  } catch (e) {
    console.warn("Water audio unavailable:", e);
  }
}

function speakHindi(words) {
  if (!("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(words);
    u.lang = "hi-IN";
    u.rate = 1.12;
    u.pitch = 1.05;
    u.volume = 0.95;
    window.speechSynthesis.speak(u);
  } catch (e) {}
}

function playPluck(rate) {
  if (!audioPluck) return;

  lastPluckTime = timeAccumulator;

  try {
    audioPluck.currentTime = 0;
    audioPluck.playbackRate = rate;
    audioPluck.play().catch(() => {});
  } catch (e) {
    // Audio failure must not interrupt gameplay.
  }
}

function scheduleAmbient(dt) {
  if (!audioInitialized || paused) return;

  if (audioWater && audioWater.paused && gameState === "playing") {
    audioWater.play().catch(() => {});
  }

  // Sparrow only: brief, independent village ambience. Crow stays off.
  aiSparrowTimer -= dt;
  if (aiSparrowTimer <= 0 && audioSparrow) {
    try {
      audioSparrow.currentTime = 0;
      audioSparrow.play().catch(() => {});
    } catch (e) {}
    aiSparrowTimer = 4 + Math.random() * 5;
  }
}

// ============================================================
// 4. LAYOUT
// ============================================================

function recomputeLayout() {
  const oldW = W;
  const oldH = H;

  W = window.innerWidth;
  H = window.innerHeight;

  canvas.width = W;
  canvas.height = H;

  boyHandX = 0.53 * W;
  boyHandY = 0.60 * H;

  player.size = 0.14 * W;
  ai.size = 0.11 * W;

  dheelZone = {
    x: 0.05 * W - 8,
    y: 0.86 * H - 8,
    w: 0.40 * W + 16,
    h: 0.10 * H + 16
  };

  khenchZone = {
    x: 0.55 * W - 8,
    y: 0.86 * H - 8,
    w: 0.40 * W + 16,
    h: 0.10 * H + 16
  };

  pauseZone = {
    x: 0.86 * W - 8,
    y: 0.02 * H - 8,
    w: 0.10 * W + 16,
    h: 0.06 * H + 16
  };

  pauseHomeZone = { x: 0.29 * W, y: 0.54 * H, w: 0.42 * W, h: 0.07 * H };

  homePlayZone = {
    x: 0.5 * W - 110,
    y: 0.56 * H - 34,
    w: 220,
    h: 64
  };

  homeLevelsZone = {
    x: 0.5 * W - 110,
    y: 0.65 * H - 28,
    w: 220,
    h: 56
  };

  if (oldW > 0 && oldH > 0) {
    player.x = player.x / oldW * W;
    player.y = player.y / oldH * H;

    ai.x = ai.x / oldW * W;
    ai.y = ai.y / oldH * H;
  }

  computeCoverRect();
}

function computeCoverRect() {
  if (!sceneReady || !sceneImage) {
    coverX = 0;
    coverY = 0;
    coverW = W;
    coverH = H;
    return;
  }

  const imageW = sceneImage.naturalWidth;
  const imageH = sceneImage.naturalHeight;

  if (imageW <= 0 || imageH <= 0) {
    coverX = 0;
    coverY = 0;
    coverW = W;
    coverH = H;
    return;
  }

  const scale = Math.max(W / imageW, H / imageH);

  coverW = imageW * scale;
  coverH = imageH * scale;

  coverX = (W - coverW) / 2;
  coverY = (H - coverH) / 2;
}

// ============================================================
// 5. INPUT
// ============================================================

function handlePointerDown(event) {
  if (event.cancelable) {
    event.preventDefault();
  }

  // First user interaction unlocks HTML Audio.

  if (!audioInitialized) {
    initAudio();
  }

  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();

  if (rect.width <= 0 || rect.height <= 0) return;

  const x =
    (event.clientX - rect.left) *
    (canvas.width / rect.width);

  const y =
    (event.clientY - rect.top) *
    (canvas.height / rect.height);

  if (gameState === "battleSelect") {
    if (inZone(x, y, selectorBackZone)) { transitionState("levelSelect"); return; }
    for (let i = 0; i < battleZones.length; i++) {
      if (inZone(x, y, battleZones[i])) {
        resetLevel(TERMINALS[selectedTerminal].from + i);
        transitionState("playing");
        pushPrompt("LEVEL " + level, "#FFD700", 1.0);
        return;
      }
    }
    transitionState("levelSelect");
    return;
  }

  if (gameState === "levelSelect") {
    if (inZone(x, y, selectorBackZone)) { transitionState("home"); return; }
    for (let i = 0; i < terminalZones.length; i++) {
      if (inZone(x, y, terminalZones[i])) {
        selectedTerminal = i;
        transitionState("battleSelect");
        return;
      }
    }
    transitionState("home");
    return;
  }

  if (gameState === "home") {
    if (inZone(x, y, homePlayZone)) {
      resetLevel(1);
      transitionState("playing");
      pushPrompt("FLY YOUR KITE!", "#FFFAEB", 1.2);
      return;
    }

    if (inZone(x, y, homeLevelsZone)) {
      transitionState("levelSelect");
      return;
    }

    return;
  }

  if (gameState !== "playing") return;

  if (inZone(x, y, pauseZone)) {
    paused = !paused;

    if (audioWater) {
      try {
        if (paused) {
          audioWater.pause();
        } else {
          audioWater.play().catch(() => {});
        }
      } catch (e) {
        // Continue even if audio cannot resume.
      }
    }

    return;
  }

  if (paused) {
    if (inZone(x, y, pauseHomeZone)) { paused = false; transitionState("home"); if (audioWater) audioWater.pause(); }
    return;
  }

  if (inZone(x, y, dheelZone)) {
    // DHEEL: loose line -> kite surges upward and outward.
    player.vy -= 255;
    player.vx += (player.x < W * 0.5 ? -1 : 1) * 85;
    playerActionScore += 1;

    manja = Math.min(1, manja + 0.065);

    pushPrompt("DHEEL", "#00BFFF", 0.8);

    playPluck(1.30);

    if (audioDheel) {
      try {
        audioDheel.currentTime = 0;
        audioDheel.play().catch(() => {});
      } catch (e) {
        // Optional action sound.
      }
    }

    return;
  }

  if (inZone(x, y, khenchZone)) {
    // KHENCH: sharp pull -> fast dive/tension attack.
    player.vy += 285;
    player.vx += (ai.x - player.x) * 0.18;
    playerActionScore += 1;

    manja = Math.min(1, manja + 0.035);

    pushPrompt("KHENCH", "#FF3B30", 0.8);

    playPluck(0.80);

    if (audioKhench) {
      try {
        audioKhench.currentTime = 0;
        audioKhench.play().catch(() => {});
      } catch (e) {
        // Optional action sound.
      }
    }
  }
}

// ============================================================
// 6. STATE MANAGEMENT
// ============================================================

function transitionState(nextState) {
  const validStates = [
    "home",
    "playing",
    "katching",
    "levelClear",
    "levelFail",
    "levelSelect",
    "battleSelect"
  ];

  if (!validStates.includes(nextState)) return;

  gameState = nextState;
}

function resetLevel(n) {
  level = Math.max(1, Math.min(MAX_LEVEL, n));
  levelTimeLeft = ROUND_SECONDS;

  player.x = 0.62 * W;
  player.y = 0.34 * H;
  player.vx = 0;
  player.vy = 0;

  ai.x = 0.24 * W;
  ai.y = 0.27 * H;
  ai.vx = 0;
  ai.vy = 0;

  // Conflict starts quickly in a 15-second round, but never instantly.
  ai.huntTimer = 1.8;
  ai.retreatTimer = 0;
  manja = 0.52;
  spawnGrace = 1.1;
  stateTimer = 0;
  playerActionScore = 0;
  contactTime = 0;
  roundSeed = Math.random() * Math.PI * 2;

  aiWasCut = false;
  playerCut = false;
  scheduledClearPluckAt = -1;
  failReason = "LEVEL FAIL";
  promptQueue = [];
  paused = false;

  if (audioWater && audioInitialized && audioWater.paused) {
    audioWater.play().catch(() => {});
  }
}

function beginKatching(who) {
  if (gameState !== "playing") return;

  aiWasCut = who === "ai";
  playerCut = who === "player";

  transitionState("katching");

  stateTimer = 1.5;

  pushPrompt("KAT GAI!", "#FF0000", 1.2);

  playPluck(1.6);

  if (audioKatGai) {
    try { audioKatGai.currentTime = 0; audioKatGai.play().catch(() => {}); } catch (e) {}
  }
  speakHindi(who === "ai" ? (Math.random() < 0.5 ? "काट दी!" : "कट गई!") : "मांझा गया!");
}

function beginLevelClear() {
  transitionState("levelClear");

  stateTimer = 2.5;

  pushPrompt("LEVEL CLEAR", "#00FF00", 2.0);

  playPluck(1.6);

  // The second celebration note is scheduled using game time.
  scheduledClearPluckAt = timeAccumulator + 0.5;
}

function beginLevelFail(reason) {
  failReason = reason || "LEVEL FAIL";

  transitionState("levelFail");

  stateTimer = 2.0;

  scheduledClearPluckAt = -1;

  pushPrompt(failReason, "#FF1744", 1.5);

  playPluck(0.55);
}

function cutAI() {
  aiWasCut = true;
  playerCut = false;

  ai.vy = Math.max(120, ai.vy);
}

function cutPlayer() {
  playerCut = true;
  aiWasCut = false;

  player.vy = Math.max(120, player.vy);

  if (audioManjaGaya) {
    try {
      audioManjaGaya.currentTime = 0;
      audioManjaGaya.play().catch(() => {});
    } catch (e) {
      // Optional losing sound.
    }
  }
}

// ============================================================
// 7. PHYSICS
// ============================================================

function updatePlayerPhysics(dt) {
  // Light, organic breeze only. No strong automatic wind steering.
  const breezeX =
    Math.sin(sineAccumulator * 1.05 + roundSeed) * 15 +
    Math.sin(sineAccumulator * 0.41 + 1.7) * 7;
  const breezeY = Math.sin(sineAccumulator * 0.83 + roundSeed) * 9;

  player.vx += breezeX * dt;
  player.vy += breezeY * dt;

  // A very weak restoring force prevents permanent edge sticking without
  // playing the game for the user.
  player.vx += (0.52 * W - player.x) * 0.035 * dt;
  player.vy += (0.34 * H - player.y) * 0.025 * dt;

  const drag = Math.pow(0.975, dt * 60);
  player.vx *= drag;
  player.vy *= drag;

  const maxSpeed = 390;
  const speed = Math.hypot(player.vx, player.vy);
  if (speed > maxSpeed) {
    player.vx = player.vx / speed * maxSpeed;
    player.vy = player.vy / speed * maxSpeed;
  }

  player.x += player.vx * dt;
  player.y += player.vy * dt;

  const minX = 0.10 * W, maxX = 0.90 * W;
  const minY = 0.15 * H, maxY = 0.58 * H;

  if (player.x < minX) { player.x = minX; player.vx = Math.abs(player.vx) * 0.45; }
  if (player.x > maxX) { player.x = maxX; player.vx = -Math.abs(player.vx) * 0.45; }
  if (player.y < minY) { player.y = minY; player.vy = Math.abs(player.vy) * 0.45; }
  if (player.y > maxY) { player.y = maxY; player.vy = -Math.abs(player.vy) * 0.45; }
}

function updateAIPhysics(dt) {
  const difficulty = Math.min(1, (level - 1) / (MAX_LEVEL - 1));

  if (ai.huntTimer > 0) {
    ai.huntTimer = Math.max(0, ai.huntTimer - dt);
    ai.vx = 22 * Math.sin(sineAccumulator * 1.2 + roundSeed);
    ai.vy = 14 * Math.sin(sineAccumulator * 1.55 + 0.7);
  } else {
    // Hunt a moving offset around the player so encounters feel like
    // kite-fighting rather than deterministic homing.
    const orbitX = Math.sin(sineAccumulator * (1.8 + difficulty) + roundSeed) * W * 0.12;
    const orbitY = Math.cos(sineAccumulator * 1.45 + roundSeed) * H * 0.07;
    const targetX = player.x + orbitX;
    const targetY = player.y + orbitY;
    const dx = targetX - ai.x;
    const dy = targetY - ai.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const huntSpeed = 82 + difficulty * 48;

    ai.vx += (dx / distance * huntSpeed - ai.vx) * Math.min(1, dt * 3.2);
    ai.vy += (dy / distance * huntSpeed - ai.vy) * Math.min(1, dt * 3.2);
  }

  ai.x += ai.vx * dt;
  ai.y += ai.vy * dt;

  if (ai.x < 0.10 * W) { ai.x = 0.10 * W; ai.vx = Math.abs(ai.vx); }
  if (ai.x > 0.90 * W) { ai.x = 0.90 * W; ai.vx = -Math.abs(ai.vx); }
  if (ai.y < 0.14 * H) { ai.y = 0.14 * H; ai.vy = Math.abs(ai.vy); }
  if (ai.y > 0.58 * H) { ai.y = 0.58 * H; ai.vy = -Math.abs(ai.vy); }
}

function updateManja(dt) {
  // MANJA is now tension/skill energy, not an automatic altitude meter.
  // It changes slowly unless the player actively works DHEEL/KHENCH.
  manja -= 0.006 * dt;
  manja = Math.max(0.12, Math.min(1, manja));
}

// ============================================================
// 8. STRING-CROSSING AND CUT DETECTION
// ============================================================

function checkStringCrossing(dt) {
  if (gameState !== "playing" || spawnGrace > 0) return;

  const dist = Math.hypot(player.x - ai.x, player.y - ai.y);
  const crossing = dist < 0.42 * W && segmentsIntersect(
    boyHandX, boyHandY, player.x, player.y,
    ai.x, ai.y, W, H
  );

  if (!crossing) {
    contactTime = Math.max(0, contactTime - dt * 1.8);
    return;
  }

  contactTime += dt;

  if (timeAccumulator - lastPluckTime >= 0.42) {
    playPluck(0.95 + Math.random() * 0.15);
  }

  // A cut requires actual input. Hands-off play can never clear a level.
  if (playerActionScore < 2 || contactTime < 0.28) return;

  const difficulty = Math.min(1, (level - 1) / (MAX_LEVEL - 1));
  const playerPower =
    manja +
    Math.min(0.16, playerActionScore * 0.016) +
    Math.random() * 0.10;

  // AI can genuinely win from level 1, and becomes progressively tougher.
  const aiPower =
    0.48 +
    difficulty * 0.34 +
    Math.random() * 0.30;

  if (playerPower >= aiPower) {
    cutAI();
    beginKatching("ai");
  } else {
    cutPlayer();
    beginKatching("player");
  }
}

// ============================================================
// 9. GAME UPDATE
// ============================================================

function update(dt) {
  timeAccumulator += dt;

  if (!paused) {
    sineAccumulator += dt;
  }

  switch (gameState) {
    case "home":
    case "levelSelect":
    case "battleSelect":
      updateHome(dt);
      break;

    case "playing":
      updatePlaying(dt);
      break;

    case "katching":
      updateKatching(dt);
      break;

    case "levelClear":
      updateLevelClear(dt);
      break;

    case "levelFail":
      updateLevelFail(dt);
      break;

    default:
      transitionState("home");
      break;
  }

  if (
    audioInitialized &&
    gameState === "playing" &&
    !paused
  ) {
    scheduleAmbient(dt);
  }

  if (!paused) {
    updatePrompts(dt);
  }
}

function updateHome(dt) {
  // The home screen remains animated by the RAF renderer.
  // No gameplay timer advances here.
}

function updatePlaying(dt) {
  if (paused) return;

  levelTimeLeft -= dt;

  if (levelTimeLeft <= 0) {
    levelTimeLeft = 0;
    // Resolve every full 15-second round as a real contest; never show TAKE CONTROL.
    beginKatching(Math.random() < (playerActionScore === 0 ? 0.58 : 0.50) ? "player" : "ai");
    return;
  }

  updatePlayerPhysics(dt);
  updateAIPhysics(dt);
  updateManja(dt);

  if (spawnGrace > 0) {
    spawnGrace = Math.max(0, spawnGrace - dt);
    return;
  }

  checkStringCrossing(dt);
}

function updateKatching(dt) {
  stateTimer -= dt;

  // The cut kite falls during the katching animation.

  if (aiWasCut) {
    ai.x += ai.vx * dt * 0.3;
    ai.y += Math.max(120, ai.vy) * dt;
    ai.vy += 110 * dt;
  }

  if (playerCut) {
    player.x += player.vx * dt * 0.3;
    player.y += Math.max(120, player.vy) * dt;
    player.vy += 110 * dt;
  }

  if (stateTimer <= 0) {
    if (aiWasCut) {
      beginLevelClear();
    } else {
      beginLevelFail("LEVEL FAIL");
    }
  }
}

function updateLevelClear(dt) {
  if (
    scheduledClearPluckAt >= 0 &&
    timeAccumulator >= scheduledClearPluckAt
  ) {
    scheduledClearPluckAt = -1;
    playPluck(1.9);
  }

  stateTimer -= dt;

  if (stateTimer <= 0) {
    if (level >= MAX_LEVEL) {
      resetLevel(1);
      transitionState("playing");
      pushPrompt("105 LEVELS COMPLETE!", "#FFD700", 1.8);
    } else {
      resetLevel(level + 1);
      transitionState("playing");
      pushPrompt("LEVEL " + level + " / " + MAX_LEVEL, "#FFD700", 1.0);
    }
  }
}

function updateLevelFail(dt) {
  stateTimer -= dt;

  if (stateTimer <= 0) {
    resetLevel(level);
    transitionState("playing");

    pushPrompt(
      "TRY AGAIN!",
      "#FFFAEB",
      1.2
    );
  }
}

// ============================================================
// 10. RENDERING
// ============================================================

function render() {
  if (!ctx) return;

  if (gameState === "home") {
    renderHome();
    return;
  }

  if (gameState === "levelSelect") {
    renderLevelSelect();
    return;
  }
  if (gameState === "battleSelect") {
    renderBattleSelect();
    return;
  }

  renderScene();
  renderStrings();
  renderKites();

  renderHUD();
  renderMANJA();
  renderButtons();

  if (gameState === "levelClear") {
    renderLevelClearBumper();
  }

  if (gameState === "levelFail") {
    renderLevelFailBumper();
  }

  if (paused && gameState === "playing") {
    ctx.save();

    ctx.fillStyle = "rgba(0,0,0,0.46)";
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.font = 'bold 43px "Arial Black", Arial, sans-serif';
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#000000";
    ctx.fillStyle = "#FFFAEB";

    ctx.strokeText("PAUSED", W * 0.5, H * 0.43);
    ctx.fillText("PAUSED", W * 0.5, H * 0.43);

    ctx.font = "bold 17px Arial, sans-serif";
    ctx.fillText("Tap pause to resume", W * 0.5, H * 0.50, W * 0.9);
    const ph = pauseHomeZone;
    roundedRectPath(ctx, ph.x, ph.y, ph.w, ph.h, 16);
    ctx.fillStyle = "rgba(255,20,147,0.92)"; ctx.fill();
    ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = "#FFFFFF"; ctx.font = 'bold 18px "Arial Black", Arial, sans-serif';
    ctx.fillText("HOME", W * 0.5, ph.y + ph.h * 0.52);

    ctx.restore();
  }

  renderPrompts();
}

function renderSelectorBack() {
  selectorBackZone = { x: W*0.035, y: H*0.035, w: W*0.22, h: H*0.065 };
  const b=selectorBackZone;
  roundedRectPath(ctx,b.x,b.y,b.w,b.h,12);
  ctx.fillStyle="#20232BCC"; ctx.fill(); ctx.strokeStyle="#fff"; ctx.lineWidth=2; ctx.stroke();
  ctx.fillStyle="#fff"; ctx.font="bold 16px Arial, sans-serif";
  ctx.fillText("‹ BACK",b.x+b.w/2,b.y+b.h/2);
}

function renderBattleSelect() {
  ctx.clearRect(0,0,W,H); ctx.fillStyle="#C88A4A"; ctx.fillRect(0,0,W,H);
  if(sceneReady){ctx.save();ctx.globalAlpha=0.3;ctx.drawImage(sceneImage,coverX,coverY,coverW,coverH);ctx.restore();}
  const t=TERMINALS[selectedTerminal];
  ctx.save();ctx.textAlign="center";ctx.textBaseline="middle";ctx.lineWidth=5;ctx.strokeStyle="#000";ctx.fillStyle="#FFD700";ctx.font='bold 33px "Arial Black", Arial, sans-serif';
  ctx.strokeText(t.name,W/2,H*0.15);ctx.fillText(t.name,W/2,H*0.15);
  ctx.font="bold 17px Arial, sans-serif";ctx.fillStyle="#fff";ctx.fillText("CHOOSE YOUR BATTLE",W/2,H*0.21);
  battleZones=[];
  const size=Math.min(W*0.23,H*0.115), gapX=W*0.28,gapY=H*0.14;
  for(let i=0;i<15;i++){
    const col=i%3,row=Math.floor(i/3),x=W/2+(col-1)*gapX-size/2,y=H*0.26+row*gapY;
    const z={x,y,w:size,h:size};battleZones.push(z);
    roundedRectPath(ctx,x,y,size,size,13);ctx.fillStyle=["#FF1493","#FF8C00","#00A86B"][col];ctx.fill();ctx.strokeStyle="#fff";ctx.lineWidth=2;ctx.stroke();
    ctx.fillStyle="#fff";ctx.font='bold 24px "Arial Black", Arial, sans-serif';ctx.fillText(String(t.from+i),x+size/2,y+size/2);
  }
  ctx.fillStyle="#fff";ctx.font="bold 13px Arial, sans-serif";ctx.fillText("ALL 15 BATTLES UNLOCKED",W/2,H*0.97,W*0.95);
  renderSelectorBack();
  ctx.restore();
}

function renderLevelSelect() {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#C88A4A"; ctx.fillRect(0, 0, W, H);
  if (sceneReady) { ctx.save(); ctx.globalAlpha = 0.30; ctx.drawImage(sceneImage, coverX, coverY, coverW, coverH); ctx.restore(); }
  ctx.save(); ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = 'bold 34px "Arial Black", Arial, sans-serif'; ctx.lineWidth = 5; ctx.strokeStyle = "#000"; ctx.fillStyle = "#FFD700";
  ctx.strokeText("CHOOSE YOUR SKY", W*0.5, H*0.10); ctx.fillText("CHOOSE YOUR SKY", W*0.5, H*0.10);
  ctx.font = "bold 15px Arial, sans-serif"; ctx.fillStyle = "#fff"; ctx.fillText("7 TERMINALS • 15 BATTLES EACH", W*0.5, H*0.145);
  terminalZones = [];
  const startY=H*0.19, gap=H*0.095, boxW=W*0.82, boxH=Math.min(62,H*0.075);
  for(let i=0;i<TERMINALS.length;i++){
    const t=TERMINALS[i], z={x:(W-boxW)/2,y:startY+i*gap,w:boxW,h:boxH}; terminalZones.push(z);
    roundedRectPath(ctx,z.x,z.y,z.w,z.h,16);
    const g=ctx.createLinearGradient(z.x,z.y,z.x+z.w,z.y); g.addColorStop(0,"rgba(255,20,147,0.92)"); g.addColorStop(1,"rgba(255,122,0,0.92)");
    ctx.fillStyle=g; ctx.fill(); ctx.strokeStyle="#fff"; ctx.lineWidth=2; ctx.stroke();
    ctx.fillStyle="#fff"; ctx.font='bold 20px "Arial Black", Arial, sans-serif'; ctx.fillText((i+1)+". "+t.name, W*0.5, z.y+z.h*0.38);
    ctx.font="bold 12px Arial, sans-serif"; ctx.fillText("LEVELS "+t.from+"–"+t.to, W*0.5, z.y+z.h*0.72);
  }
  ctx.font="bold 13px Arial, sans-serif"; ctx.fillStyle="#fff"; ctx.fillText("TAP A TERMINAL TO ENTER",W*0.5,H*0.91,W*0.92);
  renderSelectorBack();
  ctx.restore();
}

function renderHome() {
  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = "#C88A4A";
  ctx.fillRect(0, 0, W, H);

  if (sceneReady) {
    ctx.save();
    ctx.globalAlpha = 0.55;

    ctx.drawImage(
      sceneImage,
      coverX,
      coverY,
      coverW,
      coverH
    );

    ctx.restore();
  }

  ctx.save();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.font = 'bold 72px "Arial Black", Arial, sans-serif';
  ctx.lineWidth = 8;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#000000";
  ctx.fillStyle = "#FFD700";

  ctx.strokeText(
    "PATANG",
    W * 0.5,
    H * 0.35,
    W * 0.92
  );

  ctx.fillText(
    "PATANG",
    W * 0.5,
    H * 0.35,
    W * 0.92
  );

  ctx.font = "bold 28px Arial, sans-serif";
  ctx.lineWidth = 3;
  ctx.fillStyle = "#FFFAEB";

  ctx.strokeText(
    "A Kite Fight",
    W * 0.5,
    H * 0.42,
    W * 0.9
  );

  ctx.fillText(
    "A Kite Fight",
    W * 0.5,
    H * 0.42,
    W * 0.9
  );

  const p = homePlayZone;

  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 6;

  roundedRectPath(
    ctx,
    p.x,
    p.y,
    p.w,
    p.h,
    18
  );

  ctx.fillStyle = "#FF1493";
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = "#FFFFFF";
  ctx.font = 'bold 32px "Arial Black", Arial, sans-serif';

  ctx.fillText(
    "PLAY",
    W * 0.5,
    p.y + p.h * 0.52
  );

  // Colorful all-levels selector, inspired by a level-map/home control.
  const l = homeLevelsZone;
  roundedRectPath(ctx, l.x, l.y, l.w, l.h, 16);
  const levelGradient = ctx.createLinearGradient(l.x, l.y, l.x + l.w, l.y);
  levelGradient.addColorStop(0, "#FF7A00");
  levelGradient.addColorStop(0.5, "#FFD700");
  levelGradient.addColorStop(1, "#00A86B");
  ctx.fillStyle = levelGradient;
  ctx.fill();
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "#18202A";
  ctx.font = 'bold 19px "Arial Black", Arial, sans-serif';
  ctx.fillText("105 LEVELS • ALL UNLOCKED", W * 0.5, l.y + l.h * 0.50, l.w * 0.92);

  ctx.font = "bold 15px Arial, sans-serif";
  ctx.fillStyle = "#FFFFFF";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(0,0,0,0.7)";

  const instruction = "DHEEL to release · KHENCH to pull · win the clash";

  ctx.strokeText(
    instruction,
    W * 0.5,
    H * 0.74,
    W * 0.94
  );

  ctx.fillText(
    instruction,
    W * 0.5,
    H * 0.74,
    W * 0.94
  );

  ctx.restore();
}

function renderScene() {
  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = "#C88A4A";
  ctx.fillRect(0, 0, W, H);

  if (sceneReady) {
    ctx.drawImage(
      sceneImage,
      coverX,
      coverY,
      coverW,
      coverH
    );
  }
}

function renderStrings() {
  ctx.save();

  ctx.lineCap = "round";

  // Player's string. Keep it single dark line so no white thread
  // appears over the middle boy's right shoulder.

  ctx.beginPath();
  ctx.moveTo(boyHandX, boyHandY);
  ctx.lineTo(player.x, player.y);

  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // AI's string extends toward the lower-right corner.

  ctx.beginPath();
  ctx.moveTo(ai.x, ai.y);
  ctx.lineTo(W, H);

  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();
}

function renderKites() {
  drawKite(ai, false);
  drawKite(player, true);
}

function drawKite(kite, isPlayer) {
  const x = kite.x;
  const y = kite.y;
  const s = kite.size;

  ctx.save();

  if (isPlayer) {
    // Radial magenta glow extending beyond the diamond.

    const glowRadius = s * 0.5 + 20;

    const glow = ctx.createRadialGradient(
      x,
      y,
      s * 0.15,
      x,
      y,
      glowRadius
    );

    glow.addColorStop(0, "rgba(255,20,147,0.48)");
    glow.addColorStop(0.55, "rgba(255,20,147,0.25)");
    glow.addColorStop(1, "rgba(255,20,147,0)");

    ctx.fillStyle = glow;

    ctx.fillRect(
      x - glowRadius,
      y - glowRadius,
      glowRadius * 2,
      glowRadius * 2
    );
  }

  // Main diamond.

  ctx.beginPath();

  ctx.moveTo(x, y - s * 0.58);
  ctx.lineTo(x + s * 0.50, y);
  ctx.lineTo(x, y + s * 0.58);
  ctx.lineTo(x - s * 0.50, y);

  ctx.closePath();

  ctx.fillStyle = isPlayer
    ? "#FF1493"
    : "#7B2FBE";

  ctx.fill();

  ctx.strokeStyle = isPlayer
    ? "#FFFFFF"
    : "#4CAF50";

  ctx.lineWidth = isPlayer ? 3 : 2;
  ctx.lineJoin = "round";
  ctx.stroke();

  // Paper folds and bamboo cross-spars.

  ctx.beginPath();
  ctx.moveTo(x, y - s * 0.58);
  ctx.lineTo(x, y + s * 0.58);

  ctx.moveTo(x - s * 0.50, y);
  ctx.lineTo(x + s * 0.50, y);

  ctx.strokeStyle = isPlayer
    ? "rgba(255,255,255,0.60)"
    : "rgba(255,255,255,0.35)";

  ctx.lineWidth = 1;
  ctx.stroke();

  // Short fluttering tail.

  const flutter =
    Math.sin(sineAccumulator * 7 + (isPlayer ? 0 : 2)) *
    s * 0.09;

  ctx.beginPath();

  ctx.moveTo(x, y + s * 0.58);

  ctx.quadraticCurveTo(
    x + flutter,
    y + s * 0.78,
    x - flutter * 0.5,
    y + s * 0.98
  );

  ctx.strokeStyle = isPlayer
    ? "#FFFFFF"
    : "#4CAF50";

  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}

function renderHUD() {
  const pillY = 0.02 * H;
  const pillH = 0.06 * H;

  drawPill(
    0.035 * W,
    pillY,
    0.22 * W,
    pillH,
    "LVL " + level + "/" + MAX_LEVEL,
    "#FF1493",
    "#FFFFFF"
  );

  const seconds = Math.max(
    0,
    Math.ceil(levelTimeLeft)
  );

  const minutesText = String(
    Math.floor(seconds / 60)
  ).padStart(2, "0");

  const secondsText = String(
    seconds % 60
  ).padStart(2, "0");

  const timerText =
    minutesText + ":" + secondsText;

  drawPill(
    W * 0.5 - 55,
    pillY,
    110,
    pillH,
    timerText,
    seconds <= 10 ? "#D32F2F" : "#222222",
    "#FFFFFF"
  );

  drawPill(
    0.86 * W,
    pillY,
    0.10 * W,
    pillH,
    paused ? "▶" : "Ⅱ",
    "#222222",
    "#FFFFFF"
  );
}

function drawPill(x, y, w, h, label, fillColor, textColor) {
  ctx.save();

  roundedRectPath(
    ctx,
    x,
    y,
    w,
    h,
    Math.min(14, h * 0.35)
  );

  ctx.fillStyle = fillColor;
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.88)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = textColor;

  ctx.font =
    'bold ' +
    Math.max(12, Math.min(19, h * 0.44)) +
    'px "Arial Black", Arial, sans-serif';

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillText(
    label,
    x + w * 0.5,
    y + h * 0.53,
    w * 0.91
  );

  ctx.restore();
}

function renderMANJA() {
  const x = 0.05 * W;
  const y = 0.105 * H;

  const barX = 0.35 * W;
  const barY = y - 1;
  const barW = 0.50 * W;
  const barH = Math.max(13, 0.024 * H);

  ctx.save();

  ctx.font = 'bold 18px "Arial Black", Arial, sans-serif';
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.lineJoin = "round";

  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.fillStyle = "#FFFFFF";

  ctx.strokeText(
    "MANJA",
    x,
    barY + barH * 0.5
  );

  ctx.fillText(
    "MANJA",
    x,
    barY + barH * 0.5
  );

  roundedRectPath(
    ctx,
    barX,
    barY,
    barW,
    barH,
    barH / 2
  );

  ctx.fillStyle = "rgba(0,0,0,0.72)";
  ctx.fill();

  const gradient = ctx.createLinearGradient(
    barX,
    barY,
    barX + barW,
    barY
  );

  gradient.addColorStop(0, "#FFE44D");
  gradient.addColorStop(0.5, "#FF9820");
  gradient.addColorStop(1, "#F12D28");

  const fillW = barW * manja;

  if (fillW > 0) {
    roundedRectPath(
      ctx,
      barX,
      barY,
      fillW,
      barH,
      Math.min(barH / 2, fillW / 2)
    );

    ctx.fillStyle = gradient;
    ctx.fill();
  }

  roundedRectPath(
    ctx,
    barX,
    barY,
    barW,
    barH,
    barH / 2
  );

  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}

function renderButtons() {
  const y = 0.86 * H;
  const h = 0.10 * H;

  drawButton(
    0.05 * W,
    y,
    0.40 * W,
    h,
    "#2196F3",
    "up",
    "DHEEL"
  );

  drawButton(
    0.55 * W,
    y,
    0.40 * W,
    h,
    "#E53935",
    "down",
    "KHENCH"
  );
}

function drawButton(x, y, w, h, color, direction, label) {
  ctx.save();

  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 9;
  ctx.shadowOffsetY = 4;

  roundedRectPath(
    ctx,
    x,
    y,
    w,
    h,
    Math.min(18, h * 0.22)
  );

  ctx.fillStyle = color;
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw the arrow using simple canvas geometry.

  const arrowX = x + w * 0.19;
  const arrowY = y + h * 0.5;

  const arrowSize = Math.min(
    18,
    h * 0.25,
    w * 0.12
  );

  ctx.beginPath();

  if (direction === "up") {
    ctx.moveTo(
      arrowX,
      arrowY - arrowSize
    );

    ctx.lineTo(
      arrowX - arrowSize,
      arrowY + arrowSize * 0.4
    );

    ctx.lineTo(
      arrowX - arrowSize * 0.35,
      arrowY + arrowSize * 0.4
    );

    ctx.lineTo(
      arrowX - arrowSize * 0.35,
      arrowY + arrowSize
    );

    ctx.lineTo(
      arrowX + arrowSize * 0.35,
      arrowY + arrowSize
    );

    ctx.lineTo(
      arrowX + arrowSize * 0.35,
      arrowY + arrowSize * 0.4
    );

    ctx.lineTo(
      arrowX + arrowSize,
      arrowY + arrowSize * 0.4
    );
  } else {
    ctx.moveTo(
      arrowX,
      arrowY + arrowSize
    );

    ctx.lineTo(
      arrowX - arrowSize,
      arrowY - arrowSize * 0.4
    );

    ctx.lineTo(
      arrowX - arrowSize * 0.35,
      arrowY - arrowSize * 0.4
    );

    ctx.lineTo(
      arrowX - arrowSize * 0.35,
      arrowY - arrowSize
    );

    ctx.lineTo(
      arrowX + arrowSize * 0.35,
      arrowY - arrowSize
    );

    ctx.lineTo(
      arrowX + arrowSize * 0.35,
      arrowY - arrowSize * 0.4
    );

    ctx.lineTo(
      arrowX + arrowSize,
      arrowY - arrowSize * 0.4
    );
  }

  ctx.closePath();

  ctx.fillStyle = "#FFFFFF";
  ctx.fill();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.font =
    'bold ' +
    Math.min(25, Math.max(17, h * 0.34)) +
    'px "Arial Black", Arial, sans-serif';

  ctx.fillStyle = "#FFFFFF";

  ctx.fillText(
    label,
    x + w * 0.61,
    y + h * 0.53,
    w * 0.62
  );

  ctx.restore();
}

function renderLevelClearBumper() {
  ctx.save();

  ctx.fillStyle = "rgba(0,0,0,0.48)";
  ctx.fillRect(0, 0, W, H);

  const panelX = W * 0.08;
  const panelY = H * 0.36;
  const panelW = W * 0.84;
  const panelH = H * 0.23;

  roundedRectPath(
    ctx,
    panelX,
    panelY,
    panelW,
    panelH,
    20
  );

  ctx.fillStyle = "rgba(0,55,17,0.90)";
  ctx.fill();

  ctx.strokeStyle = "#00FF00";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";

  ctx.font =
    'bold ' +
    Math.min(37, W * 0.088) +
    'px "Arial Black", Arial, sans-serif';

  ctx.lineWidth = 4;
  ctx.strokeStyle = "#000000";
  ctx.fillStyle = "#00FF00";

  ctx.strokeText(
    "LEVEL CLEAR!",
    W * 0.5,
    panelY + panelH * 0.43,
    panelW * 0.93
  );

  ctx.fillText(
    "LEVEL CLEAR!",
    W * 0.5,
    panelY + panelH * 0.43,
    panelW * 0.93
  );

  ctx.font = "bold 17px Arial, sans-serif";
  ctx.fillStyle = "#FFFFFF";

  ctx.fillText(
    "NEXT LEVEL " + (level + 1),
    W * 0.5,
    panelY + panelH * 0.73
  );

  ctx.restore();
}

function renderLevelFailBumper() {
  ctx.save();

  ctx.fillStyle = "rgba(0,0,0,0.52)";
  ctx.fillRect(0, 0, W, H);

  const panelX = W * 0.08;
  const panelY = H * 0.36;
  const panelW = W * 0.84;
  const panelH = H * 0.23;

  roundedRectPath(
    ctx,
    panelX,
    panelY,
    panelW,
    panelH,
    20
  );

  ctx.fillStyle = "rgba(92,0,20,0.92)";
  ctx.fill();

  ctx.strokeStyle = "#FF1744";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";

  ctx.font =
    'bold ' +
    Math.min(39, W * 0.095) +
    'px "Arial Black", Arial, sans-serif';

  ctx.lineWidth = 4;
  ctx.strokeStyle = "#000000";
  ctx.fillStyle = "#FF1744";

  ctx.strokeText(
    failReason,
    W * 0.5,
    panelY + panelH * 0.43,
    panelW * 0.93
  );

  ctx.fillText(
    failReason,
    W * 0.5,
    panelY + panelH * 0.43,
    panelW * 0.93
  );

  ctx.font = "bold 17px Arial, sans-serif";
  ctx.fillStyle = "#FFFFFF";

  ctx.fillText(
    "RETRY LEVEL " + level,
    W * 0.5,
    panelY + panelH * 0.73
  );

  ctx.restore();
}

function renderDebugLine() {
  ctx.save();

  ctx.globalAlpha = 0.7;
  ctx.fillStyle = "#000000";

  ctx.fillRect(
    0,
    0,
    W * 0.95,
    30
  );

  ctx.globalAlpha = 1;

  ctx.font = "12px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#00FF00";

  const debugText =
    "state:" + gameState +
    " f:" + frameCount +
    " t:" + levelTimeLeft.toFixed(1) +
    " dt:" + lastDt.toFixed(3) +
    " m:" + manja.toFixed(2) +
    " p:" +
      Math.round(player.x) +
      "," +
      Math.round(player.y) +
    " a:" +
      Math.round(ai.x) +
      "," +
      Math.round(ai.y);

  ctx.fillText(
    debugText,
    5,
    15,
    Math.max(1, W * 0.95 - 10)
  );

  ctx.restore();
}

function renderPrompts() {
  if (promptQueue.length === 0) return;

  const prompt = promptQueue[promptQueue.length - 1];

  if (!prompt || prompt.timeLeft <= 0) return;

  const fadeDuration = Math.min(
    0.35,
    prompt.duration
  );

  const alpha = Math.max(
    0,
    Math.min(
      1,
      prompt.timeLeft / fadeDuration
    )
  );

  ctx.save();

  ctx.globalAlpha = alpha;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";

  ctx.font =
    'bold 34px "Arial Black", Arial, sans-serif';

  ctx.lineWidth = 5;
  ctx.strokeStyle = "#000000";
  ctx.fillStyle = prompt.color;

  ctx.strokeText(
    prompt.text,
    W * 0.5,
    H * 0.20,
    W * 0.94
  );

  ctx.fillText(
    prompt.text,
    W * 0.5,
    H * 0.20,
    W * 0.94
  );

  ctx.restore();
}

// ============================================================
// 11. PROMPT HELPERS
// ============================================================

function pushPrompt(text, color, duration) {
  const safeDuration = Math.max(
    0.05,
    duration || 1
  );

  promptQueue.push({
    text: String(text),
    color: color || "#FFFFFF",
    duration: safeDuration,
    timeLeft: safeDuration
  });

  // Avoid an indefinitely growing prompt history.

  if (promptQueue.length > 12) {
    promptQueue.shift();
  }
}

function updatePrompts(dt) {
  for (let i = promptQueue.length - 1; i >= 0; i--) {
    promptQueue[i].timeLeft -= dt;

    if (promptQueue[i].timeLeft <= 0) {
      promptQueue.splice(i, 1);
    }
  }
}

// ============================================================
// 12. BOOTSTRAP
// ============================================================

function init() {
  if (initialized) return;

  initialized = true;

  document.body.style.margin = "0";
  document.body.style.padding = "0";
  document.body.style.overflow = "hidden";

  canvas =
    document.getElementById("gameCanvas") ||
    document.querySelector("canvas");

  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.id = "gameCanvas";
    document.body.appendChild(canvas);
  }

  canvas.style.position = "fixed";
  canvas.style.left = "0";
  canvas.style.top = "0";
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  canvas.style.display = "block";
  canvas.style.touchAction = "none";
  canvas.style.userSelect = "none";

  ctx = canvas.getContext("2d");

  recomputeLayout();

  resetLevel(1);
  transitionState("home");

  canvas.addEventListener(
    "pointerdown",
    handlePointerDown,
    { passive: false }
  );

  window.addEventListener(
    "resize",
    recomputeLayout
  );

  // Load the background asynchronously.
  // The animation loop does not depend on image completion.

  sceneImage = new Image();

  sceneImage.onload = function () {
    sceneReady = true;
    computeCoverRect();
  };

  sceneImage.onerror = function () {
    sceneReady = false;
    console.warn(
      "PATANG: scene.png unavailable; using fallback background."
    );
  };

  sceneImage.src = "public/assets/scene.png";

  lastTime = performance.now();
}

window.addEventListener(
  "load",
  init,
  { once: true }
);

// ============================================================
// 13. MAIN ANIMATION LOOP
// ============================================================

function gameLoop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);

  lastTime = now;

  lastDt = Number.isFinite(dt)
    ? Math.max(0, dt)
    : 0;

  frameCount++;

  try {
    update(lastDt);
    render();
  } catch (error) {
    console.error(
      "PATANG v6.0 frame error:",
      error
    );
  }

  // Deliberately outside try/catch.
  // A failed update or render cannot terminate the RAF loop.

  requestAnimationFrame(gameLoop);
}

// ============================================================
// 14. START RAF ON WINDOW LOAD
// ============================================================

// Start immediately after init when the page is already loaded.
// Otherwise, start on the load event, without waiting for scene.png.

if (document.readyState === "complete") {
  init();
  requestAnimationFrame(gameLoop);
} else {
  window.addEventListener(
    "load",
    function startGameLoop() {
      requestAnimationFrame(gameLoop);
    },
    { once: true }
  );
}
