import type { SfxName } from '../core/audio';

/**
 * v0.8 (#26): the simulation's only way out to the device. It asks for sounds, section timers and a particle budget here;
 * the view (main.ts) plugs in the audio, the perf timers and the quality setting. Until then it is silent and untimed,
 * which is what tests, the bot and a future server get. tests/v8-pure-sim.test.ts keeps DOM, audio, storage and clocks out.
 */
export const view = {
  sfx: (_name: SfxName): void => {},
  begin: (): number => 0,
  end: (_section: string, _start: number): void => {},
  particleBudget: (): number => 1,
};

export const sfx = (name: SfxName): void => view.sfx(name);
export const begin = (): number => view.begin();
export const end = (section: string, start: number): void => view.end(section, start);
