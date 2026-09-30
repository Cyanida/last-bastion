import { ACTS } from '../config/acts';
import type { ArenaId } from '../config/arenas';
import type { ClassId } from '../config/classes';
import type { RelicId } from '../config/relics';
import type { RealmId } from '../config/world';
import { TALENT_BY_ID } from '../config/talents';
import type { Game } from '../core/types';
import { createGame, summarizeRun } from '../game';
import { applyRun, type Save } from '../logic/save';
import { todayString } from '../logic/acts';
import { addRelic } from './relics';
import { talentPointsForLevel } from '../logic/talents';
import { headStart } from './levels';
import { botBuild, expectedChampionLevel } from '../logic/championLevels';
import { spendTalent } from './talents';

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
  realmLevel?: { realm: RealmId; level: number } | null; // #206: start this realm level instead (act, wave and level are then the level's own)
}

export const isTestRun = (g: Game) => g.vars.test === 1;

export function createTestRun(s: TestSetup, seed: number): Game {
  const plan = [...s.talents].sort((a, b) => TALENT_BY_ID[a].row - TALENT_BY_ID[b].row);
  const g = s.realmLevel ? levelRun(s, seed, plan) : createGame(s.classId, seed, { arena: s.arena });
  g.vars.test = 1;
  if (!s.realmLevel) {
    g.talentPoints += Math.max(0, s.talents.length - talentPointsForLevel(s.level)); // every chosen talent is paid for, even at a low level
    // #191: the head start a level gets (queued picks, the boon bundle), at the chosen level, spending along the chosen talents
    headStart(g, (s.act - 1) * ACTS.length + s.wave, { level: s.level, plan });
  }
  for (const [id, tier] of Object.entries(s.relics ?? {})) addRelic(g, id as RelicId, 'other', tier);
  g.breather = 0.01; // the chosen wave comes next
  return g;
}

/**
 * #206: a realm level as the realm road starts it (createGame's RunOptions.level: its arena, ring step, first wave, slots, opening pick and
 * end boss). #238: no head start: the champion is the bot's build at the level enemy scaling expects there (logic/championLevels), with
 * the chosen talents in place of the bot's. Test runs start bare: no loadout, Keep or mastery. Every chosen talent is paid for, as at
 * an Act and wave; one the tree cannot take stays a point.
 */
function levelRun(s: TestSetup, seed: number, plan: string[]): Game {
  const { realm, level } = s.realmLevel!;
  const g = createGame(s.classId, seed, { arena: s.arena, level: { realm, level, champion: { ...botBuild(s.classId, expectedChampionLevel(realm, level)), talents: [] } } });
  g.talentPoints += plan.length;
  for (const id of plan) spendTalent(g, id);
  return g;
}

/**
 * The only way main.ts turns a run into rewards: the results screen, deed toasts mid-run, the treasure log's preview. A test run gets
 * null, so applyRun never sees it: no gold, Runes, class XP, deeds, contracts or run history.
 */
export const banked = (save: Save, g: Game, now: Date) => (isTestRun(g) ? null : applyRun(save, summarizeRun(g), todayString(now), now.toISOString())); // the local day, the same one the Daily Trial uses
