import { SpaceFrames } from '@/config/constants';

/** Engine-agnostic asteroid size rules (unit-testable without Phaser). */
export type AsteroidTier = 'big' | 'medium' | 'small';

export interface AsteroidTierInfo {
  frame: (typeof SpaceFrames)[keyof typeof SpaceFrames];
  /** Bigger rocks drift slower. */
  speedFactor: number;
  explosionScale: number;
  /** Tier of the children after a hit; `null` means the rock just disappears. */
  splitInto: AsteroidTier | null;
}

/** How many children a hit asteroid breaks into (when it has a smaller tier). */
export const SPLIT_CHILD_COUNT = 2;

export const ASTEROID_TIERS: Readonly<Record<AsteroidTier, AsteroidTierInfo>> = {
  big: {
    frame: SpaceFrames.AsteroidBig,
    speedFactor: 0.7,
    explosionScale: 1.3,
    splitInto: 'medium',
  },
  medium: {
    frame: SpaceFrames.AsteroidMedium,
    speedFactor: 1,
    explosionScale: 1,
    splitInto: 'small',
  },
  small: {
    frame: SpaceFrames.AsteroidSmall,
    speedFactor: 1.5,
    explosionScale: 0.65,
    splitInto: null,
  },
};

export const ASTEROID_TIER_NAMES = Object.keys(ASTEROID_TIERS) as AsteroidTier[];

/** Tier of the children of a hit asteroid, or `null` when nothing is left. */
export function splitTier(tier: AsteroidTier): AsteroidTier | null {
  return ASTEROID_TIERS[tier].splitInto;
}

/** The tiers (in order) produced by hitting an asteroid of the given tier. */
export function splitChildren(tier: AsteroidTier): AsteroidTier[] {
  const next = splitTier(tier);
  return next === null ? [] : Array.from({ length: SPLIT_CHILD_COUNT }, () => next);
}
