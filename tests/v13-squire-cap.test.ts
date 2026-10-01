import { describe, expect, it } from 'vitest';
import { TIERS } from '../src/config/economy';
import { createGame } from '../src/game';
import { capGap, championStep, expectedChampionLevel } from '../src/logic/championLevels';
import { levelPanel, levelStep, ringStep, tierStep } from '../src/logic/world';

// v0.13 (#263): a Squire champion stands at its crown cap (10 with the Marches crown) from a relic realm's level 3 on, so its levels 4
// and 5 bring no stat points while the level step keeps rising. Squire now eases a level by each champion level the cap holds it under
// what the level expects (TierDef.capEase), so its crown is a fair fight at the cap.

const rows = (n: number, f: (l: number) => number) => Array.from({ length: n }, (_, i) => f(i + 1));

describe('the champion levels the crown cap holds back (#263)', () => {
  it('is 0 until the cap binds, then the expected level over the cap', () => {
    expect(rows(7, (l) => capGap('marches', l))).toEqual([0, 0, 0, 0, 0, 1, 2]);
    expect(rows(5, (l) => capGap('ironHold', l))).toEqual([0, 0, 1, 2, 4]);
    expect(rows(5, (l) => capGap('cinderlands', l))).toEqual([0, 0, 1, 2, 4]);
    expect(rows(5, (l) => expectedChampionLevel('cinderlands', l))).toEqual([8, 9, 10, 10, 10]); // the cap of 10
  });
});

describe('Squire eases a level played at the cap (#263)', () => {
  it('takes 3% off enemy HP and damage per champion level held back, on Squire only', () => {
    expect(TIERS[0].capEase).toBe(0.03);
    for (const t of [1, 2, 3]) expect(TIERS[t].capEase).toBeUndefined();
    expect(rows(5, (l) => tierStep(0, 'cinderlands', l).hp)).toEqual([0.85, 0.813, 0.752, 0.693, 0.616]); // were 0.85 -> 0.7
    expect(rows(5, (l) => tierStep(0, 'cinderlands', l).damage)).toEqual([0.85, 0.825, 0.776, 0.728, 0.66]); // were 0.85 -> 0.75
    expect(tierStep(1, 'cinderlands', 5)).toEqual({ hp: 1, damage: 1 });
    expect(tierStep(0, 'lastBastion', 1)).toEqual({ hp: 1, damage: 1 });
  });

  it('plays the Cinderlands crown on Squire at the HP its panel shows; Knight stays', () => {
    const g = createGame('archer', 7, { tier: 0, level: { realm: 'cinderlands', level: 5 } });
    const base = (k: 'hp' | 'damage') => ringStep('cinderlands')[k] * levelStep('cinderlands', 5)[k] * championStep('cinderlands', 5)[k];
    expect(g.tier.enemyHp).toBeCloseTo(base('hp') * 0.616, 5);
    expect(g.tier.enemyDmg).toBeCloseTo(base('damage') * 0.66, 5);
    expect(Math.round(g.tier.enemyHp * 100)).toBe(levelPanel({ marches: [7] }, 'cinderlands', 5, 0).enemyHp);
    // the panel is the product of the steps (levelStep is tuned on its own, #262), so only Squire's ease is pinned here: 197, 132, 123, 110, 85 with #262's Knight step (were 127, 122, 97 at 3-5)
    const shown = (l: number, tier: number) => levelPanel({ marches: [7] }, 'cinderlands', l, tier).enemyHp;
    const steps = (l: number, tier: number) => Math.round(TIERS[tier].enemyHp * ringStep('cinderlands').hp * levelStep('cinderlands', l).hp * championStep('cinderlands', l).hp * tierStep(tier, 'cinderlands', l).hp * 100);
    expect(rows(5, (l) => shown(l, 0))).toEqual(rows(5, (l) => steps(l, 0)));
    expect(rows(5, (l) => shown(l, 1))).toEqual(rows(5, (l) => steps(l, 1))); // Knight takes no ease
    expect(shown(5, 0)).toBeLessThan((shown(5, 1) / TIERS[1].enemyHp) * 0.7 * 0.9); // the crown: Squire's old x0.7, less 12% for the cap's 4 levels
  });
});
