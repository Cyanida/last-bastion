import { ABILITY_UPGRADES } from '../config/abilityUpgrades';
import { compact } from '../core/math';
import type { Game } from '../core/types';
import { applyStatus, damageEnemy, nearestEnemy } from './combat';
import { burst, ring } from './effects';
import { clampToArena } from './movement';

const AGGRO = 280;
const LEASH = 70; // idle minions hover this close to the player

export function updateMinions(g: Game, dt: number): void {
  const p = g.player;
  for (const m of g.minions) {
    m.life -= dt;
    m.attackTimer -= dt;
    m.flash -= dt;
    const target = nearestEnemy(g, m.x, m.y, AGGRO);
    const tx = target ? target.x : p.x;
    const ty = target ? target.y : p.y;
    const stop = target ? m.r + target.r : LEASH;
    const dx = tx - m.x;
    const dy = ty - m.y;
    const d = Math.hypot(dx, dy) || 0.01;
    if (d > stop) {
      m.x += (dx / d) * m.speed * dt;
      m.y += (dy / d) * m.speed * dt;
      m.flip = dx < 0;
    }
    if (target && d <= stop + 6 && m.attackTimer <= 0) {
      m.attackTimer = m.attackCd / p.mods.minionAtkSpd;
      damageEnemy(g, target, m.damage * p.mods.minionDamage, false, (dx / d) * 80, (dy / d) * 80, 'minion');
      applyStatus(target, m.status);
    }
    clampToArena(g, m);
  }
  compact(g.minions, (m) => {
    if (m.life > 0 && m.hp > 0) return true;
    burst(g, m.x, m.y, '#d8d2bd', 10);
    if (m.volatile > 0) {
      const radius = ABILITY_UPGRADES.volatileBones.n.radius;
      for (const e of g.hash.query(m.x, m.y, radius, [])) damageEnemy(g, e, m.damage * m.volatile * p.mods.minionDamage, false, 0, 0, 'minion');
      ring(g, m.x, m.y, radius, '#7ec8d8');
    }
    return false;
  });
}
