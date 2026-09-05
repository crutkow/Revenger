import Phaser from 'phaser';
import { Depths, Gameplay, Palette, SceneKeys, ShipFactions, TextureKeys } from '@/config/constants';
import { EventBus } from '@/core/EventBus';
import { commitHighScore, setState } from '@/core/Registry';
import { Bullet } from '@/entities/Bullet';
import { Spaceship } from '@/entities/Spaceship';
import { randomRange } from '@/utils/math';

/** Asteroids are plain physics sprites — no custom class needed. */
type Asteroid = Phaser.Physics.Arcade.Sprite;

interface InputKeys {
  thrust: Phaser.Input.Keyboard.Key[];
  left: Phaser.Input.Keyboard.Key[];
  right: Phaser.Input.Keyboard.Key[];
  fire: Phaser.Input.Keyboard.Key[];
}

/**
 * Main gameplay: the tile-built capital ship (issue #2) flies through an open
 * asteroid field. The camera follows the ship; turrets track the pointer and
 * fire with SPACE or the left mouse button.
 */
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
    const { width, height } = this.scale;

    this.score = 0;
    this.isGameOver = false;
    this.cameras.main.fadeIn(240, 0, 0, 0);
    this.cameras.main.setZoom(Gameplay.battleZoom);

    this.createBackground(width, height);

    this.player = new Spaceship(this, 0, 0, { faction: ShipFactions.Gse });
    this.player.setScale(Gameplay.capitalScale);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);

    this.bullets = this.physics.add.group({ classType: Bullet, maxSize: 64, runChildUpdate: true });
    this.asteroids = this.physics.add.group({ maxSize: Gameplay.asteroidMaxCount });

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
    for (let i = 0; i < 6; i += 1) this.spawnAsteroid();

    this.publishScore();
    this.publishIntegrity();
    EventBus.emit('hud:message', 'ENGAGE', 1200);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
  }

  override update(): void {
    const cam = this.cameras.main;

    // Parallax: star layers are screen-fixed and scroll with the camera.
    this.starfieldFar.tilePositionX = cam.scrollX * 0.15;
    this.starfieldFar.tilePositionY = cam.scrollY * 0.15;
    this.starfieldNear.tilePositionX = cam.scrollX * 0.4;
    this.starfieldNear.tilePositionY = cam.scrollY * 0.4;

    if (this.isGameOver) return;

    const isDown = (keys: Phaser.Input.Keyboard.Key[]): boolean => keys.some((key) => key.isDown);

    this.player.applyThrust(isDown(this.keys.thrust));
    const turn = (isDown(this.keys.right) ? 1 : 0) - (isDown(this.keys.left) ? 1 : 0);
    this.player.steer(turn as -1 | 0 | 1);

    const pointer = this.input.activePointer;
    const world = cam.getWorldPoint(pointer.x, pointer.y);
    this.player.aimAt(world.x, world.y);

    if (isDown(this.keys.fire) || pointer.isDown) this.fire();

    this.cullAsteroids();
  }

  private createBackground(width: number, height: number): void {
    // Oversize the star sprites so zoom < 1 never exposes their edges.
    const w = width * 2;
    const h = height * 2;
    this.starfieldFar = this.add
      .tileSprite(width / 2, height / 2, w, h, TextureKeys.Starfield)
      .setAlpha(0.35)
      .setScrollFactor(0)
      .setDepth(Depths.StarfieldFar);

    this.starfieldNear = this.add
      .tileSprite(width / 2, height / 2, w, h, TextureKeys.Starfield)
      .setAlpha(0.7)
      .setTileScale(1.4)
      .setScrollFactor(0)
      .setDepth(Depths.StarfieldNear);
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
  }

  private fire(): void {
    const shot = this.player.tryFire();
    if (!shot) return;

    const bullet = this.bullets.get(0, 0) as Bullet | null;
    if (!bullet) return;

    const velocity = this.player.body.velocity;
    bullet.fire(shot.x, shot.y, shot.angle, velocity.x, velocity.y);
  }

  /** Spawns just outside the camera view, drifting loosely toward the player. */
  private spawnAsteroid(): void {
    if (this.isGameOver) return;
    if (this.asteroids.countActive(true) >= Gameplay.asteroidMaxCount) return;

    // Spawn on a ring just outside the visible area. Derived from the viewport
    // size (not `worldView`, which is stale on the first frame) so the initial
    // wave never appears on top of the ship.
    const cam = this.cameras.main;
    const halfDiag = Math.hypot(this.scale.width, this.scale.height) / (2 * cam.zoom);
    const radius = halfDiag + 120;
    const theta = randomRange(0, Math.PI * 2);
    const x = this.player.x + Math.cos(theta) * radius;
    const y = this.player.y + Math.sin(theta) * radius;

    const asteroid = this.asteroids.create(x, y, TextureKeys.Asteroid) as Asteroid;

    const scale = randomRange(0.7, 1.8);
    asteroid.setDepth(Depths.Asteroids).setScale(scale).setAngularVelocity(randomRange(-60, 60));
    asteroid.setCircle(asteroid.width * 0.42, asteroid.width * 0.08, asteroid.height * 0.08);

    const angle = Phaser.Math.Angle.Between(x, y, this.player.x, this.player.y);
    const speed = randomRange(50, 130) / scale;
    asteroid.setVelocity(
      Math.cos(angle) * speed + randomRange(-25, 25),
      Math.sin(angle) * speed + randomRange(-25, 25),
    );
  }

  /** Recycle asteroids that drift far behind the camera. */
  private cullAsteroids(): void {
    const view = this.cameras.main.worldView;
    const pad = 600;
    for (const child of this.asteroids.getChildren()) {
      const a = child as Asteroid;
      if (!a.active) continue;
      if (
        a.x < view.left - pad ||
        a.x > view.right + pad ||
        a.y < view.top - pad ||
        a.y > view.bottom + pad
      ) {
        a.destroy();
      }
    }
  }

  private handleBulletHitAsteroid(bullet: Bullet, asteroid: Asteroid): void {
    if (!bullet.active || !asteroid.active) return;

    bullet.deactivate();
    this.spawnExplosion(asteroid.x, asteroid.y, asteroid.scale);
    asteroid.destroy();

    this.score += Gameplay.scorePerAsteroid;
    this.publishScore();
  }

  private handlePlayerHitAsteroid(asteroid: Asteroid): void {
    const player = this.player;
    if (this.isGameOver || player.isInvulnerable || !asteroid.active) return;

    // Impulse: the ship is a rigid body, so a hit shoves it.
    const av = asteroid.body?.velocity;
    if (av) {
      const kick = (asteroid.scale * 30) / Gameplay.capitalMass;
      player.body.velocity.x += av.x * kick;
      player.body.velocity.y += av.y * kick;
    }

    this.spawnExplosion(asteroid.x, asteroid.y, asteroid.scale);
    asteroid.destroy();

    if (!player.takeDamage(Gameplay.capitalAsteroidDamage * asteroid.scale)) return;
    this.cameras.main.shake(160, 0.006);
    this.publishIntegrity();

    if (player.integrity <= 0) {
      this.endGame();
    } else {
      EventBus.emit('hud:message', 'HULL BREACH', 900);
    }
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
    this.spawnExplosion(this.player.x, this.player.y, 3.5);
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

  private publishIntegrity(): void {
    setState(this, 'shields', this.player.integrity);
    EventBus.emit('hud:shields', this.player.integrity, this.player.maxIntegrity);
  }

  private handleResize(size: Phaser.Structs.Size): void {
    for (const star of [this.starfieldFar, this.starfieldNear]) {
      star.setPosition(size.width / 2, size.height / 2).setSize(size.width * 2, size.height * 2);
    }
  }

  private handleShutdown(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.input.keyboard?.off('keydown-ESC');
    this.spawnTimer?.remove();
    // `cameras.main` may already be torn down during SHUTDOWN.
    const cam = this.cameras?.main as Phaser.Cameras.Scene2D.Camera | undefined;
    cam?.stopFollow();
    cam?.setZoom(1);
  }
}
