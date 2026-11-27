import Phaser from 'phaser';
import { AssetKeys, Depths, Gameplay, Palette, SceneKeys, TextureKeys } from '@/config/constants';
import { EventBus } from '@/core/EventBus';
import { commitHighScore, setState } from '@/core/Registry';
import { Bullet } from '@/entities/Bullet';
import { Spaceship } from '@/entities/Spaceship';
import type { SpaceshipBlueprint } from '@/spaceship/blueprintTypes';
import {
  ASTEROID_TIERS,
  ASTEROID_TIER_NAMES,
  splitChildren,
  type AsteroidTier,
} from '@/utils/asteroids';
import {
  compassHeadingDeg,
  farthestCornerDistance,
  randomPointOnRing,
  randomRange,
  worldToDisplayY,
} from '@/utils/math';

/** Asteroids are plain physics sprites — no custom class needed. */
type Asteroid = Phaser.Physics.Arcade.Sprite;

const ASTEROID_TIER_KEY = 'tier';
/** Initial asteroids never appear closer than this to the ship (world units). */
const INITIAL_ASTEROID_MIN_DISTANCE = 700;

interface InputKeys {
  thrust: Phaser.Input.Keyboard.Key[];
  left: Phaser.Input.Keyboard.Key[];
  right: Phaser.Input.Keyboard.Key[];
  fire: Phaser.Input.Keyboard.Key[];
}

export class BattleScene extends Phaser.Scene {
  private player!: Spaceship;
  private bullets!: Phaser.Physics.Arcade.Group;
  private asteroids!: Phaser.Physics.Arcade.Group;
  private starfieldFar!: Phaser.GameObjects.TileSprite;
  private starfieldNear!: Phaser.GameObjects.TileSprite;
  private keys!: InputKeys;
  private spawnTimer?: Phaser.Time.TimerEvent;
  private score = 0;
  private isGameOver = false;

  constructor() {
    super(SceneKeys.Battle);
  }

  create(): void {
    this.score = 0;
    this.isGameOver = false;
    this.cameras.main.fadeIn(240, 0, 0, 0);

    this.createBackground();
    this.createOriginMarker();

    // The ship spawns at the centre of the world map, (0, 0).
    const blueprint = this.cache.json.get(AssetKeys.PlayerSpaceship) as SpaceshipBlueprint;
    this.player = new Spaceship(this, 0, 0, blueprint);
    this.player.setDepth(Depths.Player);

    this.bullets = this.physics.add.group({ classType: Bullet, maxSize: 48 });
    // No maxSize: split children must always fit. Timed spawns check the cap themselves.
    this.asteroids = this.physics.add.group();

    this.physics.add.overlap(this.bullets, this.asteroids, (bulletObj, asteroidObj) => {
      this.handleBulletHitAsteroid(bulletObj as Bullet, asteroidObj as Asteroid);
    });
    this.physics.add.overlap(this.player, this.asteroids, (_playerObj, asteroidObj) => {
      this.handlePlayerHitAsteroid(asteroidObj as Asteroid);
    });

    this.bindInput();

    this.spawnTimer = this.time.addEvent({
      delay: Gameplay.asteroidSpawnMs,
      loop: true,
      callback: this.spawnAsteroid,
      callbackScope: this,
    });
    for (let i = 0; i < 4; i += 1) this.spawnAsteroid(true);

    this.publishScore();
    this.publishShields();
    EventBus.emit('hud:message', 'ENGAGE', 1200);

    this.applyCameraView();
    this.layoutStarfield();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    // Runs after Arcade's own POST_UPDATE, so the ship transform is already synced.
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, this.syncCamera, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
  }

  override update(_time: number, delta: number): void {
    if (this.isGameOver) return;

    this.player.updateInterior(delta);

    const isDown = (keys: Phaser.Input.Keyboard.Key[]): boolean => keys.some((key) => key.isDown);

    this.player.applyThrust(isDown(this.keys.thrust));
    const turn = (isDown(this.keys.right) ? 1 : 0) - (isDown(this.keys.left) ? 1 : 0);
    this.player.steer(turn as -1 | 0 | 1);

    if (isDown(this.keys.fire)) this.fire();

    this.despawnFarAsteroids();
  }

  /** Camera zoom so that `Gameplay.viewHeight` world units fit the screen height. */
  private get cameraZoom(): number {
    return this.scale.height / Gameplay.viewHeight;
  }

  /** Visible world size (unrotated) in world units. */
  private get viewSize(): { width: number; height: number } {
    const zoom = this.cameraZoom;
    return { width: this.scale.width / zoom, height: this.scale.height / zoom };
  }

  /** Distance from the ship to the farthest point that can ever be on screen. */
  private get viewRadius(): number {
    const { width, height } = this.viewSize;
    return farthestCornerDistance(width, height, 0.5, Gameplay.shipScreenY);
  }

  private get spawnRadius(): number {
    return this.viewRadius + Gameplay.asteroidSpawnMargin;
  }

  private applyCameraView(): void {
    const camera = this.cameras.main;
    // The camera pivot (rotation + zoom centre) is where the ship sits on screen.
    camera.setOrigin(0.5, Gameplay.shipScreenY);
    camera.setZoom(this.cameraZoom);
  }

  /**
   * Pins the camera to the ship: the ship stays at the pivot, the nose always points
   * up the screen and the world rotates around it.
   */
  private syncCamera(): void {
    const camera = this.cameras.main;
    camera.setRotation(-this.player.rotation);
    camera.setScroll(
      this.player.x - camera.width * camera.originX,
      this.player.y - camera.height * camera.originY,
    );

    // Parallax: star layers follow the ship at different rates. They live in the
    // (rotating) world frame, so their tile offset is simply the scaled ship position.
    this.starfieldFar.setTilePosition(
      (this.player.x * Gameplay.starfieldFarParallax) / this.starfieldFar.tileScaleX,
      (this.player.y * Gameplay.starfieldFarParallax) / this.starfieldFar.tileScaleY,
    );
    this.starfieldNear.setTilePosition(
      (this.player.x * Gameplay.starfieldNearParallax) / this.starfieldNear.tileScaleX,
      (this.player.y * Gameplay.starfieldNearParallax) / this.starfieldNear.tileScaleY,
    );

    EventBus.emit(
      'hud:ship',
      this.player.x,
      worldToDisplayY(this.player.y),
      compassHeadingDeg(this.player.angle),
    );
  }

  /**
   * Star layers are scroll-factor 0 sprites centred on the camera pivot. The camera
   * matrix rotates/zooms them with the world, so they only need to be big enough to
   * cover the screen at any rotation.
   */
  private createBackground(): void {
    this.starfieldFar = this.add
      .tileSprite(0, 0, 16, 16, TextureKeys.Starfield)
      .setOrigin(0.5)
      .setAlpha(0.35)
      .setScrollFactor(0)
      .setDepth(Depths.StarfieldFar);

    this.starfieldNear = this.add
      .tileSprite(0, 0, 16, 16, TextureKeys.Starfield)
      .setOrigin(0.5)
      .setAlpha(0.7)
      .setTileScale(1.4)
      .setScrollFactor(0)
      .setDepth(Depths.StarfieldNear);
  }

  private layoutStarfield(): void {
    const { width, height } = this.scale;
    const pivotX = width * 0.5;
    const pivotY = height * Gameplay.shipScreenY;
    // Largest distance (in screen px) from the pivot to a screen corner.
    const cover = farthestCornerDistance(width, height, 0.5, Gameplay.shipScreenY);
    const side = Math.ceil((cover * 2) / this.cameraZoom);

    for (const layer of [this.starfieldFar, this.starfieldNear]) {
      layer.setPosition(pivotX, pivotY);
      layer.setSize(side, side);
    }
  }

  /** Faint rings and crosshair marking the world centre (0, 0). */
  private createOriginMarker(): void {
    const g = this.add.graphics().setDepth(Depths.OriginMarker);
    g.lineStyle(3, Palette.Hud, 0.3);
    for (const radius of [150, 400]) g.strokeCircle(0, 0, radius);
    g.lineStyle(2, Palette.Hud, 0.22);
    g.lineBetween(-500, 0, 500, 0);
    g.lineBetween(0, -500, 0, 500);
  }

  private bindInput(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) {
      throw new Error('Keyboard input plugin unavailable');
    }

    const key = (code: number): Phaser.Input.Keyboard.Key => keyboard.addKey(code);
    const KeyCodes = Phaser.Input.Keyboard.KeyCodes;

    this.keys = {
      thrust: [key(KeyCodes.W), key(KeyCodes.UP)],
      left: [key(KeyCodes.A), key(KeyCodes.LEFT)],
      right: [key(KeyCodes.D), key(KeyCodes.RIGHT)],
      fire: [key(KeyCodes.SPACE)],
    };

    keyboard.on('keydown-ESC', () => this.returnToMenu());
    keyboard.on('keydown-G', () => this.player.toggleGridOverlay());
  }

  private fire(): void {
    if (!this.player.canFire()) return;

    const velocity = this.player.body?.velocity;
    for (const muzzle of this.player.getMuzzlePositions()) {
      const bullet = this.bullets.get(0, 0) as Bullet | null;
      if (!bullet) return;
      bullet.fire(muzzle.x, muzzle.y, this.player.heading, velocity?.x ?? 0, velocity?.y ?? 0);
    }
  }

  /**
   * Spawns a random-tier asteroid on a ring just outside the view, drifting toward the
   * ship. `initial` places it closer so the opening screen is not empty.
   */
  private spawnAsteroid(initial = false): void {
    if (this.isGameOver) return;
    if (this.asteroids.countActive(true) >= Gameplay.asteroidMaxCount) return;

    const ring = this.spawnRadius;
    const distance = initial ? randomRange(INITIAL_ASTEROID_MIN_DISTANCE, ring) : ring;
    const spawn = randomPointOnRing(this.player.x, this.player.y, distance);
    const tier = Phaser.Utils.Array.GetRandom(ASTEROID_TIER_NAMES);

    // Aim loosely at the ship so the action finds the player.
    const angle = Phaser.Math.Angle.Between(spawn.x, spawn.y, this.player.x, this.player.y);
    const speed =
      randomRange(Gameplay.asteroidMinSpeed, Gameplay.asteroidMaxSpeed) *
      ASTEROID_TIERS[tier].speedFactor;
    this.createAsteroid(
      tier,
      spawn.x,
      spawn.y,
      Math.cos(angle) * speed + randomRange(-25, 25),
      Math.sin(angle) * speed + randomRange(-25, 25),
    );
  }

  private createAsteroid(
    tier: AsteroidTier,
    x: number,
    y: number,
    vx: number,
    vy: number,
  ): Asteroid {
    const info = ASTEROID_TIERS[tier];
    const asteroid = this.asteroids.create(x, y, TextureKeys.SpaceAtlas, info.frame) as Asteroid;

    asteroid
      .setDepth(Depths.Asteroids)
      .setScale(Gameplay.asteroidScale)
      .setData(ASTEROID_TIER_KEY, tier)
      .setData('explosionScale', info.explosionScale)
      .setAngularVelocity(randomRange(-60, 60));
    // Body radius/offset are in source pixels; Arcade scales them with the sprite.
    asteroid.setCircle(asteroid.width * 0.42, asteroid.width * 0.08, asteroid.height * 0.08);
    asteroid.setVelocity(vx, vy);
    return asteroid;
  }

  /** Removes asteroids that drifted too far from the ship to ever matter. */
  private despawnFarAsteroids(): void {
    const limit = this.spawnRadius * Gameplay.asteroidDespawnFactor;
    const limitSq = limit * limit;
    for (const child of [...this.asteroids.getChildren()]) {
      const asteroid = child as Asteroid;
      const dx = asteroid.x - this.player.x;
      const dy = asteroid.y - this.player.y;
      if (dx * dx + dy * dy > limitSq) asteroid.destroy();
    }
  }

  /** Big -> 2 medium, medium -> 2 small, small -> nothing. Children bypass the spawn cap. */
  private splitAsteroid(asteroid: Asteroid): void {
    const tier = asteroid.getData(ASTEROID_TIER_KEY) as AsteroidTier | undefined;
    if (!tier) return;

    const children = splitChildren(tier);
    if (children.length === 0) return;

    const body = asteroid.body as Phaser.Physics.Arcade.Body;
    const direction = Math.random() * Math.PI * 2;
    // Push the children apart in opposite directions so momentum is conserved.
    const childRadius = (asteroid.displayWidth / 2) * 0.5;
    children.forEach((childTier, index) => {
      const sign = index % 2 === 0 ? 1 : -1;
      const dx = Math.cos(direction) * sign;
      const dy = Math.sin(direction) * sign;
      this.createAsteroid(
        childTier,
        asteroid.x + dx * childRadius,
        asteroid.y + dy * childRadius,
        body.velocity.x + dx * Gameplay.asteroidSplitSpeed,
        body.velocity.y + dy * Gameplay.asteroidSplitSpeed,
      );
    });
  }

  private handleBulletHitAsteroid(bullet: Bullet, asteroid: Asteroid): void {
    if (!bullet.active || !asteroid.active) return;

    bullet.deactivate();
    this.spawnExplosion(asteroid.x, asteroid.y, this.explosionScaleOf(asteroid));
    this.splitAsteroid(asteroid);
    asteroid.destroy();

    this.score += Gameplay.scorePerAsteroid;
    this.publishScore();
  }

  private handlePlayerHitAsteroid(asteroid: Asteroid): void {
    const player = this.player;
    if (this.isGameOver || player.isInvulnerable || !asteroid.active) return;

    this.spawnExplosion(asteroid.x, asteroid.y, this.explosionScaleOf(asteroid));
    asteroid.destroy();

    if (!player.takeDamage()) return;
    this.publishShields();

    if (player.shields <= 0) {
      this.endGame();
    } else {
      EventBus.emit('hud:message', 'HULL BREACH', 900);
    }
  }

  private explosionScaleOf(asteroid: Asteroid): number {
    return (asteroid.getData('explosionScale') as number | undefined) ?? 1;
  }

  private spawnExplosion(x: number, y: number, scale: number): void {
    const emitter = this.add.particles(x, y, TextureKeys.Particle, {
      speed: { min: 40, max: 200 * scale },
      lifespan: { min: 180, max: 520 },
      scale: { start: 0.9 * scale, end: 0 },
      quantity: 14,
      tint: [Palette.Thruster, Palette.Bullet, 0xffffff],
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    emitter.setDepth(Depths.Effects);
    emitter.explode(14);
    this.time.delayedCall(700, () => emitter.destroy());
  }

  private endGame(): void {
    this.isGameOver = true;
    this.spawnTimer?.remove();
    this.player.applyThrust(false);
    this.player.steer(0);
    this.player.setVisible(false);
    this.spawnExplosion(this.player.x, this.player.y, 2.2);
    this.cameras.main.shake(320, 0.014);

    const { highScore, isNewRecord } = commitHighScore(this, this.score);
    setState(this, 'score', this.score);
    EventBus.emit('game:over', { score: this.score, highScore, isNewRecord });
    EventBus.emit(
      'hud:message',
      isNewRecord ? `NEW RECORD: ${this.score}` : `DESTROYED — SCORE ${this.score}`,
    );

    this.time.delayedCall(2200, () => this.returnToMenu());
  }

  private returnToMenu(): void {
    EventBus.emit('hud:clear-message');
    this.scene.start(SceneKeys.MainMenu);
  }

  private publishScore(): void {
    setState(this, 'score', this.score);
    EventBus.emit('hud:score', this.score);
  }

  private publishShields(): void {
    setState(this, 'shields', this.player.shields);
    EventBus.emit('hud:shields', this.player.shields, this.player.maxShields);
  }

  private handleResize(): void {
    this.applyCameraView();
    this.layoutStarfield();
  }

  private handleShutdown(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.off(Phaser.Scenes.Events.POST_UPDATE, this.syncCamera, this);
    this.input.keyboard?.off('keydown-ESC');
    this.input.keyboard?.off('keydown-G');
    this.spawnTimer?.remove();
  }
}
