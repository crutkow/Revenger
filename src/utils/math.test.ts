import { describe, expect, it } from 'vitest';
import {
  clamp,
  compassHeadingDeg,
  damp,
  degToRad,
  farthestCornerDistance,
  lerp,
  randomInt,
  randomPointOnRing,
  worldToDisplayY,
  wrapAngleDeg,
} from './math';

describe('compassHeadingDeg', () => {
  it('maps to [0, 360) with 0 = nose up, clockwise', () => {
    expect(compassHeadingDeg(0)).toBe(0);
    expect(compassHeadingDeg(90)).toBe(90);
    expect(compassHeadingDeg(-90)).toBe(270);
    expect(compassHeadingDeg(360)).toBe(0);
    expect(compassHeadingDeg(-1)).toBe(359);
    expect(compassHeadingDeg(725)).toBe(5);
  });
});

describe('worldToDisplayY', () => {
  it('flips the axis so up is positive', () => {
    expect(worldToDisplayY(100)).toBe(-100);
    expect(worldToDisplayY(-50)).toBe(50);
    expect(Object.is(worldToDisplayY(0), 0)).toBe(true);
  });
});

describe('randomPointOnRing', () => {
  it('returns points at the requested radius around the centre', () => {
    for (let i = 0; i < 20; i += 1) {
      const p = randomPointOnRing(10, -20, 300);
      expect(Math.hypot(p.x - 10, p.y + 20)).toBeCloseTo(300, 6);
    }
  });
});

describe('farthestCornerDistance', () => {
  it('measures from the pivot to the farthest corner', () => {
    expect(farthestCornerDistance(200, 100, 0.5, 0.5)).toBeCloseTo(Math.hypot(100, 50));
    // Pivot at 60% height: the farthest edge is the top (60% of the height away).
    expect(farthestCornerDistance(200, 100, 0.5, 0.6)).toBeCloseTo(Math.hypot(100, 60));
  });
});

describe('clamp', () => {
  it('keeps values inside the range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(50, 0, 10)).toBe(10);
  });
});

describe('lerp', () => {
  it('interpolates and clamps t', () => {
    expect(lerp(0, 100, 0.5)).toBe(50);
    expect(lerp(0, 100, -1)).toBe(0);
    expect(lerp(0, 100, 2)).toBe(100);
  });
});

describe('damp', () => {
  it('approaches the target without overshooting', () => {
    const step = damp(0, 100, 0.25, 1000 / 60);
    expect(step).toBeGreaterThan(0);
    expect(step).toBeLessThan(100);
  });

  it('is frame-rate independent (bigger delta closes more distance)', () => {
    const small = damp(0, 100, 0.25, 8);
    const large = damp(0, 100, 0.25, 32);
    expect(large).toBeGreaterThan(small);
  });
});

describe('wrapAngleDeg', () => {
  it('normalises into [-180, 180)', () => {
    expect(wrapAngleDeg(0)).toBe(0);
    expect(wrapAngleDeg(190)).toBe(-170);
    expect(wrapAngleDeg(-190)).toBe(170);
    expect(wrapAngleDeg(720)).toBe(0);
  });
});

describe('degToRad', () => {
  it('converts degrees to radians', () => {
    expect(degToRad(180)).toBeCloseTo(Math.PI);
  });
});

describe('randomInt', () => {
  it('stays within the inclusive bounds', () => {
    for (let i = 0; i < 200; i += 1) {
      const value = randomInt(2, 5);
      expect(value).toBeGreaterThanOrEqual(2);
      expect(value).toBeLessThanOrEqual(5);
      expect(Number.isInteger(value)).toBe(true);
    }
  });
});
