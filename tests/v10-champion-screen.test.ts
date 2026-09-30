import { describe, expect, it } from 'vitest';
import { newChampion, nextStop, slotView } from '../src/logic/champions';
import { recordClear } from '../src/logic/world';
import { REALMS } from '../src/config/world';

describe('champions: the champion screen (#197)', () => {
  it('PLAY starts the first open realm not crowned: at level 1, or where its realm run stands (#237)', () => {
    const c = newChampion('viking');
    expect(nextStop(c, 0)).toEqual({ realm: 'marches', level: 1, tier: 0 });
    c.world = recordClear(c.world, 'marches', 3, 0);
    expect(nextStop(c, 0)).toEqual({ realm: 'marches', level: 1, tier: 0 }); // no run in progress: a realm run starts at level 1
    c.runs.marches = { level: 4, tier: 0, seed: 9, carry: null };
    expect(nextStop(c, 0)).toEqual({ realm: 'marches', level: 4, tier: 0 }); // its checkpoint
    expect(nextStop(c, 3)).toEqual({ realm: 'marches', level: 1, tier: 1 }); // Legend not open: Knight, where a Squire clear doesn't count
  });

  it('with the Marches crowned it moves on to the next open realm', () => {
    const c = newChampion('viking');
    c.world = recordClear(c.world, 'marches', REALMS.marches.levels.length, 0);
    expect(nextStop(c, 0)).toEqual({ realm: 'ironHold', level: 1, tier: 0 });
  });

  it('six slots: a legendary fills two, slots past the level idle, a relic that no longer fits is not live', () => {
    const v = slotView('viking', ['brimstoneOil', 'dragonsTongue', 'emberheart'], 2);
    expect(v.map((s) => s.id)).toEqual(['brimstoneOil', 'dragonsTongue', 'dragonsTongue', 'emberheart', null, null]);
    expect(v.map((s) => s.second)).toEqual([false, false, true, false, false, false]);
    expect(v.map((s) => s.live)).toEqual([true, false, false, true, false, false]); // 2 slots: the legendary would take 2 more, Emberheart goes in
    expect(slotView('viking', ['brimstoneOil'], 3).map((s) => s.live)).toEqual([true, true, true, false, false, false]);
    expect(slotView('viking', [], 1)).toHaveLength(6);
  });
});
