import type { EnemyId } from './enemies';

/**
 * #286: every boss's own sounds, synthesised like the rest (core/audio.ts): a signature as he arrives, a sound for his big moves (the
 * one his warning marks) and a cue as each phase begins. A sound is a few tones, each one oscillator or noise burst with a pitch slide,
 * starting `at` seconds in. The phase cue rises by `phaseRise` per phase past the second, so the third phase sounds worse than the second.
 * priority: each cue's weight in the voice limit (config/voices.ts), before the boss source's own; an arrival or a phase cue outranks a
 * warning, so in a crowd they are the last to go. #292: and the Barrowvale's Gravedigger and Barrow King.
 */
export type ToneWave = OscillatorType | 'noise';
export interface Tone {
  wave: ToneWave;
  f0: number;
  f1: number;
  dur: number;
  vol: number;
  at?: number;
}
export type BossCueKind = 'arrive' | 'move' | 'phase';
export type BossSoundSet = Record<BossCueKind, Tone[]>;

export const BOSS_SOUND = {
  priority: { arrive: 7, phase: 7, move: 4 } satisfies Record<BossCueKind, number>,
  phaseRise: 1.12,
  maxPhase: 4, // an elite crown boss's fourth phase is the last one heard as its own
};

const t = (wave: ToneWave, f0: number, f1: number, dur: number, vol: number, at = 0): Tone => ({ wave, f0, f1, dur, vol, at });
const noise = (dur: number, vol: number, at = 0): Tone => t('noise', 0, 0, dur, vol, at);

export const BOSS_SOUNDS = {
  // a grim horn and the clank of his plate; his charge thunders; a new phase rings like a struck anvil
  blackKnight: {
    arrive: [t('sawtooth', 110, 98, 0.8, 0.12), t('sawtooth', 165, 147, 0.8, 0.06, 0.05), noise(0.12, 0.1, 0.4)],
    move: [noise(0.3, 0.14), t('square', 160, 70, 0.3, 0.08)],
    phase: [t('square', 900, 700, 0.15, 0.07), t('sawtooth', 82, 55, 0.7, 0.14, 0.08)],
  },
  // a war horn up a fourth; his slam a deep thud; a new phase his roar over a drum
  warlord: {
    arrive: [t('sawtooth', 147, 147, 0.35, 0.11), t('sawtooth', 196, 220, 0.6, 0.12, 0.35)],
    move: [t('sine', 70, 35, 0.4, 0.2), noise(0.25, 0.12)],
    phase: [t('sawtooth', 180, 90, 0.6, 0.13), noise(0.2, 0.14), noise(0.2, 0.12, 0.3)],
  },
  // two cold, slightly sour sines falling; a whistling spell; a new phase a shriek rising out of the dark
  lich: {
    arrive: [t('sine', 880, 660, 1, 0.08), t('sine', 1318, 990, 1, 0.05), t('sine', 932, 698, 1, 0.04, 0.1)],
    move: [t('sine', 1200, 400, 0.35, 0.08), t('triangle', 600, 200, 0.35, 0.06)],
    phase: [t('sine', 440, 1760, 0.6, 0.1), noise(0.4, 0.06, 0.1)],
  },
  // a church bell and its fifth; his fire line a rising hiss; a new phase the bell tolled low
  inquisitor: {
    arrive: [t('triangle', 523, 520, 1, 0.12), t('triangle', 784, 780, 1, 0.07, 0.05)],
    move: [t('sawtooth', 300, 900, 0.3, 0.07), noise(0.3, 0.06)],
    phase: [t('triangle', 262, 260, 1.1, 0.14), t('triangle', 392, 390, 1.1, 0.08), t('triangle', 523, 520, 0.6, 0.05, 0.5)],
  },
  // a roar with fire behind it; his breath a long rush; a new phase a shriek climbing
  dragon: {
    arrive: [t('sawtooth', 120, 60, 1.1, 0.16), noise(1, 0.12), t('square', 90, 45, 1, 0.06, 0.1)],
    move: [noise(0.5, 0.14), t('sawtooth', 200, 80, 0.5, 0.08)],
    phase: [t('sawtooth', 90, 220, 0.7, 0.14), noise(0.5, 0.1, 0.2)],
  },
  // chains drawn tight; his seal a falling clank; a new phase a low gong
  warden: {
    arrive: [t('square', 98, 98, 0.5, 0.08), noise(0.08, 0.1, 0.1), noise(0.08, 0.1, 0.3), noise(0.08, 0.1, 0.5)],
    move: [t('square', 600, 200, 0.25, 0.07), noise(0.15, 0.1)],
    phase: [t('sine', 65, 60, 1.2, 0.2), t('triangle', 196, 194, 1, 0.07)],
  },
  // three hammer strikes on an anvil; his hammer comes down; a new phase the bellows roar
  forgemaster: {
    arrive: [t('square', 1200, 900, 0.1, 0.07), t('square', 1200, 900, 0.1, 0.07, 0.2), t('square', 1350, 1000, 0.14, 0.08, 0.4), t('sine', 80, 60, 0.6, 0.12, 0.4)],
    move: [t('square', 140, 50, 0.3, 0.12), noise(0.2, 0.12)],
    phase: [t('sawtooth', 70, 140, 0.6, 0.12), noise(0.6, 0.1)],
  },
  // a brass fanfare up a triad; his blow steel on steel; a new phase the fanfare fallen
  ironKing: {
    arrive: [t('square', 196, 196, 0.25, 0.07), t('square', 262, 262, 0.25, 0.07, 0.2), t('square', 330, 330, 0.6, 0.08, 0.4)],
    move: [t('square', 1000, 600, 0.12, 0.07), t('sawtooth', 110, 55, 0.3, 0.1)],
    phase: [t('square', 392, 196, 0.5, 0.08), t('square', 330, 165, 0.6, 0.07, 0.1)],
  },
  // a bright rising call over crackling; her flare a spark and a hiss; a new phase she blazes up
  emberQueen: {
    arrive: [t('triangle', 660, 990, 0.6, 0.1), t('triangle', 990, 1320, 0.4, 0.06, 0.3), noise(0.7, 0.07)],
    move: [noise(0.3, 0.1), t('triangle', 1200, 500, 0.3, 0.07)],
    phase: [t('sine', 330, 1320, 0.5, 0.1), t('sawtooth', 220, 440, 0.5, 0.06)],
  },
  // a rumble felt more than heard; his fist a deep crash; a new phase the ground groans
  cinderColossus: {
    arrive: [t('sine', 45, 35, 1.3, 0.24), noise(1.1, 0.12), t('square', 60, 40, 0.4, 0.08, 0.6)],
    move: [t('sine', 60, 30, 0.5, 0.22), t('square', 120, 40, 0.4, 0.08)],
    phase: [t('sawtooth', 55, 110, 0.8, 0.14), noise(0.8, 0.12)],
  },
  // a sour chord: a crown that is not his; his blow a cruel swipe; a new phase the chord falls an octave
  usurper: {
    arrive: [t('sawtooth', 147, 147, 0.9, 0.08), t('sawtooth', 156, 156, 0.9, 0.06), t('sawtooth', 220, 208, 0.6, 0.06, 0.3)],
    move: [t('sawtooth', 400, 150, 0.3, 0.09), noise(0.12, 0.08)],
    phase: [t('square', 220, 110, 0.7, 0.08), t('sawtooth', 233, 116, 0.7, 0.08)],
  },
  // a cracked handbell, beating against itself; his flasks a wet cough; a new phase a sagging toll
  abbot: {
    arrive: [t('triangle', 233, 232, 1, 0.12), t('sine', 247, 246, 1, 0.08), t('triangle', 233, 232, 0.8, 0.08, 0.6)],
    move: [noise(0.2, 0.1), t('sine', 300, 180, 0.25, 0.08, 0.05)],
    phase: [t('triangle', 175, 165, 1.1, 0.14), t('triangle', 185, 175, 1.1, 0.08)],
  },
  // #292: a spade scraping stone, then two thuds of earth; his spade swung; a new phase a cracked grave bell over the earth falling
  gravedigger: {
    arrive: [noise(0.3, 0.08), t('square', 220, 180, 0.3, 0.05), t('sine', 70, 50, 0.25, 0.14, 0.45), t('sine', 70, 50, 0.25, 0.13, 0.75)],
    move: [t('sawtooth', 500, 160, 0.25, 0.08), noise(0.15, 0.1, 0.1)],
    phase: [t('triangle', 147, 145, 1.1, 0.12), t('triangle', 156, 154, 1.1, 0.06), t('sine', 70, 52, 0.8, 0.14, 0.05)],
  },
  // #292: a hollow horn from under the barrow over the bell; his Reap a swept crescent; a new phase his dead moan up out of the ground
  barrowKing: {
    arrive: [t('sawtooth', 73, 65, 1.1, 0.1), t('sine', 110, 98, 1.1, 0.08, 0.1), t('triangle', 262, 260, 0.9, 0.07, 0.4)],
    move: [noise(0.35, 0.12), t('sawtooth', 600, 120, 0.35, 0.08)],
    phase: [t('sine', 98, 196, 0.8, 0.12), t('sawtooth', 65, 130, 0.8, 0.08), noise(0.5, 0.07, 0.2)],
  },
} satisfies Partial<Record<EnemyId, BossSoundSet>>;
export type BossSoundId = keyof typeof BOSS_SOUNDS;
