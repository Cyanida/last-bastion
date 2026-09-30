import { describe, expect, it } from 'vitest';
import { CHAMPION } from '../src/config/champion';
import { REALMS } from '../src/config/world';
import { levelForXp, xpFromWorld } from '../src/logic/championLevels';
import { realmSeed, simulateRealm } from '../src/sim/levels';

// v0.11 (#220): the bot plays a realm as one run, as a player does (src/sim/levels.ts simulateRealm): a later level goes on with what the
// run carries, and the champion spends what its clears banked before the next level

describe('the bot plays a realm as one run (#220)', () => {
  const rows = simulateRealm('paladin', 1000, 'marches', 1, 0, 20 * 60, 2);

  it('gives one row a level, in order, each on its own seed', () => {
    expect(rows.map((r) => r.level)).toEqual([1, 2]);
    expect(rows.map((r) => r.seed)).toEqual([realmSeed(1000, 1), realmSeed(1000, 2)]);
    expect(realmSeed(1000, 1)).toBe(1000);
  });

  it('goes on into level 2 with the relics level 1 ended on, not a loadout', () => {
    expect(rows[1].loadout).toEqual([]);
    expect(rows[0].held).toBeGreaterThan(0);
    expect(rows[1].relicsAtStart).toBeGreaterThanOrEqual(rows[0].held); // what it carried, and the opening pick if taken by then
    expect(rows[1].summary.wavesCleared).toBeGreaterThanOrEqual(REALMS.marches.levels[0].waves[1]); // it stands past level 1's waves
  });

  it('levels its champion up between the levels and plays level 2 at that level', () => {
    expect(rows[0].champion).toBe(1);
    expect(rows[1].champion).toBe(2); // level 1's XP is a champion level (CHAMPION.xp), and the bot spends its points (botBuild)
  });

  it('starts a relic realm with the XP its crowned realms paid', () => {
    const [first] = simulateRealm('viking', 7, 'ironHold', 1, 0, 1, 1); // a second of it: the start is what is read
    expect(first.champion).toBe(Math.min(CHAMPION.cap.base + CHAMPION.cap.perCrown, levelForXp(xpFromWorld({ marches: [REALMS.marches.levels.length] }))));
    expect(first.loadout.length).toBeGreaterThan(0); // level 1 slots its loadout
    expect(first.cleared).toBe(false);
  });
});
