/**
 * Automated play test.   npm run test:play   (after `npm run build`)
 *
 * Plays the production build in headless Chromium the way a person checks a change by hand: every choice screen answered
 * through its real buttons (level-up with rerolls and a banish, relic offers with reroll, duo, take and skip, both upgrade
 * screens, the quest board, the shrine, the peddler, the Merchant's every action, the route fork, a talent from the pause
 * menu, Esc out of its sub-screens), the keyboard, mouse and touch controls, the sounds the simulation asks for, the particle budget, the perf sections,
 * and banking a real run. Any console error fails it.
 *
 * Screens are brought up through the game's own pending queues (a level-up, a relic offer, the Merchant), so each one is
 * reached every time instead of waiting for the bot to happen upon it; the answers go through the real screen code.
 * The routine and CI run it on every pull request. A change a player sees gets its own check added here (see AGENTS.md).
 * Not covered: a gamepad beyond the press that answers a screen, and how it feels.
 */
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { spawnTree, killTree, waitForServer } from './lib/process-tree.mjs';

const PORT = Number(process.env.PLAY_PORT ?? 4180);

// a server already on the port would be tested instead of this build (and pass for it): refuse
if (await fetch(`http://localhost:${PORT}/`).then(() => true, () => false)) {
  console.error(`port ${PORT} is already in use: stop that server or set PLAY_PORT`);
  process.exit(1);
}
const preview = spawnTree(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: process.platform === 'win32' });
// #179: end the whole server tree (its vite child included), on success, failure and a signal, Linux and Windows alike
const stop = () => killTree(preview);
process.on('exit', stop);
process.on('SIGINT', () => { stop(); process.exit(130); });
process.on('SIGTERM', () => { stop(); process.exit(143); });
await waitForServer(`http://localhost:${PORT}/`, PORT);

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
// Test mode seeds its run from the clock, so a check would play a different run each time: every test-mode start goes through
// here, on a fixed seed. It returns synchronously, so a check can set its run up before a real frame steps it.
await page.addInitScript(() => {
  window.__startTest = (seed = 2654435761) => {
    const now = Date.now;
    Date.now = () => seed;
    try {
      [...document.querySelectorAll('button')].find((b) => /start test run/i.test(b.textContent)).click();
    } finally {
      Date.now = now;
    }
    return window.__lb.game;
  };
});
await page.goto(`http://localhost:${PORT}/?debug&dev=1`);
await page.waitForFunction(() => typeof window.__lb !== 'undefined');

const results = [];
/**
 * One named check: `fn` runs in the page (or here, for keyboard and mouse) and returns { ok, detail }, or { skip, detail } when the
 * branch's code lacks what the check needs (a patch branch cut from an older release).
 */
async function check(name, fn) {
  if (process.env.PLAY_ONLY && !process.env.PLAY_ONLY.split('|').some((part) => name.includes(part))) return; // a filter for repeated runs: PLAY_ONLY='(#211)|(#212)' runs the checks whose names hold any of these parts
  try {
    const r = await fn();
    results.push({ name, ok: !!r.ok || !!r.skip, skip: !!r.skip, detail: r.detail ?? '' });
  } catch (e) {
    results.push({ name, ok: false, detail: `threw: ${String(e.message ?? e).split('\n')[0]}` });
  }
}
const inPage = (fn, arg) => page.evaluate(fn, arg);
/**
 * #237: a champion's realm run standing at `level` (its checkpoint), for a check that fights past level 1: the head start is gone, so a
 * later level only goes on from its run. A bare carry: the class's own stats at champion level 1, no relics, no gold.
 */
const runAt = (level, tier = 0) => ({
  level, tier, seed: 20237,
  carry: { level: 1, points: {}, stats: {}, baseMods: {}, upgrades: [], talents: [], utilityUpgrades: [], evolutions: [], revives: 0, relics: { held: [], tiers: {}, attune: {}, from: {}, duos: [], cursedAct: 0 }, gold: 0, talentPoints: 0, rerolls: 0, banishes: 0, bannedStats: [], vars: {} },
});
/**
 * #240: a champion screen's first opening in a browser brings up its tour. A check that is not about the tour leaves it the way a
 * player would, with its Skip button, once: a tour that is not there fails the check here, and one that came up a second time would
 * block the check's next press.
 */
const skipTour = async (p = page, touch = false) => {
  const skip = p.locator('.kit-tour [data-tour-skip]');
  await skip.waitFor({ timeout: 3000 });
  await (touch ? skip.tap() : skip.click());
};
/**
 * #241: after a level's opening relic pick the fight begins. An Act's quest board may still come first (Act I's, at a realm's level 1):
 * its quests are the Act's, not the champion's build, and it is set out from as it stands. Returns the headings of the screens that came
 * before the fight, for the check to see that none was a build screen.
 */
const intoFight = async (p, press) => {
  const seen = [];
  for (let i = 0; i < 4; i++) {
    await p.waitForTimeout(200); // the run steps a tick before its next screen opens
    await p.waitForFunction(() => window.__lb.state === 'playing' || !!document.querySelector('#overlay .kit-head'), null, { timeout: 5000 }).catch(() => {});
    const head = await p.evaluate(() => (window.__lb.state === 'choice' ? document.querySelector('#overlay .kit-head')?.textContent.trim() ?? '?' : ''));
    if (!head) break;
    seen.push(head);
    if (!(await p.locator('#overlay [data-leave]').count())) break; // not a board: the check fails on its heading
    await press('#overlay [data-leave]');
  }
  return seen;
};
/**
 * #204: the Daily Trial is the one full 40-wave run left on the menus (the Classic run is gone). Opened as a save that already took a
 * trial keeps it (a check's own save has no Marches crown), then begun from the title through its own screen, as a player does.
 */
const beginDaily = (p = page) => p.evaluate(async () => {
  const lb = window.__lb, wait = (ms = 60) => new Promise((r) => setTimeout(r, ms));
  lb.save.daily['2000-01-01'] ??= 1;
  document.querySelector('[data-go="settings"]').click(); // the title again, now with the trial open
  await wait();
  document.querySelector('.settings [data-act="back"]').click();
  await wait();
  document.querySelector('[data-go="daily"]').click();
  await wait();
  document.querySelector('.kit-screen.daily [data-start]').click();
  await wait(200);
  return lb.game?.daily ?? null;
});

// helpers inside the page: step the game, open a screen, click through it
await inPage(() => {
  const lb = window.__lb;
  const sounds = {};
  if (lb.view) {
    const real = lb.view.sfx; // v0.8: the simulation's only way to the speaker
    lb.view.sfx = (n) => {
      sounds[n] = (sounds[n] ?? 0) + 1;
      real(n);
    };
  }
  const cards = () => [...document.querySelectorAll('[data-pick]')].map((b) => b.querySelector('h2,h3,b,strong')?.textContent.trim() ?? b.innerText.split('\n')[1]);
  window.__play = {
    sounds,
    cards,
    wait: (ms = 60) => new Promise((r) => setTimeout(r, ms)),
    /** Steps (the bot moves) until a choice screen is up, at most n ticks. */
    toChoice(n = 5) {
      for (let i = 0; i < n && lb.state === 'playing'; i++) lb.run(1, false, true);
      return lb.state === 'choice';
    },
    /** Steps with the bot, answering any screen with its first option, keeping the champion alive. */
    play(n) {
      for (let i = 0; i < n && lb.game && lb.state !== 'results' && lb.state !== 'menu'; i++) lb.run(1, false, true);
    },
    click: async (sel) => {
      const el = document.querySelector(sel);
      if (!el) throw new Error(`no ${sel} on screen (${document.querySelector('h1,h2')?.textContent.trim() ?? '?'})`);
      el.click();
      await new Promise((r) => setTimeout(r, 60));
    },
    title: () => document.querySelector('[data-pick], [data-leave], [data-quest], [data-heal]')?.closest('section, .overlay, div[class]')?.querySelector('h1,h2,h3')?.textContent.trim() ?? '',
  };
});

await check('title screen', () =>
  inPage(() => {
    const t = document.body.innerText;
    return { ok: window.__lb.state === 'menu' && t.includes('Take up arms'), detail: t.split('\n')[1] ?? '' };
  }),
);

// #184: the title screen wears the new look's kit: a bevelled gold main button that sinks when pressed, the ribbon, a framed
// parchment, the currency pill with the rig's icon atlas loaded
await check('title screen: the UI kit (gold bevelled button that presses, ribbon, frame, currency pill) (#184)', async () => {
  const btn = page.locator('[data-go="start"]');
  const look = () =>
    inPage(() => {
      const b = document.querySelector('[data-go="start"]');
      const cs = getComputedStyle(b);
      const lip = / 0px (\d+)px 0px 0px$/.exec(cs.boxShadow.split(/,(?![^(]*\))/).find((sh) => !sh.includes('inset')) ?? '')?.[1]; // the solid lip under the bevel
      const ribbon = document.querySelector('.kit-title .kit-ribbon');
      const tail = ribbon && getComputedStyle(ribbon, '::before');
      const frame = document.querySelector('.kit-title .kit-frame');
      const pill = document.querySelector('.kit-purse .kit-pill .kit-icon.i-gold');
      return {
        kit: b.classList.contains('kit-btn') && b.classList.contains('gold'),
        bevel: cs.boxShadow.includes('inset'),
        lip: Number(lip ?? 0),
        font: `${cs.fontFamily.split(',')[0]} ${cs.fontWeight}`,
        ribbon: !!ribbon && ribbon.getBoundingClientRect().height > 20 && tail.content !== 'none' && tail.width !== 'auto',
        frame: !!frame && getComputedStyle(frame, '::before').borderTopWidth === '2px' && !!frame.querySelector('.kit-parch .contract'),
        pill: !!pill && getComputedStyle(pill).backgroundImage.includes('ui-icons.png'),
        y: b.getBoundingClientRect().y,
      };
    });
  const up = await look();
  const atlas = await inPage(async () => {
    const img = new Image();
    img.src = 'sprites/ui-icons.png';
    return img.decode().then(() => img.naturalWidth, () => 0);
  });
  const box = await btn.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(120);
  const down = await look();
  await page.mouse.move(0, 0); // let go off the button: no click, the title stays
  await page.mouse.up();
  const still = await inPage(() => window.__lb.state === 'menu' && !!document.querySelector('[data-go="start"]'));
  const ok = up.kit && up.bevel && up.lip >= 4 && down.lip < up.lip && down.y > up.y && /Cinzel/.test(up.font) && up.ribbon && up.frame && up.pill && atlas > 0 && still;
  return { ok, detail: `kit ${up.kit}, bevel ${up.bevel}, lip ${up.lip} -> ${down.lip} pressed (sinks ${Math.round(down.y - up.y)} px), ${up.font}, ribbon ${up.ribbon}, frame ${up.frame}, pill ${up.pill}, atlas ${atlas} px wide` };
});

// #185: the kit's helpers build the title screen, and every kit component renders in its classes and works: the tab bar moves its
// open tab on a click, a switch flips, the rarity frames differ in colour and the close button shows its atlas icon
await check('menus: the UI kit helpers build the title and every component works (tabs switch, a switch flips, rarity frames) (#185)', async () => {
  const same = await inPage(() => {
    const k = window.__lb.kit;
    const html = (sel) => document.querySelector(sel)?.outerHTML;
    return [
      html('[data-go="start"]') === k.button('Take up arms', { kind: 'gold', size: 'big', attrs: 'data-go="start"' }),
      html('[data-go="keep"]') === k.button('The Keep', { icon: 'keep', attrs: 'data-go="keep"' }),
      html('.kit-purse .kit-pill') === k.pill('gold', window.__lb.save.gold, { title: 'Gold' }),
    ];
  });
  await inPage(() => {
    const k = window.__lb.kit;
    const d = document.createElement('div');
    d.id = 'kit-check';
    d.style.cssText = 'position:fixed;inset:0;z-index:9999;display:grid;align-content:start;gap:12px;padding:20px;background:#0c0806';
    d.innerHTML = k.tabs(k.MAIN_TABS, 'champion') + k.frame(k.parch(k.toggle('Music', 'music', false))) +
      k.row('<b>Relic</b>', { lead: k.rarityIcon('common', 'steel') + k.rarityIcon('signature', 'holy'), end: k.closeButton('close') });
    document.body.append(d);
    window.__kitPicked = [];
    k.wireTabs(d, (id) => window.__kitPicked.push(id));
  });
  await page.click('#kit-check [data-tab="relics"]');
  await page.click('#kit-check .kit-toggle');
  const r = await inPage(() => {
    const d = document.getElementById('kit-check');
    const knob = getComputedStyle(d.querySelector('.kit-toggle > i'), '::after').transform;
    const rim = (sel) => getComputedStyle(d.querySelector(sel)).borderTopColor;
    const out = {
      on: [...d.querySelectorAll('.kit-tab.on')].map((t) => t.dataset.tab).join(),
      picked: window.__kitPicked.join(),
      toggled: d.querySelector('[data-set="music"]').checked && knob !== 'none',
      rarity: rim('.kit-rarity.common') !== rim('.kit-rarity.signature'),
      close: getComputedStyle(d.querySelector('.kit-close .kit-icon.i-close')).backgroundImage.includes('ui-icons.png') && d.querySelector('.kit-close').getBoundingClientRect().width >= 38,
      frame: getComputedStyle(d.querySelector('.kit-frame'), '::before').borderTopWidth === '2px',
    };
    d.remove();
    delete window.__kitPicked;
    return out;
  });
  const ok = same.every(Boolean) && r.on === 'relics' && r.picked === 'relics' && r.toggled && r.rarity && r.close && r.frame;
  return { ok, detail: `title from helpers ${same.join('/')}, tab ${r.on} (picked ${r.picked}), switch ${r.toggled}, rarity colours ${r.rarity}, close ${r.close}, frame ${r.frame}` };
});

// #186: Settings and the results in the kit, on PC and phone landscape, played through their controls: the framed screen with its
// ribbon, choices as pressed wood buttons, the Sound switch, the Effects slider by keyboard, the back disc; then a real run ended from
// the pause menu, its results framed with the one gold main button, the atlas's gold icon, everything in the window, and the wood
// button home (#204: the run is the Daily Trial, and it goes back to the title). Mouse on PC, touch taps on the phone.
await check('Settings and results: the UI kit, their controls work, all in the window at 1280x720 and 844x390 (#186)', async () => {
  const seen = [];
  for (const [w, h, touch] of [[1280, 720, false], [844, 390, true]]) {
    const p = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: touch });
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
    await p.goto(`http://localhost:${PORT}/?debug`);
    await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
    const press = (sel) => (touch ? p.locator(sel).first().tap() : p.locator(sel).first().click());
    // all of the frame in the window; the parchment scrolls if it must, and its last line comes into view
    const inside = (sel) =>
      p.evaluate((sel) => {
        const f = document.querySelector(sel).getBoundingClientRect();
        const btns = [...document.querySelectorAll(`${sel} footer .kit-btn, ${sel} .kit-close`)].every((b) => {
          const r = b.getBoundingClientRect();
          return r.top >= f.top && r.bottom <= f.bottom + 6; // the lip may sit on the frame's edge
        });
        const scroll = document.querySelector(`${sel} .kit-scroll`);
        const last = scroll.lastElementChild;
        last.scrollIntoView({ block: 'nearest' });
        const lr = last.getBoundingClientRect(), sr = scroll.getBoundingClientRect();
        return f.top >= 0 && f.left >= 0 && f.bottom <= innerHeight && f.right <= innerWidth && btns && lr.bottom <= sr.bottom + 1;
      }, sel);
    await press('[data-go="settings"]');
    const set = await p.evaluate(() => {
      const root = document.querySelector('.kit-screen.settings');
      return {
        frame: !!root && root.classList.contains('kit-frame') && !!root.querySelector('.kit-parch.kit-scroll .setting'),
        ribbon: root?.querySelector('.kit-head .kit-ribbon')?.textContent.trim(),
        choices: [...document.querySelectorAll('[data-quality], [data-text-size], [data-aim]')].every((b) => b.classList.contains('kit-btn')) && document.querySelectorAll('.kit-choice .kit-btn.on.pressed').length === 3,
        switches: document.querySelectorAll('.settings .kit-toggle').length,
        sliders: document.querySelectorAll('.settings .kit-slider input[type=range]').length,
      };
    });
    const fitsSet = await inside('.kit-screen.settings');
    await press('[data-text-size="large"]');
    const large = await p.evaluate(() => {
      const b = document.querySelector('[data-text-size="large"]');
      return b.classList.contains('on') && b.getAttribute('aria-pressed') === 'true' && window.__lb.save.settings.textSize === 'large';
    });
    await press('[data-text-size="normal"]');
    const sound = p.locator('.kit-toggle:has([data-set="mute"])');
    const soundBefore = (await sound.textContent()).trim();
    await sound.click(); // a label: a click or a tap flips it alike
    const soundAfter = (await sound.textContent()).trim();
    const checked = await p.locator('[data-set="mute"]').isChecked();
    await sound.click();
    const fx = p.locator('[data-set="effects"]');
    const fxBefore = (await p.locator('.kit-slider:has([data-set="effects"]) [data-level]').textContent()).trim();
    await fx.focus();
    await p.keyboard.press('ArrowLeft');
    await p.waitForTimeout(60);
    const fxAfter = (await p.locator('.kit-slider:has([data-set="effects"]) [data-level]').textContent()).trim();
    await p.locator('[data-set="effects"]').focus();
    await p.keyboard.press('ArrowRight');
    await press('.settings [data-act="back"]');
    const title = await p.locator('[data-go="start"]').count();
    // a real run (#204: the Daily Trial), ended from the pause menu
    await beginDaily(p);
    await p.waitForFunction(() => window.__lb.state !== 'menu'); // the quest board comes first
    await p.evaluate(() => { // the bot answers the screens; stop mid-fight, where Esc pauses
      const lb = window.__lb;
      for (let i = 0; i < 400 && !(i > 60 && lb.state === 'playing'); i++) lb.run(1, false, true);
    });
    await p.keyboard.press('Escape');
    await press('[data-quit]');
    await p.locator('.kit-screen.results').waitFor({ timeout: 3000 });
    const res = await p.evaluate(() => {
      const root = document.querySelector('.kit-screen.results');
      const gold = [...root.querySelectorAll('.kit-btn.gold')];
      const banked = [...root.querySelectorAll('.stats > div')].find((d) => d.firstElementChild?.textContent === 'Gold banked');
      return {
        ribbon: root.querySelector('.kit-head .kit-ribbon')?.textContent.trim(),
        main: gold.length === 1 && gold[0].matches('[data-retry].big') && gold[0].textContent.startsWith('Quick restart'),
        menu: root.querySelector('[data-menu]')?.classList.contains('wood'),
        icon: !!banked?.querySelector('.kit-icon.i-gold') && getComputedStyle(banked.querySelector('.kit-icon')).backgroundImage.includes('ui-icons.png'),
        seed: !!root.querySelector('.stats .seed')?.textContent.trim(),
      };
    });
    const fitsRes = await inside('.kit-screen.results');
    await press('[data-menu]');
    const select = await p.evaluate(() => !!document.querySelector('.kit-title [data-go="daily"]') && !document.querySelector('.kit-screen.results')); // #204: a trial goes home
    await p.close();
    const ok = set.frame && set.ribbon === 'Settings' && set.choices && set.switches >= 3 && set.sliders === 2 && fitsSet && large &&
      soundBefore === 'On' && soundAfter === 'Off' && !checked && fxBefore !== fxAfter && title > 0 &&
      res.ribbon === 'The run ends' && res.main && res.menu && res.icon && res.seed && fitsRes && select && errs.length === 0;
    seen.push({ ok, detail: `${w}x${h}: settings ${set.frame}/${set.ribbon}, choices ${set.choices}, ${set.switches} switches, ${set.sliders} sliders, fits ${fitsSet}, Large ${large}, sound ${soundBefore}->${soundAfter}, effects ${fxBefore}->${fxAfter}, back ${title > 0}; results "${res.ribbon}", gold main ${res.main}, wood ${res.menu}, icon ${res.icon}, fits ${fitsRes}, home ${select}${errs.length ? `, errors: ${errs[0]}` : ''}` });
  }
  return { ok: seen.every((x) => x.ok), detail: seen.map((x) => x.detail).join(' | ') };
});

// #187: the compendium, the glossary and the flash cards in the kit, played at 1280x720 with the mouse and in phone landscape by touch:
// each is a wood frame with a ribbon heading that fits the screen, what you read on parchment that scrolls, the round back button in its
// corner (which goes back); every relic row has its icon in the frame of its rarity; a flash card's one button is gold and closes it
await check('menus: the compendium, glossary and flash cards in the kit, every relic in its rarity frame, at 1280x720 and phone landscape (#187)', async () => {
  const seen = [];
  for (const [w, h, touch] of [[1280, 720, false], [844, 390, true]]) {
    const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    const press = (sel) => (touch ? p.locator(sel).first().tap() : p.locator(sel).first().click());
    await p.goto(`http://localhost:${PORT}/?debug`);
    await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
    // a save that found a common, a legendary and a champion's own relic, and met two foes and a mark
    await p.evaluate(() => {
      const s = window.__lb.save;
      s.relicPicks = { brimstoneOil: 2, dragonsTongue: 1, fireArrows: 1 };
      s.cards = ['peasant', 'wolf', 'elite'];
    });
    // what a kit book looks like on screen: fits, its ribbon heading, a parchment that scrolls, the back button inside the frame
    const book = (sel) => p.evaluate(async (sel) => {
      const b = document.querySelector(`#overlay > .kit-frame.kit-book${sel}`);
      if (!b) return null;
      const r = b.getBoundingClientRect(), back = b.querySelector('.kit-corner.kit-close[data-back]').getBoundingClientRect();
      const scroll = b.querySelector('.kit-parch.kit-scroll');
      const before = scroll.scrollTop;
      scroll.scrollTop = 400;
      const scrolls = scroll.scrollTop > before && scroll.scrollHeight > scroll.clientHeight;
      scroll.scrollTop = 0;
      return {
        fits: r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1,
        ribbon: b.querySelector('h1 .kit-ribbon')?.textContent,
        scrolls,
        back: back.width >= 38 && back.right <= r.right && back.top >= r.top && getComputedStyle(b.querySelector('.kit-close .kit-icon')).backgroundImage.includes('ui-icons.png'),
        font: getComputedStyle(b.querySelector('.kit-parch h2, .kit-parch dt')).fontFamily,
      };
    }, sel);
    const heading = () => p.locator('#overlay h1').first().textContent();
    await press('[data-go="keep"]');
    await press('[data-compendium]');
    const comp = await book('.compendium');
    const rows = await p.evaluate(() => {
      const rows = [...document.querySelectorAll('.compendium .comp-card')];
      const frame = (id) => document.querySelector(`.comp-card[data-relic="${id}"] > .kit-rarity`);
      const rim = (id) => getComputedStyle(frame(id)).borderTopColor;
      return {
        n: rows.length,
        framed: rows.filter((r) => r.firstElementChild?.matches('.kit-rarity.common, .kit-rarity.rare, .kit-rarity.legendary, .kit-rarity.class, .kit-rarity.signature')).length, // #201: the signature relics in gold
        found: rows.filter((r) => !r.classList.contains('locked')).map((r) => `${r.querySelector('.kit-row-body > b').textContent} ${r.firstElementChild.classList[1]}`),
        glyph: frame('dragonsTongue').textContent === '🐉',
        colours: new Set(['brimstoneOil', 'dragonsTongue', 'fireArrows'].map(rim)).size,
        recipes: document.querySelectorAll('.compendium .recipe > .kit-rarity.signature').length,
        total: Number(document.querySelector('.compendium .sub').textContent.match(/\/ (\d+)/)?.[1]),
      };
    });
    await press('.compendium [data-back]');
    const fromComp = await heading();
    await press('[data-glossary]');
    const gloss = await book('.glossary');
    const terms = await p.evaluate(() => ({ terms: document.querySelectorAll('.glossary .kit-parch > dl:first-child dt').length, met: document.querySelectorAll('.glossary .cards-met dt .card-pic').length }));
    await press('.glossary [data-back]');
    const fromGloss = await heading();
    // a real run by the real screens (#204: the Daily Trial): the first foe brings its flash card
    await press('[data-back]');
    await beginDaily(p);
    await p.waitForFunction(() => !!window.__lb.game); // the run is on (its quest board up); the loop below answers it, as a run's checks do
    const card = await p.evaluate(() => {
      const lb = window.__lb;
      lb.save.cards = [];
      lb.game.player.invulnerable = true;
      for (let i = 0; i < 3000 && !document.querySelector('[data-card]'); i++) lb.run(1, false, true);
      const c = document.querySelector('#overlay > .kit-frame.flash-card[data-card]');
      if (!c) return null;
      const r = c.getBoundingClientRect(), btn = c.querySelector('.kit-btn.gold.big[data-leave]');
      return {
        fits: r.top >= 0 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1,
        ribbon: c.querySelector('.kit-ribbon')?.textContent,
        text: !!c.querySelector('.kit-parch h2') && !!c.querySelector('.kit-parch p')?.textContent,
        pic: !!c.querySelector('.card-pic'),
        gold: btn?.textContent === 'Got it' && c.querySelectorAll('.kit-btn.gold').length === 1,
      };
    });
    if (card) await press('[data-leave]');
    const closed = await p.evaluate(async () => (await new Promise((r) => setTimeout(r, 100)), !document.querySelector('[data-card]') && window.__lb.state === 'playing'));
    await p.close();
    const ok = !!comp && comp.fits && comp.ribbon === 'Relic compendium' && comp.scrolls && comp.back && /Cinzel/.test(comp.font) &&
      rows.n === rows.total && rows.framed === rows.n && rows.found.join() === "Brimstone Oil common,Dragon's Tongue legendary,Fire Arrows class" && rows.glyph && rows.colours === 3 && rows.recipes > 0 &&
      fromComp === 'The Keep' && !!gloss && gloss.fits && gloss.ribbon === 'Glossary' && gloss.scrolls && gloss.back && /Cinzel/.test(gloss.font) && terms.terms > 10 && terms.met === 3 && fromGloss === 'The Keep' &&
      !!card && card.fits && card.ribbon === 'New' && card.text && card.pic && card.gold && closed && errs.length === 0;
    seen.push({ ok, detail: `${w}x${h}${touch ? ' touch' : ''}: compendium ${comp ? `fits ${comp.fits}, "${comp.ribbon}", scrolls ${comp.scrolls}, back ${comp.back}` : 'NOT IN THE KIT'}, ${rows.framed}/${rows.n} framed (${rows.found.join(', ')}; ${rows.colours} colours), back to ${fromComp}; glossary ${gloss ? `fits ${gloss.fits}, ${terms.terms} terms, ${terms.met} met, scrolls ${gloss.scrolls}` : 'NOT IN THE KIT'}, back to ${fromGloss}; flash card ${card ? `fits ${card.fits}, "${card.ribbon}", gold ${card.gold}` : 'NONE'}, closed ${closed}${errs.length ? `, errors: ${errs[0]}` : ''}` });
  }
  return { ok: seen.every((s) => s.ok), detail: seen.map((s) => s.detail).join(' · ') };
});

// #189: every menu and choice screen left in the old look is in the kit now. The screen tour (lib/screen-tour.mjs) plays through all
// twenty by their real buttons, with the mouse at 1280x720 and by touch in phone landscape; each has its heading on the ribbon, no old
// button, chip or dialog left, at most one gold main button, and a framed screen fits the window (the choice screens' cards may scroll
// down, never sideways); on touch every kit button is at least 44 px.
await check('menus: every screen in the kit, played through at 1280x720 and phone landscape (#189)', async () => {
  const { tour } = await import('./lib/screen-tour.mjs');
  const seen = [];
  for (const [w, h, touch] of [[1280, 720, false], [844, 390, true]]) {
    const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
    const errs = [];
    p.on('pageerror', (e) => !e.message.includes('screen tour') && errs.push(e.message)); // the crash report's own error is the point
    await p.goto(`http://localhost:${PORT}/?debug&dev=1`);
    await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
    const screens = [];
    const { skipped } = await tour(p, async (name) => {
      screens.push(await p.evaluate((name) => {
        const root = document.getElementById('crash') ?? document.getElementById('overlay');
        const screen = root.querySelector('.kit-screen') ?? root.querySelector('.levelup');
        if (!screen) return { name, why: 'not in the kit' };
        const old = root.querySelectorAll('.btn, .chip, .dialog, h1.small').length;
        const ribbon = screen.querySelector('.kit-head .kit-ribbon')?.textContent.trim();
        const loose = [...screen.querySelectorAll('button')].filter((b) => !b.matches('.kit-btn, .kit-close, .card, .talent')).length;
        const gold = screen.querySelectorAll('.kit-btn.gold').length;
        const r = screen.getBoundingClientRect();
        const framed = screen.classList.contains('kit-screen');
        const fits = r.left >= -1 && r.right <= innerWidth + 1 && (!framed || (r.top >= -1 && r.bottom <= innerHeight + 1));
        const small = matchMedia('(pointer: coarse)').matches ? [...screen.querySelectorAll('.kit-btn, .kit-close')].filter((b) => b.offsetParent && b.getBoundingClientRect().height < 44).length : 0;
        const why = [!ribbon && 'no ribbon', old && `${old} old-style`, loose && `${loose} loose buttons`, gold > 1 && `${gold} gold`, !fits && 'off screen', small && `${small} under 44 px`].filter(Boolean).join('/');
        return { name, why };
      }, name));
    }, { touch });
    await p.close();
    const bad = screens.filter((s) => s.why);
    seen.push({
      ok: screens.length === 20 && !bad.length && !skipped.length && !errs.length,
      detail: `${w}x${h}${touch ? ' touch' : ''}: ${screens.length - bad.length}/${screens.length} in the kit${bad.length ? ` (${bad.map((s) => `${s.name}: ${s.why}`).join(', ')})` : ''}${skipped.length ? `, skipped ${skipped.join(', ')}` : ''}${errs.length ? `, errors: ${errs[0]}` : ''}`,
    });
  }
  return { ok: seen.every((s) => s.ok), detail: seen.map((s) => s.detail).join(' · ') };
});

// #138: the champions are drawn on a grid twice as fine, and show at the same size as before on the class select
await check('class select: champions on the finer grid keep their size, at one scale, standing on one line (#156)', () =>
  inPage(async () => {
    const P = window.__play;
    await P.click('[data-go="start"]');
    const size = (id) => {
      const c = document.querySelector(`[data-class="${id}"] .portrait canvas`);
      if (!c) return null;
      const r = c.getBoundingClientRect(), card = c.closest('.card').getBoundingClientRect();
      return { box: Math.round(r.height), canvas: c.height, feet: Math.round(r.bottom - card.top) };
    };
    const all = ['paladin', 'viking', 'angel', 'necromancer', 'archer'].map(size);
    await P.click('[data-back]');
    // the old grids were 14 and 16 rows at 6 px: 84 and 96 px on screen; #156: every champion is rigged, the Paladin at his old 84 px and the
    // rest at his scale (a horned helm or a halo stands taller), all with their feet on the same line of the card
    const k = all[0].box / all[0].canvas;
    const ok = all[0].box === 84 && all.every((c) => c && Math.abs(c.box - c.canvas * k) <= 1 && c.feet === all[0].feet) && window.__lb.state === 'menu';
    return { ok, detail: all.map((c) => JSON.stringify(c)).join(', ') };
  }),
);

// #194: preferred families are gone: a class card names no relic families (#176's chips went with them)
await check('class select: no class card names preferred relic families (#194)', () =>
  inPage(async () => {
    const P = window.__play;
    await P.click('[data-go="start"]');
    const cards = document.querySelectorAll('.hero, .card').length;
    const named = [...document.querySelectorAll('.fam-line')].length + (/Families:|Can max these relic families/.test(document.body.innerHTML) ? 1 : 0);
    await P.click('[data-back]');
    return { ok: cards > 0 && named === 0, detail: `${cards} cards, ${named} family lines` };
  }),
);

// #65: the title and the champion select in the new look, at 1280x720 and in phone landscape, played with the mouse: the title's kit
// buttons fit the screen; Take up arms opens the roster strip, a tile picks its champion and shows it on the pedestal with stat bars
// and facts, the one gold button names the champion and stays in reach, the round Back goes home. #204: no Classic run options are left
await check('menus: the title and the champion select in the new look, at 1280x720 and phone landscape (#65)', async () => {
  const seen = [];
  for (const [w, h] of [[1280, 720], [844, 390]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(150);
    const title = await inPage(() => {
      const o = document.getElementById('overlay');
      const btns = [...o.querySelectorAll('.kit-title .kit-btn')];
      return {
        kit: btns.length >= 4 && !o.querySelector('.kit-title .btn'),
        settingsIcon: !!document.querySelector('[data-go="settings"] .kit-icon.i-settings'),
        fits: o.scrollWidth <= o.clientWidth && btns.every((b) => b.getBoundingClientRect().right <= innerWidth),
      };
    });
    await page.click('[data-go="start"]');
    await page.waitForSelector('.kit-select [data-start]');
    // a second click on the chosen tile would start the run (#146): pick the Paladin only if he isn't already
    if ((await inPage(() => document.querySelector('.kit-select .card.champ.on')?.dataset.class)) !== 'paladin') await page.click('[data-class="paladin"]');
    const look = () =>
      inPage(() => {
        const o = document.getElementById('overlay');
        const shown = [...document.querySelectorAll('.kit-select [data-hero]')].filter((x) => !x.hidden && x.getBoundingClientRect().height > 0);
        const hero = shown[0];
        const bars = hero ? [...hero.querySelectorAll('.stat-bar i b')].map((b) => Math.round((b.getBoundingClientRect().width / b.parentElement.clientWidth) * 100)) : [];
        const start = document.querySelector('[data-start]').getBoundingClientRect();
        return {
          tiles: document.querySelectorAll('.kit-select .roster .card.champ[data-class] .portrait canvas').length,
          on: [...document.querySelectorAll('.kit-select .card.champ.on')].map((c) => c.dataset.class).join(),
          hero: shown.map((x) => x.dataset.hero).join(),
          figure: !!hero?.querySelector('.hero-figure canvas')?.width,
          bars,
          facts: hero ? [...hero.querySelectorAll('.facts small')].map((s) => s.textContent).join('/') : '',
          start: document.querySelector('[data-start]').textContent,
          gold: document.querySelectorAll('#overlay .kit-btn.gold').length,
          inReach: start.top >= 0 && start.bottom <= innerHeight,
          back: !!document.querySelector('.kit-select-top .kit-close[data-back] .kit-icon.i-back'),
          ribbon: !!document.querySelector('.kit-select-top .kit-ribbon'),
          wide: o.scrollWidth > o.clientWidth,
          scrolls: o.scrollHeight > o.clientHeight + 1,
        };
      });
    const pal = await look();
    await page.click('[data-class="viking"]'); // a tile picks the champion: the pedestal and Start follow, no run starts
    const vik = await look();
    // #204: the Classic run's options went with it: no arena, difficulty, curse, trait, Oath or seed; the road's words in their place
    const ring = await inPage(() => ({ on: !document.querySelector('.kit-select :is([data-arena], [data-tier], [data-curse], [data-trait], [data-oath], #seed)'), trait: document.querySelector('.kit-select .run-frame h2')?.textContent, still: document.querySelector('.kit-select .card.champ.on')?.dataset.class }));
    await page.locator('[data-back]').scrollIntoViewIfNeeded();
    await page.click('[data-back]');
    const home = await inPage(() => window.__lb.state === 'menu' && !!document.querySelector('.kit-title [data-go="start"]'));
    seen.push({ w, h, title, pal, vik, ring, home });
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  const ok = seen.every(({ w, title, pal, vik, ring, home }) =>
    title.kit && title.settingsIcon && title.fits
    && pal.tiles === 5 && pal.on === 'paladin' && pal.hero === 'paladin' && pal.figure && pal.bars.length === 7 && pal.bars[0] >= 99 && pal.bars.every((b) => b > 0 && b <= 100)
    && pal.facts === 'Attack/Reach/Armor/Regen/Cooldown' && pal.start === 'Onward as Paladin' && pal.gold === 1 && pal.inReach && pal.back && pal.ribbon && !pal.wide
    && vik.on === 'viking' && vik.hero === 'viking' && vik.start === 'Onward as Viking' && vik.inReach
    && ring.on && ring.trait === 'The road' && ring.still === 'viking' && home
    && (w < 1000 || !pal.scrolls)); // at 1280x720 the whole screen fits without scrolling
  return { ok, detail: seen.map(({ w, h, title, pal, vik, ring, home }) => `${w}x${h}: title kit ${title.kit}/settings icon ${title.settingsIcon}/fits ${title.fits}; ${pal.tiles} tiles, ${pal.on} on the pedestal (${pal.hero}), bars ${pal.bars.join(' ')}, facts ${pal.facts}, "${pal.start}", ${pal.gold} gold button, in reach ${pal.inReach}, scrolls ${pal.scrolls}, wide ${pal.wide}; tile -> ${vik.hero} "${vik.start}"; no run options ${ring.on} ("${ring.trait}", ${ring.still} on); Back home ${home}`).join(' | ') };
});

// ---------- a test run from the real Test mode screen ----------
await check('test mode starts a run', () =>
  inPage(async () => {
    const P = window.__play;
    [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Settings').click();
    await P.wait(150);
    await P.click('[data-act="test"]');
    const set = (el, v) => {
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const field = (id) => document.getElementById(id);
    set(field('tm-class'), 'viking');
    set(field('tm-act'), '1');
    set(field('tm-wave'), '9');
    set(field('tm-level'), '20');
    const relic = (name, tier) => {
      const s = [...document.querySelectorAll('select')].find((x) => x.closest('div, label, li')?.innerText.split('\n')[0].includes(name));
      set(s, [...s.options].find((o) => o.textContent.trim() === tier).value);
    };
    relic('Brimstone Oil', 'II');
    relic('Frost Brand', 'I');
    relic('Serrated Edge', 'I');
    relic('Phoenix Feather', 'II'); // #108: a Phoenix Feather that arrives at tier II still holds its revive
    const g = window.__startTest();
    g.player.invulnerable = true;
    await P.wait(300); // the HUD draws its TEST tag // the checks are about screens and controls, not survival
    return { ok: !!g && g.player.cls.id === 'viking' && g.player.level === 20 && g.player.relics.held.length === 4 && document.body.innerText.includes('TEST'), detail: `${g?.player.cls.id} lv ${g?.player.level}, relics ${g?.player.relics.held.join(', ')}` };
  }),
);

await check('Phoenix Feather taken at tier II holds its revive', () =>
  inPage(() => {
    const p = window.__lb.game.player;
    return { ok: p.relics.tiers.phoenixFeather === 2 && p.revives === 1, detail: `tier ${p.relics.tiers.phoenixFeather}, revives ${p.revives}` };
  }),
);

// #191: test mode starts through the levels' head start: the ability and utility tiers of the levels it skipped wait as picks
await check('test mode head start: the skipped ability and utility tiers come as picks on their screens (#191)', () =>
  inPage(async () => {
    const P = window.__play, g = window.__lb.game, p = g.player;
    const queued = `${g.pendingAbilityTiers.join()} / ${g.pendingUtilityTiers.join()}`;
    const picked = [];
    for (let i = 0; i < 6 && (g.pendingAbilityTiers.length || g.pendingUtilityTiers.length) && P.toChoice(5); i++) {
      const pick = document.querySelector('[data-pick]')?.dataset.pick;
      if (!pick) break;
      await P.click(`[data-pick="${pick}"]`);
      picked.push(pick);
    }
    const ok = queued === '0,1,2 / 0' && p.upgrades.length === 3 && p.utilityUpgrades.length === 1 && g.pendingAbilityTiers.length + g.pendingUtilityTiers.length === 0;
    p.upgrades = [];
    p.utilityUpgrades = []; // the upgrade check further down picks tier 0 again, from none
    return { ok, detail: `queued ${queued} (ability / utility), picked ${picked.join(', ')}` };
  }),
);

await check('quest board: take two', () =>
  inPage(async () => {
    const P = window.__play, g = window.__lb.game;
    if (!P.toChoice(5) || !document.querySelector('[data-quest]')) return { ok: false, detail: 'no quest board at the start of the run' };
    await P.click('[data-quest="0"]');
    await P.click('[data-quest="1"]');
    const label = document.querySelector('[data-leave]').textContent.trim();
    await P.click('[data-leave]');
    const taken = g.quests.filter((q) => q.state !== 'offered').length;
    return { ok: taken === 2 && window.__lb.state === 'playing', detail: `"${label}", ${taken} taken` };
  }),
);

await check('level-up: free reroll, paid reroll, banish, pick', () =>
  inPage(async () => {
    const P = window.__play, lb = window.__lb, g = lb.game, p = g.player;
    g.gold = 5000;
    g.banishes = 1;
    g.pendingLevelUps++;
    if (!P.toChoice()) return { ok: false, detail: 'no level-up screen' };
    const hand = () => ('levelHand' in g ? JSON.stringify(g.levelHand) : P.cards().join()); // the hand is game state from v0.8 on
    const hand0 = hand();
    await P.click('[data-reroll]'); // free
    const hand1 = hand();
    const gold1 = g.gold;
    await P.click('[data-reroll]'); // paid
    const paid = gold1 - g.gold;
    const hand2 = hand();
    await P.click('[data-banish="2"]');
    const banished = g.banishes === 0 && hand() !== hand2;
    if (!('levelHand' in g)) {
      await P.click('[data-pick="0"]');
      return { ok: hand1 !== hand0 && hand2 !== hand1 && paid > 0 && banished && lb.state === 'playing', detail: `paid reroll ${paid} gold, banish ${banished ? 'ok' : 'FAILED'} (card values not checked before v0.8)` };
    }
    // pick a flat stat card (a percent card shows +10 for a x1.1 multiplier) and check its number is what the stat gains
    const flat = (o) => o.kind === 'stat' && ['str', 'dex', 'int', 'hp', 'moveSpd'].includes(o.key);
    for (let r = 0; r < 12 && !g.levelHand.some(flat); r++) await P.click('[data-reroll]');
    const i = g.levelHand.findIndex(flat);
    const text = document.querySelectorAll('[data-pick]')[i]?.innerText ?? '';
    const key = g.levelHand[i]?.key;
    const shown = Number(text.match(/\+(\d+(?:\.\d+)?)/)?.[1]);
    const before = p.stats[key];
    await P.click(`[data-pick="${i}"]`);
    const gained = +(p.stats[key] - before).toFixed(2);
    const ok = hand1 !== hand0 && hand2 !== hand1 && paid > 0 && banished && i >= 0 && Math.abs(gained - shown) < 0.01 && g.levelHand === null && lb.state === 'playing';
    return { ok, detail: `paid reroll ${paid} gold, banish ${banished ? 'ok' : 'FAILED'}, card +${shown} ${key} → gained ${gained}` };
  }),
);

await check('level-up: pick with the 1 key, its heading clear of the HUD banner at phone width (#177)', async () => {
  const opened = await inPage(() => {
    window.__lb.game.pendingLevelUps++;
    window.__lb.game.banner = { ...window.__lb.game.banner, text: 'Wave 12', t: 1 }; // the HUD banner, up at the same moment as a level-up
    return window.__play.toChoice();
  });
  // #177: at phone width the heading must clear the HUD's Act/Wave plate and its banner underneath, both always up mid-run
  await page.setViewportSize({ width: 844, height: 390 });
  const overlap = await inPage(() => {
    const box = (sel) => document.querySelector(sel)?.getBoundingClientRect();
    const h1 = box('.levelup h1');
    const overlaps = (a, b) => !!a && !!b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const hits = ['.hud-wave', '#h-banner'].filter((sel) => overlaps(h1, box(sel)));
    return { compact: document.documentElement.classList.contains('compact'), top: Math.round(h1?.top ?? -1), hits };
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.keyboard.press('Digit1');
  const r = await inPage((opened) => ({ ok: opened && window.__lb.state === 'playing' && window.__lb.game.pendingLevelUps === 0, detail: opened ? '' : 'no screen' }), opened);
  return { ok: r.ok && overlap.hits.length === 0, detail: `${r.detail}; compact ${overlap.compact}, h1 top ${overlap.top}${overlap.hits.length ? `, overlaps: ${overlap.hits.join(', ')}` : ''}` };
});

// v0.7.5 (#111): X picks the first level-up card and is also the utility button; held past the screen, it must not cast
await check('gamepad: the button that answers a screen does not also cast', () =>
  inPage(async () => {
    const P = window.__play, lb = window.__lb, g = lb.game, p = g.player;
    const buttons = Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }));
    const real = navigator.getGamepads;
    navigator.getGamepads = () => [{ connected: true, buttons, axes: [0, 0, 0, 0] }];
    const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r))));
    try {
      await frames();
      g.pendingLevelUps++;
      if (!P.toChoice()) return { ok: false, detail: 'no level-up screen' };
      Object.assign(p, { utilityCd: 0 });
      buttons[2].pressed = true; // X: pick 1
      await frames();
      const picked = lb.state === 'playing';
      p.utilityCd = 0;
      lb.run(3, false, 'input');
      const heldCast = p.utilityCd > 0;
      buttons[2].pressed = false;
      await frames();
      buttons[2].pressed = true; // a fresh press casts
      await frames();
      p.utilityCd = 0;
      lb.run(3, false, 'input');
      const freshCast = p.utilityCd > 0;
      buttons[2].pressed = false;
      await frames();
      return { ok: picked && !heldCast && freshCast, detail: `picked ${picked}, held X cast ${heldCast}, fresh X cast ${freshCast}` };
    } finally {
      navigator.getGamepads = real;
    }
  }),
);

// #170: once the mouse has moved, it used to keep aiming forever; the right stick must be able to take aim back
await check('gamepad: the right stick aims again after the mouse moved', () =>
  inPage(async () => {
    const lb = window.__lb, g = lb.game, p = g.player;
    const buttons = Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }));
    const axes = [0, 0, 0, 0];
    const real = navigator.getGamepads;
    navigator.getGamepads = () => [{ connected: true, buttons, axes }];
    const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r))));
    try {
      await frames();
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 1250, clientY: 690, pointerType: 'mouse', bubbles: true })); // the mouse moves, near a screen corner
      lb.run(1, false, 'input');
      const mouseAngle = Math.atan2(g.input.aimY - p.y, g.input.aimX - p.x);
      axes[2] = -1; // right stick hard left
      axes[3] = 0;
      await frames(); // pumpGamepad() runs in the real frame loop
      lb.run(1, false, 'input');
      const stickAngle = Math.atan2(g.input.aimY - p.y, g.input.aimX - p.x);
      const followsStick = Math.abs(stickAngle - Math.PI) < 0.2;
      return { ok: followsStick, detail: `mouse aim ${mouseAngle.toFixed(2)} rad, stick aim ${stickAngle.toFixed(2)} rad (want ~${Math.PI.toFixed(2)})` };
    } finally {
      navigator.getGamepads = real;
    }
  }),
);

await check('relic offer: reroll, then take the duo', () =>
  inPage(async () => {
    const P = window.__play, g = window.__lb.game, rel = g.player.relics;
    rel.offers.push({ from: 'boss', options: ['butchersHook', 'guardiansAegis', 'stormPennant'], rerolls: 1, duo: 'thermalShock' });
    if (!P.toChoice()) return { ok: false, detail: 'no relic offer' };
    const before = P.cards();
    await P.click('[data-reroll]');
    const after = P.cards();
    const duo = [...document.querySelectorAll('[data-pick]')].findIndex((b) => b.innerText.includes('Thermal Shock'));
    await P.click(`[data-pick="${duo}"]`);
    return { ok: before.join() !== after.join() && rel.offers.length === 0 && rel.duos.includes('thermalShock'), detail: `${before.slice(0, 3).join(', ')} → ${after.slice(0, 3).join(', ')}; duos ${rel.duos.join(', ')}` };
  }),
);

// #96: the duo combines Brimstone Oil (II) and Frost Brand (I) into one relic bar tile at tier II; Flame and Frost stay at 1
await check('duo: its two relics become one tile at the higher tier, families unchanged', () =>
  inPage(async () => {
    const P = window.__play;
    await P.wait(300);
    const tiles = [...document.querySelectorAll('#h-relics .relic[data-id]')].map((t) => t.dataset.id);
    const duo = document.querySelector('#h-relics .relic[data-duo="thermalShock"]');
    const fams = [...document.querySelectorAll('#h-families .fam-chip b')].map((b) => b.textContent);
    const ok = !!duo && duo.innerText.includes('II') && /tier II/.test(duo.dataset.tip) && !tiles.includes('brimstoneOil') && !tiles.includes('frostBrand') && fams.filter((n) => n === '1').length >= 2 && !fams.includes('2');
    return { ok, detail: `tiles ${tiles.join(', ')}; duo ${duo?.innerText.trim() ?? 'none'}; families ${fams.join(', ')}` };
  }),
);

await check('relic offer: skip pays what it says', () =>
  inPage(async () => {
    const P = window.__play, g = window.__lb.game, rel = g.player.relics;
    rel.offers.push({ from: 'strongbox', options: ['butchersHook', 'guardiansAegis', 'stormPennant'], rerolls: 0, duo: null });
    if (!P.toChoice()) return { ok: false, detail: 'no relic offer' };
    const label = document.querySelector('[data-skip]').textContent;
    const says = Number(label.match(/🪙\s*([\d,]+)/)?.[1].replace(',', ''));
    const gold = g.gold;
    await P.click('[data-skip]');
    return { ok: g.gold - gold === says && rel.offers.length === 0, detail: `"${label.trim()}", got ${g.gold - gold}` };
  }),
);

// #98: a relic card leads with its effect in large text and one compact line; the rest shows on hover or tap (focus)
await check('relic offer: the card shows the effect first, details on hover or tap', () =>
  inPage(async () => {
    const P = window.__play, rel = window.__lb.game.player.relics;
    rel.offers.push({ from: 'lair', options: ['butchersHook', 'guardiansAegis', 'stormPennant', 'thunderDrum', 'cinderCharm'].filter((id) => !rel.held.includes(id)).slice(0, 3), rerolls: 0, duo: null }); // a held relic's tip names a later tier
    if (!P.toChoice()) return { ok: false, detail: 'no relic offer' };
    const card = document.querySelector('[data-pick="0"]');
    const effect = card.querySelector('p'), lines = card.querySelectorAll('.preview');
    const big = parseFloat(getComputedStyle(effect).fontSize) > parseFloat(getComputedStyle(lines[0]).fontSize);
    const first = card.querySelector('h2').nextElementSibling.nextElementSibling === effect;
    await P.wait(50); // let the screen settle: the real cursor's own pointerover would hide a tip shown before it
    card.dispatchEvent(new PointerEvent('pointerover', { bubbles: true })); // a hover: focus() is not reliable in a CI page without window focus
    const tip = document.getElementById('tooltip'); // read at once: the tip is placed synchronously
    const shown = tip?.style.display === 'block' && tip.innerText.includes('For this build') && !tip.innerText.includes('compendium'); // #235: every tier is on its compendium page, behind the card's ⓘ; #251: the card's tip is short
    await P.click('[data-skip]'); // skipped, so the later checks still take Butcher's Hook fresh
    return { ok: big && first && lines.length === 1 && !lines[0].innerText.includes('\n') && shown && rel.offers.length === 0, detail: `effect "${effect.innerText}", line "${lines[0]?.innerText}" (${lines.length}), bigger ${big}, tip shown ${shown}${shown ? '' : ` (${tip?.style.display}: ${(tip?.innerText ?? '').slice(0, 60)})`}` };
  }),
);

// #235: a relic card shows its short line (at most 90 characters) and tier chips, never the long text; its ⓘ, clicked with the mouse,
// opens the relic's compendium page with every tier over the pick without taking the card, and Esc closes it; no text on the card or the
// page is under 14 px at 1280x720
const minFont = (sel) => page.evaluate((sel) => {
  let min = Infinity, at = '';
  for (const root of document.querySelectorAll(sel)) {
    for (const el of [root, ...root.querySelectorAll('*')]) {
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!own || el.getBoundingClientRect().width === 0) continue;
      const px = parseFloat(getComputedStyle(el).fontSize);
      if (px < min) { min = px; at = `${el.tagName.toLowerCase()}.${el.className} "${el.textContent.trim().slice(0, 20)}"`; }
    }
  }
  return { min, at };
}, sel);
await check('relic offer: a short line and tier chips, the ⓘ opens its compendium page, no text under 14 px (#235)', async () => {
  const setup = await inPage(() => {
    const P = window.__play, rel = window.__lb.game.player.relics;
    rel.offers.push({ from: 'lair', options: ['heartOfTheHold', 'reprisalCuirass', 'thunderDrum', 'guardiansAegis'].filter((id) => !rel.held.includes(id)).slice(0, 3), rerolls: 0, duo: null });
    if (!P.toChoice()) return null;
    return [...document.querySelectorAll('.relic-card')].map((c) => ({ p: c.querySelector('p').innerText, chips: c.querySelectorAll('.tier-chips i').length, info: !!c.querySelector('.relic-info'), long: c.innerText.includes('Awaken') || c.innerText.includes('Tier II'),
      // the whole card on the 1280x720 screen, its short line inside it and not cut off
      fits: (() => { const r = c.getBoundingClientRect(), l = c.querySelector('p'), lr = l.getBoundingClientRect(); return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && lr.left >= r.left && lr.right <= r.right && lr.bottom <= r.bottom && l.scrollWidth <= l.clientWidth && c.scrollHeight <= c.clientHeight + 1; })() }));
  });
  if (!setup) return { ok: false, detail: 'no relic offer' };
  const cardFont = await minFont('.relic-card');
  await page.locator('[data-pick="0"] .relic-info').click();
  const opened = await inPage(() => {
    const pg = document.querySelector('.relic-page');
    return { page: !!pg, tiers: pg?.querySelectorAll('.tierline').length ?? 0, text: pg?.innerText.replace(/\s+/g, ' ').slice(0, 80) ?? '', state: window.__lb.state, offers: window.__lb.game.player.relics.offers.length };
  });
  const pageFont = await minFont('.relic-page');
  await page.keyboard.press('Escape');
  const closed = await inPage(() => ({ page: !!document.querySelector('.relic-page'), state: window.__lb.state, offers: window.__lb.game.player.relics.offers.length }));
  await inPage(() => window.__play.click('[data-skip]'));
  const short = setup.every((c) => c.p.length > 0 && c.p.length <= 90 && c.chips === 3 && c.info && !c.long && c.fits);
  const ok = short && opened.page && opened.tiers >= 3 && opened.state === 'choice' && opened.offers === 1 && !closed.page && closed.state === 'choice' && closed.offers === 1
    && cardFont.min >= 14 && pageFont.min >= 14;
  return { ok, detail: `cards ${setup.map((c) => `"${c.p}" (${c.p.length}, ${c.chips} chips${c.info ? ', ⓘ' : ''}${c.long ? ', LONG' : ''}${c.fits ? '' : ', DOES NOT FIT'})`).join('; ')}; ⓘ page ${opened.page} (${opened.tiers} tier lines: "${opened.text}"), still picking ${opened.state}/${opened.offers}; Esc closed ${!closed.page}; smallest font card ${cardFont.min}px (${cardFont.at}), page ${pageFont.min}px` };
});

await check('relic offer: hovering a card opens a short tooltip beside or above it, never over the card or the Reroll / Skip buttons (#251)', async () => {
  const ready = await inPage(() => {
    const P = window.__play, rel = window.__lb.game.player.relics;
    rel.offers.push({ from: 'lair', options: ['heartOfTheHold', 'reprisalCuirass', 'thunderDrum', 'guardiansAegis'].filter((id) => !rel.held.includes(id)).slice(0, 3), rerolls: 1, duo: null });
    return P.toChoice();
  });
  if (!ready) return { ok: false, detail: 'no relic offer' };
  const seen = [];
  for (const n of [0, 1, 2]) {
    await page.mouse.move(2, 2);
    await page.locator(`[data-pick="${n}"] h2`).hover();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#tooltip') ?? document.body).display === 'block', null, { timeout: 2000 }).catch(() => {});
    seen.push(await inPage((n) => {
      const box = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
      const hit = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
      const tip = document.querySelector('#tooltip');
      if (!tip || getComputedStyle(tip).display !== 'block') return { shown: false };
      const t = box(tip), card = document.querySelector(`[data-pick="${n}"]`);
      const others = [...document.querySelectorAll('[data-reroll], [data-skip], .relic-card')].filter((el) => el !== card || true);
      const over = others.filter((el) => hit(t, box(el)) && el === card).length;
      const btns = [...document.querySelectorAll('[data-reroll], [data-skip]')].filter((el) => hit(t, box(el))).length;
      const own = [...card.querySelectorAll('h2, p, .tier-chips, .tag')].filter((el) => hit(t, box(el))).length;
      return { shown: true, h: Math.round(t.b - t.t), over, btns, own, inside: t.l >= 0 && t.t >= 0 && t.r <= innerWidth && t.b <= innerHeight, vw: innerWidth };
    }, n));
  }
  await page.mouse.move(2, 2);
  await inPage(() => window.__play.click('[data-skip]'));
  const ok = seen.every((x) => x.shown && x.over === 0 && x.btns === 0 && x.own === 0 && x.inside && x.h <= 250);
  return { ok, detail: seen.map((x, i) => x.shown ? `card ${i + 1}: tooltip ${x.h}px tall at ${x.vw}px wide, over the card ${x.over}, over buttons ${x.btns}, over its text ${x.own}, ${x.inside ? 'on screen' : 'OFF SCREEN'}` : `card ${i + 1}: no tooltip`).join('; ') };
});

await check('relic offer: take a relic', () =>
  inPage(async () => {
    const P = window.__play, rel = window.__lb.game.player.relics;
    rel.offers.push({ from: 'lair', options: ['butchersHook', 'guardiansAegis', 'stormPennant', 'thunderDrum'].filter((id) => !rel.held.includes(id)).slice(0, 3), rerolls: 0, duo: null }); // one already held is taken silently
    if (!P.toChoice()) return { ok: false, detail: 'no relic offer' };
    await P.click('[data-pick="0"]');
    return { ok: rel.held.includes('butchersHook'), detail: rel.held.join(', ') };
  }),
);

await check('ability and utility upgrades', () =>
  inPage(async () => {
    const P = window.__play, g = window.__lb.game, p = g.player;
    g.pendingAbilityTiers.push(0);
    if (!P.toChoice()) return { ok: false, detail: 'no ability upgrade screen' };
    const a = document.querySelectorAll('[data-pick]')[1].dataset.pick;
    await P.click(`[data-pick="${a}"]`);
    g.pendingUtilityTiers.push(0);
    if (!P.toChoice()) return { ok: false, detail: 'no utility upgrade screen' };
    const u = document.querySelectorAll('[data-pick]')[1].dataset.pick;
    await P.click(`[data-pick="${u}"]`);
    return { ok: p.upgrades.includes(a) && p.utilityUpgrades.includes(u), detail: `${a}, ${u}` };
  }),
);

// #144: the Merchant path's caravan sells books in the relic slots, or on one visit in ten a relic, and never greys relics out
await check("Merchant path caravan: Tome of Haste and Tome of Fortune, or now and then a relic", () =>
  inPage(async () => {
    const P = window.__play, lb = window.__lb, g = lb.game, p = g.player;
    const log = [];
    const visit = (relic) => {
      g.gold = 600;
      g.pendingMerchant = g.midMerchant = true;
      g.vars.caravanRelic = relic;
      return P.toChoice() && !!document.querySelector('[data-heal]');
    };
    if (!visit(0)) return { ok: false, detail: 'no caravan' };
    log.push(document.querySelector('[data-buy]') || /one relic a visit/i.test(document.body.innerText) ? 'RELICS ON A BOOK VISIT' : 'no relics');
    const spd = p.stats.atkSpd, gold = g.gold;
    await P.click('[data-book="haste"]');
    log.push(p.stats.atkSpd > spd * 1.09 && g.gold < gold ? 'haste' : 'HASTE FAILED');
    log.push(document.querySelector('[data-book="haste"]')?.disabled ? 'one a visit' : 'HASTE STILL ON SALE');
    await P.click('[data-book="fortune"]');
    await P.click('[data-leave]');
    g.pendingLevelUps++;
    if (!P.toChoice()) return { ok: false, detail: 'no level-up screen' };
    const tags = [...document.querySelectorAll('[data-pick] .tag')].map((t) => t.textContent);
    log.push(tags.every((t) => /Epic|Evolution/.test(t)) ? 'all epic' : `NOT ALL EPIC: ${tags.join(', ')}`);
    await P.click('[data-pick="0"]');
    if (!visit(1)) return { ok: false, detail: 'no caravan with a relic' };
    const buy = document.querySelector('[data-buy="common"]');
    log.push(buy && !buy.disabled && !document.querySelector('[data-book]') ? 'a relic, no books' : 'NO RELIC ON A RELIC VISIT');
    await P.click('[data-leave]');
    return { ok: !log.some((l) => /[A-Z]{4}/.test(l)), detail: log.join(', ') };
  }),
);

await check('Merchant: heal, reroll, reforge, sell, salvage, buy, march on', () =>
  inPage(async () => {
    const P = window.__play, lb = window.__lb, g = lb.game, p = g.player, rel = p.relics;
    g.gold = 600;
    p.hp = Math.round(p.stats.hp / 4); // hurt before the screen draws, or the surgeon has nothing to heal
    g.pendingMerchant = true;
    if (!P.toChoice() || !document.querySelector('[data-heal]')) return { ok: false, detail: 'no Merchant' };
    const log = [];
    let hp = p.hp, gold = g.gold;
    await P.click('[data-heal]');
    log.push(p.hp > hp && g.gold < gold ? 'heal' : 'HEAL FAILED');
    gold = g.gold;
    log.push(document.querySelector('[data-sell="brimstoneOil"], [data-sell="frostBrand"]') ? 'DUO RELICS LISTED' : 'duo relics not listed'); // #96: combined into Thermal Shock
    await P.click('[data-reroll="butchersHook"]');
    log.push(!rel.held.includes('butchersHook') && g.gold < gold ? 'reroll' : 'REROLL FAILED');
    gold = g.gold;
    await P.click('[data-reforge="serratedEdge"]');
    log.push(!rel.held.includes('serratedEdge') && g.gold < gold ? 'reforge' : 'REFORGE FAILED');
    gold = g.gold;
    const sold = document.querySelector('[data-sell]').dataset.sell;
    await P.click(`[data-sell="${sold}"]`);
    log.push(!rel.held.includes(sold) && g.gold > gold ? 'sell' : 'SELL FAILED');
    const last = document.querySelector('[data-salvage]').dataset.salvage;
    await P.click(`[data-salvage="${last}"]`);
    log.push(!rel.held.includes(last) ? 'salvage' : 'SALVAGE FAILED');
    const held = rel.held.length;
    gold = g.gold;
    await P.click('[data-buy="common"]');
    await P.click('[data-pick="0"]');
    log.push(rel.held.length === held + 1 && g.gold < gold ? 'buy' : 'BUY FAILED');
    P.toChoice(); // the Merchant comes back after the pick of three
    const back = !!document.querySelector('[data-heal]') && [...document.querySelectorAll('[data-buy]')].every((b) => b.disabled);
    log.push(back ? 'back, one relic a visit' : 'NOT BACK AFTER BUYING');
    await P.click('[data-leave]');
    return { ok: !log.some((l) => /[A-Z]{4}/.test(l)), detail: log.join(', ') };
  }),
);

await check('route fork, then the shrine', () =>
  inPage(async () => {
    const P = window.__play, lb = window.__lb, g = lb.game;
    if (!P.toChoice() || !g.pendingRoute) return { ok: false, detail: `no route fork after the Merchant (${P.title()})` };
    const act = g.act;
    const boss = [...document.querySelectorAll('.route [data-families]')].map((t) => t.textContent); // #100: each route names its arena's boss relics
    if (boss.length !== g.pendingRoute.length || !boss.every((t) => /Boss relics: .+ · .+ · .+/.test(t))) return { ok: false, detail: `route cards without boss relic families: ${boss.join(' | ')}` };
    const i = [...document.querySelectorAll('[data-pick]')].findIndex((b) => /pilgrim/i.test(b.innerText));
    await P.click(`[data-pick="${Math.max(0, i)}"]`);
    // the new Act's quest board and the Pilgrim path's shrine can come in either order; a route without a shrine gets one directly
    let id = null;
    for (let k = 0; k < 8 && !id; k++) {
      if (lb.state !== 'choice') P.toChoice(3);
      if (document.querySelector('[data-quest]')) await P.click('[data-leave]');
      else if (g.pendingShrine && document.querySelector('[data-pick]')) {
        id = document.querySelector('[data-pick]').dataset.pick;
        await P.click(`[data-pick="${id}"]`);
      } else if (!g.pendingShrine && lb.state === 'playing') g.pendingShrine = ['valor', 'mending', 'swiftness'];
    }
    if (!id) return { ok: false, detail: `no shrine (${P.title()})` };
    P.toChoice(3);
    if (document.querySelector('[data-quest]')) await P.click('[data-leave]');
    return { ok: g.act === act + 1 && g.blessings.includes(id), detail: `Act ${g.act}, ${g.route?.focus ?? '?'} path, blessing ${id}` };
  }),
);

await check('peddler: buy a draught, leave', () =>
  inPage(async () => {
    const P = window.__play, lb = window.__lb, g = lb.game, p = g.player;
    for (let i = 0; i < 3000 && (g.breather > 0 || lb.state !== 'playing'); i++) lb.run(1, false, true); // a wave on
    g.gold = 300;
    p.hp = Math.round(p.stats.hp / 2);
    g.event = { kind: 'peddler', x: p.x, y: p.y, unit: null, foe: null, used: false, t: 0, stock: 1 };
    if (!P.toChoice() || !document.querySelector('[data-buy]')) return { ok: false, detail: 'no peddler' };
    const hp = p.hp, gold = g.gold;
    await P.click('[data-buy="0"]');
    const bought = p.hp > hp && g.gold < gold && g.event.stock === 0;
    await P.click('[data-leave]');
    return { ok: bought && !g.pendingShop && lb.state === 'playing', detail: `hp ${Math.round(hp)} → ${Math.round(p.hp)}, gold ${gold} → ${g.gold}` };
  }),
);

await check('peddler at full health: the draught is shut, a reroll token buys one more free reroll on the next level-up (#128)', () =>
  inPage(async () => {
    const P = window.__play, lb = window.__lb, g = lb.game, p = g.player;
    g.gold = 300;
    p.hp = p.stats.hp;
    g.event = { kind: 'peddler', x: p.x, y: p.y, unit: null, foe: null, used: false, t: 0, stock: 1 };
    if (!P.toChoice() || !document.querySelector('[data-buy="1"]')) return { ok: false, detail: `no reroll token (${P.title()})` };
    const shut = document.querySelector('[data-buy="0"]').disabled;
    const gold = g.gold;
    await P.click('[data-buy="1"]');
    const bought = g.gold < gold && g.event.stock === 0;
    await P.click('[data-leave]');
    g.pendingLevelUps++;
    if (!P.toChoice() || !document.querySelector('[data-reroll]')) return { ok: false, detail: 'no level-up screen' };
    const label = document.querySelector('[data-reroll]').textContent.trim();
    const free = label.includes(`${g.rerolls + 1} free`);
    await P.click('[data-pick="0"]');
    return { ok: shut && bought && free && lb.state === 'playing', detail: `draught ${shut ? 'shut' : 'OPEN'}, gold ${gold} → ${g.gold}, "${label}"` };
  }),
);

await check('peddler: drawn from the Siege Engineer rigged sheet, breathing through its idle (#178)', () =>
  inPage(async () => {
    const lb = window.__lb, g = lb.game, p = g.player;
    const was = p.invulnerable;
    p.invulnerable = true;
    g.event = { kind: 'peddler', x: p.x + 200, y: p.y, unit: null, foe: null, used: true, t: 0, stock: 0 }; // out of reach: no shop opens
    const seen = [];
    for (let i = 0; i < 60 && lb.state === 'playing'; i++) (lb.run(1, false, 'input'), lb.draw(), seen.push(lb.peddlerAnim()));
    g.event = null;
    p.invulnerable = was;
    const frames = new Set(seen.map((a) => (a ? `${a.anim}${a.frame}` : 'grid')));
    const ok = seen.length > 0 && seen.every((a) => a?.anim === 'idle') && frames.size > 1;
    return { ok, detail: [...frames].join(' ') };
  }),
);

await check('monk escort: taken from the board, he keeps walking with an enemy beside him (#119)', () =>
  inPage(async () => {
    const P = window.__play, lb = window.__lb, g = lb.game;
    let s = 7;
    const rng = () => (s = (s * 16807) % 2147483647) / 2147483647;
    g.quests.push({ kind: 'monk', reward: 'gold', state: 'offered', name: 'Monk', x: 0, y: 0, unit: null, foes: [], progress: 0, since: 0, t: 0, rng });
    g.pendingBoard = true;
    if (!P.toChoice() || !document.querySelector('[data-quest]')) return { ok: false, detail: `no quest board (${P.title()})` };
    await P.click('[data-quest="0"]');
    await P.click('[data-leave]');
    const q = g.quests.find((x) => x.kind === 'monk' && x.state === 'active');
    if (!q) return { ok: false, detail: 'the monk was not taken' };
    const alive = () => g.enemies.find((o) => !o.dead && !o.side);
    for (let i = 0; i < 600 && !alive() && q.state === 'active'; i++) lb.run(1); // wait for the wave to put an enemy on the field
    const monk = q.unit, x0 = monk.x, y0 = monk.y, hp0 = Math.round(monk.maxHp);
    let wary = false;
    for (let i = 0; i < 60 && q.state === 'active'; i++) {
      const e = alive();
      if (!e) break;
      Object.assign(e, { x: monk.x + 40, y: monk.y }); // an enemy always at his side
      lb.run(1);
      lb.draw(); // the HUD tracker is drawn with the frame
      wary ||= document.getElementById('h-quests')?.innerText.includes('wary') ?? false;
    }
    const moved = Math.round(Math.hypot(monk.x - x0, monk.y - y0));
    return { ok: wary && moved > 10, detail: `${lb.state}, ${hp0} HP, walked ${moved} px in a second with an enemy beside him, tracker ${wary ? '"wary"' : 'NEVER WARY'}` };
  }),
);

await check('talent from the pause menu', async () => {
  await inPage(() => (window.__lb.game.talentPoints = 1));
  await page.keyboard.press('Escape');
  return inPage(async () => {
    const P = window.__play, lb = window.__lb, g = lb.game, p = g.player;
    if (lb.state !== 'paused') return { ok: false, detail: 'Escape did not pause' };
    await P.click('[data-talents]');
    const node = document.querySelector('button[data-talent]:not([disabled])');
    const id = node.dataset.talent;
    node.click();
    await P.wait();
    const taken = p.talents.includes(id) && g.talentPoints === 0;
    await P.click('[data-back]');
    await P.click('[data-resume]');
    return { ok: taken && lb.state === 'playing', detail: id };
  });
});

await check('every screen answered above is in the replay log, in tick order, for player 0', () =>
  inPage(() => {
    const g = window.__lb.game;
    if (!g.replay) return { skip: true, detail: 'no replay log on this branch (before #113)' };
    const kinds = new Set(g.replay.map((c) => c.choice.c));
    const want = ['quests', 'levelReroll', 'levelBanish', 'levelUp', 'relicReroll', 'relicTake', 'relicSkip', 'abilityUpgrade', 'utilityUpgrade', 'merchantHeal', 'merchantBuy', 'merchantBook', 'merchantLeave', 'route', 'blessing', 'peddlerBuy', 'peddlerToken', 'peddlerLeave', 'talent'];
    const missing = want.filter((k) => !kinds.has(k));
    const ordered = g.replay.every((c, i) => c.player === 0 && c.tick <= g.tick && (i === 0 || c.tick >= g.replay[i - 1].tick));
    return { ok: !missing.length && ordered, detail: `${g.replay.length} choices${missing.length ? `, missing ${missing.join(', ')}` : ''}${ordered ? '' : ', out of order'}` };
  }),
);

await check('Esc in a pause sub-screen goes back to the pause menu', async () => {
  await page.keyboard.press('Escape');
  const seen = [];
  for (const btn of ['talents', 'glossary', 'treasures']) {
    const opened = await inPage(async (b) => {
      if (!document.querySelector(`[data-${b}]`)) return false;
      await window.__play.click(`[data-${b}]`);
      return !document.querySelector('[data-resume]');
    }, btn);
    if (!opened) return { ok: false, detail: `${btn}: did not open from the pause menu` };
    const t0 = await inPage(() => window.__lb.game.time);
    await page.keyboard.press('Escape');
    const after = await inPage(async (t) => {
      await window.__play.wait(100);
      const lb = window.__lb;
      return { menu: !!document.querySelector('[data-resume]'), state: lb.state, still: lb.game.time === t };
    }, t0);
    seen.push(`${btn}: ${after.menu ? 'menu' : 'no menu'}, ${after.state}`);
    if (!after.menu || after.state !== 'paused' || !after.still) return { ok: false, detail: seen.join(' · ') };
  }
  await inPage(() => window.__play.click('[data-resume]'));
  return { ok: (await inPage(() => window.__lb.state)) === 'playing', detail: seen.join(' · ') };
});

await check('keyboard: move and both abilities', async () => {
  const pos = () => inPage(() => ({ x: window.__lb.game.player.x, y: window.__lb.game.player.y }));
  await inPage(() => window.__lb.run(1, false, 'input'));
  const a = await pos();
  await page.keyboard.down('KeyD');
  await inPage(() => window.__lb.run(30, false, 'input'));
  await page.keyboard.up('KeyD');
  const b = await pos();
  await page.keyboard.down('KeyW');
  await inPage(() => window.__lb.run(30, false, 'input'));
  await page.keyboard.up('KeyW');
  const c = await pos();
  await inPage(() => window.__lb.run(10, false, 'input'));
  const d = await pos();
  await inPage(() => {
    const lb = window.__lb, p = lb.game.player;
    for (let i = 0; i < 1200 && p.abilityTime > 0; i++) lb.run(1, false, 'input'); // an ability cast by an earlier check must end first
    Object.assign(p, { abilityCd: 0, utilityCd: 0 });
  });
  await page.keyboard.down('Space');
  await inPage(() => window.__lb.run(2, false, 'input'));
  await page.keyboard.up('Space');
  await page.keyboard.down('KeyE');
  await inPage(() => window.__lb.run(2, false, 'input'));
  await page.keyboard.up('KeyE');
  const cds = await inPage(() => ({ ability: window.__lb.game.player.abilityCd, utility: window.__lb.game.player.utilityCd }));
  const ok = b.x - a.x > 20 && a.y - c.y > 20 && Math.hypot(d.x - c.x, d.y - c.y) < 1 && cds.ability > 0 && cds.utility > 0;
  return { ok, detail: `right ${Math.round(b.x - a.x)} px, up ${Math.round(a.y - c.y)} px, still after release: ${Math.hypot(d.x - c.x, d.y - c.y) < 1}, cooldowns ${cds.ability.toFixed(1)} / ${cds.utility.toFixed(1)} s` };
});

await check('mouse: aim follows the cursor', async () => {
  const dirs = [];
  for (const [dx, dy] of [[300, 0], [0, -250], [-300, 0]]) {
    await page.mouse.move(640 + dx, 360 + dy);
    dirs.push(await inPage(() => {
      window.__lb.run(1, false, 'input');
      const g = window.__lb.game;
      return { x: Math.sign(Math.round(g.input.aimX - g.player.x)), y: Math.sign(Math.round(g.input.aimY - g.player.y)), show: g.input.showAim };
    }));
  }
  const ok = dirs[0].x === 1 && dirs[1].y === -1 && dirs[2].x === -1 && dirs.every((d) => d.show);
  return { ok, detail: dirs.map((d) => `(${d.x},${d.y})`).join(' ') };
});

// v0.7.5 (#95): a boss is a fight to survive, not one ability
await check('boss: one enormous ability does not end the fight', async () => {
  const start = await inPage(() => {
    const lb = window.__lb, g = lb.game, p = g.player;
    const boss = () => g.enemies.find((e) => e.def.boss && !e.dead && !e.warded);
    for (let i = 0; i < 20000 && !boss() && lb.game === g; i++) lb.run(1, false, true); // the bot plays on to the wave-10 Act boss
    const b = boss();
    if (!b) return null;
    window.__play.boss = b;
    Object.assign(p, { x: b.x - b.r - 40, y: b.y, abilityCd: 0 });
    g.baseMods.damage *= 1000; // a monstrous build (mods are rebuilt from these every tick)
    return { hp: b.hp, max: b.maxHp, name: b.def.name, resolve: 'resolve' in b };
  });
  if (!start) return { ok: false, detail: 'no boss reached' };
  if (!start.resolve) return { skip: true, detail: 'no boss resolve on this branch (before v0.7.5)' };
  await page.mouse.move(700, 360); // aim at him (he is just right of the champion)
  await page.keyboard.down('Space');
  await inPage(() => window.__lb.run(2, false, 'input'));
  await page.keyboard.up('Space');
  await inPage(() => window.__lb.run(60, false, 'input'));
  const end = await inPage(() => {
    const b = window.__play.boss;
    window.__lb.game.baseMods.damage /= 1000;
    return { hp: b.hp, dead: b.dead };
  });
  const lost = (start.hp - end.hp) / start.max;
  return { ok: !end.dead && lost > 0 && end.hp > start.max * 0.5, detail: `${start.name}: a 1000x ability took ${(lost * 100).toFixed(0)}% of his HP in a second` };
});

// #100: a boss drops only its arena's families, the pick screen says which, and a reroll keeps to them
await check("boss relics: only the arena's families, named on the pick screen, rerolls too", () =>
  inPage(async () => {
    const P = window.__play, lb = window.__lb, g = lb.game, rel = g.player.relics, b = P.boss;
    if (!b || b.dead) return { ok: false, detail: 'no live boss' };
    rel.offers = [];
    b.hp = 1;
    for (let i = 0; i < 600 && !b.dead; i++) lb.run(1, false, 'input');
    if (!rel.offers.some((o) => o.from === 'boss')) return { ok: false, detail: `boss dead ${b.dead}, no boss relic moment` };
    rel.offers.sort((a, c) => (a.from === 'boss' ? -1 : c.from === 'boss' ? 1 : 0)); // straight to the boss's pick
    rel.offers[0].rerolls = Math.max(1, rel.offers[0].rerolls);
    if (!P.toChoice()) return { ok: false, detail: 'no relic offer' };
    const line = document.querySelector('[data-families]')?.textContent ?? '';
    const fams = () => [...document.querySelectorAll('.relic-card .fam')].map((f) => f.textContent.trim()).filter((f) => !f.includes('Cursed'));
    const before = fams();
    await P.click('[data-reroll]');
    const after = fams();
    const allowed = [...before, ...after].every((f) => line.includes(f));
    await P.click('[data-pick="0"]');
    return { ok: !!line && before.length > 0 && allowed && !rel.offers.some((o) => o.from === 'boss'), detail: `"${line.trim()}"; ${before.join(', ')} → ${after.join(', ')}` };
  }),
);

await check('touch: joystick moves, release stops', () =>
  inPage(() => {
    const lb = window.__lb, g = lb.game, p = g.player, canvas = document.querySelector('canvas');
    const ev = (type, x, y) => canvas.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerType: 'touch', pointerId: 7, isPrimary: true, bubbles: true }));
    const press = () => (ev('pointerdown', 200, 500), ev('pointermove', 260, 500));
    // a screen (the frame loop's, or a level-up while the thumb is down) hides the controls and drops the thumb: answer it, press again
    for (let i = 0; i < 20 && lb.state === 'choice'; i++) lb.run(1, false, 'input');
    // the boss checks before this leave the champion wherever they ended: maybe against a wall, inside a Warden's stone ring or
    // stunned. Clear those and stand him on open floor with 200 px free to his right, so only the thumb decides whether he walks
    const blocker = g.barriers.length, stunned = !!p.statuses.stun;
    g.barriers.length = 0;
    p.statuses = {};
    p.chillT = 0;
    const clear = (x, y) => g.arena.obstacles.every((o) => Math.abs(o.y - y) > o.r + p.r + 4 || o.x + o.r + p.r + 4 < x || o.x - o.r - p.r - 4 > x + 200);
    const spot = g.openFloors.flatMap((r) => [0.5, 0.3, 0.7].flatMap((fy) => Array.from({ length: Math.max(0, Math.floor((r.w - 280) / 40)) }, (_, k) => ({ x: r.x + 40 + k * 40, y: r.y + r.h * fy }))))
      .find((s) => clear(s.x, s.y));
    if (!spot) return { ok: false, detail: 'no open floor 200 px wide' };
    Object.assign(p, spot);
    press();
    let moved = 0, moveX = 0;
    for (let i = 0; i < 60 && moved <= 20; i++) {
      if (lb.state === 'choice') {
        lb.run(1, false, 'input');
        press();
        continue;
      }
      const x = p.x;
      lb.run(1, false, 'input');
      moved += p.x - x;
      moveX = Math.max(moveX, g.input.moveX);
    }
    ev('pointerup', 260, 500);
    lb.run(3, false, 'input');
    const x1 = p.x;
    lb.run(5, false, 'input');
    return { ok: moved > 20 && moveX > 0.9 && Math.abs(p.x - x1) < 1, detail: `moved ${Math.round(moved)} px, moveX ${moveX.toFixed(2)} (cleared ${blocker} barriers, stun ${stunned})` };
  }),
);

await check('rendering and the perf sections', () =>
  inPage(() => {
    const lb = window.__lb;
    for (let i = 0; i < 3; i++) lb.draw();
    const r = lb.profile(60);
    lb.setPerf(false);
    const s = Object.keys(r.sections);
    const need = ['enemyAI', 'physics', 'statuses', 'particles', 'hud'];
    return { ok: need.every((k) => s.includes(k)), detail: `${s.length} sections, missing: ${need.filter((k) => !s.includes(k)).join(', ') || 'none'}` };
  }),
);

await check('particles follow the quality setting', () =>
  inPage(() => {
    const lb = window.__lb, g = lb.game;
    if (!lb.setQuality) return { skip: true, detail: 'no setQuality hook on this branch' };
    const measure = (q) => {
      lb.setQuality(q);
      let sum = 0;
      for (let i = 0; i < 240; i++) {
        lb.run(1, false, true);
        sum += g.particles.length;
      }
      return { budget: lb.view.particleBudget(), avg: sum / 240 };
    };
    const low = measure('low'), high = measure('high');
    lb.setQuality('auto');
    return { ok: low.budget < high.budget && high.avg > 0, detail: `particle budget low ${low.budget.toFixed(2)}, high ${high.budget.toFixed(2)}` };
  }),
);

await check('sounds reach the audio', () =>
  inPage(() => {
    if (!window.__lb.view) return { skip: true, detail: 'no view hook on this branch (before v0.8)' };
    window.__play.play(1200);
    const s = window.__play.sounds;
    const need = ['hit', 'kill', 'swing', 'ability', 'xp'];
    return { ok: need.every((k) => s[k] > 0), detail: Object.entries(s).map(([k, v]) => `${k} ${v}`).join(', ') };
  }),
);

// v0.8 (#114): sounds leave the simulation as cues in g.out; the screen plays and empties them, a pick between steps included
await check('sound cues: played and emptied, a relic pick is heard', () =>
  inPage(async () => {
    const P = window.__play, g = window.__lb.game, rel = g.player.relics;
    if (!Array.isArray(g.out)) return { skip: true, detail: 'no cue queue on this branch (before #114)' };
    P.play(60);
    const drained = g.out.length === 0;
    rel.offers.push({ from: 'lair', options: ['butchersHook', 'guardiansAegis', 'stormPennant', 'thunderDrum'].filter((id) => !rel.held.includes(id)).slice(0, 3), rerolls: 0, duo: null }); // one already held is taken silently
    if (!P.toChoice()) return { ok: false, detail: 'no relic offer' };
    const before = P.sounds.levelup ?? 0;
    await P.click('[data-pick="0"]'); // no step runs in between: the next frame plays it
    const heard = (P.sounds.levelup ?? 0) - before;
    return { ok: drained && heard >= 1 && g.out.length === 0, detail: `queue after steps ${drained ? 'empty' : 'NOT empty'}, pick played levelup ×${heard}, queue now ${g.out.length}` };
  }),
);

// #99: a bigger boss pool; no boss comes back in a run until the pool is spent, and the HUD names the boss drawn (a variant by its own name)
await check('boss pool: the next boss is not one already met this run', async () => {
  const r = await inPage(async () => {
    const lb = window.__lb, g = lb.game, first = window.__play.boss;
    if (!('bossesSeen' in g)) return { skip: true };
    const next = () => g.enemies.find((e) => e.def.boss && !e.dead && !e.side && !e.warded && e !== first);
    for (let i = 0; i < 80000 && !next() && lb.game === g; i++) lb.run(1, false, true); // the bot plays on through the Merchant to wave 15
    const b = next();
    if (!b) return null;
    await window.__play.wait(150); // a real frame draws the HUD
    return { seen: [...g.bossesSeen], name: b.def.name, wave: g.wave, hud: document.getElementById('h-boss-name')?.textContent ?? '' };
  });
  if (!r) return { ok: false, detail: 'no second boss reached' };
  if (r.skip) return { skip: true, detail: 'no boss pool on this branch (before #99)' };
  const ok = r.seen.length >= 2 && new Set(r.seen).size === r.seen.length && r.hud.includes(r.name);
  return { ok, detail: `wave ${r.wave}: ${r.name}; met ${r.seen.join(', ')}; HUD "${r.hud}"` };
});

// ---------- v0.7.5 (#106): an error in a frame shows the error overlay, and the game goes on ----------
await check('an error in a frame: the overlay, Continue, the run goes on', () =>
  inPage(async () => {
    const lb = window.__lb, P = window.__play;
    if (!lb.game || lb.state !== 'playing') {
      lb.start('viking');
      await P.wait(200);
    }
    const g = lb.game;
    g.player.invulnerable = true;
    let texts = g.texts, thrown = false;
    Object.defineProperty(g, 'texts', {
      configurable: true,
      get() {
        if (thrown) return texts;
        thrown = true;
        throw new Error('play-test crash'); // once, in the middle of a real frame
      },
      set(v) {
        texts = v;
      },
    });
    await P.wait(400);
    const crash = document.getElementById('crash');
    const shown = { overlay: !!crash, text: crash?.textContent.includes('Something went wrong') && crash.querySelector('pre').textContent.includes('play-test crash'), state: lb.state };
    if (!crash) return { ok: false, detail: `no overlay, state ${lb.state}` };
    await P.click('#crash [data-continue]');
    await P.click('[data-resume]');
    const t0 = g.time;
    await P.wait(400); // real frames, not lb.run: the loop itself must still be running
    return { ok: shown.text && shown.state === 'paused' && !document.getElementById('crash') && lb.state === 'playing' && g.time > t0, detail: `overlay ${shown.overlay}, paused under it: ${shown.state}, run time +${(g.time - t0).toFixed(2)} s after Continue` };
  }),
);
const expected = (m) => m.includes('play-test crash');

// ---------- v0.7.5 (#106): the game starts with site data blocked ----------
await check('starts with site data blocked: title, Settings, sound toggle', async () => {
  const blocked = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  blocked.on('pageerror', (e) => errs.push(e.message));
  blocked.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await blocked.addInitScript(() =>
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      },
    }),
  );
  await blocked.goto(`http://localhost:${PORT}/`);
  await blocked.getByText('Take up arms').first().waitFor({ timeout: 5000 });
  await blocked.getByRole('button', { name: 'Settings' }).click();
  const mute = blocked.locator('.kit-toggle:has([data-set="mute"])'); // #186: a switch
  const before = await mute.textContent();
  await mute.click();
  const after = await blocked.locator('.kit-toggle:has([data-set="mute"])').textContent();
  const crash = await blocked.locator('#crash').count();
  await blocked.close();
  return { ok: before !== after && crash === 0 && errs.length === 0, detail: `title up, sound ${before} -> ${after}${errs.length ? `, errors: ${errs[0]}` : ''}` };
});

// ---------- v0.8.3 (#171): offline, a failed background update check shows no error overlay ----------
await check('offline: a failed update check shows no error overlay', async () => {
  const off = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  off.on('pageerror', (e) => errs.push(e.message));
  off.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await off.goto(`http://localhost:${PORT}/`);
  await off.getByText('Take up arms').first().waitFor({ timeout: 5000 });
  await off.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration('./'))); // registered
  await off.waitForTimeout(200); // its own .then() has attached the visibilitychange listener (src/core/pwa.ts)
  await off.context().setOffline(true);
  await off.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); // "back in the foreground": looks for an update
  await off.waitForTimeout(500); // the failed fetch has time to reject
  const crash = await off.locator('#crash').count();
  await off.context().setOffline(false);
  await off.close();
  return { ok: crash === 0 && errs.length === 0, detail: `overlay ${crash}${errs.length ? `, errors: ${errs[0]}` : ''}` };
});

// ---------- v0.8.3 (#182): desktop Settings shows the update status as it comes in, a failed check included ----------
await check('Settings: the update status follows the check while the screen is open, an error as text (#182)', async () => {
  const desk = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  desk.on('pageerror', (e) => errs.push(e.message));
  desk.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  // the Electron preload's API (electron/preload.cjs), with the status events in the test's hands
  await desk.addInitScript(() => {
    window.desktop = {
      getVersion: async () => '0.0.0',
      checkForUpdates: async () => window.__emit?.({ state: 'checking' }),
      quitAndInstall: () => undefined,
      onUpdateStatus: (fn) => (window.__emit = fn),
    };
  });
  await desk.goto(`http://localhost:${PORT}/`);
  await desk.getByText('Take up arms').first().waitFor({ timeout: 5000 });
  await desk.getByRole('button', { name: 'Settings' }).click();
  const status = desk.locator('[data-update-status]');
  await desk.evaluate(() => window.__emit({ state: 'none' }));
  const upToDate = await status.textContent();
  await desk.getByRole('button', { name: 'Check for updates' }).click();
  const checking = await status.textContent();
  await desk.evaluate(() => window.__emit({ state: 'error', message: '<b>net::ERR_INTERNET_DISCONNECTED</b>' }));
  const failed = await status.textContent();
  const markup = await status.locator('b').count();
  await desk.close();
  const ok = upToDate === 'You are up to date.' && checking === 'Checking…' && failed.includes('failed') && failed.includes('<b>') && markup === 0 && errs.length === 0;
  return { ok, detail: `${upToDate} -> ${checking} -> ${failed}${errs.length ? `, errors: ${errs[0]}` : ''}` };
});

// ---------- v0.8.3 (#182): Esc in the relic compendium goes back to the Keep, and again to the title ----------
await check('Esc in the relic compendium: back to the Keep, then the title (#182)', async () => {
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto(`http://localhost:${PORT}/`);
  await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
  await p.locator('[data-go="keep"]').click();
  await p.getByRole('button', { name: 'Relic compendium' }).click();
  const heading = () => p.locator('#overlay h1, .overlay h1').first().textContent();
  const opened = await heading();
  await p.keyboard.press('Escape');
  await p.waitForTimeout(100);
  const back = await heading();
  await p.keyboard.press('Escape');
  await p.waitForTimeout(100);
  const title = await p.getByText('Take up arms').count();
  await p.close();
  return { ok: opened === 'Relic compendium' && back === 'The Keep' && title > 0, detail: `${opened} -> ${back} -> ${title ? 'title' : '?'}` };
});

// ---------- #67: the Keep is a castle courtyard; its buildings grow with levels and ranks, and a tap opens a building's panel ----------
for (const [w, h, touch] of [[1280, 720, false], [844, 390, true]]) {
  await check(`The Keep as a castle: see it grow, ${touch ? 'tap' : 'click'} a building for its panel, buy a rank, Esc out, at ${w}x${h} (#67)`, async () => {
    const p = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`http://localhost:${PORT}/?debug`);
    await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
    await p.evaluate(() => Object.assign(window.__lb.save, { gold: 5000, runes: 12, buildings: { chapel: 2 }, meta: { relicChance: 2 } }));
    const press = (sel) => (touch ? p.locator(sel).tap() : p.locator(sel).click());
    await press('[data-go="keep"]');
    await p.locator('.keep-yard').waitFor({ timeout: 3000 });
    // every building stands in the yard, drawn from the rig's atlas at its stage: the ruined Armory, the Chapel at level 2 with a banner
    const yard = await p.evaluate(() => {
      const box = document.querySelector('.keep-yard').getBoundingClientRect();
      const blds = [...document.querySelectorAll('[data-building]')].map((b) => {
        const r = b.getBoundingClientRect();
        return { id: b.dataset.building, cls: b.className, bg: getComputedStyle(b).backgroundImage, inside: r.left >= box.left - 1 && r.right <= box.right + 1 && r.top >= box.top - 1 && r.width > 20 };
      });
      return { blds, yardBg: getComputedStyle(document.querySelector('.keep-yard')).backgroundImage };
    });
    const art = await p.evaluate(() => Promise.all(['/sprites/keep-castle.png', '/sprites/keep-yard.png'].map((src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i.naturalWidth); i.onerror = () => ok(0); i.src = src; }))));
    const chapelStage = yard.blds.find((b) => b.id === 'chapel')?.cls.match(/s-(\d+)/)?.[1];
    const armoryStage = yard.blds.find((b) => b.id === 'armory')?.cls.match(/s-(\d+)/)?.[1];
    // a tap on the Chapel opens its panel, with its ranks, costs and deed as before
    await press('[data-building="chapel"]');
    const panel = () => p.evaluate(() => {
      const el = document.querySelector('[data-panel="chapel"]');
      const r = el.getBoundingClientRect();
      return { open: !el.classList.contains('hidden') && r.width > 0, onScreen: r.top >= 0 && r.bottom <= innerHeight + 1, name: el.querySelector('.kit-ribbon').textContent.trim(), rows: el.querySelectorAll('.meta-row').length, raise: !!el.querySelector('[data-raise="chapel"]'), deed: /next deed/.test(el.textContent), others: document.querySelectorAll('[data-panel]:not(.hidden)').length };
    });
    const opened = await panel();
    // buying a rank keeps the panel open, with one more rank bought
    const before = await p.evaluate(() => window.__lb.save.meta.salvage ?? 0);
    await press('[data-panel="chapel"] [data-buy="salvage"]');
    await p.waitForTimeout(100);
    const after = await p.evaluate(() => window.__lb.save.meta.salvage ?? 0);
    const still = await panel();
    await p.keyboard.press('Escape');
    await p.waitForTimeout(100);
    const closed = !(await panel()).open && (await p.locator('.keep-yard').count()) === 1;
    await p.keyboard.press('Escape');
    await p.waitForTimeout(100);
    const title = await p.getByText('Take up arms').count();
    await p.close();
    const ok = yard.blds.length === 6 && yard.blds.every((b) => b.inside && b.bg.includes('keep-castle')) && yard.yardBg.includes('keep-yard') && art.every((n) => n > 0)
      && armoryStage === '0' && chapelStage === '9' && opened.open && opened.onScreen && opened.name.startsWith('Chapel') && opened.rows === 3 && opened.raise && opened.deed && opened.others === 1
      && after === before + 1 && still.open && closed && title > 0 && errs.length === 0;
    return { ok, detail: `${yard.blds.length} buildings${yard.blds.every((b) => b.inside) ? ' in the yard' : ' (one outside the yard)'}, armory s-${armoryStage}, chapel s-${chapelStage}, art ${art.join('/')}; panel ${opened.open ? 'open' : 'shut'} "${opened.name}" ${opened.rows} rows${opened.onScreen ? '' : ' (off screen)'}; smelter ${before} -> ${after}, still ${still.open ? 'open' : 'shut'}; Esc ${closed ? 'closes it' : 'did not close it'}, then ${title ? 'title' : '?'}${errs.length ? `; errors: ${errs[0]}` : ''}` };
  });
}

// ---------- #198: the world map from the painter: every realm on it, only the Marches open on a new save, the rest under clouds ----------
for (const [w, h, touch] of [[1280, 720, false], [844, 390, true]]) {
  await check(`world map: from the title, the Marches open and the rest under clouds, ${touch ? 'tap' : 'click'} the Marches, at ${w}x${h} (#198)`, async () => {
    const p = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`http://localhost:${PORT}/?debug`);
    await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
    const press = (sel) => (touch ? p.locator(sel).tap() : p.locator(sel).click());
    await press('[data-go="map"]');
    await p.locator('.wm-map').waitFor({ timeout: 3000 });
    const look = () => p.evaluate(() => {
      const map = document.querySelector('.wm-map'), box = map.getBoundingClientRect();
      const realms = [...document.querySelectorAll('.wm-realm')].map((b) => {
        const r = b.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height * 0.7); // below the name ribbon
        const o = b.querySelector('.wm-opens'), ob = o?.getBoundingClientRect();
        return { id: b.dataset.realm, open: !b.disabled, opens: o ? /^Opens with \d crowns?/.test(o.textContent) && ob.width > 20 && ob.left >= box.left - 1 && ob.right <= box.right + 1 : false, inside: r.left >= box.left - 1 && r.right <= box.right + 1 && r.top >= box.top - 1 && r.bottom <= box.bottom + 1, reach: hit === b };
      });
      const clouds = [...document.querySelectorAll('.wm-cloud')].map((c) => ({ id: c.className.match(/r-(\w+)/)[1], bg: getComputedStyle(c).backgroundImage, h: c.getBoundingClientRect().height }));
      const names = [...document.querySelectorAll('.wm-name')].filter((n) => n.getBoundingClientRect().width > 20 && /Cinzel/.test(getComputedStyle(n).fontFamily)).length;
      return { realms, clouds, names, mapBg: getComputedStyle(map).backgroundImage, onScreen: box.top >= 0 && box.bottom <= innerHeight + 1 && box.right <= innerWidth + 1 && box.width > 300 };
    });
    const before = await look();
    const art = await p.evaluate(() => Promise.all(['/sprites/world-map.png', '/sprites/world-clouds.png'].map((src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i.naturalWidth); i.onerror = () => ok(0); i.src = src; }))));
    await press('.wm-realm.r-marches');
    await p.waitForTimeout(100);
    const after = { note: await p.locator('.realm-road .kit-head').textContent().catch(() => '') }; // #199: its road opens
    await p.keyboard.press('Escape');
    await p.waitForTimeout(100);
    await p.keyboard.press('Escape');
    await p.waitForTimeout(100);
    const title = await p.getByText('Take up arms').count();
    await p.close();
    const open = before.realms.filter((r) => r.open).map((r) => r.id);
    const shut = before.realms.filter((r) => !r.open).map((r) => r.id);
    const ok = before.realms.length === 9 && open.join() === 'marches' && before.realms.every((r) => r.inside) && before.realms.find((r) => r.id === 'marches').reach
      && before.realms.every((r) => r.opens === !r.open)
      && before.clouds.length === 8 && before.clouds.every((c) => shut.includes(c.id) && c.bg.includes('world-clouds') && c.h > 20) && before.mapBg.includes('world-map') && art.every((n) => n > 0)
      && before.names === 9 && before.onScreen && /The Marches/.test(after.note) && title > 0 && errs.length === 0;
    return { ok, detail: `${before.realms.length} realms, open: ${open.join()}, ${before.clouds.length} under clouds (${before.realms.filter((r) => r.opens).length} say what opens them), ${before.names} names in Cinzel${before.onScreen ? '' : ' (map off screen)'}, art ${art.join('/')}; picked -> road "${after.note.trim()}"; Esc, Esc -> ${title ? 'title' : '?'}${errs.length ? `; errors: ${errs[0]}` : ''}` };
  });
}

// ---------- #199: the realm road and the level panel: world map -> the Marches -> road -> level panel -> FIGHT starts level 1 ----------
for (const [w, h, touch] of [[1280, 720, false], [844, 390, true]]) {
  await check(`realm road: map -> the Marches -> its road, a Knight crown and back, the level panel, FIGHT starts level 1, ${touch ? 'tap' : 'click'} at ${w}x${h} (#199)`, async () => {
    const p = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`http://localhost:${PORT}/?debug`);
    await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
    const press = (sel) => (touch ? p.locator(sel).tap() : p.locator(sel).click());
    await press('[data-go="map"]');
    await press('.wm-realm.r-marches');
    await p.locator('.rr-panel').waitFor({ timeout: 3000 });
    const look = () => p.evaluate(() => {
      const land = document.querySelector('.rr-land'), lb = land.getBoundingClientRect();
      const flags = [...document.querySelectorAll('.rr-flag')].map((f) => { const r = f.getBoundingClientRect(); return { n: +f.dataset.level, open: !f.disabled, on: f.classList.contains('on'), inside: r.left + r.width / 2 >= lb.left && r.right - r.width / 2 <= lb.right && r.top >= lb.top - r.height && r.bottom <= lb.bottom + r.height }; });
      const fight = document.querySelector('[data-fight]'), fb = fight.getBoundingClientRect();
      const panel = document.querySelector('.rr-panel');
      return {
        flags, landBg: getComputedStyle(land).backgroundImage, name: document.querySelector('.rr-name').textContent, text: panel.textContent.replace(/\s+/g, ' '),
        tiers: [...document.querySelectorAll('.rr-tier')].map((t) => (t.disabled ? '-' : t.classList.contains('on') ? 'X' : 'o')).join(''),
        golds: document.querySelectorAll('.realm-road .kit-btn.gold').length, fight: !fight.disabled && fb.bottom <= innerHeight + 1 && fb.right <= innerWidth + 1 && document.elementFromPoint(fb.left + fb.width / 2, fb.top + fb.height / 2)?.closest('[data-fight]') === fight,
        onScreen: (() => { const r = document.querySelector('.realm-road').getBoundingClientRect(); return r.top >= -1 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1; })(),
      };
    });
    const road = await look();
    await press('.rr-tier[data-tier="1"]');
    await p.waitForTimeout(100);
    const knight = await look();
    await press('.rr-tier[data-tier="0"]');
    await press('.rr-flag.l-1');
    await p.waitForTimeout(100);
    const squire = await look();
    await press('[data-fight]');
    await p.waitForFunction(() => window.__lb.state === 'playing' && !!window.__lb.game, null, { timeout: 5000 }).catch(() => {});
    const run = await p.evaluate(() => { const g = window.__lb.game; return g ? { realm: g.level?.realm, level: g.level?.level, last: g.level?.last, start: g.startWave, tier: g.tierIndex, arena: g.arena.id } : null; });
    await p.close();
    const ok = road.flags.length === 7 && road.flags.every((f) => f.inside) && road.flags.map((f) => f.open).join() === 'true,false,false,false,false,false,false' && road.flags[0].on
      && road.landBg.includes('world-map') && road.name === 'The Marches · Level 1' && road.tiers === 'Xo--' && road.golds === 1 && road.fight && road.onScreen
      && !/Head start/.test(road.text) && /Slots\s*3/.test(road.text) && /Enemy HP\s*34%/.test(road.text) && /Steel relics featured/.test(road.text) && /War Drummer/.test(road.text) && /Pick 1 of 2 Steel rares/.test(road.text)
      && knight.tiers === 'oX--' && /Enemy HP\s*59%/.test(knight.text) && squire.tiers === 'Xo--' && squire.flags[0].on
      && run?.realm === 'marches' && run.level === 1 && run.last === 6 && run.start === 1 && run.tier === 0 && run.arena === 'courtyard' && errs.length === 0;
    return { ok, detail: `${road.flags.length} flags (${road.flags.filter((f) => f.open).length} open${road.flags.every((f) => f.inside) ? '' : ', one off the road'}), "${road.name}", tiers ${road.tiers} -> Knight ${knight.tiers} (${/Enemy HP\s*59%/.test(knight.text) ? 'HP 59%' : 'HP?'}) -> ${squire.tiers}, ${road.golds} gold button, FIGHT ${road.fight ? 'reachable' : 'hidden'}${road.onScreen ? '' : ' (off screen)'}; run: ${run ? `${run.realm} level ${run.level}, waves ${run.start}-${run.last}, tier ${run.tier}, ${run.arena}` : 'none'}${errs.length ? `; errors: ${errs[0]}` : ''}` };
  });
}

// ---------- #221: the level step: the panel's Enemy HP on Knight is what the level fights at, eased on level 1 of the Marches ----------
for (const [w, h, touch] of [[1280, 720, false], [844, 390, true]]) {
  await check(`level step: the Marches level 1 on Knight shows Enemy HP 59% (Knight 145% eased, #243, and for a level-1 champion, #238, as tuned in #220) and FIGHT plays it at that HP, ${touch ? 'tap' : 'click'} at ${w}x${h} (#221)`, async () => {
    const p = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`http://localhost:${PORT}/?debug`);
    await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
    const press = (sel) => (touch ? p.locator(sel).tap() : p.locator(sel).click());
    await press('[data-go="map"]');
    await press('.wm-realm.r-marches');
    await p.locator('.rr-panel').waitFor({ timeout: 3000 });
    await press('.rr-tier[data-tier="1"]');
    await p.waitForTimeout(100);
    const shown = (await p.locator('.rr-panel').textContent()).replace(/\s+/g, ' ').match(/Enemy HP\s*(\d+)%/)?.[1];
    await press('[data-fight]');
    await p.waitForFunction(() => window.__lb.state === 'playing' && !!window.__lb.game, null, { timeout: 5000 }).catch(() => {});
    const run = await p.evaluate(() => { const g = window.__lb.game; return g ? { level: g.level?.level, tier: g.tierIndex, hp: Math.round(g.tier.enemyHp * 100) } : null; });
    await p.close();
    const ok = shown === '59' && run?.level === 1 && run.tier === 1 && run.hp === 59 && errs.length === 0;
    return { ok, detail: `panel Enemy HP ${shown ?? '?'}%; run: ${run ? `level ${run.level}, tier ${run.tier}, enemy HP ${run.hp}%` : 'none'}${errs.length ? `; errors: ${errs[0]}` : ''}` };
  });
}

// ---------- #220: the release's balance pass, as a player meets it: map -> the Iron Hold -> Knight; every flag's panel shows the Enemy HP
// its level plays at (335, 251, 237, 240, 225%: a level-8 to level-10 champion's foes), level 4 names its Elite boss, and FIGHT on level 1
// plays at the HP its panel showed ----------
for (const [w, h, touch] of [[1280, 720, false], [844, 390, true]]) {
  await check(`balance: the Iron Hold's road on Knight shows Enemy HP 335, 251, 237, 240 and 225% for levels 1-5, level 4 an Elite boss, and FIGHT plays level 1 at 335%, ${touch ? 'tap' : 'click'} at ${w}x${h} (#220)`, async () => {
    const p = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`http://localhost:${PORT}/?debug`);
    await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
    await p.evaluate(() => {
      const world = { marches: [7], ironHold: [0, 4] }; // the Marches crowned, the Iron Hold's first four levels cleared on Knight
      window.__lb.save.champions = { paladin: { name: 'Hild', inventory: [], loadouts: {}, ...window.__lb.build.grown(world), world, signature: true, lastBastion: false, runs: {} } };
    });
    const press = (sel) => (touch ? p.locator(sel).first().tap() : p.locator(sel).first().click());
    await press('[data-go="map"]');
    await press('.wm-realm.r-ironHold');
    await p.locator('.rr-panel').waitFor({ timeout: 3000 });
    await press('.rr-tier[data-tier="1"]');
    await p.waitForTimeout(100);
    const shown = [];
    for (let l = 1; l <= 5; l++) {
      await press(`.rr-flag.l-${l}`);
      await p.waitForTimeout(100);
      const text = (await p.locator('.rr-panel').textContent()).replace(/\s+/g, ' ');
      shown.push({ hp: text.match(/Enemy HP\s*(\d+)%/)?.[1] ?? '?', boss: text.match(/(End boss|Elite boss|Crown boss)/)?.[1] ?? '?' });
    }
    await press('.rr-flag.l-1');
    await p.waitForTimeout(100);
    await press('[data-fight]');
    await p.waitForFunction(() => window.__lb.state !== 'menu' && !!window.__lb.game, null, { timeout: 5000 }).catch(() => {});
    const run = await p.evaluate(() => { const g = window.__lb.game; return g ? { realm: g.level?.realm, level: g.level?.level, tier: g.tierIndex, hp: Math.round(g.tier.enemyHp * 100), champion: g.player.level } : null; });
    await p.close();
    const ok = shown.map((s) => s.hp).join() === '335,251,237,240,225' && shown.map((s) => s.boss).join() === 'End boss,End boss,End boss,Elite boss,Crown boss'
      && run?.realm === 'ironHold' && run.level === 1 && run.tier === 1 && run.hp === 335 && run.champion === 10 && errs.length === 0; // four Iron Hold levels cleared: level 10, the cap with one crown
    return { ok, detail: `panels Enemy HP ${shown.map((s) => `${s.hp}%`).join(', ')}; bosses ${shown.map((s) => s.boss).join(', ')}; run: ${run ? `${run.realm} level ${run.level}, tier ${run.tier}, enemy HP ${run.hp}%, champion level ${run.champion}` : 'none'}${errs.length ? `; errors: ${errs[0]}` : ''}` };
  });
}

// ---------- #250: Squire measured: map -> the Iron Hold -> Squire; every flag's panel shows the Enemy HP its level plays at on Squire,
// eased the more the later the level (197, 141, 127, 122, 109%, were 231, 173, 164, 166, 156%), FIGHT on level 1 plays at the HP its panel
// showed, and Knight's panels are as they were (335 ... 225%) ----------
const SQUIRE_IRON_HP = [197, 141, 127, 122, 109]; // levels 1-5 on Squire, as tests/v12-squire-balance.test.ts pins them
for (const [w, h, touch] of [[1280, 720, false], [844, 390, true]]) {
  await check(`balance: the Iron Hold's road on Squire shows Enemy HP ${SQUIRE_IRON_HP.join(', ')}% for levels 1-5, Knight's still 335-225%, and FIGHT plays level 1 on Squire at ${SQUIRE_IRON_HP[0]}%, ${touch ? 'tap' : 'click'} at ${w}x${h} (#250)`, async () => {
    const p = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`http://localhost:${PORT}/?debug`);
    await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
    await p.evaluate(() => {
      const world = { marches: [7], ironHold: [4, 4] }; // the Marches crowned, the Iron Hold's first four levels cleared on Squire and Knight (every flag open on both)
      window.__lb.save.champions = { paladin: { name: 'Hild', inventory: [], loadouts: {}, ...window.__lb.build.grown(world), world, signature: true, lastBastion: false, runs: {} } };
    });
    const press = (sel) => (touch ? p.locator(sel).first().tap() : p.locator(sel).first().click());
    await press('[data-go="map"]');
    await press('.wm-realm.r-ironHold');
    await p.locator('.rr-panel').waitFor({ timeout: 3000 });
    const panels = async (tier) => {
      await press(`.rr-tier[data-tier="${tier}"]`);
      await p.waitForTimeout(100);
      const out = [];
      for (let l = 1; l <= 5; l++) {
        await press(`.rr-flag.l-${l}`);
        await p.waitForTimeout(100);
        out.push((await p.locator('.rr-panel').textContent()).replace(/\s+/g, ' ').match(/Enemy HP\s*(\d+)%/)?.[1] ?? '?');
      }
      return out;
    };
    const knight = await panels(1);
    const squire = await panels(0);
    await press('.rr-flag.l-1'); // a realm run starts at level 1 (#237)
    await p.waitForTimeout(100);
    await press('[data-fight]');
    await p.waitForFunction(() => window.__lb.state !== 'menu' && !!window.__lb.game, null, { timeout: 5000 }).catch(() => {});
    const run = await p.evaluate(() => { const g = window.__lb.game; return g ? { realm: g.level?.realm, level: g.level?.level, tier: g.tierIndex, hp: Math.round(g.tier.enemyHp * 100) } : null; });
    await p.close();
    const ok = squire.join() === SQUIRE_IRON_HP.join() && knight.join() === '335,251,237,240,225'
      && run?.realm === 'ironHold' && run.level === 1 && run.tier === 0 && run.hp === SQUIRE_IRON_HP[0] && errs.length === 0;
    return { ok, detail: `Squire panels Enemy HP ${squire.map((x) => `${x}%`).join(', ')}; Knight ${knight.map((x) => `${x}%`).join(', ')}; run: ${run ? `${run.realm} level ${run.level}, tier ${run.tier}, enemy HP ${run.hp}%` : 'none'}${errs.length ? `; errors: ${errs[0]}` : ''}` };
  });
}

// ---------- #232: the Cinderlands' balance pass, as a player meets it: map -> the Cinderlands -> Knight; every flag's panel shows the Enemy
// HP its level plays at (its own level steps: the crown level eased), level 4 names its Elite boss, and FIGHT on level 1 plays at the HP
// its panel showed. Then a realm run standing at level 4: Continue from level 4, its last wave brings the Grand Inquisitor as an elite
// on 1.4 times the HP, and in his Auto-da-fé his pyres leave fire that burns 2.5 s at 8 a second (as a foe's blow scales): the numbers the sim measured him on ----------
const CINDER_HP = [335, 251, 237, 240, 200]; // levels 1-5 on Knight, as tests/v12-cinderlands-balance.test.ts pins them
for (const [w, h, touch] of [[1280, 720, false], [844, 390, true]]) {
  await check(`balance: the Cinderlands' road on Knight shows Enemy HP ${CINDER_HP.slice(0, 4).join(', ')} and ${CINDER_HP[4]}% for levels 1-5, level 4 an Elite boss, and FIGHT plays level 1 at ${CINDER_HP[0]}%; from level 4 the elite Grand Inquisitor has 1.4 times the HP and his Auto-da-fé's pyres burn 2.5 s at 8 a second, ${touch ? 'tap' : 'click'} at ${w}x${h} (#232)`, async () => {
    const errs = [];
    const open = async (world, runs) => {
      const p = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
      p.on('pageerror', (e) => errs.push(e.message));
      await p.goto(`http://localhost:${PORT}/?debug`);
      await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
      await p.evaluate(([world, runs]) => {
        const lb = window.__lb;
        lb.save.champions = { paladin: { name: 'Hild', inventory: [], loadouts: {}, ...lb.build.grown(world), world, signature: true, lastBastion: false, runs } };
        lb.save.cards = [...lb.cardIds]; // every flash card seen: none stops the fight
      }, [world, runs]);
      const press = (sel) => (touch ? p.locator(sel).first().tap() : p.locator(sel).first().click());
      await press('[data-go="map"]');
      await press('.wm-realm.r-cinderlands');
      await p.locator('.rr-panel').waitFor({ timeout: 3000 });
      await press('.rr-tier[data-tier="1"]');
      await p.waitForTimeout(100);
      const panel = async (l) => {
        await press(`.rr-flag.l-${l}`);
        await p.waitForTimeout(100);
        const text = (await p.locator('.rr-panel').textContent()).replace(/\s+/g, ' ');
        return { hp: text.match(/Enemy HP\s*(\d+)%/)?.[1] ?? '?', boss: text.match(/(End boss|Elite boss|Crown boss)/)?.[1] ?? '?', inquisitor: /Grand Inquisitor/.test(text), go: (await p.locator('[data-fight]').first().textContent()).trim() };
      };
      return { p, press, panel };
    };
    // the road: the Marches crowned, the Cinderlands' first four levels cleared on Knight, no run in progress
    const a = await open({ marches: [7], cinderlands: [0, 4] }, {});
    const shown = [];
    for (let l = 1; l <= 5; l++) shown.push(await a.panel(l));
    await a.panel(1);
    await a.press('[data-fight]');
    await a.p.waitForFunction(() => window.__lb.state !== 'menu' && !!window.__lb.game, null, { timeout: 5000 }).catch(() => {});
    const run = await a.p.evaluate(() => { const g = window.__lb.game; return g ? { realm: g.level?.realm, level: g.level?.level, tier: g.tierIndex, hp: Math.round(g.tier.enemyHp * 100), champion: g.player.level } : null; });
    await a.p.close();
    // the elite: a realm run on Knight standing at level 4
    const b = await open({ marches: [7], cinderlands: [0, 3] }, { cinderlands: runAt(4, 1) });
    const four = await b.panel(4);
    await b.press('[data-fight]');
    await b.p.waitForFunction(() => window.__lb.state !== 'menu' && !!window.__lb.game, null, { timeout: 5000 }).catch(() => {});
    const elite = await b.p.evaluate(() => {
      const lb = window.__lb, g = lb.game;
      if (!g?.level) return null;
      g.player.invulnerable = true;
      lb.run(30, false, true); // the opening pick, if one stands
      g.enemies.length = 0;
      g.spawnQueue.length = 0;
      g.wave = g.wavesCleared = g.level.last - 1;
      g.breather = 0.01;
      let boss = null;
      for (let i = 0; i < 4000 && !boss; i++) (lb.run(1, false, true), (boss = g.enemies.find((e) => e.def.boss && !e.side) ?? null));
      if (!boss) return { level: g.level.level, wave: g.wave, name: null };
      const out = { level: g.level.level, wave: g.wave, tier: g.tierIndex, levelHp: Math.round(g.tier.enemyHp * 100), name: boss.def.name, phases: boss.def.phases, hp: boss.maxHp / (lb.enemyDef(boss.def.id).hp * g.waveHpMult * g.tier.enemyHp), banner: false, phase: 1, pyres: 0, life: 0, dps: 0 };
      boss.hp = boss.maxHp * 0.25; // worn down to his last phase; he stands until his pyres are seen
      const scale = g.waveDmgMult * g.tier.enemyDmg;
      for (let i = 0; i < 1800 && out.pyres < 3; i++) {
        boss.hp = Math.max(boss.hp, boss.maxHp * 0.1);
        g.player.invulnerable = true;
        lb.run(1, false, true);
        if (g.banner?.text === 'The Inquisitor’s auto-da-fé') out.banner = true;
        out.phase = Math.max(out.phase, boss.phase);
        const fire = g.fields.filter((f) => f.hostile && f.dtype === 'fire' && f.apply?.id === 'burn');
        if (fire.length > out.pyres) (out.pyres = fire.length), (out.life = fire[0].max), (out.dps = fire[0].dps / scale);
      }
      return out;
    });
    await b.p.close();
    const ok = shown.map((s) => s.hp).join() === CINDER_HP.join() && shown.map((s) => s.boss).join() === 'End boss,End boss,End boss,Elite boss,Crown boss' && shown[3].inquisitor
      && run?.realm === 'cinderlands' && run.level === 1 && run.tier === 1 && run.hp === CINDER_HP[0] && run.champion === 10 // four Cinderlands levels cleared: level 10, the cap with one crown
      && four.boss === 'Elite boss' && four.hp === String(CINDER_HP[3]) && four.go === 'Continue from level 4'
      && elite?.level === 4 && elite.wave === 32 && elite.tier === 1 && elite.levelHp === CINDER_HP[3] && elite.name === 'The Grand Inquisitor, Elite' && elite.phases === 3 && Math.abs(elite.hp - 1.4) < 0.02
      && elite.phase === 3 && elite.banner && elite.pyres >= 3 && elite.life === 2.5 && Math.abs(elite.dps - 8) < 0.01 && errs.length === 0;
    return { ok, detail: `panels Enemy HP ${shown.map((s) => `${s.hp}%`).join(', ')}; bosses ${shown.map((s) => s.boss).join(', ')}; run: ${run ? `${run.realm} level ${run.level}, tier ${run.tier}, enemy HP ${run.hp}%, champion level ${run.champion}` : 'none'}; level 4 "${four.go}" (${four.boss}, ${four.hp}%): ${elite?.name ? `${elite.name} on wave ${elite.wave}, ${elite.phases} phases, HP x${elite.hp.toFixed(2)}, phase ${elite.phase}${elite.banner ? ', the auto-da-fé announced' : ''}, ${elite.pyres} pyres alight for ${elite.life} s at ${elite.dps.toFixed(1)} a second` : `no elite (${JSON.stringify(elite)})`}${errs.length ? `; errors: ${errs[0]}` : ''}` };
  });
}

// ---------- #258: a realm that isn't built yet says so on its road, and the champion screen's PLAY prefers a built realm ----------
// A champion with the Marches, the Iron Hold and the Cinderlands crowned: PLAY points at a built realm (the Cinderlands, replayed), not the
// Barrowvale; the map opens the Barrowvale (still playable: its FIGHT is on) and its road says its foes, bosses and relics come later; the
// Cinderlands' road says nothing of the kind.
for (const [w, h, touch] of [[1280, 720, false], [844, 390, true]]) {
  await check(`unbuilt realm: the Barrowvale's road says its own foes, bosses and relics come later and stays playable, the Cinderlands' road says nothing, and PLAY on the champion screen points at a built realm, ${touch ? 'tap' : 'click'} at ${w}x${h} (#258)`, async () => {
    const errs = [];
    const p = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`http://localhost:${PORT}/?debug`);
    await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
    await p.evaluate(() => {
      const lb = window.__lb, world = { marches: [7], ironHold: [5], cinderlands: [5] };
      lb.save.champions = { paladin: { name: 'Hild', inventory: [], loadouts: {}, ...lb.build.grown(world), world, signature: true, lastBastion: false, runs: {} } };
      lb.save.cards = [...lb.cardIds];
    });
    const press = (sel) => (touch ? p.locator(sel).first().tap() : p.locator(sel).first().click());
    await press('[data-go="champion"]');
    await skipTour(p, touch);
    await p.locator('.cs-next').waitFor({ timeout: 3000 });
    const next = (await p.locator('.cs-next').textContent()).replace(/\s+/g, ' ').trim();
    await press('[data-back]'); // back to the title
    await p.locator('[data-go="map"]').first().waitFor({ timeout: 3000 });
    await press('[data-go="map"]');
    await p.locator('.wm-realm.r-barrowvale').waitFor({ timeout: 3000 });
    await press('.wm-realm.r-barrowvale');
    await p.locator('.rr-panel').waitFor({ timeout: 3000 });
    const road = async () => ({
      text: (await p.locator('.rr-panel').textContent()).replace(/\s+/g, ' '),
      notice: (await p.locator('.rr-unbuilt').count()) ? (await p.locator('.rr-unbuilt').textContent()).replace(/\s+/g, ' ').trim() : '',
      fight: await p.locator('[data-fight]').first().isEnabled(),
      seen: await p.evaluate(() => { const r = document.querySelector('.rr-unbuilt')?.getBoundingClientRect(); return !!r && r.top >= 0 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1; }),
    });
    const vale = await road();
    if (!touch && process.env.LB_SHOT) await p.screenshot({ path: process.env.LB_SHOT });
    await p.keyboard.press('Escape'); // back to the map
    await p.locator('.wm-realm.r-cinderlands').waitFor({ timeout: 3000 });
    await press('.wm-realm.r-cinderlands');
    await p.locator('.rr-panel').waitFor({ timeout: 3000 });
    const cinder = await road();
    await p.close();
    const ok = /The Cinderlands · Level 1/.test(next) && /later version/.test(vale.notice) && vale.seen && vale.fight && !cinder.notice && errs.length === 0;
    return { ok, detail: `PLAY "${next}"; Barrowvale road: "${vale.notice}"${vale.seen ? '' : ' (off screen)'}, FIGHT ${vale.fight ? 'on' : 'off'}; Cinderlands road: ${cinder.notice ? `"${cinder.notice}"` : 'no notice'}${errs.length ? `; errors: ${errs[0]}` : ''}` };
  });
}

// ---------- #237: the head start is gone: a realm run starts at level 1, wave 1 ----------
// A champion from before v0.11, four Marches levels cleared and no run in progress, four relics in its Marches loadout: the road opens on
// level 1 with the run's three slots and no head start; level 5 (open) says the run starts at level 1 and its FIGHT is off; FIGHT on
// level 1 starts wave 1 at champion level 1 with the loadout's first three relics, straight on the opening pick of 1 of 3 (no queued
// build picks before it), and the save holds the run at level 1.
await check('realm run: no head start: four levels cleared and no run -> the road opens on level 1 (3 slots), level 5 says "The run starts at level 1" with FIGHT off, level 1 starts at wave 1 with three slotted relics and the opening pick (#237)', async () => {
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://localhost:${PORT}/?debug`);
  await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
  await p.evaluate(() => {
    const four = ['brimstoneOil', 'emberheart', 'cinderCharm', 'frostBrand'];
    window.__lb.save.champions = { paladin: { name: 'Hild', inventory: four, loadouts: { marches: four }, ...window.__lb.build.grown({ marches: [4] }), world: { marches: [4] }, signature: false, lastBastion: false, runs: {} } };
  });
  await p.click('[data-go="map"]');
  await p.click('.wm-realm.r-marches');
  await p.locator('.rr-panel').waitFor({ timeout: 3000 });
  const look = () => p.evaluate(() => ({ name: document.querySelector('.rr-name').textContent, text: document.querySelector('.rr-panel').textContent.replace(/\s+/g, ' '), fight: !document.querySelector('[data-fight]').disabled, open: [...document.querySelectorAll('.rr-flag')].filter((f) => !f.disabled).length }));
  const first = await look();
  await p.click('.rr-flag.l-5');
  await p.waitForTimeout(100);
  const later = await look();
  await p.click('[data-fight]', { force: true, timeout: 1000 }).catch(() => {}); // off: nothing starts
  await p.waitForTimeout(100);
  const stayed = await p.evaluate(() => window.__lb.state === 'menu' && !!document.querySelector('.rr-panel'));
  await p.click('.rr-flag.l-1');
  await p.waitForTimeout(100);
  await p.click('[data-fight]');
  await p.locator('[data-pick]').first().waitFor({ timeout: 5000 }).catch(() => {}); // the level's opening pick
  const run = await p.evaluate(() => {
    const g = window.__lb.game;
    return g ? { level: g.level?.level, start: g.startWave, wave: g.wave, plevel: g.player.level, held: g.player.relics.held.join(), queued: g.pendingAbilityTiers.length + g.pendingUtilityTiers.length + g.pendingLevelUps, picks: document.querySelectorAll('[data-pick]').length, saved: window.__lb.save.champions.paladin.runs.marches?.level } : null;
  });
  await p.close();
  const ok = first.name === 'The Marches · Level 1' && first.fight && first.open === 5 && !/Head start/.test(first.text) && /Slots\s*3/.test(first.text)
    && later.name === 'The Marches · Level 5' && !later.fight && /The run starts at level 1/.test(later.text) && stayed
    && run?.level === 1 && run.start === 1 && run.wave === 0 && run.plevel === 5 && run.held === 'brimstoneOil,emberheart,cinderCharm' && run.queued === 0 && run.picks === 3 && run.saved === 1 && errs.length === 0;
  return { ok, detail: `road "${first.name}" (${first.open} open, FIGHT ${first.fight ? 'on' : 'off'}${/Head start/.test(first.text) ? ', HEAD START shown' : ''}); "${later.name}": FIGHT ${later.fight ? 'ON' : 'off'}${/The run starts at level 1/.test(later.text) ? ', "The run starts at level 1"' : ', NO NOTE'}, a click starts ${stayed ? 'nothing' : 'A RUN'}; run: ${run ? `level ${run.level}, wave ${run.start} (at ${run.wave}), champion level ${run.plevel}, holds ${run.held}, ${run.queued} queued picks, opening pick of ${run.picks}, saved at level ${run.saved}` : 'none'}${errs.length ? `; errors: ${errs[0]}` : ''}` };
});

// ---------- #242: the realm road continues a realm run from its checkpoint, or starts it over ----------
// A champion with two relics in its Marches loadout. Level 1 from the road (Fight!, no run marked), cleared with its opening pick and its
// rare: back on the road level 1's flag is ticked, level 2's glows, the panel lists the run's relics and its gold button says "Continue
// from level 2" beside Start over. Back to the map and in again: the same. Start over asks in the panel's row; Keep the run (Esc on the
// keyboard) puts the buttons back and the run stays. Continue starts level 2 on the checkpoint's seed holding the same relics. A fall
// there, and the road says "fell at wave N, restart level 2". Start over and its yes: level 1, wave 1, only the loadout's relics, a new seed.
for (const [w, h, touch] of [[1280, 720, false], [844, 390, true]]) {
  await check(`realm road: level 1 cleared -> its flag ticked, level 2's glows, the run's relics listed, back to the map and Continue from level 2 with the same relics; a fall says "fell at wave N, restart level 2"; Start over asks, Keep the run keeps it, yes starts level 1 with the loadout only, ${touch ? 'tap' : 'click and Esc'} at ${w}x${h} (#242)`, async () => {
    const p = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`http://localhost:${PORT}/?debug`);
    await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
    const press = (sel) => (touch ? p.locator(sel).first().tap({ timeout: 8000 }) : p.locator(sel).first().click({ timeout: 8000 })).catch((e) => { throw new Error(`${sel}: ${String(e.message).split('\n')[0]}`); }); // a press that fails names its button
    const bad = [];
    const want = (cond, what) => { if (!cond) bad.push(what); return cond; };
    const LOADOUT = ['brimstoneOil', 'emberheart'];
    await p.evaluate((two) => {
      const lb = window.__lb;
      lb.save.champions = { paladin: { name: 'Hild', inventory: two, loadouts: { marches: two }, ...lb.build.grown({}), world: {}, signature: false, lastBastion: false, runs: {} } };
      lb.save.cards = [...lb.cardIds]; // every flash card seen: nothing stops the fight
    }, LOADOUT);
    // the road as a player sees it: the flags' run marks, the panel's row (only what is shown and can be pressed), the run in the save
    const look = () => p.evaluate(() => {
      const shown = (sel) => {
        const b = document.querySelector(sel);
        if (!b || b.closest('[hidden]')) return null;
        const r = b.getBoundingClientRect();
        return { text: b.textContent.trim(), on: !b.disabled, seen: r.width > 0 && r.top >= -1 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1 && document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest(sel) === b };
      };
      const next = document.querySelector('.rr-flag.run-next');
      const run = window.__lb.save.champions.paladin?.runs?.marches;
      return {
        name: document.querySelector('.rr-name')?.textContent ?? '',
        flags: [...document.querySelectorAll('.rr-flag')].map((f) => (f.classList.contains('run-done') && f.querySelector('.rr-tick') ? 'D' : f.classList.contains('run-next') ? 'N' : f.disabled ? '-' : 'o')).join(''),
        glow: next ? getComputedStyle(next).animationName : '',
        fight: shown('[data-fight]'), over: shown('[data-over]'), keep: shown('[data-keep]'), yes: shown('[data-yes]'),
        ask: document.querySelector('.rr-ask:not([hidden]) .rr-asks')?.textContent ?? '',
        relics: [...document.querySelectorAll('.rr-relic')].map((r) => r.dataset.relic).join(),
        fell: document.querySelector('.rr-fell')?.textContent ?? '',
        note: document.querySelector('.rr-from')?.textContent ?? '',
        golds: document.querySelectorAll('.realm-road .kit-btn.gold').length,
        state: window.__lb.state,
        run: run ? { level: run.level, seed: run.seed, held: run.carry ? run.carry.relics.held.join() : null } : null,
      };
    });
    const fight = () => p.evaluate(() => { const g = window.__lb.game; return g ? { level: g.level?.level, start: g.startWave, wave: g.wave, seed: g.seed, held: g.player.relics.held.join() } : null; });
    const opening = () => p.waitForFunction(() => window.__lb.state === 'choice' && !!document.querySelector('[data-pick]'), null, { timeout: 5000 });
    const toRoad = async () => {
      await press('.wm-realm.r-marches');
      await p.locator('.rr-panel').waitFor({ timeout: 3000 });
    };
    await press('[data-go="map"]');
    await toRoad();
    const road0 = await look();
    want(road0.name === 'The Marches · Level 1' && road0.flags === 'o------' && road0.fight?.text === 'Fight!' && !road0.over && road0.relics === '' && !road0.run, `no run: ${JSON.stringify(road0)}`);
    // level 1: its opening pick, cleared, its rare, and back to the road
    await press('[data-fight]');
    await opening();
    await p.evaluate(() => { window.__lb.game.level.cleared = true; }); // as if wave 5's boss fell: the level ends once its spoils are taken
    await press('[data-pick="0"]');
    await p.locator('.rare-pick').waitFor({ timeout: 5000 });
    await press('.rare-pick [data-pick="0"]');
    await p.locator('[data-menu]').waitFor({ timeout: 3000 });
    await press('[data-menu]');
    await p.locator('.rr-panel').waitFor({ timeout: 3000 });
    const road1 = await look();
    const held = road1.run?.held ?? '';
    want(road1.name === 'The Marches · Level 2' && road1.flags === 'DN-----' && road1.glow === 'rr-glow', `after level 1: "${road1.name}", flags ${road1.flags}, glow "${road1.glow}"`);
    want(road1.run?.level === 2 && held.startsWith(LOADOUT.join()) && held.split(',').length === 3 && road1.relics === held, `the run's relics: panel [${road1.relics}], run ${JSON.stringify(road1.run)}`);
    want(road1.fight?.text === 'Continue from level 2' && road1.fight.on && road1.fight.seen && road1.over?.text === 'Start over' && road1.over.seen && road1.golds === 1 && !road1.ask, `the panel's row ${JSON.stringify({ fight: road1.fight, over: road1.over, golds: road1.golds })}`);
    // back to the map and in again: the run is still there; level 1's flag says it is cleared in this run and still continues from level 2
    await press('[data-back]');
    await p.locator('.wm-map').waitFor({ timeout: 3000 });
    await toRoad();
    const road2 = await look();
    await press('.rr-flag.l-1');
    await p.waitForFunction(() => document.querySelector('.rr-name')?.textContent.endsWith('Level 1'), null, { timeout: 3000 }).catch(() => {});
    const onOne = await look();
    await press('.rr-flag.l-2');
    await p.waitForFunction(() => document.querySelector('.rr-name')?.textContent.endsWith('Level 2'), null, { timeout: 3000 }).catch(() => {});
    want(road2.name === 'The Marches · Level 2' && road2.fight?.text === 'Continue from level 2' && road2.flags === 'DN-----' && road2.relics === held, `from the map again: ${JSON.stringify({ name: road2.name, fight: road2.fight?.text, flags: road2.flags })}`);
    want(onOne.name === 'The Marches · Level 1' && onOne.fight?.text === 'Continue from level 2' && onOne.note === 'cleared in this run', `level 1's panel: "${onOne.name}", "${onOne.fight?.text}", note "${onOne.note}"`);
    // Start over asks first; Keep the run (Esc) keeps it
    await press('[data-over]');
    const asked = await look();
    if (touch) await press('[data-keep]');
    else await p.keyboard.press('Escape');
    await p.waitForTimeout(100);
    const keptRun = await look();
    want(asked.ask === 'Start over from level 1? This run and its 3 relics are lost.' && !asked.fight && !asked.over && asked.keep?.seen && asked.yes?.seen && asked.yes.text === 'Start over' && asked.state === 'menu', `Start over asks: ${JSON.stringify({ ask: asked.ask, fight: asked.fight, keep: asked.keep, yes: asked.yes, state: asked.state })}`);
    want(keptRun.state === 'menu' && keptRun.name === 'The Marches · Level 2' && !keptRun.ask && keptRun.fight?.seen && keptRun.run?.seed === road1.run?.seed && keptRun.run.held === held, `Keep the run: ${JSON.stringify({ state: keptRun.state, name: keptRun.name, ask: keptRun.ask, run: keptRun.run })}`);
    // Continue: level 2 on the checkpoint's seed, holding what level 1 ended with
    await press('[data-fight]');
    await opening();
    const two = await fight();
    want(two?.level === 2 && two.start > 1 && two.held === held && two.seed === road1.run?.seed, `Continue: ${JSON.stringify(two)} against the run ${JSON.stringify(road1.run)}`);
    // a fall in level 2 (at 1 HP and standing still), and the road says so
    await press('[data-pick="0"]');
    const fell = await p.evaluate(() => {
      const lb = window.__lb, g = lb.game;
      for (let i = 0; i < 80000 && lb.game === g && lb.state !== 'results'; i++) {
        if (lb.state === 'playing') g.player.hp = Math.min(g.player.hp, 1);
        lb.run(1, false, false);
      }
      return { over: g.over, wave: Math.max(1, g.wave), state: lb.state };
    });
    await p.locator('.results [data-menu]').waitFor({ timeout: 3000 });
    // #254: the best-wave line says it counts the waves of one level, in words, next to the realm's wave it reached
    const bestLine = await p.evaluate(() => { const rows = [...document.querySelectorAll('.results .stats > div')].map((d) => [d.children[0]?.textContent ?? '', d.children[1]?.textContent ?? '']); return { best: rows.find(([k]) => /^Most waves in one level/.test(k))?.[1] ?? null, reached: rows.find(([k]) => k === 'Reached')?.[1] ?? null, old: rows.some(([k]) => /^Best wave/.test(k)) }; });
    want(/^\d+ waves?$/.test(bestLine.best ?? '') && !bestLine.old && /wave \d+/.test(bestLine.reached ?? ''), `results best-wave line: ${JSON.stringify(bestLine)} after the fall at wave ${fell.wave}`);
    await press('.results [data-menu]');
    await p.locator('.champion-screen').waitFor({ timeout: 3000 });
    await skipTour(p, touch); // #240: this browser's first champion screen
    await press('.kit-tab[data-tab="map"]');
    await p.locator('.wm-map').waitFor({ timeout: 3000 });
    await toRoad();
    const road3 = await look();
    want(fell.over && fell.state === 'results' && road3.name === 'The Marches · Level 2' && road3.fell === `fell at wave ${fell.wave}, restart level 2` && road3.fight?.text === 'Continue from level 2' && road3.fight.seen && road3.run?.seed === road1.run?.seed && road3.relics === held,
      `after the fall (${JSON.stringify(fell)}): "${road3.name}", "${road3.fell}", "${road3.fight?.text}"`);
    // Start over, and yes: a new run from level 1, wave 1, with the loadout only
    await press('[data-over]');
    await press('[data-yes]');
    await opening();
    const fresh = await fight();
    const saved = await p.evaluate(() => { const r = window.__lb.save.champions.paladin.runs.marches; return r ? { level: r.level, seed: r.seed, carry: r.carry } : null; });
    await p.close();
    want(fresh?.level === 1 && fresh.start === 1 && fresh.wave === 0 && fresh.held === LOADOUT.join() && fresh.seed !== road1.run?.seed && saved?.level === 1 && saved.carry === null && saved.seed === fresh.seed, `Start over: ${JSON.stringify(fresh)}, saved ${JSON.stringify(saved)}`);
    want(errs.length === 0, `errors: ${errs[0]}`);
    return { ok: bad.length === 0, detail: bad.length ? bad.join('; ') : `"${road0.fight?.text}" -> level 1 cleared -> "${road1.name}" flags ${road1.flags} (glow ${road1.glow}), relics [${held}], "${road1.fight?.text}" + "${road1.over?.text}"; map and back: the same; "${asked.ask}" -> kept; Continue: level ${two?.level} holding [${two?.held}] on the run's seed; "${road3.fell}"; Start over -> level ${fresh?.level}, wave ${fresh?.start}, holding [${fresh?.held}] on a new seed` };
  });
}

// ---------- #200: a Marches level cleared: pick 1 of 2 rares of its family, it joins the champion, and the road opens on level 2 ----------
for (const [w, h, touch] of [[1280, 720, false], [844, 390, true]]) {
  await check(`Marches: level 1 cleared -> pick 1 of 2 Steel rares (${touch ? 'tap' : 'key 2'}), kept by the champion, back to the road on level 2 (Flame), at ${w}x${h} (#200)`, async () => {
    const p = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`http://localhost:${PORT}/?debug`);
    await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
    const press = (sel) => (touch ? p.locator(sel).tap() : p.locator(sel).click());
    await press('[data-go="map"]');
    await press('.wm-realm.r-marches');
    await p.locator('.rr-panel').waitFor({ timeout: 3000 });
    await press('[data-fight]');
    await p.locator('[data-pick]').first().waitFor({ timeout: 5000 }); // the level's opening pick
    const opening = await p.evaluate(() => document.querySelector('[data-families]')?.textContent ?? '');
    await p.evaluate(() => { window.__lb.game.level.cleared = true; }); // as if wave 5's boss fell: the level ends once its spoils are taken
    await press('[data-pick="0"]');
    await p.locator('.rare-pick').waitFor({ timeout: 5000 });
    const pick = await p.evaluate(() => ({
      head: document.querySelector('.rare-pick .kit-head')?.textContent.trim(),
      cards: [...document.querySelectorAll('.rare-pick [data-pick]')].map((b) => { const r = b.getBoundingClientRect(); return { name: b.querySelector('h2').textContent, fam: b.querySelector('.fam').textContent, rarity: b.querySelector('.tag').textContent, inside: r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 && r.top >= -1 }; }),
    }));
    if (touch) await p.locator('.rare-pick [data-pick="1"]').tap();
    else await p.keyboard.press('2');
    await p.locator('[data-menu]').waitFor({ timeout: 3000 });
    const kept = await p.evaluate(() => { const s = window.__lb.save; const c = Object.values(s.champions).find((x) => x.world.marches); return { inv: c?.inventory ?? [], cleared: c?.world.marches ?? [] }; });
    const menu = (await p.locator('[data-menu]').textContent()).trim();
    const retry = (await p.locator('[data-retry]').textContent()).trim();
    await press('[data-menu]');
    await p.locator('.rr-panel').waitFor({ timeout: 3000 });
    const road = await p.evaluate(() => ({ name: document.querySelector('.rr-name').textContent, text: document.querySelector('.rr-panel').textContent.replace(/\s+/g, ' '), open: [...document.querySelectorAll('.rr-flag')].map((f) => !f.disabled) }));
    await p.close();
    const second = pick.cards[1]?.name;
    const ok = /Steel/.test(opening) && pick.head === 'The Marches · Level 1 cleared' && pick.cards.length === 2 && pick.cards.every((c) => /Steel/.test(c.fam) && /rare/.test(c.rarity) && c.inside)
      && pick.cards[0].name !== second && kept.inv.length === 1 && kept.cleared[0] === 1 && /Back to the map/.test(menu) && retry === 'Continue to level 2'
      && road.name === 'The Marches · Level 2' && road.open.slice(0, 3).join() === 'true,true,false' && /Flame relics featured/.test(road.text) && /Pick 1 of 2 Flame rares/.test(road.text) && errs.length === 0;
    return { ok, detail: `opening "${opening.trim()}"; "${pick.head}": ${pick.cards.map((c) => `${c.name} (${c.fam.trim()}, ${c.inside ? 'in view' : 'off screen'})`).join(' / ')}; took ${second} -> inventory [${kept.inv.join()}], cleared ${kept.cleared.join('/')}; "${retry}" / "${menu}" -> "${road.name}"${/Pick 1 of 2 Flame rares/.test(road.text) ? ', Flame pick next' : ''}${errs.length ? `; errors: ${errs[0]}` : ''}` };
  });
}

// ---------- #238: champions level up between levels, not during them ----------
// Map -> the Marches -> FIGHT: level 1 is played to its end by the bot (hard blows, so it is quick) and no level-up, ability or utility
// screen ever opens: the champion stays level 1 while the HUD counts the XP up. The clear banks that XP as champion XP (the results say
// so) and the champion is level 2. On the champion screen the Build tab shows 3 stat points and the Talents tab a point to spend: a
// talent is taken on the tree, the stat points go into Strength and Vitality (the Build tab's plus buttons, #241), nothing can be reset
// inside the realm run, and PLAY starts level 2 with all of it: level 2, the growth, +20 Strength, the talent, and the utility unlocked.
for (const [w, h, touch] of [[1280, 720, false], [844, 390, true]]) {
  await check(`champion levels: a level shows no level-up screen, its clear banks champion XP (level 2), and the points spent are in the next level, ${touch ? 'tap' : 'click'} at ${w}x${h} (#238)`, async () => {
    const p = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`http://localhost:${PORT}/?debug`);
    await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
    await p.evaluate(() => { const lb = window.__lb; lb.save.cards.splice(0, lb.save.cards.length, ...lb.cardIds); }); // every flash card seen: none stops the run
    const press = (sel) => (touch ? p.locator(sel).first().tap() : p.locator(sel).first().click());
    await press('[data-go="map"]');
    await press('.wm-realm.r-marches');
    await p.locator('.rr-panel').waitFor({ timeout: 3000 });
    await press('[data-fight]');
    await p.locator('[data-pick]').first().waitFor({ timeout: 5000 }); // the level's opening pick
    await press('[data-pick="0"]');
    // the first foes fall and the HUD counts their XP up, on real frames
    await p.evaluate(() => {
      const lb = window.__lb, g = lb.game;
      g.player.invulnerable = true;
      g.baseMods.damage *= 8; // hard blows: the level is over soon
      for (let i = 0; i < 6000 && lb.game === g && g.player.xp < 1; i++) lb.run(1, false, true); // #243: a level's extra foes share its XP, so one foe may pay under 1
    });
    await p.waitForFunction(() => window.__lb.state === 'playing' && /^\+[1-9]/.test(document.getElementById('h-xp-text')?.textContent ?? ''), null, { timeout: 5000 }).catch(() => {});
    const hud = await p.evaluate(() => ({ xp: document.getElementById('h-xp-text')?.textContent ?? '', level: document.getElementById('h-level')?.textContent ?? '' }));
    const played = await p.evaluate(() => {
      const lb = window.__lb, g = lb.game, id = g.player.cls.id;
      // a level-up, ability or utility screen (a relic offer or the quest board is not one)
      const levelScreen = () => /^(Level \d+|.*upgrade)/i.test(document.querySelector('.levelup h1')?.textContent.trim() ?? '') && !!document.querySelector('.levelup .sub') && /boon|upgrade/i.test(document.querySelector('.levelup .sub').textContent);
      let screens = 0, queued = 0, top = g.player.level;
      for (let i = 0; i < 40000 && lb.game === g && lb.state !== 'results'; i++) {
        if (lb.state === 'choice' && levelScreen()) screens++;
        queued = Math.max(queued, g.pendingLevelUps + g.pendingAbilityTiers.length + g.pendingUtilityTiers.length);
        top = Math.max(top, g.player.level);
        lb.run(1, false, true);
      }
      return { id, screens, queued, top, cleared: !!g.level?.cleared, collected: Math.round(g.player.xp), state: lb.state, wave: g.wave };
    });
    // the level's Steel rare first (#200), then the results with the champion's XP
    await p.locator('.rare-pick [data-pick]').first().waitFor({ timeout: 5000 }).catch(() => {});
    await press('.rare-pick [data-pick="0"]');
    await p.locator('[data-menu]').waitFor({ timeout: 3000 });
    const banked = await p.evaluate((id) => {
      const c = window.__lb.save.champions[id];
      return { line: document.querySelector('[data-champion-xp]')?.textContent.replace(/\s+/g, ' ').trim() ?? '', xp: c.xp, level: c.level, run: c.runs.marches?.level, str: c.runs.marches?.carry?.stats.str };
    }, played.id);
    await press('[data-menu]');
    await p.locator('.rr-panel').waitFor({ timeout: 3000 });
    await press('[data-loadout]');
    await p.locator('.champion-screen').waitFor({ timeout: 3000 });
    if (await p.locator('[data-tour-skip]').count()) await press('[data-tour-skip]'); // a first visit's tour
    else await p.keyboard.press('Escape').catch(() => {});
    await p.waitForTimeout(100);
    if (!(await p.locator('.champion-screen').count())) { await press('[data-go="champion"]').catch(() => {}); }
    await press('[data-cs="build"]');
    const build = await p.evaluate(() => document.querySelector('.cs-build')?.textContent.replace(/\s+/g, ' ').trim() ?? '');
    for (const s of ['strength', 'strength', 'vitality']) await press(`[data-stat-add="${s}"]`); // #241: the Build tab's own plus buttons
    const spent = await p.evaluate(() => ({ left: document.querySelector('[data-stat-points]').textContent, plus: [...document.querySelectorAll('[data-stat-add]')].every((b) => b.disabled), reset: !!document.querySelector('[data-reset-build]') })); // three points, no fourth, no reset inside the run
    await press('[data-cs="talents"]');
    const before = await p.evaluate(() => ({ button: document.querySelector('[data-spend-talents]')?.textContent.trim() ?? '', reset: !!document.querySelector('[data-reset-points]') }));
    await press('[data-spend-talents]');
    await p.locator('.kit-screen.talents').waitFor({ timeout: 3000 });
    const tree = await p.evaluate(() => ({ sub: document.querySelector('.kit-screen.talents')?.textContent.includes('1 point to spend'), open: document.querySelectorAll('.talent.open').length }));
    await press('.talent.open');
    const after = await p.evaluate(() => document.querySelectorAll('.talent.open').length); // the point is gone: nothing else can be taken
    await press('.kit-screen.talents [data-back]');
    await p.locator('.champion-screen').waitFor({ timeout: 3000 });
    const tab = await p.evaluate((id) => ({ taken: document.querySelectorAll('.cs-plan li').length, reset: !!document.querySelector('[data-reset-points]'), saved: window.__lb.save.champions[id].talents.length, points: window.__lb.save.champions[id].points }), played.id);
    await press('[data-play]');
    await p.waitForFunction((seed) => !!window.__lb.game && window.__lb.game.level?.level === 2, null, { timeout: 5000 }).catch(() => {});
    const next = await p.evaluate(() => {
      const g = window.__lb.game, pl = g?.player;
      return g && { level: g.level?.level, wave: g.startWave, plevel: pl.level, str: pl.stats.str, grow: pl.cls.growth.str, hp: pl.stats.hp, talents: pl.talents.length, queued: g.pendingLevelUps + g.pendingAbilityTiers.length + g.pendingUtilityTiers.length, utility: !document.querySelector('#h-ut-slot')?.classList.contains('locked'), points: g.level?.champion.points };
    });
    await p.close();
    const ok = hud.level === '1' && /^\+[1-9]\d* XP$/.test(hud.xp) && played.cleared && played.screens === 0 && played.queued === 0 && played.top === 1 && played.collected > 0
      && banked.xp === played.collected && banked.level === 2 && new RegExp(`\\+${banked.xp} XP · level 2`).test(banked.line) && /level up/.test(banked.line) && banked.run === 2
      && /Level 2/.test(build) && /3 stat points to spend/.test(build) && spent.left === '0' && spent.plus && !spent.reset
      && /Spend points \(1\)/.test(before.button) && !before.reset && tree.sub && tree.open > 0 && after === 0 && tab.taken === 1 && tab.saved === 1 && !tab.reset && tab.points.strength === 2 && tab.points.vitality === 1
      && next?.level === 2 && next.wave === 7 && next.plevel === 2 && Math.abs(next.str - (banked.str + 5 * next.grow + 20)) < 0.01 && next.talents === 1 && next.queued === 0 && next.utility && next.points.strength === 2 && errs.length === 0;
    return { ok, detail: `level 1: ${played.cleared ? 'cleared' : `NOT cleared (wave ${played.wave}, ${played.state})`}, ${played.screens} level-up screens, ${played.queued} queued, champion level ${played.top} all level, HUD "level ${hud.level}, ${hud.xp}"; banked ${banked.xp} XP of ${played.collected} -> level ${banked.level} ("${banked.line}"); Build tab "${build.slice(0, 70)}"; three points spent: ${JSON.stringify(spent)}; talents "${before.button}"${before.reset || tab.reset ? ', RESET OFFERED IN A RUN' : ''}, ${tab.taken} taken; level ${next?.level}: champion level ${next?.plevel}, Strength ${next?.str} (checkpoint ${banked.str} + growth + 20), ${next?.talents} talent, utility ${next?.utility ? 'unlocked' : 'LOCKED'}, ${next?.queued} queued${errs.length ? `; errors: ${errs[0]}` : ''}` };
  });
}

// ---------- #241: the level-cleared screen spends the points, and a level starts with no build screen ----------
// Map -> the Marches -> FIGHT: the level opens on its opening relic pick (then the Act's quest board: the level's own, no build screen,
// and nothing queued for the champion). The level is cleared with a level's worth of
// XP collected (as if its foes and its boss fell). After its rare pick the "Level cleared" screen shows the XP, the level up (3 stat
// points, a talent point) and the build: a point goes into Strength and one into Vitality, the Vitality point comes back out with its
// minus, the ability's first upgrade is bought with the two points left (its two cards are dim while only one point is free), and a
// talent is taken on the tree, which comes back to this screen. "Continue to level 2" starts level 2 (its opening pick and quest
// board, no build screen) with all of it: champion level 2, the Strength point on top of the growth, the upgrade, the talent.
for (const [w, h, touch] of [[1280, 720, false], [844, 390, true]]) {
  await check(`level cleared: its screen shows the XP and the level up, spends stat points (plus, minus), buys an ability upgrade and takes a talent, and Continue starts level 2 with no build screen and all of it in, ${touch ? 'tap' : 'click'} at ${w}x${h} (#241)`, async () => {
    const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`http://localhost:${PORT}/?debug`);
    await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
    await p.evaluate(() => { const lb = window.__lb; lb.save.cards.splice(0, lb.save.cards.length, ...lb.cardIds); }); // every flash card seen: none stops the run
    const press = (sel) => (touch ? p.locator(sel).first().tap() : p.locator(sel).first().click());
    const bad = [];
    const want = (cond, what) => { if (!cond) bad.push(what); return cond; };
    // what stands before the fight: the screen that is up, anything queued, and the champion as the level holds it
    const entering = () => p.evaluate(() => {
      const lb = window.__lb, g = lb.game, pl = g.player;
      return {
        state: lb.state, head: document.querySelector('#overlay .kit-head')?.textContent.trim() ?? '', picks: document.querySelectorAll('#overlay [data-pick]').length,
        queued: g.pendingLevelUps + g.pendingAbilityTiers.length + g.pendingUtilityTiers.length, level: g.level?.level, wave: g.wave, start: g.startWave,
        id: pl.cls.id, plevel: pl.level, str: pl.stats.str, hp: pl.stats.hp, grow: pl.cls.growth.str, upgrades: pl.upgrades.join(), talents: pl.talents.length, points: g.level?.champion.points,
      };
    });
    const opening = () => p.waitForFunction(() => window.__lb.state === 'choice' && !!document.querySelector('#overlay [data-pick]'), null, { timeout: 5000 });
    await press('[data-go="map"]');
    await press('.wm-realm.r-marches');
    await p.locator('.rr-panel').waitFor({ timeout: 3000 });
    await press('[data-fight]');
    await opening();
    const one = await entering();
    want(one.head === 'Your opening pick' && one.picks === 3 && one.queued === 0 && one.level === 1 && one.start === 1 && one.plevel === 1, `FIGHT opens level 1 on ${JSON.stringify(one)}`);
    await p.evaluate(() => { const g = window.__lb.game; g.player.xp = 200; g.level.cleared = true; }); // as if its foes and its boss fell: a level's worth of XP (a champion level costs 180, #243), and the level ends once its spoils are taken
    await press('[data-pick="0"]');
    await p.locator('.rare-pick').waitFor({ timeout: 5000 });
    await press('.rare-pick [data-pick="0"]');
    await p.locator('.level-cleared').waitFor({ timeout: 3000 });
    // the screen: its lines, its two buttons, the build panel; all of it on screen
    const look = () => p.evaluate(() => {
      const root = document.querySelector('.level-cleared'), text = (sel) => root.querySelector(sel)?.textContent.replace(/\s+/g, ' ').trim() ?? '';
      const box = root.getBoundingClientRect(), go = root.querySelector('[data-retry]'), gb = go?.getBoundingClientRect();
      const stat = (id) => { const r = root.querySelector(`.bp-stat[data-stat="${id}"]`); return { n: r.querySelector('[data-stat-n]').textContent, gives: r.querySelector('[data-stat-gives]').textContent, total: r.querySelector('[data-stat-total]').textContent, plus: !r.querySelector('[data-stat-add]').disabled, minus: !r.querySelector('[data-stat-take]').disabled }; };
      return {
        state: window.__lb.state, head: text('.kit-head'), sub: text('.sub'), xp: text('[data-champion-xp]'), up: text('[data-level-up]'), points: text('[data-stat-points]'),
        go: go?.textContent.trim() ?? '', goMain: !!go && go.classList.contains('go') && go.classList.contains('big'), map: text('[data-menu]'), mains: root.querySelectorAll('.kit-btn.big').length,
        fits: box.top >= -1 && box.left >= -1 && box.bottom <= innerHeight + 1 && box.right <= innerWidth + 1 && !!gb && gb.bottom <= innerHeight + 1 && document.elementFromPoint(gb.left + gb.width / 2, gb.top + gb.height / 2)?.closest('[data-retry]') === go,
        strength: stat('strength'), vitality: stat('vitality'),
        options: [...root.querySelectorAll('[data-buy-ability]')].map((b) => ({ id: b.dataset.buyAbility, name: b.querySelector('b').textContent, on: !b.disabled })),
        bought: [...root.querySelectorAll('[data-tier="ability"] .bp-bought li b')].map((b) => b.textContent).join(),
        utility: root.querySelectorAll('[data-buy-utility]').length, talents: text('[data-spend-talents]'),
        small: [...root.querySelectorAll('*')].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && e.getClientRects().length && parseFloat(getComputedStyle(e).fontSize) < (innerHeight >= 600 ? 14 : 11)).map((e) => `${e.className || e.tagName}:${getComputedStyle(e).fontSize}`).join(),
      };
    });
    const saved = () => p.evaluate((id) => { const c = window.__lb.save.champions[id]; return { level: c.level, xp: c.xp, points: c.points, upgrades: c.upgrades.join(), talents: c.talents.length, run: c.runs.marches?.level, str: c.runs.marches?.carry?.stats.str }; }, one.id);
    const first = await look();
    const champ0 = await saved();
    want(first.state === 'results' && first.head === 'Level cleared' && /The Marches · Level 1/.test(first.sub), `the screen: "${first.head}", "${first.sub}" (${first.state})`);
    want(champ0.level === 2 && champ0.xp === 200 && champ0.run === 2 && /^Champion XP\+200 XP · level 2/.test(first.xp) && /level up/.test(first.xp) && /Level 1 → 2/.test(first.up) && /\+3 stat points · \+1 talent point/.test(first.up), `XP "${first.xp}", level up "${first.up}", saved ${JSON.stringify(champ0)}`);
    want(first.go === 'Continue to level 2' && first.goMain && first.mains === 1 && first.map === 'Back to the map' && first.fits, `buttons "${first.go}" (${first.goMain ? 'green, big' : 'NOT the main button'}, ${first.mains} big) / "${first.map}", ${first.fits ? 'on screen' : 'OFF SCREEN'}`);
    want(first.points === '3' && first.strength.n === '0' && first.strength.plus && !first.strength.minus && /^\+\d+ .+ a point$/.test(first.strength.gives) && first.options.length === 2 && first.options.every((o) => o.on) && first.utility === 2 && first.talents === 'Talents (1 to spend)' && first.small === '',
      `the build to start: ${JSON.stringify({ points: first.points, strength: first.strength, options: first.options, utility: first.utility, talents: first.talents, small: first.small })}`);
    // a point into Strength and one into Vitality: one left, so the upgrades (two points) go dim; the minus gives the Vitality point back
    await press('[data-stat-add="strength"]');
    await press('[data-stat-add="vitality"]');
    const two = await look();
    await press('[data-stat-take="vitality"]');
    const back = await look();
    want(two.points === '1' && two.strength.n === '1' && two.strength.minus && two.vitality.n === '1' && two.vitality.total !== '' && two.options.every((o) => !o.on), `two points in: ${JSON.stringify({ points: two.points, strength: two.strength, vitality: two.vitality, options: two.options.map((o) => o.on) })}`);
    want(back.points === '2' && back.vitality.n === '0' && !back.vitality.minus && back.vitality.total === '' && back.strength.n === '1' && back.options.every((o) => o.on), `the minus: ${JSON.stringify({ points: back.points, vitality: back.vitality, options: back.options.map((o) => o.on) })}`);
    // the ability's first upgrade for the two points left
    const pick = back.options[1];
    await press(`[data-buy-ability="${pick?.id}"]`);
    const bought = await look();
    want(bought.points === '0' && bought.bought === pick?.name && !bought.strength.plus && bought.strength.minus && bought.options.length === 2 && bought.options.every((o) => !o.on) && !bought.options.some((o) => o.id === pick?.id), `bought ${pick?.name}: ${JSON.stringify({ points: bought.points, bought: bought.bought, next: bought.options })}`);
    // the talent point, on the tree; its back button comes back here with the build as it was left
    await press('[data-spend-talents]');
    await p.locator('.kit-screen.talents').waitFor({ timeout: 3000 });
    await press('.talent.open');
    await press('.kit-screen.talents [data-back]');
    await p.locator('.level-cleared').waitFor({ timeout: 3000 });
    const after = await look();
    const champ1 = await saved();
    const gives = Number(/\d+/.exec(after.strength.gives)?.[0]);
    want(after.talents === 'Talent tree' && after.points === '0' && after.strength.n === '1' && after.bought === pick?.name && after.go === 'Continue to level 2', `back from the tree: ${JSON.stringify({ talents: after.talents, points: after.points, strength: after.strength.n, bought: after.bought })}`);
    want(champ1.points.strength === 1 && !champ1.points.vitality && champ1.upgrades === pick?.id && champ1.talents === 1, `saved ${JSON.stringify(champ1)}`);
    // Continue: straight into level 2, its opening pick the only screen, then the fight with everything spent
    await press('[data-retry]');
    await opening();
    const next = await entering();
    await press('[data-pick="0"]');
    const boards = await intoFight(p, press);
    const fight = await entering();
    await p.close();
    want(next.head === 'Your opening pick' && next.queued === 0 && next.level === 2 && next.wave === next.start - 1, `Continue opens level 2 on ${JSON.stringify({ head: next.head, queued: next.queued, level: next.level, wave: next.wave, start: next.start })}`);
    want(fight.state === 'playing' && fight.queued === 0 && fight.level === 2 && boards.every((b) => /quest board/i.test(b)), `after its opening pick: ${fight.state}, ${fight.queued} queued, screens [${boards.join(' | ')}]`);
    want(next.plevel === 2 && Math.abs(next.str - (champ0.str + 5 * next.grow + gives)) < 0.01 && next.upgrades === pick?.id && next.talents === 1 && next.points?.strength === 1 && !next.points?.vitality,
      `level 2's champion: level ${next.plevel}, Strength ${next.str} (checkpoint ${champ0.str} + growth ${5 * next.grow} + ${gives}), upgrades [${next.upgrades}], ${next.talents} talent, points ${JSON.stringify(next.points)}`);
    want(errs.length === 0, `errors: ${errs[0]}`);
    return { ok: bad.length === 0, detail: bad.length ? bad.join('; ') : `FIGHT -> "${one.head}", nothing queued; "${first.head}": "${first.xp}", "${first.up}"; ${first.points} points: +Strength +Vitality -> ${two.points} left, upgrades dim; -Vitality -> ${back.points}; bought ${pick?.name} -> ${bought.points}; a talent on the tree -> "${after.talents}"; "${first.go}" -> "${next.head}" of level ${next.level}${boards.length ? ` and ${boards.length} quest board` : ''}, no build screen, then the fight: champion level ${next.plevel}, Strength ${next.str} = ${champ0.str} + growth + ${gives}, [${next.upgrades}], ${next.talents} talent` };
  });
}

// ---------- #241: the champion screen's Build tab spends the same points, with the free reset, and PLAY goes straight into the fight ----------
// A level-3 champion outside a run (6 stat points). Build: two points into Focus and one into Vitality, the minus takes a Focus point
// back, the utility's first upgrade is bought; Reset points gives all six back (and the talent taken on the Talents tab). Two points
// into Vitality again, and PLAY: the opening relic pick (and Act I's quest board: the Act's quests, no build screen), then the fight, at
// champion level 3 with the HP of those two points.
for (const [w, h, touch] of [[1280, 720, false], [844, 390, true]]) {
  await check(`champion screen: the Build tab spends stat points (plus, minus), buys a utility upgrade and resets for free, and PLAY starts the level with no build screen and the points in, ${touch ? 'tap' : 'click'} at ${w}x${h} (#241)`, async () => {
    const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`http://localhost:${PORT}/?debug`);
    await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
    const press = (sel) => (touch ? p.locator(sel).first().tap() : p.locator(sel).first().click());
    const bad = [];
    const want = (cond, what) => { if (!cond) bad.push(what); return cond; };
    await p.evaluate(() => {
      const lb = window.__lb;
      lb.save.cards.splice(0, lb.save.cards.length, ...lb.cardIds);
      lb.save.champions = { paladin: { name: 'Hild', inventory: [], loadouts: {}, ...lb.build.grown({}), xp: 540, level: 3, world: {}, signature: false, lastBastion: false, runs: {} } };
    });
    await press('[data-go="champion"]');
    await p.locator('.champion-screen').waitFor({ timeout: 3000 });
    await skipTour(p, touch);
    await press('[data-cs="build"]');
    const look = () => p.evaluate(() => {
      const root = document.querySelector('.cs-build'), c = window.__lb.save.champions.paladin;
      const stat = (id) => { const r = root.querySelector(`.bp-stat[data-stat="${id}"]`); return { n: r.querySelector('[data-stat-n]').textContent, gives: r.querySelector('[data-stat-gives]').textContent, total: r.querySelector('[data-stat-total]').textContent, plus: !r.querySelector('[data-stat-add]').disabled, minus: !r.querySelector('[data-stat-take]').disabled }; };
      const play = document.querySelector('[data-play]'), pb = play.getBoundingClientRect();
      return {
        shown: root.getClientRects().length > 0, tab: document.querySelector('[data-cs].on')?.dataset.cs, level: root.querySelector('.cs-level')?.textContent.replace(/\s+/g, ' ').trim() ?? '', points: root.querySelector('[data-stat-points]').textContent,
        focus: stat('focus'), vitality: stat('vitality'),
        ability: [...root.querySelectorAll('[data-buy-ability]')].map((b) => !b.disabled), utility: [...root.querySelectorAll('[data-buy-utility]')].map((b) => ({ id: b.dataset.buyUtility, name: b.querySelector('b').textContent, on: !b.disabled })),
        bought: [...root.querySelectorAll('[data-tier="utility"] .bp-bought li b')].map((b) => b.textContent).join(),
        reset: !!root.querySelector('[data-reset-build]'), plan: document.querySelectorAll('.cs-plan li').length,
        play: pb.bottom <= innerHeight + 1 && document.elementFromPoint(pb.left + pb.width / 2, pb.top + pb.height / 2)?.closest('[data-play]') === play,
        saved: { points: c.points, upgrades: c.upgrades.length, utility: c.utilityUpgrades.join(), talents: c.talents.length },
      };
    });
    const start = await look();
    want(start.shown && start.tab === 'build' && /^Level 3/.test(start.level) && start.points === '6' && start.focus.plus && !start.focus.minus && start.ability.length === 2 && start.ability.every(Boolean) && start.utility.length === 2 && start.utility.every((o) => o.on) && !start.reset && start.play,
      `the Build tab: ${JSON.stringify({ level: start.level, points: start.points, focus: start.focus, ability: start.ability, utility: start.utility, reset: start.reset, play: start.play })}`);
    await press('[data-stat-add="focus"]');
    await press('[data-stat-add="focus"]');
    await press('[data-stat-add="vitality"]');
    const three = await look();
    await press('[data-stat-take="focus"]');
    const taken = await look();
    want(three.points === '3' && three.focus.n === '2' && three.focus.total !== '' && three.vitality.n === '1' && three.reset && three.saved.points.focus === 2, `three points in: ${JSON.stringify({ points: three.points, focus: three.focus, vitality: three.vitality, reset: three.reset, saved: three.saved })}`);
    want(taken.points === '4' && taken.focus.n === '1' && taken.saved.points.focus === 1, `the minus: ${JSON.stringify({ points: taken.points, focus: taken.focus, saved: taken.saved })}`);
    const pick = taken.utility[0];
    await press(`[data-buy-utility="${pick?.id}"]`);
    const bought = await look();
    want(bought.points === '2' && bought.bought === pick?.name && bought.saved.utility === pick?.id && bought.utility.length === 0, `bought ${pick?.name}: ${JSON.stringify({ points: bought.points, bought: bought.bought, saved: bought.saved, next: bought.utility })}`);
    // a talent on the Talents tab's tree, then the Build tab's reset: every point back, the talent too, and the screen stays on Build
    await press('[data-cs="talents"]');
    await press('[data-spend-talents]');
    await p.locator('.kit-screen.talents').waitFor({ timeout: 3000 });
    await press('.talent.open');
    await press('.kit-screen.talents [data-back]');
    await p.locator('.champion-screen').waitFor({ timeout: 3000 });
    await press('[data-cs="build"]');
    const planned = await look();
    await press('[data-reset-build]');
    await p.waitForFunction(() => document.querySelector('.cs-build [data-stat-points]')?.textContent === '6', null, { timeout: 3000 }).catch(() => {});
    const reset = await look();
    want(planned.plan === 1 && planned.saved.talents === 1 && planned.reset, `a talent taken: ${JSON.stringify({ plan: planned.plan, saved: planned.saved, reset: planned.reset })}`);
    want(reset.tab === 'build' && reset.shown && reset.points === '6' && reset.focus.n === '0' && reset.vitality.n === '0' && reset.bought === '' && reset.utility.length === 2 && !reset.reset && reset.plan === 0 && Object.keys(reset.saved.points).length === 0 && reset.saved.utility === '' && reset.saved.talents === 0,
      `Reset points: ${JSON.stringify({ tab: reset.tab, points: reset.points, focus: reset.focus.n, vitality: reset.vitality.n, bought: reset.bought, reset: reset.reset, plan: reset.plan, saved: reset.saved })}`);
    // two points into Vitality, and PLAY: the opening pick is the only screen before the fight
    await press('[data-stat-add="vitality"]');
    await press('[data-stat-add="vitality"]');
    const vit = await look();
    await press('[data-play]');
    await p.waitForFunction(() => window.__lb.state === 'choice' && !!document.querySelector('#overlay [data-pick]'), null, { timeout: 5000 });
    const entering = () => p.evaluate(() => {
      const lb = window.__lb, g = lb.game, pl = g.player;
      return { state: lb.state, head: document.querySelector('#overlay .kit-head')?.textContent.trim() ?? '', queued: g.pendingLevelUps + g.pendingAbilityTiers.length + g.pendingUtilityTiers.length, level: g.level?.level, start: g.startWave, plevel: pl.level, hp: pl.stats.hp, base: pl.cls.base.hp, grow: pl.cls.growth.hp, points: g.level?.champion.points, utility: pl.utilityUpgrades.length };
    });
    const open = await entering();
    await press('[data-pick="0"]');
    const boards = await intoFight(p, press);
    const fight = await entering();
    await p.close();
    const gives = Number(/\d+/.exec(vit.vitality.gives)?.[0]);
    want(vit.points === '4' && vit.vitality.n === '2' && vit.vitality.total === `+${2 * gives} ${vit.vitality.gives.replace(/^\+\d+ | a point$/g, '')}`, `two into Vitality: ${JSON.stringify({ points: vit.points, vitality: vit.vitality })}`);
    want(open.head === 'Your opening pick' && open.queued === 0 && open.level === 1 && open.start === 1 && fight.state === 'playing' && fight.queued === 0 && boards.every((b) => /quest board/i.test(b)), `PLAY: "${open.head}" (${open.queued} queued, level ${open.level}, wave ${open.start}), then [${boards.join(' | ')}], then ${fight.state}`);
    want(open.plevel === 3 && open.points?.vitality === 2 && open.utility === 0 && Math.abs(open.hp - (open.base + 10 * open.grow + 2 * gives)) < 0.01, `the fight's champion: level ${open.plevel}, HP ${open.hp} (base ${open.base} + growth ${10 * open.grow} + ${2 * gives}), points ${JSON.stringify(open.points)}, ${open.utility} utility upgrades`);
    want(errs.length === 0, `errors: ${errs[0]}`);
    return { ok: bad.length === 0, detail: bad.length ? bad.join('; ') : `Build tab: "${start.level}"; +Focus +Focus +Vitality -> ${three.points} left; -Focus -> ${taken.points}; bought ${pick?.name} -> ${bought.points}; a talent; Reset points -> ${reset.points} points, ${reset.plan} talents, still on Build; +2 Vitality ("${vit.vitality.total}") -> PLAY -> "${open.head}"${boards.length ? ` and ${boards.length} quest board` : ''}, no build screen, then the fight at champion level ${open.plevel} with HP ${open.hp}` };
  });
}

// ---------- #252: the Build tab names each row for the stat that class's point really gives ----------
// The Angel's first row reads Intelligence (its point gives +Intelligence), the Archer's Dexterity, then Attack Speed, its secondary stat and HP:
// every row's name is the end of its own "a point gives" line.
await check('champion screen: the Build tab names every row for the stat a point gives, the Angel and the Archer (#252)', async () => {
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://localhost:${PORT}/?debug`);
  await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
  const bad = [], seen = {};
  const want = { angel: ['Intelligence', 'Attack Speed', 'Grace', 'HP'], archer: ['Dexterity', 'Attack Speed', null, 'HP'] };
  await p.evaluate(() => {
    const lb = window.__lb;
    lb.save.cards.splice(0, lb.save.cards.length, ...lb.cardIds);
    lb.save.champions = Object.fromEntries(['angel', 'archer'].map((c) => [c, { name: c, inventory: [], loadouts: {}, ...lb.build.grown({}), xp: 540, level: 3, world: {}, signature: false, lastBastion: false, runs: {} }]));
  });
  await p.click('[data-go="champion"]');
  await p.locator('.champion-screen').waitFor({ timeout: 3000 });
  await skipTour(p, false);
  for (const cls of ['angel', 'archer']) {
    for (let i = 0; i < 6 && !(await p.locator('.cs-pick').first().textContent()).toLowerCase().includes(cls); i++) await p.click('[data-champ="1"]'); // the arrows walk the roster (they are named for their class here)
    await p.click('[data-cs="build"]');
    const rows = await p.evaluate(() => [...document.querySelectorAll('.cs-build .bp-stat')].map((r) => ({ name: r.querySelector('.bp-name b').textContent, gives: r.querySelector('[data-stat-gives]').textContent })));
    seen[cls] = rows;
    if (rows.length !== 4) { bad.push(`${cls}: ${rows.length} rows`); continue; }
    rows.forEach((r, i) => {
      if (!r.gives.endsWith(` ${r.name} a point`)) bad.push(`${cls} row ${i}: named "${r.name}" but "${r.gives}"`);
      if (want[cls][i] && r.name !== want[cls][i]) bad.push(`${cls} row ${i}: "${r.name}", wanted "${want[cls][i]}"`);
    });
    await p.screenshot({ path: `${process.env.TEMP ?? '.'}/lb252-${cls}.png` });
  }
  if (errs.length) bad.push(`errors: ${errs[0]}`);
  await p.close();
  return { ok: bad.length === 0, detail: bad.length ? bad.join('; ') : `Angel ${seen.angel.map((r) => r.name).join(' / ')}; Archer ${seen.archer.map((r) => r.name).join(' / ')}` };
});

// ---------- #212: the Iron Hold's knights: map -> the Iron Hold -> level 3's panel names the Iron Knight -> level 2 -> FIGHT; he brings his own flash card,
// "Got it" closes it, and in the fight every blow breaks one of his six plates with a clang until he stands bare in his mail ----------
await check('Iron Hold: level 3 names the Iron Knight, level 2 fields him, his flash card shows, blows break his plates one by one and he turns bare (#212)', async () => {
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://localhost:${PORT}/?debug`);
  await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
  await p.evaluate((run) => {
    const champ = (name) => ({ name, inventory: [], loadouts: {}, ...window.__lb.build.grown({ marches: [7], ironHold: [2] }), world: { marches: [7], ironHold: [2] }, signature: true, lastBastion: false, runs: { ironHold: run } });
    const lb = window.__lb;
    lb.save.champions = Object.fromEntries(['paladin', 'viking', 'angel', 'necromancer', 'archer'].map((c) => [c, champ(c)])); // the Marches crowned, Iron Hold levels 1-2 cleared, its realm run at level 2 (#237)
    lb.save.cards = lb.cardIds.filter((id) => id !== 'ironKnight'); // every other card already seen, so his is the one that shows
  }, runAt(2));
  await p.click('[data-go="map"]');
  await p.click('.wm-realm.r-ironHold');
  await p.locator('.rr-panel').waitFor({ timeout: 3000 });
  await p.click('.rr-flag.l-3'); // the first level whose featured foes (at most three) reach the knights' squads
  await p.waitForTimeout(100);
  const panel = await p.evaluate(() => ({ name: document.querySelector('.rr-name')?.textContent, text: document.querySelector('.rr-panel').textContent.replace(/\s+/g, ' ') }));
  await p.click('.rr-flag.l-2'); // a shorter level with knights from its first wave: the fight
  await p.waitForTimeout(100);
  await p.click('[data-fight]');
  await p.waitForFunction(() => window.__lb.state !== 'menu' && !!window.__lb.game, null, { timeout: 5000 }).catch(() => {});
  // the bot plays the level (the real choice screens answered) until his flash card opens
  const card = await p.evaluate(() => {
    const lb = window.__lb;
    const clangs = { n: 0 };
    if (lb.view) {
      const real = lb.view.sfx;
      lb.view.sfx = (n) => ((n === 'clang' && clangs.n++), real(n));
    }
    window.__clangs = clangs;
    lb.game.player.invulnerable = true;
    for (let i = 0; i < 40000 && !document.querySelector('[data-card]') && lb.game && lb.state !== 'results'; i++) lb.run(1, false, true);
    const c = document.querySelector('#overlay > .kit-frame.flash-card[data-card]');
    const g = lb.game;
    // the run waits under the card: a known state. Take the knight the card is about (or any whose plates are whole), read his plates now, and from
    // here on log every blow that reaches them, the ones the real frames land after "Got it" too: each blow writes his plates, then his HP
    const knight = [lb.spotlight, ...(g?.enemies ?? [])].find((e) => e && e.def.id === 'ironKnight' && !e.dead);
    if (knight) {
      knight.armorHp = knight.armorMax; // a known start: the bot may have struck him before his card opened, so his plates are made whole
      // four times his HP, so a champion whose opening pick hits hard still lands light blows (one plate each); heavy blows are
      // still judged by the rule below, against his (new) max HP
      knight.maxHp *= 4;
      knight.hp = knight.maxHp;
      const log = { start: knight.armorHp, blows: [] };
      let plates = knight.armorHp, hp = knight.hp, pending = null;
      Object.defineProperty(knight, 'armorHp', { configurable: true, get: () => plates, set: (v) => { pending = { from: plates, to: v }; plates = v; } });
      Object.defineProperty(knight, 'hp', { configurable: true, get: () => hp, set: (v) => {
        if (pending) log.blows.push({ ...pending, dealt: hp - v, killed: v <= knight.hpFloor, maxHp: knight.maxHp });
        pending = null;
        hp = v;
      } });
      window.__knight = { knight, log };
    }
    return { id: c?.dataset.card, title: c?.querySelector('.kit-parch h2')?.textContent, text: c?.querySelector('.kit-parch p')?.textContent, realm: g?.level?.realm, level: g?.level?.level, plain: g?.enemies.filter((e) => e.def.id === 'knight').length, knights: (g?.enemies ?? []).filter((e) => e.def.id === 'ironKnight').map((e) => `${e.armorHp}/${e.armorMax}${e.dead ? ' dead' : ''}`).join(' '), spot: !!lb.spotlight, state: lb.state };
  });
  if (card.id) await p.click('[data-leave]');
  // "Got it" closes the card and the run plays on: wait for that state, not a fixed time
  await p.waitForFunction(() => !document.querySelector('[data-card]') && window.__lb.state === 'playing', null, { timeout: 10000 }).catch(() => {});
  const fight = await p.evaluate(async () => {
    const lb = window.__lb, g = lb.game;
    const closed = !document.querySelector('[data-card]') && lb.state === 'playing';
    // follow that Iron Knight through the fight: his plates blow by blow, his sprite at the end
    if (!window.__knight) return { closed, found: false };
    const { knight, log } = window.__knight, max = knight.armorMax;
    // the champion stands his ground beside him and trades plain blows (no ability: one big cast may take every plate at once)
    for (let i = 0; i < 20000 && !knight.dead && knight.armorHp > 0 && lb.game === g; i++) {
      g.player.x = knight.x - 40;
      g.player.y = knight.y;
      lb.run(1, false, false);
    }
    // a blow's plates: one, plus one per full 20% of his max HP it carried (config/damage.ts PLATES: its HP damage is what the 75% the plates
    // dull leaves, so 4x that is the blow); a tick (burn, bleed) breaks none. The killing blow's HP stops at 0, so it is not judged
    const blows = log.blows.filter((b) => b.to < b.from).map((b) => ({ ...b, want: b.killed ? b.from - b.to : Math.min(b.from, 1 + Math.floor((4 * b.dealt) / (0.2 * b.maxHp) + 1e-9)) }));
    const steps = [log.start, ...blows.map((b) => b.to)];
    return { closed, found: true, start: log.start, max, steps, blows: blows.map((b) => `${b.from - b.to}${b.want !== b.from - b.to ? `(want ${b.want})` : ''}`), ruled: blows.every((b) => b.want === b.from - b.to), single: blows.filter((b) => b.from - b.to === 1).length, ticks: log.blows.length - blows.length, bare: knight.def.sprite, broken: knight.armorHp === 0, dead: knight.dead, clangs: window.__clangs.n };
  });
  await p.close();
  // from six whole plates to none, blow by blow: each blow takes the plates the rule says (a heavy one may take two), most take exactly one
  const oneByOne = fight.found && fight.ruled && fight.steps.slice(1).every((v, i) => v < fight.steps[i]) && fight.steps.length >= 4 && fight.single >= 2;
  const ok = panel.name === 'The Iron Hold · Level 3' && /Iron Knight/.test(panel.text) && !/Armored Knight/.test(panel.text)
    && card.realm === 'ironHold' && card.level === 2 && card.id === 'ironKnight' && card.title === 'Iron Knight' && /Each hit breaks one/.test(card.text ?? '') && card.plain === 0
    && fight.closed && fight.found && fight.start === 6 && fight.max === 6 && oneByOne && fight.broken && fight.bare === 'ironKnightBare' && fight.clangs > 0 && errs.length === 0;
  return { ok, detail: `panel "${panel.name}" ${/Iron Knight/.test(panel.text) ? 'names the Iron Knight' : 'NO Iron Knight'}; run ${card.realm} ${card.level}, card ${card.id ?? 'NONE'} "${card.title ?? ''}", plain knights ${card.plain}; closed ${fight.closed}; ${fight.found ? `plates ${fight.steps.join('>')} of ${fight.max} (per blow ${fight.blows.join(',')}; ${fight.ticks} ticks), sprite ${fight.bare}, ${fight.clangs} clangs${fight.dead ? ', killed' : ''}` : `no Iron Knight on the field (knights ${card.knights || 'none'}, spotlight ${card.spot}, state ${card.state})`}${errs.length ? `; errors: ${errs[0]}` : ''}` };
});

// ---------- #211: the Iron Hold's forge presses: map -> the Iron Hold -> level 1 -> FIGHT. The bot plays until a press marks the slabs round the
// champion (a warning sound, the slabs bracketed and the ram drawn over them); standing still, the ram slams him with its own sound and a foe
// on a marked slab is hurt too; at the next marking the champion steps off the line with the keyboard and the slam misses him ----------
await check('Iron Hold: forge presses mark the slabs round you and lower a ram; stand still and it slams you and the foe beside you, step aside and it misses (#211)', async () => {
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://localhost:${PORT}/?debug`);
  await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
  await p.evaluate(() => {
    const champ = (name) => ({ name, inventory: [], loadouts: {}, ...window.__lb.build.grown({ marches: [7], ironHold: [2] }), world: { marches: [7], ironHold: [2] }, signature: true, lastBastion: false, runs: {} });
    const lb = window.__lb;
    lb.save.champions = Object.fromEntries(['paladin', 'viking', 'angel', 'necromancer', 'archer'].map((c) => [c, champ(c)]));
    lb.save.cards = [...lb.cardIds]; // every flash card seen: nothing stops the fight
  });
  await p.click('[data-go="map"]');
  await p.click('.wm-realm.r-ironHold');
  await p.locator('.rr-panel').waitFor({ timeout: 3000 });
  await p.click('.rr-flag.l-1');
  await p.waitForTimeout(100);
  await p.click('[data-fight]');
  await p.waitForFunction(() => window.__lb.state !== 'menu' && !!window.__lb.game, null, { timeout: 5000 }).catch(() => {});
  // the bot plays (the real choice screens answered), unhurt, until a press marks slabs; `wait` then tracks the slabs
  const setup = `
    const lb = window.__lb, g = lb.game, p = g.player, S = 80;
    const marked = () => g.zones.filter((z) => z.slab && z.hostile);
    const onSlab = (z, b) => Math.hypot(Math.max(Math.abs(b.x - z.x) - S / 2, 0), Math.max(Math.abs(b.y - z.y) - S / 2, 0)) < b.r;
    const wait = () => { p.invulnerable = true; for (let i = 0; i < 40000 && !marked().length && lb.game === g && lb.state !== 'results'; i++) { p.hp = p.stats.hp; lb.run(1, false, true); } p.invulnerable = false; return marked(); };`;
  const { still, dodge } = await p.evaluate(`(() => { ${setup}
    const reaches = (zs) => zs.length >= 2 && zs.some((z) => onSlab(z, p));
    const letGo = () => { p.invulnerable = true; for (let i = 0; i < 1000 && marked().length; i++) lb.run(1, false, true); p.invulnerable = false; return wait(); };
    const first = () => {
    const sounds = (window.__press = { warn: 0, slam: 0 });
    const real = lb.view.sfx;
    lb.view.sfx = (n) => ((n in sounds && sounds[n]++), real(n));
    // a press whose slabs do not reach his own (a wall or an obstacle where its slab would be) is let go by: the next one is the one used
    let zs = wait();
    for (let n = 0; n < 8 && zs.length && !reaches(zs); n++) zs = letGo();
    if (!zs.length) return { found: false, realm: g.level?.realm, wave: g.wave };
    const warned = sounds.warn > 0;
    // a foe on a marked slab beside the champion's (the others sent far off), tough enough to live through it
    const mine = zs.find((z) => onSlab(z, p)), other = zs.find((z) => z !== mine);
    if (!mine) return { found: false, realm: g.level?.realm, wave: g.wave, why: 'no slab under him' };
    p.hp = p.stats.hp; // a known start: full health, whatever the real frames before this call cost him
    const [foe, ...rest] = g.enemies.filter((e) => !e.dead);
    for (const e of rest) Object.assign(e, { x: p.x + 3000, y: p.y });
    if (foe && other) Object.assign(foe, { x: other.x, y: other.y, hp: 1e6, maxHp: 1e6 });
    // hands off the keys: he stands still. Halfway down: the slab's corner bracket and the ram are drawn
    for (let i = 0; i < 1000 && zs[0].t < zs[0].delay * 0.8; i++) { lb.run(1, false, 'input'); if (foe && other) Object.assign(foe, { x: other.x, y: other.y }); }
    g.shake = 0;
    lb.draw();
    const c = document.getElementById('game').getContext('2d'), cam = lb.camera();
    const px = (wx, wy) => [...c.getImageData(Math.round((wx - Math.round(cam.x)) * cam.zoom), Math.round((wy - Math.round(cam.y)) * cam.zoom), 1, 1).data];
    // the ram over a 3x3 grid across the slab: the champion standing on it hides some of those points, never all
    const grid = [-1, 0, 1].flatMap((i) => [-1, 0, 1].map((j) => [mine.x + (i * S) / 4, mine.y + (j * S) / 4 - 10]));
    // the bracket is 3 px thick and the canvas rounds its camera, so one pixel can miss it, and the ram (a bigger sprite once the props atlas has
    // loaded) can hide a corner: the warmest pixel in a small patch at each of the slab's four corners is the sample
    const warm = (a) => a[0] - a[1] - a[2];
    const bracket = [-1, 1].flatMap((sx) => [-1, 1].flatMap((sy) => Array.from({ length: 12 }, (_, i) => Array.from({ length: 12 }, (_, j) => px(mine.x + sx * (S / 2 - 8) + i - 4, mine.y + sy * (S / 2 - 8) + j - 4))).flat())).sort((a, b) => warm(b) - warm(a))[0];
    const ramOn = grid.map(([x, y]) => px(x, y).join());
    const keep = g.zones;
    g.zones = g.zones.filter((z) => !z.slab);
    lb.draw();
    const ramOff = grid.map(([x, y]) => px(x, y).join());
    g.zones = keep;
    // stand still: the ram lands
    const slams = sounds.slam;
    let onIt = false, hp = p.hp, foeHp = foe?.hp ?? 0; // as the ram lands: the tick the slabs go
    for (let i = 0; i < 1000 && marked().length; i++) { onIt = onSlab(mine, p); hp = p.hp; foeHp = foe?.hp ?? 0; lb.run(1, false, 'input'); if (foe && other && marked().length) Object.assign(foe, { x: other.x, y: other.y }); }
    return { found: true, realm: g.level?.realm, level: g.level?.level, arena: g.arena.id, n: zs.length, warned, onIt, hurt: hp - p.hp, foeHurt: foe && other ? foeHp - foe.hp : -1, slam: sounds.slam - slams,
      bracket, ram: ramOn.filter((v, i) => v !== ramOff[i]).length >= 3, props: lb.props() };
  };
    const still = first();
    // the next marking, in this same call so no real frame runs between the two halves: step off the line with the keyboard (a line across: up or down,
    // towards the open floor; a line down: left or right). The key is a real keydown on the window, which the input layer reads as it reads the keyboard
    let dodge = { found: false };
    if (still.found) {
      let zs = wait();
      for (let n = 0; n < 8 && zs.length && !zs.some((z) => onSlab(z, p)); n++) zs = letGo(); // one that reaches him: else there is nothing to step off
      if (zs.length) {
        p.hp = p.stats.hp; // nothing else may hurt him: the slam is what is being missed
        const across = zs.every((z) => z.y === zs[0].y), mid = g.bounds;
        const key = across ? (p.y > mid.y + mid.h / 2 ? 'KeyW' : 'KeyS') : (p.x > mid.x + mid.w / 2 ? 'KeyA' : 'KeyD');
        window.dispatchEvent(new KeyboardEvent('keydown', { code: key, key }));
        const hp0 = p.hp;
        for (const e of g.enemies) Object.assign(e, { x: p.x + 3000, y: p.y }); // nothing else to hurt him
        let onIt = true, hp = p.hp;
        for (let i = 0; i < 1000 && marked().length; i++) { onIt = zs.some((z) => onSlab(z, p)); hp = p.hp; lb.run(1, false, 'input'); }
        window.dispatchEvent(new KeyboardEvent('keyup', { code: key, key }));
        dodge = { found: true, key, onIt, hurt: hp - p.hp, start: hp0 };
      } else dodge = { found: false, why: ['state ' + lb.state, lb.game === g ? 'same game' : 'other game', 'wave ' + g.wave, 'cleared ' + !!(g.level && g.level.cleared), 'over ' + !!g.over, 'hp ' + Math.round(p.hp), 'foes ' + g.enemies.length, 'pressT ' + g.pressT, 'time ' + g.time.toFixed(1)].join(', ') };
    }
    return { still, dodge };
  })()`);
  await p.close();
  // the bracket's glow pulses, so one sample can catch it dim: a warm hue (red well over green, over twice the blue) is the proof
  const red = still.bracket && still.bracket[0] > still.bracket[1] + 30 && still.bracket[0] > 2 * still.bracket[2];
  const ok = still.found && still.realm === 'ironHold' && still.level === 1 && still.arena === 'keep' && still.n >= 2 && still.warned && red && still.ram
    && still.onIt && still.hurt > 0 && still.slam > 0 && still.foeHurt > 0 && dodge.found && !dodge.onIt && dodge.hurt < still.hurt / 2 && // (a hair of other damage or regeneration is not a slam: it hurt him ten or more)
     errs.length === 0;
  return { ok, detail: still.found ? `${still.realm} level ${still.level} in the ${still.arena}: ${still.n} slabs marked${still.warned ? ' with a warning' : ''}, bracket rgb(${(still.bracket ?? []).slice(0, 3).join(',')}), ram ${still.ram ? 'drawn' : 'NOT drawn'}${still.props ? '' : ' (props atlas not loaded yet)'}; standing still: ${still.onIt ? 'on the slab' : 'OFF the slab'}, hurt ${Math.round(still.hurt)}, ${still.slam} slam sound(s), the foe beside him hurt ${Math.round(still.foeHurt)}; stepped aside (${dodge.key ?? 'no key'}): ${dodge.found ? `${dodge.onIt ? 'STILL on a slab' : 'off the slabs'}, hurt ${+dodge.hurt.toFixed(2)}` : `no second marking (${dodge.why})`}${errs.length ? `; errors: ${errs[0]}` : ''}` : `no press marked slabs (${still.realm}, wave ${still.wave})` };
});

// ---------- #249: the Iron Hold on Squire: map -> the Iron Hold -> the road on Squire; every level's featured foes are ones Squire fields
// there (no Mirror Knight, no Hound Master), the Iron Shieldwall named from level 2, at 1280x720 and 1920x1080; then level 2 -> FIGHT: the
// bot plays on Squire, nothing put in the queue by hand, until the director's own shieldwall squad marches in as Iron Shieldwalls and his
// flash card opens ----------
await check('Iron Hold on Squire: the road lists only foes Squire fields, and a level brings Iron Shieldwalls on its own (#249)', async () => {
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://localhost:${PORT}/?debug`);
  await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
  await p.evaluate((run) => {
    const champ = (name) => ({ name, inventory: [], loadouts: {}, ...window.__lb.build.grown({ marches: [7], ironHold: [4] }), world: { marches: [7], ironHold: [4] }, signature: true, lastBastion: false, runs: { ironHold: run } });
    const lb = window.__lb;
    lb.save.champions = Object.fromEntries(['paladin', 'viking', 'angel', 'necromancer', 'archer'].map((c) => [c, champ(c)])); // the Marches crowned, Iron Hold levels 1-4 cleared on Squire (so every flag opens), its realm run at level 2 on Squire
    lb.save.cards = lb.cardIds.filter((id) => id !== 'ironShieldwall'); // every other card already seen, so his is the one that shows
  }, runAt(2, 0));
  await p.click('[data-go="map"]');
  await p.click('.wm-realm.r-ironHold');
  await p.locator('.rr-panel').waitFor({ timeout: 3000 });
  await p.click('.rr-tier[data-tier="0"]');
  await p.waitForTimeout(100);
  const road = [];
  for (const size of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
    await p.setViewportSize(size);
    for (const n of [1, 2, 3, 4, 5]) {
      await p.click(`.rr-flag.l-${n}`);
      await p.waitForTimeout(60);
      road.push(await p.evaluate(({ n, w }) => {
        const foes = document.querySelector('.rr-foes');
        const r = foes?.getBoundingClientRect();
        return { n, w, tier: document.querySelector('.rr-tier.on')?.dataset.tier, foes: foes?.textContent.replace(/\s+/g, ' ').trim() ?? '', seen: !!r && r.width > 0 && r.bottom <= innerHeight && r.right <= innerWidth };
      }, { n, w: size.width }));
    }
  }
  await p.setViewportSize({ width: 1280, height: 720 });
  await p.click('.rr-flag.l-2');
  await p.waitForTimeout(100);
  await p.click('[data-fight]');
  await p.waitForFunction(() => window.__lb.state !== 'menu' && !!window.__lb.game, null, { timeout: 5000 }).catch(() => {});
  // the bot plays the level (the real choice screens answered), unhurt, until his flash card opens: only the director's own waves bring him
  const met = await p.evaluate(() => {
    const lb = window.__lb, g = lb.game;
    if (!g) return { started: false };
    // unhurt every tick: the Paladin's own shield, when the bot casts it, drops invulnerability as it ends
    for (let i = 0; i < 120000 && !document.querySelector('[data-card]') && lb.game === g && lb.state !== 'results' && !g.level?.cleared; i++) (g.player.invulnerable = true), lb.run(1, false, true);
    const c = document.querySelector('#overlay > .kit-frame.flash-card[data-card]');
    const walls = g.enemies.filter((e) => e.def.id === 'ironShieldwall');
    return { started: true, state: lb.state, screen: document.querySelector('#overlay h2, #overlay h1')?.textContent ?? '', time: Math.round(g.time), realm: g.level?.realm, level: g.level?.level, tier: g.tierIndex, wave: g.wave, card: c?.dataset.card, title: c?.querySelector('.kit-parch h2')?.textContent, walls: walls.length, inSquad: walls.filter((e) => e.squad).length, plain: g.enemies.filter((e) => e.def.id === 'shieldwall').length };
  });
  await p.close();
  const bad = road.filter((r) => r.tier !== '0' || /Mirror Knight|Hound Master|Siege Tower/.test(r.foes) || !r.seen || !r.foes);
  const walled = road.filter((r) => r.n >= 2 && /Iron Shieldwall/.test(r.foes));
  const ok = bad.length === 0 && walled.length === 8
    && met.started && met.realm === 'ironHold' && met.level === 2 && met.tier === 0 && met.card === 'ironShieldwall' && met.title === 'Iron Shieldwall'
    && met.walls > 0 && met.inSquad > 0 && met.plain === 0 && errs.length === 0;
  const l2 = road.find((r) => r.n === 2);
  return { ok, detail: `road on Squire: level 2 "${l2?.foes}"; ${bad.length ? `WRONG: ${bad.map((r) => `L${r.n}@${r.w} tier ${r.tier} "${r.foes}"${r.seen ? '' : ' (not in view)'}`).join('; ')}` : 'no foe Squire does not field, at 1280 and 1920'}; Iron Shieldwall named on ${walled.length}/8 of levels 2-5; fight: ${met.started ? `${met.realm} ${met.level} on tier ${met.tier}, wave ${met.wave} at ${met.time} s (${met.state}${met.screen ? `, "${met.screen}"` : ''}): card ${met.card ?? 'NONE'} "${met.title ?? ''}", ${met.walls} Iron Shieldwalls (${met.inSquad} in a squad), ${met.plain} plain` : 'did not start'}${errs.length ? `; errors: ${errs[0]}` : ''}` };
});

// ---------- #259: the Iron Hold's level 2 on Squire always brings its featured squad: on each of several run seeds, map -> the Iron
// Hold -> Squire -> level 2 (the road naming the Iron Shieldwall) -> FIGHT; the bot plays, unhurt, nothing put in the queue by hand, and a
// squad of Iron Shieldwalls marches in within the level's first WORLD.featuredSquad.within waves (9-11) ----------
await check('Iron Hold level 2 on Squire: the featured Iron Shieldwalls come as a squad on every seed, in the level\'s first waves (#259)', async () => {
  const seeds = [20237, 1, 2, 3, 4];
  const runs = [];
  const errs = [];
  for (const seed of seeds) {
    const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`http://localhost:${PORT}/?debug`);
    await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
    await p.evaluate((run) => {
      const champ = (name) => ({ name, inventory: [], loadouts: {}, ...window.__lb.build.grown({ marches: [7], ironHold: [1] }), world: { marches: [7], ironHold: [1] }, signature: true, lastBastion: false, runs: { ironHold: run } });
      const lb = window.__lb;
      lb.save.champions = Object.fromEntries(['paladin', 'viking', 'angel', 'necromancer', 'archer'].map((c) => [c, champ(c)])); // Iron Hold level 1 cleared on Squire, its run at level 2
      lb.save.cards = [...lb.cardIds]; // every card seen: no flash card stops the fight
    }, { ...runAt(2, 0), seed });
    await p.click('[data-go="map"]');
    await p.click('.wm-realm.r-ironHold');
    await p.locator('.rr-panel').waitFor({ timeout: 3000 });
    await p.click('.rr-tier[data-tier="0"]');
    await p.click('.rr-flag.l-2');
    await p.waitForTimeout(60);
    const foes = await p.evaluate(() => document.querySelector('.rr-foes')?.textContent.replace(/\s+/g, ' ').trim() ?? '');
    await p.click('[data-fight]');
    await p.waitForFunction(() => window.__lb.state !== 'menu' && !!window.__lb.game, null, { timeout: 5000 }).catch(() => {});
    runs.push({ seed, foes, ...await p.evaluate(() => {
      const lb = window.__lb, g = lb.game;
      if (!g) return { started: false };
      const squadWalls = () => g.enemies.filter((e) => e.def.id === 'ironShieldwall' && e.squad).length;
      for (let i = 0; i < 120000 && squadWalls() === 0 && g.wave <= 11 && lb.game === g && lb.state !== 'results' && !g.level?.cleared; i++) (g.player.invulnerable = true), lb.run(1, false, true);
      return { started: true, runSeed: g.seed, level: g.level?.level, tier: g.tierIndex, wave: g.wave, walls: squadWalls(), plain: g.enemies.filter((e) => e.def.id === 'shieldwall').length };
    }) });
    await p.close();
  }
  const good = (r) => r.started && /Iron Shieldwall/.test(r.foes) && r.runSeed === r.seed && r.level === 2 && r.tier === 0 && r.wave >= 9 && r.wave <= 11 && r.walls > 0 && r.plain === 0;
  const ok = runs.every(good) && errs.length === 0;
  return { ok, detail: `${runs.map((r) => `seed ${r.seed}: ${r.started ? `${good(r) ? '' : 'WRONG '}level ${r.level} tier ${r.tier} seed ${r.runSeed}, ${r.walls} Iron Shieldwalls in a squad by wave ${r.wave}, ${r.plain} plain${/Iron Shieldwall/.test(r.foes) ? '' : ` (road: "${r.foes}")`}` : 'did not start'}`).join('; ')}${errs.length ? `; errors: ${errs[0]}` : ''}` };
});

// ---------- #213: the Iron Hold's shieldwalls: map -> the Iron Hold -> level 2 -> FIGHT; the director's shieldwall squad marches in as Iron
// Shieldwalls with their own flash card, "Got it" closes it, and then, from a known state (him alone, the champion put in front of him, then
// behind him, then at his side), a real swing at his shield is turned with BLOCKED and a clank, the same swing lands in full on his back,
// and he turns toward the side slowly instead of at once. No real-time sampling: every number is one swing or ten ticks ----------
await check('Iron Hold: shieldwalls march as Iron Shieldwalls with their flash card; the iron shield turns a swing at his front, the same swing lands in full on his back, and he turns slowly (#213)', async () => {
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://localhost:${PORT}/?debug`);
  await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
  await p.evaluate((run) => {
    const champ = (name) => ({ name, inventory: [], loadouts: {}, ...window.__lb.build.grown({ marches: [7], ironHold: [1] }), world: { marches: [7], ironHold: [1] }, signature: true, lastBastion: false, runs: { ironHold: run } });
    const lb = window.__lb;
    lb.save.champions = Object.fromEntries(['paladin', 'viking', 'angel', 'necromancer', 'archer'].map((c) => [c, champ(c)])); // the Marches crowned, Iron Hold level 1 cleared, its realm run at level 2 (#237)
    lb.save.cards = lb.cardIds.filter((id) => id !== 'ironShieldwall'); // every other card already seen, so his is the one that shows
  }, runAt(2));
  await p.click('[data-go="map"]');
  await p.click('.wm-realm.r-ironHold');
  await p.locator('.rr-panel').waitFor({ timeout: 3000 });
  await p.click('.rr-flag.l-2');
  await p.waitForTimeout(100);
  await p.click('[data-fight]');
  await p.waitForFunction(() => window.__lb.state !== 'menu' && !!window.__lb.game, null, { timeout: 5000 }).catch(() => {});
  const card = await p.evaluate(() => {
    const lb = window.__lb;
    const blocks = { n: 0 };
    if (lb.view) {
      const real = lb.view.sfx;
      lb.view.sfx = (n) => ((n === 'block' && blocks.n++), real(n));
    }
    window.__blocks = blocks;
    lb.game.player.invulnerable = true;
    // the level's first wave is drawn; the director's shieldwall squad (config/director.ts, five spearmen) goes to the head of its queue as
    // plain shieldwalls, so the game's own spawning has to turn them into the Iron Hold's
    for (let i = 0; i < 5000 && lb.game && !lb.game.spawnQueue.length; i++) lb.run(1, false, false);
    const g = lb.game;
    const squad = g.squadPlans.push({ template: 'shieldwall', formation: 'line', spacing: 30, holdUntil: 70 }) - 1;
    g.spawnQueue.unshift(...[0, 1, 2, 3, 4].map(() => ({ id: 'shieldwall', affixes: [], squad, commander: false })));
    g.spawnTimer = 0;
    lb.run(1, false, false);
    const spawned = g.enemies.filter((e) => e.squad && e.slot >= 0 && e.def.id === 'ironShieldwall').length;
    const plain = g.enemies.filter((e) => e.def.id === 'shieldwall').length;
    // the champion stands; the line marches at him until his card opens
    for (let i = 0; i < 20000 && !document.querySelector('[data-card]') && lb.game === g && lb.state !== 'results'; i++) lb.run(1, false, false);
    const c = document.querySelector('#overlay > .kit-frame.flash-card[data-card]');
    return { id: c?.dataset.card, title: c?.querySelector('.kit-parch h2')?.textContent, text: c?.querySelector('.kit-parch p')?.textContent, realm: g.level?.realm, level: g.level?.level, spawned, plain };
  });
  if (card.id) await p.click('[data-leave]');
  // "Got it" closes the card and the run plays on: wait for that state, not a fixed time
  await p.waitForFunction(() => !document.querySelector('[data-card]') && window.__lb.state === 'playing', null, { timeout: 10000 }).catch(() => {});
  const fight = await p.evaluate(async () => {
    const lb = window.__lb, g = lb.game, pl = g.player;
    const closed = !document.querySelector('[data-card]') && lb.state === 'playing';
    const walls = () => g.enemies.filter((e) => e.def.id === 'ironShieldwall' && !e.dead);
    // until the line breaks formation to fight (a state, not a clock): in formation they face the march, not the champion
    for (let i = 0; i < 20000 && walls().some((e) => e.ai === 'regroup') && lb.game === g && lb.state !== 'results'; i++) lb.run(1, false, false);
    const w = walls().find((e) => e.ai !== 'regroup') ?? walls()[0]; // one that has broken formation: a man in the line does not turn toward anyone
    if (!w) return { closed, found: false };
    const arc = lb.enemyDef('ironShieldwall').frontBlock;
    // a known state: he stands alone (everything else is cleared away), and the champion is put beside him, facing him
    for (const o of g.enemies) if (o !== w) o.dead = true;
    lb.run(1, false, false);
    // his HP is made huge so no swing, crit or not, can kill him; a swing's damage varies (crits), so each side is struck five times and its
    // weakest blow is the number: the rule shows in the plain blows, one crit in the five cannot tip it
    w.maxHp = 1e6;
    const one = (side) => {
      w.hp = w.maxHp;
      const a = w.angle + side;
      pl.x = w.x + Math.cos(a) * (w.r + pl.r + 4);
      pl.y = w.y + Math.sin(a) * (w.r + pl.r + 4);
      pl.attackTimer = 0;
      const b0 = window.__blocks.n, texts0 = g.texts.filter((t) => t.text === 'BLOCKED').length;
      for (let i = 0; i < 30 && w.hp === w.maxHp && !w.dead; i++) lb.run(1, false, false); // one swing: until it lands
      return { dealt: w.maxHp - Math.max(0, w.hp), blocks: window.__blocks.n - b0, text: g.texts.filter((t) => t.text === 'BLOCKED').length > texts0 };
    };
    const swing = (side) => {
      const all = Array.from({ length: 5 }, () => one(side));
      return { dealt: Math.min(...all.map((r) => r.dealt)), blocks: all.reduce((n, r) => n + r.blocks, 0), text: all.some((r) => r.text) };
    };
    const front = swing(0);
    const back = swing(Math.PI);
    // at his side, out of his shield's arc: ten ticks later he has turned toward the champion, but only part of the way
    w.hp = w.maxHp;
    const side = Math.PI / 2;
    const a0 = w.angle;
    pl.x = w.x + Math.cos(a0 + side) * 60;
    pl.y = w.y + Math.sin(a0 + side) * 60;
    pl.attackTimer = 99;
    lb.run(10, false, false);
    const d = Math.abs(Math.atan2(Math.sin(w.angle - a0), Math.cos(w.angle - a0)));
    return { closed, found: true, arc, front, back, turned: +d.toFixed(3), diag: `ai ${w.ai}, hp ${w.hp}, timer ${w.attackTimer}, stun ${w.stun ?? ''}, dead ${w.dead}, x ${w.x.toFixed(0)}` };
  });
  await p.close();
  const ok = card.realm === 'ironHold' && card.level === 2 && card.spawned === 5 && card.plain === 0
    && card.id === 'ironShieldwall' && card.title === 'Iron Shieldwall' && /turns slowly/.test(card.text ?? '')
    && fight.closed && fight.found && fight.front.blocks > 0 && fight.front.text && fight.back.blocks === 0 && !fight.back.text
    && fight.front.dealt > 0 && fight.back.dealt > 0 && fight.front.dealt < fight.back.dealt * 0.5
    && fight.turned > 0 && fight.turned < fight.arc / 2 && errs.length === 0;
  return { ok, detail: `run ${card.realm} ${card.level}: ${card.spawned} Iron Shieldwalls, ${card.plain} plain; card ${card.id ?? 'NONE'} "${card.title ?? ''}"; closed ${fight.closed}; ${fight.found ? `front swing ${fight.front.dealt.toFixed(1)} (${fight.front.blocks} clanks${fight.front.text ? ', BLOCKED' : ''}), back swing ${fight.back.dealt.toFixed(1)} (${fight.back.blocks} clanks); turned ${fight.turned} rad in ten ticks (${fight.diag})` : 'no Iron Shieldwall on the field'}${errs.length ? `; errors: ${errs[0]}` : ''}` };
});

// ---------- #214: the Iron Hold's thorn bearers: map -> the Iron Hold -> level 2 -> FIGHT; a shield bearer brought in as a wave brings him
// marches as the Thorn Bearer with his own flash card, "Got it" closes it, and blows struck beside him bite the champion back, a sliver at a
// time and never faster than the thorns' cooldown. Measured from a known state (full HP, beside him, thorns ready), counted per bite ----------
await check('Iron Hold: a shield bearer marches as the Thorn Bearer, his flash card shows, and blows struck up close bite back (#214)', async () => {
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://localhost:${PORT}/?debug`);
  await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
  await p.evaluate((run) => {
    const champ = (name) => ({ name, inventory: [], loadouts: {}, ...window.__lb.build.grown({ marches: [7], ironHold: [1] }), world: { marches: [7], ironHold: [1] }, signature: true, lastBastion: false, runs: { ironHold: run } });
    const lb = window.__lb;
    lb.save.champions = Object.fromEntries(['paladin', 'viking', 'angel', 'necromancer', 'archer'].map((c) => [c, champ(c)])); // the Marches crowned, Iron Hold level 1 cleared, its realm run at level 2 (#237)
    lb.save.cards = lb.cardIds.filter((id) => id !== 'thornBearer'); // every other card already seen, so his is the one that shows
  }, runAt(2));
  await p.click('[data-go="map"]');
  await p.click('.wm-realm.r-ironHold');
  await p.locator('.rr-panel').waitFor({ timeout: 3000 });
  await p.click('.rr-flag.l-2');
  await p.waitForTimeout(100);
  await p.click('[data-fight]');
  await p.waitForFunction(() => window.__lb.state === 'playing' && !!window.__lb.game, null, { timeout: 5000 }).catch(() => {});
  // a shield bearer comes in the way a wave brings one, in sight: the realm turns him into its own kind and his card opens
  const card = await p.evaluate(() => {
    const lb = window.__lb, g = lb.game;
    const bites = { n: 0 };
    if (lb.view) {
      const real = lb.view.sfx;
      lb.view.sfx = (n) => ((n === 'thorns' && bites.n++), real(n));
    }
    window.__bites = bites;
    g.player.invulnerable = true; // until the measurement starts
    const b = lb.spawn('shieldBearer', g.player.x + 160, g.player.y);
    window.__bearer = b;
    for (let i = 0; i < 600 && !document.querySelector('[data-card]') && lb.game === g && lb.state !== 'results'; i++) lb.run(1, false, false);
    const c = document.querySelector('#overlay > .kit-frame.flash-card[data-card]');
    return { kind: b?.def.id, sprite: b?.def.sprite, id: c?.dataset.card, title: c?.querySelector('.kit-parch h2')?.textContent, text: c?.querySelector('.kit-parch p')?.textContent, realm: g.level?.realm };
  });
  if (card.id) await p.click('[data-leave]');
  await p.waitForFunction(() => !document.querySelector('[data-card]') && window.__lb.state === 'playing', null, { timeout: 3000 }).catch(() => {});
  const fight = await p.evaluate(() => {
    const lb = window.__lb, g = lb.game, pl = g.player, b = window.__bearer;
    const closed = !document.querySelector('[data-card]') && lb.state === 'playing';
    // the known state: full HP, open to harm, standing beside him, his thorns ready, and he lives through the measurement
    pl.invulnerable = false;
    pl.hp = pl.stats.hp;
    pl.x = b.x - 40;
    pl.y = b.y;
    b.thornsAt = undefined;
    b.hpFloor = 1;
    const max = pl.stats.hp, v = g.vars;
    const bites = [];
    let n0 = v['thorns.bites'] ?? 0, taken0 = v['thorns.taken'] ?? 0, texts = 0;
    const sounds0 = window.__bites.n;
    // the champion trades plain blows with him (no ability) until his thorns have bitten three times
    for (let i = 0; i < 1200 && bites.length < 3 && !g.over && lb.game === g && lb.state === 'playing'; i++) {
      lb.run(1, false, false);
      const n = v['thorns.bites'] ?? 0;
      if (n > n0) {
        bites.push({ t: g.time, taken: (v['thorns.taken'] ?? 0) - taken0, n: n - n0 });
        n0 = n;
        taken0 = v['thorns.taken'] ?? 0;
        if (g.texts.some((t) => t.text === 'THORNS')) texts++;
      }
    }
    return { closed, max, bites, sounds: window.__bites.n - sounds0, texts, alive: !g.over };
  });
  await p.close();
  const b = fight.bites;
  const gaps = b.slice(1).map((x, i) => x.t - b[i].t);
  const ok = card.realm === 'ironHold' && card.kind === 'thornBearer' && card.sprite === 'thornBearer' && card.id === 'thornBearer' && card.title === 'Thorn Bearer' && /bite back/.test(card.text ?? '')
    && fight.closed && b.length === 3 && b.every((x) => x.n === 1 && x.taken > 0 && x.taken <= fight.max * 0.1) && gaps.every((d) => d >= 0.3)
    && fight.sounds === 3 && fight.texts === 3 && fight.alive && errs.length === 0;
  return { ok, detail: `run ${card.realm}, spawned ${card.kind ?? 'NONE'} (${card.sprite}), card ${card.id ?? 'NONE'} "${card.title ?? ''}"; closed ${fight.closed}; bites ${b.map((x) => `${x.taken.toFixed(1)}hp@${x.t.toFixed(2)}s`).join(', ') || 'NONE'} of ${fight.max} max HP, ${fight.sounds} sounds, ${fight.texts} THORNS texts${fight.alive ? '' : ', champion fell'}${errs.length ? `; errors: ${errs[0]}` : ''}` };
});

// ---------- #225: the Cinderlands' torchbearers: map -> the Cinderlands -> level 2 -> FIGHT; a peasant brought in as a wave brings him
// marches as the Torchbearer with his own flash card, "Got it" closes it, and his blows stack burn on the champion, shown on the HUD. Once
// he stops landing them the stacks fall off one at a time while the fire ticks HP away; fed again, E (the utility) puts the burn out ----------
await check('Cinderlands: a peasant marches as the Torchbearer, his flash card shows, his blows stack burn on the HUD that falls off a stack at a time, and E puts it out (#225)', async () => {
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://localhost:${PORT}/?debug`);
  await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
  await p.evaluate((run) => {
    const champ = (name) => ({ name, inventory: [], loadouts: {}, ...window.__lb.build.grown({ marches: [7], cinderlands: [1] }), world: { marches: [7], cinderlands: [1] }, signature: true, lastBastion: false, runs: { cinderlands: run } });
    const lb = window.__lb;
    lb.save.champions = Object.fromEntries(['paladin', 'viking', 'angel', 'necromancer', 'archer'].map((c) => [c, champ(c)])); // the Marches crowned, Cinderlands level 1 cleared, its realm run at level 2 (#237)
    lb.save.cards = lb.cardIds.filter((id) => id !== 'torchbearer'); // every other card already seen, so his is the one that shows
  }, { ...runAt(2), carry: { ...runAt(2).carry, level: 6 } }); // level 6, as a run that cleared level 1 stands: the utility (E) is unlocked
  await p.click('[data-go="map"]');
  await p.click('.wm-realm.r-cinderlands');
  await p.locator('.rr-panel').waitFor({ timeout: 3000 });
  await p.click('.rr-flag.l-2');
  await p.waitForTimeout(100);
  await p.click('[data-fight]');
  await p.waitForFunction(() => window.__lb.state === 'playing' && !!window.__lb.game, null, { timeout: 5000 }).catch(() => {});
  // a peasant comes in the way a wave brings one, in sight: the realm turns him into its own kind and his card opens
  const card = await p.evaluate(() => {
    const lb = window.__lb, g = lb.game;
    g.player.invulnerable = true; // until the measurement starts
    const b = lb.spawn('peasant', g.player.x + 160, g.player.y);
    window.__torch = b;
    for (let i = 0; i < 600 && !document.querySelector('[data-card]') && lb.game === g && lb.state !== 'results'; i++) lb.run(1, false, false);
    const c = document.querySelector('#overlay > .kit-frame.flash-card[data-card]');
    return { kind: b?.def.id, sprite: b?.def.sprite, id: c?.dataset.card, title: c?.querySelector('.kit-parch h2')?.textContent, text: c?.querySelector('.kit-parch p')?.textContent, realm: g.level?.realm };
  });
  if (card.id) await p.click('[data-leave]');
  await p.waitForFunction(() => !document.querySelector('[data-card]') && window.__lb.state === 'playing', null, { timeout: 3000 }).catch(() => {});
  // the known state: full HP, open to harm, him beside the champion and living through it; every other foe stunned and held far off
  const stack = await p.evaluate(() => {
    const lb = window.__lb, g = lb.game, pl = g.player, b = window.__torch;
    const closed = !document.querySelector('[data-card]') && lb.state === 'playing';
    window.__hold = (keep) => {
      for (const e of g.enemies) if (e !== keep) Object.assign(e, { x: pl.x + 700, y: pl.y }).statuses.stun = { stacks: 1, time: 5, power: 0 };
    };
    pl.invulnerable = false;
    pl.hp = pl.stats.hp;
    pl.x = b.x - 30;
    pl.y = b.y;
    b.hpFloor = b.maxHp; // the champion's blows don't fell him before he has landed his
    for (let i = 0; i < 1800 && (pl.statuses.burn?.stacks ?? 0) < 3 && !g.over && lb.game === g && lb.state === 'playing'; i++) {
      window.__hold(b);
      lb.run(1, false, false);
      pl.hp = Math.max(pl.hp, pl.stats.hp * 0.6); // he must not fall while the stacks build
    }
    return { closed, stacks: pl.statuses.burn?.stacks ?? 0, decay: pl.statuses.burn?.decay ?? 0 };
  });
  // the HUD shows the stacks
  await p.waitForFunction(() => /Burning ×\d/.test(document.getElementById('h-status')?.textContent ?? ''), null, { timeout: 3000 }).catch(() => {});
  const hud = await p.evaluate(() => document.getElementById('h-status')?.textContent ?? '');
  // he stops landing blows: the stacks fall off one at a time, the fire ticking HP away as they go
  const fall = await p.evaluate(() => {
    const lb = window.__lb, g = lb.game, pl = g.player, b = window.__torch;
    const steps = [];
    const start = pl.statuses.burn?.stacks ?? 0;
    let last = start, lost = 0, hp;
    window.__hold(null);
    hp = pl.hp;
    for (let i = 0; i < 900 && last > 0 && !g.over && lb.game === g && lb.state === 'playing'; i++) {
      window.__hold(null);
      lb.run(1, false, false);
      if (pl.hp < hp) lost += hp - pl.hp;
      hp = pl.hp;
      const n = pl.statuses.burn?.stacks ?? 0;
      if (n !== last) steps.push({ n, t: g.time });
      last = n;
    }
    // fed again: back beside him until two stacks burn
    delete b.statuses.stun;
    b.x = pl.x + 30;
    b.y = pl.y;
    for (let i = 0; i < 1800 && (pl.statuses.burn?.stacks ?? 0) < 2 && !g.over && lb.game === g && lb.state === 'playing'; i++) {
      window.__hold(b);
      lb.run(1, false, false);
      pl.hp = Math.max(pl.hp, pl.stats.hp * 0.6);
    }
    pl.utilityCd = 0;
    return { start, steps, lost, again: pl.statuses.burn?.stacks ?? 0, level: pl.level, smothered: g.vars['burn.smothered'] ?? 0 };
  });
  // E, the utility key: the burn is put out
  await p.keyboard.down('KeyE');
  const put = await p.evaluate(() => {
    const lb = window.__lb, g = lb.game, pl = g.player;
    lb.run(2, false, 'input');
    return { burn: pl.statuses.burn?.stacks ?? 0, smothered: g.vars['burn.smothered'] ?? 0, cast: pl.utilityCd > 0, text: g.texts.some((t) => t.text === 'PUT OUT'), alive: !g.over };
  });
  await p.keyboard.up('KeyE');
  await p.close();
  const s = fall.steps;
  const gaps = s.slice(1).map((x, i) => x.t - s[i].t);
  const ok = card.realm === 'cinderlands' && card.kind === 'torchbearer' && card.sprite === 'torchbearer' && card.id === 'torchbearer' && card.title === 'Torchbearer' && /burn/.test(card.text ?? '')
    && stack.closed && stack.stacks >= 3 && stack.decay > 0 && /Burning ×\d/.test(hud)
    && fall.start >= 3 && s.length === fall.start && s.every((x, i) => x.n === fall.start - 1 - i) && gaps.every((d) => Math.abs(d - stack.decay) < 0.1) && fall.lost > 0
    && fall.again >= 2 && put.cast && put.burn === 0 && put.smothered - fall.smothered >= 2 && put.text && put.alive && errs.length === 0;
  return { ok, detail: `run ${card.realm}, spawned ${card.kind ?? 'NONE'} (${card.sprite}), card ${card.id ?? 'NONE'} "${card.title ?? ''}"; closed ${stack.closed}; ${stack.stacks} stacks, HUD "${hud}"; from ${fall.start} fell ${s.map((x) => `${x.n}@${x.t.toFixed(2)}s`).join(' ') || 'NONE'}, ${fall.lost.toFixed(1)} HP burnt; fed again to ${fall.again} at level ${fall.level}; E cast ${put.cast}, ${put.smothered - fall.smothered} put out, ${put.burn} left${put.alive ? '' : ', champion fell'}${errs.length ? `; errors: ${errs[0]}` : ''}` };
});

// ---------- #224: the Cinderlands' spreading fire: map -> the Cinderlands -> level 1 -> FIGHT. The champion stands two slabs from a lava
// channel, hands off the keys: the fire catches on the slab at the bank beside him with a warning sound (its rim drawn glowing) and creeps
// to him slab by slab, one unbroken trail that never lies in the lava; the slab under him kindles first and does no harm, then burns him
// (the flames drawn on it) and burns the foe held on the trail harder. At the next fire he walks off with the keyboard, and it misses him.
// PLAY_SHOT_224=<file.png> saves the canvas with the trail burning (the review image) ----------
await check('Cinderlands: fire catches at the lava\'s bank with a warning and creeps slab by slab to where you stand; the slab under you kindles, then burns you and the foe on the trail harder; walk off its path and it misses (#224)', async () => {
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://localhost:${PORT}/?debug`);
  await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
  await p.evaluate(() => {
    const champ = (name) => ({ name, inventory: [], loadouts: {}, ...window.__lb.build.grown({ marches: [7], cinderlands: [2] }), world: { marches: [7], cinderlands: [2] }, signature: true, lastBastion: false, runs: {} });
    const lb = window.__lb;
    lb.save.champions = Object.fromEntries(['paladin', 'viking', 'angel', 'necromancer', 'archer'].map((c) => [c, champ(c)]));
    lb.save.cards = [...lb.cardIds]; // every flash card seen: nothing stops the fight
  });
  await p.click('[data-go="map"]');
  await p.click('.wm-realm.r-cinderlands');
  await p.locator('.rr-panel').waitFor({ timeout: 3000 });
  await p.click('.rr-flag.l-1');
  await p.waitForTimeout(100);
  await p.click('[data-fight]');
  await p.waitForFunction(() => window.__lb.state !== 'menu' && !!window.__lb.game, null, { timeout: 5000 }).catch(() => {});
  // both halves in one call, so no real frame runs in between: every tick is stepped here, the keys read through the real input layer
  const { still, dodge, shot } = await p.evaluate((wantShot) => {
    const lb = window.__lb, g = lb.game, p = g.player, S = 80, lava = g.arena.lava ?? [];
    // on a slab as the fire counts it: by his feet, the centre within half his radius of it
    const on = (f, b) => Math.hypot(Math.max(Math.abs(b.x - f.x) - S / 2, 0), Math.max(Math.abs(b.y - f.y) - S / 2, 0)) < b.r / 2 || (Math.abs(b.x - f.x) <= S / 2 && Math.abs(b.y - f.y) <= S / 2);
    const inLava = (s) => lava.some((c) => s.x >= c.x && s.x <= c.x + c.w && s.y >= c.y && s.y <= c.y + c.h);
    const under = () => g.flames.find((f) => on(f, p));
    // one tick with nothing on the field but the foe held on the trail (`foe` at `at`): what hurts him is the fire
    const tick = (foe, at) => {
      g.enemies.length = 0;
      if (foe) g.enemies.push(Object.assign(foe, { x: at.x, y: at.y }));
      g.spawnQueue.length = 0;
      lb.run(1, false, 'input');
    };
    const sounds = { warn: 0 };
    const real = lb.view.sfx;
    lb.view.sfx = (n) => ((n in sounds && sounds[n]++), real(n));
    const c = document.getElementById('game').getContext('2d');
    const px = (wx, wy) => {
      const cam = lb.camera();
      return [...c.getImageData(Math.round((wx - Math.round(cam.x)) * cam.zoom), Math.round((wy - Math.round(cam.y)) * cam.zoom), 1, 1).data];
    };
    const warm = (a) => a[0] > a[1] + 30 && a[0] > 2 * a[2];
    // what the fire draws on a slab: the points that differ with the flames there and without, and the warmest of them
    const drawn = (f, points) => {
      g.shake = 0;
      lb.draw();
      const lit = points.map(([dx, dy]) => px(f.x + dx, f.y + dy));
      const keep = g.flames;
      g.flames = [];
      lb.draw();
      const bare = points.map(([dx, dy]) => px(f.x + dx, f.y + dy));
      g.flames = keep;
      lb.draw();
      return { changed: lit.filter((v, i) => v.join() !== bare[i].join()).length, warm: lit.filter(warm).length };
    };
    const first = () => {
      for (let i = 0; i < 3000 && g.wave < 1 && lb.game === g && lb.state !== 'results'; i++) tick(); // the opening pick, the first wave's call
      // two slabs south of the north channel's middle run, clear of the bridges and the anvils
      const top = lava.filter((q) => q.y === Math.min(...lava.map((r) => r.y))).sort((a, b) => a.x - b.x);
      const run = top[1] ?? top[0];
      if (!run) return { found: false, why: 'no lava' };
      Object.assign(p, { x: run.x + run.w * 0.3, y: run.y + run.h + 2.5 * S, invulnerable: false, iFrames: 0, hp: p.stats.hp });
      const spot = { x: p.x, y: p.y };
      // a foe held across the channel until the fire catches, tough enough to live through all of it: while he stands, the wave does not end
      const far = { x: p.x, y: run.y - 1.5 * S };
      const foe = (window.__fireFoe = lb.spawn('knight', far.x, far.y));
      Object.assign(foe, { hp: 1e6, maxHp: 1e6 });
      for (let i = 0; i < 1500 && !g.flames.length && lb.game === g && lb.state !== 'results'; i++) tick(foe, far);
      if (!g.flames.length) return { found: false, why: `no fire caught (wave ${g.wave}, fireT ${g.fireT}, state ${lb.state})` };
      const bank = { x: g.flames[0].x, y: g.flames[0].y };
      const caught = { n: g.flames.length, warned: sounds.warn > 0, banner: g.banner?.text ?? '', fromBank: bank.y - (run.y + run.h), aside: Math.abs(bank.x - spot.x) };
      // the kindling slab: its rim glows (the middle of each edge, 1 px in)
      const h = S / 2 - 3;
      const rim = drawn(g.flames[0], [[-h, 0], [h, 0], [0, -h], [0, h], [-h, 12], [h, -12]]);
      // the foe is held on the trail now: the slab after the bank's, the next towards the champion, clear of the lava
      const trail = (window.__fireAt = { x: bank.x, y: bank.y + S });
      const hp0 = p.hp, foeHp = foe.hp;
      const lit = [bank];
      const note = () => { for (const f of g.flames) if (!lit.some((s) => s.x === f.x && s.y === f.y)) lit.push({ x: f.x, y: f.y }); };
      // hands off the keys: it creeps to him. The slab under him kindles: no harm yet
      for (let i = 0; i < 1500 && !under() && g.flames.length; i++) (tick(foe, trail), note());
      const mine = under();
      if (!mine) return { found: false, why: `the fire never reached him (${lit.length} slabs lit)` };
      const kindling = { t: mine.t, hurt: hp0 - p.hp, steps: lit.length };
      // standing still: it burns
      let burnAt = -1, burnTick = -1, flames = { changed: 0, warm: 0 }, png = null;
      for (let i = 0; i < 1500 && g.flames.length; i++) {
        const before = p.hp;
        tick(foe, trail);
        note();
        if (burnAt < 0 && p.hp < before - 0.01 && under()) {
          burnAt = under().t;
          const grid = [-1, 0, 1].flatMap((a) => [-1, 0, 1].map((b) => [(a * S) / 3, (b * S) / 3]));
          flames = drawn(under(), grid);
          burnTick = i;
        }
        // the review image: a moment later, the trail burning from the bank to him and the next slab kindling
        if (wantShot && !png && burnTick >= 0 && i === burnTick + 20) ((g.shake = 0), lb.draw(), (png = document.getElementById('game').toDataURL('image/png')));
      }
      const chain = lit.every((s, i) => i === 0 || lit.slice(0, i).some((o) => Math.abs(o.x - s.x) + Math.abs(o.y - s.y) === S));
      return { found: true, realm: g.level?.realm, level: g.level?.level, arena: g.arena.id, caught, rim, kindling, burnAt, flames, hurt: hp0 - p.hp, foeHurt: foeHp - foe.hp, foeWet: inLava(trail),
        slabs: lit.length, chain, wet: lit.slice(1).filter(inLava).length, out: g.flames.length === 0, props: lb.props(), png };
    };
    const still = first();
    let dodge = { found: false };
    if (still.found) {
      // the next fire: as it catches he walks east along the channel with the keyboard, off its path, and stops a few slabs on
      const foe = window.__fireFoe, trail = window.__fireAt;
      for (let i = 0; i < 1500 && !g.fireFronts.length && lb.game === g && lb.state !== 'results'; i++) tick(foe, trail);
      if (g.fireFronts.length) {
        p.hp = p.stats.hp;
        const hp0 = p.hp, x0 = p.x;
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', key: 'd' }));
        let onIt = 0, held = true;
        for (let i = 0; i < 1500 && (g.flames.length || g.fireFronts.length); i++) {
          if (held && i >= 150) (window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD', key: 'd' })), (held = false)); // 2.5 s of walking
          tick(foe, trail);
          if (under()) onIt++;
        }
        if (held) window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD', key: 'd' }));
        dodge = { found: true, walked: p.x - x0, onIt, hurt: hp0 - p.hp };
      } else dodge = { found: false, why: `no second fire (wave ${g.wave}, fireT ${g.fireT}, state ${lb.state})` };
    }
    lb.view.sfx = real;
    const shot = still.png;
    delete still.png;
    return { still, dodge, shot };
  }, !!process.env.PLAY_SHOT_224);
  await p.close();
  if (shot && process.env.PLAY_SHOT_224) writeFileSync(process.env.PLAY_SHOT_224, Buffer.from(shot.split(',')[1], 'base64'));
  const ok = still.found && still.realm === 'cinderlands' && still.level === 1 && still.arena === 'emberForge'
    && still.caught.n === 1 && still.caught.warned && Math.abs(still.caught.fromBank) <= 40 && still.caught.aside <= 40 // one slab, the one at the bank, beside him
    && still.rim.changed >= 3 && still.rim.warm >= 3
    && still.kindling.t < 0.1 && Math.abs(still.kindling.hurt) < 0.01 && still.kindling.steps >= 2 // the slab under him has only just caught, and he is unhurt
    && still.burnAt > 0.5 && still.hurt > 0 && still.foeHurt > still.hurt && !still.foeWet && still.flames.changed >= 3 && still.flames.warm >= 2
    && still.slabs >= 4 && still.slabs <= 5 && still.chain && still.wet === 0 && still.out
    && dodge.found && dodge.walked > 160 && dodge.onIt === 0 && dodge.hurt < 0.01 && errs.length === 0;
  return { ok, detail: still.found ? `${still.realm} level ${still.level} in the ${still.arena}: caught on ${still.caught.n} slab, its middle ${Math.round(still.caught.fromBank)} px from the bank${still.caught.warned ? ' with a warning' : ', NO warning'} ("${still.caught.banner}"), rim ${still.rim.changed}/6 drawn (${still.rim.warm} warm); reached him over ${still.kindling.steps} slabs, kindling: hurt ${+still.kindling.hurt.toFixed(2)}; burning from ${still.burnAt.toFixed(2)} s: hurt ${Math.round(still.hurt)}, the foe on the trail ${Math.round(still.foeHurt)}, flames ${still.flames.changed}/9 drawn (${still.flames.warm} warm)${still.props ? '' : ' (props atlas not loaded yet)'}; ${still.slabs} slabs lit, ${still.chain ? 'one trail' : 'BROKEN trail'}, ${still.wet} past the bank in the lava, ${still.out ? 'burnt out' : 'STILL burning'}; walked off (${dodge.found ? `${Math.round(dodge.walked)} px east: ${dodge.onIt ? `ON the fire ${dodge.onIt} ticks` : 'never on it'}, hurt ${+dodge.hurt.toFixed(2)}` : dodge.why})${errs.length ? `; errors: ${errs[0]}` : ''}` : `no spreading fire: ${still.why}` };
});

// ---------- #226: the Cinderlands' cinder hounds: map -> the Cinderlands -> level 2 -> FIGHT; a wolf brought in as a wave brings him
// hunts as the Cinder Hound with his own flash card, "Got it" closes it. The champion's own blows fell him beside him: a marked blast
// stands where he fell and burns the champion who stays in it; a second one felled, A (a real key) walks the champion out of the mark
// and the blast costs him nothing ----------
await check('Cinderlands: a wolf hunts as the Cinder Hound, his flash card shows, he bursts into fire where the champion fells him, and stepping out of the mark with A spares the champion (#226)', async () => {
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://localhost:${PORT}/?debug`);
  await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
  await p.evaluate((run) => {
    const champ = (name) => ({ name, inventory: [], loadouts: {}, ...window.__lb.build.grown({ marches: [7], cinderlands: [1] }), world: { marches: [7], cinderlands: [1] }, signature: true, lastBastion: false, runs: { cinderlands: run } });
    const lb = window.__lb;
    lb.save.champions = Object.fromEntries(['paladin', 'viking', 'angel', 'necromancer', 'archer'].map((c) => [c, champ(c)])); // the Marches crowned, Cinderlands level 1 cleared, its realm run at level 2 (#237)
    lb.save.cards = lb.cardIds.filter((id) => id !== 'cinderHound'); // every other card already seen, so his is the one that shows
  }, runAt(2));
  await p.click('[data-go="map"]');
  await p.click('.wm-realm.r-cinderlands');
  await p.locator('.rr-panel').waitFor({ timeout: 3000 });
  await p.click('.rr-flag.l-2');
  await p.waitForTimeout(100);
  await p.click('[data-fight]');
  await p.waitForFunction(() => window.__lb.state === 'playing' && !!window.__lb.game, null, { timeout: 5000 }).catch(() => {});
  // a wolf comes in the way a wave brings one, in sight: the realm turns him into its own kind and his card opens
  const card = await p.evaluate(() => {
    const lb = window.__lb, g = lb.game;
    g.player.invulnerable = true; // until the measurement starts
    const b = lb.spawn('wolf', g.player.x + 160, g.player.y);
    window.__hound = b;
    for (let i = 0; i < 600 && !document.querySelector('[data-card]') && lb.game === g && lb.state !== 'results'; i++) lb.run(1, false, false);
    const c = document.querySelector('#overlay > .kit-frame.flash-card[data-card]');
    return { kind: b?.def.id, sprite: b?.def.sprite, id: c?.dataset.card, title: c?.querySelector('.kit-parch h2')?.textContent, text: c?.querySelector('.kit-parch p')?.textContent, realm: g.level?.realm };
  });
  if (card.id) await p.click('[data-leave]');
  await p.waitForFunction(() => !document.querySelector('[data-card]') && window.__lb.state === 'playing', null, { timeout: 3000 }).catch(() => {});
  // the known state: full HP, open to harm, the hound held beside the champion, every other foe stunned and held far off. The champion's
  // own attack fells him; `mode` false stands still in the mark, 'input' reads the keys held
  await p.evaluate(() => {
    const lb = window.__lb, g = lb.game, pl = g.player;
    const mine = () => g.zones.filter((z) => /Cinder Hound/.test(z.cause ?? ''));
    window.__fell = (b) => {
      pl.invulnerable = false;
      pl.hp = pl.stats.hp;
      Object.assign(b, { x: pl.x + 30, y: pl.y });
      const before = g.vars.deathBursts ?? 0;
      for (let i = 0; i < 900 && !b.dead && !g.over && lb.game === g && lb.state === 'playing'; i++) {
        for (const e of g.enemies) {
          if (e !== b) Object.assign(e, { x: pl.x + 700, y: pl.y });
          e.statuses.stun = { stacks: 1, time: 5, power: 0 };
        }
        lb.run(1, false, false);
      }
      const z = mine()[0];
      return { dead: b.dead, bursts: (g.vars.deathBursts ?? 0) - before, zones: mine().length, mark: z ? { r: z.r, delay: z.delay, hostile: z.hostile, dtype: z.dtype, at: Math.hypot(z.x - b.x, z.y - b.y), inside: Math.hypot(z.x - pl.x, z.y - pl.y) <= z.r + pl.r } : null };
    };
    window.__blast = (mode) => {
      const z = mine()[0];
      let lost = 0, ticks = 0;
      for (; ticks < 300 && mine().length && !g.over && lb.game === g && lb.state === 'playing'; ticks++) {
        for (const e of g.enemies) Object.assign(e, { x: pl.x + 700, y: pl.y }).statuses.stun = { stacks: 1, time: 5, power: 0 };
        const hp = pl.hp;
        lb.run(1, false, mode);
        if (!mine().length) lost = hp - pl.hp; // the tick it went off
      }
      return { lost, secs: ticks / 60, gone: !mine().length, away: z ? Math.hypot(z.x - pl.x, z.y - pl.y) - z.r - pl.r : 0, alive: !g.over, max: pl.stats.hp };
    };
  });
  const first = await p.evaluate(() => ({ closed: !document.querySelector('[data-card]') && window.__lb.state === 'playing', fell: window.__fell(window.__hound), blast: window.__blast(false) }));
  // a second hound felled the same way; this time A walks the champion out of the mark, away from where he fell
  const fell2 = await p.evaluate(() => window.__fell(window.__lb.spawn('wolf', window.__lb.game.player.x + 30, window.__lb.game.player.y)));
  await p.keyboard.down('KeyA');
  const blast2 = await p.evaluate(() => window.__blast('input'));
  await p.keyboard.up('KeyA');
  await p.close();
  const marked = (f) => f.dead && f.bursts === 1 && f.zones === 1 && f.mark.hostile && f.mark.dtype === 'fire' && f.mark.at < 1 && f.mark.inside && f.mark.delay >= 0.7;
  const ok = card.realm === 'cinderlands' && card.kind === 'cinderHound' && card.sprite === 'cinderHound' && card.id === 'cinderHound' && card.title === 'Cinder Hound' && /bursts into fire/.test(card.text ?? '')
    && first.closed && marked(first.fell) && first.blast.gone && first.blast.lost > 0 && first.blast.lost < first.blast.max * 0.25 && Math.abs(first.blast.secs - first.fell.mark.delay) < 0.1 && first.blast.alive
    && marked(fell2) && blast2.gone && blast2.away > 0 && blast2.lost === 0 && blast2.alive && errs.length === 0;
  const say = (f, b) => `${f.dead ? 'felled' : 'NOT felled'}, ${f.bursts} burst, mark ${f.mark ? `r ${f.mark.r} ${f.mark.dtype} ${f.mark.inside ? 'round the champion' : 'NOT round him'}` : 'NONE'}, went off after ${b.secs.toFixed(2)} s with him ${b.away > 0 ? `${b.away.toFixed(0)} px clear` : 'in it'}: ${b.lost.toFixed(1)} HP of ${b.max}`;
  return { ok, detail: `run ${card.realm}, spawned ${card.kind ?? 'NONE'} (${card.sprite}), card ${card.id ?? 'NONE'} "${card.title ?? ''}"; closed ${first.closed}; stayed: ${say(first.fell, first.blast)}; stepped out with A: ${say(fell2, blast2)}${first.blast.alive && blast2.alive ? '' : ', champion fell'}${errs.length ? `; errors: ${errs[0]}` : ''}` };
});

// ---------- #197: the champion screen: the champion on a pedestal between six slots, set chips, the inventory, the talent plan, PLAY, the tabs ----------
// From the title's Champion button, at 1280x720 with the mouse and in phone landscape by touch: a legendary tapped in the inventory takes two
// slots (#239: as one wide frame) of the Marches run's three (#237), a second legendary says why it can't go in, a slot tapped takes its relic out, a
// common fills the slot and shows its set chip, the plan gets a talent on the tree, the Map
// tab opens the world map and comes back; PLAY starts level 1 with the slotted relic and the plan; a level ended early comes home as
// "fell at wave N" with RESTART, which plays the level again on the same seed
for (const [w, h, touch] of [[1280, 720, false], [844, 390, true]]) {
  await check(`champion screen: pedestal, six slots, sets, inventory, talent plan, the Map tab, PLAY and RESTART on the same seed, ${touch ? 'tap' : 'click'} at ${w}x${h} (#197)`, async () => {
    const p = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`http://localhost:${PORT}/?debug`);
    await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
    const press = (sel) => (touch ? p.locator(sel).first().tap() : p.locator(sel).first().click());
    await p.evaluate(() => {
      window.__lb.save.champions = { paladin: { name: 'Hild', inventory: ['brimstoneOil', 'emberheart', 'dragonsTongue', 'everfrostCrown'], loadouts: {}, ...window.__lb.build.grown({}), xp: 180, level: 2, world: {}, signature: false, lastBastion: false, runs: {} } };
    });
    await press('[data-go="champion"]');
    await p.locator('.champion-screen').waitFor({ timeout: 3000 });
    await skipTour(p, touch); // #240: this browser's first champion screen
    const look = () => p.evaluate(() => {
      const scr = document.querySelector('.champion-screen'), box = scr.getBoundingClientRect();
      const play = document.querySelector('[data-play]'), pb = play.getBoundingClientRect();
      const fig = document.querySelector('.cs-hero [data-figure] canvas');
      const champ = window.__lb.save.champions.paladin;
      return {
        fits: box.top >= -1 && box.left >= -1 && box.bottom <= innerHeight + 1 && box.right <= innerWidth + 1,
        figure: !!fig && fig.getBoundingClientRect().height > 40,
        slots: [...document.querySelectorAll('.cs-slot')].map((s) => (s.classList.contains('empty') ? (s.classList.contains('idle') ? '-' : 'o') : 'R')).join(''),
        sets: [...document.querySelectorAll('.cs-set')].map((c) => c.textContent.trim()).join(','),
        inv: document.querySelectorAll('.cs-relic').length,
        blocked: [...document.querySelectorAll('.cs-relic.blocked')].map((b) => b.dataset.relic).join(','),
        why: document.querySelector('.cs-why').textContent,
        plan: document.querySelectorAll('.cs-plan li').length,
        play: play.textContent.trim(), playReach: pb.bottom <= innerHeight + 1 && document.elementFromPoint(pb.left + pb.width / 2, pb.top + pb.height / 2)?.closest('[data-play]') === play,
        next: document.querySelector('.cs-next').textContent.replace(/\s+/g, ' ').trim(),
        tabs: [...document.querySelectorAll('.kit-tab')].map((t) => (t.classList.contains('on') ? 'X' : 'o')).join(''),
        greens: document.querySelectorAll('.champion-screen .kit-btn.go').length,
        loadout: (champ.loadouts.marches ?? []).join(','), savedPlan: champ.talents.length,
      };
    });
    const first = await look();
    await press('.cs-relic[data-relic="dragonsTongue"]');
    const slotted = await look();
    await press('.cs-relic[data-relic="everfrostCrown"]'); // a second legendary: the rules say no
    const refused = await look();
    await press('.cs-slot[data-unslot="dragonsTongue"]');
    await press('.cs-relic[data-relic="brimstoneOil"]');
    const common = await look();
    await press('[data-cs="talents"]'); // #240: talents are on the Talents tab; #238: a level-2 champion has one point to spend
    await press('[data-spend-talents]');
    await press('.talent.open');
    await press('.kit-screen.talents [data-back]');
    const planned = await look();
    await press('.kit-tab[data-tab="map"]');
    const map = await p.locator('.wm-map').count();
    await p.keyboard.press('Escape');
    await p.locator('.champion-screen').waitFor({ timeout: 3000 });
    await press('[data-play]');
    await p.waitForFunction(() => !!window.__lb.game, null, { timeout: 5000 }).catch(() => {});
    const run = await p.evaluate(() => { const g = window.__lb.game; return g ? { realm: g.level?.realm, level: g.level?.level, seed: g.seed, held: g.player.relics.held.join(','), talents: g.player.talents.length } : null; });
    // the opening screens (a pick, then the quest board, left as it is), then the pause menu's End run: the level is lost
    await p.waitForFunction(() => window.__lb.state === 'choice', null, { timeout: 5000 }).catch(() => {});
    for (let i = 0; i < 8 && (await p.evaluate(() => window.__lb.state)) === 'choice'; i++) {
      const answer = p.locator('[data-pick], [data-leave]');
      await answer.first().waitFor({ timeout: 3000 }).catch(() => {});
      if (await answer.count()) await press(await p.locator('[data-pick]').count() ? '[data-pick]' : '[data-leave]');
      await p.waitForTimeout(200);
    }
    await p.waitForFunction(() => window.__lb.state === 'playing', null, { timeout: 5000 }).catch(() => {});
    await p.keyboard.press('Escape');
    await press('[data-quit]');
    await press('[data-menu]');
    await p.locator('.champion-screen').waitFor({ timeout: 3000 });
    const fell = await look();
    await press('[data-play]');
    await p.waitForFunction(() => !!window.__lb.game, null, { timeout: 5000 }).catch(() => {});
    const again = await p.evaluate(() => { const g = window.__lb.game; return g ? { level: g.level?.level, seed: g.seed } : null; });
    await p.close();
    const ok = first.fits && first.figure && first.slots === 'ooo---' && first.inv === 4 && first.blocked === '' && first.play === 'Play' && first.playReach && first.greens === 1 && first.tabs === 'oXooo'
      && /The Marches · Level 1/.test(first.next) && /3 slots/.test(first.next) && first.sets === ''
      && slotted.slots === 'Ro---' && slotted.loadout === 'dragonsTongue' && slotted.blocked === 'everfrostCrown' && slotted.sets === '1' // #237: three slots, so the legendary goes in and counts for its set
      && /everfrost crown: at most 1 legendary/i.test(refused.why) && refused.loadout === 'dragonsTongue'
      && common.slots === 'Roo---' && common.loadout === 'brimstoneOil' && common.sets === '1'
      && planned.plan === 1 && planned.savedPlan === 1 && map === 1
      && run?.realm === 'marches' && run.level === 1 && run.held.split(',')[0] === 'brimstoneOil' && run.talents === 1 // #238: the talent the champion took is in its next level
      && /Restart/i.test(fell.play) && /fell at wave \d+/.test(fell.next) && again?.level === 1 && again.seed === run.seed && errs.length === 0;
    return { ok, detail: `slots ${first.slots}, ${first.inv} relics, "${first.next}", ${first.play}${first.playReach ? '' : ' (out of reach)'}, tabs ${first.tabs}; Dragon's Tongue -> ${slotted.slots} (sets ${slotted.sets || '-'}, blocked ${slotted.blocked || '-'}); Everfrost -> "${refused.why}"; out, Brimstone -> ${common.slots}; plan ${planned.plan}; map ${map ? 'opens' : '?'}; run ${run ? `${run.realm} ${run.level}, held ${run.held}` : 'none'}; after a fall "${fell.next}" ${fell.play} -> level ${again?.level} seed ${again?.seed === run?.seed ? 'same' : 'new'}${first.fits ? '' : ' (off screen)'}${errs.length ? `; errors: ${errs[0]}` : ''}` };
  });
}

// #235: on the champion screen at 1280x720 every relic, in a slot or the inventory, has its ⓘ; hovered, its tooltip is the short line; the
// ⓘ clicked opens its compendium page without slotting it, and Esc closes the page and stays on the screen; no text under 14 px on the
// screen's own panels (slots, sets, inventory, talent plan, the level to play: all but the header and the tab bar every main screen shares)
await check('champion screen: relic tooltips are the short line, the ⓘ opens the compendium page, no text under 14 px (#235)', async () => {
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://localhost:${PORT}/?debug`);
  await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
  await p.evaluate(() => {
    window.__lb.save.champions = { paladin: { name: 'Hild', inventory: ['rivetHammer', 'heartOfTheHold', 'emberheart'], loadouts: { marches: ['rivetHammer'] }, ...window.__lb.build.grown({}), world: {}, signature: false, lastBastion: false, runs: {} } };
  });
  await p.locator('[data-go="champion"]').click();
  await p.locator('.champion-screen').waitFor({ timeout: 3000 });
  await skipTour(p); // #240: this browser's first champion screen
  const font = (sel) => p.evaluate((sel) => {
    let min = Infinity;
    for (const root of document.querySelectorAll(sel)) for (const el of [root, ...root.querySelectorAll('*')]) {
      if ([...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && el.getBoundingClientRect().width > 0) min = Math.min(min, parseFloat(getComputedStyle(el).fontSize));
    }
    return min;
  }, sel);
  const infos = await p.evaluate(() => ({ slots: document.querySelectorAll('.cs-slot[data-unslot] .relic-info').length, inv: document.querySelectorAll('.cs-relic .relic-info').length, relics: document.querySelectorAll('.cs-relic').length }));
  const relicFont = await font('.cs-main, .cs-go');
  await p.locator('.cs-relic[data-relic="emberheart"]').hover();
  const tip = await p.evaluate(() => { const t = document.getElementById('tooltip'); return { shown: t?.style.display === 'block', text: t?.innerText ?? '' }; });
  const tipFont = await font('#tooltip');
  await p.locator('.cs-relic[data-relic="emberheart"] .relic-info').click();
  const opened = await p.evaluate(() => ({ page: document.querySelector('.relic-page')?.innerText.replace(/\s+/g, ' ') ?? '', loadout: (window.__lb.save.champions.paladin.loadouts.marches ?? []).join(',') }));
  const pageFont = await font('.relic-page');
  await p.keyboard.press('Escape');
  const after = await p.evaluate(() => ({ page: !!document.querySelector('.relic-page'), screen: !!document.querySelector('.champion-screen') }));
  await p.close();
  const shortTip = tip.shown && tip.text.includes('More damage for every burning enemy near you.') && !/Tier II:|Awakens at/.test(tip.text);
  const ok = infos.slots >= 1 && infos.inv === infos.relics && shortTip && /Tier|II/.test(opened.page) && /250 px/.test(opened.page) && opened.loadout === 'rivetHammer'
    && !after.page && after.screen && relicFont >= 14 && tipFont >= 14 && pageFont >= 14 && errs.length === 0;
  return { ok, detail: `ⓘ on ${infos.slots} slot(s), ${infos.inv}/${infos.relics} inventory relics; tip ${tip.shown ? `"${tip.text.split('\n').slice(0, 2).join(' / ')}"` : 'NOT shown'}; page "${opened.page.slice(0, 70)}", loadout ${opened.loadout}; Esc: page ${after.page ? 'still open' : 'closed'}, screen ${after.screen}; smallest font on the screen ${relicFont}px, tip ${tipFont}px, page ${pageFont}px${errs.length ? `; errors: ${errs[0]}` : ''}` };
});

// ---------- #205: a realm level's relics don't count for "in one run" deeds; a full run's do, and the Chronicle says so ----------
await check('deeds: six relics held in a Marches level leave Reliquarian at 0; in a full run it is earned; the Chronicle says "full run" (#205)', async () => {
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://localhost:${PORT}/?debug`);
  await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
  const six = ['brimstoneOil', 'emberheart', 'cinderCharm', 'salamanderScale', 'dragonsTongue', 'frostBrand'];
  // hold six relics mid-fight, then Esc and quit from the pause menu: the run is banked
  const holdAndQuit = async () => {
    await p.waitForFunction(() => window.__lb.state !== 'menu' && !!window.__lb.game, null, { timeout: 5000 });
    await p.evaluate((ids) => {
      const lb = window.__lb;
      for (let i = 0; i < 400 && !(i > 60 && lb.state === 'playing'); i++) lb.run(1, false, true);
      lb.game.player.invulnerable = true;
      lb.game.player.relics.held.push(...ids.filter((id) => !lb.game.player.relics.held.includes(id)));
    }, six);
    await p.keyboard.press('Escape');
    await p.click('[data-quit]');
    await p.locator('.kit-screen.results').waitFor({ timeout: 3000 });
    return p.evaluate(() => ({ held: window.__lb.save.counters.maxRelics, deed: window.__lb.save.achievements.includes('collector') }));
  };
  await p.click('[data-go="map"]');
  await p.click('.wm-realm.r-marches');
  await p.click('[data-fight]');
  const level = await holdAndQuit();
  await p.goto(`http://localhost:${PORT}/?debug`);
  await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
  await beginDaily(p); // #204: the full run left on the menus
  const full = await holdAndQuit();
  await p.goto(`http://localhost:${PORT}/?debug`);
  await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
  await p.click('[data-go="chronicle"]');
  await p.waitForTimeout(150);
  const row = await p.evaluate(() => [...document.querySelectorAll('.ach')].find((a) => a.textContent.includes('Reliquarian'))?.textContent.replace(/\s+/g, ' ') ?? '');
  await p.close();
  const ok = level.held === 0 && !level.deed && full.held >= 6 && full.deed && /in one full run/.test(row) && /✔ Reliquarian/.test(row) && errs.length === 0;
  return { ok, detail: `level: best held ${level.held}, deed ${level.deed}; full run: best held ${full.held}, deed ${full.deed}; Chronicle "${row.slice(0, 90)}"${errs.length ? `; errors: ${errs[0]}` : ''}` };
});

// ---------- v0.8.3 (#182): a new pixel ratio (another monitor) re-sizes the canvas, so the arena stays sharp ----------
await check('DPR: moving to a sharper screen re-sizes the canvas to its pixels (#182)', async () => {
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await p.goto(`http://localhost:${PORT}/`);
  await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
  const size = () => p.evaluate(() => { const c = document.getElementById('game'); return `${c.width}x${c.height}`; });
  const before = await size();
  // the window lands on a 2x monitor: same CSS size, twice the pixels (the way Chromium reports it: no resize event needed)
  const cdp = await p.context().newCDPSession(p);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 2, mobile: false });
  await p.waitForTimeout(200);
  const after = await size();
  await p.close();
  return { ok: before === '1280x720' && after === '2560x1440', detail: `canvas ${before} -> ${after}` };
});

// ---------- v0.7.5: a shared save with markup in its title, titles and a run's Daily label shows it as text, never as page (#105) ----------
await check('import: a save with markup stays text', () =>
  inPage(() => {
    localStorage.removeItem('lastbastion.save');
    location.reload();
  }).then(async () => {
    await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu');
    return inPage(async () => {
      const bad = '<b id="xss">x</b>', wait = (ms) => new Promise((r) => setTimeout(r, ms)); // the reload dropped window.__play
      const P = { wait, click: async (sel) => (document.querySelector(sel).click(), wait(60)) };
      const btn = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(text));
      btn('Settings').click();
      await P.wait(150);
      await P.click('[data-act="save"]');
      const area = document.getElementById('save-text');
      const raw = JSON.parse(area.value);
      const run = { at: '', classId: 'paladin', tier: 0, arena: 'courtyard', seed: 1, daily: bad, curses: [], oath: 0, trait: 'none', time: 60, wave: 3, level: 2, kills: 5, end: 'slain', cause: bad, relics: {}, talents: [], upgrades: [], waves: [], marks: [] };
      area.value = JSON.stringify({ ...raw, title: bad, titles: [bad, 'the Steadfast'], runs: [run] });
      window.confirm = () => true; // v0.8.3 (#175): import asks first; its own check below answers the real dialog
      await P.click('[data-act="import"]');
      const imported = document.body.innerText.includes('Save imported');
      const seen = [];
      await P.click('[data-act="back"]');
      await P.click('[data-act="back"]'); // settings -> title (#186: the back disc)
      await P.wait(150);
      seen.push(!!document.getElementById('xss'));
      btn('Chronicle').click();
      await P.wait(150);
      seen.push(!!document.getElementById('xss'));
      const titles = [...document.querySelectorAll('[data-equip]')].map((b) => b.textContent.trim());
      document.querySelector('[data-back]').click(); // #189: the Chronicle's back disc
      await P.wait(150);
      btn('The Keep').click();
      await P.wait(150);
      await P.click('[data-history]');
      const rows = document.querySelectorAll('.run').length;
      seen.push(!!document.getElementById('xss'));
      const ok = imported && rows === 1 && !seen.some(Boolean) && titles.join('|') === 'Bare name|the Steadfast' && window.__lb.save.title === null;
      return { ok, detail: `imported ${imported}, markup on title/chronicle/history ${seen.join('/')}, titles ${titles.join(', ')}, ${rows} run` };
    });
  }),
);

// ---------- v0.8.3 (#175): Import asks first; the save it replaces shows up under Restore, and importing again never lists it twice ----------
await check('import: asks first and keeps the replaced save as a backup, once', async () => {
  await page.reload();
  await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu');
  await page.getByRole('button', { name: 'Settings' }).first().click();
  await page.click('[data-act="save"]');
  const before = await page.evaluate(() => ({ gold: window.__lb.save.gold, text: localStorage.getItem('lastbastion.save') }));
  const next = JSON.stringify({ ...JSON.parse(await page.inputValue('#save-text')), gold: before.gold + 1234 });
  const asked = [];
  const importIt = async (answer) => {
    await page.fill('#save-text', next);
    page.once('dialog', (d) => (asked.push(d.message()), answer ? d.accept() : d.dismiss()));
    await page.click('[data-act="import"]');
    await page.waitForTimeout(150);
  };
  await importIt(false); // "no" leaves everything as it was
  const kept = await page.evaluate(() => window.__lb.save.gold);
  await importIt(true);
  const gold = await page.evaluate(() => window.__lb.save.gold);
  const msg = await page.textContent('#save-msg');
  const rows1 = await page.locator('[data-restore]').count();
  const top = await page.evaluate(() => JSON.parse(localStorage.getItem('lastbastion.save.backups'))[0].text);
  await importIt(true);
  await importIt(true); // the same save again: its backup moves up, it is not stored twice
  const texts = await page.evaluate(() => JSON.parse(localStorage.getItem('lastbastion.save.backups')).map((b) => b.text));
  const rows2 = await page.locator('[data-restore]').count();
  await page.click('[data-act="back"]');
  const ok = asked.length === 4 && kept === before.gold && gold === before.gold + 1234 && msg.includes('Save imported') && top === before.text &&
    rows1 >= 1 && rows2 === texts.length && new Set(texts).size === texts.length;
  return { ok, detail: `asked ${asked.length}×, gold ${before.gold} -> ${kept} (no) -> ${gold} (yes), backup is the old save ${top === before.text}, restore rows ${rows1} -> ${rows2}, ${texts.length} backups, ${new Set(texts).size} distinct` };
});

// ---------- #239: the champion screen explains itself: a legendary is one double slot with a "2 slots" badge, a relic that can't go in
// greys the empty slots with the reason, and an ⓘ by the slots, the set chips and the talent plan opens and closes ----------
// At 1280x720 with the mouse and in phone landscape by touch, on a champion with five slots filled: the Everfrost Crown wears its
// "2 slots" badge in the inventory and can't go in; pointing at it (mouse) and tapping it greys the one empty slot, which says "a
// legendary takes 2 slots" in its own tip and under the inventory; a tap elsewhere lifts the grey. A common taken out, the Crown goes in
// as one frame two slots wide with its badge. Each ⓘ opens its text on screen and closes again: by the same ⓘ, by its ×, and by Escape
// (which leaves the screen open). At 1280x720 no text on the screen or its popups is under 14 px.
for (const [w, h, touch] of [[1280, 720, false], [844, 390, true]]) {
  await check(`champion screen: a legendary is one double slot with a "2 slots" badge, a blocked relic greys the empty slot with the reason, the three info buttons open and close, ${touch ? 'tap' : 'click'} at ${w}x${h} (#239)`, async () => {
    const p = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`http://localhost:${PORT}/?debug`);
    await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
    const press = (sel) => (touch ? p.locator(sel).first().tap() : p.locator(sel).first().click());
    await p.evaluate(() => {
      const five = ['brimstoneOil', 'emberheart', 'cinderCharm', 'frostBrand', 'wintersGrasp'];
      window.__lb.save.champions = { paladin: { name: 'Hild', inventory: [...five, 'everfrostCrown'], loadouts: { marches: five }, ...window.__lb.build.grown({}), world: {}, signature: false, lastBastion: false, runs: {} } };
    });
    await press('[data-go="champion"]');
    await p.locator('.champion-screen').waitFor({ timeout: 3000 });
    await skipTour(p, touch); // #240: this browser's first champion screen
    // every piece of text showing on the screen (its popups too) that is smaller than 14 px; the relic tooltip's own text is #235's
    const small = () => p.evaluate(() => {
      const out = [];
      for (const root of [document.querySelector('.champion-screen')]) {
        const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let n = walk.nextNode(); n; n = walk.nextNode()) {
          const e = n.parentElement, r = e.getBoundingClientRect();
          if (!n.textContent.trim() || !r.width || !r.height || e.closest('[hidden]') || getComputedStyle(e).visibility === 'hidden') continue;
          const px = parseFloat(getComputedStyle(e).fontSize);
          if (px < 14) out.push(`${px}px "${n.textContent.trim().slice(0, 24)}"`);
        }
      }
      return out;
    });
    const look = () => p.evaluate(() => {
      const width = (e) => e.getBoundingClientRect().width;
      const slots = [...document.querySelectorAll('.cs-slot')];
      const double = document.querySelector('.cs-slot.double'), single = slots.find((s) => !s.classList.contains('double'));
      const tip = document.getElementById('tooltip');
      return {
        slots: slots.map((s) => (s.classList.contains('empty') ? (s.classList.contains('deny') ? 'x' : 'o') : s.classList.contains('double') ? 'D' : 'R')).join(''),
        deny: [...document.querySelectorAll('.cs-slot.deny')].map((s) => s.dataset.tip).join('|'),
        badge: document.querySelector('.cs-relic[data-relic="everfrostCrown"] .cs-badge')?.textContent ?? '',
        blocked: [...document.querySelectorAll('.cs-relic.blocked')].map((b) => b.dataset.relic).join(','),
        why: document.querySelector('.cs-why').textContent,
        tip: tip && getComputedStyle(tip).display !== 'none' ? tip.textContent : '',
        double: double ? { badge: double.querySelector('.cs-badge')?.textContent ?? '', wide: width(double) >= 2 * width(single), name: double.getAttribute('aria-label') } : null,
        loadout: (window.__lb.save.champions.paladin.loadouts.marches ?? []).join(','),
      };
    });
    const tiny = await small();
    const first = await look();
    let hover = null;
    if (!touch) { // the mouse only points at it: the slot greys, and the relic's own tip says why
      await p.hover('.cs-relic[data-relic="everfrostCrown"]');
      hover = await look();
      tiny.push(...await small());
      await p.mouse.move(4, 4);
    }
    const away = await look();
    await press('.cs-relic[data-relic="everfrostCrown"]'); // picked: the slot stays grey, so its reason can be read on it
    if (touch) await press('.cs-slot.deny'); else await p.hover('.cs-slot.deny');
    const refused = await look();
    tiny.push(...await small());
    await press('.cs-hero [data-figure]'); // a tap elsewhere
    const lifted = await look();
    await press('.cs-slot[data-unslot="wintersGrasp"]');
    const freed = await look();
    await press('.cs-relic[data-relic="everfrostCrown"]');
    if (!touch) await p.mouse.move(4, 4);
    const crowned = await look();
    // the three ⓘ: each opens its own text, on screen, and closes its own way
    const pop = () => p.evaluate(() => {
      const q = document.querySelector('.kit-info-pop'), r = q.getBoundingClientRect();
      return { open: !q.hidden, text: q.hidden ? '' : q.textContent.trim(), fits: q.hidden || (r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight), lit: [...document.querySelectorAll('.kit-info[aria-expanded="true"]')].map((b) => b.dataset.info).join(',') };
    });
    const info = {};
    for (const [key, shut] of [['slots', 'again'], ['sets', 'x'], ['talents', 'Escape']]) {
      if (key === 'talents') await press('[data-cs="talents"]'); // #240: the plan's ⓘ is on the Talents tab
      await press(`.kit-info[data-info="${key}"]`);
      const opened = await pop();
      tiny.push(...await small());
      if (shut === 'again') await press(`.kit-info[data-info="${key}"]`);
      else if (shut === 'x') await press('.kit-info-pop .kit-close');
      else await p.keyboard.press('Escape');
      info[key] = { opened, closed: await pop() };
    }
    const still = await p.locator('.champion-screen').count(); // Escape closed the popup, not the screen
    await p.close();
    const reason = /a legendary takes 2 slots/i;
    const infoOk = Object.entries(info).every(([key, i]) => i.opened.open && i.opened.fits && i.opened.lit === key && !i.closed.open && i.closed.lit === '')
      && /legendary takes 2 slots/i.test(info.slots.opened.text) && /at most 4 relics of one family/i.test(info.slots.opened.text) && /2 class relics/i.test(info.slots.opened.text)
      && /set/i.test(info.sets.opened.text) && /bonus/i.test(info.sets.opened.text) && /talent point/i.test(info.talents.opened.text) && /between levels/i.test(info.talents.opened.text);
    const ok = first.slots === 'RRRRRo' && first.badge === '2 slots' && first.blocked === 'everfrostCrown' && first.double === null
      && (touch || (hover.slots === 'RRRRRx' && reason.test(hover.deny) && reason.test(hover.tip))) && away.slots === 'RRRRRo'
      && refused.slots === 'RRRRRx' && reason.test(refused.deny) && reason.test(refused.why) && reason.test(refused.tip) && refused.loadout === first.loadout
      && lifted.slots === 'RRRRRo'
      && freed.slots === 'RRRRoo' && freed.blocked === ''
      && crowned.slots === 'RRRRD' && crowned.double.badge === '2 slots' && crowned.double.wide && /2 slots/.test(crowned.double.name) && crowned.loadout.split(',').includes('everfrostCrown')
      && infoOk && still === 1 && (touch || tiny.length === 0) && errs.length === 0;
    return { ok, detail: `slots ${first.slots}, the Crown's badge "${first.badge}", blocked ${first.blocked || '-'}${hover ? `; pointed at -> ${hover.slots} "${hover.deny}", away -> ${away.slots}` : ''}; tapped -> ${refused.slots}, the slot says "${refused.tip.slice(0, 60)}", under the inventory "${refused.why}"; a tap elsewhere -> ${lifted.slots}; a common out -> ${freed.slots}; the Crown in -> ${crowned.slots}, ${crowned.double ? `badge "${crowned.double.badge}"${crowned.double.wide ? ', two slots wide' : ', NOT two slots wide'}` : 'NO double slot'}; info ${Object.entries(info).map(([key, i]) => `${key} ${i.opened.open ? 'opens' : 'STAYS SHUT'}${i.opened.fits ? '' : ' (off screen)'}/${i.closed.open ? 'STAYS OPEN' : 'closes'}`).join(', ')}${still ? '' : ', Escape left the screen'}${touch ? '' : `; text under 14 px: ${tiny.length ? [...new Set(tiny)].join(', ') : 'none'}`}${errs.length ? `; errors: ${errs[0]}` : ''}` };
  });
}

// ---------- #240: the champion screen in three tabs, and its tour on a first visit ----------
// From the title at 1280x720 with the mouse and in phone landscape by touch: the first opening brings the tour, five steps of one
// sentence (slots, inventory, the legendary rule, Build, PLAY), each ringing its part with its bubble on screen, and PLAY can't be
// pressed under it; Next goes through them and Done ends it. Loadout, Build and Talents then show one at a time (the slots and the
// inventory, the line about champion levels, the talent plan), the champion and PLAY on all three; the plan edited or cleared comes
// back on Talents. The screen opened again, and after a reload, has no tour; the ⓘ beside the tabs plays it again, Enter goes a step on,
// Escape and Skip leave it with the screen still open. PLAY on the Build tab starts the level. At 1280x720 no text is under 14 px.
for (const [w, h, touch] of [[1280, 720, false], [844, 390, true]]) {
  await check(`champion screen: the tour on a first visit (5 steps, Next, Done, Skip, Escape, again from its info button, never twice by itself), the Loadout, Build and Talents tabs with PLAY on each, ${touch ? 'tap' : 'click'} at ${w}x${h} (#240)`, async () => {
    const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`http://localhost:${PORT}/?debug`);
    await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
    const press = (sel) => (touch ? p.locator(sel).first().tap() : p.locator(sel).first().click());
    const seed = () => p.evaluate(() => {
      window.__lb.save.champions = { paladin: { name: 'Hild', inventory: ['brimstoneOil', 'emberheart', 'dragonsTongue'], loadouts: { marches: ['brimstoneOil'] }, ...window.__lb.build.grown({}), xp: 180, level: 2, world: {}, signature: false, lastBastion: false, runs: {} } };
    });
    await seed();
    const key = () => p.evaluate(() => localStorage.getItem('lastbastion.championTour'));
    const before = await key();
    await press('[data-go="champion"]');
    await p.locator('.champion-screen').waitFor({ timeout: 3000 });
    const tiny = [];
    // what shows: the tour's step (its ring around its part, its bubble on screen), the open tab and its parts, the champion, PLAY
    const look = () => p.evaluate(() => {
      const shown = (sel) => { const e = document.querySelector(sel); return !!e && e.getClientRects().length > 0; };
      const veil = document.querySelector('.kit-tour');
      let tour = null;
      if (veil) {
        const ring = veil.querySelector('.kit-tour-ring').getBoundingClientRect(), pop = veil.querySelector('.kit-tour-pop').getBoundingClientRect();
        const at = { slots: '.cs-slots', inventory: '.cs-inventory', legendary: '.cs-slots', build: '.cs-tabs', play: '.cs-go' }[veil.dataset.step];
        const t = document.querySelector(at).getBoundingClientRect();
        tour = {
          step: veil.dataset.step, text: veil.querySelector('p').textContent, count: veil.querySelector('[data-tour-count]').textContent, next: veil.querySelector('[data-tour-next]').textContent,
          ringed: ring.left <= t.left && ring.top <= t.top && ring.right >= t.right && ring.bottom >= t.bottom && ring.width < t.width + 20,
          fits: pop.left >= 0 && pop.top >= 0 && pop.right <= innerWidth && pop.bottom <= innerHeight,
        };
      }
      const play = document.querySelector('[data-play]'), pb = play.getBoundingClientRect();
      const small = [];
      for (const e of document.querySelectorAll('.champion-screen *')) {
        if ([...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && e.getClientRects().length && parseFloat(getComputedStyle(e).fontSize) < 14) small.push(`${e.className || e.tagName}:${getComputedStyle(e).fontSize}`);
      }
      return {
        tour, small,
        tab: [...document.querySelectorAll('[data-cs]')].filter((b) => b.classList.contains('on') && b.getAttribute('aria-selected') === 'true').map((b) => b.dataset.cs).join(),
        parts: ['.cs-slots', '.cs-sets', '.cs-inventory', '.cs-build', '.cs-talents'].filter(shown).join(' '),
        figure: shown('.cs-hero [data-figure] canvas'),
        build: document.querySelector('.cs-build').textContent.replace(/\s+/g, ' ').trim(),
        plan: document.querySelectorAll('.cs-plan li').length,
        why: document.querySelector('.cs-why').textContent,
        playReach: pb.bottom <= innerHeight + 1 && document.elementFromPoint(pb.left + pb.width / 2, pb.top + pb.height / 2)?.closest('[data-play]') === play,
        fits: (() => { const b = document.querySelector('.champion-screen').getBoundingClientRect(); return b.top >= -1 && b.left >= -1 && b.bottom <= innerHeight + 1 && b.right <= innerWidth + 1; })(),
        mainTabs: [...document.querySelectorAll('.kit-tab')].map((t) => (t.classList.contains('on') ? 'X' : 'o')).join(''),
        game: !!window.__lb.game,
      };
    });
    const see = async () => { const v = await look(); tiny.push(...v.small); return v; };
    // the first visit: the tour, step by step
    const steps = [];
    for (let i = 0; i < 5; i++) {
      const v = await see();
      if (!v.tour) break;
      steps.push({ ...v.tour, playReach: v.playReach, tab: v.tab });
      await press('[data-tour-next]');
    }
    const seen = await key();
    const done = await see();
    // the tabs, one at a time
    await press('[data-cs="build"]');
    const build = await see();
    await press('[data-cs="talents"]');
    const talents = await see();
    await press('[data-spend-talents]'); // #238: a real talent point, spent on the tree
    await press('.talent.open');
    await press('.kit-screen.talents [data-back]');
    await p.locator('.champion-screen').waitFor({ timeout: 3000 });
    const planned = await see();
    await press('[data-reset-points]'); // outside a run: every point back, for free
    await p.locator('.champion-screen').waitFor({ timeout: 3000 });
    const cleared = await see();
    await press('[data-cs="loadout"]');
    await press('.cs-relic[data-relic="dragonsTongue"]'); // a legendary beside the common: slotted, and the screen stays on Loadout
    await p.locator('.cs-slot.double').waitFor({ timeout: 3000 });
    const loadout = await see();
    // opened again, and after a reload: no tour by itself
    await press('.champion-screen [data-back]');
    await press('[data-go="champion"]');
    await p.locator('.champion-screen').waitFor({ timeout: 3000 });
    const second = await see();
    await p.reload();
    await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
    await seed();
    await press('[data-go="champion"]');
    await p.locator('.champion-screen').waitFor({ timeout: 3000 });
    const reloaded = await see();
    // again from the ⓘ, on the Build tab: it starts on Loadout; Enter goes on, Escape leaves it and the screen stays
    await press('[data-cs="build"]');
    await press('[data-tour]');
    const replay = await see();
    await p.keyboard.press('Enter');
    const entered = await see();
    await p.keyboard.press('Escape');
    const escaped = { ...(await see()), screen: await p.locator('.champion-screen').count() };
    await press('[data-tour]');
    const third = await see();
    await press('[data-tour-skip]');
    const skipped = await see();
    // PLAY from another tab
    await press('[data-cs="build"]');
    await press('[data-play]');
    await p.waitForFunction(() => !!window.__lb.game, null, { timeout: 5000 }).catch(() => {});
    const run = await p.evaluate(() => { const g = window.__lb.game; return g ? { realm: g.level?.realm, level: g.level?.level, held: g.player.relics.held.join(',') } : null; });
    await p.close();
    const one = (t) => t.split(/[.!?](\s|$)/).filter((x) => x && x.trim()).length === 1;
    const tourOk = before === null && seen !== null && steps.map((s) => s.step).join() === 'slots,inventory,legendary,build,play'
      && steps.every((s, i) => s.ringed && s.fits && one(s.text) && s.count === `${i + 1} / 5` && s.next === (i === 4 ? 'Done' : 'Next') && !s.playReach && s.tab === 'loadout')
      && /slots/i.test(steps[0].text) && /inventory/i.test(steps[1].text) && /legendary relic takes 2 slots/i.test(steps[2].text) && /Build/.test(steps[3].text) && /PLAY/.test(steps[4].text)
      && !done.tour && !done.game;
    const tabsOk = done.tab === 'loadout' && done.parts === '.cs-slots .cs-sets .cs-inventory'
      && build.tab === 'build' && build.parts === '.cs-build' && /Level 2/.test(build.build) && /3 stat points to spend/.test(build.build) && /champion levels: each level gives 3 stat points/i.test(build.build)
      && talents.tab === 'talents' && talents.parts === '.cs-talents' && talents.plan === 0
      && planned.tab === 'talents' && planned.parts === '.cs-talents' && planned.plan === 1 && cleared.tab === 'talents' && cleared.plan === 0
      && loadout.tab === 'loadout' && loadout.parts === '.cs-slots .cs-sets .cs-inventory'
      && [done, build, talents, planned, cleared, loadout].every((v) => v.playReach && v.figure && v.fits && v.mainTabs === 'oXooo' && !v.tour);
    const onceOk = !second.tour && second.tab === 'loadout' && !reloaded.tour
      && replay.tour?.step === 'slots' && replay.tab === 'loadout' && entered.tour?.step === 'inventory'
      && !escaped.tour && escaped.screen === 1 && escaped.playReach && third.tour?.step === 'slots' && !skipped.tour && skipped.playReach;
    const ok = tourOk && tabsOk && onceOk && run?.realm === 'marches' && run.level === 1 && run.held.split(',')[0] === 'brimstoneOil' && (touch || tiny.length === 0) && errs.length === 0;
    return { ok, detail: `first visit: ${steps.map((s) => `${s.count} ${s.step}${s.ringed ? '' : ' (no ring)'}${s.fits ? '' : ' (off screen)'}${s.playReach ? ' (PLAY open)' : ''}`).join(', ') || 'NO tour'}, last button "${steps[4]?.next ?? '?'}", then ${done.tour ? 'STILL up' : 'gone'}; tabs: ${[done, build, talents, loadout].map((v) => `${v.tab} [${v.parts}]${v.playReach ? '' : ' PLAY out of reach'}`).join(' · ')}; Build "${build.build}"; plan ${planned.plan} on ${planned.tab}, cleared ${cleared.plan} on ${cleared.tab}; opened again ${second.tour ? 'TOUR' : 'no tour'}, after a reload ${reloaded.tour ? 'TOUR' : 'no tour'}; info button -> ${replay.tour?.step ?? 'NONE'} on ${replay.tab}, Enter -> ${entered.tour?.step ?? 'NONE'}, Escape -> ${escaped.tour ? 'still up' : 'gone'} (screen ${escaped.screen}), Skip -> ${skipped.tour ? 'still up' : 'gone'}; PLAY on Build -> ${run ? `${run.realm} ${run.level} holding ${run.held}` : 'NO run'}${touch ? '' : `; under 14 px: ${[...new Set(tiny)].join(', ') || 'none'}`}${errs.length ? `; ERRORS ${errs.join(' | ')}` : ''}` };
  });
}

// ---------- v0.10 (#193): a v0.7-v0.9 save (format 6) loads as format 7 with its champions, its relics kept, the old text under Restore ----------
await check('save v7: a format-6 save migrates with champions (as format 8 now, #237), and the Keep, Chronicle and Settings still open (#193)', async () => {
  const { readFileSync } = await import('node:fs');
  const v6 = readFileSync(new URL('../tests/fixtures/saves/format6-v0.7.4.json', import.meta.url), 'utf8');
  const errs = errors.length;
  await page.evaluate((text) => (localStorage.removeItem('lastbastion.save.backups'), localStorage.setItem('lastbastion.save', text)), v6);
  await page.reload();
  await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu');
  const s = await page.evaluate(() => ({ version: window.__lb.save.version, champions: window.__lb.save.champions, picks: Object.keys(window.__lb.save.relicPicks) }));
  const champs = Object.values(s.champions);
  const kept = champs.length > 0 && champs.every((c) => s.picks.every((id) => c.inventory.includes(id)));
  const opened = [];
  for (const name of ['The Keep', 'Chronicle']) {
    await page.getByRole('button', { name }).first().click();
    await page.waitForTimeout(150);
    opened.push(await page.evaluate(() => document.querySelectorAll('button').length > 1));
    await page.getByRole('button', { name: 'Back' }).first().click().catch(() => page.click('[data-act="back"]'));
    await page.waitForTimeout(150);
  }
  await page.getByRole('button', { name: 'Settings' }).first().click();
  await page.click('[data-act="save"]');
  const label = await page.locator('[data-restore]').first().textContent();
  await page.click('[data-act="back"]');
  await page.click('[data-act="back"]');
  const ok = s.version === 8 && kept && opened.every(Boolean) && label.includes('v0.7-v0.9') && errors.length === errs;
  return { ok, detail: `format ${s.version}, ${champs.length} champions holding all ${s.picks.length} picked relics ${kept}, Keep/Chronicle ${opened.join('/')}, restore row "${label?.trim()}", ${errors.length - errs} errors` };
});

// ---------- v0.8.3 (#174): Blood Pact and Crimson Chalice both cut max HP onto the same pool; a tier-up on one must stay right ----------
// beside the other's cut. Tiering Blood Pact up while Crimson Chalice was still held used to recompute against a stale share of the
// pool (Crimson Chalice's cut baked in from when it was taken); the HUD's max HP must move by exactly Blood Pact's own tier I -> II
// ratio, not some other amount. A fresh test run (like the checks below), so it never disturbs the shared run's own screen sequence.
await check("Blood Pact + Crimson Chalice: a tier-up moves max HP right beside the other's cut (#174)", async () => {
  await inPage(() => {
    localStorage.removeItem('lastbastion.save');
    location.reload();
  });
  await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu');
  return inPage(async () => {
    const wait = (ms = 60) => new Promise((r) => setTimeout(r, ms));
    [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Settings').click();
    await wait(150);
    document.querySelector('[data-act="test"]').click();
    await wait();
    const set = (id, v) => {
      const el = document.getElementById(id);
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    set('tm-class', 'paladin');
    set('tm-level', '1');
    const relic = (name, tier) => {
      const s = [...document.querySelectorAll('select')].find((x) => x.closest('div, label, li')?.innerText.split('\n')[0].includes(name));
      s.value = [...s.options].find((o) => o.textContent.trim() === tier).value;
      s.dispatchEvent(new Event('input', { bubbles: true }));
      s.dispatchEvent(new Event('change', { bubbles: true }));
    };
    relic('Blood Pact', 'I');
    relic('Crimson Chalice', 'I');
    const lb = window.__lb, g = window.__startTest(), p = g.player;
    if (!p.relics.held.includes('bloodPact') || !p.relics.held.includes('crimsonChalice')) return { ok: false, detail: `setup is missing Blood Pact or Crimson Chalice (held: ${p.relics.held.join(', ')})` };
    const before = p.stats.hp;
    p.relics.attune.bloodPact = 1; // a full bar: the next tick ties it up for real (systems/relics.ts tierUp), same as earning it in a fight
    lb.run(1);
    lb.draw(); // the HUD only redraws on a real frame, same as the running game
    const after = p.stats.hp;
    const bp1 = 0.75, bp2 = 0.8; // config/relics.ts bloodPact: n.hp (tier I) / n2.hp (tier II) — the fraction of max HP it keeps
    const want = bp2 / bp1, got = after / before;
    const hpShown = document.getElementById('h-hp-text')?.textContent ?? '';
    const shownMax = Number(hpShown.split('/')[1]);
    return { ok: p.relics.tiers.bloodPact === 2 && Math.abs(got - want) < 0.01 && Math.abs(shownMax - after) < 1, detail: `HP ${before.toFixed(1)} -> ${after.toFixed(1)} (x${got.toFixed(3)}, want x${want.toFixed(3)}), HUD shows ${hpShown}` };
  });
});

// ---------- v0.8.3 (#182): a set bonus reached in a new run flashes, even when the last run reached it too ----------
await check('HUD: a new run flashes its family set again, nothing kept from the last run (#182)', async () => {
  await inPage(() => {
    localStorage.removeItem('lastbastion.save');
    location.reload();
  });
  await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu');
  return inPage(async () => {
    const wait = (ms = 60) => new Promise((r) => setTimeout(r, ms));
    [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Settings').click();
    await wait(150);
    document.querySelector('[data-act="test"]').click();
    await wait();
    const relic = (name, tier) => {
      const s = [...document.querySelectorAll('select')].find((x) => x.closest('div, label, li')?.innerText.split('\n')[0].includes(name));
      s.value = [...s.options].find((o) => o.textContent.trim() === tier).value;
      s.dispatchEvent(new Event('input', { bubbles: true }));
      s.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const flashing = () => document.querySelectorAll('#h-families .fam-chip.flash').length;
    relic('Blood Pact', 'I');
    relic('Vampire Fang', 'I');
    const lb = window.__lb;
    window.__startTest();
    lb.draw();
    const first = flashing();
    document.getElementById('btn-pause').click(); // end the run the way a player does: pause, End run (a test run goes back to its setup)
    await wait();
    document.querySelector('[data-quit]').click();
    await wait();
    relic('Serrated Edge', 'I'); // three Blood relics: still the 2-piece set, a different relic bar
    window.__startTest();
    lb.draw();
    const second = flashing();
    return { ok: first > 0 && second > 0, detail: `set chip flashing: first run ${first}, next run ${second}` };
  });
});

// ---------- v0.7.5 (#112): an Act III slam that came due while you kept away lands as soon as you walk up ----------
await check('Act III: a slam that is due fires when you walk into range', async () => {
  await inPage(() => {
    localStorage.removeItem('lastbastion.save');
    location.reload();
  });
  await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu');
  const start = await inPage(async () => {
    const lb = window.__lb, wait = (ms = 60) => new Promise((r) => setTimeout(r, ms));
    [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Settings').click();
    await wait(150);
    document.querySelector('[data-act="test"]').click();
    await wait();
    const set = (id, v) => {
      const el = document.getElementById(id);
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    set('tm-class', 'viking');
    set('tm-act', '3');
    set('tm-wave', '5');
    window.__startTest(); // set up before a real frame steps it: about one Act III boss wave in six brings no slammer at all
    const g = lb.game, p = g.player;
    p.invulnerable = true;
    p.attackTimer = 1e9; // it must not die before the check
    g.tierIndex = 3; // #101: Legend's full roster, so Mirror Knights and Bone Collectors come too and a slammer turns up soon
    const slammer = () => g.enemies.find((e) => !e.dead && ['knight', 'mirrorKnight', 'boneCollector'].includes(e.def.id));
    for (let i = 0; i < 6000 && !slammer() && lb.game === g; i++) lb.run(1, false, true);
    const e = slammer();
    if (!e) return null;
    for (let i = 0; i < 60 * 9; i++) { // longer than its cooldown, kept out of range
      Object.assign(e, { x: p.x + 420, y: p.y, hp: e.maxHp });
      p.attackTimer = 1e9;
      lb.run(1, false, true);
    }
    Object.assign(e, { x: p.x + 170, y: p.y });
    window.__slam = { e, zones: g.zones.length };
    return { id: e.def.id, act: g.act };
  });
  if (!start) return { ok: false, detail: 'no knight reached' };
  await page.keyboard.down('KeyD'); // walk up to it
  const fired = await inPage(() => {
    const { e } = window.__slam, g = window.__lb.game;
    for (let i = 0; i < 40; i++) {
      window.__lb.run(1, false, 'input');
      if (g.zones.some((z) => z.owner === e)) return i;
    }
    return -1;
  });
  await page.keyboard.up('KeyD');
  return { ok: fired >= 0, detail: `Act ${start.act} ${start.id}: ${fired >= 0 ? `slammed ${fired} ticks after the walk-up` : 'no slam in 40 ticks'}` };
});

// ---------- v0.8 (#126): the Bone Colossus stays capped over many casts, and the skeletons stand beside it ----------
await check('Bone Colossus: capped over many Raise Deads, skeletons stay beside it', async () => {
  await inPage(() => {
    localStorage.removeItem('lastbastion.save');
    location.reload();
  });
  await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu');
  await inPage(async () => {
    const lb = window.__lb, wait = (ms = 60) => new Promise((r) => setTimeout(r, ms));
    [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Settings').click();
    await wait(150);
    document.querySelector('[data-act="test"]').click();
    await wait();
    const set = (id, v) => {
      const el = document.getElementById(id);
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    set('tm-class', 'necromancer');
    set('tm-act', '3');
    set('tm-wave', '5');
    set('tm-level', '30');
    const g = window.__startTest();
    g.player.invulnerable = true;
    g.evolutions = ['boneColossus']; // test mode has no evolution picker
    g.breather = 1e9; // the wave never starts: foes killing skeletons at random would decide whether any stand after a cast
  });
  const seen = [];
  for (let cast = 0; cast < 25; cast++) {
    await inPage(() => {
      const lb = window.__lb, g = lb.game, p = g.player;
      for (let i = 0; i < 1200 && p.abilityTime > 0; i++) lb.run(1, false, 'input');
      for (let i = 0; i < 6; i++) g.corpses.push({ x: p.x + 30 * i, y: p.y + 20, t: 0 });
      for (let i = g.minions.length - 1; i >= 0; i--) if (!g.minions[i].kind && !g.minions[i].cleave) g.minions.splice(i, 1); // so the skeletons counted after a cast are its own
      p.abilityCd = 0;
    });
    await page.keyboard.down('Space');
    await inPage(() => window.__lb.run(2, false, 'input'));
    await page.keyboard.up('Space');
    seen.push(await inPage(() => {
      const g = window.__lb.game, colossi = g.minions.filter((m) => m.cleave);
      return { colossi: colossi.length, damage: colossi[0]?.damage ?? 0, fused: colossi[0]?.fused ?? 0, bones: g.minions.filter((m) => !m.kind && !m.cleave).length };
    }));
  }
  const last = seen.at(-1);
  const ok = seen.every((s) => s.colossi === 1 && s.bones > 0 && s.fused <= 10) && last.fused === 10 && last.damage > 0 && last.damage < 5000;
  return { ok, detail: `after ${seen.length} casts: ${last.bones} skeletons, Colossus ×${last.fused}, ${Math.round(last.damage)} dmg (first ${Math.round(seen[0].damage)})` };
});

// ---------- #201: the signature relics: gold in the compendium, a test run holds the Phylactery, Raise Dead brings its Bone Knight ----------
await check('Relics: five gold signature relics in the compendium; the Phylactery raises a Bone Knight with Raise Dead (#201)', async () => {
  const cp = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await cp.goto(`http://localhost:${PORT}/`);
  await cp.getByText('Take up arms').first().waitFor({ timeout: 5000 });
  await cp.locator('[data-go="keep"]').click();
  await cp.getByRole('button', { name: 'Relic compendium' }).click();
  const comp = await cp.evaluate(() => {
    const head = [...document.querySelectorAll('.compendium h2')].find((h) => /Signature/.test(h.textContent));
    const grid = head?.nextElementSibling?.nextElementSibling;
    return { head: !!head, gold: grid ? grid.querySelectorAll('.comp-card > .kit-rarity.signature').length : 0 };
  });
  await cp.close();
  await inPage(() => {
    localStorage.removeItem('lastbastion.save');
    location.reload();
  });
  await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu');
  const run = await inPage(async () => {
    const wait = (ms = 60) => new Promise((r) => setTimeout(r, ms));
    [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Settings').click();
    await wait(150);
    document.querySelector('[data-act="test"]').click();
    await wait();
    const cls = document.getElementById('tm-class');
    cls.value = 'necromancer';
    cls.dispatchEvent(new Event('change', { bubbles: true }));
    await wait();
    const s = document.querySelector('select[data-relic="phylactery"]');
    if (!s) return { listed: false };
    s.value = '1';
    s.dispatchEvent(new Event('change', { bubbles: true }));
    const g = window.__startTest();
    g.player.invulnerable = true;
    g.breather = 1e9; // no wave: nothing kills the knight before it is counted
    window.__lb.draw();
    const chip = document.querySelector('#hud .relic.signature, .relic.signature');
    return { listed: true, held: g.player.relics.held.includes('phylactery'), chip: !!chip && /Phylactery/.test(chip.dataset.tip ?? '') };
  });
  await page.keyboard.down('Space');
  await inPage(() => window.__lb.run(2, false, 'input'));
  await page.keyboard.up('Space');
  const knights = await inPage(() => window.__lb.game.minions.filter((m) => m.relicBy === 'phylactery').length);
  const ok = comp.head && comp.gold === 5 && run.listed && run.held && run.chip && knights === 1;
  return { ok, detail: `compendium: signature section ${comp.head}, ${comp.gold} gold frames; test mode lists it ${run.listed}, held ${run.held}, gold HUD chip ${run.chip}; Bone Knights after Raise Dead: ${knights}` };
});

// ---------- #182: the Aegis of Dawn's dome goes when Divine Shield is detonated early ----------
await check('Aegis of Dawn: the dome rises with the shield and goes with an early detonation', async () => {
  await inPage(() => {
    localStorage.removeItem('lastbastion.save');
    location.reload();
  });
  await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu');
  await inPage(async () => {
    const wait = (ms = 60) => new Promise((r) => setTimeout(r, ms));
    [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Settings').click();
    await wait(150);
    document.querySelector('[data-act="test"]').click();
    await wait();
    const set = (id, v) => {
      const el = document.getElementById(id);
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    set('tm-class', 'paladin');
    set('tm-level', '10');
    const g = window.__startTest();
    g.evolutions = ['aegisOfDawn']; // test mode has no evolution picker
    g.breather = 1e9;
    g.player.abilityCd = 0;
  });
  const press = async () => {
    await page.keyboard.down('Space');
    await inPage(() => window.__lb.run(2, false, 'input'));
    await page.keyboard.up('Space');
    await inPage(() => window.__lb.run(2, false, 'input'));
  };
  const dome = () => inPage(() => ({ dome: window.__lb.game.fields.some((f) => f.follow), up: window.__lb.game.player.abilityTime > 0 }));
  await press();
  const raised = await dome();
  await press(); // again: detonate early
  const after = await dome();
  const ok = raised.up && raised.dome && !after.up && !after.dome;
  return { ok, detail: `raised: shield ${raised.up}, dome ${raised.dome}; detonated: shield ${after.up}, dome ${after.dome}` };
});

// ---------- #134: Dread Howl stuns the enemies around the Viking when rage starts, and none of them flee ----------
await check('Dread Howl: raging stuns the enemies around you instead of scaring them off', async () => {
  await inPage(() => {
    localStorage.removeItem('lastbastion.save');
    location.reload();
  });
  await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu');
  const ready = await inPage(async () => {
    const lb = window.__lb, wait = (ms = 60) => new Promise((r) => setTimeout(r, ms));
    [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Settings').click();
    await wait(150);
    document.querySelector('[data-act="test"]').click();
    await wait();
    const set = (id, v) => {
      const el = document.getElementById(id);
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    set('tm-class', 'viking');
    set('tm-act', '1');
    set('tm-wave', '3');
    set('tm-level', '20');
    const g = window.__startTest();
    const p = g.player;
    p.invulnerable = true;
    p.upgrades.push('dreadHowl'); // test mode has no upgrade picker
    const foes = () => g.enemies.filter((e) => !e.dead && !e.def.boss);
    for (let i = 0; i < 6000 && foes().length < 3 && lb.game === g; i++) {
      p.attackTimer = 1e9;
      lb.run(1, false, true);
    }
    const near = foes().slice(0, 3);
    if (near.length < 3) return false;
    near.forEach((e, i) => Object.assign(e, { x: p.x + 50 + i * 25, y: p.y, fearT: 0 }));
    delete near[0].statuses.stun;
    p.abilityCd = 0;
    window.__howl = near;
    return true;
  });
  if (!ready) return { ok: false, detail: 'no enemies reached' };
  await page.keyboard.down('Space');
  await inPage(() => window.__lb.run(2, false, 'input'));
  await page.keyboard.up('Space');
  return inPage(() => {
    const near = window.__howl, raging = window.__lb.game.player.abilityTime > 0;
    const stunned = near.filter((e) => e.statuses.stun).length, fleeing = near.filter((e) => e.fearT > 0).length;
    return { ok: raging && stunned === near.length && fleeing === 0, detail: `raging ${raging}, ${stunned}/${near.length} stunned, ${fleeing} fleeing` };
  });
});

// ---------- #127: the Usurper's last phase is a short hold he fights through, then your blows finish him ----------
await check("Usurper: the last phase holds a few seconds, he attacks through it, then he falls", async () => {
  await inPage(() => {
    localStorage.removeItem('lastbastion.save');
    location.reload();
  });
  await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu');
  return inPage(async () => {
    const lb = window.__lb, wait = (ms = 60) => new Promise((r) => setTimeout(r, ms));
    [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Settings').click();
    await wait(150);
    document.querySelector('[data-act="test"]').click();
    await wait();
    const set = (id, v) => {
      const el = document.getElementById(id);
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    set('tm-class', 'viking');
    set('tm-arena', 'bastion');
    set('tm-act', '4');
    set('tm-wave', '10');
    window.__startTest(); // set up before a real frame steps it: the same Usurper fight every time
    const g = lb.game, p = g.player;
    p.invulnerable = true;
    const usurper = () => g.enemies.find((e) => e.def.id === 'usurper' && !e.dead);
    for (let i = 0; i < 6000 && !usurper() && lb.game === g; i++) lb.run(1, false, true);
    const u = usurper();
    if (!u) return { ok: false, detail: 'no Usurper reached' };
    // set up phase 3: past his first threshold, the Royal Flames out, then below a third
    lb.run(60 * 21, false, true);
    u.hp = u.maxHp * 0.6;
    lb.run(5, false, true);
    // your blows put the flames out one by one; kept at a sliver every tick, since a priest's heal can refill one out of reach
    for (let i = 0; i < 600 && u.warded; i++) {
      const f = g.enemies.find((f) => f.def.id === 'royalFlame' && !f.dead);
      if (f) Object.assign(f, { hp: 0.01 }) && Object.assign(p, { x: f.x - f.r - 20, y: f.y });
      lb.run(1, false, 'input');
    }
    if (u.warded) return { ok: false, detail: 'the ward never broke' };
    u.hp = u.maxHp * 0.3;
    lb.run(2, false, 'input');
    if (u.phase !== 3) return { ok: false, detail: `phase ${u.phase}, not 3` };
    g.baseMods.damage *= 1e4; // a huge build: only the hold keeps him up
    let attacks = 0, t = 0;
    const tick = () => {
      Object.assign(p, { x: u.x - u.r - 30, y: u.y });
      lb.run(1, false, 'input');
      t += 1 / 60;
      if (g.zones.some((z) => z.owner === u) || u.telegraph) attacks++;
    };
    for (let i = 0; i < 60 * 3; i++) tick();
    const heldAt3s = !u.dead && u.hp <= 1;
    for (let i = 0; i < 60 * 20 && !u.dead; i++) tick();
    g.baseMods.damage /= 1e4;
    return { ok: heldAt3s && attacks > 0 && u.dead && t < 12, detail: `held at 3 s: ${heldAt3s}, he attacked on ${attacks} ticks, fell after ${t.toFixed(1)} s of phase 3` };
  });
});

// ---------- v0.7.5 (#109): the Gallows pays in a cursed run, and the results screen shows it ----------
await check('Gallows: a cursed run (the Daily Trial) earns its bonus, the results show it', () =>
  inPage(async () => {
    localStorage.removeItem('lastbastion.save');
    location.reload();
  }).then(async () => {
    await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu');
    return inPage(async () => {
      const lb = window.__lb, wait = (ms = 60) => new Promise((r) => setTimeout(r, ms));
      const P = { wait, click: async (sel) => {
        const el = document.querySelector(sel);
        if (!el) throw new Error(`no ${sel} on screen (${document.querySelector('h1,h2')?.textContent.trim() ?? '?'})`);
        el.click();
        await wait();
      } }; // the reload dropped window.__play
      lb.save.meta.curseBonus = 3; // three ranks of the Gallows, as if bought at the Keep
      // #204: the cursed run left is the Daily Trial (two curses), open as a save that already took one keeps it
      lb.save.daily['2000-01-01'] = 1;
      await P.click('[data-go="settings"]');
      await P.click('.settings [data-act="back"]');
      await P.click('[data-go="daily"]');
      const shown = Number([...document.querySelectorAll('.kit-screen.daily .stats > div')].find((d) => /Gold/.test(d.firstElementChild?.textContent))?.textContent.match(/×([\d.]+)/)[1]); // curses alone, without the Gallows
      await P.click('.kit-screen.daily [data-start]');
      await P.wait(200);
      const g = lb.game, mult = g.vars.curseMult;
      g.player.invulnerable = true;
      for (let i = 0; i < 600 && lb.state !== 'results'; i++) lb.run(1, false, true);
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Escape', key: 'Escape' }));
      await P.wait(150);
      await P.click('[data-quit]');
      await P.wait(300);
      const line = [...document.querySelectorAll('div')].find((d) => d.firstElementChild?.textContent === 'Curses')?.innerText ?? '';
      const ok = g.curses.length === 2 && !!g.daily && mult > shown + 0.1 && line.includes(`×${mult.toFixed(2)}`);
      return { ok, detail: `select ×${shown}, run ×${mult.toFixed(2)}, results "${line.replace(/\s+/g, ' ')}"` };
    });
  }),
);

// #79, #203: the Classic select's difficulty row went with it (#204); the realm road's tier crowns (Squire and Knight open, the rest
// locked) are checked with the road (#199)

// #101: each difficulty adds enemy types; the tier's tip names them, and a Knight run fields no Champion or Legend type
await check('difficulty: the waves of a Knight run bring no foes from the tiers above', () =>
  inPage(async () => {
    localStorage.removeItem('lastbastion.save');
    location.reload();
  }).then(async () => {
    await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu');
    return inPage(async () => {
      const lb = window.__lb, wait = (ms = 60) => new Promise((r) => setTimeout(r, ms));
      // #204: the Classic select (and its tier tips) is gone; a run on Knight by the test handle, as the perf test starts one
      lb.save.settings.tier = 1;
      lb.start('viking');
      await wait(200);
      const g = lb.game;
      g.player.invulnerable = true;
      g.wave = 13; // every type is unlocked by wave 14: only the tier holds them back
      const seen = new Set();
      for (let i = 0; i < 1200 && lb.state !== 'results' && g.wave < 17; i++) {
        lb.run(1, false, true);
        for (const u of g.spawnQueue) seen.add(u.id);
        for (const e of g.enemies) seen.add(e.def.id);
      }
      const above = ['shieldwall', 'siegeTower'].filter((id) => seen.has(id));
      const ok = g.tierIndex === 1 && seen.size > 3 && above.length === 0;
      return { ok, detail: `tier ${g.tierIndex}, waves to ${g.wave}, seen ${[...seen].join(', ')}${above.length ? `, above: ${above}` : ''}` };
    });
  }),
);

// ---------- v0.8 (#124): flash cards, in a real run (a test run shows none) ----------
await check('flash card: a new foe shows one with its sprite and a spotlight on it, the run waits, Enter closes it, never twice, kept in the Glossary, redrawn foes at their old size', () =>
  inPage(() => {
    localStorage.removeItem('lastbastion.save');
    location.reload();
  }).then(async () => {
    await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu');
    await beginDaily(); // #204: the Daily Trial, the full run left on the menus
    const first = await inPage(async () => {
      const lb = window.__lb, wait = (ms = 60) => new Promise((r) => setTimeout(r, ms));
      const g = lb.game;
      g.player.invulnerable = true;
      for (let i = 0; i < 3000 && !document.querySelector('[data-card]'); i++) lb.run(1, false, true);
      const card = document.querySelector('[data-card]');
      if (!card) return null;
      const tick = g.tick;
      await wait(300); // real frames: the loop must not step the run under the card
      // #133: the card shows the foe's own sprite (or a mechanic's icon), and the spotlight is on a met foe of that kind
      const pic = card.querySelector('.card-pic');
      const spot = lb.spotlight;
      const side = spot && spot.x > g.player.x ? 0.15 : 0.85; // a patch of arena on the far side from the foe
      const shade = () => {
        const cv = document.getElementById('game'), d = cv.getContext('2d').getImageData(Math.round(cv.width * side) - 15, Math.round(cv.height / 2) - 15, 30, 30).data;
        let sum = 0;
        for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2];
        return sum / (d.length / 4);
      };
      window.__shade = shade;
      const picture = pic?.tagName === 'IMG' ? (pic.dataset.spriteOf === card.dataset.card && pic.complete && pic.naturalWidth > 0 ? 'sprite' : `wrong sprite ${pic.dataset.spriteOf}`) : pic ? 'icon' : 'none';
      return { id: card.dataset.card, name: card.querySelector('h2').textContent, words: card.querySelector('p').textContent.split(' ').length, state: lb.state, held: g.tick === tick, saved: lb.save.cards.includes(card.dataset.card), picture, spotOn: !!spot && g.enemies.includes(spot) && (spot.def.id === card.dataset.card || card.dataset.card in { elite: 1, telegraph: 1 }), dim: shade() };
    });
    if (!first) return { ok: false, detail: 'no card in 3000 ticks' };
    await page.keyboard.press('Enter');
    const after = await inPage(async (id) => {
      const lb = window.__lb, wait = (ms = 60) => new Promise((r) => setTimeout(r, ms));
      await wait(100);
      const closed = !document.querySelector('[data-card]') && lb.state === 'playing';
      const lit = window.__shade(), spotOff = lb.spotlight === null; // #133: the arena lights up again once the card closes
      const shown = [id];
      for (let i = 0; i < 1500 && lb.state !== 'results'; i++) {
        lb.run(1, false, true);
        const c = document.querySelector('[data-card]');
        if (c) (shown.push(c.dataset.card), c.querySelector('[data-leave]').click());
      }
      return { closed, shown, lit, spotOff };
    }, first.id);
    await page.keyboard.press('Escape');
    const glossary = await inPage(async () => {
      await new Promise((r) => setTimeout(r, 100));
      document.querySelector('[data-glossary]')?.click();
      await new Promise((r) => setTimeout(r, 100));
      const met = document.querySelector('.cards-met');
      // #138: the foes met so far, as their pictures show them (the arena sprite at its own scale, plus a 2 px margin each side)
      const sizes = met ? [...met.querySelectorAll('img.card-pic')].map((i) => [i.dataset.spriteOf, i.naturalWidth, i.naturalHeight]) : [];
      return met ? { text: met.innerText, pics: met.querySelectorAll('.card-pic').length, rows: met.querySelectorAll('dt').length, sizes } : { text: '', pics: 0, rows: 0, sizes };
    });
    const once = new Set(after.shown).size === after.shown.length;
    const dimmed = first.dim < after.lit * 0.7;
    const pictured = first.picture === 'sprite' && glossary.pics === glossary.rows;
    // #138: the regular foes and the commanders are drawn on a grid twice as fine, and keep the old grid's size: its columns and rows at 3 px each
    const oldGrid = { peasant: [12, 14], wolf: [14, 8], crossbow: [12, 14], knight: [12, 14], cultist: [12, 14], shieldBearer: [12, 14], priest: [12, 14], cavalry: [16, 13], engineer: [12, 14], plagueDoctor: [12, 14], houndmaster: [12, 14], mirrorKnight: [12, 14], assassin: [12, 13], shieldwall: [12, 14], boneCollector: [12, 14], bannerman: [12, 14], drummer: [12, 14], chaplain: [12, 14] };
    const redrawn = glossary.sizes.filter(([id]) => id in oldGrid);
    // #157: a foe with a rigged sheet shows its figure instead, about 50 art px tall
    const rigged = await inPage(() => window.__lb.sheets());
    const sized = redrawn.length > 0 && redrawn.every(([id, w, h]) => (rigged.includes(id) ? h >= 40 && h <= 80 : w === oldGrid[id][0] * 3 + 4 && h === oldGrid[id][1] * 3 + 4));
    const ok = first.state === 'choice' && first.held && first.saved && first.words <= 14 && after.closed && once && glossary.text.includes(first.name) && pictured && first.spotOn && dimmed && after.spotOff && sized;
    return { ok, detail: `foe pictures ${redrawn.map(([id, w, h]) => `${id} ${w}×${h}`).join(', ') || 'NONE'}${sized ? '' : ' (WRONG SIZE)'}; "${first.name}" (${first.words} words), picture ${first.picture}, spotlight ${first.spotOn ? 'on it' : 'MISSING'}, arena ${Math.round(first.dim)} → ${Math.round(after.lit)} after closing${after.spotOff ? '' : ' (STILL LIT)'}, held ${first.held}, saved ${first.saved}, Enter closed ${after.closed}; cards ${after.shown.join(', ')}${once ? '' : ' (REPEATED)'}; Glossary ${glossary.text ? 'lists it' : 'MISSING'}, ${glossary.pics}/${glossary.rows} pictures` };
  }),
);

// #138 part 3: the siege pieces and the bosses are on the finer grid too; their card pictures (the same ones a flash card shows) keep the
// old grid's size at their own scale, and the Siege Camp and the Plague Cart show their own pictures
// #158: a boss with a rigged sheet shows its rigged figure instead, bigger than the old grid (the flash card fits it to 96 px)
await check('card pictures: siege pieces and bosses redrawn at their old size (rigged bosses bigger), the Siege Camp and the Plague Cart their own', () =>
  inPage(() => location.reload()).then(async () => {
    await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu' && window.__lb.sheets().includes('blackKnight'));
    return inPage(async () => {
      const lb = window.__lb, wait = (ms = 100) => new Promise((r) => setTimeout(r, ms));
      // [id, sprite, old columns, old rows, arena scale]
      const want = [['ballista', 'ballista', 14, 10, 3], ['siegeTower', 'siegeTower', 16, 18, 4], ['blackKnight', 'blackKnight', 16, 18, 4], ['warlord', 'warlord', 16, 18, 4], ['lich', 'lich', 16, 18, 4], ['inquisitor', 'inquisitor', 16, 18, 4], ['abbot', 'abbot', 16, 18, 4], ['dragon', 'dragon', 29, 18, 4], ['warden', 'warden', 16, 18, 4], ['usurper', 'usurper', 16, 18, 4], ['royalFlame', 'royalFlame', 12, 14, 4]];
      const had = [...lb.save.cards];
      lb.save.cards.push(...[...want.map(([id]) => id), 'siegeCamp', 'plagueCart'].filter((id) => !had.includes(id)));
      document.querySelector('[data-go="keep"]').click();
      await wait();
      document.querySelector('[data-glossary]').click();
      await wait();
      const pics = new Map([...document.querySelectorAll('.cards-met img.card-pic')].map((i) => [i.dataset.spriteOf, [i.naturalWidth, i.naturalHeight, i.src]]));
      document.querySelector('[data-back]').click();
      await wait();
      document.querySelector('[data-back]')?.click();
      await wait();
      lb.save.cards.splice(0, lb.save.cards.length, ...had);
      const rigged = lb.sheets(); // #157: a redrawn siege piece shows its rigged figure, 1 art px to 1 world px; #158: a rigged boss, bigger than the old grid
      const boss = (id) => !['ballista', 'siegeTower'].includes(id);
      const wrong = want.filter(([id, , c, r, s]) => (rigged.includes(id) ? !(boss(id) ? pics.get(id)?.[1] > r * s + 4 : pics.get(id)?.[1] >= 30 && pics.get(id)?.[1] <= 120) : pics.get(id)?.[0] !== c * s + 4 || pics.get(id)?.[1] !== r * s + 4)).map(([id]) => `${id} ${pics.get(id)?.slice(0, 2).join('×') ?? 'none'}`);
      const own = ['siegeCamp', 'plagueCart'].every((id) => pics.has(id)) && pics.get('siegeCamp')[2] !== pics.get('siegeTower')?.[2] && pics.get('plagueCart')[2] !== pics.get('ballista')?.[2];
      const ok = wrong.length === 0 && own && lb.state === 'menu';
      return { ok, detail: `${want.map(([id]) => `${id} ${pics.get(id)?.slice(0, 2).join('×')}`).join(', ')}${wrong.length ? ` · WRONG ${wrong}` : ''} · camp ${pics.get('siegeCamp')?.slice(0, 2).join('×')}, cart ${pics.get('plagueCart')?.slice(0, 2).join('×')}${own ? '' : ' (NOT THEIR OWN)'}` };
    });
  }),
);

// ---------- a real run (not a test run) is banked ----------
await check('a real run is banked: gold, the local day, the run log, the week', () =>
  inPage(async () => {
    const P = window.__play, lb = window.__lb;
    localStorage.removeItem('lastbastion.save');
    location.reload();
  }).then(async () => {
    await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu');
    return inPage(async () => {
      const lb = window.__lb, wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const before = { gold: lb.save.gold, runs: lb.save.runs.length };
      lb.start('viking');
      await wait(200);
      lb.game.player.invulnerable = true;
      for (let i = 0; i < 2400 && lb.state !== 'results'; i++) lb.run(1, false, true);
      const earned = lb.game.gold;
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Escape', key: 'Escape' }));
      await wait(150);
      document.querySelector('[data-quit]').click();
      await wait(300);
      const s = lb.save, d = new Date(), today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, last = s.runs[s.runs.length - 1];
      const ok = lb.state === 'results' && s.gold - before.gold === earned && earned > 0 && s.dailyGold.date === today && s.runs.length === before.runs + 1 && Math.abs(Date.parse(last.at) - Date.now()) < 120000 && !!s.contracts.week;
      return { ok, detail: `gold +${s.gold - before.gold} (earned ${earned}), day ${s.dailyGold.date}, runs ${s.runs.length}, week ${s.contracts.week}` };
    });
  }),
);

// ---------- v0.8 (#123): Settings › Text size scales the HUD; at 1400x800 and at phone width nothing in it overlaps ----------
await check('text size: Larger grows the HUD, no overlap at 1400x800 and 844x390', async () => {
  const seen = [];
  for (const [w, h] of [[1400, 800], [844, 390]]) {
    for (const size of ['normal', 'larger']) {
      await page.setViewportSize({ width: w, height: h });
      await inPage(() => {
        localStorage.removeItem('lastbastion.save');
        location.reload();
      });
      await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu');
      seen.push(await inPage(async (size) => {
        const lb = window.__lb, wait = (ms = 60) => new Promise((r) => setTimeout(r, ms));
        const btn = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === text);
        if (innerWidth < 900) { // a phone: a touch first, so the HUD takes its touch layout (relic bar at the top)
          const canvas = document.querySelector('canvas');
          for (const type of ['pointerdown', 'pointerup']) canvas.dispatchEvent(new PointerEvent(type, { clientX: 200, clientY: 300, pointerType: 'touch', pointerId: 9, isPrimary: true, bubbles: true }));
        }
        btn('Settings').click();
        await wait(150);
        document.querySelector(`[data-text-size="${size}"]`).click();
        await wait();
        const chip = document.querySelector(`[data-text-size="${size}"]`).classList.contains('on');
        document.querySelector('[data-act="test"]').click();
        await wait();
        const selects = [...document.querySelectorAll('#tm-relics select')].slice(0, 9); // enough relics for the "+N" overflow chip
        for (const s of selects) {
          s.value = '1';
          s.dispatchEvent(new Event('change', { bubbles: true }));
        }
        window.__startTest().player.invulnerable = true;
        await wait(300);
        lb.run(30, false, true);
        lb.game.banner = { ...lb.game.banner, text: 'Wave 12', t: 9 };
        await wait(300);
        const parts = ['.hud-tl', '#h-quests', '#h-map', '#h-stats', '.hud-tr', '#h-families', '#h-relics', '.hud-wave', '#h-banner', '#h-talent', '.hud-ability', '#h-toasts'];
        const boxes = parts.map((sel) => [sel, document.querySelector(sel)?.getBoundingClientRect()]).filter(([, r]) => r && r.width > 0 && r.height > 0);
        const hits = [];
        for (let i = 0; i < boxes.length; i++) {
          const [a, r] = boxes[i];
          if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) hits.push(`${a} off screen`);
          for (let j = i + 1; j < boxes.length; j++) {
            const [b, q] = boxes[j];
            if (r.left < q.right - 1 && q.left < r.right - 1 && r.top < q.bottom - 1 && q.top < r.bottom - 1) hits.push(`${a} × ${b}`);
          }
        }
        return { chip, tl: document.querySelector('.hud-tl').getBoundingClientRect().width, more: !!document.querySelector('#h-relics .more'), hits };
      }, size));
    }
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  const [dn, dl, pn, pl] = seen;
  const hits = seen.flatMap((s, i) => s.hits.map((x) => `${['desk N', 'desk L', 'phone N', 'phone L'][i]}: ${x}`));
  const ok = seen.every((s) => s.chip && s.more) && dl.tl / dn.tl > 1.25 && pl.tl / pn.tl > 1.1 && hits.length === 0;
  return { ok, detail: `player panel ${Math.round(dn.tl)} -> ${Math.round(dl.tl)}px (1400x800), ${Math.round(pn.tl)} -> ${Math.round(pl.tl)}px (844x390), +N ${seen.map((s) => s.more).join('/')}${hits.length ? `; overlaps: ${hits.slice(0, 4).join(', ')}` : ''}` };
});

// ---------- #172: at a desktop window height where the old h/scale check misclassified it, Larger text stays on the desktop layout ----------
await check('text size: Larger keeps the desktop layout on a desktop window', async () => {
  const atSize = async (w, h, size) => {
    await page.setViewportSize({ width: w, height: h });
    await inPage(() => {
      localStorage.removeItem('lastbastion.save');
      location.reload();
    });
    await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu');
    return inPage(async (size) => {
      const wait = (ms = 60) => new Promise((r) => setTimeout(r, ms));
      const btn = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === text);
      btn('Settings').click();
      await wait(150);
      document.querySelector(`[data-text-size="${size}"]`).click();
      await wait();
      return { compact: document.documentElement.classList.contains('compact'), scaled: document.documentElement.classList.contains('scaled') };
    }, size);
  };
  // 1000x700: desktop-width, and tall enough to stay desktop -- but 700 / textScale('larger', ...) = 700 / 1.3 = 538, which used to trip the 560 compact threshold
  const tall = await atSize(1000, 700, 'larger');
  // a genuinely short desktop-width window still gets the compact layout, at Normal size (no scale to divide by)
  const short = await atSize(1000, 500, 'normal');
  await page.setViewportSize({ width: 1280, height: 720 });
  const ok = !tall.compact && tall.scaled && short.compact;
  return { ok, detail: `1000x700 at Larger: compact=${tall.compact} scaled=${tall.scaled}; 1000x500 at Normal: compact=${short.compact}` };
});

// #146: a class card only selects its champion; Start (or a second click on the chosen card) opens it. #204: no run begins there any
// more: the chosen champion's screen opens, with the Archer on its pedestal and no run started
await check('class select: a card selects, a click beside a swatch starts nothing, Enter selects then opens the champion screen, no run begins (#204)', async () => {
  await inPage(() => {
    localStorage.removeItem('lastbastion.save');
    location.reload();
  });
  await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu');
  const look = () => inPage(() => ({ state: window.__lb.state, on: [...document.querySelectorAll('.select .card.on')].map((c) => c.dataset.class), start: document.querySelector('[data-start]')?.textContent ?? '' }));
  const box = (sel) => inPage((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }, sel);
  await inPage(() => { window.__lb.save.palettes = [1]; document.querySelector('[data-go="start"]').click(); }); // an earned colour shows the swatches
  await page.waitForSelector('[data-start]');
  const first = await look(); // pre-selected: Start works straight away
  await page.locator('[data-class="viking"]').scrollIntoViewIfNeeded();
  const sw = await box('[data-palette="viking:1"]');
  await page.mouse.click(sw.x + sw.w + 4, sw.y + sw.h / 2); // just misses the swatch: lands on the card
  await page.waitForTimeout(100);
  const missed = await look();
  await page.mouse.click(sw.x + sw.w / 2, sw.y + sw.h / 2); // on the swatch: the colour changes, the choice stays
  await page.waitForTimeout(100);
  const recoloured = { ...(await look()), palette: await inPage(() => window.__lb.save.settings.palettes.viking) };
  await inPage(() => document.querySelector('[data-class="archer"]').focus());
  await page.keyboard.press('Enter'); // selects the Archer
  await page.waitForTimeout(100);
  const keyed = await look();
  await page.keyboard.press('Enter'); // the chosen card again: its champion screen opens
  await page.waitForSelector('.champion-screen', { timeout: 3000 }).catch(() => {});
  const run = await inPage(() => ({ state: window.__lb.state, game: !!window.__lb.game, cls: document.querySelector('.champion-screen .cs-pick .kit-ribbon')?.textContent }));
  const ok = first.state === 'menu' && first.on.length === 1 && first.start.startsWith("Onward as ")
    && missed.state === 'menu' && missed.on.join() === 'viking' && missed.start === 'Onward as Viking'
    && recoloured.state === 'menu' && recoloured.on.join() === 'viking' && recoloured.palette === 1
    && keyed.state === 'menu' && keyed.on.join() === 'archer' && keyed.start === 'Onward as Archer'
    && run.cls === 'Archer' && run.state === 'menu' && !run.game;
  return { ok, detail: `first ${JSON.stringify(first)}, beside swatch ${JSON.stringify(missed)}, on swatch ${JSON.stringify(recoloured)}, Enter ${JSON.stringify(keyed)}, Enter again ${JSON.stringify(run)}` };
});

// #117: with Ballista Shot the reticle is the bolt's own size (it was drawn at 14 for a 16 bolt)
await check('ballista: the aim reticle is the size of the bolt it fires', async () => {
  await inPage(() => {
    localStorage.removeItem('lastbastion.save');
    location.reload();
  });
  await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu');
  await inPage(async () => {
    const wait = (ms = 60) => new Promise((r) => setTimeout(r, ms));
    window.__lb.start('archer'); // #204: an Archer's run by the test handle (the Classic select is gone; the trial's class is the day's)
    await wait(200);
    const g = window.__lb.game;
    g.player.invulnerable = true;
    g.player.upgrades.push('ballista'); // as if picked at a level-up
    g.player.abilityCd = 0;
    // the reticle is the only dashed circle the renderer strokes
    const C = CanvasRenderingContext2D.prototype, dash = C.setLineDash, arc = C.arc;
    window.__reticle = [];
    C.setLineDash = function (d) { this.__dashed = d.length > 0; return dash.call(this, d); };
    C.arc = function (x, y, r, ...rest) { if (this.__dashed) window.__reticle.push(r); return arc.call(this, x, y, r, ...rest); };
  });
  await page.mouse.move(700, 300);
  await page.mouse.move(760, 330);
  const drawn = await inPage(() => {
    const lb = window.__lb;
    lb.run(1, false, 'input'); // the cursor's aim reaches the game
    lb.draw();
    return [...new Set(window.__reticle)];
  });
  await page.mouse.down({ button: 'right' });
  const shot = await inPage(() => {
    const lb = window.__lb, g = lb.game;
    for (let i = 0; i < 20; i++) {
      lb.run(1, false, 'input');
      const bolt = g.projectiles.find((q) => !q.hostile && q.pierce >= 999);
      if (bolt) return bolt.r;
    }
    return 0;
  });
  await page.mouse.up({ button: 'right' });
  const cls = await inPage(() => window.__lb.game?.player.cls.id);
  return { ok: cls === 'archer' && drawn.length === 1 && shot > 0 && drawn[0] === shot, detail: `${cls}: reticle ${drawn.join('/') || 'none'}, bolt ${shot}` };
});

// #150: every relic compendium card holds all its text, at Normal and Larger text, on PC and at phone width
await check('compendium: no card text falls off its card', async () => {
  const seen = [];
  for (const [w, h] of [[1280, 720], [844, 390]]) {
    for (const size of ['normal', 'larger']) {
      await page.setViewportSize({ width: w, height: h });
      await inPage(() => {
        localStorage.removeItem('lastbastion.save');
        location.reload();
      });
      await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu');
      // a save that found every relic but one (all champions' lists in test mode): every name shows, and one unknown card
      await inPage(async () => {
        const s = window.__lb.save;
        [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Settings').click();
        await new Promise((r) => setTimeout(r, 150));
        document.querySelector('[data-act="test"]').click();
        await new Promise((r) => setTimeout(r, 60));
        const cls = document.getElementById('tm-class'), ids = new Set();
        for (const o of cls.options) { // each champion lists its own class relics
          cls.value = o.value;
          cls.dispatchEvent(new Event('change'));
          for (const x of document.querySelectorAll('#tm-relics select')) ids.add(x.dataset.relic);
        }
        localStorage.setItem('lastbastion.save', JSON.stringify({ ...s, relicPicks: Object.fromEntries([...ids].filter((_, i) => i > 0).map((id) => [id, 3])) }));
        location.reload();
      });
      await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu');
      seen.push(await inPage(async (size) => {
        const wait = (ms = 150) => new Promise((r) => setTimeout(r, ms));
        const btn = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === text);
        btn('Settings').click();
        await wait();
        document.querySelector(`[data-text-size="${size}"]`).click();
        await wait();
        document.querySelector('[data-act="back"]').click();
        await wait();
        document.querySelector('[data-go="keep"]').click();
        await wait();
        document.querySelector('[data-compendium]').click();
        await wait();
        const cards = [...document.querySelectorAll('.compendium .comp-card')]; // #187: each relic a kit row
        const bad = [];
        for (const c of cards) {
          const box = c.getBoundingClientRect();
          const walk = document.createTreeWalker(c, NodeFilter.SHOW_TEXT);
          for (let t = walk.nextNode(); t; t = walk.nextNode()) {
            if (!t.textContent.trim()) continue;
            const range = document.createRange();
            range.selectNodeContents(t);
            for (const r of range.getClientRects()) {
              if (r.left < box.left - 1 || r.right > box.right + 1 || r.top < box.top - 1 || r.bottom > box.bottom + 1) {
                bad.push(`${c.querySelector('.kit-row-body > b')?.textContent}: "${t.textContent.trim().slice(0, 20)}"`);
                break;
              }
            }
          }
        }
        return { cards: cards.length, known: cards.filter((c) => !c.classList.contains('undiscovered')).length, bad };
      }, size));
    }
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  const labels = ['desk N', 'desk L', 'phone N', 'phone L'];
  const bad = seen.flatMap((s, i) => s.bad.map((x) => `${labels[i]} ${x}`));
  const ok = seen.every((s) => s.cards > 20 && s.known > 40) && bad.length === 0;
  return { ok, detail: `${seen[0].cards} cards (${seen[0].known} found) × 4 layouts${bad.length ? `; overflows ${bad.length}: ${bad.slice(0, 4).join(', ')}` : ', all text inside'}` };
});

// ---------- #155: the rigged sprite sheets load, and the Paladin animates idle -> walk -> attack as he moves and fights ----------
await check('Paladin sheet: loads, then idle, walk and attack play as he moves and swings (#155)', () =>
  inPage(() => {
    localStorage.removeItem('lastbastion.save');
    location.reload();
  }).then(async () => {
    await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu');
    await inPage(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Settings').click();
      await wait(150);
      document.querySelector('[data-act="test"]').click();
      await wait(60);
      const set = (id, v) => {
        const el = document.getElementById(id);
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      set('tm-class', 'paladin');
      set('tm-act', '1');
      set('tm-wave', '1');
      const g = window.__startTest();
      g.player.invulnerable = true;
      for (const e of g.enemies) Object.assign(e, { x: g.player.x + 2000, y: g.player.y }); // nobody in reach yet
    });
    const seen = [];
    const sample = async (ms) => {
      for (let t = 0; t < ms; t += 50) {
        // three ticks through the real input, then let a frame draw him
        const a = await inPage(() => (window.__lb.run(3, false, 'input'), new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(window.__lb.anim().anim))))));
        if (seen[seen.length - 1] !== a) seen.push(a);
      }
    };
    await sample(500); // standing
    await page.keyboard.down('KeyD');
    await sample(600);
    await page.keyboard.up('KeyD');
    await inPage(() => {
      const g = window.__lb.game, p = g.player, e = g.enemies.find((x) => !x.dead);
      if (e) Object.assign(e, { x: p.x + 40, y: p.y, hp: 1e6, maxHp: 1e6 }); // a foe steps into his reach
    });
    await sample(1500);
    const sheets = await inPage(() => window.__lb.sheets());
    const order = ['idle', 'walk', 'attack'].map((a) => seen.indexOf(a));
    const ok = sheets.includes('paladin') && order.every((i) => i >= 0) && order[0] < order[1] && order[1] < order[2];
    return { ok, detail: `sheets [${sheets.join(', ')}]; ${seen.join(' → ')}; ${await inPage(() => window.__lb.state)}` };
  }),
);

// ---------- #155: the test-mode gallery plays every rigged sprite, and the class select shows the Paladin from his sheet ----------
await check('Sprite gallery plays the Paladin; his class card shows his sheet (#155)', () =>
  inPage(() => location.reload()).then(async () => {
    await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu' && window.__lb.sheets().includes('paladin'));
    return inPage(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Settings').click();
      await wait(150);
      document.querySelector('[data-act="test"]').click();
      await wait(60);
      const frames = {};
      for (let i = 0; i < 20; i++) {
        for (const c of document.querySelectorAll('[data-sheet="paladin"]')) (frames[c.dataset.anim] ??= new Set()).add(c.dataset.frame);
        await wait(80);
      }
      // every animation shows up, and each one with more than one frame moves
      const moving = ['idle', 'walk', 'attack', 'hurt', 'death'].every((a) => frames[a]?.size > 1);
      document.querySelector('.testmode [data-back]').click(); // to Settings
      await wait(100);
      document.querySelector('[data-act="back"]').click(); // to the title
      await wait(100);
      document.querySelector('[data-go="start"]').click();
      await wait(100);
      const c = document.querySelector('[data-class="paladin"] .portrait canvas');
      // the sheet's idle frame cropped to the figure (about 55 art px tall, drawn at 2x), shown at the old portrait's 84 px
      const box = Math.round(c.getBoundingClientRect().height);
      const ok = moving && c.height >= 100 && box === 84;
      return { ok, detail: `${Object.entries(frames).map(([a, f]) => `${a} ${f.size}`).join(', ')}; portrait canvas ${c.width}×${c.height}, shown ${box} px` };
    });
  }),
);

// ---------- #156: every champion draws from its rigged sheet: it attacks a foe in reach, and casts when Space uses its ability ----------
await check('Champion sheets: each class loads its sheet, attacks and casts its ability (#156)', async () => {
  const out = [];
  for (const cls of ['paladin', 'viking', 'angel', 'necromancer', 'archer']) {
    await inPage(() => location.reload());
    await page.waitForFunction((c) => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu' && window.__lb.sheets().includes(c), cls);
    await inPage(async (c) => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Settings').click();
      await wait(150);
      document.querySelector('[data-act="test"]').click();
      await wait(60);
      const set = (id, v) => {
        const el = document.getElementById(id);
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      set('tm-class', c);
      set('tm-act', '1');
      set('tm-wave', '1');
      const g = window.__startTest();
      g.player.invulnerable = true;
    }, cls);
    const seen = new Set();
    const sample = async (ms) => {
      for (let t = 0; t < ms; t += 50) seen.add(await inPage(() => (window.__lb.run(3, false, 'input'), new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(window.__lb.anim().anim)))))));
    };
    for (let i = 0; i < 12 && !seen.has('attack'); i++) {
      await inPage(() => {
        const g = window.__lb.game, p = g.player, [e, ...rest] = g.enemies.filter((x) => !x.dead);
        for (const x of rest) Object.assign(x, { x: p.x + 2000, y: p.y });
        if (e) Object.assign(e, { x: p.x + 40, y: p.y, hp: 1e6, maxHp: 1e6 }); // one foe in reach, once the wave has spawned
      });
      await sample(250);
    }
    await inPage(() => Object.assign(window.__lb.game.player, { abilityCd: 0 }));
    await page.keyboard.down('Space');
    await sample(150);
    await page.keyboard.up('Space');
    await sample(300);
    out.push([cls, seen.has('attack') && seen.has('cast'), [...seen].join('/')]);
  }
  return { ok: out.every(([, ok]) => ok), detail: out.map(([c, , s]) => `${c}: ${s}`).join('; ') };
});

// ---------- #245: the Paladin redrawn as a holy warrior: silver-white plate, gold, a blue cape and no red; his blade blazes on the cast; in a
// run a blow plays his shield block, Space his cast and E his Challenge, and on the field he still shows plate, gold and blue ----------
await check('Paladin look: silver-white plate, gold and blue, no red; the blade blazes on the cast; a blow is a block in play (#245)', async () => {
  await inPage(() => location.reload());
  await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu' && window.__lb.sheets().includes('paladin'));
  const kinds = `({
    plate: (r, g, b) => r >= 190 && b >= r + 5 && g >= r,
    gold: (r, g, b) => r > 180 && g > 110 && b < 90,
    blue: (r, g, b) => b > 130 && b > r + 60,
    red: (r, g, b) => r > 120 && g < 70 && b < 70,
    blaze: (r, g, b) => r >= 250 && g >= 235 && b >= 170 && b <= 245,
  })`;
  // the test-mode gallery: his idle in his new colours, his cast row at its brightest against his idle
  const gallery = await inPage(async (kinds) => {
    const K = eval(kinds), wait = (ms) => new Promise((r) => setTimeout(r, ms));
    [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Settings').click();
    await wait(150);
    document.querySelector('[data-act="test"]').click();
    await wait(60);
    const count = (anim) => {
      const c = document.querySelector(`[data-sheet="paladin"][data-anim="${anim}"]`), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      const n = Object.fromEntries(Object.keys(K).map((k) => [k, 0]));
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) for (const k in K) if (K[k](d[i], d[i + 1], d[i + 2])) n[k]++;
      return n;
    };
    const idle = count('idle');
    let blaze = 0;
    const hurt = new Set();
    for (let i = 0; i < 25; i++) {
      blaze = Math.max(blaze, count('cast').blaze);
      hurt.add(document.querySelector('[data-sheet="paladin"][data-anim="hurt"]').dataset.frame);
      await wait(60);
    }
    document.querySelector('.testmode [data-back]').click();
    await wait(100);
    document.querySelector('[data-act="back"]').click();
    await wait(100);
    return { idle, blaze, hurt: hurt.size };
  }, kinds);
  // a Paladin run in test mode: a foe at his side strikes him, then Space and E, played through the keys
  await inPage(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Settings').click();
    await wait(150);
    document.querySelector('[data-act="test"]').click();
    await wait(60);
    const set = (id, v) => {
      const el = document.getElementById(id);
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    set('tm-class', 'paladin');
    set('tm-act', '1');
    set('tm-wave', '1');
    set('tm-level', '5'); // Challenge, his utility, unlocks at level 3
    window.__startTest();
  });
  const seen = new Set(), hurtFrames = new Set();
  const sample = async (ms) => {
    for (let t = 0; t < ms; t += 50) {
      const a = await inPage(() => (window.__lb.run(3, false, 'input'), new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(window.__lb.anim()))))));
      seen.add(a.anim);
      if (a.anim === 'hurt') hurtFrames.add(a.frame);
    }
  };
  for (let i = 0; i < 16 && !seen.has('hurt'); i++) {
    await inPage(() => {
      const g = window.__lb.game, p = g.player, [e, ...rest] = g.enemies.filter((x) => !x.dead);
      for (const x of rest) Object.assign(x, { x: p.x + 2000, y: p.y });
      if (e) Object.assign(e, { x: p.x + 30, y: p.y, hp: 1e6, maxHp: 1e6 }); // one foe at his side, tough enough to keep striking
      Object.assign(p, { hp: p.stats.hp, invulnerable: false });
    });
    await sample(250);
  }
  await sample(400); // the block plays through
  // on the field, at game size: the pixels where he stands show his plate, gold and blue
  const field = await inPage((kinds) => {
    const K = eval(kinds), lb = window.__lb, p = lb.game.player, cam = lb.camera();
    lb.draw();
    const c = document.getElementById('game').getContext('2d');
    const x = Math.round((p.x - 30 - Math.round(cam.x)) * cam.zoom), y = Math.round((p.y - 60 - Math.round(cam.y)) * cam.zoom);
    const d = c.getImageData(x, y, Math.round(60 * cam.zoom), Math.round(66 * cam.zoom)).data;
    const n = Object.fromEntries(Object.keys(K).map((k) => [k, 0]));
    for (let i = 0; i < d.length; i += 4) for (const k in K) if (K[k](d[i], d[i + 1], d[i + 2])) n[k]++;
    return n;
  }, kinds);
  await inPage(() => Object.assign(window.__lb.game.player, { abilityCd: 0, hp: window.__lb.game.player.stats.hp }));
  await page.keyboard.down('Space');
  await sample(150);
  await page.keyboard.up('Space');
  await sample(600);
  await inPage(() => Object.assign(window.__lb.game.player, { utilityCd: 0, hp: window.__lb.game.player.stats.hp }));
  await page.keyboard.down('KeyE');
  await sample(150);
  await page.keyboard.up('KeyE');
  await sample(400);
  const { idle } = gallery;
  const ok = idle.plate >= 60 && idle.gold >= 60 && idle.blue >= 60 && idle.red === 0 && gallery.blaze >= 3 * Math.max(1, idle.blaze) && gallery.hurt === 3
    && seen.has('hurt') && hurtFrames.size >= 2 && seen.has('cast') && seen.has('skill') && field.plate >= 20 && field.gold >= 20 && field.blue >= 20;
  return { ok, detail: `gallery idle ${JSON.stringify(idle)}, cast blaze ${gallery.blaze}, hurt frames ${gallery.hurt}; in play ${[...seen].join('/')} (hurt frames ${[...hurtFrames].join(',')}); on the field ${JSON.stringify(field)}` };
});

// ---------- #156: at the attack-speed cap the Viking swings a short swing that keeps up, and E plays his Leap, not a walk ----------
await check('Fast attacks and Leap: the swing keeps up at the cap, E leaps without running legs (#156)', async () => {
  await inPage(() => location.reload());
  await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu' && window.__lb.sheets().includes('viking'));
  await inPage(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Settings').click();
    await wait(150);
    document.querySelector('[data-act="test"]').click();
    await wait(60);
    const set = (id, v) => {
      const el = document.getElementById(id);
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    set('tm-class', 'viking');
    set('tm-act', '1');
    set('tm-wave', '1');
    set('tm-level', '5'); // the utility ability unlocks at level 3
    window.__startTest().player.invulnerable = true;
  });
  const frame = () => inPage(() => (window.__lb.run(1, false, 'input'), new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(window.__lb.anim()))))));
  const pin = () => inPage(() => {
    const g = window.__lb.game, p = g.player, [e, ...rest] = g.enemies.filter((x) => !x.dead);
    p.stats.atkSpd = 50; // far past the 4.5 a second cap
    for (const x of rest) Object.assign(x, { x: p.x + 2000, y: p.y });
    if (e) Object.assign(e, { x: p.x + 40, y: p.y, hp: 1e6, maxHp: 1e6 });
    return !!e;
  });
  for (let i = 0; i < 40 && !(await pin()); i++) await inPage(() => window.__lb.run(10, false, 'input'));
  const swing = [];
  for (let i = 0; i < 40; i++) {
    await pin();
    swing.push(await frame());
  }
  const attacking = swing.filter((f) => f.anim === 'attack');
  const windUp = attacking.filter((f) => f.frame < 3).length; // ready and wind-up frames are skipped at this speed
  await pin();
  await inPage(() => Object.assign(window.__lb.game.player, { utilityCd: 0 }));
  await page.keyboard.down('KeyE');
  const leap = [await frame()];
  await page.keyboard.up('KeyE');
  for (let i = 0; i < 4; i++) leap.push(await frame());
  const ok = attacking.length >= swing.length * 0.8 && windUp === 0 && leap.some((f) => f.anim === 'skill') && !leap.some((f) => f.anim === 'walk');
  return { ok, detail: `at the cap ${attacking.length}/${swing.length} frames attacking, ${windUp} wind-up; E: ${leap.map((f) => `${f.anim}${f.frame}`).join(' ')}` };
});

// ---------- #247: the Viking is a raider: grey-teal wool and a Dane axe, no ginger beard; his rage roars, his hurt shrugs off the blow ----------
await check('Viking raider: the gallery shows his teal wool and no ginger beard; Space plays the war cry and the drop back, a blow plays his hurt to the straightening up (#247)', async () => {
  await inPage(() => location.reload());
  await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu' && window.__lb.sheets().includes('viking'));
  const look = await inPage(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Settings').click();
    await wait(150);
    document.querySelector('[data-act="test"]').click();
    await wait(200);
    // the idle cell in the gallery, counted by colour: the teal ramp (his coat, tunic, trousers) against the old ginger beard's ramp
    const c = document.querySelector('[data-sheet="viking"][data-anim="idle"]');
    const px = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const hex = (i) => '#' + [px[i], px[i + 1], px[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('');
    const teal = new Set(['#303d3d', '#475756', '#61726f', '#7e8f8b', '#9dada8']), ginger = new Set(['#7a3a12', '#a85a1c', '#cf7f2e', '#e8a54c']);
    let t = 0, g = 0;
    for (let i = 0; i < px.length; i += 4) if (px[i + 3] > 0) (teal.has(hex(i)) && t++, ginger.has(hex(i)) && g++);
    const set = (id, v) => {
      const el = document.getElementById(id);
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    set('tm-class', 'viking');
    set('tm-act', '1');
    set('tm-wave', '1');
    window.__startTest().player.invulnerable = true;
    return { teal: t, ginger: g, cell: `${c.width / 2}×${c.height / 2}` };
  });
  const frame = () => inPage(() => (window.__lb.run(1, false, 'input'), new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(window.__lb.anim()))))));
  // one foe in reach, the rest far away; once the wave has spawned
  const pin = () => inPage(() => {
    const g = window.__lb.game, p = g.player, [e, ...rest] = g.enemies.filter((x) => !x.dead);
    for (const x of rest) Object.assign(x, { x: p.x + 2000, y: p.y });
    if (e) Object.assign(e, { x: p.x + 30, y: p.y, hp: 1e6, maxHp: 1e6 });
    return !!e;
  });
  for (let i = 0; i < 40 && !(await pin()); i++) await inPage(() => window.__lb.run(10, false, 'input'));
  // Berserker Rage on Space: the hunch, the war cry with the axe raised (frame 3, held longest) and the drop back into the hold
  await inPage(() => Object.assign(window.__lb.game.player, { abilityCd: 0, attackTimer: 1e6 })); // no swing in the way of the cast
  await page.keyboard.down('Space');
  const cast = [await frame()];
  await page.keyboard.up('Space');
  for (let i = 0; i < 60; i++) cast.push(await frame());
  const castFrames = new Set(cast.filter((f) => f.anim === 'cast').map((f) => f.frame));
  // a foe's blow: he hunches into it and straightens up, three frames, with no swing of his own to hide it
  await inPage(() => Object.assign(window.__lb.game.player, { invulnerable: false, attackTimer: 1e6 }));
  const hurt = [];
  for (let i = 0; i < 400 && !(hurt.some((f) => f.anim === 'hurt' && f.frame === 2)); i++) {
    await pin();
    await inPage(() => { const p = window.__lb.game.player; p.hp = Math.max(p.hp, p.stats.hp * 0.9); p.attackTimer = Math.max(p.attackTimer, 100); });
    hurt.push(await frame());
  }
  await inPage(() => (window.__lb.game.player.invulnerable = true));
  const hurtFrames = new Set(hurt.filter((f) => f.anim === 'hurt').map((f) => f.frame));
  // sampled a step at a time, the short first frames can slip between samples: the roar (3) and the drop back (4) exist only in the
  // new five-frame cast, the straightening up (2) only in the new three-frame hurt
  const ok = look.teal > 200 && look.ginger === 0 && castFrames.has(3) && castFrames.has(4) && hurtFrames.has(2);
  return { ok, detail: `gallery idle ${look.cell}: ${look.teal} teal px, ${look.ginger} ginger px; cast frames ${[...castFrames].sort().join(',')}; hurt frames ${[...hurtFrames].sort().join(',')} after ${hurt.length} steps` };
});

// ---------- #156: the Viking's swing leaves a tapered trail, not a flat wedge; the walk keeps pace with the ground at 1.5x and under a heavy slow ----------
await check('Swing trail and walk pace: a crescent trail on the swing; the feet follow the ground fast and slowed (#156)', async () => {
  await inPage(() => location.reload());
  await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu' && window.__lb.sheets().includes('viking'));
  await inPage(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Settings').click();
    await wait(150);
    document.querySelector('[data-act="test"]').click();
    await wait(60);
    const set = (id, v) => {
      const el = document.getElementById(id);
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    set('tm-class', 'viking');
    set('tm-act', '1');
    set('tm-wave', '1');
    window.__startTest().player.invulnerable = true;
  });
  // the trail: drawn with and without the fresh swing's effect, the canvas changes on the crescent but not inside it, where the old wedge was
  const trail = await inPage(async () => {
    const lb = window.__lb, g = lb.game, p = g.player;
    let fx = null;
    for (let i = 0; i < 300 && !fx; i++) {
      const [e, ...rest] = g.enemies.filter((x) => !x.dead);
      for (const x of rest) Object.assign(x, { x: p.x + 2000, y: p.y });
      if (e) Object.assign(e, { x: p.x + 40, y: p.y, hp: 1e6, maxHp: 1e6 });
      lb.run(1, false, 'input');
      fx = g.effects.find((x) => x.kind === 'arc' && x.t < 0.05);
    }
    if (!fx) return null;
    const c = document.getElementById('game').getContext('2d'), cam = lb.camera();
    const probe = (k) => {
      const a = fx.angle + 0.6, wx = fx.x + Math.cos(a) * fx.r * k, wy = fx.y + Math.sin(a) * fx.r * k;
      return [...c.getImageData(Math.round((wx - Math.round(cam.x)) * cam.zoom), Math.round((wy - Math.round(cam.y)) * cam.zoom), 1, 1).data];
    };
    g.shake = 0; // no screen shake between the two draws
    lb.draw();
    const on = [probe(0.82), probe(0.4)];
    g.effects = g.effects.filter((x) => x !== fx);
    lb.draw();
    const off = [probe(0.82), probe(0.4)];
    const d = (i) => Math.round(Math.hypot(on[i][0] - off[i][0], on[i][1] - off[i][1], on[i][2] - off[i][2]));
    return { crescent: d(0), inside: d(1) };
  });
  // the walk: D held for a second at 1.5x and at a heavy slow; walk frames stepped against the distance the feet should take
  const walk = [];
  for (const mult of [1.5, 0.35]) {
    const r = await inPage(async (mult) => {
      const lb = window.__lb, g = lb.game, p = g.player;
      g.enemies.length = 0;
      p.x = g.arena.w * 0.25; // room to walk right: the 1.5x walk used to reach the wall and leave the slow walk none
      p.stats.baseMove ??= p.stats.moveSpd;
      p.stats.moveSpd = p.stats.baseMove * mult; // a fast build (movement talents, Ghost Step) or a heavy slow
      return { x: p.x, speed: p.cls.base.moveSpd }; // the walk's base: the class's own speed, as the renderer uses
    }, mult);
    await page.keyboard.down('KeyD');
    let steps = 0, last = null;
    for (let i = 0; i < 40; i++) {
      const f = await inPage(() => (window.__lb.game.enemies.length = 0, window.__lb.run(1, false, 'input'), new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => res(window.__lb.anim()))))));
      if (f.anim === 'walk' && last !== null && f.frame !== last) steps += (f.frame - last + 8) % 8;
      last = f.anim === 'walk' ? f.frame : null;
    }
    await page.keyboard.up('KeyD');
    const dist = await inPage((x0) => window.__lb.game.player.x - x0, r.x);
    const want = dist / ((r.speed * 0.8) / 8); // WALK_STRIDE: 8 frames per 0.8 s of base-speed travel
    walk.push({ mult, dist: Math.round(dist), steps, ratio: want > 0 ? steps / want : 0 });
  }
  const ok = !!trail && trail.crescent > 20 && trail.inside < 8 && walk.every((w) => w.ratio > 0.7 && w.ratio < 1.3) && walk[0].dist > walk[1].dist * 3;
  return { ok, detail: `trail ${trail ? `changes ${trail.crescent} on the crescent, ${trail.inside} inside` : 'not seen'}; ${walk.map((w) => `${w.mult}x: ${w.dist} px, ${w.steps} frames (${w.ratio.toFixed(2)} of the ground)`).join('; ')}` };
});

// ---------- #156: the Midnight colours turn every champion night-blue on the class card (a hue shift used to turn the Necromancer green) ----------
await check('Midnight colours: every champion turns night-blue on the class select (#156)', async () => {
  await inPage(() => location.reload());
  await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu' && ['paladin', 'viking', 'angel', 'necromancer', 'archer'].every((c) => window.__lb.sheets().includes(c)));
  await inPage(() => { window.__lb.save.palettes = [3]; document.querySelector('[data-go="start"]').click(); });
  await page.waitForSelector('[data-start]');
  const out = [];
  for (const c of ['paladin', 'viking', 'angel', 'necromancer', 'archer']) {
    const sw = page.locator(`[data-palette="${c}:3"]`);
    await sw.scrollIntoViewIfNeeded();
    await sw.click(); // the card is drawn again in its new colours
    out.push(await inPage((id) => {
      const cv = document.querySelector(`[data-class="${id}"] .portrait canvas`), px = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < px.length; i += 4) if (px[i + 3] > 128) (r += px[i]), (g += px[i + 1]), (b += px[i + 2]);
      return { id, blue: b > r && b > g };
    }, c));
  }
  await inPage(() => document.querySelector('[data-back]').click());
  return { ok: out.every((o) => o.blue), detail: out.map((o) => `${o.id} ${o.blue ? 'blue' : 'not blue'}`).join(', ') };
});

// ---------- #156: the champions' allies: raised skeletons walk up and strike, the Angel's decoy and the Archer's shade are drawn from their sheets, the shade looses ----------
await check("Allies: raised skeletons walk and strike, the Angel's decoy and the Archer's shade play from their sheets (#156)", async () => {
  const start = async (cls, evo, key) => {
    await inPage(() => location.reload());
    await page.waitForFunction((c) => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu' && window.__lb.sheets().includes(c), cls === 'necromancer' ? 'skeleton' : cls);
    await inPage(async ([c, ev]) => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Settings').click();
      await wait(150);
      document.querySelector('[data-act="test"]').click();
      await wait(60);
      const set = (id, v) => {
        const el = document.getElementById(id);
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      set('tm-class', c);
      set('tm-act', '1');
      set('tm-wave', '1');
      set('tm-level', '5'); // the utility ability unlocks at level 3
      const g = window.__startTest();
      g.player.invulnerable = true;
      if (ev) g.evolutions = [ev]; // test mode has no evolution picker
    }, [cls, evo]);
    const pin = () => inPage(() => {
      const g = window.__lb.game, p = g.player, [e, ...rest] = g.enemies.filter((x) => !x.dead);
      for (const x of rest) Object.assign(x, { x: p.x + 2000, y: p.y });
      if (e) Object.assign(e, { x: p.x + 160, y: p.y, vx: 0, vy: 0, hp: 1e6, maxHp: 1e6, speed: 0 }); // one foe standing still, a walk away
      return !!e;
    });
    for (let i = 0; i < 40 && !(await pin()); i++) await inPage(() => window.__lb.run(10, false, 'input'));
    await inPage((k) => {
      const g = window.__lb.game, p = g.player;
      if (k === 'Space') for (let i = 0; i < 6; i++) g.corpses.push({ x: p.x - 60, y: p.y + 10 * i, t: 0 });
      Object.assign(p, { abilityCd: 0, utilityCd: 0 });
    }, key);
    await page.keyboard.down(key);
    await inPage(() => window.__lb.run(2, false, 'input'));
    await page.keyboard.up(key);
    return pin;
  };
  const watch = async (pin, kind, frames) => {
    const seen = new Set();
    for (let i = 0; i < frames; i++) {
      await pin();
      const a = await inPage((k) => (window.__lb.run(3, false, 'input'), new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(window.__lb.minionAnim(k)))))), kind);
      seen.add(a ? a.anim : 'none');
    }
    return seen;
  };
  const bones = await watch(await start('necromancer', null, 'Space'), 'skeleton', 90);
  const decoy = await watch(await start('angel', 'phaseWalk', 'KeyE'), 'decoy', 10);
  const shade = await watch(await start('archer', 'shadowStep', 'KeyE'), 'shade', 60);
  const ok = bones.has('walk') && bones.has('attack') && !decoy.has('none') && decoy.has('idle') && shade.has('attack'); // the shade fades after a few seconds
  return { ok, detail: `skeleton: ${[...bones].join('/')}; decoy: ${[...decoy].join('/')}; shade: ${[...shade].join('/')}` };
});

// ---------- #158: every boss loads its sheet, the gallery plays each one's special, and the Usurper stands tallest ----------
await check('Boss sheets: all eight bosses and the Royal Flame load and play their special and phase pose in the gallery; the Usurper is the tallest (#158)', () =>
  inPage(() => location.reload()).then(async () => {
    const bosses = ['blackKnight', 'warlord', 'lich', 'inquisitor', 'abbot', 'dragon', 'warden', 'usurper'];
    await page.waitForFunction((ids) => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu' && ids.every((id) => window.__lb.sheets().includes(id)), [...bosses, 'royalFlame']).catch(() => {});
    return inPage(async (bosses) => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const loaded = window.__lb.sheets();
      [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Settings').click();
      await wait(150);
      document.querySelector('[data-act="test"]').click();
      await wait(60);
      // the figure's height in the gallery (every boss is drawn at the same scale in the arena): opaque rows of its idle, at its
      // tallest over the loop (the canvas shows whichever idle frame is up, and the bob moves the figure by a few pixels)
      const tall = (id) => {
        const c = document.querySelector(`[data-sheet="${id}"][data-anim="idle"]`), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let top = -1, bot = -1;
        for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3]) { if (top < 0) top = y; bot = y; break; }
        return bot - top + 1;
      };
      const h = {};
      const frames = {}, phase = {};
      for (let i = 0; i < 25; i++) {
        for (const id of bosses) if (id !== 'dragon') h[id] = Math.max(h[id] ?? 0, tall(id));
        for (const id of bosses) for (const c of document.querySelectorAll(`[data-sheet="${id}"][data-anim="special"]`)) (frames[id] ??= new Set()).add(c.dataset.frame);
        for (const id of bosses) for (const c of document.querySelectorAll(`[data-sheet="${id}"][data-anim="phase"]`)) (phase[id] ??= new Set()).add(c.dataset.frame);
        await wait(80);
      }
      document.querySelector('.testmode [data-back]').click();
      await wait(100);
      document.querySelector('[data-act="back"]').click();
      await wait(100);
      const missing = [...bosses, 'royalFlame'].filter((id) => !loaded.includes(id));
      const still = bosses.filter((id) => !(frames[id]?.size > 1));
      const noPhase = bosses.filter((id) => !(phase[id]?.size > 1));
      const tallest = Object.entries(h).every(([id, v]) => id === 'usurper' || h.usurper > v * 1.1);
      return { ok: !missing.length && !still.length && !noPhase.length && tallest, detail: `missing [${missing}]; special not playing [${still}]; phase not playing [${noPhase}]; heights ${Object.entries(h).map(([k, v]) => `${k} ${v}`).join(', ')}` };
    }, bosses);
  }),
);

// ---------- #158: a boss with a rigged sheet walks, winds up its special over the telegraph, releases it, and falls ----------
await check('Black Knight sheet: walks, winds up and releases his charge on its telegraph, rallies into his second phase, then falls (#158)', () =>
  inPage(() => location.reload()).then(async () => {
    await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu' && window.__lb.sheets().includes('blackKnight'));
    await inPage(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Settings').click();
      await wait(150);
      document.querySelector('[data-act="test"]').click();
      await wait(60);
      const set = (id, v) => {
        const el = document.getElementById(id);
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      set('tm-class', 'paladin');
      set('tm-arena', 'courtyard');
      set('tm-act', '1');
      set('tm-wave', '5'); // the courtyard's wave boss
      window.__startTest().player.invulnerable = true;
    });
    const boss = () => inPage(() => {
      const lb = window.__lb, g = lb.game;
      for (let i = 0; i < 1200 && !g.enemies.some((e) => e.def.id === 'blackKnight'); i++) lb.run(1, false, 'input');
      return g.enemies.some((e) => e.def.id === 'blackKnight');
    });
    if (!(await boss())) return { ok: false, detail: 'no Black Knight came' };
    const seen = [];
    const sample = async (ms) => {
      for (let t = 0; t < ms; t += 50) {
        const a = await inPage(() => (window.__lb.run(3, false, 'input'), new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(window.__lb.foeAnim('blackKnight')?.anim))))));
        if (a && seen[seen.length - 1] !== a) seen.push(a);
      }
    };
    await inPage(() => {
      const g = window.__lb.game, p = g.player, e = g.enemies.find((x) => x.def.id === 'blackKnight');
      for (const o of g.enemies) if (o !== e) o.hp = 0.01, o.x = p.x + 3000; // the escort out of the way
      Object.assign(e, { x: p.x + 300, y: p.y, special: 0.6, hp: 1e6, maxHp: 1e6 }); // his charge comes soon
    });
    await sample(4000);
    await inPage(() => {
      const e = window.__lb.game.enemies.find((x) => x.def.id === 'blackKnight');
      Object.assign(e, { hp: e.maxHp * 0.45, state: 0, special: 99, telegraph: null }); // below half: his second phase (out of any wind-up: it reads its telegraph)
    });
    await sample(800);
    await inPage(() => {
      const g = window.__lb.game, p = g.player, e = g.enemies.find((x) => x.def.id === 'blackKnight');
      Object.assign(e, { x: p.x + 40, y: p.y, hp: 1, maxHp: 1e6, state: 0, special: 99, telegraph: null }); // into the Paladin's reach, one blow from death
    });
    let fell = [];
    for (let i = 0; i < 60 && !fell.includes('blackKnight'); i++) fell = await inPage(() => (window.__lb.run(3, false, 'input'), new Promise((r) => requestAnimationFrame(() => r(window.__lb.foesDying())))));
    const ok = ['walk', 'special', 'phase'].every((a) => seen.includes(a)) && fell.includes('blackKnight');
    return { ok, detail: `${seen.join(' → ')}; fallen [${fell.join(', ')}]` };
  }),
);

// ---------- #157: the foes' rigged sheets: a peasant walks up, jabs on his wind-up, and falls when slain ----------
await check('Peasant sheet: he walks up, jabs, and plays his death when slain (#157)', () =>
  inPage(() => location.reload()).then(async () => {
    await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu' && window.__lb.sheets().includes('peasant'));
    await inPage(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Settings').click();
      await wait(150);
      document.querySelector('[data-act="test"]').click();
      await wait(60);
      const set = (id, v) => {
        const el = document.getElementById(id);
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      set('tm-class', 'paladin');
      set('tm-act', '1');
      set('tm-wave', '1');
      const g = window.__startTest();
      g.player.invulnerable = true;
      const peasants = g.enemies.filter((e) => e.def.id === 'peasant');
      for (const [i, e] of g.enemies.entries()) Object.assign(e, { x: g.player.x + (e === peasants[0] ? 160 : 3000 + i * 40), y: g.player.y, hp: 1e6, maxHp: 1e6 });
    });
    const seen = [];
    for (let t = 0; t < 5000 && !seen.includes('attack'); t += 50) {
      if (seen.includes('walk')) {
        await inPage(() => {
          // he has walked: now he stands at the Paladin's side
          const g = window.__lb.game, e = g.enemies.find((x) => x.def.id === 'peasant' && Math.abs(x.x - g.player.x) < 400);
          if (e) Object.assign(e, { x: g.player.x + 22, y: g.player.y });
        });
      }
      const a = await inPage(() => (window.__lb.run(3, false, 'input'), new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(window.__lb.foeAnim('peasant')?.anim ?? 'none'))))));
      if (seen[seen.length - 1] !== a) seen.push(a);
    }
    // slain: his death plays where he stood
    const dying = await inPage(() => {
      const g = window.__lb.game, e = g.enemies.find((x) => x.def.id === 'peasant' && Math.abs(x.x - g.player.x) < 200);
      if (e) Object.assign(e, { hp: 1 });
      return new Promise((r) => {
        let n = 0;
        const tick = () => {
          window.__lb.run(2, false, 'input');
          requestAnimationFrame(() => (window.__lb.foesDying().includes('peasant') || ++n > 60 ? r(window.__lb.foesDying()) : tick()));
        };
        tick();
      });
    });
    const ok = seen.includes('walk') && seen.includes('attack') && dying.includes('peasant');
    return { ok, detail: `${seen.join(' → ')}; dying [${dying.join(', ')}]` };
  }),
);

// ---------- #166: rendering runs every frame but the sim only every tick; a walking foe holds its pose across the extra draws ----------
await check('Foe sheets: a walking peasant keeps its walk frame across render frames with no new sim tick (#166)', () =>
  inPage(() => location.reload()).then(async () => {
    await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu' && window.__lb.sheets().includes('peasant'));
    await inPage(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Settings').click();
      await wait(150);
      document.querySelector('[data-act="test"]').click();
      await wait(60);
      const set = (id, v) => {
        const el = document.getElementById(id);
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      set('tm-class', 'paladin');
      set('tm-act', '1');
      set('tm-wave', '1');
      const g = window.__startTest();
      g.player.invulnerable = true;
      const peasants = g.enemies.filter((e) => e.def.id === 'peasant');
      // far from the player, so he walks and never comes into swinging reach
      for (const [i, e] of g.enemies.entries()) Object.assign(e, { x: g.player.x + (e === peasants[0] ? 400 : 3000 + i * 40), y: g.player.y, hp: 1e6, maxHp: 1e6 });
    });
    let walking = false;
    for (let t = 0; t < 5000 && !walking; t += 50) {
      const a = await inPage(() => (window.__lb.run(3, false, 'input'), new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(window.__lb.foeAnim('peasant')?.anim ?? 'none'))))));
      walking = a === 'walk';
    }
    // several renders in a row with no `run()` between them: same sim tick, so the flicker (a stale bug would drop to idle here) must not show
    const frames = await inPage(() => {
      const out = [];
      for (let i = 0; i < 8; i++) (window.__lb.draw(), out.push(window.__lb.foeAnim('peasant')));
      return out;
    });
    const held = frames.every((f) => f && f.anim === frames[0].anim && f.frame === frames[0].frame);
    const ok = walking && held && frames[0]?.anim === 'walk';
    return { ok, detail: `walking before hold: ${walking}; held frames [${frames.map((f) => `${f?.anim}:${f?.frame}`).join(', ')}]` };
  }),
);

// ---------- #157: every redrawn foe loads its sheet, and a ranged foe (the Crossbowman) levels and looses on his shot ----------
await check('Foe sheets: every redrawn foe and commander loads; a crossbowman plays his shot (#157)', () =>
  inPage(() => location.reload()).then(async () => {
    const want = ['peasant', 'wolf', 'crossbow', 'cavalry', 'ballista', 'plagueCart', 'siegeTower', 'siegeCamp', 'knight', 'cultist', 'shieldBearer', 'priest', 'engineer', 'plagueDoctor', 'houndmaster', 'mirrorKnight', 'assassin', 'shieldwall', 'boneCollector', 'bannerman', 'drummer', 'chaplain'];
    await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu' && window.__lb.sheets().includes('crossbow'));
    const sheets = await inPage(() => window.__lb.sheets());
    const missing = want.filter((id) => !sheets.includes(id));
    await inPage(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Settings').click();
      await wait(150);
      document.querySelector('[data-act="test"]').click();
      await wait(60);
      for (const [id, v] of [['tm-class', 'paladin'], ['tm-act', '1'], ['tm-wave', '1']]) {
        const el = document.getElementById(id);
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const g = window.__startTest();
      g.player.invulnerable = true;
      for (let i = 0; i < 200 && !g.enemies.length; i++) window.__lb.run(1, false, 'input'); // the wave's first foe
      const [e] = g.enemies;
      e.def = window.__lb.enemyDef('crossbow'); // the first foe becomes a crossbowman
      for (const [i, x] of g.enemies.entries()) Object.assign(x, { x: g.player.x + (x === e ? 180 : 3000 + i * 40), y: g.player.y, hp: 1e6, maxHp: 1e6 });
    });
    const seen = [];
    for (let t = 0; t < 6000 && !seen.includes('attack'); t += 50) {
      const a = await inPage(() => (window.__lb.run(3, false, 'input'), new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(window.__lb.foeAnim('crossbow')?.anim ?? 'none'))))));
      if (seen[seen.length - 1] !== a) seen.push(a);
    }
    return { ok: missing.length === 0 && seen.includes('attack'), detail: `missing [${missing.join(', ')}]; crossbow ${seen.join(' → ')}` };
  }),
);

// ---------- #165: the Plague Cart is rolled by the event, not its own (zero) config speed; it must keep a valid walk frame, not vanish ----------
await check('Plague Cart: keeps a valid walk frame while it crosses, though its base speed is 0 (#165)', () =>
  inPage(() => location.reload()).then(async () => {
    await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu' && window.__lb.sheets().includes('plagueCart'));
    await inPage(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Settings').click();
      await wait(150);
      document.querySelector('[data-act="test"]').click();
      await wait(60);
      for (const [id, v] of [['tm-class', 'paladin'], ['tm-act', '1'], ['tm-wave', '1']]) {
        const el = document.getElementById(id);
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const g = window.__startTest();
      g.player.invulnerable = true;
      for (let i = 0; i < 200 && !g.enemies.length; i++) window.__lb.run(1, false, 'input'); // the wave's first foe
      const [e] = g.enemies;
      e.def = window.__lb.enemyDef('plagueCart'); // the first foe becomes the cart
      Object.assign(e, { baseSpeed: 0, x: g.player.x + 150, y: g.player.y, hp: 1e6, maxHp: 1e6 }); // its own speed is 0: the event moves it by hand (systems/events.ts)
      for (const x of g.enemies) if (x !== e) Object.assign(x, { x: g.player.x + 3000, y: g.player.y }); // everyone else out of the way
    });
    const frames = [];
    for (let i = 0; i < 20; i++) {
      frames.push(
        await inPage(() => {
          window.__lb.game.enemies[0].x += 5; // rolls across, same as the event's moveTo
          window.__lb.run(1, false, 'input');
          return window.__lb.foeAnim('plagueCart');
        }),
      );
    }
    const walking = frames.filter((f) => f?.anim === 'walk');
    const ok = walking.length > 0 && walking.every((f) => Number.isFinite(f.frame) && f.frame >= 0);
    return { ok, detail: frames.map((f) => `${f?.anim ?? 'none'}${f?.frame ?? ''}`).join(' ') };
  }),
);
// ---------- #159: every arena draws its ground props from the rig's atlas, and the keep's braziers flicker ----------
await check('Arenas: every arena shows its rigged props; the braziers flicker; pickups are rigged (#159)', () =>
  inPage(() => location.reload()).then(async () => {
    await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu' && window.__lb.props());
    const out = [];
    for (const arena of ['courtyard', 'graveyard', 'keep', 'bastion']) {
      if (out.length) {
        await inPage(() => location.reload());
        await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu' && window.__lb.props());
      }
      out.push(
        await inPage(async (arena) => {
          const lb = window.__lb, wait = (ms = 60) => new Promise((r) => setTimeout(r, ms));
          [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Settings').click();
          await wait(150);
          document.querySelector('[data-act="test"]').click();
          await wait();
          const el = document.getElementById('tm-arena');
          el.value = arena;
          el.dispatchEvent(new Event('change', { bubbles: true }));
          const g = window.__startTest();
          g.player.invulnerable = true;
          // the quest board comes up on the first frames: set out without a quest, and let the run go
          for (let i = 0; i < 40 && !(lb.state === 'playing' && g.time > 0.3); i++) {
            if (lb.state === 'choice') lb.run(1, false, 'input');
            await wait(50);
          }
          // the atlas, read back, against the baked ground: each obstacle's prop is in the arena, pixel for pixel at its anchor column
          const img = new Image();
          img.src = 'sprites/props.png';
          await img.decode();
          const atlas = document.createElement('canvas');
          [atlas.width, atlas.height] = [img.width, img.height];
          atlas.getContext('2d').drawImage(img, 0, 0);
          const a = atlas.getContext('2d'), ground = lb.arenaCanvas(g.arena.id).getContext('2d');
          // kind: [atlas row y, anchor x, anchor y, a solid pixel's y in the cell, drawn for radius] (src/render/props.json)
          const P = { pillar: [0, 38, 80, 50, 30], tomb: [172, 24, 48, 35, 18], tree: [236, 60, 98, 70, 26], throne: [356, 60, 100, 70, 44] };
          let props = 0, wrong = 0;
          for (const o of g.arena.obstacles) {
            const m = P[o.kind];
            if (!m) continue;
            const k = o.r / m[4];
            const want = a.getImageData(m[1], m[0] + m[3], 1, 1).data;
            const got = ground.getImageData(Math.round(o.x), Math.round(o.y + (m[3] - m[2]) * k), 1, 1).data;
            props++;
            if (k === 1 && Math.hypot(want[0] - got[0], want[1] - got[1], want[2] - got[2]) > 8) wrong++;
          }
          // a brazier on screen: its flame changes from frame to frame
          let flicker = null;
          const b = g.arena.obstacles.find((o) => o.kind === 'brazier');
          if (b) {
            Object.assign(g.player, { x: b.x - 120, y: b.y });
            await wait(200);
            const cam = lb.camera(), c = document.getElementById('game').getContext('2d');
            const seen = new Set();
            for (let i = 0; i < 12; i++) {
              g.enemies.length = 0;
              const px = c.getImageData(Math.round((b.x - cam.x) * cam.zoom) - 12, Math.round((b.y - 40 - cam.y) * cam.zoom) - 12, 24, 24).data;
              seen.add(px.join(',').length + ':' + px.reduce((s, v) => s + v, 0));
              await wait(60);
            }
            flicker = seen.size;
            if (flicker < 2) flicker = `${flicker} (${lb.state}, time ${g.time.toFixed(2)})`;
          }
          // the ground pickups: an xp gem, a big one and a coin next to the champion, drawn once (no tick, so none is picked up)
          let pickups = null;
          if (arena === 'keep') {
            const drops = [['xp', 1, 508, 7], ['xp', 10, 522, 7], ['gold', 1, 536, 6]].map(([kind, value, row, at], i) => ({ kind, value, row, at, x: Math.round(g.player.x) + 40 + i * 30, y: Math.round(g.player.y) - 60 }));
            g.enemies.length = 0;
            g.pickups.push(...drops.map(({ kind, value, x, y }) => ({ kind, value, x, y })));
            lb.draw();
            const cam = lb.camera(), c = document.getElementById('game').getContext('2d');
            pickups = drops.filter((d) => {
              const want = a.getImageData(d.at, d.row + d.at, 1, 1).data; // the anchor
              const got = c.getImageData(Math.round((d.x - Math.round(cam.x)) * cam.zoom), Math.round((d.y - Math.round(cam.y)) * cam.zoom), 1, 1).data;
              return Math.hypot(want[0] - got[0], want[1] - got[1], want[2] - got[2]) <= 8;
            }).length;
          }
          return { arena, props, wrong, flicker, pickups };
        }, arena),
      );
    }
    const ok = out.every((r) => r.wrong === 0) && out.find((r) => r.arena === 'graveyard').props > 0 && typeof out.find((r) => r.arena === 'keep').flicker === 'number' && out.find((r) => r.arena === 'keep').pickups === 3;
    return { ok, detail: out.map((r) => `${r.arena}: ${r.props} props${r.wrong ? ` (${r.wrong} WRONG)` : ''}${r.flicker === null ? '' : `, flame ${r.flicker} looks`}${r.pickups === null ? '' : `, ${r.pickups}/3 pickups drawn from the atlas`}`).join('; ') };
  }),
);

// ---------- #159: the wings' features are rigged props, and the Graveyard's hands claw up out of their circles ----------
await check('Arenas: the altar, strongbox, lair and cache are drawn props; grasping hands rise in their telegraphs (#159)', () =>
  inPage(() => location.reload()).then(async () => {
    await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu' && window.__lb.props());
    const out = [];
    for (const arena of ['bastion', 'graveyard', 'keep']) {
      if (out.length) {
        await inPage(() => location.reload());
        await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu' && window.__lb.props());
      }
      out.push(
        await inPage(async (arena) => {
          const lb = window.__lb, wait = (ms = 60) => new Promise((r) => setTimeout(r, ms));
          [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Settings').click();
          await wait(150);
          document.querySelector('[data-act="test"]').click();
          await wait();
          const el = document.getElementById('tm-arena');
          el.value = arena;
          el.dispatchEvent(new Event('change', { bubbles: true }));
          const g = window.__startTest();
          g.player.invulnerable = true;
          for (let i = 0; i < 40 && !(lb.state === 'playing' && g.time > 0.3); i++) {
            if (lb.state === 'choice') lb.run(1, false, 'input');
            await wait(50);
          }
          const img = new Image();
          img.src = 'sprites/props.png';
          await img.decode();
          const atlas = document.createElement('canvas');
          [atlas.width, atlas.height] = [img.width, img.height];
          atlas.getContext('2d').drawImage(img, 0, 0);
          const a = atlas.getContext('2d'), c = document.getElementById('game').getContext('2d');
          // does the canvas show the atlas pixel (col, row) of a prop whose anchor (ax, ay) sits on world (x, y)?
          const shows = (x, y, ax, ay, col, row) => {
            const cam = lb.camera();
            const wx = Math.round(x - ax) + ax, wy = Math.round(y - ay) + ay;
            const want = a.getImageData(col, row, 1, 1).data;
            const got = c.getImageData(Math.round((wx - Math.round(cam.x)) * cam.zoom), Math.round((wy - Math.round(cam.y)) * cam.zoom), 1, 1).data;
            return Math.hypot(want[0] - got[0], want[1] - got[1], want[2] - got[2]) <= 8;
          };
          // src/render/props.json: atlas row and anchor of each feature's prop
          const F = { shrine: [587, 30, 35], chest: [640, 20, 20], lair: [674, 32, 26], hazard: [715, 24, 24] };
          let features = null;
          const f = g.features[0];
          if (f) {
            // its wing opened, and the feature set down beside the champion so the camera has it (the wing's floor stays walled off)
            g.regionOpen[f.wing] = true;
            Object.assign(f, { x: Math.round(g.player.x) + 150, y: Math.round(g.player.y) });
            features = [];
            for (const kind of Object.keys(F)) {
              f.kind = kind;
              g.enemies.length = 0;
              lb.draw();
              const [row, ax, ay] = F[kind];
              if (shows(f.x, f.y, ax, ay, ax, row + ay)) features.push(kind);
            }
          }
          // the arena's hazard, now: a hand (the Graveyard) or a flame (the keep's braziers) in each telegraph
          g.wave = Math.max(1, g.wave);
          g.hazardT = 0.001;
          for (let i = 0; i < 40 && !g.zones.some((z) => z.art); i++) await wait(25);
          const arts = [...new Set(g.zones.filter((z) => z.art).map((z) => z.art))];
          let hand = null;
          const z = g.zones.find((z) => z.art === 'hands');
          if (z) {
            Object.assign(g.player, { x: z.x - 200, y: z.y });
            g.enemies.length = 0;
            lb.draw();
            const frame = Math.min(2, Math.floor(Math.min(1, z.t / z.delay) * 3));
            hand = shows(z.x, z.y + 8, 16, 42, frame * 32 + 16, 753 + 42); // the earth heaped round the wrist, at the anchor
          }
          return { arena, features, arts, hand };
        }, arena),
      );
    }
    const by = (id) => out.find((r) => r.arena === id);
    const ok = by('bastion').features?.length === 4 && by('graveyard').arts.includes('hands') && by('graveyard').hand === true && by('keep').arts.includes('fire');
    return { ok, detail: out.map((r) => `${r.arena}: ${r.features ? `features ${r.features.join('/') || 'none'}, ` : ''}telegraphs ${r.arts.join('/') || 'none'}${r.hand === null ? '' : `, hand ${r.hand ? 'drawn' : 'MISSING'}`}`).join('; ') };
  }),
);

// ---------- #210: the Great Keep as a fortress: its wings are rooms (forge, armory, chapel, barracks) that open by the start wave ----------
// Test mode, the Great Keep: at wave 1 every gate is shut; at wave 6 (past the mid-Act boss) one wing is open by the start. Walked into with
// the keyboard, the room names its feature ("Forge fires", not "Vents"), and its floor holds its own rigged furniture (anvils, weapon racks,
// bunks), pixel for pixel from the props atlas.
await check('Great Keep: a fortress whose wings are the forge, armory, chapel and barracks, one open by wave 6, walked into, furnished (#210)', async () => {
  const start = (wave, seed) => inPage(() => location.reload()).then(async () => {
    await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu' && window.__lb.props());
    return inPage(async ([wave, seed]) => {
      const lb = window.__lb, wait = (ms = 60) => new Promise((r) => setTimeout(r, ms));
      [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Settings').click();
      await wait(150);
      document.querySelector('[data-act="test"]').click();
      await wait();
      const set = (id, v) => {
        const el = document.getElementById(id);
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      set('tm-arena', 'keep');
      set('tm-act', '1');
      set('tm-wave', String(wave));
      const g = window.__startTest(seed);
      g.player.invulnerable = true;
      for (let i = 0; i < 60 && !(lb.state === 'playing' && g.time > 0.3); i++) {
        if (lb.state === 'choice') lb.run(1, false, 'input');
        await wait(50);
      }
      const open = g.arena.regions.filter((r) => r.id !== 'core' && g.regionOpen[r.id]).map((r) => r.id);
      return { arena: g.arena.id, open, names: g.arena.regions.filter((r) => r.id !== 'core' && r.id !== 'vault').map((r) => r.name), state: lb.state };
    }, [wave, seed]);
  });
  const first = await start(1);
  const later = await start(6, 3); // seed 3 opens the forge first: its fires go by their own name, not "Vents"
  const wing = later.open[0];
  // stand in the open wing's gate, on the core's side, and walk in with the key that points into the wing
  const key = { north: 'KeyW', south: 'KeyS', east: 'KeyD', west: 'KeyA' }[wing];
  await inPage((wing) => {
    const g = window.__lb.game, r = g.arena.regions.find((q) => q.id === wing), core = g.arena.regions.find((q) => q.id === 'core').floor;
    const gx = r.gate.x + r.gate.w / 2, gy = r.gate.y + r.gate.h / 2;
    const x = wing === 'east' ? core.x + core.w - 30 : wing === 'west' ? core.x + 30 : gx;
    const y = wing === 'south' ? core.y + core.h - 30 : wing === 'north' ? core.y + 30 : gy;
    Object.assign(g.player, { x, y });
    g.enemies.length = 0;
    g.texts.length = 0;
    window.__lb.run(1, false, 'input');
  }, wing);
  let walked = null;
  if (key) {
    await page.keyboard.down(key);
    for (let i = 0; i < 12 && !walked?.seen; i++) {
      walked = await inPage((wing) => {
        const lb = window.__lb, g = lb.game;
        g.enemies.length = 0;
        lb.run(10, false, 'input');
        return { seen: g.regionSeen.includes(wing), texts: g.texts.map((t) => t.text) };
      }, wing);
    }
    await page.keyboard.up(key);
  }
  // the wing's furniture, read back from the baked ground against the atlas (src/render/props.json: row y, anchor x, anchor y, a solid pixel's y)
  const props = await inPage(async (wing) => {
    const lb = window.__lb, g = lb.game, r = g.arena.regions.find((q) => q.id === wing);
    const img = new Image();
    img.src = 'sprites/props.png';
    await img.decode();
    const atlas = document.createElement('canvas');
    [atlas.width, atlas.height] = [img.width, img.height];
    atlas.getContext('2d').drawImage(img, 0, 0);
    const a = atlas.getContext('2d'), ground = lb.arenaCanvas(g.arena.id).getContext('2d');
    const P = { pillar: [0, 38, 80, 50], anvil: [853, 38, 50, 50], rack: [925, 40, 81, 40], bunk: [1026, 38, 30, 20] };
    const inWing = g.arena.obstacles.filter((o) => o.x >= r.floor.x && o.x <= r.floor.x + r.floor.w && o.y >= r.floor.y && o.y <= r.floor.y + r.floor.h);
    const kinds = [...new Set(inWing.map((o) => o.kind))];
    const drawn = inWing.filter((o) => {
      const m = P[o.kind];
      if (!m) return false;
      const want = a.getImageData(m[1], m[0] + m[3], 1, 1).data;
      const got = ground.getImageData(Math.round(o.x), Math.round(o.y + m[3] - m[2]), 1, 1).data;
      return Math.hypot(want[0] - got[0], want[1] - got[1], want[2] - got[2]) <= 8;
    }).length;
    return { kinds, count: inWing.length, drawn, name: r.name };
  }, wing);
  const want = { north: ['the forge', 'Forge fires', 'anvil'], east: ['the armory', 'Strongbox', 'rack'], south: ['the chapel', 'Shrine', 'pillar'], west: ['the barracks', 'Lair', 'bunk'] }[wing] ?? [];
  const ok = first.arena === 'keep' && first.open.length === 0 && later.open.length === 1
    && later.names.join() === 'the forge,the armory,the chapel,the barracks'
    && walked?.seen === true && walked.texts.some((t) => t.includes(want[1]))
    && props.name === want[0] && props.kinds.join() === want[2] && props.count === 4 && props.drawn === 4;
  return { ok, detail: `wave 1: ${first.open.length} wings open; wave 6: ${later.open.join('/') || 'none'} open (${props.name}); walked in ${walked?.seen ? 'yes' : 'NO'}, it says "${walked?.texts.find((t) => t.includes(want[1])) ?? walked?.texts.join(' | ') ?? ''}"; furniture ${props.kinds.join('/')} x${props.count}, ${props.drawn} drawn from the atlas; wings: ${later.names.join(', ')}` };
});


// ---------- #194: one 6-set bonus a run: a test run holding six Flame and six Frost relics lights only one family's 6 ----------
await check('Relics: with six Flame and six Frost relics held, only one family reaches its 6-set bonus; the other stops at its 4 (#194)', () =>
  inPage(() => location.reload()).then(async () => {
    await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu');
    return inPage(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const set = (el, v) => {
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Settings').click();
      await wait(150);
      document.querySelector('[data-act="test"]').click();
      await wait(100);
      set(document.getElementById('tm-class'), 'angel'); // the Angel finds six of each: its class relics are Flame and Frost ones
      const ids = ['brimstoneOil', 'emberheart', 'cinderCharm', 'salamanderScale', 'dragonsTongue', 'sunfireCenser', 'frostBrand', 'wintersGrasp', 'shatterglass', 'glacialHeart', 'everfrostCrown', 'frostwardHalo'];
      for (const id of ids) set(document.querySelector(`#tm-relics select[data-relic="${id}"]`), '1');
      const g = window.__startTest();
      g.player.invulnerable = true;
      await wait(400); // the HUD draws the family row
      const tip = (icon) => [...document.querySelectorAll('#h-families .fam-chip')].find((c) => c.textContent.startsWith(icon))?.dataset.tip ?? '';
      const flame = tip('🔥'), frost = tip('❄️');
      const six = [/Inferno/.test(flame), /Rimewalker/.test(frost)];
      const four = [/Pyre/.test(flame), /Shatter/.test(frost)];
      const ok = g.player.relics.held.length === 12 && six.filter(Boolean).length === 1 && four.every(Boolean);
      return { ok, detail: `${g.player.relics.held.length} held; Flame: "${flame.split('\n')[0]}"; Frost: "${frost.split('\n')[0]}"` };
    });
  }),
);

// ---------- #196: the starter commons: Berserker Tooth speeds you up at full HP, Serrated Edge opens 7 bleed stacks ----------
await check("Relics: at full HP a test run with Berserker Tooth already attacks 10% faster, and its HUD tile and Serrated Edge's say so (#196)", () =>
  inPage(() => location.reload()).then(async () => {
    await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu');
    return inPage(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const set = (el, v) => {
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Settings').click();
      await wait(150);
      document.querySelector('[data-act="test"]').click();
      await wait(100);
      set(document.getElementById('tm-class'), 'viking');
      for (const id of ['berserkerTooth', 'serratedEdge']) set(document.querySelector(`#tm-relics select[data-relic="${id}"]`), '1');
      const g = window.__startTest();
      g.player.invulnerable = true;
      await wait(400); // a few ticks: the tooth's bonus and the HUD tiles
      const tip = (id) => document.querySelector(`#h-relics .relic[data-id="${id}"]`)?.dataset.tip ?? '';
      const tooth = tip('berserkerTooth'), edge = tip('serratedEdge');
      const full = g.player.hp >= g.player.stats.hp, spd = g.player.relics.dyn.atkSpd ?? 0;
      const ok = full && Math.abs(spd - 0.1) < 1e-6 && /\+10% attack speed/.test(tooth) && /7 bleed stacks/.test(edge);
      const line = (t, re) => t.split('\n').find((l) => re.test(l)) ?? t.split('\n')[0];
      return { ok, detail: `HP ${full ? 'full' : 'not full'}, relic attack speed +${Math.round(spd * 100)}%; tooth: "${line(tooth, /attack speed/)}"; edge: "${line(edge, /bleed/)}"` };
    });
  }),
);

// ---------- #167: no frame in the sprite gallery is cut off at its cell: nothing opaque on a cell's edge ----------
await check('Sprite gallery: no frame of any sheet is cut off at the edge of its cell; the Warlord swings and falls in full (#167)', () =>
  inPage(() => location.reload()).then(async () => {
    await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu' && ['warlord', 'abbot', 'dragon', 'viking'].every((id) => window.__lb.sheets().includes(id)));
    return inPage(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Settings').click();
      await wait(150);
      document.querySelector('[data-act="test"]').click();
      await wait(100);
      // the gallery draws each art pixel as 2x2: a cell's edge is its canvas's outer 2 px
      const seen = new Set(), cut = new Set();
      for (let i = 0; i < 40; i++) {
        for (const c of document.querySelectorAll('[data-sheet]')) {
          const key = `${c.dataset.sheet} ${c.dataset.anim} ${c.dataset.frame}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, w = c.width, h = c.height;
          const a = (x, y) => d[(y * w + x) * 4 + 3];
          let hit = false;
          for (let x = 0; x < w && !hit; x++) hit = !!(a(x, 0) || a(x, 1) || a(x, h - 1) || a(x, h - 2));
          for (let y = 0; y < h && !hit; y++) hit = !!(a(0, y) || a(1, y) || a(w - 1, y) || a(w - 2, y));
          if (hit) cut.add(key);
        }
        await wait(70);
      }
      document.querySelector('.testmode [data-back]').click();
      await wait(100);
      document.querySelector('[data-act="back"]').click();
      await wait(100);
      const warlord = [...seen].filter((k) => /^warlord (attack|death) /.test(k)).length;
      return { ok: !cut.size && seen.size > 150 && warlord >= 6, detail: `${seen.size} frames looked at (${warlord} of the Warlord's swing and fall); cut off: [${[...cut].slice(0, 8)}]` };
    });
  }),
);

// ---------- #168: the sprite frame cache stays bounded without thrashing, and the gallery leaves it alone ----------
await check('Frame cache: the sprite gallery adds nothing to it; a run through Act III stays under its cap and never re-renders a frame (#168)', async () => {
  const all = await inPage(() => window.__lb.frameCache()); // everything the checks since the last reload drew
  return inPage(() => location.reload()).then(async () => {
    await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu' && window.__lb.sheets().includes('paladin'));
    return inPage(async () => {
      const lb = window.__lb, wait = (ms) => new Promise((r) => setTimeout(r, ms));
      [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Settings').click();
      await wait(150);
      const before = lb.frameCache().size;
      document.querySelector('[data-act="test"]').click();
      await wait(1500); // every sheet in the gallery cycles several frames
      const played = new Set([...document.querySelectorAll('[data-sheet]')].map((c) => c.dataset.frame)).size > 1;
      const gallery = lb.frameCache().size - before;
      // a run, drawn every few ticks: Act I, then the Act III waves and their bosses
      const g = window.__startTest();
      g.player.invulnerable = true;
      for (const act of [1, 3])
        for (let i = 0; i < 400 && lb.game && lb.state !== 'results'; i++) {
          if (i === 0 && act > 1) lb.skipTo(act, 1);
          lb.run(6, true);
          lb.draw();
          if (i % 50 === 0) await wait(20); // let real frames draw too
        }
      const run = lb.frameCache();
      return { played, gallery, run };
    });
  }).then(({ played, gallery, run }) => {
    const rate = run.hits / Math.max(1, run.hits + run.misses);
    // every miss filled a new entry: nothing drawn in the run was ever evicted and drawn again
    const ok = played && gallery === 0 && run.size <= run.cap && run.misses === run.size && rate > 0.99;
    return { ok: ok && all.size <= all.cap && all.misses === all.size, detail: `gallery added ${gallery} frames${played ? '' : ' (and did not play)'}; run: ${run.size}/${run.cap} frames, ${run.misses} misses, hit rate ${(rate * 100).toFixed(2)}%; the checks before: ${all.size} frames, ${all.misses} misses` };
  });
});

// ---------- #60: the Marches' levels 1 and 2 are the tutorial, on flash cards ----------
// A new save, only the foes' and marks' cards seen: a full run shows no tutorial card. Map -> the Marches -> FIGHT: the opening pick and the
// quest board come first with no card over them, then "Move and fight" (closed with Enter or a tap on Got it), then relics once one is held, the ability a few
// seconds in, "Level up" before its screen (which opens once the card is closed), the utility when it unlocks and a status once a foe
// near the champion burns (as level 2's Flame relics make them); each one once, kept in the save, with an icon and no spotlight
for (const [w, h, touch] of [[1280, 720, false], [844, 390, true]]) {
  await check(`Marches tutorial: level 1 teaches moving, relics, the ability, champion XP (no level-up screen, #238) and a status on flash cards, once each, none in a full run, ${touch ? 'tap' : 'Enter'} at ${w}x${h} (#60)`, async () => {
    const TUTORIAL = ['move', 'relics', 'ability', 'levelUp', 'utility', 'sets', 'status'];
    const p = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    const fresh = async () => {
      await p.goto(`http://localhost:${PORT}/?debug`);
      await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
      await p.evaluate((tut) => { const lb = window.__lb; lb.save.cards.splice(0, lb.save.cards.length, ...lb.cardIds.filter((id) => !tut.includes(id))); }, TUTORIAL);
    };
    const press = (sel) => (touch ? p.locator(sel).first().tap() : p.locator(sel).first().click());
    // a full run (#204: the Daily Trial): the bot plays a while and no tutorial card comes up
    await fresh();
    await beginDaily(p);
    await p.waitForFunction(() => !!window.__lb.game);
    const full = await p.evaluate(() => {
      const lb = window.__lb, cards = [];
      lb.game.player.invulnerable = true;
      for (let i = 0; i < 1500 && lb.game && lb.state !== 'results'; i++) {
        const c = document.querySelector('[data-card]');
        if (c) cards.push(c.dataset.card);
        lb.run(1, false, true);
      }
      return cards;
    });
    // the Marches level 1 by the real screens
    await fresh();
    await press('[data-go="map"]');
    await press('.wm-realm.r-marches');
    await p.locator('.rr-panel').waitFor({ timeout: 3000 });
    await press('[data-fight]');
    await p.locator('[data-pick]').first().waitFor({ timeout: 5000 });
    const opening = await p.evaluate(() => ({ pick: document.querySelectorAll('[data-pick]').length, card: !!document.querySelector('[data-card]'), level: window.__lb.game.level?.level }));
    await press('[data-pick="0"]');
    // then the quest board, set out as it is; the move card follows once the run is on. #208: under load the card can come up between
    // two looks, so only a screen's own button is answered here (never the card's Got it), with time to spare for slow frames
    const answer = p.locator(':is([data-pick], [data-leave]):not([data-card] *)').first();
    for (let i = 0; i < 40 && !(await p.locator('[data-card]').count()); i++) {
      if ((await p.evaluate(() => window.__lb.state)) === 'choice' && (await answer.count())) await (touch ? answer.tap({ timeout: 2000 }) : answer.click({ timeout: 2000 })).catch(() => {});
      await p.waitForTimeout(150);
    }
    await p.locator('[data-card="move"]').waitFor({ timeout: 10000 }).catch(() => {});
    const look = () => p.evaluate(() => {
      const c = document.querySelector('#overlay > .kit-frame.flash-card[data-card]');
      if (!c) return null;
      const r = c.getBoundingClientRect(), b = c.querySelector('[data-leave]').getBoundingClientRect();
      return {
        id: c.dataset.card, name: c.querySelector('h2').textContent, text: c.querySelector('p').textContent, icon: c.querySelector('.card-pic.icon')?.textContent.trim() ?? '',
        ribbon: c.querySelector('.kit-ribbon')?.textContent.trim(), state: window.__lb.state, spot: !!window.__lb.spotlight,
        fits: r.left >= -1 && r.right <= innerWidth + 1 && b.bottom <= innerHeight + 1 && b.top >= -1, saved: window.__lb.save.cards.includes(c.dataset.card),
      };
    });
    const move = await look();
    const tick0 = await p.evaluate(() => window.__lb.game.tick);
    await p.waitForTimeout(300); // real frames: the run waits under the card
    const held = (await p.evaluate(() => window.__lb.game.tick)) === tick0;
    if (touch) await p.locator('[data-card] [data-leave]').tap();
    else await p.keyboard.press('Enter');
    const closed = await p.waitForFunction(() => !document.querySelector('[data-card]') && window.__lb.state === 'playing', null, { timeout: 3000 }).then(() => true, () => false);
    // then play on (the bot moves; run() answers each screen and card through its button): note every card and when it came
    const seen = await p.evaluate((tut) => {
      const lb = window.__lb, g = lb.game, out = [];
      g.player.invulnerable = true;
      let burnt = false;
      for (let i = 0; i < 9000 && lb.game === g && lb.state !== 'results'; i++) {
        const c = document.querySelector('[data-card]');
        if (c && tut.includes(c.dataset.card)) {
          const e = { id: c.dataset.card, name: c.querySelector('h2').textContent, tick: g.tick, icon: !!c.querySelector('.card-pic.icon'), spot: !!lb.spotlight, levelUps: g.pendingLevelUps, xp: g.player.xp, screenUnder: !!document.querySelector('.levelup') };
          lb.run(1, false, true); // Got it, and a step
          e.screenAfter = !!document.querySelector('.levelup [data-pick]'); // #238: no level-up screen follows the XP card
          out.push(e);
          continue;
        }
        const need = ['move', 'relics', 'ability', 'levelUp'].every((id) => lb.save.cards.includes(id)); // #238: the utility unlocks at champion level 2, so its card waits for level 2
        if (need && !burnt && lb.state === 'playing') { // as a Flame relic does in level 2: a foe near the champion catches fire
          const foe = g.enemies.find((f) => !f.dead && !f.hidden && Math.hypot(f.x - g.player.x, f.y - g.player.y) < 300);
          if (foe) { foe.statuses.burn = { stacks: 1, time: 3, power: 1 }; burnt = true; }
        }
        if (burnt && lb.save.cards.includes('status')) break;
        lb.run(1, false, true);
      }
      return { out, cards: [...lb.save.cards], level: g.level?.level };
    }, TUTORIAL);
    await p.close();
    const ids = seen.out.map((e) => e.id);
    const at = (id) => seen.out.find((e) => e.id === id);
    const want = ['relics', 'ability', 'levelUp', 'status'];
    const lvl = at('levelUp');
    const ok = full.every((id) => !TUTORIAL.includes(id)) && opening.pick > 0 && !opening.card && opening.level === 1
      && move?.id === 'move' && move.name === 'Move and fight' && /WASD/.test(move.text) && move.icon && move.ribbon === 'New' && move.state === 'choice' && !move.spot && move.fits && move.saved && held && closed
      && want.every((id) => ids.filter((x) => x === id).length === 1) && !ids.includes('move') && seen.out.every((e) => e.icon && !e.spot)
      && at('relics').tick >= 120 && at('ability').tick >= 480 && lvl.name === 'Champion XP' && lvl.xp > 0 && lvl.levelUps === 0 && !lvl.screenUnder && !lvl.screenAfter && !ids.includes('utility')
      && TUTORIAL.filter((id) => id !== 'sets' && id !== 'utility').every((id) => seen.cards.filter((x) => x === id).length === 1) && errs.length === 0;
    return { ok, detail: `full run: ${full.filter((id) => TUTORIAL.includes(id)).length} tutorial cards (${full.length} cards); level ${opening.level}: opening pick ${opening.pick ? 'first' : 'MISSING'}${opening.card ? ' UNDER A CARD' : ''}; "${move?.name ?? 'no move card'}" ${move ? `(${move.icon}, fits ${move.fits}, held ${held}, closed ${closed})` : ''}; then ${seen.out.map((e) => `${e.id}@${e.tick}`).join(', ')}${lvl ? `; level-up card with ${lvl.levelUps} pending, screen after ${lvl.screenAfter}` : ''}${errs.length ? `; errors: ${errs[0]}` : ''}` };
  });
}

// ---------- #202: the Marches crowned: level 7's Warden as the crown boss (each phase held 12 s, his Judgement last), the Grave pick, then the signature relic ----------
// From the title through the map and the road to level 7 (levels 1-6 cleared), the bot fights wave 40 with a strong blow on every swing, so
// only the crown's hold keeps him up. Then the level's Grave rare (key 1 or a tap) and the crown's gold card (Enter or a tap).
for (const [w, h, touch] of [[1280, 720, false], [844, 390, true]]) {
  await check(`Marches crown: level 7's Warden holds each phase 12 s and ends in his Judgement; the Grave pick, then the gold signature relic (${touch ? 'tap' : 'Enter'}), at ${w}x${h} (#202)`, async () => {
    const p = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`http://localhost:${PORT}/?debug`);
    await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
    const press = (sel) => (touch ? p.locator(sel).first().tap() : p.locator(sel).first().click());
    await p.evaluate((run) => {
      window.__lb.save.champions = { paladin: { name: 'Hild', inventory: [], loadouts: {}, ...window.__lb.build.grown({ marches: [6] }), world: { marches: [6] }, signature: false, lastBastion: false, runs: { marches: run } } }; // #237: its realm run at level 7
    }, runAt(7));
    await press('[data-go="map"]');
    await press('.wm-realm.r-marches');
    await p.locator('.rr-panel').waitFor({ timeout: 3000 });
    const road = await p.evaluate(() => ({ name: document.querySelector('.rr-name').textContent, text: document.querySelector('.rr-panel').textContent.replace(/\s+/g, ' ') }));
    await press('[data-fight]');
    await p.locator('[data-pick]').first().waitFor({ timeout: 5000 }); // the level's opening pick
    await press('[data-pick="0"]');
    const fight = await p.evaluate(() => {
      const lb = window.__lb, g = lb.game;
      g.player.stats.str *= 40;
      g.enemies.length = 0;
      g.spawnQueue.length = 0;
      g.wave = g.wavesCleared = g.level.last - 1; // straight on to wave 40, the crown boss's wave
      g.breather = 0.01;
      const out = { crown: false, banner: '', born: -1, phases: [], end: -1, judgement: false, judged: false, unbroken: false };
      let warden = null;
      for (let i = 0; i < 30000 && lb.state !== 'results'; i++) {
        g.player.invulnerable = true; // every tick: the Paladin's own ability ends it
        lb.run(1, false, true);
        warden ??= g.enemies.find((e) => e.def.id === 'warden') ?? null;
        if (!warden) continue;
        if (out.born < 0) (out.born = g.time), (out.crown = warden.crown), (out.banner = g.banner?.text ?? '');
        const at = +(g.time - out.born).toFixed(2);
        if (out.phases.length < warden.phase - 1) out.phases.push(at);
        if (g.banner?.text === 'The Warden’s judgement') out.judgement = true;
        if (g.banner?.text === 'Judged') out.judged = true; // a seal of the Judgement: the ring inside the ring
        if (g.texts.some((t) => t.text === 'UNBROKEN')) out.unbroken = true;
        if (warden.dead && out.end < 0) out.end = at;
      }
      return { ...out, cleared: !!g.level?.cleared, state: lb.state };
    });
    await p.locator('.rare-pick').first().waitFor({ timeout: 5000 });
    const grave = await p.evaluate(() => ({ head: document.querySelector('.rare-pick .kit-head')?.textContent.trim(), fams: [...document.querySelectorAll('.rare-pick [data-pick]')].map((b) => b.querySelector('.fam').textContent) }));
    if (touch) await p.locator('.rare-pick [data-pick="0"]').tap();
    else await p.keyboard.press('1');
    await p.locator('.crown-pick').waitFor({ timeout: 3000 });
    const crown = await p.evaluate(() => {
      const b = document.querySelector('.crown-pick [data-pick]'), r = b.getBoundingClientRect();
      return { head: document.querySelector('.crown-pick .kit-head')?.textContent.trim(), cards: document.querySelectorAll('.crown-pick [data-pick]').length, name: b.querySelector('h2').textContent, fam: b.querySelector('.fam').textContent, gold: b.classList.contains('signature'), inside: r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 && r.top >= -1 && r.left >= -1 };
    });
    if (touch) await p.locator('.crown-pick [data-pick="0"]').tap();
    else await p.keyboard.press('Enter');
    await p.locator('[data-menu]').waitFor({ timeout: 3000 });
    const champ = await p.evaluate(() => window.__lb.save.champions.paladin);
    await p.close();
    const [p2, p3] = fight.phases, min = 11.9;
    const held = p2 >= min && p3 - p2 >= min && fight.end - p3 >= min;
    const ok = road.name === 'The Marches · Level 7' && /Your signature relic/.test(road.text) && fight.crown && fight.banner === 'The Warden · Crown boss' && held && fight.judgement && fight.judged && fight.unbroken && fight.cleared
      && /The Marches · Level 7 cleared/.test(grave.head) && grave.fams.length === 2 && grave.fams.every((f) => /Grave/.test(f))
      && /The Marches crowned/.test(crown.head) && crown.cards === 1 && crown.name === "Oathkeeper's Seal" && /Signature/.test(crown.fam) && crown.gold && crown.inside
      && champ.signature === true && champ.inventory.includes('oathkeepersSeal') && champ.inventory.length === 2 && champ.world.marches[0] === 7 && errs.length === 0;
    return { ok, detail: `"${road.name}"; ${fight.crown ? 'crown' : 'plain'} Warden ("${fight.banner}"), phase 2 at ${p2} s, phase 3 at ${p3} s, fell at ${fight.end} s${fight.unbroken ? ', UNBROKEN shown' : ''}${fight.judgement ? ', Judgement' : ''}${fight.judged ? ' seals' : ''}, level ${fight.cleared ? 'cleared' : 'not cleared'}; "${grave.head}" (${grave.fams.map((f) => f.trim()).join('/')}); "${crown.head}": ${crown.name} (${crown.fam.trim()}${crown.gold ? ', gold' : ''}${crown.inside ? '' : ', off screen'}); inventory [${champ.inventory.join()}], signature ${champ.signature}${errs.length ? `; errors: ${errs[0]}` : ''}` };
  });
}

// ---------- #204: the Daily Trial is shut until the Marches crown, and says so; crowned, it is today's run with the fixed pool and no loadout ----------
// A fresh save: the title's trial is a locked button naming what opens it, and a click on it opens nothing. Then the champion holds the
// Marches crown (as #202's check wins it), a loadout for the Marches, Armorer's Choice and the Keepsake: the title opens the trial, and its
// run holds no relic and offers no Armorer's pick (both are slots now), finds relics outside the champion's inventory, and plays no level.
for (const [w, h, touch] of [[1280, 720, false], [844, 390, true]]) {
  await check(`Daily Trial: shut with "Opens with the Marches crown" on a new save; crowned, ${touch ? 'a tap' : 'a click'} begins today's run with the fixed pool and no loadout, at ${w}x${h} (#204)`, async () => {
    const p = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`http://localhost:${PORT}/?debug`);
    await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
    const press = (sel) => (touch ? p.locator(sel).first().tap() : p.locator(sel).first().click());
    const title = () => p.evaluate(() => {
      const b = document.querySelector('.kit-title [data-go="daily"]'), r = b?.getBoundingClientRect();
      return b && { disabled: b.disabled, lock: !!b.querySelector('.kit-icon.i-lock'), note: b.querySelector('.lock-note')?.textContent ?? '', inside: r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight + 1 };
    });
    const shut = await title();
    await p.locator('.kit-title [data-go="daily"]').click({ force: true }); // a disabled button: nothing opens
    await p.waitForTimeout(100);
    const stayed = await p.evaluate(() => window.__lb.state === 'menu' && !document.querySelector('.kit-screen.daily') && !!document.querySelector('.kit-title'));
    await p.evaluate(() => {
      const s = window.__lb.save;
      s.champions = { ...s.champions, viking: { name: 'Sigrun', inventory: ['brimstoneOil'], loadouts: { marches: ['brimstoneOil'] }, ...window.__lb.build.grown({ marches: [7] }), world: { marches: [7] }, signature: false, lastBastion: false, runs: {} } };
      s.meta.startRelic = 1; // Armorer's Choice
      s.classes.viking.xp = 1e6; // mastery up to the Keepsake
    });
    await press('[data-go="settings"]');
    await press('.settings [data-act="back"]');
    const open = await title();
    await press('.kit-title [data-go="daily"]');
    await p.locator('.kit-screen.daily [data-start]').waitFor({ timeout: 3000 });
    await press('.kit-screen.daily [data-start]');
    await p.waitForFunction(() => !!window.__lb.game, null, { timeout: 5000 });
    const run = await p.evaluate(() => {
      const g = window.__lb.game, d = new Date(), today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return { daily: g.daily === today, level: !!g.level, held: g.player.relics.held.length, armorer: g.player.relics.offers.some((o) => o.from === 'start'), pool: g.player.relics.pool.length, wider: g.player.relics.pool.some((id) => !window.__lb.save.champions.viking.inventory.includes(id) && window.__lb.game.player.relics.pool.length > 0), curses: g.curses.length };
    });
    await p.close();
    const ok = !!shut && shut.disabled && shut.lock && shut.note === 'Opens with the Marches crown' && shut.inside && stayed
      && !!open && !open.disabled && !open.lock && !open.note && run.daily && !run.level && run.held === 0 && !run.armorer && run.pool > 30 && run.wider && run.curses === 2 && errs.length === 0;
    return { ok, detail: `shut: ${shut ? `disabled ${shut.disabled}, lock ${shut.lock}, "${shut.note}", inside ${shut.inside}` : 'NO BUTTON'}, a click opens nothing ${stayed}; crowned: open ${open ? !open.disabled : 'NO BUTTON'}; run: today's ${run.daily}, level ${run.level}, ${run.held} held, Armorer's pick ${run.armorer}, pool ${run.pool} relics (beyond the inventory ${run.wider}), ${run.curses} curses${errs.length ? `; errors: ${errs[0]}` : ''}` };
  });
}

// ---------- #208: v0.10's whole road, from a new save to the Marches crown, through the real screens ----------
// At 1280x720 with the mouse and keys. The title's Take up arms -> the Viking's card -> Onward makes a new champion (no relics, level 1,
// one slot); the Map tab -> the Marches -> its road -> FIGHT plays level 1, which the bot clears in full (all 6 waves, #243, and its boss;
// the champion can't be hurt, the one shortcut), and its Steel rare (key 1) joins the champion. Back on the road, Loadout slots that rare
// for level 2 and PLAY starts it holding the rare. There the champion stands still at 1 HP until a foe really kills it: "Thou art
// slain", then the champion screen says where it fell, and RESTART plays level 2 again on the same seed, which the bot clears. Levels
// 3-7 each go road -> Loadout (every relic won slotted; the level's own slots are live, the rest idle) -> PLAY, holding the live ones,
// played out to the level's last wave and its rare; level 7's crown Warden falls and the crown's gold card (Enter) gives the signature.
await check('journey: a new champion, its loadout slots, the map, the realm road, level 1 cleared, its relics kept into level 2 after a reload, a fall in level 2 and its restart from the checkpoint, levels 3-7 carrying the run, and the Marches crown pick, click and keys at 1280x720 (#208, #237)', async () => {
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://localhost:${PORT}/?debug`);
  await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
  const press = (sel) => p.locator(sel).first().click();
  const bad = [];
  const want = (cond, what) => { if (!cond) bad.push(what); return cond; };
  const screen = () => p.evaluate(() => ({
    slots: [...document.querySelectorAll('.cs-slot')].map((s) => (s.classList.contains('empty') ? (s.classList.contains('idle') ? '-' : 'o') : s.classList.contains('idle') ? 'r' : 'R')).join(''),
    next: document.querySelector('.cs-next')?.textContent.replace(/\s+/g, ' ').trim() ?? '',
    play: document.querySelector('[data-play]')?.textContent.trim() ?? '',
    empty: !!document.querySelector('.cs-inventory .cs-empty'),
    champ: window.__lb.save.champions.viking ?? null,
  }));
  // the level as the bot plays it, every screen answered by its first option: to its end (`fall`: standing still at 1 HP until slain)
  const playOut = (fall) => p.evaluate((fall) => {
    const lb = window.__lb, g = lb.game, held = [...g.player.relics.held];
    for (let i = 0; i < 80000 && lb.game === g && lb.state !== 'results'; i++) {
      if (lb.state === 'playing') {
        if (fall) g.player.hp = Math.min(g.player.hp, 1);
        else g.player.invulnerable = true;
      }
      lb.run(1, false, !fall);
    }
    return { held, end: [...g.player.relics.held], state: lb.state, cleared: !!g.level?.cleared, over: g.over, wave: g.wave, last: g.level?.last, level: g.level?.level, seed: g.seed, gold: g.gold, plevel: g.player.level };
  }, fall);
  const opening = async () => { // the level's opening pick
    await p.waitForFunction(() => window.__lb.state === 'choice' && !!document.querySelector('[data-pick]'), null, { timeout: 5000 });
    await press('[data-pick="0"]');
  };
  const rarePick = async (n) => { // key 1 takes the first rare
    await p.locator('.rare-pick').waitFor({ timeout: 5000 });
    const pick = await p.evaluate(() => ({ head: document.querySelector('.rare-pick .kit-head')?.textContent.trim() ?? '', fams: [...document.querySelectorAll('.rare-pick [data-pick]')].map((b) => b.querySelector('.fam').textContent.trim()) }));
    want(pick.head === `The Marches · Level ${n} cleared` && pick.fams.length === 2, `level ${n} rare pick "${pick.head}" (${pick.fams.join('/')})`);
    await p.keyboard.press('1');
    return pick;
  };
  const log = [];
  // a new champion from the title: the class select, the Viking, Onward
  await press('[data-go="start"]');
  await press('[data-class="viking"]');
  await press('[data-start]');
  await p.locator('.champion-screen').waitFor({ timeout: 3000 });
  await skipTour(p); // #240: this browser's first champion screen
  const born = await screen();
  want(born.champ?.name === 'Viking' && born.champ.inventory.length === 0 && born.empty && born.slots === 'ooo---' && born.play === 'Play' && /The Marches · Level 1/.test(born.next) && /3 slots\b/.test(born.next), `new champion ${JSON.stringify(born)}`);
  log.push(`new ${born.champ?.name ?? '?'} (${born.slots}, "${born.next}")`);
  // the Map tab -> the Marches -> the road on level 1 -> FIGHT
  await press('.kit-tab[data-tab="map"]');
  await p.locator('.wm-map').waitFor({ timeout: 3000 });
  const open = await p.evaluate(() => [...document.querySelectorAll('.wm-realm')].filter((b) => !b.disabled).map((b) => b.dataset.realm).join());
  want(open === 'marches', `map opens ${open}`);
  await press('.wm-realm.r-marches');
  await p.locator('.rr-panel').waitFor({ timeout: 3000 });
  const road1 = (await p.locator('.rr-name').textContent()).trim();
  want(road1 === 'The Marches · Level 1', `road "${road1}"`);
  await press('[data-fight]');
  await opening();
  const one = await playOut(false);
  want(one.cleared && one.level === 1 && one.wave === one.last && one.state === 'results', `level 1 ${JSON.stringify(one)}`);
  const steel = await rarePick(1);
  want(steel.fams.every((f) => /Steel/.test(f)), 'level 1 rares not Steel');
  await p.locator('[data-menu]').waitFor({ timeout: 3000 });
  const won = (await screen()).champ;
  want(won.inventory.length === 1 && won.world.marches?.[0] === 1, `after level 1 ${JSON.stringify(won)}`);
  log.push(`map ${open} -> "${road1}" -> cleared waves 1-${one.wave}, took a ${steel.fams[0]} rare`);
  // #237: level 1 cleared is the realm run's checkpoint, in the save: after a reload the road goes on at level 2 with level 1's relics kept
  const kept = await p.evaluate(() => window.__lb.save.champions.viking?.runs?.marches ?? null);
  want(kept?.level === 2 && kept.carry?.relics.held.join() === one.end.join() && kept.carry.level === one.plevel && kept.carry.gold === one.gold, `checkpoint ${JSON.stringify(kept && { level: kept.level, held: kept.carry?.relics.held })} after level 1 held ${one.end.join()}`);
  await p.reload();
  await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
  await press('[data-go="map"]');
  await press('.wm-realm.r-marches');
  await p.locator('.rr-panel').waitFor({ timeout: 3000 });
  const road2 = (await p.locator('.rr-name').textContent()).trim();
  const facts2 = await p.evaluate(() => document.querySelector('.rr-facts').textContent.replace(/\s+/g, ' ').trim());
  want(road2 === 'The Marches · Level 2' && new RegExp(`Checkpoint\\s*Level 1 cleared\\s*Relics kept\\s*${one.end.length}\\s*Enemy`).test(facts2) && !/Head start/.test(facts2), `road after level 1 and a reload "${road2}" (${facts2})`);
  log.push(`reloaded: "${road2}", ${facts2}`);
  // Loadout slots the rare: the run is under way, so every slot idles and it stays out (the loadout went in at level 1), PLAY
  await press('[data-loadout]');
  await p.locator('.champion-screen').waitFor({ timeout: 3000 });
  const bare = await screen();
  await press(`.cs-relic[data-relic="${won.inventory[0]}"]`);
  const slotted = await screen();
  want(bare.slots === '------' && /Level 2/.test(bare.next) && /run in progress/.test(bare.next) && slotted.slots === 'r-----' && slotted.champ.loadouts.marches?.join() === won.inventory[0], `level 2 loadout ${bare.slots} -> ${slotted.slots}`);
  await press('[data-play]');
  await opening();
  // the fall: at 1 HP and standing still, the first blow that lands ends it
  const fell = await playOut(true);
  want(fell.over && fell.level === 2 && fell.state === 'results' && fell.held.slice(0, one.end.length).join() === one.end.join() && (!fell.held.includes(won.inventory[0]) || one.end.includes(won.inventory[0])), `the fall ${JSON.stringify(fell)}: level 1 held ${one.end.join()}`);
  await p.locator('.results [data-retry]').waitFor({ timeout: 3000 });
  const slain = await p.evaluate(() => ({ head: document.querySelector('.results .kit-head').textContent.trim(), retry: document.querySelector('[data-retry]').textContent.trim() }));
  want(slain.head === 'Thou art slain' && slain.retry === 'Quick restart · The Marches · Level 2', `results ${JSON.stringify(slain)}`);
  await press('[data-menu]');
  await p.locator('.champion-screen').waitFor({ timeout: 3000 });
  const after = await screen();
  want(after.play === 'Restart' && after.next.includes('Level 2') && after.next.endsWith(`fell at wave ${Math.max(1, fell.wave)}`), `after the fall "${after.next}" ${after.play}`);
  await press('[data-play]');
  await opening();
  const again = await playOut(false);
  want(again.level === 2 && again.seed === fell.seed && again.held.join() === fell.held.join() && again.cleared && again.wave === again.last, `restart ${JSON.stringify(again)}`);
  log.push(`level 2 holding level 1's ${one.end.join()}: "${slain.head}" at wave ${fell.wave}, "${after.next}" -> ${after.play} on the ${again.seed === fell.seed ? 'same' : 'OTHER'} seed with the same relics, cleared`);
  await rarePick(2);
  await p.locator('.level-cleared [data-retry]').waitFor({ timeout: 3000 });
  const onward = (await p.locator('.level-cleared [data-retry]').textContent()).trim();
  want(onward === 'Continue to level 3', `after level 2 the main button says "${onward}"`); // #237: the run goes on; #241: from the level-cleared screen
  // levels 3-7 by the road, every relic won in the loadout: none goes in, the run holds what it found
  let before = again.end; // #237: each level goes on holding what the level before ended with
  for (let n = 3; n <= 7; n++) {
    await p.locator('[data-menu]').waitFor({ timeout: 3000 });
    await press('[data-menu]');
    await p.locator('.rr-panel').waitFor({ timeout: 3000 });
    const road = (await p.locator('.rr-name').textContent()).trim();
    await press('[data-loadout]');
    await p.locator('.champion-screen').waitFor({ timeout: 3000 });
    for (let k = 0; k < 6; k++) {
      const free = p.locator('.cs-relic:not(.on):not(.blocked)');
      if (!(await free.count())) break;
      await free.first().click();
    }
    const lo = await screen();
    const loadout = lo.champ.loadouts.marches ?? [];
    want(road === `The Marches · Level ${n}` && /run in progress/.test(lo.next) && lo.slots.replace(/[-r]/g, '').length === 0 && loadout.length === Math.min(6, lo.champ.inventory.length), `level ${n}: "${road}", ${lo.slots} ("${lo.next}"), loadout ${loadout.join()}`);
    await press('[data-play]');
    await opening();
    const run = await playOut(false);
    want(run.level === n && run.cleared && run.wave === run.last && run.held.slice(0, before.length).join() === before.join(), `level ${n} ${JSON.stringify(run)}: held before ${before.join()}`);
    before = run.end;
    log.push(`L${n} ${lo.slots} held ${run.held.length}`);
    await rarePick(n);
  }
  // the Marches crowned: its gold card, Enter takes it
  await p.locator('.crown-pick').waitFor({ timeout: 3000 });
  const crown = await p.evaluate(() => {
    const b = document.querySelector('.crown-pick [data-pick]');
    return { head: document.querySelector('.crown-pick .kit-head')?.textContent.trim() ?? '', cards: document.querySelectorAll('.crown-pick [data-pick]').length, name: b?.querySelector('h2').textContent ?? '', gold: !!b?.classList.contains('signature') };
  });
  await p.keyboard.press('Enter');
  await p.locator('[data-menu]').waitFor({ timeout: 3000 });
  const end = (await screen()).champ;
  await p.close();
  want(/The Marches crowned/.test(crown.head) && crown.cards === 1 && crown.name === "Jarl's Torc" && crown.gold && end.signature && end.inventory.includes('jarlsTorc') && end.world.marches[0] === 7 && !end.runs.marches, `crown ${JSON.stringify(crown)}, champion ${JSON.stringify(end)}`); // #237: the last level ends the run
  want(errs.length === 0, `errors: ${errs[0]}`);
  log.push(`"${crown.head}": ${crown.name}${crown.gold ? ' (gold)' : ''}, ${end.inventory.length} relics, signature ${end.signature}`);
  return { ok: bad.length === 0, detail: `${log.join('; ')}${bad.length ? `; WRONG: ${bad.join(' | ')}` : ''}` };
});

// ---------- #208: the slot rules left over from #197's check, by touch in phone landscape ----------
// #197 plays a legendary's two slots and the one-legendary rule. Here a Viking with the Keep's two extra slots (Armorer's Choice, the
// Keepsake) and six Marches levels cleared but no realm run in progress (#237: so its run starts at level 1, with five slots: a realm run's
// three and the Keep's two), reached by the champion screen's arrow: two class relics shut out a third ("at most 2"), the signature still
// goes beside them, four Steel relics shut out a fifth ("at most 4 of one family"), six filled leave no free slot, PLAY holds the first
// five; level 1 from the road has the same five live slots, the sixth idle, and its run holds the same five.
await check('slot rules: at most 2 class relics (the signature beside them), 4 of one family, no seventh slot; the five slots of a realm run take the first five, from the champion screen and from the road, tap at 844x390 (#208, #237)', async () => {
  const p = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://localhost:${PORT}/?debug`);
  await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
  const tap = (sel) => p.locator(sel).first().tap();
  await p.evaluate(() => {
    const s = window.__lb.save;
    s.champions = { viking: { name: 'Sigrun', inventory: ['stormbornPelt', 'wolfskin', 'ironhide', 'towerShield', 'thornMail', 'anvilHeart', 'shockSigil', 'jarlsTorc'], loadouts: {}, ...window.__lb.build.grown({ marches: [6] }), world: { marches: [6] }, signature: true, lastBastion: false, runs: {} } };
    s.meta.startRelic = 1; // Armorer's Choice: a slot
    s.classes.viking.xp = 1e6; // mastery up to the Keepsake: a slot
  });
  await tap('[data-go="champion"]'); // the Paladin's screen, then the next champion's arrow: the Viking
  await p.locator('.champion-screen').waitFor({ timeout: 3000 });
  await skipTour(p, true); // #240: this browser's first champion screen
  await tap('[data-champ="1"]');
  await p.locator('.champion-screen .cs-relic').first().waitFor({ timeout: 3000 });
  const look = () => p.evaluate(() => ({
    slots: [...document.querySelectorAll('.cs-slot')].map((s) => (s.classList.contains('empty') ? (s.classList.contains('idle') ? '-' : 'o') : s.classList.contains('idle') ? 'r' : 'R')).join(''),
    blocked: Object.fromEntries([...document.querySelectorAll('.cs-relic.blocked')].map((b) => [b.dataset.relic, b.dataset.why])),
    why: document.querySelector('.cs-why').textContent, next: document.querySelector('.cs-next').textContent.replace(/\s+/g, ' ').trim(),
    loadout: (window.__lb.save.champions.viking.loadouts.marches ?? []).join(),
  }));
  const first = await look();
  await tap('.cs-relic[data-relic="stormbornPelt"]');
  await tap('.cs-relic[data-relic="wolfskin"]');
  const classes = await look();
  await tap('.cs-relic[data-relic="ironhide"]'); // a third class relic: refused, and why
  const third = await look();
  for (const id of ['towerShield', 'thornMail', 'anvilHeart', 'shockSigil']) await tap(`.cs-relic[data-relic="${id}"]`);
  const full = await look();
  await tap('.cs-slot[data-unslot="wolfskin"]'); // one class relic out: a slot is free, and Ironhide would be the fifth Steel
  await tap('.cs-relic[data-relic="ironhide"]');
  const fifth = await look();
  await tap('.cs-relic[data-relic="jarlsTorc"]');
  const six = await look();
  await tap('[data-play]');
  await p.waitForFunction(() => !!window.__lb.game, null, { timeout: 5000 }).catch(() => {});
  const run7 = await p.evaluate(() => ({ level: window.__lb.game?.level?.level, held: window.__lb.game?.player.relics.held.join() ?? '' }));
  // the opening screens answered, then the pause menu's End run, and level 1 (the same five slots) from the road
  await p.waitForFunction(() => window.__lb.state === 'choice', null, { timeout: 5000 }).catch(() => {});
  for (let i = 0; i < 8 && (await p.evaluate(() => window.__lb.state)) === 'choice'; i++) {
    await p.locator('[data-pick], [data-leave]').first().waitFor({ timeout: 3000 }).catch(() => {});
    await tap(await p.locator('[data-pick]').count() ? '[data-pick]' : '[data-leave]');
    await p.waitForTimeout(200);
  }
  await p.waitForFunction(() => window.__lb.state === 'playing', null, { timeout: 5000 }).catch(() => {});
  await p.keyboard.press('Escape');
  await tap('[data-quit]');
  await tap('[data-menu]');
  await p.locator('.champion-screen').waitFor({ timeout: 3000 });
  await tap('.kit-tab[data-tab="map"]');
  await tap('.wm-realm.r-marches');
  await p.locator('.rr-panel').waitFor({ timeout: 3000 });
  await tap('.rr-flag.l-1');
  await tap('[data-loadout]');
  await p.locator('.champion-screen').waitFor({ timeout: 3000 });
  const small = await look();
  await tap('[data-play]');
  await p.waitForFunction(() => !!window.__lb.game, null, { timeout: 5000 }).catch(() => {});
  const run1 = await p.evaluate(() => ({ level: window.__lb.game?.level?.level, held: window.__lb.game?.player.relics.held.join() ?? '' }));
  await p.close();
  const six7 = 'stormbornPelt,towerShield,thornMail,anvilHeart,shockSigil,jarlsTorc';
  const five = six7.split(',').slice(0, 5).join();
  const ok = /Level 1/.test(first.next) && /5 slots/.test(first.next) && first.slots === 'ooooo-' && Object.keys(first.blocked).length === 0
    && classes.loadout === 'stormbornPelt,wolfskin' && classes.blocked.ironhide === 'At most 2 class relics.' && !classes.blocked.jarlsTorc
    && /Ironhide: At most 2 class relics/.test(third.why) && third.loadout === classes.loadout
    && full.slots === 'RRRRRr' && full.blocked.ironhide === 'No free slot for it.' && /No free slot/.test(full.blocked.jarlsTorc ?? '')
    && fifth.blocked.ironhide === 'At most 4 relics of one family.' && /Ironhide: At most 4 relics of one family/.test(fifth.why) && !fifth.loadout.includes('ironhide')
    && six.loadout === six7 && six.slots === 'RRRRRr' && run7.level === 1 && run7.held.split(',').slice(0, 6).join() === five
    && /Level 1/.test(small.next) && /5 slots/.test(small.next) && small.slots === 'RRRRRr' && run1.level === 1 && run1.held.split(',').slice(0, 6).join() === five && errs.length === 0;
  return { ok, detail: `"${first.next}" ${first.slots}; 2 class relics -> Ironhide "${classes.blocked.ironhide ?? '-'}", signature ${classes.blocked.jarlsTorc ? 'blocked' : 'free'}; six in: ${full.slots}, Torc "${full.blocked.jarlsTorc ?? '-'}"; a slot free -> Ironhide "${fifth.blocked.ironhide ?? '-'}"; PLAY holds ${run7.held}; level 1 "${small.next}" ${small.slots}, holds ${run1.held}${errs.length ? `; errors: ${errs[0]}` : ''}` };
});

// ---------- #206: test mode starts any realm level: Settings -> Test mode -> "Start at" a realm level -> the level's run ----------
// On its own page (test mode keeps its last setup, and the other test-mode checks start at an Act and wave): the Iron Hold's level 4
// (not built yet: its realm, ring step and waves, in the arena chosen), through the level's own head start, with its opening pick
await check('test mode: "Start at" a realm level starts that level through its head start, with its opening pick (#206)', async () => {
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://localhost:${PORT}/?debug&dev=1`);
  await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
  await p.getByRole('button', { name: 'Settings', exact: true }).click();
  await p.locator('[data-act="test"]').click();
  if (!(await p.locator('#tm-start').count())) return (await p.close(), { skip: true, detail: 'no realm-level start in this build' });
  await p.locator('#tm-class').selectOption('viking');
  await p.locator('#tm-arena').selectOption('keep');
  const disabled = () => p.evaluate(() => ['tm-act', 'tm-wave', 'tm-level'].map((id) => document.getElementById(id).disabled).join());
  const before = await disabled();
  const label = await p.locator('#tm-start option[value="ironHold:4"]').textContent();
  await p.locator('#tm-start').selectOption('ironHold:4');
  const after = await disabled();
  await p.getByRole('button', { name: /start test run/i }).click();
  await p.waitForFunction(() => window.__lb.state === 'choice' && !!document.querySelector('[data-families]'), null, { timeout: 5000 }).catch(() => {});
  const run = await p.evaluate(() => {
    const g = window.__lb.game;
    return g && { test: g.vars.test, realm: g.level?.realm, level: g.level?.level, last: g.level?.last, start: g.startWave, wave: g.wave, act: g.act, lv: g.player.level, arena: g.arena.id,
      picks: g.pendingAbilityTiers.length, tiers: g.player.upgrades.length, offer: g.player.relics.offers[0]?.from, families: document.querySelector('[data-families]')?.textContent.trim() ?? '', hud: document.body.innerText.includes('TEST') };
  });
  await p.locator('[data-pick="0"]').click().catch(() => {});
  const held = await p.evaluate(() => window.__lb.game.player.relics.held.length);
  await p.close();
  const ok = before === 'false,false,false' && after === 'true,true,true' && /Iron Hold · Level 4 \(waves 25–32\)/.test(label ?? '')
    && run?.test === 1 && run.realm === 'ironHold' && run.level === 4 && run.last === 32 && run.start === 25 && [24, 25].includes(run.wave) && run.act === 3 && run.lv === 10 && run.arena === 'keep' // wave 25 may already have begun (#243: waves 25-32)
    && run.picks === 0 && run.tiers === 3 && run.offer === 'start' && /Steel/.test(run.families) && run.hud && held === 1 && errs.length === 0;
  return { ok, detail: `"${label}"; act/wave/level disabled ${before} -> ${after}; run: ${run ? `test ${run.test}, ${run.realm} level ${run.level}, waves ${run.start}-${run.last} (on wave ${run.wave}, Act ${run.act}), lv ${run.lv}, ${run.arena}, ${run.picks} queued ability picks, ${run.tiers} ability tiers held, offer from ${run.offer} "${run.families}", TEST tag ${run.hud}` : 'none'}; picked -> ${held} held${errs.length ? `; errors: ${errs[0]}` : ''}` };
});

// ---------- #223: the Ember Forge: Settings -> Test mode -> "Start at" the Cinderlands' level 1 -> the opening pick -> the Ember Forge ----------
// The level plays in the Ember Forge (the HUD names it); its lava is baked into the ground (molten orange along a channel, but for a crust
// plate or two; grey stone on the bridge between two runs). Walked into with the keyboard and stood in, the lava burns the champion; walked over the bridge, it doesn't.
await check('Ember Forge: a Cinderlands level plays in the Ember Forge; walk into a lava channel and it burns you, cross at the bridge and it doesn\'t (#223)', async () => {
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://localhost:${PORT}/?debug&dev=1`);
  await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
  await p.evaluate(() => (window.__lb.save.cards = [...window.__lb.cardIds])); // every flash card seen: nothing stops the walk
  await p.getByRole('button', { name: 'Settings', exact: true }).click();
  await p.locator('[data-act="test"]').click();
  if (!(await p.locator('#tm-start option[value="cinderlands:1"]').count())) return (await p.close(), { skip: true, detail: 'no Cinderlands level start in this build' });
  await p.locator('#tm-class').selectOption('viking');
  await p.locator('#tm-start').selectOption('cinderlands:1');
  await p.getByRole('button', { name: /start test run/i }).click();
  await p.locator('[data-pick]').first().waitFor({ timeout: 5000 }); // the level's opening pick
  await p.locator('[data-pick="0"]').click();
  await p.waitForFunction(() => window.__lb.state === 'playing', null, { timeout: 5000 }).catch(() => {});
  const seen = await p.evaluate(() => {
    const lb = window.__lb, g = lb.game, lava = g.arena.lava ?? [];
    const top = lava.filter((c) => c.y === Math.min(...lava.map((q) => q.y))).sort((a, b) => a.x - b.x);
    const ground = lb.arenaCanvas(g.arena.id).getContext('2d');
    const px = (x, y) => [...ground.getImageData(Math.round(x), Math.round(y), 1, 1).data];
    const run = top[1] ?? top[0];
    const molten = run ? [0.15, 0.3, 0.45, 0.6, 0.75, 0.9].map((t) => px(run.x + run.w * t, run.y + run.h / 2)) : [];
    const bridge = top.length > 1 ? px((top[0].x + top[0].w + top[1].x) / 2, top[0].y + top[0].h / 2) : [0, 0, 0];
    return { arena: g.arena.id, realm: g.level?.realm, runs: lava.length, hud: document.body.innerText.includes('The Ember Forge'),
      molten: molten.filter(([r, gg, b]) => r > 150 && r > gg && b < 90).length, bridge, run: run && { x: run.x, y: run.y, w: run.w, h: run.h }, gapX: top.length > 1 ? (top[0].x + top[0].w + top[1].x) / 2 : 0 };
  });
  // walk down with the keyboard from the bank; `into` stops as the champion stands in the middle of the channel, then he stands there
  const walk = async (x, y, stopY) => {
    await p.evaluate(([x, y]) => {
      const g = window.__lb.game;
      Object.assign(g.player, { x, y, invulnerable: false, iFrames: 0 });
      g.enemies.length = 0;
      g.spawnQueue.length = 0;
      window.__lb.run(1, false, 'input');
    }, [x, y]);
    const hp0 = await p.evaluate(() => window.__lb.game.player.hp);
    await p.keyboard.down('KeyS');
    for (let i = 0; i < 40; i++) {
      const at = await p.evaluate((stopY) => {
        const lb = window.__lb, g = lb.game;
        for (let k = 0; k < 3 && g.player.y < stopY; k++) (g.enemies.length = 0), (g.spawnQueue.length = 0), lb.run(1, false, 'input');
        return g.player.y;
      }, stopY);
      if (at >= stopY) break;
    }
    await p.keyboard.up('KeyS');
    return p.evaluate((hp0) => {
      const lb = window.__lb, g = lb.game, texts = [];
      for (let i = 0; i < 75; i++) { // stand there 1.25 s: two or three lava ticks
        g.enemies.length = 0;
        g.spawnQueue.length = 0;
        lb.run(1, false, 'input');
        for (const t of g.texts) if (!texts.includes(t.text)) texts.push(t.text);
      }
      return { lost: Math.round(hp0 - g.player.hp), x: Math.round(g.player.x), y: Math.round(g.player.y), burns: texts.filter((t) => /^-\d/.test(t)).length };
    }, hp0);
  };
  const r = seen.run;
  const into = r ? await walk(r.x + r.w / 2, r.y - 50, r.y + r.h / 2) : null;
  const over = r && seen.gapX ? await walk(seen.gapX, r.y - 50, r.y + r.h / 2) : null;
  await p.close();
  const grey = Math.max(...seen.bridge.slice(0, 3)) - Math.min(...seen.bridge.slice(0, 3)) < 40;
  const ok = seen.arena === 'emberForge' && seen.realm === 'cinderlands' && seen.hud && seen.runs === 6 && seen.molten >= 4 && grey
    && into?.lost > 0 && into.burns > 0 && over?.lost <= 0 && errs.length === 0;
  return { ok, detail: `${seen.realm} level 1 in ${seen.arena} (HUD ${seen.hud ? 'names it' : 'NO'}); ${seen.runs} lava runs, ${seen.molten}/6 molten pixels, bridge rgb ${seen.bridge.slice(0, 3).join(',')}; stood in the lava at ${into?.x},${into?.y}: -${into?.lost} HP (${into?.burns} burns); on the bridge at ${over?.x},${over?.y}: ${over?.lost > 0 ? `-${over.lost}` : 'unhurt'}${errs.length ? `; errors: ${errs[0]}` : ''}` };
});

// ---------- #215: the Forgemaster: Settings -> Test mode -> "Start at" the Iron Hold's level 3 -> the opening pick -> its last wave ----------
// The champion stands beside him and trades plain blows (no ability, no bot moves, unhurt), so the fight goes the same way every run:
// his plate breaks blow by blow, his hammer comes down in a marked arc, each new phase reforges the plate whole, from phase 2 the forge
// presses slam a checkerboard (a third stroke in phase 3), and his fall clears the level.
await check('Forgemaster: test mode starts the Iron Hold level 3; its last wave is his; hammer, presses, plates broken and reforged each phase, level cleared (#215)', async () => {
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://localhost:${PORT}/?debug&dev=1`);
  await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
  await p.getByRole('button', { name: 'Settings', exact: true }).click();
  await p.locator('[data-act="test"]').click();
  if (!(await p.locator('#tm-start option[value="ironHold:3"]').count())) return (await p.close(), { skip: true, detail: 'no realm-level start in this build' });
  await p.locator('#tm-class').selectOption('paladin');
  await p.locator('#tm-arena').selectOption('keep');
  await p.locator('#tm-start').selectOption('ironHold:3');
  await p.evaluate(() => {
    // Start test run, on __startTest's fixed seed (test mode seeds from the clock), so the fight is the same every time
    const now = Date.now;
    Date.now = () => 2654435761;
    try {
      [...document.querySelectorAll('button')].find((b) => /start test run/i.test(b.textContent)).click();
    } finally {
      Date.now = now;
    }
  });
  await p.locator('[data-pick]').first().waitFor({ timeout: 5000 }); // the level's opening pick
  await p.locator('[data-pick="0"]').click();
  const fight = await p.evaluate(() => {
    const lb = window.__lb, g = lb.game;
    const clangs = { n: 0 };
    if (lb.view) {
      const real = lb.view.sfx;
      lb.view.sfx = (n) => ((n === 'clang' && clangs.n++), real(n));
    }
    g.enemies.length = 0;
    g.spawnQueue.length = 0;
    g.wave = g.wavesCleared = g.level.last - 1; // straight on to wave 24, the level's last (#243)
    g.breather = 0.01;
    const out = { wave: 0, id: '', plates: [], broke: false, hammer: [0, 0, 0], presses: [0, 0, 0], reforged: [], phases: [], dead: false };
    let f = null;
    const seen = new WeakSet();
    for (let i = 0; i < 60000 && lb.state !== 'results' && !(f?.dead && g.level.cleared); i++) {
      g.player.invulnerable = true;
      // beside him, trading blows, once this phase has shown its moves (the hammer; from phase 2 the presses too); until then a
      // few steps off, out of reach of his blows but inside his, so he keeps swinging and pressing
      const shown = f && out.hammer[f.phase - 1] > 0 && (f.phase === 1 || out.presses[f.phase - 1] > 0);
      if (f && !f.dead) (g.player.x = f.x - f.r - (shown ? 16 : 220)), (g.player.y = f.y);
      lb.run(1, false, false);
      f ??= g.enemies.find((e) => e.def.boss) ?? null;
      if (!f) continue;
      if (!out.id) (out.id = f.def.id), (out.wave = g.wave), out.plates.push(f.armorHp);
      if (f.phase > out.phases.length + 1) out.phases.push(+g.time.toFixed(1)), out.reforged.push(f.armorHp);
      if (out.phases.length === 0 && f.armorHp !== out.plates[out.plates.length - 1]) out.plates.push(f.armorHp);
      if (f.armorHp === 0) out.broke = true;
      const mine = g.zones.filter((z) => z.owner === f && !seen.has(z)); // the zones one blow set this tick
      for (const z of mine) seen.add(z);
      out.hammer[f.phase - 1] = Math.max(out.hammer[f.phase - 1], mine.filter((z) => z.color === '#f08a1c').length);
      out.presses[f.phase - 1] = Math.max(out.presses[f.phase - 1], mine.filter((z) => z.color === '#9a9aa0').length);
      if (f.dead) out.dead = true;
    }
    return { ...out, max: f?.armorMax, clangs: clangs.n, cleared: !!g.level?.cleared, test: g.vars.test };
  });
  await p.close();
  const oneByOne = fight.plates.length >= 4 && fight.plates.slice(1).every((v, i) => v < fight.plates[i]);
  const ok = fight.test === 1 && fight.wave === 24 && fight.id === 'forgemaster' && fight.plates[0] === 6 && fight.max === 6 && oneByOne && fight.broke && fight.clangs > 0
    && fight.phases.length === 2 && fight.reforged.every((n) => n === 6) && fight.hammer[0] === 5 && fight.presses[0] === 0 && fight.presses[1] === 25 && fight.presses[2] === 38
    && fight.dead && fight.cleared && errs.length === 0;
  return { ok, detail: `wave ${fight.wave}: ${fight.id || 'no boss'}; plates ${fight.plates.join('>')} of ${fight.max}, ${fight.clangs} clangs; phases at ${fight.phases.join(', ')} s, reforged to ${fight.reforged.join('/')}; hammer zones ${fight.hammer.join('/')}, press tiles ${fight.presses.join('/')} by phase; ${fight.dead ? 'fell' : 'STANDING'}, level ${fight.cleared ? 'cleared' : 'not cleared'}${errs.length ? `; errors: ${errs[0]}` : ''}` };
});

// ---------- #217: the Iron Hold's Steel relics: a test run holding all four, fought through the real input for 30 s ----------
await check('Relics: Rivet Hammer, Pavise, Reprisal Cuirass and Heart of the Hold each do their work in a fight, and their HUD tiles say what they do (#217)', () =>
  inPage(() => location.reload()).then(async () => {
    await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu');
    const ids = ['rivetHammer', 'pavise', 'reprisalCuirass', 'heartOfTheHold'];
    const start = await inPage(async (ids) => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const set = (el, v) => {
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Settings').click();
      await wait(150);
      document.querySelector('[data-act="test"]').click();
      await wait(100);
      set(document.getElementById('tm-class'), 'paladin');
      set(document.getElementById('tm-act'), '2'); // a crowded Act II wave and a level-1 champion: the horde reaches her and hits
      set(document.getElementById('tm-wave'), '5');
      set(document.getElementById('tm-level'), '1');
      const listed = ids.filter((id) => document.querySelector(`#tm-relics select[data-relic="${id}"]`));
      for (const id of listed) set(document.querySelector(`#tm-relics select[data-relic="${id}"]`), '1');
      const g = window.__startTest();
      g.player.deathless = true; // hits land and are counted, the run just never ends
      await wait(300);
      const tip = (id) => document.querySelector(`#h-relics .relic[data-id="${id}"]`)?.dataset.tip ?? '';
      return { listed: listed.length, held: g.player.relics.held.filter((id) => ids.includes(id)).length, tips: ids.map(tip) };
    }, ids);
    // the champion steps toward the horde (arrow keys) and holds her ground for 30 s: every number below comes from real hits
    await page.keyboard.down('ArrowRight');
    await inPage(() => window.__lb.run(60, false, 'input'));
    await page.keyboard.up('ArrowRight');
    await inPage(() => window.__lb.run(1800, false, 'input'));
    const fight = await inPage((ids) => {
      const p = window.__lb.game.player, s = (id) => p.relics.stats[id] ?? { damage: 0, prevented: 0 };
      return { rivet: s(ids[0]).damage, pavise: s(ids[1]).prevented, reprisal: s(ids[2]).damage, heart: s(ids[3]).damage, stacks: p.armorStacks };
    }, ids);
    const [rivet, pavise, reprisal, heart] = start.tips;
    const said = [/rivet/i.test(rivet), /in front of you/.test(pavise), /full force/.test(reprisal), /never fade/.test(heart)];
    const worked = fight.rivet > 0 && fight.pavise > 0 && fight.reprisal > 0 && fight.heart > 0 && fight.stacks > 0;
    const ok = start.listed === 4 && start.held === 4 && said.every(Boolean) && worked;
    const r = (v) => Math.round(v);
    return { ok, detail: `test mode lists ${start.listed}/4, held ${start.held}; tiles say ${said.map((x) => (x ? 'yes' : 'NO')).join('/')}; rivets ${r(fight.rivet)} dmg, Pavise turned away ${r(fight.pavise)}, reprisals ${r(fight.reprisal)} dmg, Heart thorns ${r(fight.heart)} dmg, ${fight.stacks} armor stacks` };
  }),
);

// ---------- #218: the Iron Hold's Steel class relics: each champion's own, in a test run fought through the real input (ability on Space) ----------
await check('Relics: Iron Halo, Legion Plate and Bodkin Points each work for their own champion in a fight, test mode lists each for its class only, and their HUD tiles say what they do (#218)', async () => {
  const cases = [
    { classId: 'angel', id: 'ironHalo', says: /Heavenly Radiance gives .* armor stacks/ },
    // Legion Plate's bonus is 3% per stack of a level-1 skeleton's hit (a fraction of a point), so its fight runs twice as long
    { classId: 'necromancer', id: 'legionPlate', says: /hit of your minions gives you an armor stack/, secs: 60 },
    { classId: 'archer', id: 'bodkinPoints', says: /arrow hit is a bodkin/ },
  ];
  const ids = cases.map((c) => c.id);
  const out = [];
  for (const c of cases) {
    await inPage(() => location.reload());
    await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu');
    const start = await inPage(async ({ c, ids }) => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const set = (el, v) => {
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Settings').click();
      await wait(150);
      document.querySelector('[data-act="test"]').click();
      await wait(100);
      set(document.getElementById('tm-class'), c.classId);
      set(document.getElementById('tm-act'), '2'); // a crowded Act II wave and a level-1 champion, as #217's check
      set(document.getElementById('tm-wave'), '5');
      set(document.getElementById('tm-level'), '1');
      const listed = ids.filter((id) => document.querySelector(`#tm-relics select[data-relic="${id}"]`));
      const own = document.querySelector(`#tm-relics select[data-relic="${c.id}"]`);
      if (own) set(own, '1');
      const g = window.__startTest();
      g.player.deathless = true; // hits land and are counted, the run just never ends
      await wait(300);
      return { listed, held: g.player.relics.held.includes(c.id), tip: document.querySelector(`#h-relics .relic[data-id="${c.id}"]`)?.dataset.tip ?? '' };
    }, { c, ids });
    // the champion steps toward the horde and fights for 30 s (or c.secs), casting the ability (Space) whenever it is ready
    await page.keyboard.down('ArrowRight');
    await inPage(() => window.__lb.run(60, false, 'input'));
    await page.keyboard.up('ArrowRight');
    await page.keyboard.down('Space');
    let stacks = 0;
    for (let i = 0; i < (c.secs ?? 30); i++) stacks = Math.max(stacks, await inPage(() => (window.__lb.run(60, false, 'input'), window.__lb.game.player.armorStacks)));
    await page.keyboard.up('Space');
    const damage = await inPage((id) => window.__lb.game.player.relics.stats[id]?.damage ?? 0, c.id);
    const ok = start.listed.length === 1 && start.listed[0] === c.id && start.held && c.says.test(start.tip) && damage > 0 && stacks > 0;
    out.push({ ok, text: `${c.classId}: lists ${start.listed.join('+') || 'none'}, held ${start.held}, tile ${c.says.test(start.tip) ? 'yes' : 'NO'}, ${damage.toFixed(1)} dmg in ${c.secs ?? 30} s, up to ${stacks} armor stacks` });
  }
  return { ok: out.every((o) => o.ok), detail: out.map((o) => o.text).join('; ') };
});

// ---------- #229: the Cinderlands' Flame relics: a test run holding all three (and two Flame commons/rares that light the first burns),
// fought through the real input for 30 s ----------
await check('Relics: Flashpowder, Pitch Pot and Crown of Cinders each do their work in a fight, and their HUD tiles say what they do (#229)', () =>
  inPage(() => location.reload()).then(async () => {
    await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu');
    const ids = ['flashpowder', 'pitchPot', 'crownOfCinders'];
    const seeds = ['brimstoneOil', 'emberMantle']; // the burns the three build on: an attack's chance to burn, the mantle's ring of fire
    const start = await inPage(async ({ ids, seeds }) => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const set = (el, v) => {
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Settings').click();
      await wait(150);
      document.querySelector('[data-act="test"]').click();
      await wait(100);
      set(document.getElementById('tm-class'), 'paladin');
      set(document.getElementById('tm-act'), '2'); // a crowded Act II wave and a level-1 champion, as #217's check
      set(document.getElementById('tm-wave'), '5');
      set(document.getElementById('tm-level'), '1');
      const listed = ids.filter((id) => document.querySelector(`#tm-relics select[data-relic="${id}"]`));
      for (const id of [...listed, ...seeds]) set(document.querySelector(`#tm-relics select[data-relic="${id}"]`), '1');
      const g = window.__startTest();
      g.player.deathless = true; // the run just never ends
      await wait(300);
      const tip = (id) => document.querySelector(`#h-relics .relic[data-id="${id}"]`)?.dataset.tip ?? '';
      return { listed: listed.length, held: g.player.relics.held.filter((id) => ids.includes(id)).length, tips: ids.map(tip) };
    }, { ids, seeds });
    // the champion steps into the horde (arrow keys) and holds her ground for 30 s; every number below comes from real hits, ticks and kills
    await page.keyboard.down('ArrowRight');
    await inPage(() => window.__lb.run(60, false, 'input'));
    await page.keyboard.up('ArrowRight');
    let patches = 0;
    for (let i = 0; i < 30; i++) patches = Math.max(patches, await inPage(() => (window.__lb.run(60, false, 'input'), window.__lb.game.fields.filter((f) => f.by === 'pitchPot').length)));
    const fight = await inPage((ids) => {
      const s = (id) => window.__lb.game.player.relics.stats[id]?.damage ?? 0;
      return ids.map(s);
    }, ids);
    const said = [/flare/.test(start.tips[0]), /burning pitch/.test(start.tips[1]), /fire leaps on/.test(start.tips[2])];
    const ok = start.listed === 3 && start.held === 3 && said.every(Boolean) && fight.every((d) => d > 0) && patches > 0;
    const r = (v) => Math.round(v);
    return { ok, detail: `test mode lists ${start.listed}/3, held ${start.held}; tiles say ${said.map((x) => (x ? 'yes' : 'NO')).join('/')}; flares ${r(fight[0])} dmg, pitch ${r(fight[1])} dmg (up to ${patches} patches), the crown's leaps ${r(fight[2])} dmg` };
  }),
);

// ---------- #230: the Cinderlands' Flame class relics: each champion's own, in a test run fought through the real input (ability on Space) ----------
await check("Relics: Surtr's Brand and Bonefire each work for their own champion in a fight, test mode lists each for its class only, and their HUD tiles say what they do (#230)", async () => {
  const cases = [
    // 30 s holds a whole Berserker Rage and its end, where the fire bursts out. Rage takes `deathless` for its own (Undying), so the Viking
    // cannot lean on it as the others do: he fights at level 25, strong enough to stand in this wave, and the flag is set again every second
    { classId: 'viking', id: 'surtrsBrand', says: /stokes your axe/, level: '25' },
    { classId: 'necromancer', id: 'bonefire', says: /Your skeletons burn/, secs: 40 }, // the skeletons have to be raised and reach the horde first
  ];
  const ids = cases.map((c) => c.id);
  const out = [];
  for (const c of cases) {
    await inPage(() => location.reload());
    await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu');
    const start = await inPage(async ({ c, ids }) => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const set = (el, v) => {
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Settings').click();
      await wait(150);
      document.querySelector('[data-act="test"]').click();
      await wait(100);
      set(document.getElementById('tm-class'), c.classId);
      set(document.getElementById('tm-act'), '2'); // a crowded Act II wave and a level-1 champion, as #217's check
      set(document.getElementById('tm-wave'), '5');
      set(document.getElementById('tm-level'), c.level ?? '1');
      const listed = ids.filter((id) => document.querySelector(`#tm-relics select[data-relic="${id}"]`));
      const own = document.querySelector(`#tm-relics select[data-relic="${c.id}"]`);
      if (own) set(own, '1');
      const g = window.__startTest();
      g.player.deathless = true; // hits land and are counted, the run just never ends
      await wait(300);
      return { listed, held: g.player.relics.held.includes(c.id), tip: document.querySelector(`#h-relics .relic[data-id="${c.id}"]`)?.dataset.tip ?? '' };
    }, { c, ids });
    // the champion steps toward the horde and fights for 30 s (or c.secs), casting the ability (Space) whenever it is ready
    await page.keyboard.down('ArrowRight');
    await inPage(() => window.__lb.run(60, false, 'input'));
    await page.keyboard.up('ArrowRight');
    await page.keyboard.down('Space');
    let burning = 0;
    const second = () => {
      const lb = window.__lb;
      lb.run(60, false, 'input');
      if (!lb.game) throw new Error(`the run ended (${lb.state})`);
      lb.game.player.deathless = true;
      return lb.game.enemies.filter((e) => !e.dead && e.statuses.burn).length;
    };
    for (let i = 0; i < (c.secs ?? 30); i++) burning = Math.max(burning, await inPage(second));
    await page.keyboard.up('Space');
    const damage = await inPage((id) => window.__lb.game.player.relics.stats[id]?.damage ?? 0, c.id);
    const ok = start.listed.length === 1 && start.listed[0] === c.id && start.held && c.says.test(start.tip) && damage > 0;
    out.push({ ok, text: `${c.classId}: lists ${start.listed.join('+') || 'none'}, held ${start.held}, tile ${c.says.test(start.tip) ? 'yes' : 'NO'}, ${damage.toFixed(1)} dmg in ${c.secs ?? 30} s, up to ${burning} enemies burning at once` });
  }
  return { ok: out.every((o) => o.ok), detail: out.map((o) => o.text).join('; ') };
});

// ---------- #230: Baptism of Fire, the Cinderlands' duo: a test run holding its two relics (and two that light the first burns) takes the
// gold card at a relic moment, then fights through the real input for 30 s ----------
await check('Relics: Baptism of Fire is taken as the gold card once Flashpowder and Blessed Water are held, its tile says what it does, and its flares heal in a fight (#230)', () =>
  inPage(() => location.reload()).then(async () => {
    await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu');
    const start = await inPage(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const set = (el, v) => {
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Settings').click();
      await wait(150);
      document.querySelector('[data-act="test"]').click();
      await wait(100);
      set(document.getElementById('tm-class'), 'paladin');
      set(document.getElementById('tm-act'), '2'); // a crowded Act II wave and a level-1 champion, as #217's check
      set(document.getElementById('tm-wave'), '5');
      set(document.getElementById('tm-level'), '1');
      for (const id of ['flashpowder', 'blessedWater', 'brimstoneOil', 'emberMantle']) set(document.querySelector(`#tm-relics select[data-relic="${id}"]`), '1');
      const lb = window.__lb;
      const g = window.__startTest();
      g.player.deathless = true; // hits land (so there is something to heal), the run just never ends
      await wait(300);
      // a relic moment with the duo ready, as a boss's fall gives it; the gold card is picked on the real screen
      g.player.relics.offers.push({ from: 'boss', options: ['butchersHook', 'guardiansAegis', 'stormPennant'], rerolls: 0, duo: 'baptismOfFire' });
      // (a step answers any screen that is up before it, a level-up say, with its first option; the relic moment's cards are left to the check)
      const find = () => [...document.querySelectorAll('[data-pick]')].find((b) => b.innerText.includes('Baptism of Fire'));
      let card = find();
      for (let i = 0; i < 40 && !card; i++) {
        lb.run(1, false, 'input');
        await wait(50);
        card = find();
      }
      const gold = !!card?.classList.contains('duo-card');
      card?.click();
      await wait(300);
      const tile = document.querySelector('#h-relics .relic[data-duo="baptismOfFire"]');
      const tiles = [...document.querySelectorAll('#h-relics .relic[data-id]')].map((t) => t.dataset.id);
      return { gold, formed: g.player.relics.duos.includes('baptismOfFire'), tip: tile?.dataset.tip ?? '', joined: !tiles.includes('flashpowder') && !tiles.includes('blessedWater'), state: lb.state };
    });
    // the champion steps into the horde (arrow keys) and holds her ground for 30 s; the heals below come from real flares
    await page.keyboard.down('ArrowRight');
    await inPage(() => window.__lb.run(60, false, 'input'));
    await page.keyboard.up('ArrowRight');
    for (let i = 0; i < 30; i++) await inPage(() => window.__lb.run(60, false, 'input'));
    const fight = await inPage(() => {
      const s = window.__lb.game.player.relics.stats;
      return { healed: s.baptismOfFire?.healing ?? 0, flares: s.flashpowder?.damage ?? 0 };
    });
    const says = /flare heals you/.test(start.tip);
    const ok = start.gold && start.formed && start.joined && says && fight.healed > 0 && fight.flares > 0;
    return { ok, detail: `gold card ${start.gold}, formed ${start.formed}, one tile for its two relics ${start.joined}, tile says ${says ? 'yes' : 'NO'}; in 30 s its flares dealt ${Math.round(fight.flares)} and healed ${fight.healed.toFixed(1)} HP` };
  }),
);

// ---------- #216: the Iron King: Settings -> Test mode -> "Start at" the Iron Hold's level 5 -> the opening pick -> its last wave ----------
// The champion trades plain blows beside him (no ability, no bot moves, unhurt), so the fight goes the same way every run: phase 1 his
// plate breaks blow by blow, his Decree lines land and his guard of Iron Knights comes; phase 2 he casts the plate off and raises the tower
// shield (blows at his front ring off it, so the champion steps round to his back) and rushes; phase 3 the thorns bite a blow struck up
// close and the Decree is a star of 8 lines. Each phase holds its 12 s as a crown boss's does, and his fall clears the level.
await check('Iron King: test mode starts the Iron Hold level 5; its crown boss: plate, then shield (blocked in front), then thorns, each phase 12 s, level cleared (#216)', async () => {
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://localhost:${PORT}/?debug&dev=1`);
  await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
  await p.getByRole('button', { name: 'Settings', exact: true }).click();
  await p.locator('[data-act="test"]').click();
  if (!(await p.locator('#tm-start option[value="ironHold:5"]').count())) return (await p.close(), { skip: true, detail: 'no realm-level start in this build' });
  await p.locator('#tm-class').selectOption('paladin');
  await p.locator('#tm-arena').selectOption('keep');
  await p.locator('#tm-start').selectOption('ironHold:5');
  await p.evaluate(() => {
    // Start test run, on __startTest's fixed seed (test mode seeds from the clock), so the fight is the same every time
    const now = Date.now;
    Date.now = () => 2654435761;
    try {
      [...document.querySelectorAll('button')].find((b) => /start test run/i.test(b.textContent)).click();
    } finally {
      Date.now = now;
    }
  });
  await p.locator('[data-pick]').first().waitFor({ timeout: 5000 }); // the level's opening pick
  await p.locator('[data-pick="0"]').click();
  const fight = await p.evaluate(() => {
    const lb = window.__lb, g = lb.game;
    const sounds = { block: [0, 0, 0] };
    let k = null;
    if (lb.view) {
      const real = lb.view.sfx;
      lb.view.sfx = (n) => ((n === 'block' && k && sounds.block[k.phase - 1]++), real(n));
    }
    g.enemies.length = 0;
    g.spawnQueue.length = 0;
    g.wave = g.wavesCleared = g.level.last - 1; // straight on to wave 40, the level's last
    g.breather = 0.01;
    const out = { wave: 0, id: '', crown: false, banner: '', plates: [], decree: [0, 0, 0], rush: [0, 0, 0], guard: 0, phases: [], armorAt2: -1, bites: [0, 0, 0], dead: false };
    const seen = new WeakSet();
    let bitAt;
    for (let i = 0; i < 90000 && lb.state !== 'results' && !(k?.dead && g.level.cleared); i++) {
      g.player.invulnerable = true;
      if (k && !k.dead) {
        // phase 1 and 3: a step off his front edge; phase 2: at his front until the shield has rung, then round at his back
        const back = k.phase === 2 && sounds.block[1] > 0;
        const a = back ? k.angle + Math.PI : k.phase === 2 ? k.angle : Math.PI;
        g.player.x = k.x + Math.cos(a) * (k.r + 16);
        g.player.y = k.y + Math.sin(a) * (k.r + 16);
      }
      lb.run(1, false, false);
      k ??= g.enemies.find((e) => e.def.boss) ?? null;
      if (!k) continue;
      if (!out.id) (out.id = k.def.id), (out.wave = g.wave), (out.crown = k.crown), (out.banner = g.banner?.text ?? ''), out.plates.push(k.armorHp);
      if (k.phase > out.phases.length + 1) {
        out.phases.push(+g.time.toFixed(1));
        if (k.phase === 2) out.armorAt2 = k.armorHp;
      }
      if (out.phases.length === 0 && k.armorHp !== out.plates[out.plates.length - 1]) out.plates.push(k.armorHp);
      const mine = g.zones.filter((z) => z.owner === k && !seen.has(z)); // the zones one Decree set this tick
      for (const z of mine) seen.add(z);
      out.decree[k.phase - 1] = Math.max(out.decree[k.phase - 1], mine.length);
      if (k.state === 1) out.rush[k.phase - 1]++;
      out.guard = Math.max(out.guard, g.enemies.filter((e) => e.def.id === 'ironKnight' && !e.dead).length);
      if (k.thornsAt !== undefined && k.thornsAt !== bitAt) (bitAt = k.thornsAt), out.bites[k.phase - 1]++; // his own thorns (the wave's thorn bearers bite too)
      if (k.dead) out.dead = true;
    }
    return { ...out, block: sounds.block, cleared: !!g.level?.cleared, test: g.vars.test };
  });
  await p.close();
  const oneByOne = fight.plates.length >= 3 && fight.plates.slice(1).every((v, i) => v < fight.plates[i]);
  const long = fight.phases.length === 2 && fight.phases[1] - fight.phases[0] >= 12;
  const ok = fight.test === 1 && fight.wave === 40 && fight.id === 'ironKing' && fight.crown && fight.banner === 'The Iron King · Crown boss' && fight.plates[0] === 8 && oneByOne
    && fight.guard >= 2 && fight.decree[0] === 24 && fight.decree[2] === 48 && fight.rush[0] === 0 && fight.rush[1] > 0 && long && fight.armorAt2 === 0
    && fight.block[0] === 0 && fight.block[1] > 0 && fight.bites[1] === 0 && fight.bites[2] > 0 && fight.dead && fight.cleared && errs.length === 0;
  return { ok, detail: `wave ${fight.wave}: ${fight.id || 'no boss'}${fight.crown ? ' (crown)' : ''} "${fight.banner}"; plates ${fight.plates.join('>')}, guard ${fight.guard}; phases at ${fight.phases.join(', ')} s, plate ${fight.armorAt2} at phase 2; decree zones ${fight.decree.join('/')}, rush ticks ${fight.rush.join('/')}, shield blocks ${fight.block.join('/')}, thorn bites ${fight.bites.join('/')} by phase; ${fight.dead ? 'fell' : 'STANDING'}, level ${fight.cleared ? 'cleared' : 'not cleared'}${errs.length ? `; errors: ${errs[0]}` : ''}` };
});

// ---------- #227: the Ember Queen: Settings -> Test mode -> "Start at" the Cinderlands' level 3 -> the opening pick -> its last wave ----------
// The champion stands beside her and trades plain blows (no ability, no bot moves, unhurt), so the fight goes the same way every run.
// Until a phase has shown its blows (Kindling and the Ember volley; from phase 2 her Flare too) he waits well off, out of his own reach but inside her
// reach, so she keeps casting. Her Kindling leaves burning ground, each new phase flares her up, and in phase 3 her steps burn.
// First he stands still and open to harm in the Ember Forge (#223): her fire leaves burn stacks (#225) that the HUD shows; then he is unhurt again.
await check('Ember Queen: test mode starts the Cinderlands level 3 in the Ember Forge; its last wave is hers; her fire stacks burn on the HUD; Kindling, volley, Flare, burning ground, a flare-up each phase, level cleared (#227)', async () => {
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://localhost:${PORT}/?debug&dev=1`);
  await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
  await p.getByRole('button', { name: 'Settings', exact: true }).click();
  await p.locator('[data-act="test"]').click();
  if (!(await p.locator('#tm-start option[value="cinderlands:3"]').count())) return (await p.close(), { skip: true, detail: 'no realm-level start in this build' });
  await p.locator('#tm-class').selectOption('paladin');
  await p.locator('#tm-arena').selectOption('emberForge'); // the Cinderlands' own arena (#223)
  await p.locator('#tm-start').selectOption('cinderlands:3');
  await p.evaluate(() => {
    // Start test run, on __startTest's fixed seed (test mode seeds from the clock), so the fight is the same every time
    const now = Date.now;
    Date.now = () => 2654435761;
    try {
      [...document.querySelectorAll('button')].find((b) => /start test run/i.test(b.textContent)).click();
    } finally {
      Date.now = now;
    }
  });
  await p.locator('[data-pick]').first().waitFor({ timeout: 5000 }); // the level's opening pick
  await p.locator('[data-pick="0"]').click();
  // her fire on the champion: he stands still, open to harm, until her Kindling (a burst, then the ground it leaves) has two stacks burning
  const burn = await p.evaluate(() => {
    const lb = window.__lb, g = lb.game, pl = g.player;
    g.enemies.length = 0;
    g.spawnQueue.length = 0;
    g.wave = g.wavesCleared = g.level.last - 1; // straight on to wave 24, the level's last (#243)
    g.breather = 0.01;
    pl.invulnerable = true;
    let q = null;
    for (let i = 0; i < 4000 && !q; i++) (lb.run(1, false, false), (q = g.enemies.find((e) => e.def.boss) ?? null));
    window.__queen = q;
    if (!q) return { arena: g.arena.id, stacks: 0, decay: 0, phase: 0 };
    q.hpFloor = q.maxHp; // his blows don't move the fight on while her fire is measured
    pl.invulnerable = false;
    for (let i = 0; i < 3000 && (pl.statuses.burn?.stacks ?? 0) < 2 && lb.state !== 'results'; i++) {
      for (const e of g.enemies) if (e !== q) Object.assign(e, { x: pl.x + 700, y: pl.y }).statuses.stun = { stacks: 1, time: 5, power: 0 }; // her fire alone
      lb.run(1, false, false);
      pl.hp = Math.max(pl.hp, pl.stats.hp * 0.6); // he must not fall while the stacks build
    }
    pl.invulnerable = true;
    return { arena: g.arena.id, stacks: pl.statuses.burn?.stacks ?? 0, decay: pl.statuses.burn?.decay ?? 0, phase: q.phase };
  });
  await p.waitForFunction(() => /Burning ×\d/.test(document.getElementById('h-status')?.textContent ?? ''), null, { timeout: 3000 }).catch(() => {});
  const hud = await p.evaluate(() => document.getElementById('h-status')?.textContent ?? '');
  const fight = await p.evaluate(() => {
    const lb = window.__lb, g = lb.game, pl = g.player;
    const out = { wave: 0, id: '', kindle: [0, 0, 0], volley: [0, 0, 0], flare: [0, 0, 0], ground: 0, trail: [0, 0, 0], flaresUp: [], phases: [], dead: false };
    const q = window.__queen ?? null;
    let aimed = false;
    const seen = new WeakSet();
    if (q) (q.hpFloor = 0), (pl.hp = pl.stats.hp), delete pl.statuses.burn; // the fight proper: unhurt from here
    for (const z of g.zones) seen.add(z); // what is left of the Kindling that burnt him is not a whole blow: phase 1 waits for one of its own
    for (let i = 0; i < 60000 && q && lb.state !== 'results' && !(q.dead && g.level.cleared); i++) {
      pl.invulnerable = true;
      const ph = q.phase - 1;
      const shown = out.kindle[ph] > 0 && out.volley[ph] > 0 && (q.phase === 1 || out.flare[ph] > 0);
      if (!q.dead) (pl.x = q.x - q.r - (shown ? 16 : 450)), (pl.y = q.y), (q.hpFloor = shown ? 0 : q.hp); // while he waits nothing of his (a relic's fire, a burn left on her) moves the fight on
      lb.run(1, false, false);
      if (!out.id) (out.id = q.def.id), (out.wave = g.wave);
      if (q.phase > out.phases.length + 1) out.phases.push(+g.time.toFixed(1)), out.flaresUp.push(g.banner?.text ?? '');
      const k = q.phase - 1;
      const mine = g.zones.filter((z) => z.owner === q && !seen.has(z)); // the zones one blow set this tick
      for (const z of mine) seen.add(z);
      out.kindle[k] = Math.max(out.kindle[k], mine.filter((z) => z.color === '#f06a1c').length);
      out.flare[k] = Math.max(out.flare[k], mine.filter((z) => z.color === '#ffb347').length);
      if (q.telegraph && !aimed) out.volley[k]++;
      aimed = !!q.telegraph;
      const burning = g.fields.filter((f) => f.hostile && f.dtype === 'fire');
      out.ground = Math.max(out.ground, burning.filter((f) => f.r === 44).length); // the Kindling's burning ground
      out.trail[k] = Math.max(out.trail[k], burning.filter((f) => f.r === 26).length); // her burning steps
      if (q.dead) out.dead = true;
    }
    return { ...out, cleared: !!g.level?.cleared, test: g.vars.test };
  });
  await p.close();
  const ok = fight.test === 1 && fight.wave === 24 && fight.id === 'emberQueen' && fight.phases.length === 2
    && burn.arena === 'emberForge' && burn.phase === 1 && burn.stacks >= 2 && burn.decay > 0 && /Burning ×\d/.test(hud)
    && fight.kindle.join() === '3,4,5' && fight.volley.every((n) => n > 0) && fight.flare[0] === 0 && fight.flare[1] === 33 && fight.flare[2] === 62
    && fight.ground > 0 && fight.trail[0] === 0 && fight.trail[1] === 0 && fight.trail[2] > 0 && fight.flaresUp.every((t) => t === 'The Ember Queen flares up')
    && fight.dead && fight.cleared && errs.length === 0;
  return { ok, detail: `wave ${fight.wave} in ${burn.arena}: ${fight.id || 'no boss'}; her fire left ${burn.stacks} burn stacks (one off every ${burn.decay} s), HUD "${hud}"; phases at ${fight.phases.join(', ')} s ("${fight.flaresUp.join('", "')}"); kindle spots ${fight.kindle.join('/')}, volleys ${fight.volley.join('/')}, flare zones ${fight.flare.join('/')} by phase; burning ground up to ${fight.ground}, trail patches ${fight.trail.join('/')}; ${fight.dead ? 'fell' : 'STANDING'}, level ${fight.cleared ? 'cleared' : 'not cleared'}${errs.length ? `; errors: ${errs[0]}` : ''}` };
});

// ---------- #228: the Cinder Colossus: Settings -> Test mode -> "Start at" the Cinderlands' level 5 -> the opening pick -> its last wave ----------
// The champion trades plain blows beside him (no ability, no bot moves), so the fight goes the same way every run: phase 1 his hits
// (the Slam's fan of fire lines and his touch) burn, so the champion takes them there, healed each tick, and the burn stacks (#225's,
// which fall one at a time); from phase
// 2 he is unhurt: his embers land round him and the fire spreads patch by patch; phase 3 his brood of Cultists comes and the foes that
// fall in his heat burst into fire. Each phase holds its 12 s as a crown boss's does, and his fall clears the level.
await check('Cinder Colossus: test mode starts the Cinderlands level 5; its crown boss: burning hits, then spreading fire, then bursts, each phase 12 s, level cleared (#228)', async () => {
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://localhost:${PORT}/?debug&dev=1`);
  await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
  await p.getByRole('button', { name: 'Settings', exact: true }).click();
  await p.locator('[data-act="test"]').click();
  if (!(await p.locator('#tm-start option[value="cinderlands:5"]').count())) return (await p.close(), { skip: true, detail: 'no realm-level start in this build' });
  await p.locator('#tm-class').selectOption('paladin');
  await p.locator('#tm-arena').selectOption((await p.locator('#tm-arena option[value="emberForge"]').count()) ? 'emberForge' : 'keep'); // the Ember Forge once it is built (#223)
  await p.locator('#tm-start').selectOption('cinderlands:5');
  await p.evaluate(() => {
    // Start test run, on __startTest's fixed seed (test mode seeds from the clock), so the fight is the same every time
    const now = Date.now;
    Date.now = () => 2654435761;
    try {
      [...document.querySelectorAll('button')].find((b) => /start test run/i.test(b.textContent)).click();
    } finally {
      Date.now = now;
    }
  });
  await p.locator('[data-pick]').first().waitFor({ timeout: 5000 }); // the level's opening pick
  await p.locator('[data-pick="0"]').click();
  const fight = await p.evaluate(() => {
    const lb = window.__lb, g = lb.game;
    g.enemies.length = 0;
    g.spawnQueue.length = 0;
    g.wave = g.wavesCleared = g.level.last - 1; // straight on to wave 40, the level's last
    g.breather = 0.01;
    const out = { wave: 0, id: '', crown: false, banner: '', decay: 0, burn: [0, 0, 0], slam: [0, 0, 0], patches: [0, 0, 0], bursts: [0, 0, 0], brood: 0, phases: [], dead: false, fell: false };
    const seen = new WeakSet();
    let k = null;
    let patches = 0, bursts = 0;
    for (let i = 0; i < 90000 && lb.state !== 'results' && !(k?.dead && g.level.cleared); i++) {
      const burning = k && !k.dead && k.phase === 1; // phase 1: take his burning hits, healed each tick; after it, unhurt
      g.player.invulnerable = !burning;
      if (burning) g.player.hp = g.player.stats.hp;
      if (k && !k.dead) {
        g.player.x = k.x - (k.r + 16); // a step off his edge
        g.player.y = k.y;
      }
      lb.run(1, false, false);
      if (g.player.hp <= 0) out.fell = true;
      k ??= g.enemies.find((e) => e.def.boss) ?? null;
      if (!k) continue;
      if (!out.id) (out.id = k.def.id), (out.wave = g.wave), (out.crown = k.crown), (out.banner = g.banner?.text ?? '');
      if (k.phase > out.phases.length + 1) out.phases.push(+g.time.toFixed(1));
      const ph = k.phase - 1;
      out.burn[ph] = Math.max(out.burn[ph], g.player.statuses.burn?.stacks ?? 0);
      if (burning) out.decay = Math.max(out.decay, g.player.statuses.burn?.decay ?? 0); // #225's burn stacks: they fall one at a time
      const mine = g.zones.filter((z) => z.owner === k && !seen.has(z) && z.r === k.def.zoneRadius); // the zones one Slam set this tick
      for (const z of g.zones) if (z.owner === k) seen.add(z);
      out.slam[ph] = Math.max(out.slam[ph], mine.length);
      const pa = g.vars['colossus.patches'] ?? 0, bu = g.vars['colossus.bursts'] ?? 0;
      out.patches[ph] += pa - patches;
      out.bursts[ph] += bu - bursts;
      (patches = pa), (bursts = bu);
      out.brood = Math.max(out.brood, g.enemies.filter((e) => e.def.id === 'cultist' && !e.dead).length);
      if (k.dead) out.dead = true;
    }
    return { ...out, cleared: !!g.level?.cleared, test: g.vars.test };
  });
  await p.close();
  const long = fight.phases.length === 2 && fight.phases[1] - fight.phases[0] >= 12;
  const ok = fight.test === 1 && fight.wave === 40 && fight.id === 'cinderColossus' && fight.crown && fight.banner === 'The Cinder Colossus · Crown boss' && !fight.fell
    && fight.burn[0] >= 2 && fight.decay > 0 && fight.slam[0] === 15 && fight.patches[0] === 0 && fight.patches[1] >= 9 && fight.bursts[1] === 0 && fight.bursts[2] > 0
    && fight.brood >= 1 && long && fight.dead && fight.cleared && errs.length === 0;
  return { ok, detail: `wave ${fight.wave}: ${fight.id || 'no boss'}${fight.crown ? ' (crown)' : ''} "${fight.banner}"; phases at ${fight.phases.join(', ')} s; burn stacks ${fight.burn.join('/')} (one falls every ${fight.decay} s), slam zones ${fight.slam.join('/')}, fire patches ${fight.patches.join('/')}, bursts ${fight.bursts.join('/')} by phase; brood ${fight.brood}; ${fight.fell ? 'CHAMPION FELL; ' : ''}${fight.dead ? 'fell' : 'STANDING'}, level ${fight.cleared ? 'cleared' : 'not cleared'}${errs.length ? `; errors: ${errs[0]}` : ''}` };
});

// ---------- #236: no boss ends two levels of a realm: Settings -> Test mode -> "Start at" a Marches level -> the opening pick -> its last wave ----------
// Level 1 ends on the Black Knight (Act I's opener); level 5 used to draw him again. Now it ends on another boss, the same one on any seed.
await check('Bosses: the Marches level 1 ends on the Black Knight; level 5 ends on another boss, the same on every seed (#236)', async () => {
  const lastBoss = async (start, seed) => {
    const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`http://localhost:${PORT}/?debug&dev=1`);
    await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
    await p.getByRole('button', { name: 'Settings', exact: true }).click();
    await p.locator('[data-act="test"]').click();
    if (!(await p.locator(`#tm-start option[value="${start}"]`).count())) return (await p.close(), null);
    await p.locator('#tm-class').selectOption('paladin');
    await p.locator('#tm-start').selectOption(start);
    await p.evaluate((seed) => {
      const now = Date.now; // test mode seeds from the clock
      Date.now = () => seed;
      try {
        [...document.querySelectorAll('button')].find((b) => /start test run/i.test(b.textContent)).click();
      } finally {
        Date.now = now;
      }
    }, seed);
    await p.locator('[data-pick]').first().waitFor({ timeout: 5000 }); // the level's opening pick
    await p.locator('[data-pick="0"]').click();
    const out = await p.evaluate(() => {
      const lb = window.__lb, g = lb.game;
      g.player.invulnerable = true;
      g.enemies.length = 0;
      g.spawnQueue.length = 0;
      g.wave = g.wavesCleared = g.level.last - 1; // straight on to the level's last wave
      g.breather = 0.01;
      let b = null;
      for (let i = 0; i < 4000 && !b; i++) (lb.run(1, false, false), (b = g.enemies.find((e) => e.def.boss) ?? null));
      return { wave: g.wave, last: g.level.last, name: b?.def.name ?? '', key: g.bossesSeen.at(-1) ?? '' };
    });
    const hud = await p.waitForFunction(() => document.getElementById('h-boss-name')?.textContent, null, { timeout: 5000 }).then((h) => h.jsonValue()).catch(() => '');
    await p.close();
    return { ...out, hud, errs: errs.length };
  };
  const l1 = await lastBoss('marches:1', 2654435761);
  if (!l1) return { skip: true, detail: 'no realm-level start in this build' };
  const l5 = await lastBoss('marches:5', 2654435761);
  const l5b = await lastBoss('marches:5', 12345);
  const ok = l1.wave === 6 && l1.key === 'blackKnight' && l5.wave === 30 && l5.key && l5.key !== 'blackKnight' && l5b.key === l5.key
    && l5.hud.startsWith(l5.name) && l1.hud.startsWith(l1.name) && !l1.errs && !l5.errs && !l5b.errs;
  return { ok, detail: `level 1 wave ${l1.wave}: ${l1.key} "${l1.hud}"; level 5 wave ${l5.wave}: ${l5.key} "${l5.hud}", on another seed ${l5b.key}` };
});

// ---------- #243: longer levels: a level runs on its own waves ----------
// A new Viking from the title -> the Map tab -> the Marches -> its road: level 1's panel says Waves 1–6. FIGHT plays it out (the bot,
// who can't be hurt, the one shortcut): the scale's old boss wave 5 is a plain wave, and the level's one boss comes on wave 6, its last.
// Its rare (key 1), then the level-cleared screen's Continue (#241) goes into level 2, waves 7–12: Act I ends inside it at wave 10 with no boss, no Merchant
// and no fork; the fight goes on into Act II, and the boss comes on wave 12.
await check('longer levels: the Marches level 1 is waves 1–6 with its one boss on wave 6; Continue into level 2 (waves 7–12), where Act I ends with no boss, no Merchant and no fork, click and keys at 1280x720 (#243)', async () => {
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://localhost:${PORT}/?debug`);
  await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
  const press = (sel) => p.locator(sel).first().click();
  const bad = [];
  const want = (cond, what) => { if (!cond) bad.push(what); return cond; };
  // the level played out, every screen answered by its first option; which waves had a boss on the field, and any Merchant or fork
  const playOut = () => p.evaluate(() => {
    const lb = window.__lb, g = lb.game;
    const out = { first: g.startWave, last: g.level?.last, level: g.level?.level, bossWaves: [], shop: false, acts: [g.act], banners: [] };
    for (let i = 0; i < 120000 && lb.game === g && lb.state !== 'results'; i++) {
      if (lb.state === 'playing') g.player.invulnerable = true;
      lb.run(1, false, true);
      if (g.pendingMerchant || g.pendingRoute) out.shop = true;
      if (g.enemies.some((e) => e.def.boss && !e.side) && !out.bossWaves.includes(g.wave)) out.bossWaves.push(g.wave);
      if (g.act !== out.acts.at(-1)) out.acts.push(g.act), out.banners.push(g.banner?.text ?? '');
    }
    return { ...out, wave: g.wave, cleared: !!g.level?.cleared, state: lb.state, minutes: +(g.time / 60).toFixed(1) };
  });
  const opening = async () => { // the level's opening pick
    await p.waitForFunction(() => window.__lb.state === 'choice' && !!document.querySelector('[data-pick]'), null, { timeout: 5000 });
    await press('[data-pick="0"]');
  };
  await press('[data-go="start"]');
  await press('[data-class="viking"]');
  await press('[data-start]');
  await p.locator('.champion-screen').waitFor({ timeout: 3000 });
  await skipTour(p);
  await press('.kit-tab[data-tab="map"]');
  await p.locator('.wm-map').waitFor({ timeout: 3000 });
  await press('.wm-realm.r-marches');
  await p.locator('.rr-panel').waitFor({ timeout: 3000 });
  const facts = await p.evaluate(() => document.querySelector('.rr-facts').textContent.replace(/\s+/g, ' ').trim());
  want(/Waves\s*1–6/.test(facts), `level 1's panel says "${facts}"`);
  await press('[data-fight]');
  await opening();
  const one = await playOut();
  want(one.level === 1 && one.first === 1 && one.last === 6 && one.cleared && one.wave === 6 && one.state === 'results' && one.bossWaves.join() === '6' && !one.shop, `level 1 ${JSON.stringify(one)}`);
  await p.locator('.rare-pick').waitFor({ timeout: 5000 });
  await p.keyboard.press('1');
  await p.locator('.level-cleared [data-retry]').waitFor({ timeout: 3000 });
  const onward = (await p.locator('.level-cleared [data-retry]').textContent()).trim();
  want(onward === 'Continue to level 2', `the main button says "${onward}"`);
  await press('.level-cleared [data-retry]');
  await opening();
  const two = await playOut();
  await p.close();
  want(two.level === 2 && two.first === 7 && two.last === 12 && two.cleared && two.wave === 12 && two.state === 'results' && two.bossWaves.join() === '12' && !two.shop && two.acts.join() === '1,2' && /^Act II/.test(two.banners[0] ?? ''), `level 2 ${JSON.stringify(two)}`);
  want(errs.length === 0, `errors: ${errs[0]}`);
  return { ok: bad.length === 0, detail: bad.length ? bad.join('; ') : `panel "Waves 1–6"; level 1: waves ${one.first}-${one.wave}, boss on wave ${one.bossWaves.join()}, ${one.minutes} min; "${onward}"; level 2: waves ${two.first}-${two.wave}, boss on wave ${two.bossWaves.join()}, Act ${two.acts.join(' -> ')} ("${two.banners[0]}"), no Merchant, no fork, ${two.minutes} min` };
});

// ---------- #219: the Iron Hold's five levels, their rewards, its crown and its theme, as one realm run ----------
// A Paladin who holds the Marches crown: the map opens the Iron Hold, its road starts on level 1 (Knight picked on the road) and its
// panel names the keep-locked reward and waves 1–8; FIGHT, and the level plays the Iron Hold's own theme. The realm is one run (#237):
// each level is fought on from its last wave with a strong blow on every swing (the shortcuts), its boss falls, its reward is picked, and
// the level-cleared screen (#241) goes on: level 1 (a pool boss on wave 8) offers 1 of 2 locked Steel rares (key 1), then "Continue to
// level 2"; level 2 (the Warden, 3 phases, wave 16) the same, then Back to the map: the road stands at level 3 with "Continue from level
// 3"; level 3 (the Forgemaster, wave 24) banks the Paladin's Steel class relic on one card (Enter); level 4 (the Warden as an elite: 4
// phases, wave 32) a Steel rare again; level 5 (the Iron King as crown boss, wave 40) the Knight crown's pick of the two Steel
// legendaries (key 2), and its level-cleared screen has no Continue: the run is over. The Champion and Legend crowns are fought from the
// same level-5 checkpoint put back on their tier (the one save shortcut): the Champion crown gives the other legendary on one card (a
// click), the Legend crown the title and the palette, named on the level-cleared screen.
/** A relic realm's run, played through its real screens (#219's recipe; #231 plays the Cinderlands on it). `R`: what the realm names. */
const realmRun = (R) => async () => {
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://localhost:${PORT}/?debug`);
  await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
  const press = (sel) => p.locator(sel).first().click();
  const bad = [], log = [];
  const want = (cond, what) => { if (!cond) bad.push(what); return cond; };
  const champ = () => p.evaluate(() => window.__lb.save.champions.paladin);
  await p.evaluate(() => {
    window.__lb.save.champions = { paladin: { name: 'Hild', inventory: [], loadouts: {}, ...window.__lb.build.grown({ marches: [7] }), world: { marches: [7] }, signature: false, lastBastion: false, runs: {} } };
  });
  const road = async (tier) => {
    await p.locator('.rr-panel').waitFor({ timeout: 3000 });
    if (tier !== undefined) await press(`.rr-tier[data-tier="${tier}"]`);
    await p.locator('.rr-panel').waitFor({ timeout: 3000 });
    return p.evaluate(() => ({ name: document.querySelector('.rr-name').textContent.trim(), text: document.querySelector('.rr-panel').textContent.replace(/\s+/g, ' '), go: document.querySelector('[data-fight]').textContent.trim() }));
  };
  // the level's opening pick (a relic of the realm's family), `before` (while the run plays in real time), then on from the level's last wave to its end
  let strong = 0; // the strong blow's Strength: set in level 1, and the run carries it on
  const fight = async (before) => {
    await p.waitForFunction(() => window.__lb.state === 'choice' && !!document.querySelector('[data-pick]'), null, { timeout: 5000 });
    await press('[data-pick="0"]');
    const seen = before ? await before() : null;
    const out = await p.evaluate((strong) => {
      const lb = window.__lb, g = lb.game, s = g.player.stats;
      s.str = strong && s.str >= strong * 0.9 ? s.str : Math.max(strong, s.str * 40);
      g.enemies.length = 0;
      g.spawnQueue.length = 0;
      g.wave = g.wavesCleared = g.level.last - 1;
      g.breather = 0.01;
      let held = [], boss = null;
      const banners = new Set(); // what the fight announced while its boss stood (the elite's extra phase says its name)
      for (let i = 0; i < 60000 && lb.game === g && lb.state !== 'results'; i++) {
        if (lb.state === 'playing') g.player.invulnerable = true;
        held = [...g.player.relics.held];
        lb.run(1, false, true);
        const b = g.enemies.find((e) => e.def.boss && !e.side);
        if (b && g.banner) banners.add(g.banner.text);
        if (b) boss = { name: b.def.name, phases: b.def.phases ?? 2, crown: !!b.crown, phase: Math.max(boss?.phase ?? 0, b.phase), banners: [...banners], hp: boss?.hp ?? b.maxHp / (lb.enemyDef(b.def.id).hp * g.waveHpMult * g.tier.enemyHp) }; // `hp`: his HP over a plain one's at this wave (#220)
      }
      return { held, boss, str: s.str, level: g.level?.level, first: g.startWave, tier: g.tierIndex, cleared: !!g.level?.cleared, wave: g.wave, state: lb.state };
    }, strong);
    strong = out.str;
    return { ...out, seen };
  };
  const screenOf = (sel) => p.evaluate((sel) => ({
    head: document.querySelector(`${sel} .kit-head`)?.textContent.trim() ?? '',
    cards: [...document.querySelectorAll(`${sel} [data-pick]`)].map((b) => ({ name: b.querySelector('h2')?.textContent.trim() ?? '', fam: b.querySelector('.fam')?.textContent.trim() ?? '' })),
  }), sel);
  // the level-cleared screen (#241): its main button, its sub line, and what the crown gave
  const clearedScreen = async () => {
    await p.locator('.level-cleared [data-menu]').waitFor({ timeout: 5000 });
    return p.evaluate(() => ({
      next: document.querySelector('.level-cleared [data-retry]')?.textContent.trim() ?? '',
      map: document.querySelector('.level-cleared [data-menu]')?.textContent.trim() ?? '',
      sub: document.querySelector('.level-cleared .sub')?.textContent.replace(/\s+/g, ' ').trim() ?? '',
      gift: document.querySelector('.level-cleared [data-crown-gift]')?.textContent.replace(/\s+/g, ' ').trim() ?? '',
    }));
  };
  const keepLocked = async (n, run, taken) => { // a keep-locked level's pick of the family's locked rares: key 1 keeps the first
    await p.locator('.rare-pick').waitFor({ timeout: 5000 });
    const pick = await screenOf('.rare-pick');
    want(run.cleared && run.level === n && run.tier === 1 && run.first === n * 8 - 7 && run.wave === n * 8 && pick.head === `${R.name} · Level ${n} cleared` && pick.cards.length >= 1 && pick.cards.length <= 2
      && pick.cards.every((c) => c.fam.includes(R.family) && !taken.includes(c.name)), `level ${n} ${JSON.stringify(run)} pick ${JSON.stringify(pick)} (taken ${taken.join()})`);
    await p.keyboard.press('1');
    taken.push(pick.cards[0]?.name);
    return pick;
  };
  try {
    // the map opens the realm; its road on level 1, on Knight
    await press('[data-go="map"]');
    await p.locator('.wm-map').waitFor({ timeout: 3000 });
    const open = await p.evaluate((id) => document.querySelector(`.wm-realm.r-${id}`)?.disabled === false, R.id);
    want(open, `${R.name} is shut on the map`);
    await press(`.wm-realm.r-${R.id}`);
    const r1 = await road(1);
    want(r1.name === `${R.name} · Level 1` && /Keep a locked relic/.test(r1.text) && /Waves\s*1–8/.test(r1.text) && r1.go === 'Fight!', `road ${JSON.stringify(r1)}`);
    // level 1, playing its own theme: a pool boss, then 1 of 2 locked rares of its family
    const taken = [];
    await press('[data-fight]');
    const one = await fight(() => p.waitForFunction((theme) => window.__lb.music?.().arena === theme, R.theme, { timeout: 10000 }).then(() => R.theme, () => p.evaluate(() => String(window.__lb.music?.().arena))));
    want(one.seen === R.theme, `theme ${one.seen}`);
    want(!!one.boss && !R.own.test(one.boss.name), `level 1 boss ${JSON.stringify(one.boss)}`);
    const keep1 = await keepLocked(1, one, taken);
    want(keep1.cards.length === 2, `level 1 shows ${keep1.cards.length} rares`);
    const c1 = await clearedScreen();
    const after1 = await champ();
    want(c1.next === 'Continue to level 2' && after1.inventory.length === 1 && after1.world[R.id]?.[1] === 1 && after1.runs[R.id]?.level === 2 && after1.runs[R.id].tier === 1, `after level 1 "${c1.next}" ${JSON.stringify({ inv: after1.inventory, world: after1.world[R.id], run: after1.runs[R.id]?.level })}`);
    log.push(`map open, "${r1.name}" (waves 1–8), theme ${one.seen}, ${one.boss?.name} on wave ${one.wave}; "${keep1.head}": ${keep1.cards.map((c) => c.name).join('/')} -> ${after1.inventory.join()}; "${c1.next}"`);
    // level 2 by Continue: the realm's first boss, a second rare, then Back to the map: the road stands at level 3
    await press('.level-cleared [data-retry]');
    const two = await fight();
    want(two.boss?.name === R.first && two.boss.phases === R.phases && two.held.slice(0, one.held.length).join() === one.held.join(), `level 2 boss ${JSON.stringify(two.boss)}, held ${two.held.join()} after ${one.held.join()}`);
    const keep2 = await keepLocked(2, two, taken);
    const c2 = await clearedScreen();
    want(c2.next === 'Continue to level 3' && c2.map === 'Back to the map', `after level 2 ${JSON.stringify(c2)}`);
    await press('.level-cleared [data-menu]');
    const r3 = await road();
    want(r3.name === `${R.name} · Level 3` && r3.text.includes(`Your class relic of ${R.family}`) && r3.text.includes(R.third) && r3.go === 'Continue from level 3', `road 3 ${JSON.stringify(r3)}`);
    log.push(`L2 ${two.boss?.name} (${two.boss?.phases} phases) on wave ${two.wave}, kept ${keep2.cards[0]?.name}; the map: "${r3.name}", "${r3.go}"`);
    // level 3: the realm's new boss, the class relic on one card
    await press('[data-fight]');
    const three = await fight();
    await p.locator('.class-pick').waitFor({ timeout: 5000 });
    const cls = await screenOf('.class-pick');
    want(three.cleared && three.level === 3 && three.wave === 24 && (three.boss?.name ?? '').includes(R.third) && cls.head === `${R.name} · Level 3 cleared` && cls.cards.length === 1 && cls.cards[0].name === R.classRelic[1], `level 3 ${JSON.stringify(three)} card ${JSON.stringify(cls)}`);
    await p.keyboard.press('Enter');
    const c3 = await clearedScreen();
    const after3 = await champ();
    want(c3.next === 'Continue to level 4' && after3.inventory.includes(R.classRelic[0]) && after3.inventory.length === 3, `after level 3 "${c3.next}" ${JSON.stringify(after3.inventory)}`);
    log.push(`L3 ${three.boss?.name} on wave ${three.wave}: "${cls.head}": ${cls.cards[0]?.name}`);
    // level 4: the first boss as an elite, a phase more, which it announces; a third rare
    await press('.level-cleared [data-retry]');
    const four = await fight();
    want(four.boss?.name === `${R.first}, Elite` && four.boss.phases === R.phases + 1 && four.boss.phase === R.phases + 1 && !four.boss.crown && four.boss.banners.includes(R.elite) && Math.abs(four.boss.hp - 1.4) < 0.02, `level 4 boss ${JSON.stringify(four.boss)}`); // #220: an elite has 1.4 times the HP
    const keep4 = await keepLocked(4, four, taken);
    const c4 = await clearedScreen();
    const after4 = await champ();
    const checkpoint5 = after4.runs[R.id]; // the run as it stands before level 5
    want(c4.next === 'Continue to level 5' && after4.inventory.length === 4 && checkpoint5?.level === 5, `after level 4 "${c4.next}" ${JSON.stringify({ inv: after4.inventory, run: checkpoint5?.level })}`);
    log.push(`L4 ${four.boss?.name} (${four.boss?.phases} phases, "${R.elite}") on wave ${four.wave}, kept ${keep4.cards[0]?.name}`);
    // level 5 on Knight: the crown boss, the pick of the family's two legendaries, and the run is over
    await press('.level-cleared [data-retry]');
    const five = await fight();
    await p.locator('.legendary-pick').waitFor({ timeout: 5000 });
    const leg = await screenOf('.legendary-pick');
    want(five.cleared && five.level === 5 && five.wave === 40 && five.tier === 1 && (five.boss?.name ?? '').includes(R.crown) && five.boss.crown && leg.head === `👑 ${R.name} crowned` && leg.cards.length === 2, `Knight crown ${JSON.stringify(five)} pick ${JSON.stringify(leg)}`);
    await p.keyboard.press('2');
    const c5 = await clearedScreen();
    const knight = await champ();
    const took = knight.inventory.find((id) => R.legendaries.includes(id));
    want(c5.next === '' && c5.map === 'Back to the map' && /last level/.test(c5.sub) && !c5.gift && !!took && knight.world[R.id][1] === 5 && !knight.runs[R.id], `after the Knight crown ${JSON.stringify(c5)} ${JSON.stringify({ inv: knight.inventory, world: knight.world[R.id], run: knight.runs[R.id]?.level })}`);
    log.push(`L5 ${five.boss?.name} (crown) on wave ${five.wave}: "${leg.head}" on Knight: ${leg.cards.map((c) => c.name).join('/')} -> ${took}; no Continue, the run is over`);
    // a higher crown, from the level-5 checkpoint put back on its tier
    const crownOn = async (tier, world) => {
      await p.evaluate(([id, tier, world, run]) => {
        const c = window.__lb.save.champions.paladin;
        c.world[id] = world;
        c.runs[id] = { ...run, tier };
      }, [R.id, tier, world, checkpoint5]);
      await press('.level-cleared [data-menu]');
      const r = await road();
      await press('[data-fight]');
      return { r, run: await fight() };
    };
    // the Champion crown: the other legendary on one card
    const top = await crownOn(2, [0, 5, 4]);
    want(top.r.name === `${R.name} · Level 5` && top.r.text.includes(`The other ${R.family} legendary`) && top.r.go === 'Continue from level 5', `road Champion ${JSON.stringify(top.r)}`);
    await p.locator('.crown-pick').waitFor({ timeout: 5000 });
    const other = await screenOf('.crown-pick');
    await press('.crown-pick [data-pick="0"]');
    const cc = await clearedScreen();
    const champion = await champ();
    want(top.run.cleared && top.run.tier === 2 && other.head === `👑 ${R.name} crowned` && other.cards.length === 1 && other.cards[0].name !== leg.cards[1]?.name
      && R.legendaries.every((id) => champion.inventory.includes(id)) && champion.world[R.id][2] === 5 && cc.next === '' && !cc.gift, `Champion crown ${JSON.stringify(top.run)} card ${JSON.stringify(other)} champion ${JSON.stringify(champion.inventory)}`);
    log.push(`Champion crown: ${other.cards[0]?.name}; inventory ${champion.inventory.join()}`);
    // the Legend crown: a title and a palette, named on the level-cleared screen
    const legend = await crownOn(3, [0, 5, 5, 4]);
    want(legend.r.name === `${R.name} · Level 5` && legend.r.text.includes(`The title ${R.title}`) && /A palette/.test(legend.r.text), `road Legend ${JSON.stringify(legend.r)}`);
    const cl = await clearedScreen();
    const account = await p.evaluate((id) => ({ titles: window.__lb.save.titles, palettes: window.__lb.save.palettes, world: window.__lb.save.champions.paladin.world[id] }), R.id);
    await press('.level-cleared [data-menu]');
    await p.locator('.rr-panel').waitFor({ timeout: 3000 });
    await p.close();
    want(legend.run.cleared && legend.run.tier === 3 && /Legend crown/.test(cl.gift) && cl.gift.includes(R.title) && cl.gift.includes(R.palette[1]) && account.titles.includes(R.title) && account.palettes.includes(R.palette[0]) && account.world[3] === 5, `Legend crown ${JSON.stringify(legend.run)} "${cl.gift}" ${JSON.stringify(account)}`);
    want(errs.length === 0, `errors: ${errs[0]}`);
    log.push(`Legend crown: "${cl.gift}"`);
    return { ok: bad.length === 0, detail: `${log.join('; ')}${bad.length ? `; WRONG: ${bad.join(' | ')}` : ''}` };
  } catch (e) { // a screen that never came: say how far the run got and what stood there instead
    const at = await p.evaluate(() => `${window.__lb.state}: "${document.querySelector('.kit-head, .rr-name')?.textContent.trim() ?? ''}"`).catch(() => '?');
    await p.close().catch(() => {});
    return { ok: false, detail: `${log.join('; ')}; STOPPED at ${at}: ${String(e.message).split('\n')[0]}${bad.length ? `; WRONG: ${bad.join(' | ')}` : ''}${errs.length ? `; errors: ${errs[0]}` : ''}` };
  }
};

await check('Iron Hold: the map opens it with the Marches crown, its road and theme; one realm run on Knight: levels 1, 2 and 4 keep a locked Steel rare, level 3 the class relic, level 4 the Warden as an elite, the Knight crown picks a legendary and ends the run; the Champion crown gives the other, the Legend crown a title and a palette (#219)', realmRun({
  id: 'ironHold', name: 'The Iron Hold', family: 'Steel', theme: 'ironHold', own: /Warden|Forgemaster|Iron King/,
  first: 'The Warden', phases: 3, elite: 'The Warden’s judgement', third: 'Forgemaster', crown: 'Iron King',
  classRelic: ['aegisFaithful', 'Aegis of the Faithful'], legendaries: ['unbreakable', 'heartOfTheHold'], title: 'Ironsworn', palette: [6, 'Iron colours'],
}));

// ---------- #231: the Cinderlands' five levels, their rewards, its crown and its theme, as one realm run ----------
// The Iron Hold's run above, in the Cinderlands: the map opens it with the Marches crown, its levels play the Cinderlands' own theme (not
// the Ember Forge's), levels 1, 2 and 4 keep a locked Flame rare, level 2 ends on the Grand Inquisitor (2 phases, wave 16), level 3 on
// the Ember Queen and banks the Paladin's Flame class relic (Radiant Brand), level 4 on the Grand Inquisitor as an elite (3 phases: his
// third is announced as the Auto-da-fé), level 5 on the Cinder Colossus as crown boss with the Knight crown's pick of the two Flame
// legendaries; the Champion crown gives the other, the Legend crown the title Cinderborn and the Cinder colours.
await check('Cinderlands: the map opens it with the Marches crown, its road and theme; one realm run on Knight: levels 1, 2 and 4 keep a locked Flame rare, level 3 the class relic, level 4 the Grand Inquisitor as an elite with his Auto-da-fé, the Knight crown picks a legendary and ends the run; the Champion crown gives the other, the Legend crown a title and a palette (#231)', realmRun({
  id: 'cinderlands', name: 'The Cinderlands', family: 'Flame', theme: 'cinderlands', own: /Inquisitor|Ember Queen|Cinder Colossus|Heretic/,
  first: 'The Grand Inquisitor', phases: 2, elite: 'The Inquisitor’s auto-da-fé', third: 'Ember Queen', crown: 'Cinder Colossus',
  classRelic: ['radiantBrand', 'Radiant Brand'], legendaries: ['dragonsTongue', 'crownOfCinders'], title: 'Cinderborn', palette: [7, 'Cinder colours'],
}));

// ---------- #248: the ability bar's upgrade chips, key badge and the utility's name never cover one another ----------
await check('Ability bar: 0 to 3 upgrade chips, the E key and the utility name all stay readable at 1280x720, 1920x1080 and 844x390 (#248)', async () => {
  await inPage(() => {
    localStorage.removeItem('lastbastion.save');
    location.reload();
  });
  await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu');
  await inPage(async () => {
    const wait = (ms = 60) => new Promise((r) => setTimeout(r, ms));
    [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Settings').click();
    await wait(150);
    document.querySelector('[data-act="test"]').click();
    await wait();
    const set = (id, v) => {
      const el = document.getElementById(id);
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    set('tm-class', 'archer');
    set('tm-act', '1');
    set('tm-wave', '1');
    set('tm-level', '20');
    window.__startTest().player.invulnerable = true;
  });
  const bad = [], seen = [];
  for (const [w, h] of [[1280, 720], [1920, 1080], [844, 390]]) {
    await page.setViewportSize({ width: w, height: h });
    for (const n of [0, 1, 2, 3]) {
      await inPage((k) => { window.__lb.game.player.upgrades = ['burningRain', 'pinning', 'doubleVolley'].slice(0, k); }, n);
      await page.waitForTimeout(250);
      const r = await inPage(() => {
        const box = (el) => { const b = el.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
        const shown = (el) => el.getClientRects().length > 0;
        const P = box(document.querySelector('.hud-ability'));
        const chips = [...document.querySelectorAll('#h-ab-ups .hud-badge')].filter(shown);
        const key = document.querySelector('#h-ut-slot .hud-key'), name = document.getElementById('h-ut-name');
        const parts = [...chips.map((c) => ['chip', c]), ...(shown(key) ? [['key', key], ['name', name]] : [])];
        const inside = (b) => b.l >= P.l - 1 && b.r <= P.r + 1 && b.t >= P.t - 1 && b.b <= P.b + 1;
        const cut = parts.filter(([, el]) => !inside(box(el)) || el.scrollWidth > el.clientWidth + 1).map(([k]) => k);
        const over = [];
        for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
          const a = box(parts[i][1]), b = box(parts[j][1]);
          if (a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1) over.push(`${parts[i][0]}/${parts[j][0]}`);
        }
        return { chips: chips.length, key: shown(key), name: name.textContent, cut, over, offscreen: P.l < 0 || P.r > innerWidth || P.b > innerHeight };
      });
      seen.push(`${w}x${h}/${n}: ${r.chips} chips${r.key ? '' : ', key hidden (phone)'}`);
      if (r.cut.length || r.over.length || r.offscreen) bad.push(`${w}x${h} with ${n}: cut [${r.cut}] overlapping [${r.over}]${r.offscreen ? ' off screen' : ''}`);
      if (w > 844 && (r.chips !== n || !r.key || !r.name)) bad.push(`${w}x${h} with ${n}: ${r.chips} chips, key ${r.key}, name "${r.name}"`);
    }
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  return { ok: bad.length === 0, detail: bad.length ? bad.join('; ') : seen.join('; ') };
});

await check('HUD: the wave and boss panel fades while the champion or a boss is at the top wall under it, and comes back (#255)', async () => {
  // a run of its own: the check moves the champion and clears the field
  await inPage(() => { localStorage.removeItem('lastbastion.save'); location.reload(); });
  await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu');
  await inPage(async () => {
    const wait = (ms = 60) => new Promise((r) => setTimeout(r, ms));
    [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Settings').click();
    await wait(150);
    document.querySelector('[data-act="test"]').click();
    await wait();
    const el = document.getElementById('tm-class');
    el.value = 'viking';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    window.__startTest();
  });
  await page.waitForTimeout(300);
  // `who` stands under the panel (top wall) or far from it (bottom); the other is out of the way
  const put = async (who, where) => {
    await inPage((a) => {
      const lb = window.__lb, g = lb.game, pl = g.player;
      pl.invulnerable = true;
      g.spawnQueue.length = 0;
      g.enemies.length = 0;
      const b = g.bounds.w > 0 ? g.bounds : { x: g.arena.wall, y: g.arena.wall, w: g.arena.w - 2 * g.arena.wall, h: g.arena.h - 2 * g.arena.wall };
      const cx = b.x + b.w / 2, y = a.where === 'top' ? b.y + 30 : b.y + b.h - 300;
      // the camera centres the champion across, so he is always under the panel's column: apart from the boss only by height
      pl.x = cx;
      pl.y = a.who === 'champion' ? y : y + 260;
      if (a.who === 'boss') lb.spawn('ironKing', cx, y).hpFloor = 1;
      lb.run(2, false, false);
    }, { who, where });
    await page.waitForTimeout(450); // frames draw; the fade eases
    return inPage(() => Number(getComputedStyle(document.getElementById('h-wave-panel')).opacity));
  };
  const bossTop = await put('boss', 'top');
  if (process.env.PLAY_SHOT) { // a picture for the pull request, with any card on top of the field set aside
    await inPage(() => (document.getElementById('overlay').style.visibility = 'hidden'));
    await page.screenshot({ path: process.env.PLAY_SHOT }).catch(() => {});
    await inPage(() => (document.getElementById('overlay').style.visibility = ''));
  }
  const champTop = await put('champion', 'top');
  const bossLow = await put('boss', 'bottom');
  const champLow = await put('champion', 'bottom');
  return { ok: bossTop < 0.5 && champTop < 0.5 && bossLow > 0.9 && champLow > 0.9, detail: `top wall: boss ${bossTop}, champion ${champTop}; away from it: ${bossLow}, ${champLow}` };
});

// ---------- #256: no menu text under 14 px at 1280x720 on the title, the world map, the road, class select, the Keep and the talent tree ----------
// Played through the screens with the mouse at 1280x720 and by touch in phone landscape, on a champion with three Marches levels cleared
// (and later a run at level 3 holding three relics), 12 wins and full mastery: the title, the map, the road on level 3 (its "The run
// starts at level 1" note) and on level 4 with the run (its relics row, a relic's tooltip with its glossary block), class select, the Keep
// and a building's panel, the champion screen's Talents tab and the talent tree with a talent's tooltip. At 1280x720 no text showing is
// under 14 px (#235's rule); at both sizes the realm names, the road's tier buttons and its bottom row, the Keep's plates and a champion
// tile's record never overlap one another or spill out of their box.
for (const [w, h, touch] of [[1280, 720, false], [844, 390, true]]) {
  await check(`menus: no text under 14 px at 1280x720, nothing overlapping or cut off, on the title, map, road, class select, Keep and talent tree, ${touch ? 'tap' : 'click'} at ${w}x${h} (#256)`, async () => {
    const p = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`http://localhost:${PORT}/?debug`);
    await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
    const press = async (sel) => {
      await (touch ? p.locator(sel).first().tap({ timeout: 5000 }) : p.locator(sel).first().click({ timeout: 5000 }));
      await p.waitForTimeout(120);
    };
    const title = async () => {
      await p.goto(`http://localhost:${PORT}/?debug`);
      await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
      await seed(false);
    };
    const seed = (run) => p.evaluate(([run, carry]) => {
      const lb = window.__lb, three = ['brimstoneOil', 'emberheart', 'frostBrand'];
      lb.save.champions = { paladin: { name: 'Hild', inventory: three, loadouts: { marches: three.slice(0, 2) }, ...lb.build.grown({}), world: { marches: [3] }, signature: false, lastBastion: false, runs: run ? { marches: { ...carry, carry: { ...carry.carry, relics: { ...carry.carry.relics, held: three } } } } : {} } };
      lb.save.wins = { ...lb.save.wins, paladin: 12 };
      lb.save.classes.paladin.xp = 1e9; // Mastery 25: the longest record a champion tile holds
      lb.save.cards = [...lb.cardIds];
    }, [run, runAt(3)]);
    // every piece of text showing (the tooltip too) smaller than 14 px, and the labels that overlap one another or spill out of their box
    const look = (screen) => p.evaluate((screen) => {
      const tiny = [];
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        const e = n.parentElement, r = e.getBoundingClientRect();
        if (!n.textContent.trim() || !r.width || !r.height || e.closest('[hidden], #hud') || getComputedStyle(e).visibility === 'hidden') continue;
        const px = parseFloat(getComputedStyle(e).fontSize);
        if (px < 14) tiny.push(`${screen}: ${px}px "${n.textContent.trim().slice(0, 24)}"`);
      }
      const shown = (sel) => [...document.querySelectorAll(sel)].filter((e) => e.getClientRects().length && !e.closest('[hidden]'));
      const name = (e) => e.textContent.trim().replace(/\s+/g, ' ').slice(0, 20);
      const bad = [];
      for (const sel of ['.wm-name', '.rr-tier', '.rr-go:not([hidden]) > *', '.keep-plate']) {
        const els = shown(sel);
        for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
          const a = els[i].getBoundingClientRect(), b = els[j].getBoundingClientRect();
          if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) bad.push(`${screen}: "${name(els[i])}" over "${name(els[j])}"`);
        }
      }
      for (const [one, other] of [['.kit-screen > .sub', '.kit-head .kit-close']]) { // a screen's line under its heading and its back button
        for (const a of shown(one)) for (const b of shown(other)) {
          const words = document.createRange(); // the text's own lines, not the paragraph's full-width box
          words.selectNodeContents(a);
          const o = b.getBoundingClientRect();
          if ([...words.getClientRects()].some((r) => r.left < o.right - 1 && o.left < r.right - 1 && r.top < o.bottom - 1 && o.top < r.bottom - 1)) bad.push(`${screen}: "${name(a)}" under the back button`);
        }
      }
      for (const [sel, box] of [['.wm-name, .wm-opens', '.wm-map'], ['.keep-plate', '.keep-yard'], ['.champ-rec, .champ-name', '.card.champ'], ['.rr-go:not([hidden]) > *', '.rr-panel']]) {
        for (const e of shown(sel)) {
          const r = e.getBoundingClientRect(), o = e.closest(box).getBoundingClientRect();
          if (r.left < o.left - 1 || r.right > o.right + 1 || r.top < o.top - 1 || r.bottom > o.bottom + 1 || e.scrollWidth > e.clientWidth + 1) bad.push(`${screen}: "${name(e)}" cut off`);
        }
      }
      const tip = document.getElementById('tooltip');
      return { tiny, bad, gloss: !!tip && tip.style.display === 'block' && !!tip.querySelector('.gloss') };
    }, screen);
    const seen = [];
    const at = async (screen) => {
      await p.waitForTimeout(150);
      const r = await look(screen);
      seen.push(r);
      return r;
    };
    await seed(false);
    await at('title');
    await press('[data-go="map"]');
    await at('map');
    await press('.wm-realm.r-marches');
    await press('.rr-flag.l-3');
    const note = await p.evaluate(() => document.querySelector('.rr-from')?.textContent ?? '');
    await at('road');
    await press('[data-back]');
    await seed(true);
    await press('.wm-realm.r-marches');
    await press('.rr-flag.l-4');
    const run = await p.evaluate(() => ({ relics: document.querySelectorAll('.rr-relic').length, note: document.querySelector('.rr-from')?.textContent ?? '' }));
    await at('road with a run');
    let gloss = null;
    if (!touch) {
      await p.hover('.rr-relic');
      gloss = (await at('a run relic\'s tooltip')).gloss;
      await p.mouse.move(2, 2);
    }
    await title();
    await press('[data-go="start"]');
    await at('class select');
    await title();
    await press('[data-go="keep"]');
    await p.locator('.keep-yard').waitFor({ timeout: 3000 });
    await at('the Keep');
    await press('.keep-bld.b-armory');
    await at('the Armory\'s panel');
    await title();
    await press('[data-go="champion"]');
    await p.locator('.champion-screen').waitFor({ timeout: 3000 });
    await skipTour(p, touch);
    await press('[data-cs="talents"]');
    await at('champion Talents tab');
    await press('[data-spend-talents]');
    await p.locator('.kit-screen.talents').waitFor({ timeout: 3000 });
    await at('talent tree');
    if (!touch) {
      await p.hover('.talent');
      await at('a talent\'s tooltip');
    }
    await p.close();
    const tiny = touch ? [] : [...new Set(seen.flatMap((s) => s.tiny))];
    const bad = [...new Set(seen.flatMap((s) => s.bad))];
    const ok = seen.length === (touch ? 9 : 11) && tiny.length === 0 && bad.length === 0 && note === 'The run starts at level 1' && run.relics === 3 && run.note === 'the run stands at level 3'
      && (touch || gloss) && errs.length === 0;
    return { ok, detail: `${seen.length} screens; road notes "${note}" / "${run.note}" with ${run.relics} run relics${touch ? '' : `, a relic's tooltip ${gloss ? 'with' : 'WITHOUT'} its glossary block; under 14 px: ${tiny.slice(0, 8).join(', ') || 'none'}${tiny.length > 8 ? ` (+${tiny.length - 8})` : ''}`}; overlapping or cut off: ${bad.slice(0, 8).join(', ') || 'none'}${errs.length ? `; errors: ${errs[0]}` : ''}` };
  });
}


// ---------- #257: a keep-a-relic level with no relic left to keep says why and what you get instead ----------
await check('Iron Hold: a level 1 clear by a champion who owns every Steel rare says so in one plain sentence above a lone "Take 2 Runes" (#257)', async () => {
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://localhost:${PORT}/?debug`);
  await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
  const press = (sel) => p.locator(sel).first().click();
  await p.evaluate(() => {
    const lb = window.__lb;
    lb.save.champions = { paladin: { name: 'Hild', inventory: lb.relicRares('steel'), loadouts: {}, ...lb.build.grown({ marches: [7] }), world: { marches: [7] }, signature: false, lastBastion: false, runs: {} } };
  });
  await press('[data-go="map"]');
  await press('.wm-realm.r-ironHold');
  await p.locator('.rr-panel').waitFor({ timeout: 3000 });
  await press('.rr-tier[data-tier="1"]');
  await press('[data-fight]');
  await p.waitForFunction(() => window.__lb.state === 'choice' && !!document.querySelector('[data-pick]'), null, { timeout: 5000 });
  await p.evaluate(() => { window.__lb.game.level.cleared = true; }); // as if its boss fell: the level ends once its opening pick is taken
  await press('[data-pick="0"]');
  await p.locator('.rare-pick').waitFor({ timeout: 5000 });
  const got = await p.evaluate(() => ({ sub: document.querySelector('.rare-pick .sub')?.textContent.trim(), cards: document.querySelectorAll('.rare-pick [data-pick]').length, buttons: [...document.querySelectorAll('.rare-pick button')].map((b) => b.textContent.trim()) }));
  await p.screenshot({ path: `${process.env.TEMP ?? '.'}/lb257-no-relic.png` });
  const ok = got.sub === 'You already own every Steel relic this level offers, so you get 2 Runes instead.' && got.cards === 0 && got.buttons.length === 1 && /Take ◆ 2 Runes/.test(got.buttons[0]) && errs.length === 0;
  await p.close();
  return { ok, detail: ok ? got.sub : `${JSON.stringify(got)} ${errs.join('|')}` };
});

await check('no console errors', async () => {
  const real = errors.filter((m) => !expected(m)); // the error-overlay check throws one on purpose
  return { ok: real.length === 0, detail: real.slice(0, 3).join(' | ') };
});

await browser.close();
const width = Math.max(...results.map((r) => r.name.length));
for (const r of results) console.log(`${r.skip ? 'skip' : r.ok ? 'ok  ' : 'FAIL'}  ${r.name.padEnd(width)}  ${r.detail}`);
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} of ${results.length} checks failed` : `\nall ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
