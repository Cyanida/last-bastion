import { CLASS_SOUNDS, type SoundLayer } from '../config/classSounds';
import type { ClassId } from '../config/classes';
import type { CueSource } from '../config/voices';

/**
 * #284: which class sound a cue plays, kept out of WebAudio so the tests can read it. The simulation still asks for 'swing', 'shoot' and
 * 'ability' (their voice priorities stay); the player's own swing or shot is his class's attack, his cast his class's ability.
 */
export type ClassSoundKind = 'attack' | 'ability';
const KIND: Record<string, ClassSoundKind> = { swing: 'attack', shoot: 'attack', ability: 'ability' };

/** The class sound for a cue (its kind), or null: not the player's, not an attack or ability, or no class known. */
export const classSoundKind = (name: string, src: CueSource, cls: ClassId | null | undefined): ClassSoundKind | null =>
  src === 'player' && cls && cls in CLASS_SOUNDS ? (KIND[name] ?? null) : null;

/** The layers to play. */
export const classLayers = (cls: ClassId, kind: ClassSoundKind): readonly SoundLayer[] => CLASS_SOUNDS[cls][kind];

/** How long a layered sound lasts: until its last layer ends (its voice is held that long). */
export const layersDur = (layers: readonly SoundLayer[]): number => layers.reduce((d, l) => Math.max(d, (l.at ?? 0) + l.dur), 0);

/** A sound's shape as text, so two classes' sounds can be told apart. */
export const soundPrint = (layers: readonly SoundLayer[]): string =>
  layers.map((l) => `${l.wave}:${l.f0}>${l.f1}/${l.dur}@${l.at ?? 0}x${l.rate ?? 1}`).join('|');
