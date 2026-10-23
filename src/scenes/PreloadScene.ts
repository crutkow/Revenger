import Phaser from 'phaser';
import { registerAtlasFrames } from '@/atlas/AtlasRegistry';
import type { AtlasDescriptor } from '@/atlas/atlasTypes';
import { AssetKeys, Palette, SceneKeys, TextureKeys } from '@/config/constants';

/** Atlases in `public/assets/ships/`: image + tile-based descriptor, split into named frames. */
const ATLASES = [
  {
    texture: TextureKeys.PoerAtlas,
    image: 'ships/poer_atlas.png',
    descriptorKey: AssetKeys.PoerAtlasDescriptor,
    descriptor: 'ships/poer_atlas.json',
  },
  {
    texture: TextureKeys.SpaceAtlas,
    image: 'ships/space_atlas.png',
    descriptorKey: AssetKeys.SpaceAtlasDescriptor,
    descriptor: 'ships/space_atlas.json',
  },
] as const;

/**
 * Asset stage. Ship, bullet and asteroid art comes from the atlases above. The
 * starfield and particle textures are still generated at runtime.
 *
 * More real files can be added in `preload()`:
 *   this.load.atlas('fx', 'fx/fx.png', 'fx/fx.json');
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Preload);
  }

  preload(): void {
    this.createProgressBar();

    this.load.setBaseURL('assets/');
    for (const atlas of ATLASES) {
      this.load.image(atlas.texture, atlas.image);
      this.load.json(atlas.descriptorKey, atlas.descriptor);
    }
  }

  create(): void {
    for (const atlas of ATLASES) {
      const descriptor = this.cache.json.get(atlas.descriptorKey) as AtlasDescriptor;
      registerAtlasFrames(this, atlas.texture, descriptor);
      // Pixel art: keep edges crisp when sprites are rotated or scaled.
      this.textures.get(atlas.texture).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

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
