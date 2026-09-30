import { describe, expect, it } from 'vitest';
import { TIERS } from '../src/config/economy';
import { relicDef } from '../src/config/relics';
import { createGame } from '../src/game';
import { championStep } from '../src/logic/championLevels';
import { levelPanel, levelStep, ringStep, tierStep } from '../src/logic/world';
import { expectedChampion, squireBar, type LevelRun } from '../src/sim/levels';

// v0.12 (#250): Squire measured. The sim plays the realm levels on Squire with a Squire player's progress, and holds Squire to a bar
// against Knight: 10 points over Knight's first-try clear rate on every level, every class but the Archer over half its Squire tries.

type Row = Omit<LevelRun, 'summary'>;
const row = (classId: Row['classId'], level: number, cleared: boolean): Row =>
  ({ classId, realm: 'ironHold', level, seed: 1, cleared, time: 60, loadout: [], power: null, relicsAtStart: 0, held: 0, duos: 0, sixes: 0, sixAt: null, moments: 0, pool: 1 });

describe("Squire eases a realm's levels, the later the more (#250)", () => {
  it("takes HP x0.85 to x0.7 and damage x0.85 to x0.75 from a realm's first level to its last", () => {
    expect(TIERS[0].realmEase).toEqual({ hp: [0.85, 0.7], damage: [0.85, 0.75] });
    expect([1, 2, 3, 4, 5].map((l) => tierStep(0, 'ironHold', l))).toEqual([
      { hp: 0.85, damage: 0.85 }, { hp: 0.813, damage: 0.825 }, { hp: 0.775, damage: 0.8 }, { hp: 0.737, damage: 0.775 }, { hp: 0.7, damage: 0.75 },
    ]);
    expect(tierStep(0, 'marches', 1)).toEqual({ hp: 0.85, damage: 0.85 });
    expect(tierStep(0, 'marches', 7)).toEqual({ hp: 0.7, damage: 0.75 });
  });

  it('leaves Knight and up, and the Last Bastion, as they were', () => {
    for (const t of [1, 2, 3]) {
      expect(TIERS[t].realmEase).toBeUndefined();
      for (let l = 1; l <= 5; l++) expect(tierStep(t, 'ironHold', l)).toEqual({ hp: 1, damage: 1 });
    }
    expect(tierStep(0, 'lastBastion', 1)).toEqual({ hp: 1, damage: 1 });
  });

  it('plays a Squire level at the HP and damage its panel shows; a plain Squire run takes no ease', () => {
    const g = createGame('paladin', 5, { tier: 0, level: { realm: 'ironHold', level: 4 } });
    const base = ringStep('ironHold').hp * levelStep('ironHold', 4).hp * championStep('ironHold', 4).hp;
    expect(g.tier.enemyHp).toBeCloseTo(base * 0.737, 5);
    expect(g.tier.enemyDmg).toBeCloseTo(ringStep('ironHold').damage * levelStep('ironHold', 4).damage * championStep('ironHold', 4).damage * 0.775, 5);
    expect(Math.round(g.tier.enemyHp * 100)).toBe(levelPanel({ marches: [7] }, 'ironHold', 4, 0).enemyHp);
    expect(createGame('paladin', 5, { tier: 0 }).tier.enemyHp).toBe(1);
    expect(createGame('paladin', 5, { tier: 0, realm: 'ironHold' }).tier.enemyHp).toBeCloseTo(ringStep('ironHold').hp);
  });

  it("shows Squire's Enemy HP on the road; Knight's stays", () => {
    const shown = (realm: 'marches' | 'ironHold' | 'cinderlands', n: number, tier: number) => Array.from({ length: n }, (_, i) => levelPanel({ marches: [7] }, realm, i + 1, tier).enemyHp);
    expect(shown('marches', 7, 0)).toEqual([34, 34, 39, 48, 54, 60, 45]); // were 40, 41, 49, 61, 72, 82, 64
    expect(shown('ironHold', 5, 0)).toEqual([197, 141, 127, 122, 109]); // were 231, 173, 164, 166, 156
    expect(shown('cinderlands', 5, 0)).toEqual([197, 141, 127, 122, 97]); // were 231, 173, 164, 166, 138
    expect(shown('marches', 7, 1)).toEqual([59, 60, 72, 89, 105, 119, 93]);
    expect(shown('ironHold', 5, 1)).toEqual([335, 251, 237, 240, 225]);
    expect(shown('cinderlands', 5, 1)).toEqual([335, 251, 237, 240, 200]);
  });
});

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
