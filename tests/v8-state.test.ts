import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/math';
import { createGame } from '../src/game';
import { botStep } from '../src/sim/bot';
import { aimFan } from '../src/systems/patterns';
import { hashState, restore, snapshot, type Snapshot } from '../src/sim/snapshot';
import { step, type Command } from '../src/sim/commands';
import { raiseSkeleton } from '../src/systems/relicCore';

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

  it("the game's streams (run, relics) serialize as plain numbers and go on the same after JSON", () => {
    const g = createGame('paladin', 777);
    for (const r of [g.rng, g.player.relics.rng]) {
      expect(typeof r.s).toBe('number');
      const copy = mulberry32(0);
      copy.s = JSON.parse(JSON.stringify({ s: r.s })).s;
      expect([copy(), copy()]).toEqual([r(), r()]);
    }
    expect(g.player.relics.rng.s).not.toBe(g.rng.s); // two streams, not one shared
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
    expect([r.kills, r.wave, r.player.hp, r.player.gold, r.tick]).toEqual([g.kills, g.wave, g.player.hp, g.player.gold, g.tick]);
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

/** Step 3.3b: the relic state that lived in module WeakMaps (Frost, Holy, Storm, Grave, raised skeletons) is in the state now. */
describe('relic state in the snapshot (#27)', () => {
  it("a relic's skeleton, a warded one, a kill streak and a walked corpse come back from a restore", () => {
    const g = playTo(30);
    const p = g.player;
    const m = raiseSkeleton(g, p, p.x, p.y, 'grave', { hp: 10, damage: 5, life: 5 });
    p.relics.warded.push(m);
    p.relics.streak.push(g.time);
    g.enemies[0].rimeT = g.time + 3;
    g.corpses.push({ x: 1, y: 2, t: 0, walked: true });
    const r = restore(JSON.parse(JSON.stringify(snapshot(g))));
    const rm = r.minions[r.minions.length - 1];
    expect(rm.relicBy).toBe('grave');
    expect(r.player.relics.warded).toEqual([rm]);
    expect(r.player.relics.streak).toEqual([g.time]);
    expect(r.enemies[0].rimeT).toBe(g.time + 3);
    expect(r.corpses[r.corpses.length - 1].walked).toBe(true);
  });
});

/**
 * Step 3.4: hashState and the replay test from the issue. The bot plays a full Act with relics and writes down its commands; a fresh
 * Game replays them and the hashes match every 60 ticks. A run restored mid-Act and continued ends on the same hash.
 */
describe('replay (#27)', () => {
  it('equal states hash equal, and one changed number changes the hash', () => {
    const g = playTo(20);
    const r = restore(JSON.parse(JSON.stringify(snapshot(g))));
    expect(hashState(r)).toBe(hashState(g));
    r.player.gold += 1;
    expect(hashState(r)).not.toBe(hashState(g));
  });

  it('the same commands give the same hash for a full Act, and a mid-Act restore ends the same', () => {
    const seed = 11; // a seed the bot clears Act 1 on (with relics, so their state is in play)
    const g = createGame('angel', seed);
    const log: Command[] = [];
    const hashes: number[] = [];
    let mid: Snapshot | null = null;
    while (g.act === 1 && !g.over && g.time < 30 * 60) {
      if (g.tick % 60 === 0) hashes.push(hashState(g));
      if (!mid && g.wave === 5) mid = JSON.parse(JSON.stringify(snapshot(g)));
      botStep(g, 0, log);
    }
    expect(g.act).toBe(2); // the bot cleared Act 1: a whole Act was recorded
    const end = hashState(g);

    const r = createGame('angel', seed);
    const at = new Map<number, Command[]>();
    for (const c of log) (at.get(c.tick) ?? at.set(c.tick, []).get(c.tick)!).push(c);
    const last = g.tick;
    while (r.tick < last) {
      if (r.tick % 60 === 0) expect(hashState(r), `tick ${r.tick}`).toBe(hashes[r.tick / 60]);
      step(r, at.get(r.tick) ?? []);
    }
    expect(hashState(r)).toBe(end);

    const m = restore(mid!);
    while (m.tick < last) step(m, at.get(m.tick) ?? []);
    expect(hashState(m)).toBe(end);
  }, 300_000);
});
