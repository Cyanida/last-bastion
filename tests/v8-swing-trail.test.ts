import { describe, expect, it } from 'vitest';
import { swingTrail, TRAIL_WIDTH } from '../src/logic/animation';

const pairs = (f: number[]) => Array.from({ length: f.length / 2 }, (_, i) => [f[2 * i], f[2 * i + 1]] as const);

describe('#156 swing trail', () => {
  it('is a crescent along the reach: pointed tips, widest in the middle, its trailing end eaten away as it fades', () => {
    const r = 80, n = 10;
    const p = pairs(swingTrail(r, 0, 2, 0, n));
    expect(p.length).toBe(2 * (n + 1));
    for (const [x, y] of p.slice(0, n + 1)) expect(Math.hypot(x, y)).toBeCloseTo(r, 6); // the outer edge sits on the reach
    expect(Math.hypot(...p[n + 1])).toBeCloseTo(r, 6); // the inner edge starts at the leading tip
    expect(Math.hypot(...p[n + 1 + n / 2])).toBeCloseTo(r * (1 - TRAIL_WIDTH), 6); // widest in the middle
    expect(Math.atan2(p[0][1], p[0][0])).toBeCloseTo(-1, 6); // fresh: the full arc
    expect(Math.atan2(p[n][1], p[n][0])).toBeCloseTo(1, 6);
    const late = pairs(swingTrail(r, 0, 2, 1, n));
    expect(Math.atan2(late[0][1], late[0][0])).toBeCloseTo(1 - 2 * 0.3, 6); // faded: only the leading 30% is left
    expect(Math.atan2(late[n][1], late[n][0])).toBeCloseTo(1, 6);
  });
});
