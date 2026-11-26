import type Phaser from 'phaser';
import { Gameplay } from '@/config/constants';
import type { DoorLayout, PxPoint } from '@/spaceship/blueprintTypes';
import { createDoorState, isNearDoor, leafPose, stepDoor } from '@/spaceship/doors';

/**
 * Sliding door (issue #8): two leaf sprites that slide apart along the wall when crew is near
 * and slide back together afterwards. The sprites are never scaled or cropped.
 */
export class SlidingDoor {
  private readonly state = createDoorState();

  constructor(
    private readonly layout: DoorLayout,
    /** Leaf sprites: `[-1]` is the left/top leaf, `[1]` the right/bottom one. */
    private readonly leaves: Readonly<Record<-1 | 1, Phaser.GameObjects.Sprite>>,
  ) {
    this.apply();
  }

  /** 0 = closed, 1 = open. */
  get progress(): number {
    return this.state.progress;
  }

  update(dtMs: number, crew: readonly PxPoint[]): void {
    const before = this.state.progress;
    stepDoor(
      this.state,
      isNearDoor(this.layout, crew, Gameplay.doorOpenRadius),
      dtMs,
      Gameplay.doorSlideMs,
      Gameplay.doorCloseDelayMs,
    );
    if (this.state.progress !== before) this.apply();
  }

  private apply(): void {
    for (const side of [-1, 1] as const) {
      const pose = leafPose(this.layout, side, this.state.progress);
      this.leaves[side].setPosition(pose.x, pose.y);
    }
  }
}
