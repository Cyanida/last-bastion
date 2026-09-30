import { describe, expect, it } from 'vitest';
import { SQUADS } from '../src/config/director';
import { TIERS } from '../src/config/economy';
import type { EnemyId } from '../src/config/enemies';
import { REALM_IDS, REALMS } from '../src/config/world';
import { directWave, squadOnTier } from '../src/logic/director';
import { tierAllows } from '../src/logic/waves';
import { featuredFoes, levelFields, levelPanel } from '../src/logic/world';

// #249: the Iron Hold's shieldwall squads march on every difficulty, and the road features only foes the chosen tier fields there
const SQUIRE = 0, KNIGHT = 1;
const wall = SQUADS.find((t) => t.id === 'shieldwall')!;
const iron = levelFields({ realm: 'ironHold' });

/** Shieldwall spearmen the director sends over waves `from`-`to` of a few seeds, on `tier`, with the run's `fields`. */
function walls(tier: number, fields: readonly EnemyId[] | undefined, from = 9, to = 40): number {
  let n = 0;
  for (let seed = 1; seed <= 6; seed++)
    for (let wave = from; wave <= to; wave++) n += directWave({ seed, wave, tier, fields }).units.filter((u) => u.id === 'shieldwall').length;
  return n;
}

describe('the Iron Hold fields its shieldwalls on every tier (#249)', () => {
  it("the Iron Hold's levels field the shieldwall; the Marches, the Last Bastion and a plain run keep the tier roster", () => {
    expect(iron).toContain('shieldwall');
    expect(levelFields({ realm: 'marches' })).toBeUndefined();
    expect(levelFields({ realm: 'lastBastion' })).toBeUndefined();
    expect(levelFields(null)).toBeUndefined();
    for (const t of [SQUIRE, KNIGHT]) {
      expect(tierAllows('shieldwall', t)).toBe(false);
      expect(tierAllows('shieldwall', t, iron)).toBe(true);
      expect(squadOnTier(wall, t)).toBe(false);
      expect(squadOnTier(wall, t, iron)).toBe(true);
    }
    expect(tierAllows('mirrorKnight', SQUIRE, iron)).toBe(false); // only its own foes, not every tier's
  });

  it('the director sends shieldwall squads in the Iron Hold on Squire and Knight, and none outside it', () => {
    for (const t of [SQUIRE, KNIGHT]) {
      expect(walls(t, iron)).toBeGreaterThan(0);
      expect(walls(t, undefined)).toBe(0);
    }
    expect(walls(SQUIRE, iron, 1, 8)).toBe(0); // the squad's own first wave (9) still holds: level 1 teaches the knights
  });

  it('outside the Iron Hold the waves are what they were', () => {
    for (const wave of [9, 20, 33]) expect(directWave({ seed: 3, wave, tier: SQUIRE, fields: undefined })).toEqual(directWave({ seed: 3, wave, tier: SQUIRE }));
  });
});

describe("the road's featured foes follow the chosen tier (#249)", () => {
  it('every featured foe of every level is one its tier fields there', () => {
    for (const realm of REALM_IDS)
      REALMS[realm].levels.forEach((lv, i) => {
        for (let t = 0; t < TIERS.length; t++)
          for (const id of featuredFoes(lv.waves, 3, t, realm)) expect(tierAllows(id, t, REALMS[realm].fields), `${id}: ${realm} ${i + 1} on tier ${t}`).toBe(true);
      });
  });

  it('Squire: no Mirror Knight in the Iron Hold, no Hound Master in the Marches; its Iron Shieldwall from level 2', () => {
    const foes = (realm: 'ironHold' | 'marches', level: number, tier: number) => levelPanel({ marches: [7] }, realm, level, tier).foes;
    for (const level of [2, 3, 4, 5]) {
      expect(foes('ironHold', level, SQUIRE)).not.toContain('Mirror Knight');
      expect(foes('ironHold', level, SQUIRE)).toContain('Iron Shieldwall');
      expect(foes('ironHold', level, KNIGHT)).toContain('Iron Shieldwall');
    }
    expect(foes('marches', 2, SQUIRE)).not.toContain('Hound Master');
    expect(foes('marches', 2, KNIGHT)).toContain('Hound Master');
  });

  it("the realm's own foes come first, at most three, never empty", () => {
    expect(featuredFoes([9, 16], 3, SQUIRE, 'ironHold')[0]).toBe('shieldwall');
    for (let t = 0; t < TIERS.length; t++)
      for (const lv of REALMS.ironHold.levels) {
        const foes = featuredFoes(lv.waves, 3, t, 'ironHold');
        expect(foes.length).toBeGreaterThan(0);
        expect(foes.length).toBeLessThanOrEqual(3);
      }
    expect(featuredFoes([1, 8], 3, SQUIRE, 'ironHold')).toEqual(expect.arrayContaining(['knight', 'shieldBearer'])); // level 1: the Iron Knight and the Thorn Bearer
  });
});
