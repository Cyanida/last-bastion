/**
 * #184: review screenshots of the new look.   node scripts/ui-previews.mjs   (after `npm run build`)
 * Renders the title screen and the champion select (#65) at 1280x720 and in phone landscape (844x390, touch), and a kit sheet with every component of
 * src/ui/kit.css (built with kit.ts, #185), into docs/review/0.9.0/. These are review images for the issue, not game assets.
 * #189: and every screen of the screen tour at both sizes; `PREVIEW_DIST=<an older build> PREVIEW_TAG=before` renders the before pictures.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { spawnTree, killTree } from './lib/process-tree.mjs';
import { tour } from './lib/screen-tour.mjs';

const PORT = Number(process.env.PREVIEW_PORT ?? 4190);
const OUT = 'docs/review/0.9.0';
// #189: PREVIEW_DIST serves another build (an older release's, for the "before" pictures), PREVIEW_TAG names its pictures
const DIST = process.env.PREVIEW_DIST ?? 'dist';
const TAG = process.env.PREVIEW_TAG ?? 'after';
const preview = spawnTree(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', '--port', String(PORT), '--strictPort', '--outDir', DIST], { stdio: 'ignore', shell: process.platform === 'win32' });
process.on('exit', () => killTree(preview));
for (let i = 0; i < 60 && !(await fetch(`http://localhost:${PORT}/`).then(() => true, () => false)); i++) await new Promise((r) => setTimeout(r, 250));
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
async function shot(file, viewport, touch, prepare) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
  await page.goto(`http://localhost:${PORT}/?debug`);
  await page.getByText('Take up arms').first().waitFor();
  if (prepare) await page.evaluate(prepare);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${file}` });
  await page.close();
  console.log(`${OUT}/${file}`);
}

if (TAG === 'after') {
await shot('title-1280x720.png', { width: 1280, height: 720 });
await shot('title-phone-844x390.png', { width: 844, height: 390 }, true);
// #65: the champion select
const champions = () => document.querySelector('[data-go="start"]').click();
await shot('champions-1280x720.png', { width: 1280, height: 720 }, false, champions);
await shot('champions-phone-844x390.png', { width: 844, height: 390 }, true, champions);
// #185: the kit sheet is built with the kit's own helpers (kit.ts, on window.__lb with ?debug), so it shows what screens get
await shot('kit-sheet.png', { width: 1280, height: 800 }, false, () => {
  const k = window.__lb.kit;
  const cap = (t) => `<div style="font:800 11px var(--kit-num);letter-spacing:.08em;text-transform:uppercase;color:#cdb68a;margin-bottom:-8px">${t}</div>`;
  const rarities = [['common', 'steel'], ['rare', 'frost'], ['legendary', 'flame'], ['class', 'grave'], ['signature', 'holy']];
  const o = document.getElementById('overlay');
  o.innerHTML = `
    <div class="kit-sheet" style="display:grid;grid-template-columns:1fr 1fr;gap:20px 40px;align-items:start;color:#f3ead0;font-family:var(--body);max-width:1200px">
      <div style="display:grid;gap:16px;justify-items:start">
        ${cap('ribbon')}${k.ribbon('The Marches · Level 3')}
        ${cap('buttons: gold main, go, wood · big, normal, small · pressed, disabled')}
        <div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap">${k.button('Fight!', { kind: 'gold', size: 'big' })}${k.button('Play', { kind: 'go', size: 'big' })}${k.closeButton('close')}${k.closeButton('back')}</div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          ${k.button('Gold', { kind: 'gold' })}${k.button('Pressed', { kind: 'gold', cls: 'pressed' })}${k.button('Go', { kind: 'go' })}${k.button('Pressed', { kind: 'go', cls: 'pressed' })}
          ${k.button('Wood', { icon: 'keep' })}${k.button('Pressed', { cls: 'pressed' })}${k.button('Small', { size: 'small' })}${k.button('Locked', { icon: 'lock', disabled: true })}
        </div>
        ${cap('currency pills')}<div style="display:flex;gap:14px">${k.pill('gold', 12480)}${k.pill('runes', 36)}${k.pill('crown', '3/8')}</div>
        ${cap('rarity frames')}<div style="display:flex;gap:16px">${rarities.map(([r, i]) => `<div style="display:grid;justify-items:center;gap:6px;font:800 12px var(--kit-num);text-transform:uppercase;letter-spacing:.05em">${k.rarityIcon(r, i)}${r}</div>`).join('')}</div>
        ${cap('icon atlas')}<div style="display:flex;flex-wrap:wrap;gap:6px;max-width:560px;background:#0c0806;padding:8px;border-radius:8px">${k.ICON_IDS.map((i) => `<span title="${i}">${k.icon(i, 2)}</span>`).join('')}</div>
      </div>
      <div style="display:grid;gap:16px">
        ${cap('frame and parchment')}
        ${k.frame(k.parch('<b style="font:800 16px var(--kit-num)">Parchment in a wood frame</b><p style="margin:6px 0 0;font-size:16px;line-height:1.3">Dark wood with a brass inner line and rivets holds everything on screen; parchment holds anything you read.</p>'))}
        ${cap('list rows / cards')}
        <div style="display:grid;gap:8px">
          ${k.row('<b>Ember Crown</b><br>Your fire spreads to one more foe.', { lead: k.rarityIcon('legendary', 'flame'), end: k.button('Take', { kind: 'go', size: 'small' }) })}
          ${k.row('<b>Frostbite</b><br>Chilled foes take 15% more damage.', { cls: 'on', lead: k.rarityIcon('rare', 'frost'), end: k.pill('gold', 120) })}
          ${k.row('<b>Sealed</b><br>Clear the Iron Hold to open.', { cls: 'locked', lead: k.rarityIcon('common', 'lock') })}
        </div>
        ${cap('settings')}
        ${k.frame(k.parch(`<div style="display:grid;gap:10px">${k.toggle(`${k.icon('music')} Music`, 'music', true)}${k.toggle(`${k.icon('sound')} Screen shake`, 'shake', false)}${k.slider(`${k.icon('sound')} Volume`, 'volume', 70)}</div>`))}
        ${cap('tab bar')}${k.tabs(k.MAIN_TABS, 'champion')}
      </div>
    </div>`;
  o.classList.remove('hidden');
});}

// #189: every screen of the screen tour (lib/screen-tour.mjs), played through its buttons: 189-<screen>-<before|after>-<size>.jpg
for (const [size, viewport, touch] of [['1280x720', { width: 1280, height: 720 }, false], ['phone', { width: 844, height: 390 }, true]]) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
  await page.goto(`http://localhost:${PORT}/?debug&dev=1`);
  await page.getByText('Take up arms').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  const { skipped } = await tour(page, async (name) => {
    await page.screenshot({ path: `${OUT}/189-${name}-${TAG}-${size}.jpg`, type: 'jpeg', quality: 80 }); // 80 pictures: JPEG keeps the repo light
    console.log(`${OUT}/189-${name}-${TAG}-${size}.jpg`);
  }, { touch });
  if (skipped.length) console.log(`${size}: skipped ${skipped.join(', ')}`);
  await page.close();
}
await browser.close();
process.exit(0);
