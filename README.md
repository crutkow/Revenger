# Revenger

Space battle simulator — a top-down HTML5 game built with **TypeScript**, **Vite**, **Phaser** and **Pixi.js**.

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
```

| Script                      | Purpose                                         |
| --------------------------- | ----------------------------------------------- |
| `npm run dev`               | Vite dev server with HMR + in-browser TS errors |
| `npm run build`             | Typecheck, then production build into `dist/`   |
| `npm run preview`           | Serve the production build locally              |
| `npm run typecheck`         | `tsc --noEmit`                                  |
| `npm run lint` / `lint:fix` | ESLint (flat config, typescript-eslint)         |
| `npm run format`            | Prettier                                        |
| `npm test` / `test:watch`   | Vitest                                          |

## Controls

`W` / `↑` thrust · `A` `D` / `←` `→` rotate · `Space` fire · `G` show/hide the ship grids · `Esc` back to menu

## Gameplay rules

- **Borderless world.** Space has no edges. The ship spawns at world `(0, 0)`;
  the HUD shows its `X` / `Y` (Y up) and heading (`0°` = north, clockwise,
  `0–359`). A faint marker is drawn at the world centre.
- **Pinned camera.** The camera follows the ship and counter-rotates so the nose
  always points up the screen; the world appears to rotate. The ship sits below
  screen centre (`Gameplay.shipScreenY`).
- **Breaking asteroids.** Big → 2 medium → 2 small → nothing. Every hit scores.
  Split children may exceed `asteroidMaxCount`; only timed spawns respect it.
  Asteroids spawn on a ring outside the view and despawn when far away.
- **Scale.** The ship is drawn at full size (`spaceshipScale: 1`) and asteroids
  are scaled up (`asteroidScale: 2`). To see more of the world around a
  full-size ship, raise `Gameplay.viewHeight` (camera zoom = screen height /
  `viewHeight`).

## Architecture

Phaser and Pixi are both full renderers, so they are **not** mixed in one canvas.
Instead two canvases are stacked inside `#game-root`:

```
┌─ #game-root ──────────────────────────────────┐
│  <canvas> Pixi   — HUD / FX  (transparent,    │  pointer-events: none
│                    pointer-events: none)      │
│  <canvas> Phaser — game world, physics, input │  base layer
└───────────────────────────────────────────────┘
```

- **Phaser owns the clock.** Pixi is created with `autoStart: false` and
  rendered from Phaser's `POST_STEP` event, so exactly one world render and one
  HUD render happen per frame, in that order.
- **They never touch each other.** All communication goes through the typed
  `EventBus` (`src/core/EventBus.ts`), so either engine can be swapped out
  without rewriting game logic.
- **Resize is single-sourced.** Phaser's Scale Manager (`RESIZE` mode) is the
  authority; its `RESIZE` event drives `PixiOverlay.resize()`.

### Layout

```
src/
├─ main.ts               # boots Phaser + Pixi, wires the EventBus
├─ config/
│  ├─ constants.ts       # scene/texture keys, depths, palette, tuning values
│  └─ gameConfig.ts      # Phaser.Types.Core.GameConfig (arcade physics, no gravity)
├─ core/
│  ├─ EventBus.ts        # typed cross-engine messaging
│  └─ Registry.ts        # typed global state + localStorage high score
├─ scenes/
│  ├─ BootScene.ts       # engine setup, focus/blur pause
│  ├─ PreloadScene.ts    # loading bar + atlas loading
│  ├─ MainMenuScene.ts   # title screen
│  └─ BattleScene.ts     # gameplay: world, pinned camera, bullets, asteroids, scoring
├─ entities/
│  ├─ Spaceship.ts       # player: blueprint-built container, inertia, steering, shields
│  ├─ Ship.ts            # legacy single-sprite ship (only TurnDirection is used)
│  └─ Bullet.ts          # pooled Arcade.Image projectile
├─ pixi/
│  ├─ PixiOverlay.ts     # Pixi Application lifecycle + resize sync
│  └─ layers/HudLayer.ts # score, shields, FPS, ship position/heading, messages
└─ utils/
   ├─ math.ts            # engine-agnostic helpers (unit tested)
   └─ asteroids.ts       # asteroid split rules (unit tested)
```

### Ship grids

A blueprint (`public/assets/ships/spaceship_*.json`, types in
`src/spaceship/blueprintTypes.ts`) uses two grids of 16 px, the second offset by half a cell
from the cell centres (helpers in `src/spaceship/grid.ts`):

| Grid          | Points                                          | Used for                                |
| ------------- | ----------------------------------------------- | --------------------------------------- |
| **Cell grid** | cell `(x, y)` covers `x * 16 .. x * 16 + 16` px | platform, hull                          |
| **Node grid** | node `(x, y)` = corner of cell `(x, y)`         | crew, room items, doors (and the walls) |

Walls run along the lines between cells, so they pass through nodes. A room of 4x4 cells
(64 px, one platform tile) has **3x3 nodes** inside it; the middle one is the room centre.
Crew stands and walks only on these floor nodes. A door sits on a node of a straight inner wall,
in the middle of a 4 cell wall, so crew walks through the exact centre of the door:

```json
{ "x": 8, "y": 10, "dir": "v" }
```

`dir` is the direction of the wall. The door replaces the wall pieces of that node and the two
edges next to it. `DoorLayout.nodes` are the floor nodes on both sides of the door.

The builder also exports a walkability graph (`SpaceshipLayout.nav`): the floor nodes plus the
door nodes, linked to their 4 neighbours (`createWalkGrid` / `findNodePath` for pathfinding).

Items are placed either on a platform `tile` (fixed position per item type) or, for room items,
on a `node` with an optional pixel `offset` for precise placing:

```json
{ "type": "bed", "node": { "x": 5, "y": 9 }, "offset": { "x": 2, "y": 0 } }
```

The sprite (plus 2 px wall clearance) must stay inside the hull and may not touch inner walls or
other items. Press `G` in battle to draw both grids (blue = hull cells, orange = nodes and links,
red = door nodes).

### Notes

- **Assets.** Sprites come from the atlases in `public/assets/ships/`; see
  `public/assets/README.md`.
- **Physics:** Arcade (simple AABB/circle, top-down, zero gravity). Set
  `VITE_PHYSICS_DEBUG=true` in a `.env.local` file to draw physics bodies in dev.
- **Path alias:** `@/*` → `src/*` (configured in both `tsconfig.json` and
  `vite.config.ts`).
- **Chunking:** `phaser` and `pixi.js` are emitted as separate vendor chunks so
  game-code deploys don't invalidate them.
