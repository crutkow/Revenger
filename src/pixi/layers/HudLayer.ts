import { Container, Graphics, Text, type TextStyleOptions } from 'pixi.js';
import { damp } from '@/utils/math';

const HUD_COLOR = 0x6ef2ff;
const DANGER_COLOR = 0xff5470;
const MARGIN = 24;

const labelStyle: TextStyleOptions = {
  fontFamily: 'Segoe UI, system-ui, sans-serif',
  fontSize: 14,
  fontWeight: '600',
  letterSpacing: 2,
  fill: HUD_COLOR,
};

const valueStyle: TextStyleOptions = {
  ...labelStyle,
  fontSize: 30,
  letterSpacing: 1,
  fill: 0xffffff,
};

/**
 * The whole HUD is Pixi-rendered. It knows nothing about Phaser — `main.ts`
 * feeds it plain numbers/strings from the EventBus.
 */
export class HudLayer extends Container {
  private readonly scoreLabel = new Text({ text: 'SCORE', style: labelStyle });
  private readonly scoreValue = new Text({ text: '0', style: valueStyle });
  private readonly fpsValue = new Text({ text: '60 FPS', style: { ...labelStyle, fontSize: 12 } });
  private readonly shieldLabel = new Text({ text: 'SHIELDS', style: labelStyle });
  private readonly shieldBar = new Graphics();
  private readonly message = new Text({
    text: '',
    style: { ...valueStyle, fontSize: 24, align: 'center', fill: HUD_COLOR },
  });

  private viewWidth = 0;
  private viewHeight = 0;

  private displayedScore = 0;
  private targetScore = 0;
  private shields = 0;
  private maxShields = 0;
  private smoothedFps = 60;
  private messageTimerMs = 0;

  constructor() {
    super();
    this.message.anchor.set(0.5);
    this.addChild(
      this.scoreLabel,
      this.scoreValue,
      this.fpsValue,
      this.shieldLabel,
      this.shieldBar,
      this.message,
    );
  }

  setScore(score: number): void {
    this.targetScore = score;
  }

  setShields(current: number, max: number): void {
    this.shields = current;
    this.maxShields = max;
    this.drawShieldBar();
  }

  setMessage(text: string, durationMs = 0): void {
    this.message.text = text;
    this.message.alpha = 1;
    this.messageTimerMs = durationMs;
  }

  clearMessage(): void {
    this.message.text = '';
    this.messageTimerMs = 0;
  }

  /** Per-frame animation; called from PixiOverlay.update(). */
  tick(deltaMs: number): void {
    // Score rolls up smoothly instead of snapping.
    this.displayedScore = damp(this.displayedScore, this.targetScore, 0.2, deltaMs);
    if (Math.abs(this.targetScore - this.displayedScore) < 0.5) {
      this.displayedScore = this.targetScore;
    }
    const rounded = Math.round(this.displayedScore).toString();
    if (this.scoreValue.text !== rounded) {
      this.scoreValue.text = rounded;
    }

    if (deltaMs > 0) {
      this.smoothedFps = damp(this.smoothedFps, 1000 / deltaMs, 0.08, deltaMs);
      this.fpsValue.text = `${Math.round(this.smoothedFps)} FPS`;
    }

    if (this.messageTimerMs > 0) {
      this.messageTimerMs -= deltaMs;
      if (this.messageTimerMs <= 0) {
        this.clearMessage();
      } else if (this.messageTimerMs < 400) {
        this.message.alpha = this.messageTimerMs / 400;
      }
    }
  }

  /** Re-anchors HUD elements after a viewport resize. */
  layout(width: number, height: number): void {
    this.viewWidth = width;
    this.viewHeight = height;

    this.scoreLabel.position.set(MARGIN, MARGIN);
    this.scoreValue.position.set(MARGIN, MARGIN + 18);

    this.shieldLabel.position.set(MARGIN, height - MARGIN - 34);
    this.shieldBar.position.set(MARGIN, height - MARGIN - 12);

    this.fpsValue.position.set(width - MARGIN - this.fpsValue.width, MARGIN);

    this.message.position.set(width / 2, height * 0.62);

    this.drawShieldBar();
  }

  private drawShieldBar(): void {
    const segmentWidth = 34;
    const segmentHeight = 8;
    const gap = 6;

    this.shieldBar.clear();
    for (let i = 0; i < this.maxShields; i += 1) {
      const filled = i < this.shields;
      this.shieldBar
        .rect(i * (segmentWidth + gap), 0, segmentWidth, segmentHeight)
        .fill({ color: filled ? HUD_COLOR : DANGER_COLOR, alpha: filled ? 1 : 0.18 });
    }

    // Keep the bar pinned to the bottom-left after layout changes.
    if (this.viewWidth > 0 && this.viewHeight > 0) {
      this.shieldBar.position.set(MARGIN, this.viewHeight - MARGIN - 12);
    }
  }
}
