/**
 * #155: which frame of a rigged sprite sheet to show, read from what the game already knows. Pure and render-only: nothing here
 * feeds back into the simulation. The sheets are written by `npm run art` (tools/art) as public/sprites/<id>.png plus
 * src/render/sheets/<id>.json (this frame data).
 */
export type AnimName = 'idle' | 'walk' | 'attack' | 'hurt' | 'death';

export interface SheetData {
  w: number; // cell size in art pixels
  h: number;
  anchor: [number, number]; // ground point between the feet, in the cell
  tall: number; // figure height in art pixels
  anims: Record<AnimName, number[]>; // ms per frame; the rows of the sheet in this order
  impact: number; // attack frame where the weapon connects
}

/** What the renderer tracks per animated body (render-side state only). */
export interface AnimInput {
  time: number; // seconds, a steady clock (idle)
  walked: number; // distance moved so far, world px (walk: the feet follow the ground)
  moving: boolean;
  sinceHit: number; // seconds since the last attack landed (Infinity: none)
  untilHit: number; // seconds until the next attack lands if a target stays in reach (Infinity: none coming)
  attackCd: number; // seconds between attacks: the whole swing is squeezed into it
  hurt: number; // seconds since last hurt (Infinity: not hurt)
  dead: number; // seconds since death (Infinity: alive)
}

/** Distance a full walk cycle covers at art scale 1: 8 frames at 100 ms at the base walk speed. */
export const WALK_STRIDE = 0.8;

/** Index into a looping or held sequence of frame durations at `t` ms. */
export function frameAt(ms: number[], t: number, loop: boolean): number {
  const total = ms.reduce((a, b) => a + b, 0);
  if (loop) t = ((t % total) + total) % total;
  for (let i = 0; i < ms.length; i++) {
    if (t < ms[i]) return i;
    t -= ms[i];
  }
  return ms.length - 1;
}

/**
 * The frame to show. The attack is timed around the hit: the frames before `impact` play over the last moments before the next
 * attack lands, the impact frame shows at the moment it lands, then recovery. The whole swing is squeezed to fit the attack speed.
 * `baseSpeed` is the body's base walk speed (world px/s): the walk cycle covers WALK_STRIDE s of base-speed travel.
 */
export function pickFrame(d: SheetData, s: AnimInput, baseSpeed: number): { anim: AnimName; frame: number } {
  const a = d.anims;
  if (s.dead < Infinity) return { anim: 'death', frame: frameAt(a.death, s.dead * 1000, false) };
  const pre = a.attack.slice(0, d.impact), post = a.attack.slice(d.impact);
  const preMs = pre.reduce((x, y) => x + y, 0), postMs = post.reduce((x, y) => x + y, 0);
  const squeeze = Math.min(1, (s.attackCd * 1000) / (preMs + postMs));
  if (s.sinceHit * 1000 < postMs * squeeze) return { anim: 'attack', frame: d.impact + frameAt(post, (s.sinceHit * 1000) / squeeze, false) };
  const hurtMs = a.hurt.reduce((x, y) => x + y, 0);
  if (s.hurt * 1000 < hurtMs) return { anim: 'hurt', frame: frameAt(a.hurt, s.hurt * 1000, false) };
  if (s.untilHit * 1000 < preMs * squeeze) return { anim: 'attack', frame: frameAt(pre, preMs - (s.untilHit * 1000) / squeeze, false) };
  if (s.moving) return { anim: 'walk', frame: Math.floor((s.walked / (baseSpeed * WALK_STRIDE)) * a.walk.length) % a.walk.length };
  return { anim: 'idle', frame: frameAt(a.idle, s.time * 1000, true) };
}

/**
 * #157: seconds until a foe's next blow lands, for its wind-up: a telegraphed attack's own wind-up first, else the sooner of a
 * shot (`shot`: seconds to its next bolt, Infinity when it doesn't shoot or its target is out of range) and a melee swing (only
 * while its target is in reach). Infinity: nothing coming.
 */
export function foeUntilHit(windup: number, attackTimer: number, inReach: boolean, shot: number): number {
  if (windup > 0) return windup;
  return Math.min(inReach && attackTimer > 0 ? attackTimer : Infinity, shot > 0 ? shot : Infinity);
}
