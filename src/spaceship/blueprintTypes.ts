/**
 * Spaceship blueprint (`public/assets/ships/spaceship_*.json`).
 * Build rules: GitHub issue #4. All positions are whole **cells** of 16 px,
 * origin = top-left of the ship, +x right, +y down.
 *
 * Two grids (issue #9), the second one is offset by half a cell from the first:
 *
 * - **Cell grid**: hull and platform. The cell (x, y) covers (x * 16 .. x * 16 + 16) px.
 *   Walls run along the lines between cells.
 * - **Node grid**: the points where those lines cross, i.e. the corners of the cells. Node
 *   (x, y) lies at (x * 16, y * 16) px, so a 4x4 cell room (64 px) has 3x3 = 9 nodes inside
 *   it, the middle one at the centre of the room. Crew stands and walks on nodes, room items
 *   are placed on nodes, and a door sits on a node of a straight inner wall: the middle of
 *   a 4 cell wall. Nodes on a wall are not walkable, except door nodes.
 *   See `grid.ts` for the conversions.
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

/**
 * Node of the second grid, offset by half a cell from the cell centres (issue #9).
 * Node (x, y) is the top-left corner of cell (x, y), at (x * 16, y * 16) px.
 */
export interface NodePoint {
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
 * Door on node (x, y) of a straight inner wall. `dir` is the direction of the wall:
 * `h` = horizontal wall (the leaves slide left/right), `v` = vertical wall (up/down).
 * The wall must continue on both sides of the node. The door is 24 px wide: it replaces
 * the wall edge on each side of the node (the two 16 px edges) except the outer 4 px.
 */
export interface DoorSpec {
  x: number;
  y: number;
  dir: 'h' | 'v';
}

/**
 * An item is placed in one of two ways (exactly one of `tile` / `node`):
 *
 * - `tile`: top-left cell of the platform tile that holds it. The sprite sits at the fixed
 *   position of its `ITEM_TYPES` entry (inner and outer items).
 * - `node`: node of the second grid (issue #9). Only inner (room) items. The sprite centre
 *   is the node plus the optional pixel `offset` for precise placing.
 */
export interface ItemPlacement {
  /** Key of `ITEM_TYPES`. */
  type: string;
  tile?: CellPoint;
  node?: NodePoint;
  /** Pixel offset of the sprite centre from its node. Only used together with `node`. */
  offset?: PxPoint;
}

/**
 * Crew member that patrols a fixed path (issue #8, placeholder AI). The path is a list of
 * nodes of the second grid (issue #9): it starts at the first node, walks to the next ones in
 * a straight line each and walks back at the end. Nodes must be floor nodes (inside a room,
 * not on a wall) or door nodes. Segments run along rows or columns and may only cross inner
 * walls at doors.
 */
export interface CrewSpec {
  path: NodePoint[];
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
  /** Optional crew members (issue #8). */
  crew?: CrewSpec[];
}

/** Draw order, bottom to top. */
export type SpriteLayer = 'platform' | 'inner' | 'wall' | 'door' | 'crew' | 'outer' | 'flame';

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
  /** Set on the two leaves of a sliding door: index into `SpaceshipLayout.doors`. */
  door?: { index: number; side: -1 | 1 };
  /** Set on a crew member sprite: index into `SpaceshipLayout.crew`. */
  crew?: { index: number };
}

/**
 * Sliding door (issue #8) on a node of an inner wall: two leaves that meet in the middle when
 * closed and slide apart along the wall when open (design: `poer_ship_doors_*.png`). Leaves
 * are the plain atlas sprites: never scaled, never cropped, drawn above the walls.
 */
export interface DoorLayout {
  /** Door node (its centre) in pixels relative to the pivot. */
  x: number;
  y: number;
  /** The door node on the grid. */
  node: NodePoint;
  /** `h`: door on a horizontal wall (leaves slide left/right), `v`: leaves slide up/down. */
  axis: 'h' | 'v';
  /** Length of one leaf along the slide axis, in pixels. */
  leafLength: number;
  /** Slide distance from closed to open (one leaf length). */
  travel: number;
  /**
   * The two floor nodes on both sides of the door (issue #9): left/right of a vertical door,
   * above/below a horizontal one. The door node is half way between them.
   */
  nodes: [NodePoint, NodePoint];
}

/** Walkable node of the second grid. `x`/`y` are pixels relative to the pivot. */
export interface NavNode {
  node: NodePoint;
  x: number;
  y: number;
}

/**
 * Walkability graph of the node grid (issue #9): the nodes are the floor nodes inside the
 * rooms plus the door nodes; neighbouring nodes (16 px apart) are linked.
 */
export interface NavGraph {
  nodes: NavNode[];
  /** Pairs of indices into `nodes`, each link listed once. */
  links: [number, number][];
}

export interface CrewLayout {
  /** Walk path in pixels relative to the pivot (node positions). */
  path: PxPoint[];
}

export interface SpaceshipLayout {
  name: string;
  /** Sprites in draw order (bottom to top). */
  sprites: SpritePlacement[];
  doors: DoorLayout[];
  crew: CrewLayout[];
  /** Walkability graph of the node grid. */
  nav: NavGraph;
  /** Top-left corner of every hull cell in pixels relative to the pivot (debug overlay). */
  hullCells: PxPoint[];
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
