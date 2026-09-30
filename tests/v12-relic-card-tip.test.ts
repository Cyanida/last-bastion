import { describe, expect, it } from 'vitest';
import { placeClear } from '../src/logic/tipPlace';

const view = { width: 1280, height: 720 };
const overlaps = (a: { top: number; left: number }, t: { width: number; height: number }, r: { left: number; top: number; right: number; bottom: number }) =>
  a.left < r.right && a.left + t.width > r.left && a.top < r.bottom && a.top + t.height > r.top;

describe('relic card tooltip placement (#251)', () => {
  const card = { left: 516, top: 248, right: 764, bottom: 558 };
  it('sits above the card when there is room, inside the window', () => {
    const t = { width: 280, height: 150 };
    const at = placeClear(card, t, view, 8, 6)!;
    expect(at.top + t.height).toBeLessThanOrEqual(card.top);
    expect(at.left).toBeGreaterThanOrEqual(6);
    expect(at.left + t.width).toBeLessThanOrEqual(1274);
  });
  it('goes beside the card when above is too tight, never over it', () => {
    const t = { width: 280, height: 300 };
    const at = placeClear(card, t, view, 8, 6)!;
    expect(overlaps(at, t, card)).toBe(false);
    expect(at.top + t.height).toBeLessThanOrEqual(714);
  });
  it('gives up (null) when neither above nor beside fits', () => {
    expect(placeClear({ left: 0, top: 10, right: 1280, bottom: 700 }, { width: 280, height: 300 }, view, 8, 6)).toBeNull();
  });
  it('stays on screen at 1920x1080 too', () => {
    const t = { width: 280, height: 200 };
    const at = placeClear({ left: 1500, top: 400, right: 1900, bottom: 900 }, t, { width: 1920, height: 1080 }, 8, 6)!;
    expect(at.left + t.width).toBeLessThanOrEqual(1914);
    expect(at.top).toBeGreaterThanOrEqual(6);
  });
});
