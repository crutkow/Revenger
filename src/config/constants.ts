/** Design resolution. The Scale Manager uses RESIZE, so treat these as a reference frame. */
export const DESIGN_WIDTH = 1280;
export const DESIGN_HEIGHT = 720;

export const SceneKeys = {
  Boot: 'boot',
  Preload: 'preload',
  MainMenu: 'main-menu',
  Battle: 'battle',
  Shipyard: 'shipyard',
} as const;
export type SceneKey = (typeof SceneKeys)[keyof typeof SceneKeys];

/** Procedural textures are generated in PreloadScene; the ship atlases are real files. */
export const TextureKeys = {
  Bullet: 'tex-bullet',
  Asteroid: 'tex-asteroid',
  Starfield: 'tex-starfield',
  Particle: 'tex-particle',
  ShipAtlasGse: 'atlas-ship-gse',
  ShipAtlasPoer: 'atlas-ship-poer',
} as const;
export type TextureKey = (typeof TextureKeys)[keyof typeof TextureKeys];

/** Faction skins, both sharing the tile layout described in `shipAtlas.ts`. */
export const ShipFactions = {
  Gse: TextureKeys.ShipAtlasGse,
  Poer: TextureKeys.ShipAtlasPoer,
} as const;
export type ShipFaction = (typeof ShipFactions)[keyof typeof ShipFactions];

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

  // Capital ship (issue #2) — heavier, slower, turret-armed.
  capitalMaxIntegrity: 100,
  capitalAsteroidDamage: 10,
  capitalInvulnerableMs: 600,
  capitalMass: 40,
  capitalThrust: 160,
  capitalMaxSpeed: 220,
  capitalDrag: 0.6,
  capitalTurnAccel: 90, // degrees / s²
  capitalAngularDrag: 0.85,
  capitalFireCooldownMs: 140,
  /** World-space rendering scale of the capital ship (the layout is 384×640 px). */
  capitalScale: 0.75,
  /** Camera zoom in battle so the ship and its surroundings fit comfortably. */
  battleZoom: 0.9,
} as const;

export const StorageKeys = {
  HighScore: 'revenger:high-score',
} as const;
