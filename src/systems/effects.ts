import { GAME } from '../config/game';
import { compact, TAU } from '../core/math';
import type { Game } from '../core/types';

// Cosmetic only, so Math.random instead of the seeded game rng.

export function burst(g: Game, x: number, y: number, color: string, n: number, speed = 130): void {
  for (let i = 0; i < n && g.particles.length < GAME.maxParticles; i++) {
    const a = Math.random() * TAU;
    const v = speed * (0.3 + Math.random() * 0.7);
    const life = 0.25 + Math.random() * 0.35;
    g.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, color, size: 2 + Math.random() * 2 });
  }
}

export function floatText(g: Game, x: number, y: number, text: string, color: string, size = 13): void {
  if (g.texts.length >= GAME.maxTexts) g.texts.shift();
  g.texts.push({ x: x + (Math.random() - 0.5) * 14, y, text, color, life: 0.7, size });
}

export function ring(g: Game, x: number, y: number, r: number, color: string, dur = 0.4): void {
  g.effects.push({ kind: 'ring', x, y, x2: 0, y2: 0, r, angle: 0, arc: 0, t: 0, dur, color });
}

export function swingArc(g: Game, x: number, y: number, r: number, angle: number, arc: number, color: string): void {
  g.effects.push({ kind: 'arc', x, y, x2: 0, y2: 0, r, angle, arc, t: 0, dur: 0.15, color });
}

/** Short-lived beam: chain lightning, priest heals. */
export function line(g: Game, x: number, y: number, x2: number, y2: number, color: string): void {
  g.effects.push({ kind: 'line', x, y, x2, y2, r: 0, angle: 0, arc: 0, t: 0, dur: 0.22, color });
}

export function shake(g: Game, amount: number): void {
  g.shake = Math.max(g.shake, amount);
}

export function updateEffects(g: Game, dt: number): void {
  for (const p of g.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.92;
    p.vy *= 0.92;
    p.life -= dt;
  }
  compact(g.particles, (p) => p.life > 0);
  for (const t of g.texts) {
    t.y -= 40 * dt;
    t.life -= dt;
  }
  compact(g.texts, (t) => t.life > 0);
  for (const e of g.effects) e.t += dt;
  compact(g.effects, (e) => e.t < e.dur);
  g.shake = Math.max(0, g.shake - 40 * dt);
  if (g.banner.t > 0) g.banner.t -= dt;
}
