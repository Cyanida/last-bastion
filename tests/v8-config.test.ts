import { describe, expect, it } from 'vitest';
import { DUOS, FAMILIES, RELICS } from '../src/config/relics';
import { ADDITIVE, isMultiplicative, neutralMods } from '../src/logic/mods';
import type { Mods } from '../src/core/types';

// #117: one list of which mod keys multiply, and awakening numbers in config that their text is built from
describe('config cleanup (#117)', () => {
  it('every mod key is additive (neutral 0) or multiplicative (neutral 1), from the one list in logic/mods.ts', () => {
    for (const [key, v] of Object.entries(neutralMods()) as [keyof Mods, number][]) {
      expect(isMultiplicative(key), key).toBe(!ADDITIVE.has(key));
      expect(v, key).toBe(isMultiplicative(key) ? 1 : 0);
    }
  });

  it('an awakening with numbers states them in its text', () => {
    expect(RELICS.frostBrand.awaken).toMatchObject({ n: { reduce: 0.2 }, desc: 'Chilled enemies deal 20% less damage.' });
    expect(RELICS.glacialHeart.awaken.desc).toBe('Every freeze near you gives +20% attack speed for 2 s.');
    for (const r of Object.values(RELICS)) expect(r.awaken.n).toBeTypeOf('object');
    expect(RELICS.galeforceQuiver.awaken).toMatchObject({ n: { every: 10, jumps: 5 }, desc: 'Every 10th arrow is a lightning bolt that chains 5 times.' });
    expect(RELICS.wolfskin.awaken.desc).toBe('Bleeding enemies you kill during Rage give +5% attack speed for the rest of it (up to 25%).');
    expect(RELICS.unbreakable.awaken.desc).toBe('After it blocks, +50% armor for 4 s.');
  });

  it('duo text is built from its numbers, and Frost keeps its shared reach in config', () => {
    expect(DUOS.martyrsCovenant.desc).toBe('30% of the damage you take comes back as ward over 3 s.');
    expect(DUOS.rimeDead.desc).toContain('(up to 4)');
    expect(FAMILIES.frost.n.near).toBe(300);
    expect(RELICS.rimebow.n.time).toBe(3);
  });
});
