import { UTILITY } from '../config/utility';
import { WORLD, type RealmId } from '../config/world';
import type { RelicId } from '../config/relics';
import type { Game } from '../core/types';
import { tierForLevel } from '../logic/abilityUpgrades';
import { actOf } from '../logic/acts';
import { applyGrowth } from '../logic/formulas';
import { talentPointsForLevel } from '../logic/talents';
import { applyStatUpgrade } from '../logic/upgrades';
import { headStartLevel, wingsOpenBy } from '../logic/world';
import type { RunCarry } from '../logic/realmRun';
import { initQuests } from './quests';
import { initRegions, openNextWing } from './regions';
import { spendTalent } from './talents';

/**
 * v0.10 (#191): a run at a realm level (docs/road-to-the-crown.md rule 3). The later screens (the champion screen, the realm road) and
 * test mode start one through RunOptions.level (game.ts createGame). v0.11 (#237): a realm is one run, so a later level of it goes on
 * with the carry of the level before (applyCarry); level 1 slots the loadout. Only test mode and the sim still start a later level on its
 * own, with a head start in place of the run before it.
 */
export interface LevelStart {
  realm: RealmId;
  level: number; // 1-based, into REALMS[realm].levels
  relics?: RelicId[]; // the slotted loadout, added after the head start at the level's relic tier
  talentPlan?: string[]; // the champion's talent plan: the head start spends its points along it
  carry?: RunCarry | null; // #237: the realm run's state entering this level (its checkpoint); none: level 1's loadout, or test mode's head start
}

/**
 * The head start at `wave`, shared by levels and test mode: the player grows to `level` (by default the pace's level there, with the Keep's
 * and mastery's start levels on top) as if it had played the waves before. Each level skipped gives its growth, its ability or utility tier
 * as a queued pick, its talent point, and one boon of the bundle (WORLD.headStart). Talent points go along `plan` while it can take them.
 * Then the run stands just before `wave`: its Act, quest board and the wings open by then.
 */
export function headStart(g: Game, wave: number, opts: { level?: number; plan?: string[] } = {}): void {
  const p = g.player;
  const target = opts.level ?? headStartLevel(wave) + p.level - 1;
  const { boons, rarity, lateRarity, lateFrom } = WORLD.headStart;
  for (let n = 0; p.level < target; n++) {
    p.level++;
    p.stats = applyGrowth(p.stats, p.cls.growth);
    const boon = boons[n % boons.length];
    p.stats = applyStatUpgrade(p.stats, boon === 'attack' ? p.cls.attack.scaling : boon, p.level >= lateFrom ? lateRarity : rarity);
    const tier = tierForLevel(p.level);
    if (tier >= 0) g.pendingAbilityTiers.push(tier);
    const utilityTier = UTILITY.tiers.indexOf(p.level);
    if (utilityTier >= 0 && utilityTier < g.utilityTiers) g.pendingUtilityTiers.push(utilityTier);
    g.talentPoints += talentPointsForLevel(p.level) - talentPointsForLevel(p.level - 1);
  }
  for (const id of opts.plan ?? []) if (g.talentPoints > 0) spendTalent(g, id); // one the tree cannot take yet stays a point to spend
  p.hp = p.stats.hp;
  if (actOf(wave) !== g.act) {
    g.act = actOf(wave);
    initRegions(g);
    initQuests(g);
  }
  for (let i = 0; i < wingsOpenBy(wave); i++) openNextWing(g);
  g.startWave = wave;
  g.wave = g.wavesCleared = wave - 1;
}

/** #237: the run as it stands when a level is cleared, to go on into the realm's next level (logic/realmRun.ts checkpoint). */
export function takeCarry(g: Game): RunCarry {
  const p = g.player, r = p.relics;
  const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
  return {
    level: p.level, xp: p.xp, stats: { ...p.stats }, baseMods: { ...g.baseMods } as unknown as Record<string, number>,
    upgrades: [...p.upgrades], talents: [...p.talents], utilityUpgrades: [...p.utilityUpgrades], evolutions: [...g.evolutions], revives: p.revives,
    relics: copy({ held: r.held, tiers: r.tiers, attune: r.attune, from: r.from, duos: r.duos, cursedAct: r.cursedAct }),
    gold: g.gold, talentPoints: g.talentPoints, pendingLevelUps: g.pendingLevelUps,
    pendingAbilityTiers: [...g.pendingAbilityTiers], pendingUtilityTiers: [...g.pendingUtilityTiers],
    rerolls: g.rerolls, banishes: g.banishes, bannedStats: [...g.bannedStats], vars: { ...g.vars },
  };
}

/**
 * #237: a later level of a realm run goes on from its checkpoint: the build, relics (at their tiers) and gold the run had, in place of the
 * fresh start createGame built. No acquire hook runs again: the stats already hold what the relics did to them. HP starts full.
 * Then the run stands just before the level's first wave, as a head start leaves it.
 */
export function applyCarry(g: Game, c: RunCarry, wave: number): void {
  const p = g.player, r = p.relics;
  p.level = c.level;
  p.xp = c.xp;
  for (const k of Object.keys(p.stats) as (keyof typeof p.stats)[]) if (k in c.stats) p.stats[k] = c.stats[k];
  for (const [k, v] of Object.entries(c.baseMods)) if (k in g.baseMods) (g.baseMods as unknown as Record<string, number>)[k] = v;
  p.mods = { ...g.baseMods };
  p.hp = p.stats.hp;
  p.upgrades = [...c.upgrades];
  p.talents = [...c.talents];
  p.utilityUpgrades = [...c.utilityUpgrades];
  p.revives = c.revives;
  g.evolutions = [...c.evolutions];
  g.talentModsCache = null;
  Object.assign(r, { held: [...c.relics.held], tiers: { ...c.relics.tiers }, attune: { ...c.relics.attune }, from: { ...c.relics.from }, duos: [...c.relics.duos], cursedAct: c.relics.cursedAct, dirty: true });
  r.fresh = r.fresh.filter((id) => !r.held.includes(id));
  g.gold = g.goldStart = c.gold; // what a level banks is what it earned
  g.talentPoints = c.talentPoints;
  g.pendingLevelUps = c.pendingLevelUps;
  g.pendingAbilityTiers = [...c.pendingAbilityTiers];
  g.pendingUtilityTiers = [...c.pendingUtilityTiers];
  g.rerolls = c.rerolls;
  g.banishes = c.banishes;
  g.bannedStats = [...c.bannedStats];
  Object.assign(g.vars, c.vars);
  headStart(g, wave, { level: p.level }); // grows nothing: it only moves the run to the level's first wave
}
