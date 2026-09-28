import { describe, expect, it } from 'vitest';
import { BOSSES } from '../src/config/bosses';
import { TIERS } from '../src/config/economy';
import { FAMILY_IDS, RELIC_IDS, relicDef, type RelicId } from '../src/config/relics';
import { MARCHES_FAMILIES, REALM_IDS, REALMS, WORLD, WORLD_BOSSES, type RealmId } from '../src/config/world';
import { clearRewards, crownedRealms, isCrowned, keepLockedOptions, levelOpen, realmOpen, recordClear, ringStep, slotsFor, tierOpen, type WorldProgress } from '../src/logic/world';

const KNIGHT = 1;
/** Crown each realm on `tier`, level by level. */
const crown = (tier: number, ...realms: RealmId[]): WorldProgress =>
  realms.reduce<WorldProgress>((p, r) => REALMS[r].levels.reduce((q, _, i) => recordClear(q, r, i + 1, tier), p), {});

describe('world data (#190)', () => {
  it('the Marches, seven relic realms (one per family) and the Last Bastion, in their rings', () => {
    expect(REALM_IDS).toHaveLength(9);
    const relic = REALM_IDS.filter((r) => REALMS[r].family);
    expect(relic.map((r) => REALMS[r].family).sort()).toEqual([...FAMILY_IDS].sort());
    expect(relic.map((r) => REALMS[r].ring)).toEqual([2, 2, 2, 3, 3, 4, 4]);
    expect([REALMS.marches.ring, REALMS.lastBastion.ring]).toEqual([1, 5]);
    expect(REALMS.ironHold.opens).toEqual({ crowns: 1 });
    expect(REALMS.frozenPass.opens).toEqual({ crowns: 2 });
    expect(REALMS.hallowedReach.opens).toEqual({ crowns: 4 });
    expect(REALMS.lastBastion.opens).toEqual({ crowns: 5, fromRing: [3, 1] });
  });

  it('levels cover waves 1-40 without gaps; slots and starting tiers follow rule 4', () => {
    for (const r of REALM_IDS) {
      const lv = REALMS[r].levels;
      expect(lv[0].waves[0]).toBe(1);
      expect(lv[lv.length - 1].waves[1]).toBe(40);
      lv.slice(1).forEach((l, i) => expect(l.waves[0]).toBe(lv[i].waves[1] + 1));
    }
    expect(REALMS.ironHold.levels.map((l) => l.waves)).toEqual([[1, 5], [6, 10], [11, 20], [21, 30], [31, 40]]);
    expect(REALMS.ironHold.levels.map((l) => l.slots)).toEqual([1, 2, 3, 4, 5]);
    expect(REALMS.ironHold.levels.map((l) => l.relicTier)).toEqual([1, 1, 1, 2, 2]);
    expect(REALMS.marches.levels.map((l) => l.slots)).toEqual([1, 1, 2, 2, 3, 3, 4]);
    expect(REALMS.marches.levels.map((l) => l.relicTier)).toEqual([1, 1, 1, 1, 2, 2, 2]);
    expect(REALMS.marches.levels.map((l) => l.family)).toEqual(MARCHES_FAMILIES);
    expect(new Set(MARCHES_FAMILIES).size).toBe(7);
    expect(REALMS.lastBastion.levels).toMatchObject([{ waves: [1, 40], slots: 5, relicTier: 1 }]);
  });

  it('end bosses: pool, first, new, first as an elite, crown; every boss exists or is a planned one', () => {
    expect(REALMS.ironHold.levels.map((l) => l.boss)).toEqual([
      { boss: 'pool' }, { boss: 'warden' }, { boss: 'forgemaster' }, { boss: 'warden', elite: true }, { boss: 'ironKing', crown: true },
    ]);
    expect(REALMS.marches.levels[6].boss).toEqual({ boss: 'warden', crown: true });
    for (const r of REALM_IDS) for (const { boss } of REALMS[r].levels) {
      expect(boss.boss === 'pool' || boss.boss === 'usurper' || boss.boss in BOSSES || boss.boss in WORLD_BOSSES, `${r}: ${boss.boss}`).toBe(true);
    }
  });

  it('one tier step outweighs the whole ring ladder', () => {
    expect(ringStep('marches')).toEqual({ hp: 1, damage: 1 });
    expect(ringStep('lastBastion')).toEqual({ hp: 1.28, damage: 1.16 });
    for (let t = 1; t < TIERS.length; t++) {
      expect(TIERS[t].enemyHp / TIERS[t - 1].enemyHp).toBeGreaterThan(ringStep('lastBastion').hp);
      expect(TIERS[t].enemyDmg / TIERS[t - 1].enemyDmg).toBeGreaterThan(ringStep('lastBastion').damage);
    }
  });
});

describe('world logic (#190)', () => {
  it('only the Marches is open at first; its crown opens ring 2', () => {
    expect(REALM_IDS.filter((r) => realmOpen({}, r))).toEqual(['marches']);
    const p = crown(0, 'marches'); // a Squire crown counts
    expect(REALM_IDS.filter((r) => realmOpen(p, r)).sort()).toEqual(['barrowvale', 'cinderlands', 'ironHold', 'marches']);
  });

  it('ring 3 at 2 crowns, ring 4 at 4, the Last Bastion at 5 with one from ring 3', () => {
    expect(realmOpen(crown(KNIGHT, 'marches', 'ironHold'), 'frozenPass')).toBe(true);
    const four = crown(KNIGHT, 'marches', 'ironHold', 'barrowvale', 'cinderlands');
    expect(realmOpen(four, 'hallowedReach')).toBe(true);
    expect(realmOpen(crown(KNIGHT, 'marches', 'ironHold', 'barrowvale'), 'hallowedReach')).toBe(false);
    expect(realmOpen({ ...four, ...crown(KNIGHT, 'hallowedReach') }, 'lastBastion')).toBe(false); // five, none from ring 3
    const five = { ...four, ...crown(KNIGHT, 'frozenPass') };
    expect(crownedRealms(five)).toHaveLength(5);
    expect(realmOpen(five, 'lastBastion')).toBe(true);
  });

  it('levels open in order per tier; a higher tier clear counts for the lower ones', () => {
    let p: WorldProgress = {};
    expect(levelOpen(p, 'marches', 1, 0)).toBe(true);
    expect(levelOpen(p, 'marches', 2, 0)).toBe(false);
    p = recordClear(p, 'marches', 1, KNIGHT);
    expect(levelOpen(p, 'marches', 2, 0)).toBe(true);
    expect(levelOpen(p, 'marches', 2, KNIGHT)).toBe(true);
    p = recordClear({}, 'marches', 1, 0);
    expect(levelOpen(p, 'marches', 2, KNIGHT)).toBe(false);
    expect(levelOpen(p, 'marches', 8, 0)).toBe(false);
  });

  it('Champion opens with the Knight crown, Legend with the Champion crown, per realm', () => {
    expect(tierOpen({}, 'marches', 0) && tierOpen({}, 'marches', KNIGHT)).toBe(true);
    expect(tierOpen(crown(0, 'marches'), 'marches', 2)).toBe(false);
    const p = crown(KNIGHT, 'marches');
    expect(tierOpen(p, 'marches', 2)).toBe(true);
    expect(tierOpen(p, 'marches', 3)).toBe(false);
    expect(tierOpen(p, 'ironHold', 2)).toBe(false);
    expect(tierOpen(crown(2, 'marches'), 'marches', 3)).toBe(true);
  });

  it('slots: Armorer and Keepsake add one each, up to 6', () => {
    expect(slotsFor('marches', 1)).toBe(1);
    expect(slotsFor('ironHold', 3, 2)).toBe(5);
    expect(slotsFor('ironHold', 5, 2)).toBe(WORLD.maxSlots);
    expect(slotsFor('lastBastion', 1, 1)).toBe(6);
  });

  it('first-clear rewards come once; crown rewards once per tier', () => {
    expect(clearRewards({}, 'marches', 1, 0).level).toEqual([{ kind: 'rarePick', family: 'steel', of: 2 }]);
    expect(clearRewards(recordClear({}, 'marches', 1, 0), 'marches', 1, KNIGHT).level).toEqual([]);
    expect(clearRewards({ marches: [6] }, 'marches', 7, 0).crown).toEqual([{ kind: 'signature' }]);
    expect(clearRewards(crown(0, 'marches'), 'marches', 7, KNIGHT).crown).toEqual([]); // the signature came with the Squire crown
    expect(clearRewards(crown(2, 'marches'), 'marches', 7, 3).crown).toEqual([{ kind: 'title' }, { kind: 'palette' }]);

    const hold = (tier: number) => clearRewards(tier ? crown(tier - 1, 'ironHold') : { ironHold: [4] }, 'ironHold', 5, tier).crown;
    expect(hold(0)).toEqual([]);
    expect(hold(KNIGHT)).toEqual([{ kind: 'legendaryPick' }]);
    expect(hold(2)).toEqual([{ kind: 'legendaryOther' }]);
    expect(hold(3)).toEqual([{ kind: 'title' }, { kind: 'palette' }]);
    expect(REALMS.ironHold.levels.map((l) => l.reward?.kind)).toEqual(['keepLocked', 'keepLocked', 'classRelic', 'keepLocked', undefined]);
  });

  it('keepLocked offers locked relics of the families held; none held offers nothing (Runes instead)', () => {
    const steel = RELIC_IDS.filter((id) => relicDef(id).family === 'steel');
    const flame = RELIC_IDS.filter((id) => relicDef(id).family === 'flame');
    const locked: RelicId[] = [...steel.slice(1), ...flame];
    expect(keepLockedOptions([steel[0]], locked)).toEqual(steel.slice(1));
    expect(keepLockedOptions([], locked)).toEqual([]);
    expect(WORLD.keepLockedRunes).toBeGreaterThan(0);
  });

  it('isCrowned by tier', () => {
    const p = crown(KNIGHT, 'marches');
    expect([isCrowned(p, 'marches'), isCrowned(p, 'marches', KNIGHT), isCrowned(p, 'marches', 2)]).toEqual([true, true, false]);
  });
});
