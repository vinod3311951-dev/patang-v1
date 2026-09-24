# INDIA FRAME — SHARED BASE FOR FOUR GAMES

## The Four Games
1. Patang (kite fighting) — 10 working hours — V1 in progress
2. Gilli Danda (traditional Indian stick game) — 10 working hours — not started
3. Kanchey (marbles) — 10 working hours — not started
4. Hide & Seek — 10 working hours — not started

## Shared Assets (built once, reused by all four)
- India Frame scene library (canvas-rendered layered backgrounds)
- Player character (young Indian boy, canvas-drawn, with pose system)
- AI opponent character (silhouette, appears on distant rooftop or in scene)
- Ambient sound library (oscillator-synthesized street sounds)
- Kite-shaped UI chrome (buttons, modals)
- Colour palette (manjha white, mango gold #ffd65a, indigo #5c6cff, kumkum red #ff5364, jade green #42d887)
- localStorage schema pattern (one key per game)

## Scenes (built on demand — each game reuses what exists)
- V1: Rooftop Terrace at Golden Hour (built for Patang)
- V2: Bazaar Sky, River Breeze, Festival City, Fort Horizon, Mountain Calm (later)

## Player Character Poses
Same character body. Different props and poses per game:
- Patang: "kite" pose — chest-up, standing on rooftop, holding charkhi spool
- Gilli Danda: "throw" and "crouch" poses — full body on ground, holding stick
- Kanchey: "crouch" pose — on ground, flicking marble
- Hide & Seek: "run" and "hide" poses — moving through scene

## AI Opponent
A single silhouette character reused across all four games.
- Patang: rival kite flyer on distant rooftop
- Gilli Danda: rival player in the field
- Kanchey: rival marble player across the pitch
- Hide & Seek: the seeker

## Voice Lines
Only Patang uses voice lines. The other three games use in-world sounds only.
- Patang: Khench, Dheel, Woh kaata!, Meri patang gai, Sara maanja gaya, Kat gae
- Gilli Danda: no voice — wood hitting wood only
- Kanchey: no voice — glass on glass, click, roll
- Hide & Seek: no voice — canvas text only (Time to hide, Seen, Found)

## Ambient Sound Library (shared)
Birds, broom scrape, traffic hum, cow moo, monkey, temple bell, distant laughter, wood chop, water splash. All oscillator-synthesized. All scheduled by the game loop. All gated by the mute button.

## Rules (from Color Dominion, inherited)
1. No DOM overlays over the canvas during play
2. No service worker, no manifest
3. No setTimeout / setInterval for visual state
4. Readable code, every function on its own line, comment above each
5. Whole files only, no minification

## What Each New Game Inherits
- Reuses India Frame scenes
- Reuses player character with new pose
- Reuses AI opponent
- Reuses ambient sound library
- Reuses kite-shaped UI
- Reuses colour palette
- Reuses rules above
- Adds only: its own gameplay mechanic, its own voice/text strategy, its own save key

## What Is NOT Shared
- Gameplay logic
- Level progression formula
- Score system
- Save data (each game has its own localStorage key: patang, gilli-danda, kanchey, hide-and-seek)
