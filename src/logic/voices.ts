import { VOICES, type CueSource } from '../config/voices';

/**
 * #283: the effect voices' rules, kept out of WebAudio so the tests can read them: a cue's priority, whether it gets a voice (a free one,
 * the weakest one playing, or none), its small pitch and volume change, and its stereo place and volume by where it is on screen.
 */
export type { CueSource };
/** A voice playing: how much it matters, and when it started and ends (on the audio clock). */
export interface Voice {
  prio: number;
  start: number;
  ends: number;
}
/** Where the player looks: the middle of the screen and half its size, in world px. */
export interface Listener {
  x: number;
  y: number;
  halfW: number;
  halfH: number;
}

/** A cue's weight: its sound's own, plus what its source adds (a boss's warning outranks a foe's). */
export const cuePriority = (name: string, src: CueSource): number => (VOICES.priority[name] ?? VOICES.fallback) + VOICES.source[src];

/**
 * Whether a new cue gets a voice: 'free' while fewer than `max` still sound at `now`; else the index of the voice it takes over (the
 * weakest, the oldest of those, if it matters less than the new cue), else 'drop': a crowd's hits don't cut each other off.
 */
export function pickVoice(active: readonly Voice[], prio: number, now: number, max: number = VOICES.max): number | 'free' | 'drop' {
  let live = 0;
  let weakest = -1;
  for (let i = 0; i < active.length; i++) {
    const v = active[i];
    if (v.ends <= now) continue; // done: its place is free
    live++;
    const w = active[weakest];
    if (weakest < 0 || v.prio < w.prio || (v.prio === w.prio && v.start < w.start)) weakest = i;
  }
  if (live < max) return 'free';
  return weakest >= 0 && active[weakest].prio < prio ? weakest : 'drop';
}

/** The same sound from the same source again this soon is not started. */
export const tooSoon = (last: number | undefined, now: number): boolean => last !== undefined && now - last < VOICES.repeat;

/** A cue's small change, from two random numbers in [0, 1): a playback rate and a volume factor, each within VOICES.vary either way. */
export const vary = (r1: number, r2: number): { rate: number; volume: number } => ({
  rate: 1 + (r1 * 2 - 1) * VOICES.vary.pitch,
  volume: 1 + (r2 * 2 - 1) * VOICES.vary.volume,
});

/**
 * A cue's stereo place (-1 left .. 1 right) and volume factor from where it happened: across the screen it pans, past its edge it also
 * fades with the distance. A cue with no place (NaN) or no listener yet sits in the middle at full volume.
 */
export function placeCue(x: number, y: number, at: Listener | null): { pan: number; gain: number } {
  if (!at || !Number.isFinite(x) || !Number.isFinite(y) || at.halfW <= 0 || at.halfH <= 0) return { pan: 0, gain: 1 };
  const dx = x - at.x;
  const dy = y - at.y;
  const pan = Math.max(-1, Math.min(1, dx / at.halfW)) * VOICES.pan;
  const over = Math.hypot(Math.max(0, Math.abs(dx) - at.halfW), Math.max(0, Math.abs(dy) - at.halfH));
  const d = VOICES.distance;
  return { pan, gain: Math.max(d.floor, 1 - over / d.fade) };
}
