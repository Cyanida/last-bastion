import { describe, expect, it } from 'vitest';
import { INQUISITOR } from '../src/config/bosses';
import { ENEMY_STATUS } from '../src/config/damage';
import { ENEMIES } from '../src/config/enemies';
import { REALMS, WORLD } from '../src/config/world';
import type { Enemy, Game } from '../src/core/types';
import { createGame } from '../src/game';
import { levelPanel, levelStep, levelWaves } from '../src/logic/world';
import { levelCell, simulateRealm } from '../src/sim/levels';
import { updateSpawning } from '../src/systems/spawning';

// v0.12 (#232): the release's balance pass. The Cinderlands have level steps and wave lengths of their own (the Iron Hold and the realms
// still to come keep a relic realm's), the Cinder Colossus is eased, and the sim's rows say where a first try fell.

describe('the Cinderlands\' own level steps and wave lengths, as tuned (#232)', () => {
  it('takes its own steps: level 1 eased, level 3 hitting a little harder, the crown level eased most', () => {
    expect(WORLD.levelStep.own.cinderlands).toEqual({ hp: [0.77, 0.72, 0.83, 0.95, 0.95], damage: [0.85, 0.82, 0.98, 1.08, 0.95] }); // #262: levels 2 and 4 eased
    expect([1, 2, 3, 4, 5].map((l) => levelStep('cinderlands', l))).toEqual([
      { hp: 0.77, damage: 0.85 }, { hp: 0.72, damage: 0.82 }, { hp: 0.83, damage: 0.98 }, { hp: 0.95, damage: 1.08 }, { hp: 0.95, damage: 0.95 },
    ]);
    for (const s of Object.values(WORLD.levelStep.own)) {
      expect(s.hp).toHaveLength(5);
      expect(s.damage).toHaveLength(5);
      expect(Math.min(...s.hp)).toBeGreaterThanOrEqual(0.72); // never under the floor just over Squire (#220)
      expect(Math.min(...s.damage)).toBeGreaterThanOrEqual(0.82);
    }
  });

  it('brings more foes over a longer time in its levels 2-4', () => {
    expect([1, 2, 3, 4, 5].map((l) => levelWaves('cinderlands', l))).toEqual([
      { foes: 1.6, pace: 2 }, { foes: 1.2, pace: 1.65 }, // #262: level 2 brings fewer foes (was 1.3)
      { foes: 1.25, pace: 1.7 }, { foes: 1.05, pace: 2 }, { foes: 0.9, pace: 2.2 },
    ]);
    for (const w of Object.values(WORLD.levelWaves.own)) expect([w.foes.length, w.pace.length]).toEqual([5, 5]);
  });

  it('leaves the Iron Hold, and every realm with no steps of its own, on a relic realm\'s', () => {
    for (const realm of ['ironHold', 'frozenPass', 'stormspire'] as const) // #293: the Barrowvale has steps of its own now
      for (let l = 1; l <= 5; l++) {
        expect(levelStep(realm, l)).toEqual({ hp: WORLD.levelStep.realm.hp[l - 1], damage: WORLD.levelStep.realm.damage[l - 1] });
        expect(levelWaves(realm, l)).toEqual({ foes: WORLD.levelWaves.realm.foes[l - 1], pace: WORLD.levelWaves.realm.pace[l - 1] });
      }
    expect(WORLD.levelStep.realm).toEqual({ hp: [0.77, 0.77, 0.83, 0.99, 1.07], damage: [0.92, 0.86, 0.93, 1.12, 1.23] });
    expect(WORLD.levelWaves.realm).toEqual({ foes: [1.6, 1.2, 1.1, 0.95, 0.9], pace: [2, 1.5, 1.5, 1.8, 2.2] });
    expect(levelStep('lastBastion', 1)).toEqual({ hp: 1, damage: 1 });
    expect(levelWaves('lastBastion', 1)).toEqual({ foes: 1, pace: 1 });
  });

  it('the level panel shows the Enemy HP a Cinderlands level plays at', () => {
    const shown = (realm: 'ironHold' | 'cinderlands', level: number) => levelPanel({ marches: [7] }, realm, level, 1).enemyHp;
    expect([1, 2, 3, 4, 5].map((l) => shown('cinderlands', l))).toEqual([335, 235, 237, 230, 200]); // #262: levels 2 and 4 eased
    expect([1, 2, 3, 4, 5].map((l) => shown('ironHold', l))).toEqual([335, 251, 237, 240, 225]); // as #220 left it
    const g = createGame('viking', 3, { tier: 1, level: { realm: 'cinderlands', level: 5 } });
    expect(Math.round(g.tier.enemyHp * 100)).toBe(200);
  });
});

describe('the Cinderlands\' bosses, as measured and tuned (#232)', () => {
  const bossOf = (g: Game, wave: number): Enemy => {
    g.wave = g.wavesCleared = wave - 1;
    g.breather = 0.01;
    for (let i = 0; i < 4000 && !g.enemies.some((e) => e.def.boss); i++) updateSpawning(g, 0.05);
    return g.enemies.find((e) => e.def.boss)!;
  };

  it('the Cinder Colossus hits less hard, his burn and his fires are cooler; his HP and his phases stay', () => {
    const c = ENEMIES.cinderColossus;
    expect([c.hp, c.damage, c.poolDps, c.phases]).toEqual([1200, 18, 8, 3]);
    expect(ENEMY_STATUS.cinderColossus).toMatchObject({ id: 'burn', stacks: 2, power: 2.2 }); // still two stacks a hit: three hits and you are at the cap
    expect(ENEMY_STATUS.cinderColossus!.power!).toBeGreaterThan(ENEMY_STATUS.emberQueen!.power!); // and still the hottest burn of the realm
  });

  it('the Ember Queen and the Inquisitor\'s Auto-da-fé keep their numbers: neither cost the bot a first try', () => {
    expect([ENEMIES.emberQueen.hp, ENEMIES.emberQueen.damage]).toEqual([1050, 22]);
    expect(INQUISITOR.pyre).toEqual({ life: 2.5, dps: 8 });
  });

  it('level 4\'s Grand Inquisitor comes as an elite: 1.4 times the HP, hitting 1.15 times as hard, a phase more', () => {
    expect(WORLD.eliteBoss).toEqual({ phases: 1, hp: 1.4, damage: 1.15 });
    const elite = bossOf(createGame('paladin', 11, { level: { realm: 'cinderlands', level: 4 } }), 32);
    const plain = bossOf(createGame('paladin', 11, { level: { realm: 'cinderlands', level: 2 } }), 16);
    expect(elite.def.name).toBe('The Grand Inquisitor, Elite');
    expect(elite.def.phases).toBe((plain.def.phases ?? 2) + 1);
    const was = { ...WORLD.eliteBoss };
    Object.assign(WORLD.eliteBoss, { hp: 1, damage: 1 }); // the same fight with his plain numbers
    try {
      const same = bossOf(createGame('paladin', 11, { level: { realm: 'cinderlands', level: 4 } }), 32);
      expect(elite.maxHp / same.maxHp).toBeCloseTo(1.4, 2);
      expect(elite.damage / same.damage).toBeCloseTo(1.15);
    } finally {
      Object.assign(WORLD.eliteBoss, was);
    }
  });
});

describe('the sim says where a first try fell (#232)', () => {
  it('a row names the wave of the fall and whether the end boss stood; a clear names neither', () => {
    const rows = simulateRealm('archer', 1000, 'cinderlands', 1, 0, 20 * 60, 1);
    expect(rows).toHaveLength(1);
    const [r] = rows;
    expect(r.realm).toBe('cinderlands');
    if (r.cleared) expect([r.fellWave, r.fellBoss]).toEqual([null, false]);
    else {
      expect(r.fellWave).toBeGreaterThanOrEqual(1);
      expect(r.fellWave).toBeLessThanOrEqual(REALMS.cinderlands.levels[0].waves[1]);
    }
    expect(r.bossSeconds === null || r.bossSeconds! >= 0).toBe(true);
    expect(levelCell(rows).runs).toBe(1);
  }, 120_000);
});
