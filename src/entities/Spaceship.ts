import Phaser from 'phaser';
import { getAtlasFrame, hasAtlasFrame } from '@/atlas/AtlasRegistry';
import { Gameplay, SPRITE_FACING_DEG, TextureKeys } from '@/config/constants';
import type {
  FrameSizeLookup,
  SpaceshipBlueprint,
  SpaceshipLayout,
} from '@/spaceship/blueprintTypes';
import { buildSpaceshipLayout } from '@/spaceship/spaceshipBuilder';
import type { TurnDirection } from './Ship';

/** Frame sizes of the poer atlas, used to build and validate blueprints. */
export const poerFrameSize: FrameSizeLookup = (name) => {
  if (!hasAtlasFrame(TextureKeys.PoerAtlas, name)) return undefined;
  const { width, height } = getAtlasFrame(TextureKeys.PoerAtlas, name);
  return { w: width, h: height };
};

/**
 * Player ship built from a blueprint (issue #4): platform, hull, rooms and items
 * are separate sprites in one container. Rotates around the platform bounding box
 * centre and has the same flight model as the old single-sprite ship.
 * The art points up (nose = top of the blueprint), like `SPRITE_FACING_DEG` expects.
 */
export class Spaceship extends Phaser.GameObjects.Container {
  shields: number = Gameplay.playerStartShields;
  readonly maxShields: number = Gameplay.playerStartShields;

  readonly layout: SpaceshipLayout;
  private readonly flames: Phaser.GameObjects.Sprite[] = [];

  private invulnerableUntil = 0;
  private lastFiredAt = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, blueprint: SpaceshipBlueprint) {
    super(scene, x, y);
    this.layout = buildSpaceshipLayout(blueprint, poerFrameSize);
    const { size, hullCenter, hullSize } = this.layout;

    for (const placement of this.layout.sprites) {
      const sprite = scene.add.sprite(
        placement.x,
        placement.y,
        TextureKeys.PoerAtlas,
        placement.frame,
      );
      this.add(sprite);
      if (placement.layer === 'flame') {
        sprite.setVisible(false);
        this.flames.push(sprite);
      }
    }

    this.setSize(size.w, size.h).setScale(Gameplay.spaceshipScale);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Collision: a circle that fits the hull bounds (rotation-proof for arcade physics).
    const radius = Math.min(hullSize.w, hullSize.h) / 2;
    const body = this.arcade;
    body.setCircle(radius, size.w / 2 + hullCenter.x - radius, size.h / 2 + hullCenter.y - radius);
    body.useDamping = true;
    body.setDrag(Gameplay.playerDrag, Gameplay.playerDrag);
    body.setMaxVelocity(Gameplay.playerMaxSpeed, Gameplay.playerMaxSpeed);
    body.setCollideWorldBounds(false);
  }

  private get arcade(): Phaser.Physics.Arcade.Body {
    return this.body as Phaser.Physics.Arcade.Body;
  }

  get isInvulnerable(): boolean {
    return this.scene.time.now < this.invulnerableUntil;
  }

  /** Direction the nose points, as a math angle in degrees (0 = +X). */
  get heading(): number {
    return this.angle + SPRITE_FACING_DEG;
  }

  applyThrust(active: boolean): void {
    for (const flame of this.flames) flame.setVisible(active);
    if (!active) {
      this.arcade.setAcceleration(0, 0);
      return;
    }
    const rad = Phaser.Math.DegToRad(this.heading);
    this.arcade.setAcceleration(
      Math.cos(rad) * Gameplay.playerThrust,
      Math.sin(rad) * Gameplay.playerThrust,
    );
  }

  steer(direction: TurnDirection): void {
    this.arcade.setAngularVelocity(direction * Gameplay.playerTurnRate);
  }

  /** Returns true when the cooldown allowed a shot this frame. */
  canFire(): boolean {
    if (this.scene.time.now - this.lastFiredAt < Gameplay.fireCooldownMs) {
      return false;
    }
    this.lastFiredAt = this.scene.time.now;
    return true;
  }

  /** Cannon muzzles in world space. */
  getMuzzlePositions(): Phaser.Math.Vector2[] {
    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);
    const scale = this.scaleX;
    return this.layout.muzzles.map(
      (m) =>
        new Phaser.Math.Vector2(
          this.x + (m.x * cos - m.y * sin) * scale,
          this.y + (m.x * sin + m.y * cos) * scale,
        ),
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
    this.setPosition(x, y).setAngle(0).setAlpha(1);
    this.arcade.setVelocity(0, 0);
    this.arcade.setAcceleration(0, 0);
    this.arcade.setAngularVelocity(0);
    for (const flame of this.flames) flame.setVisible(false);
  }
}
