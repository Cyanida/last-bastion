/**
 * #210: pictures of an arena for review.   node scripts/arena-preview.mjs <arena> <out-prefix>   (after `npm run build`)
 * Writes <out-prefix>-map.png (the whole baked map, every wing drawn open, at half size) and <out-prefix>-play.png (a test-mode run
 * at Act I wave 10 with the wing opened by then, the champion in the first wing that opened, at 1280x720).
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { spawnTree, killTree } from './lib/process-tree.mjs';

const [arena = 'keep', out = 'arena'] = process.argv.slice(2);
const PORT = Number(process.env.PREVIEW_PORT ?? 4232);
const preview = spawnTree(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: process.platform === 'win32' });
process.on('exit', () => killTree(preview));
for (let i = 0; i < 60; i++) {
  if (await fetch(`http://localhost:${PORT}/`).then(() => true, () => false)) break;
  await new Promise((r) => setTimeout(r, 250));
}
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await page.goto(`http://localhost:${PORT}/?debug&dev=1`);
await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu' && window.__lb.props());
const map = await page.evaluate(async (arena) => {
  const lb = window.__lb, wait = (ms = 80) => new Promise((r) => setTimeout(r, ms));
  [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Settings').click();
  await wait(150);
  document.querySelector('[data-act="test"]').click();
  await wait();
  const set = (id, v) => {
    const el = document.getElementById(id);
    el.value = v;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  set('tm-arena', arena);
  set('tm-wave', '10');
  const now = Date.now;
  Date.now = () => 2654435761;
  [...document.querySelectorAll('button')].find((b) => /start test run/i.test(b.textContent)).click();
  Date.now = now;
  const g = lb.game;
  g.player.invulnerable = true;
  for (let i = 0; i < 40 && !(lb.state === 'playing' && g.time > 0.3); i++) {
    if (lb.state === 'choice') lb.run(1, false, 'input');
    await wait(50);
  }
  const src = lb.arenaCanvas(g.arena.id), c = document.createElement('canvas');
  [c.width, c.height] = [src.width / 2, src.height / 2];
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  const wing = g.arena.regions.find((r) => r.id !== 'core' && g.regionOpen[r.id]);
  if (wing) Object.assign(g.player, { x: wing.floor.x + wing.floor.w / 2 - 90, y: wing.floor.y + wing.floor.h / 2 + 40 });
  g.enemies.length = 0;
  await wait(400);
  return c.toDataURL('image/png');
}, arena);
writeFileSync(`${out}-map.png`, Buffer.from(map.split(',')[1], 'base64'));
await page.screenshot({ path: `${out}-play.png` });
await browser.close();
console.log(`${out}-map.png, ${out}-play.png`);
process.exit(0);
