/**
 * Relic diagnosis (RELICS.md): what relics runs pick up and from where, what each relic contributes in Act III, how often the
 * stacking rules bite. One class per process, so the classes run in parallel; then merge:
 *
 *   npx vite-node scripts/relic-report.ts run <classId> <runs> <out.json>     fresh and maxed runs, wins stop the run
 *   npx vite-node scripts/relic-report.ts merge <out.json> ...                the tables
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { CLASS_ORDER, type ClassId } from '../src/config/classes';
import { MASTERY, META, META_IDS } from '../src/config/economy';
import { RELIC_IDS, RELIC_STACKING, RELICS, type RelicId } from '../src/config/relics';
import type { Game, RelicStat } from '../src/core/types';
import { createGame, type RunOptions } from '../src/game';
import { botStep } from '../src/sim/bot';

interface Totals { dealt: number; healed: number; taken: number; prevented: number; ticks: number; softCap: number; procShare: number }
interface RunRow {
  classId: ClassId; setup: string; won: boolean; wave: number;
  held: number; tierUps: number; from: Record<string, number>; // new relics by source, at the end of the run
  act3: { stats: Record<string, RelicStat>; totals: Totals } | null; // the difference between the end of wave 20 and the end of wave 30
  healCapWaves: number; waves: number;
}

const snap = (g: Game) => ({
  stats: JSON.parse(JSON.stringify(g.player.relics.stats)) as Record<string, RelicStat>,
  totals: { dealt: g.vars.dealt ?? 0, healed: g.vars.healed ?? 0, taken: g.vars.taken ?? 0, prevented: g.vars.prevented ?? 0, ticks: g.vars.relicTicks ?? 0, softCap: g.vars.softCapTicks ?? 0, procShare: g.vars.procShareTicks ?? 0 },
});

function play(classId: ClassId, seed: number, opts: RunOptions, variant: number, setup: string): RunRow {
  const g = createGame(classId, seed, opts);
  let at20: ReturnType<typeof snap> | null = null;
  let at30: ReturnType<typeof snap> | null = null;
  let wave = 0;
  let healCapWaves = 0;
  while (!g.over && g.time < 60 * 60 && g.victory === 'none') {
    if (g.wave !== wave) {
      if ((g.vars.relicHeal ?? 0) > RELIC_STACKING.healCap) healCapWaves++; // read before the new wave resets it
      wave = g.wave;
    }
    botStep(g, variant);
    if (!at20 && g.wavesCleared >= 20) at20 = snap(g);
    if (!at30 && g.wavesCleared >= 30) at30 = snap(g);
  }
  const from: Record<string, number> = {};
  for (const id of g.player.relics.held) from[g.player.relics.from[id] ?? 'other'] = (from[g.player.relics.from[id] ?? 'other'] ?? 0) + 1;
  let act3: RunRow['act3'] = null;
  if (at20 && at30) {
    const stats: Record<string, RelicStat> = {};
    for (const [id, s] of Object.entries(at30.stats)) {
      const b = at20.stats[id] ?? { damage: 0, healing: 0, prevented: 0 };
      stats[id] = { damage: s.damage - b.damage, healing: s.healing - b.healing, prevented: s.prevented - b.prevented };
    }
    // relics held through Act III with no credit at all still count (as zero)
    for (const id of g.player.relics.held) stats[id] ??= { damage: 0, healing: 0, prevented: 0 };
    const t = Object.fromEntries(Object.keys(at30.totals).map((k) => [k, at30!.totals[k as keyof Totals] - at20!.totals[k as keyof Totals]])) as unknown as Totals;
    act3 = { stats, totals: t };
  }
  return { classId, setup, won: g.victory !== 'none', wave: g.wave, held: g.player.relics.held.length, tierUps: g.player.relics.found.length - g.player.relics.held.length, from, act3, healCapWaves, waves: g.wavesCleared };
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === 'run') {
  const [classId, runsArg, out] = args as [ClassId, string, string];
  const maxed = Object.fromEntries(META_IDS.map((id) => [id, META[id].max]));
  const setups: [string, RunOptions][] = [['fresh', { tier: 0, arena: 'courtyard' }], ['maxed', { tier: 0, arena: 'courtyard', meta: maxed, classXp: MASTERY[MASTERY.length - 1].xp, treasure: 3 }]];
  const rows: RunRow[] = [];
  for (const [name, opts] of setups) for (let i = 0; i < Number(runsArg); i++) rows.push(play(classId, 1000 + i * 7919, opts, i % 2, name));
  writeFileSync(out, JSON.stringify(rows));
  console.log(`${classId}: ${rows.length} runs, ${rows.filter((r) => r.won).length} won, ${rows.filter((r) => r.act3).length} through Act III`);
} else if (cmd === 'merge') {
  const rows: RunRow[] = args.flatMap((f) => JSON.parse(readFileSync(f, 'utf8')));
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
  const won = rows.filter((r) => r.won);
  console.log(`\n## Runs\n\n${rows.length} runs (${CLASS_ORDER.join(', ')}; fresh and maxed), ${won.length} won, ${rows.filter((r) => r.act3).length} finished Act III.\n`);
  console.log('| | Relics held at the end | Tier-ups | Runs |\n|---|---|---|---|');
  for (const [label, set] of [['Winning runs', won], ['All runs', rows]] as const) console.log(`| ${label} | ${avg(set.map((r) => r.held)).toFixed(1)} | ${avg(set.map((r) => r.tierUps)).toFixed(1)} | ${set.length} |`);
  const sources = [...new Set(won.flatMap((r) => Object.keys(r.from)))];
  const perSource = sources.map((s) => [s, avg(won.map((r) => r.from[s] ?? 0))] as const).sort((a, b) => b[1] - a[1]);
  const sum = perSource.reduce((a, [, v]) => a + v, 0);
  console.log(`\nWhere a winning run's relics came from (new relics, not tier-ups):\n\n| Source | Relics per run | Share |\n|---|---|---|`);
  for (const [s, v] of perSource) console.log(`| ${s} | ${v.toFixed(2)} | ${pct(v / sum)} |`);

  const act3 = rows.filter((r) => r.act3);
  console.log(`\n## Contribution in Act III (waves 21-30, ${act3.length} runs)\n\nShare of all damage dealt, all healing received and all damage the relic's armor turned away, averaged over the runs that held it through Act III.\n`);
  console.log('| Relic | Rarity | Runs held | Damage | Healing | Mitigation | Best | Verdict |\n|---|---|---|---|---|---|---|---|');
  const table = RELIC_IDS.map((id: RelicId) => {
    const held = act3.filter((r) => r.act3!.stats[id]);
    const dmg = avg(held.map((r) => r.act3!.stats[id].damage / Math.max(1, r.act3!.totals.dealt)));
    const heal = avg(held.map((r) => r.act3!.stats[id].healing / Math.max(1, r.act3!.totals.healed)));
    const mit = avg(held.map((r) => r.act3!.stats[id].prevented / Math.max(1, r.act3!.totals.taken + r.act3!.totals.prevented)));
    const best = Math.max(dmg, heal, mit);
    return { id, held: held.length, dmg, heal, mit, best };
  }).sort((a, b) => b.best - a.best);
  for (const r of table) {
    const verdict = r.held === 0 ? 'not seen' : r.best < 0.03 ? '**dead weight**' : r.best > 0.35 ? '**carries**' : '';
    console.log(`| ${RELICS[r.id].name} | ${RELICS[r.id].rarity} | ${r.held} | ${pct(r.dmg)} | ${pct(r.heal)} | ${pct(r.mit)} | ${pct(r.best)} | ${verdict} |`);
  }
  const ticks = act3.reduce((a, r) => a + r.act3!.totals.ticks, 0);
  console.log(`\n## How often the stacking rules bite (Act III)\n`);
  console.log(`- (v0.7: the category soft caps and proc sharing were removed in A6; ${ticks} Act III ticks measured.)`);
  console.log(`- The per-wave relic healing cap is passed in **${pct(rows.reduce((a, r) => a + r.healCapWaves, 0) / Math.max(1, rows.reduce((a, r) => a + r.waves, 0)))}** of all waves.`);
}
