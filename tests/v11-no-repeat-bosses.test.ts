import { describe, expect, it } from 'vitest';
import { REALM_IDS, REALMS } from '../src/config/world';
import { levelBoss, realmBosses } from '../src/logic/world';

describe('no boss ends two levels of the same realm (#236)', () => {
  it('walks every realm: no plain boss repeats; an elite or crown boss is its own variant', () => {
    for (const realm of REALM_IDS) {
      const keys = realmBosses(realm);
      expect(keys).toHaveLength(REALMS[realm].levels.length);
      const plain = keys.filter((_, i) => !REALMS[realm].levels[i].boss.elite && !REALMS[realm].levels[i].boss.crown);
      expect(new Set(plain).size, realm).toBe(plain.length);
    }
  });

  it('the Marches no longer end on the Black Knight twice, and a level always ends on the same boss', () => {
    const marches = realmBosses('marches');
    expect(marches.filter((k) => k === 'blackKnight')).toHaveLength(1);
    expect(marches[0]).toBe('blackKnight'); // Act I keeps the arena's opener
    expect(realmBosses('marches')).toEqual(marches);
    expect(levelBoss('marches', 5)).toBe(marches[4]);
  });

  it("the Iron Hold's first boss comes back at level 4 as an elite", () => {
    const hold = realmBosses('ironHold');
    expect(hold[1]).toBe('warden');
    expect(hold[3]).toBe('warden');
    expect(REALMS.ironHold.levels[3].boss.elite).toBe(true);
    expect(hold.filter((k) => k === 'warden')).toHaveLength(2);
  });
});
