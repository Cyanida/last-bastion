import { AMBIENCE, type Bed } from '../config/ambience';
import type { ArenaId } from '../config/arenas';
import { mulberry32 } from '../core/math';

/**
 * #288: the arenas' ambience beds, kept out of WebAudio so the tests can hear them: which bed an arena plays, how loud it sits under the
 * fight, and the bed itself, rendered sample by sample into one seamless loop (core/ambience.ts plays it on the ambience bus).
 */
export const bedOf = (arena: ArenaId): Bed => AMBIENCE.beds[arena];

/** The bed's level under the music's layer (0 breather .. 3 boss): it steps back as the fight grows. */
export const bedLevel = (layer: number): number => AMBIENCE.gain * AMBIENCE.fight[Math.min(AMBIENCE.fight.length - 1, Math.max(0, Math.floor(layer)))];

/** A fixed seed per arena, so an arena's bed is the same loop every run (and every test). */
export const bedSeed = (arena: ArenaId): number => [...arena].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

const SEAM = 0.25; // seconds rendered past the loop's end and blended into its start, so the repeat has no click

/** One loop of the bed, `bed.seconds` long at `rate` samples a second. Everything scattered in it wraps round the loop's end. */
export function renderBed(bed: Bed, rate: number, seed: number): Float32Array {
  const rng = mulberry32(seed);
  const len = Math.round(bed.seconds * rate);
  const seam = Math.min(len, Math.round(SEAM * rate));
  const out = new Float32Array(len);
  // the wind: brown noise (integrated white, as #282's) through a one-pole lowpass; rendered past the end, then the tail fades over the head
  const w = bed.wind;
  const a = 1 - Math.exp((-2 * Math.PI * w.cutoff) / rate);
  let brown = 0;
  let lp = 0;
  const tail = new Float32Array(seam);
  for (let i = 0; i < len + seam; i++) {
    brown = (brown + 0.02 * (rng() * 2 - 1)) / 1.02;
    lp += a * (brown * 3.5 - lp); // brown noise is quiet: up to about white noise's level
    if (i < len) out[i] = lp * w.gain;
    else tail[i - len] = lp * w.gain;
  }
  for (let i = 0; i < seam; i++) out[i] = out[i] * (i / seam) + tail[i] * (1 - i / seam);
  const add = (at: number, v: number) => (out[(((at % len) + len) % len) | 0] += v);
  // fire: short pops of bright noise (white noise's difference), each its own loudness
  if (bed.crackle) {
    const c = bed.crackle;
    const n = Math.max(1, Math.round(c.perSecond * bed.seconds));
    const pop = Math.max(1, Math.round(c.length * rate));
    for (let k = 0; k < n; k++) {
      const at = Math.floor(rng() * len);
      const amp = c.gain * (0.3 + 0.7 * rng());
      let prev = 0;
      for (let i = 0; i < pop * 4; i++) {
        const white = rng() * 2 - 1;
        add(at + i, (white - prev) * amp * Math.exp(-i / pop));
        prev = white;
      }
    }
  }
  // crows: each call in its own slot of the loop, so two never overlap; a few rasping notes (a saw with noise in it) falling in pitch
  if (bed.calls) {
    const c = bed.calls;
    const slot = len / c.perLoop;
    const noteLen = Math.round(c.note * rate);
    const step = Math.round((c.note + c.gap) * rate);
    for (let k = 0; k < c.perLoop; k++) {
      const at = Math.floor(k * slot + rng() * Math.max(0, slot - step * c.notes));
      const pitch = 0.9 + 0.2 * rng();
      for (let n = 0; n < c.notes; n++) {
        const amp = c.gain * (1 - 0.2 * n);
        let phase = 0;
        for (let i = 0; i < noteLen; i++) {
          const t = i / noteLen;
          phase += (pitch * c.f0 * Math.pow(c.f1 / c.f0, t)) / rate;
          const saw = 2 * (phase - Math.floor(phase)) - 1;
          add(at + n * step + i, (saw * 0.7 + (rng() * 2 - 1) * 0.3) * amp * Math.sin(Math.PI * t));
        }
      }
    }
  }
  // drips: a short sine blip falling in pitch, dying away fast
  if (bed.drips) {
    const d = bed.drips;
    const blip = Math.round(d.length * rate);
    for (let k = 0; k < d.perLoop; k++) {
      const at = Math.floor(rng() * len);
      const amp = d.gain * (0.5 + 0.5 * rng());
      let phase = 0;
      for (let i = 0; i < blip; i++) {
        const t = i / blip;
        phase += (d.f0 * Math.pow(d.f1 / d.f0, t)) / rate;
        add(at + i, Math.sin(2 * Math.PI * phase) * amp * Math.exp(-5 * t));
      }
    }
  }
  // the room: a feedback delay round the loop; a second pass lets the echoes from the loop's end ring on into its start
  if (bed.echo) {
    const dry = out.slice();
    const lag = Math.max(1, Math.round(bed.echo.delay * rate));
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i < len; i++) out[i] = dry[i] + bed.echo.feedback * out[(i - lag + len) % len];
  }
  return out;
}
