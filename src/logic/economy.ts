import { CLASS_XP, GOLD, MASTERY, META, type MetaId, type TierDef } from '../config/economy';
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

/** Cost to go from `rank` to rank + 1, or null when capped. */
export function metaCost(id: MetaId, rank: number): number | null {
  const m = META[id];
  return rank >= m.max ? null : Math.round(m.baseCost * Math.pow(m.growth, rank));
}

export function totalMetaCost(): number {
  let sum = 0;
  for (const id of Object.keys(META) as MetaId[]) for (let r = 0; r < META[id].max; r++) sum += metaCost(id, r)!;
  return sum;
}

export function classXpForRun(run: { wavesCleared: number; bosses: number; level: number }, tier: TierDef): number {
  return Math.round((run.wavesCleared * CLASS_XP.perWaveCleared + run.bosses * CLASS_XP.perBoss + run.level * CLASS_XP.perLevel) * tier.classXp);
}

export function masteryRank(xp: number): number {
  return MASTERY.filter((r) => xp >= r.xp).length;
}

/** Sum of the rewards of all ranks reached. */
export function masteryBonus(xp: number): { secondary: number; relic: boolean; reroll: number } {
  const ranks = MASTERY.slice(0, masteryRank(xp));
  return {
    secondary: ranks.reduce((s, r) => s + r.secondary, 0),
    relic: ranks.some((r) => r.relic),
    reroll: ranks.reduce((s, r) => s + r.reroll, 0),
  };
}

export type MetaRanks = Partial<Record<MetaId, number>>;
const rank = (meta: MetaRanks, id: MetaId) => Math.min(META[id].max, meta[id] ?? 0);

/** Class base stats with the Keep's permanent upgrades and mastery applied. */
export function startingStats(base: Stats, meta: MetaRanks, secondaryBonus: number): Stats {
  return {
    hp: Math.round(base.hp * (1 + rank(meta, 'hp') * META.hp.perRank)),
    str: base.str + rank(meta, 'str') * META.str.perRank,
    dex: base.dex + rank(meta, 'dex') * META.dex.perRank,
    int: base.int + rank(meta, 'int') * META.int.perRank,
    atkSpd: base.atkSpd * (1 + rank(meta, 'atkSpd') * META.atkSpd.perRank),
    moveSpd: base.moveSpd * (1 + rank(meta, 'moveSpd') * META.moveSpd.perRank),
    secondary: base.secondary + secondaryBonus,
  };
}

/** The non-stat part of the Keep: what a run starts with. */
export function metaLoadout(meta: MetaRanks): { gold: number; rerolls: number; relicSlots: number; mods: Partial<Mods> } {
  return {
    gold: rank(meta, 'startGold') * META.startGold.perRank,
    rerolls: rank(meta, 'rerolls') * META.rerolls.perRank,
    relicSlots: rank(meta, 'relicSlot') * META.relicSlot.perRank,
    mods: { xp: 1 + rank(meta, 'xp') * META.xp.perRank, pickup: 1 + rank(meta, 'pickup') * META.pickup.perRank },
  };
}
