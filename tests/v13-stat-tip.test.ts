import { describe, expect, it } from 'vitest';
import { placeClear } from '../src/logic/tipPlace';

describe('a stat tip keeps off the points line (#266)', () => {
  const view = { width: 1280, height: 720 };
  const line = { left: 400, top: 300, right: 880, bottom: 326 };
  const row = { left: 420, top: 340, right: 700, bottom: 380 };
  const tip = { width: 260, height: 90 };
  const hit = (a: { top: number; left: number }) => a.left < line.right && a.left + tip.width > line.left && a.top < line.bottom && a.top + tip.height > line.top;
  it('goes beside or below the row when above would cover the line', () => {
    const at = placeClear(row, tip, view, 8, 6, [line], row.bottom)!;
    expect(at).not.toBeNull();
    expect(hit(at)).toBe(false);
  });
  it('is null when nothing fits, so the usual spot is used', () => {
    expect(placeClear(row, { width: 1270, height: 700 }, view, 8, 6, [line], row.bottom)).toBeNull();
  });
});
