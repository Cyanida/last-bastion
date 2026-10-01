// v0.13 (#275): corpses that rise again unless you trample them (the Barrowvale's Barrow Thralls): which foes do, when, and what stops it
import { RISING } from '../config/enemies';
import type { EnemyId } from '../config/enemies';
import type { Corpse } from '../core/types';

/** A foe's rising (config/enemies.ts RISING), if its kind has one. */
export const risingOf = (id: EnemyId) => RISING[id];

/** What a fallen foe's corpse carries: when it rises and as what, or undefined: its kind stays down, or it has risen once already. */
export function corpseRise(foe: { id: EnemyId; risen?: boolean; side: boolean }): Corpse['rise'] {
  const cfg = RISING[foe.id];
  return cfg && !foe.risen ? { id: foe.id, at: cfg.delay, side: foe.side } : undefined;
}

/** Whether the champion (at x, y, radius r) stands on a rising corpse: within its kind's `trample` px of his edge. */
export function tramples(c: Corpse, x: number, y: number, r: number): boolean {
  const cfg = c.rise && RISING[c.rise.id];
  return !!cfg && Math.hypot(c.x - x, c.y - y) <= r + cfg.trample;
}

/** How far a rising corpse is from rising, 0 (just fell) to 1 (rises now): the mark on the ground fills as it nears. */
export const riseProgress = (c: Corpse) => (c.rise ? Math.min(1, c.t / c.rise.at) : 0);

/**
 * One tick over the corpses, after they aged (game.ts): a rising corpse the champion stands on is trampled (it stays a plain corpse, for
 * Raise Dead and the rest, and never rises), and one whose time has come leaves the ground and is returned, for the caller to raise.
 * `onTrample` hears each corpse trampled. Mutates `corpses`.
 */
export function stepRising(corpses: Corpse[], champ: { x: number; y: number; r: number }, onTrample?: (c: Corpse) => void): Corpse[] {
  const out: Corpse[] = [];
  for (let i = corpses.length - 1; i >= 0; i--) {
    const c = corpses[i];
    if (!c.rise) continue;
    if (tramples(c, champ.x, champ.y, champ.r)) {
      c.rise = undefined;
      onTrample?.(c);
    } else if (c.t >= c.rise.at) {
      out.push(c);
      corpses.splice(i, 1);
    }
  }
  return out;
}

/** The HP a risen foe comes back with: its kind's share of the HP it had when it first stood (at least 1). */
export function risenHp(id: EnemyId, maxHp: number): number {
  return Math.max(1, Math.round(maxHp * (RISING[id]?.hp ?? 1)));
}
