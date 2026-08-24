import { fileURLToPath, URL } from 'node:url';
// `vitest/config` re-exports Vite's defineConfig plus the typed `test` block.
import { defineConfig } from 'vitest/config';
import checker from 'vite-plugin-checker';

export default defineConfig({
  // Relative base so the build can be dropped on any static host / itch.io zip.
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    // Surfaces TS errors in the browser overlay during `npm run dev`.
    checker({ typescript: true }),
  ],
  server: {
    port: 5173,
    open: true,
  },
  preview: {
    port: 4173,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 1600, // Phaser + Pixi are large by nature
    rollupOptions: {
      output: {
        // Keep the two engines in their own long-cached chunks so game-code
        // changes don't invalidate ~2MB of vendor JS on every deploy.
        manualChunks: {
          phaser: ['phaser'],
          pixi: ['pixi.js'],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
  },
});
