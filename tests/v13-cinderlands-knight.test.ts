import { describe, expect, it } from 'vitest';
import { WORLD } from '../src/config/world';
import { createGame } from '../src/game';
import { expectedChampionLevel, levelForXp, levelCap, xpFromWorld } from '../src/logic/championLevels';
import { levelPanel, levelStep } from '../src/logic/world';
import { simulateRealm } from '../src/sim/levels';

// v0.13 (#262): the Cinderlands on Knight, from level 2 on, for a champion at the Marches crown's level (the v0.12.0 playtest's Paladin,
// level 8-9 with only the Marches crown). The sim can hold its champion at a level all realm long to measure that champion, and the
// Cinderlands' levels 2 and 4 ease (BALANCE.md).

describe('a champion with only the Marches crown in the Cinderlands (#262)', () => {
  it('stands where the sim expects it: 8 at level 1, 9 at level 2, then the one-crown cap of 10', () => {
    const at = (cleared: number) => {
      const world = { marches: [7], cinderlands: [0, cleared] };
      return levelForXp(xpFromWorld(world), levelCap(world));
    };
    expect([0, 1, 2, 3, 4].map(at)).toEqual([8, 9, 10, 10, 10]);
    expect([1, 2, 3, 4, 5].map((l) => expectedChampionLevel('cinderlands', l))).toEqual([8, 9, 10, 10, 10]);
  });

  it('eases the Cinderlands\' levels 2 and 4 on Knight, and leaves levels 1, 3 and 5 and the Iron Hold as they were', () => {
    expect(WORLD.levelStep.own.cinderlands).toEqual({ hp: [0.77, 0.72, 0.83, 0.95, 0.95], damage: [0.85, 0.82, 0.98, 1.08, 0.95] });
    expect(levelStep('cinderlands', 2)).toEqual({ hp: 0.72, damage: 0.82 }); // the floor just over Squire (#220)
    const shown = (realm: 'ironHold' | 'cinderlands', level: number) => levelPanel({ marches: [7] }, realm, level, 1).enemyHp;
    expect([1, 2, 3, 4, 5].map((l) => shown('cinderlands', l))).toEqual([335, 235, 237, 230, 200]); // were 335, 251, 237, 240, 200
    expect([1, 2, 3, 4, 5].map((l) => shown('ironHold', l))).toEqual([335, 251, 237, 240, 225]);
    const g = createGame('paladin', 5, { tier: 1, level: { realm: 'cinderlands', level: 2 } });
    expect(Math.round(g.tier.enemyHp * 100)).toBe(235);
  });
});

describe('the sim holds a champion at a level (#262)', () => {
  it('plays a realm run at the held level, where expected progress would bring its own', () => {
    const [free] = simulateRealm('paladin', 1000, 'cinderlands', 1, 0, 3, 1);
    const [held] = simulateRealm('paladin', 1000, 'cinderlands', 1, 0, 3, 1, 7);
    expect(free.champion).toBe(expectedChampionLevel('cinderlands', 1)); // 8: the Marches crown's level
    expect(held.champion).toBe(7);
  });
});
