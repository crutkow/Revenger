/** Design resolution. The Scale Manager uses RESIZE, so treat these as a reference frame. */
export const DESIGN_WIDTH = 1280;
export const DESIGN_HEIGHT = 720;

export const SceneKeys = {
  Boot: 'boot',
  Preload: 'preload',
  MainMenu: 'main-menu',
  Battle: 'battle',
} as const;
export type SceneKey = (typeof SceneKeys)[keyof typeof SceneKeys];

/** Textures are generated procedurally in PreloadScene, so no binary assets are required. */
export const TextureKeys = {
  Ship: 'tex-ship',
  Bullet: 'tex-bullet',
  Asteroid: 'tex-asteroid',
  Starfield: 'tex-starfield',
  Particle: 'tex-particle',
} as const;
export type TextureKey = (typeof TextureKeys)[keyof typeof TextureKeys];

/** Render order inside the Phaser scene. */
export const Depths = {
  StarfieldFar: 0,
  StarfieldNear: 10,
  Asteroids: 20,
  Bullets: 30,
  Player: 40,
  Effects: 50,
} as const;

export const Palette = {
  Space: 0x05070f,
  Hud: 0x6ef2ff,
  Hull: 0xd7e3ff,
  Thruster: 0xff9f45,
  Bullet: 0xfff3a0,
  Asteroid: 0x8a94ad,
  Danger: 0xff5470,
} as const;

export const Gameplay = {
  playerMaxSpeed: 340,
  playerThrust: 420,
  playerTurnRate: 220, // degrees / second
  playerDrag: 0.55,
  playerStartShields: 3,
  playerInvulnerableMs: 1500,
  bulletSpeed: 620,
  bulletLifespanMs: 1100,
  fireCooldownMs: 180,
  asteroidSpawnMs: 900,
  asteroidMaxCount: 18,
  scorePerAsteroid: 10,
} as const;

export const StorageKeys = {
  HighScore: 'revenger:high-score',
} as const;
