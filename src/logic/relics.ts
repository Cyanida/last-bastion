import type { ClassId } from '../config/classes';
import { RELIC_DROPS, RELIC_IDS, RELIC_MAX_TIER, RELIC_STACKING, RELIC_WEIGHTS, relicDef, relicMods, SYNERGIES, SYNERGY_IDS, type RelicCategory, type RelicId, type SynergyId } from '../config/relics';
import { pickWeighted } from '../core/math';
import type { Mods, Rng } from '../core/types';

export type RelicTiers = Partial<Record<RelicId, number>>;

/** Relics this class may find: everything unlocked, minus other classes' relics. */
export function relicPoolFor(classId: ClassId, locked: RelicId[]): RelicId[] {
  return RELIC_IDS.filter((id) => !locked.includes(id) && (relicDef(id).classId ?? classId) === classId);
}

export const relicTier = (tiers: RelicTiers, id: RelicId): number => tiers[id] ?? 0;
export const canUpgrade = (tiers: RelicTiers, id: RelicId, cap = RELIC_MAX_TIER): boolean => relicTier(tiers, id) > 0 && relicTier(tiers, id) < Math.min(cap, RELIC_MAX_TIER);

/** Share of new relics in a drop: shrinks with every relic held, so late drops are mostly upgrades. */
export const newRelicShare = (heldCount: number): number => Math.max(RELIC_DROPS.minNewShare, 1 - heldCount * RELIC_DROPS.newDecayPerHeld);

/**
 * Up to n distinct offers, weighted by rarity: new relics from the pool (weight scaled by newRelicShare) and upgrades of held relics
 * below the top tier. `exclude` keeps the same relic out of two offers queued at once.
 */
export function rollRelics(pool: RelicId[], held: RelicId[], tiers: RelicTiers, rng: Rng, n: number, exclude: RelicId[] = [], cap = RELIC_MAX_TIER): RelicId[] {
  const share = newRelicShare(held.length);
  const left = [
    ...pool.filter((id) => !held.includes(id) && !exclude.includes(id)).map((id) => ({ value: id, weight: RELIC_WEIGHTS[relicDef(id).rarity] * share })),
    ...held.filter((id) => canUpgrade(tiers, id, cap) && !exclude.includes(id)).map((id) => ({ value: id, weight: RELIC_WEIGHTS[relicDef(id).rarity] })),
  ];
  const out: RelicId[] = [];
  while (out.length < n && left.length > 0) {
    const pick = pickWeighted(left, rng);
    left.splice(left.findIndex((o) => o.value === pick), 1);
    out.push(pick);
  }
  return out;
}

/** Tiers after taking `id`: a new relic at tier 1, a held one a tier up (never past the cap). Same object back = nothing changed. */
export function withRelic(tiers: RelicTiers, id: RelicId, cap = RELIC_MAX_TIER): RelicTiers {
  const tier = relicTier(tiers, id);
  if (tier >= Math.min(cap, RELIC_MAX_TIER)) return tiers;
  return { ...tiers, [id]: tier + 1 };
}

/** Synergies whose relics are all held (clashes included: the caller filters on `anti`). */
export function activeSynergies(held: RelicId[]): SynergyId[] {
  return SYNERGY_IDS.filter((id) => SYNERGIES[id].relics.every((r) => held.includes(r as RelicId)));
}

export const synergiesOf = (id: RelicId): SynergyId[] => SYNERGY_IDS.filter((s) => (SYNERGIES[s].relics as RelicId[]).includes(id));

/** Soft cap: face value up to the cap, diminishing returns past it (the excess is squeezed into at most half the cap again). */
export function softCap(sum: number, cap: number): number {
  if (sum <= cap) return sum;
  const tail = cap / 2;
  return cap + tail * (1 - Math.exp(-(sum - cap) / tail));
}

const MULTIPLICATIVE = new Set<keyof Mods>(['damage', 'atkSpd', 'moveSpd', 'cooldown', 'pickup', 'xp', 'gold', 'minionAtkSpd', 'minionDamage']);

export interface RelicModTotal {
  raw: number; // the additive sum of bonuses (a cooldown cut is positive here)
  eff: number; // after the soft cap
  cap: number;
  count: number; // relics contributing
}

/** Per mod key: what the held relics add up to and what survives the soft cap. Multiplicative keys are handled as bonuses (1.12 -> +0.12). */
export function relicModTotals(held: RelicId[], tiers: RelicTiers): Partial<Record<keyof Mods, RelicModTotal>> {
  const out: Partial<Record<keyof Mods, RelicModTotal>> = {};
  for (const id of held) {
    const mods = relicMods(id, relicTier(tiers, id));
    if (!mods) continue;
    for (const key of Object.keys(mods) as (keyof Mods)[]) {
      const v = mods[key]!;
      const bonus = MULTIPLICATIVE.has(key) ? (key === 'cooldown' ? 1 - v : v - 1) : v;
      const t = (out[key] ??= { raw: 0, eff: 0, cap: RELIC_STACKING.softCaps[key] ?? Infinity, count: 0 });
      t.raw += bonus;
      t.count++;
    }
  }
  for (const t of Object.values(out)) t.eff = softCap(t.raw, t.cap);
  return out;
}

export type RelicTotals = Partial<Record<keyof Mods, RelicModTotal>>;

/** Static totals plus this tick's conditional bonuses (a charge, a horn...), soft-capped together. */
export function foldRelicMods(statics: RelicTotals, dyn: Partial<Record<keyof Mods, number>>): RelicTotals {
  const out: RelicTotals = {};
  const keys = new Set([...Object.keys(statics), ...Object.keys(dyn)] as (keyof Mods)[]);
  for (const key of keys) {
    const st = statics[key];
    const raw = (st?.raw ?? 0) + (dyn[key] ?? 0);
    if (raw === 0 && !st) continue;
    const cap = st?.cap ?? RELIC_STACKING.softCaps[key] ?? Infinity;
    out[key] = { raw, eff: softCap(raw, cap), cap, count: (st?.count ?? 0) + (dyn[key] ? 1 : 0) };
  }
  return out;
}

/** Totals -> the one Mods object to fold into p.mods (multiplicative keys become 1 + eff, a cooldown cut 1 - eff). */
export function totalsToMods(totals: RelicTotals): Partial<Mods> {
  const mods: Partial<Mods> = {};
  for (const [key, t] of Object.entries(totals) as [keyof Mods, RelicModTotal][]) {
    mods[key] = MULTIPLICATIVE.has(key) ? (key === 'cooldown' ? 1 - t.eff : 1 + t.eff) : t.eff;
  }
  return mods;
}

/** The one Mods object that folds every held relic's plain mods together (additive within a key, soft-capped). */
export const relicModsCombined = (held: RelicId[], tiers: RelicTiers): Partial<Mods> => totalsToMods(relicModTotals(held, tiers));

/** Past procCap relics of a proc category, every proc's chance is scaled down so the category as a whole stops growing. */
export function procScale(held: RelicId[], category: RelicCategory): number {
  const count = held.filter((id) => relicDef(id).category === category).length;
  return count <= RELIC_STACKING.procCap ? 1 : RELIC_STACKING.procCap / count;
}
