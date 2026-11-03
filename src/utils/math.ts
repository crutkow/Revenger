/** Small, engine-agnostic math helpers (unit-testable without Phaser/Pixi). */

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * clamp(t, 0, 1);
}

/** Frame-rate independent smoothing. `rate` is the fraction closed per 16.67ms. */
export function damp(from: number, to: number, rate: number, deltaMs: number): number {
  const t = 1 - Math.pow(1 - clamp(rate, 0, 1), deltaMs / (1000 / 60));
  return lerp(from, to, t);
}

/** Normalises degrees into [-180, 180). */
export function wrapAngleDeg(degrees: number): number {
  const wrapped = ((degrees + 180) % 360 + 360) % 360;
  return wrapped - 180;
}

export function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function randomInt(min: number, max: number): number {
  return Math.floor(randomRange(min, max + 1));
}

/** Compass heading in [0, 360): 0 = nose up (north), increasing clockwise. */
export function compassHeadingDeg(angleDeg: number): number {
  return ((angleDeg % 360) + 360) % 360;
}

/** World Y (Phaser, grows downwards) to display Y (grows upwards). Never returns -0. */
export function worldToDisplayY(y: number): number {
  return -y + 0;
}

/** A random point on the circle of `radius` around (cx, cy). */
export function randomPointOnRing(
  cx: number,
  cy: number,
  radius: number,
): { x: number; y: number } {
  const angle = Math.random() * Math.PI * 2;
  return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
}

/**
 * Distance from the pivot point (fraction of the view) to the farthest corner of a
 * `viewWidth × viewHeight` rectangle. Anything beyond it is off-screen at any camera rotation.
 */
export function farthestCornerDistance(
  viewWidth: number,
  viewHeight: number,
  pivotXFraction: number,
  pivotYFraction: number,
): number {
  const dx = Math.max(pivotXFraction, 1 - pivotXFraction) * viewWidth;
  const dy = Math.max(pivotYFraction, 1 - pivotYFraction) * viewHeight;
  return Math.hypot(dx, dy);
}

/** Picks a point on the perimeter of a w×h rectangle, `margin` px outside it. */
export function randomPointOutsideRect(
  width: number,
  height: number,
  margin: number,
): { x: number; y: number } {
  switch (randomInt(0, 3)) {
    case 0:
      return { x: randomRange(0, width), y: -margin };
    case 1:
      return { x: width + margin, y: randomRange(0, height) };
    case 2:
      return { x: randomRange(0, width), y: height + margin };
    default:
      return { x: -margin, y: randomRange(0, height) };
  }
}
