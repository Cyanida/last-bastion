import { sfx } from '../core/audio';
import { TAU } from '../core/math';
import type { Game } from '../core/types';
import { addZone } from '../entities/hazards';

/** Each arena's environmental hazard, on a timer. Damage scales with the wave like enemy damage. */
export function updateArena(g: Game, dt: number): void {
  const hz = g.arena.hazard;
  if (!hz || g.wave === 0) return;
  g.hazardT -= dt;
  if (g.hazardT > 0) return;
  g.hazardT = hz.every;
  const damage = hz.damage * g.waveDmgMult * g.tier.enemyDmg;
  sfx('warn');

  if (hz.kind === 'graspingHands') {
    const p = g.player;
    for (let i = 0; i < hz.count; i++) {
      const a = g.rng() * TAU;
      const d = i === 0 ? 0 : g.rng() * hz.spread;
      addZone(g, { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, r: hz.radius, delay: hz.delay + i * 0.15, damage, hostile: true, color: '#8fb08a' });
    }
  } else {
    // braziers burn friend and foe: one hostile zone and one friendly zone on the same spot
    for (const o of g.arena.obstacles) {
      if (o.kind !== 'brazier') continue;
      addZone(g, { x: o.x, y: o.y, r: hz.radius, delay: hz.delay, damage, hostile: true, color: '#e07b28' });
      addZone(g, { x: o.x, y: o.y, r: hz.radius, delay: hz.delay, damage: damage * 3, hostile: false, color: '#e07b28' });
    }
  }
}
