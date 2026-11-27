import { CELL_PX, type NavGraph, type NodePoint, type PxPoint } from './blueprintTypes';

/**
 * Pure helpers for the two grids of a blueprint (issue #9). No Phaser here.
 *
 * - **Cell grid**: hull and platform. Cell (x, y) covers (x * 16 .. x * 16 + 16) px.
 * - **Node grid**: offset by half a cell from the cell centres: the nodes are the points where
 *   the lines between the cells cross. Node (x, y) is the top-left corner of cell (x, y), at
 *   (x * 16, y * 16) px. A 4x4 cell room has 3x3 nodes inside it, the middle one is the room
 *   centre.
 *
 * Walls run along the lines between the cells, so they pass through nodes. Nodes on a wall are
 * not walkable, except door nodes: a door sits on a node of a straight wall, so crew walks
 * through the exact centre of the door.
 */

/**
 * Unit wall edge between two neighbouring nodes: `h` from node (x, y) to (x + 1, y),
 * `v` from node (x, y) to (x, y + 1).
 */
export interface Edge {
  dir: 'h' | 'v';
  x: number;
  y: number;
}

export const cellKey = (x: number, y: number): string => `${x},${y}`;
export const edgeKey = (e: Edge): string => `${e.dir}${e.x},${e.y}`;

/** Pixel position (relative to the blueprint origin) of a node. */
export const nodeToPx = (node: NodePoint): PxPoint => ({
  x: node.x * CELL_PX,
  y: node.y * CELL_PX,
});

/** Pixel position of the middle of a wall edge. */
export const edgeCenterPx = (edge: Edge): PxPoint =>
  edge.dir === 'h'
    ? { x: (edge.x + 0.5) * CELL_PX, y: edge.y * CELL_PX }
    : { x: edge.x * CELL_PX, y: (edge.y + 0.5) * CELL_PX };

/** Node closest to a pixel position. */
export const pxToNode = (p: PxPoint): NodePoint => ({
  x: Math.round(p.x / CELL_PX),
  y: Math.round(p.y / CELL_PX),
});

/** The two nodes at the ends of an edge. */
export function edgeNodes(edge: Edge): [NodePoint, NodePoint] {
  return edge.dir === 'h'
    ? [
        { x: edge.x, y: edge.y },
        { x: edge.x + 1, y: edge.y },
      ]
    : [
        { x: edge.x, y: edge.y },
        { x: edge.x, y: edge.y + 1 },
      ];
}

/** The two cells on both sides of an edge: above/below an `h` edge, left/right of a `v` edge. */
export function edgeCells(edge: Edge): [NodePoint, NodePoint] {
  return edge.dir === 'h'
    ? [
        { x: edge.x, y: edge.y - 1 },
        { x: edge.x, y: edge.y },
      ]
    : [
        { x: edge.x - 1, y: edge.y },
        { x: edge.x, y: edge.y },
      ];
}

/** Edge between two neighbouring nodes, or undefined when they are not 4-neighbours. */
export function edgeBetween(a: NodePoint, b: NodePoint): Edge | undefined {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) + Math.abs(dy) !== 1) return undefined;
  if (dx !== 0) return { dir: 'h', x: Math.min(a.x, b.x), y: a.y };
  return { dir: 'v', x: a.x, y: Math.min(a.y, b.y) };
}

/**
 * The two wall edges that meet at a door node, one on each side along the wall:
 * `h` wall: left and right edge, `v` wall: upper and lower edge.
 */
export function doorEdges(node: NodePoint, dir: 'h' | 'v'): [Edge, Edge] {
  return dir === 'h'
    ? [
        { dir: 'h', x: node.x - 1, y: node.y },
        { dir: 'h', x: node.x, y: node.y },
      ]
    : [
        { dir: 'v', x: node.x, y: node.y - 1 },
        { dir: 'v', x: node.x, y: node.y },
      ];
}

/** The two nodes through a door: above/below an `h` wall, left/right of a `v` wall. */
export function doorSideNodes(node: NodePoint, dir: 'h' | 'v'): [NodePoint, NodePoint] {
  return dir === 'h'
    ? [
        { x: node.x, y: node.y - 1 },
        { x: node.x, y: node.y + 1 },
      ]
    : [
        { x: node.x - 1, y: node.y },
        { x: node.x + 1, y: node.y },
      ];
}

const STEPS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** Walkable nodes and the links between them. */
export interface WalkGrid {
  readonly nodes: readonly NodePoint[];
  has(node: NodePoint): boolean;
  /** True when both nodes are walkable, neighbours, and no wall edge runs between them. */
  canStep(from: NodePoint, to: NodePoint): boolean;
  neighbours(node: NodePoint): NodePoint[];
}

/**
 * @param nodes   Walkable nodes: floor nodes inside the rooms and door nodes.
 * @param blocked Keys (`edgeKey`) of wall edges that cannot be walked along or across.
 */
export function createWalkGrid(
  nodes: readonly NodePoint[],
  blocked: ReadonlySet<string>,
): WalkGrid {
  const floor = new Set(nodes.map((n) => cellKey(n.x, n.y)));
  const has = (n: NodePoint): boolean => floor.has(cellKey(n.x, n.y));
  const canStep = (from: NodePoint, to: NodePoint): boolean => {
    const edge = edgeBetween(from, to);
    return !!edge && has(from) && has(to) && !blocked.has(edgeKey(edge));
  };
  return {
    nodes,
    has,
    canStep,
    neighbours: (node) =>
      STEPS.map(([dx, dy]) => ({ x: node.x + dx, y: node.y + dy })).filter((n) => canStep(node, n)),
  };
}

/** Shortest path (breadth-first) between two nodes including both ends, or undefined. */
export function findNodePath(
  grid: WalkGrid,
  from: NodePoint,
  to: NodePoint,
): NodePoint[] | undefined {
  if (!grid.has(from) || !grid.has(to)) return undefined;
  const startKey = cellKey(from.x, from.y);
  const previous = new Map<string, NodePoint | undefined>([[startKey, undefined]]);
  const queue: NodePoint[] = [from];
  for (let head = 0; head < queue.length; head += 1) {
    const node = queue[head];
    if (!node) break;
    if (node.x === to.x && node.y === to.y) {
      const path: NodePoint[] = [];
      for (let n: NodePoint | undefined = node; n; n = previous.get(cellKey(n.x, n.y)))
        path.push(n);
      return path.reverse();
    }
    for (const next of grid.neighbours(node)) {
      const key = cellKey(next.x, next.y);
      if (previous.has(key)) continue;
      previous.set(key, node);
      queue.push(next);
    }
  }
  return undefined;
}

/** Exports the walk grid with pixel positions relative to `pivot` (the ship centre). */
export function toNavGraph(grid: WalkGrid, pivot: PxPoint): NavGraph {
  const index = new Map(grid.nodes.map((n, i) => [cellKey(n.x, n.y), i]));
  const links: [number, number][] = [];
  grid.nodes.forEach((node, i) => {
    // Right and down only, so each link is listed once.
    for (const next of [
      { x: node.x + 1, y: node.y },
      { x: node.x, y: node.y + 1 },
    ]) {
      const j = index.get(cellKey(next.x, next.y));
      if (j !== undefined && grid.canStep(node, next)) links.push([i, j]);
    }
  });
  return {
    nodes: grid.nodes.map((node) => {
      const p = nodeToPx(node);
      return { node, x: p.x - pivot.x, y: p.y - pivot.y };
    }),
    links,
  };
}
