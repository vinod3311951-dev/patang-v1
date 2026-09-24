# INDIA FRAME — SHARED BASE FOR FOUR GAMES

## The Four Games
1. Patang (kite fighting)
2. Gilli Danda (traditional Indian stick game)
3. Kanchey (marbles)
4. Hide & Seek

## Shared Scene

The India Frame base world is a single hand-painted village scene at golden hour, saved at `public/assets/scene.png` (per game repo). All four games — Patang, Gilli Danda, Kanchey, Hide & Seek — take place in this same village. Each game stages its action in a different region of the same scene:

- Patang: three children on the dirt path in the foreground, kites fly in the open sky above the horizon
- Gilli Danda: an open paddy field area in the midground, kids with a gilli and danda
- Kanchey: a dirt patch near the left-side house, kids crouched in a circle
- Hide & Seek: children scatter between the huts, palms, and rice field edges

Each game draws its own interactive elements (kites, gilli, marbles, running figures) in code on top of the shared `scene.png`. No game-specific background images. Every game repo carries its own copy of `scene.png` so it can be swapped or refined independently if needed.

## Shared Assets
- Single hand-painted village scene
- Canvas-drawn interactive game elements
- Ambient sound library
- Shared UI language and colour palette
- One localStorage key per game

## Ambient Sound Library
Birds, traffic, village calls, distant children, wind, and temple bell. Procedural sounds are scheduled by each game's RAF loop.

## Rules
1. No DOM overlays over the canvas during play
2. No service worker, no manifest
3. No setTimeout / setInterval for visual state
4. Readable code, every function on its own line, comment above each
5. Whole files only, no minification

## What Is NOT Shared
- Gameplay logic
- Level progression formula
- Score system
- Save data
