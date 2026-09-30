// v0.11 (#238): champion levels (docs/road-to-the-crown.md rule 2, 29-09). A champion levels up between levels, not during them: a
// cleared level banks the XP it collected as champion XP, each champion level gives stat points and a talent point, and the champion
// spends them itself (the level-cleared screen and the champion screen's Build and Talents tabs, #241, call this file). Pure: every
// spend returns a new champion, or the same object when it can't be done. systems/levels.ts puts a build into a run.
import { ABILITY_TRACKS, ABILITY_UPGRADES, type AbilityUpgradeId } from '../config/abilityUpgrades';
import { CHAMPION, CHAMPION_STAT_KEYS, CHAMPION_STAT_NAMES, CHAMPION_STATS, type ChampionStat, type StatPoints } from '../config/champion';
import type { ClassId } from '../config/classes';
import { CLASSES } from '../config/classes';
import { TALENT_BY_ID, TALENTS } from '../config/talents';
import type { TreasureId } from '../config/treasures';
import { UPGRADES } from '../config/upgrades';
import { UTILITY, UTILITY_TRACKS, UTILITY_UPGRADES, type UtilityUpgradeId } from '../config/utility';
import { REALM_IDS, REALMS, type RealmId } from '../config/world';
import type { StatKey, Stats } from '../core/types';
import { pickAbilityUpgrade } from './abilityUpgrades';
import type { Champion } from './champions';
import { applyGrowth, expectedLevel, xpToNext as runXpToNext } from './formulas';
import { branchPlan, canTakeTalent } from './talents';
import { statLabel, upgradeAmount } from './upgrades';
import { bestCleared, crownedRealms, type WorldProgress } from './world';

export type { StatPoints };

/** What a champion has grown into: the part of a Champion this file works on. */
export interface ChampionGrowth {
  xp: number; // champion XP banked, all of it (it is never lost: past the cap it waits for the next crown)
  level: number; // by its XP, held at the cap (levelOf)
  points: StatPoints; // stat points spent per stat
  upgrades: AbilityUpgradeId[]; // ability tiers bought, in tier order
  utilityUpgrades: UtilityUpgradeId[]; // utility tiers bought, in tier order
  talents: string[]; // talent points spent, in order
}

export const newGrowth = (): ChampionGrowth => ({ xp: 0, level: 1, points: {}, upgrades: [], utilityUpgrades: [], talents: [] });

// ---------- levels and XP ----------

/** The highest level a champion with this progress can have: CHAMPION.cap, by the crowns it holds on any tier. */
export const levelCap = (world: WorldProgress): number => Math.min(CHAMPION.cap.max, CHAMPION.cap.base + CHAMPION.cap.perCrown * crownedRealms(world).length);

/** Champion XP from `level` to the next. */
export const xpToNext = (level: number): number => Math.min(CHAMPION.xp.perLevel * level, CHAMPION.xp.most);

/** All the champion XP it takes to reach `level` from level 1. */
export function xpForLevel(level: number): number {
  let xp = 0;
  for (let l = 1; l < level; l++) xp += xpToNext(l);
  return xp;
}

/** The level `xp` champion XP gives, at most `cap`. */
export function levelForXp(xp: number, cap: number = CHAMPION.cap.max): number {
  let level = 1;
  for (let left = xp; level < cap && left >= xpToNext(level); level++) left -= xpToNext(level);
  return level;
}

/** A champion's level by its XP and the crowns it holds. */
export const levelOf = (c: Pick<Champion, 'xp' | 'world'>): number => levelForXp(c.xp, levelCap(c.world));

/**
 * Where a champion stands for an XP bar: its level and cap, the XP into its level and what the next one costs. `capped`: it stands at its
 * cap: `into` keeps counting (XP is never lost) and the next crown turns it into levels.
 */
export function levelProgress(c: Pick<Champion, 'xp' | 'world'>): { level: number; cap: number; capped: boolean; into: number; next: number } {
  const cap = levelCap(c.world);
  const level = levelForXp(c.xp, cap);
  return { level, cap, capped: level >= cap, into: c.xp - xpForLevel(level), next: xpToNext(level) };
}

/** The run XP a player at the pace holds at the start of `wave` (the old in-run curve: logic/formulas xpToNext along expectedLevel). */
function paceXp(wave: number): number {
  const level = expectedLevel(wave);
  let xp = 0;
  for (let l = 1; l < Math.floor(level); l++) xp += runXpToNext(l);
  return xp + (level - Math.floor(level)) * runXpToNext(Math.floor(level));
}

/** A level's first-clear XP: what its waves pay a player at the pace. A clear banks what it collected; this is what that comes to. */
export function levelXp(realm: RealmId, level: number): number {
  const [first, last] = REALMS[realm].levels[level - 1].waves;
  return Math.round(paceXp(last + 1) - paceXp(first));
}

/** The champion XP a clear banks from the XP it `collected`: all of it on a first clear, CHAMPION.replayXp of it on a replay. */
export const clearXp = (collected: number, first: boolean): number => Math.max(0, Math.round(collected * (first ? 1 : CHAMPION.replayXp)));

/** Is clearing `level` a first clear (on any tier)? Judged by the progress before it, as its reward is (logic/world clearRewards). */
export const firstClear = (world: WorldProgress, realm: RealmId, level: number): boolean => bestCleared(world, realm, 0) < level;

/** Bank `xp` champion XP: the level follows, up to the cap. Also after a crown with no XP: the cap rose, so XP that waited becomes levels. */
export const grantXp = <C extends Pick<Champion, 'xp' | 'level' | 'world'>>(c: C, xp = 0): C => {
  const total = c.xp + Math.max(0, Math.round(xp));
  return { ...c, xp: total, level: Math.max(c.level, levelForXp(total, levelCap(c.world))) };
};

/**
 * A v7 champion (save v7 had no levels) starts with the XP its cleared levels would have paid, a first clear each, so at the level its
 * crowns and cleared levels would have given.
 */
export function xpFromWorld(world: WorldProgress): number {
  let xp = 0;
  for (const r of REALM_IDS) for (let l = 1; l <= bestCleared(world, r, 0); l++) xp += levelXp(r, l);
  return xp;
}

/**
 * The champion level enemy scaling expects on entering `level` of `realm`: CHAMPION.expected spread over the realm's levels, held at the
 * cap of a champion with just the crowns that open the realm (so 5 from the Marches' level 5 on, until its crown).
 */
export function expectedChampionLevel(realm: RealmId, level: number): number {
  const def = REALMS[realm];
  const [from, to] = CHAMPION.expected[Math.min(CHAMPION.expected.length, def.ring) - 1];
  const cap = Math.min(CHAMPION.cap.max, CHAMPION.cap.base + CHAMPION.cap.perCrown * def.opens.crowns);
  return Math.min(cap, Math.round(from + ((to - from) * (level - 1)) / def.levels.length));
}

/**
 * Enemy HP and damage for the champion level a level expects (CHAMPION.scaling): the expected champion's strength over that of the
 * player the waves were tuned for, who stood at the pace's level `at` of the way through them (#220: at their end). Below 1 where a champion is behind the old pace
 * (no level-up inside the level), well above it in a relic realm, whose first waves a level-8 champion walks into.
 */
export function championStep(realm: RealmId, level: number): { hp: number; damage: number } {
  const [first, last] = REALMS[realm].levels[level - 1].waves;
  const s = realm === 'lastBastion' ? CHAMPION.scaling.finale : CHAMPION.scaling; // #220: the finale keeps its first fit
  const strength = (runLevels: number) => 1 + s.perRunLevel * (runLevels - 1);
  const pace = expectedLevel(first) + (expectedLevel(last + 1) - expectedLevel(first)) * s.at;
  const step = strength(1 + (expectedChampionLevel(realm, level) - 1) * CHAMPION.runLevels * s.worth) / strength(pace);
  return { hp: step, damage: step };
}

// ---------- points ----------

const sum = (p: StatPoints): number => CHAMPION_STATS.reduce((n, s) => n + (p[s] ?? 0), 0);

export const statPointsEarned = (level: number): number => (level - 1) * CHAMPION.statPoints;
export const statPointsSpent = (c: Pick<ChampionGrowth, 'points' | 'upgrades' | 'utilityUpgrades'>): number => sum(c.points) + CHAMPION.tierCost * (c.upgrades.length + c.utilityUpgrades.length);
/** Stat points still to spend. */
export const statPointsFree = (c: ChampionGrowth): number => statPointsEarned(c.level) - statPointsSpent(c);

/** `bonus`: the account's permanent talent points (the Keep, mastery, account perks and deeds: logic/economy bonusTalentPoints). */
export const talentPointsEarned = (level: number, bonus = 0): number => (level - 1) * CHAMPION.talentPoints + bonus;
/** Talent points still to spend. */
export const talentPointsFree = (c: ChampionGrowth, bonus = 0): number => talentPointsEarned(c.level, bonus) - c.talents.length;

/**
 * What one point in `stat` gives a class: which of its stats, how much is added to it, and the line a screen shows ("+10 Strength",
 * "+32% Attack Speed", "+6 Faith"). #241: `n` points' worth in the line, for a stat's total (`amount` stays one point's).
 */
export function pointGives(classId: ClassId, stat: ChampionStat, n = 1): { key: StatKey; amount: number; name: string; text: string } {
  const key = CHAMPION_STAT_KEYS[classId][stat];
  const { rarity, boons } = CHAMPION.point;
  const boon = upgradeAmount(key, rarity);
  const share = UPGRADES[key].mode === 'mult';
  const label = statLabel(key, CLASSES[classId]);
  return { key, amount: (share ? CLASSES[classId].base[key] * (boon - 1) : boon) * boons, name: CHAMPION_STAT_NAMES[stat].name, text: share ? `+${Math.round((boon - 1) * boons * n * 100)}% ${label}` : `+${boon * boons * n} ${label}` };
}

/** One point into `stat`. */
export const spendStat = <C extends ChampionGrowth>(c: C, stat: ChampionStat): C =>
  statPointsFree(c) < 1 || !CHAMPION_STATS.includes(stat) ? c : { ...c, points: { ...c.points, [stat]: (c.points[stat] ?? 0) + 1 } };

/**
 * #241: the stat points a realm run has played with already (the most any checkpoint's carry holds per stat): they stay until the run
 * ends, as resetPoints keeps the whole build. A point put in since the checkpoint is not in the run yet and can still come out.
 */
export function heldPoints(c: Pick<Champion, 'runs'>): StatPoints {
  const held: StatPoints = {};
  for (const run of Object.values(c.runs)) for (const s of CHAMPION_STATS) if (run?.carry?.points[s]) held[s] = Math.max(held[s] ?? 0, run.carry.points[s]!);
  return held;
}

/** #241: one point back out of `stat` (the minus beside it), down to what a run holds (`held`: heldPoints). */
export function unspendStat<C extends ChampionGrowth>(c: C, stat: ChampionStat, held: StatPoints = {}): C {
  const n = c.points[stat] ?? 0;
  if (n < 1 || n <= (held[stat] ?? 0)) return c;
  const { [stat]: _out, ...rest } = c.points;
  return { ...c, points: n > 1 ? { ...rest, [stat]: n - 1 } : rest };
}

/** The ability tier a champion can buy next (0-2: tiers come in order), or null: all bought. Its two options: logic/abilityUpgrades upgradeOptions. */
export const nextAbilityTier = (c: ChampionGrowth): number | null => (c.upgrades.length < 3 ? c.upgrades.length : null);

/** Buy the next ability tier as `id`, one of its two options, for CHAMPION.tierCost stat points. */
export function buyAbilityTier<C extends ChampionGrowth>(c: C, classId: ClassId, id: AbilityUpgradeId): C {
  const tier = nextAbilityTier(c);
  if (tier === null || statPointsFree(c) < CHAMPION.tierCost) return c;
  const upgrades = pickAbilityUpgrade(c.upgrades, classId, tier, id);
  return upgrades === c.upgrades ? c : { ...c, upgrades };
}

/** The utility tier a champion can buy next, or null. `tiers`: how many its mastery opens (the second is a mastery unlock). */
export const nextUtilityTier = (c: ChampionGrowth, classId: ClassId, tiers: number = UTILITY_TRACKS[classId].length): number | null =>
  c.utilityUpgrades.length < Math.min(tiers, UTILITY_TRACKS[classId].length) ? c.utilityUpgrades.length : null;

/** Buy the next utility tier as `id`, for CHAMPION.tierCost stat points. */
export function buyUtilityTier<C extends ChampionGrowth>(c: C, classId: ClassId, id: UtilityUpgradeId, tiers?: number): C {
  const tier = nextUtilityTier(c, classId, tiers);
  if (tier === null || statPointsFree(c) < CHAMPION.tierCost || !(UTILITY_TRACKS[classId][tier] as readonly string[]).includes(id)) return c;
  return { ...c, utilityUpgrades: [...c.utilityUpgrades, id] };
}

/** Why a talent can't be taken, or null when it can: the tree's own rules (logic/talents), with the champion's points. */
export const canSpendTalent = (c: ChampionGrowth, classId: ClassId, id: string, bonus = 0, rowCap = TALENTS.rows - 1, treasure?: TreasureId | null): boolean =>
  TALENT_BY_ID[id]?.classId === classId && canTakeTalent(c.talents, id, talentPointsFree(c, bonus), rowCap, treasure);

/** One talent point into `id`. `rowCap`: the Library's (config/economy TALENT_ROW_CAP). */
export const spendTalent = <C extends ChampionGrowth>(c: C, classId: ClassId, id: string, bonus = 0, rowCap = TALENTS.rows - 1, treasure?: TreasureId | null): C =>
  canSpendTalent(c, classId, id, bonus, rowCap, treasure) ? { ...c, talents: [...c.talents, id] } : c;

/** A realm run past its first level holds the build it was played with, so points can't be taken back until it ends. */
export const inRun = (c: Pick<Champion, 'runs'>): boolean => Object.values(c.runs).some((r) => !!r?.carry);

/** Every stat and talent point back, for free: only outside a run (the same object while one goes on). */
export const resetPoints = <C extends ChampionGrowth & Pick<Champion, 'runs'>>(c: C): C =>
  inRun(c) ? c : { ...c, points: {}, upgrades: [], utilityUpgrades: [], talents: [] };

// ---------- the spending screens (#241) ----------

/** The champion level its utility ability unlocks at (UTILITY.unlockLevel in run levels, a champion level being worth several). */
export const utilityUnlockLevel = 1 + Math.ceil((UTILITY.unlockLevel - 1) / CHAMPION.runLevels);

/** What `from` -> `to` champion levels gave to spend (the level-cleared screen's "level up" line). */
export const levelUpGains = (from: number, to: number): { levels: number; statPoints: number; talentPoints: number } => {
  const levels = Math.max(0, to - from);
  return { levels, statPoints: levels * CHAMPION.statPoints, talentPoints: levels * CHAMPION.talentPoints };
};

/** A two-way tier to buy: which tier (0-based), its two options, and whether the points are there. `locked`: a line saying what opens it. */
export interface TierChoice<Id extends string> {
  bought: Id[];
  next: { tier: number; options: readonly Id[]; canBuy: boolean } | null; // null: every tier bought (or none open yet)
  locked: string | null;
}

/**
 * #241: a champion's build as the level-cleared screen and the champion screen's Build tab show it: its level and XP bar, the points
 * free to spend, each stat with what a point gives and whether its plus and minus can be pressed, and the ability and utility tier
 * that can be bought next. `bonus`: the account's permanent talent points; `utilityTiers`: how many its mastery opens.
 * Decided: the minus takes back only points no realm run has played with yet (heldPoints); tiers and talents come back with the free
 * reset outside a run, never one at a time. A utility tier can be bought once the utility itself is unlocked (champion level 2).
 */
export interface BuildView {
  level: number;
  cap: number;
  capped: boolean;
  xp: number; // into its level
  next: number; // what the next level costs
  statPoints: number;
  talentPoints: number;
  tierCost: number;
  stats: { id: ChampionStat; name: string; desc: string; gives: string; points: number; total: string; canAdd: boolean; canTake: boolean }[];
  ability: TierChoice<AbilityUpgradeId>;
  utility: TierChoice<UtilityUpgradeId>;
  canReset: boolean; // outside a realm run, with something spent
}

export function buildView(c: Champion, classId: ClassId, o: { bonus?: number; utilityTiers?: number } = {}): BuildView {
  const at = levelProgress(c);
  const free = statPointsFree(c);
  const held = heldPoints(c);
  const abilityTier = nextAbilityTier(c);
  const utilityTier = nextUtilityTier(c, classId, o.utilityTiers ?? 1);
  const utilityOpen = c.level >= utilityUnlockLevel;
  return {
    level: at.level, cap: at.cap, capped: at.capped, xp: at.into, next: at.next,
    statPoints: free, talentPoints: talentPointsFree(c, o.bonus ?? 0), tierCost: CHAMPION.tierCost,
    stats: CHAMPION_STATS.map((id) => {
      const points = c.points[id] ?? 0;
      return { id, name: CHAMPION_STAT_NAMES[id].name, desc: CHAMPION_STAT_NAMES[id].desc, gives: pointGives(classId, id).text, points, total: pointGives(classId, id, points).text, canAdd: free >= 1, canTake: points > (held[id] ?? 0) };
    }),
    ability: { bought: [...c.upgrades], next: abilityTier === null ? null : { tier: abilityTier, options: ABILITY_TRACKS[classId][abilityTier], canBuy: free >= CHAMPION.tierCost }, locked: null },
    utility: {
      bought: [...c.utilityUpgrades],
      next: utilityTier === null || !utilityOpen ? null : { tier: utilityTier, options: UTILITY_TRACKS[classId][utilityTier], canBuy: free >= CHAMPION.tierCost },
      locked: utilityOpen ? null : `Unlocks at champion level ${utilityUnlockLevel}.`,
    },
    canReset: !inRun(c) && (statPointsSpent(c) > 0 || c.talents.length > 0),
  };
}

// ---------- reading a stored champion's growth (save v8) ----------

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const count = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

/**
 * Any stored value -> a valid growth for a champion of `classId` with this world progress. No XP stored (a v7 champion): the XP its
 * cleared levels would have paid. A spend the points can't pay for (a hand-edited save) gives every stat point back. A v7 talent plan
 * becomes its spent talents; a run takes as many as it has points for (buildOf).
 */
export function readGrowth(raw: Record<string, unknown>, classId: ClassId, world: WorldProgress): ChampionGrowth {
  const xp = typeof raw.xp === 'number' && Number.isFinite(raw.xp) ? Math.max(0, Math.floor(raw.xp)) : xpFromWorld(world);
  let c: ChampionGrowth = { ...newGrowth(), xp, level: levelForXp(xp, levelCap(world)) };
  const points = isObj(raw.points) ? Object.fromEntries(CHAMPION_STATS.filter((s) => count((raw.points as StatPoints)[s]) > 0).map((s) => [s, count((raw.points as StatPoints)[s])])) : {};
  const own = <T extends string>(v: unknown, known: object): T[] => (Array.isArray(v) ? [...new Set(v)].filter((id): id is T => typeof id === 'string' && Object.hasOwn(known, id)) : []);
  const stats: ChampionGrowth = { ...c, points };
  for (const id of own<AbilityUpgradeId>(raw.upgrades, ABILITY_UPGRADES)) stats.upgrades = pickAbilityUpgrade(stats.upgrades, classId, ABILITY_TRACKS[classId].findIndex((t) => t.includes(id)), id);
  for (const id of own<UtilityUpgradeId>(raw.utilityUpgrades, UTILITY_UPGRADES)) {
    const tier = UTILITY_TRACKS[classId].findIndex((t) => (t as readonly string[]).includes(id));
    if (tier >= 0 && !UTILITY_TRACKS[classId][tier].some((o) => stats.utilityUpgrades.includes(o))) stats.utilityUpgrades = [...stats.utilityUpgrades, id];
  }
  if (statPointsSpent(stats) <= statPointsEarned(c.level)) c = stats;
  const talents = Array.isArray(raw.talents) ? raw.talents : raw.talentPlan;
  c.talents = own<string>(talents, TALENT_BY_ID).filter((t) => TALENT_BY_ID[t].classId === classId);
  return c;
}

// ---------- a build, as a run takes it ----------

/** A champion's build entering a level: its level, what its points bought, and its XP bar (`xp` into the level, `next` what the next costs). */
export interface ChampionBuild {
  level: number;
  points: StatPoints;
  upgrades: AbilityUpgradeId[];
  utilityUpgrades: UtilityUpgradeId[];
  talents: string[];
  xp: number;
  next: number;
}

export const newBuild = (): ChampionBuild => ({ level: 1, points: {}, upgrades: [], utilityUpgrades: [], talents: [], xp: 0, next: xpToNext(1) });

/** The build a champion takes into its next level. Talents: as many, in order, as it has points for with the account's `bonus`. */
export function buildOf(c: Champion, bonus = 0): ChampionBuild {
  const at = levelProgress(c);
  return { level: c.level, points: { ...c.points }, upgrades: [...c.upgrades], utilityUpgrades: [...c.utilityUpgrades], talents: c.talents.slice(0, Math.max(0, talentPointsEarned(c.level, bonus))), xp: at.into, next: at.next };
}

/**
 * A class's stats grown from one champion state to a later one: CHAMPION.runLevels of its growth per level, and each stat point's boon.
 * From level 1 with no points this is the whole build; a realm run's later level adds only what the champion gained since its
 * checkpoint (systems/levels.ts applyChampion). Points only ever grow inside a run (resetPoints), so nothing is taken back.
 */
export function buildStats(classId: ClassId, stats: Stats, from: { level: number; points: StatPoints }, to: { level: number; points: StatPoints }): Stats {
  let out = { ...stats };
  for (let i = 0; i < Math.max(0, to.level - from.level) * CHAMPION.runLevels; i++) out = applyGrowth(out, CLASSES[classId].growth);
  for (const stat of CHAMPION_STATS) {
    const n = Math.max(0, (to.points[stat] ?? 0) - (from.points[stat] ?? 0));
    const { key, amount } = pointGives(classId, stat);
    out[key] += amount * n;
  }
  return out;
}

/**
 * The bot's build at `level` (the sim's and test mode's champion): ability and utility tiers where CHAMPION.bot buys them (`variant`
 * picks the option, as the bot always did; `utilityTiers`: what its mastery opens), the other points round CHAMPION.bot.stats, and a
 * talent point per level down one branch (logic/talents branchPlan), spilling into the next.
 */
export function botBuild(classId: ClassId, level: number, variant = 0, utilityTiers = 1, bonus = 0): ChampionBuild {
  let c: ChampionGrowth = { ...newGrowth(), xp: xpForLevel(level), level };
  const bot = CHAMPION.bot;
  for (const at of bot.abilityAt) if (level >= at) c = buyAbilityTier(c, classId, ABILITY_TRACKS[classId][c.upgrades.length][variant % 2]);
  for (const at of bot.utilityAt) if (level >= at && nextUtilityTier(c, classId, utilityTiers) !== null) c = buyUtilityTier(c, classId, UTILITY_TRACKS[classId][c.utilityUpgrades.length][variant % 2], utilityTiers);
  for (let i = 0; statPointsFree(c) > 0; i++) c = spendStat(c, bot.stats[i % bot.stats.length]);
  for (let spent = true; spent && talentPointsFree(c, bonus) > 0; ) {
    spent = false;
    for (let b = 0; b < 3 && !spent; b++) {
      const next = branchPlan(classId, variant + b).find((id) => canSpendTalent(c, classId, id, bonus));
      if (next) (c = spendTalent(c, classId, next, bonus)), (spent = true);
    }
  }
  return { level, points: c.points, upgrades: c.upgrades, utilityUpgrades: c.utilityUpgrades, talents: c.talents, xp: 0, next: xpToNext(level) };
}
