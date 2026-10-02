// v0.13 (#276): foes that leave plague ground where they die (the Barrowvale's Blight Hounds): which foes do, and what one does to the ground
import { PLAGUE_GROUND, PLAGUE_GROUND_RULES } from '../config/damage';
import type { EnemyId } from '../config/enemies';

/** A foe's plague ground (config/damage.ts PLAGUE_GROUND), if its kind leaves one. */
export const plagueGroundOf = (id: EnemyId) => PLAGUE_GROUND[id];

/** A patch of plague ground: where, how wide, how long it lasts, and its shadow damage a second. */
export interface Patch { x: number; y: number; r: number; life: number; dps: number }

/** Plague ground already standing, as the game holds it: `life` left of its full `max`. */
export interface Standing { x: number; y: number; r: number; life: number; max: number }

/**
 * What `foe`, fallen, does to the plague ground: nothing (its kind leaves none), `renew` a patch standing where it fell (within
 * PLAGUE_GROUND_RULES.merge x its radius: a pack dying in a heap fouls one patch), or `lay` a new one where it fell, and `drop` the
 * patch with the least time left when PLAGUE_GROUND_RULES.cap already stand. `foe.damage` is its blow as it stood (scaled by the wave,
 * the tier and the level's step), so the ground grows with the foe. Patches with no life left are gone already and count for nothing.
 */
export function plagueGround<T extends Standing>(foe: { id: EnemyId; x: number; y: number; damage: number }, standing: readonly T[]): { renew: T } | { lay: Patch; drop: T | null } | null {
  const cfg = PLAGUE_GROUND[foe.id];
  if (!cfg) return null;
  const live = standing.filter((s) => s.life > 0);
  const reach = cfg.radius * PLAGUE_GROUND_RULES.merge;
  const near = live.find((s) => (s.x - foe.x) ** 2 + (s.y - foe.y) ** 2 <= reach * reach);
  if (near) return { renew: near };
  const drop = live.length >= PLAGUE_GROUND_RULES.cap ? live.reduce((a, b) => (b.life < a.life ? b : a)) : null;
  return { lay: { x: foe.x, y: foe.y, r: cfg.radius, life: cfg.life, dps: foe.damage * cfg.dps }, drop };
}
