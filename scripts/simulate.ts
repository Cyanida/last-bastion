/**
 * Headless balance simulation:  npm run sim -- [runs=6] [tier=0] [arena=courtyard]
 * A basic bot (kite, dodge telegraphs, ability on cooldown) plays each class with no Keep upgrades
 * and with everything maxed. The number that matters is the spread between classes and the
 * "maxed / fresh" ratio (target 1.5-2x, see BALANCE.md). It is a yardstick, not a good player.
 *
 * Wall probe:  npm run sim -- probe [runs=3] [tier=0]
 * The same bot, revived on death, through wave 30: deaths and seconds per band of 5 waves and the
 * level at the end of each band, per class. A wall is a band where deaths jump and stay up.
 *
 * Economy:  npm run sim -- economy [runs=80] [tier=0]
 * One save, played run after run by the bot (classes in turn, the bot spends gold and Runes greedily on the Keep between runs, deeds
 * earned as they come). Reports gold and Runes per run and the run on which the Keep is fully raised (target 40-60, BALANCE.md).
 *
 * Relics (v0.7):  npm run sim -- relics [runs=3]
 * Maxed saves and the family-following bot, one process per class (scripts/relic-report.ts): 6-sets and duos in winning runs, families
 * at a 4-set per class, the relic power index, and every relic's contribution from wave 21 on (targets: RELICS.md, A8).
 *
 * Depth past the win (v0.6):  npm run sim -- deep [runs=3] [tier=0]: the default table, wins going on into Endless.
 * v0.7.1: SIM_CLASS=viking,archer runs only those classes (so the tables can run one process per class in parallel).
 * Pacing:  npm run sim -- pacing [runs=4] [tier=0]
 * The run logs (v0.6) of fresh and maxed runs: run length, minutes per Act, wins, the share of time with under 5 enemies alive, and the
 * longest stretches with no new wave, pick, event, objective or boss. The rule is that none lasts longer than RUN_LOG.maxGap seconds.
 */
import type { ArenaId } from '../src/config/arenas';
import { CLASS_ORDER } from '../src/config/classes';
import { BUILDING_IDS, BUILDINGS, MASTERY, META, META_IDS, TIERS } from '../src/config/economy';
import { ACTS } from '../src/config/acts';
import { RUN_LOG } from '../src/config/game';
import { actMinutes, quietStretches } from '../src/logic/runlog';
import type { RunOptions } from '../src/game';
import { lockedRelics, withAchievements } from '../src/logic/achievements';
import { accountLevel, buildingLevel, metaCost, totalKeepCost } from '../src/logic/economy';
import { expectedLevel } from '../src/logic/formulas';
import { applyRun, buyBuilding, buyMeta, defaultSave } from '../src/logic/save';
import type { RunSummary } from '../src/logic/save';
import { probeRun, simulateRun } from '../src/sim/bot';

const mode = ['probe', 'relics', 'economy', 'pacing', 'deep'].includes(process.argv[2] ?? '') ? process.argv[2] : '';
const deep = mode === 'deep'; // v0.6: the default table, but a win marches on into Endless, so depth is not capped at wave 40
const probe = mode === 'probe';
const argAt = mode ? 3 : 2;
const [runs = mode === 'economy' ? 80 : mode === 'pacing' ? 4 : mode ? 3 : 6, tier = 0] = process.argv.slice(argAt, argAt + 2).map(Number);
const arena = (process.argv[argAt + 2] ?? 'courtyard') as ArenaId;
const maxed = Object.fromEntries(META_IDS.map((id) => [id, META[id].max]));
const CLASSES = process.env.SIM_CLASS ? CLASS_ORDER.filter((c) => process.env.SIM_CLASS!.split(',').includes(c)) : CLASS_ORDER;

const setups: [string, RunOptions][] = [
  ['fresh', { tier, arena }],
  ['maxed', { tier, arena, meta: maxed, classXp: MASTERY[MASTERY.length - 1].xp, treasure: 3 }], // v0.5: with the class's sacred treasure at tier III
];

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const pad = (s: string | number, n: number) => String(s).padStart(n);


if (mode === 'economy') {
  let save = defaultSave();
  const target = totalKeepCost();
  console.log(`\neconomy · ${runs} runs on one save · ${TIERS[tier].name} · ${arena} · the whole Keep costs 🪙 ${target.gold} and ◆ ${target.runes}\n`);
  console.log(`${'run'.padStart(4)}${'class'.padStart(13)}${'wave'.padStart(6)}${'gold'.padStart(7)}${'runes'.padStart(7)}${'bank'.padStart(8)}${'◆'.padStart(5)}${'spent'.padStart(8)}${'ranks'.padStart(7)}${'lvls'.padStart(6)}${'acct'.padStart(6)}  deeds`);
  const started = Date.now();
  let spentGold = 0;
  let spentRunes = 0;
  let done = 0;
  const maxRanks = META_IDS.reduce((n, id) => n + META[id].max, 0);
  const maxLevels = BUILDING_IDS.reduce((n, id) => n + BUILDINGS[id].levels.length, 0);
  for (let i = 1; i <= runs; i++) {
    const classId = CLASS_ORDER[(i - 1) % CLASS_ORDER.length];
    const result = simulateRun(classId, 5000 + i, {
      tier, arena, meta: save.meta, classXp: save.classes[classId].xp, lockedRelics: lockedRelics(save),
      accountLevel: accountLevel(CLASS_ORDER.map((c) => save.classes[c].xp)), libraryLevel: buildingLevel(save.buildings, 'library'),
      bonusTalentPoints: save.talentPoints, // v0.4: deeds pay permanent talent points
    }, i % 2);
    const applied = applyRun(save, result, `day-${Math.floor(i / 5)}`); // five runs a day: the daily caps bite as they would
    save = withAchievements(applied.save).save;
    // spend: buildings first (they gate everything), then the cheapest rank
    let bought = true;
    while (bought) {
      bought = false;
      for (const b of BUILDING_IDS) {
        const next = buyBuilding(save, b);
        if (next !== save) (spentGold += save.gold - next.gold), (spentRunes += save.runes - next.runes), (save = next), (bought = true);
      }
      const options = META_IDS.map((id) => ({ id, cost: metaCost(id, save.meta[id] ?? 0, save.buildings) })).filter((o) => o.cost !== null).sort((a, b) => a.cost!.gold - b.cost!.gold);
      for (const o of options) {
        const next = buyMeta(save, o.id);
        if (next !== save) {
          (spentGold += save.gold - next.gold), (spentRunes += save.runes - next.runes), (save = next), (bought = true);
          break;
        }
      }
    }
    const ranks = META_IDS.reduce((n, id) => n + (save.meta[id] ?? 0), 0);
    const levels = BUILDING_IDS.reduce((n, id) => n + buildingLevel(save.buildings, id), 0);
    const acct = accountLevel(CLASS_ORDER.map((c) => save.classes[c].xp));
    if (i <= 10 || i % 5 === 0 || (ranks === maxRanks && levels === maxLevels && !done)) {
      console.log(`${pad(i, 4)}${pad(classId, 13)}${pad(result.wave, 6)}${pad(applied.gold, 7)}${pad(applied.runes, 7)}${pad(save.gold, 8)}${pad(save.runes, 5)}${pad(spentGold, 8)}${pad(`${ranks}/${maxRanks}`, 7)}${pad(`${levels}/${maxLevels}`, 6)}${pad(acct, 6)}  ${save.achievements.length}`);
    }
    if (ranks === maxRanks && levels === maxLevels && !done) {
      done = i;
      console.log(`\n  the Keep is fully raised after run ${i} (🪙 ${spentGold} and ◆ ${spentRunes} spent) · target 40-60`);
      break;
    }
  }
  if (!done) {
    const missing = BUILDING_IDS.flatMap((b) => BUILDINGS[b].levels.slice(buildingLevel(save.buildings, b)).map((l) => l.achievement).filter((a) => a && !save.achievements.includes(a)));
    console.log(`\n  the Keep is NOT fully raised after ${runs} runs (🪙 ${spentGold} and ◆ ${spentRunes} spent; ${save.gold} gold and ${save.runes} Runes in hand) · target 40-60`);
    if (missing.length) console.log(`  deeds still missing: ${[...new Set(missing)].join(', ')}`);
  }
  console.log(`  ${((Date.now() - started) / 1000).toFixed(0)}s\n`);
  process.exit(0);
}

if (mode === 'pacing') {
  console.log(`
pacing · ${runs} runs per cell · ${TIERS[tier].name} · ${arena} · from the run logs · rule: nothing new for at most ${RUN_LOG.maxGap} s
`);
  console.log(`${'class'.padEnd(12)}${'setup'.padEnd(7)}${pad('min', 6)}${pad('wave', 6)}${['I', 'II', 'III', 'IV'].map((a) => pad(`Act ${a}`, 8)).join('')}${pad('won', 5)}${pad('quiet', 7)}${pad('gap', 6)}${pad('>rule', 7)}  longest stretches (s @ wave)`);
  const started = Date.now();
  const all: { setup: string; gaps: number[]; over: number; runs: number }[] = [];
  for (const classId of CLASSES) {
    for (const [name, opts] of setups) {
      const logs = Array.from({ length: runs }, (_, i) => simulateRun(classId, 1000 + i, opts, i % 2).log!);
      const acts = [0, 1, 2, 3].map((a) => {
        const done = logs.filter((l) => l.waves.length > (a + 1) * ACTS.length || (l.won && l.waves.length === (a + 1) * ACTS.length)).map((l) => actMinutes(l, ACTS.length)[a]); // only Acts that were finished (a win ends on Act IV's last wave)
        return done.length ? `${avg(done).toFixed(1)}${done.length < logs.length ? '*' : ''}` : '-';
      });
      const stretches = logs.map((l) => quietStretches(l, 3));
      const longest = stretches.map((s) => s[0]?.length ?? 0);
      const over = stretches.filter((s) => (s[0]?.length ?? 0) > RUN_LOG.maxGap).length;
      all.push({ setup: name, gaps: longest, over, runs: logs.length });
      const worst = stretches.flat().sort((a, b) => b.length - a.length).slice(0, 3).map((s) => `${Math.round(s.length)}@${s.wave}`).join('  ');
      const quiet = sum(logs.map((l) => sum(l.waves.map((w) => w[3])))) / sum(logs.map((l) => l.time));
      console.log(`${classId.padEnd(12)}${name.padEnd(7)}${pad((avg(logs.map((l) => l.time)) / 60).toFixed(1), 6)}${pad(avg(logs.map((l) => l.wave)).toFixed(1), 6)}${acts.map((a) => pad(a, 8)).join('')}${pad(`${logs.filter((l) => l.won).length}/${logs.length}`, 5)}${pad(`${Math.round(quiet * 100)}%`, 7)}${pad(Math.round(avg(longest)), 6)}${pad(`${over}/${logs.length}`, 7)}  ${worst}`);
    }
  }
  for (const setup of ['fresh', 'maxed']) {
    const rows = all.filter((a) => a.setup === setup);
    console.log(`${'ALL'.padEnd(12)}${setup.padEnd(7)}longest stretch per run: ${avg(rows.flatMap((r) => r.gaps)).toFixed(0)} s on average · ${sum(rows.map((r) => r.over))}/${sum(rows.map((r) => r.runs))} runs break the ${RUN_LOG.maxGap} s rule`);
  }
  console.log(`
  (min: run length · Act: minutes an Act took, finished Acts only, * = not every run finished it · won: beat the Usurper (a win is banked, v0.6) · quiet: time with under ${RUN_LOG.quietBelow} enemies alive · gap: longest stretch without anything new, averaged over runs · ${((Date.now() - started) / 1000).toFixed(0)}s)
`);
  process.exit(0);
}

if (mode === 'relics') {
  // v0.7 A8: one class per process (scripts/relic-report.ts), in parallel, then the tables
  const { spawn } = await import('node:child_process');
  const { mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'lb-relics-'));
  const outs = CLASS_ORDER.map((c) => join(dir, `${c}.json`));
  const node = (argv: string[]) => new Promise<void>((done, fail) => spawn('npx', ['vite-node', 'scripts/relic-report.ts', ...argv], { stdio: 'inherit', shell: true }).on('exit', (code) => (code ? fail(new Error(`exit ${code}`)) : done())));
  const started = Date.now();
  await Promise.all(CLASS_ORDER.map((c, i) => node(['run', c, String(runs), outs[i]])));
  await node(['merge', ...outs]);
  console.log(`
(${((Date.now() - started) / 1000).toFixed(0)}s)`);
  process.exit(0);
}

if (probe) {
  const TO = 30;
  const bands = Array.from({ length: TO / 5 }, (_, i) => [i * 5 + 1, i * 5 + 5] as const);
  console.log(`\nwall probe · ${runs} runs per class · ${TIERS[tier].name} · ${arena} · fresh, revived on death, through wave ${TO}\n`);
  const head = bands.map(([a, b]) => pad(`${a}-${b}`, 8)).join('');
  console.log(`${'class'.padEnd(12)}${pad('', 9)}${head}`);
  console.log(`${'expected'.padEnd(12)}${pad('level', 9)}${bands.map(([, b]) => pad(expectedLevel(b + 1).toFixed(1), 8)).join('')}`);
  const started = Date.now();
  for (const classId of CLASSES) {
    const results = Array.from({ length: runs }, (_, i) => probeRun(classId, 1000 + i, { tier, arena }, i % 2, TO));
    const per = (f: (r: ReturnType<typeof probeRun>, a: number, b: number) => number) => bands.map(([a, b]) => avg(results.map((r) => f(r, a, b))));
    const deaths = per((r, a, b) => sum(r.deathsAtWave.slice(a - 1, b)));
    const seconds = per((r, a, b) => sum(r.secondsAtWave.slice(a - 1, b)));
    const level = per((r, _a, b) => r.levelAtWave[b - 1] ?? 0);
    const fmt = (xs: number[], d: number) => xs.map((x) => pad(x.toFixed(d), 8)).join('');
    console.log(`${classId.padEnd(12)}${pad('deaths', 9)}${fmt(deaths, 1)}`);
    console.log(`${''.padEnd(12)}${pad('minutes', 9)}${fmt(seconds.map((s) => s / 60), 1)}`);
    console.log(`${''.padEnd(12)}${pad('level', 9)}${fmt(level, 1)}`);
  }
  console.log(`\n  (deaths and minutes: totals over the 5 waves of the band, averaged over runs · level: at the end of the band · ${((Date.now() - started) / 1000).toFixed(0)}s)\n`);
  process.exit(0);
}

console.log(`\n${runs} runs per cell · ${TIERS[tier].name} · ${arena} · alternating ability-upgrade branches${deep ? ' · deep: wins go on into Endless (up to 60 minutes)' : ''}\n`);
console.log(`${'class'.padEnd(12)}${pad('fresh', 8)}${pad('min-max', 9)}${pad('maxed', 8)}${pad('min-max', 9)}${pad('ratio', 7)}${pad('lvl', 6)}${pad('gold', 7)}${pad('min', 6)}${pad('cmdr', 6)}${pad('elites', 7)}${pad('acts*', 6)}${pad('won', 7)}${pad('won10+', 8)}`);
console.log('  (lvl, gold, minutes, commanders and elites slain: fresh runs · acts*: Acts cleared by maxed runs · won: fresh / maxed runs that beat the Usurper · won10+: of the fresh runs past wave 10, how many won (v0.7.1). Squads, the director, status effects and the Merchant all run as in the game.)');

const started = Date.now();
const totals: Record<string, number[]> = { fresh: [], maxed: [] };
const paceRuns: Record<string, RunSummary[]> = {};
for (const classId of CLASSES) {
  const cells = setups.map(([name, opts]) => {
    const results = Array.from({ length: runs }, (_, i) => simulateRun(classId, 1000 + i, opts, i % 2, deep ? 60 * 60 : undefined, deep));
    if (name === 'fresh') paceRuns[classId] = results;
    const waves = results.map((r) => r.wave);
    totals[name].push(avg(waves));
    return { wave: avg(waves), min: Math.min(...waves), max: Math.max(...waves), level: avg(results.map((r) => r.level)), gold: avg(results.map((r) => r.gold)), minutes: avg(results.map((r) => r.time)) / 60, commanders: avg(results.map((r) => r.commanders ?? 0)), elites: avg(results.map((r) => r.elites)), acts: avg(results.map((r) => r.actsCleared ?? 0)), won: results.filter((r) => r.won).length, past10: results.filter((r) => r.wavesCleared >= 10).length, won10: results.filter((r) => r.won && r.wavesCleared >= 10).length, n: results.length };
  });
  const [f, m] = cells;
  console.log(
    `${classId.padEnd(12)}${pad(f.wave.toFixed(1), 8)}${pad(`${f.min}-${f.max}`, 9)}${pad(m.wave.toFixed(1), 8)}${pad(`${m.min}-${m.max}`, 9)}${pad((m.wave / f.wave).toFixed(2), 7)}${pad(f.level.toFixed(0), 6)}${pad(f.gold.toFixed(0), 7)}${pad(f.minutes.toFixed(1), 6)}${pad(f.commanders.toFixed(1), 6)}${pad(f.elites.toFixed(1), 7)}${pad(m.acts.toFixed(1), 6)}${pad(`${f.won}/${m.won}`, 7)}${pad(`${f.won10}/${f.past10}`, 8)}`,
  );
}
// pace report: the level at the end of wave w (fresh runs), against the target pace
const CHECK = [5, 10, 15, 20, 25, 30];
console.log(`
level at the end of wave (fresh runs, classes that got there) vs expected${pad('', 4)}${CHECK.map((w) => pad(`w${w}`, 7)).join('')}`);
console.log(`${'expected'.padEnd(12)}${pad('', 4)}${CHECK.map((w) => pad(expectedLevel(w + 1).toFixed(1), 7)).join('')}`);
for (const classId of CLASSES) {
  const runs = paceRuns[classId];
  const cells = CHECK.map((w) => {
    const levels = runs.map((r) => r.levelAtWave?.[w - 1]).filter((l): l is number => l !== undefined);
    return levels.length ? `${avg(levels).toFixed(1)}${levels.length < runs.length ? `*` : ''}` : '-';
  });
  console.log(`${classId.padEnd(12)}${pad('', 4)}${cells.map((c) => pad(c, 7)).join('')}`);
}
console.log('  (* = not every run reached that wave; a level within about one of "expected" means the XP curve keeps pace)');

const f = avg(totals.fresh);
const m = avg(totals.maxed);
console.log(`${'ALL'.padEnd(12)}${pad(f.toFixed(1), 8)}${pad('', 9)}${pad(m.toFixed(1), 8)}${pad('', 9)}${pad((m / f).toFixed(2), 7)}`);
console.log(`\nspread between classes (fresh): ${(Math.max(...totals.fresh) / Math.min(...totals.fresh)).toFixed(2)}x · ${((Date.now() - started) / 1000).toFixed(0)}s\n`);
