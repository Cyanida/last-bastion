import { describe, expect, it } from 'vitest';
import { RELICS } from '../src/config/relics';
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
  });
});
