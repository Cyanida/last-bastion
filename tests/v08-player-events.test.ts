import { describe, expect, it } from 'vitest';
import { addListener, emit } from '../src/core/events';
import type { Player } from '../src/core/types';
import { createGame } from '../src/game';
import { spawnEnemy } from '../src/systems/spawning';
import { damageEnemy } from '../src/systems/combat';
import { withPlayer } from '../src/logic/players';
import { restore, snapshot } from '../src/sim/snapshot';

// what the listeners below heard, per test
const heard: { name: string; p: Player }[] = [];
addListener((g, name, _ev, p) => void (g.vars.spy && heard.push({ name, p })));
const each: { name: string; p: Player; focus: Player }[] = [];
addListener((g, name, _ev, p) => void (g.vars.spy && each.push({ name, p, focus: g.player })), true);

describe('v0.8 events carry their player, and players roll their own dice (#28)', () => {
  it("a hit and a kill carry the player who dealt them", () => {
    const g = createGame('paladin', 11, { allies: ['viking'] });
    const [, p2] = g.players;
    const e = spawnEnemy(g, 'knight', p2.x + 30, p2.y);
    g.vars.spy = 1;
    heard.length = 0;
    withPlayer(g, p2, () => damageEnemy(g, e, 1e6, false, 0, 0, 'attack'));
    expect(heard.filter((h) => h.name === 'onHit' || h.name === 'onKill').map((h) => h.p)).toEqual([p2, p2]);
  });

  it('a world event reaches every player once, with the focus on them; a run-wide listener hears it once', () => {
    const g = createGame('paladin', 11, { allies: ['viking', 'archer'] });
    g.vars.spy = 1;
    heard.length = each.length = 0;
    emit(g, 'onWaveStart', { wave: 1 });
    expect(heard.filter((h) => h.name === 'onWaveStart')).toHaveLength(1);
    const per = each.filter((h) => h.name === 'onWaveStart');
    expect(per.map((h) => h.p)).toEqual(g.players);
    expect(per.every((h) => h.focus === h.p)).toBe(true);
    expect(g.player).toBe(g.players[0]); // the focus comes back
  });

  it("player 1 rolls from the run's stream (solo unchanged); allies from their own, and a snapshot keeps it that way", () => {
    const g = createGame('archer', 21, { allies: ['viking', 'angel'] });
    const [p1, p2, p3] = g.players;
    expect(p1.rng).toBe(g.rng);
    expect(new Set([g.rng.s, p2.rng.s, p3.rng.s]).size).toBe(3);
    const s = g.rng.s;
    p2.rng();
    expect(g.rng.s).toBe(s); // an ally's crit never moves the world's draws
    const r = restore(JSON.parse(JSON.stringify(snapshot(g))));
    expect(r.players[0].rng).toBe(r.rng);
    expect(r.players[1].rng.s).toBe(p2.rng.s);
    expect(r.players[1].rng()).toBe(p2.rng());
  });
});
