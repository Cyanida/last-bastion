import { sfx } from '../sim/view';
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
  sfx(g, 'warn');

  if (hz.kind === 'graspingHands') {
    const p = g.player;
    for (let i = 0; i < hz.count; i++) {
      const a = g.rng() * TAU;
      const d = i === 0 ? 0 : g.rng() * hz.spread;
      addZone(g, { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, r: hz.radius, delay: hz.delay + i * 0.15, damage, hostile: true, color: '#8fb08a' });
    }
  } else if (hz.kind === 'gatehouse') {
    // v0.6 Last Bastion: the gatehouse burns. A marked row of fire rolls across the south end of the hall, one side to the other,
    // and like the braziers it burns the horde too: lure them through it
    const core = g.arena.regions!.find((r) => r.id === 'core')!.floor;
    const y = core.y + core.h - 140;
    const n = Math.floor(core.w / hz.spacing);
    const fromLeft = g.rng() < 0.5;
    for (let i = 0; i <= n; i++) {
      const x = core.x + hz.spacing / 2 + (fromLeft ? i : n - i) * ((core.w - hz.spacing) / n);
      addZone(g, { x, y, r: hz.radius, delay: hz.delay + i * 0.09, damage, hostile: true, color: '#e07b28', dtype: 'fire' });
      addZone(g, { x, y, r: hz.radius, delay: hz.delay + i * 0.09, damage: damage * 3, hostile: false, color: '#e07b28', dtype: 'fire', source: 'hazard' });
    }
  } else {
    // braziers burn friend and foe: one hostile zone and one friendly zone on the same spot
    for (const o of g.arena.obstacles) {
      if (o.kind !== 'brazier') continue;
      addZone(g, { x: o.x, y: o.y, r: hz.radius, delay: hz.delay, damage, hostile: true, color: '#e07b28' });
      addZone(g, { x: o.x, y: o.y, r: hz.radius, delay: hz.delay, damage: damage * 3, hostile: false, color: '#e07b28', source: 'hazard' });
    }
  }
}
