import Phaser from 'phaser';
import { DESIGN_HEIGHT, DESIGN_WIDTH, Palette } from './constants';
import { BootScene } from '@/scenes/BootScene';
import { PreloadScene } from '@/scenes/PreloadScene';
import { MainMenuScene } from '@/scenes/MainMenuScene';
import { BattleScene } from '@/scenes/BattleScene';

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL,
  parent: 'game-root',
  backgroundColor: Palette.Space,
  scale: {
    // RESIZE keeps the world 1:1 with CSS pixels and fills the parent element;
    // scenes read `this.scale.width/height` instead of hardcoded sizes.
    mode: Phaser.Scale.RESIZE,
    width: DESIGN_WIDTH,
    height: DESIGN_HEIGHT,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 }, // top-down space: no gravity
      debug: import.meta.env.DEV && import.meta.env['VITE_PHYSICS_DEBUG'] === 'true',
    },
  },
  render: {
    antialias: true,
    powerPreference: 'high-performance',
    roundPixels: false,
  },
  fps: {
    target: 60,
    // Keeps physics stable when the browser throttles the tab.
    smoothStep: true,
  },
  autoFocus: true,
  disableContextMenu: true,
  scene: [BootScene, PreloadScene, MainMenuScene, BattleScene],
};
