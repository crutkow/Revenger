# Revenger — Game Design Document

_Living document. Status: prototype. Last updated: 2026-09-05._

## 1. Pitch

**Revenger** is a top-down space battle simulator. The player commands a
**tile-built capital ship** — platform, hull, rooms, crew and weapon systems
are all composed from a shared 64 × 64 tile atlas — and fights through an
open, scrolling asteroid field. Everything the player sees of their ship is
*the* ship: rooms will eventually be crewed and damaged tile-by-tile.

## 2. Current scope (prototype)

| System | State |
| --- | --- |
| Tile-built capital ship: platform / hull / rooms / props / items / crew | ✅ `Spaceship` (issue #2), pixel-matched to the issue mock-ups |
| Capital ship is the playable vessel (thrust, steer, rigid body, destructible) | ✅ `BattleScene` |
| Turrets track the pointer and fire (round-robin, recoil) | ✅ |
| Asteroids, scoring, hull integrity, game over | ✅ |
| Camera follows the ship over an infinite starfield | ✅ |
| Phaser (world) + Pixi (HUD) split rendering | ✅ |
| Shipyard viewer with the 10 build phases | ✅ `ShipyardScene` |
| Crew simulation, room functions, per-tile destruction, enemy ships | ⏳ not started |

> The earlier "small arrow ship" gameplay was a placeholder and has been
> removed; the capital ship *is* the player now.

## 3. Core loop (target)

1. Fly the capital ship (inertia, slow turn rate — it's a big vessel).
2. Aim all turrets with the mouse; fire with `Space` / LMB.
3. Destroy asteroids for score; collisions shove the ship and damage the hull.
4. When hull integrity reaches 0 the ship is destroyed → game over → menu.

Future: rooms do things (bridge = sensors, engine room = thrust, cabins =
crew rest), crew walk between rooms and repair breaches, enemy factions
(GSE vs. POER) field their own tile-built ships.

## 4. The tile-built spaceship (issue #2)

### 4.1 Source atlases

Two interchangeable faction skins, both 512 × 512 px / 8 × 8 tiles of 64 px:

- `public/assets/ships/gse_atlas.png`
- `public/assets/ships/poer_atlas.png`

**All art in these atlases is placeholder.** Rooms, crew, turrets and engines
are readable stand-ins whose only job is to validate layout. They will be
replaced tile-for-tile without code changes.

Atlas coordinate convention: **(0,0) is the bottom-left tile.** The mapping to
a Phaser spritesheet frame index lives in `src/config/shipAtlas.ts::frameOf()`.

| Coordinate | Content |
| --- | --- |
| (0,0) | Crew member |
| (0,1) / (1,1) | Hull wall — vertical / horizontal (8 × 36 / 36 × 8 px) |
| (2,1) / (3,1) | Room wall — vertical / horizontal |
| (4,1) / (5,1) | Room door — vertical / horizontal |
| row 2 | Items outside the hull: turret, barrel, light, rocket engine, jet blast |
| row 3 | Mess hall: floor (col 0), counters, stools |
| row 4 | Cabin: floor, bunks (horizontal / vertical), lockers |
| row 5 | Bridge: floor, lamps, consoles |
| row 6 | Engine room: floor, reactors, vents |
| row 7 | Hallway: floor, shelves |

### 4.2 Layout data (`src/config/shipLayout.ts`)

The layout is authored in the pixel frame of the reference mock-ups
(**384 × 640**, bow at the top) so it can be compared 1:1 with them.

The platform is a brick bond — 64 px tiles, odd rows shifted by 32 px — so the
footprint is described on a **half-tile grid** (12 × 10 cells of 32 × 64 px):

```
..pp....pp..   row 0  bow tabs        (p = platform outside the hull)
.ppBBBBBBpp.   row 1  bridge
ppBBBBBBBBpp   row 2
.aaaaHHMMMM.   row 3  cabin | hallway | mess hall
..aaHHHHMM..   row 4  waist
.aaaaHHcccc.   row 5  cabin | hallway | cabin
ppHHHHHHHHpp   row 6  hallway T-junction
.ddddHHeeee.   row 7  cabin | hallway | cabin
ppEEEEEEEEpp   row 8  engine room
...ppEEpp...   row 9  stern tab
```

Everything else is a list of pixel positions: `DOORS`, `PROPS`, `TURRETS`,
`ENGINES`, `CREW`, each tagged with the build phase it belongs to.

### 4.3 Rendering rules (`src/entities/Spaceship.ts`)

- **Platform (phase 1)** — one floor tile per brick, for every non-void cell.
- **Hull (phase 2)** — hull-wall sprites on every edge between a hull cell and
  a non-hull cell. Walls are inset 4 px into the tile; a 64 px vertical edge
  uses two 36 px sprites, a 32 px horizontal edge uses one.
- **Rooms (phases 3–7)** — room floor per room type, room walls on every edge
  between two different room codes, doors drawn over the wall. Hull walls
  render above room walls so they read taller from the top-down view.
- **Items (phases 8–9)** — turrets on the bow/side tabs, barrels attached and
  rotated with the turret heading; engines on the stern tabs with a jet-blast
  sprite that flickers/stretches while thrusting.
- **Crew (phase 10)** — static markers at the mock-up positions.

The Shipyard scene exposes the `phase` option so any of the ten steps can be
viewed on its own and compared with `public/design/reference/phaseNN-*.png`.

### 4.4 Physics & gameplay

`Spaceship` is a `Phaser.GameObjects.Container` with one Arcade body
(circle, mass 40, drag 0.6, angular drag 0.85). The ship is rendered at
`Gameplay.capitalScale` (0.75) with the camera at `Gameplay.battleZoom` (0.9).

| Tunable (`Gameplay.*`) | Value | Meaning |
| --- | --- | --- |
| `capitalThrust` | 160 | forward acceleration (px/s²) |
| `capitalMaxSpeed` | 220 | velocity clamp |
| `capitalTurnAccel` | 90 | angular acceleration (°/s²) |
| `capitalFireCooldownMs` | 140 | between turret shots (round-robin) |
| `capitalMaxIntegrity` | 100 | hull points |
| `capitalAsteroidDamage` | 10 × asteroid scale | damage per collision |
| `capitalInvulnerableMs` | 600 | i-frames after a hit |

Turrets clamp to ±100° around their rest heading so side guns can't fire
through the hull. Firing applies a small recoil tween to the barrel.

## 5. Controls

| Context | Keys |
| --- | --- |
| Main menu | `Enter` / `Space` / click — launch · `S` — Shipyard viewer |
| Battle | `W`/`↑` thrust · `A`/`D`/`←`/`→` rotate · mouse aim · `Space` / LMB fire · `Esc` menu |
| Shipyard | `←`/`→` (or `A`/`D`) build phase · `Tab` faction skin · `Esc` menu |

## 6. Code map

```
src/config/
  shipAtlas.ts    # atlas coordinate → frame index; named tiles & props
  shipLayout.ts   # half-tile CELL_MAP + doors/props/turrets/engines/crew
  constants.ts    # Gameplay.capital* tuning, ShipFactions
src/entities/
  Spaceship.ts    # renders the layout in 10 phases; physics; thrust/steer/aim/fire/damage
  Bullet.ts       # pooled projectile (culled against the camera view)
src/scenes/
  BattleScene.ts  # camera-follow gameplay with the capital ship
  ShipyardScene.ts# static viewer, phases 1–10, faction swap
scripts/
  screenshot.mjs  # Playwright helper: `final` shots or all `phases`
```

## 7. Known simplifications / next steps

- Props, crew, turrets and engines are placeholders and purely visual/static.
- Hull damage is a single scalar; no per-tile destruction yet.
- One hull silhouette; `CELL_MAP` is designed so more ship classes can be
  added as sibling layouts.
- Asteroids are the only threat; no enemy ships yet.

## 8. Reference material

- Issue with brief and mock-ups: [crutkow/Revenger#2](https://github.com/crutkow/Revenger/issues/2)
- Mock-ups (local copies): `public/design/reference/phase01-platform.png` … `phase10-crew.png`
- Verification screenshots: `public/design/screenshots/`
- Concept art: `public/design/concept_arts/`
