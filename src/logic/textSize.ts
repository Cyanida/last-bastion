import { TEXT_FIT, TEXT_SIZES, type TextSize } from '../config/game';

/** v0.8 (#123): the UI scale for a text size on a w×h window: the chosen size, capped so the scaled HUD keeps TEXT_FIT's room, never below 1. */
export function textScale(size: TextSize, w: number, h: number): number {
  return Math.min(TEXT_SIZES[size], Math.max(1, Math.min(w / TEXT_FIT.minW, h / TEXT_FIT.minH)));
}
