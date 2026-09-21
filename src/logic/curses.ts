import { CURSES, type CurseId } from '../config/curses';

/** Gold and class-XP multiplier for a set of curses: bonuses add up, duplicates count once. */
export function curseMultiplier(ids: readonly CurseId[]): number {
  return 1 + [...new Set(ids)].reduce((sum, id) => sum + CURSES[id].bonus, 0);
}

/** A numeric knob of a curse if it is active, else `fallback` (usually 1). */
export function curseValue(ids: readonly CurseId[], id: CurseId, key: string, fallback = 1): number {
  return ids.includes(id) ? (CURSES[id].n[key] ?? fallback) : fallback;
}
