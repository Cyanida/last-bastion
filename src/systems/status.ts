import { DAMAGE_TYPES, STATUS_TUNING, type DamageType } from '../config/damage';
import type { Game } from '../core/types';
import { tickStatuses } from '../logic/status';
import { damageEnemy, damagePlayer } from './combat';

/** Collects damage-over-time and lands it every STATUS_TUNING.dotTick, so burns read as ticks, not as a number per frame. */
function flush(dots: Partial<Record<DamageType, number>>, hit: (amount: number, type: DamageType) => void): void {
  for (const type of Object.keys(dots) as DamageType[]) {
    const amount = dots[type]!;
    if (amount < 0.5) continue; // too small to show: keep it for the next tick
    delete dots[type];
    hit(amount, type);
  }
}

const scratch: Partial<Record<DamageType, number>> = {};

export function updateStatuses(g: Game, dt: number): void {
  for (const e of g.enemies) {
    if (e.dead) continue;
    const dots = tickStatuses(e.statuses, dt, scratch);
    for (const type in dots) {
      e.dots[type as DamageType] = (e.dots[type as DamageType] ?? 0) + dots[type as DamageType]!;
      delete dots[type as DamageType];
    }
    if ((e.dotT -= dt) <= 0) {
      e.dotT = STATUS_TUNING.dotTick;
      flush(e.dots, (amount, type) => damageEnemy(g, e, amount, false, 0, 0, 'hazard', type));
    }
  }
  const p = g.player;
  const dots = tickStatuses(p.statuses, dt);
  for (const type of Object.keys(dots) as DamageType[]) p.dots[type] = (p.dots[type] ?? 0) + dots[type]!;
  if ((p.dotT -= dt) <= 0) {
    p.dotT = STATUS_TUNING.dotTick;
    flush(p.dots, (amount, type) => damagePlayer(g, amount, true, null, `${DAMAGE_TYPES[type].name.toLowerCase()} damage over time`));
  }
  for (const m of g.minions) {
    if ((m.blessedT -= dt) > 0) m.hp = Math.min(m.maxHp, m.hp + STATUS_TUNING.blessedRegen * dt);
  }
}
