/**
 * Automated performance test.   npm run test:perf   (after `npm run build`)
 *
 * Serves the production build and opens it in headless Chromium (1400x800). For each scenario it scripts a wave-20
 * fight with 250 enemies under a wave modifier (Fog, Blood Moon) through the same hook the F3 overlay uses
 * (?debug enables it in a build), then lets the game's own requestAnimationFrame loop run for 300 frames and reads
 * the frame-to-frame times it recorded. Measuring the live loop matters: a synchronous "render 300 times" loop never
 * yields to the compositor, so the canvas raster work piles up and is paid in 40 ms lumps that a real frame never sees.
 *
 * The horde is topped up to 250 every half second so it does not thin out while measuring. v0.6 adds the Usurper in his last phase in the
 * Last Bastion (royal decrees and quake rings: the most telegraph zones at once), with 150 of his host around him.
 * v0.11 (#220) adds the fortress: an Iron Hold level (level 3, wave 20) in the Great Keep, 250 of the realm's own foes (Iron Knights with
 * their plates, Iron Shieldwalls, Thorn Bearers) among the others, under its forge presses (marked slabs and rams) and the Keep's braziers.
 * v0.12 (#232) adds the Ember Forge: a Cinderlands level (level 3, wave 20) in its own arena, 250 foes, the realm's own among them
 * (Torchbearers, and Cinder Hounds that burst into fire where they fall), over its lava channels, with its fire spreading over the floor.
 * v0.13 (#273) adds the Forsaken Graveyard as the Barrowvale's arena: a Barrowvale level (level 3, wave 20), 250 foes among its crypts,
 * headstones, broken chapel and grave mounds, with its grasping hands bursting from the earth.
 * v0.7.1: the run music plays through every scenario (Chromium may start audio without a gesture here), and before them a quick check
 * that it plays in every arena: each arena's theme gets notes queued on a running AudioContext. Any console error fails the test.
 * Fails when the 95th-percentile frame time exceeds PERF_BUDGET_MS (default 20 ms, the desktop target: one frame at
 * 60 Hz is 16.7 ms, so a p95 under 20 means at most a few dropped frames in 5 s). CI runners raster in software
 * and are slower than a desktop, so the workflow passes a looser budget.
 */
import { chromium } from 'playwright';
import { spawnTree, killTree, waitForServer } from './lib/process-tree.mjs';

const BUDGET = Number(process.env.PERF_BUDGET_MS ?? 20);
const PORT = Number(process.env.PERF_PORT ?? 4179);
const SCENARIOS = ['fog', 'bloodMoon', 'usurper', 'fortress', 'emberForge', 'graveyard'];
const ARENAS = ['courtyard', 'graveyard', 'keep', 'bastion'];
const FRAMES = 300;

// a server already on the port would be measured instead of this build (and pass for it): refuse
if (await fetch(`http://localhost:${PORT}/`).then(() => true, () => false)) {
  console.error(`port ${PORT} is already in use: stop that server or set PERF_PORT`);
  process.exit(1);
}
const preview = spawnTree(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: process.platform === 'win32' });
// #179: killing the shell (Windows) or npx (Linux) alone left its vite child behind; end the whole tree, on exit or a signal
const stop = () => killTree(preview);
process.on('exit', stop);
process.on('SIGINT', () => { stop(); process.exit(130); });
process.on('SIGTERM', () => { stop(); process.exit(143); });
await waitForServer(`http://localhost:${PORT}/`, PORT);

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 800 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(`http://localhost:${PORT}/?debug`);
await page.waitForFunction(() => typeof window.__lb !== 'undefined');

// v0.7.1: the run music plays in every arena (the Last Bastion is Act IV's). One run after another, so this also crosses from
// one theme into the next; each arena gets up to 10 s to take over, then 4 s (more than a bar of any theme) to queue notes.
// B5: two stingers sound in each arena (all five kinds over the four), and the voice budget holds throughout.
const STINGERS = ['tier', 'set', 'duo', 'evolution', 'phase'];
const music = [];
for (const [i, arena] of ARENAS.entries()) {
  await page.evaluate((arena) => {
    const lb = window.__lb;
    localStorage.clear();
    lb.save.settings.arena = arena === 'bastion' ? 'courtyard' : arena;
    lb.start('viking');
    if (arena === 'bastion') lb.skipTo(4, 31);
    else lb.game.wave = 1; // a wave on: the base layer
    lb.game.player.invulnerable = true;
  }, arena);
  await page.waitForFunction((arena) => window.__lb.music().arena === arena, arena, { timeout: 10000 }).catch(() => {});
  const before = await page.evaluate(() => window.__lb.music());
  const sting = (k) => page.evaluate((k) => window.__lb.stinger(k), STINGERS[k % STINGERS.length]);
  await page.waitForTimeout(500);
  await sting(2 * i);
  await page.waitForTimeout(1800);
  await sting(2 * i + 1);
  await page.waitForTimeout(1700);
  const m = await page.evaluate(() => window.__lb.music());
  music.push({ want: arena, ...m, queued: m.queued - before.queued, stingers: m.stingers - before.stingers });
}

// v0.7.5 (#97): a frame-rate dip. The run keeps playing while every frame blocks the main thread for half a second (2 fps) for 6 s;
// the scheduler's timer runs late, and the music has to keep every bar on its downbeat (no bar reached after it should have sounded).
const dipBefore = await page.evaluate(() => window.__lb.music());
await page.evaluate(() => new Promise((done) => {
  const until = performance.now() + 6000;
  const frame = () => {
    const end = performance.now() + 500;
    while (performance.now() < end);
    if (performance.now() < until) requestAnimationFrame(frame);
    else done();
  };
  requestAnimationFrame(frame);
}));
const dipAfter = await page.evaluate(() => window.__lb.music());
const dip = { ...dipAfter, queued: dipAfter.queued - dipBefore.queued, late: dipAfter.late - dipBefore.late };

const results = [];
for (const modifier of SCENARIOS) {
  await page.evaluate((modifier) => {
    const lb = window.__lb;
    localStorage.clear();
    const fortress = modifier === 'fortress';
    lb.save.cards?.push(...(lb.cardIds ?? [])); // v0.8 (#124): every flash card seen, or one would pause the fight mid-measurement
    const forge = modifier === 'emberForge';
    const yard = modifier === 'graveyard';
    if (fortress) lb.start('viking', { tier: 1, level: { realm: 'ironHold', level: 3 } }); // #220: the Great Keep as the Iron Hold plays it
    else if (forge) lb.start('viking', { tier: 1, level: { realm: 'cinderlands', level: 3 } }); // #232: the Ember Forge as the Cinderlands play it
    else if (yard) lb.start('viking', { tier: 1, level: { realm: 'barrowvale', level: 3 } }); // #273: the Forsaken Graveyard as the Barrowvale plays it
    else lb.start('viking');
    const g = lb.game;
    if (fortress || forge || yard) g.player.relics.offers.length = 0; // no opening pick: its screen would wait for a choice
    g.player.invulnerable = true;
    g.player.stats.hp = 1e6;
    g.player.hp = 1e6;
    g.player.stats.atkSpd = 2;
    g.player.stats.str = 30;
    // v0.7: a Flame 4-set (Pyre), Storm's Arc, a Frost relic and the Thermal Shock duo: relic hooks, set bonuses and a duo all run
    Object.assign(g.player.relics, { held: ['brimstoneOil', 'emberheart', 'cinderCharm', 'salamanderScale', 'stormPennant', 'thunderDrum', 'frostBrand'], duos: ['thermalShock'], dirty: true });
    for (const id of g.player.relics.held) g.player.relics.tiers[id] = 1;
    g.player.upgrades.push('dreadHowl', 'whirlwind', 'frenzy');
    g.baseMods.xp = 0; // no level-ups: a choice screen would pause the sim mid-measurement
    g.player.relics.pool = []; // no relic offers either
    const final = modifier === 'usurper';
    if (final) lb.skipTo(4, 40);
    else {
      g.wave = 19;
      g.breather = 0.01;
    }
    g.tier = { ...g.tier, eliteMult: 2 };
    lb.run(2, false, true);
    for (let i = 0; final && i < 900 && !g.enemies.some((e) => e.def.id === 'usurper'); i++) lb.run(1, false, true);
    const u = g.enemies.find((e) => e.def.id === 'usurper');
    if (final && !u) throw new Error('the Usurper never came');
    if (u) {
      u.phase = 3; // straight to the crown's wrath: decrees and quake rings
      g.vars['usurper.phase'] = 3;
      u.maxHp = u.hp = 1e9; // and he must not fall while it is measured
    }
    if (!final && !fortress && !forge && !yard) g.modifier = modifier;
    // the fortress: half the horde is the realm's own (a knight, a shieldwall and a shield bearer march as its variants there)
    // the Ember Forge: two in three are the realm's own (a peasant marches as a Torchbearer there, a wolf hunts as a Cinder Hound)
    const kinds = fortress ? ['knight', 'shieldwall', 'shieldBearer', 'peasant', 'crossbow', 'knight'] : forge ? ['peasant', 'wolf', 'crossbow', 'peasant', 'wolf', 'knight'] : ['peasant', 'wolf', 'crossbow', 'knight', 'shieldBearer', 'cultist'];
    const topUp = () => {
      while (g.enemies.length + g.spawnQueue.length < (final ? 150 : 250)) g.spawnQueue.push({ id: kinds[(g.enemies.length + g.spawnQueue.length) % 6], affixes: g.enemies.length % 9 === 0 ? ['shielded'] : [], squad: -1, commander: false });
      g.spawnTimer = 0;
      g.spawnInterval = 0.01;
    };
    topUp();
    lb.run(180, true, true); // the fight is on: particles, numbers, procs, and the sprite caches are warm
    window.__slabs = 0; // the fortress: the most slabs a forge press marked at once while it was measured
    // the fortress: a press is never more than a second off (its own clock runs 8 s, longer than the measurement), so its slabs and rams are always in the frames
    window.__flames = 0; // the Ember Forge: the most slabs the spreading fire held at once while it was measured
    // the Ember Forge: the fire catches at the lava's bank every 2 s at most (its own clock runs 10 s, longer than the measurement), so tongues of it are always creeping over the floor in the frames
    window.__hands = 0; // the graveyard: the most grasping hands marked at once while it was measured
    // the graveyard: its hands come every 7 s, longer than the measurement, so their clock is kept under 2 s and hands are always in the frames
    window.__topUp = setInterval(() => lb.state === 'playing' && (final || fortress || forge || yard || (g.modifier = modifier), fortress && g.pressT > 1 && (g.pressT = 1), forge && g.fireT > 2 && (g.fireT = 2), yard && g.hazardT > 2 && (g.hazardT = 2), (window.__hands = Math.max(window.__hands, g.zones.filter((z) => z.art === 'hands').length)), (window.__slabs = Math.max(window.__slabs, g.zones.filter((z) => z.slab).length)), (window.__flames = Math.max(window.__flames, g.flames.length)), topUp()), 500);
    lb.setPerf(true); // section timers and draw counts, like the overlay
    lb.resetPerf();
  }, modifier);
  await page.waitForFunction((n) => window.__lb.perfSummary().frames >= n, FRAMES, { timeout: 60000 });
  const r = await page.evaluate(() => {
    const lb = window.__lb;
    clearInterval(window.__topUp);
    const s = lb.perfSummary();
    const music = lb.music();
    const g = lb.game;
    const sections = Object.entries(lb.perf.sections).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(', ');
    const own = ['ironKnight', 'ironShieldwall', 'thornBearer', 'torchbearer', 'cinderHound'];
    const out = { ...s, arena: g.arena.id, realm: g.level?.realm ?? null, hazard: !!g.pressT || window.__slabs > 0, slabs: window.__slabs, flames: window.__flames, hands: window.__hands, realmFoes: g.enemies.filter((e) => own.includes(e.def.id)).length, state: lb.state, lastUpdate: lb.perf.updateMs, lastRender: lb.perf.renderMs, enemies: g.enemies.length, draws: lb.perf.counts.draws, particles: g.particles.length, texts: g.texts.length, detail: lb.quality.detail, sections, music };
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

let failed = errors.length > 0;
console.log('\nmusic · every arena · 4 s of a run each\n');
for (const m of music) {
  const ok = m.playing === 'run' && m.context === 'running' && m.arena === m.want && m.queued > 0 && m.stingers === 2 && m.peak <= m.budget;
  failed ||= !ok;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${m.want.padEnd(10)} ${m.playing ?? 'silent'} · theme ${m.arena} · context ${m.context} · layer ${m.layer} · ${m.queued} notes queued · ${m.voices} voices · ${m.stingers} stingers · peak ${m.peak} of ${m.budget} voices`);
}
{
  const ok = dip.playing === 'run' && dip.queued > 0 && dip.late === 0;
  failed ||= !ok;
  console.log(`${ok ? 'PASS' : 'FAIL'}  frame dip  6 s at 2 fps · ${dip.playing ?? 'silent'} · ${dip.queued} notes queued · ${dip.late} bars late`);
}
console.log(`\nperf test · wave 20 · 250 enemies (the Usurper: wave 40, 150; the fortress: an Iron Hold level in the Great Keep; the Ember Forge: a Cinderlands level; the graveyard: a Barrowvale level) · ${FRAMES} live frames · budget p95 <= ${BUDGET} ms\n`);
for (const r of results) {
  // #220: the fortress scene must be the fortress: the Iron Hold in the Great Keep, its own foes in the horde and a press seen marking slabs
  // #273: and the graveyard scene the Barrowvale in the Forsaken Graveyard, a full horde and its grasping hands seen bursting up
  // #232: and the Ember Forge scene the Ember Forge: the Cinderlands in their own arena, their own foes in the horde and the fire seen spreading over the floor
  const scene = r.modifier === 'fortress' ? r.arena === 'keep' && r.realm === 'ironHold' && r.realmFoes >= 50 && r.slabs >= 3 && r.state === 'playing'
    : r.modifier === 'emberForge' ? r.arena === 'emberForge' && r.realm === 'cinderlands' && r.realmFoes >= 50 && r.flames >= 3 && r.state === 'playing'
    : r.modifier === 'graveyard' ? r.arena === 'graveyard' && r.realm === 'barrowvale' && r.hands >= 3 && r.enemies >= 200 && r.state === 'playing' : true;
  const ok = r.p95 <= BUDGET && scene;
  failed ||= !ok;
  const f = (n) => n.toFixed(1).padStart(6);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${r.modifier.padEnd(10)} frame avg ${f(r.avg)}  p95 ${f(r.p95)}  max ${f(r.max)}  | update ${r.update.toFixed(2)} (last ${r.lastUpdate.toFixed(2)})  render ${r.render.toFixed(2)} (last ${r.lastRender.toFixed(2)})  | enemies ${r.enemies}  draws ${r.draws}  particles ${r.particles}  texts ${r.texts}  detail ${r.detail.toFixed(2)}`);
  console.log(`      heaviest sections (last frame): ${r.sections}  · state ${r.state}  · music ${r.music.playing ?? 'silent'} layer ${r.music.layer}, ${r.music.voices} voices`);
  if (r.modifier === 'fortress') console.log(`      ${scene ? 'the fortress' : 'NOT the fortress'}: ${r.realm ?? 'no realm'} in the ${r.arena} · ${r.realmFoes} Iron Hold foes of ${r.enemies} · forge presses marked up to ${r.slabs} slabs at once`);
  if (r.modifier === 'graveyard') console.log(`      ${scene ? 'the Forsaken Graveyard' : 'NOT the Forsaken Graveyard'}: ${r.realm ?? 'no realm'} in the ${r.arena} · ${r.enemies} foes · up to ${r.hands} grasping hands marked at once`);
  if (r.modifier === 'emberForge') console.log(`      ${scene ? 'the Ember Forge' : 'NOT the Ember Forge'}: ${r.realm ?? 'no realm'} in the ${r.arena} · ${r.realmFoes} Cinderlands foes of ${r.enemies} · the spreading fire held up to ${r.flames} slabs at once`);
}
for (const e of errors) console.log(`FAIL  console error: ${e}`);
console.log('');
process.exit(failed ? 1 : 0);
