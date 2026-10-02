import type { BossComposer, BossTheme } from '../config/music';
import { clampIndex, inRange, RANGES, rngFor, type NoteEvent, type Voice } from './music';
import { composeRunBar, formBars, isBossMusic, ladderOf, lowest, musicTheme, triad, type Cue, type Layer, type MusicId } from './runMusic';

/**
 * #289: the boss themes as a score, like logic/runMusic.ts: pure and seeded; core/music.ts plays them. A boss theme is scored by the run
 * music's parts (its layer is the boss's phase: logic/runMusic.ts bossMusicOf) plus a part of its own, from its composer below, that
 * makes it this boss's and builds with the layer too. That part comes right after the drone, so a full voice budget drops the generic
 * parts before it.
 */
type Composer = (t: BossTheme, seed: number, bar: number, layer: Layer) => NoteEvent[];

/** One bar of whatever the id plays: a boss's theme, or an arena's (logic/runMusic.ts composeRunBar). */
export function composeMusicBar(id: MusicId, seed: number, bar: number, layer: Layer, cue: Cue | null = null): NoteEvent[] {
  const t = musicTheme(id);
  return isBossMusic(id) ? composeBossBar(t as BossTheme, seed, bar, layer, cue) : composeRunBar(t, seed, bar, layer, cue);
}

export function composeBossBar(t: BossTheme, seed: number, bar: number, layer: Layer, cue: Cue | null = null): NoteEvent[] {
  const base = composeRunBar(t, seed, bar, layer, cue);
  if (cue || layer === 0) return base;
  const drone = bar % 2 === 0 ? 2 : 0; // composeRunBar lists the drone's root and fifth first, on a chord's first bar
  return [...base.slice(0, drone), ...COMPOSERS[t.composer](t, seed, bar, layer), ...base.slice(drone)];
}

const chordAt = (t: BossTheme, bar: number) => triad(t, t.chords[Math.floor((bar % formBars(t)) / 2)]);
const note = (voice: Voice, time: number, midi: number, duration: number, velocity: number): NoteEvent => ({ voice, time, midi, duration, velocity: Math.min(1, velocity) });

export const COMPOSERS: Record<BossComposer, Composer> = {
  /** The Black Knight's grim march: a snare on every beat with its drag, the horn tolling root and fifth, a roll into every fourth bar. */
  march(t, _seed, bar, layer) {
    const chord = chordAt(t, bar);
    const v = 0.35 + layer * 0.12;
    const notes = [[0, 1], [1, 0.6], [1.75, 0.35], [2, 0.8], [3, 0.6], [3.75, 0.35]].map(([b, k]) => note('drum', b, 58, 0.3, v * k));
    if (layer >= 2 && bar % 2 === 0) {
      const root = lowest(chord[0], 'horn');
      notes.push(note('horn', 0, root, 2, 0.55), note('horn', 2, root + 7 <= RANGES.horn[1] ? root + 7 : root - 5, 2, 0.5));
    }
    if (layer === 3 && bar % 4 === 3) for (let k = 0; k < 6; k++) notes.push(note('drum', 3 + k / 6, 58, 0.2, 0.3 + k * 0.08)); // the roll
    return notes;
  },
  /** The Warlord's war horns: a call up root, fifth and octave every few bars (more often as he rages), toms answering it. */
  warhorn(t, seed, bar, layer) {
    const chord = chordAt(t, bar);
    const notes: NoteEvent[] = [note('drum', 0.5, 50, 0.4, 0.3 + layer * 0.1), note('drum', 2.5, 47, 0.4, 0.3 + layer * 0.1)];
    if (bar % (layer === 1 ? 4 : 2) === 0) {
      const root = lowest(chord[0], 'horn');
      const call = rngFor(seed, bar, 40)() < 0.5 ? [0, 7, 12] : [0, 5, 7];
      call.forEach((step, k) => notes.push(note('horn', k * 0.75, Math.min(RANGES.horn[1], root + step) , k === 2 ? 2.5 : 0.75, 0.6 + layer * 0.05)));
      if (layer === 3) notes.push(note('bass', 0, lowest(chord[0], 'bass'), 3, 0.7)); // the call doubled low
    }
    return notes;
  },
  /** The Lich's cold choir: a high line held a bar at a time over the pad, stepping the chord's tones; ice bells from his last phase. */
  choir(t, seed, bar, layer) {
    const chord = chordAt(t, bar);
    const [ladder, top] = ladderOf(chord, 'choir', 0.8);
    const r = rngFor(seed, bar, 41);
    const notes = [note('choir', 0, ladder[clampIndex(top - (bar % 2) - (r() < 0.3 ? 1 : 0), ladder)], t.meter, 0.45 + layer * 0.1)];
    if (layer >= 2) notes.push(note('choir', 0, ladder[clampIndex(top - 2 - (bar % 2), ladder)], t.meter, 0.4)); // a second voice under it
    if (layer === 3) {
      const bells = inRange(chord, ...RANGES.bell);
      notes.push(note('bell', 0, bells[bells.length - 1], 4, 0.45), note('bell', 1.5, bells[bells.length - 2] ?? bells[0], 4, 0.35));
    }
    return notes;
  },
  /** The Plague Abbot's sickly chant: one reciting note in quarters that sags to the flat second at a phrase's end; later a second voice a fourth under it, like old organum. */
  chant(t, _seed, bar, layer) {
    const pcs = t.mode.map((s) => (t.root + s) % 12);
    const scale = inRange(pcs, ...RANGES.choir);
    const tone = scale.findIndex((m) => m % 12 === t.root); // the reciting note: the tonic, low in the choir
    const notes: NoteEvent[] = [];
    const sag = bar % 4 === 3;
    for (let b = 0; b < t.meter; b++) {
      const i = sag && b >= 2 ? tone + 1 : tone; // up to the flat second, a half step that will not resolve
      notes.push(note('choir', b, scale[clampIndex(i, scale)], 1, 0.4 + layer * 0.08 - (b % 2) * 0.08));
      if (layer >= 2) {
        const under = scale[clampIndex(i, scale)] - 5;
        if (under >= RANGES.organ[0] && pcs.includes(under % 12)) notes.push(note('organ', b, under, 1, 0.35));
      }
    }
    if (layer === 3 && bar % 2 === 0) notes.push(note('bell', 0, inRange([t.root], ...RANGES.bell)[0], 3, 0.4)); // a cracked handbell
    return notes;
  },
};
