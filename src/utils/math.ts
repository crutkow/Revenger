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
