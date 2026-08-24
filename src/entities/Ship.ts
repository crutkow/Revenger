import Phaser from 'phaser';
import { Gameplay, TextureKeys } from '@/config/constants';

export type TurnDirection = -1 | 0 | 1;

/**
 * Player ship: arcade-physics body with inertia + angular steering.
 * Texture points along +X, so `angle` is also the thrust direction.
 */
export class Ship extends Phaser.Physics.Arcade.Sprite {
  shields = Gameplay.playerStartShields;
  readonly maxShields = Gameplay.playerStartShields;

  private invulnerableUntil = 0;
  private lastFiredAt = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TextureKeys.Ship);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setOrigin(0.5)
      .setAngle(-90) // nose up on spawn
      .setDamping(true)
      .setDrag(Gameplay.playerDrag)
      .setMaxVelocity(Gameplay.playerMaxSpeed)
      .setCollideWorldBounds(false);

    this.setCircle(this.width * 0.4, this.width * 0.1, this.height * 0.1);
  }

  get isInvulnerable(): boolean {
    return this.scene.time.now < this.invulnerableUntil;
  }

  applyThrust(active: boolean): void {
    if (!active) {
      this.setAcceleration(0, 0);
      return;
    }
    const rad = Phaser.Math.DegToRad(this.angle);
    this.setAcceleration(
      Math.cos(rad) * Gameplay.playerThrust,
      Math.sin(rad) * Gameplay.playerThrust,
    );
  }

  steer(direction: TurnDirection): void {
    this.setAngularVelocity(direction * Gameplay.playerTurnRate);
  }

  /** Returns true when the cooldown allowed a shot this frame. */
  canFire(): boolean {
    if (this.scene.time.now - this.lastFiredAt < Gameplay.fireCooldownMs) {
      return false;
    }
    this.lastFiredAt = this.scene.time.now;
    return true;
  }

  /** Muzzle position in world space. */
  getMuzzlePosition(): Phaser.Math.Vector2 {
    const rad = Phaser.Math.DegToRad(this.angle);
    const offset = this.width * 0.55;
    return new Phaser.Math.Vector2(
      this.x + Math.cos(rad) * offset,
      this.y + Math.sin(rad) * offset,
    );
  }

  /** Returns true when the hit landed (i.e. the ship was not invulnerable). */
  takeDamage(): boolean {
    if (this.isInvulnerable) return false;

    this.shields = Math.max(0, this.shields - 1);
    this.invulnerableUntil = this.scene.time.now + Gameplay.playerInvulnerableMs;

    this.scene.tweens.add({
      targets: this,
      alpha: { from: 0.2, to: 1 },
      duration: 180,
      repeat: Math.floor(Gameplay.playerInvulnerableMs / 360),
      yoyo: true,
      onComplete: () => this.setAlpha(1),
    });

    this.scene.cameras.main.shake(180, 0.008);
    return true;
  }

  reset(x: number, y: number): void {
    this.shields = this.maxShields;
    this.invulnerableUntil = 0;
    this.lastFiredAt = 0;
    this.setPosition(x, y).setAngle(-90).setAlpha(1);
    this.setVelocity(0, 0);
    this.setAcceleration(0, 0);
    this.setAngularVelocity(0);
  }
}
