import { ACHIEVEMENTS, type AchievementDef } from '../config/achievements';
import type { ArenaId } from '../config/arenas';
import { CURSE_IDS, type CurseId } from '../config/curses';
import type { RelicId } from '../config/relics';
import type { Save } from './save';

/** Achievements whose condition is met but that are not recorded yet. */
export function newlyEarned(save: Save): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => !save.achievements.includes(a.id) && a.progress(save) >= a.target);
}

/** Records everything newly earned. Returns the same object when nothing changed. */
export function withAchievements(save: Save): { save: Save; earned: AchievementDef[] } {
  const earned = newlyEarned(save);
  return { earned, save: earned.length ? { ...save, achievements: [...save.achievements, ...earned.map((a) => a.id)] } : save };
}

const stillLocked = (save: Save) => ACHIEVEMENTS.filter((a) => a.unlocks && !save.achievements.includes(a.id));

export const lockedRelics = (save: Save): RelicId[] => stillLocked(save).flatMap((a) => (a.unlocks!.relic ? [a.unlocks!.relic] : []));
export const lockedArenas = (save: Save): ArenaId[] => stillLocked(save).flatMap((a) => (a.unlocks!.arena ? [a.unlocks!.arena] : []));

export const lockedCurses = (save: Save): CurseId[] => stillLocked(save).flatMap((a) => (a.unlocks!.curse ? [a.unlocks!.curse] : []));
export const unlockedCurses = (save: Save): CurseId[] => CURSE_IDS.filter((id) => !lockedCurses(save).includes(id));

/** The achievement that gates an arena or relic, for "locked: ..." hints in the UI. */
export const gateOf = (what: { arena?: ArenaId; relic?: RelicId; curse?: CurseId }): AchievementDef | undefined =>
  ACHIEVEMENTS.find((a) => (what.arena && a.unlocks?.arena === what.arena) || (what.relic && a.unlocks?.relic === what.relic) || (what.curse && a.unlocks?.curse === what.curse));
