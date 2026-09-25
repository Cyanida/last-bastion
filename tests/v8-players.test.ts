import { describe, expect, it } from 'vitest';
import { GAME } from '../src/config/game';
import { createGame } from '../src/game';
import { nearestPlayer, withPlayer } from '../src/logic/players';
import { botChoose, botInput } from '../src/sim/bot';
import { intentCommand, step } from '../src/sim/commands';
import { hashState, restore, snapshot } from '../src/sim/snapshot';

const idle = { moveX: 0, moveY: 0, aimX: 0, aimY: 0, ability: false, utility: false, showAim: false };

describe('v0.8 multi-player state (#28)', () => {
  it('a run holds 1-4 players; one player is players[0] and the focus', () => {
    const solo = createGame('paladin', 7);
    expect(solo.players).toEqual([solo.player]);
    const four = createGame('paladin', 7, { allies: ['viking', 'archer', 'angel', 'necromancer'] });
    expect(four.players.map((p) => p.cls.id)).toEqual(['paladin', 'viking', 'archer', 'angel']); // capped at GAME.maxPlayers
    expect(four.players).toHaveLength(GAME.maxPlayers);
    expect(four.player).toBe(four.players[0]);
    expect(new Set(four.players.map((p) => p.x)).size).toBe(4); // side by side, not on top of each other
    expect(four.players[1].relics.rng.s).not.toBe(four.players[0].relics.rng.s); // each draws relics from their own stream
  });

  it('allies leave player 1 drawing exactly as a solo run', () => {
    const solo = createGame('viking', 42);
    const duo = createGame('viking', 42, { allies: ['archer'] });
    expect(duo.rng.s).toBe(solo.rng.s);
    expect(duo.players[0].relics.rng.s).toBe(solo.player.relics.rng.s);
  });

  it('each intent moves its own player, and the focus goes back to player 1', () => {
    const g = createGame('paladin', 3, { allies: ['viking'] });
    const [a, b] = g.players;
    const ax = a.x;
    const bx = b.x;
    for (let i = 0; i < 30; i++) step(g, [intentCommand(g, { ...idle, moveX: 1 }, 0), intentCommand(g, { ...idle, moveX: -1 }, 1)]);
    expect(a.x).toBeGreaterThan(ax);
    expect(b.x).toBeLessThan(bx);
    expect(g.player).toBe(a);
    expect(g.input.moveX).toBe(1);
    expect(b.input.moveX).toBe(-1);
    step(g, [intentCommand(g, idle, 7)]); // no such player: dropped
    expect(g.players).toHaveLength(2);
  });

  it('withPlayer focuses a player and always gives the focus back', () => {
    const g = createGame('archer', 1, { allies: ['angel'] });
    expect(withPlayer(g, g.players[1], () => g.player.cls.id)).toBe('angel');
    expect(g.player).toBe(g.players[0]);
    expect(() => withPlayer(g, g.players[1], () => { throw new Error('x'); })).toThrow();
    expect(g.player).toBe(g.players[0]);
  });

  it('enemies go for the nearest player; a tie goes to player 1', () => {
    const g = createGame('paladin', 1, { allies: ['viking'] });
    const [a, b] = g.players;
    expect(nearestPlayer(g, b.x + 5, b.y)).toBe(b);
    expect(nearestPlayer(g, (a.x + b.x) / 2, a.y)).toBe(a);
  });

  it('two bot players play several waves in one Game, and the run snapshots and restores', () => {
    const g = createGame('paladin', 1234, { allies: ['viking'] });
    for (const p of g.players) p.invulnerable = true; // the waves have to go by, not the players
    const moved = g.players.map(() => 0);
    while (g.wavesCleared < 3 && g.time < 400) {
      botChoose(g);
      const cmds = g.players.map((p, i) => withPlayer(g, p, () => intentCommand(g, botInput(g), i)));
      const before = g.players.map((p) => p.x + p.y);
      step(g, cmds);
      g.players.forEach((p, i) => (moved[i] += Math.abs(p.x + p.y - before[i])));
    }
    expect(g.wavesCleared).toBeGreaterThanOrEqual(3);
    expect(moved.every((m) => m > 100)).toBe(true); // both players fought, not just the first
    const r = restore(JSON.parse(JSON.stringify(snapshot(g))));
    expect(r.players).toHaveLength(2);
    expect(r.player).toBe(r.players[0]);
    expect(hashState(r)).toBe(hashState(g));
  }, 60_000);
});
