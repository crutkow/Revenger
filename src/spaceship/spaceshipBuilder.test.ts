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
    const order = ['platform', 'inner', 'wall', 'outer', 'flame'];
    const layers = buildSpaceshipLayout(blueprint, sizeOf).sprites.map((s) =>
      order.indexOf(s.layer),
    );
    expect(layers).toEqual([...layers].sort((a, b) => a - b));
  });

  it('uses two doors and no hull doors', () => {
    expect(framesOf(blueprint).filter((f) => f === 'inner-door_horizontal')).toHaveLength(2);
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

  it('replaces the wall piece of a door edge with a door', () => {
    const bp = twoRooms();
    bp.doors = [{ x: 2, y: 1, dir: 'v' }];
    const f = framesOf(bp);
    expect(f.filter((n) => n === 'inner-door_vertical')).toHaveLength(1);
    expect(f.filter((n) => n === 'inner-wall-vertical')).toHaveLength(3 + 3); // 3 edges + 3 inner vertices
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
