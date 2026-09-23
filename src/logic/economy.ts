import { ACCOUNT_MILESTONES, BUILDING_IDS, BUILDINGS, CLASS_XP, GOLD, MASTERY, META, RUNES, type BuildingId, type MasteryReward, type MetaId, type TierDef } from '../config/economy';
import type { Mods, Rng, Stats } from '../core/types';

/** Gold in one drop. 0 = no drop. Elites and bosses always drop. */
export function goldDrop(xp: number, kind: 'regular' | 'elite' | 'boss', rng: Rng, mult: number, eliteMult: number): number {
  if (kind === 'regular' && rng() >= GOLD.dropChance) return 0;
  const base = kind === 'boss' ? GOLD.bossDrop : xp * GOLD.perXp * (kind === 'elite' ? eliteMult : 1);
  return Math.max(1, Math.round(base * (1 + (rng() * 2 - 1) * GOLD.variance) * mult));
}

export const waveClearGold = (wave: number, mult: number) => Math.round((GOLD.waveBonusBase + GOLD.waveBonusPerWave * wave) * mult);

/** Cost of the n-th paid reroll (0-based) on one level-up screen. */
export const rerollCost = (paidSoFar: number) => Math.round(GOLD.rerollCost * Math.pow(GOLD.rerollCostGrowth, paidSoFar));

export type MetaRanks = Partial<Record<MetaId, number>>;
export type BuildingLevels = Partial<Record<BuildingId, number>>;
const rank = (meta: MetaRanks, id: MetaId) => Math.min(META[id].max, meta[id] ?? 0);

export const buildingOf = (id: MetaId): BuildingId => BUILDING_IDS.find((b) => BUILDINGS[b].upgrades.includes(id))!;
export const buildingLevel = (levels: BuildingLevels, id: BuildingId): number => Math.min(BUILDINGS[id].levels.length, levels[id] ?? 0);

/** How many ranks of a track its building's level allows. */
export function rankCap(id: MetaId, levels: BuildingLevels): number {
  const b = buildingOf(id);
  return Math.ceil(META[id].max * BUILDINGS[b].capFrac[buildingLevel(levels, b)]);
}

/** Cost to go from `rank` to rank + 1 (gold, and Runes for the top ranks), or null when capped by the track or its building. */
export function metaCost(id: MetaId, rank: number, levels?: BuildingLevels): { gold: number; runes: number } | null {
  const m = META[id];
  if (rank >= m.max || (levels && rank >= rankCap(id, levels))) return null;
  return { gold: Math.round(m.baseCost * Math.pow(m.growth, rank)), runes: m.runesFrom !== undefined && rank >= m.runesFrom ? (m.runeCost ?? 1) : 0 };
}

/** Everything the Keep can sell: every track to its max, every building to its top level. */
export function totalKeepCost(): { gold: number; runes: number } {
  let gold = 0;
  let runes = 0;
  for (const id of Object.keys(META) as MetaId[]) {
    for (let r = 0; r < META[id].max; r++) {
      const c = metaCost(id, r)!;
      gold += c.gold;
      runes += c.runes;
    }
  }
  for (const b of BUILDING_IDS) for (const l of BUILDINGS[b].levels) (gold += l.gold), (runes += l.runes);
  return { gold, runes };
}

export const totalMetaCost = (): number => totalKeepCost().gold;

/** Runes for the n-th Act boss slain in a run (0-based), plus the Treasury's Rune Carver. */
export const runesForActBoss = (index: number, meta: MetaRanks): number => RUNES.perActBoss[Math.min(RUNES.perActBoss.length - 1, index)] + rank(meta, 'runeIncome') * META.runeIncome.perRank;

export function classXpForRun(run: { wavesCleared: number; bosses: number; level: number }, tier: TierDef): number {
  return Math.round((run.wavesCleared * CLASS_XP.perWaveCleared + run.bosses * CLASS_XP.perBoss + run.level * CLASS_XP.perLevel) * tier.classXp);
}

export function masteryRank(xp: number): number {
  return MASTERY.filter((r) => xp >= r.xp).length;
}

export interface MasteryBonus {
  secondary: number;
  relic: boolean;
  reroll: number;
  talentPoint: number;
  utilityCd: number; // fraction cut
  classXp: number; // fraction bonus
  startLevel: number;
  utilityTier: boolean;
  titles: string[];
  palettes: number[];
  treasureStep: number; // v0.5 sacred treasures: 1 = the chain is open, 2 = the tier III follow-up too
}

/** Sum of the rewards of all ranks reached. */
export function masteryBonus(xp: number): MasteryBonus {
  const out: MasteryBonus = { secondary: 0, relic: false, reroll: 0, talentPoint: 0, utilityCd: 0, classXp: 0, startLevel: 0, utilityTier: false, titles: [], palettes: [], treasureStep: 0 };
  for (const r of MASTERY.slice(0, masteryRank(xp))) applyReward(out, r.reward);
  return out;
}

function applyReward(out: MasteryBonus, r: MasteryReward): void {
  switch (r.kind) {
    case 'secondary': out.secondary += r.amount; break;
    case 'reroll': out.reroll += r.amount; break;
    case 'relic': out.relic = true; break;
    case 'talentPoint': out.talentPoint += r.amount; break;
    case 'utilityCd': out.utilityCd += r.amount; break;
    case 'classXp': out.classXp += r.amount; break;
    case 'startLevel': out.startLevel += r.amount; break;
    case 'utilityTier': out.utilityTier = true; break;
    case 'title': out.titles.push(r.title); break;
    case 'palette': out.palettes.push(r.palette); break;
    case 'treasureStep': out.treasureStep = Math.max(out.treasureStep, r.step); break;
  }
}

export function rewardText(r: MasteryReward): string {
  switch (r.kind) {
    case 'secondary': return `+${r.amount} starting secondary stat`;
    case 'reroll': return `+${r.amount} free reroll on every level-up`;
    case 'relic': return 'Start with a random common relic';
    case 'talentPoint': return `Start with ${r.amount} talent point${r.amount > 1 ? 's' : ''}`;
    case 'utilityCd': return `Utility ability recharges ${Math.round(r.amount * 100)}% faster`;
    case 'classXp': return `+${Math.round(r.amount * 100)}% class XP`;
    case 'startLevel': return `Start every run ${r.amount} level${r.amount > 1 ? 's' : ''} higher`;
    case 'utilityTier': return 'A second utility upgrade choice at level 14';
    case 'title': return `Title: ${r.title}`;
    case 'palette': return 'A new sprite palette';
    case 'treasureStep': return r.step === 1 ? 'Sacred treasure: its quest begins, fragments drop from Act bosses' : 'Sacred treasure: the tier III follow-up can be earned';
  }
}

/** The account level: every class's mastery rank added up. */
export const accountLevel = (classXp: number[]): number => classXp.reduce((n, xp) => n + masteryRank(xp), 0);

export function accountPerks(level: number): { mods: Partial<Mods>; reroll: number; talentPoint: number } {
  const out = { mods: {} as Partial<Mods>, reroll: 0, talentPoint: 0 };
  for (const m of ACCOUNT_MILESTONES) {
    if (level < m.level) continue;
    for (const [k, v] of Object.entries(m.mods ?? {}) as [keyof Mods, number][]) out.mods[k] = (out.mods[k] ?? 1) * v;
    out.reroll += m.reroll ?? 0;
    out.talentPoint += m.talentPoint ?? 0;
  }
  return out;
}

/** Class base stats with the Keep's permanent upgrades and mastery applied. */
export function startingStats(base: Stats, meta: MetaRanks, secondaryBonus: number): Stats {
  return {
    hp: Math.round(base.hp * (1 + rank(meta, 'hp') * META.hp.perRank)),
    str: base.str,
    dex: base.dex,
    int: base.int,
    atkSpd: base.atkSpd,
    moveSpd: base.moveSpd * (1 + rank(meta, 'moveSpd') * META.moveSpd.perRank),
    secondary: base.secondary + secondaryBonus,
  };
}

/** The non-stat part of the Keep: what a run starts with. */
export function metaLoadout(meta: MetaRanks): {
  gold: number; rerolls: number; relicSlots: number; talentPoints: number; startLevel: number;
  traitSlots: number; startRelic: boolean; banishes: number; // v0.6 sidegrades
  relicRerolls: number; bossChoices: number; salvageBonus: number; curseBonus: number; eliteGold: number; bossGold: number; goldIncome: number; dailyCap: number; mods: Partial<Mods>;
} {
  return {
    gold: rank(meta, 'startGold') * META.startGold.perRank,
    rerolls: rank(meta, 'rerolls') * META.rerolls.perRank,
    relicSlots: rank(meta, 'relicSlot') * META.relicSlot.perRank,
    talentPoints: rank(meta, 'talentPoint') * META.talentPoint.perRank,
    startLevel: rank(meta, 'startLevel') * META.startLevel.perRank,
    traitSlots: 1 + rank(meta, 'traitSlot'),
    startRelic: rank(meta, 'startRelic') > 0,
    banishes: rank(meta, 'banish') * META.banish.perRank,
    relicRerolls: rank(meta, 'relicChance') * META.relicChance.perRank, // v0.7 Reliquary Guard
    bossChoices: rank(meta, 'relicSlot'), // v0.7 Reliquary Vault: options added at wave-boss moments
    salvageBonus: rank(meta, 'salvage') * META.salvage.perRank,
    curseBonus: rank(meta, 'curseBonus') * META.curseBonus.perRank,
    eliteGold: 1 + rank(meta, 'eliteGold') * META.eliteGold.perRank,
    bossGold: rank(meta, 'bossGold') * META.bossGold.perRank,
    goldIncome: 1 + rank(meta, 'goldIncome') * META.goldIncome.perRank,
    dailyCap: rank(meta, 'dailyCap') * META.dailyCap.perRank,
    mods: { xp: 1 + rank(meta, 'xp') * META.xp.perRank, pickup: 1 + rank(meta, 'pickup') * META.pickup.perRank, utilityCd: 1 - rank(meta, 'utilityCd') * META.utilityCd.perRank },
  };
}
