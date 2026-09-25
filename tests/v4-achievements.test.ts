import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, CATEGORIES, FEAT_KEYS, tierReward, type AchievementCategory } from '../src/config/achievements';
import { CLASS_ORDER } from '../src/config/classes';
import { CURSE_IDS } from '../src/config/curses';
import { BUILDING_IDS, BUILDINGS, RUNES } from '../src/config/economy';
import { TRAIT_IDS, TRAITS } from '../src/config/traits';
import { emit } from '../src/core/events';
import { createGame, summarizeRun } from '../src/game';
import { earnedTier, earnedTitles, gateOf, newlyEarned, tierKey, tierOf, withAchievements } from '../src/logic/achievements';
import { applyRun, defaultSave, migrate, type RunSummary, type Save } from '../src/logic/save';
import { oldSave } from './fixtures/saves';

const run = (over: Partial<RunSummary> = {}): RunSummary => ({
  classId: 'paladin', tier: 0, wave: 6, wavesCleared: 5, kills: 10, time: 200, level: 6, gold: 0,
  bosses: [], elites: 0, flawlessBosses: 0, relics: [], abilityUpgrades: 0, wave10Time: 0, ...over,
});
const withCounters = (over: Partial<Save['counters']>): Save => ({ ...defaultSave(), counters: { ...defaultSave().counters, ...over } });
const ids = (save: Save) => newlyEarned(save).map((e) => tierKey(e.id, e.tier));

describe('the deed roster', () => {
  it('has 60+ deeds with unique ids, spread over every category, none earned on a fresh save', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(60);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    for (const c of Object.keys(CATEGORIES) as AchievementCategory[]) expect(ACHIEVEMENTS.filter((a) => a.category === c).length).toBeGreaterThan(0);
    expect(newlyEarned(defaultSave())).toEqual([]);
  });

  it('hides at least ten deeds, and every hidden one has a hint', () => {
    const hidden = ACHIEVEMENTS.filter((a) => a.hidden);
    expect(hidden.length).toBeGreaterThanOrEqual(10);
    for (const a of hidden) expect(a.hint && a.hint.length > 0).toBe(true);
  });

  it('every deed has 1-3 tiers with rising targets, and every tier pays at least its Runes', () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.tiers.length).toBeGreaterThanOrEqual(1);
      expect(a.tiers.length).toBeLessThanOrEqual(RUNES.achievementTier.length);
      for (let i = 0; i < a.tiers.length; i++) {
        if (i > 0) expect(a.tiers[i].target).toBeGreaterThan(a.tiers[i - 1].target);
        expect(tierReward(a, i + 1).runes).toBe(RUNES.achievementTier[i]);
      }
    }
  });

  it('every class has at least two feats of its own', () => {
    for (const id of CLASS_ORDER) expect(ACHIEVEMENTS.filter((a) => a.classId === id).length).toBeGreaterThanOrEqual(2);
  });

  it('deeds, traits and unlocks all point at deeds that exist', () => {
    for (const b of BUILDING_IDS) {
      for (const level of BUILDINGS[b].levels) {
        if (!level.achievement) continue;
        const gate = tierOf(level.achievement);
        expect(gate).toBeDefined();
        expect(gate!.tier).toBeLessThanOrEqual(gate!.def.tiers.length);
      }
    }
    for (const id of TRAIT_IDS) {
      const need = TRAITS[id].unlock.achievement;
      if (!need) continue;
      expect(ACHIEVEMENTS.some((a) => a.id === need)).toBe(true);
      // the deed that gates a trait also advertises it as its reward
      expect(ACHIEVEMENTS.some((a) => a.id === need && a.tiers.some((t) => t.reward.trait === id))).toBe(true);
    }
    for (const id of CURSE_IDS) expect(gateOf({ curse: id })).toBeDefined();
    for (const a of ACHIEVEMENTS) if (a.unlocks?.relic) expect(gateOf({ relic: a.unlocks.relic })).toBeDefined();
  });
});

describe('tiers', () => {
  it('a counter at the silver target earns bronze and silver at once; gold waits', () => {
    const silver = withCounters({ elites: 250 });
    expect(ids(silver)).toEqual(expect.arrayContaining(['eliteHunter', 'eliteHunter:2']));
    expect(ids(silver)).not.toContain('eliteHunter:3');
    const after = withAchievements(silver).save;
    expect(earnedTier(after, 'eliteHunter')).toBe(2);
    expect(after.achievements).toContain('eliteHunter'); // bronze stays the bare id, so every old check keeps working
    const gold = withAchievements({ ...after, counters: { ...after.counters, elites: 1000 } });
    expect(gold.earned.map((e) => e.tier)).toEqual([3]);
  });

  it('pays the Runes of every tier earned and never pays twice', () => {
    const first = withAchievements(withCounters({ kills: 2000 })); // First Blood: 100 / 500 / 2,000
    expect(first.earned.map((e) => e.id)).toEqual(['firstBlood', 'firstBlood', 'firstBlood']);
    expect(first.save.runes).toBe(RUNES.achievementTier.reduce((a, b) => a + b, 0));
    const again = withAchievements(first.save);
    expect(again.earned).toEqual([]);
    expect(again.save).toBe(first.save); // idempotent: same object back
  });

  it('gold tiers hand out titles, palettes and talent points, and they are equippable', () => {
    const { save } = withAchievements(withCounters({ kills: 2000, bossKinds: ['dragon', 'warden', 'blackKnight', 'abbot', 'lich'] }));
    expect(save.titles).toContain('Blooded'); // First Blood, gold
    expect(save.palettes).toContain(2); // Rogues' Gallery
    expect(earnedTitles(save)).toEqual(expect.arrayContaining(['Blooded']));
    const worn: Save = { ...save, title: 'Blooded' };
    expect(migrate(JSON.parse(JSON.stringify(worn)))).toEqual(worn); // the worn title survives a round trip
    const points = withAchievements(withCounters({ actsCleared: 4 })).save; // Second Act, gold: a permanent talent point
    expect(points.talentPoints).toBe(1);
    expect(createGame('viking', 1, { bonusTalentPoints: points.talentPoints }).talentPoints).toBe(1);
  });
});

describe('class feats', () => {
  it('run -> summary -> save -> deed: a Divine Shield that soaks a beating earns the Bulwark', () => {
    const g = createGame('paladin', 1);
    g.player.invulnerable = true;
    emit(g, 'onBlocked', { amount: 3000, attacker: null });
    emit(g, 'onBlocked', { amount: 3000, attacker: null });
    expect(g.feats.absorb).toBe(6000);
    const summary = summarizeRun(g);
    expect(summary.feats?.absorb).toBe(6000);
    const { save } = applyRun(defaultSave(), summary);
    expect(save.counters.absorb).toBe(6000);
    expect(ids(save)).toEqual(expect.arrayContaining(['paladinShield', 'paladinShield:2'])); // 2,000 and 5,000
  });

  it('feats keep the best single run, and a save without them still migrates', () => {
    const first = applyRun(defaultSave(), run({ feats: { minions: 12, rolls: 30 } })).save;
    expect(first.counters.minions).toBe(12);
    const second = applyRun(first, run({ classId: 'necromancer', feats: { minions: 8 } })).save;
    expect(second.counters.minions).toBe(12); // a weaker run does not undo it
    expect(applyRun(second, run({ feats: { minions: 20 } })).save.counters.minions).toBe(20);
    const old = { ...oldSave('v0.3.1'), counters: { kills: 40 } };
    for (const key of FEAT_KEYS) expect(migrate(old).counters[key]).toBe(0);
  });
});

describe('migration', () => {
  it('keeps old deed ids and maps the ones that became tiers', () => {
    const v3 = { ...oldSave('v0.3.1'), achievements: ['firstBlood', 'wave10', 'champion', 'legend'] };
    const save = migrate(v3);
    expect(save.achievements).toEqual(['firstBlood', 'wave10', 'knight:2', 'knight:3']);
    expect(earnedTier(save, 'knight')).toBe(0); // bronze was never stored, so it is earned again on the next check
    expect(migrate(JSON.parse(JSON.stringify(save)))).toEqual(save); // and mapping twice changes nothing
    expect(save.titles).toEqual([]);
    expect(save.title).toBeNull();
    expect(save.palettes).toEqual([]);
    expect(save.talentPoints).toBe(0);
    expect(save.treasures).toEqual(defaultSave().treasures);
  });
});
