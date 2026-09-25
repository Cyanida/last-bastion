import { describe, expect, it } from 'vitest';
import { NET } from '../src/config/net';
import { mulberry32 } from '../src/core/math';
import { createGame } from '../src/game';
import { broadcastTransport, loopbackPair, type NetMessage } from '../src/net/transport';
import { choiceCommand, intentCommand, step, type Command } from '../src/sim/commands';
import { hashState, restore, snapshot } from '../src/sim/snapshot';

const idle = { moveX: 0, moveY: 0, aimX: 0, aimY: 0, ability: false, utility: false, showAim: false };
const perfect = { latencyMs: 0, jitterMs: 0, loss: 0 };
const cmd = (tick: number): NetMessage => ({ t: 'command', cmd: { tick, player: 0, kind: 'choice', choice: { c: 'levelUp', index: 0 } } });

describe('v0.8 loopback transport (#31)', () => {
  it('a pair carries commands both ways, as copies, and stops when closed', () => {
    const [a, b] = loopbackPair(mulberry32(1), perfect, () => 0);
    expect(a.connected && b.connected).toBe(true);
    const m = cmd(3);
    a.send(m);
    b.send(cmd(4));
    const got = b.receive();
    expect(got).toEqual([m]);
    expect(got[0]).not.toBe(m);
    expect(a.receive()).toEqual([cmd(4)]);
    expect(b.receive()).toEqual([]);
    a.close();
    expect(b.connected).toBe(false);
    a.send(cmd(5));
    expect(b.receive()).toEqual([]);
  });

  it('holds each message for the latency, plus or minus the jitter', () => {
    let now = 0;
    const [a, b] = loopbackPair(mulberry32(7), { latencyMs: 100, jitterMs: 20, loss: 0 }, () => now);
    for (let i = 0; i < 50; i++) a.send(cmd(i));
    now = 79.9;
    expect(b.receive()).toEqual([]);
    now = 120;
    expect(b.receive()).toHaveLength(50);
  });

  it('jitter can reorder, loss drops about its share, and the same seed gives the same network', () => {
    const run = (seed: number) => {
      let now = 0;
      const [a, b] = loopbackPair(mulberry32(seed), { ...NET, loss: 0.1 }, () => now);
      const got: number[] = [];
      for (let i = 0; i < 1000; i++) {
        a.send(cmd(i));
        now += 1;
        for (const m of b.receive()) if (m.t === 'command') got.push(m.cmd.tick);
      }
      now += 1000;
      for (const m of b.receive()) if (m.t === 'command') got.push(m.cmd.tick);
      return got;
    };
    const got = run(42);
    expect(got.length).toBeGreaterThan(850);
    expect(got.length).toBeLessThan(950);
    expect(got.some((t, i) => i > 0 && t < got[i - 1])).toBe(true);
    expect(run(42)).toEqual(got);
    expect(run(43)).not.toEqual(got);
  });

  it('commands stepped on the far side give the same game as stepping them here', () => {
    let now = 0;
    const [a, b] = loopbackPair(mulberry32(3), perfect, () => now);
    const here = createGame('viking', 11);
    const there = createGame('viking', 11);
    for (let i = 0; i < 120; i++) {
      const cmds: Command[] = [intentCommand(here, { ...idle, moveX: i % 40 < 20 ? 1 : -1, ability: i === 60 })];
      if (i === 30) {
        here.pendingLevelUps = there.pendingLevelUps = 1;
        cmds.unshift(choiceCommand(here, { c: 'levelUp', index: 1 }));
      }
      for (const c of cmds) a.send({ t: 'command', cmd: c });
      step(here, cmds);
      step(there, b.receive().flatMap((m) => (m.t === 'command' ? [m.cmd] : [])));
    }
    expect(there.replay).toEqual(here.replay);
    expect(hashState(there)).toBe(hashState(here));
  });

  it('a snapshot goes across and restores to the same game', () => {
    const [a, b] = loopbackPair(mulberry32(5), perfect, () => 0);
    const g = createGame('necromancer', 8);
    for (let i = 0; i < 90; i++) step(g, [intentCommand(g, { ...idle, moveY: 1 })]);
    a.send({ t: 'snapshot', tick: g.tick, snap: snapshot(g) });
    const [m] = b.receive();
    expect(m.t === 'snapshot' && m.tick).toBe(90);
    if (m.t === 'snapshot') expect(hashState(restore(m.snap))).toBe(hashState(g));
  });

  it('two BroadcastChannel ends in a room find each other, talk, and see the other leave', async () => {
    const tick = () => new Promise((r) => setTimeout(r, 20));
    const a = broadcastTransport('test-room', mulberry32(1), perfect, () => 0);
    const b = broadcastTransport('test-room', mulberry32(2), perfect, () => 0);
    await tick();
    expect(a.connected && b.connected).toBe(true);
    a.send(cmd(9));
    await tick();
    expect(b.receive()).toEqual([cmd(9)]);
    a.close();
    await tick();
    expect(b.connected).toBe(false);
    b.close();
  });
});
