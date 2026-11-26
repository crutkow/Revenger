import type Phaser from 'phaser';
import { Gameplay } from '@/config/constants';
import type { PxPoint } from '@/spaceship/blueprintTypes';
import { CREW_FRAMES, createWalker, stepWalker } from '@/spaceship/crew';

/** Crew member (issue #8) that patrols a fixed path inside the ship. */
export class CrewMember {
  private readonly walker;
  private stepClockMs = 0;

  constructor(
    private readonly path: readonly PxPoint[],
    private readonly sprite: Phaser.GameObjects.Sprite,
  ) {
    this.walker = createWalker(path);
    this.applyPose();
  }

  /** Position relative to the ship pivot. */
  get position(): PxPoint {
    return { x: this.walker.x, y: this.walker.y };
  }

  update(dtMs: number): void {
    stepWalker(this.walker, this.path, dtMs, Gameplay.crewSpeed, Gameplay.crewEndWaitMs);
    this.stepClockMs = this.walker.moving ? this.stepClockMs + dtMs : 0;
    this.applyPose();
  }

  private applyPose(): void {
    const { x, y, moving } = this.walker;
    // The art is a front view (head on top), so it stays upright relative to the ship.
    this.sprite.setPosition(x, y);
    const frames = CREW_FRAMES.walk;
    const frame = moving
      ? frames[Math.floor(this.stepClockMs / Gameplay.crewStepFrameMs) % frames.length]
      : CREW_FRAMES.idle;
    if (frame && this.sprite.frame.name !== frame) this.sprite.setFrame(frame);
  }
}
