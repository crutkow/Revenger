import Phaser from 'phaser';
import { gameConfig } from '@/config/gameConfig';
import { EventBus } from '@/core/EventBus';
import { initState } from '@/core/Registry';
import { PixiOverlay } from '@/pixi/PixiOverlay';
import '@/styles/main.css';

/**
 * Entry point — Option A architecture:
 *
 *   Phaser  -> gameplay world, arcade physics, input, scenes  (base canvas)
 *   Pixi    -> HUD / FX overlay                               (transparent canvas on top)
 *   EventBus-> the only channel between them
 *
 * Phaser owns the single game loop; Pixi renders on demand from POST_STEP.
 */
async function bootstrap(): Promise<void> {
  const host = document.getElementById('game-root');
  if (!host) {
    throw new Error('#game-root element is missing from index.html');
  }

  const game = new Phaser.Game(gameConfig);
  initState(game);

  const overlay = new PixiOverlay();
  await overlay.init(host);

  // --- Frame sync: one Phaser step == one Pixi render -----------------------
  game.events.on(Phaser.Core.Events.POST_STEP, (_time: number, delta: number) => {
    overlay.update(delta);
  });

  // --- Viewport sync -------------------------------------------------------
  game.scale.on(Phaser.Scale.Events.RESIZE, (size: Phaser.Structs.Size) => {
    overlay.resize(size.width, size.height);
  });

  // --- Gameplay -> HUD wiring ---------------------------------------------
  EventBus.on('hud:score', (score) => overlay.hud.setScore(score));
  EventBus.on('hud:shields', (current, max) => overlay.hud.setShields(current, max));
  EventBus.on('hud:message', (text, durationMs) => overlay.hud.setMessage(text, durationMs));
  EventBus.on('hud:clear-message', () => overlay.hud.clearMessage());

  // --- Teardown ------------------------------------------------------------
  window.addEventListener('pagehide', () => {
    overlay.destroy();
    game.destroy(true);
  });

  if (import.meta.env.DEV) {
    // Handy for poking at the running game from the devtools console.
    Object.assign(window, { game, overlay, EventBus });
    import.meta.hot?.dispose(() => {
      overlay.destroy();
      game.destroy(true);
    });
  }
}

void bootstrap().catch((error: unknown) => {
  console.error('[revenger] fatal boot error', error);
  const splash = document.getElementById('boot-splash');
  if (splash) {
    splash.classList.remove('is-hidden');
    splash.textContent = 'Failed to start — WebGL may be unavailable.';
  }
});
