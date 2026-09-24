import { describe, expect, it } from 'vitest';
import type { Game } from '../src/core/types';
import { createGame } from '../src/game';
import { shieldBurst } from '../src/logic/abilities';
import { updateAbility } from '../src/systems/abilities';
import { spawnEnemy } from '../src/systems/spawning';

/** A Paladin with one sturdy, still enemy beside it, to measure the burst on. */
function paladin(): Game {
  const g = createGame('paladin', 1);
  const p = g.player;
  spawnEnemy(g, 'peasant', p.x + 40, p.y);
  for (const e of g.enemies) {
    e.speed = 0;
    e.hp = e.maxHp = 1e9;
    g.hash.insert(e);
  }
  return g;
}
function step(g: Game, ability: boolean): void {
  g.input.ability = ability;
  updateAbility(g, 1 / 60);
  g.time += 1 / 60;
}
/** Casts, holds `hold` ticks, then (optionally) presses again; returns the burst's damage. */
function burstAfter(hold: number, detonate: boolean): number {
  const g = paladin();
  const e = g.enemies[0];
  step(g, true); // cast
  for (let i = 0; i < hold; i++) step(g, false);
  if (detonate) step(g, true);
  while (g.player.abilityTime > 0) step(g, false);
  return 1e9 - e.hp;
}

describe('Divine Shield detonation (v0.7.4, #63)', () => {
  it('the burst share runs from 50% at the cast to 100% when the shield runs out', () => {
    expect(shieldBurst(0.5, 0, 3)).toBe(0.5);
    expect(shieldBurst(0.5, 1.5, 1.5)).toBe(0.75);
    expect(shieldBurst(0.5, 3, 0)).toBe(1);
  });

  it('a new press right after the cast ends the shield with half the burst; letting it run out deals it all', () => {
    const full = burstAfter(0, false);
    expect(full).toBeGreaterThan(0);
    const early = burstAfter(1, true);
    expect(early / full).toBeGreaterThan(0.49);
    expect(early / full).toBeLessThan(0.52);
  });

  it('a held key does not detonate', () => {
    const g = paladin();
    const p = g.player;
    step(g, true);
    const dur = p.abilityTime;
    for (let i = 0; i < 30; i++) step(g, true);
    expect(p.abilityTime).toBeGreaterThan(0);
    expect(p.abilityTime).toBeLessThan(dur);
  });

  it('after an early end the cooldown still lasts at least as long as the shield was up', () => {
    const g = paladin();
    const p = g.player;
    step(g, true);
    for (let i = 0; i < 60; i++) step(g, false);
    step(g, true);
    expect(p.abilityTime).toBe(0);
    expect(p.invulnerable).toBe(false);
    expect(p.abilityCd).toBeGreaterThanOrEqual(g.vars['shield.up'] - 1e-9);
    expect(g.vars['ability.readyAt']).toBeCloseTo(g.time - 1 / 60 + g.vars['shield.up'], 5);
  });
});
