import { describe, expect, it } from 'vitest';
import { clamp, damp, degToRad, lerp, randomInt, wrapAngleDeg } from './math';

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
