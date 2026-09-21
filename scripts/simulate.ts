/**
 * Headless balance simulation:  npm run sim -- [runs=6] [tier=0] [arena=courtyard]
 * A basic bot (kite, dodge telegraphs, ability on cooldown) plays each class with no Keep upgrades
 * and with everything maxed. The number that matters is the spread between classes and the
 * "maxed / fresh" ratio (target 1.5-2x, see BALANCE.md). It is a yardstick, not a good player.
 */
import type { ArenaId } from '../src/config/arenas';
import { CLASS_ORDER } from '../src/config/classes';
import { MASTERY, META, META_IDS, TIERS } from '../src/config/economy';
import type { RunOptions } from '../src/game';
import { simulateRun } from '../src/sim/bot';

const [runs = 6, tier = 0] = process.argv.slice(2, 4).map(Number);
const arena = (process.argv[4] ?? 'courtyard') as ArenaId;
const maxed = Object.fromEntries(META_IDS.map((id) => [id, META[id].max]));

const setups: [string, RunOptions][] = [
  ['fresh', { tier, arena }],
  ['maxed', { tier, arena, meta: maxed, classXp: MASTERY[MASTERY.length - 1].xp }],
];

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const pad = (s: string | number, n: number) => String(s).padStart(n);

console.log(`\n${runs} runs per cell · ${TIERS[tier].name} · ${arena} · alternating ability-upgrade branches\n`);
console.log(`${'class'.padEnd(12)}${pad('fresh', 8)}${pad('min-max', 9)}${pad('maxed', 8)}${pad('min-max', 9)}${pad('ratio', 7)}${pad('lvl', 6)}${pad('gold', 7)}${pad('min', 6)}${pad('cmdr', 6)}${pad('elites', 7)}${pad('acts*', 6)}`);
console.log('  (lvl, gold, minutes, commanders and elites slain: fresh runs · acts*: Acts cleared by maxed runs. Squads, the director, status effects and the Merchant all run as in the game.)');

const started = Date.now();
const totals: Record<string, number[]> = { fresh: [], maxed: [] };
for (const classId of CLASS_ORDER) {
  const cells = setups.map(([name, opts]) => {
    const results = Array.from({ length: runs }, (_, i) => simulateRun(classId, 1000 + i, opts, i % 2));
    const waves = results.map((r) => r.wave);
    totals[name].push(avg(waves));
    return { wave: avg(waves), min: Math.min(...waves), max: Math.max(...waves), level: avg(results.map((r) => r.level)), gold: avg(results.map((r) => r.gold)), minutes: avg(results.map((r) => r.time)) / 60, commanders: avg(results.map((r) => r.commanders ?? 0)), elites: avg(results.map((r) => r.elites)), acts: avg(results.map((r) => r.actsCleared ?? 0)) };
  });
  const [f, m] = cells;
  console.log(
    `${classId.padEnd(12)}${pad(f.wave.toFixed(1), 8)}${pad(`${f.min}-${f.max}`, 9)}${pad(m.wave.toFixed(1), 8)}${pad(`${m.min}-${m.max}`, 9)}${pad((m.wave / f.wave).toFixed(2), 7)}${pad(f.level.toFixed(0), 6)}${pad(f.gold.toFixed(0), 7)}${pad(f.minutes.toFixed(1), 6)}${pad(f.commanders.toFixed(1), 6)}${pad(f.elites.toFixed(1), 7)}${pad(m.acts.toFixed(1), 6)}`,
  );
}
const f = avg(totals.fresh);
const m = avg(totals.maxed);
console.log(`${'ALL'.padEnd(12)}${pad(f.toFixed(1), 8)}${pad('', 9)}${pad(m.toFixed(1), 8)}${pad('', 9)}${pad((m / f).toFixed(2), 7)}`);
console.log(`\nspread between classes (fresh): ${(Math.max(...totals.fresh) / Math.min(...totals.fresh)).toFixed(2)}x · ${((Date.now() - started) / 1000).toFixed(0)}s\n`);
