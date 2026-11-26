import type { PxPoint } from './blueprintTypes';

/**
 * Pure crew walking logic (issue #8, placeholder AI). A crew member patrols a fixed path:
 * it walks to the last point, waits, walks back, waits, and so on.
 */

/** Frame names in `poer_atlas.json`. The art faces down (+y) at rotation 0. */
export const CREW_FRAMES = {
  idle: 'crew-member-idle',
  walk: ['crew-member-walk-1', 'crew-member-walk-2'],
} as const;

export interface WalkerState {
  x: number;
  y: number;
  /** Index of the path point being walked to. */
  index: number;
  /** 1 = towards the end of the path, -1 = back to the start. */
  dir: 1 | -1;
  waitMs: number;
  /** Direction of the last step, as a math angle in radians (0 = +x, y points down). */
  heading: number;
  /** True when the last step moved the walker. */
  moving: boolean;
}

export function createWalker(path: readonly PxPoint[]): WalkerState {
  const start = path[0] ?? { x: 0, y: 0 };
  const next = path[1];
  return {
    x: start.x,
    y: start.y,
    index: next ? 1 : 0,
    dir: 1,
    waitMs: 0,
    heading: next ? Math.atan2(next.y - start.y, next.x - start.x) : Math.PI / 2,
    moving: false,
  };
}

/** Advances the walker by `dtMs`. Waits `endWaitMs` at both ends of the path. */
export function stepWalker(
  state: WalkerState,
  path: readonly PxPoint[],
  dtMs: number,
  speedPxPerSec: number,
  endWaitMs: number,
): void {
  state.moving = false;
  if (path.length < 2) return;

  let remainingMs = dtMs;
  if (state.waitMs > 0) {
    const used = Math.min(state.waitMs, remainingMs);
    state.waitMs -= used;
    remainingMs -= used;
  }

  let budget = (speedPxPerSec * remainingMs) / 1000;
  while (budget > 0) {
    const target = path[state.index];
    if (!target) return;
    const dx = target.x - state.x;
    const dy = target.y - state.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 0) state.heading = Math.atan2(dy, dx);

    if (dist > budget) {
      state.x += (dx / dist) * budget;
      state.y += (dy / dist) * budget;
      state.moving = true;
      return;
    }

    state.x = target.x;
    state.y = target.y;
    budget -= dist;
    if (dist > 0) state.moving = true;

    const atEnd = state.index + state.dir < 0 || state.index + state.dir >= path.length;
    if (atEnd) state.dir = state.dir === 1 ? -1 : 1;
    state.index += state.dir;
    if (atEnd) {
      state.waitMs = endWaitMs;
      return;
    }
  }
}
