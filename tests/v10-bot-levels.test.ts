import { describe, expect, it } from 'vitest';
import { CLASS_ORDER } from '../src/config/classes';
import { RELIC_IDS, relicDef, SIGNATURE, type RelicId } from '../src/config/relics';
import { MARCHES_FAMILIES, REALMS } from '../src/config/world';
import { createGame } from '../src/game';
import { ownable, slotBlock, slotCost } from '../src/logic/champions';
import { botLoadout, expectedChampion, levelCell, levelOptions, minutesWithRetries, powerGap, powerOf, realmMinutes, type LevelRun } from '../src/sim/levels';

// v0.10 (#207): the bot fills loadout slots and plays realm levels with expected progress (src/sim/levels.ts)

describe('the bot fills its slots (#207)', () => {
  it('keeps to the slot rules for every class, slot count and realm', () => {
    for (const c of CLASS_ORDER)
      for (const finale of [false, true])
        for (let slots = 1; slots <= 6; slots++) {
          const loadout = botLoadout(c, [...RELIC_IDS], slots, 'steel', finale);
          expect(loadout.reduce((n, id) => n + slotCost(id), 0)).toBeLessThanOrEqual(slots);
          loadout.forEach((id, i) => expect(slotBlock(c, loadout.slice(0, i), id, slots, finale)).toBeNull());
          expect(loadout.every((id) => ownable(c, id))).toBe(true);
        }
  });

  it('fills every slot it can', () => {
    const loadout = botLoadout('viking', [...RELIC_IDS], 6, 'flame');
    expect(loadout.reduce((n, id) => n + slotCost(id), 0)).toBe(6);
  });

  it('slots its signature relic first, then builds on one family', () => {
    const inv: RelicId[] = ['anvilHeart', 'salamanderScale', 'thornMail', 'towerShield', SIGNATURE.relic.paladin];
    const loadout = botLoadout('paladin', inv, 4);
    expect(loadout[0]).toBe(SIGNATURE.relic.paladin);
    expect(loadout.slice(1).every((id) => relicDef(id).family === 'steel')).toBe(true);
  });

  it("leans to the level's featured family", () => {
    const inv: RelicId[] = ['anvilHeart', 'salamanderScale'];
    expect(botLoadout('angel', inv, 1, 'flame')).toEqual(['salamanderScale']);
    expect(botLoadout('angel', inv, 1, 'steel')).toEqual(['anvilHeart']);
  });

  it('gives the same loadout for the same inventory', () => {
    const inv = expectedChampion('necromancer', 'lastBastion', 1).inventory;
    expect(botLoadout('necromancer', inv, 5, undefined, true)).toEqual(botLoadout('necromancer', [...inv], 5, undefined, true));
  });
});

describe('expected progress (#207, plan rule 9)', () => {
  it('starts the Marches with an empty inventory', () => {
    expect(expectedChampion('paladin', 'marches', 1).inventory).toEqual([]);
  });

  it('has one rare of each earlier Marches family by level 7', () => {
    const inv = expectedChampion('archer', 'marches', 7).inventory;
    expect(inv.map((id) => relicDef(id).family)).toEqual(MARCHES_FAMILIES.slice(0, 6));
    expect(inv.every((id) => relicDef(id).rarity === 'rare')).toBe(true);
  });

  it('opens a relic realm with the Marches crowned: its signature relic too', () => {
    const c = expectedChampion('viking', 'ironHold', 1);
    expect(c.signature).toBe(true);
    expect(c.inventory).toContain(SIGNATURE.relic.viking);
    expect(c.inventory.length).toBe(8);
  });

  it('gains the realm family by its crown level, and only relics it may own', () => {
    for (const cls of CLASS_ORDER) {
      const inv = expectedChampion(cls, 'lastBastion', 1).inventory;
      expect(new Set(inv).size).toBe(inv.length);
      expect(inv.every((id) => ownable(cls, id))).toBe(true);
    }
    const before = expectedChampion('angel', 'ironHold', 1).inventory;
    const crown = expectedChampion('angel', 'ironHold', 5).inventory;
    expect(crown.filter((id) => relicDef(id).family === 'steel').length).toBeGreaterThan(before.filter((id) => relicDef(id).family === 'steel').length);
  });

  it('fills a level with the Keep’s extra slots when the options carry them', () => {
    const c = expectedChampion('paladin', 'ironHold', 5);
    const plain = levelOptions('paladin', c, 'ironHold', 5, 1).level!.relics!;
    const armorer = levelOptions('paladin', c, 'ironHold', 5, 1, 0, { meta: { startRelic: 1 } }).level!.relics!;
    expect(plain.reduce((n, id) => n + slotCost(id), 0)).toBeLessThanOrEqual(REALMS.ironHold.levels[4].slots);
    expect(armorer.reduce((n, id) => n + slotCost(id), 0)).toBeGreaterThan(plain.reduce((n, id) => n + slotCost(id), 0));
  });
});

describe('the levels table (#207)', () => {
  it('reads more power at a higher champion level (#238: no head start)', () => {
    const early = createGame('paladin', 1, { tier: 1, level: { realm: 'marches', level: 1 } });
    const late = createGame('paladin', 1, levelOptions('paladin', expectedChampion('paladin', 'marches', 7), 'marches', 7, 1));
    expect(late.player.level).toBe(5); // the cap before the Marches crown
    expect(powerOf(late)).toBeGreaterThan(powerOf(early) * 2);
  });

  it('counts retries as the failed tries a clear rate implies', () => {
    expect(minutesWithRetries({ clear: 1, minutes: 4, failMinutes: 0 })).toBe(4);
    expect(minutesWithRetries({ clear: 0.5, minutes: 4, failMinutes: 2 })).toBe(6);
    expect(minutesWithRetries({ clear: 0, minutes: 0, failMinutes: 2 })).toBe(Infinity);
    const t = realmMinutes([{ clear: 1, minutes: 4, failMinutes: 0 }, { clear: 0.5, minutes: 8, failMinutes: 4 }]);
    expect(t).toEqual({ clean: 12, retries: 16 });
    expect(powerGap(115, 100)).toBeCloseTo(0.15);
  });

  it('sums up a level from its runs', () => {
    const run = (cleared: boolean, time: number, duos: number): Omit<LevelRun, 'summary'> => ({
      classId: 'paladin', realm: 'marches', level: 7, seed: 1, cleared, time, loadout: [], power: 100, relicsAtStart: 5, held: 8, duos, sixes: cleared ? 1 : 0, sixAt: cleared ? 35 : null, moments: 4, pool: 20,
    });
    const c = levelCell([run(true, 480, 1), run(true, 600, 3), run(false, 120, 0), run(false, 240, 0)]);
    expect(c).toMatchObject({ runs: 4, clear: 0.5, minutes: 9, failMinutes: 3, power: 100, moments: 0.2, sixes: 1, duos: 2, duos3: 0.5, sixEarly: 0 });
  });
});
