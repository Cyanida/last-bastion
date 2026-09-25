import { describe, expect, it } from 'vitest';
import { SQUADS } from '../src/config/director';
import { TIERS } from '../src/config/economy';
import { ENEMIES } from '../src/config/enemies';
import { WAVES } from '../src/config/waves';
import { directWave, squadOnTier } from '../src/logic/director';
import { tierAllows, unlockedPool } from '../src/logic/waves';

// #101: each difficulty fields its own enemy types and every lower tier's
describe('enemy types per difficulty', () => {
  const pool = (tier?: number) => unlockedPool(40, null, tier).map((p) => p.value);

  it('has a roster row per tier, with regular enemies only, each type once', () => {
    expect(WAVES.tierRoster.length).toBe(TIERS.length);
    const all = WAVES.tierRoster.flat();
    expect(new Set(all).size).toBe(all.length);
    for (const id of all) expect(ENEMIES[id].boss ?? false).toBe(false);
  });

  it('Squire is more than peasants but not everything; each tier adds types; Legend has the full pool', () => {
    const sizes = TIERS.map((_, t) => WAVES.tierRoster.flat().filter((id) => tierAllows(id, t)).length); // pool and squad-only types
    expect(pool(0).length).toBeGreaterThan(3);
    for (let t = 1; t < sizes.length; t++) expect(sizes[t]).toBeGreaterThan(sizes[t - 1]);
    expect(pool(TIERS.length - 1)).toEqual(pool());
    expect(pool(0)).not.toContain('siegeTower');
    expect(pool(0)).toContain('peasant');
  });

  it('types in no list (commanders, bosses) are on every tier', () => {
    expect(tierAllows('bannerman', 0)).toBe(true);
    expect(tierAllows('blackKnight', 0)).toBe(true);
    expect(tierAllows('mirrorKnight', 0)).toBe(false);
    expect(tierAllows('mirrorKnight', 1)).toBe(true);
  });

  it('squads need every member on the tier', () => {
    const crusade = SQUADS.find((t) => t.id === 'crusade')!; // brings a Mirror Knight
    expect(squadOnTier(crusade, 0)).toBe(false);
    expect(squadOnTier(crusade, 1)).toBe(true);
    const wall = SQUADS.find((t) => t.id === 'shieldwall')!;
    expect(squadOnTier(wall, 1)).toBe(false);
    expect(squadOnTier(wall, 2)).toBe(true);
    expect(squadOnTier(SQUADS.find((t) => t.id === 'levy')!, 0)).toBe(true);
  });

  it('the director spawns nothing the tier does not field (the boss aside)', () => {
    for (let tier = 0; tier < TIERS.length; tier++) {
      for (let wave = 1; wave <= 40; wave++) {
        const plan = directWave({ seed: 7, wave, tier });
        for (const u of plan.units) if (u.id !== plan.boss) expect(tierAllows(u.id, tier), `${u.id} on tier ${tier}, wave ${wave}`).toBe(true);
      }
    }
  });
});
