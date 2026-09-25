import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/math';
import { createGame } from '../src/game';
import { botStep } from '../src/sim/bot';
import { restore, snapshot } from '../src/sim/snapshot';

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

/** Step 3.2: snapshot and restore. Plays the bot until a moment with enemies about and no timers (closures become data in step 3.3). */
function playTo(seconds: number, seed = 4242) {
  const g = createGame('paladin', seed, { noRelics: true });
  while (g.time < seconds || g.timers.length || !g.enemies.length) botStep(g);
  return g;
}

describe('snapshot and restore (#27)', () => {
  it('survives JSON, and restoring then snapshotting again gives the same JSON', () => {
    const g = playTo(90);
    const json = JSON.stringify(snapshot(g));
    expect(JSON.stringify(snapshot(restore(JSON.parse(json))))).toBe(json);
  });

  it('keeps shared references shared and config definitions the config objects', () => {
    const g = playTo(90);
    const r = restore(JSON.parse(JSON.stringify(snapshot(g))));
    expect(r.enemies.length).toBeGreaterThan(0);
    expect(r.enemies[0].def).toBe(g.enemies[0].def);
    expect(r.player.cls).toBe(g.player.cls);
    expect(r.arena).toBe(g.arena);
    for (const sq of r.squads) for (const m of sq.members) if (!m.dead) expect(r.enemies).toContain(m);
  });

  it('a restored run plays on exactly like the original', () => {
    const g = playTo(60);
    const r = restore(JSON.parse(JSON.stringify(snapshot(g))));
    for (let i = 0; i < 60 * 30 || g.timers.length; i++) (botStep(g), botStep(r));
    expect(g.kills).toBeGreaterThan(0);
    expect(r.rng.s).toBe(g.rng.s);
    expect(JSON.stringify(snapshot(r))).toBe(JSON.stringify(snapshot(g)));
    expect([r.kills, r.wave, r.player.hp, r.gold, r.tick]).toEqual([g.kills, g.wave, g.player.hp, g.gold, g.tick]);
  });

  it('refuses a closure it cannot write down yet', () => {
    const g = createGame('paladin', 1);
    g.timers.push({ t: 1, fn: () => {} });
    expect(() => snapshot(g)).toThrow(/timers/);
  });
});
