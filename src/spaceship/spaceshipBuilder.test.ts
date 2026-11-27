import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildFrameMap } from '@/atlas/atlasUtils';
import type { AtlasDescriptor } from '@/atlas/atlasTypes';
import type { FrameSizeLookup, SpaceshipBlueprint } from './blueprintTypes';
import { ITEM_TYPES } from './itemTable';
import { buildSpaceshipLayout, junctionFrame, validateSpaceship } from './spaceshipBuilder';

const readJson = <T>(path: string): T =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as T;

const atlas = readJson<AtlasDescriptor>('../../public/assets/ships/poer_atlas.json');
const frames = buildFrameMap(atlas);
const sizeOf: FrameSizeLookup = (name) => {
  const frame = frames.get(name);
  return frame ? { w: frame.width, h: frame.height } : undefined;
};

/** One 64x64 platform tile with a 3x3 cell hull (cells 0..2) and a bed inside the tile. */
function smallShip(): SpaceshipBlueprint {
  return {
    name: 'test',
    platform: [{ x: 0, y: 0 }],
    hull: [{ x: 0, y: 0, w: 4, h: 4 }],
    walls: [],
    doors: [],
    items: [{ type: 'bed', tile: { x: 0, y: 0 } }],
  };
}

const framesOf = (bp: SpaceshipBlueprint): string[] =>
  buildSpaceshipLayout(bp, sizeOf).sprites.map((s) => s.frame);

describe('spaceship_01 blueprint', () => {
  const blueprint = readJson<SpaceshipBlueprint>('../../public/assets/ships/spaceship_01.json');

  it('follows all build rules', () => {
    expect(validateSpaceship(blueprint, sizeOf)).toEqual([]);
  });

  it('only uses atlas frames that exist', () => {
    for (const type of Object.values(ITEM_TYPES)) {
      expect(frames.has(type.frame), type.frame).toBe(true);
      if (type.flame) expect(frames.has(type.flame.frame), type.flame.frame).toBe(true);
    }
  });

  it('builds a ship centred on its platform bounding box', () => {
    const layout = buildSpaceshipLayout(blueprint, sizeOf);
    expect(layout.size).toEqual({ w: 24 * 16, h: 16 * 16 });
    expect(layout.hullSize).toEqual({ w: 16 * 16, h: 12 * 16 });
    const platforms = layout.sprites.filter((s) => s.layer === 'platform');
    expect(platforms).toHaveLength(blueprint.platform.length);
    for (const s of layout.sprites.filter((sp) => sp.layer !== 'flame')) {
      expect(Math.abs(s.x)).toBeLessThanOrEqual(layout.size.w / 2 + 32);
      expect(Math.abs(s.y)).toBeLessThanOrEqual(layout.size.h / 2 + 32);
    }
  });

  it('has two cannon muzzles and two flames', () => {
    const layout = buildSpaceshipLayout(blueprint, sizeOf);
    expect(layout.muzzles).toHaveLength(2);
    expect(layout.sprites.filter((s) => s.layer === 'flame')).toHaveLength(2);
  });

  it('draws layers in the documented order', () => {
    const order = ['platform', 'inner', 'wall', 'door', 'crew', 'outer', 'flame'];
    const layers = buildSpaceshipLayout(blueprint, sizeOf).sprites.map((s) =>
      order.indexOf(s.layer),
    );
    expect(layers).toEqual([...layers].sort((a, b) => a - b));
  });

  it('has four doors made of two leaves each, and no hull doors', () => {
    const layout = buildSpaceshipLayout(blueprint, sizeOf);
    expect(layout.doors).toHaveLength(4);
    const leaves = layout.sprites.filter((s) => s.layer === 'door');
    expect(leaves).toHaveLength(8);
    expect(leaves.filter((s) => s.frame === 'inner-door_horizontal')).toHaveLength(4);
    expect(leaves.filter((s) => s.frame === 'inner-door_vertical')).toHaveLength(4);
  });

  it('has two crew members', () => {
    const layout = buildSpaceshipLayout(blueprint, sizeOf);
    expect(layout.crew).toHaveLength(2);
    expect(layout.sprites.filter((s) => s.layer === 'crew')).toHaveLength(2);
  });
});

describe('junctionFrame', () => {
  it.each([
    [['down', 'right'], 'hull-wall-corner-top-left'],
    [['down', 'left'], 'hull-wall-corner-top-right'],
    [['up', 'right'], 'hull-wall-corner-bottom-left'],
    [['up', 'left'], 'hull-wall-corner-bottom-right'],
    [['left', 'right'], 'hull-wall-horizontal'],
    [['up', 'down'], 'hull-wall-vertical'],
  ] as const)('hull arms %j -> %s', (arms, frame) => {
    expect(junctionFrame('hull', new Set(arms))).toBe(frame);
  });

  it.each([
    [['left', 'right', 'down'], 'inner-wall-t-top'],
    [['left', 'right', 'up'], 'inner-wall-t-bottom'],
    [['up', 'down', 'right'], 'inner-wall-t-left'],
    [['up', 'down', 'left'], 'inner-wall-t-right'],
    [['up', 'down', 'left', 'right'], 'inner-wall-cross'],
  ] as const)('inner arms %j -> %s', (arms, frame) => {
    expect(junctionFrame('inner', new Set(arms))).toBe(frame);
  });

  it('has no T or cross frame for hull walls', () => {
    expect(junctionFrame('hull', new Set(['left', 'right', 'down']))).toBeUndefined();
  });
});

describe('hull walls', () => {
  it('traces a rectangle with 4 corners and straight pieces on every edge', () => {
    const f = framesOf(smallShip());
    expect(f.filter((n) => n.startsWith('hull-wall-corner'))).toHaveLength(4);
    expect(f.filter((n) => n === 'hull-wall-horizontal')).toHaveLength(2 * 4 + 2 * 3);
    expect(f.filter((n) => n === 'hull-wall-vertical')).toHaveLength(2 * 4 + 2 * 3);
  });

  it('uses the right corner frame for each corner of the rectangle', () => {
    const f = framesOf(smallShip());
    for (const suffix of ['top-left', 'top-right', 'bottom-left', 'bottom-right']) {
      expect(f).toContain(`hull-wall-corner-${suffix}`);
    }
  });

  it('places walls centred on grid lines', () => {
    const layout = buildSpaceshipLayout(smallShip(), sizeOf);
    const half = layout.size.w / 2;
    const corner = layout.sprites.find((s) => s.frame === 'hull-wall-corner-top-left');
    expect(corner).toMatchObject({ x: -half, y: -half });
  });
});

describe('inner walls, doors and junctions', () => {
  function twoRooms(): SpaceshipBlueprint {
    return {
      name: 'rooms',
      platform: [{ x: 0, y: 0 }],
      hull: [{ x: 0, y: 0, w: 4, h: 4 }],
      walls: [{ x1: 2, y1: 0, x2: 2, y2: 4 }],
      doors: [],
      items: [],
    };
  }

  it('splits the hull and uses hull pieces where the wall meets the hull', () => {
    const f = framesOf(twoRooms());
    // 4 edge pieces + 3 inner vertices (the 2 end vertices belong to the hull).
    expect(f.filter((n) => n === 'inner-wall-vertical')).toHaveLength(4 + 3);
    // Wall ends at the hull: the vertex piece is the hull straight, not an inner T.
    expect(f.filter((n) => n.startsWith('inner-wall-t-'))).toHaveLength(0);
  });

  it('replaces the wall pieces around a door node with a door', () => {
    const bp = twoRooms();
    bp.doors = [{ x: 2, y: 2, dir: 'v' }];
    const f = framesOf(bp);
    expect(f.filter((n) => n === 'inner-door_vertical')).toHaveLength(2); // two leaves
    // Without the door: 4 edges + 3 inner nodes. The door removes its node and the 2 edges next to it.
    expect(f.filter((n) => n === 'inner-wall-vertical')).toHaveLength(4 + 3 - 3);
  });

  it('describes a door by its leaf length: each leaf slides one leaf length', () => {
    const bp = twoRooms();
    bp.doors = [{ x: 2, y: 2, dir: 'v' }];
    const [door] = buildSpaceshipLayout(bp, sizeOf).doors;
    // The ship pivot is the centre of the 64 px tile, so the door node (2, 2) is at (0, 0).
    expect(door).toEqual({
      x: 0,
      y: 0,
      node: { x: 2, y: 2 },
      axis: 'v',
      leafLength: 12,
      travel: 12,
      nodes: [
        { x: 1, y: 2 },
        { x: 3, y: 2 },
      ],
    });
  });

  it('puts a door exactly half way between the crew nodes on both sides', () => {
    const bp = twoRooms();
    bp.doors = [{ x: 2, y: 2, dir: 'v' }];
    bp.crew = [
      {
        path: [
          { x: 1, y: 2 },
          { x: 2, y: 2 },
          { x: 3, y: 2 },
        ],
      },
    ];
    const layout = buildSpaceshipLayout(bp, sizeOf);
    const [door] = layout.doors;
    const [left, mid, right] = layout.crew[0]?.path ?? [];
    expect(mid).toEqual({ x: door?.x, y: door?.y });
    expect(door?.x).toBe(((left?.x ?? 0) + (right?.x ?? 0)) / 2);
    expect(door?.y).toBe(left?.y);
  });

  it('has 3x3 floor nodes in a 4x4 cell room, none on the walls', () => {
    const bp = smallShip();
    const { nav } = buildSpaceshipLayout(bp, sizeOf);
    expect(nav.nodes).toHaveLength(9);
    expect(nav.nodes.map((n) => n.node)).toContainEqual({ x: 2, y: 2 });
    for (const n of nav.nodes) {
      expect(n.node.x).toBeGreaterThanOrEqual(1);
      expect(n.node.x).toBeLessThanOrEqual(3);
      expect(n.node.y).toBeGreaterThanOrEqual(1);
      expect(n.node.y).toBeLessThanOrEqual(3);
    }
    // The room centre node is the centre of the ship.
    expect(nav.nodes.find((n) => n.node.x === 2 && n.node.y === 2)).toMatchObject({ x: 0, y: 0 });
  });

  it('links the nodes of both rooms only through the door', () => {
    const bp = twoRooms();
    const links = (b: SpaceshipBlueprint): number =>
      buildSpaceshipLayout(b, sizeOf).nav.links.length;
    // Two rooms with 1x3 floor nodes each: 2 links per room.
    expect(links(bp)).toBe(4);
    bp.doors = [{ x: 2, y: 2, dir: 'v' }];
    // The door node is linked to the node on each side.
    expect(links(bp)).toBe(4 + 2);
  });

  it('rejects doors that do not sit on a straight inner wall', () => {
    const at = (x: number, y: number, dir: 'h' | 'v' = 'v'): string[] => {
      const bp = twoRooms();
      bp.doors = [{ x, y, dir }];
      return validateSpaceship(bp, sizeOf);
    };
    expect(at(2, 2)).toEqual([]);
    expect(at(2, 2, 'h').join()).toMatch(/not on an inner wall/); // wall runs the other way
    expect(at(2, 0).join()).toMatch(/not on an inner wall/); // end of the wall (hull node)
    expect(at(1, 2).join()).toMatch(/not on an inner wall/); // no wall at all

    const bp = twoRooms();
    bp.walls.push({ x1: 2, y1: 2, x2: 4, y2: 2 }); // T junction at (2, 2)
    bp.doors = [{ x: 2, y: 2, dir: 'v' }];
    expect(validateSpaceship(bp, sizeOf).join()).toMatch(/not on an inner wall/);
  });

  it('rejects doors that overlap', () => {
    const bp = twoRooms();
    bp.doors = [
      { x: 2, y: 1, dir: 'v' },
      { x: 2, y: 2, dir: 'v' },
    ];
    expect(validateSpaceship(bp, sizeOf).join()).toMatch(/overlaps another door/);
  });

  it('accepts crew that walks through a door and rejects walking through a wall', () => {
    const bp = twoRooms();
    const path = [
      { x: 1, y: 2 },
      { x: 3, y: 2 },
    ];
    bp.doors = [{ x: 2, y: 2, dir: 'v' }];
    bp.crew = [{ path }];
    expect(validateSpaceship(bp, sizeOf)).toEqual([]);
    bp.doors = [];
    expect(validateSpaceship(bp, sizeOf).join()).toMatch(/crosses a wall/);
    bp.doors = [{ x: 2, y: 2, dir: 'v' }];
    bp.crew = [
      {
        path: [
          { x: 1, y: 1 },
          { x: 3, y: 1 },
        ],
      },
    ];
    expect(validateSpaceship(bp, sizeOf).join()).toMatch(/crosses a wall/);
  });

  it('rejects crew on walls or outside the hull and off the rows and columns', () => {
    const bp = twoRooms();
    bp.crew = [
      {
        path: [
          { x: 1, y: 1 },
          { x: 5, y: 1 },
        ],
      },
    ];
    expect(validateSpaceship(bp, sizeOf).join()).toMatch(/not on the floor/);
    bp.crew = [{ path: [{ x: 2, y: 1 }] }]; // on the wall
    expect(validateSpaceship(bp, sizeOf).join()).toMatch(/not on the floor/);
    bp.crew = [{ path: [{ x: 0, y: 0 }] }]; // hull corner
    expect(validateSpaceship(bp, sizeOf).join()).toMatch(/not on the floor/);
    bp.crew = [
      {
        path: [
          { x: 1, y: 1 },
          { x: 3, y: 3 },
        ],
      },
    ];
    expect(validateSpaceship(bp, sizeOf).join()).toMatch(/row or column/);
    bp.crew = [{ path: [] }];
    expect(validateSpaceship(bp, sizeOf).join()).toMatch(/empty path/);
  });

  it('builds T and cross junctions from inner walls', () => {
    const bp = twoRooms();
    bp.walls.push({ x1: 2, y1: 2, x2: 4, y2: 2 });
    expect(framesOf(bp)).toContain('inner-wall-t-left');

    bp.walls.push({ x1: 0, y1: 2, x2: 2, y2: 2 });
    expect(framesOf(bp)).toContain('inner-wall-cross');
  });

  it('builds inner corners', () => {
    const bp = twoRooms();
    bp.walls = [
      { x1: 1, y1: 1, x2: 3, y2: 1 },
      { x1: 3, y1: 1, x2: 3, y2: 3 },
      { x1: 3, y1: 3, x2: 1, y2: 3 },
      { x1: 1, y1: 3, x2: 1, y2: 1 },
    ];
    const f = framesOf(bp);
    for (const suffix of ['top-left', 'top-right', 'bottom-left', 'bottom-right']) {
      expect(f).toContain(`inner-wall-corner-${suffix}`);
    }
  });
});

describe('items on nodes', () => {
  /**
   * Hull 4x4 cells split by a wall at x = 2 (px 32). The bed is 28x36 px, so it fits on node
   * (1, 2) = (16, 32) px with exactly 2 px clearance to the wall and to the hull wall.
   */
  function roomWithBed(item: Partial<SpaceshipBlueprint['items'][number]>): SpaceshipBlueprint {
    return {
      name: 'node-items',
      platform: [{ x: 0, y: 0 }],
      hull: [{ x: 0, y: 0, w: 4, h: 4 }],
      walls: [{ x1: 2, y1: 0, x2: 2, y2: 4 }],
      doors: [],
      items: [{ type: 'bed', ...item }],
    };
  }

  it('places the sprite on the node plus the offset', () => {
    const bp = roomWithBed({ node: { x: 1, y: 2 }, offset: { x: 0, y: -8 } });
    expect(validateSpaceship(bp, sizeOf)).toEqual([]);
    const layout = buildSpaceshipLayout(bp, sizeOf);
    const bed = layout.sprites.find((s) => s.frame === 'inner-cabin-bed');
    // Node (1, 2) is at (16, 32) px; the pivot of the 64 px tile is (32, 32).
    expect(bed).toMatchObject({ x: 16 - 32, y: 32 - 8 - 32, layer: 'inner' });
  });

  it('uses the offset for precise placing next to a wall', () => {
    expect(validateSpaceship(roomWithBed({ node: { x: 1, y: 2 } }), sizeOf)).toEqual([]);
    const toWall = roomWithBed({ node: { x: 1, y: 2 }, offset: { x: 1, y: 0 } });
    expect(validateSpaceship(toWall, sizeOf).join()).toMatch(/touches an inner wall/);
    const toHull = roomWithBed({ node: { x: 1, y: 2 }, offset: { x: -1, y: 0 } });
    expect(validateSpaceship(toHull, sizeOf).join()).toMatch(/outside the hull/);
  });

  it('rejects sprites that reach outside the hull', () => {
    expect(validateSpaceship(roomWithBed({ node: { x: 1, y: 1 } }), sizeOf).join()).toMatch(
      /outside the hull/,
    );
  });

  it('rejects nodes outside the room, on a wall, bad nodes and outer items', () => {
    const outside = roomWithBed({ node: { x: 9, y: 9 } });
    expect(validateSpaceship(outside, sizeOf).join()).toMatch(/node is not on the floor/);
    const onWall = roomWithBed({ node: { x: 2, y: 2 } });
    expect(validateSpaceship(onWall, sizeOf).join()).toMatch(/node is not on the floor/);
    const fractional = roomWithBed({ node: { x: 1.5, y: 1 } });
    expect(validateSpaceship(fractional, sizeOf).join()).toMatch(/whole numbers/);
    const outer = roomWithBed({ type: 'cannon', node: { x: 1, y: 1 } });
    expect(validateSpaceship(outer, sizeOf).join()).toMatch(/only inner items/);
  });

  it('needs exactly one of tile or node, and offset only with a node', () => {
    expect(validateSpaceship(roomWithBed({}), sizeOf).join()).toMatch(/exactly one of/);
    const both = roomWithBed({ node: { x: 0, y: 1 }, tile: { x: 0, y: 0 } });
    expect(validateSpaceship(both, sizeOf).join()).toMatch(/exactly one of/);
    const stray = roomWithBed({ tile: { x: 0, y: 0 }, offset: { x: 1, y: 1 } });
    expect(validateSpaceship(stray, sizeOf).join()).toMatch(/only allowed together with "node"/);
  });

  it('rejects overlap with another item, also across placement styles', () => {
    const bp = roomWithBed({ node: { x: 1, y: 2 } });
    bp.items.push({ type: 'bed', node: { x: 1, y: 2 }, offset: { x: 0, y: 1 } });
    expect(validateSpaceship(bp, sizeOf).join()).toMatch(/overlaps/);
    const mixed = roomWithBed({ node: { x: 1, y: 2 } });
    mixed.items.push({ type: 'bed', tile: { x: 0, y: 0 } });
    expect(validateSpaceship(mixed, sizeOf).join()).toMatch(/overlaps/);
  });
});

describe('validation', () => {
  const errorsOf = (mutate: (bp: SpaceshipBlueprint) => void): string[] => {
    const bp = smallShip();
    mutate(bp);
    return validateSpaceship(bp, sizeOf);
  };

  it('accepts the minimal ship', () => {
    expect(validateSpaceship(smallShip(), sizeOf)).toEqual([]);
  });

  it('rejects overlapping platform tiles', () => {
    expect(errorsOf((bp) => bp.platform.push({ x: 2, y: 2 })).join()).toMatch(/overlap/);
  });

  it('rejects a hull outside the platform', () => {
    expect(errorsOf((bp) => (bp.hull = [{ x: 0, y: 0, w: 5, h: 4 }])).join()).toMatch(
      /outside the platform/,
    );
  });

  it('rejects a disconnected hull', () => {
    const errors = errorsOf((bp) => {
      bp.platform.push({ x: 8, y: 0 });
      bp.hull.push({ x: 8, y: 0, w: 4, h: 4 });
      bp.items = [];
    });
    expect(errors.join()).toMatch(/connected/);
  });

  it('rejects a hull with a hole', () => {
    const errors = errorsOf((bp) => {
      bp.platform = [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 0, y: 4 },
        { x: 4, y: 4 },
      ];
      bp.hull = [
        { x: 0, y: 0, w: 8, h: 3 },
        { x: 0, y: 3, w: 3, h: 2 },
        { x: 5, y: 3, w: 3, h: 2 },
        { x: 0, y: 5, w: 8, h: 3 },
      ];
      bp.items = [];
    });
    expect(errors.join()).toMatch(/holes/);
  });

  it('rejects inner walls with an open end', () => {
    expect(errorsOf((bp) => bp.walls.push({ x1: 1, y1: 1, x2: 3, y2: 1 })).join()).toMatch(
      /open end/,
    );
  });

  it('rejects inner walls outside the hull or off the grid', () => {
    expect(errorsOf((bp) => bp.walls.push({ x1: 0, y1: 0, x2: 4, y2: 0 })).join()).toMatch(
      /inside the hull/,
    );
    expect(errorsOf((bp) => bp.walls.push({ x1: 0.5, y1: 1, x2: 3, y2: 1 })).join()).toMatch(
      /grid lines/,
    );
    expect(errorsOf((bp) => bp.walls.push({ x1: 1, y1: 1, x2: 2, y2: 2 })).join()).toMatch(
      /horizontal or vertical/,
    );
  });

  it('rejects doors that are not on an inner wall (including the hull)', () => {
    expect(errorsOf((bp) => bp.doors.push({ x: 0, y: 0, dir: 'h' })).join()).toMatch(
      /not on an inner wall/,
    );
  });

  it('rejects unknown items and items off the platform', () => {
    expect(errorsOf((bp) => bp.items.push({ type: 'nope', tile: { x: 0, y: 0 } })).join()).toMatch(
      /unknown item type/,
    );
    expect(errorsOf((bp) => bp.items.push({ type: 'bed', tile: { x: 4, y: 0 } })).join()).toMatch(
      /no platform tile/,
    );
  });

  it('rejects inner items outside and outer items inside the hull', () => {
    expect(
      errorsOf((bp) => (bp.items = [{ type: 'cannon', tile: { x: 0, y: 0 } }])).join(),
    ).toMatch(/outer item on an inner tile/);
    const errors = errorsOf((bp) => {
      bp.platform.push({ x: 4, y: 0 });
      bp.items = [{ type: 'bed', tile: { x: 4, y: 0 } }];
    });
    expect(errors.join()).toMatch(/inner item on an outer tile/);
  });

  it('rejects items on a tile that is only partly in the hull', () => {
    expect(errorsOf((bp) => (bp.hull = [{ x: 0, y: 0, w: 3, h: 3 }])).join()).toMatch(
      /partly inside/,
    );
  });

  it('rejects overlapping items on one tile', () => {
    expect(errorsOf((bp) => bp.items.push({ type: 'bed', tile: { x: 0, y: 0 } })).join()).toMatch(
      /overlaps/,
    );
  });

  it('rejects unknown atlas frames and throws when building', () => {
    const noFrames: FrameSizeLookup = () => undefined;
    expect(validateSpaceship(smallShip(), noFrames).join()).toMatch(/unknown atlas frame/);
    expect(() => buildSpaceshipLayout(smallShip(), noFrames)).toThrow(/Invalid spaceship/);
  });
});
