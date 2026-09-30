/** #251: where a card's hover tooltip goes so it never covers the card it belongs to. Pure: rectangles in, a corner out. */
export interface Rect { left: number; top: number; right: number; bottom: number }
export interface Size { width: number; height: number }

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/**
 * Above the card, centred on it; failing that beside it (right, then left), nudged to stay in the window. Null when neither fits, so the
 * caller falls back to its usual spot. Below is never tried: a card's buttons sit there.
 */
export function placeClear(anchor: Rect, tip: Size, view: Size, gap: number, edge: number): { top: number; left: number } | null {
  const across = clamp((anchor.left + anchor.right) / 2 - tip.width / 2, edge, view.width - tip.width - edge);
  if (anchor.top - tip.height - gap >= edge) return { top: anchor.top - tip.height - gap, left: across };
  const down = clamp(anchor.top, edge, view.height - tip.height - edge);
  if (anchor.right + gap + tip.width <= view.width - edge) return { top: down, left: anchor.right + gap };
  if (anchor.left - gap - tip.width >= edge) return { top: down, left: anchor.left - gap - tip.width };
  return null;
}
