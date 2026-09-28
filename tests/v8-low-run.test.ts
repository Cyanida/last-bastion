import { describe, expect, it } from 'vitest';
import type { Game } from '../src/core/types';
import { emit } from '../src/core/events';
import { createGame, updateGame } from '../src/game';
import { merchantReroll } from '../src/systems/acts';
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

describe('the Merchant reroll stream (#182)', () => {
  it('a reroll draws from its own stream: the run and relic streams do not move', () => {
    const g = createGame('viking', 7);
    addRelic(g, 'butchersHook');
    g.gold = 9999;
    const [run, relic] = [g.rng.s, g.player.relics.rng.s];
    expect(merchantReroll(g, 'butchersHook')).toBe(true);
    expect([g.rng.s, g.player.relics.rng.s]).toEqual([run, relic]);
  });

  it('the same seed rerolls into the same relic, whatever else was rolled first', () => {
    const pick = (burn: number) => {
      const g = createGame('viking', 7);
      addRelic(g, 'butchersHook');
      g.gold = 9999;
      for (let i = 0; i < burn; i++) g.rng();
      merchantReroll(g, 'butchersHook');
      return g.player.relics.held[0];
    };
    expect(pick(0)).toBe(pick(5));
  });
});

describe('relic crediting of delayed damage (#182)', () => {
  it("Thunder Drum's Rolling Thunder, a clap a second later, is credited to the drum", () => {
    const g = createGame('viking', 1);
    addRelic(g, 'thunderDrum', 'other', 3);
    const e = foe(g, 40);
    e.hp = e.maxHp = 1e9;
    emit(g, 'onAbilityUsed', { cooldown: 10 });
    const first = g.player.relics.stats.thunderDrum?.damage ?? 0;
    expect(first).toBeGreaterThan(0);
    expect(g.timers).toHaveLength(1);
    for (let i = 0; i < 120 && g.timers.length; i++) updateGame(g, 1 / 60);
    expect(g.timers).toHaveLength(0);
    expect(g.player.relics.stats.thunderDrum!.damage).toBeGreaterThan(first * 1.5);
  });
});
