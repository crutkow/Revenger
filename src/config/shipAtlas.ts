/**
 * Tile map for the spaceship atlases `public/assets/ships/{gse,poer}_atlas.png`.
 *
 * Both atlases are 512×512 px = 8×8 tiles of 64×64 px and share one layout.
 * Coordinates below follow the design brief: **(0,0) is the bottom-left tile.**
 *
 *   row 0 : (0,0) crew member
 *   row 1 : (0,1) hull wall V  (1,1) hull wall H  (2,1) room wall V  (3,1) room wall H
 *           (4,1) room door V  (5,1) room door H
 *   row 2 : items outside the hull — (1,2) turret (2,2) barrel (3,2) light
 *           (4,2) rocket engine (5,2) jet blast
 *   row 3+: room rows. Column 0 of each row is the room's floor/platform tile,
 *           the remaining columns are that room's placeholder props.
 *             row 3 mess hall, row 4 cabin, row 5 bridge, row 6 engine room, row 7 hallway
 *
 * All art in rows 0 and 2–7 is *placeholder* — it exists so the layout can be
 * validated visually; final art will replace it tile-for-tile.
 */

export const ATLAS_TILE = 64;
export const ATLAS_COLS = 8;
export const ATLAS_ROWS = 8;

export interface AtlasCoord {
  col: number;
  /** Row index counted from the bottom of the atlas image. */
  row: number;
}

/**
 * Bottom-left atlas coordinate → Phaser spritesheet frame index
 * (Phaser numbers frames left→right, top→bottom).
 */
export function frameOf({ col, row }: AtlasCoord): number {
  return (ATLAS_ROWS - 1 - row) * ATLAS_COLS + col;
}

const t = (col: number, row: number): AtlasCoord => ({ col, row });

/** Structural tiles. */
export const Structure = {
  Crew: t(0, 0),
  HullWallV: t(0, 1),
  HullWallH: t(1, 1),
  RoomWallV: t(2, 1),
  RoomWallH: t(3, 1),
  RoomDoorV: t(4, 1),
  RoomDoorH: t(5, 1),
} as const satisfies Record<string, AtlasCoord>;

/** Items mounted outside the hull (row 2). */
export const Items = {
  Turret: t(1, 2),
  Barrel: t(2, 2),
  Light: t(3, 2),
  Engine: t(4, 2),
  JetBlast: t(5, 2),
} as const satisfies Record<string, AtlasCoord>;

/** Floor tiles: column 0 of each room row. The platform uses the mess-hall floor. */
export const Floors = {
  Platform: t(0, 3),
  Mess: t(0, 3),
  Cabin: t(0, 4),
  Bridge: t(0, 5),
  Engine: t(0, 6),
  Hallway: t(0, 7),
} as const satisfies Record<string, AtlasCoord>;

/** Room placeholder props. Names describe what the placeholder stands for. */
export const Props = {
  // row 3 – mess hall
  MessCounterTop: t(1, 3),
  MessCounterBottom: t(2, 3),
  MessStoolRight: t(3, 3),
  MessStoolLeft: t(4, 3),
  // row 4 – cabin
  CabinBunkLeft: t(1, 4),
  CabinBunkRight: t(2, 4),
  CabinBunkLeftAlt: t(3, 4),
  CabinBunkRightAlt: t(4, 4),
  CabinBunkVerticalLeft: t(5, 4),
  CabinBunkVerticalRight: t(6, 4),
  // row 5 – bridge
  BridgeLampCornerLeft: t(1, 5),
  BridgeLampCornerRight: t(2, 5),
  BridgeLampLeft: t(3, 5),
  BridgeLampRight: t(4, 5),
  BridgeConsoleTop: t(5, 5),
  BridgeConsoleBottom: t(6, 5),
  // row 6 – engine room
  EngineReactorRight: t(1, 6),
  EngineReactorLeft: t(2, 6),
  EngineReactorWide: t(3, 6),
  EngineVents: t(4, 6),
  // row 7 – hallway
  HallShelfLeft: t(1, 7),
  HallShelfRight: t(2, 7),
} as const satisfies Record<string, AtlasCoord>;

export type PropName = keyof typeof Props;
