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
    const want = ['quests', 'levelReroll', 'levelBanish', 'levelUp', 'relicReroll', 'relicTake', 'relicSkip', 'abilityUpgrade', 'utilityUpgrade', 'merchantHeal', 'merchantBuy', 'merchantLeave', 'route', 'blessing', 'peddlerBuy', 'peddlerLeave', 'talent'];
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
    [...document.querySelectorAll('button')].find((b) => /start test run/i.test(b.textContent)).click();
    await wait(300);
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
    [...document.querySelectorAll('button')].find((b) => /start test run/i.test(b.textContent)).click();
    await wait(300);
    const g = lb.game;
    g.player.invulnerable = true;
    g.evolutions = ['boneColossus']; // test mode has no evolution picker
  });
  const seen = [];
  for (let cast = 0; cast < 25; cast++) {
    await inPage(() => {
      const lb = window.__lb, g = lb.game, p = g.player;
      for (let i = 0; i < 1200 && p.abilityTime > 0; i++) lb.run(1, false, 'input');
      for (let i = 0; i < 6; i++) g.corpses.push({ x: p.x + 30 * i, y: p.y + 20, t: 0 });
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

// #101: each difficulty adds enemy types; the tier's tip names them, and a Knight run fields no Champion or Legend type
await check('difficulty: Knight names its new foes, and its waves bring none from the tiers above', () =>
  inPage(async () => {
    localStorage.removeItem('lastbastion.save');
    location.reload();
  }).then(async () => {
    await page.waitForFunction(() => typeof window.__lb !== 'undefined' && window.__lb.state === 'menu');
    return inPage(async () => {
      const lb = window.__lb, wait = (ms = 60) => new Promise((r) => setTimeout(r, ms));
      lb.save.tierUnlocked = 1; // as if wave 15 was cleared on Squire, with the Watchtower raised
      lb.save.buildings.watchtower = 1;
      document.querySelector('[data-go="start"]').click();
      await wait();
      const tipOf = (i) => document.querySelector(`[data-tier="${i}"]`)?.dataset.tip ?? '';
      document.querySelector('[data-tier="1"]').click();
      await wait();
      const tips = [tipOf(0), tipOf(1)];
      document.querySelector('[data-class="viking"]').click();
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
await check('flash card: a new foe shows one, the run waits, Enter closes it, never twice, kept in the Glossary', () =>
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
      await wait(200);
      const g = lb.game;
      g.player.invulnerable = true;
      for (let i = 0; i < 3000 && !document.querySelector('[data-card]'); i++) lb.run(1, false, true);
      const card = document.querySelector('[data-card]');
      if (!card) return null;
      const tick = g.tick;
      await wait(300); // real frames: the loop must not step the run under the card
      return { id: card.dataset.card, name: card.querySelector('h2').textContent, words: card.querySelector('p').textContent.split(' ').length, state: lb.state, held: g.tick === tick, saved: lb.save.cards.includes(card.dataset.card) };
    });
    if (!first) return { ok: false, detail: 'no card in 3000 ticks' };
    await page.keyboard.press('Enter');
    const after = await inPage(async (id) => {
      const lb = window.__lb, wait = (ms = 60) => new Promise((r) => setTimeout(r, ms));
      await wait(100);
      const closed = !document.querySelector('[data-card]') && lb.state === 'playing';
      const shown = [id];
      for (let i = 0; i < 1500 && lb.state !== 'results'; i++) {
        lb.run(1, false, true);
        const c = document.querySelector('[data-card]');
        if (c) (shown.push(c.dataset.card), c.querySelector('[data-leave]').click());
      }
      return { closed, shown };
    }, first.id);
    await page.keyboard.press('Escape');
    const glossary = await inPage(async () => {
      await new Promise((r) => setTimeout(r, 100));
      document.querySelector('[data-glossary]')?.click();
      await new Promise((r) => setTimeout(r, 100));
      return document.querySelector('.cards-met')?.innerText ?? '';
    });
    const once = new Set(after.shown).size === after.shown.length;
    const ok = first.state === 'choice' && first.held && first.saved && first.words <= 14 && after.closed && once && glossary.includes(first.name);
    return { ok, detail: `"${first.name}" (${first.words} words), held ${first.held}, saved ${first.saved}, Enter closed ${after.closed}; cards ${after.shown.join(', ')}${once ? '' : ' (REPEATED)'}; Glossary ${glossary ? 'lists it' : 'MISSING'}` };
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
        [...document.querySelectorAll('button')].find((b) => /start test run/i.test(b.textContent)).click();
        await wait(300);
        lb.game.player.invulnerable = true;
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
