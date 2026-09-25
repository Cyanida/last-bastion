import type { Field, Game, Projectile, Zone } from '../core/types';
import { relicContext } from '../systems/relicContext';

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
  o: Pick<Projectile, 'damage' | 'crit' | 'hostile' | 'pierce' | 'shape' | 'color' | 'r'> & { speed: number; range: number } & Partial<Pick<Projectile, 'status' | 'source' | 'dtype' | 'seek'>>,
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
  pr.seek = o.seek ?? false;
  pr.by = relicContext.acting ?? undefined; // v0.7: fired by a relic's hook: its hits are that relic's work
  g.projectiles.push(pr);
}

export function addZone(g: Game, z: Pick<Zone, 'x' | 'y' | 'r' | 'delay' | 'damage' | 'hostile' | 'color'> & Partial<Zone>): void {
  g.zones.push({ t: 0, lastIn: [], crit: false, maxHits: 0, owner: null, killsOwner: false, arrow: false, status: null, leaveField: null, dtype: 'physical', source: 'ability', ...z });
  if (z.hostile && z.owner && z.delay > 0) z.owner.windupT = Math.max(z.owner.windupT, z.delay); // v0.6: whoever set it glows until it lands
}

export function addField(g: Game, f: Pick<Field, 'x' | 'y' | 'r' | 'life' | 'dps' | 'hostile' | 'color'> & Partial<Pick<Field, 'heal' | 'dtype' | 'apply'>>): void {
  g.fields.push({ heal: 0, dtype: 'physical', apply: null, ...f, max: f.life, tickT: 0, by: relicContext.acting ?? undefined });
}

const TIMER_KINDS = new Map<string, (g: Game, a: any) => void>();

/**
 * v0.8 step 3.3 (#27): a delayed action (second volley, twin pulse...) as data, so a snapshot can write it down. Registers what a
 * `kind` does and returns its scheduler: `later(g, seconds, args)`. The args are plain state (numbers, entities, plain objects).
 */
export function timer<A>(kind: string, fn: (g: Game, a: A) => void): (g: Game, seconds: number, a: A) => void {
  TIMER_KINDS.set(kind, fn); // a second registration (a dev hot reload) replaces the first
  return (g, seconds, a) => void g.timers.push({ t: seconds, kind, a });
}

/** addField after a delay (Burning Rain). */
export const fieldLater = timer('field', addField);

export const runTimer = (g: Game, t: Game['timers'][number]): void => TIMER_KINDS.get(t.kind)!(g, t.a);
