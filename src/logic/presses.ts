import type { Obstacle } from '../config/arenas';
import type { Rect } from '../config/regions';
import type { RealmId, WorldArenaId } from '../config/world';
import { REALMS } from '../config/world';

/**
 * #211: the Iron Hold's forge presses, as pure geometry: which flagstone slabs a press marks round the player, and who stands on a
 * marked slab when it slams. A slab is `cell` px square, laid from the map's corner (render/arena.ts), named by its centre.
 */
export interface Slab {
  x: number;
  y: number;
}

/** Do the presses work in this run? Only in a realm level whose realm has them, in that realm's own arena (test mode may pick another). */
export const pressesOn = (realm: RealmId | undefined, arena: WorldArenaId): boolean => !!realm && REALMS[realm].hazard === 'presses' && REALMS[realm].arena === arena;

/** The centre of the slab under (x, y). */
export const slabAt = (x: number, y: number, cell: number): Slab => ({ x: (Math.floor(x / cell) + 0.5) * cell, y: (Math.floor(y / cell) + 0.5) * cell });

/** Every other slam is a cross from wave `crossFrom` on; before it, and in between, a line. `n` counts the slams so far. */
export const pressShape = (wave: number, n: number, crossFrom: number): 'line' | 'cross' => (wave >= crossFrom && n % 2 === 1 ? 'cross' : 'line');

/**
 * The slabs a slam marks round (x, y): a `line` of `len` slabs through the player's own, across or down (`across`), the player's slab
 * `at` 0..len-1 along it; or a cross, the player's slab and its four neighbours. Always the player's own slab: stand still and it lands
 * on you, step one slab aside (off the line, or diagonally off the cross) and it misses.
 */
export function pressSlabs(x: number, y: number, cell: number, shape: 'line' | 'cross', len: number, across: boolean, at: number): Slab[] {
  const o = slabAt(x, y, cell);
  if (shape === 'cross') return [o, ...[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: o.x + dx * cell, y: o.y + dy * cell }))];
  const out: Slab[] = [];
  for (let i = 0; i < len; i++) {
    const k = (i - Math.min(len - 1, Math.max(0, at))) * cell;
    out.push(across ? { x: o.x + k, y: o.y } : { x: o.x, y: o.y + k });
  }
  return out;
}

/** A slab a press can reach: its centre on open floor (not a wall or a shut gate) and clear of the obstacles standing there. */
export const openSlab = (s: Slab, open: readonly Rect[], obstacles: readonly Obstacle[]): boolean =>
  open.some((r) => s.x >= r.x && s.x <= r.x + r.w && s.y >= r.y && s.y <= r.y + r.h) && obstacles.every((o) => (o.x - s.x) ** 2 + (o.y - s.y) ** 2 > o.r * o.r);

/** Is a body of radius r at (x, y) on the slab (centre sx, sy)? Its circle touches the square, as the drawn slab shows. */
export function onSlab(sx: number, sy: number, cell: number, x: number, y: number, r: number): boolean {
  const h = cell / 2;
  const dx = Math.max(Math.abs(x - sx) - h, 0), dy = Math.max(Math.abs(y - sy) - h, 0);
  return dx * dx + dy * dy < r * r || (dx === 0 && dy === 0);
}
