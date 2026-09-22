import { mulberry32 } from '../core/math';

/**
 * The menu music as a score: which note, on which voice, when. Pure and seeded; core/music.ts plays it.
 * D Dorian in a slow 3/4, a 16-bar form of two-bar chords, re-rolled every pass so it never loops note for note.
 */
export type Voice = 'drone' | 'harp' | 'flute' | 'bell';
export interface NoteEvent {
  time: number; // beats from the downbeat of the bar
  voice: Voice;
  midi: number;
  duration: number; // beats
  velocity: number; // 0..1
}

export const BPM = 76;
export const BAR_BEATS = 3;
export const FORM_BARS = 16;
/** D Dorian (D E F G A B C): the raised sixth is what makes it sound old and hopeful rather than sad. */
export const SCALE = [2, 4, 5, 7, 9, 11, 0];
export const CHORDS = { Dm: [2, 5, 9], C: [0, 4, 7], G: [7, 11, 2], F: [5, 9, 0] } satisfies Record<string, number[]>;
/** Two bars each: i VII IV i | III VII IV i. */
export const PROGRESSION: (keyof typeof CHORDS)[] = ['Dm', 'C', 'G', 'Dm', 'F', 'C', 'G', 'Dm'];
export const RANGES: Record<Voice, [number, number]> = { drone: [36, 55], harp: [50, 76], flute: [62, 84], bell: [74, 96] };

/** Harp arpeggios in eighths, as steps up the chord from its lowest voicing; null is a rest. */
const HARP: (number | null)[][] = [
  [0, 1, 2, 3, 2, 1],
  [0, 2, 1, 3, 2, 4],
  [0, 1, 2, 3, 4, 3],
  [0, null, 2, 3, null, 1],
  [0, 2, 3, 4, 3, 2],
];
/** Flute rhythms in beats; negative is a rest. Phrase ends breathe. */
const RHYTHMS = [[3], [2, 1], [1, 1, 1], [-1, 2], [1.5, 0.5, 1], [1, 2]];
const CADENCES = [[2, -1], [3], [1, 1, -1]];
/** The shape of a four-bar phrase, in scale steps from the flute's centre. One is drawn per phrase. */
const ARCHES = [[0, 2, 4, 1], [2, 4, 3, 0], [0, 1, 3, -1], [3, 5, 2, 0]];

const FLUTE = inRange(SCALE, ...RANGES.flute);

export const chordOf = (bar: number): number[] => CHORDS[PROGRESSION[Math.floor((bar % FORM_BARS) / 2)]];

function inRange(pcs: number[], lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let m = lo; m <= hi; m++) if (pcs.includes(m % 12)) out.push(m);
  return out;
}

const rngFor = (seed: number, n: number, salt: number) => mulberry32((seed ^ Math.imul(n * 8 + salt + 1, 0x9e3779b1)) >>> 0);
const pick = <T>(items: T[], r: () => number): T => items[Math.floor(r() * items.length)];
const clampIndex = (i: number, arr: unknown[]) => Math.max(0, Math.min(arr.length - 1, i));

/** Where the flute aims at the start of a bar: an index into FLUTE. Pure per bar, so the next bar's aim is known. */
function fluteTarget(seed: number, bar: number): number {
  const centre = 4 + (Math.floor(bar / FORM_BARS) % 2) * 3; // A4, and a fourth higher every other pass
  return centre + pick(ARCHES, rngFor(seed, Math.floor(bar / 4), 2))[bar % 4];
}

export function composeBar(seed: number, bar: number): NoteEvent[] {
  const pos = bar % FORM_BARS;
  const chord = chordOf(bar);
  const r = rngFor(seed, bar, 0);
  const notes: NoteEvent[] = [];
  const add = (voice: Voice, time: number, midi: number, duration: number, velocity: number) =>
    notes.push({ voice, time, midi, duration, velocity: Math.min(1, velocity) });

  // drone: root and fifth held under each two-bar chord
  if (pos % 2 === 0) {
    const root = 36 + chord[0];
    add('drone', 0, root, BAR_BEATS * 2, 0.8);
    add('drone', 0, root + 7, BAR_BEATS * 2, 0.55);
  }

  // harp: an arpeggio from the voicing nearest D3 (smooth voice leading); one pattern per chord
  const ladder = inRange(chord, ...RANGES.harp);
  const chordRng = rngFor(seed, Math.floor(bar / 2), 1);
  const pattern = pick(HARP, chordRng);
  const base = ladder.reduce((best, m, i) => (Math.abs(m - 51) < Math.abs(ladder[best] - 51) ? i : best), 0) + (chordRng() < 0.3 ? 1 : 0);
  if (pos === FORM_BARS - 1) {
    for (let i = 0; i < 5; i++) add('harp', i * 0.12, ladder[clampIndex(base + i, ladder)], 3, 0.6); // a rolled chord to close the form
  } else {
    pattern.forEach((step, i) => {
      if (step !== null) add('harp', i * 0.5, ladder[clampIndex(base + step, ladder)], 1.5, (i === 0 ? 0.75 : i % 2 ? 0.4 : 0.55) + r() * 0.1);
    });
  }

  // flute: the bar opens on the chord tone nearest the phrase's arch, then steps toward the next bar's
  const intro = bar < 4; // the first time round, the harp plays alone for a phrase
  if (!intro && (pos === FORM_BARS - 1 || r() > 0.15)) {
    const target = fluteTarget(seed, bar);
    const next = fluteTarget(seed, bar + 1);
    let i = FLUTE.reduce((best, m, k) => (chord.includes(m % 12) && Math.abs(k - target) < Math.abs(best - target) ? k : best), -99);
    i = clampIndex(i, FLUTE);
    const rhythm = pos === FORM_BARS - 1 ? [3] : bar % 4 === 3 ? pick(CADENCES, r) : pick(RHYTHMS, r);
    let t = 0;
    let first = true;
    for (const d of rhythm) {
      if (d < 0) {
        t -= d;
        continue;
      }
      if (!first) {
        const dir = Math.sign(next - i) || (r() < 0.5 ? -1 : 1);
        i = clampIndex(i + (r() < 0.2 ? -dir : dir * (r() < 0.75 ? 1 : 2)), FLUTE);
      }
      add('flute', t, FLUTE[i], d, (first && bar % 4 === 0 ? 0.75 : 0.6) + r() * 0.15);
      t += d;
      first = false;
    }
  }

  // bell: a shimmer to open every pass, and now and then elsewhere
  if (pos === 0 || (pos !== FORM_BARS - 1 && r() < 0.2)) {
    const bells = inRange(chord, ...RANGES.bell);
    const k = Math.floor(r() * (bells.length - 1));
    const at = pos === 0 ? 0 : pick([0, 1, 1.5, 2], r);
    add('bell', at, bells[k], 5, 0.7);
    if (r() < 0.5 && at + 0.5 < BAR_BEATS) add('bell', at + 0.5, bells[k + 1], 5, 0.5);
  }
  return notes;
}
