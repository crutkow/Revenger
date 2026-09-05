# Revenger

Space battle simulator — a top-down HTML5 game built with **TypeScript**, **Vite**, **Phaser** and **Pixi.js**.

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
```

| Script | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server with HMR + in-browser TS errors |
| `npm run build` | Typecheck, then production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` / `lint:fix` | ESLint (flat config, typescript-eslint) |
| `npm run format` | Prettier |
| `npm test` / `test:watch` | Vitest |

## Controls

**Battle** — `W` / `↑` thrust · `A` `D` / `←` `→` rotate · mouse aim · `Space` / LMB fire · `Esc` menu
**Menu** — `Enter` launch · `S` Shipyard viewer
**Shipyard** — `←` `→` build phase · `Tab` faction skin · `Esc` menu

## The ship

The player flies a **tile-built capital ship** (GitHub issue #2): platform,
hull, rooms, props, turrets, engines and crew are all assembled from a 64 px
tile atlas (`public/assets/ships/*.png`, placeholder art). The layout is data
(`src/config/shipLayout.ts`) and matches the issue's mock-ups pixel-for-pixel —
open the Shipyard (`S`) to step through the ten build phases. Design details
live in `public/design/GDD.md`.

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
│  ├─ shipAtlas.ts       # ship atlas tile map (bottom-left origin → frame index)
│  ├─ shipLayout.ts      # capital-ship layout data (cells, doors, props, items, crew)
│  └─ gameConfig.ts      # Phaser.Types.Core.GameConfig (arcade physics, no gravity)
├─ core/
│  ├─ EventBus.ts        # typed cross-engine messaging
│  └─ Registry.ts        # typed global state + localStorage high score
├─ scenes/
│  ├─ BootScene.ts       # engine setup, focus/blur pause
│  ├─ PreloadScene.ts    # loading bar, ship atlases, procedural textures
│  ├─ MainMenuScene.ts   # title screen
│  ├─ BattleScene.ts     # gameplay: capital ship, camera follow, asteroids, scoring
│  └─ ShipyardScene.ts   # static viewer: 10 build phases, faction swap
├─ entities/
│  ├─ Spaceship.ts       # tile-built capital ship: render + physics + turrets
│  └─ Bullet.ts          # pooled Arcade projectile
├─ pixi/
│  ├─ PixiOverlay.ts     # Pixi Application lifecycle + resize sync
│  └─ layers/HudLayer.ts # score, hull bar, FPS, centre messages
└─ utils/math.ts         # engine-agnostic helpers (unit tested)
```

### Notes

- **Assets.** The two ship tile atlases in `public/assets/ships/` are loaded as
  64 px spritesheets; everything else (bullets, asteroids, stars) is generated
  at runtime in `PreloadScene`.
- **Screenshots.** `node scripts/screenshot.mjs <url> <outDir> [final|phases]`
  drives the game headlessly with Playwright (`npx playwright install chromium`).
- **Physics:** Arcade (simple AABB/circle, top-down, zero gravity). Set
  `VITE_PHYSICS_DEBUG=true` in a `.env.local` file to draw physics bodies in dev.
- **Path alias:** `@/*` → `src/*` (configured in both `tsconfig.json` and
  `vite.config.ts`).
- **Chunking:** `phaser` and `pixi.js` are emitted as separate vendor chunks so
  game-code deploys don't invalidate them.
