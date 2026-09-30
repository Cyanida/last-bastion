// v0.11 (#242): the realm road's side of a realm run (#237, logic/realmRun.ts): what the road shows of a champion's unfinished run (the
// checkpoint's flag, the levels cleared in it, the relics it holds) and what the level panel offers: Continue from its checkpoint, or
// Start over, which asks first because the run is lost. Pure: main.ts reads the run here and ui/screens.ts draws it.
import { TIERS } from '../config/economy';
import type { RelicId } from '../config/relics';
import type { RealmId } from '../config/world';
import type { Champion } from './champions';

/** A champion's unfinished run of a realm, as its road shows it. */
export interface RoadRun {
  level: number; // its checkpoint: the level it goes on at
  tier: number; // the tier it is played on
  here: boolean; // the road shows that tier: its flags mark the run, and the panel continues it
  relics: { id: RelicId; tier: number }[]; // what it holds, in the order found
}

/**
 * The run of `realm` the road marks while it shows `tier`. Decided: a run still at level 1 is none: it has no checkpoint yet and nothing
 * to lose, so level 1 just says Fight (a death there plays its seed again, as #237 has it).
 */
export function roadRun(c: Champion, realm: RealmId, tier: number): RoadRun | null {
  const run = c.runs[realm];
  if (!run?.carry) return null;
  const r = run.carry.relics;
  return { level: run.level, tier: run.tier, here: run.tier === tier, relics: r.held.map((id) => ({ id, tier: r.tiers[id] ?? 1 })) };
}

/**
 * The tier the road opens on when none is asked for: the run's own, so a run in progress is what the road shows; else `want` (the
 * setting). Decided: the run's tier wins over the setting, or a Knight run would hide behind a Squire road.
 */
export const roadOpensOn = (c: Champion, realm: RealmId, want: number): number => (c.runs[realm]?.carry ? c.runs[realm]!.tier : want);

/** A flag in the run: `done` for a level cleared in it (before the checkpoint), `next` for the checkpoint itself, which glows. */
export const runMark = (run: RoadRun | null, level: number): 'done' | 'next' | null =>
  !run?.here ? null : level < run.level ? 'done' : level === run.level ? 'next' : null;

/** The level panel's line after a death in `level` (the issue's words). */
export const fellLine = (wave: number, level: number): string => `fell at wave ${wave}, restart level ${level}`;

/** #253: the level panel's fact for a run: its checkpoint, worded as levels cleared so it can't read as the champion's level. */
export const checkpointFact = (checkpoint: number): { label: string; value: string } =>
  ({ label: 'Checkpoint', value: checkpoint > 1 ? `Level ${checkpoint - 1} cleared` : 'None cleared' });

const relicCount = (n: number): string => `${n} relic${n === 1 ? '' : 's'}`;

/** What the level panel's bottom row offers for the picked level. */
export interface RoadGo {
  label: string; // the gold button
  enabled: boolean;
  plays: number; // the level the gold button starts
  ask: string | null; // the gold button asks this first: it starts a new run over one on another tier
  over: string | null; // a Start over button stands beside it, and asks this first
  note: string | null; // a line beside the champion's name
}

/**
 * The panel's buttons for `level` (open or not) of the road on `tier`, with the realm's run in progress or none.
 * - A run on this tier: Continue from its checkpoint, whichever flag is picked, and Start over. Decided: both on every level of the road,
 *   so the run is never out of reach and the screen keeps its one gold button.
 * - A run on another tier: only level 1 fights, and it asks first: one run per champion per realm, so the new run ends the old one.
 * - No run: level 1 fights; a later level can't start a run (#237: no head start).
 */
export function roadGo(run: RoadRun | null, level: number, tier: number, open: boolean): RoadGo {
  if (run?.here)
    return {
      label: `Continue from level ${run.level}`, enabled: true, plays: run.level, ask: null,
      over: `Start over from level 1? This run and its ${relicCount(run.relics.length)} are lost.`,
      note: level < run.level ? 'cleared in this run' : level > run.level ? `the run stands at level ${run.level}` : null,
    };
  const first = level === 1;
  return {
    label: 'Fight!', enabled: open && first, plays: 1,
    ask: run && first ? `Start a new run on ${TIERS[tier].name}? The ${TIERS[run.tier].name} run at level ${run.level} and its ${relicCount(run.relics.length)} are lost.` : null,
    over: null,
    note: run ? `a ${TIERS[run.tier].name} run stands at level ${run.level}` : open && !first ? 'The run starts at level 1' : null,
  };
}
