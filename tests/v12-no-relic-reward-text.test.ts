import { describe, expect, it } from 'vitest';
import { keepLockedEmptyText, keepLockedPick, newChampion } from '../src/logic/champions';
import { championPool, lockedIn } from '../src/logic/relics';
import { relicDef } from '../src/config/relics';
import type { FamilyId } from '../src/config/relics';

// #257: a keep-a-relic level with nothing to keep says why, and what you get instead.
const family: FamilyId = 'steel';
describe('no relic left to keep', () => {
  it('all rares owned: says so and names the Runes', () => {
    const c = newChampion('paladin');
    const all = lockedIn(championPool('paladin', c.inventory, family), c.inventory).filter((id) => relicDef(id).rarity === 'rare' && !relicDef(id).classId && !relicDef(id).signature);
    const full = { ...c, inventory: [...c.inventory, ...all] };
    expect(keepLockedPick(full, 'paladin', family, [], 2)).toEqual([]);
    expect(keepLockedEmptyText(full, 'paladin', family, 'Steel')).toBe('You already own every Steel relic this level offers, so you get 2 Runes instead.');
  });
  it('rares left but none of the family held: says that instead', () => {
    const c = newChampion('paladin');
    expect(keepLockedPick(c, 'paladin', family, [], 2)).toEqual([]);
    expect(keepLockedEmptyText(c, 'paladin', family, 'Steel')).toBe('You held no Steel relic when the level ended, so there is none to keep, and you get 2 Runes instead.');
  });
});
