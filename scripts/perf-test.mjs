/**
 * Automated performance test.   npm run test:perf   (after `npm run build`)
 *
 * Serves the production build and opens it in headless Chromium (1400x800). For each scenario it scripts a wave-20
 * fight with 250 enemies under a wave modifier (Fog, Blood Moon) through the same hook the F3 overlay uses
 * (?debug enables it in a build), then lets the game's own requestAnimationFrame loop run for 300 frames and reads
 * the frame-to-frame times it recorded. Measuring the live loop matters: a synchronous "render 300 times" loop never
 * yields to the compositor, so the canvas raster work piles up and is paid in 40 ms lumps that a real frame never sees.
 *
 * The horde is topped up to 250 every half second so it does not thin out while measuring.
 * Fails when the 95th-percentile frame time exceeds PERF_BUDGET_MS (default 20 ms, the desktop target: one frame at
 * 60 Hz is 16.7 ms, so a p95 under 20 means at most a few dropped frames in 5 s). CI runners raster in software
 * and are slower than a desktop, so the workflow passes a looser budget.
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const BUDGET = Number(process.env.PERF_BUDGET_MS ?? 20);
const PORT = 4179;
const SCENARIOS = ['fog', 'bloodMoon'];
const FRAMES = 300;

const preview = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: process.platform === 'win32' });
const stop = () => preview.kill();
process.on('exit', stop);
for (let i = 0; i < 60; i++) {
  try {
    await fetch(`http://localhost:${PORT}/`);
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 250));
  }
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 800 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.goto(`http://localhost:${PORT}/?debug`);
await page.waitForFunction(() => typeof window.__lb !== 'undefined');

const results = [];
for (const modifier of SCENARIOS) {
  await page.evaluate((modifier) => {
    const lb = window.__lb;
    localStorage.clear();
    lb.start('viking');
    const g = lb.game;
    g.player.invulnerable = true;
    g.player.stats.hp = 1e6;
    g.player.hp = 1e6;
    g.player.stats.atkSpd = 2;
    g.player.stats.str = 30;
    for (const id of ['stormPennant', 'powderKeg', 'brimstoneOil', 'frostBrand', 'whetstone', 'echoBell']) g.relics.push(id);
    g.player.upgrades.push('dreadHowl', 'whirlwind', 'frenzy');
    g.baseMods.xp = 0; // no level-ups: a choice screen would pause the sim mid-measurement
    g.relicPool = []; // no relic offers either
    g.wave = 19;
    g.breather = 0.01;
    g.tier = { ...g.tier, eliteMult: 2 };
    lb.run(2, false, true);
    g.modifier = modifier;
    const kinds = ['peasant', 'wolf', 'crossbow', 'knight', 'shieldBearer', 'cultist'];
    const topUp = () => {
      while (g.enemies.length + g.spawnQueue.length < 250) g.spawnQueue.push({ id: kinds[(g.enemies.length + g.spawnQueue.length) % 6], affixes: g.enemies.length % 9 === 0 ? ['shielded'] : [], squad: -1, commander: false });
      g.spawnTimer = 0;
      g.spawnInterval = 0.01;
    };
    topUp();
    lb.run(180, true, true); // the fight is on: particles, numbers, procs, and the sprite caches are warm
    window.__topUp = setInterval(() => lb.state === 'playing' && (g.modifier = modifier, topUp()), 500);
    lb.setPerf(true); // section timers and draw counts, like the overlay
    lb.resetPerf();
  }, modifier);
  await page.waitForFunction((n) => window.__lb.perfSummary().frames >= n, FRAMES, { timeout: 60000 });
  const r = await page.evaluate(() => {
    const lb = window.__lb;
    clearInterval(window.__topUp);
    const s = lb.perfSummary();
    const g = lb.game;
    const sections = Object.entries(lb.perf.sections).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(', ');
    const out = { ...s, state: lb.state, lastUpdate: lb.perf.updateMs, lastRender: lb.perf.renderMs, enemies: g.enemies.length, draws: lb.perf.counts.draws, particles: g.particles.length, texts: g.texts.length, detail: lb.quality.detail, sections };
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));
    document.querySelector('[data-quit]')?.click();
    document.querySelector('[data-menu]')?.click();
    document.querySelector('[data-back]')?.click();
    return out;
  });
  results.push({ modifier, ...r });
}
await browser.close();
stop();

let failed = false;
console.log(`\nperf test · wave 20 · 250 enemies · ${FRAMES} live frames · budget p95 <= ${BUDGET} ms\n`);
for (const r of results) {
  const ok = r.p95 <= BUDGET;
  failed ||= !ok;
  const f = (n) => n.toFixed(1).padStart(6);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${r.modifier.padEnd(10)} frame avg ${f(r.avg)}  p95 ${f(r.p95)}  max ${f(r.max)}  | update ${r.update.toFixed(2)} (last ${r.lastUpdate.toFixed(2)})  render ${r.render.toFixed(2)} (last ${r.lastRender.toFixed(2)})  | enemies ${r.enemies}  draws ${r.draws}  particles ${r.particles}  texts ${r.texts}  detail ${r.detail.toFixed(2)}`);
  console.log(`      heaviest sections (last frame): ${r.sections}  · state ${r.state}`);
}
console.log('');
process.exit(failed ? 1 : 0);
