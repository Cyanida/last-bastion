import type { ClassId } from '../config/classes';
import { RELIC_IDS, RELIC_WEIGHTS, relicDef, type RelicId } from '../config/relics';
import { pickWeighted } from '../core/math';
import type { Rng } from '../core/types';

/** Relics this class may find: everything unlocked, minus other classes' relics. */
export function relicPoolFor(classId: ClassId, locked: RelicId[]): RelicId[] {
  return RELIC_IDS.filter((id) => !locked.includes(id) && (relicDef(id).classId ?? classId) === classId);
}

/** Up to n distinct relics not already held, weighted by rarity. */
export function rollRelics(pool: RelicId[], held: RelicId[], rng: Rng, n: number): RelicId[] {
  const left = pool.filter((id) => !held.includes(id));
  const out: RelicId[] = [];
  while (out.length < n && left.length > 0) {
    const pick = pickWeighted(left.map((id) => ({ weight: RELIC_WEIGHTS[relicDef(id).rarity], value: id })), rng);
    left.splice(left.indexOf(pick), 1);
    out.push(pick);
  }
  return out;
}

/** New relic list after taking `id`. When full, `replace` says which slot to give up; without it nothing changes. */
export function withRelic(held: RelicId[], slots: number, id: RelicId, replace?: number): RelicId[] {
  if (held.includes(id)) return held;
  if (held.length < slots) return [...held, id];
  if (replace === undefined || replace < 0 || replace >= held.length) return held;
  return held.map((r, i) => (i === replace ? id : r));
}
