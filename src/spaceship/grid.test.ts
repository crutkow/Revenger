import { describe, expect, it } from 'vitest';
import {
  createWalkGrid,
  doorEdges,
  doorSideNodes,
  edgeBetween,
  edgeCells,
  edgeCenterPx,
  edgeKey,
  edgeNodes,
  findNodePath,
  nodeToPx,
  pxToNode,
  toNavGraph,
  type Edge,
} from './grid';

describe('grid conversions', () => {
  it('puts a node on the corner of a cell: a 64 px room has 3x3 nodes inside it', () => {
    expect(nodeToPx({ x: 3, y: 2 })).toEqual({ x: 48, y: 32 });
    // Room (4x4 cells) at cells 8..11: the nodes strictly inside it are x = 9, 10, 11.
    const inside = [9, 10, 11].map((x) => nodeToPx({ x, y: 9 }).x);
    expect(inside).toEqual([144, 160, 176]);
    // Its middle node is the centre of the 128..192 px room.
    expect(nodeToPx({ x: 10, y: 10 })).toEqual({ x: 160, y: 160 });
  });

  it('maps pixels back to the closest node', () => {
    expect(pxToNode({ x: 48, y: 32 })).toEqual({ x: 3, y: 2 });
    expect(pxToNode({ x: 55, y: 39 })).toEqual({ x: 3, y: 2 });
    expect(pxToNode({ x: 57, y: 41 })).toEqual({ x: 4, y: 3 });
  });

  it.each<Edge>([
    { dir: 'h', x: 4, y: 3 },
    { dir: 'v', x: 4, y: 3 },
  ])('puts the %j edge centre half way between its two end nodes', (edge) => {
    const [a, b] = edgeNodes(edge);
    const pa = nodeToPx(a);
    const pb = nodeToPx(b);
    expect(edgeCenterPx(edge)).toEqual({ x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 });
  });

  it('names the cells beside an edge', () => {
    expect(edgeCells({ dir: 'v', x: 8, y: 10 })).toEqual([
      { x: 7, y: 10 },
      { x: 8, y: 10 },
    ]);
    expect(edgeCells({ dir: 'h', x: 12, y: 8 })).toEqual([
      { x: 12, y: 7 },
      { x: 12, y: 8 },
    ]);
  });

  it('finds the edge between neighbouring nodes in both directions', () => {
    expect(edgeBetween({ x: 7, y: 10 }, { x: 8, y: 10 })).toEqual({ dir: 'h', x: 7, y: 10 });
    expect(edgeBetween({ x: 8, y: 10 }, { x: 7, y: 10 })).toEqual({ dir: 'h', x: 7, y: 10 });
    expect(edgeBetween({ x: 12, y: 7 }, { x: 12, y: 8 })).toEqual({ dir: 'v', x: 12, y: 7 });
    expect(edgeBetween({ x: 12, y: 8 }, { x: 12, y: 7 })).toEqual({ dir: 'v', x: 12, y: 7 });
  });

  it('has no edge between nodes that are not 4-neighbours', () => {
    expect(edgeBetween({ x: 0, y: 0 }, { x: 1, y: 1 })).toBeUndefined();
    expect(edgeBetween({ x: 0, y: 0 }, { x: 2, y: 0 })).toBeUndefined();
    expect(edgeBetween({ x: 0, y: 0 }, { x: 0, y: 0 })).toBeUndefined();
  });

  it('describes a door node by its two wall edges and the nodes on both sides', () => {
    expect(doorEdges({ x: 12, y: 8 }, 'h')).toEqual([
      { dir: 'h', x: 11, y: 8 },
      { dir: 'h', x: 12, y: 8 },
    ]);
    expect(doorEdges({ x: 8, y: 10 }, 'v')).toEqual([
      { dir: 'v', x: 8, y: 9 },
      { dir: 'v', x: 8, y: 10 },
    ]);
    expect(doorSideNodes({ x: 12, y: 8 }, 'h')).toEqual([
      { x: 12, y: 7 },
      { x: 12, y: 9 },
    ]);
    expect(doorSideNodes({ x: 8, y: 10 }, 'v')).toEqual([
      { x: 7, y: 10 },
      { x: 9, y: 10 },
    ]);
  });
});

/**
 * Nodes x 0..4, y 0..2 with a wall along x = 2: wall nodes are not walkable, only the door node
 * (2, 1) is. The wall runs along the edges v(2, 0) and v(2, 1).
 */
function twoRoomFloor() {
  const nodes = [];
  for (let y = 0; y <= 2; y += 1) {
    for (let x = 0; x <= 4; x += 1) if (x !== 2 || y === 1) nodes.push({ x, y });
  }
  const blocked = new Set([edgeKey({ dir: 'v', x: 2, y: 0 }), edgeKey({ dir: 'v', x: 2, y: 1 })]);
  return createWalkGrid(nodes, blocked);
}

describe('walk grid', () => {
  it('blocks wall nodes, allows the door node and rejects steps off the floor', () => {
    const grid = twoRoomFloor();
    expect(grid.canStep({ x: 1, y: 0 }, { x: 2, y: 0 })).toBe(false);
    expect(grid.canStep({ x: 1, y: 1 }, { x: 2, y: 1 })).toBe(true);
    expect(grid.canStep({ x: 2, y: 1 }, { x: 3, y: 1 })).toBe(true);
    expect(grid.canStep({ x: 4, y: 0 }, { x: 5, y: 0 })).toBe(false);
    expect(grid.canStep({ x: 0, y: 0 }, { x: 1, y: 1 })).toBe(false);
  });

  it('does not walk along a wall, even between two walkable nodes', () => {
    const grid = createWalkGrid(
      [
        { x: 2, y: 0 },
        { x: 2, y: 1 },
      ],
      new Set([edgeKey({ dir: 'v', x: 2, y: 0 })]),
    );
    expect(grid.canStep({ x: 2, y: 0 }, { x: 2, y: 1 })).toBe(false);
  });

  it('lists only reachable neighbours', () => {
    expect(twoRoomFloor().neighbours({ x: 1, y: 1 })).toEqual([
      { x: 2, y: 1 },
      { x: 0, y: 1 },
      { x: 1, y: 2 },
      { x: 1, y: 0 },
    ]);
    expect(twoRoomFloor().neighbours({ x: 1, y: 0 })).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ]);
  });

  it('finds the shortest path through the door', () => {
    const path = findNodePath(twoRoomFloor(), { x: 0, y: 0 }, { x: 4, y: 0 });
    expect(path).toHaveLength(7);
    expect(path?.[0]).toEqual({ x: 0, y: 0 });
    expect(path?.at(-1)).toEqual({ x: 4, y: 0 });
    expect(path).toContainEqual({ x: 2, y: 1 });
  });

  it('finds no path when the rooms are sealed or a node is off the floor', () => {
    const sealed = createWalkGrid(
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      new Set([edgeKey({ dir: 'h', x: 0, y: 0 })]),
    );
    expect(findNodePath(sealed, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeUndefined();
    expect(findNodePath(sealed, { x: 0, y: 0 }, { x: 5, y: 5 })).toBeUndefined();
  });

  it('exports a nav graph with pixel positions relative to the pivot, one link per pair', () => {
    const graph = toNavGraph(twoRoomFloor(), { x: 32, y: 16 });
    expect(graph.nodes).toHaveLength(13);
    expect(graph.nodes[0]).toEqual({ node: { x: 0, y: 0 }, x: 0 - 32, y: 0 - 16 });
    // Each room is 2x3 nodes (7 links), plus 2 links of the door node.
    expect(graph.links).toHaveLength(7 + 7 + 2);
    expect(new Set(graph.links.map(([a, b]) => `${a}-${b}`)).size).toBe(graph.links.length);
  });
});
