// v0.10 (#204): the Daily Trial's rules (docs/road-to-the-crown.md rule 6): today's 40-wave run (logic/acts dailySetup), the fixed pool
// of a run without a champion (logic/relics relicPoolFor), no loadout, and open once the Marches are crowned
import { CLASS_ORDER, type ClassId } from '../config/classes';
import { REALMS, WORLD } from '../config/world';
import type { Champion } from './champions';
import { isCrowned } from './world';

/** Open once any champion holds the crown of WORLD.daily.opensWith (any tier), or for a save that already took a trial (it keeps it). */
export const dailyOpen = (save: { champions: Partial<Record<ClassId, Champion>>; daily: Record<string, number> }): boolean =>
  Object.keys(save.daily).length > 0 || CLASS_ORDER.some((id) => { const c = save.champions[id]; return !!c && isCrowned(c.world, WORLD.daily.opensWith); });

/** What opens the trial, for the title while it is shut: "Opens with the Marches crown". */
export const dailyOpensText = (): string => `Opens with the ${REALMS[WORLD.daily.opensWith].name.replace(/^The /, '')} crown`;

/** Whether a run opens with the Armorer's offer and the Keepsake's free common: not in a level (they are slots there), nor in a trial. */
export const startRelicGifts = (o: { level: boolean; daily: boolean }): boolean => !o.level && (!o.daily || WORLD.daily.startRelics);
