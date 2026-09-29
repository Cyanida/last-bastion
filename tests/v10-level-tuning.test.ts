import { describe, expect, it } from 'vitest';
import { TIERS } from '../src/config/economy';
import { REALMS, WORLD } from '../src/config/world';
import { createGame } from '../src/game';
import { levelStep, ringStep } from '../src/logic/world';

/** #221: rule 9's tuning passes, the level step on enemies and the head start's late boons. */
describe('levels: the level step on enemies (#221)', () => {
  it('has a value for every Marches and relic realm level; the Last Bastion keeps 1', () => {
    expect(WORLD.levelStep.marches.hp).toHaveLength(REALMS.marches.levels.length);
    expect(WORLD.levelStep.marches.damage).toHaveLength(REALMS.marches.levels.length);
    expect(WORLD.levelStep.realm.hp).toHaveLength(REALMS.ironHold.levels.length);
    expect(WORLD.levelStep.realm.damage).toHaveLength(REALMS.ironHold.levels.length);
    expect(levelStep('lastBastion', 1)).toEqual({ hp: 1, damage: 1 });
    expect(levelStep('marches', 1)).toEqual({ hp: WORLD.levelStep.marches.hp[0], damage: WORLD.levelStep.marches.damage[0] });
    expect(levelStep('frozenPass', 5)).toEqual({ hp: WORLD.levelStep.realm.hp[4], damage: WORLD.levelStep.realm.damage[4] });
  });

  it('a tier step still outweighs it: every level on Knight is harder than the same level on Squire', () => {
    for (const realm of ['marches', 'ironHold', 'crimsonFields'] as const)
      for (let l = 1; l <= REALMS[realm].levels.length; l++) {
        const s = levelStep(realm, l), r = ringStep(realm);
        expect(TIERS[1].enemyHp * s.hp * r.hp).toBeGreaterThan(TIERS[0].enemyHp * r.hp);
        expect(TIERS[1].enemyDmg * s.damage * r.damage).toBeGreaterThan(TIERS[0].enemyDmg * r.damage);
      }
  });

  it('folds into a level run\'s tier with the ring step, and not into a run with no level', () => {
    const g = createGame('paladin', 3, { tier: 1, level: { realm: 'ironHold', level: 1 } });
    expect(g.tier.enemyHp).toBeCloseTo(TIERS[1].enemyHp * ringStep('ironHold').hp * levelStep('ironHold', 1).hp);
    expect(g.tier.enemyDmg).toBeCloseTo(TIERS[1].enemyDmg * ringStep('ironHold').damage * levelStep('ironHold', 1).damage);
    expect(createGame('paladin', 3, { tier: 1, realm: 'ironHold' }).tier.enemyHp).toBeCloseTo(TIERS[1].enemyHp * ringStep('ironHold').hp);
  });
});

describe('levels: the head start\'s late boons (#221)', () => {
  it('levels from lateFrom on give lateRarity boons, stronger than the rare ones before', () => {
    const at = () => createGame('paladin', 3, { tier: 1, level: { realm: 'marches', level: 4 } }).player; // a head start to level 15
    const hs = WORLD.headStart as { lateFrom: number };
    const late = at();
    const was = hs.lateFrom;
    hs.lateFrom = 99; // every boon rare, as before #221
    try {
      const rare = at();
      expect(late.level).toBe(rare.level);
      expect(late.stats.hp).toBeGreaterThan(rare.stats.hp);
      expect(late.stats.atkSpd).toBeGreaterThan(rare.stats.atkSpd);
    } finally {
      hs.lateFrom = was;
    }
    expect(WORLD.headStart.lateFrom).toBeGreaterThan(6); // Marches level 2 (a head start to level 6) keeps rare boons only
  });
});
