import { describe, expect, it } from 'vitest';
import { GRAVE_HANDS } from '../src/config/arenas';
import { ENEMIES } from '../src/config/enemies';
import { WORLD } from '../src/config/world';
import type { Enemy, Game } from '../src/core/types';
import { createGame } from '../src/game';
import { endBossStep, levelPanel, levelStep, levelWaves } from '../src/logic/world';
import { updateSpawning } from '../src/systems/spawning';

// v0.13 (#293): the release's balance pass. The Barrowvale takes level steps of its own (its level 1 at the floor, its crown level eased),
// its grasping hands hit and hold a little less, and the Plague Abbot, its level 1's end boss by name, comes on a step of his own there.

describe('the Barrowvale\'s own level steps, as tuned (#293)', () => {
  it('takes its own steps: level 1 at the floor, levels 3-5 eased; its wave lengths stay a relic realm\'s', () => {
    expect(WORLD.levelStep.own.barrowvale).toEqual({ hp: [0.72, 0.77, 0.8, 0.95, 0.95], damage: [0.82, 0.86, 0.9, 1.05, 1.05] });
    expect([1, 2, 3, 4, 5].map((l) => levelStep('barrowvale', l))).toEqual([
      { hp: 0.72, damage: 0.82 }, { hp: 0.77, damage: 0.86 }, { hp: 0.8, damage: 0.9 }, { hp: 0.95, damage: 1.05 }, { hp: 0.95, damage: 1.05 },
    ]);
    for (let l = 1; l <= 5; l++) expect(levelWaves('barrowvale', l)).toEqual({ foes: WORLD.levelWaves.realm.foes[l - 1], pace: WORLD.levelWaves.realm.pace[l - 1] });
  });

  it('the level panel shows the Enemy HP a Barrowvale level plays at; the Iron Hold keeps its own', () => {
    const shown = (realm: 'ironHold' | 'barrowvale', level: number) => levelPanel({ marches: [7] }, realm, level, 1).enemyHp;
    expect([1, 2, 3, 4, 5].map((l) => shown('barrowvale', l))).toEqual([314, 251, 229, 230, 200]); // were the Iron Hold's: 335, 251, 237, 240, 225
    expect([1, 2, 3, 4, 5].map((l) => shown('ironHold', l))).toEqual([335, 251, 237, 240, 225]);
    const g = createGame('viking', 3, { tier: 1, level: { realm: 'barrowvale', level: 1 } });
    expect(Math.round(g.tier.enemyHp * 100)).toBe(314);
  });

  it('its grasping hands hit for 7 and hold 1 s (were 10 and 1.2); a foe on a grave still pays three times and is held 2 s', () => {
    expect([GRAVE_HANDS.damage, GRAVE_HANDS.hold, GRAVE_HANDS.foeMult, GRAVE_HANDS.foeHold]).toEqual([7, 1, 3, 2]);
  });
});

describe('the Plague Abbot on the Barrowvale\'s step (#293)', () => {
  const bossOf = (g: Game, wave: number): Enemy => {
    g.wave = g.wavesCleared = wave - 1;
    g.breather = 0.01;
    for (let i = 0; i < 4000 && !g.enemies.some((e) => e.def.boss); i++) updateSpawning(g, 0.05);
    return g.enemies.find((e) => e.def.boss)!;
  };

  it('a realm\'s end boss steps only where the realm says so', () => {
    expect(endBossStep('barrowvale', 1)).toEqual({ hp: 0.85, damage: 0.7 });
    for (let l = 2; l <= 5; l++) expect(endBossStep('barrowvale', l)).toEqual({ hp: 1, damage: 1 });
    for (const realm of ['marches', 'ironHold', 'cinderlands', 'lastBastion'] as const) expect(endBossStep(realm, 1)).toEqual({ hp: 1, damage: 1 });
    expect([ENEMIES.abbot.hp, ENEMIES.abbot.damage, ENEMIES.abbot.poolDps]).toEqual([900, 16, 14]); // his own numbers stay: plain runs and the Marches draw him too
  });

  it('ends the Barrowvale\'s level 1 on 0.85 of his HP, hitting and fouling the ground at 0.7', () => {
    const abbot = bossOf(createGame('paladin', 11, { level: { realm: 'barrowvale', level: 1 } }), 8);
    expect(abbot.def.id).toBe('abbot');
    const was = WORLD.endBossStep.barrowvale;
    WORLD.endBossStep.barrowvale = [];
    try {
      const plain = bossOf(createGame('paladin', 11, { level: { realm: 'barrowvale', level: 1 } }), 8);
      expect(abbot.maxHp / plain.maxHp).toBeCloseTo(0.85, 2);
      expect(abbot.damage / plain.damage).toBeCloseTo(0.7);
      expect(abbot.def.poolDps! / plain.def.poolDps!).toBeCloseTo(0.7);
      expect(plain.def.poolDps).toBe(ENEMIES.abbot.poolDps);
    } finally {
      WORLD.endBossStep.barrowvale = was;
    }
    expect(ENEMIES.abbot.poolDps).toBe(14); // the shared def is never touched
  });

  it('leaves the Lich, the Gravedigger and the Barrow King their own numbers', () => {
    const lich = bossOf(createGame('paladin', 11, { level: { realm: 'barrowvale', level: 2 } }), 16);
    expect(lich.def.id).toBe('lich');
    const was = WORLD.endBossStep.barrowvale;
    WORLD.endBossStep.barrowvale = [];
    try {
      const same = bossOf(createGame('paladin', 11, { level: { realm: 'barrowvale', level: 2 } }), 16);
      expect([lich.maxHp, lich.damage]).toEqual([same.maxHp, same.damage]);
    } finally {
      WORLD.endBossStep.barrowvale = was;
    }
  });
});
