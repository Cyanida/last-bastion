import { FEATURES, WING_IDS, type FeatureKind, type Rect, type RegionDef, type RegionId, type WingId } from '../config/regions';
import { clamp, mulberry32 } from '../core/math';
import type { Rng } from '../core/types';

/** The walkable rects for a set of open regions: every open floor, and the corridor of every open region but the core. */
export function openRects(regions: RegionDef[], open: Partial<Record<RegionId, boolean>>): Rect[] {
  const out: Rect[] = [];
  for (const r of regions) {
    if (!open[r.id]) continue;
    out.push(r.floor);
    if (r.gate) out.push(r.gate);
  }
  return out;
}

/** Bounding box of a set of rects. */
export function boundsOf(rects: Rect[]): Rect {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const r of rects) {
    x0 = Math.min(x0, r.x);
    y0 = Math.min(y0, r.y);
    x1 = Math.max(x1, r.x + r.w);
    y1 = Math.max(y1, r.y + r.h);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * Keeps a circle of radius r inside the union of the rects: if it is inside one (shrunk by r) it stays, else it goes to the
 * nearest point that is. Corridors are only shrunk across their width, so a body walks through a gate without a seam.
 * A body too wide for a corridor simply cannot use it.
 */
export function clampToRects(rects: Rect[], b: { x: number; y: number; r: number }): void {
  let best = Infinity;
  let bx = b.x;
  let by = b.y;
  for (const q of rects) {
    const x0 = q.x + (q.along === 'x' ? 0 : b.r);
    const x1 = q.x + q.w - (q.along === 'x' ? 0 : b.r);
    const y0 = q.y + (q.along === 'y' ? 0 : b.r);
    const y1 = q.y + q.h - (q.along === 'y' ? 0 : b.r);
    if (x0 > x1 || y0 > y1) continue;
    const cx = clamp(b.x, x0, x1);
    const cy = clamp(b.y, y0, y1);
    const d = (cx - b.x) ** 2 + (cy - b.y) ** 2;
    if (d === 0) return;
    if (d < best) {
      best = d;
      bx = cx;
      by = cy;
    }
  }
  if (best < Infinity) {
    b.x = bx;
    b.y = by;
  }
}

export const inRect = (q: Rect, x: number, y: number, pad = 0): boolean => x >= q.x - pad && x <= q.x + q.w + pad && y >= q.y - pad && y <= q.y + q.h + pad;
export const inRects = (rects: Rect[], x: number, y: number): boolean => rects.some((q) => inRect(q, x, y));

/** Which region's floor a point is on (corridors count for neither), or null. */
export function regionAt(regions: RegionDef[], x: number, y: number): RegionDef | null {
  return regions.find((r) => inRect(r.floor, x, y)) ?? null;
}

/**
 * A spawn point: on the edge of an open floor, `inset` inside it, at least `minDist` from (px, py). Enemies come from the
 * whole open map, not only the core. Picks the farthest of a few tries when nothing is far enough.
 */
export function spawnPoint(floors: Rect[], rng: Rng, px: number, py: number, minDist: number, inset = 24): { x: number; y: number } {
  const total = floors.reduce((s, f) => s + f.w + f.h, 0);
  let best = { x: px, y: py };
  let bestD = -1;
  for (let tries = 0; tries < 12; tries++) {
    let pick = rng() * total;
    let f = floors[0];
    for (const q of floors) {
      pick -= q.w + q.h;
      if (pick <= 0) {
        f = q;
        break;
      }
    }
    const side = Math.floor(rng() * 4);
    const t = rng();
    const x = side < 2 ? f.x + inset + t * (f.w - 2 * inset) : side === 2 ? f.x + inset : f.x + f.w - inset;
    const y = side >= 2 ? f.y + inset + t * (f.h - 2 * inset) : side === 0 ? f.y + inset : f.y + f.h - inset;
    const d = Math.hypot(x - px, y - py);
    if (d > bestD) {
      bestD = d;
      best = { x, y };
    }
    if (d >= minDist) break;
  }
  return best;
}

/** Per Act: which feature each wing holds, and the order the wings open in. Seeded, so a Daily Trial's map is the same for everyone. */
export function rollWings(seed: number, act: number): { features: Record<WingId, FeatureKind>; order: WingId[] } {
  const rng = mulberry32((Math.imul(seed | 0, 0x27d4eb2d) ^ Math.imul(act, 0x165667b1)) >>> 0);
  const kinds = Object.keys(FEATURES) as FeatureKind[];
  const shuffle = <T>(xs: readonly T[]): T[] => {
    const a = [...xs];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const shuffled = shuffle(kinds);
  const features = Object.fromEntries(WING_IDS.map((id, i) => [id, shuffled[i]])) as Record<WingId, FeatureKind>;
  return { features, order: shuffle(WING_IDS) };
}
