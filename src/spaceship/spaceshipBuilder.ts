import {
  CELL_PX,
  TILE_CELLS,
  TILE_PX,
  type CellPoint,
  type CrewLayout,
  type DoorLayout,
  type FrameSizeLookup,
  type PxPoint,
  type SpaceshipBlueprint,
  type SpaceshipLayout,
  type SpriteLayer,
  type SpritePlacement,
} from './blueprintTypes';
import { CREW_FRAMES } from './crew';
import { leafPose } from './doors';
import { ITEM_TYPES } from './itemTable';

/** Door leaf frames (one leaf each, two leaves make a door) and the matching wall pieces. */
const DOOR_FRAMES = {
  h: { leaf: 'inner-door_horizontal', wall: 'inner-wall-horizontal' },
  v: { leaf: 'inner-door_vertical', wall: 'inner-wall-vertical' },
} as const;

/**
 * Pure build logic for spaceship blueprints (rules: issue #4). No Phaser here:
 * it turns a blueprint into a list of sprite placements and reports rule violations.
 */

type Dir = 'up' | 'down' | 'left' | 'right';
const DIRS: readonly Dir[] = ['up', 'down', 'left', 'right'];

/** Unit wall edge on the grid: `h` from (x, y) to (x + 1, y), `v` from (x, y) to (x, y + 1). */
interface Edge {
  dir: 'h' | 'v';
  x: number;
  y: number;
}

interface VertexArms {
  hull: Set<Dir>;
  inner: Set<Dir>;
}

const cellKey = (x: number, y: number): string => `${x},${y}`;
const edgeKey = (e: Edge): string => `${e.dir}${e.x},${e.y}`;
const isInt = (...values: number[]): boolean => values.every((v) => Number.isInteger(v));

/** Cells (as keys) on the two sides of an edge. */
function edgeSides(e: Edge): [string, string] {
  return e.dir === 'h'
    ? [cellKey(e.x, e.y - 1), cellKey(e.x, e.y)]
    : [cellKey(e.x - 1, e.y), cellKey(e.x, e.y)];
}

/** Both end vertices of an edge, with the arm direction seen from each vertex. */
function edgeEnds(
  e: Edge,
): [{ x: number; y: number; arm: Dir }, { x: number; y: number; arm: Dir }] {
  return e.dir === 'h'
    ? [
        { x: e.x, y: e.y, arm: 'right' },
        { x: e.x + 1, y: e.y, arm: 'left' },
      ]
    : [
        { x: e.x, y: e.y, arm: 'down' },
        { x: e.x, y: e.y + 1, arm: 'up' },
      ];
}

/** Corner frame suffix. The name says where the corner sits; arms point the other way. */
function cornerSuffix(arms: Set<Dir>): string {
  const [u, d, l, r] = [arms.has('up'), arms.has('down'), arms.has('left'), arms.has('right')];
  if (d && r) return 'top-left';
  if (d && l) return 'top-right';
  if (u && r) return 'bottom-left';
  return 'bottom-right';
}

/**
 * Frame for a wall vertex with the given arms, or undefined if no frame exists.
 * Hull walls: straight + corners. Inner walls: straight + corners + T + cross.
 */
export function junctionFrame(
  prefix: 'hull' | 'inner',
  arms: ReadonlySet<Dir>,
): string | undefined {
  const set = new Set(arms);
  const [u, d, l, r] = [set.has('up'), set.has('down'), set.has('left'), set.has('right')];
  if (set.size === 2) {
    if (l && r) return `${prefix}-wall-horizontal`;
    if (u && d) return `${prefix}-wall-vertical`;
    return `${prefix}-wall-corner-${cornerSuffix(set)}`;
  }
  if (prefix === 'inner') {
    if (set.size === 3) {
      // Suffix = side of the through-wall (the missing arm), the stem points the other way.
      const missing = DIRS.find((dir) => !set.has(dir));
      return `inner-wall-t-${missing === 'up' ? 'top' : missing === 'down' ? 'bottom' : missing}`;
    }
    if (set.size === 4) return 'inner-wall-cross';
  }
  return undefined;
}

function addArm(
  vertices: Map<string, VertexArms>,
  kind: keyof VertexArms,
  x: number,
  y: number,
  arm: Dir,
): void {
  const key = cellKey(x, y);
  let entry = vertices.get(key);
  if (!entry) {
    entry = { hull: new Set(), inner: new Set() };
    vertices.set(key, entry);
  }
  entry[kind].add(arm);
}

/** Breadth-first flood fill over 4-neighbour cells that satisfy `accept`. Returns visited keys. */
function floodFill(start: CellPoint, accept: (x: number, y: number) => boolean): Set<string> {
  const seen = new Set<string>([cellKey(start.x, start.y)]);
  const queue: CellPoint[] = [start];
  while (queue.length > 0) {
    const cell = queue.pop();
    if (!cell) break;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = cell.x + dx;
      const ny = cell.y + dy;
      const key = cellKey(nx, ny);
      if (!seen.has(key) && accept(nx, ny)) {
        seen.add(key);
        queue.push({ x: nx, y: ny });
      }
    }
  }
  return seen;
}

interface Analysis {
  errors: string[];
  layout?: SpaceshipLayout;
}

function analyzeSpaceship(bp: SpaceshipBlueprint, sizeOf: FrameSizeLookup): Analysis {
  const errors: string[] = [];
  const missingFrames = new Set<string>();

  const frameSize = (frame: string): { w: number; h: number } => {
    const size = sizeOf(frame);
    if (!size) {
      missingFrames.add(frame);
      return { w: 0, h: 0 };
    }
    return size;
  };

  // ---- Platform -----------------------------------------------------------
  const platformTiles = new Map<string, CellPoint>();
  const platformCells = new Set<string>();
  if (bp.platform.length === 0) errors.push('platform has no tiles');
  for (const tile of bp.platform) {
    if (!isInt(tile.x, tile.y)) {
      errors.push(`platform tile (${tile.x}, ${tile.y}) must use whole cells`);
      continue;
    }
    for (const other of platformTiles.values()) {
      if (Math.abs(other.x - tile.x) < TILE_CELLS && Math.abs(other.y - tile.y) < TILE_CELLS) {
        errors.push(`platform tiles (${other.x}, ${other.y}) and (${tile.x}, ${tile.y}) overlap`);
      }
    }
    platformTiles.set(cellKey(tile.x, tile.y), tile);
    for (let dy = 0; dy < TILE_CELLS; dy += 1) {
      for (let dx = 0; dx < TILE_CELLS; dx += 1) {
        platformCells.add(cellKey(tile.x + dx, tile.y + dy));
      }
    }
  }

  // ---- Hull area ----------------------------------------------------------
  const hullCells = new Map<string, CellPoint>();
  for (const rect of bp.hull) {
    if (!isInt(rect.x, rect.y, rect.w, rect.h) || rect.w <= 0 || rect.h <= 0) {
      errors.push(`hull rectangle (${rect.x}, ${rect.y}, ${rect.w}x${rect.h}) is invalid`);
      continue;
    }
    for (let y = rect.y; y < rect.y + rect.h; y += 1) {
      for (let x = rect.x; x < rect.x + rect.w; x += 1) {
        hullCells.set(cellKey(x, y), { x, y });
      }
    }
  }
  const inHull = (x: number, y: number): boolean => hullCells.has(cellKey(x, y));

  if (hullCells.size === 0) {
    errors.push('hull is empty');
  } else {
    const offPlatform = [...hullCells.values()].filter(
      (c) => !platformCells.has(cellKey(c.x, c.y)),
    );
    if (offPlatform.length > 0) {
      const first = offPlatform[0];
      errors.push(
        `hull is outside the platform (${offPlatform.length} cells, first at ${first?.x}, ${first?.y})`,
      );
    }

    const firstCell = hullCells.values().next().value as CellPoint;
    if (floodFill(firstCell, inHull).size !== hullCells.size) {
      errors.push('hull is not one connected piece');
    }

    // Holes: every non-hull cell in the bounding box (plus a margin) must reach the outside.
    const xs = [...hullCells.values()].map((c) => c.x);
    const ys = [...hullCells.values()].map((c) => c.y);
    const [minX, maxX, minY, maxY] = [
      Math.min(...xs) - 1,
      Math.max(...xs) + 1,
      Math.min(...ys) - 1,
      Math.max(...ys) + 1,
    ];
    const outside = floodFill(
      { x: minX, y: minY },
      (x, y) => x >= minX && x <= maxX && y >= minY && y <= maxY && !inHull(x, y),
    );
    const emptyCells = (maxX - minX + 1) * (maxY - minY + 1) - hullCells.size;
    if (outside.size !== emptyCells) errors.push('hull has holes');
  }

  // ---- Hull walls (traced from the outline) -------------------------------
  const vertices = new Map<string, VertexArms>();
  const hullEdges = new Map<string, Edge>();
  const addHullEdge = (edge: Edge): void => {
    hullEdges.set(edgeKey(edge), edge);
    for (const end of edgeEnds(edge)) addArm(vertices, 'hull', end.x, end.y, end.arm);
  };
  for (const { x, y } of hullCells.values()) {
    if (!inHull(x, y - 1)) addHullEdge({ dir: 'h', x, y });
    if (!inHull(x, y + 1)) addHullEdge({ dir: 'h', x, y: y + 1 });
    if (!inHull(x - 1, y)) addHullEdge({ dir: 'v', x, y });
    if (!inHull(x + 1, y)) addHullEdge({ dir: 'v', x: x + 1, y });
  }

  // ---- Inner walls --------------------------------------------------------
  const innerEdges = new Map<string, Edge>();
  for (const wall of bp.walls) {
    const label = `inner wall (${wall.x1}, ${wall.y1}) -> (${wall.x2}, ${wall.y2})`;
    if (!isInt(wall.x1, wall.y1, wall.x2, wall.y2)) {
      errors.push(`${label} must lie on grid lines`);
      continue;
    }
    const horizontal = wall.y1 === wall.y2;
    const vertical = wall.x1 === wall.x2;
    if (horizontal === vertical) {
      errors.push(`${label} must be horizontal or vertical and not empty`);
      continue;
    }
    const edges: Edge[] = [];
    if (horizontal) {
      for (let x = Math.min(wall.x1, wall.x2); x < Math.max(wall.x1, wall.x2); x += 1) {
        edges.push({ dir: 'h', x, y: wall.y1 });
      }
    } else {
      for (let y = Math.min(wall.y1, wall.y2); y < Math.max(wall.y1, wall.y2); y += 1) {
        edges.push({ dir: 'v', x: wall.x1, y });
      }
    }
    for (const edge of edges) {
      if (!edgeSides(edge).every((key) => hullCells.has(key))) {
        errors.push(`${label} must be inside the hull`);
        break;
      }
      if (innerEdges.has(edgeKey(edge))) continue;
      innerEdges.set(edgeKey(edge), edge);
      for (const end of edgeEnds(edge)) addArm(vertices, 'inner', end.x, end.y, end.arm);
    }
  }

  // ---- Doors --------------------------------------------------------------
  const doorKeys = new Set<string>();
  for (const door of bp.doors) {
    const edge: Edge = { dir: door.dir, x: door.x, y: door.y };
    if (door.dir !== 'h' && door.dir !== 'v') {
      errors.push(`door (${door.x}, ${door.y}) has invalid direction "${String(door.dir)}"`);
    } else if (!isInt(door.x, door.y) || !innerEdges.has(edgeKey(edge))) {
      errors.push(`door (${door.x}, ${door.y}, ${door.dir}) is not on an inner wall`);
    } else {
      doorKeys.add(edgeKey(edge));
    }
  }

  // ---- Wall sprites -------------------------------------------------------
  const walls: SpritePlacement[] = [];
  const pushSprite = (
    list: SpritePlacement[],
    layer: SpriteLayer,
    frame: string,
    x: number,
    y: number,
  ): void => {
    const { w, h } = frameSize(frame);
    list.push({ frame, x, y, w, h, layer });
  };

  for (const [key, arms] of vertices) {
    const [vx, vy] = key.split(',').map(Number) as [number, number];
    const px = vx * CELL_PX;
    const py = vy * CELL_PX;
    if (arms.hull.size > 0) {
      const frame = arms.hull.size === 2 ? junctionFrame('hull', arms.hull) : undefined;
      if (!frame) {
        errors.push(`hull wall at vertex (${vx}, ${vy}) has ${arms.hull.size} arms (pinched hull)`);
      } else {
        pushSprite(walls, 'wall', frame, px, py);
      }
    } else if (arms.inner.size === 1) {
      errors.push(`inner wall has an open end at vertex (${vx}, ${vy})`);
    } else {
      const frame = junctionFrame('inner', arms.inner);
      if (frame) pushSprite(walls, 'wall', frame, px, py);
    }
  }

  for (const edge of hullEdges.values()) {
    const frame = edge.dir === 'h' ? 'hull-wall-horizontal' : 'hull-wall-vertical';
    const [cx, cy] =
      edge.dir === 'h'
        ? [(edge.x + 0.5) * CELL_PX, edge.y * CELL_PX]
        : [edge.x * CELL_PX, (edge.y + 0.5) * CELL_PX];
    pushSprite(walls, 'wall', frame, cx, cy);
  }
  // A door edge has no wall piece: the opening is free floor. The two leaves (drawn above the
  // walls) cover the edge and its two vertex pieces when closed and slide along the wall when open.
  const doorsAbs: DoorLayout[] = [];
  for (const edge of innerEdges.values()) {
    const frame = DOOR_FRAMES[edge.dir];
    const [cx, cy] =
      edge.dir === 'h'
        ? [(edge.x + 0.5) * CELL_PX, edge.y * CELL_PX]
        : [edge.x * CELL_PX, (edge.y + 0.5) * CELL_PX];

    if (!doorKeys.has(edgeKey(edge))) {
      pushSprite(walls, 'wall', frame.wall, cx, cy);
      continue;
    }
    const leaf = frameSize(frame.leaf);
    const leafLength = edge.dir === 'h' ? leaf.w : leaf.h;
    doorsAbs.push({ x: cx, y: cy, axis: edge.dir, leafLength, travel: leafLength });
  }

  // ---- Crew ---------------------------------------------------------------
  const crewAbs: CrewLayout[] = [];
  (bp.crew ?? []).forEach((member, index) => {
    const label = `crew member ${index}`;
    const path = member.path;
    if (path.length === 0) {
      errors.push(`${label} has an empty path`);
      return;
    }
    let valid = true;
    path.forEach((cell, i) => {
      if (!isInt(cell.x, cell.y) || !inHull(cell.x, cell.y)) {
        errors.push(`${label}: path cell (${cell.x}, ${cell.y}) is not inside the hull`);
        valid = false;
        return;
      }
      const prev = path[i - 1];
      if (!prev || !isInt(prev.x, prev.y)) return;
      if (prev.x !== cell.x && prev.y !== cell.y) {
        errors.push(
          `${label}: path step (${prev.x}, ${prev.y}) -> (${cell.x}, ${cell.y}) must follow a row or column`,
        );
        valid = false;
        return;
      }
      // Walk the step cell by cell: inner walls may only be crossed at doors.
      const stepX = Math.sign(cell.x - prev.x);
      const stepY = Math.sign(cell.y - prev.y);
      for (let x = prev.x, y = prev.y; x !== cell.x || y !== cell.y; x += stepX, y += stepY) {
        const crossed: Edge =
          stepX !== 0
            ? { dir: 'v', x: stepX > 0 ? x + 1 : x, y }
            : { dir: 'h', x, y: stepY > 0 ? y + 1 : y };
        const key = edgeKey(crossed);
        if (innerEdges.has(key) && !doorKeys.has(key)) {
          errors.push(`${label}: path walks through an inner wall at ${key}`);
          valid = false;
        }
      }
    });
    if (valid) {
      crewAbs.push({
        path: path.map((c) => ({ x: (c.x + 0.5) * CELL_PX, y: (c.y + 0.5) * CELL_PX })),
      });
    }
  });

  // ---- Platform sprites ---------------------------------------------------
  const platform: SpritePlacement[] = [];
  for (const tile of platformTiles.values()) {
    pushSprite(
      platform,
      'platform',
      'platform-main',
      tile.x * CELL_PX + TILE_PX / 2,
      tile.y * CELL_PX + TILE_PX / 2,
    );
  }

  // ---- Items --------------------------------------------------------------
  const inner: SpritePlacement[] = [];
  const outer: SpritePlacement[] = [];
  const flames: SpritePlacement[] = [];
  const muzzles: PxPoint[] = [];
  const itemRects = new Map<
    string,
    { type: string; x: number; y: number; w: number; h: number }[]
  >();

  for (const item of bp.items) {
    const type = ITEM_TYPES[item.type];
    const label = `item "${item.type}" on tile (${item.tile.x}, ${item.tile.y})`;
    if (!type) {
      errors.push(`${label}: unknown item type`);
      continue;
    }
    const tileKey = cellKey(item.tile.x, item.tile.y);
    if (!platformTiles.has(tileKey)) {
      errors.push(`${label}: no platform tile there`);
      continue;
    }

    let hullCount = 0;
    for (let dy = 0; dy < TILE_CELLS; dy += 1) {
      for (let dx = 0; dx < TILE_CELLS; dx += 1) {
        if (inHull(item.tile.x + dx, item.tile.y + dy)) hullCount += 1;
      }
    }
    const tileKind =
      hullCount === TILE_CELLS * TILE_CELLS ? 'inner' : hullCount === 0 ? 'outer' : 'mixed';
    if (tileKind === 'mixed') {
      errors.push(`${label}: tile is only partly inside the hull`);
      continue;
    }
    if (tileKind !== type.kind) {
      errors.push(`${label}: ${type.kind} item on an ${tileKind} tile`);
      continue;
    }

    const { w, h } = frameSize(type.frame);
    const cx = item.tile.x * CELL_PX + TILE_PX / 2 + type.offset.x;
    const cy = item.tile.y * CELL_PX + TILE_PX / 2 + type.offset.y;
    if (
      Math.abs(type.offset.x) + w / 2 > TILE_PX / 2 ||
      Math.abs(type.offset.y) + h / 2 > TILE_PX / 2
    ) {
      errors.push(`${label}: sprite does not fit in the tile`);
    }

    const rects = itemRects.get(tileKey) ?? [];
    for (const other of rects) {
      if (Math.abs(other.x - cx) * 2 < other.w + w && Math.abs(other.y - cy) * 2 < other.h + h) {
        errors.push(`${label}: overlaps item "${other.type}"`);
      }
    }
    rects.push({ type: item.type, x: cx, y: cy, w, h });
    itemRects.set(tileKey, rects);

    pushSprite(type.kind === 'inner' ? inner : outer, type.kind, type.frame, cx, cy);
    if (type.flame) {
      pushSprite(
        flames,
        'flame',
        type.flame.frame,
        cx + type.flame.offset.x,
        cy + type.flame.offset.y,
      );
    }
    if (type.muzzle) muzzles.push({ x: cx + type.muzzle.x, y: cy + type.muzzle.y });
  }

  for (const frame of missingFrames) errors.push(`unknown atlas frame "${frame}"`);
  if (errors.length > 0 || platformTiles.size === 0) return { errors };

  // ---- Bounds and pivot ---------------------------------------------------
  const tiles = [...platformTiles.values()];
  const left = Math.min(...tiles.map((t) => t.x)) * CELL_PX;
  const top = Math.min(...tiles.map((t) => t.y)) * CELL_PX;
  const right = Math.max(...tiles.map((t) => t.x + TILE_CELLS)) * CELL_PX;
  const bottom = Math.max(...tiles.map((t) => t.y + TILE_CELLS)) * CELL_PX;
  const pivot: PxPoint = { x: (left + right) / 2, y: (top + bottom) / 2 };

  const hullList = [...hullCells.values()];
  const hullLeft = Math.min(...hullList.map((c) => c.x)) * CELL_PX;
  const hullTop = Math.min(...hullList.map((c) => c.y)) * CELL_PX;
  const hullRight = (Math.max(...hullList.map((c) => c.x)) + 1) * CELL_PX;
  const hullBottom = (Math.max(...hullList.map((c) => c.y)) + 1) * CELL_PX;

  const recenter = (s: SpritePlacement): SpritePlacement => ({
    ...s,
    x: s.x - pivot.x,
    y: s.y - pivot.y,
  });

  const doors = doorsAbs.map((d) => ({ ...d, x: d.x - pivot.x, y: d.y - pivot.y }));
  const crew = crewAbs.map((c) => ({
    path: c.path.map((p) => ({ x: p.x - pivot.x, y: p.y - pivot.y })),
  }));

  // Two leaves per door, drawn closed; `SlidingDoor` moves and crops them at runtime.
  const leaves: SpritePlacement[] = doors.flatMap((door, index) =>
    ([-1, 1] as const).map((side) => {
      const frame = DOOR_FRAMES[door.axis].leaf;
      const pose = leafPose(door, side, 0);
      const { w, h } = frameSize(frame);
      return { frame, x: pose.x, y: pose.y, w, h, layer: 'door' as const, door: { index, side } };
    }),
  );

  const crewSprites: SpritePlacement[] = crew.map((member, index) => {
    const frame = CREW_FRAMES.idle;
    const start = member.path[0] ?? { x: 0, y: 0 };
    const { w, h } = frameSize(frame);
    return { frame, x: start.x, y: start.y, w, h, layer: 'crew' as const, crew: { index } };
  });

  return {
    errors,
    layout: {
      name: bp.name,
      // Draw order: platform, inner items, walls, door leaves, crew, outer items, flames.
      sprites: [
        ...platform.map(recenter),
        ...inner.map(recenter),
        ...walls.map(recenter),
        ...leaves,
        ...crewSprites,
        ...outer.map(recenter),
        ...flames.map(recenter),
      ],
      doors,
      crew,
      size: { w: right - left, h: bottom - top },
      hullCenter: {
        x: (hullLeft + hullRight) / 2 - pivot.x,
        y: (hullTop + hullBottom) / 2 - pivot.y,
      },
      hullSize: { w: hullRight - hullLeft, h: hullBottom - hullTop },
      muzzles: muzzles.map((m) => ({ x: m.x - pivot.x, y: m.y - pivot.y })),
    },
  };
}

/** Returns a list of human-readable rule violations. An empty list means the blueprint is valid. */
export function validateSpaceship(bp: SpaceshipBlueprint, sizeOf: FrameSizeLookup): string[] {
  return analyzeSpaceship(bp, sizeOf).errors;
}

/** Builds the sprite layout of a blueprint. Throws if it breaks a build rule. */
export function buildSpaceshipLayout(
  bp: SpaceshipBlueprint,
  sizeOf: FrameSizeLookup,
): SpaceshipLayout {
  const { errors, layout } = analyzeSpaceship(bp, sizeOf);
  if (errors.length > 0 || !layout) {
    throw new Error(`Invalid spaceship "${bp.name}":\n- ${errors.join('\n- ')}`);
  }
  return layout;
}
