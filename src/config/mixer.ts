/**
 * #282: the sound mixer (core/audio.ts, logic/mixer.ts). Every sound goes out through one of four buses into the master; each bus and the
 * master has a Settings slider in percent. full: a bus's gain at 100% (the music sits under the effects, as it did before the mixer).
 * defaults: a fresh player's mix (music 55% is about the old "Medium"). duck: how far a bus drops under a heavy effect (audio.ts HEAVY); the
 * timing is MUSIC.duck's. ambience: the run's wind, lowpassed brown noise that swells and settles on a slow LFO.
 */
export type BusId = 'master' | 'music' | 'effects' | 'ui' | 'ambience';
export const BUS_ORDER: readonly BusId[] = ['master', 'music', 'effects', 'ui', 'ambience'];

export const MIXER = {
  full: { master: 1, music: 0.7, effects: 1, ui: 0.8, ambience: 0.5 } satisfies Record<BusId, number>,
  defaults: { master: 100, music: 55, effects: 100, ui: 70, ambience: 50 } satisfies Record<BusId, number>,
  step: 5, // the sliders move in steps of this many percent
  duck: { music: 0.45, ambience: 0.5 } satisfies Partial<Record<BusId, number>>,
  ambience: { seconds: 4, cutoff: 420, gain: 0.35, lfoHz: 0.07, lfoDepth: 0.15, fade: 1.5 },
};
