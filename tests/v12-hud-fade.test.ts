import { describe, expect, it } from 'vitest';
import { panelCovers } from '../src/logic/hudFade';

// #255: the wave and boss panel fades while the champion or a boss is under it.
describe('hud panel fade', () => {
  const panel = { left: 700, right: 1220, top: 12, bottom: 190 };
  const cam = { x: 0, y: 0, zoom: 2, dpr: 1 };
  it('covers a body at the top wall under the panel', () => {
    expect(panelCovers(panel, [{ x: 480, y: 40, r: 14 }], cam)).toBe(true);
  });
  it('lets go when it leaves, sideways or down', () => {
    expect(panelCovers(panel, [{ x: 200, y: 40, r: 14 }], cam)).toBe(false);
    expect(panelCovers(panel, [{ x: 480, y: 400, r: 14 }], cam)).toBe(false);
    expect(panelCovers(panel, [], cam)).toBe(false);
  });
  it('counts the head above the feet and the zoom', () => {
    expect(panelCovers(panel, [{ x: 480, y: 120, r: 14 }], cam)).toBe(true); // feet at 240, head reaches 124
    expect(panelCovers(panel, [{ x: 960, y: 300, r: 14 }], { ...cam, zoom: 1 })).toBe(false); // head at 242, below the panel
    expect(panelCovers(panel, [{ x: 960, y: 200, r: 14 }], { ...cam, zoom: 1 })).toBe(true); // head at 142, inside it
  });
});
