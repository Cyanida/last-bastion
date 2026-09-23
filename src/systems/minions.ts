import { ABILITY_UPGRADES } from '../config/abilityUpgrades';
import { STATUS_TUNING } from '../config/damage';
import { compact } from '../core/math';
import type { Game, Minion } from '../core/types';
import { applyStatus, damageEnemy, nearestEnemy } from './combat';
import { burst, ring } from './effects';
import { fireProjectile } from '../entities/hazards';
import { waypoint } from '../logic/regions';
import { clampToArena } from './movement';
import { regionsOf } from './regions';

const AGGRO = 280;
const LEASH = 70; // idle minions hover this close to the player

/** The Necromancer's own: skeletons and golems (v0.5 quest and event units have a kind and do not take up his slots). */
export const skeletonCount = (g: Game): number => g.minions.reduce((n, m) => n + (m.kind ? 0 : 1), 0);

/** v0.5: a caravan or a monk walks its waypoints in a loop at its current speed (its quest sets it to 0 to make it wait). */
function walkPath(g: Game, m: Minion, dt: number): void {
  const next = m.path?.[m.pathI ?? 0];
  if (!next) return;
  const at = viaGate(g, m, next.x, next.y); // a waypoint on another floor: through its gate first
  const dx = at.x - m.x;
  const dy = at.y - m.y;
  const d = Math.hypot(dx, dy);
  if (d < 8 && at === next) m.pathI = ((m.pathI ?? 0) + 1) % m.path!.length;
  else {
    const step = Math.min(d, m.speed * dt);
    m.x += (dx / d) * step;
    m.y += (dy / d) * step;
    if (step > 0) m.flip = dx < 0;
  }
}

/** The point to head for: (x, y) itself, or the gate on the way when it is on another floor (logic/regions waypoint). */
function viaGate(g: Game, m: Minion, x: number, y: number): { x: number; y: number } {
  return (g.openFloors.length > 1 && waypoint(regionsOf(g), m.x, m.y, x, y)) || { x, y };
}

export function updateMinions(g: Game, dt: number): void {
  const p = g.player;
  for (const m of g.minions) {
    m.life -= dt;
    m.attackTimer -= dt;
    m.flash -= dt;
    if (m.passive) {
      walkPath(g, m, dt);
      clampToArena(g, m);
      // v0.6: the Archer's shadow stands and shoots
      if (m.shoot && (m.shoot.t -= dt) <= 0) {
        const e = nearestEnemy(g, m.x, m.y, 520);
        if (e) {
          m.shoot.t = m.shoot.every;
          m.flip = e.x < m.x;
          fireProjectile(g, m.x, m.y - 6, Math.atan2(e.y - m.y, e.x - m.x), { damage: m.shoot.damage, crit: false, hostile: false, pierce: 1, shape: 'arrow', color: '#a77fd0', r: 5, speed: 620, range: 560, source: 'minion' });
        }
      }
      continue;
    }
    const target = nearestEnemy(g, m.x, m.y, AGGRO);
    const goal = viaGate(g, m, target ? target.x : p.x, target ? target.y : p.y); // v0.5: another floor: through its gate
    const stop = target && goal.x === target.x && goal.y === target.y ? m.r + target.r : goal.x === p.x && goal.y === p.y ? LEASH : 4;
    const dx = goal.x - m.x;
    const dy = goal.y - m.y;
    const d = Math.hypot(dx, dy) || 0.01;
    if (d > stop) {
      m.x += (dx / d) * m.speed * dt;
      m.y += (dy / d) * m.speed * dt;
      m.flip = dx < 0;
    }
    if (target && goal.x === target.x && goal.y === target.y && d <= stop + 6 && m.attackTimer <= 0) {
      m.attackTimer = m.attackCd / p.mods.minionAtkSpd;
      const blessed = m.blessedT > 0 ? STATUS_TUNING.blessedDamage : 1;
      damageEnemy(g, target, m.damage * p.mods.minionDamage * blessed, false, (dx / d) * 80, (dy / d) * 80, 'minion', 'shadow');
      applyStatus(target, m.status, g);
      if (m.cleave) {
        // v0.6 Bone Colossus: the blow lands on everything around its target too
        for (const o of g.hash.query(target.x, target.y, m.cleave, [])) if (o !== target && !o.dead) damageEnemy(g, o, m.damage * p.mods.minionDamage * blessed, false, 0, 0, 'minion', 'shadow');
        ring(g, target.x, target.y, m.cleave, '#d8d2bd', 0.25);
      }
    }
    clampToArena(g, m);
  }
  compact(g.minions, (m) => {
    if (m.life > 0 && m.hp > 0) return true;
    burst(g, m.x, m.y, '#d8d2bd', 10);
    if (m.onEnd) {
      for (const e of g.hash.query(m.x, m.y, m.onEnd.radius, [])) damageEnemy(g, e, m.onEnd.damage, false, 0, 0, 'minion', m.onEnd.dtype);
      ring(g, m.x, m.y, m.onEnd.radius, m.onEnd.color, 0.5);
      burst(g, m.x, m.y, m.onEnd.color, 18, 220);
    }
    if (m.volatile > 0) {
      const radius = ABILITY_UPGRADES.volatileBones.n.radius;
      for (const e of g.hash.query(m.x, m.y, radius, [])) damageEnemy(g, e, m.damage * m.volatile * p.mods.minionDamage, false, 0, 0, 'minion');
      ring(g, m.x, m.y, radius, '#7ec8d8');
    }
    return false;
  });
}
