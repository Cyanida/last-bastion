import { SKILL } from '../config/game';
import { TAU } from '../core/math';
import type { Telegraph } from '../core/types';

/**
 * v0.6 telegraph geometry, shared by the aim (systems/patterns.ts), the drawing (render/renderer.ts) and the perfect dodge
 * (systems/dodge.ts), so what you see is exactly what hits. A charge is one line; a volley is `count` lines `spread` radians wide
 * (a full circle splits evenly).
 */
export function lineAngle(t: Telegraph, i: number): number {
  const n = t.count ?? 1;
  if (n === 1) return t.angle;
  const spread = t.spread ?? 0;
  return spread >= TAU - 1e-3 ? t.angle + (i / n) * TAU : t.angle + (i / (n - 1) - 0.5) * spread;
}

/** Is a body of radius r at (x, y) inside any line of a telegraph cast from (ex, ey)? */
export function inTelegraph(t: Telegraph, ex: number, ey: number, x: number, y: number, r: number): boolean {
  for (let i = 0; i < (t.count ?? 1); i++) {
    const a = lineAngle(t, i);
    const along = (x - ex) * Math.cos(a) + (y - ey) * Math.sin(a);
    const across = -(x - ex) * Math.sin(a) + (y - ey) * Math.cos(a);
    if (along > -r && along < t.length + r && Math.abs(across) < t.width / 2 + r) return true;
  }
  return false;
}

/** A perfect dodge: clear of the attack as it lands, having been inside it no more than SKILL.perfect.window seconds before. */
export const isPerfectDodge = (lastIn: number, now: number, inside: boolean): boolean => !inside && lastIn >= 0 && now - lastIn <= SKILL.perfect.window + 1e-9;
