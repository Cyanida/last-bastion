import { describe, expect, it } from 'vitest';
import { ARENAS, type ArenaId } from '../src/config/arenas';
import { CLASSES, type ClassId } from '../src/config/classes';
import { ARENA_FAMILIES, FAMILY_IDS, preferredFamilies, relicDef, type RelicId } from '../src/config/relics';
import { createGame } from '../src/game';
import { familyPool, relicPoolFor } from '../src/logic/relics';
import { offerRelics, rerollRelicOffer } from '../src/systems/relics';

const inFamilies = (ids: RelicId[], fams: string[]) => ids.every((id) => relicDef(id).cursed || fams.includes(relicDef(id).family!));

describe('#100: arenas drop only their families at a boss', () => {
  it('every family is some arena\'s, and each arena has three', () => {
    const all = new Set(Object.values(ARENA_FAMILIES).flat());
    expect([...all].sort()).toEqual([...FAMILY_IDS].sort());
    for (const id of Object.keys(ARENA_FAMILIES) as ArenaId[]) expect(new Set(ARENA_FAMILIES[id]).size).toBe(3);
  });

  it('a boss moment and its rerolls offer only the arena\'s families; other moments stay open', () => {
    for (const arena of Object.keys(ARENAS) as ArenaId[]) {
      const g = createGame('paladin', 7, { arena });
      const rel = g.player.relics;
      rel.offers = [];
      for (let i = 0; i < 30; i++) {
        offerRelics(g, 3, 'boss');
        const o = rel.offers[0];
        expect(o.families).toEqual(ARENA_FAMILIES[arena]);
        expect(inFamilies(o.options, ARENA_FAMILIES[arena])).toBe(true);
        rerollRelicOffer(g);
        expect(inFamilies(o.options, ARENA_FAMILIES[arena])).toBe(true);
        rel.offers = [];
      }
      const seen = new Set<string>();
      for (let i = 0; i < 60; i++) {
        offerRelics(g, 3, 'lair');
        expect(rel.offers[0].families).toBeUndefined();
        rel.offers[0].options.forEach((id) => seen.add(relicDef(id).family ?? ''));
        rel.offers = [];
      }
      expect(FAMILY_IDS.every((f) => seen.has(f))).toBe(true);
    }
  });

  it('falls back to the whole pool when the families run dry, so a pick is always full', () => {
    const pool = relicPoolFor('paladin', []);
    const held = pool.filter((id) => ['flame', 'holy', 'steel'].includes(relicDef(id).family!));
    expect(familyPool(pool, held, ['flame', 'holy', 'steel'], 3)).toBe(pool);
    expect(familyPool(pool, [], ['flame'], 3).every((id) => relicDef(id).family === 'flame')).toBe(true);
  });

  it('every class can still find all six relics of each preferred family (other moments are open)', () => {
    for (const cls of Object.keys(CLASSES) as ClassId[]) {
      const pool = relicPoolFor(cls, []);
      for (const f of preferredFamilies(cls)) expect(pool.filter((id) => relicDef(id).family === f).length).toBeGreaterThanOrEqual(6);
    }
  });

  it('the same seed offers the same boss relics (Daily Trial)', () => {
    const run = () => {
      const g = createGame('archer', 42, { arena: 'keep' });
      g.player.relics.offers = [];
      offerRelics(g, 3, 'boss');
      rerollRelicOffer(g);
      return g.player.relics.offers[0].options.join();
    };
    expect(run()).toBe(run());
  });
});
