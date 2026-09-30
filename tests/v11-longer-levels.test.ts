import { describe, expect, it } from 'vitest';
import { WAVES } from '../src/config/waves';
import { REALM_IDS, REALMS, WORLD } from '../src/config/world';
import type { Game } from '../src/core/types';
import { createGame } from '../src/game';
import { directWave, waveBudget } from '../src/logic/director';
import { rollEvent } from '../src/logic/quests';
import { enemyCount, isBossWave, pacingOf } from '../src/logic/waves';
import { bossWaveIn, levelBoss, levelWaves, ownWaves } from '../src/logic/world';
import { median } from '../src/sim/levels';
import { updateSpawning } from '../src/systems/spawning';

/** Stand the run at the end of wave `wave` with the field empty, and let one spawning step close it. */
function clearWave(g: Game, wave: number): void {
  g.wave = wave;
  g.breather = 0;
  g.spawnQueue.length = 0;
  g.enemies.length = 0;
  updateSpawning(g, 0.016);
}

/** Step spawning until wave `wave` starts. */
function startWave(g: Game, wave: number): void {
  g.wave = wave - 1;
  g.breather = 0.001;
  updateSpawning(g, 0.016);
}

/** #243: longer levels (docs/road-to-the-crown.md rules 3 and 9): the wave splits, a level's own boss wave, and its wave length. */
describe('longer levels: the wave splits (#243)', () => {
  it('a relic realm is 8 waves a level; the Marches 6, 6, 6, 6, 6, 5, 5', () => {
    const lengths = (r: keyof typeof REALMS) => REALMS[r].levels.map((l) => l.waves[1] - l.waves[0] + 1);
    expect(lengths('marches')).toEqual([6, 6, 6, 6, 6, 5, 5]);
    for (const r of REALM_IDS.filter((id) => REALMS[id].family)) expect(lengths(r)).toEqual([8, 8, 8, 8, 8]);
    expect(lengths('lastBastion')).toEqual([40]);
  });
});

describe('longer levels: a level runs on its own waves (#243)', () => {
  it('its one boss wave is its last; a plain run and the Last Bastion keep the scale\'s (x5, x0)', () => {
    const lv = { realm: 'ironHold' as const, last: 16 };
    expect([10, 15, 16].map((w) => bossWaveIn(lv, w))).toEqual([false, false, true]);
    expect([10, 15, 16].map((w) => bossWaveIn(null, w))).toEqual([true, true, false]);
    expect([10, 15, 16].map((w) => bossWaveIn({ realm: 'lastBastion', last: 40 }, w))).toEqual([true, true, false]);
    expect([ownWaves(lv), ownWaves(null), ownWaves({ realm: 'lastBastion' })]).toEqual([true, false, false]);
  });

  it('the director plays a wave as it is told: a scale boss wave as a plain wave with its full host, a level\'s last wave with its boss and a small escort', () => {
    const plain = directWave({ seed: 5, wave: 10, boss: false });
    expect(plain.boss).toBeNull();
    expect(plain.budget).toBe(waveBudget(10, 0, 1, false));
    expect(plain.budget).toBeGreaterThan(directWave({ seed: 5, wave: 10 }).budget); // no escort cut
    expect(enemyCount(10, false)).toBeGreaterThan(enemyCount(10));
    const end = directWave({ seed: 5, wave: 8, boss: true, bosses: ['warden'] });
    expect(end.boss).toBe('warden');
    expect(end.units[0].id).toBe('warden');
    expect(end.modifier).toBeNull(); // boss waves roll no modifier
    expect(enemyCount(8, true)).toBe(Math.max(1, Math.round(enemyCount(8, false) * WAVES.bossEscortFrac)));
    expect(directWave({ seed: 5, wave: 8 }).boss).toBeNull(); // and a plain run's wave 8 is as it was
    expect(directWave({ seed: 5, wave: 10 })).toEqual(directWave({ seed: 5, wave: 10, boss: isBossWave(10), pace: 1 }));
  });

  it('a level\'s boss wave is never a breather and brings no event, though its place in the Act would make it one', () => {
    expect(pacingOf(8)).toBe('breather');
    expect(pacingOf(8, true)).toBeNull();
    expect(rollEvent(3, 8, true)).toBeNull();
    expect(rollEvent(3, 8)).not.toBeNull(); // a breather always brings one
  });

  it('in a level the scale\'s boss waves bring no boss, and the last wave brings the level\'s own', () => {
    const g = createGame('paladin', 3, { level: { realm: 'ironHold', level: 2 } }); // waves 9-16
    startWave(g, 10);
    expect(g.bossesSeen).toEqual([]);
    expect(g.spawnQueue.some((u) => u.id === 'dragon' || u.id === 'warden')).toBe(false);
    startWave(g, 15);
    expect(g.bossesSeen).toEqual([]);
    startWave(g, 16);
    expect(g.bossesSeen).toEqual([levelBoss('ironHold', 2)]);
    const plain = createGame('paladin', 3);
    startWave(plain, 10);
    expect(plain.bossesSeen).toHaveLength(1); // a plain run's wave 10 is its Act boss, as before
  });

  it('an Act that ends inside a level moves on with no Merchant and no fork; a plain run still meets the Merchant', () => {
    const g = createGame('paladin', 3, { level: { realm: 'marches', level: 2 } }); // waves 7-12
    const arena = g.arena.id;
    expect(g.act).toBe(1);
    clearWave(g, 10);
    expect(g.level!.cleared).toBe(false);
    expect([g.pendingMerchant, g.pendingRoute, g.route]).toEqual([false, null, null]);
    expect(g.act).toBe(2);
    expect(g.arena.id).toBe(arena); // the realm's own arena, not the rotation's
    expect(g.banner?.text).toMatch(/^Act II/);
    expect(g.pendingBoard).toBe(true); // Act II's board is up
    g.pendingBoard = false;
    g.breather = 0.001;
    updateSpawning(g, 0.016);
    expect(g.wave).toBe(11); // and the next wave comes
    clearWave(g, 12);
    expect(g.level!.cleared).toBe(true);
    const plain = createGame('paladin', 3);
    clearWave(plain, 10);
    expect([plain.pendingMerchant, plain.act]).toEqual([true, 1]);
  });
});

describe('longer levels: wave length in levels only (#243)', () => {
  it('has a value for every Marches and relic realm level; the Last Bastion keeps 1', () => {
    for (const k of ['foes', 'pace'] as const) {
      expect(WORLD.levelWaves.marches[k]).toHaveLength(REALMS.marches.levels.length);
      expect(WORLD.levelWaves.realm[k]).toHaveLength(REALMS.ironHold.levels.length);
    }
    expect(levelWaves('lastBastion', 1)).toEqual({ foes: 1, pace: 1 });
    expect(levelWaves('marches', 1)).toEqual({ foes: WORLD.levelWaves.marches.foes[0], pace: WORLD.levelWaves.marches.pace[0] });
    expect(levelWaves('frozenPass', 5)).toEqual({ foes: WORLD.levelWaves.realm.foes[4], pace: WORLD.levelWaves.realm.pace[4] });
  });

  it('a level\'s wave brings its share of foes over its share of time; a plain run (the Daily Trial) is untouched', () => {
    const lw = levelWaves('ironHold', 1);
    const g = createGame('paladin', 3, { tier: 1, level: { realm: 'ironHold', level: 1 } });
    const plain = createGame('paladin', 3, { tier: 1 });
    startWave(g, 2);
    startWave(plain, 2);
    const same = directWave({ seed: 3, wave: 2, classId: 'paladin', tier: 1, eliteMult: plain.tier.eliteMult });
    expect(plain.spawnQueue).toHaveLength(same.units.length);
    expect(plain.spawnInterval).toBe(same.spawnInterval);
    const want = directWave({ seed: 3, wave: 2, classId: 'paladin', tier: 1, eliteMult: g.tier.eliteMult, budgetMult: lw.foes, boss: false, pace: lw.pace });
    expect(g.spawnQueue).toHaveLength(want.units.length);
    expect(g.spawnInterval).toBe(want.spawnInterval);
    expect(want.budget).toBe(waveBudget(2, 0, lw.foes));
    expect(Math.sign(g.spawnQueue.length - plain.spawnQueue.length)).toBe(Math.sign(lw.foes - 1));
  });

  it('a foe\'s XP is divided by the level\'s foes, so a level pays what its waves pay at the pace', () => {
    const lw = levelWaves('ironHold', 1);
    const g = createGame('paladin', 3, { tier: 1, level: { realm: 'ironHold', level: 1 } });
    const plain = createGame('paladin', 3, { tier: 1 });
    for (const x of [g, plain]) {
      x.wave = 1;
      x.spawnQueue = [{ id: 'peasant', affixes: [], squad: -1, commander: false }];
      x.spawnTimer = 0;
      x.breather = 0;
      updateSpawning(x, 0.016);
    }
    expect(g.enemies[0].xp).toBeCloseTo(plain.enemies[0].xp / lw.foes);
  });
});

describe('longer levels: the sim\'s median (#243)', () => {
  it('is the middle value, the mean of the middle two for an even count, 0 for none', () => {
    expect([median([3, 1, 2]), median([4, 1, 2, 3]), median([])]).toEqual([2, 2.5, 0]);
  });
});
