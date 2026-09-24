
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
let levelTimeLeft = 60;

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
  huntTimer: 8,
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
let homePlayZone = null;

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

  audioWater = new Audio("/assets/water.mp3");
  audioWater.volume = 0.20;
  audioWater.loop = true;
  audioWater.preload = "auto";

  audioSparrow = new Audio("/assets/sparrow.mp3");
  audioSparrow.volume = 0.24;
  audioSparrow.preload = "auto";

  audioCrow = new Audio("/assets/crow.mp3");
  audioCrow.volume = 0.22;
  audioCrow.preload = "auto";

  audioPluck = new Audio("/assets/pluck.mp3");
  audioPluck.volume = 0.48;
  audioPluck.preload = "auto";

  audioDheel = new Audio("/assets/pluck.mp3");
  audioDheel.volume = 0.28;
  audioDheel.playbackRate = 1.30;
  audioDheel.preload = "auto";

  audioKhench = new Audio("/assets/pluck.mp3");
  audioKhench.volume = 0.28;
  audioKhench.playbackRate = 0.80;
  audioKhench.preload = "auto";

  audioKatGai = new Audio("/assets/pluck.mp3");
  audioKatGai.volume = 0.35;
  audioKatGai.playbackRate = 1.60;
  audioKatGai.preload = "auto";

  audioManjaGaya = new Audio("/assets/pluck.mp3");
  audioManjaGaya.volume = 0.30;
  audioManjaGaya.playbackRate = 0.55;
  audioManjaGaya.preload = "auto";

  aiSparrowTimer = 4 + Math.random() * 5;
  aiCrowTimer = 12 + Math.random() * 13;

  try {
    audioWater.play().catch(() => {});
  } catch (e) {
    console.warn("Water audio unavailable:", e);
  }
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

  aiSparrowTimer -= dt;
  aiCrowTimer -= dt;

  if (aiSparrowTimer <= 0) {
    if (audioSparrow) {
      try {
        audioSparrow.currentTime = 0;
        audioSparrow.play().catch(() => {});
      } catch (e) {
        // Ambient audio is optional.
      }
    }

    aiSparrowTimer = 4 + Math.random() * 5;
  }

  if (aiCrowTimer <= 0) {
    if (audioCrow) {
      try {
        audioCrow.currentTime = 0;
        audioCrow.play().catch(() => {});
      } catch (e) {
        // Ambient audio is optional.
      }
    }

    aiCrowTimer = 12 + Math.random() * 13;
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

  homePlayZone = {
    x: 0.5 * W - 110,
    y: 0.60 * H - 35,
    w: 220,
    h: 70
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

  if (gameState === "home") {
    if (inZone(x, y, homePlayZone)) {
      resetLevel(1);
      transitionState("playing");
      pushPrompt("FLY YOUR KITE!", "#FFFAEB", 1.5);
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

  if (paused) return;

  if (inZone(x, y, dheelZone)) {
    player.vy = -200;

    manja = Math.min(1, manja + 0.10);

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
    player.vy = 200;

    manja = Math.max(0, manja - 0.05);

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
    "levelFail"
  ];

  if (!validStates.includes(nextState)) return;

  gameState = nextState;
}

function resetLevel(n) {
  level = n;

  levelTimeLeft = Math.max(30, 62 - n * 2);

  player.x = 0.62 * W;
  player.y = 0.30 * H;
  player.vx = 0;
  player.vy = 0;

  ai.x = 0.22 * W;
  ai.y = 0.22 * H;
  ai.vx = 0;
  ai.vy = 0;

  ai.huntTimer = 8.0;
  ai.retreatTimer = 0;

  manja = 0.3;

  spawnGrace = 2.0;
  stateTimer = 0;

  aiWasCut = false;
  playerCut = false;

  scheduledClearPluckAt = -1;
  failReason = "LEVEL FAIL";

  promptQueue = [];

  paused = false;

  if (audioWater && audioInitialized) {
    try {
      if (audioWater.paused) {
        audioWater.play().catch(() => {});
      }
    } catch (e) {
      // Gameplay does not depend on background audio.
    }
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
    try {
      audioKatGai.currentTime = 0;
      audioKatGai.play().catch(() => {});
    } catch (e) {
      // Optional cut sound.
    }
  }
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
  player.vx = 70 * Math.sin(sineAccumulator * 0.7);

  player.vy *= Math.pow(0.94, dt * 60);

  player.x += player.vx * dt;
  player.y += player.vy * dt;

  player.x = Math.max(
    0.15 * W,
    Math.min(0.88 * W, player.x)
  );

  player.y = Math.max(
    0.14 * H,
    Math.min(0.48 * H, player.y)
  );

  if (
    (player.y <= 0.14 * H && player.vy < 0) ||
    (player.y >= 0.48 * H && player.vy > 0)
  ) {
    player.vy = 0;
  }
}

function updateAIPhysics(dt) {
  if (ai.huntTimer > 0) {
    ai.huntTimer = Math.max(0, ai.huntTimer - dt);

    ai.vx =
      40 * Math.sin(sineAccumulator * 0.85 + 0.8);

    ai.vy =
      20 * Math.sin(sineAccumulator * 1.15 + 0.5);
  } else {
    const dx = player.x - ai.x;
    const dy = player.y - ai.y;

    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 0.001) {
      ai.vx = dx / distance * 55;
      ai.vy = dy / distance * 55;
    } else {
      ai.vx = 0;
      ai.vy = 0;
    }

    const speed = Math.sqrt(
      ai.vx * ai.vx + ai.vy * ai.vy
    );

    if (speed > 70) {
      ai.vx = ai.vx / speed * 70;
      ai.vy = ai.vy / speed * 70;
    }
  }

  ai.x += ai.vx * dt;
  ai.y += ai.vy * dt;

  if (ai.x < 0.10 * W) {
    ai.x = 0.10 * W;
    ai.vx = Math.abs(ai.vx);
  }

  if (ai.x > 0.88 * W) {
    ai.x = 0.88 * W;
    ai.vx = -Math.abs(ai.vx);
  }

  if (ai.y < 0.10 * H) {
    ai.y = 0.10 * H;
    ai.vy = Math.abs(ai.vy);
  }

  if (ai.y > 0.55 * H) {
    ai.y = 0.55 * H;
    ai.vy = -Math.abs(ai.vy);
  }
}

function updateManja(dt) {
  if (player.y < 0.28 * H) {
    manja += 0.35 * dt;
  } else if (player.y > 0.42 * H) {
    manja -= 0.25 * dt;
  } else {
    manja -= 0.05 * dt;
  }

  manja = Math.max(0, Math.min(1, manja));
}

// ============================================================
// 8. STRING-CROSSING AND CUT DETECTION
// ============================================================

function checkStringCrossing() {
  if (gameState !== "playing") return;

  if (spawnGrace > 0) return;

  const dx = player.x - ai.x;
  const dy = player.y - ai.y;

  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > 0.35 * W) return;

  const crossing = segmentsIntersect(
    boyHandX,
    boyHandY,
    player.x,
    player.y,
    ai.x,
    ai.y,
    W,
    H
  );

  if (!crossing) return;

  const stringDX = player.x - boyHandX;
  const stringDY = player.y - boyHandY;

  const playerStrLen = Math.sqrt(
    stringDX * stringDX +
    stringDY * stringDY
  );

  if (playerStrLen < 0.15 * H) return;

  const aiSharp = Math.min(
    0.85,
    0.30 + (level - 1) * 0.04
  );

  if (manja > aiSharp + 0.08) {
    cutAI();
    beginKatching("ai");
    return;
  }

  if (manja < aiSharp - 0.08) {
    cutPlayer();
    beginKatching("player");
    return;
  }

  // Similar string sharpness: brushing without a cut.

  if (timeAccumulator - lastPluckTime >= 0.45) {
    playPluck(1.0);
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
    beginLevelFail("TIME OUT");
    return;
  }

  updatePlayerPhysics(dt);
  updateAIPhysics(dt);
  updateManja(dt);

  if (spawnGrace > 0) {
    spawnGrace = Math.max(0, spawnGrace - dt);
    return;
  }

  checkStringCrossing();
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
    resetLevel(level + 1);
    transitionState("playing");

    pushPrompt(
      "LEVEL " + level,
      "#FFD700",
      1.2
    );
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
    renderDebugLine();
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
    ctx.fillText(
      "Tap the pause button to resume",
      W * 0.5,
      H * 0.50,
      W * 0.9
    );

    ctx.restore();
  }

  renderPrompts();

  // Always the final visual layer.
  renderDebugLine();
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

  ctx.font = "bold 16px Arial, sans-serif";
  ctx.fillStyle = "#FFFFFF";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(0,0,0,0.7)";

  const instruction = "DHEEL to climb · KHENCH to dive";

  ctx.strokeText(
    instruction,
    W * 0.5,
    H * 0.68,
    W * 0.94
  );

  ctx.fillText(
    instruction,
    W * 0.5,
    H * 0.68,
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

  // Warm-white highlight beneath the player's black string.

  ctx.beginPath();
  ctx.moveTo(boyHandX, boyHandY);
  ctx.lineTo(player.x, player.y);

  ctx.strokeStyle = "rgba(255,250,235,0.95)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Player's string.

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
    "LVL " + level,
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

  sceneImage.src = "/assets/scene.png";

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
