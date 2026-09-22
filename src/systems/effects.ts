import { GAME, RENDER } from '../config/game';
import { compact, TAU } from '../core/math';
import { particleBudget } from '../core/quality';
import type { Enemy, FloatText, Game, Particle } from '../core/types';

// Cosmetic only, so Math.random instead of the seeded game rng.
// Particles and texts are pooled: at 60 Hz with a horde on screen they were the bulk of the garbage.

const particlePool: Particle[] = [];
const textPool: FloatText[] = [];

export function burst(g: Game, x: number, y: number, color: string, n: number, speed = 130): void {
  const count = Math.ceil(n * particleBudget());
  for (let i = 0; i < count && g.particles.length < GAME.maxParticles; i++) {
    const a = Math.random() * TAU;
    const v = speed * (0.3 + Math.random() * 0.7);
    const life = 0.25 + Math.random() * 0.35;
    const p = particlePool.pop() ?? ({} as Particle);
    p.x = x;
    p.y = y;
    p.vx = Math.cos(a) * v;
    p.vy = Math.sin(a) * v;
    p.life = p.max = life;
    p.color = color;
    p.size = 2 + Math.random() * 2;
    g.particles.push(p);
  }
}

function takeText(g: Game, x: number, y: number, text: string, color: string, size: number): FloatText {
  if (g.texts.length >= RENDER.maxTexts) {
    const old = g.texts.shift()!;
    if (old.owner) old.owner.lastText = null;
    textPool.push(old);
  }
  const t = textPool.pop() ?? ({} as FloatText);
  t.x = x;
  t.y = y;
  t.text = text;
  t.color = color;
  t.size = size;
  t.life = 0.7;
  t.value = 0;
  t.owner = null;
  t.img = null;
  g.texts.push(t);
  return t;
}

export function floatText(g: Game, x: number, y: number, text: string, color: string, size = 13): void {
  takeText(g, x + (Math.random() - 0.5) * 14, y, text, color, size);
}

/**
 * A damage number on an enemy. A hit that lands within RENDER.mergeNumberWindow of the previous one on the same
 * enemy is added to that number instead of spawning another: a Viking at 4 swings a second makes one growing number, not four.
 */
export function damageNumber(g: Game, e: Enemy, amount: number, color: string, size: number, suffix = ''): void {
  const t = e.lastText;
  if (t && t.owner === e && t.life > 0.7 - RENDER.mergeNumberWindow && t.size === size && t.color === color) {
    t.value += amount;
    t.text = `${Math.round(t.value)}${suffix}`;
    t.img = null; // re-rendered on the next frame
    t.life = Math.max(t.life, 0.55);
    return;
  }
  const n = takeText(g, e.x + (Math.random() - 0.5) * 14, e.y - e.r - 8, `${Math.round(amount)}${suffix}`, color, size);
  n.value = amount;
  n.owner = e;
  e.lastText = n;
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
  compact(g.particles, (p) => p.life > 0 || (particlePool.push(p), false));
  for (const t of g.texts) {
    t.y -= 40 * dt;
    t.life -= dt;
  }
  compact(g.texts, (t) => {
    if (t.life > 0) return true;
    if (t.owner && t.owner.lastText === t) t.owner.lastText = null;
    textPool.push(t);
    return false;
  });
  for (const e of g.effects) e.t += dt;
  compact(g.effects, (e) => e.t < e.dur);
  g.shake = Math.max(0, g.shake - 40 * dt);
  if (g.banner.t > 0) g.banner.t -= dt;
}
