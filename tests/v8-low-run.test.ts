import { describe, expect, it } from 'vitest';
import type { Game } from '../src/core/types';
import { createGame } from '../src/game';
import { killEnemy } from '../src/systems/combat';
import { addRelic } from '../src/systems/relics';
import { spawnEnemy } from '../src/systems/spawning';

const foe = (g: Game, dx: number) => {
  const e = spawnEnemy(g, 'knight', g.player.x + dx, g.player.y);
  e.armorHp = 0;
  g.hash.insert(e);
  return e;
};

describe('Gutting through Last Blood (#182)', () => {
  it('a bleed Gutting passes on is a bleed you apply: below 25% HP Last Blood doubles it', () => {
    const g = createGame('viking', 1);
    addRelic(g, 'butchersHook', 'other', 3);
    addRelic(g, 'berserkerTooth', 'other', 3);
    const [dead, near] = [foe(g, 60), foe(g, 90)];
    dead.statuses.bleed = { stacks: 2, time: 5, power: 1 };
    g.player.hp = g.player.stats.hp * 0.1;
    killEnemy(g, dead);
    expect(near.statuses.bleed?.stacks).toBe(4);
  });
});
