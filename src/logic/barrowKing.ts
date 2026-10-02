// v0.13 (#278): the Barrow King, the Barrowvale's crown boss: what each phase teaches, which blow comes next, where his Reap lands,
// where his graves open, when one is trampled, and how much his risen guard turns
import { BARROW_KING } from '../config/bosses';

type Pt = { x: number; y: number };

/** The lesson a phase teaches: the dead rise unless trampled, plague ground that lasts, and his own: his risen dead guard him. */
export type BarrowLesson = (typeof BARROW_KING.lessons)[number];
export const barrowLesson = (phase: number): BarrowLesson => BARROW_KING.lessons[Math.min(Math.max(phase, 1), BARROW_KING.lessons.length) - 1];

/** One of his blows. `n` counts his blows in this phase (0-based). Every blow is a Reap; these say what comes with it. */
export interface BarrowMove {
  graves: 'you' | 'him' | null; // graves open round you (phase 1) or round him (his guard, phase 3)
  plague: boolean; // the Reap's ground stays plagued
}

export function barrowMove(phase: number, n: number): BarrowMove {
  const k = BARROW_KING;
  const graves = phase < k.plagueFrom ? 'you' : phase >= k.guardFrom && n % k.guard.every === 0 ? 'him' : null;
  return { graves, plague: phase >= k.plagueFrom && n % k.plague.every === 0 };
}

/** His next blow's cooldown by phase: quicker as the fight goes on. */
export const barrowCd = (phase: number): number => BARROW_KING.specialCd[Math.min(Math.max(phase, 1), BARROW_KING.specialCd.length) - 1];

/**
 * The Reap: his blade sweeps a crescent in front of him, `reap.rows` rows of `reap.zones` marked zones on an arc of `reap.arc` rad centred
 * on `angle` (at you), the near row `reap.near` past his edge (`r`), each further row `reap.step` beyond. Step out of it, or behind him.
 */
export function reapZones(x: number, y: number, r: number, angle: number): Pt[] {
  const s = BARROW_KING.reap;
  const out: Pt[] = [];
  for (let row = 0; row < s.rows; row++) {
    const d = r + s.near + row * s.step;
    const n = s.zones + row; // the far row is longer: the arc widens
    for (let i = 0; i < n; i++) {
      const a = angle + (n === 1 ? 0 : (i / (n - 1) - 0.5) * s.arc);
      out.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d });
    }
  }
  return out;
}

/** Where graves open: `count` evenly round (cx, cy), `dist` away, starting along `angle`. Never on the spot itself: a grave is walked to. */
export function graveSpots(cx: number, cy: number, angle: number, count: number, dist: number): Pt[] {
  return Array.from({ length: count }, (_, i) => {
    const a = angle + (i / count) * Math.PI * 2;
    return { x: cx + Math.cos(a) * dist, y: cy + Math.sin(a) * dist };
  });
}

/** Is a grave at (gx, gy) trampled by someone standing at (x, y) with radius `r`? Stepping onto its mound is enough. */
export const trampled = (gx: number, gy: number, x: number, y: number, r: number): boolean =>
  (x - gx) ** 2 + (y - gy) ** 2 <= (BARROW_KING.graves.radius + r) ** 2;

/** What of a blow reaches him: in his guard phase, while any of his risen stand within the guard's reach, less. */
export const barrowWard = (phase: number, guards: number): number => (phase >= BARROW_KING.guardFrom && guards > 0 ? 1 - BARROW_KING.guard.reduction : 1);

/** An open grave: where, how long it has been open. Kept per Barrow King (systems/bosses.ts opens and fills them, render/ draws them). */
export interface Grave { x: number; y: number; t: number }
export const kingGraves = new WeakMap<object, Grave[]>();
