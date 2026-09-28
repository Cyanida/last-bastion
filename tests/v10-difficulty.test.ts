import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from '../src/config/achievements';
import { TIERS } from '../src/config/economy';
import { REALMS, type RealmId } from '../src/config/world';
import { createGame } from '../src/game';
import { nextTierRequirement, tierUnlockedFor, topTierWon } from '../src/logic/difficulty';
import { ringStep, recordClear, tierOpen, type WorldProgress } from '../src/logic/world';
import { applyRun, defaultSave, migrate, type RunSummary } from '../src/logic/save';

const recs = (wins: number[]) => ({ tierWaves: [0, 0, 0, 0], tierWins: wins });
const run = (o: Partial<RunSummary>): RunSummary => ({
  classId: 'viking', tier: 0, wave: 1, wavesCleared: 0, kills: 0, time: 60, level: 1, gold: 0, bosses: [], elites: 0, flawlessBosses: 0, relics: [], abilityUpgrades: 0, wave10Time: 0, ...o,
});
const crown = (p: WorldProgress, realm: RealmId, tier: number): WorldProgress => REALMS[realm].levels.reduce((q, _, i) => recordClear(q, realm, i + 1, tier), p);

describe('v0.10 #203: difficulty', () => {
  it('Squire and Knight are open from the start, in a fresh save and a migrated one', () => {
    expect(tierUnlockedFor(0, recs([0, 0, 0, 0]))).toBe(1);
    expect(defaultSave().tierUnlocked).toBe(1);
    expect(migrate({ version: 6, tierUnlocked: 0 }).tierUnlocked).toBe(1);
    expect(nextTierRequirement(1, recs([0, 0, 0, 0]))).toBe('');
    // the first run no longer announces Knight as unlocked
    expect(applyRun(defaultSave(), run({ wave: 16, wavesCleared: 15 })).tierUnlocked).toBe(false);
  });

  it('with no realm, Champion opens with a win on Knight and Legend with a win on Champion', () => {
    expect(tierUnlockedFor(1, recs([3, 0, 0, 0]))).toBe(1); // a Squire win is not enough any more
    expect(nextTierRequirement(2, recs([3, 0, 0, 0]))).toBe('win a run on Knight');
    expect(tierUnlockedFor(1, recs([0, 1, 0, 0]))).toBe(2);
    expect(nextTierRequirement(3, recs([0, 1, 0, 0]))).toBe('win a run on Champion');
    expect(tierUnlockedFor(1, recs([0, 1, 1, 0]))).toBe(3);
    const up = applyRun(defaultSave(), run({ tier: 1, wave: 40, wavesCleared: 40, won: true }));
    expect([up.tierUnlocked, up.save.tierUnlocked]).toEqual([true, 2]);
    expect(migrate({ version: 6, tierUnlocked: 3 }).tierUnlocked).toBe(3); // a save keeps every tier it opened
  });

  it('in a realm, Champion opens with its Knight crown and Legend with its Champion crown, that realm only', () => {
    expect([0, 1].every((t) => tierOpen({}, 'marches', t))).toBe(true);
    expect(tierOpen({}, 'marches', 2) || tierOpen({}, 'marches', 4) || tierOpen({}, 'marches', -1)).toBe(false);
    const k = crown({}, 'marches', 1);
    expect([tierOpen(k, 'marches', 2), tierOpen(k, 'marches', 3)]).toEqual([true, false]);
    expect(tierOpen(crown(k, 'marches', 2), 'marches', 3)).toBe(true);
    const both = crown(crown(k, 'marches', 2), 'ironHold', 0);
    expect([tierOpen(both, 'ironHold', 1), tierOpen(both, 'ironHold', 2)]).toEqual([true, false]);
  });

  it('the ring step scales a realm run and leaves a run with no realm as it was', () => {
    const base = createGame('paladin', 7, { tier: 1 }).tier;
    expect(base).toEqual(TIERS[1]);
    expect(createGame('paladin', 7, { tier: 1, realm: 'marches' }).tier).toEqual(TIERS[1]);
    const fin = createGame('paladin', 7, { tier: 1, realm: 'lastBastion' }).tier;
    expect(fin.enemyHp).toBeCloseTo(TIERS[1].enemyHp * ringStep('lastBastion').hp);
    expect(fin.enemyDmg).toBeCloseTo(TIERS[1].enemyDmg * ringStep('lastBastion').damage);
    expect([fin.gold, fin.eliteMult]).toEqual([TIERS[1].gold, TIERS[1].eliteMult]);
    const oath = createGame('paladin', 7, { tier: 0, oath: 3, realm: 'frozenPass' }).tier; // Oath and ring stack
    expect(oath.enemyHp).toBeCloseTo(createGame('paladin', 7, { tier: 0, oath: 3 }).tier.enemyHp * ringStep('frozenPass').hp);
  });

  it('the knight deed counts wins on Knight, Champion and Legend', () => {
    const deed = ACHIEVEMENTS.find((a) => a.id === 'knight')!;
    expect(topTierWon(recs([0, 0, 0, 0]))).toBe(0);
    expect(topTierWon(recs([5, 0, 0, 0]))).toBe(0);
    expect(topTierWon(recs([0, 1, 0, 0]))).toBe(1);
    expect(topTierWon(recs([0, 0, 0, 1]))).toBe(3);
    expect(deed.progress(defaultSave())).toBe(0); // Knight being open earns nothing
    expect(deed.progress({ ...defaultSave(), tierWins: [0, 0, 2, 0] })).toBe(2);
  });
});
