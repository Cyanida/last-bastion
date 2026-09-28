import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pickFrame, type AnimInput, type SheetData } from '../src/logic/animation';

// #165: the Plague Cart's config speed is 0 (systems/events.ts drives its motion, not its base speed), but the renderer still
// asks pickFrame for a walk frame with baseSpeed 0 while it crosses the arena. That used to divide by zero into a NaN frame,
// which drew nothing: the cart vanished. It should hold a valid frame instead.
describe('#165 plague cart walk frame', () => {
  it('walks on a valid frame at speed 0, not NaN', () => {
    const d = JSON.parse(readFileSync('src/render/sheets/plagueCart.json', 'utf8')) as SheetData;
    const calm: AnimInput = { time: 0, walked: 40, moving: true, sinceHit: Infinity, untilHit: Infinity, attackCd: 0.8, cast: Infinity, skill: Infinity, hurt: Infinity, dead: Infinity };
    const { anim, frame } = pickFrame(d, calm, 0);
    expect(anim).toBe('walk');
    expect(Number.isNaN(frame)).toBe(false);
    expect(frame).toBe(0);
  });
});
