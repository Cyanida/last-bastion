import { ACHIEVEMENTS, tierReward, type AchievementDef, type AchievementReward } from '../config/achievements';
import type { ArenaId } from '../config/arenas';
import { CLASS_ORDER } from '../config/classes';
import { CURSE_IDS, type CurseId } from '../config/curses';
import type { RelicId } from '../config/relics';
import { TRAITS } from '../config/traits';
import { masteryBonus } from './economy';
import type { Save } from './save';

/** How an earned tier is stored: bronze is the bare id, so every old `achievements.includes(id)` check still means "bronze earned". */
export const tierKey = (id: string, tier: number): string => (tier > 1 ? `${id}:${tier}` : id);

/** "wave20:3" -> that achievement and the tier it names; a bare id is tier 1. */
export function tierOf(key: string): { def: AchievementDef; tier: number } | undefined {
  const [id, tier] = key.split(':');
  const def = ACHIEVEMENTS.find((a) => a.id === id);
  return def && { def, tier: Number(tier) || 1 };
}

/** Highest tier of an achievement already recorded (0 = none). */
export function earnedTier(save: Save, id: string): number {
  let tier = 0;
  while (save.achievements.includes(tierKey(id, tier + 1))) tier++;
  return tier;
}

export interface EarnedTier {
  id: string; // the achievement id, so `earned.map((e) => e.id)` still reads as before
  tier: number;
  def: AchievementDef;
  reward: AchievementReward;
}

/** Tiers whose target is met but that are not recorded yet, in order: a jump can earn bronze, silver and gold at once. */
export function newlyEarned(save: Save): EarnedTier[] {
  const out: EarnedTier[] = [];
  for (const a of ACHIEVEMENTS) {
    const progress = a.progress(save);
    for (let tier = earnedTier(save, a.id) + 1; tier <= a.tiers.length && progress >= a.tiers[tier - 1].target; tier++) {
      out.push({ id: a.id, tier, def: a, reward: tierReward(a, tier) });
    }
  }
  return out;
}

/** Records everything newly earned and pays for it. Returns the same object when nothing changed. */
export function withAchievements(save: Save): { save: Save; earned: EarnedTier[] } {
  const earned = newlyEarned(save);
  if (earned.length === 0) return { earned, save };
  const next: Save = {
    ...save,
    achievements: [...save.achievements, ...earned.map((e) => tierKey(e.id, e.tier))],
    titles: [...save.titles],
    palettes: [...save.palettes],
    treasureSteps: { ...save.treasureSteps },
  };
  for (const { def, reward } of earned) {
    next.runes += reward.runes ?? 0;
    next.talentPoints += reward.talentPoint ?? 0;
    if (reward.title && !next.titles.includes(reward.title)) next.titles.push(reward.title);
    if (reward.palette !== undefined && !next.palettes.includes(reward.palette)) next.palettes.push(reward.palette);
    if (reward.treasureStep) for (const id of def.classId ? [def.classId] : CLASS_ORDER) next.treasureSteps[id] = Math.max(next.treasureSteps[id], reward.treasureStep);
  }
  return { earned, save: next };
}

/** Every title that can be equipped: achievement rewards plus the mastery tracks' titles. */
export const earnedTitles = (save: Save): string[] => [...new Set([...save.titles, ...CLASS_ORDER.flatMap((id) => masteryBonus(save.classes[id].xp).titles)])];

/** One line of reward text for a tier, for the Chronicle and the in-run toast. */
export function rewardText(reward: AchievementReward): string {
  const parts = [`◆ ${reward.runes ?? 0}`];
  if (reward.title) parts.push(`title "${reward.title}"`);
  if (reward.trait) parts.push(`trait ${TRAITS[reward.trait].name}`);
  if (reward.palette !== undefined) parts.push('a sprite palette for every class');
  if (reward.talentPoint) parts.push(`+${reward.talentPoint} starting talent point`);
  if (reward.treasureStep) parts.push('a sacred treasure step');
  return parts.join(' · ');
}

const stillLocked = (save: Save) => ACHIEVEMENTS.filter((a) => a.unlocks && !save.achievements.includes(a.id));

export const lockedRelics = (save: Save): RelicId[] => stillLocked(save).flatMap((a) => (a.unlocks!.relic ? [a.unlocks!.relic] : []));
export const lockedArenas = (save: Save): ArenaId[] => stillLocked(save).flatMap((a) => (a.unlocks!.arena ? [a.unlocks!.arena] : []));

export const lockedCurses = (save: Save): CurseId[] => stillLocked(save).flatMap((a) => (a.unlocks!.curse ? [a.unlocks!.curse] : []));
export const unlockedCurses = (save: Save): CurseId[] => CURSE_IDS.filter((id) => !lockedCurses(save).includes(id));

/** The achievement that gates an arena or relic, for "locked: ..." hints in the UI. */
export const gateOf = (what: { arena?: ArenaId; relic?: RelicId; curse?: CurseId }): AchievementDef | undefined =>
  ACHIEVEMENTS.find((a) => (what.arena && a.unlocks?.arena === what.arena) || (what.relic && a.unlocks?.relic === what.relic) || (what.curse && a.unlocks?.curse === what.curse));
