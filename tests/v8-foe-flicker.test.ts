import { describe, expect, it } from 'vitest';
import { noNewTick } from '../src/logic/animation';

describe('#166 no flicker to idle between sim ticks', () => {
  it('spots a render frame with no new sim tick, so the renderer can hold its last frame instead of reading a zero position delta as idle', () => {
    expect(noNewTick(5, 5)).toBe(true); // same tick as last time: several draws between two sim steps
    expect(noNewTick(6, 5)).toBe(false); // the sim stepped since: recompute from the foe's real movement
    expect(noNewTick(0, -1)).toBe(false); // a foe's first frame: never held before, must compute
  });
});
