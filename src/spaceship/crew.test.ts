import { describe, expect, it } from 'vitest';
import { createWalker, stepWalker } from './crew';

const path = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 50 },
];

describe('stepWalker', () => {
  it('starts at the first point heading to the second', () => {
    const w = createWalker(path);
    expect(w).toMatchObject({ x: 0, y: 0, index: 1, moving: false });
  });

  it('walks at the given speed', () => {
    const w = createWalker(path);
    stepWalker(w, path, 500, 100, 0);
    expect(w.x).toBeCloseTo(50);
    expect(w.moving).toBe(true);
    expect(w.heading).toBe(0);
  });

  it('turns corners within one step', () => {
    const w = createWalker(path);
    stepWalker(w, path, 1200, 100, 0); // 120 px: 100 along x, 20 along y
    expect(w.x).toBeCloseTo(100);
    expect(w.y).toBeCloseTo(20);
    expect(w.heading).toBeCloseTo(Math.PI / 2);
  });

  it('waits at the end, then walks back', () => {
    const w = createWalker(path);
    stepWalker(w, path, 2000, 100, 1000); // reaches the end (150 px) and waits
    expect(w).toMatchObject({ x: 100, y: 50, dir: -1 });
    stepWalker(w, path, 500, 100, 1000);
    expect(w.moving).toBe(false);
    expect(w.y).toBe(50);
    stepWalker(w, path, 1000, 100, 1000); // 500 ms wait left, then 500 ms walking back
    expect(w.y).toBeCloseTo(0);
    expect(w.moving).toBe(true);
  });

  it('stays put with a single point', () => {
    const one = [{ x: 5, y: 5 }];
    const w = createWalker(one);
    stepWalker(w, one, 1000, 100, 0);
    expect(w).toMatchObject({ x: 5, y: 5, moving: false });
  });
});
