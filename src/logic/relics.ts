import type { ClassId } from '../config/classes';
import { ATTUNEMENT, DUO_IDS, DUO_SIX_STRENGTH, DUOS, FAMILY_IDS, RELIC_MOMENTS, RELIC_IDS, RELIC_MAX_TIER, RELIC_WEIGHTS, relicDef, relicMods, type DuoId, type FamilyId, type RelicId, type RelicKey, type SetLevel } from '../config/relics';
import { pickWeighted } from '../core/math';
import type { Mods, RelicState, Rng, SeededRng } from '../core/types';
import { mulberry32 } from '../core/math';
import { hashSeed } from './acts';

/** v0.7: a player's own relic stream, split from the run seed (player 0, 1, ...). */
export const relicStream = (seed: number, player: number): SeededRng => mulberry32(hashSeed(`relics:${seed}:${player}`));

/** An empty relic state; createGame fills in the pool and the stream. */
export const emptyRelics = (): RelicState => ({
  held: [], tiers: {}, attune: {}, work: {}, pool: [], offers: [], found: [], from: {}, stats: {}, rng: mulberry32(0),
  static: {}, dyn: {}, totals: {}, dirty: true, sets: {}, duos: [], cursedAct: 0,
});

export type RelicTiers = Partial<Record<RelicId, number>>;

/** A4: attunement a relic earns by doing its work, up to ATTUNEMENT.workCap a wave (the tier-up itself happens in systems/relics updateRelics). */
export function addWork(r: RelicState, key: RelicKey, amount: number): void {
  const id = key as RelicId; // a duo is never held: it has no tiers and does not attune
  if (!r.held.includes(id) || (r.tiers[id] ?? 0) >= RELIC_MAX_TIER) return;
  const add = Math.min(amount, ATTUNEMENT.workCap - (r.work[id] ?? 0));
  if (!(add > 0)) return;
  r.work[id] = (r.work[id] ?? 0) + add;
  r.attune[id] = (r.attune[id] ?? 0) + add;
}
/**
 * v0.7 A5: duos ready to be offered: both source relics held, neither feeding a formed duo, not formed yet; the first completed first (by when
 * its second source relic was taken).
 */
export function readyDuos(r: Pick<RelicState, 'held' | 'duos'>): DuoId[] {
  const used = new Set<RelicId>(r.duos.flatMap((d) => DUOS[d].from));
  const done = (d: DuoId) => Math.max(...DUOS[d].from.map((id) => r.held.indexOf(id)));
  return DUO_IDS.filter((d) => !r.duos.includes(d) && DUOS[d].from.every((id) => r.held.includes(id) && !used.has(id))).sort((a, b) => done(a) - done(b));
}
/** The two families of every formed duo, for familySets. */
export const duoFamilies = (duos: DuoId[]): [FamilyId, FamilyId][] => duos.map((d) => DUOS[d].families);

/** A4: attunement every held relic below the top tier gains (a wave cleared, an elite killed). */
export function attuneAll(r: RelicState, amount: number): void {
  for (const id of r.held) if ((r.tiers[id] ?? 0) < RELIC_MAX_TIER) r.attune[id] = (r.attune[id] ?? 0) + amount;
}

/** Relics this class may find: everything unlocked, minus other classes' relics. */
export function relicPoolFor(classId: ClassId, locked: RelicId[]): RelicId[] {
  return RELIC_IDS.filter((id) => !locked.includes(id) && !relicDef(id).cursed && (relicDef(id).classId ?? classId) === classId); // v0.7.1: cursed relics come by their own rule
}

export const relicTier = (tiers: RelicTiers, id: RelicId): number => tiers[id] ?? 0;

/**
 * v0.7.1 B7: what the Merchant's Reforge carries over, half a relic's attunement. A relic's attunement is (tier - 1) + its bar: 0 for a fresh
 * tier I, 2 once awakened (the bar stops there). Half of that goes to the new relic as tier + bar: awakened -> tier II with an empty bar,
 * tier II at 50% -> tier I at 75%, tier I at 60% -> tier I at 30%.
 */
export function halfAttunement(tier: number, attune: number): { tier: number; attune: number } {
  const kept = (tier - 1 + (tier >= RELIC_MAX_TIER ? 0 : Math.min(1, attune))) / 2;
  return { tier: 1 + Math.floor(kept), attune: kept - Math.floor(kept) };
}

/** Up to n distinct relics from the pool, weighted by rarity; never one already held (v0.7: no duplicates) or in `exclude`. */
export function rollRelics(pool: RelicId[], held: RelicId[], rng: Rng, n: number, exclude: RelicId[] = []): RelicId[] {
  const left = pool.filter((id) => !held.includes(id) && !exclude.includes(id)).map((id) => ({ value: id, weight: RELIC_WEIGHTS[relicDef(id).rarity] }));
  const out: RelicId[] = [];
  while (out.length < n && left.length > 0) {
    const pick = pickWeighted(left, rng);
    left.splice(left.findIndex((o) => o.value === pick), 1);
    out.push(pick);
  }
  return out;
}

/**
 * v0.7: one relic moment's options, never a held relic. Weighted by rarity and `lean` times more for a family already held;
 * once any family is held, at least one option comes from a held family and at least one from a family not held, when the pool allows.
 * `familyOf` returns undefined for relics without a family (the rule ignores them). The order is shuffled, so the rule's picks are not
 * always the first cards.
 */
export function rollOffer(
  pool: RelicId[], held: RelicId[], rng: Rng, n: number, familyOf: (id: RelicId) => string | undefined, lean = 1, exclude: RelicId[] = [],
): RelicId[] {
  const heldFamilies = new Set(held.map(familyOf).filter((f): f is string => !!f));
  const all = pool.filter((id) => !held.includes(id) && !exclude.includes(id))
    .map((id) => ({ value: id, weight: RELIC_WEIGHTS[relicDef(id).rarity] * (relicDef(id).classId ? RELIC_MOMENTS.classRelicWeight : 1) * (heldFamilies.has(familyOf(id) ?? '') ? lean : 1) }));
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

