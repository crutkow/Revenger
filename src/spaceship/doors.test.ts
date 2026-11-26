import { describe, expect, it } from 'vitest';
import type { DoorLayout } from './blueprintTypes';
import { createDoorState, isNearDoor, leafPose, stepDoor } from './doors';

/** Door on a horizontal wall edge: 12 px leaves, each slides one leaf length. */
const hDoor: DoorLayout = {
  x: 100,
  y: 50,
  axis: 'h',
  leafLength: 12,
  travel: 12,
};

describe('leafPose', () => {
  it('closed: the two leaves sit side by side', () => {
    expect(leafPose(hDoor, -1, 0)).toEqual({ x: 94, y: 50 });
    expect(leafPose(hDoor, 1, 0)).toEqual({ x: 106, y: 50 });
  });

  it('open: the leaves moved apart by one leaf length each', () => {
    expect(leafPose(hDoor, -1, 1)).toEqual({ x: 82, y: 50 });
    expect(leafPose(hDoor, 1, 1)).toEqual({ x: 118, y: 50 });
  });

  it('slides along y for a vertical door', () => {
    const vDoor: DoorLayout = { ...hDoor, axis: 'v' };
    expect(leafPose(vDoor, -1, 1)).toEqual({ x: 100, y: 32 });
    expect(leafPose(vDoor, 1, 0)).toEqual({ x: 100, y: 56 });
  });

  it('rounds to whole pixels and clamps progress', () => {
    expect(leafPose(hDoor, 1, 0.3).x).toBe(106 + 4);
    expect(leafPose(hDoor, 1, 5).x).toBe(118);
    expect(leafPose(hDoor, 1, -1).x).toBe(106);
  });
});

describe('stepDoor', () => {
  const run = (near: boolean, ms: number, state = createDoorState()) => {
    stepDoor(state, near, ms, 250, 300);
    return state;
  };

  it('opens over the slide time and stays open', () => {
    const state = run(true, 125);
    expect(state.progress).toBeCloseTo(0.5);
    run(true, 500, state);
    expect(state.progress).toBe(1);
  });

  it('waits for the close delay, then closes over the slide time', () => {
    const state = run(true, 1000);
    run(false, 200, state);
    expect(state.progress).toBe(1);
    run(false, 100, state); // delay runs out
    expect(state.progress).toBe(1);
    run(false, 100, state); // closing starts
    expect(state.progress).toBeCloseTo(0.6);
    run(false, 1000, state);
    expect(state.progress).toBe(0);
  });

  it('opens again when someone returns while closing', () => {
    const state = run(true, 1000);
    run(false, 300, state); // delay runs out
    run(false, 125, state); // half closed
    expect(state.progress).toBeCloseTo(0.5);
    run(true, 50, state);
    expect(state.progress).toBeCloseTo(0.7);
  });
});

describe('isNearDoor', () => {
  it('uses the distance to the door centre', () => {
    expect(isNearDoor(hDoor, [{ x: 100, y: 66 }], 16)).toBe(true);
    expect(isNearDoor(hDoor, [{ x: 100, y: 67 }], 16)).toBe(false);
    expect(isNearDoor(hDoor, [], 16)).toBe(false);
  });
});
