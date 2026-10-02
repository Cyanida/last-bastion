import { describe, expect, it } from 'vitest';
import { newChampion, nextStop } from '../src/logic/champions';
import { recordClear, unbuiltNotice } from '../src/logic/world';
import { REALM_IDS, REALMS } from '../src/config/world';

describe('world: realms not built yet (#258)', () => {
  it('the data marks the Marches, the Iron Hold, the Barrowvale (#281), the Cinderlands and the Last Bastion built, the rest not', () => {
    expect(REALM_IDS.filter((r) => REALMS[r].built)).toEqual(['marches', 'ironHold', 'barrowvale', 'cinderlands', 'lastBastion']);
    expect(REALM_IDS.filter((r) => !REALMS[r].built)).toEqual(['frozenPass', 'stormspire', 'hallowedReach', 'crimsonFields']);
  });

  it('only an unbuilt realm has a notice, and it says the foes, bosses and relics come in a later version', () => {
    expect(unbuiltNotice('marches')).toBeNull();
    expect(unbuiltNotice('cinderlands')).toBeNull();
    expect(unbuiltNotice('barrowvale')).toBeNull(); // #281: built
    expect(unbuiltNotice('frozenPass')).toMatch(/foes, bosses and relics come in a later version/);
  });

  it('an unbuilt realm is still open by its own thresholds (not locked)', () => {
    const c = newChampion('viking');
    c.world = recordClear(c.world, 'marches', REALMS.marches.levels.length, 0);
    expect(REALMS.frozenPass.opens.crowns).toBe(2);
  });

  it("PLAY skips an open unbuilt realm for the next built one", () => {
    const c = newChampion('viking');
    c.world = recordClear(c.world, 'marches', 7, 0);
    c.world = recordClear(c.world, 'ironHold', 5, 0);
    expect(nextStop(c, 0).realm).toBe('barrowvale'); // #281: built, so PLAY goes there; the Frozen Pass is open (2 crowns) but not built
    c.world = recordClear(c.world, 'barrowvale', 5, 0);
    expect(nextStop(c, 0).realm).toBe('cinderlands');
    c.world = recordClear(c.world, 'cinderlands', 5, 0);
    expect(nextStop(c, 0)).toEqual({ realm: 'cinderlands', level: 1, tier: 0 }); // every built realm crowned: a replay, not the Frozen Pass
  });
});
