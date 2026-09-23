/**
 * v0.7 relic balance (RELICS.md, A8): what the drafting bot's relic builds do. `npm run sim -- relics [runs]` runs one process per class in
 * parallel and merges them; by hand:
 *
 *   npx vite-node scripts/relic-report.ts run <classId> <runs> <out.json>     maxed saves, the family-following bot, a win stops the run
 *   npx vite-node scripts/relic-report.ts merge <out.json> ...                the tables
 *
 * Targets (the v0.7 brief): every relic 3-35% of what it does in the builds that hold it; a 6-set in about a third of winning runs; 1-2 duos
 * a winning run and 3+ in under 15%; every class at a 4-set in two or more families; relic power index 1.8-2.2 (see POWER below).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { CLASS_ORDER, type ClassId } from '../src/config/classes';
import { MASTERY, META, META_IDS } from '../src/config/economy';
import { DUO_IDS, FAMILIES, FAMILY_IDS, isDuo, isFamily, keyName, RELIC_IDS, relicDef, type FamilyId, type RelicKey } from '../src/config/relics';
import type { Game, RelicStat } from '../src/core/types';
import { createGame, type RunOptions } from '../src/game';
import { duoFamilies, familySets } from '../src/logic/relics';
import { botStep } from '../src/sim/bot';

interface Snap { stats: Record<string, RelicStat>; dealt: number; healed: number; taken: number; prevented: number }
interface RunRow {
  classId: ClassId; won: boolean; wave: number; held: number; duos: number; awakened: number; moments: Record<string, number>;
  levels: Partial<Record<FamilyId, number>>; // set level per family at the end
  sixes: [FamilyId, number][]; // 6-sets at the end, with their straight pieces (under 6: completed with a duo)
  power: number | null; // relics' share of the damage dealt in waves 11-20
  power3: number | null; // ...and in waves 21-30, with the build complete
  late: { shares: Record<string, number>; waves: number } | null; // each relic held at wave 20: its share (best of damage, healing, mitigation) from wave 21 on
}

const snap = (g: Game): Snap => ({ stats: JSON.parse(JSON.stringify(g.player.relics.stats)), dealt: g.vars.dealt ?? 0, healed: g.vars.healed ?? 0, taken: g.vars.taken ?? 0, prevented: g.vars.prevented ?? 0 });
const diff = (a: Snap, b: Snap, id: string) => {
  const s = b.stats[id] ?? { damage: 0, healing: 0, prevented: 0 };
  const t = a.stats[id] ?? { damage: 0, healing: 0, prevented: 0 };
  return { damage: s.damage - t.damage, healing: s.healing - t.healing, prevented: s.prevented - t.prevented };
};

/**
 * POWER: the relic power index is how much harder the character hits at the same wave than without its relics: 1 / (1 - the relics' share
 * of the damage dealt), so relics adding +100% to what the character deals read as 2.0 (plain bonuses are credited their share; procs,
 * duos, set bonuses and relic skeletons their own damage). It climbs through a run (a build grows), so the target is read over Acts II-III
 * (waves 11-30), with Act II and Act III shown on their own.
 */
export const powerIndex = (share: number): number => 1 / Math.max(0.01, 1 - share);

function play(classId: ClassId, seed: number, opts: RunOptions, variant: number): RunRow {
  const g = createGame(classId, seed, opts);
  let at10: Snap | null = null;
  let at20: Snap | null = null;
  let at30: Snap | null = null;
  let heldAt20: string[] = [];
  while (!g.over && g.time < 60 * 60 && g.victory === 'none') {
    botStep(g, variant);
    if (!at10 && g.wavesCleared >= 10) at10 = snap(g);
    if (!at30 && g.wavesCleared >= 30) at30 = snap(g);
    if (!at20 && g.wavesCleared >= 20) (at20 = snap(g)), (heldAt20 = [...g.player.relics.held, ...g.player.relics.duos, ...FAMILY_IDS.filter((f) => (g.player.relics.sets[f]?.level ?? 0) > 0)]);
  }
  const end = snap(g);
  const r = g.player.relics;
  const relicDamage = (a: Snap, b: Snap) => Object.keys(b.stats).reduce((n, id) => n + diff(a, b, id).damage, 0);
  const power = at10 && at20 ? relicDamage(at10, at20) / Math.max(1, at20.dealt - at10.dealt) : null;
  const power3 = at20 && at30 ? relicDamage(at20, at30) / Math.max(1, at30.dealt - at20.dealt) : null;
  let late: RunRow['late'] = null;
  if (at20 && g.wavesCleared >= 25) {
    const dealt = Math.max(1, end.dealt - at20.dealt);
    const healed = Math.max(1, end.healed - at20.healed);
    const hits = Math.max(1, end.taken - at20.taken + end.prevented - at20.prevented);
    late = { shares: Object.fromEntries(heldAt20.map((id) => { const d = diff(at20!, end, id); return [id, Math.max(d.damage / dealt, d.healing / healed, d.prevented / hits)]; })), waves: g.wavesCleared - 20 };
  }
  const sets = familySets(r.held, duoFamilies(r.duos));
  return {
    classId, won: g.victory !== 'none', wave: g.wave, held: r.held.length, duos: r.duos.length,
    moments: Object.fromEntries(Object.entries(g.vars).filter(([k]) => k.startsWith('moments.')).map(([k, v]) => [k.slice(8), v])),
    awakened: r.held.filter((id) => (r.tiers[id] ?? 0) >= 3).length,
    levels: Object.fromEntries(FAMILY_IDS.filter((f) => sets[f]).map((f) => [f, sets[f]!.level])),
    sixes: FAMILY_IDS.filter((f) => sets[f]?.level === 6).map((f) => [f, sets[f]!.straight]),
    power, power3, late,
  };
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === 'run') {
  const [classId, runsArg, out] = args as [ClassId, string, string];
  const maxed = Object.fromEntries(META_IDS.map((id) => [id, META[id].max]));
  const opts: RunOptions = { tier: 0, arena: 'courtyard', meta: maxed, classXp: MASTERY[MASTERY.length - 1].xp, treasure: 3 };
  const rows = Array.from({ length: Number(runsArg) }, (_, i) => play(classId, 1000 + i * 7919, opts, i % 2));
  writeFileSync(out, JSON.stringify(rows));
  console.log(`${classId}: ${rows.length} runs, ${rows.filter((r) => r.won).length} won`);
} else if (cmd === 'merge') {
  const rows: RunRow[] = args.flatMap((f) => JSON.parse(readFileSync(f, 'utf8')));
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
  const won = rows.filter((r) => r.won);
  const ok = (good: boolean) => (good ? '✔' : '**✘**');
  const six = won.filter((r) => Object.values(r.levels).includes(6)).length / Math.max(1, won.length);
  const duos = avg(won.map((r) => r.duos));
  const duos3 = won.filter((r) => r.duos >= 3).length / Math.max(1, won.length);
  const pooled = (xs: RunRow[], k: 'power' | 'power3') => powerIndex(avg(xs.filter((r) => r[k] != null).map((r) => r[k]!))); // the mean share, then the index: a near-dead run cannot blow it up
  const power = pooled(rows, 'power');
  const power3 = pooled(rows, 'power3');
  const power23 = powerIndex(avg(rows.flatMap((r) => [r.power, r.power3]).filter((v): v is number => v != null)));
  console.log(`\n## Relic balance (A8)\n\n${rows.length} runs (maxed saves, the family-following bot), ${won.length} won.\n`);
  console.log('| Target | Measured | |\n|---|---|---|');
  console.log(`| A 6-set in about a third of winning runs | ${pct(six)} | ${ok(six >= 0.2 && six <= 0.45)} |`);
  console.log(`| 1-2 duos a winning run | ${duos.toFixed(2)} | ${ok(duos >= 1 && duos <= 2)} |`);
  console.log(`| 3+ duos in under 15% of winning runs | ${pct(duos3)} | ${ok(duos3 < 0.15)} |`);
  console.log(`| Relic power index 1.8-2.2 (Acts II-III, waves 11-30) | ${power23.toFixed(2)} (Act II ${power.toFixed(2)}, Act III ${power3.toFixed(2)}) | ${ok(power23 >= 1.8 && power23 <= 2.2)} |`);
  const sixes = won.flatMap((r) => r.sixes ?? []);
  console.log(`
6-sets in winning runs: ${sixes.length} (${sixes.filter(([, n]) => n >= 6).length} straight, ${sixes.filter(([, n]) => n < 6).length} completed with a duo); by family: ${FAMILY_IDS.map((f) => `${FAMILIES[f].name} ${sixes.filter(([x]) => x === f).length}`).join(', ')}.`);
  const sources = [...new Set(won.flatMap((r) => Object.keys(r.moments)))];
  console.log(`
Relic moments a winning run met: ${avg(won.map((r) => Object.values(r.moments).reduce((a, b) => a + b, 0))).toFixed(1)} (${sources.map((s) => `${s} ${avg(won.map((r) => r.moments[s] ?? 0)).toFixed(1)}`).join(', ')}).`);
  console.log(`\n| Class | Runs | Won | Families at a 4-set (all runs) | Power index (Act II / III) | Relics held | Duos | Awakened |\n|---|---|---|---|---|---|---|---|`);
  for (const c of CLASS_ORDER) {
    const mine = rows.filter((r) => r.classId === c);
    if (!mine.length) continue;
    const fours = FAMILY_IDS.filter((f) => mine.some((r) => (r.levels[f] ?? 0) >= 4));
    console.log(`| ${c} | ${mine.length} | ${mine.filter((r) => r.won).length} | ${fours.map((f) => FAMILIES[f].name).join(', ') || '-'} ${ok(fours.length >= 2)} | ${pooled(mine, 'power').toFixed(2)} / ${pooled(mine, 'power3').toFixed(2)} | ${avg(mine.map((r) => r.held)).toFixed(1)} | ${avg(mine.map((r) => r.duos)).toFixed(1)} | ${avg(mine.map((r) => r.awakened)).toFixed(1)} |`);
  }
  const late = rows.filter((r) => r.late);
  console.log(`\n## Contribution from wave 21 on (${late.length} runs)\n\nEach relic and duo held at wave 20: its share of the damage dealt, the healing received or the damage turned away (the largest), averaged over the runs that held it. Target 3-35%.\n`);
  console.log('| Relic | Family | Runs | Share | |\n|---|---|---|---|---|');
  const keys: RelicKey[] = [...RELIC_IDS, ...DUO_IDS, ...FAMILY_IDS];
  const table = keys.map((id) => {
    const held = late.filter((r) => id in r.late!.shares);
    return { id, n: held.length, share: avg(held.map((r) => r.late!.shares[id])) };
  }).filter((t) => t.n > 0).sort((a, b) => b.share - a.share);
  for (const t of table) console.log(`| ${keyName(t.id)} | ${isDuo(t.id) ? 'duo' : isFamily(t.id) ? 'set bonuses' : FAMILIES[relicDef(t.id).family].name} | ${t.n} | ${pct(t.share)} | ${isFamily(t.id) ? '' : t.share < 0.03 ? '**under 3%**' : t.share > 0.35 ? '**over 35%**' : ''} |`);
  const unseen = keys.filter((id) => !isFamily(id) && !table.some((t) => t.id === id));
  if (unseen.length) console.log(`\nNot held at wave 20 in any run: ${unseen.map(keyName).join(', ')}.`);
}
