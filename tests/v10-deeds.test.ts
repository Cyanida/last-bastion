import { describe, expect, it } from 'vitest';
import { newlyEarned } from '../src/logic/achievements';
import { applyRun, defaultSave, type RunSummary } from '../src/logic/save';
import type { RelicId } from '../src/config/relics';

const run = (o: Partial<RunSummary>): RunSummary => ({
  classId: 'paladin', tier: 0, wave: 1, wavesCleared: 0, kills: 0, time: 60, level: 1, gold: 0, bosses: [], elites: 0, flawlessBosses: 0, relics: [], abilityUpgrades: 0, wave10Time: 0, ...o,
});
// a Flame 6-set, two duos, four awakened relics, three ability upgrades: every "in one run" deed's bronze
const build: Partial<RunSummary> = {
  relics: ['brimstoneOil', 'emberheart', 'cinderCharm', 'salamanderScale', 'dragonsTongue', 'radiantBrand', 'frostBrand', 'stormPennant'] as RelicId[],
  duos: ['thermalShock', 'wildfire'],
  relicTiers: { brimstoneOil: 3, emberheart: 3, cinderCharm: 3, salamanderScale: 3 },
  abilityUpgrades: 3,
};
const perRun = ['collector', 'sixSet', 'duos', 'awakening', 'ascended'];
const earned = (r: RunSummary) => newlyEarned(applyRun(defaultSave(), r).save).map((e) => e.id);

describe('deeds: "in one run" and Six of a Kind count in the Last Bastion, wave deeds count waves played (#205)', () => {
  it('a realm level counts none of the "in one run" deeds or Six of a Kind', () => {
    const lv = applyRun(defaultSave(), run({ ...build, wave: 10, wavesCleared: 10, realmLevel: { realm: 'marches', level: 2, cleared: true } })).save;
    expect(lv.counters).toMatchObject({ maxRelics: 0, sixSets: 0, maxDuos: 0, maxAwakened: 0, maxAbilityUpgrades: 0 });
    for (const id of perRun) expect(newlyEarned(lv).map((e) => e.id)).not.toContain(id);
  });

  it('the Last Bastion, and a run with no level, count them', () => {
    expect(earned(run({ ...build, realmLevel: { realm: 'lastBastion', level: 1, cleared: false } }))).toEqual(expect.arrayContaining(perRun));
    expect(earned(run(build))).toEqual(expect.arrayContaining(perRun));
  });

  it('wave deeds count the waves played: a level from wave 21 to 30 is ten waves, not thirty', () => {
    const lv = applyRun(defaultSave(), run({ wave: 30, wavesCleared: 30, realmLevel: { realm: 'ironHold', level: 4, cleared: true } })).save;
    expect(lv.classes.paladin.bestWave).toBe(10);
    const ids = newlyEarned(lv).map((e) => e.id);
    expect(ids).toContain('wave10');
    expect(ids).not.toContain('wave20');
    expect(applyRun(defaultSave(), run({ wave: 30, wavesCleared: 30 })).save.classes.paladin.bestWave).toBe(30);
  });

  it('reaching wave 10 fast counts only from wave 1', () => {
    const lv = applyRun(defaultSave(), run({ wave: 10, wave10Time: 100, realmLevel: { realm: 'marches', level: 2, cleared: true } })).save;
    expect(lv.counters.fastestWave10).toBe(0);
    expect(applyRun(defaultSave(), run({ wave: 10, wave10Time: 100 })).save.counters.fastestWave10).toBe(100);
  });
});
