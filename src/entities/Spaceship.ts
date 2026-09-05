import Phaser from 'phaser';
import type { ShipFaction } from '@/config/constants';
import { Depths, Gameplay } from '@/config/constants';
import type { AtlasCoord } from '@/config/shipAtlas';
import { Floors, frameOf, Items, Props, Structure } from '@/config/shipAtlas';
import type { BuildPhase, RoomKind, TurretDef } from '@/config/shipLayout';
import {
  BARREL_OFFSET,
  cellAt,
  CREW,
  DOORS,
  ENGINES,
  GRID_COLS,
  GRID_ROWS,
  HALF,
  isHull,
  isPlatform,
  JET_OFFSET,
  MAX_PHASE,
  MUZZLE_OFFSET,
  PROPS,
  ROOM_PHASE,
  roomKindOf,
  SHIP_HEIGHT,
  SHIP_WIDTH,
  TILE,
  TURRETS,
} from '@/config/shipLayout';

/** Wall sprites are 8 px thick and drawn 4 px inside the tile edge. */
const WALL_INSET = 4;

interface Turret {
  def: TurretDef;
  base: Phaser.GameObjects.Image;
  barrel: Phaser.GameObjects.Image;
  /** Current heading in local (unrotated ship) space, degrees. */
  heading: number;
}

export interface SpaceshipOptions {
  faction: ShipFaction;
  /** Render only the build phases up to this one (1–10). Default: all. */
  phase?: BuildPhase;
}

/**
 * The player's tile-built capital ship (issue #2).
 *
 * Two visual layers inside one container:
 *   1. `platform` – the deck crew walk on (inside and outside the hull),
 *   2. `hull`     – hull walls, room walls/doors, floors, props, items, crew.
 *
 * The container carries a single Arcade rigid body (mass, drag, angular drag)
 * so the ship reacts to thrust, recoil and impacts, and a hull-integrity
 * value makes it destructible.
 *
 * Local coordinate frame: the layout's 384×640 mock-up frame re-centred on
 * (0,0); -Y is the bow. With `angle = 0` the ship points "up" on screen and
 * thrust is applied along `forwardAngle` (= `angle - 90`).
 */
export class Spaceship extends Phaser.GameObjects.Container {
  declare body: Phaser.Physics.Arcade.Body;

  readonly faction: ShipFaction;
  readonly maxIntegrity: number = Gameplay.capitalMaxIntegrity;
  integrity: number = Gameplay.capitalMaxIntegrity;

  private readonly platformLayer: Phaser.GameObjects.Container;
  private readonly hullLayer: Phaser.GameObjects.Container;
  private readonly turrets: Turret[] = [];
  private readonly jets: Phaser.GameObjects.Image[] = [];
  private lastFiredAt = 0;
  private nextTurret = 0;
  private invulnerableUntil = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, options: SpaceshipOptions) {
    super(scene, x, y);
    this.faction = options.faction;
    const phase = options.phase ?? MAX_PHASE;

    this.platformLayer = scene.add.container(0, 0);
    this.hullLayer = scene.add.container(0, 0);
    this.add([this.platformLayer, this.hullLayer]);
    this.setSize(SHIP_WIDTH, SHIP_HEIGHT);

    this.build(phase);

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body
      .setCircle(SHIP_HEIGHT * 0.36, SHIP_WIDTH / 2 - SHIP_HEIGHT * 0.36, SHIP_HEIGHT * 0.14)
      .setMass(Gameplay.capitalMass)
      .setDamping(true)
      .setDrag(Gameplay.capitalDrag)
      .setAngularDrag(Gameplay.capitalAngularDrag)
      .setMaxVelocity(Gameplay.capitalMaxSpeed);
    this.setDepth(Depths.Player);
  }

  // ---------------------------------------------------------------------------
  // Construction
  // ---------------------------------------------------------------------------

  /** Mock-up pixel coords → local container coords (centre origin). */
  private static local(px: number, py: number): { x: number; y: number } {
    return { x: px - SHIP_WIDTH / 2, y: py - SHIP_HEIGHT / 2 };
  }

  private sprite(
    layer: Phaser.GameObjects.Container,
    tile: AtlasCoord,
    px: number,
    py: number,
    angle = 0,
  ): Phaser.GameObjects.Image {
    const { x, y } = Spaceship.local(px, py);
    const img = this.scene.add.image(x, y, this.faction, frameOf(tile)).setAngle(angle);
    layer.add(img);
    return img;
  }

  private build(phase: BuildPhase): void {
    this.buildPlatform();
    if (phase >= 3) this.buildFloors(phase);
    if (phase >= 2) this.buildHullWalls();
    if (phase >= 3) this.buildRoomWalls(phase);
    if (phase >= 3) this.buildDoors(phase);
    if (phase >= 3) this.buildProps(phase);
    if (phase >= 8) this.buildItems(phase);
    if (phase >= 10) this.buildCrew();
  }

  /**
   * Iterates every 64 px tile of the brick-bond platform. A tile starts at each
   * half-cell whose neighbour to the right is also present, stepping by two.
   */
  private forEachTile(
    predicate: (code: string) => boolean,
    fn: (px: number, py: number, code: string) => void,
  ): void {
    for (let row = 0; row < GRID_ROWS; row += 1) {
      let col = 0;
      while (col < GRID_COLS) {
        const code = cellAt(row, col);
        if (predicate(code) && predicate(cellAt(row, col + 1))) {
          fn(col * HALF, row * TILE, code);
          col += 2;
        } else {
          col += 1;
        }
      }
    }
  }

  /** Phase 1 – the walkable platform, one floor tile per brick. */
  private buildPlatform(): void {
    this.forEachTile(isPlatform, (px, py) => {
      this.sprite(this.platformLayer, Floors.Platform, px + TILE / 2, py + TILE / 2);
    });
  }

  /** Phases 3–7 – room-specific floors on top of the platform. */
  private buildFloors(phase: BuildPhase): void {
    this.forEachTile(isHull, (px, py, code) => {
      const kind = roomKindOf(code);
      if (!kind || ROOM_PHASE[kind] > phase) return;
      this.sprite(this.hullLayer, Spaceship.floorFor(kind), px + TILE / 2, py + TILE / 2);
    });
  }

  private static floorFor(kind: RoomKind): AtlasCoord {
    switch (kind) {
      case 'bridge':
        return Floors.Bridge;
      case 'hallway':
        return Floors.Hallway;
      case 'engine':
        return Floors.Engine;
      case 'cabin':
        return Floors.Cabin;
      case 'mess':
        return Floors.Mess;
    }
  }

  /**
   * Walks every half-cell edge and calls `fn` for edges where `inside(a)`
   * differs from `inside(b)`. Horizontal edges are 32 px long (one half-cell);
   * vertical edges are 64 px long.
   */
  private forEachBoundaryEdge(
    inside: (code: string) => boolean,
    fn: (x: number, y: number, orientation: 'horizontal' | 'vertical') => void,
  ): void {
    for (let row = 0; row <= GRID_ROWS; row += 1) {
      for (let col = 0; col <= GRID_COLS; col += 1) {
        const here = inside(cellAt(row, col));
        // Edge above this cell.
        if (col < GRID_COLS && here !== inside(cellAt(row - 1, col))) {
          fn(col * HALF + HALF / 2, row * TILE, 'horizontal');
        }
        // Edge to the left of this cell.
        if (row < GRID_ROWS && here !== inside(cellAt(row, col - 1))) {
          fn(col * HALF, row * TILE + TILE / 2, 'vertical');
        }
      }
    }
  }

  /** Phase 2 – hull walls around the enclosed hull (bow/stern tabs excluded). */
  private buildHullWalls(): void {
    this.forEachBoundaryEdge(isHull, (x, y, orientation) => {
      const inset = this.insetToward(x, y, orientation, isHull);
      this.placeWall(Structure.HullWallH, Structure.HullWallV, x, y, orientation, inset, 6);
    });
  }

  /**
   * Phases 3–7 – room walls on every edge between two different room codes
   * (or between a room and the hallway), skipping the outer hull boundary.
   */
  private buildRoomWalls(phase: BuildPhase): void {
    const visible = (code: string): boolean => {
      const kind = roomKindOf(code);
      return kind !== undefined && ROOM_PHASE[kind] <= phase;
    };
    for (let row = 0; row < GRID_ROWS; row += 1) {
      for (let col = 0; col < GRID_COLS; col += 1) {
        const here = cellAt(row, col);
        if (!isHull(here)) continue;
        const up = cellAt(row - 1, col);
        const left = cellAt(row, col - 1);
        if (isHull(up) && up !== here && (visible(here) || visible(up))) {
          this.placeRoomWall(col * HALF + HALF / 2, row * TILE, 'horizontal', here, up, visible);
        }
        if (isHull(left) && left !== here && (visible(here) || visible(left))) {
          this.placeRoomWall(col * HALF, row * TILE + TILE / 2, 'vertical', here, left, visible);
        }
      }
    }
  }

  private placeRoomWall(
    x: number,
    y: number,
    orientation: 'horizontal' | 'vertical',
    a: string,
    b: string,
    visible: (code: string) => boolean,
  ): void {
    // Inset toward whichever side is the room being drawn (prefer the non-hallway side).
    const preferred = visible(a) && a !== 'H' ? a : visible(b) && b !== 'H' ? b : a;
    const inset = this.insetToward(x, y, orientation, (code) => code === preferred);
    this.placeWall(Structure.RoomWallH, Structure.RoomWallV, x, y, orientation, inset, 5);
  }

  /** Returns +1/-1 so the wall is nudged into the side satisfying `inside`. */
  private insetToward(
    x: number,
    y: number,
    orientation: 'horizontal' | 'vertical',
    inside: (code: string) => boolean,
  ): number {
    if (orientation === 'horizontal') {
      const below = cellAt(Math.floor(y / TILE), Math.floor(x / HALF));
      return inside(below) ? 1 : -1;
    }
    const right = cellAt(Math.floor(y / TILE), Math.floor(x / HALF));
    return inside(right) ? 1 : -1;
  }

  /**
   * Places a wall sprite centred on an edge. Wall tiles are 36 px long, so a
   * 32 px horizontal edge is covered by one sprite and a 64 px vertical edge by
   * two (each covering half). Walls are inset 4 px into the tile.
   */
  private placeWall(
    tileH: AtlasCoord,
    tileV: AtlasCoord,
    x: number,
    y: number,
    orientation: 'horizontal' | 'vertical',
    inset: number,
    depth: number,
  ): void {
    if (orientation === 'horizontal') {
      this.sprite(this.hullLayer, tileH, x, y + inset * WALL_INSET).setDepth(depth);
      return;
    }
    const wx = x + inset * WALL_INSET;
    this.sprite(this.hullLayer, tileV, wx, y - HALF / 2).setDepth(depth);
    this.sprite(this.hullLayer, tileV, wx, y + HALF / 2).setDepth(depth);
  }

  /** Doors are drawn over the wall, covering its 32 px opening. */
  private buildDoors(phase: BuildPhase): void {
    for (const door of DOORS) {
      if (door.phase > phase) continue;
      const horizontal = door.orientation === 'horizontal';
      const tile = horizontal ? Structure.RoomDoorH : Structure.RoomDoorV;
      // Room doors sit on room walls, which are inset toward the room; match that.
      const inset = this.insetToward(door.x, door.y, door.orientation, (c) => c !== 'H' && isHull(c));
      const dx = horizontal ? 0 : inset * WALL_INSET;
      const dy = horizontal ? inset * WALL_INSET : 0;
      this.sprite(this.hullLayer, tile, door.x + dx, door.y + dy).setDepth(7);
    }
  }

  /** Phases 3–7 – placeholder props inside rooms. */
  private buildProps(phase: BuildPhase): void {
    for (const prop of PROPS) {
      if (prop.phase > phase) continue;
      this.sprite(this.hullLayer, Props[prop.tile], prop.x, prop.y).setDepth(3);
    }
  }

  /** Phases 8–9 – turrets (+ barrels) and engines (+ jet blast). */
  private buildItems(phase: BuildPhase): void {
    for (const def of TURRETS) {
      const base = this.sprite(this.hullLayer, Items.Turret, def.x, def.y).setDepth(8);
      const barrel = this.sprite(this.hullLayer, Items.Barrel, def.x, def.y).setDepth(9);
      barrel.setVisible(phase >= 9);
      const turret: Turret = { def, base, barrel, heading: def.restAngle };
      this.turrets.push(turret);
      this.layoutTurret(turret);
    }
    for (const def of ENGINES) {
      this.sprite(this.hullLayer, Items.Engine, def.x, def.y).setDepth(8);
      const jet = this.sprite(this.hullLayer, Items.JetBlast, def.x, def.y + JET_OFFSET).setDepth(1);
      jet.setVisible(phase >= 9).setAlpha(0.9);
      this.jets.push(jet);
    }
  }

  /** Phase 10 – static crew markers. */
  private buildCrew(): void {
    for (const [x, y] of CREW) {
      this.sprite(this.hullLayer, Structure.Crew, x, y).setDepth(10);
    }
  }

  private layoutTurret(turret: Turret): void {
    const rad = Phaser.Math.DegToRad(turret.heading);
    const { x, y } = Spaceship.local(turret.def.x, turret.def.y);
    turret.barrel
      .setPosition(x + Math.cos(rad) * BARREL_OFFSET, y + Math.sin(rad) * BARREL_OFFSET)
      .setAngle(turret.heading);
  }

  // ---------------------------------------------------------------------------
  // Gameplay
  // ---------------------------------------------------------------------------

  get isInvulnerable(): boolean {
    return this.scene.time.now < this.invulnerableUntil;
  }

  /** The bow points to -Y in local space, so with `angle = 0` forward is -90° (up). */
  get forwardAngle(): number {
    return this.angle - 90;
  }

  applyThrust(active: boolean): void {
    const rad = Phaser.Math.DegToRad(this.forwardAngle);
    if (active) {
      this.body.setAcceleration(
        Math.cos(rad) * Gameplay.capitalThrust,
        Math.sin(rad) * Gameplay.capitalThrust,
      );
    } else {
      this.body.setAcceleration(0, 0);
    }
    const flicker = active ? 0.8 + Math.random() * 0.2 : 0.25 + Math.random() * 0.1;
    const stretch = active ? 1 : 0.6;
    for (const jet of this.jets) jet.setAlpha(flicker).setScale(1, stretch);
  }

  steer(direction: -1 | 0 | 1): void {
    this.body.setAngularAcceleration(direction * Gameplay.capitalTurnAccel);
    if (direction === 0) this.body.setAngularVelocity(this.body.angularVelocity * 0.96);
  }

  /** Rotates all turrets toward a world-space point (e.g. the pointer). */
  aimAt(worldX: number, worldY: number): void {
    const rot = Phaser.Math.DegToRad(this.angle);
    for (const turret of this.turrets) {
      const { x: lx, y: ly } = Spaceship.local(turret.def.x, turret.def.y);
      // Turret world position.
      const wx = this.x + lx * Math.cos(rot) - ly * Math.sin(rot);
      const wy = this.y + lx * Math.sin(rot) + ly * Math.cos(rot);
      const worldHeading = Phaser.Math.RadToDeg(Math.atan2(worldY - wy, worldX - wx));
      const localHeading = Phaser.Math.Angle.WrapDegrees(worldHeading - this.angle);
      // Clamp to ±100° around the rest angle so side guns can't shoot through the hull.
      const delta = Phaser.Math.Angle.WrapDegrees(localHeading - turret.def.restAngle);
      turret.heading = turret.def.restAngle + Phaser.Math.Clamp(delta, -100, 100);
      this.layoutTurret(turret);
    }
  }

  /**
   * Fires the next turret in sequence (round-robin). Returns the world-space
   * muzzle position and heading, or `null` if still on cooldown.
   */
  tryFire(): { x: number; y: number; angle: number } | null {
    const now = this.scene.time.now;
    if (now - this.lastFiredAt < Gameplay.capitalFireCooldownMs) return null;
    if (this.turrets.length === 0) return null;
    this.lastFiredAt = now;

    const turret = this.turrets[this.nextTurret % this.turrets.length]!;
    this.nextTurret += 1;

    const rot = Phaser.Math.DegToRad(this.angle);
    const heading = turret.heading;
    const hrad = Phaser.Math.DegToRad(heading);
    const { x: lx, y: ly } = Spaceship.local(turret.def.x, turret.def.y);
    const mx = lx + Math.cos(hrad) * MUZZLE_OFFSET;
    const my = ly + Math.sin(hrad) * MUZZLE_OFFSET;

    // Recoil kick on the barrel.
    const startX = turret.barrel.x;
    const startY = turret.barrel.y;
    turret.barrel.setPosition(startX - Math.cos(hrad) * 6, startY - Math.sin(hrad) * 6);
    this.scene.tweens.add({ targets: turret.barrel, x: startX, y: startY, duration: 90 });

    return {
      x: this.x + mx * Math.cos(rot) - my * Math.sin(rot),
      y: this.y + mx * Math.sin(rot) + my * Math.cos(rot),
      angle: heading + this.angle,
    };
  }

  /** Applies damage; returns `true` when the hit landed (not invulnerable). */
  takeDamage(amount: number): boolean {
    if (this.isInvulnerable) return false;
    this.integrity = Math.max(0, this.integrity - amount);
    this.invulnerableUntil = this.scene.time.now + Gameplay.capitalInvulnerableMs;

    this.scene.tweens.add({
      targets: this.hullLayer,
      alpha: { from: 0.35, to: 1 },
      duration: 120,
      repeat: 2,
      yoyo: true,
      onComplete: () => this.hullLayer.setAlpha(1),
    });
    return true;
  }

  /** Bounding radius used for world wrapping / culling. */
  get boundingRadius(): number {
    return SHIP_HEIGHT / 2;
  }
}
