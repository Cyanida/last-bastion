import { describe, expect, it } from 'vitest';
import { FAMILY_IDS, RELIC_IDS, RELIC_MOMENTS, RELIC_POOL, relicDef, type FamilyId, type RelicId } from '../src/config/relics';
import { mulberry32 } from '../src/core/math';
import { createGame } from '../src/game';
import { freshRelics, newChampion } from '../src/logic/champions';
import { championPool, familySets, isStarterRelic, lockedIn, relicCardLine, relicPoolFor, rollOffer, rollWithLocked, sixOpen } from '../src/logic/relics';
import { addRelic, familyOf, offerRelics, rerollRelicOffer } from '../src/systems/relics';

const of = (f: FamilyId, classId = 'viking') => relicPoolFor(classId as 'viking').filter((id) => relicDef(id).family === f);

describe('the pool follows the champion (#194, rule 5)', () => {
  it('starter commons and the three open relics, the inventory, and inside a realm its whole family', () => {
    const inv: RelicId[] = ['salamanderScale'];
    const out = championPool('viking', inv);
    expect(out.filter((id) => relicDef(id).rarity === 'common')).toEqual(relicPoolFor('viking').filter((id) => relicDef(id).rarity === 'common'));
    expect(out).toEqual(expect.arrayContaining([...RELIC_POOL.open, ...inv]));
    expect(out.every((id) => isStarterRelic(id) || inv.includes(id))).toBe(true);
    const realm = championPool('viking', inv, 'steel');
    expect(realm).toEqual(expect.arrayContaining(of('steel')));
    expect(lockedIn(realm, inv).every((id) => relicDef(id).family === 'steel' && relicDef(id).rarity !== 'common')).toBe(true);
    expect(lockedIn(out, inv)).toEqual([]); // outside a realm nothing is locked
  });

  it('a run without a champion keeps every relic its class may find (the Daily Trial, the sims)', () => {
    expect(createGame('angel', 1).player.relics.pool).toEqual(relicPoolFor('angel'));
  });

  it('one locked relic among the options while any is left, wherever the rest come from', () => {
    const pool = relicPoolFor('viking');
    const locked = of('flame').filter((id) => relicDef(id).rarity !== 'common');
    const rng = mulberry32(5);
    for (let i = 0; i < 200; i++) {
      const out = rollWithLocked(pool.filter((id) => relicDef(id).family === 'storm'), locked, [], rng, 3, familyOf);
      expect(out).toHaveLength(3);
      expect(out.filter((id) => locked.includes(id))).toHaveLength(1);
    }
    expect(rollWithLocked(pool, locked, locked, rng, 3, familyOf).some((id) => locked.includes(id))).toBe(false); // none left: a plain roll
  });

  it('a fresh relic is offered about three times as often', () => {
    const pool = relicPoolFor('viking').filter((id) => relicDef(id).rarity === 'common');
    const count = (fresh: RelicId[]) => {
      const rng = mulberry32(194);
      let n = 0;
      for (let i = 0; i < 3000; i++) if (rollOffer(pool, [], rng, 1, familyOf, 1, [], fresh)[0] === pool[0]) n++;
      return n;
    };
    expect(RELIC_MOMENTS.newRelicWeight).toBe(3);
    const ratio = count([pool[0]]) / count([]);
    expect(ratio).toBeGreaterThan(2.3);
    expect(ratio).toBeLessThan(3.2);
  });

  it('fresh relics are the inventory never picked, and the weight ends at the first pick', () => {
    const c = { ...newChampion('paladin'), inventory: ['salamanderScale', 'tempestEye'] as RelicId[] };
    expect(freshRelics(c, { salamanderScale: 2 })).toEqual(['tempestEye']);
    const g = createGame('paladin', 3, { inventory: c.inventory, fresh: ['tempestEye'] });
    addRelic(g, 'tempestEye');
    expect(g.player.relics.fresh).toEqual([]);
  });
});

describe('a level opens on a pick of its family, and realm bosses offer a locked relic (#194, rule 4)', () => {
  const level = { realm: 'marches' as const, level: 2 }; // featured: Flame
  it('the opening pick: three Flame relics, a locked one among them, in place of the Armorer and the Keepsake', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const g = createGame('viking', seed, { level, inventory: ['brimstoneOil'], meta: { startRelic: 1 }, classXp: 1e9 });
      const r = g.player.relics;
      expect(r.held).toEqual([]); // no Keepsake gift in a level: it is a slot
      expect(r.offers).toHaveLength(1);
      const [o] = r.offers;
      expect(o.from).toBe('start');
      expect(o.options).toHaveLength(3);
      expect(o.options.every((id) => relicDef(id).family === 'flame')).toBe(true);
      expect(o.options.some((id) => r.locked.includes(id))).toBe(true);
      const left = r.locked.filter((id) => !o.options.includes(id)); // a reroll never shows the cards it replaces
      expect(rerollRelicOffer(g)).toBe(true);
      if (left.length) expect(o.options.some((id) => left.includes(id))).toBe(true); // a reroll keeps the rule
    }
  });

  it('the same seed opens on the same pick (death restarts the level)', () => {
    const opts = { level, inventory: [] as RelicId[] };
    expect(createGame('angel', 9, opts).player.relics.offers[0].options).toEqual(createGame('angel', 9, opts).player.relics.offers[0].options);
  });

  it('a boss in a realm always offers one locked relic of its family, while any is left', () => {
    const g = createGame('viking', 4, { level, inventory: [] });
    const r = g.player.relics;
    r.offers = [];
    for (let i = 0; i < 20; i++) {
      offerRelics(g, 3, 'boss');
      const o = r.offers.pop()!;
      expect(o.options.some((id) => r.locked.includes(id) && relicDef(id).family === 'flame')).toBe(true);
    }
    for (const id of r.locked) addRelic(g, id);
    offerRelics(g, 3, 'boss');
    expect(r.offers.pop()!.options.length).toBeGreaterThan(0); // none left: a plain boss moment
  });
});

describe('one 6-set bonus per run (#194, rule 4)', () => {
  const six = (f: FamilyId) => RELIC_IDS.filter((id) => relicDef(id).family === f && !relicDef(id).classId).slice(0, 5);
  it('the first family to hold 6 keeps its 6 bonus; a second stops at 4', () => {
    const flame = [...six('flame'), RELIC_IDS.find((id) => relicDef(id).family === 'flame' && relicDef(id).classId)!];
    const frost = [...six('frost'), RELIC_IDS.find((id) => relicDef(id).family === 'frost' && relicDef(id).classId)!];
    expect(flame).toHaveLength(6);
    const sets = familySets([...frost.slice(0, 5), ...flame, frost[5]]);
    expect(sets.flame).toEqual({ count: 6, level: 6 });
    expect(sets.frost).toEqual({ count: 6, level: 4 });
    expect(sixOpen(sets, 'frost')).toBe(false);
    expect(sixOpen(sets, 'flame')).toBe(true);
    expect(sixOpen(familySets(flame.slice(0, 5)), 'frost')).toBe(true);
    expect(FAMILY_IDS.filter((f) => sets[f]?.level === 6)).toHaveLength(RELIC_MOMENTS.sixSets);
  });

  it('an offer card promises no 6 bonus another family has taken', () => {
    expect(relicCardLine('frostBrand', 5, { upgrade: false, duo: false, evolution: false })).toContain('★ set bonus');
    expect(relicCardLine('frostBrand', 5, { upgrade: false, duo: false, evolution: false, noSix: true })).not.toContain('★');
    expect(relicCardLine('frostBrand', 3, { upgrade: false, duo: false, evolution: false, noSix: true })).toContain('★ set bonus'); // the 4 still comes
  });
});
