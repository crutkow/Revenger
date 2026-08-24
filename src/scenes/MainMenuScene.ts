import Phaser from 'phaser';
import { Depths, SceneKeys, TextureKeys } from '@/config/constants';
import { EventBus } from '@/core/EventBus';
import { getState } from '@/core/Registry';

export class MainMenuScene extends Phaser.Scene {
  private starfield?: Phaser.GameObjects.TileSprite;
  private isLaunching = false;

  constructor() {
    super(SceneKeys.MainMenu);
  }

  create(): void {
    const { width, height } = this.scale;
    this.isLaunching = false;
    this.cameras.main.fadeIn(240, 0, 0, 0);

    this.starfield = this.add
      .tileSprite(0, 0, width, height, TextureKeys.Starfield)
      .setOrigin(0)
      .setAlpha(0.55)
      .setDepth(Depths.StarfieldFar);

    const title = this.add
      .text(width / 2, height * 0.34, 'REVENGER', {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: '72px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    title.setShadow(0, 0, '#6ef2ff', 24, true, true);

    this.add
      .text(width / 2, height * 0.44, 'S P A C E   B A T T L E   S I M U L A T O R', {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: '16px',
        color: '#6ef2ff',
      })
      .setOrigin(0.5);

    const prompt = this.add
      .text(width / 2, height * 0.62, 'CLICK OR PRESS ENTER TO LAUNCH', {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: '18px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: prompt,
      alpha: { from: 1, to: 0.25 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });

    this.add
      .text(
        width / 2,
        height * 0.74,
        'W / ↑ thrust    A D / ← → rotate    SPACE fire    ESC menu',
        {
          fontFamily: 'Segoe UI, system-ui, sans-serif',
          fontSize: '14px',
          color: '#8a94ad',
          align: 'center',
        },
      )
      .setOrigin(0.5);

    const highScore = getState(this, 'highScore');
    if (highScore > 0) {
      this.add
        .text(width / 2, height * 0.82, `BEST: ${highScore}`, {
          fontFamily: 'Segoe UI, system-ui, sans-serif',
          fontSize: '15px',
          color: '#6ef2ff',
        })
        .setOrigin(0.5);
    }

    // The Pixi HUD is hidden on the menu.
    EventBus.emit('hud:score', 0);
    EventBus.emit('hud:shields', 0, 0);
    EventBus.emit('hud:clear-message');

    this.input.once(Phaser.Input.Events.POINTER_DOWN, () => this.startGame());
    this.input.keyboard?.once('keydown-ENTER', () => this.startGame());
    this.input.keyboard?.once('keydown-SPACE', () => this.startGame());

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    });
  }

  override update(_time: number, delta: number): void {
    if (this.starfield) {
      this.starfield.tilePositionX += (delta / 1000) * 8;
    }
  }

  private handleResize(size: Phaser.Structs.Size): void {
    this.starfield?.setSize(size.width, size.height);
  }

  private startGame(): void {
    if (this.isLaunching) return;
    this.isLaunching = true;

    this.cameras.main.fadeOut(220, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      EventBus.emit('game:start');
      this.scene.start(SceneKeys.Battle);
    });
  }
}
