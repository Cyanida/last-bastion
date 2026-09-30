import { describe, expect, it } from 'vitest';
import { ABILITY_TRACKS } from '../src/config/abilityUpgrades';
import { CHAMPION, CHAMPION_STATS } from '../src/config/champion';
import { UTILITY_TRACKS } from '../src/config/utility';
import { newChampion, type Champion } from '../src/logic/champions';
import {
  buildStats, buildView, buyAbilityTier, buyUtilityTier, heldPoints, levelUpGains, pointGives, resetPoints, spendStat, statPointsFree, unspendStat,
  utilityUnlockLevel, xpForLevel,
} from '../src/logic/championLevels';
import type { RealmRun, RunCarry } from '../src/logic/realmRun';
import { CLASSES } from '../src/config/classes';

/** A champion of `classId` at `level`, with the XP that level takes (crowned far enough for the cap not to hold it). */
const at = (classId: 'paladin' | 'viking' | 'archer', level: number): Champion =>
  ({ ...newChampion(classId), world: { marches: [7], ironHold: [5], barrowvale: [5] }, xp: xpForLevel(level), level });

/** A realm run at its level-2 checkpoint, whose stats hold `points`. */
const runHolding = (points: RunCarry['points']): RealmRun => ({ level: 2, tier: 0, seed: 1, carry: { level: 2, points } as RunCarry });

describe('the build panel: spending and taking back stat points (#241)', () => {
  it('a level up gives 3 stat points and a talent point to spend', () => {
    expect(levelUpGains(1, 2)).toEqual({ levels: 1, statPoints: CHAMPION.statPoints, talentPoints: CHAMPION.talentPoints });
    expect(levelUpGains(2, 4)).toEqual({ levels: 2, statPoints: 6, talentPoints: 2 });
    expect(levelUpGains(5, 5)).toEqual({ levels: 0, statPoints: 0, talentPoints: 0 }); // at the cap: XP banked, no level
  });

  it('the minus takes a point back out, and never below zero', () => {
    let c = spendStat(spendStat(at('paladin', 2), 'strength'), 'strength');
    expect(statPointsFree(c)).toBe(1);
    c = unspendStat(c, 'strength');
    expect(c.points).toEqual({ strength: 1 });
    expect(statPointsFree(c)).toBe(2);
    c = unspendStat(c, 'strength');
    expect(c.points).toEqual({}); // no zero left behind: the same as never spent
    expect(unspendStat(c, 'strength')).toBe(c);
    expect(unspendStat(c, 'vitality')).toBe(c);
  });

  it('a point a realm run has played with stays until the run ends; one put in since its checkpoint comes out again', () => {
    let c: Champion = { ...at('viking', 3), points: { strength: 2, vitality: 1 }, runs: { marches: runHolding({ strength: 2 }) } };
    expect(heldPoints(c)).toEqual({ strength: 2 });
    expect(unspendStat(c, 'strength', heldPoints(c))).toBe(c); // both are in the run
    c = spendStat(c, 'strength');
    expect(c.points.strength).toBe(3);
    c = unspendStat(c, 'strength', heldPoints(c)); // the third is not in it yet
    expect(c.points.strength).toBe(2);
    expect(unspendStat(c, 'vitality', heldPoints(c)).points).toEqual({ strength: 2 }); // the run never played with Vitality
    expect(resetPoints(c)).toBe(c); // and no reset inside the run
    // two runs: the most either holds
    expect(heldPoints({ runs: { marches: runHolding({ strength: 1, focus: 2 }), ironHold: runHolding({ strength: 3 }) } })).toEqual({ strength: 3, focus: 2 });
    expect(heldPoints({ runs: { marches: { level: 1, tier: 0, seed: 1, carry: null } } })).toEqual({}); // a run at level 1 has played nothing
  });

  it('what is taken back never reaches the next level: the stats grow by the points left', () => {
    const c = unspendStat(spendStat(spendStat(at('paladin', 2), 'strength'), 'strength'), 'strength');
    const base = { ...CLASSES.paladin.base };
    const grown = buildStats('paladin', base, { level: 2, points: {} }, c);
    expect(grown.str - base.str).toBeCloseTo(pointGives('paladin', 'strength').amount);
  });

  it('a stat line says what one point gives and what its points add up to', () => {
    expect(pointGives('paladin', 'strength').text).toBe('+10 Strength');
    expect(pointGives('paladin', 'strength', 3).text).toBe('+30 Strength');
    const one = pointGives('archer', 'dexterity').text, two = pointGives('archer', 'dexterity', 2).text;
    expect(one).toMatch(/^\+\d+% /);
    expect(Number(/\d+/.exec(two)![0])).toBe(2 * Number(/\d+/.exec(one)![0])); // points add up, never compound
    expect(pointGives('archer', 'dexterity', 2).amount).toBe(pointGives('archer', 'dexterity').amount); // one point's worth, whatever the line shows
  });
});

describe('the build as its screens show it (#241)', () => {
  it('a fresh level-1 champion has nothing to spend: every plus and minus is off, and the utility waits for its level', () => {
    const v = buildView(newChampion('paladin'), 'paladin');
    expect(v).toMatchObject({ level: 1, statPoints: 0, talentPoints: 0, canReset: false, tierCost: CHAMPION.tierCost });
    expect(v.stats.map((s) => s.id)).toEqual([...CHAMPION_STATS]);
    expect(v.stats.every((s) => !s.canAdd && !s.canTake && s.points === 0)).toBe(true);
    expect(v.ability.next).toMatchObject({ tier: 0, canBuy: false, options: ABILITY_TRACKS.paladin[0] });
    expect(v.utility.next).toBeNull();
    expect(v.utility.locked).toBe(`Unlocks at champion level ${utilityUnlockLevel}.`);
    expect(utilityUnlockLevel).toBe(2);
  });

  it('level 2: three points, a plus on every stat, and either tier for two of them', () => {
    let c = at('paladin', 2);
    let v = buildView(c, 'paladin', { bonus: 2 });
    expect(v).toMatchObject({ level: 2, statPoints: 3, talentPoints: 3, xp: 0 }); // a level's talent point and the account's two
    expect(v.stats.every((s) => s.canAdd && !s.canTake)).toBe(true);
    expect(v.stats[0]).toMatchObject({ id: 'strength', name: 'Strength', gives: '+10 Strength', points: 0 });
    expect(v.ability.next?.canBuy).toBe(true);
    expect(v.utility).toMatchObject({ locked: null, next: { tier: 0, canBuy: true, options: UTILITY_TRACKS.paladin[0] } });
    // two points in: the third still goes into a stat, but no tier
    c = spendStat(spendStat(c, 'strength'), 'vitality');
    v = buildView(c, 'paladin');
    expect(v.statPoints).toBe(1);
    expect(v.stats.map((s) => [s.points, s.canAdd, s.canTake])).toEqual([[1, true, true], [0, true, false], [0, true, false], [1, true, true]]);
    expect(v.stats[0].total).toBe('+10 Strength');
    expect(v.ability.next?.canBuy).toBe(false);
    expect(v.utility.next?.canBuy).toBe(false);
    expect(v.canReset).toBe(true); // outside a run: everything back, for free
  });

  it('tiers come in order; a bought one is listed and the next is offered; the second utility tier is a mastery unlock', () => {
    let c = at('archer', 4); // 9 points
    c = buyAbilityTier(c, 'archer', ABILITY_TRACKS.archer[0][1]);
    c = buyUtilityTier(c, 'archer', UTILITY_TRACKS.archer[0][0]);
    let v = buildView(c, 'archer');
    expect(v.statPoints).toBe(9 - 2 * CHAMPION.tierCost);
    expect(v.ability).toMatchObject({ bought: [ABILITY_TRACKS.archer[0][1]], next: { tier: 1, options: ABILITY_TRACKS.archer[1], canBuy: true } });
    expect(v.utility).toMatchObject({ bought: [UTILITY_TRACKS.archer[0][0]], next: null, locked: null }); // one tier without the mastery rank
    expect(buildView(c, 'archer', { utilityTiers: 2 }).utility.next).toMatchObject({ tier: 1, options: UTILITY_TRACKS.archer[1] });
    c = buyAbilityTier(buyAbilityTier(c, 'archer', ABILITY_TRACKS.archer[1][0]), 'archer', ABILITY_TRACKS.archer[2][0]);
    v = buildView(c, 'archer');
    expect(v.ability.next).toBeNull(); // all three bought
    expect(v.ability.bought).toHaveLength(3);
    expect(v.statPoints).toBe(1);
  });

  it('inside a realm run: no reset, and only the points put in since its checkpoint can come out', () => {
    const c: Champion = { ...at('viking', 3), points: { strength: 2, dexterity: 1 }, runs: { marches: runHolding({ strength: 2 }) } };
    const v = buildView(c, 'viking');
    expect(v.canReset).toBe(false);
    expect(v.stats.map((s) => s.canTake)).toEqual([false, true, false, false]);
    expect(v.statPoints).toBe(3);
  });

  it('at the cap the panel says so, and XP keeps counting', () => {
    const c = { ...newChampion('paladin'), xp: xpForLevel(5) + 50, level: 5 };
    expect(buildView(c, 'paladin')).toMatchObject({ level: 5, cap: 5, capped: true, xp: 50 });
  });
});
