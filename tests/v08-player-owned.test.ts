import { describe, expect, it } from 'vitest';
import { addListener } from '../src/core/events';
import type { Player } from '../src/core/types';
import { createGame } from '../src/game';
import { damagePlayer, healPlayer } from '../src/systems/combat';
import { updateTreasures } from '../src/systems/treasures';

const hurt: Player[] = [];
addListener((g, name, _ev, p) => void (g.vars.spy && name === 'onDamageTaken' && hurt.push(p)));

describe('v0.8 hits, heals and the treasure act on the player they name, not the focused one (#28)', () => {
  it("a hit on player 2 hurts player 2 and says so; player 1 is untouched", () => {
    const g = createGame('paladin', 11, { allies: ['viking'] });
    const [p1, p2] = g.players;
    g.vars.spy = 1;
    hurt.length = 0;
    const hp1 = p1.hp;
    const hp2 = p2.hp;
    damagePlayer(g, p2, 10, true);
    expect(p2.hp).toBeLessThan(hp2);
    expect(p1.hp).toBe(hp1);
    expect(hurt).toEqual([p2]);
    healPlayer(g, p2, 1000, false);
    expect(p2.hp).toBe(p2.stats.hp);
  });

  it("the equipped treasure works for the player of its class only", () => {
    const g = createGame('necromancer', 11, { allies: ['viking'] });
    g.treasure = { id: 'bookOfTheDead', tier: 0 };
    const [p1, p2] = g.players;
    const base1 = p1.mods.minionMax;
    const base2 = p2.mods.minionMax;
    updateTreasures(g, p1);
    updateTreasures(g, p2);
    expect(p1.mods.minionMax).toBeGreaterThan(base1);
    expect(p2.mods.minionMax).toBe(base2);
  });
});
