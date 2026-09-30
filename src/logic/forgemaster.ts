// v0.11 (#215): the Forgemaster, the Iron Hold's level-3 boss: which blow comes next, and where his hammer and his forge presses land
import { FORGEMASTER } from '../config/bosses';

/** One of his blows. `n` counts his blows so far (0-based). */
export interface ForgeMove {
  slam: boolean; // the hammer: a marked arc in front of him
  sparks: boolean; // a fan of sparks after the hammer
  slag: boolean; // the hammer's zones leave burning slag
  strokes: number; // the forge presses: how many strokes (0: none this blow)
}

export function forgeMove(phase: number, n: number): ForgeMove {
  const strokes = FORGEMASTER.press.strokes[Math.min(phase, FORGEMASTER.press.strokes.length) - 1];
  if (strokes > 0 && n % 2 === 1) return { slam: false, sparks: false, slag: false, strokes };
  return { slam: true, sparks: phase >= 2, slag: phase >= FORGEMASTER.slagFrom, strokes: 0 };
}

/** His next blow's cooldown by phase: quicker as the fight goes on. */
export const forgeCd = (phase: number): number => FORGEMASTER.specialCd[Math.min(phase, FORGEMASTER.specialCd.length) - 1];

/** The hammer's zones: an arc of FORGEMASTER.slam.zones centred on `angle`, `reach` past his edge (`r`) from (x, y). */
export function slamZones(x: number, y: number, r: number, angle: number): { x: number; y: number }[] {
  const s = FORGEMASTER.slam;
  const d = r + s.reach;
  return Array.from({ length: s.zones }, (_, i) => {
    const a = angle + (i / (s.zones - 1) - 0.5) * s.arc;
    return { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d };
  });
}

/**
 * The forge presses: a size x size checkerboard of tiles centred on (x, y) (where you stand). Stroke k slams the tiles of colour k % 2
 * at `first + k * gap` s: the first stroke takes the tile you stand on, so step onto a neighbour, which the next stroke takes, so step
 * back onto one that just struck. Walking off the board works too.
 */
export function pressTiles(x: number, y: number, strokes: number): { x: number; y: number; delay: number; stroke: number }[] {
  const p = FORGEMASTER.press;
  const h = (p.size - 1) / 2;
  const out: { x: number; y: number; delay: number; stroke: number }[] = [];
  for (let k = 0; k < strokes; k++) {
    for (let i = -h; i <= h; i++) {
      for (let j = -h; j <= h; j++) {
        if (Math.abs(i + j) % 2 !== k % 2) continue;
        out.push({ x: x + i * p.cell, y: y + j * p.cell, delay: p.first + k * p.gap, stroke: k });
      }
    }
  }
  return out;
}
