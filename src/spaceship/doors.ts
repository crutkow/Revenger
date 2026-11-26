import type { DoorLayout, PxPoint } from './blueprintTypes';

/**
 * Pure sliding door logic (issue #8). No Phaser here: door state stepping and the pose
 * (position + crop) of a door leaf.
 */

export interface DoorState {
  /** 0 = closed, 1 = fully open. */
  progress: number;
  /** Time left before a door without anyone nearby starts closing. */
  closeInMs: number;
}

export const createDoorState = (): DoorState => ({ progress: 0, closeInMs: 0 });

/**
 * Opens while someone is near. Once nobody is near it waits `closeDelayMs`, then closes.
 */
export function stepDoor(
  state: DoorState,
  near: boolean,
  dtMs: number,
  slideMs: number,
  closeDelayMs: number,
): void {
  if (near) {
    state.closeInMs = closeDelayMs;
    state.progress = Math.min(1, state.progress + dtMs / slideMs);
    return;
  }
  if (state.closeInMs > 0) {
    state.closeInMs = Math.max(0, state.closeInMs - dtMs);
    return;
  }
  state.progress = Math.max(0, state.progress - dtMs / slideMs);
}

/** True when any point is within `radius` of the door centre. */
export function isNearDoor(door: DoorLayout, points: readonly PxPoint[], radius: number): boolean {
  return points.some((p) => Math.hypot(p.x - door.x, p.y - door.y) <= radius);
}

export interface LeafPose {
  /** Sprite centre relative to the pivot. */
  x: number;
  y: number;
}

/**
 * Position of one door leaf. `side` -1 is the left/top leaf, 1 the right/bottom one.
 * The slide is rounded to whole pixels to keep the pixel art sharp.
 */
export function leafPose(door: DoorLayout, side: -1 | 1, progress: number): LeafPose {
  const offset = Math.round(door.travel * Math.min(1, Math.max(0, progress)));
  const centre = side * (door.leafLength / 2 + offset);
  return door.axis === 'h' ? { x: door.x + centre, y: door.y } : { x: door.x, y: door.y + centre };
}
