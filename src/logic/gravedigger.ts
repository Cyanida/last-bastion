// v0.13 (#277): the Gravedigger, the Barrowvale's level-3 boss: which blow comes next, where his spade, his Digging and his Rot land, and
// his open graves: trampled, or risen
import { GRAVEDIGGER } from '../config/bosses';
import { TAU } from '../core/math';
import type { Grave } from '../core/types';

export type DiggerMove = 'dig' | 'spade' | 'rot';

const byPhase = <T>(list: readonly T[], phase: number): T => list[Math.max(1, Math.min(phase, list.length)) - 1];

/** His blow number `n` (0-based) in `phase`: his Digging and his spade in turn; from GRAVEDIGGER.rot.from every third blow is his Rot. */
export function diggerMove(phase: number, n: number): DiggerMove {
  const rot = phase >= GRAVEDIGGER.rot.from;
  if (rot && n % 3 === 2) return 'rot';
  return n % (rot ? 3 : 2) === 0 ? 'dig' : 'spade';
}

/** His next blow's cooldown by phase: quicker as the fight goes on. */
export const diggerCd = (phase: number): number => byPhase(GRAVEDIGGER.specialCd, phase);

/** How long an open grave waits for a foot by phase before its dead climbs out. */
export const riseTime = (phase: number): number => byPhase(GRAVEDIGGER.grave.rise, phase);

/** His spade: GRAVEDIGGER.spade.zones in an arc centred on `angle`, `reach` past his edge (`r`) from (x, y). */
export function spadeZones(x: number, y: number, r: number, angle: number): { x: number; y: number }[] {
  const s = GRAVEDIGGER.spade;
  const d = r + s.reach;
  return Array.from({ length: s.zones }, (_, i) => {
    const a = angle + (i / (s.zones - 1) - 0.5) * s.arc;
    return { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d };
  });
}

/**
 * His Digging: the first clod on (x, y) (where you stand), the rest evenly on a ring GRAVEDIGGER.dig.spread round it from `angle`,
 * landing one after the other, `gap` s apart. Each leaves an open grave where it lands.
 */
export function digZones(x: number, y: number, phase: number, angle: number): { x: number; y: number; delay: number }[] {
  const d = GRAVEDIGGER.dig;
  const n = byPhase(d.count, phase);
  return Array.from({ length: n }, (_, i) => {
    const a = angle + ((i - 1) / Math.max(1, n - 1)) * TAU;
    const r = i === 0 ? 0 : d.spread;
    return { x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, delay: d.first + i * d.gap };
  });
}

/** His Rot: a line of marks from his edge (`r`) towards `angle`, `step` apart, landing outward one after the other. */
export function rotZones(x: number, y: number, r: number, angle: number): { x: number; y: number; delay: number }[] {
  const o = GRAVEDIGGER.rot;
  return Array.from({ length: o.zones }, (_, i) => {
    const d = r + o.step * (i + 1);
    return { x: x + Math.cos(angle) * d, y: y + Math.sin(angle) * d, delay: o.delay + i * o.gap };
  });
}

/**
 * Opens the graves his Digging leaves: one per clod, open once it lands (t starts at -delay). Past GRAVEDIGGER.grave.max open graves
 * the newest are not dug, so a long fight can't bury the field.
 */
export function digGraves(graves: Grave[], clods: readonly { x: number; y: number; delay: number }[]): void {
  for (const c of clods) if (graves.length < GRAVEDIGGER.grave.max) graves.push({ x: c.x, y: c.y, t: -c.delay });
}

/**
 * One tick of his open graves: a grave the champion (at px, py, radius pr) stands on is trampled shut; one left open `riseTime(phase)` s
 * rises. `all` (a new phase): every open grave rises now. Both come back, and leave the list.
 */
export function tickGraves(graves: Grave[], dt: number, px: number, py: number, pr: number, phase: number, all = false): { trampled: Grave[]; risen: Grave[] } {
  const trampled: Grave[] = [], risen: Grave[] = [];
  const rise = riseTime(phase);
  for (let i = graves.length - 1; i >= 0; i--) {
    const gr = graves[i];
    gr.t += dt;
    if (gr.t < 0) continue; // the dirt is still in the air
    if (Math.hypot(gr.x - px, gr.y - py) <= GRAVEDIGGER.grave.radius + pr) trampled.push(gr);
    else if (all || gr.t >= rise) risen.push(gr);
    else continue;
    graves.splice(i, 1);
  }
  return { trampled, risen };
}
