import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { foeUntilHit, pickFrame, type AnimInput, type SheetData } from '../src/logic/animation';

describe('#157 foe animation', () => {
  it('winds up to a telegraph first, else the sooner of a shot and a swing in reach', () => {
    expect(foeUntilHit(0.3, 0.1, true, 0.05)).toBe(0.3);
    expect(foeUntilHit(0, 0.4, true, Infinity)).toBe(0.4);
    expect(foeUntilHit(0, 0.4, false, Infinity)).toBe(Infinity); // out of reach: no swing coming
    expect(foeUntilHit(0, 0.4, false, 0.2)).toBe(0.2);
    expect(foeUntilHit(0, 0, true, Infinity)).toBe(Infinity);
  });

  it("the Peasant's jab lands on its impact frame and walks at his own speed", () => {
    const d = JSON.parse(readFileSync('src/render/sheets/peasant.json', 'utf8')) as SheetData;
    const calm: AnimInput = { time: 0, walked: 0, moving: false, sinceHit: Infinity, untilHit: Infinity, attackCd: 0.8, hurt: Infinity, dead: Infinity };
    expect(pickFrame(d, { ...calm, sinceHit: 0 }, 72)).toEqual({ anim: 'attack', frame: d.impact });
    expect(pickFrame(d, { ...calm, untilHit: foeUntilHit(0, 0.01, true, Infinity) }, 72)).toEqual({ anim: 'attack', frame: d.impact - 1 });
    expect(pickFrame(d, { ...calm, moving: true, walked: 72 * 0.8 * 0.5 }, 72)).toEqual({ anim: 'walk', frame: 4 });
  });
});
