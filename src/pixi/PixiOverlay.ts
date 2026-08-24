import { Application, Container } from 'pixi.js';
import { HudLayer } from './layers/HudLayer';

/**
 * Pixi renders a transparent layer stacked on top of Phaser's canvas.
 *
 * Phaser owns the clock: `autoStart` is disabled and `update()` is called from
 * Phaser's POST_STEP, so both engines render exactly once per frame in a
 * deterministic order (world first, HUD second).
 */
export class PixiOverlay {
  readonly app = new Application();

  /** Root container for all overlay content. */
  readonly stage = new Container();

  hud!: HudLayer;

  private initialised = false;

  async init(host: HTMLElement): Promise<void> {
    const width = host.clientWidth || window.innerWidth;
    const height = host.clientHeight || window.innerHeight;

    await this.app.init({
      width,
      height,
      backgroundAlpha: 0, // fully transparent so Phaser shows through
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      autoStart: false, // driven by Phaser's game loop
      powerPreference: 'high-performance',
    });

    const canvas = this.app.canvas;
    canvas.id = 'pixi-overlay';
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    // The HUD is presentational: let all pointer input fall through to Phaser.
    canvas.style.pointerEvents = 'none';
    host.appendChild(canvas);

    this.app.stage.addChild(this.stage);

    this.hud = new HudLayer();
    this.stage.addChild(this.hud);
    this.hud.layout(width, height);

    this.initialised = true;
  }

  /** Called once per Phaser frame with the frame delta in milliseconds. */
  update(deltaMs: number): void {
    if (!this.initialised) return;
    this.hud.tick(deltaMs);
    this.app.render();
  }

  resize(width: number, height: number): void {
    if (!this.initialised) return;
    this.app.renderer.resize(width, height);
    this.hud.layout(width, height);
  }

  destroy(): void {
    if (!this.initialised) return;
    this.initialised = false;
    this.app.destroy(true, { children: true, texture: true });
  }
}
