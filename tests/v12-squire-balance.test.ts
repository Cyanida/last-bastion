import { describe, expect, it } from 'vitest';
import { relicDef } from '../src/config/relics';
import { expectedChampion, squireBar, type LevelRun } from '../src/sim/levels';

// v0.12 (#250): Squire measured. The sim plays the realm levels on Squire with a Squire player's progress, and holds Squire to a bar
// against Knight: 10 points over Knight's first-try clear rate on every level, every class but the Archer over half its Squire tries.

type Row = Omit<LevelRun, 'summary'>;
const row = (classId: Row['classId'], level: number, cleared: boolean): Row =>
  ({ classId, realm: 'ironHold', level, seed: 1, cleared, time: 60, loadout: [], power: null, relicsAtStart: 0, held: 0, duos: 0, sixes: 0, sixAt: null, moments: 0, pool: 1 });

describe('the sim on Squire (#250)', () => {
  it('gives a Squire player a Squire crown: no legendary from a relic realm, the same Marches crown', () => {
    const legendaries = (tier: number) => expectedChampion('angel', 'lastBastion', 1, tier).inventory.filter((id) => relicDef(id).rarity === 'legendary').length;
    expect(legendaries(1)).toBeGreaterThan(0);
    expect(legendaries(0)).toBe(0);
    expect(expectedChampion('paladin', 'ironHold', 1, 0).inventory).toEqual(expectedChampion('paladin', 'ironHold', 1, 1).inventory);
    expect(expectedChampion('paladin', 'ironHold', 3, 0).level).toBe(expectedChampion('paladin', 'ironHold', 3, 1).level);
  });

  it('holds Squire 10 points over Knight and every class but the Archer over half', () => {
    const squire = [
      ...['paladin', 'viking', 'angel', 'necromancer'].flatMap((c) => [row(c as Row['classId'], 1, true), row(c as Row['classId'], 1, true)]),
      row('archer', 1, false), row('archer', 1, false), // exempt: reported, not held to it
      row('paladin', 2, true), row('paladin', 2, false), row('viking', 2, true), row('viking', 2, true),
    ];
    const knight = [row('paladin', 1, true), row('paladin', 1, false), row('paladin', 2, true), row('paladin', 2, false)];
    const [one, two] = squireBar(squire, knight);
    expect(one).toMatchObject({ level: 1, squire: 0.8, knight: 0.5, easier: true, everyClass: true });
    expect(one.classes.archer).toBe(0);
    expect(two).toMatchObject({ level: 2, squire: 0.75, knight: 0.5, easier: true, everyClass: false }); // the Paladin at 50% is not over half
  });

  it('asks every Squire try on a level Knight clears 90% or more', () => {
    const knight = Array.from({ length: 10 }, (_, i) => row('angel', 1, i < 9));
    expect(squireBar(Array.from({ length: 10 }, (_, i) => row('angel', 1, i < 9)), knight)[0].easier).toBe(false);
    expect(squireBar(Array.from({ length: 10 }, () => row('angel', 1, true)), knight)[0].easier).toBe(true);
  });
});
