/**
 * Headless balance simulation:  npm run sim -- [runs=6] [tier=0] [arena=courtyard]
 * A basic bot (kite, dodge telegraphs, ability on cooldown) plays each class with no Keep upgrades
 * and with everything maxed. The number that matters is the spread between classes and the
 * "maxed / fresh" ratio (target 1.5-2x, see BALANCE.md). It is a yardstick, not a good player.
 *
 * Wall probe:  npm run sim -- probe [runs=3] [tier=0]
 * The same bot, revived on death, through wave 30: deaths and seconds per band of 5 waves and the
 * level at the end of each band, per class. A wall is a band where deaths jump and stay up.
 */
import type { ArenaId } from '../src/config/arenas';
import { CLASS_ORDER } from '../src/config/classes';
import { MASTERY, META, META_IDS, TIERS } from '../src/config/economy';
import type { RunOptions } from '../src/game';
import { expectedLevel } from '../src/logic/formulas';
import type { RunSummary } from '../src/logic/save';
import { probeRun, simulateRun } from '../src/sim/bot';

const probe = process.argv[2] === 'probe';
const [runs = probe ? 3 : 6, tier = 0] = process.argv.slice(probe ? 3 : 2, probe ? 5 : 4).map(Number);
const arena = (process.argv[probe ? 5 : 4] ?? 'courtyard') as ArenaId;
const maxed = Object.fromEntries(META_IDS.map((id) => [id, META[id].max]));

const setups: [string, RunOptions][] = [
  ['fresh', { tier, arena }],
  ['maxed', { tier, arena, meta: maxed, classXp: MASTERY[MASTERY.length - 1].xp }],
];

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const pad = (s: string | number, n: number) => String(s).padStart(n);

if (probe) {
  const TO = 30;
  const bands = Array.from({ length: TO / 5 }, (_, i) => [i * 5 + 1, i * 5 + 5] as const);
  console.log(`\nwall probe · ${runs} runs per class · ${TIERS[tier].name} · ${arena} · fresh, revived on death, through wave ${TO}\n`);
  const head = bands.map(([a, b]) => pad(`${a}-${b}`, 8)).join('');
  console.log(`${'class'.padEnd(12)}${pad('', 9)}${head}`);
  console.log(`${'expected'.padEnd(12)}${pad('level', 9)}${bands.map(([, b]) => pad(expectedLevel(b + 1).toFixed(1), 8)).join('')}`);
  const started = Date.now();
  for (const classId of CLASS_ORDER) {
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

console.log(`\n${runs} runs per cell · ${TIERS[tier].name} · ${arena} · alternating ability-upgrade branches\n`);
console.log(`${'class'.padEnd(12)}${pad('fresh', 8)}${pad('min-max', 9)}${pad('maxed', 8)}${pad('min-max', 9)}${pad('ratio', 7)}${pad('lvl', 6)}${pad('gold', 7)}${pad('min', 6)}${pad('cmdr', 6)}${pad('elites', 7)}${pad('acts*', 6)}`);
console.log('  (lvl, gold, minutes, commanders and elites slain: fresh runs · acts*: Acts cleared by maxed runs. Squads, the director, status effects and the Merchant all run as in the game.)');

const started = Date.now();
const totals: Record<string, number[]> = { fresh: [], maxed: [] };
const paceRuns: Record<string, RunSummary[]> = {};
for (const classId of CLASS_ORDER) {
  const cells = setups.map(([name, opts]) => {
    const results = Array.from({ length: runs }, (_, i) => simulateRun(classId, 1000 + i, opts, i % 2));
    if (name === 'fresh') paceRuns[classId] = results;
    const waves = results.map((r) => r.wave);
    totals[name].push(avg(waves));
    return { wave: avg(waves), min: Math.min(...waves), max: Math.max(...waves), level: avg(results.map((r) => r.level)), gold: avg(results.map((r) => r.gold)), minutes: avg(results.map((r) => r.time)) / 60, commanders: avg(results.map((r) => r.commanders ?? 0)), elites: avg(results.map((r) => r.elites)), acts: avg(results.map((r) => r.actsCleared ?? 0)) };
  });
  const [f, m] = cells;
  console.log(
    `${classId.padEnd(12)}${pad(f.wave.toFixed(1), 8)}${pad(`${f.min}-${f.max}`, 9)}${pad(m.wave.toFixed(1), 8)}${pad(`${m.min}-${m.max}`, 9)}${pad((m.wave / f.wave).toFixed(2), 7)}${pad(f.level.toFixed(0), 6)}${pad(f.gold.toFixed(0), 7)}${pad(f.minutes.toFixed(1), 6)}${pad(f.commanders.toFixed(1), 6)}${pad(f.elites.toFixed(1), 7)}${pad(m.acts.toFixed(1), 6)}`,
  );
}
// pace report: the level at the end of wave w (fresh runs), against the target pace
const CHECK = [5, 10, 15, 20, 25, 30];
console.log(`
level at the end of wave (fresh runs, classes that got there) vs expected${pad('', 4)}${CHECK.map((w) => pad(`w${w}`, 7)).join('')}`);
console.log(`${'expected'.padEnd(12)}${pad('', 4)}${CHECK.map((w) => pad(expectedLevel(w + 1).toFixed(1), 7)).join('')}`);
for (const classId of CLASS_ORDER) {
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
