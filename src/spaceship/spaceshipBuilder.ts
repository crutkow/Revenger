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
import {
  cellKey,
  createWalkGrid,
  doorEdges,
  doorSideNodes,
  edgeCells,
  edgeCenterPx,
  edgeKey,
  nodeToPx,
  toNavGraph,
  type Edge,
} from './grid';
import { ITEM_TYPES } from './itemTable';

/**
 * Half the thickness of a wall sprite in pixels. Room items placed on a node keep this
 * distance to every wall.
 */
const WALL_HALF_PX = 2;

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

interface VertexArms {
  hull: Set<Dir>;
  inner: Set<Dir>;
}

const isInt = (...values: number[]): boolean => values.every((v) => Number.isInteger(v));

/** Cells (as keys) on the two sides of an edge. */
function edgeSides(e: Edge): [string, string] {
  const [a, b] = edgeCells(e);
  return [cellKey(a.x, a.y), cellKey(b.x, b.y)];
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
  // A door sits on a node of a straight inner wall: the wall continues on both sides and
  // nothing else (T junction, corner, hull) meets the node. It replaces the wall pieces of
  // the two edges next to the node.
  const doorNodeKeys = new Set<string>();
  const doorEdgeKeys = new Set<string>();
  const doorSpecs: { x: number; y: number; dir: 'h' | 'v' }[] = [];
  for (const door of bp.doors) {
    const label = `door (${door.x}, ${door.y}, ${door.dir})`;
    if (door.dir !== 'h' && door.dir !== 'v') {
      errors.push(`door (${door.x}, ${door.y}) has invalid direction "${String(door.dir)}"`);
      continue;
    }
    const arms = vertices.get(cellKey(door.x, door.y));
    const [first, second] = doorEdges(door, door.dir);
    const straight =
      isInt(door.x, door.y) &&
      arms !== undefined &&
      arms.hull.size === 0 &&
      arms.inner.size === 2 &&
      innerEdges.has(edgeKey(first)) &&
      innerEdges.has(edgeKey(second));
    if (!straight) {
      errors.push(`${label} is not on an inner wall (needs a straight wall on both sides)`);
      continue;
    }
    if (doorEdgeKeys.has(edgeKey(first)) || doorEdgeKeys.has(edgeKey(second))) {
      errors.push(`${label} overlaps another door`);
      continue;
    }
    doorNodeKeys.add(cellKey(door.x, door.y));
    doorEdgeKeys.add(edgeKey(first));
    doorEdgeKeys.add(edgeKey(second));
    doorSpecs.push({ x: door.x, y: door.y, dir: door.dir });
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
    const { x: px, y: py } = nodeToPx({ x: vx, y: vy });
    if (doorNodeKeys.has(key)) continue; // the door leaves cover this wall piece
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
    const { x: cx, y: cy } = edgeCenterPx(edge);
    pushSprite(walls, 'wall', frame, cx, cy);
  }
  // The two edges next to a door node have no wall piece: the opening is free floor. The two
  // leaves (drawn above the walls) cover both edges and the node piece when closed (24 px
  // around the door node) and slide along the wall when open.
  for (const edge of innerEdges.values()) {
    if (doorEdgeKeys.has(edgeKey(edge))) continue;
    const { x: cx, y: cy } = edgeCenterPx(edge);
    pushSprite(walls, 'wall', DOOR_FRAMES[edge.dir].wall, cx, cy);
  }
  const doorsAbs: DoorLayout[] = doorSpecs.map((door) => {
    const leaf = frameSize(DOOR_FRAMES[door.dir].leaf);
    const leafLength = door.dir === 'h' ? leaf.w : leaf.h;
    const { x, y } = nodeToPx(door);
    return {
      x,
      y,
      node: { x: door.x, y: door.y },
      axis: door.dir,
      leafLength,
      travel: leafLength,
      nodes: doorSideNodes(door, door.dir),
    };
  });

  // ---- Walk grid (node grid) ----------------------------------------------
  // Floor nodes: all four cells around the node are hull and no wall touches it. Door nodes are
  // walkable too. A node is therefore never on the hull or on an inner wall.
  const walkNodes = new Map<string, { x: number; y: number }>();
  for (const { x, y } of hullCells.values()) {
    for (const [nx, ny] of [
      [x, y],
      [x + 1, y],
      [x, y + 1],
      [x + 1, y + 1],
    ] as const) {
      const key = cellKey(nx, ny);
      const surrounded =
        inHull(nx - 1, ny - 1) && inHull(nx, ny - 1) && inHull(nx - 1, ny) && inHull(nx, ny);
      if (surrounded && !vertices.has(key)) walkNodes.set(key, { x: nx, y: ny });
    }
  }
  for (const door of doorSpecs) walkNodes.set(cellKey(door.x, door.y), { x: door.x, y: door.y });
  const walkGrid = createWalkGrid(
    [...walkNodes.values()].sort((a, b) => a.y - b.y || a.x - b.x),
    new Set(innerEdges.keys()),
  );

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
    path.forEach((node, i) => {
      if (!isInt(node.x, node.y) || !walkGrid.has(node)) {
        errors.push(
          `${label}: path node (${node.x}, ${node.y}) is not on the floor (inside a room, not on a wall)`,
        );
        valid = false;
        return;
      }
      const prev = path[i - 1];
      if (!prev || !isInt(prev.x, prev.y)) return;
      if (prev.x !== node.x && prev.y !== node.y) {
        errors.push(
          `${label}: path step (${prev.x}, ${prev.y}) -> (${node.x}, ${node.y}) must follow a row or column`,
        );
        valid = false;
        return;
      }
      // Walk the step node by node: walls may only be crossed at door nodes.
      const stepX = Math.sign(node.x - prev.x);
      const stepY = Math.sign(node.y - prev.y);
      for (let x = prev.x, y = prev.y; x !== node.x || y !== node.y; x += stepX, y += stepY) {
        const to = { x: x + stepX, y: y + stepY };
        if (walkGrid.canStep({ x, y }, to)) continue;
        valid = false;
        errors.push(
          `${label}: path crosses a wall at node (${to.x}, ${to.y}); walls can only be crossed at doors`,
        );
        break;
      }
    });
    if (valid) crewAbs.push({ path: path.map(nodeToPx) });
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
  const itemRects: { type: string; x: number; y: number; w: number; h: number }[] = [];

  /** Why a room item at this centre cannot stand there, or undefined when it fits. */
  const roomFootprintError = (cx: number, cy: number, w: number, h: number): string | undefined => {
    const [x0, x1] = [cx - w / 2 - WALL_HALF_PX, cx + w / 2 + WALL_HALF_PX];
    const [y0, y1] = [cy - h / 2 - WALL_HALF_PX, cy + h / 2 + WALL_HALF_PX];
    for (let y = Math.floor(y0 / CELL_PX); y <= Math.ceil(y1 / CELL_PX) - 1; y += 1) {
      for (let x = Math.floor(x0 / CELL_PX); x <= Math.ceil(x1 / CELL_PX) - 1; x += 1) {
        if (!inHull(x, y)) return 'sprite reaches outside the hull';
      }
    }
    for (const edge of innerEdges.values()) {
      const start = nodeToPx(edge);
      const crosses =
        edge.dir === 'h'
          ? x0 < start.x + CELL_PX && x1 > start.x && y0 < start.y && y1 > start.y
          : y0 < start.y + CELL_PX && y1 > start.y && x0 < start.x && x1 > start.x;
      if (crosses) return 'sprite touches an inner wall';
    }
    return undefined;
  };

  for (const item of bp.items) {
    const type = ITEM_TYPES[item.type];
    const { tile, node } = item;
    const label = node
      ? `item "${item.type}" on node (${node.x}, ${node.y})`
      : `item "${item.type}" on tile (${tile?.x}, ${tile?.y})`;
    if (!type) {
      errors.push(`${label}: unknown item type`);
      continue;
    }
    if (!tile === !node) {
      errors.push(`${label}: needs exactly one of "tile" or "node"`);
      continue;
    }
    if (item.offset && !node) {
      errors.push(`${label}: "offset" is only allowed together with "node"`);
      continue;
    }

    const { w, h } = frameSize(type.frame);
    let cx: number;
    let cy: number;

    if (node) {
      // Room item on a node of the second grid, plus a free pixel offset.
      if (!isInt(node.x, node.y)) {
        errors.push(`${label}: node must use whole numbers`);
        continue;
      }
      if (type.kind !== 'inner') {
        errors.push(`${label}: only inner items can be placed on a node`);
        continue;
      }
      if (!walkGrid.has(node)) {
        errors.push(`${label}: node is not on the floor (inside a room, not on a wall)`);
        continue;
      }
      const offset = item.offset ?? { x: 0, y: 0 };
      if (!Number.isFinite(offset.x) || !Number.isFinite(offset.y)) {
        errors.push(`${label}: offset must be a number`);
        continue;
      }
      const centre = nodeToPx(node);
      cx = centre.x + offset.x;
      cy = centre.y + offset.y;
      const problem = roomFootprintError(cx, cy, w, h);
      if (problem) errors.push(`${label}: ${problem}`);
    } else if (tile) {
      if (!platformTiles.has(cellKey(tile.x, tile.y))) {
        errors.push(`${label}: no platform tile there`);
        continue;
      }

      let hullCount = 0;
      for (let dy = 0; dy < TILE_CELLS; dy += 1) {
        for (let dx = 0; dx < TILE_CELLS; dx += 1) {
          if (inHull(tile.x + dx, tile.y + dy)) hullCount += 1;
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

      cx = tile.x * CELL_PX + TILE_PX / 2 + type.offset.x;
      cy = tile.y * CELL_PX + TILE_PX / 2 + type.offset.y;
      if (
        Math.abs(type.offset.x) + w / 2 > TILE_PX / 2 ||
        Math.abs(type.offset.y) + h / 2 > TILE_PX / 2
      ) {
        errors.push(`${label}: sprite does not fit in the tile`);
      }
    } else {
      continue;
    }

    for (const other of itemRects) {
      if (Math.abs(other.x - cx) * 2 < other.w + w && Math.abs(other.y - cy) * 2 < other.h + h) {
        errors.push(`${label}: overlaps item "${other.type}"`);
      }
    }
    itemRects.push({ type: item.type, x: cx, y: cy, w, h });

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
      nav: toNavGraph(walkGrid, pivot),
      hullCells: hullList.map((c) => ({ x: c.x * CELL_PX - pivot.x, y: c.y * CELL_PX - pivot.y })),
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
