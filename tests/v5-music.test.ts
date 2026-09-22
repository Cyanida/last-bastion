import { describe, expect, it } from 'vitest';
import { BAR_BEATS, CHORDS, chordOf, composeBar, FORM_BARS, PROGRESSION, RANGES, SCALE, type NoteEvent } from '../src/logic/music';

const SEEDS = [1, 42, 0xdeadbeef];
const score = (seed: number) => Array.from({ length: 64 }, (_, bar) => composeBar(seed, bar));
const pcs = (notes: NoteEvent[]) => [...new Set(notes.map((n) => n.midi % 12))].sort();

describe('menu music (v0.5)', () => {
  it('every note of 64 bars is in D Dorian, in its voice range and inside its bar', () => {
    for (const seed of SEEDS) {
      for (const n of score(seed).flat()) {
        expect(SCALE).toContain(n.midi % 12);
        expect(n.midi).toBeGreaterThanOrEqual(RANGES[n.voice][0]);
        expect(n.midi).toBeLessThanOrEqual(RANGES[n.voice][1]);
        expect(n.time).toBeGreaterThanOrEqual(0);
        expect(n.time).toBeLessThan(BAR_BEATS);
        expect(n.duration).toBeGreaterThan(0);
        expect(n.velocity).toBeGreaterThan(0);
        expect(n.velocity).toBeLessThanOrEqual(1);
      }
    }
  });

  it('drone and harp follow the progression, two bars per chord', () => {
    for (const seed of SEEDS) {
      score(seed).forEach((notes, bar) => {
        const chord = CHORDS[PROGRESSION[Math.floor((bar % FORM_BARS) / 2)]];
        expect(chordOf(bar)).toBe(chord);
        const drone = notes.filter((n) => n.voice === 'drone');
        if (bar % 2 === 0) expect(pcs(drone)).toEqual([chord[0], (chord[0] + 7) % 12].sort());
        else expect(drone).toEqual([]);
        for (const pc of pcs(notes.filter((n) => n.voice === 'harp'))) expect(chord).toContain(pc);
      });
    }
  });

  it('the same seed gives the same music; passes and seeds vary', () => {
    expect(score(7)).toEqual(score(7));
    const passes = [0, 1, 2, 3].map((p) => JSON.stringify(score(7).slice(p * FORM_BARS, (p + 1) * FORM_BARS)));
    expect(new Set(passes).size).toBe(4);
    expect(JSON.stringify(score(8))).not.toBe(JSON.stringify(score(7)));
  });

  it('the harp opens alone, a bell opens every pass, and every voice plays', () => {
    for (const seed of SEEDS) {
      const bars = score(seed);
      for (const notes of bars.slice(0, 4)) expect(notes.some((n) => n.voice === 'flute')).toBe(false);
      for (let b = 0; b < 64; b += FORM_BARS) expect(bars[b].some((n) => n.voice === 'bell' && n.time === 0)).toBe(true);
      expect(new Set(bars.flat().map((n) => n.voice))).toEqual(new Set(['drone', 'harp', 'flute', 'bell']));
    }
  });
});
