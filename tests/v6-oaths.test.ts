import { describe, expect, it } from 'vitest';
import { OATHS } from '../src/config/oaths';
import { TIERS } from '../src/config/economy';
import { createGame, updateGame } from '../src/game';
import { oathCap, oathReward, oathStack } from '../src/logic/oaths';
import { applyRun, defaultSave, migrate, type RunSummary } from '../src/logic/save';
import { damageEnemy } from '../src/systems/combat';
import { spawnEnemy } from '../src/systems/spawning';

const DT = 1 / 60;

describe('the Oath modifier stack (v0.6)', () => {
  it('Oath 0 asks nothing; every level keeps everything below it and adds exactly one thing', () => {
    const none = oathStack(0);
    expect(none.curses).toEqual([]);
    expect(Object.values(none.n).every((v) => v === 0 || v === 1)).toBe(true);
    expect(OATHS).toHaveLength(20);
    for (let lv = 1; lv <= OATHS.length; lv++) {
      const prev = oathStack(lv - 1);
      const next = oathStack(lv);
      expect(next.curses.slice(0, prev.curses.length)).toEqual(prev.curses); // cumulative
      const changed = (Object.keys(next.n) as (keyof typeof next.n)[]).filter((k) => next.n[k] !== prev.n[k]);
      expect(changed.length + next.curses.length - prev.curses.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('Oath 20 stacks all twenty: multipliers multiply, the curses are all distinct', () => {
    const top = oathStack(20);
    expect(new Set(top.curses).size).toBe(top.curses.length);
    expect(top.curses).toHaveLength(8);
    expect(top.n.hp).toBeCloseTo(1.15 * 1.1);
    expect(top.n.damage).toBeCloseTo(1.15 * 1.1);
    expect(top.n.eliteMult).toBeCloseTo(1.5 * 1.3);
    expect(top.n).toMatchObject({ bossHp: 1.3, modifierChance: 2, modifierFrom: 2, secondWind: 0.3, affixes: 3, noMerchant: 2, noLastStand: 1, rerollsLess: 1 });
    expect(oathStack(99)).toEqual(top); // clamped
  });

  it('a class may swear one above its highest kept Oath, and none before its first win', () => {
    expect(oathCap(0, 0)).toBe(0);
    expect(oathCap(1, 0)).toBe(1);
    expect(oathCap(4, 6)).toBe(7);
    expect(oathCap(9, 20)).toBe(20);
  });
});

describe('an Oath run (v0.6)', () => {
  it('replaces the free curses, folds its numbers into the tier, and can take the Last Stand and a reroll away', () => {
    const custom = createGame('viking', 1, { curses: ['swarm'] });
    const sworn = createGame('viking', 1, { curses: ['swarm'], oath: 20 });
    expect(custom.curses).toEqual(['swarm']);
    expect(sworn.curses).toEqual(oathStack(20).curses);
    expect(sworn.tier.enemyHp).toBeCloseTo(TIERS[0].enemyHp * oathStack(20).n.hp);
    expect(sworn.lastStand).toBe('off');
    expect(sworn.rerolls).toBe(custom.rerolls - 1);
    expect(createGame('viking', 1, { oath: 13 }).lastStand).toBe('ready');
  });

  it('Unbowed Crowns: a boss rises once with 30% HP, then falls for good', () => {
    const g = createGame('paladin', 2, { oath: 4 });
    g.lastStand = 'off';
    const boss = spawnEnemy(g, 'blackKnight', g.player.x + 300, g.player.y);
    damageEnemy(g, boss, boss.maxHp * 2);
    expect(boss.dead).toBe(false);
    expect(boss.hp).toBe(1);
    updateGame(g, DT);
    expect(boss.hp).toBe(Math.round(boss.maxHp * 0.3));
    damageEnemy(g, boss, boss.maxHp * 2);
    updateGame(g, DT);
    expect(boss.hp <= 0 || boss.dead).toBe(true);
  });

  it('Iron Crowns: bosses have more HP', () => {
    const before = spawnEnemy(createGame('paladin', 2, { oath: 14 }), 'blackKnight', 0, 0);
    const crowned = spawnEnemy(createGame('paladin', 2, { oath: 15 }), 'blackKnight', 0, 0);
    expect(crowned.maxHp).toBe(Math.round(before.maxHp * 1.3));
  });

  it('Thrice-Marked: every elite carries three different affixes; plain enemies stay plain', () => {
    const g = createGame('archer', 3, { oath: 9 });
    const elite = spawnEnemy(g, 'peasant', 0, 0, ['swift']);
    expect(elite.affixes).toHaveLength(3);
    expect(new Set(elite.affixes).size).toBe(3);
    expect(elite.affixes[0]).toBe('swift');
    expect(spawnEnemy(g, 'peasant', 0, 0).affixes).toEqual([]);
  });

  it('Empty Road: no Merchant at the end of Act II, straight to the fork; Act I still has him', () => {
    const g = createGame('paladin', 11, { oath: 10 });
    g.act = 2;
    g.wave = 20;
    g.breather = 0;
    g.spawnQueue = [];
    updateGame(g, DT);
    expect(g.pendingMerchant).toBe(false);
    expect(g.pendingRoute).not.toBeNull();
    const h = createGame('paladin', 11, { oath: 10 });
    h.wave = 10;
    h.breather = 0;
    h.spawnQueue = [];
    updateGame(h, DT);
    expect(h.pendingMerchant).toBe(true);
  });
});

describe('keeping an Oath (v0.6)', () => {
  const run: RunSummary = { classId: 'angel', tier: 0, wave: 40, wavesCleared: 40, kills: 3000, time: 2100, level: 33, gold: 0, bosses: [], elites: 20, flawlessBosses: 0, relics: [], abilityUpgrades: 3, wave10Time: 300, won: true };

  it('the first win at a new level pays and is recorded; again, or lower, or lost, pays nothing extra', () => {
    const won = applyRun(defaultSave(), run, 'd').save; // the first win, no Oath
    const first = applyRun(won, { ...run, oath: 1 }, 'd');
    expect(first.oathKept).toBe(1);
    expect(first.save.oaths.angel).toBe(1);
    const again = applyRun(first.save, { ...run, oath: 1 }, 'd');
    expect(again.oathKept).toBe(0);
    expect(first.runes - again.runes).toBe(oathReward(1).runes);
    expect(first.gold - again.gold).toBe(oathReward(1).gold);
    expect(applyRun(first.save, { ...run, oath: 2, won: false }, 'd').oathKept).toBe(0);
    expect(applyRun(first.save, { ...run, oath: 2 }, 'd').save.oaths).toMatchObject({ angel: 2, archer: 0 });
    expect(oathReward(20).runes).toBeGreaterThan(oathReward(1).runes);
  });

  it('the save keeps the Oath record and the chosen Oath, clamped', () => {
    const s = migrate({ ...defaultSave(), oaths: { angel: 3, viking: 99 }, settings: { ...defaultSave().settings, oath: 42 } });
    expect(s.oaths).toMatchObject({ angel: 3, viking: 20, paladin: 0 });
    expect(s.settings.oath).toBe(20);
  });
});
