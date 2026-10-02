import { BUS_ORDER, MIXER, type BusId } from '../config/mixer';
import { MUSIC } from '../config/music';

/**
 * #282: the mixer's rules, kept out of WebAudio so the tests can read them: the stored mix (and the old Music and Effects levels it
 * replaces), each bus's gain, whether a bus can be heard at all, and which bus a sound goes out on.
 */
export type Mix = Record<BusId, number>; // percent, 0..100 in MIXER.step steps
type Level = keyof typeof MUSIC.volume; // the old 'off' | 'low' | 'medium' | 'high'

/** A percent on the sliders' grid. */
export const snap = (pct: number): number => Math.min(100, Math.max(0, Math.round(pct / MIXER.step) * MIXER.step));

/** The old level as a percent of the bus's full gain, so a migrated mix sounds as it did (to the nearest step). */
const fromLevel = (bus: 'music' | 'effects', level: string | null): number | null =>
  level !== null && level in MUSIC[bus === 'music' ? 'volume' : 'effects'] ? snap((MUSIC[bus === 'music' ? 'volume' : 'effects'][level as Level] / MIXER.full[bus]) * 100) : null;

/**
 * The mix from storage: the saved mix if it parses (a bus missing or broken takes its default), else the old Music and Effects levels
 * (v0.7.1), else the defaults.
 */
export function readMix(stored: string | null, legacy: { music: string | null; effects: string | null }): Mix {
  let raw: unknown = null;
  try {
    raw = stored === null ? null : JSON.parse(stored);
  } catch {
    raw = null; // corrupt: fall back as if it were never saved
  }
  const mix: Mix = { ...MIXER.defaults };
  if (raw && typeof raw === 'object') {
    for (const bus of BUS_ORDER) {
      const v = (raw as Record<string, unknown>)[bus];
      if (typeof v === 'number' && Number.isFinite(v)) mix[bus] = snap(v);
    }
    return mix;
  }
  mix.music = fromLevel('music', legacy.music) ?? mix.music;
  mix.effects = fromLevel('effects', legacy.effects) ?? mix.effects;
  return mix;
}

/** One bus moved to a new percent. */
export const withBus = (mix: Mix, bus: BusId, pct: number): Mix => ({ ...mix, [bus]: snap(pct) });

/** A bus's own gain node value (the master's is its own; the others go through it). */
export const busGain = (mix: Mix, bus: BusId): number => (MIXER.full[bus] * mix[bus]) / 100;

/** What a sound on this bus comes out at, master included: 0 when muted. */
export const outGain = (mix: Mix, bus: BusId, muted: boolean): number => (muted ? 0 : busGain(mix, 'master') * (bus === 'master' ? 1 : busGain(mix, bus)));

/** Nothing is scheduled on a bus that cannot be heard (a voice not started is cheaper than a silent one). */
export const heard = (mix: Mix, bus: BusId, muted: boolean): boolean => outGain(mix, bus, muted) > 0;

/** The slider's label. */
export const mixLabel = (pct: number): string => (pct <= 0 ? 'Off' : `${pct}%`);

/** How far a bus drops under a heavy effect; 1 for a bus that does not duck. */
export const duckDepth = (bus: BusId): number => (MIXER.duck as Partial<Record<BusId, number>>)[bus] ?? 1;
