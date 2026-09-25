import { describe, expect, it } from 'vitest';
import { BOSS_RESOLVE } from '../src/config/damage';
import { FINAL } from '../src/config/acts';
import { createGame } from '../src/game';
import { throughResolve } from '../src/logic/status';
import { damageEnemy } from '../src/systems/combat';
import { spawnEnemy } from '../src/systems/spawning';

const { burst, perSec, excess, cap } = BOSS_RESOLVE;

describe('v0.7.5 boss resolve (#95)', () => {
  it('lands a hit in full up to the burst allowance, and a fraction past it', () => {
    expect(throughResolve(50, 1000, 0, 0, 0).dealt).toBe(50);
    const big = throughResolve(500, 1000, 0, 0, 0);
    expect(big.dealt).toBeCloseTo(burst * 1000 + (500 - burst * 1000) * excess);
    expect(big.load).toBeCloseTo(big.dealt);
    expect(throughResolve(1e9, 1000, 0, 0, 0).dealt).toBeCloseTo(cap * 1000); // however big, a burst stops at the cap
  });

  it('refills the allowance at perSec of max HP a second', () => {
    const full = throughResolve(burst * 1000, 1000, 0, 0, 0);
    expect(throughResolve(10, 1000, full.load, 0, 0).dealt).toBeCloseTo(10 * excess); // right after: all past the allowance
    expect(throughResolve(perSec * 1000, 1000, full.load, 0, 1).dealt).toBeCloseTo(perSec * 1000); // a second later: that much room again
  });

  it('keeps the Usurper standing through one enormous hit', () => {
    const g = createGame('archer', 1);
    const u = spawnEnemy(g, FINAL.boss, g.player.x + 300, g.player.y);
    damageEnemy(g, u, u.maxHp * 3, false, 0, 0, 'ability');
    expect(u.dead).toBe(false);
    expect(u.hp).toBeCloseTo(u.maxHp * (1 - cap));
  });

  it('leaves ordinary enemies alone', () => {
    const g = createGame('archer', 1);
    const e = spawnEnemy(g, 'peasant', g.player.x + 300, g.player.y);
    damageEnemy(g, e, e.maxHp * 3, false, 0, 0, 'ability');
    expect(e.dead).toBe(true);
  });
});
