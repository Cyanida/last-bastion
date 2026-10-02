import { describe, expect, it } from 'vitest';
import { AMBIENCE } from '../src/config/ambience';
import { ARENAS, type ArenaId } from '../src/config/arenas';
import { bedLevel, bedOf, bedSeed, renderBed } from '../src/logic/ambience';

// #288: every arena has its own ambience bed on the ambience bus, which steps back under the fight
const RATE = 8000; // a low rate keeps the renders quick; the beds are the same shapes at any rate
const IDS = Object.keys(ARENAS) as ArenaId[];
const rms = (a: Float32Array) => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length);
/** How bright a render's brightest tenth of a second is: its sample-to-sample change (pops, caws and drips are bright; lowpassed wind is not). */
const bright = (a: Float32Array) => {
  const win = RATE / 10;
  let best = 0;
  for (let at = 1; at + win <= a.length; at += win / 2) {
    let d = 0;
    for (let i = at; i < at + win; i++) d += (a[i] - a[i - 1]) ** 2;
    best = Math.max(best, Math.sqrt(d / win));
  }
  return best;
};

describe('arena ambience (#288)', () => {
  it('every arena picks a bed of its own, and the picks are not all the same', () => {
    for (const id of IDS) expect(bedOf(id)).toBe(AMBIENCE.beds[id]);
    expect(new Set(IDS.map((id) => JSON.stringify(bedOf(id)))).size).toBe(IDS.length);
    expect(new Set(IDS.map(bedSeed)).size).toBe(IDS.length);
  });

  it('each place has what the plan asks: fire crackles in the Ember Forge, crows in the graveyard, the keep echoes, wind on the courtyard', () => {
    expect(bedOf('emberForge').crackle).toBeTruthy();
    expect(bedOf('graveyard').calls).toBeTruthy();
    expect(bedOf('keep').echo).toBeTruthy();
    expect(bedOf('courtyard').wind.gain).toBeGreaterThan(0);
    expect(bedOf('courtyard').crackle ?? bedOf('courtyard').calls ?? bedOf('courtyard').drips).toBeUndefined();
  });

  it('a bed renders one loop, the same every time, never silent and never clipping', () => {
    for (const id of IDS) {
      const a = renderBed(bedOf(id), RATE, bedSeed(id));
      expect(a.length).toBe(Math.round(bedOf(id).seconds * RATE));
      expect(renderBed(bedOf(id), RATE, bedSeed(id))).toEqual(a);
      expect(rms(a)).toBeGreaterThan(0.005);
      expect(Math.max(...a.map(Math.abs))).toBeLessThan(1);
    }
  });

  it('the loop has no click where it repeats', () => {
    for (const id of IDS) {
      const a = renderBed({ ...bedOf(id), crackle: undefined, calls: undefined, drips: undefined }, RATE, bedSeed(id));
      const step = Math.abs(a[0] - a[a.length - 1]);
      let typical = 0;
      for (let i = 1; i < a.length; i++) typical = Math.max(typical, Math.abs(a[i] - a[i - 1]));
      expect(step).toBeLessThanOrEqual(typical);
    }
  });

  it('the fire, the crows and the drips are heard over the wind', () => {
    for (const [id, extra] of [['emberForge', 'crackle'], ['graveyard', 'calls'], ['keep', 'drips'], ['bastion', 'crackle']] as const) {
      const full = renderBed(bedOf(id), RATE, bedSeed(id));
      const windOnly = renderBed({ ...bedOf(id), [extra]: undefined }, RATE, bedSeed(id));
      expect(bright(full), id).toBeGreaterThan(bright(windOnly) * 2);
    }
  });

  it('the bed steps back as the fight grows: fullest in a breather, quietest under a boss', () => {
    expect(bedLevel(0)).toBe(AMBIENCE.gain);
    for (let l = 1; l < 4; l++) expect(bedLevel(l)).toBeLessThan(bedLevel(l - 1));
    expect(bedLevel(9)).toBe(bedLevel(3));
    expect(bedLevel(-1)).toBe(bedLevel(0));
  });
});
