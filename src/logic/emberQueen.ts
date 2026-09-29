// v0.12 (#227): the Ember Queen, the Cinderlands' level-3 boss: which blow comes next, and where her Kindling and her Flare land
import { EMBER_QUEEN } from '../config/bosses';
import { TAU } from '../core/math';

export type QueenMove = 'kindle' | 'volley' | 'flare';

const byPhase = <T>(list: readonly T[], phase: number): T => list[Math.max(1, Math.min(phase, list.length)) - 1];

/** Her blow number `n` (0-based) in `phase`: Kindling and the Ember volley in turn; from EMBER_QUEEN.flare.from every third blow is her Flare. */
export function queenMove(phase: number, n: number): QueenMove {
  if (phase >= EMBER_QUEEN.flare.from && n % 3 === 2) return 'flare';
  return n % (phase >= EMBER_QUEEN.flare.from ? 3 : 2) === 0 ? 'kindle' : 'volley';
}

/** Her next blow's cooldown by phase: quicker as the fight goes on. */
export const queenCd = (phase: number): number => byPhase(EMBER_QUEEN.specialCd, phase);

/**
 * The Kindling: the first spot on (x, y) (where you stand), the rest evenly on a ring EMBER_QUEEN.kindle.spread round it from `angle`,
 * bursting one after the other, `gap` s apart. Burning ground stays where each lands, so the floor round you closes in.
 */
export function kindleZones(x: number, y: number, phase: number, angle: number): { x: number; y: number; delay: number }[] {
  const k = EMBER_QUEEN.kindle;
  const n = byPhase(k.count, phase);
  return Array.from({ length: n }, (_, i) => {
    const a = angle + ((i - 1) / Math.max(1, n - 1)) * TAU;
    const d = i === 0 ? 0 : k.spread;
    return { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, delay: k.first + i * k.gap };
  });
}

/** The Flare: rings of fire round her (x, y, her radius `r`), `step` apart past her edge, a zone every `spacing` px, the near ring first. */
export function flareZones(x: number, y: number, r: number, phase: number): { x: number; y: number; delay: number; ring: number }[] {
  const f = EMBER_QUEEN.flare;
  const out: { x: number; y: number; delay: number; ring: number }[] = [];
  for (let ring = 0; ring < byPhase(f.rings, phase); ring++) {
    const d = r + f.step * (ring + 1);
    const n = Math.ceil((TAU * d) / f.spacing);
    for (let i = 0; i < n; i++) out.push({ x: x + Math.cos((i / n) * TAU) * d, y: y + Math.sin((i / n) * TAU) * d, delay: f.first + ring * f.gap, ring });
  }
  return out;
}
