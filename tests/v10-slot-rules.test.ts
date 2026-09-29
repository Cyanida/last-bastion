import { describe, expect, it } from 'vitest';
import { fitLoadout, readChampion, slotBlock, slotCost } from '../src/logic/champions';
import { createGame } from '../src/game';
import { REALMS, WORLD } from '../src/config/world';

describe('relics: the slot rules (#195)', () => {
  it('a legendary costs 2 slots, the rest 1', () => {
    expect(slotCost('dragonsTongue')).toBe(WORLD.loadout.legendarySlots);
    expect(slotCost('brimstoneOil')).toBe(1);
  });

  it('names why a relic cannot be slotted', () => {
    expect(slotBlock('viking', [], 'hungeringBlade', 6)).toBe('cursed');
    expect(slotBlock('viking', [], 'fireArrows', 6)).toBe('otherClass');
    expect(slotBlock('viking', ['brimstoneOil'], 'brimstoneOil', 6)).toBe('slotted');
    expect(slotBlock('viking', ['brimstoneOil'], 'dragonsTongue', 2)).toBe('slots'); // 1 + 2 > 2
    expect(slotBlock('viking', ['brimstoneOil'], 'dragonsTongue', 3)).toBeNull();
    expect(slotBlock('viking', ['brimstoneOil', 'emberheart', 'cinderCharm', 'salamanderScale'], 'dragonsTongue', 6)).toBe('family');
    expect(slotBlock('viking', ['dragonsTongue'], 'everfrostCrown', 6)).toBe('legendary');
    expect(slotBlock('viking', ['dragonsTongue'], 'everfrostCrown', 6, true)).toBeNull(); // 2 in the Last Bastion
    expect(slotBlock('archer', ['fireArrows', 'rimebow'], 'galeforceQuiver', 6)).toBe('classRelics');
    expect(slotBlock('archer', ['fireArrows'], 'rimebow', 6)).toBeNull();
  });

  it('a loadout keeps, in order, every relic that still fits', () => {
    expect(fitLoadout('viking', ['dragonsTongue', 'everfrostCrown', 'brimstoneOil', 'hungeringBlade'], 3)).toEqual(['dragonsTongue', 'brimstoneOil']);
    expect(fitLoadout('viking', ['brimstoneOil', 'emberheart', 'cinderCharm'], 2)).toEqual(['brimstoneOil', 'emberheart']); // fewer slots: the first ones
  });

  it('a saved loadout is read to the rules at the most slots', () => {
    const inventory = ['dragonsTongue', 'everfrostCrown', 'brimstoneOil'];
    const c = readChampion({ inventory, loadouts: { marches: inventory, lastBastion: inventory } }, 'viking');
    expect(c.loadouts.marches).toEqual(['dragonsTongue', 'brimstoneOil']);
    expect(c.loadouts.lastBastion).toEqual(inventory);
  });

  it('a level slots only what fits its slots and rules', () => {
    const g = createGame('viking', 3, { level: { realm: 'marches', level: 3, relics: ['brimstoneOil', 'dragonsTongue', 'emberheart', 'cinderCharm'] } });
    expect(g.player.relics.held).toEqual(['brimstoneOil', 'emberheart']); // 2 slots; the legendary would take 2 more
    const h = createGame('viking', 3, { level: { realm: 'marches', level: 3, relics: ['brimstoneOil', 'dragonsTongue'] }, meta: { startRelic: 1 } });
    expect(h.player.relics.held).toEqual(['brimstoneOil', 'dragonsTongue']); // Armorer's Choice: a third slot
  });

  it('tier by position: I early in a realm, II late; I in the Last Bastion', () => {
    expect(REALMS.ironHold.levels.map((l) => l.relicTier)).toEqual([1, 1, 1, 2, 2]);
    expect(REALMS.marches.levels.map((l) => l.relicTier)).toEqual([1, 1, 1, 1, 2, 2, 2]);
    expect(REALMS.lastBastion.levels[0].relicTier).toBe(1);
    const g = createGame('viking', 3, { level: { realm: 'marches', level: 5, relics: ['brimstoneOil'] } });
    expect(g.player.relics.tiers.brimstoneOil).toBe(2);
  });
});
