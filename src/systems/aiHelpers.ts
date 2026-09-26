import { AI_TUNING } from '../config/ai';
import { AFFIXES } from '../config/elites';
import { TAU } from '../core/math';
import type { Enemy, Game, Minion, Player } from '../core/types';
import { fireProjectile } from '../entities/hazards';
import { hurtTarget } from './combat';
import { spawnEnemy } from './spawning';

/** Shared by the state machine (enemyAI.ts), the specials (specials.ts) and the boss scripts. */
export type Target = Player | Minion;
export const POISON = '#6f8f4e';

export const distTo = (e: Enemy, t: { x: number; y: number }) => Math.hypot(t.x - e.x, t.y - e.y);
export const angleTo = (e: Enemy, t: { x: number; y: number }) => Math.atan2(t.y - e.y, t.x - e.x);
export const enraged = (e: Enemy) => e.affixes.includes('enraged') && e.hp < e.maxHp * AFFIXES.enraged.n.threshold;
export const hitDamage = (e: Enemy) => e.damage * (enraged(e) ? AFFIXES.enraged.n.damage : 1) * (e.buffT > 0 ? e.buffDmg : 1);

export function move(e: Enemy, angle: number, speed: number, dt: number): void {
  if (e.waypoint) angle = Math.atan2(e.waypoint.y - e.y, e.waypoint.x - e.x); // v0.5: another floor: through the gate first
  e.x += Math.cos(angle) * speed * dt;
  e.y += Math.sin(angle) * speed * dt;
}

/** Walk to a point; returns the distance that was left. */
export function moveTo(e: Enemy, x: number, y: number, speed: number, dt: number): number {
  const d = Math.hypot(x - e.x, y - e.y);
  if (d > 4) move(e, Math.atan2(y - e.y, x - e.x), Math.min(speed, d / dt), dt);
  return d;
}

/** Walk at the target until touching it. e.angle doubles as the facing (shield bearers block along it). */
export function seek(e: Enemy, t: Target, speed: number, dt: number): void {
  e.flip = t.x < e.x;
  e.angle = angleTo(e, t);
  if (distTo(e, t) > e.r + t.r - 2) move(e, e.angle, speed, dt);
}

export function touch(g: Game, e: Enemy, t: Target, mult = 1): void {
  if (e.attackTimer <= 0 && distTo(e, t) < e.r + t.r + 4) {
    e.attackTimer = e.def.attackCd;
    hurtTarget(g, t, hitDamage(e) * mult, false, e);
  }
}

export function shootAt(g: Game, e: Enemy, angle: number): void {
  fireProjectile(g, e.x, e.y, angle, {
    damage: hitDamage(e),
    crit: false,
    hostile: true,
    pierce: 0,
    shape: e.def.boss ? 'orb' : 'arrow',
    color: e.def.id === 'abbot' ? POISON : e.def.boss ? '#7a4fa0' : '#c23a2e',
    r: e.def.boss ? 8 : 5,
    speed: e.def.projSpeed!,
    range: 700,
  });
}

/** Hold a preferred distance: approach when far, back off when crowded. */
export function keepRange(e: Enemy, t: Target, dt: number): number {
  const d = distTo(e, t);
  const a = angleTo(e, t);
  e.flip = t.x < e.x;
  if (d > e.def.range!) move(e, a, e.speed, dt);
  else if (d < e.def.range! * 0.55) move(e, a + Math.PI, e.speed * 0.8, dt);
  return d;
}

export function summon(g: Game, e: Enemy): void {
  if (g.enemies.length > AI_TUNING.maxSummons) return;
  for (let i = 0; i < e.def.summonCount!; i++) {
    const a = (i / e.def.summonCount!) * TAU;
    spawnEnemy(g, e.def.summon!, e.x + Math.cos(a) * 60, e.y + Math.sin(a) * 60);
  }
}

export const specialDamage = (e: Enemy) => hitDamage(e) * e.def.specialMult!;

const chargeHits = new WeakMap<Enemy, Set<Target>>();
/** A charge starts: nobody has been run through yet. */
export const chargeStart = (e: Enemy) => chargeHits.set(e, new Set());
/** One tick of a charge: it hits the player and each minion it touches once per charge, not every tick it overlaps them. */
export function chargeThrough(g: Game, e: Enemy): void {
  const hit = chargeHits.get(e) ?? chargeStart(e).get(e)!;
  for (const v of [g.player, ...g.minions]) {
    if (hit.has(v) || distTo(e, v) > e.r + v.r + 6) continue;
    hit.add(v);
    hurtTarget(g, v, specialDamage(e), true, e);
  }
}
