import Phaser from 'phaser';
import { Depths, Gameplay, SPRITE_FACING_DEG, SpaceFrames, TextureKeys } from '@/config/constants';

/**
 * Pooled projectile, created through a physics group with `classType: Bullet`.
 *
 * Extends Arcade.Sprite (not Image) because Group.create() only registers
 * children with the scene's UpdateList when they expose `preUpdate` — that's
 * what drives the lifespan/culling logic below.
 */
export class Bullet extends Phaser.Physics.Arcade.Sprite {
  private lifespanMs = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TextureKeys.SpaceAtlas, SpaceFrames.Bullet);
    this.setDepth(Depths.Bullets);
  }

  /** `headingDeg` is a math angle (0 = +X); the nose-up sprite is rotated to match. */
  fire(x: number, y: number, headingDeg: number, inheritVx = 0, inheritVy = 0): void {
    this.enableBody(true, x, y, true, true);
    this.setAngle(headingDeg - SPRITE_FACING_DEG);
    this.lifespanMs = Gameplay.bulletLifespanMs;

    const rad = Phaser.Math.DegToRad(headingDeg);
    this.setVelocity(
      Math.cos(rad) * Gameplay.bulletSpeed + inheritVx * 0.35,
      Math.sin(rad) * Gameplay.bulletSpeed + inheritVy * 0.35,
    );
  }

  deactivate(): void {
    this.disableBody(true, true);
    this.lifespanMs = 0;
  }

  protected override preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);

    this.lifespanMs -= delta;
    if (this.lifespanMs <= 0) {
      this.deactivate();
      return;
    }

    // Cull anything that leaves the viewport.
    const { width, height } = this.scene.scale;
    const pad = 48;
    if (this.x < -pad || this.x > width + pad || this.y < -pad || this.y > height + pad) {
      this.deactivate();
    }
  }
}
