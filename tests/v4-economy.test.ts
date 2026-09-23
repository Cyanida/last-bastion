import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from '../src/config/achievements';
import { CLASS_ORDER } from '../src/config/classes';
import { ACCOUNT_MILESTONES, BUILDING_IDS, BUILDINGS, MASTERY, META, META_IDS, RUNES, TALENT_ROW_CAP } from '../src/config/economy';
import { createGame } from '../src/game';
import { accountLevel, accountPerks, buildingLevel, masteryBonus, masteryRank, metaCost, rankCap, rewardText, runesForActBoss, totalKeepCost } from '../src/logic/economy';
import { applyRun, buyBuilding, buyMeta, defaultSave, migrate, SAVE_VERSION, type RunSummary, type Save } from '../src/logic/save';
import { spendTalent } from '../src/systems/talents';
import { branchPlan } from '../src/logic/talents';

const run = (over: Partial<RunSummary> = {}): RunSummary => ({
  classId: 'paladin', tier: 0, wave: 11, wavesCleared: 10, kills: 200, time: 400, level: 11, gold: 300,
  bosses: ['blackKnight', 'dragon'], elites: 4, flawlessBosses: 0, relics: ['frostBrand'], abilityUpgrades: 1, wave10Time: 0, ...over,
});

describe('Runes (v0.4)', () => {
  it('only Act bosses pay Runes in a run, more for later Acts, and salvage shards convert', () => {
    const { runes, save } = applyRun(defaultSave(), run());
    expect(runes).toBe(RUNES.perActBoss[0]); // one Act boss (the Dragon); the Black Knight is a mid-Act boss
    expect(save.runes).toBe(RUNES.perActBoss[0]);
    expect(applyRun(defaultSave(), run({ bosses: ['dragon', 'warden'] })).runes).toBe(RUNES.perActBoss[0] + RUNES.perActBoss[1]);
    expect(applyRun(defaultSave(), run({ bosses: ['dragon', 'warden', 'dragon', 'warden', 'dragon', 'warden'] })).runes).toBe(RUNES.runCap); // a deep run is capped
    expect(applyRun(defaultSave(), run({ bosses: [] })).runes).toBe(0);
    expect(runesForActBoss(0, { runeIncome: 2 })).toBe(RUNES.perActBoss[0] + 2); // the Treasury's Rune Carver
    const shards = applyRun(defaultSave(), run({ bosses: [], salvage: RUNES.shardsPerRune * 2 + 3 }));
    expect(shards.runes).toBe(2);
    expect(shards.save.runeShards).toBe(3);
  });

  it('gold from curses and the Daily Trial is capped per day; plain gold is not', () => {
    const cursed = run({ gold: 2000, curses: ['ironHorde', 'swarm', 'frenzy'] });
    const first = applyRun(defaultSave(), cursed, '2026-01-01');
    const banked = applyRun(defaultSave(), run({ gold: 2000 }), '2026-01-01').gold; // the run cap first, the same for cursed and plain runs
    expect(first.gold).toBeLessThanOrEqual(banked);
    expect(first.gold).toBeGreaterThan(banked - RUNES.dailyCaps.curseGold); // only the curse share can be withheld
    expect(first.save.dailyGold.curse).toBeGreaterThan(0);
    const second = applyRun(first.save, cursed, '2026-01-01');
    expect(second.gold).toBeLessThan(first.gold); // the day's allowance is spent
    expect(second.save.dailyGold.curse).toBe(RUNES.dailyCaps.curseGold);
    const nextDay = applyRun(first.save, cursed, '2026-01-02');
    expect(nextDay.gold).toBe(first.gold);
    expect(applyRun(defaultSave(), run({ gold: 1000 }), '2026-01-01').gold).toBe(1000); // under the run cap: face value
    const deep = applyRun(defaultSave(), run({ gold: 2000 }), '2026-01-01').gold;
    expect(deep).toBeLessThan(2000); // a single deep run does not buy the Keep
    expect(deep).toBeGreaterThan(RUNES.runGoldCap);
    expect(applyRun(defaultSave(), run({ gold: 1e6 }), '2026-01-01').gold).toBeLessThanOrEqual(RUNES.runGoldCap * 2);
    const trial = applyRun(defaultSave(), run({ gold: 2000, daily: '2026-01-01' }), '2026-01-01');
    expect(trial.gold).toBe(RUNES.dailyCaps.trialGold);
    const raised = applyRun({ ...defaultSave(), meta: { dailyCap: 1 } }, run({ gold: 2000, daily: '2026-01-01' }), '2026-01-01');
    expect(raised.gold).toBe(RUNES.dailyCaps.trialGold + META.dailyCap.perRank);
  });
});

describe('the Keep: buildings, caps and costs', () => {
  it('every upgrade belongs to exactly one building; buildings need gold, Runes and a deed', () => {
    for (const id of META_IDS) expect(BUILDING_IDS.filter((b) => BUILDINGS[b].upgrades.includes(id))).toHaveLength(1);
    for (const b of BUILDING_IDS) for (const l of BUILDINGS[b].levels) if (l.achievement) expect(ACHIEVEMENTS.some((a) => a.id === l.achievement)).toBe(true);
    const poor = { ...defaultSave(), gold: 5000, runes: 20 };
    expect(buyBuilding(poor, 'armory')).toBe(poor); // the deed is missing
    const deeded: Save = { ...poor, achievements: ['firstBlood'] };
    const raised = buyBuilding(deeded, 'armory');
    expect(raised.buildings.armory).toBe(1);
    expect(raised.gold).toBe(5000 - BUILDINGS.armory.levels[0].gold);
    expect(raised.runes).toBe(20 - BUILDINGS.armory.levels[0].runes);
    expect(buyBuilding({ ...deeded, runes: 0 }, 'armory')).toEqual(expect.objectContaining({ buildings: {} }));
  });

  it('a building level caps its tracks; the top ranks cost Runes', () => {
    expect(rankCap('hp', {})).toBe(2);
    expect(rankCap('hp', { armory: 3 })).toBe(META.hp.max);
    expect(metaCost('hp', 2, {})).toBeNull(); // capped by the ruin
    expect(metaCost('hp', 2, { armory: 2 })).not.toBeNull();
    expect(metaCost('hp', 0)!.runes).toBe(0);
    expect(metaCost('hp', META.hp.runesFrom!)!.runes).toBe(META.hp.runeCost);
    const rich = { ...defaultSave(), gold: 9999, runes: 0, buildings: { armory: 3 }, meta: { hp: 2 } };
    expect(buyMeta(rich, 'hp')).toBe(rich); // no Runes
    expect(buyMeta({ ...rich, runes: 1 }, 'hp').meta.hp).toBe(3);
    const total = totalKeepCost();
    expect(total.gold).toBeGreaterThan(10000);
    expect(total.runes).toBeGreaterThan(50);
  });

  it('the Library caps talent rows, the Chapel caps relic tiers, the Watchtower gates tiers', () => {
    expect(TALENT_ROW_CAP[0]).toBe(2); // v0.5: three rows open on a fresh save
    const g = createGame('paladin', 1, { libraryLevel: 0 });
    g.talentPoints = 9;
    const plan = branchPlan('paladin', 0);
    for (const id of plan.slice(0, 6)) expect(spendTalent(g, id)).toBe(true);
    expect(spendTalent(g, plan[6])).toBe(false); // the keystone needs Library level 1
    const open = createGame('paladin', 1, { libraryLevel: 1 });
    open.talentPoints = 9;
    for (const id of plan) expect(spendTalent(open, id)).toBe(true); // keystone included
    expect(buildingLevel({ watchtower: 2 }, 'watchtower')).toBe(2);
  });
});

describe('mastery: 25 named ranks, and the account level', () => {
  it('every rank has a name, a reward text and a rising threshold; the bonuses add up', () => {
    expect(MASTERY).toHaveLength(25);
    for (let i = 0; i < MASTERY.length; i++) {
      expect(MASTERY[i].name.length).toBeGreaterThan(0);
      expect(rewardText(MASTERY[i].reward).length).toBeGreaterThan(0);
      if (i > 0) expect(MASTERY[i].xp).toBeGreaterThan(MASTERY[i - 1].xp);
    }
    expect(masteryRank(MASTERY[9].xp)).toBe(10);
    const b = masteryBonus(MASTERY[24].xp);
    expect(b.titles).toEqual(['Initiate', 'Veteran', 'Master', 'Grandmaster']);
    expect(b.palettes).toEqual([1, 2, 3]);
    expect(b.treasureStep).toBe(2);
    expect(masteryBonus(MASTERY[4].xp).utilityTier).toBe(true);
    expect(masteryBonus(MASTERY[3].xp).utilityTier).toBe(false);
    const g = createGame('archer', 1, { classXp: MASTERY[24].xp });
    expect(g.player.level).toBe(2); // Seasoned
    expect(g.talentPoints).toBe(1); // Prodigy
    expect(g.baseMods.utilityCd).toBeCloseTo(0.85); // three times Quick Hands
  });

  it('the account level sums the ranks and its milestones give account-wide perks', () => {
    expect(accountLevel([0, 0, 0, 0, 0])).toBe(0);
    expect(accountLevel(CLASS_ORDER.map(() => MASTERY[24].xp))).toBe(125);
    expect(accountPerks(9).reroll).toBe(0);
    expect(accountPerks(25).reroll).toBe(1);
    expect(accountPerks(100).mods.damage).toBeCloseTo(1.1);
    expect(accountPerks(75).talentPoint).toBe(1);
    expect(ACCOUNT_MILESTONES.map((m) => m.level)).toEqual([10, 25, 50, 75, 100]);
    const g = createGame('viking', 1, { accountLevel: 100 });
    expect(g.rerolls).toBe(2);
    expect(g.baseMods.gold).toBeCloseTo(1.05);
  });
});

describe('save migration v3 -> v4', () => {
  it('a v0.3 save keeps everything and is granted a Rune per achievement; a v4 save keeps its Runes and buildings', () => {
    const v3 = { ...defaultSave(), version: 3, gold: 500, achievements: ['firstBlood', 'wave10', 'bossSlayer'], meta: { hp: 2, relicSlot: 1 } } as unknown as Record<string, unknown>;
    delete v3.runes;
    delete v3.buildings;
    delete v3.dailyGold;
    const s = migrate(v3);
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.gold).toBe(500);
    expect(s.runes).toBe(3);
    expect(s.meta).toEqual({ hp: 2, relicSlot: 1 }); // the old seventh slot is now the tier III vault
    expect(s.buildings).toEqual({});
    expect(migrate(s)).toEqual(s); // idempotent
    const v4 = { ...s, runes: 7, buildings: { armory: 2, chapel: 9 } };
    expect(migrate(v4).runes).toBe(7);
    expect(migrate(v4).buildings).toEqual({ armory: 2, chapel: BUILDINGS.chapel.levels.length });
  });
});
