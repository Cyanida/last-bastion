// v0.12 (#228): the Cinder Colossus, the Cinderlands' crown boss: what each phase teaches, which blow comes next, where his fire lands
// and how it spreads, and which falling foes burst
import { CINDER_COLOSSUS } from '../config/bosses';

type Pt = { x: number; y: number };

/** The realm lesson a phase teaches: burn stacks on you, fire that spreads, bursts of fire when foes die. */
export type ColossusLesson = (typeof CINDER_COLOSSUS.lessons)[number];
export const colossusLesson = (phase: number): ColossusLesson =>
  CINDER_COLOSSUS.lessons[Math.min(Math.max(phase, 1), CINDER_COLOSSUS.lessons.length) - 1];

/** One of his blows. `n` counts his blows in this phase (0-based). */
export interface ColossusMove {
  slam: boolean; // a fan of marked lines of fire at you
  kindle: boolean; // embers round you that leave spreading fire
  brood: boolean; // his brood of Cultists
}

export function colossusMove(phase: number, n: number): ColossusMove {
  const kindle = phase >= CINDER_COLOSSUS.kindleFrom && n % 2 === 0;
  return { slam: !kindle, kindle, brood: phase >= CINDER_COLOSSUS.burstFrom && n % CINDER_COLOSSUS.broodEvery === 0 };
}

/** His next blow's cooldown by phase: quicker as the fight goes on. */
export const colossusCd = (phase: number): number => CINDER_COLOSSUS.specialCd[Math.min(phase, CINDER_COLOSSUS.specialCd.length) - 1];

/**
 * The Slam: a fan of `slam.lines` lines from his edge (`r`) outward, the middle one straight along `angle` (at you), each `slam.zones`
 * long and `step` apart, landing one after another from the inside out: step between the lines, or outrun them.
 */
export function slamFan(x: number, y: number, r: number, angle: number): (Pt & { delay: number })[] {
  const s = CINDER_COLOSSUS.slam;
  const out: (Pt & { delay: number })[] = [];
  for (let k = 0; k < s.lines; k++) {
    const a = angle + (k - (s.lines - 1) / 2) * s.spread;
    for (let i = 1; i <= s.zones; i++) out.push({ x: x + Math.cos(a) * (r + (i - 0.5) * s.step), y: y + Math.sin(a) * (r + (i - 0.5) * s.step), delay: s.first + (i - 1) * s.gap });
  }
  return out;
}

/** Kindling: `kindle.seeds` embers, the first on (px, py), the rest evenly round it `scatter` away, starting along `angle`. */
export function kindleSeeds(px: number, py: number, angle: number): Pt[] {
  const k = CINDER_COLOSSUS.kindle;
  const out: Pt[] = [{ x: px, y: py }];
  for (let i = 1; i < k.seeds; i++) {
    const a = angle + ((i - 1) / (k.seeds - 1)) * Math.PI * 2;
    out.push({ x: px + Math.cos(a) * k.scatter, y: py + Math.sin(a) * k.scatter });
  }
  return out;
}

/**
 * Fire that spreads: the patches a fire at (x, y) kindles next, `kindle.step` further along `angle` (away from him). Generation 0 forks
 * in two, `fork` rad apart; later ones creep straight on; the `gens`-th patch is the last.
 */
export function spreadNext(x: number, y: number, angle: number, gen: number): (Pt & { angle: number })[] {
  const k = CINDER_COLOSSUS.kindle;
  if (gen + 1 >= k.gens) return [];
  const angles = gen === 0 ? [angle - k.fork / 2, angle + k.fork / 2] : [angle];
  return angles.map((a) => ({ x: x + Math.cos(a) * k.step, y: y + Math.sin(a) * k.step, angle: a }));
}

/** Does a foe that falls at (x, y) burst? Only in his burst phase and within his heat, round (cx, cy). */
export function burstsIn(phase: number, cx: number, cy: number, x: number, y: number): boolean {
  const reach = CINDER_COLOSSUS.burst.reach;
  return phase >= CINDER_COLOSSUS.burstFrom && (x - cx) ** 2 + (y - cy) ** 2 <= reach * reach;
}
