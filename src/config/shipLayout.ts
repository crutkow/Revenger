/**
 * Layout of the player's capital ship (GitHub issue #2), authored in the pixel
 * frame of the reference mock-ups: a 384 × 640 canvas, bow at the top.
 *
 * The platform is a brick-bond grid: 64 px tiles, odd rows shifted by 32 px.
 * To describe that with plain data we use a **half-tile grid** of 12 columns
 * (32 px wide) × 10 rows (64 px tall). A 64 px tile always occupies two
 * horizontally adjacent half-cells.
 *
 * Every position in this file was measured from the mock-ups attached to the
 * issue, so `Spaceship` reproduces them pixel-for-pixel.
 */
import type { PropName } from './shipAtlas';

export const TILE = 64;
export const HALF = 32;
export const GRID_COLS = 12;
export const GRID_ROWS = 10;
export const SHIP_WIDTH = GRID_COLS * HALF; // 384
export const SHIP_HEIGHT = GRID_ROWS * TILE; // 640

/**
 * Half-cell map. One character per 32 × 64 half-cell.
 *
 *   `.` void            `p` platform outside the hull (item mounts)
 *   `B` bridge          `H` hallway          `E` engine room
 *   `a` port cabin      `c` starboard cabin  `d` / `e` aft cabins
 *   `M` mess hall
 *
 * Anything that is not `.` or `p` is enclosed by the hull.
 */
export const CELL_MAP: readonly string[] = [
  '..pp....pp..', // row 0 – bow tabs
  '.ppBBBBBBpp.', // row 1
  'ppBBBBBBBBpp', // row 2
  '.aaaaHHMMMM.', // row 3
  '..aaHHHHMM..', // row 4 – waist, hallway bulge
  '.aaaaHHcccc.', // row 5
  'ppHHHHHHHHpp', // row 6 – hallway T-junction
  '.ddddHHeeee.', // row 7
  'ppEEEEEEEEpp', // row 8
  '...ppEEpp...', // row 9 – stern tab
];

export type CellCode = string;

export function cellAt(row: number, col: number): CellCode {
  if (row < 0 || row >= GRID_ROWS || col < 0 || col >= GRID_COLS) return '.';
  return CELL_MAP[row]?.[col] ?? '.';
}

export function isPlatform(code: CellCode): boolean {
  return code !== '.';
}

export function isHull(code: CellCode): boolean {
  return code !== '.' && code !== 'p';
}

export type RoomKind = 'bridge' | 'hallway' | 'engine' | 'cabin' | 'mess';

export function roomKindOf(code: CellCode): RoomKind | undefined {
  switch (code) {
    case 'B':
      return 'bridge';
    case 'H':
      return 'hallway';
    case 'E':
      return 'engine';
    case 'a':
    case 'c':
    case 'd':
    case 'e':
      return 'cabin';
    case 'M':
      return 'mess';
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Doors – 32 px openings cut into room walls. Centre in pixel coords.
// Bridge / engine-room doors are horizontal, side-room doors vertical.
// ---------------------------------------------------------------------------

/**
 * Build phase numbering follows the issue's mock-ups:
 * 1 platform · 2 hull · 3 hallway · 4 bridge · 5 engine room · 6 cabins ·
 * 7 mess hall · 8 items · 9 item addons · 10 crew.
 */
export type BuildPhase = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export const MAX_PHASE: BuildPhase = 10;

export const ROOM_PHASE: Record<RoomKind, BuildPhase> = {
  hallway: 3,
  bridge: 4,
  engine: 5,
  cabin: 6,
  mess: 7,
};

export interface DoorDef {
  x: number;
  y: number;
  orientation: 'horizontal' | 'vertical';
  /** Doors appear together with the room they lead into. */
  phase: BuildPhase;
}

export const DOORS: readonly DoorDef[] = [
  { x: 192, y: 192, orientation: 'horizontal', phase: 4 }, // bridge ↔ hallway
  { x: 192, y: 512, orientation: 'horizontal', phase: 5 }, // hallway ↔ engine room
  { x: 128, y: 288, orientation: 'vertical', phase: 6 }, // port cabin ↔ hallway
  { x: 224, y: 352, orientation: 'vertical', phase: 6 }, // hallway ↔ starboard cabin
  { x: 160, y: 480, orientation: 'vertical', phase: 6 }, // aft port cabin ↔ hallway
  { x: 224, y: 480, orientation: 'vertical', phase: 6 }, // hallway ↔ aft starboard cabin
  { x: 256, y: 288, orientation: 'vertical', phase: 7 }, // hallway ↔ mess hall
];

// ---------------------------------------------------------------------------
// Room props – placeholder sprites from the atlas, by sprite centre.
// ---------------------------------------------------------------------------

export interface PropDef {
  tile: PropName;
  x: number;
  y: number;
  /** Build phase the prop belongs to (matches the issue's mock-up numbering). */
  phase: BuildPhase;
}

export const PROPS: readonly PropDef[] = [
  // Phase 3 – hallway
  { tile: 'HallShelfLeft', x: 96, y: 416, phase: 3 },
  { tile: 'HallShelfLeft', x: 288, y: 416, phase: 3 },
  // Phase 4 – bridge
  { tile: 'BridgeLampLeft', x: 128, y: 96, phase: 4 },
  { tile: 'BridgeLampRight', x: 256, y: 96, phase: 4 },
  { tile: 'BridgeLampCornerLeft', x: 96, y: 160, phase: 4 },
  { tile: 'BridgeLampCornerRight', x: 288, y: 160, phase: 4 },
  { tile: 'BridgeConsoleTop', x: 192, y: 96, phase: 4 },
  { tile: 'BridgeConsoleBottom', x: 192, y: 121, phase: 4 },
  { tile: 'BridgeConsoleTop', x: 160, y: 134, phase: 4 },
  { tile: 'BridgeConsoleBottom', x: 160, y: 159, phase: 4 },
  { tile: 'BridgeConsoleTop', x: 224, y: 134, phase: 4 },
  { tile: 'BridgeConsoleBottom', x: 224, y: 159, phase: 4 },
  // Phase 5 – engine room
  { tile: 'EngineReactorLeft', x: 96, y: 544, phase: 5 },
  { tile: 'EngineReactorRight', x: 288, y: 544, phase: 5 },
  { tile: 'EngineVents', x: 160, y: 544, phase: 5 },
  { tile: 'EngineVents', x: 224, y: 544, phase: 5 },
  { tile: 'EngineReactorWide', x: 192, y: 608, phase: 5 },
  // Phase 6 – cabins
  { tile: 'CabinBunkLeft', x: 64, y: 224, phase: 6 },
  { tile: 'CabinBunkLeftAlt', x: 128, y: 224, phase: 6 },
  { tile: 'CabinBunkVerticalLeft', x: 96, y: 288, phase: 6 },
  { tile: 'CabinBunkLeft', x: 64, y: 352, phase: 6 },
  { tile: 'CabinBunkLeftAlt', x: 128, y: 352, phase: 6 },
  { tile: 'CabinBunkRightAlt', x: 256, y: 352, phase: 6 },
  { tile: 'CabinBunkLeftAlt', x: 320, y: 352, phase: 6 },
  { tile: 'CabinBunkLeft', x: 64, y: 480, phase: 6 },
  { tile: 'CabinBunkRight', x: 128, y: 480, phase: 6 },
  { tile: 'CabinBunkRightAlt', x: 256, y: 480, phase: 6 },
  { tile: 'CabinBunkLeftAlt', x: 320, y: 480, phase: 6 },
  // Phase 7 – mess hall
  { tile: 'MessCounterTop', x: 256, y: 224, phase: 7 },
  { tile: 'MessCounterTop', x: 320, y: 224, phase: 7 },
  { tile: 'MessStoolRight', x: 253, y: 226, phase: 7 },
  { tile: 'MessStoolRight', x: 317, y: 226, phase: 7 },
  { tile: 'MessStoolRight', x: 287, y: 287, phase: 7 },
];

// ---------------------------------------------------------------------------
// Items outside the hull
// ---------------------------------------------------------------------------

export interface TurretDef {
  x: number;
  y: number;
  /** Rest heading in degrees, Phaser convention (0 = +X). -90 = forward. */
  restAngle: number;
}

export const TURRETS: readonly TurretDef[] = [
  { x: 96, y: 32, restAngle: -90 },
  { x: 288, y: 32, restAngle: -90 },
  { x: 32, y: 160, restAngle: -90 },
  { x: 352, y: 160, restAngle: -90 },
  { x: 32, y: 416, restAngle: 180 },
  { x: 352, y: 416, restAngle: 0 },
];

/** Barrel centre offset from the turret centre, along its heading. */
export const BARREL_OFFSET = 22;
/** Muzzle distance from the turret centre (bullet spawn). */
export const MUZZLE_OFFSET = 40;

export interface EngineDef {
  x: number;
  y: number;
}

export const ENGINES: readonly EngineDef[] = [
  { x: 32, y: 544 },
  { x: 352, y: 544 },
  { x: 128, y: 608 },
  { x: 256, y: 608 },
];

/** Jet-blast centre offset below the engine centre. */
export const JET_OFFSET = 65;

// ---------------------------------------------------------------------------
// Crew – static placeholder markers (Phase 10).
// ---------------------------------------------------------------------------

export const CREW: readonly (readonly [number, number])[] = [
  [128, 96],
  [248, 96],
  [193, 113],
  [161, 148],
  [225, 148],
  [96, 160],
  [288, 160],
  [83, 273],
  [163, 286],
  [303, 223],
  [298, 278],
  [118, 373],
  [248, 373],
  [158, 433],
  [273, 433],
  [128, 548],
  [258, 548],
  [193, 528],
  [193, 583],
];
