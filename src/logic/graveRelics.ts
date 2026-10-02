// v0.13 (#279): the Barrowvale's Grave relics (config/relics.ts, RELICS.md C6): the pure rules behind Barrow Boots, Plague Censer, Sexton's
// Bell and Crown of Antlers. Their behaviour is systems/relicFamilies/grave.ts.
import type { Corpse } from '../core/types';

const d2 = (c: { x: number; y: number }, x: number, y: number) => (c.x - x) ** 2 + (c.y - y) ** 2;

/** Barrow Boots: the corpses a champion at (x, y) with radius r walks over this tick (within `reach` of his edge), each stomped once only. */
export const stompable = (corpses: readonly Corpse[], x: number, y: number, r: number, reach: number): Corpse[] =>
  corpses.filter((c) => !c.stomped && d2(c, x, y) <= (r + reach) ** 2);

/**
 * Plague Censer: does this kill leave plague ground? Every `every`-th kill does (`kills` counts this one), and awakened (Blight Bloom) so
 * does every kill of an enemy that stood in the censer's ground; never beyond `max` patches standing (`laid`).
 */
export const censerLays = (kills: number, every: number, laid: number, max: number, inPlague: boolean, bloom: boolean): boolean =>
  laid < max && (kills % every === 0 || (bloom && inPlague));

/**
 * Sexton's Bell: the corpses a toll raises: up to `count` within `radius` of (x, y), a corpse about to rise against the champion (a
 * Barrow Thrall's, logic/risingCorpse.ts) first, then the nearest.
 */
export function tollCorpses(corpses: readonly Corpse[], x: number, y: number, radius: number, count: number): Corpse[] {
  const near = corpses.filter((c) => d2(c, x, y) <= radius * radius);
  return near.sort((a, b) => (a.rise ? 0 : 1) - (b.rise ? 0 : 1) || d2(a, x, y) - d2(b, x, y)).slice(0, Math.max(0, count));
}

/** Crown of Antlers: the share of a hit the barrow guard takes off: `per` for each guard standing near, up to `cap` guards. */
export const guardCut = (guards: number, per: number, cap: number): number => per * Math.max(0, Math.min(guards, cap));
