import { CLASS_ORDER, type ClassId } from '../config/classes';
import { GAME } from '../config/game';
import { FAMILY_IDS, isCursedRelic, RELIC_IDS, relicDef, SIGNATURE, type FamilyId, type RelicId } from '../config/relics';
import { REALMS, type RealmId } from '../config/world';
import type { Game } from '../core/types';
import { createGame, summarizeRun, type RunOptions } from '../game';
import { championBonus, fitLoadout, newChampion, ownable, rarePickOptions, type Champion } from '../logic/champions';
import { attackDamage, critChance } from '../logic/formulas';
import { familySets } from '../logic/relics';
import { botBuild, clearXp, expectedChampionLevel, grantXp, levelCap, xpForLevel, xpFromWorld } from '../logic/championLevels';
import { masteryBonus } from '../logic/economy';
import { recordClear, slotsFor } from '../logic/world';
import type { RealmRun } from '../logic/realmRun';
import type { RunSummary } from '../logic/save';
import { takeCarry } from '../systems/levels';
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

/** One first clear's rewards into the champion (the bot's picks: the first option offered), on `tier` (#250: Knight unless a Squire run says so). */
function clear(c: Champion, classId: ClassId, realm: RealmId, level: number, tier = 1): Champion {
  const def = REALMS[realm];
  const r = def.levels[level - 1].reward;
  c = { ...c, world: recordClear(c.world, realm, level, tier) }; // #238: its crowns set its level cap
  const add = (id: RelicId | undefined) => (id ? { ...c, inventory: [...c.inventory, id] } : c);
  if (r?.kind === 'rarePick') c = add(rarePickOptions(c, r.family, r.of)[0]);
  // a kept locked relic: the realm's own family, which the bot holds in its realm (rule 5); the rarest the family has left, not a legendary
  if (r?.kind === 'keepLocked') c = add(firstOf(c, classId, def.family, (id) => relicDef(id).rarity === 'rare' && !relicDef(id).classId) ?? firstOf(c, classId, def.family, (id) => relicDef(id).rarity === 'common'));
  if (r?.kind === 'classRelic') c = add(firstOf(c, classId, def.family, (id) => relicDef(id).classId === classId));
  if (level === def.levels.length) {
    if (realm === 'marches') c = { ...add(SIGNATURE.relic[classId]), signature: true };
    // the Knight crown's legendary pick; #250: a Squire crown gives none (config/world RELIC_CROWN)
    if (def.family && def.crown.tiers.slice(0, tier + 1).some((t) => t.some((x) => x.kind === 'legendaryPick'))) c = add(firstOf(c, classId, def.family, (id) => relicDef(id).rarity === 'legendary'));
  }
  return c;
}

/**
 * Plan rule 9's "expected progress": the champion as it stands at `level` of `realm` on its first try, having first-cleared every level
 * before it (and crowned every realm that opens this one) on Knight, the bot picking the first option of each reward. Decided: no Keep
 * ranks and no mastery, so the Keep's slots and levels are headroom on top of the targets, not part of them. #250: `tier` 0 is a Squire
 * player's progress: every clear and crown on Squire (a relic realm's Squire crown gives no legendary).
 */
export function expectedChampion(classId: ClassId, realm: RealmId, level: number, tier = 1): Champion {
  let c = newChampion(classId);
  for (const r of CROWNED_BEFORE[realm]) for (let l = 1; l <= REALMS[r].levels.length; l++) c = clear(c, classId, r, l, tier);
  for (let l = 1; l < level; l++) c = clear(c, classId, realm, l, tier);
  // #238: at the level enemy scaling expects there, as far as the crowns it holds let it (5 before the Marches crown)
  const at = Math.min(levelCap(c.world), expectedChampionLevel(realm, level));
  return { ...c, level: at, xp: xpForLevel(at) };
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
  fellWave?: number | null; // #232: the wave a lost first try fell on (null: it cleared, or ran out of time)
  fellBoss?: boolean; // #232: it fell with the level's end boss on the floor
  bossSeconds?: number | null; // #232: seconds the end boss stood, from its arrival to the level's end (null: never met)
  time: number; // seconds played
  loadout: RelicId[]; // what the bot slotted
  champion?: number; // #220: the champion level it played at (a realm run's: by the XP its earlier levels banked)
  power: number | null; // powerOf at the level's first wave, once its opening pick is taken
  relicsAtStart: number; // relics held then
  held: number; duos: number; sixes: number; // at the end: relics held, duos, families at a 6-set
  sixAt: number | null; // the wave the first 6-set formed (rule 9: never before wave 10 in the Last Bastion)
  moments: number; pool: number; // relic moments met, and the relics the run could find
  summary: RunSummary;
}

/** The RunOptions of a level for `c`, with the bot's loadout (in the slots the Keep and mastery in `extra` give) and its build at the champion's level. */
export function levelOptions(classId: ClassId, c: Champion, realm: RealmId, level: number, tier: number, variant = 0, extra: RunOptions = {}): RunOptions {
  const def = REALMS[realm].levels[level - 1];
  const slots = slotsFor(realm, level, championBonus(extra.meta ?? {}, extra.classXp ?? 0).slots);
  const relics = botLoadout(classId, c.inventory, slots, def.family, realm === 'lastBastion');
  // #238: the bot's build at the champion's level (expectedChampion: the level enemy scaling expects, held at its crown cap)
  const champion = botBuild(classId, c.level, variant, masteryBonus(extra.classXp ?? 0).utilityTier ? 2 : 1);
  return { ...extra, tier, level: { realm, level, relics, champion }, inventory: c.inventory, fresh: c.inventory };
}

/**
 * A level played by the bot until it is cleared, dead or out of time. `revive` (#220, a realm run): a death is still the first try's
 * fall (`cleared` false, `time` the fall's), but the bot is raised on the spot and plays the level out, so the run goes on.
 */
function playLevel(g: Game, classId: ClassId, realm: RealmId, level: number, variant: number, loadout: RelicId[], maxSeconds: number, revive = false): LevelRun {
  const first = REALMS[realm].levels[level - 1].waves[0];
  let power: number | null = null;
  let relicsAtStart = 0;
  let sixAt: number | null = null;
  let heldBefore = -1;
  let fell: number | null = null;
  let fellWave: number | null = null, fellBoss = false, bossAt: number | null = null;
  const bossUp = () => g.enemies.some((e) => e.def.boss && !e.side);
  const moments = () => Object.entries(g.vars).filter(([k]) => k.startsWith('moments.')).reduce((n, [, v]) => n + v, 0);
  const carried = moments(); // a realm run carries its counters on: a level's moments are those it met itself
  const done = () => !!g.level?.cleared || g.victory !== 'none';
  while (!g.over && !done() && g.time < maxSeconds) {
    botStep(g, variant);
    if (power === null && g.wave >= first) (power = powerOf(g)), (relicsAtStart = g.player.relics.held.length);
    if (sixAt === null && g.player.relics.held.length !== heldBefore) { // only when the relics changed: familySets every tick is not free
      heldBefore = g.player.relics.held.length;
      if (Object.values(familySets(g.player.relics.held)).some((s) => s?.level === 6)) sixAt = Math.max(first, g.wave);
    }
    if (bossAt === null && g.wave === g.level?.last && bossUp()) bossAt = g.time;
    if (g.over && fell === null) (fellWave = g.wave), (fellBoss = bossUp());
    if (g.over && revive && !done()) (fell ??= g.time), (g.over = false), (g.player.hp = g.player.stats.hp), (g.player.invulnT = 3); // as continuousPower
  }
  const r = g.player.relics;
  const sets = familySets(r.held);
  return {
    classId, realm, level, seed: g.seed, cleared: fell === null && done(), time: fell ?? g.time, loadout, champion: g.player.level,
    fellWave, fellBoss, bossSeconds: bossAt === null ? null : g.time - bossAt,
    power, relicsAtStart, held: r.held.length, duos: r.duos.length, sixes: FAMILY_IDS.filter((f) => sets[f]?.level === 6).length, sixAt,
    moments: moments() - carried,
    pool: r.pool.filter((id) => !isCursedRelic(id)).length,
    summary: summarizeRun(g),
  };
}

/**
 * A first try at `level` of `realm` on its own by the bot, with expected progress (or champion `c`): the loadout only, none of what a
 * realm run carries into a later level. A tool (the golden runs, a quick look at one level); rule 9 is measured by simulateRealm.
 * The run stops on the clear, a death or `maxSeconds`.
 */
export function simulateLevel(classId: ClassId, seed: number, realm: RealmId, level: number, tier = 1, variant = 0, c = expectedChampion(classId, realm, level, tier), maxSeconds = 45 * 60): LevelRun {
  const opts = levelOptions(classId, c, realm, level, tier, variant);
  return playLevel(createGame(classId, seed, opts), classId, realm, level, variant, opts.level!.relics ?? [], maxSeconds);
}

/** A level's seed in a realm run started on `seed`: its own, as a checkpoint's is (logic/realmRun checkpoint). */
export const realmSeed = (seed: number, level: number): number => (seed + (level - 1) * 104729) >>> 0;

/**
 * #220: a realm played by the bot as a player plays it (rule 3): one run from level 1, each later level going on from the checkpoint of
 * the one before with what the run carries (relics at their tiers, gold, the build), and the champion banking each clear's XP and
 * spending its stat points, ability tiers and talent points before the next level (botBuild at its new level), as on the level-cleared
 * screen. The champion starts as expected progress has it at the realm's level 1, with the XP its cleared levels paid. One row a level:
 * its first try. Decided: a fall counts as that level's first try lost, and the bot is raised where it fell to play the level out (a
 * replay from the checkpoint on the same seed would fall the same way), so the run reaches the later levels with a cleared level's
 * finds and XP, as a player's retry does. A level not over in `maxSeconds` ends the run there.
 */
export function simulateRealm(classId: ClassId, seed: number, realm: RealmId, tier = 1, variant = 0, maxSeconds = 45 * 60, levels = REALMS[realm].levels.length): LevelRun[] {
  let c = expectedChampion(classId, realm, 1, tier); // #250: on Squire, a Squire player's progress
  c = grantXp(c, Math.max(0, xpFromWorld(c.world) - c.xp));
  let run: RealmRun | null = { level: 1, tier, seed: realmSeed(seed, 1), carry: null };
  const rows: LevelRun[] = [];
  while (run && run.level <= levels) {
    const level: number = run.level;
    const opts = levelOptions(classId, c, realm, level, tier, variant);
    const g = createGame(classId, run.seed, { ...opts, level: { ...opts.level!, carry: run.carry } });
    rows.push(playLevel(g, classId, realm, level, variant, run.carry ? [] : opts.level!.relics ?? [], maxSeconds, true));
    if (!g.level?.cleared && g.victory === 'none') break;
    const xp = clearXp(g.player.xp, true);
    c = grantXp(clear(c, classId, realm, level, tier), xp); // its reward and crown first: the cap follows the crowns held
    run = level < REALMS[realm].levels.length ? { level: level + 1, tier, seed: realmSeed(seed, level + 1), carry: takeCarry(g) } : null;
  }
  return rows;
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
/** The middle value (the mean of the middle two for an even count); 0 for none. */
export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : 0;
}

/** One level's first tries, summed up: clear rate, minutes of a clear and of a failed try, power and relics at its first wave, moments per findable relic. */
export interface LevelCell {
  realm: RealmId; level: number; waves: [number, number]; runs: number;
  clear: number; // share of first tries cleared
  minutes: number; // a clear, on average
  median: number; // #243: a clear's median minutes, which rule 9's level times are held against
  failMinutes: number; // a failed try, on average (0 when none failed)
  power: number; // powerOf at the first wave
  relicsAtStart: number;
  champion: number; // #220: the champion level played at, on average
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
    median: median(won.map((r) => r.time)) / 60,
    failMinutes: avg(lost.map((r) => r.time)) / 60,
    power: avg(rows.filter((r) => r.power !== null).map((r) => r.power!)),
    relicsAtStart: avg(rows.map((r) => r.relicsAtStart)),
    champion: avg(rows.map((r) => r.champion ?? 0)),
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

/**
 * #250: Squire against Knight, level by level. Squire is the easier tier, so a level passes when Squire's first-try clear rate stands at
 * least `margin` over Knight's (or at 100%) and every class clears over `floor` of its Squire tries. The Archer is left out of the class check (the bot
 * underrates it, a gap across realms: BALANCE.md) but still reported. `rows`: every level's first tries, both tiers, one realm run each.
 */
export const SQUIRE_BAR = { margin: 0.1, floor: 0.5, exempt: ['archer'] as ClassId[] };

export interface SquireBarRow {
  realm: RealmId; level: number;
  squire: number; knight: number; // first-try clear rate
  classes: Partial<Record<ClassId, number>>; // each class's Squire clear rate
  easier: boolean; // squire >= knight + margin
  everyClass: boolean; // every class not exempt over the floor
}

export function squireBar(squire: Omit<LevelRun, 'summary'>[], knight: Omit<LevelRun, 'summary'>[]): SquireBarRow[] {
  const rate = (rows: { cleared: boolean }[]) => (rows.length ? rows.filter((r) => r.cleared).length / rows.length : 0);
  const out: SquireBarRow[] = [];
  const keys = [...new Map(squire.map((r) => [`${r.realm}:${r.level}`, r])).values()];
  for (const { realm, level } of keys) {
    const at = (rows: typeof squire) => rows.filter((r) => r.realm === realm && r.level === level);
    const s = at(squire), k = at(knight);
    const classes: Partial<Record<ClassId, number>> = {};
    for (const c of CLASS_ORDER) { const mine = s.filter((r) => r.classId === c); if (mine.length) classes[c] = rate(mine); }
    const sq = rate(s), kn = rate(k);
    out.push({
      realm, level, squire: sq, knight: kn, classes,
      easier: sq >= Math.min(1, kn + SQUIRE_BAR.margin) - 1e-9, // a level Knight clears 90%+ asks every Squire try
      everyClass: Object.entries(classes).every(([c, v]) => SQUIRE_BAR.exempt.includes(c as ClassId) || v! > SQUIRE_BAR.floor),
    });
  }
  return out;
}
