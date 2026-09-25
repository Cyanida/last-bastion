import { describe, expect, it } from 'vitest';
import { ENEMY_STATUS } from '../src/config/damage';
import { MODIFIERS } from '../src/config/waves';
import { TIERS } from '../src/config/economy';
import type { Game } from '../src/core/types';
import { createGame } from '../src/game';
import { hurtTarget, killEnemy } from '../src/systems/combat';
import { updatePattern } from '../src/systems/patterns';
import { spawnEnemy } from '../src/systems/spawning';

const DT = 1 / 60;

function stage(tier = 0): Game {
  const g = createGame('paladin', 7, { tier });
  g.pendingBoard = false;
  g.breather = 1e9;
  g.player.attackTimer = 1e9;
  return g;
}

describe('late-Act slams and enemy damage over time (v0.7.5, #112)', () => {
  it('a slam that came due out of range fires the moment the player steps in', () => {
    const g = stage();
    g.act = 3;
    const e = spawnEnemy(g, 'knight', g.player.x + 400, g.player.y);
    for (let i = 0; i < 60 * 20; i++) updatePattern(g, e, DT); // well past its cooldown, out of range
    expect(e.patternT).toBe(0);
    e.x = g.player.x + 60;
    const zones = g.zones.length;
    updatePattern(g, e, DT);
    expect(g.zones.length).toBe(zones + 1);
  });

  it('bleed, burn and poison from enemy hits follow the difficulty tier', () => {
    for (const tier of [0, 3]) {
      const g = stage(tier);
      const wolf = spawnEnemy(g, 'wolf', g.player.x + 30, g.player.y);
      hurtTarget(g, g.player, 5, true, wolf);
      expect(g.player.statuses.bleed!.power).toBeCloseTo(ENEMY_STATUS.wolf!.power! * g.waveDmgMult * TIERS[tier].enemyDmg);
    }
  });

  it('Plague pools follow the difficulty tier', () => {
    const g = stage(3);
    g.modifier = 'plague';
    const e = spawnEnemy(g, 'peasant', g.player.x + 200, g.player.y);
    killEnemy(g, e);
    const pool = g.fields.at(-1)!;
    expect(pool.dps).toBeCloseTo(MODIFIERS.plague.n.dps * g.waveDmgMult * TIERS[3].enemyDmg);
  });
});
