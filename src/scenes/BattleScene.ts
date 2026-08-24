import Phaser from 'phaser';
import { Depths, Gameplay, Palette, SceneKeys, TextureKeys } from '@/config/constants';
import { EventBus } from '@/core/EventBus';
import { commitHighScore, setState } from '@/core/Registry';
import { Bullet } from '@/entities/Bullet';
import { Ship } from '@/entities/Ship';
import { randomPointOutsideRect, randomRange } from '@/utils/math';

/** Asteroids are plain physics sprites — no custom class needed. */
type Asteroid = Phaser.Physics.Arcade.Sprite;

interface InputKeys {
  thrust: Phaser.Input.Keyboard.Key[];
  left: Phaser.Input.Keyboard.Key[];
  right: Phaser.Input.Keyboard.Key[];
  fire: Phaser.Input.Keyboard.Key[];
}

export class BattleScene extends Phaser.Scene {
  private player!: Ship;
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

    this.createBackground(width, height);

    this.player = new Ship(this, width / 2, height / 2);
    this.player.setDepth(Depths.Player);

    this.bullets = this.physics.add.group({ classType: Bullet, maxSize: 48 });
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
    for (let i = 0; i < 4; i += 1) this.spawnAsteroid();

    this.publishScore();
    this.publishShields();
    EventBus.emit('hud:message', 'ENGAGE', 1200);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
  }

  override update(_time: number, delta: number): void {
    const dt = delta / 1000;
    const velocity = this.player.body?.velocity;
    const vx = velocity?.x ?? 0;
    const vy = velocity?.y ?? 0;

    // Parallax: the two star layers drift at different rates.
    this.starfieldFar.tilePositionX += vx * dt * 0.02;
    this.starfieldFar.tilePositionY += vy * dt * 0.02;
    this.starfieldNear.tilePositionX += vx * dt * 0.06;
    this.starfieldNear.tilePositionY += vy * dt * 0.06;

    if (this.isGameOver) return;

    const isDown = (keys: Phaser.Input.Keyboard.Key[]): boolean => keys.some((key) => key.isDown);

    this.player.applyThrust(isDown(this.keys.thrust));
    const turn = (isDown(this.keys.right) ? 1 : 0) - (isDown(this.keys.left) ? 1 : 0);
    this.player.steer(turn as -1 | 0 | 1);

    if (isDown(this.keys.fire)) this.fire();

    // Toroidal playfield: leaving one edge re-enters on the opposite side.
    this.physics.world.wrap(this.player, this.player.width * 0.5);
    this.physics.world.wrap(this.asteroids, 64);
  }

  private createBackground(width: number, height: number): void {
    this.starfieldFar = this.add
      .tileSprite(0, 0, width, height, TextureKeys.Starfield)
      .setOrigin(0)
      .setAlpha(0.35)
      .setScrollFactor(0)
      .setDepth(Depths.StarfieldFar);

    this.starfieldNear = this.add
      .tileSprite(0, 0, width, height, TextureKeys.Starfield)
      .setOrigin(0)
      .setAlpha(0.7)
      .setScale(1.4)
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
    if (!this.player.canFire()) return;

    const bullet = this.bullets.get(0, 0) as Bullet | null;
    if (!bullet) return;

    const muzzle = this.player.getMuzzlePosition();
    const velocity = this.player.body?.velocity;
    bullet.fire(muzzle.x, muzzle.y, this.player.angle, velocity?.x ?? 0, velocity?.y ?? 0);
  }

  private spawnAsteroid(): void {
    if (this.isGameOver) return;
    if (this.asteroids.countActive(true) >= Gameplay.asteroidMaxCount) return;

    const { width, height } = this.scale;
    const spawn = randomPointOutsideRect(width, height, 80);

    const asteroid = this.asteroids.create(spawn.x, spawn.y, TextureKeys.Asteroid) as Asteroid;

    const scale = randomRange(0.5, 1.3);
    asteroid
      .setDepth(Depths.Asteroids)
      .setScale(scale)
      .setAngularVelocity(randomRange(-60, 60));
    asteroid.setCircle(asteroid.width * 0.42, asteroid.width * 0.08, asteroid.height * 0.08);

    // Aim loosely at the player so the action stays on-screen.
    const angle = Phaser.Math.Angle.Between(spawn.x, spawn.y, this.player.x, this.player.y);
    const speed = randomRange(50, 130) / scale;
    asteroid.setVelocity(
      Math.cos(angle) * speed + randomRange(-25, 25),
      Math.sin(angle) * speed + randomRange(-25, 25),
    );
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

    this.spawnExplosion(asteroid.x, asteroid.y, asteroid.scale);
    asteroid.destroy();

    if (!player.takeDamage()) return;
    this.publishShields();

    if (player.shields <= 0) {
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

  private handleResize(size: Phaser.Structs.Size): void {
    this.starfieldFar.setSize(size.width, size.height);
    this.starfieldNear.setSize(size.width, size.height);
  }

  private handleShutdown(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.input.keyboard?.off('keydown-ESC');
    this.spawnTimer?.remove();
  }
}
