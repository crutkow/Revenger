import Phaser from 'phaser';
import { SceneKeys } from '@/config/constants';

/**
 * First scene: engine-level setup only (no asset loading).
 * Hides the HTML splash once WebGL is confirmed alive.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Boot);
  }

  create(): void {
    document.getElementById('boot-splash')?.classList.add('is-hidden');

    // Auto-pause when the tab loses focus so the sim doesn't fast-forward on return.
    this.game.events.on(Phaser.Core.Events.BLUR, () => this.game.loop.sleep());
    this.game.events.on(Phaser.Core.Events.FOCUS, () => this.game.loop.wake());

    this.scene.start(SceneKeys.Preload);
  }
}
