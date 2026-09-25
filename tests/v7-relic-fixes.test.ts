import { describe, expect, it } from 'vitest';
import { RELIC_DAMAGE_PER_LEVEL, RELIC_MAX_TIER, relicN } from '../src/config/relics';
import type { Game } from '../src/core/types';
import { emit } from '../src/core/events';
import { createGame } from '../src/game';
import { killEnemy } from '../src/systems/combat';
import { addRelic, removeRelic } from '../src/systems/relics';
import { spawnEnemy } from '../src/systems/spawning';

const game = (): Game => {
  const g = createGame('paladin', 1);
  g.rng = Object.assign(() => 0.999, { s: 0 });
  return g;
};

describe('relic fixes (v0.7.5, #108)', () => {
  it('Phoenix Feather gives its revive whatever tier it arrives at, and only once per run', () => {
    for (const tier of [1, 2, 3]) {
      const g = game();
      addRelic(g, 'phoenixFeather', 'other', tier);
      expect(g.player.revives, `tier ${tier}`).toBe(1);
    }
    const g = game();
    addRelic(g, 'phoenixFeather', 'other', 2);
    removeRelic(g, 'phoenixFeather');
    addRelic(g, 'phoenixFeather', 'other', 3); // sold and found again: no second charge
    expect(g.player.revives).toBe(1);
  });

  it('a boss killed by the last link of a relic chain is still a relic moment', () => {
    const g = game();
    const boss = spawnEnemy(g, 'blackKnight', 300, 300);
    g.procDepth = 2;
    killEnemy(g, boss);
    g.procDepth = 0;
    expect(g.player.relics.offers.map((o) => o.from)).toContain('boss');
  });

  it('selling Blood Pact gives back the HP it took, not a share of HP gained since', () => {
    const g = game();
    g.player.stats.hp = 200;
    addRelic(g, 'bloodPact');
    const cut = relicN('bloodPact', 1).hp;
    expect(g.player.stats.hp).toBeCloseTo(200 * cut);
    g.player.stats.hp += 100;
    removeRelic(g, 'bloodPact');
    expect(g.player.stats.hp).toBeCloseTo(300);
  });

  it('Rebirth scales with level like every other relic damage', () => {
    const hit = (level: number): number => {
      const g = game();
      addRelic(g, 'phoenixFeather', 'other', RELIC_MAX_TIER);
      g.player.level = level;
      const e = spawnEnemy(g, 'knight', g.player.x + 40, g.player.y);
      e.armorHp = 0;
      e.hp = e.maxHp = 1e6;
      g.hash.insert(e);
      emit(g, 'onRevive', {});
      return 1e6 - e.hp;
    };
    expect(hit(10) / hit(0)).toBeCloseTo(1 + 10 * RELIC_DAMAGE_PER_LEVEL);
  });
});
