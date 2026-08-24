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

`W` / `↑` thrust · `A` `D` / `←` `→` rotate · `Space` fire · `Esc` back to menu

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
│  ├─ PreloadScene.ts    # loading bar + procedural texture generation
│  ├─ MainMenuScene.ts   # title screen
│  └─ BattleScene.ts     # gameplay: ship, bullets, asteroids, scoring
├─ entities/
│  ├─ Ship.ts            # Arcade.Sprite: inertia, steering, shields
│  └─ Bullet.ts          # pooled Arcade.Image projectile
├─ pixi/
│  ├─ PixiOverlay.ts     # Pixi Application lifecycle + resize sync
│  └─ layers/HudLayer.ts # score, shields, FPS, centre messages
└─ utils/math.ts         # engine-agnostic helpers (unit tested)
```

### Notes

- **No binary assets required.** All textures are generated at runtime in
  `PreloadScene`; see `public/assets/README.md` to switch to real files.
- **Physics:** Arcade (simple AABB/circle, top-down, zero gravity). Set
  `VITE_PHYSICS_DEBUG=true` in a `.env.local` file to draw physics bodies in dev.
- **Path alias:** `@/*` → `src/*` (configured in both `tsconfig.json` and
  `vite.config.ts`).
- **Chunking:** `phaser` and `pixi.js` are emitted as separate vendor chunks so
  game-code deploys don't invalidate them.
