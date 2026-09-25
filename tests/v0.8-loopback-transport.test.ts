import { describe, expect, it } from 'vitest';
import { NET } from '../src/config/net';
import { mulberry32 } from '../src/core/math';
import { createGame } from '../src/game';
import { broadcastTransport, loopbackPair, loopbackRoom, memoryRoom, roomTransport, type NetMessage } from '../src/net/transport';
import { choiceCommand, intentCommand, step, type Command } from '../src/sim/commands';
import { hashState, restore, snapshot } from '../src/sim/snapshot';

const idle = { moveX: 0, moveY: 0, aimX: 0, aimY: 0, ability: false, utility: false, showAim: false };
const perfect = { ...NET, latencyMs: 0, jitterMs: 0, loss: 0 };
const intent = (tick: number): NetMessage => ({ t: 'command', cmd: { tick, player: 0, kind: 'intent', intent: idle } });
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
    const [a, b] = loopbackPair(mulberry32(7), { ...NET, latencyMs: 100, jitterMs: 20, loss: 0 }, () => now);
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
        a.send(intent(i));
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
    const fast = { ...perfect, joinMs: 10 };
    const a = broadcastTransport('test-room', mulberry32(1), fast);
    await tick();
    expect(a.player).toBe(0); // nobody answered: a hosts
    const b = broadcastTransport('test-room', mulberry32(2), fast);
    await tick();
    expect(a.connected && b.connected).toBe(true);
    expect(b.player).toBe(1);
    a.send(cmd(9));
    await tick();
    expect(b.receive()).toEqual([cmd(9)]);
    a.close();
    await tick();
    expect(b.connected).toBe(false);
    b.close();
  });

  it('each window in a room gets its own player id; a fifth has none, and a freed id is handed out again', () => {
    const room = memoryRoom();
    const join = () => roomTransport(room(), mulberry32(1), { ...perfect, joinMs: 0 }, () => 0);
    const [a, b, c, d, e] = [join(), join(), join(), join(), join()];
    expect([a, b, c, d, e].map((t) => t.player)).toEqual([0, 1, 2, 3, null]);
    expect(a.peers).toBe(4);
    b.close();
    expect(a.peers).toBe(3);
    expect(join().player).toBe(1);
  });

  it('windows that open at the same moment agree on one host', () => {
    let now = 0;
    const room = memoryRoom();
    const ends = [0, 1, 2].map(() => roomTransport(room(), mulberry32(1), perfect, () => now));
    expect(ends.map((t) => t.player)).toEqual([null, null, null]); // still waiting for a host
    now = NET.joinMs;
    for (const t of ends) t.receive(); // the earliest-sorting one hosts and welcomes the rest
    const ids = ends.map((t) => t.player);
    expect(ids.filter((p) => p === 0)).toHaveLength(1);
    expect([...ids].sort()).toEqual([0, 1, 2]);
  });

  it('choice commands are resent until acknowledged: over a lossy network every pick arrives, once, at every window', () => {
    let now = 0;
    const room = loopbackRoom(3, mulberry32(9), { ...NET, loss: 0.3 }, () => now);
    const got: number[][] = room.map(() => []);
    for (let i = 0; i < 200; i++) {
      if (i < 50) room[1].send(cmd(i));
      now += 16;
      room.forEach((t, k) => got[k].push(...t.receive().flatMap((m) => (m.t === 'command' ? [m.cmd.tick] : []))));
    }
    const all = Array.from({ length: 50 }, (_, i) => i);
    expect([...got[0]].sort((x, y) => x - y)).toEqual(all);
    expect([...got[2]].sort((x, y) => x - y)).toEqual(all);
    expect(got[1]).toEqual([]);
  });

  it('intents are not resent, and a window that leaves is no longer waited on', () => {
    let now = 0;
    const room = memoryRoom();
    const join = () => roomTransport(room(), mulberry32(4), { ...perfect, loss: 1, joinMs: 0 }, () => now); // no ack ever arrives
    const [a, b] = [join(), join()];
    const sent: string[] = [];
    room().listen((w) => w.t === 'msg' && sent.push(w.m.t === 'command' ? w.m.cmd.kind : w.m.t)); // hears every post, joins nothing
    a.send(intent(1));
    a.send(cmd(1));
    for (let k = 0; k < 3; k++) {
      now += NET.resendMs;
      a.receive();
    }
    expect(sent).toEqual(['intent', 'choice', 'choice', 'choice', 'choice']);
    b.close();
    now += NET.resendMs;
    a.receive();
    expect(sent).toHaveLength(5);
  });
});
