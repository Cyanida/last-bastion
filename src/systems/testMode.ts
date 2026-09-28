import { ACTS } from '../config/acts';
import type { ArenaId } from '../config/arenas';
import type { ClassId } from '../config/classes';
import type { RelicId } from '../config/relics';
import { TALENT_BY_ID } from '../config/talents';
import type { Game } from '../core/types';
import { createGame, summarizeRun } from '../game';
import { applyRun, type Save } from '../logic/save';
import { todayString } from '../logic/acts';
import { addRelic } from './relics';
import { talentPointsForLevel } from '../logic/talents';
import { headStart } from './levels';

/**
 * v0.7.1 test mode (hidden: tap the version in Settings five times, or ?dev=1): start a run anywhere, with a chosen class, level and
 * talents, and (v0.7.1 B5) relics at a chosen attunement tier. A test run starts bare (no Keep, mastery, traits, curses or treasure) and never reaches the save.
 */
export interface TestSetup {
  classId: ClassId;
  arena: ArenaId;
  act: number;
  wave: number; // within the Act, 1..ACTS.length
  level: number;
  talents: string[];
  relics: Partial<Record<RelicId, number>>; // B5: held from the start, at this tier (1-3)
}

export const isTestRun = (g: Game) => g.vars.test === 1;

export function createTestRun(s: TestSetup, seed: number): Game {
  const g = createGame(s.classId, seed, { arena: s.arena });
  g.vars.test = 1;
  g.talentPoints += Math.max(0, s.talents.length - talentPointsForLevel(s.level)); // every chosen talent is paid for, even at a low level
  // #191: the head start a level gets (queued picks, the boon bundle), at the chosen level, spending along the chosen talents
  headStart(g, (s.act - 1) * ACTS.length + s.wave, { level: s.level, plan: [...s.talents].sort((a, b) => TALENT_BY_ID[a].row - TALENT_BY_ID[b].row) });
  for (const [id, tier] of Object.entries(s.relics ?? {})) addRelic(g, id as RelicId, 'other', tier);
  g.breather = 0.01; // the chosen wave comes next
  return g;
}

/**
 * The only way main.ts turns a run into rewards: the results screen, deed toasts mid-run, the treasure log's preview. A test run gets
 * null, so applyRun never sees it: no gold, Runes, class XP, deeds, contracts or run history.
 */
export const banked = (save: Save, g: Game, now: Date) => (isTestRun(g) ? null : applyRun(save, summarizeRun(g), todayString(now), now.toISOString())); // the local day, the same one the Daily Trial uses
