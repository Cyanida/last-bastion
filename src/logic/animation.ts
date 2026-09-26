/**
 * #155: which frame of a rigged sprite sheet to show, read from what the game already knows. Pure and render-only: nothing here
 * feeds back into the simulation. The sheets are written by `npm run art` (tools/art) as public/sprites/<id>.png plus
 * src/render/sheets/<id>.json (this frame data).
 */
export type AnimName = 'idle' | 'walk' | 'attack' | 'cast' | 'hurt' | 'death' | 'skill';

export interface SheetData {
  w: number; // cell size in art pixels
  h: number;
  anchor: [number, number]; // ground point between the feet, in the cell
  tall: number; // figure height in art pixels
  anims: Record<Exclude<AnimName, 'skill'>, number[]> & { skill?: number[] }; // ms per frame; the rows of the sheet in this order.
  // skill: #156, the utility ability (Leap, Dodge Roll, Blink, Taunt, Corpse Explosion); only the champions have it
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
  cast: number; // #156: seconds since the signature ability was used (Infinity: not yet)
  skill: number; // #156: seconds since the utility ability was used (Infinity: not yet)
  hurt: number; // seconds since last hurt (Infinity: not hurt)
  dead: number; // seconds since death (Infinity: alive)
}

/** Distance a full walk cycle covers at art scale 1: 8 frames at 100 ms at the base walk speed. */
export const WALK_STRIDE = 0.8;

/** #156: below this share of its full length the swing drops its wind-up and plays only the swing, impact and recovery. */
export const SHORT_SWING = 0.5;

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
 * attack lands, the impact frame shows at the moment it lands, then recovery. The whole swing is squeezed to fit the attack speed;
 * squeezed below SHORT_SWING it skips the wind-up. The utility ability plays its own `skill` row, which outranks everything but death.
 * `baseSpeed` is the body's base walk speed (world px/s): the walk cycle covers WALK_STRIDE s of base-speed travel.
 */
export function pickFrame(d: SheetData, s: AnimInput, baseSpeed: number): { anim: AnimName; frame: number } {
  const a = d.anims;
  if (s.dead < Infinity) return { anim: 'death', frame: frameAt(a.death, s.dead * 1000, false) };
  const sum = (ms: number[]) => ms.reduce((x, y) => x + y, 0);
  if (a.skill && s.skill * 1000 < sum(a.skill)) return { anim: 'skill', frame: frameAt(a.skill, s.skill * 1000, false) }; // #156: legs don't run through a leap or a roll
  if (s.cast * 1000 < sum(a.cast)) return { anim: 'cast', frame: frameAt(a.cast, s.cast * 1000, false) }; // #156: the ability outranks a swing
  const post = a.attack.slice(d.impact), postMs = sum(post);
  let pre = a.attack.slice(0, d.impact);
  // #156: squeezed too hard, the wind-up frames only flicker: a fast attack keeps just the swing frame before the impact
  if (s.attackCd * 1000 < SHORT_SWING * (sum(pre) + postMs)) pre = pre.slice(-1);
  const preMs = sum(pre), skip = d.impact - pre.length;
  const squeeze = Math.min(1, (s.attackCd * 1000) / (preMs + postMs));
  if (s.sinceHit * 1000 < postMs * squeeze) return { anim: 'attack', frame: d.impact + frameAt(post, (s.sinceHit * 1000) / squeeze, false) };
  if (s.hurt * 1000 < sum(a.hurt)) return { anim: 'hurt', frame: frameAt(a.hurt, s.hurt * 1000, false) };
  if (s.untilHit * 1000 < preMs * squeeze) return { anim: 'attack', frame: skip + frameAt(pre, preMs - (s.untilHit * 1000) / squeeze, false) };
  if (s.moving) return { anim: 'walk', frame: Math.floor((s.walked / (baseSpeed * WALK_STRIDE)) * a.walk.length) % a.walk.length };
  return { anim: 'idle', frame: frameAt(a.idle, s.time * 1000, true) };
}
