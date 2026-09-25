import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/math';
import { createGame } from '../src/game';

/** v0.8 step 3 (#27, ARCHITECTURE.md): serializable state. Step 3.1: every stored random stream keeps its whole state in `.s`. */

describe('serializable random streams (#27)', () => {
  it('draws the same numbers as before: the golden runs depend on it', () => {
    const r = mulberry32(42);
    expect([r(), r(), r()].map((x) => Math.round(x * 1e9))).toEqual([601103752, 448290559, 852465793]);
  });

  it('copying .s into a fresh stream continues the same sequence', () => {
    const a = mulberry32(1234);
    for (let i = 0; i < 17; i++) a();
    const b = mulberry32(0);
    b.s = a.s;
    expect([b(), b(), b()]).toEqual([a(), a(), a()]);
  });

  it("the game's streams (run, relics) serialize as plain numbers", () => {
    const g = createGame('paladin', 777);
    expect(typeof g.rng.s).toBe('number');
    expect(typeof g.player.relics.rng.s).toBe('number');
    expect(JSON.parse(JSON.stringify({ s: g.rng.s })).s).toBe(g.rng.s);
  });
});
