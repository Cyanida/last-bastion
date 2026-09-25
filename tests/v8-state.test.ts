import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/math';
import { createGame } from '../src/game';
import { botStep } from '../src/sim/bot';
import { aimFan } from '../src/systems/patterns';
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

/** Step 3.2: snapshot and restore. Plays the bot until a moment with enemies about. */
function playTo(seconds: number, seed = 4242) {
  const g = createGame('paladin', seed, { noRelics: true });
  while (g.time < seconds || !g.enemies.length) botStep(g);
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

  it('refuses a function in the state', () => {
    const g = createGame('paladin', 1);
    (g.vars as Record<string, unknown>).oops = () => {};
    expect(() => snapshot(g)).toThrow(/g\.vars\.oops/);
  });
});

/** Step 3.3: delayed actions are data (a kind and plain args), so a run with timers pending restores too. */
describe('timers as data (#27)', () => {
  it('a volley winding up survives a snapshot and fires the same in both runs', () => {
    const g = playTo(60);
    const e = g.enemies[0];
    aimFan(g, e, { angle: 0, count: 5, spread: 1, windup: 0.5, damage: 10, speed: 300, range: 400 });
    expect(g.timers.map((t) => t.kind)).toContain('aimFan');
    const r = restore(JSON.parse(JSON.stringify(snapshot(g))));
    expect(r.timers.find((t) => t.kind === 'aimFan')!.a).toMatchObject({ e: r.enemies[0], tele: r.enemies[0].telegraph });
    for (let i = 0; i < 60; i++) (botStep(g), botStep(r));
    expect(JSON.stringify(snapshot(r))).toBe(JSON.stringify(snapshot(g)));
  });
});
