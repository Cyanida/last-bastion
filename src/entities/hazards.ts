import type { Field, Game, Projectile, Zone } from '../core/types';

export function fireProjectile(
  g: Game,
  x: number,
  y: number,
  angle: number,
  o: Pick<Projectile, 'damage' | 'crit' | 'hostile' | 'pierce' | 'shape' | 'color' | 'r'> & { speed: number; range: number } & Partial<Pick<Projectile, 'status' | 'source'>>,
): void {
  g.projectiles.push({
    x,
    y,
    r: o.r,
    vx: Math.cos(angle) * o.speed,
    vy: Math.sin(angle) * o.speed,
    damage: o.damage,
    crit: o.crit,
    hostile: o.hostile,
    pierce: o.pierce,
    life: o.range / o.speed,
    shape: o.shape,
    color: o.color,
    hit: [],
    status: o.status ?? null,
    source: o.source ?? 'attack',
  });
}

export function addZone(g: Game, z: Pick<Zone, 'x' | 'y' | 'r' | 'delay' | 'damage' | 'hostile' | 'color'> & Partial<Zone>): void {
  g.zones.push({ t: 0, crit: false, maxHits: 0, owner: null, killsOwner: false, arrow: false, status: null, leaveField: null, ...z });
}

export function addField(g: Game, f: Pick<Field, 'x' | 'y' | 'r' | 'life' | 'dps' | 'hostile' | 'color'> & { heal?: number }): void {
  g.fields.push({ heal: 0, ...f, max: f.life, tickT: 0 });
}

/** Run fn after `seconds` of game time (second volley, twin pulse...). */
export function after(g: Game, seconds: number, fn: () => void): void {
  g.timers.push({ t: seconds, fn });
}
