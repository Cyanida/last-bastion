import { describe, expect, it } from 'vitest';
import { CLASS_ORDER } from '../src/config/classes';
import { TALENT_BRANCHES, TALENT_BY_ID, TALENTS, talentsFor } from '../src/config/talents';
import { TRAIT_IDS, TRAITS } from '../src/config/traits';
import { TALENT_CARD_CHANCE } from '../src/config/upgrades';
import { MASTERY } from '../src/config/economy';
import { UTILITIES, UTILITY, UTILITY_TRACKS, UTILITY_UPGRADES } from '../src/config/utility';
import { mulberry32 } from '../src/core/math';
import { createGame, updateGame } from '../src/game';
import { branchPlan, branchPoints, canTakeTalent, talentBlocker, talentMods, talentPointsForLevel } from '../src/logic/talents';
import { rollLevelUpOptions } from '../src/logic/upgrades';
import { gainXp, levelUpOptions, chooseLevelUp } from '../src/systems/leveling';
import { applyTrait, spendTalent } from '../src/systems/talents';
import { chooseUtilityUpgrade, updateUtility, utilityUnlocked } from '../src/systems/utility';
import { spawnEnemy } from '../src/systems/spawning';
import { xpToNext } from '../src/logic/formulas';

const DT = 1 / 60;
const levelTo = (g: ReturnType<typeof createGame>, level: number) => {
  while (g.player.level < level) gainXp(g, xpToNext(g.player.level) / Math.max(1, g.player.mods.xp));
  g.pendingLevelUps = 0;
  g.pendingAbilityTiers.length = 0;
};

describe('talent trees (v0.4)', () => {
  it('every class has three branches of seven nodes in four rows with one keystone, and every prerequisite exists', () => {
    for (const classId of CLASS_ORDER) {
      expect(TALENT_BRANCHES[classId]).toHaveLength(3);
      for (const b of TALENT_BRANCHES[classId]) {
        const nodes = talentsFor(classId).filter((n) => n.branch === b.id);
        expect(nodes).toHaveLength(7);
        expect(nodes.filter((n) => n.keystone)).toHaveLength(1);
        expect(new Set(nodes.map((n) => n.row)).size).toBe(TALENTS.rows);
        for (const n of nodes) for (const r of n.requires) expect(TALENT_BY_ID[r].branch).toBe(b.id);
      }
    }
  });

  it('a point every 3 levels', () => {
    expect(talentPointsForLevel(1)).toBe(0);
    expect(talentPointsForLevel(3)).toBe(1);
    expect(talentPointsForLevel(5)).toBe(1);
    expect(talentPointsForLevel(6)).toBe(2);
    expect(talentPointsForLevel(30)).toBe(10);
    const g = createGame('paladin', 1);
    levelTo(g, 7);
    expect(g.talentPoints).toBe(2);
  });

  it('prerequisites: a node needs one of its parents; a keystone needs 4 points in its branch; only one keystone', () => {
    const plan = branchPlan('paladin', 0); // bulwark, top to bottom
    const [a0, a1, b0, , , , k] = plan;
    expect(talentBlocker([], b0, 5)).toMatch(/needs/);
    expect(canTakeTalent([], a0, 1)).toBe(true);
    expect(canTakeTalent([], a0, 0)).toBe(false); // no points
    expect(canTakeTalent([a0], a0, 5)).toBe(false); // already taken
    expect(canTakeTalent([a0], b0, 5)).toBe(true);
    expect(canTakeTalent([a1], b0, 5)).toBe(true); // either parent
    expect(talentBlocker([a0, b0, plan[4]], k, 5)).toMatch(/points in the branch/);
    expect(canTakeTalent([a0, a1, b0, plan[4]], k, 5)).toBe(true);
    expect(branchPoints([a0, a1, b0, plan[4]], TALENT_BY_ID[a0].branch)).toBe(4);
    const zealot = branchPlan('paladin', 1);
    const withKeystone = [a0, a1, b0, plan[4], k];
    expect(talentBlocker([...withKeystone, ...zealot.slice(0, 6)], zealot[6], 9)).toMatch(/only one keystone/);
  });

  it('spending applies stats at once and mods every tick; the game refuses invalid picks', () => {
    const g = createGame('viking', 1);
    levelTo(g, 6);
    const hp = g.player.stats.hp;
    const [a0, a1, b0] = branchPlan('viking', 2); // jarl: Hardy (+30 HP), Shield Arm (+6% armor), Thick Hide
    expect(spendTalent(g, b0)).toBe(false); // needs a parent
    expect(spendTalent(g, a0)).toBe(true);
    expect(g.player.stats.hp).toBe(hp + 30);
    expect(spendTalent(g, a1)).toBe(true);
    expect(spendTalent(g, b0)).toBe(false); // out of points
    expect(g.talentPoints).toBe(0);
    updateGame(g, DT);
    expect(g.player.mods.armor).toBeCloseTo(0.06);
    expect(talentMods([a1]).armor).toBeCloseTo(0.06);
  });

  it('the bot walks a branch and reaches the keystone', () => {
    const plan = branchPlan('archer', 1);
    expect(plan).toHaveLength(7);
    expect(TALENT_BY_ID[plan[6]].keystone).toBe(true);
    const taken: string[] = [];
    for (const id of plan) {
      expect(canTakeTalent(taken, id, 1)).toBe(true);
      taken.push(id);
    }
  });
});

describe('utility abilities', () => {
  it('unlock at level 3, own cooldown, tiers at levels 8 and 14 with two-way exclusive choices', () => {
    const plain = createGame('paladin', 1);
    levelTo(plain, 14);
    expect(plain.pendingUtilityTiers).toEqual([0]); // the second tier is mastery rank 5's unlock
    const g = createGame('paladin', 1, { classXp: MASTERY[4].xp });
    g.input.utility = true;
    updateUtility(g, DT);
    expect(utilityUnlocked(g.player)).toBe(false);
    expect(g.player.utilityCd).toBe(0);
    levelTo(g, UTILITY.unlockLevel);
    expect(utilityUnlocked(g.player)).toBe(true);
    g.wave = 3;
    const e = spawnEnemy(g, 'peasant', g.player.x + 150, g.player.y);
    g.hash.clear();
    for (const en of g.enemies) g.hash.insert(en);
    updateUtility(g, DT);
    expect(g.player.utilityCd).toBeGreaterThan(0); // cast
    expect(e.tauntT).toBeGreaterThan(0); // Challenged
    expect(g.pendingUtilityTiers).toEqual([]);
    levelTo(g, 8);
    expect(g.pendingUtilityTiers).toEqual([0]);
    const [a, b] = UTILITY_TRACKS.paladin[0];
    expect(chooseUtilityUpgrade(g, UTILITY_TRACKS.paladin[1][0])).toBe(false); // wrong tier
    expect(chooseUtilityUpgrade(g, a)).toBe(true);
    expect(g.player.utilityUpgrades).toEqual([a]);
    expect(chooseUtilityUpgrade(g, b)).toBe(false); // nothing pending, and the other path is lost
    levelTo(g, 14);
    expect(g.pendingUtilityTiers).toEqual([1]);
    for (const classId of CLASS_ORDER) for (const tier of UTILITY_TRACKS[classId]) for (const id of tier) expect(UTILITY_UPGRADES[id]).toBeDefined();
    expect(Object.keys(UTILITIES)).toHaveLength(5);
  });

  it('a dash moves the player and a talent shortens the cooldown', () => {
    const g = createGame('angel', 1);
    levelTo(g, 3);
    const { x } = g.player;
    g.input.aimX = x + 500;
    g.input.aimY = g.player.y;
    g.input.utility = true;
    updateUtility(g, DT);
    expect(g.player.x - x).toBeCloseTo(UTILITIES.angel.n.range);
    expect(g.player.invulnT).toBeGreaterThan(0);
    const cd = g.player.utilityCdMax;
    const g2 = createGame('angel', 1);
    levelTo(g2, 6);
    const [farBlink] = branchPlan('angel', 2); // herald: Swift Wings first... the second node is Foresight; Far Blink is row 1
    expect(spendTalent(g2, farBlink)).toBe(true);
    expect(spendTalent(g2, branchPlan('angel', 2)[2])).toBe(true); // Far Blink: -25% cooldown
    updateGame(g2, DT);
    g2.input.aimX = g2.player.x + 500;
    g2.input.utility = true;
    updateUtility(g2, DT);
    expect(g2.player.utilityCdMax).toBeLessThan(cd);
  });
});

describe('starting traits', () => {
  it('every trait changes the run at start; locked ones name an achievement', () => {
    for (const id of TRAIT_IDS) {
      const t = TRAITS[id];
      if (id === 'none') continue;
      expect(t.mods || t.stats || t.n).toBeTruthy();
    }
    const plain = createGame('viking', 1);
    const glass = createGame('viking', 1, { trait: 'glassCannon' });
    expect(glass.player.stats.hp).toBe(Math.round(plain.player.stats.hp * 0.75));
    updateGame(glass, DT);
    expect(glass.player.mods.damage).toBeCloseTo(1.3);
    expect(glass.trait).toBe('glassCannon');
    const lucky = createGame('viking', 1);
    applyTrait(lucky, 'cursedLuck');
    expect(lucky.vars['trait.rerolls']).toBe(1); // v0.7: an extra reroll at every relic moment
    expect(TRAITS.scavenger.unlock.achievement).toBe('treasurer');
  });
});

describe('the mixed level-up pool', () => {
  it('offers talent points and relics now and then, and both take effect', () => {
    const rng = mulberry32(9);
    let talents = 0;
    let relics = 0;
    for (let i = 0; i < 400; i++) {
      for (const o of rollLevelUpOptions(rng, [], () => 'frostBrand')) {
        if (o.kind === 'talent') talents++;
        if (o.kind === 'relic') relics++;
      }
    }
    expect(talents).toBeGreaterThan(400 * TALENT_CARD_CHANCE * 0.6);
    expect(relics).toBeGreaterThan(20);
    const g = createGame('archer', 1);
    g.pendingLevelUps = 2;
    chooseLevelUp(g, { kind: 'talent' });
    expect(g.talentPoints).toBe(1);
    chooseLevelUp(g, { kind: 'relic', id: 'frostBrand' });
    expect(g.player.relics.held).toContain('frostBrand');
    expect(g.pendingLevelUps).toBe(0);
    expect(levelUpOptions(g)).toHaveLength(3);
  });
});
