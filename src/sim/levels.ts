import type { ClassId } from '../config/classes';
import { GAME } from '../config/game';
import { FAMILY_IDS, isCursedRelic, RELIC_IDS, relicDef, SIGNATURE, type FamilyId, type RelicId } from '../config/relics';
import { REALMS, type RealmId } from '../config/world';
import type { Game } from '../core/types';
import { createGame, summarizeRun, type RunOptions } from '../game';
import { championBonus, fitLoadout, newChampion, ownable, rarePickOptions, type Champion } from '../logic/champions';
import { attackDamage, critChance } from '../logic/formulas';
import { familySets } from '../logic/relics';
import { branchPlan } from '../logic/talents';
import { slotsFor } from '../logic/world';
import type { RunSummary } from '../logic/save';
import { botStep } from './bot';

/**
 * v0.10 (#207): the bot on the Road to the Crown. It fills a level's starting slots from a champion's inventory, and plays realm levels
 * with the inventory a champion would have by then ("expected progress", plan rule 9). scripts/simulate.ts `levels` and
 * scripts/relic-report.ts `loadout` read this; tests/v10-level-golden.test.ts pins two Marches levels.
 */

const RARITY_SCORE = { common: 1, rare: 2, legendary: 3 } as const;

/** The bot's own taste in families, as its relic draft has it: the families of its class relics. */
const tasteOf = (classId: ClassId): FamilyId[] => FAMILY_IDS.filter((f) => RELIC_IDS.some((id) => relicDef(id).classId === classId && relicDef(id).family === f));

/**
 * The bot fills `slots` slots from `inventory` under the slot rules (logic/champions fitLoadout): its signature relic first, then one main
 * family built toward a set (the level's featured family counts double, the bot's taste once, then what it owns most of), the rarest first,
 * then anything that still fits. Ties keep inventory order, so the same inventory always gives the same loadout.
 */
export function botLoadout(classId: ClassId, inventory: RelicId[], slots: number, family?: FamilyId, finale = false): RelicId[] {
  const own = inventory.filter((id) => ownable(classId, id));
  const taste = tasteOf(classId);
  const weight = (f: FamilyId) => own.filter((id) => relicDef(id).family === f).length + (f === family ? 2 : 0) + (taste.includes(f) ? 1 : 0);
  const owned = FAMILY_IDS.filter((f) => own.some((id) => relicDef(id).family === f));
  const main = owned.reduce<FamilyId | undefined>((a, b) => (a === undefined || weight(b) > weight(a) ? b : a), undefined);
  const score = (id: RelicId) => {
    const d = relicDef(id);
    return (d.signature ? 100 : 0) + (d.family && d.family === main ? 10 : 0) + (d.family === family ? 5 : 0) + RARITY_SCORE[d.rarity];
  };
  const order = own.map((id, i) => ({ id, i, s: score(id) })).sort((a, b) => b.s - a.s || a.i - b.i).map((o) => o.id);
  return fitLoadout(classId, order, slots, finale);
}

/** The realms crowned before a realm opens, in this sim's order. Decided: for the Last Bastion, the first three ring-2 realms and the Frozen Pass (5 crowns, one from ring 3). */
const CROWNED_BEFORE: Record<RealmId, RealmId[]> = {
  marches: [],
  ironHold: ['marches'], barrowvale: ['marches'], cinderlands: ['marches'],
  frozenPass: ['marches', 'ironHold'], stormspire: ['marches', 'ironHold'],
  hallowedReach: ['marches', 'ironHold', 'barrowvale', 'cinderlands'], crimsonFields: ['marches', 'ironHold', 'barrowvale', 'cinderlands'],
  lastBastion: ['marches', 'ironHold', 'barrowvale', 'cinderlands', 'frozenPass'],
};

/** The first relic of `family` the champion could own and doesn't yet, matching `pick`. */
const firstOf = (c: Champion, classId: ClassId, family: FamilyId | undefined, pick: (id: RelicId) => boolean): RelicId | undefined =>
  family && RELIC_IDS.find((id) => relicDef(id).family === family && ownable(classId, id) && !c.inventory.includes(id) && pick(id));

/** One first clear's rewards into the champion (the bot's picks: the first option offered), crowns on Knight. */
function clear(c: Champion, classId: ClassId, realm: RealmId, level: number): Champion {
  const def = REALMS[realm];
  const r = def.levels[level - 1].reward;
  const add = (id: RelicId | undefined) => (id ? { ...c, inventory: [...c.inventory, id] } : c);
  if (r?.kind === 'rarePick') c = add(rarePickOptions(c, r.family, r.of)[0]);
  // a kept locked relic: the realm's own family, which the bot holds in its realm (rule 5); the rarest the family has left, not a legendary
  if (r?.kind === 'keepLocked') c = add(firstOf(c, classId, def.family, (id) => relicDef(id).rarity === 'rare' && !relicDef(id).classId) ?? firstOf(c, classId, def.family, (id) => relicDef(id).rarity === 'common'));
  if (r?.kind === 'classRelic') c = add(firstOf(c, classId, def.family, (id) => relicDef(id).classId === classId));
  if (level === def.levels.length) {
    if (realm === 'marches') c = { ...add(SIGNATURE.relic[classId]), signature: true };
    if (def.family) c = add(firstOf(c, classId, def.family, (id) => relicDef(id).rarity === 'legendary')); // the Knight crown's legendary pick
  }
  return c;
}

/**
 * Plan rule 9's "expected progress": the champion as it stands at `level` of `realm` on its first try, having first-cleared every level
 * before it (and crowned every realm that opens this one) on Knight, the bot picking the first option of each reward. Decided: no Keep
 * ranks and no mastery, so the Keep's slots and levels are headroom on top of the targets, not part of them.
 */
export function expectedChampion(classId: ClassId, realm: RealmId, level: number): Champion {
  let c = newChampion(classId);
  for (const r of CROWNED_BEFORE[realm]) for (let l = 1; l <= REALMS[r].levels.length; l++) c = clear(c, classId, r, l);
  for (let l = 1; l < level; l++) c = clear(c, classId, realm, l);
  return c;
}

/**
 * A static power index: sqrt(damage per second of the basic attack x effective HP), from stats, mods, crits and armor. Relic procs, sets
 * and abilities are not in it (the level table shows relics held beside it). Rule 9 compares it at a level's first wave with a continuous
 * run at that wave.
 */
export function powerOf(g: Game): number {
  const p = g.player;
  const hit = attackDamage(p.cls.attack.damage, p.stats[p.cls.attack.scaling], p.mods.damage);
  const crit = 1 + critChance(p.stats.dex) * (GAME.critMult - 1 + p.mods.critDamage);
  const rate = Math.min(GAME.maxAttackRate, p.stats.atkSpd * p.mods.atkSpd);
  const ehp = p.stats.hp / (1 - Math.min(0.9, Math.max(0, p.mods.armor)));
  return Math.sqrt(hit * crit * rate * ehp);
}

export interface LevelRun {
  classId: ClassId; realm: RealmId; level: number; seed: number;
  cleared: boolean; // its last wave cleared
  time: number; // seconds played
  loadout: RelicId[]; // what the bot slotted
  power: number | null; // powerOf at the level's first wave, once its opening pick is taken
  relicsAtStart: number; // relics held then
  held: number; duos: number; sixes: number; // at the end: relics held, duos, families at a 6-set
  sixAt: number | null; // the wave the first 6-set formed (rule 9: never before wave 10 in the Last Bastion)
  moments: number; pool: number; // relic moments met, and the relics the run could find
  summary: RunSummary;
}

/** The RunOptions of a level for `c`, with the bot's loadout (in the slots the Keep and mastery in `extra` give) and talent plan. */
export function levelOptions(classId: ClassId, c: Champion, realm: RealmId, level: number, tier: number, variant = 0, extra: RunOptions = {}): RunOptions {
  const def = REALMS[realm].levels[level - 1];
  const slots = slotsFor(realm, level, championBonus(extra.meta ?? {}, extra.classXp ?? 0).slots);
  const relics = botLoadout(classId, c.inventory, slots, def.family, realm === 'lastBastion');
  return { ...extra, tier, level: { realm, level, relics, talentPlan: branchPlan(classId, variant) }, inventory: c.inventory, fresh: c.inventory };
}

/** A first try at `level` of `realm` by the bot, with expected progress (or champion `c`). The run stops on the clear, a death or `maxSeconds`. */
export function simulateLevel(classId: ClassId, seed: number, realm: RealmId, level: number, tier = 1, variant = 0, c = expectedChampion(classId, realm, level), maxSeconds = 45 * 60): LevelRun {
  const opts = levelOptions(classId, c, realm, level, tier, variant);
  const g = createGame(classId, seed, opts);
  const first = REALMS[realm].levels[level - 1].waves[0];
  let power: number | null = null;
  let relicsAtStart = 0;
  let sixAt: number | null = null;
  let heldBefore = -1;
  while (!g.over && !g.level?.cleared && g.victory === 'none' && g.time < maxSeconds) {
    botStep(g, variant);
    if (power === null && g.wave >= first) (power = powerOf(g)), (relicsAtStart = g.player.relics.held.length);
    if (sixAt === null && g.player.relics.held.length !== heldBefore) { // only when the relics changed: familySets every tick is not free
      heldBefore = g.player.relics.held.length;
      if (Object.values(familySets(g.player.relics.held)).some((s) => s?.level === 6)) sixAt = Math.max(first, g.wave);
    }
  }
  const r = g.player.relics;
  const sets = familySets(r.held);
  return {
    classId, realm, level, seed, cleared: !!g.level?.cleared || g.victory !== 'none', time: g.time, loadout: opts.level!.relics ?? [],
    power, relicsAtStart, held: r.held.length, duos: r.duos.length, sixes: FAMILY_IDS.filter((f) => sets[f]?.level === 6).length, sixAt,
    moments: Object.entries(g.vars).filter(([k]) => k.startsWith('moments.')).reduce((n, [, v]) => n + v, 0),
    pool: r.pool.filter((id) => !isCursedRelic(id)).length,
    summary: summarizeRun(g),
  };
}

/**
 * The continuous run rule 9 compares with: a plain run from wave 1 on the same tier, powerOf and relics held at the start of each of
 * `waves`. Decided: revived on the spot when it dies (as the wall probe is, sim/bot probeRun), so the bot's pace reaches every level's
 * first wave; a fresh bot on Knight rarely gets past wave 10 on its own.
 */
export function continuousPower(classId: ClassId, seed: number, waves: number[], tier = 1, variant = 0, maxSeconds = 45 * 60): Record<number, { power: number; relics: number }> {
  const g = createGame(classId, seed, { tier });
  const out: Record<number, { power: number; relics: number }> = {};
  const last = Math.max(...waves);
  while (g.victory === 'none' && g.time < maxSeconds && g.wave <= last) {
    botStep(g, variant);
    if (g.over) (g.over = false), (g.player.hp = g.player.stats.hp), (g.player.invulnT = 3);
    if (waves.includes(g.wave) && !out[g.wave]) out[g.wave] = { power: powerOf(g), relics: g.player.relics.held.length };
  }
  return out;
}

// ---------- the levels table (scripts/level-report.ts) ----------

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** One level's first tries, summed up: clear rate, minutes of a clear and of a failed try, power and relics at its first wave, moments per findable relic. */
export interface LevelCell {
  realm: RealmId; level: number; waves: [number, number]; runs: number;
  clear: number; // share of first tries cleared
  minutes: number; // a clear, on average
  failMinutes: number; // a failed try, on average (0 when none failed)
  power: number; // powerOf at the first wave
  relicsAtStart: number;
  moments: number; // relic moments met per findable relic, on average
  sixes: number; // share of clears ending with a 6-set
  duos: number; // duos per clear
  duos3: number; // share of clears with 3 or more duos
  sixEarly: number; // share of runs whose first 6-set formed before wave 10
}

export function levelCell(rows: Omit<LevelRun, 'summary'>[]): LevelCell {
  const { realm, level } = rows[0];
  const won = rows.filter((r) => r.cleared);
  const lost = rows.filter((r) => !r.cleared);
  return {
    realm, level, waves: REALMS[realm].levels[level - 1].waves, runs: rows.length,
    clear: won.length / rows.length,
    minutes: avg(won.map((r) => r.time)) / 60,
    failMinutes: avg(lost.map((r) => r.time)) / 60,
    power: avg(rows.filter((r) => r.power !== null).map((r) => r.power!)),
    relicsAtStart: avg(rows.map((r) => r.relicsAtStart)),
    moments: avg(rows.map((r) => r.moments / Math.max(1, r.pool))),
    sixes: won.length ? won.filter((r) => r.sixes > 0).length / won.length : 0,
    duos: avg(won.map((r) => r.duos)),
    duos3: won.length ? won.filter((r) => r.duos >= 3).length / won.length : 0,
    sixEarly: rows.filter((r) => r.sixAt !== null && r.sixAt < 10).length / rows.length,
  };
}

/**
 * Minutes to clear a level with retries: the clear, plus the failed tries before it (a first try clears with chance `clear`, so on average
 * (1 - clear) / clear failed tries come first). A level the bot never clears has no finite time (Infinity).
 */
export const minutesWithRetries = (c: Pick<LevelCell, 'clear' | 'minutes' | 'failMinutes'>): number =>
  c.clear > 0 ? c.minutes + ((1 - c.clear) / c.clear) * c.failMinutes : Infinity;

/** A realm played through: clean (every level cleared first try) and with retries. */
export const realmMinutes = (cells: Pick<LevelCell, 'clear' | 'minutes' | 'failMinutes'>[]): { clean: number; retries: number } => ({
  clean: cells.reduce((n, c) => n + c.minutes, 0),
  retries: cells.reduce((n, c) => n + minutesWithRetries(c), 0),
});

/** Power at a level's first wave against the continuous run's at that wave: +0.10 is 10% stronger. */
export const powerGap = (level: number, continuous: number): number => (continuous > 0 ? level / continuous - 1 : 0);
