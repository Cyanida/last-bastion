import { SPREADING_FIRE } from '../config/arenas';
import type { Rect } from '../config/regions';
import type { RealmId, WorldArenaId } from '../config/world';
import { REALMS } from '../config/world';
import { lavaBanks } from './lava';
import { slabAt, type Slab } from './presses';

/**
 * #224: the Cinderlands' spreading fire, as pure rules: where it catches at the lava's banks, how a tongue of it creeps over the floor
 * slab by slab to where the champion stood and spreads round that spot, and how long each slab kindles, burns and dies. A slab is a flagstone (config/arenas.ts FLAGSTONE),
 * named by its centre like the forge presses' (logic/presses.ts); systems/arena.ts runs it on its own clock.
 */

/** A slab the fire holds: `t` s since it caught. It kindles first (a warning, no harm), then burns, then is out. */
export interface Flame {
  x: number;
  y: number;
  t: number;
}

/**
 * A tongue of fire still creeping: the slab it lit last, how many more it lights, the seconds to the next, and where it is headed:
 * the spot the champion stood on when it caught. It does not follow them, so a few steps off its path always clear it.
 */
export interface FireFront {
  x: number;
  y: number;
  left: number;
  t: number;
  tx: number;
  ty: number;
}

/** Does the fire spread in this run? Only in a realm level whose realm has it, in that realm's own arena (test mode may pick another). */
export const fireOn = (realm: RealmId | undefined, arena: WorldArenaId): boolean => !!realm && REALMS[realm].hazard === 'fire' && REALMS[realm].arena === arena;

/** How many tongues catch at once: one, and from wave `twoFrom` two. */
export const fireTongues = (wave: number, twoFrom: number): number => (wave >= twoFrom ? 2 : 1);

/**
 * The slabs along the channels' banks, both sides: the slab under each bank point (logic/lava.ts lavaBanks), a step out of the lava.
 * Such a slab may lie half over the channel: the fire licks out of the lava there. No slab twice.
 */
export function bankSlabs(channels: readonly Rect[], cell: number): Slab[] {
  const out = new Map<string, Slab>();
  for (const c of channels) {
    const along = c.w >= c.h;
    for (const b of lavaBanks([c], cell)) {
      // a pixel out from the bank, away from the channel's middle
      const s = along ? slabAt(b.x, b.y + (b.y > c.y ? 1 : -1), cell) : slabAt(b.x + (b.x > c.x ? 1 : -1), b.y, cell);
      out.set(`${s.x},${s.y}`, s);
    }
  }
  return [...out.values()];
}

/** Where the fire catches: the `n` bank slabs nearest (px, py), the nearest first, each at least `apart` px from the ones before it. */
export function catchSlabs(banks: readonly Slab[], px: number, py: number, n: number, apart: number): Slab[] {
  const near = banks.slice().sort((a, b) => (a.x - px) ** 2 + (a.y - py) ** 2 - ((b.x - px) ** 2 + (b.y - py) ** 2));
  const out: Slab[] = [];
  for (const s of near) {
    if (out.length >= n) break;
    if (out.every((o) => Math.hypot(o.x - s.x, o.y - s.y) >= apart)) out.push(s);
  }
  return out;
}

/**
 * The slab a tongue at (fx, fy) lights next: of the four beside it, the `free` one nearest the spot it is headed for, (tx, ty). None
 * free: null, and the tongue dies there. Once it has reached the spot, the nearest free slab is one beside it: the fire spreads round
 * it. Four, not eight: the fire is one unbroken trail, never a diagonal a champion could slip through unseen.
 */
export function creep(fx: number, fy: number, tx: number, ty: number, cell: number, free: (s: Slab) => boolean): Slab | null {
  let best: Slab | null = null;
  let bestD = Infinity;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const s = { x: fx + dx * cell, y: fy + dy * cell };
    const d = (s.x - tx) ** 2 + (s.y - ty) ** 2;
    if (d < bestD && free(s)) (best = s), (bestD = d);
  }
  return best;
}

/** A flame `t` s old: kindling (the warning), burning, or out. */
export const flameState = (t: number, kindle: number, life: number): 'kindling' | 'burning' | 'out' => (t < kindle ? 'kindling' : t < kindle + life ? 'burning' : 'out');

const held = (flames: readonly Flame[], s: Slab): boolean => flames.some((f) => f.x === s.x && f.y === s.y);

/**
 * The fire catches on these slabs: each kindles, and a tongue starts from it towards (tx, ty), where the champion stands now, that
 * lights `reach` slabs in all, this one counted.
 */
export function catchFire(flames: Flame[], fronts: FireFront[], slabs: readonly Slab[], tx: number, ty: number, cfg: Pick<typeof SPREADING_FIRE, 'reach' | 'step'> = SPREADING_FIRE): void {
  for (const s of slabs) {
    if (held(flames, s)) continue;
    flames.push({ x: s.x, y: s.y, t: 0 });
    if (cfg.reach > 1) fronts.push({ x: s.x, y: s.y, left: cfg.reach - 1, t: cfg.step, tx, ty });
  }
}

/**
 * `dt` seconds of fire: every flame ages and the burnt-out ones go; every tongue lights its next slab each `step` s, towards its spot
 * and then round it, over slabs that are `open` (floor, no lava) and not alight already, until it has lit its reach or is boxed in.
 */
export function advanceFire(flames: Flame[], fronts: FireFront[], dt: number, cell: number, open: (s: Slab) => boolean, cfg: Pick<typeof SPREADING_FIRE, 'step' | 'kindle' | 'life'> = SPREADING_FIRE): void {
  for (const f of flames) f.t += dt;
  for (let i = flames.length - 1; i >= 0; i--) if (flameState(flames[i].t, cfg.kindle, cfg.life) === 'out') flames.splice(i, 1);
  for (const f of fronts) {
    f.t -= dt;
    while (f.t <= 0 && f.left > 0) {
      const next = creep(f.x, f.y, f.tx, f.ty, cell, (s) => open(s) && !held(flames, s));
      if (!next) {
        f.left = 0;
        break;
      }
      flames.push({ x: next.x, y: next.y, t: 0 });
      f.x = next.x;
      f.y = next.y;
      f.left--;
      f.t += cfg.step;
    }
  }
  for (let i = fronts.length - 1; i >= 0; i--) if (fronts[i].left <= 0) fronts.splice(i, 1);
}
