import { CHAMPION } from '../config/champion';
import { UTILITY } from '../config/utility';
import { WORLD, type RealmId } from '../config/world';
import type { RelicId } from '../config/relics';
import type { Game } from '../core/types';
import { tierForLevel } from '../logic/abilityUpgrades';
import { actOf } from '../logic/acts';
import { buildStats, type ChampionBuild, type StatPoints } from '../logic/championLevels';
import { applyGrowth } from '../logic/formulas';
import { talentPointsForLevel } from '../logic/talents';
import { applyStatUpgrade } from '../logic/upgrades';
import { headStartLevel, wingsOpenBy } from '../logic/world';
import type { RunCarry } from '../logic/realmRun';
import { initQuests } from './quests';
import { initRegions, openNextWing } from './regions';
import { learnTalent, spendTalent } from './talents';

/**
 * v0.10 (#191): a run at a realm level (docs/road-to-the-crown.md rule 3). The later screens (the champion screen, the realm road) and
 * test mode start one through RunOptions.level (game.ts createGame). v0.11 (#237): a realm is one run, so a later level of it goes on
 * with the carry of the level before (applyCarry); level 1 slots the loadout. #238: there is no head start and no level-up inside a
 * level: the player is its champion's build (applyChampion). Test mode and the sim start a later level on its own with the bot's build
 * at the level enemy scaling expects there.
 */
export interface LevelStart {
  realm: RealmId;
  level: number; // 1-based, into REALMS[realm].levels
  relics?: RelicId[]; // the slotted loadout, added after the build at the level's relic tier
  champion?: ChampionBuild; // #238: the champion's level and what its points bought (logic/championLevels buildOf); none: a level-1 champion with nothing spent
  carry?: RunCarry | null; // #237: the realm run's state entering this level (its checkpoint); none: level 1's loadout, or a level started on its own
}

/**
 * Test mode's head start at `wave` of a plain run (#238: realm levels have none): the player grows to `level` (by default the pace's
 * level there, with the Keep's and mastery's start levels on top) as if it had played the waves before. Each level skipped gives its
 * growth, its ability or utility tier as a queued pick, its talent point, and one boon of the bundle (WORLD.headStart). Talent points go
 * along `plan` while it can take them. Then the run stands just before `wave`: its Act, quest board and the wings open by then.
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
  enterWave(g, wave);
}

/** The run stands just before `wave`: its Act, quest board and the wings open by then. A realm level starts here, with no head start. */
export function enterWave(g: Game, wave: number): void {
  if (actOf(wave) !== g.act) {
    g.act = actOf(wave);
    initRegions(g);
    initQuests(g);
  }
  for (let i = 0; i < wingsOpenBy(wave); i++) openNextWing(g);
  g.startWave = wave;
  g.wave = g.wavesCleared = wave - 1;
}

/**
 * #238: the champion's build goes into the run. The player takes the champion's level, its growth and stat points (logic/championLevels
 * buildStats), its talents and its ability and utility tiers. `held`: what the run's stats hold already (a realm run's carry: the
 * champion as it was at the checkpoint), so only what it gained or spent since is added: spent points apply to the next level. HP
 * starts full, and no level-up comes inside the level (systems/leveling.ts gainXp).
 */
export function applyChampion(g: Game, b: ChampionBuild, held: { level: number; points: StatPoints } = { level: 1, points: {} }): void {
  const p = g.player;
  p.levelWorth = CHAMPION.runLevels;
  p.stats = buildStats(p.cls.id, p.stats, held, b);
  p.level = b.level;
  p.xp = 0; // the level's own XP counts up from nothing
  for (const id of b.talents) if (!p.talents.includes(id)) learnTalent(g, id);
  p.upgrades = [...new Set([...p.upgrades, ...b.upgrades])];
  p.utilityUpgrades = [...new Set([...p.utilityUpgrades, ...b.utilityUpgrades])];
  p.hp = p.stats.hp;
  if (g.level) g.level.champion = { level: b.level, points: { ...b.points }, xp: b.xp, next: b.next };
}

/** #237: the run as it stands when a level is cleared, to go on into the realm's next level (logic/realmRun.ts checkpoint). */
export function takeCarry(g: Game): RunCarry {
  const p = g.player, r = p.relics;
  const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
  return {
    level: p.level, points: { ...g.level?.champion.points }, stats: { ...p.stats }, baseMods: { ...g.baseMods } as unknown as Record<string, number>,
    upgrades: [...p.upgrades], talents: [...p.talents], utilityUpgrades: [...p.utilityUpgrades], evolutions: [...g.evolutions], revives: p.revives,
    relics: copy({ held: r.held, tiers: r.tiers, attune: r.attune, from: r.from, duos: r.duos, cursedAct: r.cursedAct }),
    gold: g.gold, talentPoints: g.talentPoints,
    rerolls: g.rerolls, banishes: g.banishes, bannedStats: [...g.bannedStats], vars: { ...g.vars },
  };
}

/**
 * #237: a later level of a realm run goes on from its checkpoint: the build, relics (at their tiers) and gold the run had, in place of the
 * fresh start createGame built. No acquire hook runs again: the stats already hold what the relics did to them. HP starts full.
 * Then the run stands just before the level's first wave. #238: createGame puts the champion's build on top (applyChampion).
 */
export function applyCarry(g: Game, c: RunCarry, wave: number): void {
  const p = g.player, r = p.relics;
  p.level = c.level;
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
  g.rerolls = c.rerolls;
  g.banishes = c.banishes;
  g.bannedStats = [...c.bannedStats];
  Object.assign(g.vars, c.vars);
  enterWave(g, wave);
}
