import { describe, expect, it } from 'vitest';
import { ABILITY_TRACKS } from '../src/config/abilityUpgrades';
import { CHAMPION, CHAMPION_STAT_KEYS, CHAMPION_STATS } from '../src/config/champion';
import { CLASSES, CLASS_ORDER } from '../src/config/classes';
import { talentsFor } from '../src/config/talents';
import { UTILITY_TRACKS } from '../src/config/utility';
import { createGame, summarizeRun } from '../src/game';
import { newChampion, readChampion, type Champion } from '../src/logic/champions';
import {
  botBuild, buildOf, buildStats, buyAbilityTier, buyUtilityTier, championStep, clearXp, expectedChampionLevel, grantXp, inRun, levelCap, levelForXp,
  levelProgress, levelXp, pointGives, resetPoints, spendStat, spendTalent, statPointsFree, talentPointsFree, xpForLevel, xpFromWorld, xpToNext,
} from '../src/logic/championLevels';
import { checkpoint, newRealmRun } from '../src/logic/realmRun';
import { applyRun, defaultSave, migrate } from '../src/logic/save';
import { utilityUnlocked } from '../src/systems/utility';
import { gainXp } from '../src/systems/leveling';
import { takeCarry } from '../src/systems/levels';
import { updateSpawning } from '../src/systems/spawning';

/** A champion of `classId` at `level`, with the XP that level takes. */
const at = (classId: 'paladin' | 'viking' | 'archer', level: number, world: Champion['world'] = { marches: [7], ironHold: [5], barrowvale: [5], cinderlands: [5], frozenPass: [5] }): Champion =>
  ({ ...newChampion(classId), world, xp: xpForLevel(level), level });

describe('champion levels: XP, the cap and the curve (#238)', () => {
  it('the cap is 5 + 5 per crown held on any tier, never past 30', () => {
    expect(levelCap({})).toBe(5);
    expect(levelCap({ marches: [6] })).toBe(5); // not crowned yet
    expect(levelCap({ marches: [7] })).toBe(10);
    expect(levelCap({ marches: [0, 7], ironHold: [5] })).toBe(15); // a crown on Knight counts
    expect(levelCap({ marches: [7], ironHold: [5], barrowvale: [5], cinderlands: [5], frozenPass: [5], stormspire: [5], hallowedReach: [5] })).toBe(CHAMPION.cap.max);
  });

  it('a level costs more XP than the one before, up to a ceiling; XP past the cap waits for the next crown', () => {
    expect([1, 2, 3].map(xpToNext)).toEqual([180, 360, 540]); // #243: fitted to the longer levels
    expect(xpToNext(20)).toBe(CHAMPION.xp.most);
    expect(levelForXp(xpForLevel(4))).toBe(4);
    expect(levelForXp(xpForLevel(4) - 1)).toBe(3);
    let c = grantXp(newChampion('paladin'), xpForLevel(8));
    expect(c.level).toBe(5); // no crown: held at 5
    expect(levelProgress(c)).toMatchObject({ level: 5, cap: 5, capped: true });
    c = grantXp({ ...c, world: { marches: [7] } }); // the crown raises the cap: the XP that waited becomes levels
    expect(c.level).toBe(8);
  });

  it('the Marches pay about a level per level: 8 or 9 at the crown, as enemy scaling expects', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map((l) => levelXp('marches', l))).toEqual([252, 612, 768, 816, 864, 822, 912]); // #243: waves 1-6, 7-12, 13-18, 19-24, 25-30, 31-35, 36-40
    let xp = 0;
    const levels = [1, 2, 3, 4, 5, 6, 7].map((l) => levelForXp((xp += levelXp('marches', l)), 30));
    expect(levels.slice(0, 4)).toEqual([2, 3, 4, 5]);
    expect(levels[6]).toBeGreaterThanOrEqual(8);
    expect(levels[6]).toBeLessThanOrEqual(9);
    expect([1, 4, 5, 7].map((l) => expectedChampionLevel('marches', l))).toEqual([1, 4, 5, 5]); // 5 is the cap before its crown
    expect([1, 5].map((l) => expectedChampionLevel('ironHold', l))).toEqual([8, 10]);
    expect(expectedChampionLevel('frozenPass', 1)).toBe(15);
    expect(expectedChampionLevel('lastBastion', 1)).toBe(30);
  });

  it('enemies scale to the champion level a level expects: eased in the Marches, up in a relic realm', () => {
    expect(championStep('marches', 1).hp).toBeLessThan(1); // a level-1 champion all level long, where a run grew to level 6
    expect(championStep('marches', 1).hp).toBeGreaterThan(0.4); // #220: against the pace as the level ends
    expect(championStep('ironHold', 1).hp).toBeGreaterThan(2); // a level-8 champion walks into waves 1-8
    expect(championStep('ironHold', 1).hp).toBeGreaterThan(championStep('ironHold', 5).hp);
    const g = createGame('paladin', 1, { tier: 1, level: { realm: 'ironHold', level: 1 } });
    expect(g.tier.enemyHp).toBeGreaterThan(createGame('paladin', 1, { tier: 1 }).tier.enemyHp);
  });

  it('a replayed level banks a quarter of what it collected', () => {
    expect(clearXp(200, true)).toBe(200);
    expect(clearXp(200, false)).toBe(50);
  });
});

describe('champion levels: points (#238)', () => {
  it('each level gives 3 stat points and a talent point; the four stats are the class\'s own', () => {
    const c = at('paladin', 3);
    expect([statPointsFree(c), talentPointsFree(c), talentPointsFree(c, 2)]).toEqual([6, 2, 4]);
    for (const id of CLASS_ORDER) {
      expect(CHAMPION_STAT_KEYS[id]).toEqual({ strength: CLASSES[id].attack.scaling, dexterity: 'atkSpd', focus: 'secondary', vitality: 'hp' });
      for (const s of CHAMPION_STATS) expect(pointGives(id, s).amount).toBeGreaterThan(0);
    }
    expect(pointGives('paladin', 'strength')).toMatchObject({ key: 'str', amount: 10, text: '+10 Strength' });
    expect(pointGives('archer', 'strength')).toMatchObject({ key: 'dex', text: '+10 Dexterity' });
    expect(pointGives('paladin', 'focus').text).toBe('+6 Faith');
    expect(pointGives('paladin', 'dexterity').text).toBe('+32% Attack Speed');
  });

  it('a point is spent while there is one; an ability or utility tier costs 2, in tier order, one option per tier', () => {
    let c = at('viking', 2); // 3 points
    const [a, b] = ABILITY_TRACKS.viking[0];
    expect(buyAbilityTier(c, 'viking', ABILITY_TRACKS.viking[1][0])).toBe(c); // tier 2 before tier 1
    c = buyAbilityTier(c, 'viking', a);
    expect(c.upgrades).toEqual([a]);
    expect(statPointsFree(c)).toBe(1);
    expect(buyAbilityTier(c, 'viking', b)).toBe(c); // the tier's other option
    expect(buyUtilityTier(c, 'viking', UTILITY_TRACKS.viking[0][0])).toBe(c); // 1 point: too poor
    c = spendStat(c, 'vitality');
    expect(c.points).toEqual({ vitality: 1 });
    expect(spendStat(c, 'strength')).toBe(c); // none left
    const rich = at('viking', 4);
    const u = buyUtilityTier(rich, 'viking', UTILITY_TRACKS.viking[0][1]);
    expect(u.utilityUpgrades).toEqual([UTILITY_TRACKS.viking[0][1]]);
    expect(buyUtilityTier(u, 'viking', UTILITY_TRACKS.viking[1][0], 1)).toBe(u); // the second tier is a mastery unlock
    expect(buyUtilityTier(u, 'viking', UTILITY_TRACKS.viking[1][0], 2).utilityUpgrades).toHaveLength(2);
  });

  it('talent points are spent by hand, by the tree\'s rules', () => {
    const [first, second] = talentsFor('viking').filter((n) => n.row === 0).map((n) => n.id);
    const deep = talentsFor('viking').find((n) => n.row === 1)!.id;
    let c = at('viking', 2); // one point
    expect(spendTalent(c, 'viking', deep)).toBe(c); // needs its row-0 talent
    expect(spendTalent(c, 'viking', talentsFor('paladin')[0].id)).toBe(c); // another class's
    c = spendTalent(c, 'viking', first);
    expect(c.talents).toEqual([first]);
    expect(spendTalent(c, 'viking', second)).toBe(c); // no point left
    expect(spendTalent(c, 'viking', second, 1).talents).toEqual([first, second]); // the account's bonus point
  });

  it('points are reset for free, but not inside a realm run', () => {
    let c = spendStat(spendTalent(at('viking', 3), 'viking', talentsFor('viking')[0].id), 'strength');
    const free = resetPoints(c);
    expect([free.points, free.talents, free.upgrades, statPointsFree(free)]).toEqual([{}, [], [], 6]);
    const g = createGame('viking', 5, { level: { realm: 'marches', level: 1, champion: buildOf(c) } });
    c = { ...c, runs: { marches: checkpoint(newRealmRun(0, 5), 'marches', takeCarry(g), 6)! } };
    expect(inRun(c)).toBe(true);
    expect(resetPoints(c)).toBe(c);
  });

  it('the bot spends every point it can: tiers where config says, the rest on stats, talents down a branch', () => {
    for (const id of CLASS_ORDER) {
      const b = botBuild(id, 8);
      expect(b.upgrades).toHaveLength(3);
      expect(b.utilityUpgrades).toHaveLength(1);
      expect(Object.values(b.points).reduce((n, v) => n + v, 0)).toBe(7 * CHAMPION.statPoints - 4 * CHAMPION.tierCost);
      expect(b.talents).toHaveLength(7);
    }
    expect(botBuild('paladin', 1)).toMatchObject({ level: 1, points: {}, upgrades: [], talents: [] });
  });
});

describe('champion levels: in a level (#238)', () => {
  it('a level never levels up: its XP counts up and nothing is queued', () => {
    const g = createGame('paladin', 3, { level: { realm: 'marches', level: 1 } });
    gainXp(g, 5000);
    expect(g.player.level).toBe(1);
    expect([g.pendingLevelUps, g.pendingAbilityTiers, g.pendingUtilityTiers, g.talentPoints]).toEqual([0, [], [], 0]);
    expect(summarizeRun(g).realmLevel?.xp).toBe(5000);
    const daily = createGame('paladin', 3, { daily: '2026-09-30' }); // the Daily Trial keeps its level-ups
    gainXp(daily, 5000);
    expect(daily.player.level).toBeGreaterThan(1);
    expect(daily.pendingLevelUps).toBeGreaterThan(0);
  });

  it('the build is in the level: growth per level, the points\' stats, tiers and talents', () => {
    const talent = talentsFor('paladin')[0].id;
    let c = at('paladin', 3);
    c = spendStat(spendStat(spendStat(c, 'strength'), 'vitality'), 'dexterity');
    c = spendTalent(buyAbilityTier(c, 'paladin', ABILITY_TRACKS.paladin[0][1]), 'paladin', talent);
    const base = createGame('paladin', 3, { level: { realm: 'marches', level: 1 } }).player;
    const g = createGame('paladin', 3, { level: { realm: 'marches', level: 1, champion: buildOf(c) } });
    const p = g.player, grow = CLASSES.paladin.growth, levels = 2 * CHAMPION.runLevels;
    expect(p.level).toBe(3);
    expect(p.stats.str).toBeCloseTo(base.stats.str + grow.str * levels + 10);
    expect(p.stats.atkSpd).toBeCloseTo(base.stats.atkSpd + grow.atkSpd * levels + CLASSES.paladin.base.atkSpd * 0.32);
    expect(p.stats.hp).toBeGreaterThanOrEqual(base.stats.hp + grow.hp * levels + 80);
    expect(p.hp).toBe(p.stats.hp);
    expect(p.upgrades).toEqual([ABILITY_TRACKS.paladin[0][1]]);
    expect(p.talents).toEqual([talent]);
    expect(utilityUnlocked(p)).toBe(true); // from champion level 2
    expect(utilityUnlocked(base)).toBe(false);
    expect(buildStats('paladin', base.stats, { level: 3, points: c.points }, { level: 3, points: c.points })).toEqual(base.stats); // nothing gained: nothing added
  });

  it('points spent between two levels of a realm run apply to the next level, on top of its checkpoint', () => {
    let c = at('viking', 2, {});
    const g1 = createGame('viking', 9, { level: { realm: 'marches', level: 1, champion: buildOf(c) } });
    g1.gold += 40;
    const run = checkpoint(newRealmRun(0, 9), 'marches', takeCarry(g1), 10)!;
    expect(run.carry).toMatchObject({ level: 2, points: {} });
    const same = createGame('viking', 10, { level: { realm: 'marches', level: 2, champion: buildOf(c), carry: run.carry } });
    expect(same.player.stats).toEqual(g1.player.stats); // nothing spent since: the run as it stood
    c = spendStat(spendStat(grantXp(c, xpToNext(2)), 'strength'), 'strength'); // a level up, and two points into Strength
    const talent = talentsFor('viking')[0].id;
    c = spendTalent(c, 'viking', talent);
    const g2 = createGame('viking', 10, { level: { realm: 'marches', level: 2, champion: buildOf(c), carry: run.carry } });
    expect(g2.player.level).toBe(3);
    expect(g2.player.stats.str).toBeCloseTo(g1.player.stats.str + CLASSES.viking.growth.str * CHAMPION.runLevels + 20);
    expect(g2.player.talents).toEqual([talent]);
    expect(g2.gold).toBe(g1.gold); // the carry is still the run's
    expect(g2.level!.champion).toMatchObject({ level: 3, points: { strength: 2 } });
  });
});

describe('champion levels: the save (#238)', () => {
  const clearWave = (g: ReturnType<typeof createGame>, wave: number) => {
    g.wave = wave;
    g.breather = 0;
    g.spawnQueue.length = 0;
    g.enemies.length = 0;
    updateSpawning(g, 0.016);
  };

  it('a clear adds the level\'s XP as champion XP; a death adds none; a replay a quarter', () => {
    const g = createGame('paladin', 3, { level: { realm: 'marches', level: 1 } });
    gainXp(g, 250);
    const lost = applyRun(defaultSave(), summarizeRun(g));
    expect(lost.champion).toEqual({ xp: 0, from: 1, to: 1 });
    expect(lost.save.champions.paladin).toBeUndefined();
    clearWave(g, 6); // #243: the Marches' level 1 ends on wave 6
    const xp = summarizeRun(g).realmLevel!.xp!; // the 250, and the wave's clear XP
    expect(xp).toBeGreaterThanOrEqual(250);
    const won = applyRun(defaultSave(), summarizeRun(g));
    expect(won.champion).toEqual({ xp, from: 1, to: 2 });
    expect(won.save.champions.paladin).toMatchObject({ xp, level: 2 });
    const again = applyRun(won.save, summarizeRun(g));
    expect(again.champion.xp).toBe(Math.round(xp * CHAMPION.replayXp));
    expect(again.save.champions.paladin!.xp).toBe(xp + Math.round(xp * CHAMPION.replayXp));
  });

  it('a stored champion reads back as it was; what the points can\'t pay for is given back', () => {
    let c = spendStat(at('viking', 4), 'focus');
    c = buyAbilityTier(c, 'viking', ABILITY_TRACKS.viking[0][0]);
    c = spendTalent(c, 'viking', talentsFor('viking')[0].id);
    expect(readChampion(JSON.parse(JSON.stringify(c)), 'viking')).toEqual(c);
    const cheat = readChampion({ xp: 0, level: 30, points: { strength: 99, luck: 5 }, upgrades: ['frenzy', 'mirrorShield'], talents: ['paladin.x'] }, 'viking');
    expect(cheat).toMatchObject({ xp: 0, level: 1, points: {}, upgrades: [], talents: [] });
  });

  it('a v7 champion starts at the level its crowns and cleared levels would have given, and keeps its plan as talents', () => {
    const world = { marches: [7], ironHold: [2] };
    const plan = talentsFor('viking').filter((n) => n.row === 0).map((n) => n.id).slice(0, 2);
    const raw = { ...defaultSave(), version: 7, champions: { viking: { name: 'Sigrun', inventory: [], loadouts: {}, talentPlan: plan, world, signature: true, lastBastion: false } } };
    const c = migrate(JSON.parse(JSON.stringify(raw))).champions.viking!;
    expect(c.xp).toBe(xpFromWorld(world));
    expect(c.xp).toBe([1, 2, 3, 4, 5, 6, 7].reduce((n, l) => n + levelXp('marches', l), 0) + levelXp('ironHold', 1) + levelXp('ironHold', 2));
    expect(c.level).toBe(levelForXp(c.xp, 10)); // one crown: a cap of 10
    expect(c.level).toBeGreaterThanOrEqual(8);
    expect(c.talents).toEqual(plan);
    expect(statPointsFree(c)).toBe((c.level - 1) * 3); // nothing spent yet
    expect(migrate(JSON.parse(JSON.stringify({ ...raw, champions: { viking: { name: 'Sigrun', world: {} } } }))).champions.viking).toMatchObject({ xp: 0, level: 1 });
  });
});
