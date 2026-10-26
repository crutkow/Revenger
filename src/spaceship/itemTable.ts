import type { PxPoint } from './blueprintTypes';

export interface ItemType {
  /** Frame name in `poer_atlas.json`. */
  frame: string;
  /** `inner` items need a tile fully inside the hull, `outer` items a tile fully outside. */
  kind: 'inner' | 'outer';
  /** Fixed position of the sprite centre relative to the tile centre, in pixels. */
  offset: PxPoint;
  /** Flame sprite shown while thrusting. `offset` is relative to the item centre. */
  flame?: { frame: string; offset: PxPoint };
  /** Where bullets leave the item, relative to the item centre (nose pointing up). */
  muzzle?: PxPoint;
}

/**
 * Item types a blueprint can use. A tile is 64x64 px (-32..32 around its centre);
 * leave about 4 px at the tile edge for the walls that sit on the grid lines.
 */
export const ITEM_TYPES: Readonly<Record<string, ItemType>> = {
  // Inner items
  bed: { frame: 'inner-cabin-bed', kind: 'inner', offset: { x: 0, y: 0 } },
  'bridge-seat': { frame: 'inner-bridge-seat-main', kind: 'inner', offset: { x: 0, y: 8 } },
  'bridge-monitor': { frame: 'inner-bridge-monitor', kind: 'inner', offset: { x: 0, y: -20 } },
  'bridge-console-left': {
    frame: 'inner-bridge-console-corner-bottom-left',
    kind: 'inner',
    offset: { x: -17, y: 18 },
  },
  'bridge-console-right': {
    frame: 'inner-bridge-console-corner-bottom-right',
    kind: 'inner',
    offset: { x: 17, y: 18 },
  },
  'messhall-dining': { frame: 'inner-messhall-dining', kind: 'inner', offset: { x: 0, y: 0 } },
  'messhall-table': { frame: 'inner-messhall-table', kind: 'inner', offset: { x: 0, y: 0 } },
  'engine-room': { frame: 'inner-engine-room-main', kind: 'inner', offset: { x: 0, y: 0 } },

  // Outer items
  'thruster-main': {
    frame: 'outer-thruster-main',
    kind: 'outer',
    offset: { x: 0, y: 0 },
    flame: { frame: 'outer-thruster-flame', offset: { x: 0, y: 46 } },
  },
  'thruster-left': { frame: 'outer-thruster-left', kind: 'outer', offset: { x: 0, y: 0 } },
  'thruster-right': { frame: 'outer-thruster-right', kind: 'outer', offset: { x: 0, y: 0 } },
  turret: {
    frame: 'outer-torret',
    kind: 'outer',
    offset: { x: 0, y: 0 },
    muzzle: { x: 0, y: -23 },
  },
  cannon: {
    frame: 'outer-cannon',
    kind: 'outer',
    offset: { x: 0, y: 0 },
    muzzle: { x: 0, y: -31 },
  },
};
