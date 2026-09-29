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
import { initQuests } from './quests';
import { initRegions, openNextWing } from './regions';
import { spendTalent } from './talents';

/**
 * v0.10 (#191): a run at a realm level (docs/road-to-the-crown.md rule 3). The later screens (the champion screen, the realm road) and
 * test mode start one through RunOptions.level (game.ts createGame), which calls headStart and then slots the loadout.
 */
export interface LevelStart {
  realm: RealmId;
  level: number; // 1-based, into REALMS[realm].levels
  relics?: RelicId[]; // the slotted loadout, added after the head start at the level's relic tier
  talentPlan?: string[]; // the champion's talent plan: the head start spends its points along it
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
