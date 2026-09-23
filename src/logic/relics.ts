import type { ClassId } from '../config/classes';
import { DUO_SIX_STRENGTH, FAMILY_IDS, RELIC_DROPS, RELIC_IDS, RELIC_MAX_TIER, RELIC_WEIGHTS, relicDef, relicMods, type FamilyId, type RelicId, type SetLevel } from '../config/relics';
import { pickWeighted } from '../core/math';
import type { Mods, RelicState, Rng } from '../core/types';
import { mulberry32 } from '../core/math';
import { hashSeed } from './acts';

/** v0.7: a player's own relic stream, split from the run seed (player 0, 1, ...). */
export const relicStream = (seed: number, player: number): Rng => mulberry32(hashSeed(`relics:${seed}:${player}`));

/** An empty relic state; createGame fills in the pool, the tier cap and the stream. */
export const emptyRelics = (): RelicState => ({
  held: [], tiers: {}, pool: [], offers: [], tierCap: 3, found: [], from: {}, stats: {}, rng: mulberry32(0),
  static: {}, dyn: {}, totals: {}, dirty: true, sets: {}, duos: [],
});

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

/**
 * v0.7: one relic moment's options. Weighted by rarity (new relics also by newRelicShare) and `lean` times more for a family already held;
 * once any family is held, at least one option comes from a held family and at least one from a family not held, when the pool allows.
 * `familyOf` returns undefined for relics without a family (the rule ignores them). The order is shuffled, so the rule's picks are not
 * always the first cards.
 */
export function rollOffer(
  pool: RelicId[], held: RelicId[], tiers: RelicTiers, rng: Rng, n: number, familyOf: (id: RelicId) => string | undefined,
  lean = 1, exclude: RelicId[] = [], cap = RELIC_MAX_TIER,
): RelicId[] {
  const heldFamilies = new Set(held.map(familyOf).filter((f): f is string => !!f));
  const share = newRelicShare(held.length);
  const all = [
    ...pool.filter((id) => !held.includes(id) && !exclude.includes(id)).map((id) => ({ value: id, weight: RELIC_WEIGHTS[relicDef(id).rarity] * share })),
    ...held.filter((id) => canUpgrade(tiers, id, cap) && !exclude.includes(id)).map((id) => ({ value: id, weight: RELIC_WEIGHTS[relicDef(id).rarity] })),
  ].map((o) => ({ ...o, weight: o.weight * (heldFamilies.has(familyOf(o.value) ?? '') ? lean : 1) }));
  const out: RelicId[] = [];
  const take = (from: typeof all) => {
    if (!from.length || out.length >= n) return;
    const pick = pickWeighted(from, rng);
    out.push(pick);
    all.splice(all.findIndex((o) => o.value === pick), 1);
  };
  if (heldFamilies.size) {
    take(all.filter((o) => heldFamilies.has(familyOf(o.value) ?? '')));
    take(all.filter((o) => { const f = familyOf(o.value); return !!f && !heldFamilies.has(f); }));
  }
  while (out.length < n && all.length) take(all);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Tiers after taking `id`: a new relic at tier 1, a held one a tier up (never past the cap). Same object back = nothing changed. */
export function withRelic(tiers: RelicTiers, id: RelicId, cap = RELIC_MAX_TIER): RelicTiers {
  const tier = relicTier(tiers, id);
  if (tier >= Math.min(cap, RELIC_MAX_TIER)) return tiers;
  return { ...tiers, [id]: tier + 1 };
}

/** v0.7 (RELICS.md): a family's count, straight pieces (not duos), set level, and the strength its set works at. */
export interface SetState { count: number; straight: number; level: 0 | SetLevel; strength: number }

/**
 * Family counts and set levels. `duoFamilies`: the two families of every formed duo (a duo counts for both). A 6 reached without 6 straight
 * pieces (a family the class does not prefer, completed with a duo) works at DUO_SIX_STRENGTH.
 */
export function familySets(held: RelicId[], duoFamilies: [FamilyId, FamilyId][]): Partial<Record<FamilyId, SetState>> {
  const out: Partial<Record<FamilyId, SetState>> = {};
  for (const f of FAMILY_IDS) {
    const straight = held.filter((id) => relicDef(id).family === f).length;
    const count = straight + duoFamilies.filter((d) => d.includes(f)).length;
    if (!count) continue;
    const level = count >= 6 ? 6 : count >= 4 ? 4 : count >= 2 ? 2 : 0;
    out[f] = { count, straight, level, strength: level === 6 && straight < 6 ? DUO_SIX_STRENGTH : 1 };
  }
  return out;
}

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
      const t = (out[key] ??= { raw: 0, eff: 0, cap: Infinity, count: 0 });
      t.raw += bonus;
      t.count++;
    }
  }
  for (const t of Object.values(out)) t.eff = t.raw; // v0.7: no category soft caps
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
    out[key] = { raw, eff: raw, cap: Infinity, count: (st?.count ?? 0) + (dyn[key] ? 1 : 0) };
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

