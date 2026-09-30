/**
 * #240: a short guided tour over a screen (the champion screen's first visit): a few steps, each pointing at one part of the screen
 * with one sentence beside it. Pure: which step comes next, whether the tour opens by itself, and where a step's bubble goes.
 */
export interface TourStep {
  id: string;
  at: string; // a CSS selector of the part this step points at, under the screen's frame
  text: string; // one sentence
}

/** The tour opens by itself once: when nothing was stored under its key yet. */
export const showTourNow = (seen: string | null): boolean => seen === null;

/** The step after step `i` of `steps`, or null when that was the last: the tour is over. */
export const tourNext = (i: number, steps: number): number | null => (i + 1 < steps ? i + 1 : null);

export interface TourBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Where a step's bubble (w × h) goes for a part at `t`, in a view of `view`: under the part, else over it, else left of it, else right
 * of it, `gap` away and kept `edge` inside the view; on top of the part's middle when it leaves no room on any side.
 */
export function tourBubble(t: TourBox, b: { w: number; h: number }, view: { w: number; h: number }, gap = 10, edge = 6): { left: number; top: number } {
  const x = (v: number) => Math.max(edge, Math.min(v, view.w - b.w - edge));
  const y = (v: number) => Math.max(edge, Math.min(v, view.h - b.h - edge));
  const cx = x(t.left + t.width / 2 - b.w / 2);
  const cy = y(t.top + t.height / 2 - b.h / 2);
  if (t.top + t.height + gap + b.h <= view.h - edge) return { left: cx, top: t.top + t.height + gap };
  if (t.top - gap - b.h >= edge) return { left: cx, top: t.top - gap - b.h };
  if (t.left - gap - b.w >= edge) return { left: t.left - gap - b.w, top: cy };
  if (t.left + t.width + gap + b.w <= view.w - edge) return { left: t.left + t.width + gap, top: cy };
  return { left: cx, top: cy };
}
