// v0.10 (#202): the crown boss rules (docs/road-to-the-crown.md rule 3) and the Warden's third phase as the Marches' crown boss
import { INQUISITOR, WARDEN } from '../config/bosses';
import { ENEMY_STATUS } from '../config/damage';
import { WORLD, type EndBoss } from '../config/world';
import { TAU } from '../core/math';
import type { StatusApply } from './status';

/** A level's end boss is its realm's crown boss. */
export const isCrownFight = (end: EndBoss | undefined): boolean => !!end?.crown;

/**
 * What a crown boss's HP holds at, so no blow carries it through a phase (phases split the HP bar evenly, systems/enemyAI): while its phase
 * has not run WORLD.crownBoss.minPhaseSeconds, just above that phase's own threshold (the last phase's is death: held at 1 HP). After it, on
 * the threshold itself (#264): a burst ends the phase and no more, so the next phase begins at the top of its own share of the bar and is
 * fought through, not stood out at its floor. 0 = no hold (its last phase, run its time).
 */
export function crownHpFloor(maxHp: number, phase: number, phases: number, elapsed: number, min = WORLD.crownBoss.minPhaseSeconds): number {
  if (phase >= phases) return elapsed < min ? 1 : 0;
  const threshold = Math.floor(maxHp * (1 - phase / phases)); // on it, enterPhase (hp <= its share) moves the phase on
  return elapsed < min ? threshold + 1 : threshold;
}

/** #219: a level's end boss comes as an elite (rule 3: a relic realm's level 4, its first boss again). */
export const isEliteFight = (end: EndBoss | undefined): boolean => !!end?.elite;

/** An elite end boss's phases: WORLD.eliteBoss.phases more than its plain self's. */
export const elitePhases = (phases: number): number => phases + WORLD.eliteBoss.phases;

/**
 * The Warden's Judgement: the crown boss's own third phase (#202), and the elite's extra phase after his three (#219), so the Iron
 * Hold's level 4 ends on more than level 2's Warden again. A plain Warden never gets there: he has three phases.
 */
export const wardenJudges = (phase: number, crown: boolean): boolean => phase >= (crown ? 3 : 4);

/**
 * #231: the Grand Inquisitor's Auto-da-fé, the elite's extra phase after his two (the Cinderlands' level 4): his pyres stay alight. A
 * plain Inquisitor (and the Heretic) never gets there: he has two phases.
 */
export const inquisitorPyres = (phase: number): boolean => phase >= INQUISITOR.pyreFrom;

/**
 * The burning ground one of his pyres leaves in the Auto-da-fé, or null before it: INQUISITOR.pyre's fire x `scale` (the wave's and the
 * difficulty's enemy damage), and the Torchbearers' falling burn (#225) on whoever stands in it, a stack a tick.
 */
export function pyreField(phase: number, scale: number): { life: number; dps: number; apply: StatusApply } | null {
  if (!inquisitorPyres(phase)) return null;
  const b = ENEMY_STATUS.torchbearer!;
  return { life: INQUISITOR.pyre.life, dps: INQUISITOR.pyre.dps * scale, apply: { ...b, power: (b.power ?? 0) * scale } };
}

/** One of the Warden's seals: its outer ring's gaps and what comes with it. `n` counts his seals so far (0-based). */
export interface WardenMove {
  gaps: number;
  inner: boolean; // the Judgement's second ring inside the first
  sweep: boolean; // the clock hands of force
  close: boolean; // the tighter circle closing in after a moment
  hammer: boolean; // the Judgement's rings of force from where he stands
  summon: boolean; // his knights
}

export function wardenMove(phase: number, crown: boolean, n: number): WardenMove {
  const gaps = WARDEN.seal.gaps[Math.min(phase, WARDEN.seal.gaps.length) - 1];
  if (wardenJudges(phase, crown)) return { gaps, inner: true, sweep: false, close: false, hammer: true, summon: n % WARDEN.crown.summonEvery === 0 };
  return { gaps, inner: false, sweep: phase >= 2, close: phase === 3, hammer: false, summon: phase === 3 };
}

/** The Warden's seal cooldown: quicker in the crown's Judgement. */
export const wardenSpecialCd = (base: number, phase: number, crown: boolean): number => (wardenJudges(phase, crown) ? WARDEN.crown.specialCd : base);

/**
 * The Judgement's hammer: ring k (1-based) of zones at k x `step` from (x, y), spaced so neighbouring zones overlap a little, landing ring
 * after ring. `offset` turns the rings (radians).
 */
export function hammerZones(x: number, y: number, offset: number): { x: number; y: number; delay: number }[] {
  const h = WARDEN.crown.hammer;
  const out: { x: number; y: number; delay: number }[] = [];
  for (let k = 1; k <= h.rings; k++) {
    const d = k * h.step;
    const n = Math.ceil((TAU * d) / (h.radius * 1.6));
    for (let i = 0; i < n; i++) {
      const a = offset + (i / n) * TAU;
      out.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, delay: h.first + (k - 1) * h.gap });
    }
  }
  return out;
}
