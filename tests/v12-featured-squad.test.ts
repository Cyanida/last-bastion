import { describe, expect, it } from 'vitest';
import { REALMS, WORLD, type RealmId } from '../src/config/world';
import { directWave } from '../src/logic/director';
import { featuredFoes, featuredSquads, levelFields } from '../src/logic/world';

/** A level's waves as systems/spawning.ts asks the director for them (the parts #249 and #259 touch). */
function levelSquads(realm: RealmId, level: number, tier: number, seed: number): string[] {
  const [first, last] = REALMS[realm].levels[level - 1].waves;
  const featured = featuredSquads(realm, level, tier, seed);
  const out: string[] = [];
  for (let wave = first; wave <= last; wave++) {
    const plan = directWave({
      seed, wave, tier, fields: levelFields({ realm }), fieldsWeight: REALMS[realm].fieldsWeight, boss: wave === last,
      featured: featured.filter((f) => f.wave === wave).map((f) => f.template),
    });
    out.push(...plan.squads.map((s) => s.template));
  }
  return out;
}

describe('world: a level whose road features Iron Shieldwalls brings a squad of them (#259)', () => {
  it('Iron Hold levels 2-5 feature the Iron Shieldwall on every tier, and each brings its squad on a wave early in the level', () => {
    for (let tier = 0; tier < 4; tier++) {
      for (let level = 2; level <= 5; level++) {
        const waves = REALMS.ironHold.levels[level - 1].waves;
        expect(featuredFoes(waves, undefined, tier, 'ironHold')).toContain('shieldwall');
        for (let seed = 1; seed <= 50; seed++) {
          const f = featuredSquads('ironHold', level, tier, seed);
          expect(f.map((x) => x.template)).toEqual(['shieldwall']);
          const first = Math.max(waves[0], 9);
          expect(f[0].wave).toBeGreaterThanOrEqual(first);
          expect(f[0].wave).toBeLessThan(first + WORLD.featuredSquad.within);
        }
      }
    }
  });

  it('the wave is fixed per seed and spread over the first waves', () => {
    expect(featuredSquads('ironHold', 2, 0, 7)).toEqual(featuredSquads('ironHold', 2, 0, 7));
    const waves = new Set(Array.from({ length: 60 }, (_, s) => featuredSquads('ironHold', 2, 0, s + 1)[0].wave));
    expect([...waves].sort((a, b) => a - b)).toEqual([9, 10, 11]);
  });

  it('level 1 (before the squad marches), the Marches and the Cinderlands guarantee nothing', () => {
    expect(featuredSquads('ironHold', 1, 0, 1)).toEqual([]);
    expect(featuredSquads('marches', 3, 2, 1)).toEqual([]);
    expect(featuredSquads('cinderlands', 2, 0, 1)).toEqual([]);
  });

  it('every seed plays a shieldwall squad in Iron Hold levels 2-5 on Squire and Knight', () => {
    for (const tier of [0, 1])
      for (let level = 2; level <= 5; level++)
        for (let seed = 1; seed <= 40; seed++) expect(levelSquads('ironHold', level, tier, seed)).toContain('shieldwall');
  });

  it('the director puts a featured squad in its wave, out of the squad budget, the same for the same inputs', () => {
    const input = { seed: 3, wave: 10, tier: 0, fields: levelFields({ realm: 'ironHold' }), fieldsWeight: 0.25 };
    const plain = directWave(input);
    const sure = directWave({ ...input, featured: ['shieldwall'] });
    expect(sure.squads[0].template).toBe('shieldwall');
    expect(sure.units.filter((u) => u.id === 'shieldwall' && u.squad === 0)).toHaveLength(5);
    expect(sure.budget).toBe(plain.budget);
    expect(directWave({ ...input, featured: ['shieldwall'] })).toEqual(sure);
  });
});
