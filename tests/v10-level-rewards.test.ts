import { describe, expect, it } from 'vitest';
import { RUNES } from '../src/config/economy';
import { createGame, summarizeRun } from '../src/game';
import { applyRun, defaultSave, type RunSummary, type Save } from '../src/logic/save';
import { headStartLevel, levelSkip } from '../src/logic/world';

const run = (o: Partial<RunSummary>): RunSummary => ({
  classId: 'paladin', tier: 0, wave: 1, wavesCleared: 0, kills: 0, time: 60, level: 1, gold: 0, bosses: [], elites: 0, flawlessBosses: 0, relics: [], abilityUpgrades: 0, wave10Time: 0, ...o,
});
const marches = (level: number, cleared = true) => ({ realm: 'marches' as const, level, cleared });

describe('levels: rewards count only the waves played (#192)', () => {
  it('a level skips the waves before its first and the head start levels; its share of a full run', () => {
    expect(levelSkip('marches', 1)).toEqual({ waves: 0, levels: 0, share: 5 / 40 });
    expect(levelSkip('marches', 7)).toEqual({ waves: 30, levels: headStartLevel(31) - 1, share: 10 / 40 });
    expect(levelSkip('lastBastion', 1)).toEqual({ waves: 0, levels: 0, share: 1 });
  });

  it('class XP from a level equals a fresh run that played the same waves and levels', () => {
    const skip = levelSkip('marches', 5);
    const lv = applyRun(defaultSave(), run({ wave: 26, wavesCleared: 25, level: 23, realmLevel: marches(5) }));
    const fresh = applyRun(defaultSave(), run({ wave: 6, wavesCleared: 25 - skip.waves, level: 23 - skip.levels }));
    expect(lv.classXp).toBe(fresh.classXp);
    expect(lv.save.tierWaves[0]).toBe(5); // the tier record counts the 5 waves played, not 25
  });

  it("the gold cap is the level's share of a full run's", () => {
    const gold = RUNES.runGoldCap * 3;
    const full = applyRun(defaultSave(), run({ gold })).gold;
    const short = applyRun(defaultSave(), run({ gold, realmLevel: marches(1, false) })).gold;
    expect(full).toBeGreaterThan(RUNES.runGoldCap);
    expect(short).toBeLessThanOrEqual(2 * RUNES.runGoldCap * (5 / 40));
    expect(applyRun(defaultSave(), run({ gold: 100, realmLevel: marches(1, false) })).gold).toBe(100); // under the cap: face value
  });

  it('a first clear goes on the champion and pays once; a replay pays nothing', () => {
    const first = applyRun(defaultSave(), run({ wave: 5, wavesCleared: 5, realmLevel: marches(1) }));
    expect(first.levelRewards.level).toEqual([{ kind: 'rarePick', family: 'steel', of: 2 }]);
    expect(first.save.champions.paladin!.world.marches).toEqual([1]);
    const again = applyRun(first.save, run({ wave: 5, wavesCleared: 5, realmLevel: marches(1) }));
    expect(again.levelRewards).toEqual({ level: [], crown: [] });
    const lost = applyRun(defaultSave(), run({ wave: 3, wavesCleared: 2, realmLevel: marches(1, false) }));
    expect(lost.levelRewards.level).toEqual([]);
    expect(lost.save.champions.paladin).toBeUndefined();
  });

  it('the crown pays its first-crown rewards once', () => {
    let save: Save = defaultSave();
    for (let l = 1; l <= 6; l++) save = applyRun(save, run({ realmLevel: marches(l) })).save;
    const crown = applyRun(save, run({ realmLevel: marches(7) }));
    expect(crown.levelRewards.crown).toEqual([{ kind: 'signature' }]);
    expect(applyRun(crown.save, run({ realmLevel: marches(7) })).levelRewards.crown).toEqual([]);
  });

  it('summarizeRun reports the level and counts only the Acts played whole', () => {
    const g = createGame('paladin', 3, { level: { realm: 'marches', level: 7 } });
    g.wavesCleared = 40;
    expect(summarizeRun(g)).toMatchObject({ actsCleared: 1, realmLevel: { realm: 'marches', level: 7, cleared: false } });
    const plain = createGame('paladin', 3);
    plain.wavesCleared = 20;
    expect(summarizeRun(plain)).toMatchObject({ actsCleared: 2, realmLevel: undefined });
  });
});
