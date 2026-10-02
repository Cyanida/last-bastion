import { FOE_FAMILY, FOE_SOUNDS, REALM_TINTS, type FoeEvent, type FoeLayer } from '../config/foeSounds';
import type { EnemyId } from '../config/enemies';
import type { CueOpts } from '../sim/view';

/**
 * #285: which sound an enemy makes (config/foeSounds.ts), kept out of WebAudio so the tests can read it. A foe's cue carries a voice
 * key, `family.event` or `family/realm.event`; the speaker (core/audio.ts) plays that key's layers instead of the cue's plain sound.
 */
export type { FoeEvent };

/** The voice key of a foe's sound for this event; none for a boss or a foe with no family (it keeps the plain sound). */
export function foeVoice(id: EnemyId, event: FoeEvent): string | undefined {
  const f = FOE_FAMILY[id];
  if (!f) return undefined;
  return `${f.family}${f.realm ? `/${f.realm}` : ''}.${event}`;
}

const cache = new Map<string, FoeLayer[] | null>();
/** A voice key's layers, the realm's tint applied (a key that names no sound: null). Worked out once per key. */
export function foeLayers(key: string): FoeLayer[] | null {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const m = /^(\w+)(?:\/(\w+))?\.(\w+)$/.exec(key);
  const family = m && (FOE_SOUNDS as Record<string, Record<string, FoeLayer[]> | undefined>)[m[1]];
  const base = family?.[m![3]];
  const tint = m?.[2] ? (REALM_TINTS as Record<string, (typeof REALM_TINTS)[keyof typeof REALM_TINTS] | undefined>)[m[2]] : undefined;
  let out: FoeLayer[] | null = null;
  if (base && (!m![2] || tint)) {
    out = tint ? [...base.map((l) => ({ ...l, f0: l.f0 * tint.pitch, f1: l.f1 * tint.pitch })), tint.layer] : base;
  }
  cache.set(key, out);
  return out;
}

/** How long a voice's sound lasts, in seconds (its last layer's end). */
export const layersEnd = (layers: readonly FoeLayer[]): number => Math.max(0, ...layers.map((l) => (l.at ?? 0) + l.dur));

/** A foe's cue for this event, at the foe: its family's voice, or (a boss, a foe with no family) the plain cue `by` would give. */
export const foeBy = (e: { x: number; y: number; def: { id: EnemyId; boss: boolean } }, event: FoeEvent): CueOpts =>
  e.def.boss ? { src: 'boss', at: e } : { src: 'foe', at: e, voice: foeVoice(e.def.id, event) };
