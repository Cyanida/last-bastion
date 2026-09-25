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
    [...document.querySelectorAll('button')].find((b) => /start test run/i.test(b.textContent)).click();
    await P.wait(300);
    const g = window.__lb.game;
    g.player.invulnerable = true; // the checks are about screens and controls, not survival
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

await check('relic offer: take a relic', () =>
  inPage(async () => {
    const P = window.__play, rel = window.__lb.game.player.relics;
    rel.offers.push({ from: 'lair', options: ['butchersHook', 'guardiansAegis', 'stormPennant'], rerolls: 0, duo: null });
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
    const monk = q.unit, x0 = monk.x, y0 = monk.y, hp0 = Math.round(monk.maxHp);
    let wary = false;
    for (let i = 0; i < 60 && q.state === 'active'; i++) {
      const e = g.enemies.find((o) => !o.dead && !o.side);
      if (!e) break;
      Object.assign(e, { x: monk.x + 40, y: monk.y }); // an enemy always at his side
      lb.run(1);
      lb.draw(); // the HUD tracker is drawn with the frame
      wary ||= document.getElementById('h-quests')?.innerText.includes('wary') ?? false;
    }
    const moved = Math.round(Math.hypot(monk.x - x0, monk.y - y0));
    return { ok: wary && moved > 10, detail: `${hp0} HP, walked ${moved} px in a second with an enemy beside him, tracker ${wary ? '"wary"' : 'NEVER WARY'}` };
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
  await inPage(() => Object.assign(window.__lb.game.player, { abilityCd: 0, utilityCd: 0 }));
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

await check('touch: joystick moves, release stops', () =>
  inPage(() => {
    const lb = window.__lb, g = lb.game, p = g.player, canvas = document.querySelector('canvas');
    const ev = (type, x, y) => canvas.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerType: 'touch', pointerId: 7, isPrimary: true, bubbles: true }));
    const x0 = p.x;
    ev('pointerdown', 200, 500);
    ev('pointermove', 260, 500);
    lb.run(20, false, 'input');
    const moved = p.x - x0, moveX = g.input.moveX;
    ev('pointerup', 260, 500);
    lb.run(3, false, 'input');
    const x1 = p.x;
    lb.run(5, false, 'input');
    return { ok: moved > 20 && moveX > 0.9 && Math.abs(p.x - x1) < 1, detail: `moved ${Math.round(moved)} px, moveX ${moveX.toFixed(2)}` };
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
    [...document.querySelectorAll('button')].find((b) => /start test run/i.test(b.textContent)).click();
    await wait(300);
    const g = lb.game, p = g.player;
    p.invulnerable = true;
    p.attackTimer = 1e9; // it must not die before the check
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
