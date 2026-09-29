// v0.11 (#216): the Iron King, the Iron Hold's crown boss: what each phase wears, which blow comes next, and where his Decree lands
import { IRON_KING } from '../config/bosses';
import { PLATES, THORNS, TOWER_SHIELDS } from '../config/damage';
import type { EnemyId } from '../config/enemies';

/** What he wears in a phase: his plate, his iron tower shield, his thorns. */
export type KingGuard = (typeof IRON_KING.guards)[number];
export const kingGuard = (phase: number): KingGuard => IRON_KING.guards[Math.min(Math.max(phase, 1), IRON_KING.guards.length) - 1];

/** A foe's plate (config/damage.ts PLATES) as it stands now: always a knight's; the Iron King's only in his plate phase. */
export const platesOf = (id: EnemyId, phase: number) => (id === 'ironKing' && kingGuard(phase) !== 'plate' ? undefined : PLATES[id]);
/** A foe's iron tower shield (TOWER_SHIELDS) as it stands now: always up on a shieldwall; the Iron King's only in his shield phase. */
export const towerShieldOf = (id: EnemyId, phase: number) => (id === 'ironKing' && kingGuard(phase) !== 'shield' ? undefined : TOWER_SHIELDS[id]);
/** A foe's thorns (THORNS) as they stand now: always a thorn bearer's; the Iron King's only in his thorns phase. */
export const thornsOf = (id: EnemyId, phase: number) => (id === 'ironKing' && kingGuard(phase) !== 'thorns' ? undefined : THORNS[id]);

/** One of his blows. `n` counts his blows so far (0-based). */
export interface KingMove {
  decree: number; // lines of the Decree (0: none this blow)
  rush: boolean; // a telegraphed rush at you, behind the shield
  guard: boolean; // his guard of knights
}

export function kingMove(phase: number, n: number): KingMove {
  if (phase >= IRON_KING.rushFrom && n % 2 === 1) return { decree: 0, rush: true, guard: false };
  const d = IRON_KING.decree.lines;
  return { decree: d[Math.min(phase, d.length) - 1], rush: false, guard: phase === 1 && n % IRON_KING.guardEvery === 0 };
}

/** His next blow's cooldown by phase: quicker as the fight goes on. */
export const kingCd = (phase: number): number => IRON_KING.specialCd[Math.min(phase, IRON_KING.specialCd.length) - 1];

/**
 * The Decree: `lines` lines of zones from (x, y), evenly round him, the first straight along `angle` (at you), each IRON_KING.decree.zones
 * long, `step` apart from his edge (`r`) outward (the first touches it, so standing at his side on a line is no refuge), landing one after another from the inside out: step off the line, or outrun it.
 */
export function decreeZones(x: number, y: number, r: number, angle: number, lines: number): { x: number; y: number; delay: number }[] {
  const d = IRON_KING.decree;
  const out: { x: number; y: number; delay: number }[] = [];
  for (let k = 0; k < lines; k++) {
    const a = angle + (k / lines) * Math.PI * 2;
    for (let i = 1; i <= d.zones; i++) out.push({ x: x + Math.cos(a) * (r + (i - 0.5) * d.step), y: y + Math.sin(a) * (r + (i - 0.5) * d.step), delay: d.first + (i - 1) * d.gap });
  }
  return out;
}
