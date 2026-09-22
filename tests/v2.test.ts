import { describe, expect, it } from 'vitest';
import { ABILITY_TRACKS, ABILITY_UPGRADES } from '../src/config/abilityUpgrades';
import { ACHIEVEMENTS } from '../src/config/achievements';
import { CLASS_ORDER, CLASSES } from '../src/config/classes';
import { META, META_IDS, TIERS, MASTERY } from '../src/config/economy';
import { AFFIXES, ELITES } from '../src/config/elites';
import { RELIC_IDS, RELICS, relicDef } from '../src/config/relics';
import { TRADEOFF_IDS } from '../src/config/upgrades';
import { WAVES } from '../src/config/waves';
import { mulberry32 } from '../src/core/math';
import type { Enemy, Game } from '../src/core/types';
import { createGame, summarizeRun } from '../src/game';
import { pickAbilityUpgrade, tierForLevel } from '../src/logic/abilityUpgrades';
import { lockedArenas, lockedRelics, newlyEarned, withAchievements } from '../src/logic/achievements';
import { classXpForRun, goldDrop, masteryBonus, masteryRank, metaCost, metaLoadout, rerollCost, startingStats, totalMetaCost, waveClearGold } from '../src/logic/economy';
import { applyAffixes, eliteChance, rollAffixes } from '../src/logic/elites';
import { neutralMods } from '../src/logic/mods';
import { relicPoolFor, rollRelics, withRelic } from '../src/logic/relics';
import { applyRun, buyMeta, defaultSave, exportSave, importSave, migrate, SAVE_VERSION, type RunSummary } from '../src/logic/save';
import { applyTradeoff, rollLevelUpOptions, upgradeAmount } from '../src/logic/upgrades';
import { generateWave, isBossWave } from '../src/logic/waves';
import { simulateRun } from '../src/sim/bot';
import { chooseAbilityUpgrade, updateAbility } from '../src/systems/abilities';
import { damageEnemy, damagePlayer, killEnemy } from '../src/systems/combat';
import { gainXp } from '../src/systems/leveling';
import { addRelic, updateRelics } from '../src/systems/relics';
import { spawnEnemy } from '../src/systems/spawning';

/** A headless game with some enemies placed next to the player and indexed in the spatial hash. */
function arena(classId: Parameters<typeof createGame>[0], enemies: [number, number][] = []): { g: Game; foes: Enemy[] } {
  const g = createGame(classId, 1);
  g.rng = () => 0.999; // no crits, no random procs unless a test says otherwise
  const foes = enemies.map(([dx, dy]) => spawnEnemy(g, 'knight', g.player.x + dx, g.player.y + dy));
  for (const f of foes) f.armorHp = 0; // v0.3 gave knights breakable armor; these tests are about relics, so they fight bare knights
  for (const e of g.enemies) g.hash.insert(e);
  return { g, foes };
}
const tickMods = (g: Game) => {
  g.player.mods = { ...g.baseMods };
  updateRelics(g, 1 / 60);
};

describe('relic hooks', () => {
  it('has 20+ relics in three rarities and one class relic per class', () => {
    expect(RELIC_IDS.length).toBeGreaterThanOrEqual(20);
    expect(new Set(RELIC_IDS.map((id) => relicDef(id).rarity))).toEqual(new Set(['common', 'rare', 'legendary']));
    for (const c of CLASS_ORDER) expect(RELIC_IDS.some((id) => relicDef(id).classId === c)).toBe(true);
  });

  it('plain mods apply while held', () => {
    const { g } = arena('paladin');
    addRelic(g, 'whetstone');
    tickMods(g);
    expect(g.player.mods.damage).toBeCloseTo(1.12);
  });

  it('onKill: Vampire Fang heals', () => {
    const { g, foes } = arena('viking', [[40, 0]]);
    addRelic(g, 'vampireFang');
    g.player.hp = 50;
    killEnemy(g, foes[0]);
    expect(g.player.hp).toBeCloseTo(50 + RELICS.vampireFang.n.heal);
  });

  it('onDamageTaken: Thorn Mail hurts the attacker, Reliquary shaves cooldown by Faith', () => {
    const { g, foes } = arena('paladin', [[30, 0]]);
    addRelic(g, 'thornMail');
    addRelic(g, 'reliquary');
    g.player.abilityCd = 10;
    const before = foes[0].hp;
    damagePlayer(g, 20, true, foes[0]);
    const taken = g.player.stats.hp - g.player.hp;
    expect(before - foes[0].hp).toBeCloseTo(taken * RELICS.thornMail.n.mult);
    expect(g.player.abilityCd).toBeCloseTo(10 - RELICS.reliquary.n.perFaith * g.player.stats.secondary);
  });

  it('onHit: Storm Pennant chains attacks (and only attacks) to a second enemy', () => {
    const { g, foes } = arena('archer', [[40, 0], [90, 0]]);
    addRelic(g, 'stormPennant');
    g.rng = () => 0; // proc
    damageEnemy(g, foes[0], 10);
    expect(foes[1].maxHp - foes[1].hp).toBeCloseTo(10 * RELICS.stormPennant.n.mult);
    const hp = foes[1].hp;
    damageEnemy(g, foes[0], 10, false, 0, 0, 'ability');
    expect(foes[1].hp).toBe(hp);
  });

  it('onKill: Powder Keg explodes the corpse for a share of its max HP', () => {
    const { g, foes } = arena('archer', [[40, 0], [80, 0]]);
    addRelic(g, 'powderKeg');
    g.rng = () => 0;
    killEnemy(g, foes[0]);
    expect(foes[1].maxHp - foes[1].hp).toBeCloseTo(foes[0].maxHp * RELICS.powderKeg.n.hpFrac);
  });

  it("tick: Sentinel's Stance charges while standing still and is capped", () => {
    const { g } = arena('angel');
    addRelic(g, 'sentinelStance');
    g.player.still = 1;
    tickMods(g);
    expect(g.player.mods.damage).toBeCloseTo(1 + RELICS.sentinelStance.n.perSec);
    g.player.still = 999;
    tickMods(g);
    expect(g.player.mods.damage).toBeCloseTo(1 + RELICS.sentinelStance.n.max);
  });

  it('class relics scale with the secondary stat', () => {
    const { g } = arena('archer');
    addRelic(g, 'hawkeyeQuiver');
    g.player.stats.secondary = 8;
    tickMods(g);
    expect(g.player.mods.pierce).toBe(2);
    g.player.stats.secondary = 16;
    tickMods(g);
    expect(g.player.mods.pierce).toBe(4);

    const necro = arena('necromancer').g;
    addRelic(necro, 'boneChime');
    tickMods(necro);
    const low = necro.player.mods.minionAtkSpd;
    necro.player.stats.secondary += 10;
    tickMods(necro);
    expect(necro.player.mods.minionAtkSpd).toBeGreaterThan(low);
  });

  it('Phoenix Feather revives once', () => {
    const { g } = arena('archer');
    addRelic(g, 'phoenixFeather');
    damagePlayer(g, 9999, true);
    expect(g.over).toBe(false);
    expect(g.player.hp).toBeCloseTo(g.player.stats.hp * 0.5);
    g.player.invulnT = 0;
    damagePlayer(g, 9999, true);
    expect(g.over).toBe(true);
  });

  it('bosses always offer a choice of 3, from the right pool', () => {
    const { g } = arena('paladin');
    const boss = spawnEnemy(g, 'blackKnight', 300, 300);
    killEnemy(g, boss);
    expect(g.relicOffers).toHaveLength(1);
    expect(new Set(g.relicOffers[0]).size).toBe(3);
    for (const id of g.relicOffers[0]) expect([undefined, 'paladin']).toContain(relicDef(id).classId);
  });

  it('pool and rolls (v0.4: no slot limit; a held relic at the top tier is never rolled again)', () => {
    const pool = relicPoolFor('viking', ['phoenixFeather']);
    expect(pool).toContain('wolfskin');
    expect(pool).not.toContain('reliquary');
    expect(pool).not.toContain('phoenixFeather');
    const rolled = rollRelics(pool, ['whetstone'], { whetstone: 3 }, mulberry32(3), 3);
    expect(rolled).not.toContain('whetstone');
    expect(rollRelics(['whetstone'], ['whetstone'], { whetstone: 3 }, mulberry32(3), 3)).toEqual([]);
    expect(withRelic({ whetstone: 3 }, 'whetstone')).toEqual({ whetstone: 3 });
    expect(withRelic({}, 'bloodPact')).toEqual({ bloodPact: 1 });
  });
});

describe('ability upgrade selection', () => {
  it('every class has 3 tiers of 2 distinct options, and every upgrade belongs to exactly one slot', () => {
    const all = CLASS_ORDER.flatMap((c) => ABILITY_TRACKS[c].flat());
    expect(all).toHaveLength(30);
    expect(new Set(all)).toEqual(new Set(Object.keys(ABILITY_UPGRADES)));
  });

  it('tiers unlock at levels 5, 10 and 15', () => {
    expect([1, 5, 6, 10, 15, 16].map(tierForLevel)).toEqual([-1, 0, -1, 1, 2, -1]);
    const { g } = arena('angel');
    gainXp(g, 100000);
    expect(g.player.level).toBeGreaterThan(15);
    expect(g.pendingAbilityTiers).toEqual([0, 1, 2]);
  });

  it('options within a tier are mutually exclusive, and only valid picks count', () => {
    const one = pickAbilityUpgrade([], 'paladin', 0, 'mirrorShield');
    expect(one).toEqual(['mirrorShield']);
    expect(pickAbilityUpgrade(one, 'paladin', 0, 'sanctuary')).toBe(one); // other branch is gone
    expect(pickAbilityUpgrade(one, 'paladin', 1, 'sanctuary')).toBe(one); // wrong tier
    expect(pickAbilityUpgrade(one, 'paladin', 1, 'dreadHowl')).toBe(one); // wrong class
    expect(pickAbilityUpgrade(one, 'paladin', undefined, 'zeal')).toBe(one); // nothing pending
    expect(pickAbilityUpgrade(one, 'paladin', 1, 'zeal')).toEqual(['mirrorShield', 'zeal']);
  });

  it('the game only accepts a pick for the pending tier', () => {
    const { g } = arena('archer');
    expect(chooseAbilityUpgrade(g, 'ballista')).toBe(false);
    g.pendingAbilityTiers.push(0);
    expect(chooseAbilityUpgrade(g, 'pinning')).toBe(false);
    expect(chooseAbilityUpgrade(g, 'ballista')).toBe(true);
    expect(g.pendingAbilityTiers).toEqual([]);
  });

  it('upgraded abilities still scale with the secondary stat', () => {
    const shot = (focus: number) => {
      const { g } = arena('archer');
      g.player.upgrades = ['ballista'];
      g.player.stats.secondary = focus;
      g.input = { ...g.input, aimX: g.player.x + 100, aimY: g.player.y, ability: true };
      updateAbility(g, 1 / 60);
      expect(g.zones).toHaveLength(0); // the volley really became one bolt
      return g.projectiles[0].damage;
    };
    expect(shot(15)).toBeGreaterThan(shot(5));

    const reflect = (faith: number) => {
      const { g, foes } = arena('paladin', [[30, 0]]);
      g.player.upgrades = ['mirrorShield'];
      g.player.stats.secondary = faith;
      g.input.ability = true;
      updateAbility(g, 1 / 60);
      damagePlayer(g, 10, true, foes[0]);
      expect(g.player.hp).toBe(g.player.stats.hp); // blocked
      return foes[0].maxHp - foes[0].hp;
    };
    expect(reflect(5)).toBeGreaterThan(0);
    expect(reflect(15)).toBeGreaterThan(reflect(5));
  });
});

describe('level-up variety', () => {
  it('rarity scales the bonus part of a boon', () => {
    expect(upgradeAmount('str', 'common')).toBe(3);
    expect(upgradeAmount('str', 'epic')).toBeGreaterThan(upgradeAmount('str', 'rare'));
    expect(upgradeAmount('atkSpd', 'epic')).toBeCloseTo(1.25);
  });

  it('offers 3 options, sometimes a tradeoff, never a tradeoff already taken', () => {
    const rng = mulberry32(5);
    let tradeoffs = 0;
    for (let i = 0; i < 300; i++) {
      const options = rollLevelUpOptions(rng, ['glassCannon']);
      expect(options).toHaveLength(3);
      for (const o of options) {
        if (o.kind !== 'tradeoff') continue;
        tradeoffs++;
        expect(o.id).not.toBe('glassCannon');
      }
    }
    expect(tradeoffs).toBeGreaterThan(20);
    expect(rollLevelUpOptions(() => 0, TRADEOFF_IDS).every((o) => o.kind !== 'tradeoff')).toBe(true); // v0.4: the pool also holds talent and relic cards
  });

  it('tradeoffs give and take, and cannot push max HP below the floor', () => {
    const base = CLASSES.archer.base;
    const glass = applyTradeoff(base, neutralMods(), 'glassCannon');
    expect(glass.mods.damage).toBeCloseTo(1.25);
    expect(glass.stats.hp).toBe(Math.round(base.hp * 0.8));
    expect(applyTradeoff({ ...base, hp: 22 }, neutralMods(), 'bloodPrice').stats.hp).toBe(20);
  });
});

describe('affix application', () => {
  const base = { hp: 100, damage: 10, speed: 60, radius: 12, xp: 2 };

  it('elites are tougher, worth more, and affixes change their stats', () => {
    const plain = applyAffixes(base, ['vampiric']);
    expect(plain).toMatchObject({ hp: 100 * ELITES.hpMult, damage: 10 * ELITES.dmgMult, speed: 60, xp: 2 * ELITES.xpMult, shield: 0 });
    expect(applyAffixes(base, ['swift']).speed).toBeCloseTo(60 * AFFIXES.swift.n.speed);
    expect(applyAffixes(base, ['shielded', 'swift']).shield).toBe(Math.round(100 * ELITES.hpMult * AFFIXES.shielded.n.frac));
  });

  it('elite chance: none early, rises with wave and tier, capped', () => {
    expect(eliteChance(ELITES.fromWave - 1, 3)).toBe(0);
    expect(eliteChance(10, 1)).toBeGreaterThan(eliteChance(5, 1));
    expect(eliteChance(10, 2)).toBeGreaterThan(eliteChance(10, 1));
    expect(eliteChance(500, 3)).toBe(ELITES.maxChance);
  });

  it('rolls 1 affix early, up to 2 distinct later', () => {
    const rng = mulberry32(11);
    for (let i = 0; i < 100; i++) expect(rollAffixes(5, rng)).toHaveLength(1);
    const late = Array.from({ length: 200 }, () => rollAffixes(20, rng));
    expect(late.some((a) => a.length === 2)).toBe(true);
    for (const a of late) expect(new Set(a).size).toBe(a.length);
  });

  it('a Shielded elite soaks damage with its barrier first; Splitting leaves copies', () => {
    const { g } = arena('paladin');
    const e = spawnEnemy(g, 'peasant', 300, 300, ['shielded', 'splitting']);
    expect(e.elite).toBe(true);
    const hp = e.hp;
    expect(damageEnemy(g, e, e.shieldMax - 1)).toBe(0);
    expect(e.hp).toBe(hp);
    damageEnemy(g, e, 11);
    expect(e.hp).toBe(hp - 10);
    const before = g.enemies.length;
    killEnemy(g, e);
    expect(g.enemies.length).toBe(before + AFFIXES.splitting.n.count);
    expect(g.elitesKilled).toBe(1);
  });

  it('waves: elites never replace the boss, modifiers start at wave 6 and skip boss waves, Siege brings crossbows', () => {
    for (let w = 1; w <= 40; w++) {
      const plan = generateWave(w, mulberry32(w), { eliteMult: 3 });
      if (plan.boss) expect(plan.elites[0]).toBeUndefined();
      if (w < WAVES.modifierFromWave || isBossWave(w)) expect(plan.modifier).toBeNull();
      if (w < ELITES.fromWave) expect(Object.keys(plan.elites)).toHaveLength(0);
    }
    const share = (mod: string | null) => {
      let ranged = 0;
      let total = 0;
      for (let s = 0; s < 300; s++) {
        const plan = generateWave(12, mulberry32(s));
        if (plan.modifier !== mod) continue;
        ranged += plan.spawns.filter((id) => id === 'crossbow').length;
        total += plan.spawns.length;
      }
      return ranged / total;
    };
    expect(share('siege')).toBeGreaterThan(share(null) * 2);
  });

  it('arenas bring their own boss rotation; the courtyard keeps the v0.1 one', () => {
    expect(generateWave(5, mulberry32(1)).boss).toBe('blackKnight');
    expect(generateWave(5, mulberry32(1), { bosses: ['abbot', 'lich'] }).boss).toBe('abbot');
  });
});

describe('gold and cost calculations', () => {
  it('Keep costs rise per rank and stop at the cap', () => {
    for (const id of META_IDS) {
      for (let r = 1; r < META[id].max; r++) expect(metaCost(id, r)!.gold).toBeGreaterThanOrEqual(metaCost(id, r - 1)!.gold);
      expect(metaCost(id, META[id].max)).toBeNull();
    }
    expect(metaCost('hp', 0)!.gold).toBe(META.hp.baseCost);
    expect(totalMetaCost()).toBeGreaterThan(5000); // a long-term goal, not one good run
  });

  it('buying deducts gold, respects the cap and poverty', () => {
    const rich = { ...defaultSave(), gold: 1000, buildings: { armory: 3, library: 3 } }; // v0.4: buildings raised, so the old caps apply
    const bought = buyMeta(rich, 'str');
    expect(bought.meta.str).toBe(1);
    expect(bought.gold).toBe(1000 - META.str.baseCost);
    expect(buyMeta({ ...defaultSave(), gold: 1 }, 'str').meta.str).toBeUndefined();
    const capped = { ...rich, meta: { rerolls: META.rerolls.max } };
    expect(buyMeta(capped, 'rerolls')).toBe(capped);
  });

  it('drops: regular enemies sometimes, elites and bosses always and more', () => {
    expect(goldDrop(2, 'regular', () => 0.99, 1, 5)).toBe(0);
    const mid = () => 0.5; // drop, no variance
    expect(goldDrop(2, 'regular', () => 0.2, 1, 5)).toBeGreaterThan(0);
    expect(goldDrop(2, 'elite', mid, 1, 5)).toBe(10);
    expect(goldDrop(2, 'elite', mid, 2, 5)).toBe(20); // tier / relic multiplier
    expect(goldDrop(2, 'boss', mid, 1, 5)).toBeGreaterThan(goldDrop(2, 'elite', mid, 1, 5));
    expect(waveClearGold(10, 1)).toBeGreaterThan(waveClearGold(3, 1));
    expect([0, 1, 2].map(rerollCost)).toEqual([15, 30, 60]);
  });

  it('the Keep and mastery shape the start of a run, within a modest budget', () => {
    const maxed = Object.fromEntries(META_IDS.map((id) => [id, META[id].max]));
    const base = CLASSES.archer.base;
    const s = startingStats(base, maxed, 3);
    expect(s.hp).toBe(Math.round(base.hp * 1.2));
    expect(s.dex).toBe(base.dex + 5);
    expect(s.secondary).toBe(base.secondary + 3);
    expect(s.hp / base.hp).toBeLessThan(1.5); // helps, does not trivialize
    expect(metaLoadout(maxed)).toMatchObject({ gold: 100, rerolls: 2, relicSlots: 1, relicTierCap: 3 });
    expect(startingStats(base, { hp: 99 }, 0).hp).toBe(s.hp); // ranks above the cap are ignored

    const g = createGame('archer', 1, { meta: maxed });
    expect(g.relicSlots).toBe(metaLoadout(maxed).relicSlots); // v0.4: no longer a cap
    expect(g.rerolls).toBe(3);
    expect(g.gold).toBe(100);
    expect(g.player.level).toBe(1 + META.startLevel.max); // v0.4 Veteran Levies
    expect(g.talentPoints).toBe(META.talentPoint.max);
    expect(summarizeRun(g).gold).toBe(0); // starting gold is not "earned"
  });

  it('mastery ranks and class XP', () => {
    expect(masteryRank(0)).toBe(0);
    expect(masteryRank(150)).toBe(1);
    expect(masteryRank(1e9)).toBe(MASTERY.length); // v0.4: 25 ranks
    expect(masteryBonus(1e9)).toMatchObject({ secondary: 7, relic: true, reroll: 2, utilityTier: true, startLevel: 1 });
    expect(masteryBonus(MASTERY[4].xp)).toMatchObject({ secondary: 1, relic: true, reroll: 1, utilityTier: true });
    const run = { wavesCleared: 8, bosses: 1, level: 9 };
    expect(classXpForRun(run, TIERS[1])).toBeGreaterThan(classXpForRun(run, TIERS[0]));
    expect(createGame('viking', 1, { classXp: 1e9 }).relics).toHaveLength(1); // rank 3: starts with a common relic
  });
});

const run = (over: Partial<RunSummary> = {}): RunSummary => ({
  classId: 'paladin', tier: 0, wave: 6, wavesCleared: 5, kills: 80, time: 200, level: 6, gold: 120,
  bosses: ['blackKnight'], elites: 2, flawlessBosses: 0, relics: ['whetstone'], abilityUpgrades: 1, wave10Time: 0, ...over,
});

describe('unlock conditions', () => {
  it('has 15+ achievements with unique ids, none earned on a fresh save', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(15);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    expect(newlyEarned(defaultSave())).toEqual([]);
    expect(lockedArenas(defaultSave())).toEqual(expect.arrayContaining(['graveyard', 'keep']));
    expect(lockedRelics(defaultSave())).toEqual(expect.arrayContaining(['phoenixFeather', 'soulLantern', 'conquerorCrown']));
  });

  it('a run feeds gold, records, counters and class XP into the save', () => {
    const { save, classXp } = applyRun(defaultSave(), run());
    expect(save.gold).toBe(120);
    expect(save.classes.paladin).toMatchObject({ bestWave: 6, runs: 1, kills: 80, xp: classXp });
    expect(classXp).toBeGreaterThan(0);
    expect(save.relicPicks.whetstone).toBe(1);
    expect(save.counters.bossKinds).toEqual(['blackKnight']);
    expect(applyRun(save, run({ wave: 3 })).save.classes.paladin.bestWave).toBe(6); // best never goes down
  });

  it('reaching wave 10 unlocks the graveyard; a flawless boss unlocks the Phoenix Feather', () => {
    const after = withAchievements(applyRun(defaultSave(), run({ wave: 10, flawlessBosses: 1 })).save);
    const ids = after.earned.map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(['wave10', 'flawless', 'bossSlayer']));
    expect(lockedArenas(after.save)).not.toContain('graveyard');
    expect(lockedArenas(after.save)).toContain('keep');
    expect(lockedRelics(after.save)).not.toContain('phoenixFeather');
    expect(withAchievements(after.save).earned).toEqual([]); // only reported once
  });

  it('wave 20 with all five classes', () => {
    let save = defaultSave();
    for (const classId of CLASS_ORDER.slice(0, 4)) save = applyRun(save, run({ classId, wave: 20 })).save;
    expect(withAchievements(save).earned.map((a) => a.id)).not.toContain('wave20all');
    save = applyRun(save, run({ classId: CLASS_ORDER[4], wave: 20 })).save;
    expect(withAchievements(save).earned.map((a) => a.id)).toContain('wave20all');
  });

  it('clearing wave 15 on your highest tier unlocks the next, and only then', () => {
    expect(applyRun(defaultSave(), run({ wavesCleared: 14 })).tierUnlocked).toBe(false);
    const up = applyRun(defaultSave(), run({ wavesCleared: 15 }));
    expect(up.tierUnlocked).toBe(true);
    expect(up.save.tierUnlocked).toBe(1);
    expect(applyRun(up.save, run({ wavesCleared: 15, tier: 0 })).tierUnlocked).toBe(false); // must be on the new tier
    const top = { ...defaultSave(), tierUnlocked: TIERS.length - 1 };
    expect(applyRun(top, run({ wavesCleared: 15, tier: TIERS.length - 1 })).save.tierUnlocked).toBe(TIERS.length - 1);
  });
});

describe('save migration', () => {
  it('v0.1 best-wave records survive', () => {
    const save = migrate(undefined, { paladin: 7, archer: 12 });
    expect(save.version).toBe(SAVE_VERSION); // was the literal 2 in v0.2; the save format is version 3 since v0.3
    expect(save.classes.paladin.bestWave).toBe(7);
    expect(save.classes.archer.bestWave).toBe(12);
    expect(save.classes.viking.bestWave).toBe(0);
    expect(save.gold).toBe(0);
    expect(withAchievements(save).earned.map((a) => a.id)).toContain('wave10'); // old deeds count
  });

  it('nothing stored, or junk, gives a fresh save', () => {
    expect(migrate(undefined, undefined)).toEqual(defaultSave());
    expect(migrate('garbage', [1, 2])).toEqual(defaultSave());
    expect(migrate({ version: 1, gold: 999 }, { paladin: 'x', necromancer: -4 })).toEqual(defaultSave());
  });

  it('a v2 save wins over legacy records and round-trips through export / import', () => {
    const save = applyRun({ ...defaultSave(), gold: 50, meta: { hp: 2 }, achievements: ['firstBlood'] }, run()).save;
    expect(migrate(JSON.parse(JSON.stringify(save)), { paladin: 99 })).toEqual(save);
    expect(importSave(exportSave(save))).toEqual(save);
  });

  it('import rejects what is not a save and repairs what is damaged', () => {
    expect(importSave('not json')).toBeNull();
    expect(importSave('{"paladin": 7}')).toBeNull();
    const fixed = importSave(JSON.stringify({ version: 2, gold: -5, meta: { hp: 999, bogus: 3 }, tierUnlocked: 42, settings: { arena: 'moon', tier: 9 }, classes: { paladin: { bestWave: 4 } } }))!;
    expect(fixed.gold).toBe(0);
    expect(fixed.meta.hp).toBe(META.hp.max);
    expect(fixed.tierUnlocked).toBe(TIERS.length - 1);
    expect(fixed.settings.arena).toBe('courtyard');
    expect(fixed.classes.paladin).toMatchObject({ bestWave: 4, runs: 0 });
    expect(fixed.classes.archer.bestWave).toBe(0);
  });
});

describe('headless simulation', () => {
  it('a bot run ends, earns something, and is deterministic per seed', () => {
    const a = simulateRun('archer', 7, {}, 0, 240);
    expect(a.wave).toBeGreaterThan(1);
    expect(a.kills).toBeGreaterThan(10);
    expect(simulateRun('archer', 7, {}, 0, 240)).toEqual(a);
  });
});
