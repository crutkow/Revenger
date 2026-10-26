/**
 * Spaceship blueprint (`public/assets/ships/spaceship_*.json`).
 * Build rules: GitHub issue #4. All positions are whole **cells** of 16 px,
 * origin = top-left of the ship, +x right, +y down. Wall coordinates are
 * grid-line vertices (a vertex (x, y) is the top-left corner of cell (x, y)).
 */

/** Edge length of one grid cell in pixels. */
export const CELL_PX = 16;
/** Platform tile edge length in cells (64 px). */
export const TILE_CELLS = 4;
/** Platform tile edge length in pixels. */
export const TILE_PX = CELL_PX * TILE_CELLS;

export interface CellPoint {
  x: number;
  y: number;
}

export interface CellRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Axis-aligned inner wall between two grid vertices. */
export interface WallSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Door on one 16 px wall edge that starts at vertex (x, y):
 * `h` = edge going right to (x + 1, y), `v` = edge going down to (x, y + 1).
 */
export interface DoorSpec {
  x: number;
  y: number;
  dir: 'h' | 'v';
}

export interface ItemPlacement {
  /** Key of `ITEM_TYPES`. */
  type: string;
  /** Top-left cell of the platform tile that holds the item. */
  tile: CellPoint;
}

export interface SpaceshipBlueprint {
  name: string;
  /** Top-left cell of every 64x64 platform tile. */
  platform: CellPoint[];
  /** Hull area as cell rectangles. Hull walls are traced from its outline. */
  hull: CellRect[];
  /** Inner walls (room walls). Must lie inside the hull. */
  walls: WallSegment[];
  doors: DoorSpec[];
  items: ItemPlacement[];
}

/** Draw order, bottom to top. */
export type SpriteLayer = 'platform' | 'inner' | 'wall' | 'outer' | 'flame';

export interface PxPoint {
  x: number;
  y: number;
}

export interface PxSize {
  w: number;
  h: number;
}

/** One sprite of the built ship. `x`/`y` is the sprite centre, relative to the ship pivot. */
export interface SpritePlacement {
  frame: string;
  x: number;
  y: number;
  w: number;
  h: number;
  layer: SpriteLayer;
}

export interface SpaceshipLayout {
  name: string;
  /** Sprites in draw order (bottom to top). */
  sprites: SpritePlacement[];
  /** Platform bounding box size in pixels. Its centre is the ship pivot (0, 0). */
  size: PxSize;
  /** Hull bounding box centre and size, relative to the pivot. */
  hullCenter: PxPoint;
  hullSize: PxSize;
  /** Cannon muzzles relative to the pivot, nose pointing up. */
  muzzles: PxPoint[];
}

/** Returns the pixel size of an atlas frame, or undefined if the frame does not exist. */
export type FrameSizeLookup = (frame: string) => PxSize | undefined;
