import type { ArenaId } from './arenas';
import type { Voice } from '../logic/music';

/**
 * v0.7.1 run music (logic/runMusic.ts composes it, core/music.ts plays it). One theme per arena, in the menu music's style:
 * a mode, a slow tempo, a two-bar-per-chord progression, and the voices that play each part.
 *   drone  root and fifth under every chord, in every layer (the sparse layer is little more than this)
 *   pad    the chord held under the base layer and up
 *   pulse  the base layer's ostinato, in eighths: steps up the chord (null is a rest)
 *   perc   the base layer's soft drum, as [beat, velocity]
 *   lead   the second layer's motif (it comes in when the fight gets dense or dangerous)
 * The boss layer adds `boss` (a drum pattern) and a bass line on every theme.
 */
export interface Theme {
  name: string;
  root: number; // the tonic as a MIDI pitch class (D = 2)
  mode: number[]; // the scale, in semitones above the tonic
  bpm: number;
  meter: number; // beats a bar
  chords: number[]; // the progression as scale degrees (0 = the tonic), two bars each
  drone: Voice;
  pad: Voice | null;
  pulse: { voice: Voice; steps: (number | null)[] } | null;
  perc: { midi: number; hits: [number, number][] } | null;
  lead: Voice;
  boss: { midi: number; hits: [number, number][] };
}

const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];
const MIXOLYDIAN = [0, 2, 4, 5, 7, 9, 10];
const MINOR = [0, 2, 3, 5, 7, 8, 10];

export const THEMES: Record<ArenaId, Theme> = {
  courtyard: {
    name: 'Castle Courtyard', root: 2, mode: DORIAN, bpm: 84, meter: 3,
    chords: [0, 6, 3, 0, 2, 6, 3, 0], // i VII IV i | III VII IV i, like the menu
    drone: 'drone', pad: null,
    pulse: { voice: 'harp', steps: [0, 1, 2, 3, 2, 1] },
    perc: { midi: 50, hits: [[0, 0.7], [1.5, 0.3], [2, 0.45]] }, // a soft frame drum
    lead: 'flute',
    boss: { midi: 45, hits: [[0, 1], [1, 0.6], [2, 0.7], [2.5, 0.45]] },
  },
  graveyard: {
    name: 'Forsaken Graveyard', root: 9, mode: PHRYGIAN, bpm: 66, meter: 4,
    chords: [0, 1, 5, 0, 3, 1, 6, 0], // i bII VI i | iv bII vii i: the flat second is the chill
    drone: 'drone', pad: 'choir',
    pulse: { voice: 'bell', steps: [2, null, null, null, null, 4, null, null] }, // sparse bells
    perc: null,
    lead: 'flute',
    boss: { midi: 38, hits: [[0, 1], [1.5, 0.5], [2, 0.8], [3, 0.6], [3.5, 0.4]] },
  },
  keep: {
    name: 'The Great Keep', root: 7, mode: MIXOLYDIAN, bpm: 76, meter: 4,
    chords: [0, 6, 3, 0, 4, 6, 3, 0], // I bVII IV I | v bVII IV I
    drone: 'drone', pad: 'horn',
    pulse: { voice: 'harp', steps: [0, null, 2, null, 1, null, 2, null] },
    perc: { midi: 45, hits: [[0, 0.7], [1, 0.25], [2, 0.55], [3, 0.25]] }, // a slow march
    lead: 'horn',
    boss: { midi: 43, hits: [[0, 1], [1, 0.6], [2, 0.8], [3, 0.6], [3.5, 0.5]] },
  },
  bastion: {
    name: 'The Last Bastion', root: 2, mode: MINOR, bpm: 92, meter: 4,
    chords: [0, 5, 3, 4, 0, 5, 6, 4], // i VI iv v | i VI VII v: never quite comes home
    drone: 'organ', pad: 'organ',
    pulse: null,
    perc: { midi: 38, hits: [[0, 0.8], [1, 0.4], [2, 0.6], [3, 0.4]] }, // a low timpani pulse
    lead: 'horn',
    boss: { midi: 36, hits: [[0, 1], [0.5, 0.4], [1, 0.7], [2, 0.9], [2.5, 0.4], [3, 0.7], [3.5, 0.5]] },
  },
};

/**
 * Mixing and the adaptive rules. Volumes are gains; the run mix sits under the menu's so the music never gets louder than the effects.
 * danger: the second layer comes in at this many enemies alive, or below this share of HP. calmBars: a layer only steps down after
 * this many bars of asking for less, so it does not flap. voices: the most notes sounding at once (low quality: phones).
 */
export const MUSIC = {
  volume: { off: 0, low: 0.2, medium: 0.4, high: 0.7 },
  effects: { off: 0, low: 0.35, medium: 0.65, high: 1 },
  runMix: 0.55,
  duck: { depth: 0.45, attack: 0.03, hold: 0.25, release: 0.6 }, // under the heavy effects (audio.ts HEAVY)
  danger: { enemies: 35, hp: 0.4 },
  calmBars: 2,
  crossfadeBars: 2,
  voices: { high: 28, low: 16 },
};
