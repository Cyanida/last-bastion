import { describe, expect, it } from 'vitest';
import { DUOS } from '../src/config/relics';
import type { Enemy, Game } from '../src/core/types';
import { createGame } from '../src/game';
import { addBleed } from '../src/systems/relicCore';
import { DUO_HOOKS } from '../src/systems/relicFamilies/duos';
import { spawnEnemy } from '../src/systems/spawning';

/** A quiet arena with four sturdy knights in a row, 100 px apart: a chain from the first reaches the next two, not the last. */
function stage(): { g: Game; foes: Enemy[] } {
  const g = createGame('viking', 7);
  g.pendingBoard = false;
  g.breather = 1e9;
  const foes = [0, 1, 2, 3].map((i) => Object.assign(spawnEnemy(g, 'knight', g.player.x + 100 + i * 100, g.player.y), { hp: 1e7, maxHp: 1e7, armorHp: 0 }));
  g.hash.clear();
  for (const e of g.enemies) g.hash.insert(e);
  return { g, foes };
}
const hit = (g: Game, enemy: Enemy, crit: boolean) => DUO_HOOKS.redLightning!.onHit!(g, { enemy, amount: 100, crit, source: 'attack' }, g.player);

describe('Red Lightning (#149)', () => {
  it('a crit on a bleeding enemy chains to two more, each for 35% of the hit', () => {
    const d = DUOS.redLightning.n;
    expect(d.jumps).toBe(2);
    expect(d.mult).toBe(0.35); // was 0.5: with the Viking's cleave it cleared whole Squire waves on its own
    const { g, foes } = stage();
    addBleed(g, g.player, foes[0], 1, 1);
    hit(g, foes[0], true);
    const lost = foes.map((e) => 1e7 - e.hp);
    expect(lost[0]).toBe(0);
    expect(lost[1]).toBeGreaterThan(0);
    expect(lost[2]).toBeGreaterThan(0);
    expect(lost[3]).toBe(0); // two jumps, no more
    expect(lost[1]).toBeLessThanOrEqual(100 * d.mult + 1e-6);
  });

  it('does nothing on a plain hit or on an enemy that is not bleeding', () => {
    const { g, foes } = stage();
    hit(g, foes[0], true);
    addBleed(g, g.player, foes[0], 1, 1);
    hit(g, foes[0], false);
    expect(foes.every((e) => e.hp === 1e7)).toBe(true);
  });
});
