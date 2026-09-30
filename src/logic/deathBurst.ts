// v0.12 (#226): foes that burst into fire where they die (the Cinderlands' Cinder Hounds): which foes do, and the blast one leaves
import { DEATH_BURSTS } from '../config/damage';
import type { EnemyId } from '../config/enemies';
import { burstsIn } from './cinderColossus';

/** A foe's death burst (config/damage.ts DEATH_BURSTS), if its kind has one. */
export const deathBurstOf = (id: EnemyId) => DEATH_BURSTS[id];

/** The marked blast a fallen foe leaves: where, how wide, how long after the fall, and its fire damage. */
export interface Blast { x: number; y: number; r: number; delay: number; damage: number }

/**
 * The blast `foe` leaves where it fell, or null: its kind has none, or it fell in the Cinder Colossus's heat (`colossus`: him, alive,
 * with his phase), where his own blast bursts it instead (systems/bosses.ts) and one death never bursts twice. `foe.damage` is its
 * blow as it stood (scaled by the wave, the tier and the level's step), so the blast grows with the foe.
 */
export function deathBurst(foe: { id: EnemyId; x: number; y: number; damage: number }, colossus?: { phase: number; x: number; y: number } | null): Blast | null {
  const cfg = DEATH_BURSTS[foe.id];
  if (!cfg || (colossus && burstsIn(colossus.phase, colossus.x, colossus.y, foe.x, foe.y))) return null;
  return { x: foe.x, y: foe.y, r: cfg.radius, delay: cfg.delay, damage: foe.damage * cfg.damage };
}
