// One-off helper: boots the game in headless Chromium and captures screenshots.
// Not part of the build; run manually:
//   node scripts/screenshot.mjs [url] [outDir] [mode]
// mode: "final" (default: menu + battle + shipyard) | "phases" (all 10 build phases)
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://localhost:5173';
const outDir = process.argv[3] ?? '/tmp/shots';
const mode = process.argv[4] ?? 'final';
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (err) => console.log('[pageerror]', err.message));
page.on('console', (msg) => {
  if (msg.type() === 'error') console.log('[console.error]', msg.text());
});

await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(1500);

if (mode === 'phases') {
  await page.keyboard.press('KeyS');
  await page.waitForTimeout(800);
  for (let i = 0; i < 10; i += 1) await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(300);
  for (let phase = 1; phase <= 10; phase += 1) {
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${outDir}/phase${String(phase).padStart(2, '0')}.png` });
    if (phase < 10) await page.keyboard.press('ArrowRight');
  }
} else {
  await page.screenshot({ path: `${outDir}/01-main-menu.png` });

  // Battle: launch, fly a bit, aim & shoot.
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2200); // menu fade-out + battle fade-in
  await page.mouse.move(900, 250);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(600);
  await page.keyboard.down('Space');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${outDir}/02-battle.png` });
  await page.keyboard.up('Space');
  await page.keyboard.up('KeyW');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(700);

  // Shipyard, final phase.
  await page.keyboard.press('KeyS');
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${outDir}/03-shipyard.png` });
}

await browser.close();
console.log('done');
