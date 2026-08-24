import type Phaser from 'phaser';
import { StorageKeys } from '@/config/constants';

/**
 * Typed wrapper around Phaser's global registry (shared data across scenes),
 * with the high score mirrored into localStorage.
 */
export interface GameState {
  score: number;
  highScore: number;
  shields: number;
}

export const DEFAULT_STATE: GameState = {
  score: 0,
  highScore: 0,
  shields: 0,
};

function readStoredHighScore(): number {
  try {
    const raw = localStorage.getItem(StorageKeys.HighScore);
    const value = raw === null ? 0 : Number.parseInt(raw, 10);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    // Private browsing / blocked storage — fail soft.
    return 0;
  }
}

function writeStoredHighScore(value: number): void {
  try {
    localStorage.setItem(StorageKeys.HighScore, String(value));
  } catch {
    /* ignore */
  }
}

export function initState(game: Phaser.Game): void {
  game.registry.set({ ...DEFAULT_STATE, highScore: readStoredHighScore() });
}

export function getState<K extends keyof GameState>(scene: Phaser.Scene, key: K): GameState[K] {
  const value = scene.registry.get(key) as GameState[K] | undefined;
  return value ?? DEFAULT_STATE[key];
}

export function setState<K extends keyof GameState>(
  scene: Phaser.Scene,
  key: K,
  value: GameState[K],
): void {
  scene.registry.set(key, value);
}

export interface HighScoreResult {
  highScore: number;
  isNewRecord: boolean;
}

/** Commits `score` as the new high score when it beats the stored one. */
export function commitHighScore(scene: Phaser.Scene, score: number): HighScoreResult {
  const current = getState(scene, 'highScore');
  if (score <= current) {
    return { highScore: current, isNewRecord: false };
  }
  setState(scene, 'highScore', score);
  writeStoredHighScore(score);
  return { highScore: score, isNewRecord: true };
}
