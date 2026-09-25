import { describe, expect, it } from 'vitest';
import { ACTS } from '../src/config/acts';
import { FEAT_KEYS } from '../src/config/achievements';
import { CLASS_ORDER, type ClassId } from '../src/config/classes';
import { MASTERY } from '../src/config/economy';
import { ENEMIES } from '../src/config/enemies';
import { HIDDEN_TALENTS, TALENT_BRANCHES, TALENT_BY_ID, talentsFor } from '../src/config/talents';
import { TREASURE_RULES, TREASURES, treasureDesc, treasureN } from '../src/config/treasures';
import { emit } from '../src/core/events';
import type { Game } from '../src/core/types';
import { createGame, summarizeRun, updateGame, type RunOptions } from '../src/game';
import { withAchievements } from '../src/logic/achievements';
import { masteryBonus, rewardText } from '../src/logic/economy';
import { rollBoard } from '../src/logic/quests';
import { regionAt } from '../src/logic/regions';
import { applyRun, defaultSave, migrate } from '../src/logic/save';
import { oldSave } from './fixtures/saves';
import { talentBlocker } from '../src/logic/talents';
import { advanceChain, chainStep, emptyTreasure, guardianDue, rankFor, type TreasureRecord } from '../src/logic/treasures';
import { botChoose, botStep } from '../src/sim/bot';
import { updateAbility } from '../src/systems/abilities';
import { nextAct } from '../src/systems/acts';
import { killEnemy, updatePlayerAttack } from '../src/systems/combat';
import { feat } from '../src/systems/feats';
import { skeletonCount } from '../src/systems/minions';
import { updatePickups } from '../src/systems/movement';
import { payReward, takeQuests, updateQuests } from '../src/systems/quests';
import { regionsOf } from '../src/systems/regions';
import { spawnEnemy } from '../src/systems/spawning';
import { spendTalent } from '../src/systems/talents';
import { updateTreasures } from '../src/systems/treasures';

const DT = 1 / 60;
const RANK_10 = MASTERY[9].xp;
const RANK_20 = MASTERY[19].xp;
const rec = (r: Partial<TreasureRecord> = {}): TreasureRecord => ({ ...emptyTreasure(), ...r });
/** A run of that class with its chain as given (mastery rank 10 unless said otherwise). */
const withChain = (classId: ClassId, chain: Partial<TreasureRecord>, opts: RunOptions = {}, seed = 7): Game => createGame(classId, seed, { classXp: RANK_10, chain: rec(chain), ...opts });
const openWings = (g: Game) => Object.keys(g.regionOpen).length;

/** Kills a fresh boss of that kind, as a wave's boss would be (not side content). */
function slay(g: Game, id: keyof typeof ENEMIES, wave: number): void {
  g.wave = wave;
  killEnemy(g, spawnEnemy(g, id, g.player.x + 200, g.player.y));
}

/** Walks the player into the open vault and lets the guardian wake. */
function enterVault(g: Game): void {
  const vault = regionsOf(g).find((r) => r.id === 'vault')!;
  Object.assign(g.player, { x: vault.floor.x + vault.floor.w / 2, y: vault.floor.y + vault.floor.h - 40 });
  updateTreasures(g);
}

describe('the sacred treasures are data', () => {
  it('every class has one: three tiers of numbers and text, a guardian from a mid-Act boss, three Act bosses for fragments, a trial on a feat, two follow-ups, a hidden node', () => {
    for (const id of CLASS_ORDER) {
      const t = TREASURES[id];
      expect(t.tiers).toHaveLength(3);
      expect(new Set([1, 2, 3].map((tier) => treasureDesc(id, tier))).size).toBe(3);
      expect(ENEMIES[t.guardian.from].boss).toBe(true);
      expect(ACTS.bosses).not.toContain(t.guardian.from); // a guardian never counts as an Act boss (Runes, fragments)
      for (const b of t.fragmentBosses) expect(ACTS.bosses).toContain(b);
      expect(FEAT_KEYS).toContain(t.trial.feat);
      expect(t.trial.desc).toContain(String(t.trial.n));
      expect(t.followUps).toHaveLength(2);
      expect(TALENT_BRANCHES[id].map((b) => b.id)).toContain(t.talent.branch);
    }
    expect(new Set(CLASS_ORDER.map((id) => TREASURES[id].id)).size).toBe(5);
  });

  it('mastery rank 10 opens the chain, rank 20 the tier III follow-up', () => {
    expect(rankFor(1)).toBe(10);
    expect(rankFor(2)).toBe(20);
    expect(MASTERY[19].name).toBe('Relic-Bearer');
    expect(rewardText(MASTERY[19].reward)).toMatch(/tier III/);
    expect(chainStep(rec(), masteryBonus(MASTERY[8].xp).treasureStep)).toBe('locked');
    expect(chainStep(rec(), masteryBonus(RANK_10).treasureStep)).toBe('fragments');
    expect(createGame('paladin', 1, { chain: rec() }).chain).toBeNull(); // below rank 10 the chain does not play
    expect(withChain('paladin', {}).chain?.unlocked).toBe(1);
  });
});

describe('step 1: fragments', () => {
  it('drop only from the next listed Act boss, only in a run of that class, only while fragments are due', () => {
    const g = withChain('paladin', {});
    slay(g, 'warden', 10); // the Paladin's first fragment is the Dragon's
    slay(g, 'blackKnight', 5);
    expect(g.pickups.some((k) => k.kind === 'fragment')).toBe(false);
    slay(g, 'dragon', 10);
    const shard = g.pickups.find((k) => k.kind === 'fragment')!;
    expect(shard).toBeDefined();
    Object.assign(g.player, { x: shard.x, y: shard.y });
    updatePickups(g, DT);
    expect(g.chain).toMatchObject({ fragments: 1, found: 1 });
    // the next one is the Warden's: another Dragon drops nothing
    slay(g, 'dragon', 10);
    expect(g.pickups.some((k) => k.kind === 'fragment')).toBe(false);
    // locked (below rank 10), or all three found: nothing
    for (const h of [createGame('paladin', 7, { chain: rec() }), withChain('paladin', { fragments: 3 })]) {
      slay(h, 'dragon', 10);
      expect(h.pickups.some((k) => k.kind === 'fragment')).toBe(false);
    }
    // the run reports it, and only the Paladin's record moves
    const { save } = applyRun(defaultSave(), summarizeRun(g));
    expect(save.treasures.paladin.fragments).toBe(1);
    for (const id of CLASS_ORDER.filter((c) => c !== 'paladin')) expect(save.treasures[id]).toEqual(emptyTreasure());
  });

  it('a fragment left on the field is swept up with the Act; a quest may pay one in place of a Rune', () => {
    const g = withChain('viking', {});
    slay(g, 'dragon', 10);
    nextAct(g);
    expect(g.chain?.fragments).toBe(1);

    let seed = 1;
    while (!rollBoard(seed, 1).some((q) => q.reward === 'rune')) seed++;
    expect(rollBoard(seed, 1, true).filter((q) => q.reward === 'fragment')).toHaveLength(1);
    expect(rollBoard(seed, 1, true).map((q) => q.kind)).toEqual(rollBoard(seed, 1).map((q) => q.kind)); // same quests
    expect(withChain('angel', {}, {}, seed).quests.some((q) => q.reward === 'fragment')).toBe(true);
    expect(createGame('angel', seed).quests.some((q) => q.reward === 'fragment')).toBe(false);
    const h = withChain('angel', { fragments: 3 });
    const runes = h.questRunes;
    payReward(h, 'fragment'); // past the third it is a Rune
    expect(h.chain?.fragments).toBe(3);
    expect(h.questRunes).toBe(runes + 1);
  });
});

describe('step 2: the trial', () => {
  it('is offered only at step 2, as a free extra card on the board', () => {
    expect(withChain('paladin', { fragments: 2 }).quests.some((q) => q.kind === 'trial')).toBe(false);
    expect(withChain('paladin', { fragments: 3, trial: true }).quests.some((q) => q.kind === 'trial')).toBe(false);
    const g = withChain('paladin', { fragments: 3 });
    const board = g.quests.filter((q) => q.state === 'offered');
    expect(board).toHaveLength(4);
    expect(board[3]).toMatchObject({ kind: 'trial', reward: 'trial', name: TREASURES.paladin.trial.name, since: TREASURES.paladin.trial.n });
    takeQuests(g, [0, 1, 2, 3]);
    expect(g.quests.filter((q) => q.state === 'active').map((q) => q.kind)).toEqual([board[0].kind, board[1].kind, 'trial']); // two plus the trial
  });

  it('counts the class feat this Act only; done, it passes the chain on (this run too)', () => {
    const g = withChain('paladin', { fragments: 3 });
    takeQuests(g, [3]);
    const trial = g.quests[0];
    feat(g, 'absorb', 250);
    updateQuests(g, DT);
    expect(trial.progress).toBe(250);
    expect(trial.state).toBe('active');
    feat(g, 'absorb', TREASURES.paladin.trial.n);
    updateQuests(g, DT);
    expect(trial.state).toBe('done');
    expect(g.chain).toMatchObject({ trial: true, passed: true });
    expect(applyRun(defaultSave(), summarizeRun(g)).save.treasures.paladin.trial).toBe(true);
    // a new Act starts the count again
    const h = withChain('archer', { fragments: 3 });
    feat(h, 'volleyHits', 99);
    nextAct(h);
    expect(h.actFeats).toEqual({});
    expect(h.feats.volleyHits).toBe(99);
  });
});

describe('step 3: the vault and its guardian', () => {
  it('the vault opens after the mid-Act boss only once the trial is passed, with the east wing', () => {
    const early = withChain('paladin', { fragments: 3 });
    slay(early, 'blackKnight', 5);
    expect(early.regionOpen.vault).toBeFalsy();
    const g = withChain('paladin', { fragments: 3, trial: true });
    slay(g, 'dragon', 10); // an Act boss does not open it
    expect(g.regionOpen.vault).toBeFalsy();
    slay(g, 'blackKnight', 5);
    expect(g.regionOpen.vault).toBe(true);
    expect(g.regionOpen.east).toBe(true);
    expect(g.banner.text).toMatch(/vault/);
  });

  it('the guardian wakes inside when you walk in: renamed, tinted, x2.5 HP, side; slain it pays Runes and a relic, opens no wing and earns tier I', () => {
    const g = withChain('necromancer', { fragments: 3, trial: true });
    slay(g, 'blackKnight', 5);
    const plain = spawnEnemy(g, TREASURES.necromancer.guardian.from, 0, 0);
    plain.dead = true;
    enterVault(g);
    const e = g.chain!.guardian!;
    expect(e.def.name).toBe(TREASURES.necromancer.guardian.name);
    expect(e.def.palette).toBe(TREASURES.necromancer.guardian.palette);
    expect(e.maxHp).toBe(Math.round(plain.maxHp * TREASURE_RULES.guardianHp));
    expect(e.side).toBe(true);
    expect(regionAt(regionsOf(g), e.x, e.y)?.id).toBe('vault');
    updateTreasures(g); // only one
    expect(g.enemies.filter((x) => x.def.name === e.def.name)).toHaveLength(1);
    const wings = openWings(g);
    const offers = g.player.relics.offers.length;
    killEnemy(g, e);
    expect(openWings(g)).toBe(wings);
    expect(g.player.relics.offers.length).toBe(offers); // v0.7: a side boss is not a relic moment
    expect(g.questRunes).toBe(TREASURE_RULES.guardianRunes);
    expect(g.chain?.slain).toBe(true);
    const { save, runes } = applyRun(defaultSave(), summarizeRun(g));
    expect(save.treasures.necromancer.tier).toBe(1);
    expect(runes).toBeGreaterThanOrEqual(TREASURE_RULES.guardianRunes);
    // slain, it does not come back this run
    slay(g, 'lich', 15);
    expect(guardianDue('necromancer', g.chain!, g.tierIndex)).toBe(false);
  });

  it('swept away with the Act, the guardian waits for the next opening', () => {
    const g = withChain('viking', { fragments: 3, trial: true });
    slay(g, 'blackKnight', 5);
    enterVault(g);
    expect(g.chain?.guardian).not.toBeNull();
    nextAct(g);
    updateTreasures(g);
    expect(g.chain?.guardian).toBeNull();
    expect(g.regionOpen.vault).toBeFalsy();
    slay(g, 'warlord', 15);
    expect(g.regionOpen.vault).toBe(true);
  });
});

describe('the follow-ups', () => {
  it('tier II: carry it through two Acts; tier III: rank 20, then the guardian again on Knight or higher', () => {
    const ctx = { unlocked: 1, difficulty: 0, acts: 2 };
    const run = { found: 0, passed: false, slain: false, carried: 1 };
    expect(advanceChain('archer', rec({ tier: 1 }), run, ctx).tier).toBe(2);
    expect(advanceChain('archer', rec({ tier: 1 }), run, { ...ctx, acts: 1 }).tier).toBe(1);
    expect(advanceChain('archer', rec({ tier: 1 }), { ...run, carried: 0 }, ctx).tier).toBe(1);
    const slain = { ...run, slain: true };
    expect(advanceChain('archer', rec({ tier: 2 }), slain, { unlocked: 2, difficulty: 1, acts: 0 }).tier).toBe(3);
    expect(advanceChain('archer', rec({ tier: 2 }), slain, { unlocked: 2, difficulty: 0, acts: 0 }).tier).toBe(2);
    expect(advanceChain('archer', rec({ tier: 2 }), slain, { unlocked: 1, difficulty: 3, acts: 0 }).tier).toBe(2);
    expect(advanceChain('archer', rec({ tier: 3 }), slain, { unlocked: 2, difficulty: 3, acts: 9 }).tier).toBe(3);
    // in a run: the vault opens again only when the tier III goal's other parts hold
    const ready = { ...rec({ fragments: 3, trial: true, tier: 2 }), unlocked: 2, slain: false };
    expect(guardianDue('archer', ready, 1)).toBe(true);
    expect(guardianDue('archer', ready, 0)).toBe(false);
    expect(guardianDue('archer', { ...ready, unlocked: 1 }, 1)).toBe(false);
    expect(guardianDue('archer', { ...ready, tier: 1 }, 3)).toBe(false);
    const g = withChain('archer', { fragments: 3, trial: true, tier: 2 }, { classXp: RANK_20, tier: 1, treasure: 2 });
    slay(g, 'blackKnight', 5);
    enterVault(g);
    killEnemy(g, g.chain!.guardian!);
    const base = defaultSave();
    const before = { ...base, classes: { ...base.classes, archer: { ...base.classes.archer, xp: RANK_20 } }, treasures: { ...base.treasures, archer: rec({ fragments: 3, trial: true, tier: 2 }) } };
    expect(applyRun(before, summarizeRun(g)).save.treasures.archer.tier).toBe(3);
  });
});

describe('the effects: build-defining, per tier', () => {
  it('the Holy Grail: when Divine Shield ends, heals part of what it soaked, and leaves holy ground', () => {
    const heal = [1, 2, 3].map((tier) => {
      const g = createGame('paladin', 1, { treasure: tier });
      const p = g.player;
      Object.assign(p, { hp: 1, absorbed: 400, abilityTime: DT / 2 });
      updateAbility(g, DT);
      expect(g.fields.find((f) => !f.hostile)?.life).toBe(treasureN('paladin', tier).ground);
      return p.hp - 1;
    });
    expect(heal[0]).toBeCloseTo(400 * 0.2 + createGame('paladin', 1).player.stats.hp * 0.01 * 5, 5);
    expect(heal[1]).toBeGreaterThan(heal[0]);
    expect(heal[2]).toBeGreaterThan(heal[1]);
    const bare = createGame('paladin', 1);
    Object.assign(bare.player, { hp: 1, absorbed: 400, abilityTime: DT / 2 });
    updateAbility(bare, DT);
    expect(bare.player.hp).toBe(1);
  });

  it("Mjölnir's Shard: during Rage a hit may call lightning that chains to 3 / 4 / 5 enemies", () => {
    const struck = [1, 2, 3].map((tier) => {
      const g = createGame('viking', 1, { treasure: tier });
      g.rng = Object.assign(() => 0, { s: 0 }); // the proc always fires
      g.player.abilityTime = 3;
      const foes = Array.from({ length: 8 }, (_, i) => spawnEnemy(g, 'knight', g.player.x + 100 + i * 60, g.player.y));
      for (const e of foes) g.hash.insert(e);
      emit(g, 'onHit', { enemy: foes[0], amount: 20, crit: false, source: 'attack' });
      return foes.filter((e) => e.hp < e.maxHp).length;
    });
    expect(struck).toEqual([3, 4, 5]);
    const calm = createGame('viking', 1, { treasure: 3 });
    calm.rng = Object.assign(() => 0, { s: 0 });
    const e = spawnEnemy(calm, 'knight', calm.player.x + 100, calm.player.y);
    const f = spawnEnemy(calm, 'knight', calm.player.x + 150, calm.player.y);
    calm.hash.insert(e);
    calm.hash.insert(f);
    emit(calm, 'onHit', { enemy: e, amount: 20, crit: false, source: 'attack' }); // no Rage: nothing
    expect(f.hp).toBe(f.maxHp);
  });

  it('the Halo of Dawn: Radiance leaves a sun that lasts longer per tier and grows with Grace', () => {
    for (const tier of [1, 2, 3]) {
      const g = createGame('angel', 1, { treasure: tier });
      g.player.stats.secondary = 10;
      emit(g, 'onAbilityUsed', { cooldown: 10 });
      const sun = g.fields.find((f) => !f.hostile)!;
      const n = treasureN('angel', tier);
      expect(sun.life).toBe(n.time);
      expect(sun.r).toBe(n.radius + 10 * n.perGrace);
      expect(sun.heal).toBe(n.heal);
    }
  });

  it('the Book of the Dead: +1 / +2 / +3 minions, and the fallen explode harder with Soul Power', () => {
    for (const tier of [1, 2, 3]) {
      const g = createGame('necromancer', 1, { treasure: tier });
      const base = g.player.mods.minionMax;
      g.input.ability = true;
      updateAbility(g, DT);
      updateTreasures(g);
      expect(g.player.mods.minionMax).toBe(base + tier);
      const n = treasureN('necromancer', tier);
      for (const m of g.minions) expect(m.volatile).toBeCloseTo(n.blast + n.perSoul * g.player.stats.secondary);
    }
  });

  it('the Bow of the Wild Hunt: every 7th / 6th / 5th arrow splits in three (sooner with Focus); the Volley calls 1 / 2 / 3 hounds', () => {
    for (const tier of [1, 2, 3]) {
      const g = createGame('archer', 1, { treasure: tier });
      updateTreasures(g);
      const every = treasureN('archer', tier).every;
      expect(g.vars.splitEvery).toBe(every);
      const e = spawnEnemy(g, 'knight', g.player.x + 150, g.player.y);
      e.hp = e.maxHp = 1e9;
      g.hash.insert(e);
      for (let i = 0; i < every; i++) {
        g.player.attackTimer = 0;
        updatePlayerAttack(g, DT);
      }
      expect(g.projectiles.length).toBe(every + 2);
      emit(g, 'onAbilityUsed', { cooldown: 10 });
      expect(g.minions.filter((m) => m.kind === 'hound')).toHaveLength(tier);
      expect(skeletonCount(g)).toBe(0); // hounds take no skeleton slots
      g.player.stats.secondary = 40;
      updateTreasures(g);
      expect(g.vars.splitEvery).toBe(3);
    }
  });
});

describe('the hidden talent node', () => {
  it('exists only with the treasure equipped: shown, takeable, and the bot takes it', () => {
    expect(HIDDEN_TALENTS).toHaveLength(5);
    const id = 'paladin.treasure';
    expect(TALENT_BY_ID[id].treasure).toBe('holyGrail');
    expect(talentsFor('paladin').map((n) => n.id)).not.toContain(id);
    expect(talentsFor('paladin', 'holyGrail').map((n) => n.id)).toContain(id);
    expect(talentsFor('paladin', 'holyGrail')).toHaveLength(22);
    expect(talentBlocker([], id, 3)).toMatch(/sacred treasure/);
    expect(talentBlocker([], id, 3, undefined, 'holyGrail')).toBeNull();
    const bare = createGame('paladin', 1);
    bare.player.talentPoints = 1;
    expect(spendTalent(bare, id)).toBe(false);
    const g = createGame('paladin', 1, { treasure: 1 });
    g.player.talentPoints = 1;
    const faith = g.player.stats.secondary;
    botChoose(g);
    expect(g.player.talents).toEqual([id]);
    expect(g.player.stats.secondary).toBe(faith + 2);
  });
});

describe('the save', () => {
  it('migrates treasureSteps into fragments, validates the record and round-trips', () => {
    const old = { ...oldSave('v0.4.0'), treasureSteps: { paladin: 1, viking: 0, angel: 5, necromancer: 0, archer: 0 } };
    const save = migrate(old);
    expect(save.treasures.paladin).toEqual(rec({ fragments: 1 }));
    expect(save.treasures.angel.fragments).toBe(3);
    expect(save.treasures.viking).toEqual(emptyTreasure());
    expect(migrate(JSON.parse(JSON.stringify(save)))).toEqual(save);
    const odd = migrate({ ...defaultSave(), treasures: { paladin: { fragments: 9, trial: 'yes', tier: 7, equipped: false } } });
    expect(odd.treasures.paladin).toEqual({ fragments: 3, trial: false, tier: 3, equipped: false });
  });

  it('a gold mastery deed pays a fragment of that class (a Rune once all three are found); Keeper of Relics counts treasures', () => {
    const base = defaultSave();
    const ranked = { ...base, classes: { ...base.classes, paladin: { ...base.classes.paladin, xp: RANK_20 } } };
    expect(withAchievements(ranked).save.treasures.paladin.fragments).toBe(1);
    expect(withAchievements(ranked).save.treasures.viking.fragments).toBe(0);
    const full = { ...ranked, treasures: { ...ranked.treasures, paladin: rec({ fragments: 3 }) } };
    expect(withAchievements(full).save.runes).toBe(withAchievements(ranked).save.runes + 1);
    const keeper = { ...base, treasures: { ...base.treasures, paladin: rec({ tier: 1 }), viking: rec({ tier: 3 }), angel: rec({ tier: 2 }) } };
    expect(withAchievements(keeper).earned.filter((e) => e.id === 'keeperOfRelics').map((e) => e.tier)).toEqual([1, 2]);
  });
});

describe('the bot', () => {
  it('takes the trial when offered and walks into the open vault to wake the guardian', () => {
    const g = withChain('viking', { fragments: 3 });
    botChoose(g);
    expect(g.quests.some((q) => q.kind === 'trial' && q.state === 'active')).toBe(true);

    const h = withChain('archer', { fragments: 3, trial: true });
    botChoose(h);
    slay(h, 'blackKnight', 5);
    for (const f of h.features) f.used = true;
    for (const q of h.quests) q.state = 'failed';
    h.breather = 1e9; // no waves: nothing else to do
    for (let i = 0; i < 60 * 40 && !h.chain?.guardian; i++) botStep(h);
    expect(h.chain?.guardian).not.toBeNull();
  });

  it('a maxed run with the treasure plays without throwing', () => {
    for (const cls of CLASS_ORDER) {
      const g = createGame(cls, 3, { treasure: 3, classXp: RANK_20 });
      for (let i = 0; i < 60 * 15 && !g.over; i++) botStep(g);
      expect(g.time).toBeGreaterThan(0);
      updateGame(g, DT);
    }
  });
});
