import type { Obstacle } from '../config/arenas';
import type { Rect } from '../config/regions';
import type { RealmId, WorldArenaId } from '../config/world';
import { REALMS } from '../config/world';

/**
 * #274: the Barrowvale's grasping hands, as pure rules: where the graves are marked round the champion, how many, and how long the hands
 * that rise from them hold him. systems/arena.ts marks them on the arena's hazard clock; systems/combat.ts lands them.
 */
export interface Grave {
  x: number;
  y: number;
}

/** Do the graves hold in this run? Only in a realm level whose realm has them, in that realm's own arena (test mode may pick another). */
export const handsOn = (realm: RealmId | undefined, arena: WorldArenaId): boolean => !!realm && REALMS[realm].hazard === 'hands' && REALMS[realm].arena === arena;

/** How many graves open at once: `graves`, and from wave `moreFrom` one more. */
export const graveCount = (wave: number, graves: number, moreFrom: number): number => graves + (wave >= moreFrom ? 1 : 0);

/**
 * `n` graves round (x, y): the first under the champion (stand still and it takes you), the rest `near`..`far` px off, spread round him
 * in even arcs (each a random angle inside its own) so two never stack on one side. `rng` returns [0, 1).
 */
export function graveSpots(x: number, y: number, n: number, near: number, far: number, rng: () => number): Grave[] {
  const out: Grave[] = [{ x, y }];
  const arc = (Math.PI * 2) / Math.max(1, n - 1);
  const turn = rng() * Math.PI * 2;
  for (let i = 1; i < n; i++) {
    const a = turn + (i - 1 + rng()) * arc;
    const d = near + rng() * (far - near);
    out.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d });
  }
  return out;
}

/** A grave the hands can rise from: on open floor (not a wall or a shut gate) and clear of the obstacles standing there. */
export const openGrave = (s: Grave, r: number, open: readonly Rect[], obstacles: readonly Obstacle[]): boolean =>
  open.some((o) => s.x >= o.x && s.x <= o.x + o.w && s.y >= o.y && s.y <= o.y + o.h) && obstacles.every((o) => (o.x - s.x) ** 2 + (o.y - s.y) ** 2 > (o.r + r * 0.5) ** 2);

/** How long the champion is held after the hands rise: `hold` s if they caught him (`caught`: the blow landed), never shortening a hold already on. */
export const heldFor = (heldT: number, hold: number, caught: boolean): number => (caught ? Math.max(heldT, hold) : heldT);

/** A held champion cannot walk: his walking speed is multiplied by this. */
export const walkFactor = (heldT: number): number => (heldT > 0 ? 0 : 1);
