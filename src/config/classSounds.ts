import type { ClassId } from './classes';

/**
 * #284: each class's own attack and ability sound (core/audio.ts plays them, logic/classSounds.ts picks them). A sound is a few layers
 * played together, each one oscillator or noise burst with a pitch slide, like the plain effects: wave, f0 -> f1 Hz over dur s at vol.
 * at: the layer starts this many s after the cue (a ring after the blow, an echo). rate: a noise layer's playback rate (low is duller,
 * high is hissier). The cue keeps its old name's voice priority (swing, shoot, ability in config/voices.ts) and goes out on the effects bus.
 */
export type LayerWave = 'sine' | 'square' | 'sawtooth' | 'triangle' | 'noise';
export interface SoundLayer {
  wave: LayerWave;
  f0: number;
  f1: number;
  dur: number;
  vol: number;
  at?: number;
  rate?: number;
}
export interface ClassSound {
  attack: SoundLayer[];
  ability: SoundLayer[];
}

export const CLASS_SOUNDS: Record<ClassId, ClassSound> = {
  // a sword's swish with a bright ring of steel; the Divine Shield is a held bell chord
  paladin: {
    attack: [
      { wave: 'noise', f0: 0, f1: 0, dur: 0.08, vol: 0.05, rate: 1.3 },
      { wave: 'triangle', f0: 1250, f1: 980, dur: 0.12, vol: 0.035, at: 0.02 },
    ],
    ability: [
      { wave: 'sine', f0: 523, f1: 523, dur: 0.55, vol: 0.1 },
      { wave: 'sine', f0: 784, f1: 784, dur: 0.5, vol: 0.07, at: 0.03 },
      { wave: 'triangle', f0: 1046, f1: 1568, dur: 0.3, vol: 0.04 },
    ],
  },
  // a heavy axe: a long low whoosh and a thud; the Berserker Rage is a rising roar
  viking: {
    attack: [
      { wave: 'noise', f0: 0, f1: 0, dur: 0.13, vol: 0.07, rate: 0.55 },
      { wave: 'square', f0: 150, f1: 55, dur: 0.1, vol: 0.05, at: 0.04 },
    ],
    ability: [
      { wave: 'sawtooth', f0: 85, f1: 190, dur: 0.45, vol: 0.12 },
      { wave: 'noise', f0: 0, f1: 0, dur: 0.35, vol: 0.08, rate: 0.7 },
      { wave: 'square', f0: 60, f1: 45, dur: 0.3, vol: 0.06, at: 0.1 },
    ],
  },
  // a light orb: a rising shimmer; the Heavenly Radiance is a bright sweep and a high echo
  angel: {
    attack: [
      { wave: 'sine', f0: 1100, f1: 1550, dur: 0.09, vol: 0.05 },
      { wave: 'triangle', f0: 1650, f1: 2200, dur: 0.07, vol: 0.02, at: 0.02 },
    ],
    ability: [
      { wave: 'sine', f0: 440, f1: 1320, dur: 0.4, vol: 0.12 },
      { wave: 'triangle', f0: 660, f1: 1980, dur: 0.35, vol: 0.06, at: 0.05 },
      { wave: 'sine', f0: 1760, f1: 1760, dur: 0.3, vol: 0.03, at: 0.2 },
    ],
  },
  // a dark orb: a falling buzz under a hollow tone; Raise Dead is a deep grinding groan from the ground
  necromancer: {
    attack: [
      { wave: 'sawtooth', f0: 300, f1: 140, dur: 0.11, vol: 0.035 },
      { wave: 'sine', f0: 150, f1: 95, dur: 0.12, vol: 0.05 },
    ],
    ability: [
      { wave: 'square', f0: 110, f1: 50, dur: 0.55, vol: 0.08 },
      { wave: 'sawtooth', f0: 220, f1: 70, dur: 0.45, vol: 0.06, at: 0.05 },
      { wave: 'noise', f0: 0, f1: 0, dur: 0.3, vol: 0.05, rate: 0.4, at: 0.1 },
    ],
  },
  // a bowstring's twang and the arrow's hiss; the Arrow Volley is a string drawn tight and a rush of shafts
  archer: {
    attack: [
      { wave: 'triangle', f0: 880, f1: 280, dur: 0.07, vol: 0.06 },
      { wave: 'noise', f0: 0, f1: 0, dur: 0.05, vol: 0.025, rate: 2, at: 0.01 },
    ],
    ability: [
      { wave: 'triangle', f0: 500, f1: 1100, dur: 0.15, vol: 0.08 },
      { wave: 'noise', f0: 0, f1: 0, dur: 0.3, vol: 0.07, rate: 1.8, at: 0.12 },
      { wave: 'triangle', f0: 900, f1: 300, dur: 0.08, vol: 0.05, at: 0.12 },
    ],
  },
};
