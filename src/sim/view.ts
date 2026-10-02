import type { SfxName } from '../core/audio';
import type { Game } from '../core/types';
import type { CueSource } from '../config/voices';

/**
 * v0.8 (#26): the simulation's only way out to the device. It asks for section timers and a particle budget here;
 * the view (main.ts) plugs in the perf timers, the quality setting and the speaker (`sfx`, which plays the drained `g.out`). Until then it is silent and untimed,
 * which is what tests, the bot and a future server get. tests/v8-pure-sim.test.ts keeps DOM, audio, storage and clocks out.
 */
export const view = {
  sfx: (_name: SfxName, _cue?: Cue): void => {},
  begin: (): number => 0,
  end: (_section: string, _start: number): void => {},
  particleBudget: (): number => 1,
};

/**
 * #283: a cue's source and place. `src` decides how much it matters when the voices are full (a boss's cue keeps its voice, a foe's hit
 * in a crowd is dropped first); `at` is where it happened, which pans it and quiets it off screen. No `at`: in the middle, at full volume.
 */
export interface CueOpts {
  src?: CueSource;
  at?: { x: number; y: number } | null;
  voice?: string; // #285: a foe family's own sound (logic/foeSounds.ts foeBy), played in place of the cue's plain one
}
/** A cue as it waits in `g.out`: its place copied (x, y NaN for none), so the queue holds no entity. */
export interface Cue {
  name: SfxName;
  src: CueSource;
  x: number;
  y: number;
  voice?: string; // #285
}
/**
 * A sound cue: it waits in `g.out` until the view plays it (playCues) after the step (#114). #283: with its source and place, for example
 * `sfx(g, 'warn', { src: 'boss', at: boss })`.
 */
export const sfx = (g: Game, name: SfxName, o?: CueOpts): void => {
  g.out.push({ name, src: o?.src ?? 'world', x: o?.at ? o.at.x : NaN, y: o?.at ? o.at.y : NaN, voice: o?.voice });
};
/** #283: a foe's cue, at the foe: a boss's own weighs as a boss cue. */
export const by = (e: { x: number; y: number; def: { boss: boolean } }): CueOpts => ({ src: e.def.boss ? 'boss' : 'foe', at: e });
/** The view's side: play this step's cues, and empty the queue. */
export function playCues(g: Game): void {
  for (const c of g.out) view.sfx(c.name, c);
  g.out.length = 0;
}
export const begin = (): number => view.begin();
export const end = (section: string, start: number): void => view.end(section, start);
