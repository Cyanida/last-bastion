import { BOSS_SOUND, BOSS_SOUNDS, type BossCueKind, type BossSoundId, type Tone } from '../config/bossSounds';
import { VOICES } from '../config/voices';

/**
 * #286: which boss sound plays when, kept out of WebAudio and the game loop so the tests can read it. A boss cue is named
 * `boss:<id>:arrive`, `boss:<id>:move` or `boss:<id>:phase<n>`; core/audio.ts plays its tones (bossTones) at its weight (bossCuePriority),
 * and systems/bossSounds.ts decides which one a boss makes this step (nextBossCue).
 */
export type BossCueName = `boss:${BossSoundId}:${'arrive' | 'move'}` | `boss:${BossSoundId}:phase${number}`;

export const hasBossSounds = (id: string): id is BossSoundId => Object.hasOwn(BOSS_SOUNDS, id);
export const isBossCue = (name: string): name is BossCueName => name.startsWith('boss:');

export const bossCueName = (id: BossSoundId, kind: BossCueKind, phase = 2): BossCueName =>
  kind === 'phase' ? `boss:${id}:phase${Math.max(2, Math.min(BOSS_SOUND.maxPhase, phase))}` : `boss:${id}:${kind}`;

/** A cue's boss, kind and phase (1 for an arrival or a move). */
export function parseBossCue(name: BossCueName): { id: BossSoundId; kind: BossCueKind; phase: number } {
  const [, id, what] = name.split(':');
  const phase = what.startsWith('phase') ? Number(what.slice(5)) : 1;
  return { id: id as BossSoundId, kind: phase > 1 ? 'phase' : (what as BossCueKind), phase };
}

/** The tones a cue plays: its boss's set, a later phase's cue pitched up a step per phase past the second. */
export function bossTones(name: BossCueName): Tone[] {
  const { id, kind, phase } = parseBossCue(name);
  const tones = BOSS_SOUNDS[id][kind];
  if (kind !== 'phase' || phase <= 2) return tones;
  const k = BOSS_SOUND.phaseRise ** (phase - 2);
  return tones.map((x) => ({ ...x, f0: x.f0 * k, f1: x.f1 * k }));
}

/** How long a sound's tones last, start to end, in seconds. */
export const tonesLength = (tones: readonly Tone[]): number => tones.reduce((m, x) => Math.max(m, (x.at ?? 0) + x.dur), 0);

/** A boss cue's weight in the voice limit (logic/voices.ts pickVoice): its kind's, plus the boss source's. */
export const bossCuePriority = (name: BossCueName): number => BOSS_SOUND.priority[parseBossCue(name).kind] + VOICES.source.boss;

/**
 * The cue a boss makes this step: his arrival the first step he is heard (`heard` undefined), a phase cue when his phase has moved past
 * the one last heard, else his big-move sound when he warned this step (a boss's warning marks every big move), else none.
 */
export function nextBossCue(heard: number | undefined, phase: number, warned: boolean): { kind: BossCueKind; phase: number } | null {
  if (heard === undefined) return { kind: 'arrive', phase };
  if (phase > heard) return { kind: 'phase', phase };
  return warned ? { kind: 'move', phase } : null;
}
