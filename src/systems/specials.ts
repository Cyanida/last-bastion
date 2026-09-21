import { sfx } from '../core/audio';
import type { Enemy, Game } from '../core/types';
import { addZone } from '../entities/hazards';
import { angleTo, hitDamage, move, touch, type Target } from './aiHelpers';
import { floatText, line } from './effects';

/**
 * Type-specific actions the state machine runs in its 'special' state (config/ai.ts names them).
 * Called every tick while in that state; return true when the action is over. e.state / e.timer are scratch,
 * reset to 0 when the state is entered.
 */
export type Special = (g: Game, e: Enemy, t: Target, dt: number) => boolean;

export const SPECIALS: Record<string, Special> = {
  // crouch -> leap in a straight line. Wolves do it quickly, cavalry does it long and telegraphed.
  lunge(g, e, t, dt) {
    const def = e.def;
    if (e.state === 0) {
      e.state = 1;
      e.timer = def.windup!;
      e.angle = angleTo(e, t);
      e.flip = t.x < e.x;
      if (def.telegraphLunge) e.telegraph = { angle: e.angle, length: def.lungeSpeed! * def.lungeTime!, width: e.r * 2, t: 0, dur: def.windup! };
      return false;
    }
    e.timer -= dt;
    if (e.state === 1) {
      if (e.telegraph) e.telegraph.t += dt;
      if (e.timer <= 0) {
        e.state = 2;
        e.timer = def.lungeTime!;
        e.telegraph = null;
      }
      return false;
    }
    move(e, e.angle, def.lungeSpeed!, dt);
    touch(g, e, t, 1.5);
    return e.timer <= 0;
  },

  // plants itself and blows up after a telegraphed fuse. Killing it first cancels the blast; it never "finishes".
  fuse(g, e, _t, dt) {
    if (e.state === 0) {
      e.state = 1;
      e.timer = e.def.fuse!;
      addZone(g, { x: e.x, y: e.y, r: e.def.blastRadius!, delay: e.def.fuse!, damage: hitDamage(e), hostile: true, color: '#e07b28', owner: e, killsOwner: true });
      sfx('warn');
    } else e.timer -= dt; // only drives the blink; the zone kills its owner when it detonates
    return false;
  },

  // tops up the most wounded ally in reach
  heal(g, e) {
    let worst: Enemy | null = null;
    for (const o of g.hash.query(e.x, e.y, e.def.healRange!, [])) {
      if (o !== e && !o.dead && o.hp < o.maxHp && (!worst || o.hp / o.maxHp < worst.hp / worst.maxHp)) worst = o;
    }
    if (worst) {
      const amount = Math.min(worst.maxHp - worst.hp, e.def.healAmount! * g.waveHpMult);
      worst.hp += amount;
      line(g, e.x, e.y - 10, worst.x, worst.y, '#6fdc6f');
      floatText(g, worst.x, worst.y - worst.r - 8, `+${Math.round(amount)}`, '#6fdc6f', 12);
    }
    return true;
  },
};
