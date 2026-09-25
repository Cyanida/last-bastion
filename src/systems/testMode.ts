import { ACTS } from '../config/acts';
import { ARENAS, type ArenaId } from '../config/arenas';
import { GAME } from '../config/game';
import type { ClassId } from '../config/classes';
import type { RelicId } from '../config/relics';
import { TALENT_BY_ID } from '../config/talents';
import type { Game } from '../core/types';
import { createGame, summarizeRun } from '../game';
import { applyGrowth } from '../logic/formulas';
import { applyRun, type Save } from '../logic/save';
import { todayString } from '../logic/acts';
import { nextAct } from './acts';
import { addRelic } from './relics';
import { initRegions } from './regions';
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
  players?: number; // v0.8 (#28): local players, all of the chosen class, one viewpoint each
}

export const isTestRun = (g: Game) => g.vars.test === 1;

export function createTestRun(s: TestSetup, seed: number): Game {
  const g = createGame(s.classId, seed, { arena: s.arena, allies: Array((s.players ?? 1) - 1).fill(s.classId) });
  g.vars.test = 1;
  while (g.act < s.act) nextAct(g);
  if (g.arena.id !== s.arena) {
    g.arena = ARENAS[s.arena];
    initRegions(g);
    g.players.forEach((p, i) => Object.assign(p, { x: g.arena.w / 2 + i * GAME.playerSpacing, y: g.arena.h / 2 }));
  }
  for (const p of g.players) {
    for (; p.level < s.level; p.level++) p.stats = applyGrowth(p.stats, p.cls.growth);
    p.hp = p.stats.hp;
  }
  g.players[0].talentPoints += s.talents.length;
  for (const id of [...s.talents].sort((a, b) => TALENT_BY_ID[a].row - TALENT_BY_ID[b].row)) spendTalent(g, g.players[0], id); // one a tree cannot take stays a point to spend
  for (const [id, tier] of Object.entries(s.relics ?? {})) addRelic(g, id as RelicId, 'other', tier);
  g.wave = g.wavesCleared = (s.act - 1) * ACTS.length + s.wave - 1;
  g.breather = 0.01; // the chosen wave comes next
  return g;
}

/**
 * The only way main.ts turns a run into rewards: the results screen, deed toasts mid-run, the treasure log's preview. A test run gets
 * null, so applyRun never sees it: no gold, Runes, class XP, deeds, contracts or run history.
 */
export const banked = (save: Save, g: Game, now: Date) => (isTestRun(g) ? null : applyRun(save, summarizeRun(g), todayString(now), now.toISOString())); // the local day, the same one the Daily Trial uses
