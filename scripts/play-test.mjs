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
import { spawn, spawnSync } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = Number(process.env.PLAY_PORT ?? 4180);

// a server already on the port would be tested instead of this build (and pass for it): refuse
if (await fetch(`http://localhost:${PORT}/`).then(() => true, () => false)) {
  console.error(`port ${PORT} is already in use: stop that server or set PLAY_PORT`);
  process.exit(1);
}
const preview = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: process.platform === 'win32' });
// on Windows the server runs under a shell: end the whole tree (perf-test.mjs)
const stop = () => (process.platform === 'win32' ? spawnSync('taskkill', ['/pid', String(preview.pid), '/T', '/F'], { stdio: 'ignore' }) : preview.kill());
process.on('exit', stop);
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

// #138: the champions are drawn on a grid twice as fine, and show at the same size as before on the class select
await check('class select: champions on the finer grid keep their size', () =>
  inPage(async () => {
    const P = window.__play;
    await P.click('[data-go="start"]');
    const size = (id) => {
      const c = document.querySelector(`[data-class="${id}"] .portrait canvas`);
      return c ? { box: Math.round(c.getBoundingClientRect().height), canvas: c.height } : null;
    };
    const pal = size('paladin'), vik = size('viking');
    await P.click('[data-back]');
    // the old grids were 14 and 16 rows at 6 px: 84 and 96 px on screen, whatever the finer canvas holds
    const ok = pal?.box === 84 && vik?.box === 96 && window.__lb.state === 'menu';
    return { ok, detail: `paladin ${JSON.stringify(pal)}, viking ${JSON.stringify(vik)}` };
  }),
);

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

await check('level-up: pick with the 1 key', async () => {
  const opened = await inPage(() => {
    window.__lb.game.pendingLevelUps++;
    return window.__play.toChoice();
  });
  await page.keyboard.press('Digit1');
  return inPage((opened) => ({ ok: opened && window.__lb.state === 'playing' && window.__lb.game.pendingLevelUps === 0, detail: opened ? '' : 'no screen' }), opened);
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
    const shown = { overlay: !!crash, text: crash?.innerText.includes('Something went wrong') && crash.querySelector('pre').textContent.includes('play-test crash'), state: lb.state };
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
  const mute = blocked.locator('[data-act="mute"]');
  const before = await mute.textContent();
  await mute.click();
  const after = await blocked.locator('[data-act="mute"]').textContent();
  const crash = await blocked.locator('#crash').count();
  await blocked.close();
  return { ok: before !== after && crash === 0 && errs.length === 0, detail: `title up, sound ${before} -> ${after}${errs.length ? `, errors: ${errs[0]}` : ''}` };
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
      await P.click('[data-act="import"]');
      const imported = document.body.innerText.includes('Save imported');
      const seen = [];
      await P.click('[data-act="back"]');
      btn('Back').click(); // settings -> title
      await P.wait(150);
      seen.push(!!document.getElementById('xss'));
      btn('Chronicle').click();
      await P.wait(150);
      seen.push(!!document.getElementById('xss'));
      const titles = [...document.querySelectorAll('[data-equip]')].map((b) => b.textContent.trim());
      btn('Back').click();
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
await check('Gallows: a cursed run earns its bonus, the results show it', () =>
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
      lb.save.achievements.push('firstBlood'); // it unlocks the Iron Horde curse
      await P.click('[data-go="start"]');
      await P.click('[data-curse="ironHorde"]');
      const shown = Number(document.querySelector('.select .mult').textContent.match(/×([\d.]+)/)[1]); // curses alone, without the Gallows
      await P.click('[data-class="viking"]');
      document.querySelector('[data-start]')?.click(); // #146: the card selects (unless it already was), Start begins the run
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
      const ok = g.curses.length === 1 && mult > shown + 0.1 && line.includes(`×${mult.toFixed(2)}`);
      return { ok, detail: `select ×${shown}, run ×${mult.toFixed(2)}, results "${line.replace(/\s+/g, ' ')}"` };
    });
  }),
);

// #79: the difficulty select says what opens each locked tier, and the Watchtower no longer locks one
await check('difficulty: a locked tier names what opens it, and Knight opens with no Watchtower', () =>
  inPage(async () => {
    localStorage.removeItem('lastbastion.save');
    location.reload();
  }).then(async () => {
    await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu');
    return inPage(async () => {
      const lb = window.__lb, wait = (ms = 60) => new Promise((r) => setTimeout(r, ms));
      const btn = (i) => document.querySelector(`[data-tier="${i}"]`);
      document.querySelector('[data-go="start"]').click();
      await wait();
      const fresh = [1, 2, 3].map((i) => (btn(i).disabled ? btn(i).dataset.tip : 'open'));
      lb.save.tierUnlocked = 1; // wave 15 cleared on Squire; the Watchtower stays a ruin
      lb.save.buildings.watchtower = 0;
      btn(0).click(); // redraws the select
      await wait();
      btn(1).click();
      await wait();
      const picked = btn(1).classList.contains('on') && lb.save.settings.tier === 1;
      const champ = btn(2).dataset.tip;
      const ok = fresh[0] === 'Locked — clear wave 15 on Squire' && fresh[1] === 'Locked — clear wave 30 on Knight and win a run on Squire'
        && fresh[2] === 'Locked — win a run on Champion' && picked && btn(2).disabled && champ.includes('win a run on Squire');
      return { ok, detail: `fresh ${JSON.stringify(fresh)} · Knight picked ${picked} · Champion "${champ}"` };
    });
  }),
);

// #101: each difficulty adds enemy types; the tier's tip names them, and a Knight run fields no Champion or Legend type
await check('difficulty: Knight names its new foes, and its waves bring none from the tiers above', () =>
  inPage(async () => {
    localStorage.removeItem('lastbastion.save');
    location.reload();
  }).then(async () => {
    await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu');
    return inPage(async () => {
      const lb = window.__lb, wait = (ms = 60) => new Promise((r) => setTimeout(r, ms));
      lb.save.tierUnlocked = 1; // as if wave 15 was cleared on Squire
      document.querySelector('[data-go="start"]').click();
      await wait();
      const tipOf = (i) => document.querySelector(`[data-tier="${i}"]`)?.dataset.tip ?? '';
      document.querySelector('[data-tier="1"]').click();
      await wait();
      const tips = [tipOf(0), tipOf(1)];
      document.querySelector('[data-class="viking"]').click();
      document.querySelector('[data-start]')?.click(); // #146: the card selects, Start begins the run
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
      const ok = g.tierIndex === 1 && tips[0].includes('the basic foes') && /new foes: Hound Master, Mirror Knight/.test(tips[1]) && seen.size > 3 && above.length === 0;
      return { ok, detail: `tier ${g.tierIndex}, waves to ${g.wave}, seen ${[...seen].join(', ')}${above.length ? `, above: ${above}` : ''} · "${tips[1].split('· ').pop()}"` };
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
    const first = await inPage(async () => {
      const lb = window.__lb, wait = (ms = 60) => new Promise((r) => setTimeout(r, ms));
      document.querySelector('[data-go="start"]').click();
      await wait();
      document.querySelector('[data-class="viking"]').click();
      document.querySelector('[data-start]')?.click(); // #146: the card selects, Start begins the run
      await wait(200);
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
await check('card pictures: siege pieces and bosses redrawn at their old size, the Siege Camp and the Plague Cart their own', () =>
  inPage(() => location.reload()).then(async () => {
    await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu');
    return inPage(async () => {
      const lb = window.__lb, wait = (ms = 100) => new Promise((r) => setTimeout(r, ms));
      // [id, sprite, old columns, old rows, arena scale]
      const want = [['ballista', 'ballista', 14, 10, 3], ['siegeTower', 'siegeTower', 16, 18, 4], ['blackKnight', 'blackKnight', 16, 18, 4], ['warlord', 'warlord', 16, 18, 4], ['lich', 'lich', 16, 18, 4], ['inquisitor', 'inquisitor', 16, 18, 4], ['abbot', 'abbot', 16, 18, 4], ['dragon', 'dragon', 29, 18, 4], ['warden', 'warden', 16, 18, 4], ['usurper', 'usurper', 16, 18, 5], ['royalFlame', 'royalFlame', 12, 14, 4]];
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
      const rigged = lb.sheets(); // #157: a redrawn piece shows its rigged figure instead, 1 art px to 1 world px
      const wrong = want.filter(([id, , c, r, s]) => (rigged.includes(id) ? !(pics.get(id)?.[1] >= 30 && pics.get(id)?.[1] <= 120) : pics.get(id)?.[0] !== c * s + 4 || pics.get(id)?.[1] !== r * s + 4)).map(([id]) => `${id} ${pics.get(id)?.slice(0, 2).join('×') ?? 'none'}`);
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

// #146: a class card only selects its champion; Start (or a second click on the chosen card) begins the run
await check('class select: a card selects, a click beside a swatch starts nothing, Enter selects then starts, Start begins the run', async () => {
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
  await page.keyboard.press('Enter'); // the chosen card again: the run begins
  await page.waitForFunction(() => window.__lb.state !== 'menu');
  const run = await inPage(() => ({ state: window.__lb.state, cls: window.__lb.game?.player.cls.id }));
  const ok = first.state === 'menu' && first.on.length === 1 && first.start.startsWith("Start as ")
    && missed.state === 'menu' && missed.on.join() === 'viking' && missed.start === 'Start as Viking'
    && recoloured.state === 'menu' && recoloured.on.join() === 'viking' && recoloured.palette === 1
    && keyed.state === 'menu' && keyed.on.join() === 'archer' && keyed.start === 'Start as Archer'
    && run.cls === 'archer' && run.state !== 'menu';
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
    document.querySelector('[data-go="start"]').click();
    await wait();
    document.querySelector('[data-class="archer"]').click();
    document.querySelector('[data-start]')?.click(); // #146: the card selects, Start begins the run
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
        const cards = [...document.querySelectorAll('.compendium .relic-card')];
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
                bad.push(`${c.querySelector('h2')?.textContent}: "${t.textContent.trim().slice(0, 20)}"`);
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

// ---------- #157: every redrawn foe loads its sheet, and a ranged foe (the Crossbowman) levels and looses on his shot ----------
await check('Foe sheets: every redrawn foe and commander loads; a crossbowman plays his shot (#157)', () =>
  inPage(() => location.reload()).then(async () => {
    const want = ['peasant', 'wolf', 'crossbow', 'cavalry', 'ballista', 'plagueCart', 'knight', 'cultist', 'shieldBearer', 'priest', 'engineer', 'plagueDoctor', 'houndmaster', 'mirrorKnight', 'assassin', 'shieldwall', 'boneCollector', 'bannerman', 'drummer', 'chaplain'];
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
