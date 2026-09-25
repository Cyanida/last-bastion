import { describe, expect, it } from 'vitest';
import type { Game } from '../src/core/types';
import { createGame } from '../src/game';
import { cooldownFloor } from '../src/logic/formulas';
import { updateAbility } from '../src/systems/abilities';
import { perfectDodge } from '../src/systems/dodge';
import { addRelic } from '../src/systems/relics';
import { damagePlayer } from '../src/systems/combat';
import { spawnEnemy } from '../src/systems/spawning';

/** A Paladin with Sanctuary and Second Wind, surrounded, lots of Faith: the shield lasts longer than its cooldown. */
function stacked(): Game {
  const g = createGame('paladin', 1);
  const p = g.player;
  p.upgrades.push('sanctuary', 'secondWind');
  p.stats.secondary = 60; // a long shield: 3 + 0.12 × 60 = 10.2 s, twice that while surrounded
  for (let i = 0; i < 5; i++) spawnEnemy(g, 'peasant', p.x + 40 + i * 6, p.y);
  for (const e of g.enemies) {
    e.speed = 0;
    g.hash.insert(e);
  }
  return g;
}
/** Runs the ability system (and the clock) for `seconds`, casting whenever it is ready. */
function run(g: Game, seconds: number, cast = true): { up: number } {
  let up = 0;
  for (let t = 0; t < seconds; t += 1 / 60) {
    g.input.ability = cast;
    updateAbility(g, g.player, 1 / 60);
    g.time += 1 / 60;
    if (g.player.abilityTime > 0) up += 1 / 60;
  }
  return { up };
}

describe('Divine Shield uptime (v0.7.3, #53)', () => {
  it('after the shield, the cooldown lasts at least as long as the shield was up', () => {
    const g = stacked();
    const p = g.player;
    run(g, 1 / 60); // cast
    while (p.abilityTime > 0) run(g, 1 / 60, false); // Sanctuary stretches it while surrounded
    expect(g.player.vars['shield.up']).toBeGreaterThan(p.abilityCdMax); // the shield outlasted its own cooldown...
    expect(p.abilityCd).toBeGreaterThanOrEqual(g.player.vars['shield.up'] - 1 / 30); // ...so the cooldown now lasts as long as the shield did
    expect(cooldownFloor(g)).toBeGreaterThan(p.abilityCdMax);
  });

  it('perfect dodges and the Reliquary cannot cut it below that floor', () => {
    const g = stacked();
    addRelic(g, 'reliquary');
    run(g, 0.1);
    run(g, 30, false);
    const p = g.player;
    const floor = cooldownFloor(g);
    expect(floor).toBeGreaterThan(0);
    perfectDodge(g, g.player);
    expect(p.abilityCd).toBeGreaterThanOrEqual(floor - 1e-9);
    for (let i = 0; i < 20; i++) damagePlayer(g, g.player, 1, true);
    expect(p.abilityCd).toBeGreaterThanOrEqual(cooldownFloor(g) - 1e-9);
  });

  it('casting on cooldown for two minutes keeps the Paladin shielded at most half the time', () => {
    const g = stacked();
    const { up } = run(g, 120);
    expect(up / 120).toBeLessThanOrEqual(0.52);
    expect(up / 120).toBeGreaterThan(0.3); // still a strong shield
  });
});
