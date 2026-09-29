/**
 * v0.10 (#207): realm levels played by the bot with expected progress (plan rule 9). `npm run sim -- levels [runs=4] [tier=1] [realms]` runs
 * one process per class in parallel and merges them; by hand:
 *
 *   npx vite-node scripts/level-report.ts run <classId> <runs> <tier> <realms> <out.json>    first tries at every level of those realms
 *   npx vite-node scripts/level-report.ts merge <out.json> ...                               the tables and rule 9's targets
 *
 * `realms`: comma-separated RealmIds (default marches,ironHold: the Marches and a stand-in relic realm; add lastBastion for the finale).
 * Each run is a first try: the champion has first-cleared every level before it on Knight, no Keep ranks, no mastery (src/sim/levels.ts).
 * The continuous runs (a plain run from wave 1 on the same tier, revived when it dies) give the power the level's head start is held against.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { CLASS_ORDER, type ClassId } from '../src/config/classes';
import { TIERS } from '../src/config/economy';
import { REALMS, type RealmId } from '../src/config/world';
import { continuousPower, levelCell, minutesWithRetries, powerGap, realmMinutes, simulateLevel, type LevelCell, type LevelRun } from '../src/sim/levels';

type Row = Omit<LevelRun, 'summary'>;
interface Out { classId: ClassId; tier: number; realms: RealmId[]; levels: Row[]; continuous: Record<number, { power: number; relics: number }>[] }

const firstWaves = (realms: RealmId[]) => [...new Set(realms.flatMap((r) => REALMS[r].levels.map((l) => l.waves[0])))].sort((a, b) => a - b);

const [cmd, ...args] = process.argv.slice(2);
if (cmd === 'run') {
  const [classId, runsArg, tierArg, realmsArg, out] = args as [ClassId, string, string, string, string];
  const runs = Number(runsArg);
  const tier = Number(tierArg);
  const realms = realmsArg.split(',') as RealmId[];
  const levels: Row[] = [];
  for (const realm of realms)
    for (let level = 1; level <= REALMS[realm].levels.length; level++)
      for (let i = 0; i < runs; i++) {
        const { summary: _, ...row } = simulateLevel(classId, 1000 + i * 7919, realm, level, tier, i % 2);
        levels.push(row);
      }
  const continuous = Array.from({ length: runs }, (_, i) => continuousPower(classId, 1000 + i * 7919, firstWaves(realms), tier, i % 2));
  writeFileSync(out, JSON.stringify({ classId, tier, realms, levels, continuous } satisfies Out));
  console.log(`${classId}: ${levels.length} level runs, ${levels.filter((r) => r.cleared).length} cleared`);
} else if (cmd === 'merge') {
  const outs: Out[] = args.map((f) => JSON.parse(readFileSync(f, 'utf8')));
  const { tier, realms } = outs[0];
  const rows = outs.flatMap((o) => o.levels);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const ok = (good: boolean) => (good ? '✔' : '**✘**');
  const signed = (v: number) => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`;
  // the continuous power at a wave: over every class's runs that got there
  const cont = (w: number) => { const xs = outs.flatMap((o) => o.continuous.map((c) => c[w]).filter((x) => x)); return { power: avg(xs.map((x) => x.power)), relics: avg(xs.map((x) => x.relics)), n: xs.length }; };
  const cells: LevelCell[] = [];
  console.log(`\n## Realm levels (#207)\n\n${rows.length} first tries on ${TIERS[tier].name} (${CLASS_ORDER.filter((c) => outs.some((o) => o.classId === c)).join(', ')}), expected progress: every earlier level first-cleared, no Keep ranks, no mastery.\n`);
  console.log('| Realm | Level | Waves | Tries | Cleared | Minutes (clear / with retries) | Power: level / continuous (runs) | Gap | Relics at its first wave: level / continuous | Moments per findable relic |');
  console.log('|---|---|---|---|---|---|---|---|---|---|');
  for (const realm of realms)
    for (let level = 1; level <= REALMS[realm].levels.length; level++) {
      const mine = rows.filter((r) => r.realm === realm && r.level === level);
      if (!mine.length) continue;
      const c = levelCell(mine);
      cells.push(c);
      const k = cont(c.waves[0]);
      console.log(`| ${REALMS[realm].name} | ${level} | ${c.waves[0]}-${c.waves[1]} | ${c.runs} | ${pct(c.clear)} | ${c.minutes.toFixed(1)} / ${minutesWithRetries(c).toFixed(1)} | ${c.power.toFixed(0)} / ${k.n ? k.power.toFixed(0) : '-'} (${k.n}) | ${k.n ? signed(powerGap(c.power, k.power)) : '-'} | ${c.relicsAtStart.toFixed(1)} / ${k.n ? k.relics.toFixed(1) : '-'} | ${c.moments.toFixed(2)} |`);
    }
  const cell = (realm: RealmId, level: number) => cells.find((c) => c.realm === realm && c.level === level);
  const relicRealms = realms.filter((r) => REALMS[r].family);
  const gaps = cells.filter((c) => c.waves[0] > 1 && cont(c.waves[0]).n).map((c) => ({ c, gap: powerGap(c.power, cont(c.waves[0]).power) }));
  const worst = gaps.reduce<(typeof gaps)[number] | null>((a, b) => (!a || Math.abs(b.gap) > Math.abs(a.gap) ? b : a), null);
  const lines: [string, string, boolean | null][] = [];
  const m1 = cell('marches', 1);
  if (m1) lines.push(['First-try clear about 95% at Marches level 1', pct(m1.clear), m1.clear >= 0.9]);
  for (const r of relicRealms) {
    const [l1, l5] = [cell(r, 1), cell(r, 5)];
    if (l1) lines.push([`About 90% at realm level 1 (${REALMS[r].name})`, pct(l1.clear), l1.clear >= 0.85 && l1.clear <= 0.95]);
    if (l5) lines.push([`55-60% at realm level 5 (${REALMS[r].name})`, pct(l5.clear), l5.clear >= 0.55 && l5.clear <= 0.6]);
  }
  if (worst) lines.push(['Power at each level\'s first wave within ±15% of a continuous run', `${gaps.filter((g) => Math.abs(g.gap) <= 0.15).length}/${gaps.length} levels within; widest ${REALMS[worst.c.realm].name} ${worst.c.level} ${signed(worst.gap)}`, gaps.every((g) => Math.abs(g.gap) <= 0.15)]);
  const crowns = cells.filter((c) => c.level === REALMS[c.realm].levels.length && c.realm !== 'lastBastion');
  for (const c of crowns) lines.push([`A 6-set in most crown-level clears (${REALMS[c.realm].name} ${c.level})`, c.clear ? pct(c.sixes) : 'no clears', c.clear > 0 && c.sixes > 0.5]);
  const lb = cell('lastBastion', 1);
  if (lb) {
    lines.push(['A 6-set in most Last Bastion wins', lb.clear ? pct(lb.sixes) : 'no wins', lb.clear > 0 && lb.sixes > 0.5]);
    lines.push(['No 6-set before wave 10 in the Last Bastion', `${pct(lb.sixEarly)} of runs`, lb.sixEarly === 0]);
    lines.push(['1-2 duos per Last Bastion win', lb.clear ? lb.duos.toFixed(2) : 'no wins', lb.clear > 0 && lb.duos >= 1 && lb.duos <= 2]);
    lines.push(['3+ duos in under 15% of Last Bastion wins', lb.clear ? pct(lb.duos3) : 'no wins', lb.clear > 0 && lb.duos3 < 0.15]);
    lines.push(['The Last Bastion in 35-45 minutes', lb.clear ? lb.minutes.toFixed(1) : 'no wins', lb.minutes >= 35 && lb.minutes <= 45]);
  }
  for (const r of realms.filter((x) => x !== 'lastBastion')) {
    const mine = cells.filter((c) => c.realm === r);
    const moments = mine.reduce((n, c) => n + c.moments, 0);
    lines.push([`Relic moments per findable relic 0.4-0.6 (${REALMS[r].name}, the realm played through)`, moments.toFixed(2), moments >= 0.4 && moments <= 0.6]);
  }
  for (const [n, lo, hi, text] of [[5, 3.5, 4.5, 'about 4'], [10, 8, 10, '8-10']] as const) {
    const mine = cells.filter((c) => c.realm !== 'lastBastion' && c.waves[1] - c.waves[0] + 1 === n && c.clear > 0);
    if (!mine.length) continue;
    const m = avg(mine.map((c) => c.minutes));
    const each = mine.map((c) => `${REALMS[c.realm].name.replace(/^The /, '')} ${c.level} ${c.minutes.toFixed(1)}`).join(', ');
    lines.push([`A ${n}-wave level in ${text} minutes (a clear)`, `${m.toFixed(1)} on average (${each})`, m >= lo && m <= hi]);
  }
  for (const r of relicRealms) {
    const t = realmMinutes(cells.filter((c) => c.realm === r));
    lines.push([`A realm in about 35 minutes clean, 45 with retries (${REALMS[r].name})`, `${t.clean.toFixed(1)} / ${Number.isFinite(t.retries) ? t.retries.toFixed(1) : 'never cleared'}`, Math.abs(t.clean - 35) <= 5 && Math.abs(t.retries - 45) <= 5]);
  }
  if (realms.includes('marches')) {
    const t = realmMinutes(cells.filter((c) => c.realm === 'marches'));
    lines.push(['(the Marches played through, no target of its own)', `${t.clean.toFixed(1)} / ${Number.isFinite(t.retries) ? t.retries.toFixed(1) : 'never cleared'}`, null]);
  }
  console.log(`\n## Rule 9 targets\n\n| Target | Measured | |\n|---|---|---|`);
  for (const [t, m, good] of lines) console.log(`| ${t} | ${m} | ${good === null ? '' : ok(good)} |`);
  console.log('\nPower: sqrt(basic attack damage per second x effective HP) at the first wave (src/sim/levels.ts powerOf); relic procs and sets are not in it. Every family\'s 6-set against the class median and every relic\'s 3-35% share: `npm run sim -- relics 3 loadout`.');
}
