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
import { chromium } from 'playwright';
import { spawnTree, killTree } from './lib/process-tree.mjs';

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
for (let i = 0; i < 60; i++) {
  try {
    await fetch(`http://localhost:${PORT}/`);
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 250));
  }
}

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
  try {
    const r = await fn();
    results.push({ name, ok: !!r.ok || !!r.skip, skip: !!r.skip, detail: r.detail ?? '' });
  } catch (e) {
    results.push({ name, ok: false, detail: `threw: ${String(e.message ?? e).split('\n')[0]}` });
  }
}
const inPage = (fn, arg) => page.evaluate(fn, arg);
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
    const shown = tip?.style.display === 'block' && tip.innerText.includes('For this build') && tip.innerText.includes('Tier II');
    await P.click('[data-skip]'); // skipped, so the later checks still take Butcher's Hook fresh
    return { ok: big && first && lines.length === 1 && !lines[0].innerText.includes('\n') && shown && rel.offers.length === 0, detail: `effect "${effect.innerText}", line "${lines[0]?.innerText}" (${lines.length}), bigger ${big}, tip shown ${shown}${shown ? '' : ` (${tip?.style.display}: ${(tip?.innerText ?? '').slice(0, 60)})`}` };
  }),
);

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
      && /Head start\s*Level 1/.test(road.text) && /Slots\s*1/.test(road.text) && /Enemy HP\s*85%/.test(road.text) && /Steel relics featured/.test(road.text) && /Wolf/.test(road.text) && /Pick 1 of 2 Steel rares/.test(road.text)
      && knight.tiers === 'oX--' && /Enemy HP\s*123%/.test(knight.text) && squire.tiers === 'Xo--' && squire.flags[0].on
      && run?.realm === 'marches' && run.level === 1 && run.last === 5 && run.start === 1 && run.tier === 0 && run.arena === 'courtyard' && errs.length === 0;
    return { ok, detail: `${road.flags.length} flags (${road.flags.filter((f) => f.open).length} open${road.flags.every((f) => f.inside) ? '' : ', one off the road'}), "${road.name}", tiers ${road.tiers} -> Knight ${knight.tiers} (${/Enemy HP\s*123%/.test(knight.text) ? 'HP 123%' : 'HP?'}) -> ${squire.tiers}, ${road.golds} gold button, FIGHT ${road.fight ? 'reachable' : 'hidden'}${road.onScreen ? '' : ' (off screen)'}; run: ${run ? `${run.realm} level ${run.level}, waves ${run.start}-${run.last}, tier ${run.tier}, ${run.arena}` : 'none'}${errs.length ? `; errors: ${errs[0]}` : ''}` };
  });
}

// ---------- #221: the level step: the panel's Enemy HP on Knight is what the level fights at, eased on level 1 of the Marches ----------
for (const [w, h, touch] of [[1280, 720, false], [844, 390, true]]) {
  await check(`level step: the Marches level 1 on Knight shows Enemy HP 123% (Knight 145% eased) and FIGHT plays it at that HP, ${touch ? 'tap' : 'click'} at ${w}x${h} (#221)`, async () => {
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
    const ok = shown === '123' && run?.level === 1 && run.tier === 1 && run.hp === 123 && errs.length === 0;
    return { ok, detail: `panel Enemy HP ${shown ?? '?'}%; run: ${run ? `level ${run.level}, tier ${run.tier}, enemy HP ${run.hp}%` : 'none'}${errs.length ? `; errors: ${errs[0]}` : ''}` };
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
      && pick.cards[0].name !== second && kept.inv.length === 1 && kept.cleared[0] === 1 && /Back to the Marches/.test(menu) && /The Marches · Level 1/.test(retry)
      && road.name === 'The Marches · Level 2' && road.open.slice(0, 3).join() === 'true,true,false' && /Flame relics featured/.test(road.text) && /Pick 1 of 2 Flame rares/.test(road.text) && errs.length === 0;
    return { ok, detail: `opening "${opening.trim()}"; "${pick.head}": ${pick.cards.map((c) => `${c.name} (${c.fam.trim()}, ${c.inside ? 'in view' : 'off screen'})`).join(' / ')}; took ${second} -> inventory [${kept.inv.join()}], cleared ${kept.cleared.join('/')}; "${retry}" / "${menu}" -> "${road.name}"${/Pick 1 of 2 Flame rares/.test(road.text) ? ', Flame pick next' : ''}${errs.length ? `; errors: ${errs[0]}` : ''}` };
  });
}

// ---------- #212: the Iron Hold's knights: map -> the Iron Hold -> level 3's panel names the Iron Knight -> level 2 -> FIGHT; he brings his own flash card,
// "Got it" closes it, and in the fight every blow breaks one of his six plates with a clang until he stands bare in his mail ----------
await check('Iron Hold: level 3 names the Iron Knight, level 2 fields him, his flash card shows, blows break his plates one by one and he turns bare (#212)', async () => {
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://localhost:${PORT}/?debug`);
  await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
  await p.evaluate(() => {
    const champ = (name) => ({ name, inventory: [], loadouts: {}, talentPlan: [], world: { marches: [7], ironHold: [2] }, signature: true, lastBastion: false });
    const lb = window.__lb;
    lb.save.champions = Object.fromEntries(['paladin', 'viking', 'angel', 'necromancer', 'archer'].map((c) => [c, champ(c)])); // the Marches crowned, Iron Hold levels 1-2 cleared
    lb.save.cards = lb.cardIds.filter((id) => id !== 'ironKnight'); // every other card already seen, so his is the one that shows
  });
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
    const knight = [lb.spotlight, ...(g?.enemies ?? [])].find((e) => e && e.def.id === 'ironKnight' && !e.dead && e.armorHp === e.armorMax);
    if (knight) {
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
    return { id: c?.dataset.card, title: c?.querySelector('.kit-parch h2')?.textContent, text: c?.querySelector('.kit-parch p')?.textContent, realm: g?.level?.realm, level: g?.level?.level, plain: g?.enemies.filter((e) => e.def.id === 'knight').length };
  });
  if (card.id) await p.click('[data-leave]');
  const fight = await p.evaluate(async () => {
    await new Promise((r) => setTimeout(r, 100));
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
  return { ok, detail: `panel "${panel.name}" ${/Iron Knight/.test(panel.text) ? 'names the Iron Knight' : 'NO Iron Knight'}; run ${card.realm} ${card.level}, card ${card.id ?? 'NONE'} "${card.title ?? ''}", plain knights ${card.plain}; closed ${fight.closed}; ${fight.found ? `plates ${fight.steps.join('>')} of ${fight.max} (per blow ${fight.blows.join(',')}; ${fight.ticks} ticks), sprite ${fight.bare}, ${fight.clangs} clangs${fight.dead ? ', killed' : ''}` : 'no Iron Knight on the field'}${errs.length ? `; errors: ${errs[0]}` : ''}` };
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
    const champ = (name) => ({ name, inventory: [], loadouts: {}, talentPlan: [], world: { marches: [7], ironHold: [2] }, signature: true, lastBastion: false });
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
    const wait = () => { p.invulnerable = true; for (let i = 0; i < 40000 && !marked().length && lb.game === g && lb.state !== 'results'; i++) lb.run(1, false, true); p.invulnerable = false; return marked(); };`;
  const still = await p.evaluate(`(() => { ${setup}
    const sounds = (window.__press = { warn: 0, slam: 0 });
    const real = lb.view.sfx;
    lb.view.sfx = (n) => ((n in sounds && sounds[n]++), real(n));
    const zs = wait();
    if (!zs.length) return { found: false, realm: g.level?.realm, wave: g.wave };
    const warned = sounds.warn > 0;
    // a foe on a marked slab beside the champion's (the others sent far off), tough enough to live through it
    const mine = zs.find((z) => onSlab(z, p)), other = zs.find((z) => z !== mine);
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
    const bracket = px(mine.x - S / 2 + 4, mine.y - S / 2 + 4), ramOn = grid.map(([x, y]) => px(x, y).join());
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
  })()`);
  // the next marking: step off the line with the keyboard (a line across: up or down, towards the open floor; a line down: left or right)
  let dodge = { found: false };
  if (still.found) {
    const key = await p.evaluate(`(() => { ${setup}
      const zs = wait();
      if (!zs.length) return null;
      const across = zs.every((z) => z.y === zs[0].y), mid = g.bounds;
      return across ? (p.y > mid.y + mid.h / 2 ? 'KeyW' : 'KeyS') : (p.x > mid.x + mid.w / 2 ? 'KeyA' : 'KeyD');
    })()`);
    if (key) {
      await p.keyboard.down(key);
      dodge = await p.evaluate(`(() => { ${setup}
        const zs = marked(), hp0 = p.hp;
        for (const e of g.enemies) Object.assign(e, { x: p.x + 3000, y: p.y }); // nothing else to hurt him
        let onIt = true, hp = p.hp;
        for (let i = 0; i < 1000 && marked().length; i++) { onIt = zs.some((z) => onSlab(z, p)); hp = p.hp; lb.run(1, false, 'input'); }
        return { found: true, key: '${key}', onIt, hurt: hp - p.hp, start: hp0 };
      })()`);
      await p.keyboard.up(key);
    }
  }
  await p.close();
  // the bracket's glow pulses, so one sample can catch it dim: a warm hue (red well over green, over twice the blue) is the proof
  const red = still.bracket && still.bracket[0] > still.bracket[1] + 30 && still.bracket[0] > 2 * still.bracket[2];
  const ok = still.found && still.realm === 'ironHold' && still.level === 1 && still.arena === 'keep' && still.n >= 2 && still.warned && red && still.ram
    && still.onIt && still.hurt > 0 && still.slam > 0 && still.foeHurt > 0 && dodge.found && !dodge.onIt && dodge.hurt === 0 && errs.length === 0;
  return { ok, detail: still.found ? `${still.realm} level ${still.level} in the ${still.arena}: ${still.n} slabs marked${still.warned ? ' with a warning' : ''}, bracket rgb(${(still.bracket ?? []).slice(0, 3).join(',')}), ram ${still.ram ? 'drawn' : 'NOT drawn'}${still.props ? '' : ' (props atlas not loaded yet)'}; standing still: ${still.onIt ? 'on the slab' : 'OFF the slab'}, hurt ${Math.round(still.hurt)}, ${still.slam} slam sound(s), the foe beside him hurt ${Math.round(still.foeHurt)}; stepped aside (${dodge.key ?? 'no key'}): ${dodge.found ? `${dodge.onIt ? 'STILL on a slab' : 'off the slabs'}, hurt ${Math.round(dodge.hurt)}` : 'no second marking'}${errs.length ? `; errors: ${errs[0]}` : ''}` : `no press marked slabs (${still.realm}, wave ${still.wave})` };
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
  await p.evaluate(() => {
    const champ = (name) => ({ name, inventory: [], loadouts: {}, talentPlan: [], world: { marches: [7], ironHold: [1] }, signature: true, lastBastion: false });
    const lb = window.__lb;
    lb.save.champions = Object.fromEntries(['paladin', 'viking', 'angel', 'necromancer', 'archer'].map((c) => [c, champ(c)])); // the Marches crowned, Iron Hold level 1 cleared
    lb.save.cards = lb.cardIds.filter((id) => id !== 'ironShieldwall'); // every other card already seen, so his is the one that shows
  });
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
  const fight = await p.evaluate(async () => {
    await new Promise((r) => setTimeout(r, 100));
    const lb = window.__lb, g = lb.game, pl = g.player;
    const closed = !document.querySelector('[data-card]') && lb.state === 'playing';
    const walls = () => g.enemies.filter((e) => e.def.id === 'ironShieldwall' && !e.dead);
    // until the line breaks formation to fight (a state, not a clock): in formation they face the march, not the champion
    for (let i = 0; i < 5000 && walls().some((e) => e.ai === 'regroup') && lb.game === g; i++) lb.run(1, false, false);
    const w = walls()[0];
    if (!w) return { closed, found: false };
    const arc = lb.enemyDef('ironShieldwall').frontBlock;
    // a known state: he stands alone (everything else is cleared away), and the champion is put beside him, facing him
    for (const o of g.enemies) if (o !== w) o.dead = true;
    lb.run(1, false, false);
    const swing = (side) => {
      w.hp = w.maxHp;
      const a = w.angle + side;
      pl.x = w.x + Math.cos(a) * (w.r + pl.r + 4);
      pl.y = w.y + Math.sin(a) * (w.r + pl.r + 4);
      pl.attackTimer = 0;
      const b0 = window.__blocks.n, texts0 = g.texts.filter((t) => t.text === 'BLOCKED').length;
      for (let i = 0; i < 30 && w.hp === w.maxHp && !w.dead; i++) lb.run(1, false, false); // one swing: until it lands
      return { dealt: w.maxHp - Math.max(0, w.hp), blocks: window.__blocks.n - b0, text: g.texts.filter((t) => t.text === 'BLOCKED').length > texts0 };
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
    return { closed, found: true, arc, front, back, turned: +d.toFixed(3) };
  });
  await p.close();
  const ok = card.realm === 'ironHold' && card.level === 2 && card.spawned === 5 && card.plain === 0
    && card.id === 'ironShieldwall' && card.title === 'Iron Shieldwall' && /turns slowly/.test(card.text ?? '')
    && fight.closed && fight.found && fight.front.blocks > 0 && fight.front.text && fight.back.blocks === 0 && !fight.back.text
    && fight.front.dealt > 0 && fight.back.dealt > 0 && fight.front.dealt < fight.back.dealt * 0.5
    && fight.turned > 0 && fight.turned < fight.arc / 2 && errs.length === 0;
  return { ok, detail: `run ${card.realm} ${card.level}: ${card.spawned} Iron Shieldwalls, ${card.plain} plain; card ${card.id ?? 'NONE'} "${card.title ?? ''}"; closed ${fight.closed}; ${fight.found ? `front swing ${fight.front.dealt.toFixed(1)} (${fight.front.blocks} clanks${fight.front.text ? ', BLOCKED' : ''}), back swing ${fight.back.dealt.toFixed(1)} (${fight.back.blocks} clanks); turned ${fight.turned} rad in ten ticks` : 'no Iron Shieldwall on the field'}${errs.length ? `; errors: ${errs[0]}` : ''}` };
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
  await p.evaluate(() => {
    const champ = (name) => ({ name, inventory: [], loadouts: {}, talentPlan: [], world: { marches: [7], ironHold: [1] }, signature: true, lastBastion: false });
    const lb = window.__lb;
    lb.save.champions = Object.fromEntries(['paladin', 'viking', 'angel', 'necromancer', 'archer'].map((c) => [c, champ(c)])); // the Marches crowned, Iron Hold level 1 cleared
    lb.save.cards = lb.cardIds.filter((id) => id !== 'thornBearer'); // every other card already seen, so his is the one that shows
  });
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

// ---------- #197: the champion screen: the champion on a pedestal between six slots, set chips, the inventory, the talent plan, PLAY, the tabs ----------
// From the title's Champion button, at 1280x720 with the mouse and in phone landscape by touch: a legendary tapped in the inventory takes two
// slots and idles in the Marches level 1's one slot, a second legendary says why it can't go in, a slot tapped takes its relic out, a
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
      window.__lb.save.champions = { paladin: { name: 'Hild', inventory: ['brimstoneOil', 'emberheart', 'dragonsTongue', 'everfrostCrown'], loadouts: {}, talentPlan: [], world: {}, signature: false, lastBastion: false } };
    });
    await press('[data-go="champion"]');
    await p.locator('.champion-screen').waitFor({ timeout: 3000 });
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
        loadout: (champ.loadouts.marches ?? []).join(','), savedPlan: champ.talentPlan.length,
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
    await press('[data-plan]');
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
    const ok = first.fits && first.figure && first.slots === 'o-----' && first.inv === 4 && first.blocked === '' && first.play === 'Play' && first.playReach && first.greens === 1 && first.tabs === 'oXooo'
      && /The Marches · Level 1/.test(first.next) && /1 slot/.test(first.next) && first.sets === ''
      && slotted.slots === 'RRo---' && slotted.loadout === 'dragonsTongue' && slotted.blocked === 'everfrostCrown' && slotted.sets === ''
      && /everfrost crown: at most 1 legendary/i.test(refused.why) && refused.loadout === 'dragonsTongue'
      && common.slots === 'R-----' && common.loadout === 'brimstoneOil' && common.sets === '1'
      && planned.plan === 1 && planned.savedPlan === 1 && map === 1
      && run?.realm === 'marches' && run.level === 1 && run.held.split(',')[0] === 'brimstoneOil' && run.talents === 0 // level 1's head start has no point to spend yet
      && /Restart/i.test(fell.play) && /fell at wave \d+/.test(fell.next) && again?.level === 1 && again.seed === run.seed && errs.length === 0;
    return { ok, detail: `slots ${first.slots}, ${first.inv} relics, "${first.next}", ${first.play}${first.playReach ? '' : ' (out of reach)'}, tabs ${first.tabs}; Dragon's Tongue -> ${slotted.slots} (sets ${slotted.sets || '-'}, blocked ${slotted.blocked || '-'}); Everfrost -> "${refused.why}"; out, Brimstone -> ${common.slots}; plan ${planned.plan}; map ${map ? 'opens' : '?'}; run ${run ? `${run.realm} ${run.level}, held ${run.held}` : 'none'}; after a fall "${fell.next}" ${fell.play} -> level ${again?.level} seed ${again?.seed === run?.seed ? 'same' : 'new'}${first.fits ? '' : ' (off screen)'}${errs.length ? `; errors: ${errs[0]}` : ''}` };
  });
}

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

// ---------- v0.10 (#193): a v0.7-v0.9 save (format 6) loads as format 7 with its champions, its relics kept, the old text under Restore ----------
await check('save v7: a format-6 save migrates with champions, and the Keep, Chronicle and Settings still open (#193)', async () => {
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
  const ok = s.version === 7 && kept && opened.every(Boolean) && label.includes('v0.7-v0.9') && errors.length === errs;
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
  await check(`Marches tutorial: levels 1-2 teach moving, relics, the ability, level-ups, the utility and a status on flash cards, once each, none in a full run, ${touch ? 'tap' : 'Enter'} at ${w}x${h} (#60)`, async () => {
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
          const e = { id: c.dataset.card, tick: g.tick, icon: !!c.querySelector('.card-pic.icon'), spot: !!lb.spotlight, levelUps: g.pendingLevelUps, screenUnder: !!document.querySelector('.levelup') };
          lb.run(1, false, true); // Got it, and a step
          e.screenAfter = !!document.querySelector('.levelup [data-pick]'); // the level-up card's screen follows it
          out.push(e);
          continue;
        }
        const need = ['move', 'relics', 'ability', 'levelUp', 'utility'].every((id) => lb.save.cards.includes(id));
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
    const want = ['relics', 'ability', 'levelUp', 'utility', 'status'];
    const lvl = at('levelUp');
    const ok = full.every((id) => !TUTORIAL.includes(id)) && opening.pick > 0 && !opening.card && opening.level === 1
      && move?.id === 'move' && move.name === 'Move and fight' && /WASD/.test(move.text) && move.icon && move.ribbon === 'New' && move.state === 'choice' && !move.spot && move.fits && move.saved && held && closed
      && want.every((id) => ids.filter((x) => x === id).length === 1) && !ids.includes('move') && seen.out.every((e) => e.icon && !e.spot)
      && at('relics').tick >= 120 && at('ability').tick >= 480 && lvl.levelUps > 0 && !lvl.screenUnder && lvl.screenAfter
      && TUTORIAL.filter((id) => id !== 'sets').every((id) => seen.cards.filter((x) => x === id).length === 1) && errs.length === 0;
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
    await p.evaluate(() => {
      window.__lb.save.champions = { paladin: { name: 'Hild', inventory: [], loadouts: {}, talentPlan: [], world: { marches: [6] }, signature: false, lastBastion: false } };
    });
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
      s.champions = { ...s.champions, viking: { name: 'Sigrun', inventory: ['brimstoneOil'], loadouts: { marches: ['brimstoneOil'] }, talentPlan: [], world: { marches: [7] }, signature: false, lastBastion: false } };
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
// one slot); the Map tab -> the Marches -> its road -> FIGHT plays level 1, which the bot clears in full (all 5 waves and its boss;
// the champion can't be hurt, the one shortcut), and its Steel rare (key 1) joins the champion. Back on the road, Loadout slots that rare
// for level 2 and PLAY starts it holding the rare. There the champion stands still at 1 HP until a foe really kills it: "Thou art
// slain", then the champion screen says where it fell, and RESTART plays level 2 again on the same seed, which the bot clears. Levels
// 3-7 each go road -> Loadout (every relic won slotted; the level's own slots are live, the rest idle) -> PLAY, holding the live ones,
// played out to the level's last wave and its rare; level 7's crown Warden falls and the crown's gold card (Enter) gives the signature.
await check('journey: a new champion, its loadout slots, the map, the realm road, level 1 cleared, a fall in level 2 and its restart, levels 3-7 and the Marches crown pick, click and keys at 1280x720 (#208)', async () => {
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
    return { held, state: lb.state, cleared: !!g.level?.cleared, over: g.over, wave: g.wave, last: g.level?.last, level: g.level?.level, seed: g.seed };
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
  const born = await screen();
  want(born.champ?.name === 'Viking' && born.champ.inventory.length === 0 && born.empty && born.slots === 'o-----' && born.play === 'Play' && /The Marches · Level 1/.test(born.next) && /1 slot\b/.test(born.next), `new champion ${JSON.stringify(born)}`);
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
  // back on the road at level 2; Loadout slots the rare, PLAY
  await press('[data-menu]');
  await p.locator('.rr-panel').waitFor({ timeout: 3000 });
  const road2 = (await p.locator('.rr-name').textContent()).trim();
  want(road2 === 'The Marches · Level 2', `road after level 1 "${road2}"`);
  await press('[data-loadout]');
  await p.locator('.champion-screen').waitFor({ timeout: 3000 });
  const bare = await screen();
  await press(`.cs-relic[data-relic="${won.inventory[0]}"]`);
  const slotted = await screen();
  want(bare.slots === 'o-----' && /Level 2/.test(bare.next) && slotted.slots === 'R-----' && slotted.champ.loadouts.marches?.join() === won.inventory[0], `level 2 loadout ${bare.slots} -> ${slotted.slots}`);
  await press('[data-play]');
  await opening();
  // the fall: at 1 HP and standing still, the first blow that lands ends it
  const fell = await playOut(true);
  want(fell.over && fell.level === 2 && fell.state === 'results' && fell.held[0] === won.inventory[0], `the fall ${JSON.stringify(fell)}`);
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
  want(again.level === 2 && again.seed === fell.seed && again.cleared && again.wave === again.last, `restart ${JSON.stringify(again)}`);
  log.push(`level 2 with ${fell.held[0]}: "${slain.head}" at wave ${fell.wave}, "${after.next}" -> ${after.play} on the ${again.seed === fell.seed ? 'same' : 'OTHER'} seed, cleared`);
  await rarePick(2);
  // levels 3-7 by the road, every relic won in the loadout
  const base = [1, 1, 2, 2, 3, 3, 4];
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
    const live = +(lo.next.match(/(\d+) slots?/)?.[1] ?? 0), loadout = lo.champ.loadouts.marches ?? [];
    want(road === `The Marches · Level ${n}` && live >= base[n - 1] && lo.slots.replace(/[-r]/g, '').length === live && loadout.length === Math.min(6, lo.champ.inventory.length), `level ${n}: "${road}", ${lo.slots} for ${live} slots, loadout ${loadout.join()}`);
    await press('[data-play]');
    await opening();
    const run = await playOut(false);
    want(run.level === n && run.cleared && run.wave === run.last && run.held.slice(0, live).join() === loadout.slice(0, live).join(), `level ${n} ${JSON.stringify(run)}`);
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
  want(/The Marches crowned/.test(crown.head) && crown.cards === 1 && crown.name === "Jarl's Torc" && crown.gold && end.signature && end.inventory.includes('jarlsTorc') && end.world.marches[0] === 7, `crown ${JSON.stringify(crown)}, champion ${JSON.stringify(end)}`);
  want(errs.length === 0, `errors: ${errs[0]}`);
  log.push(`"${crown.head}": ${crown.name}${crown.gold ? ' (gold)' : ''}, ${end.inventory.length} relics, signature ${end.signature}`);
  return { ok: bad.length === 0, detail: `${log.join('; ')}${bad.length ? `; WRONG: ${bad.join(' | ')}` : ''}` };
});

// ---------- #208: the slot rules left over from #197's check, by touch in phone landscape ----------
// #197 plays a legendary's two slots and the one-legendary rule. Here a Viking with the Keep's two extra slots (Armorer's Choice, the
// Keepsake) on level 7 (six slots), reached by the champion screen's arrow: two class relics shut out a third ("at most 2"), the signature still goes beside them, four Steel
// relics shut out a fifth ("at most 4 of one family"), six filled leave no free slot, PLAY holds all six; level 1 from the road has
// three live slots, the rest idle, and its run holds the first three.
await check('slot rules: at most 2 class relics (the signature beside them), 4 of one family, no seventh slot; a smaller level takes the first ones, tap at 844x390 (#208)', async () => {
  const p = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://localhost:${PORT}/?debug`);
  await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
  const tap = (sel) => p.locator(sel).first().tap();
  await p.evaluate(() => {
    const s = window.__lb.save;
    s.champions = { viking: { name: 'Sigrun', inventory: ['stormbornPelt', 'wolfskin', 'ironhide', 'towerShield', 'thornMail', 'anvilHeart', 'shockSigil', 'jarlsTorc'], loadouts: {}, talentPlan: [], world: { marches: [6] }, signature: true, lastBastion: false } };
    s.meta.startRelic = 1; // Armorer's Choice: a slot
    s.classes.viking.xp = 1e6; // mastery up to the Keepsake: a slot
  });
  await tap('[data-go="champion"]'); // the Paladin's screen, then the next champion's arrow: the Viking
  await p.locator('.champion-screen').waitFor({ timeout: 3000 });
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
  // the opening screens answered, then the pause menu's End run, and level 1 (one slot of its own, two from the Keep) from the road
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
  const ok = /Level 7/.test(first.next) && /6 slots/.test(first.next) && first.slots === 'oooooo' && Object.keys(first.blocked).length === 0
    && classes.loadout === 'stormbornPelt,wolfskin' && classes.blocked.ironhide === 'At most 2 class relics.' && !classes.blocked.jarlsTorc
    && /Ironhide: At most 2 class relics/.test(third.why) && third.loadout === classes.loadout
    && full.slots === 'RRRRRR' && full.blocked.ironhide === 'No free slot for it (a legendary takes two).' && /No free slot/.test(full.blocked.jarlsTorc ?? '')
    && fifth.blocked.ironhide === 'At most 4 relics of one family.' && /Ironhide: At most 4 relics of one family/.test(fifth.why) && !fifth.loadout.includes('ironhide')
    && six.loadout === six7 && six.slots === 'RRRRRR' && run7.level === 7 && run7.held.startsWith(six7)
    && /Level 1/.test(small.next) && /3 slots/.test(small.next) && small.slots === 'RRRrrr' && run1.level === 1 && run1.held.split(',').slice(0, 4).join() === six7.split(',').slice(0, 3).join() && errs.length === 0;
  return { ok, detail: `"${first.next}" ${first.slots}; 2 class relics -> Ironhide "${classes.blocked.ironhide ?? '-'}", signature ${classes.blocked.jarlsTorc ? 'blocked' : 'free'}; six in: ${full.slots}, Torc "${full.blocked.jarlsTorc ?? '-'}"; a slot free -> Ironhide "${fifth.blocked.ironhide ?? '-'}"; level 7 holds ${run7.held}; level 1 "${small.next}" ${small.slots}, holds ${run1.held}${errs.length ? `; errors: ${errs[0]}` : ''}` };
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
      picks: g.pendingAbilityTiers.length, offer: g.player.relics.offers[0]?.from, families: document.querySelector('[data-families]')?.textContent.trim() ?? '', hud: document.body.innerText.includes('TEST') };
  });
  await p.locator('[data-pick="0"]').click().catch(() => {});
  const held = await p.evaluate(() => window.__lb.game.player.relics.held.length);
  await p.close();
  const ok = before === 'false,false,false' && after === 'true,true,true' && /Iron Hold · Level 4 \(waves 21–30\)/.test(label ?? '')
    && run?.test === 1 && run.realm === 'ironHold' && run.level === 4 && run.last === 30 && run.start === 21 && [20, 21].includes(run.wave) && run.act === 3 && run.lv === 19 && run.arena === 'keep' // wave 21 may already have begun
    && run.picks > 0 && run.offer === 'start' && /Steel/.test(run.families) && run.hud && held === 1 && errs.length === 0;
  return { ok, detail: `"${label}"; act/wave/level disabled ${before} -> ${after}; run: ${run ? `test ${run.test}, ${run.realm} level ${run.level}, waves ${run.start}-${run.last} (on wave ${run.wave}, Act ${run.act}), lv ${run.lv}, ${run.arena}, ${run.picks} queued ability picks, offer from ${run.offer} "${run.families}", TEST tag ${run.hud}` : 'none'}; picked -> ${held} held${errs.length ? `; errors: ${errs[0]}` : ''}` };
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
    g.wave = g.wavesCleared = g.level.last - 1; // straight on to wave 20, the level's last
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
  const ok = fight.test === 1 && fight.wave === 20 && fight.id === 'forgemaster' && fight.plates[0] === 6 && fight.max === 6 && oneByOne && fight.broke && fight.clangs > 0
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
await check('Ember Queen: test mode starts the Cinderlands level 3; its last wave is hers; Kindling, volley, Flare, burning ground, a flare-up each phase, level cleared (#227)', async () => {
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://localhost:${PORT}/?debug&dev=1`);
  await p.getByText('Take up arms').first().waitFor({ timeout: 5000 });
  await p.getByRole('button', { name: 'Settings', exact: true }).click();
  await p.locator('[data-act="test"]').click();
  if (!(await p.locator('#tm-start option[value="cinderlands:3"]').count())) return (await p.close(), { skip: true, detail: 'no realm-level start in this build' });
  await p.locator('#tm-class').selectOption('paladin');
  await p.locator('#tm-arena').selectOption('courtyard'); // the Ember Forge, once built, takes its place
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
  const fight = await p.evaluate(() => {
    const lb = window.__lb, g = lb.game;
    g.enemies.length = 0;
    g.spawnQueue.length = 0;
    g.wave = g.wavesCleared = g.level.last - 1; // straight on to wave 20, the level's last
    g.breather = 0.01;
    const out = { wave: 0, id: '', kindle: [0, 0, 0], volley: [0, 0, 0], flare: [0, 0, 0], ground: 0, trail: [0, 0, 0], flaresUp: [], phases: [], dead: false };
    let q = null, aimed = false;
    const seen = new WeakSet();
    for (let i = 0; i < 60000 && lb.state !== 'results' && !(q?.dead && g.level.cleared); i++) {
      g.player.invulnerable = true;
      const ph = q ? q.phase - 1 : 0;
      const shown = q && out.kindle[ph] > 0 && out.volley[ph] > 0 && (q.phase === 1 || out.flare[ph] > 0);
      if (q && !q.dead) (g.player.x = q.x - q.r - (shown ? 16 : 450)), (g.player.y = q.y);
      lb.run(1, false, false);
      q ??= g.enemies.find((e) => e.def.boss) ?? null;
      if (!q) continue;
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
  const ok = fight.test === 1 && fight.wave === 20 && fight.id === 'emberQueen' && fight.phases.length === 2
    && fight.kindle.join() === '3,4,5' && fight.volley.every((n) => n > 0) && fight.flare[0] === 0 && fight.flare[1] === 33 && fight.flare[2] === 62
    && fight.ground > 0 && fight.trail[0] === 0 && fight.trail[1] === 0 && fight.trail[2] > 0 && fight.flaresUp.every((t) => t === 'The Ember Queen flares up')
    && fight.dead && fight.cleared && errs.length === 0;
  return { ok, detail: `wave ${fight.wave}: ${fight.id || 'no boss'}; phases at ${fight.phases.join(', ')} s ("${fight.flaresUp.join('", "')}"); kindle spots ${fight.kindle.join('/')}, volleys ${fight.volley.join('/')}, flare zones ${fight.flare.join('/')} by phase; burning ground up to ${fight.ground}, trail patches ${fight.trail.join('/')}; ${fight.dead ? 'fell' : 'STANDING'}, level ${fight.cleared ? 'cleared' : 'not cleared'}${errs.length ? `; errors: ${errs[0]}` : ''}` };
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
