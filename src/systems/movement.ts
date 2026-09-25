import { AFFIXES } from '../config/elites';
import { GAME } from '../config/game';
import { sfx } from '../sim/view';
import { compact } from '../core/math';
import type { Body, Enemy, Game } from '../core/types';
import { clampToRects } from '../logic/regions';
import { speedFactor } from '../logic/status';
import { floatText } from './effects';
import { gainXp } from './leveling';
import { takeFragment } from './treasures';

function pushOut(b: Body, o: Body): void {
  if (b === o) return;
  const dx = b.x - o.x;
  const dy = b.y - o.y;
  const min = o.r + b.r;
  const d2 = dx * dx + dy * dy;
  if (d2 >= min * min) return;
  if (d2 === 0) {
    b.x = o.x + min; // dead centre: any direction will do
    return;
  }
  const d = Math.sqrt(d2);
  b.x = o.x + (dx / d) * min;
  b.y = o.y + (dy / d) * min;
}

/** Keeps a body inside the open part of the map and out of the arena's obstacles (circle colliders, so hordes slide around them). */
export function clampToArena(g: Game, b: Body): void {
  for (const o of g.arena.obstacles) pushOut(b, o);
  for (const o of g.barriers) pushOut(b, o); // walls a boss raised
  clampToRects(g.openRects, b); // v0.5: the walls are the edges of the open regions; closed wings are solid
}

/** v0.5: a point pushed clear of obstacles and into the open map, so whatever a quest or an event puts there can be reached. */
export function clearPoint(g: Game, at: { x: number; y: number }, r = 40): { x: number; y: number } {
  const b = { x: at.x, y: at.y, r };
  clampToArena(g, b);
  return { x: b.x, y: b.y };
}

export function updatePlayerMovement(g: Game, dt: number): void {
  const p = g.player;
  const { moveX, moveY } = g.input;
  const len = Math.hypot(moveX, moveY);
  if (len > 0) {
    const speed = p.stats.moveSpd * p.mods.moveSpd * (p.chillT > 0 ? AFFIXES.frostAura.n.slow : 1) * speedFactor(p.statuses);
    p.x += (moveX / len) * speed * dt;
    p.y += (moveY / len) * speed * dt;
    if (moveX !== 0) p.flip = moveX < 0;
    p.still = 0;
  } else p.still += dt;
  clampToArena(g, p);
}

const near: Enemy[] = [];

/** Knockback, soft separation so hordes don't stack into one pixel, arena bounds. */
export function updateEnemyPhysics(g: Game, dt: number): void {
  const decay = Math.pow(0.002, dt);
  for (const e of g.enemies) {
    if (e.dead) continue;
    e.x += e.kx * dt;
    e.y += e.ky * dt;
    e.kx *= decay;
    e.ky *= decay;
    if (!e.def.boss) {
      for (const o of g.hash.query(e.x, e.y, e.r, near)) {
        if (o === e || o.dead) continue;
        const dx = e.x - o.x;
        const dy = e.y - o.y;
        const d = Math.hypot(dx, dy) || 0.01;
        const push = ((e.r + o.r - d) / d) * 0.25;
        e.x += dx * push;
        e.y += dy * push;
      }
    }
    clampToArena(g, e);
  }
}

export function updatePickups(g: Game, dt: number): void {
  const p = g.player;
  const vacuum = g.breather > 0; // between waves everything flies to the player
  const radius = GAME.pickupRadius * p.mods.pickup;
  compact(g.pickups, (k) => {
    const dx = p.x - k.x;
    const dy = p.y - k.y;
    const d = Math.hypot(dx, dy) || 0.01;
    if (d < p.r + 8) {
      if (k.kind === 'xp') gainXp(g, k.value);
      else if (k.kind === 'gold') {
        g.player.gold += k.value;
        floatText(g, p.x, p.y - 26, `+${k.value}g`, '#c9a227', 12);
      } else if (k.kind === 'fragment') takeFragment(g);
      sfx(g, 'xp');
      return false;
    }
    if (vacuum || d < radius) {
      const step = Math.min(d, GAME.pickupSpeed * (vacuum ? 2 : 1) * dt);
      k.x += (dx / d) * step;
      k.y += (dy / d) * step;
    }
    return true;
  });
}
