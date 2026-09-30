// v0.10 (#202): the crown boss rules (docs/road-to-the-crown.md rule 3) and the Warden's third phase as the Marches' crown boss
import { WARDEN } from '../config/bosses';
import { WORLD, type EndBoss } from '../config/world';
import { TAU } from '../core/math';

/** A level's end boss is its realm's crown boss. */
export const isCrownFight = (end: EndBoss | undefined): boolean => !!end?.crown;

/**
 * What a crown boss's HP holds at, so no blow carries it through a phase (phases split the HP bar evenly, systems/enemyAI): while its phase
 * has not run WORLD.crownBoss.minPhaseSeconds, just above that phase's own threshold; after it, just above the next one, so a burst still
 * lands in the next phase and starts its clock. The last threshold is death: held at 1 HP. 0 = no hold (its last phase, run its time).
 */
export function crownHpFloor(maxHp: number, phase: number, phases: number, elapsed: number, min = WORLD.crownBoss.minPhaseSeconds): number {
  const hold = elapsed < min ? phase : phase + 1; // the threshold it may not pass yet
  if (hold > phases) return 0;
  return hold === phases ? 1 : Math.floor(maxHp * (1 - hold / phases)) + 1;
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
