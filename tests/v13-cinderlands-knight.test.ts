import { describe, expect, it } from 'vitest';
import { expectedChampionLevel } from '../src/logic/championLevels';
import { simulateRealm } from '../src/sim/levels';

// v0.13 (#262): the Cinderlands on Knight, from level 2 on, for a champion at the Marches crown's level (the v0.12.0 playtest's Paladin,
// level 8-9 with only the Marches crown). The sim can hold its champion at a level all realm long to measure that champion.

describe('the sim holds a champion at a level (#262)', () => {
  it('plays a realm run at the held level, where expected progress would bring its own', () => {
    const [free] = simulateRealm('paladin', 1000, 'cinderlands', 1, 0, 3, 1);
    const [held] = simulateRealm('paladin', 1000, 'cinderlands', 1, 0, 3, 1, 7);
    expect(free.champion).toBe(expectedChampionLevel('cinderlands', 1)); // 8: the Marches crown's level
    expect(held.champion).toBe(7);
  });
});
