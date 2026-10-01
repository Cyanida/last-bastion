/** #251: where a card's hover tooltip goes so it never covers the card it belongs to. Pure: rectangles in, a corner out. */
export interface Rect { left: number; top: number; right: number; bottom: number }
export interface Size { width: number; height: number }

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

const hits = (a: Rect, b: Rect): boolean => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

/**
 * Above the card, centred on it; failing that beside it (right, then left), nudged to stay in the window; failing that below the card's
 * buttons (`belowTop`, the bottom of the lowest one) when given. Every spot must stay clear of `avoid` (the screen's title and first
 * line, #261). Null when none fits, so the caller falls back to its usual spot.
 */
export function placeClear(
  anchor: Rect, tip: Size, view: Size, gap: number, edge: number, avoid: Rect[] = [], belowTop: number | null = null,
): { top: number; left: number } | null {
  const across = clamp((anchor.left + anchor.right) / 2 - tip.width / 2, edge, view.width - tip.width - edge);
  const down = clamp(anchor.top, edge, view.height - tip.height - edge);
  const spots: { top: number; left: number; fits: boolean }[] = [
    { top: anchor.top - tip.height - gap, left: across, fits: anchor.top - tip.height - gap >= edge },
    { top: down, left: anchor.right + gap, fits: anchor.right + gap + tip.width <= view.width - edge },
    { top: down, left: anchor.left - gap - tip.width, fits: anchor.left - gap - tip.width >= edge },
  ];
  if (belowTop !== null) {
    const top = belowTop + gap;
    spots.push({ top, left: across, fits: top + tip.height <= view.height - edge });
  }
  for (const s of spots) {
    if (!s.fits) continue;
    const rect = { left: s.left, top: s.top, right: s.left + tip.width, bottom: s.top + tip.height };
    if (!avoid.some((a) => hits(rect, a))) return { top: s.top, left: s.left };
  }
  return null;
}
