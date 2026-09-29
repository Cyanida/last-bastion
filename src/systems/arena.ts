import { FLAGSTONE, PRESSES } from '../config/arenas';
import { sfx } from '../sim/view';
import { TAU } from '../core/math';
import type { Game } from '../core/types';
import { addZone } from '../entities/hazards';
import { openSlab, pressesOn, pressShape, pressSlabs } from '../logic/presses';

/** Each arena's environmental hazard, on a timer. Damage scales with the wave like enemy damage. */
export function updateArena(g: Game, dt: number): void {
  updatePresses(g, dt);
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
      addZone(g, { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, r: hz.radius, delay: hz.delay + i * 0.15, damage, hostile: true, color: '#8fb08a', art: 'hands' });
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
      addZone(g, { x, y, r: hz.radius, delay: hz.delay + i * 0.09, damage, hostile: true, color: '#e07b28', dtype: 'fire', art: 'fire' });
      addZone(g, { x, y, r: hz.radius, delay: hz.delay + i * 0.09, damage: damage * 3, hostile: false, color: '#e07b28', dtype: 'fire', source: 'hazard' });
    }
  } else {
    // braziers burn friend and foe: one hostile zone and one friendly zone on the same spot
    for (const o of g.arena.obstacles) {
      if (o.kind !== 'brazier') continue;
      addZone(g, { x: o.x, y: o.y, r: hz.radius, delay: hz.delay, damage, hostile: true, color: '#e07b28', art: 'fire' });
      addZone(g, { x: o.x, y: o.y, r: hz.radius, delay: hz.delay, damage: damage * 3, hostile: false, color: '#e07b28', source: 'hazard' });
    }
  }
}

/**
 * #211: the Iron Hold's forge presses, on their own clock beside the arena's braziers. A press marks the slabs round the player (a line
 * through theirs, late on every other slam a cross), lowers its ram over them and slams: one hostile zone and one friendly zone per
 * slab, like the braziers, so the horde lured under it takes the heavier blow.
 */
function updatePresses(g: Game, dt: number): void {
  if (g.wave === 0 || !pressesOn(g.level?.realm, g.arena.id)) return;
  g.pressT -= dt;
  if (g.pressT > 0) return;
  g.pressT = PRESSES.every;
  const p = g.player;
  const shape = pressShape(g.wave, g.presses++, PRESSES.crossFrom);
  const slabs = pressSlabs(p.x, p.y, FLAGSTONE, shape, PRESSES.line, g.rng() < 0.5, Math.floor(g.rng() * PRESSES.line)).filter((s) => openSlab(s, g.openRects, g.arena.obstacles));
  if (!slabs.length) return;
  const damage = PRESSES.damage * g.waveDmgMult * g.tier.enemyDmg;
  sfx(g, 'warn');
  for (const s of slabs) {
    const z = { x: s.x, y: s.y, r: FLAGSTONE / 2, slab: FLAGSTONE, delay: PRESSES.delay, color: '#e0683f', source: 'hazard' as const };
    addZone(g, { ...z, damage, hostile: true, art: 'press' });
    addZone(g, { ...z, damage: damage * PRESSES.foeMult, hostile: false });
  }
}
