import Phaser from 'phaser';
import { Palette, SceneKeys, TextureKeys } from '@/config/constants';
import { ATLAS_TILE } from '@/config/shipAtlas';

/**
 * Asset stage. Most textures are generated at runtime so `npm run dev` works
 * on a clean checkout; the two spaceship tile atlases are real files loaded
 * as spritesheets (64×64 frames) — see `src/config/shipAtlas.ts`.
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Preload);
  }

  preload(): void {
    this.createProgressBar();

    this.load.setBaseURL('assets/');
    this.load.spritesheet(TextureKeys.ShipAtlasGse, 'ships/gse_atlas.png', {
      frameWidth: ATLAS_TILE,
      frameHeight: ATLAS_TILE,
    });
    this.load.spritesheet(TextureKeys.ShipAtlasPoer, 'ships/poer_atlas.png', {
      frameWidth: ATLAS_TILE,
      frameHeight: ATLAS_TILE,
    });
  }

  create(): void {
    this.generateBulletTexture();
    this.generateAsteroidTexture();
    this.generateParticleTexture();
    this.generateStarfieldTexture();

    this.scene.start(SceneKeys.MainMenu);
  }

  private createProgressBar(): void {
    const { width, height } = this.scale;
    const barWidth = Math.min(420, width * 0.5);
    const barHeight = 6;
    const x = (width - barWidth) / 2;
    const y = height / 2;

    const frame = this.add.graphics();
    frame.lineStyle(1, Palette.Hud, 0.4).strokeRect(x, y, barWidth, barHeight);

    const fill = this.add.graphics();
    this.load.on(Phaser.Loader.Events.PROGRESS, (value: number) => {
      fill.clear().fillStyle(Palette.Hud, 1).fillRect(x, y, barWidth * value, barHeight);
    });
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      fill.destroy();
      frame.destroy();
    });
  }

  private generateBulletTexture(): void {
    const g = this.add.graphics();
    g.fillStyle(Palette.Bullet, 1).fillRect(0, 2, 14, 3);
    g.fillStyle(0xffffff, 1).fillRect(10, 2, 4, 3);
    g.generateTexture(TextureKeys.Bullet, 14, 7);
    g.destroy();
  }

  private generateAsteroidTexture(): void {
    const size = 48;
    const radius = size / 2 - 2;
    const points: Phaser.Math.Vector2[] = [];
    const steps = 11;

    for (let i = 0; i < steps; i += 1) {
      const angle = (i / steps) * Math.PI * 2;
      const r = radius * Phaser.Math.FloatBetween(0.72, 1);
      points.push(
        new Phaser.Math.Vector2(size / 2 + Math.cos(angle) * r, size / 2 + Math.sin(angle) * r),
      );
    }

    const g = this.add.graphics();
    g.fillStyle(Palette.Asteroid, 1).fillPoints(points, true, true);
    g.lineStyle(1.5, 0xffffff, 0.18).strokePoints(points, true, true);
    g.generateTexture(TextureKeys.Asteroid, size, size);
    g.destroy();
  }

  private generateParticleTexture(): void {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1).fillCircle(4, 4, 4);
    g.generateTexture(TextureKeys.Particle, 8, 8);
    g.destroy();
  }

  /** Tileable star patch used for the parallax background. */
  private generateStarfieldTexture(): void {
    const size = 256;
    const g = this.add.graphics();

    for (let i = 0; i < 90; i += 1) {
      const alpha = Phaser.Math.FloatBetween(0.2, 0.9);
      const radius = Phaser.Math.FloatBetween(0.5, 1.6);
      g.fillStyle(0xffffff, alpha);
      g.fillCircle(Phaser.Math.Between(0, size), Phaser.Math.Between(0, size), radius);
    }

    g.generateTexture(TextureKeys.Starfield, size, size);
    g.destroy();
  }
}
