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
  /** #291: the Forgemaster's anvil: hammer blows in a strike-strike, strike rhythm, each ringing a bell on the chord; more blows as he heats, horn stabs in his last phase. */
  anvil(t, _seed, bar, layer) {
    const chord = chordAt(t, bar);
    const bells = inRange(chord, ...RANGES.bell);
    const blows: [number, number][] = layer === 1 ? [[0, 1], [0.5, 0.55], [2, 0.9]] : [[0, 1], [0.5, 0.55], [2, 0.9], [3, 0.7], [3.5, 0.45]];
    const notes: NoteEvent[] = [];
    blows.forEach(([b, k], i) => {
      notes.push(note('drum', b, 60, 0.15, (0.35 + layer * 0.1) * k)); // the hammer's clang
      if (k >= 0.7) notes.push(note('bell', b, bells[(bar + i) % Math.min(3, bells.length)], 1.5, 0.3 + layer * 0.06)); // the anvil rings
    });
    if (layer === 3) for (const b of [0, 2]) notes.push(note('horn', b, lowest(chord[0], 'horn'), 0.75, 0.6));
    return notes;
  },
  /** #291: the Iron King's crown: a dotted horn fanfare up root, third and fifth on every chord, answered from his second phase by a choir crowning it; a drum roll to his throne in the last. */
  crown(t, _seed, bar, layer) {
    const chord = chordAt(t, bar);
    const [ladder, base] = ladderOf(chord, 'horn', 0.2);
    const up = (k: number) => ladder[clampIndex(base + k, ladder)];
    const v = 0.5 + layer * 0.07;
    const notes: NoteEvent[] = bar % 2 === 0
      ? [note('horn', 0, up(0), 1.5, v), note('horn', 1.5, up(1), 0.5, v * 0.8), note('horn', 2, up(2), 2, v)]
      : layer >= 2 ? [note('horn', 0, up(2), 2, v * 0.85), note('horn', 2, up(0), 2, v * 0.85)] : [];
    if (layer >= 2) {
      const [voices, top] = ladderOf(chord, 'choir', 0.9);
      notes.push(note('choir', 0, voices[top], t.meter, 0.4), note('choir', 0, voices[clampIndex(top - 1, voices)], t.meter, 0.35));
    }
    if (layer === 3 && bar % 4 === 3) for (let k = 0; k < 8; k++) notes.push(note('drum', 2 + k / 4, 45, 0.2, 0.3 + k * 0.07)); // the roll
    return notes;
  },
  /** #291: the Ember Queen's flame: a flute winding the scale like a flame, quarters at first, eighths from her second phase, doubled on the harp and over finger cymbals in her last. */
  flame(t, seed, bar, layer) {
    const pcs = t.mode.map((s) => (t.root + s) % 12);
    const scale = inRange(pcs, ...RANGES.flute);
    const r = rngFor(seed, bar, 42);
    let i = scale.findIndex((m) => m >= 68 && m % 12 === chordAt(t, bar)[0]);
    if (i < 0) i = Math.floor(scale.length / 2);
    const step = layer === 1 ? 1 : 0.5;
    const notes: NoteEvent[] = [];
    for (let b = 0; b < t.meter; b += step) {
      const m = scale[clampIndex(i, scale)];
      notes.push(note('flute', b, m, step, 0.35 + layer * 0.08 - (b % 1) * 0.1));
      if (layer === 3) notes.push(note('harp', b, m - 12, step, 0.35), note('drum', b + step / 2, 62, 0.1, 0.25)); // the harp an octave under; the cymbals between
      i += r() < 0.5 ? -1 : 1; // it flickers up and down a step at a time
    }
    return notes;
  },
  /** #291: the Cinder Colossus's footfalls: a giant's steps on one and three under an organ pedal; from his second phase rubble falls after each step and the fifth joins the pedal; in his last the flute shrieks. */
  footfall(t, _seed, bar, layer) {
    const chord = chordAt(t, bar);
    const notes: NoteEvent[] = [];
    for (const b of [0, 2]) {
      notes.push(note('drum', b, 31, 1, 0.5 + layer * 0.12));
      if (layer >= 2) notes.push(note('drum', b + 0.5, 52, 0.2, 0.25), note('drum', b + 0.75, 50, 0.2, 0.2)); // the rubble
    }
    if (bar % 2 === 0) {
      const pedal = lowest(chord[0], 'organ');
      notes.push(note('organ', 0, pedal, t.meter * 2, 0.45));
      if (layer >= 2) notes.push(note('organ', 0, lowest(chord[2], 'organ'), t.meter * 2, 0.35));
    }
    if (layer === 3 && bar % 4 === 0) {
      const [ladder, top] = ladderOf(chord, 'flute', 1);
      notes.push(note('flute', 0, ladder[top], 1.5, 0.55), note('flute', 1.5, ladder[clampIndex(top - 1, ladder)], 1.5, 0.45)); // the shriek, falling
    }
    return notes;
  },
};
