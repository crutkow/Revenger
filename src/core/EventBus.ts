import Phaser from 'phaser';

/**
 * Cross-engine message bus.
 *
 * Phaser (gameplay) never touches Pixi objects directly and vice versa — they
 * only exchange plain data through this bus. That keeps either renderer
 * replaceable and makes the HUD testable in isolation.
 */
export interface GameEventMap {
  'game:start': [];
  'game:over': [payload: { score: number; highScore: number; isNewRecord: boolean }];
  'hud:score': [score: number];
  'hud:shields': [current: number, max: number];
  'hud:message': [text: string, durationMs?: number];
  'hud:clear-message': [];
}

export type GameEventName = keyof GameEventMap;

class TypedEventBus {
  private readonly emitter = new Phaser.Events.EventEmitter();

  on<K extends GameEventName>(
    event: K,
    handler: (...args: GameEventMap[K]) => void,
    context?: unknown,
  ): this {
    this.emitter.on(event, handler as (...args: unknown[]) => void, context);
    return this;
  }

  once<K extends GameEventName>(
    event: K,
    handler: (...args: GameEventMap[K]) => void,
    context?: unknown,
  ): this {
    this.emitter.once(event, handler as (...args: unknown[]) => void, context);
    return this;
  }

  off<K extends GameEventName>(
    event: K,
    handler?: (...args: GameEventMap[K]) => void,
    context?: unknown,
  ): this {
    this.emitter.off(event, handler as ((...args: unknown[]) => void) | undefined, context);
    return this;
  }

  emit<K extends GameEventName>(event: K, ...args: GameEventMap[K]): boolean {
    return this.emitter.emit(event, ...args);
  }

  removeAll(): void {
    this.emitter.removeAllListeners();
  }
}

export const EventBus = new TypedEventBus();
