import { RENDER } from '../config/game';
import type { Field, Game, Projectile, Zone } from '../core/types';

const pool: Projectile[] = [];
/** Returned by combat when a projectile dies, so the next shot reuses the object (and its hit list). */
export function recycleProjectile(pr: Projectile): void {
  pr.hit.length = 0;
  pool.push(pr);
}

export function fireProjectile(
  g: Game,
  x: number,
  y: number,
  angle: number,
  o: Pick<Projectile, 'damage' | 'crit' | 'hostile' | 'pierce' | 'shape' | 'color' | 'r'> & { speed: number; range: number } & Partial<Pick<Projectile, 'status' | 'source' | 'dtype'>>,
): void {
  const pr = pool.pop() ?? ({ hit: [] } as unknown as Projectile);
  pr.x = x;
  pr.y = y;
  pr.r = o.r;
  pr.vx = Math.cos(angle) * o.speed;
  pr.vy = Math.sin(angle) * o.speed;
  pr.damage = o.damage;
  pr.crit = o.crit;
  pr.hostile = o.hostile;
  pr.pierce = o.pierce;
  pr.life = o.range / o.speed;
  pr.shape = o.shape;
  pr.color = o.color;
  pr.status = o.status ?? null;
  pr.source = o.source ?? 'attack';
  pr.dtype = o.dtype ?? 'physical';
  g.projectiles.push(pr);
}

export function addZone(g: Game, z: Pick<Zone, 'x' | 'y' | 'r' | 'delay' | 'damage' | 'hostile' | 'color'> & Partial<Zone>): void {
  g.zones.push({ t: 0, lastIn: -1, crit: false, maxHits: 0, owner: null, killsOwner: false, arrow: false, status: null, leaveField: null, dtype: 'physical', ...z });
  if (z.hostile && z.owner && z.delay > 0) z.owner.windupT = Math.max(z.owner.windupT, z.delay); // v0.6: whoever set it glows until it lands
}

export function addField(g: Game, f: Pick<Field, 'x' | 'y' | 'r' | 'life' | 'dps' | 'hostile' | 'color'> & Partial<Pick<Field, 'heal' | 'dtype' | 'apply'>>): void {
  if (g.fields.length >= RENDER.maxFields) g.fields.shift(); // the oldest goes: a Plague wave would otherwise carpet the arena
  g.fields.push({ heal: 0, dtype: 'physical', apply: null, ...f, max: f.life, tickT: 0 });
}

/** Run fn after `seconds` of game time (second volley, twin pulse...). */
export function after(g: Game, seconds: number, fn: () => void): void {
  g.timers.push({ t: seconds, fn });
}
