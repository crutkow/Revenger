import { describe, expect, it } from 'vitest';
import { ASTEROID_TIERS, SPLIT_CHILD_COUNT, splitChildren, splitTier } from './asteroids';

describe('splitTier', () => {
  it('big -> medium, medium -> small, small -> nothing', () => {
    expect(splitTier('big')).toBe('medium');
    expect(splitTier('medium')).toBe('small');
    expect(splitTier('small')).toBeNull();
  });
});

describe('splitChildren', () => {
  it('breaks into two asteroids of the next tier', () => {
    expect(splitChildren('big')).toEqual(['medium', 'medium']);
    expect(splitChildren('medium')).toEqual(['small', 'small']);
    expect(SPLIT_CHILD_COUNT).toBe(2);
  });

  it('leaves nothing behind for small asteroids', () => {
    expect(splitChildren('small')).toEqual([]);
  });
});

describe('ASTEROID_TIERS', () => {
  it('uses a distinct atlas frame per tier', () => {
    const frames = Object.values(ASTEROID_TIERS).map((t) => t.frame);
    expect(new Set(frames).size).toBe(3);
  });
});
