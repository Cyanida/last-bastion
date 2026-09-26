import type { SfxName } from '../core/audio';
import type { Game } from '../core/types';

/**
 * v0.8 (#26): the simulation's only way out to the device. It asks for section timers and a particle budget here;
 * the view (main.ts) plugs in the perf timers, the quality setting and the speaker (`sfx`, which plays the drained `g.out`). Until then it is silent and untimed,
 * which is what tests, the bot and a future server get. tests/v8-pure-sim.test.ts keeps DOM, audio, storage and clocks out.
 */
export const view = {
  sfx: (_name: SfxName): void => {},
  begin: (): number => 0,
  end: (_section: string, _start: number): void => {},
  particleBudget: (): number => 1,
};

/** A sound cue: it waits in `g.out` until the view plays it (playCues) after the step (#114). */
export const sfx = (g: Game, name: SfxName): void => {
  g.out.push(name);
};
/** The view's side: play this step's cues, and empty the queue. */
export function playCues(g: Game): void {
  for (const name of g.out) view.sfx(name);
  g.out.length = 0;
}
export const begin = (): number => view.begin();
export const end = (section: string, start: number): void => view.end(section, start);
