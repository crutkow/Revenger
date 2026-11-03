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

/**
 * Atlas textures are loaded from `public/assets/ships/`; the starfield and
 * particle textures are still generated procedurally in PreloadScene.
 */
export const TextureKeys = {
  /** Ship parts atlas (`poer_atlas.png`). */
  PoerAtlas: 'atlas-poer',
  /** Ship, bullet and asteroid sprites (`space_atlas.png`). */
  SpaceAtlas: 'atlas-space',
  Starfield: 'tex-starfield',
  Particle: 'tex-particle',
} as const;
export type TextureKey = (typeof TextureKeys)[keyof typeof TextureKeys];

/** Keys for non-texture loaded assets. */
export const AssetKeys = {
  PoerAtlasDescriptor: 'desc-atlas-poer',
  SpaceAtlasDescriptor: 'desc-atlas-space',
  /** Player spaceship blueprint (`ships/spaceship_01.json`). */
  PlayerSpaceship: 'blueprint-spaceship-01',
} as const;

/** Frame names in `space_atlas.json`. */
export const SpaceFrames = {
  Ship: 'ship-small',
  Bullet: 'ship-bullet',
  AsteroidBig: 'asteroid-big',
  AsteroidMedium: 'asteroid-medium',
  AsteroidSmall: 'asteroid-small',
} as const;
export type SpaceFrame = (typeof SpaceFrames)[keyof typeof SpaceFrames];

/**
 * Heading (math angle, 0 = +X, clockwise on screen) that a sprite faces when its
 * `angle` is 0. The atlas sprites are drawn nose-up, i.e. facing -90°.
 * sprite.angle = heading - SPRITE_FACING_DEG, so change this if art is redrawn.
 */
export const SPRITE_FACING_DEG = -90;

/** Render order inside the Phaser scene. */
export const Depths = {
  StarfieldFar: 0,
  StarfieldNear: 10,
  /** Faint marker drawn at world (0, 0). */
  OriginMarker: 15,
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
  /** Display scale of the blueprint-built spaceship (1 = atlas pixels; issue #6: no downscale). */
  spaceshipScale: 1,
  /**
   * Virtual vertical resolution of the camera in world units. The camera zoom is
   * `screenHeight / viewHeight`, so the ship stays full-size while a taller area of
   * space is visible (bigger value = more world on screen, smaller ship on screen).
   */
  viewHeight: 2880,
  /** Where the ship sits vertically on screen (0 = top, 0.5 = centre, 1 = bottom). */
  shipScreenY: 0.6,
  playerStartShields: 3,
  playerInvulnerableMs: 1500,
  bulletSpeed: 620,
  bulletLifespanMs: 1100,
  fireCooldownMs: 180,
  asteroidSpawnMs: 900,
  /** Cap for timed spawns only; split children may exceed it. */
  asteroidMaxCount: 18,
  /** Display scale of every asteroid tier (issue #6). */
  asteroidScale: 2,
  asteroidMinSpeed: 70,
  asteroidMaxSpeed: 170,
  /** Extra distance beyond the farthest view corner where asteroids appear (world units). */
  asteroidSpawnMargin: 200,
  /** Asteroids farther than `spawn radius * this` from the ship are removed. */
  asteroidDespawnFactor: 1.5,
  /** Speed added to split children, in opposite directions (world units / s). */
  asteroidSplitSpeed: 90,
  scorePerAsteroid: 10,
  /** Parallax factors of the star layers relative to ship movement. */
  starfieldFarParallax: 0.15,
  starfieldNearParallax: 0.4,
} as const;

export const StorageKeys = {
  HighScore: 'revenger:high-score',
} as const;
