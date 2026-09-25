import { describe, expect, it } from 'vitest';
import { nextTierRequirement, tierUnlockedFor } from '../src/logic/difficulty';
import { applyRun, defaultSave, migrate, type RunSummary } from '../src/logic/save';

const recs = (waves: number[], wins: number[]) => ({ tierWaves: waves, tierWins: wins });
const run = (o: Partial<RunSummary>): RunSummary => ({
  classId: 'viking', tier: 0, wave: 1, wavesCleared: 0, kills: 0, time: 60, level: 1, gold: 0, bosses: [], elites: 0, flawlessBosses: 0, relics: [], abilityUpgrades: 0, wave10Time: 0, ...o,
});

describe('v0.8 #79: difficulty unlocks', () => {
  it('Squire is always open; Knight opens at wave 15 on Squire', () => {
    expect(tierUnlockedFor(0, recs([0, 0, 0, 0], [0, 0, 0, 0]))).toBe(0);
    expect(tierUnlockedFor(0, recs([14, 0, 0, 0], [0, 0, 0, 0]))).toBe(0);
    expect(tierUnlockedFor(0, recs([15, 0, 0, 0], [0, 0, 0, 0]))).toBe(1);
    expect(nextTierRequirement(1, recs([3, 0, 0, 0], [0, 0, 0, 0]))).toBe('clear wave 15 on Squire');
  });

  it('Champion needs both wave 30 on Knight and a win on Squire, in any order', () => {
    expect(tierUnlockedFor(1, recs([15, 30, 0, 0], [0, 0, 0, 0]))).toBe(1);
    expect(tierUnlockedFor(1, recs([40, 10, 0, 0], [1, 0, 0, 0]))).toBe(1);
    expect(tierUnlockedFor(1, recs([40, 30, 0, 0], [1, 0, 0, 0]))).toBe(2);
    expect(nextTierRequirement(2, recs([15, 10, 0, 0], [0, 0, 0, 0]))).toBe('clear wave 30 on Knight and win a run on Squire');
    expect(nextTierRequirement(2, recs([40, 10, 0, 0], [1, 0, 0, 0]))).toBe('clear wave 30 on Knight');
    // through applyRun: the win first, then the Knight run
    let save = { ...defaultSave(), tierUnlocked: 1 };
    save = applyRun(save, run({ tier: 0, wave: 40, wavesCleared: 40, won: true })).save;
    expect(save.tierUnlocked).toBe(1);
    const up = applyRun(save, run({ tier: 1, wave: 31, wavesCleared: 30 }));
    expect(up.tierUnlocked).toBe(true);
    expect(up.save.tierUnlocked).toBe(2);
  });

  it('Legend needs a win on Champion; a Squire win opens nothing past Knight on its own', () => {
    expect(tierUnlockedFor(2, recs([40, 40, 40, 0], [1, 1, 0, 0]))).toBe(2);
    expect(tierUnlockedFor(2, recs([40, 40, 40, 0], [1, 1, 1, 0]))).toBe(3);
    expect(nextTierRequirement(3, recs([0, 0, 0, 0], [0, 0, 0, 0]))).toBe('win a run on Champion');
    expect(applyRun(defaultSave(), run({ tier: 0, wave: 40, wavesCleared: 40, won: true })).save.tierUnlocked).toBe(1);
  });

  it('the Watchtower gates nothing, and a save keeps every difficulty it opened', () => {
    const old = migrate({ version: 6, tierUnlocked: 3, buildings: {} });
    expect(old.tierUnlocked).toBe(3);
    expect(applyRun(old, run({ tier: 0, wave: 2, wavesCleared: 1 })).save.tierUnlocked).toBe(3);
    // an older save's records come from its run log
    const logged = migrate({ version: 6, tierUnlocked: 1, runs: [{ classId: 'viking', tier: 1, wave: 31, won: false, time: 900, waves: [], marks: [] }, { classId: 'viking', tier: 0, wave: 35, won: true, time: 900, waves: [], marks: [] }] });
    expect(logged.tierWaves.slice(0, 2)).toEqual([35, 30]);
    expect(logged.tierWins[0]).toBe(1);
    expect(logged.tierUnlocked).toBe(2);
  });
});
