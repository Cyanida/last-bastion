import { PATTERNS, type Pattern, type PatternKind } from '../config/ai';
import type { DamageType } from '../config/damage';
import { sfx } from '../sim/view';
import { TAU } from '../core/math';
import type { Enemy, Game, Telegraph } from '../core/types';
import { addZone, after, fireProjectile } from '../entities/hazards';
import { lineAngle } from '../logic/telegraph';
import { angleTo, distTo, hitDamage } from './aiHelpers';

/**
 * v0.6: telegraphed patterns that force movement (config/ai.ts PATTERNS), for Act III-IV enemies and bosses on top of what they do,
 * and the aimed volley the boss scripts share. Every pattern warns first: aim lines for shots, ground markers for blasts, and the
 * enemy glows while it winds up (Enemy.windupT; addZone sets it for zones). Blasts belong to their caster: kill it and they fizzle.
 */
const COLORS: Record<DamageType, string> = { physical: '#c23a2e', fire: '#e07b28', holy: '#f2e6a0', shadow: '#a77fd0', frost: '#a9d8ef' };

/**
 * A volley along marked lines: `count` shots `spread` radians wide (a full circle splits evenly), aimed where the target stands now,
 * fired after `windup`. The lines stay put, so stepping off them dodges it. Cancelled if the caster dies or is stunned mid-windup.
 */
export function aimFan(g: Game, e: Enemy, o: { angle: number; count: number; spread: number; windup: number; damage: number; speed: number; range: number; dtype?: DamageType; color?: string }): void {
  const tele: Telegraph = { angle: o.angle, length: o.range, width: 12, t: 0, dur: o.windup, count: o.count, spread: o.spread };
  e.telegraph = tele;
  e.windupT = Math.max(e.windupT, o.windup);
  sfx('warn');
  after(g, o.windup, () => {
    if (e.dead || e.telegraph !== tele) return; // slain, stunned or overridden: the volley never comes
    e.telegraph = null;
    for (let i = 0; i < o.count; i++) {
      fireProjectile(g, e.x, e.y, lineAngle(tele, i), { damage: o.damage, crit: false, hostile: true, pierce: 0, shape: 'orb', color: o.color ?? COLORS[o.dtype ?? 'physical'], r: 7, speed: o.speed, range: o.range, dtype: o.dtype });
    }
  });
}

const blast = (g: Game, e: Enemy, p: Pattern, x: number, y: number, delay = p.windup) =>
  addZone(g, { x, y, r: p.radius, delay, damage: hitDamage(e) * p.damage, hostile: true, color: COLORS[p.dtype ?? 'physical'], owner: e, dtype: p.dtype ?? 'physical' });

const KINDS: Record<PatternKind, (g: Game, e: Enemy, p: Pattern) => void> = {
  fan: (g, e, p) => aimFan(g, e, { angle: angleTo(e, g.player), count: p.count, spread: p.spread, windup: p.windup, damage: hitDamage(e) * p.damage, speed: p.radius * 5, range: p.range * 1.3, dtype: p.dtype }),
  ring: (g, e, p) => aimFan(g, e, { angle: angleTo(e, g.player), count: p.count, spread: TAU, windup: p.windup, damage: hitDamage(e) * p.damage, speed: p.radius * 5, range: p.range, dtype: p.dtype }),
  mortar(g, e, p) {
    const { x, y } = g.player;
    blast(g, e, p, x, y);
    for (let i = 1; i < p.count; i++) {
      const a = g.rng() * TAU;
      const d = 50 + g.rng() * p.spread;
      blast(g, e, p, x + Math.cos(a) * d, y + Math.sin(a) * d, p.windup + i * 0.15);
    }
  },
  circle(g, e, p) {
    const off = g.rng() * TAU;
    for (let i = 0; i < p.count; i++) blast(g, e, p, g.player.x + Math.cos(off + (i / p.count) * TAU) * p.spread, g.player.y + Math.sin(off + (i / p.count) * TAU) * p.spread);
  },
  cross(g, e, p) {
    const { x, y } = g.player;
    blast(g, e, p, x, y);
    for (let k = 1; k <= p.count; k++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) blast(g, e, p, x + dx * k * p.spread, y + dy * k * p.spread, p.windup + k * 0.08);
  },
  slam: (g, e, p) => blast(g, e, p, e.x, e.y),
};

/** Every tick for every enemy that has a pattern (enemyAI.ts): the aim lines fill, and the pattern goes off when it is due and in range. */
export function updatePattern(g: Game, e: Enemy, dt: number): void {
  if (e.telegraph?.count) e.telegraph.t += dt; // any volley's aim lines, the bosses' included
  const p = PATTERNS[e.def.id];
  if (!p || g.act < p.from) return;
  if (e.patternT < 0) e.patternT = p.cd * (0.4 + 0.6 * e.flankRoll); // not all of a wave at once
  e.patternT = Math.max(0, e.patternT - dt); // it waits at 0 until the player is in range, not back into a cooldown (#112)
  if (e.patternT > 0 || e.hidden || e.pulled || e.telegraph || distTo(e, g.player) > p.range) return;
  e.patternT = p.cd;
  KINDS[p.kind](g, e, p);
}
