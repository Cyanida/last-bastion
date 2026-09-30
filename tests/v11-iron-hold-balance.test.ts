import { describe, expect, it } from 'vitest';
import { CHAMPION } from '../src/config/champion';
import { TIERS } from '../src/config/economy';
import { REALMS, WORLD } from '../src/config/world';
import type { Enemy, Game } from '../src/core/types';
import { createGame } from '../src/game';
import { championStep, expectedChampionLevel } from '../src/logic/championLevels';
import { expectedLevel } from '../src/logic/formulas';
import { levelPanel, levelStep, levelWaves } from '../src/logic/world';
import { updateSpawning } from '../src/systems/spawning';

// v0.11 (#220): the release's balance pass. Enemy scaling by champion level reads the pace at a level's end, the late levels step up
// (a realm run carries its relics on), and the elite end boss has numbers of its own.

describe('enemy scaling by champion level, as tuned (#220)', () => {
  const strength = (k: number, runLevels: number) => 1 + k * (runLevels - 1);

  it('reads the pace `at` of the way through the level: at its end', () => {
    const { perRunLevel: k, worth, at } = CHAMPION.scaling;
    expect(at).toBe(1);
    for (const [realm, level] of [['marches', 1], ['marches', 4], ['ironHold', 5]] as const) {
      const [first, last] = REALMS[realm].levels[level - 1].waves;
      const pace = expectedLevel(first) + (expectedLevel(last + 1) - expectedLevel(first)) * at;
      const want = strength(k, 1 + (expectedChampionLevel(realm, level) - 1) * CHAMPION.runLevels * worth) / strength(k, pace);
      expect(championStep(realm, level).hp).toBeCloseTo(want);
      expect(championStep(realm, level).damage).toBeCloseTo(want);
    }
  });

  it('eases the early Marches levels most: the step rises from level 1 to level 5, where the cap holds the champion', () => {
    const steps = [1, 2, 3, 4, 5, 6, 7].map((l) => championStep('marches', l).hp);
    for (let i = 1; i < 5; i++) expect(steps[i]).toBeGreaterThan(steps[i - 1]);
    expect(steps[5]).toBeLessThan(steps[4]); // level 5 all the way to the crown against later waves
    expect(steps[6]).toBeLessThan(steps[5]);
  });

  it('leaves the Last Bastion on its first fit (its own release tunes it)', () => {
    const f = CHAMPION.scaling.finale;
    expect(f).toEqual({ perRunLevel: 0.12, worth: 0.8, at: 0.5 });
    const mid = (expectedLevel(1) + expectedLevel(41)) / 2;
    expect(championStep('lastBastion', 1).hp).toBeCloseTo(strength(0.12, 1 + 29 * CHAMPION.runLevels * 0.8) / strength(0.12, mid));
  });
});

describe('the level step and wave length, as tuned (#220)', () => {
  it('never goes under its floor just over Squire, and the late levels step up from it', () => {
    for (const s of [WORLD.levelStep.marches, WORLD.levelStep.realm]) {
      expect(Math.min(...s.hp)).toBeGreaterThanOrEqual(0.72);
      expect(Math.min(...s.damage)).toBeGreaterThanOrEqual(0.82);
    }
    expect(levelStep('marches', 2)).toEqual({ hp: 0.72, damage: 0.82 });
    expect(levelStep('marches', 6).hp).toBeGreaterThan(levelStep('marches', 3).hp);
    expect(levelStep('ironHold', 5).hp).toBeGreaterThan(levelStep('ironHold', 3).hp);
    expect(levelStep('ironHold', 5).damage).toBeGreaterThan(levelStep('ironHold', 3).damage);
  });

  it('the level panel shows the Enemy HP a level plays at', () => {
    const shown = (realm: 'marches' | 'ironHold', level: number, tier: number) => levelPanel({ marches: [7] }, realm, level, tier).enemyHp;
    expect(shown('marches', 1, 1)).toBe(59);
    expect(shown('marches', 1, 0)).toBe(40);
    expect([1, 2, 3, 4, 5].map((l) => shown('ironHold', l, 1))).toEqual([335, 251, 237, 240, 225]);
    const g = createGame('viking', 3, { tier: 1, level: { realm: 'ironHold', level: 5 } });
    expect(Math.round(g.tier.enemyHp * 100)).toBe(225);
    expect(g.tier.enemyHp).toBeGreaterThan(TIERS[1].enemyHp); // a level-10 champion's foes are tougher than a plain run's
  });

  it('the Marches level 1 brings more foes over a longer time, to stay over its 4 minutes', () => {
    expect(levelWaves('marches', 1)).toEqual({ foes: 1.6, pace: 2.8 });
  });
});

describe('the elite end boss, as tuned (#220)', () => {
  const bossOf = (g: Game, wave: number): Enemy => {
    g.wave = g.wavesCleared = wave - 1;
    g.breather = 0.01;
    for (let i = 0; i < 4000 && !g.enemies.some((e) => e.def.boss); i++) updateSpawning(g, 0.05);
    return g.enemies.find((e) => e.def.boss)!;
  };

  it('has more HP and hits harder than its plain self at the same level', () => {
    expect(WORLD.eliteBoss).toEqual({ phases: 1, hp: 1.4, damage: 1.15 });
    const elite = bossOf(createGame('paladin', 11, { level: { realm: 'ironHold', level: 4 } }), 32);
    const was = { ...WORLD.eliteBoss };
    Object.assign(WORLD.eliteBoss, { hp: 1, damage: 1 }); // the same fight with its plain numbers
    try {
      const plain = bossOf(createGame('paladin', 11, { level: { realm: 'ironHold', level: 4 } }), 32);
      expect(elite.def.name).toBe('The Warden, Elite');
      expect(elite.maxHp / plain.maxHp).toBeCloseTo(1.4, 2);
      expect(elite.hp).toBe(elite.maxHp);
      expect(elite.damage / plain.damage).toBeCloseTo(1.15);
    } finally {
      Object.assign(WORLD.eliteBoss, was);
    }
  });

  it('leaves level 2’s plain Warden alone', () => {
    const was = { ...WORLD.eliteBoss };
    const a = bossOf(createGame('paladin', 11, { level: { realm: 'ironHold', level: 2 } }), 16);
    Object.assign(WORLD.eliteBoss, { hp: 3, damage: 3 });
    try {
      const b = bossOf(createGame('paladin', 11, { level: { realm: 'ironHold', level: 2 } }), 16);
      expect(b.maxHp).toBe(a.maxHp);
      expect(b.damage).toBe(a.damage);
    } finally {
      Object.assign(WORLD.eliteBoss, was);
    }
  });
});
