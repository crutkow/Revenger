import Phaser from 'phaser';
import type { ShipFaction } from '@/config/constants';
import { Depths, SceneKeys, ShipFactions, TextureKeys } from '@/config/constants';
import type { BuildPhase } from '@/config/shipLayout';
import { MAX_PHASE, SHIP_HEIGHT } from '@/config/shipLayout';
import { Spaceship } from '@/entities/Spaceship';

const PHASE_NAMES: Record<BuildPhase, string> = {
  1: 'Platform',
  2: 'Hull',
  3: 'Hallway',
  4: 'Bridge',
  5: 'Engine room',
  6: 'Cabins',
  7: 'Mess hall',
  8: 'Items',
  9: 'Item addons',
  10: 'Crew members',
};

/**
 * Shipyard – a static viewer for the tile-built capital ship.
 *
 * Mirrors the ten build phases from issue #2 so each step can be compared 1:1
 * with the reference mock-ups (`public/design/reference/phaseNN-*.png`).
 *
 *   ← / →   previous / next build phase
 *   TAB     swap faction atlas (GSE / POER)
 *   ESC     back to the main menu
 */
export class ShipyardScene extends Phaser.Scene {
  private ship?: Spaceship;
  private faction: ShipFaction = ShipFactions.Gse;
  private phase: BuildPhase = MAX_PHASE;
  private starfield?: Phaser.GameObjects.TileSprite;
  private caption?: Phaser.GameObjects.Text;

  constructor() {
    super(SceneKeys.Shipyard);
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.fadeIn(200, 0, 0, 0);

    this.starfield = this.add
      .tileSprite(0, 0, width, height, TextureKeys.Starfield)
      .setOrigin(0)
      .setAlpha(0.4)
      .setDepth(Depths.StarfieldFar);

    this.add
      .text(width / 2, 20, 'SHIPYARD   ← → build phase · TAB faction · ESC menu', {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: '15px',
        color: '#6ef2ff',
      })
      .setOrigin(0.5, 0)
      .setDepth(100);

    this.caption = this.add
      .text(width / 2, height - 28, '', {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5, 1)
      .setDepth(100);

    this.rebuild();

    const keyboard = this.input.keyboard;
    keyboard?.once('keydown-ESC', () => this.scene.start(SceneKeys.MainMenu));
    keyboard?.on('keydown-TAB', this.swapFaction, this);
    keyboard?.on('keydown-LEFT', () => this.setPhase(this.phase - 1));
    keyboard?.on('keydown-RIGHT', () => this.setPhase(this.phase + 1));
    keyboard?.on('keydown-A', () => this.setPhase(this.phase - 1));
    keyboard?.on('keydown-D', () => this.setPhase(this.phase + 1));

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
      keyboard?.off('keydown-TAB', this.swapFaction, this);
      keyboard?.off('keydown-LEFT');
      keyboard?.off('keydown-RIGHT');
      keyboard?.off('keydown-A');
      keyboard?.off('keydown-D');
    });
  }

  private setPhase(next: number): void {
    const clamped = Phaser.Math.Clamp(next, 1, MAX_PHASE) as BuildPhase;
    if (clamped === this.phase) return;
    this.phase = clamped;
    this.rebuild();
  }

  private swapFaction(): void {
    this.faction = this.faction === ShipFactions.Gse ? ShipFactions.Poer : ShipFactions.Gse;
    this.rebuild();
  }

  private rebuild(): void {
    const { width, height } = this.scale;
    this.ship?.destroy();
    this.ship = new Spaceship(this, width / 2, height / 2, {
      faction: this.faction,
      phase: this.phase,
    });
    // The shipyard is a static viewer; freeze the body so nothing drifts.
    this.ship.body.setImmovable(true).setAllowDrag(false);
    this.fitShip();

    const skin = this.faction === ShipFactions.Gse ? 'GSE' : 'POER';
    this.caption?.setText(`Phase ${this.phase}: ${PHASE_NAMES[this.phase]}   ·   ${skin}`);
  }

  /** Scale the ship so it fills ~90 % of the viewport height. */
  private fitShip(): void {
    if (!this.ship) return;
    const { width, height } = this.scale;
    const scale = Math.min(1, (height * 0.9) / SHIP_HEIGHT);
    this.ship.setScale(scale).setPosition(width / 2, height / 2);
  }

  private handleResize(size: Phaser.Structs.Size): void {
    this.starfield?.setSize(size.width, size.height);
    this.caption?.setPosition(size.width / 2, size.height - 28);
    this.fitShip();
  }
}
