/**
 * #184: review screenshots of the new look.   node scripts/ui-previews.mjs   (after `npm run build`)
 * Renders the title screen at 1280x720 and in phone landscape (844x390, touch), and a kit sheet with every component of
 * src/ui/kit.css, into docs/review/0.9.0/. These are review images for the issue, not game assets.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { spawnTree, killTree } from './lib/process-tree.mjs';

const PORT = Number(process.env.PREVIEW_PORT ?? 4190);
const OUT = 'docs/review/0.9.0';
const preview = spawnTree(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: process.platform === 'win32' });
process.on('exit', () => killTree(preview));
for (let i = 0; i < 60 && !(await fetch(`http://localhost:${PORT}/`).then(() => true, () => false)); i++) await new Promise((r) => setTimeout(r, 250));
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
async function shot(file, viewport, touch, prepare) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
  await page.goto(`http://localhost:${PORT}/`);
  await page.getByText('Take up arms').first().waitFor();
  if (prepare) await page.evaluate(prepare);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${file}` });
  await page.close();
  console.log(`${OUT}/${file}`);
}

await shot('title-1280x720.png', { width: 1280, height: 720 });
await shot('title-phone-844x390.png', { width: 844, height: 390 }, true);
await shot('kit-sheet.png', { width: 1280, height: 720 }, false, () => {
  const icons = ['gold', 'runes', 'crown', 'steel', 'flame', 'frost', 'storm', 'holy', 'blood', 'grave', 'map', 'keep'];
  const rarity = [['common', 'steel'], ['rare', 'frost'], ['legendary', 'flame'], ['class', 'grave'], ['signature', 'holy']];
  const tabs = [['map', 'Map'], ['steel', 'Champion'], ['keep', 'Keep'], ['holy', 'Relics'], ['crown', 'Deeds']];
  const o = document.getElementById('overlay');
  o.innerHTML = `
    <div class="kit-sheet" style="display:grid;grid-template-columns:1fr 1fr;gap:26px 40px;align-items:start;color:#f3ead0;font-family:var(--body);max-width:1180px">
      <div style="display:grid;gap:18px;justify-items:start">
        <div><div class="kit-ribbon">The Marches · Level 3</div></div>
        <div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap">
          <button class="kit-btn gold big">Fight!</button><button class="kit-btn go big">Play</button>
        </div>
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
          <button class="kit-btn gold">Gold</button><button class="kit-btn gold pressed">Pressed</button>
          <button class="kit-btn go">Go</button><button class="kit-btn go pressed">Pressed</button>
          <button class="kit-btn wood">Wood</button><button class="kit-btn wood pressed">Pressed</button>
          <button class="kit-btn wood small">Small</button><button class="kit-btn wood" disabled>Locked</button>
        </div>
        <div style="display:flex;gap:14px">
          <span class="kit-pill"><i class="kit-icon i-gold"></i>12,480</span><span class="kit-pill"><i class="kit-icon i-runes"></i>36</span><span class="kit-pill"><i class="kit-icon i-crown"></i>3/8</span>
        </div>
        <div style="display:flex;gap:16px">${rarity.map(([r, i]) => `<div style="display:grid;justify-items:center;gap:6px;font:800 12px var(--heading);text-transform:uppercase;letter-spacing:.05em"><span class="kit-rarity ${r}"><i class="kit-icon i-${i}"></i></span>${r}</div>`).join('')}</div>
        <div style="display:flex;gap:6px;background:#0c0806;padding:8px;border-radius:8px">${icons.map((i) => `<i class="kit-icon i-${i}" style="--s:2" title="${i}"></i>`).join('')}</div>
      </div>
      <div style="display:grid;gap:22px">
        <div class="kit-frame"><div class="kit-parch"><b style="font:800 16px var(--heading)">Parchment in a wood frame</b>
          <p style="margin:6px 0 0;font-size:16px;line-height:1.3">Dark wood with a brass inner line and brass rivets holds everything on screen; parchment holds anything you read. Alegreya Sans for text, Cinzel 800 and 900 for buttons, ribbons and numbers.</p></div></div>
        <div class="kit-frame" style="padding:18px"><div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><button class="kit-btn go big">Play</button><button class="kit-btn wood">Loadout</button></div></div>
        <div class="kit-tabs">${tabs.map(([i, t], n) => `<button class="kit-tab ${n === 1 ? 'on' : ''}"><i class="kit-icon i-${i}"></i>${t}</button>`).join('')}</div>
      </div>
    </div>`;
  o.classList.remove('hidden');
});
await browser.close();
process.exit(0);
