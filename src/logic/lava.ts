import type { Rect } from '../config/regions';

/**
 * #223: the Ember Forge's lava channels, as pure geometry: who stands in one, and what a tick of it costs. The channels are rects on the
 * map (config/arenas.ts LAVA, moved into place by expandArena); systems/arena.ts burns whoever is in one on a GAME.fieldTick clock.
 */

/**
 * Is a body of radius r at (x, y) in the lava? Its feet are: the centre within half its radius of a channel, so a body that only
 * brushes the bank with its edge stays dry, and one that steps in burns.
 */
export function inLava(x: number, y: number, r: number, channels: readonly Rect[]): boolean {
  const pad = r / 2;
  return channels.some((c) => x >= c.x - pad && x <= c.x + c.w + pad && y >= c.y - pad && y <= c.y + c.h + pad);
}

/** One tick of lava: `dps` for `tick` s, scaled like enemy damage (`scale`), x`foeMult` when it burns a foe. */
export const lavaTick = (dps: number, tick: number, scale: number, foeMult: number, foe: boolean): number => dps * tick * scale * (foe ? foeMult : 1);

/**
 * #224's hook: the points along the channels' banks, `step` px apart, both sides, where the spreading fire can catch from the lava.
 * Nothing reads it yet; the spreading fire (#224) seeds its flames here.
 */
export function lavaBanks(channels: readonly Rect[], step: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (const c of channels) {
    const along = c.w >= c.h;
    const len = along ? c.w : c.h;
    for (let a = step / 2; a < len; a += step) {
      if (along) out.push({ x: c.x + a, y: c.y }, { x: c.x + a, y: c.y + c.h });
      else out.push({ x: c.x, y: c.y + a }, { x: c.x + c.w, y: c.y + a });
    }
  }
  return out;
}
