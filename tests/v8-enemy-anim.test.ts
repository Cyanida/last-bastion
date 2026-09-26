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
    const calm: AnimInput = { time: 0, walked: 0, moving: false, sinceHit: Infinity, untilHit: Infinity, attackCd: 0.8, cast: Infinity, skill: Infinity, hurt: Infinity, dead: Infinity };
    expect(pickFrame(d, { ...calm, sinceHit: 0 }, 72)).toEqual({ anim: 'attack', frame: d.impact });
    expect(pickFrame(d, { ...calm, untilHit: foeUntilHit(0, 0.01, true, Infinity) }, 72)).toEqual({ anim: 'attack', frame: d.impact - 1 });
    expect(pickFrame(d, { ...calm, moving: true, walked: 72 * 0.8 * 0.5 }, 72)).toEqual({ anim: 'walk', frame: 4 });
  });

  it("a hasted foe (War Drummer) steps and swings faster, a slowed one slower, through the shared pickFrame", () => {
    const d = JSON.parse(readFileSync('src/render/sheets/knight.json', 'utf8')) as SheetData;
    const calm: AnimInput = { time: 0, walked: 0, moving: true, sinceHit: Infinity, untilHit: Infinity, attackCd: 1, cast: Infinity, skill: Infinity, hurt: Infinity, dead: Infinity };
    const base = 60, t = 0.5; // seconds of walking
    const walkAt = (mult: number) => pickFrame(d, { ...calm, walked: base * mult * t }, base).frame; // walked grows with the buffed speed
    expect(walkAt(1.3)).toBeGreaterThan(walkAt(1));
    expect(walkAt(0.5)).toBeLessThan(walkAt(1));
    // a faster attack interval squeezes the swing: 120 ms after the hit, a short interval is further into the recovery
    const post = (cd: number) => pickFrame(d, { ...calm, moving: false, sinceHit: 0.12, attackCd: cd }, base);
    expect(post(0.2).frame).toBeGreaterThan(post(2).frame); // #156: 0.2, as a short swing (no wind-up) fits 0.4 s unsqueezed
  });
});
