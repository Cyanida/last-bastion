import { ABILITY_TIER_LEVELS, ABILITY_TRACKS, type AbilityUpgradeId } from '../config/abilityUpgrades';
import type { ClassId } from '../config/classes';

/** Tier index (0-2) unlocked by reaching exactly this level, or -1. */
export const tierForLevel = (level: number) => ABILITY_TIER_LEVELS.indexOf(level);

export const upgradeOptions = (classId: ClassId, tier: number) => ABILITY_TRACKS[classId][tier];

/**
 * New list of chosen upgrades. Returns the same array (no change) when the pick is invalid:
 * not this class's track, not this tier, or the tier's other option was already taken.
 */
export function pickAbilityUpgrade(picked: AbilityUpgradeId[], classId: ClassId, tier: number | undefined, id: AbilityUpgradeId): AbilityUpgradeId[] {
  const options = tier === undefined ? undefined : ABILITY_TRACKS[classId][tier];
  if (!options || !options.includes(id) || options.some((o) => picked.includes(o))) return picked;
  return [...picked, id];
}
