import type { Aim } from '../input/mapping';

interface Point {
  x: number;
  y: number;
}

const MAX_CANDIDATES = 48; // ponytail: O(candidates * points); plenty for one cast, revisit if auto-aim ever runs every tick

/**
 * Auto-aim for touch and gamepad: the centre of the densest group of points within `range` of `from`.
 * Ties go to the closer group. Returns null when nothing is in range.
 */
export function densestCluster(points: readonly Point[], from: Point, range: number, radius: number): Point | null {
  const inRange = points
    .map((p) => ({ p, d: Math.hypot(p.x - from.x, p.y - from.y) }))
    .filter((c) => c.d <= range)
    .sort((a, b) => a.d - b.d)
    .slice(0, MAX_CANDIDATES);
  let best: Point | null = null;
  let bestScore = -1;
  for (const c of inRange) {
    const group = points.filter((q) => Math.hypot(q.x - c.p.x, q.y - c.p.y) <= radius);
    const score = group.length - c.d / (range * 2); // density first, distance as the tie-breaker
    if (score > bestScore) {
      bestScore = score;
      best = { x: group.reduce((s, q) => s + q.x, 0) / group.length, y: group.reduce((s, q) => s + q.y, 0) / group.length };
    }
  }
  return best;
}

/** Turn an input-layer Aim into a world point. `toWorld` converts CSS pixels; `auto` is the precomputed auto-aim point. */
export function resolveAim(aim: Aim, player: Point, auto: Point | null, castRange: number, toWorld: (x: number, y: number) => Point, pxToWorld: number): Point {
  const fallback = auto ?? player;
  if (aim.kind === 'screen') return toWorld(aim.x, aim.y);
  if (aim.kind === 'offset') return { x: fallback.x + aim.dx * pxToWorld, y: fallback.y + aim.dy * pxToWorld };
  if (aim.kind === 'stick') return { x: player.x + aim.x * castRange, y: player.y + aim.y * castRange };
  return fallback;
}
