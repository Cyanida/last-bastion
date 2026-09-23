import type { ArenaId } from '../config/arenas';
import { MUSIC, THEMES, type Theme } from '../config/music';
import type { Game } from '../core/types';
import { clampIndex, inRange, pick, RANGES, rngFor, type NoteEvent, type Voice } from './music';
import { pacingOf } from './waves';

/**
 * v0.7.1 run music as a score, like logic/music.ts for the menus: pure and seeded; core/music.ts plays it.
 * Layers: 0 sparse (breathers, the Merchant, the calm before the first wave), 1 base (a wave), 2 the second layer (a dense or
 * dangerous fight), 3 the boss layer (percussion and a bass line on top). Every part draws from its own seeded stream, so a
 * layer coming in adds its part and never re-rolls the others. Parts are listed from the most to the least needed: when the voice
 * budget is full, core/music.ts drops the last ones. The conductor below reads the mood once a bar.
 */
export type Layer = 0 | 1 | 2 | 3;
export type Cue = 'fork' | 'victory';
export interface Mood {
  arena: ArenaId;
  layer: Layer;
  cue: Cue | null;
}

export const barSeconds = (t: Theme) => (t.meter * 60) / t.bpm;
const formBars = (t: Theme) => t.chords.length * 2;
const pitchClasses = (t: Theme) => t.mode.map((s) => (t.root + s) % 12);
/** The triad on a scale degree, as pitch classes, root first. */
const triad = (t: Theme, degree: number) => [0, 2, 4].map((k) => (t.root + t.mode[(degree + k) % 7]) % 12);
/** The lowest pitch of that class in the voice's range. */
const lowest = (pc: number, voice: Voice) => RANGES[voice][0] + ((pc - RANGES[voice][0]) % 12 + 12) % 12;
/** A ladder of the chord's tones across the voice's range, and the index nearest `frac` of the way up it. */
function ladderOf(chord: number[], voice: Voice, frac: number): [number[], number] {
  const ladder = inRange(chord, ...RANGES[voice]);
  return [ladder, Math.round((ladder.length - 1) * frac)];
}

/** Motif rhythms in beats (negative is a rest), per meter; and the moves in scale steps from one note to the next. */
const RHYTHMS: Record<number, number[][]> = {
  3: [[1, 1, 1], [1.5, 0.5, 1], [2, 1], [-1, 1, 1], [1, 0.5, 0.5, 1]],
  4: [[1, 1, 2], [1.5, 0.5, 2], [2, 1, 1], [1, 0.5, 0.5, 2], [-1, 1, 2]],
};
const MOVES = [[1, 1, -1], [2, -1, -1], [-1, -1, 2], [1, 2, -2], [0, 1, -1]];

export function composeRunBar(t: Theme, seed: number, bar: number, layer: Layer, cue: Cue | null = null): NoteEvent[] {
  const pos = bar % formBars(t);
  const pass = Math.floor(bar / formBars(t));
  const chord = triad(t, t.chords[Math.floor(pos / 2)]);
  const notes: NoteEvent[] = [];
  const add = (voice: Voice, time: number, midi: number, duration: number, velocity: number) =>
    notes.push({ voice, time, midi, duration, velocity: Math.min(1, velocity) });
  const held = t.meter * 2; // a chord lasts two bars

  // drone: root and fifth under each chord, in every layer
  if (pos % 2 === 0) {
    const root = lowest(chord[0], t.drone);
    add(t.drone, 0, root, held, layer === 0 ? 0.6 : 0.8);
    add(t.drone, 0, root + 7, held, layer === 0 ? 0.4 : 0.55);
  }
  if (cue) return [...notes, ...cueNotes(t, cue)];

  if (layer === 0) {
    // sparse: now and then a single note over the drone
    const r = rngFor(seed, bar, 20);
    if (pos % 2 === 1 && r() < 0.6) {
      const voice = t.pulse?.voice ?? t.lead;
      const [ladder, mid] = ladderOf(chord, voice, 0.5);
      add(voice, pick([0, 1], r), ladder[clampIndex(mid + pick([-1, 0, 1], r), ladder)], 2, 0.45);
    }
    return notes;
  }

  // pad: the chord held, voiced low in its range
  if (t.pad && pos % 2 === 0) {
    const [ladder, low] = ladderOf(chord, t.pad, 0.25);
    for (let i = 0; i < 3; i++) add(t.pad, 0, ladder[clampIndex(low + i, ladder)], held, 0.5);
  }

  // boss: a heavier drum and a bass line (root, fifth, root; the last beat reaches for the next chord)
  if (layer === 3) {
    for (const [beat, v] of t.boss.hits) add('drum', beat, t.boss.midi, 0.6, v);
    const root = lowest(chord[0], 'bass');
    const next = lowest(triad(t, t.chords[Math.floor(((pos + 1) % formBars(t)) / 2)])[0], 'bass');
    const top = root + 12 <= RANGES.bass[1] ? root + 12 : root;
    const line = t.meter === 3 ? [[0, root, 1], [1, root + 7, 1], [2, pos % 2 ? next : root, 1]] : [[0, root, 1.5], [1.5, root, 0.5], [2, root + 7, 1], [3, pos % 2 ? next : top, 1]];
    for (const [beat, midi, d] of line) add('bass', beat, midi, d, beat === 0 ? 0.8 : 0.6);
  }

  // lead: the theme's motif (rhythm and moves drawn once per piece), varied every pass (turned upside down, moved up or down)
  if (layer >= 2) {
    const piece = rngFor(seed, 0, 22);
    const rhythm = pick(RHYTHMS[t.meter] ?? RHYTHMS[4], piece);
    const moves = pick(MOVES, piece);
    const varied = rngFor(seed, pass, 23);
    const flip = varied() < 0.4 ? -1 : 1;
    const shift = pick([0, 0, 1, -1, 2], varied);
    const scale = inRange(pitchClasses(t), ...RANGES[t.lead]);
    const centre = Math.floor(scale.length / 2) + shift;
    // start on the chord tone nearest the centre; the second bar of a chord answers with one long note
    let i = scale.reduce((best, m, k) => (chord.includes(m % 12) && Math.abs(k - centre) < Math.abs(best - centre) ? k : best), -99);
    i = clampIndex(i, scale);
    const answer = pos % 2 === 1;
    let time = 0;
    let n = 0;
    for (const d of answer ? [t.meter - 1] : rhythm) {
      if (d < 0) {
        time -= d;
        continue;
      }
      if (n > 0) i = clampIndex(i + flip * moves[(n - 1) % moves.length], scale);
      add(t.lead, time, scale[i], d, (n === 0 ? 0.65 : 0.55) - (answer ? 0.1 : 0));
      time += d;
      n++;
    }
  }

  // perc: the soft drum
  for (const [beat, v] of t.perc?.hits ?? []) add('drum', beat, t.perc!.midi, 0.5, v * 0.8);

  // pulse: the ostinato, one voicing per chord (sometimes a step up the ladder)
  if (t.pulse) {
    const r = rngFor(seed, Math.floor(bar / 2), 21);
    const [ladder, low] = ladderOf(chord, t.pulse.voice, 0.2);
    const base = low + (r() < 0.3 ? 1 : 0);
    t.pulse.steps.forEach((step, i) => {
      if (step !== null && i * 0.5 < t.meter) add(t.pulse!.voice, i * 0.5, ladder[clampIndex(base + step, ladder)], 1.5, (i === 0 ? 0.7 : i % 2 ? 0.4 : 0.55) + r() * 0.1);
    });
  }
  return notes;
}

/** Short cues over the drone: a rising horn call at the fork in the road, and a fanfare on the home chord (major) for a victory. */
function cueNotes(t: Theme, cue: Cue): NoteEvent[] {
  const major = (d: number) => (t.mode[(d + 2) % 7] - t.mode[d] + 12) % 12 === 4;
  const chord = triad(t, cue === 'victory' && !major(0) ? 2 : 0); // a minor mode wins on its major third degree
  const [horn, mid] = ladderOf(chord, 'horn', 0.3);
  const call = [horn[clampIndex(mid, horn)], horn[clampIndex(mid + 2, horn)], horn[clampIndex(mid + 3, horn)]];
  const notes: NoteEvent[] = call.map((midi, k) => ({ voice: 'horn', time: k, midi, duration: k === 2 ? t.meter : 1, velocity: 0.7 }));
  const bells = inRange(chord, ...RANGES.bell);
  notes.push({ voice: 'bell', time: 2, midi: bells[1], duration: 5, velocity: 0.6 });
  if (cue === 'victory') {
    const [harp, low] = ladderOf(chord, 'harp', 0.2);
    for (let k = 0; k < 5; k++) notes.push({ voice: 'harp', time: k * 0.12, midi: harp[clampIndex(low + k, harp)], duration: 3, velocity: 0.6 });
    notes.push({ voice: 'bell', time: 2.5, midi: bells[2], duration: 5, velocity: 0.5 });
  }
  return notes;
}

/** Where the music is: the theme, the layer it plays, how far into the theme, and when the next bar starts (AudioContext seconds). */
export interface Conductor {
  seed: number;
  arena: ArenaId;
  layer: Layer;
  bar: number;
  at: number;
  calm: number; // bars in a row the mood has asked for a lower layer
  cue: Cue | null; // the cue last asked for: one plays once each time it is asked for
}
/** One bar to play. `from`: the first bar in a new arena, crossfading out of this one. */
export interface Bar {
  at: number;
  arena: ArenaId;
  layer: Layer;
  bar: number;
  cue: Cue | null;
  from: ArenaId | null;
}

export const newConductor = (mood: Mood, seed: number, at: number): Conductor => ({ seed, arena: mood.arena, layer: mood.layer, bar: 0, at, calm: 0, cue: mood.cue });

/**
 * The lookahead scheduler's clock: every bar whose downbeat falls before now + lookahead, reading the mood once a bar, at its
 * downbeat. It is the only place the music changes, so every change lands on a bar line. Up comes in on the next bar, down
 * only after MUSIC.calmBars; a new arena starts on the next bar with a crossfade.
 */
export function conduct(c: Conductor, want: Mood, now: number, lookahead: number): { c: Conductor; bars: Bar[] } {
  const bars: Bar[] = [];
  let next = { ...c, at: Math.max(c.at, now) }; // after a long stall, skip ahead rather than pile up late notes
  while (next.at < now + lookahead) {
    const from = want.arena !== next.arena ? next.arena : null;
    const calm = want.layer < next.layer ? next.calm + 1 : 0;
    const layer = want.layer >= next.layer || calm > MUSIC.calmBars ? want.layer : next.layer;
    const bar = from ? 0 : next.bar;
    bars.push({ at: next.at, arena: want.arena, layer, bar, cue: want.cue !== next.cue ? want.cue : null, from });
    next = { ...next, arena: want.arena, layer, bar: bar + 1, calm: layer === want.layer ? 0 : calm, cue: want.cue, at: next.at + barSeconds(THEMES[want.arena]) };
  }
  return { c: next, bars };
}

/** What the run asks of the music right now (main.ts, every frame). */
export function moodOf(g: Pick<Game, 'arena' | 'wave' | 'enemies' | 'player' | 'pendingMerchant' | 'pendingRoute' | 'victory'>): Mood {
  const cue: Cue | null = g.victory === 'pending' ? 'victory' : g.pendingRoute ? 'fork' : null;
  const dense = g.enemies.length >= MUSIC.danger.enemies || g.player.hp < g.player.stats.hp * MUSIC.danger.hp;
  const layer: Layer = g.pendingMerchant || cue ? 0 : g.enemies.some((e) => e.def.boss) ? 3 : dense ? 2 : g.wave === 0 || pacingOf(g.wave) === 'breather' ? 0 : 1;
  return { arena: g.arena.id, layer, cue };
}
