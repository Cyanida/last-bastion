import type { ArenaId } from './arenas';
import type { Voice } from '../logic/music';
import type { RealmId } from './world';

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
const PHRYGIAN_DOMINANT = [0, 1, 4, 5, 7, 8, 10]; // #231: Phrygian with a major third: the flat second's dread, and heat
const HARMONIC_MINOR = [0, 2, 3, 5, 7, 8, 11]; // #281: minor with a raised seventh: the leading tone pulls home like a bier to its grave

/** #219: a theme is an arena's, or a realm's own (its levels play it in place of their arena's). */
export type ThemeId = ArenaId | 'ironHold' | 'cinderlands' | 'barrowvale';

export const THEMES: Record<ThemeId, Theme> = {
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
  // #223: the Ember Forge (a plain run there; the Cinderlands' levels play their own theme, #231): the keep's march in a Phrygian minor, a hammer on the anvil for the drum
  emberForge: {
    name: 'The Ember Forge', root: 4, mode: PHRYGIAN, bpm: 80, meter: 4,
    chords: [0, 1, 3, 0, 5, 1, 6, 0], // i bII iv i | VI bII vii i
    drone: 'drone', pad: 'horn',
    pulse: { voice: 'bell', steps: [0, null, null, 2, null, null, 1, null] }, // the anvil's ring
    perc: { midi: 43, hits: [[0, 0.8], [0.5, 0.3], [2, 0.7], [2.5, 0.3]] }, // hammer blows in pairs
    lead: 'horn',
    boss: { midi: 40, hits: [[0, 1], [0.5, 0.5], [1, 0.7], [2, 0.9], [2.5, 0.5], [3, 0.7]] },
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
  // #219: the Iron Hold's own theme over the Great Keep: a minor forge march, anvil bells on the off-beats, a choir of iron under it
  ironHold: {
    name: 'The Iron Hold', root: 4, mode: MINOR, bpm: 72, meter: 4,
    chords: [0, 5, 6, 0, 3, 5, 4, 0], // i VI VII i | iv VI v i: heavy and square, it always comes home
    drone: 'drone', pad: 'choir',
    pulse: { voice: 'bell', steps: [null, null, 0, null, null, null, 2, null] }, // the anvil, struck on beats 2 and 4
    perc: { midi: 40, hits: [[0, 0.85], [1, 0.3], [2, 0.65], [2.5, 0.3], [3, 0.35]] }, // a hammer's march
    lead: 'horn',
    boss: { midi: 36, hits: [[0, 1], [0.75, 0.45], [1, 0.8], [2, 1], [2.75, 0.45], [3, 0.8], [3.5, 0.5]] },
  },
  // #231: the Cinderlands' own theme over the Ember Forge: a slow fire dance in three, a harp flickering over an organ's glow, a flute for the lead
  cinderlands: {
    name: 'The Cinderlands', root: 11, mode: PHRYGIAN_DOMINANT, bpm: 90, meter: 3,
    chords: [0, 1, 0, 3, 0, 6, 1, 0], // I bII I iv | I bvii bII I: it keeps falling back onto the flat second, like a fire that won't go out
    drone: 'drone', pad: 'organ',
    pulse: { voice: 'harp', steps: [0, 2, 1, 3, null, 2] }, // flames licking up the chord, a breath before the last
    perc: { midi: 47, hits: [[0, 0.75], [1, 0.3], [1.5, 0.4], [2, 0.55]] }, // a hand drum's dance
    lead: 'flute',
    boss: { midi: 38, hits: [[0, 1], [0.5, 0.45], [1, 0.7], [1.5, 0.45], [2, 0.9], [2.5, 0.55]] },
  },
  // #281: the Barrowvale's own theme over the Forsaken Graveyard: a slow funeral waltz, a tolling bell over an organ, a choir of mourners for the lead
  barrowvale: {
    name: 'The Barrowvale', root: 0, mode: HARMONIC_MINOR, bpm: 68, meter: 3,
    chords: [0, 5, 3, 4, 0, 3, 4, 0], // i VI iv V | i iv V i: the major V's leading tone drags every line back down to the tonic
    drone: 'drone', pad: 'organ',
    pulse: { voice: 'bell', steps: [0, null, null, null, 2, null] }, // the barrow bell: a toll on the downbeat, its echo on the third beat
    perc: { midi: 36, hits: [[0, 0.7], [2, 0.3]] }, // a muffled bier drum, one step a bar
    lead: 'choir',
    boss: { midi: 36, hits: [[0, 1], [1, 0.55], [1.5, 0.4], [2, 0.8], [2.5, 0.4]] },
  },
};

/** #219: the realms whose levels play a theme of their own; the rest play their arena's. */
export const REALM_THEMES: Partial<Record<RealmId, ThemeId>> = { ironHold: 'ironHold', cinderlands: 'cinderlands', barrowvale: 'barrowvale' };

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
  lookahead: 1, // v0.7.5: seconds of music queued ahead on the audio clock; a frame stall shorter than this cannot open a gap
  stingerGap: 1.5, // v0.7.1: seconds after a stinger before another can sound (a burst of tier-ups rings once)
};
