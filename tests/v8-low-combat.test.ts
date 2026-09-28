import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../src/config/enemies';
import { TIERS } from '../src/config/economy';
import type { Game } from '../src/core/types';
import { createGame } from '../src/game';
import { shootAt } from '../src/systems/aiHelpers';
import { updateProjectiles } from '../src/systems/combat';
import { SPECIALS } from '../src/systems/specials';
import { spawnEnemy } from '../src/systems/spawning';

function stage(tier = 0): Game {
  const g = createGame('paladin', 7, { tier });
  g.pendingBoard = false;
  g.breather = 1e9;
  g.player.attackTimer = 1e9;
  return g;
}

describe('the remaining low combat items of the 28-09 check (#182)', () => {
  it("the plague doctor's pool and its poison follow the difficulty tier", () => {
    const g = stage(3);
    const doc = spawnEnemy(g, 'plagueDoctor', g.player.x + 200, g.player.y);
    SPECIALS.plague(g, doc, g.player, 1 / 60);
    const pool = g.zones.at(-1)!.leaveField!;
    const mult = g.waveDmgMult * TIERS[3].enemyDmg;
    expect(pool.dps).toBeCloseTo(ENEMIES.plagueDoctor.poolDps! * mult);
    expect(pool.apply!.power).toBeCloseTo(ENEMIES.plagueDoctor.poolDps! * 0.5 * mult);
  });

  it("a priest's heal follows the difficulty tier, as the HP it mends does", () => {
    const g = stage(3);
    const priest = spawnEnemy(g, 'priest', g.player.x + 200, g.player.y);
    const hurt = spawnEnemy(g, 'knight', priest.x + 20, priest.y);
    hurt.hp = 1;
    g.hash.clear();
    for (const e of g.enemies) g.hash.insert(e);
    SPECIALS.heal(g, priest, g.player, 1 / 60);
    expect(hurt.hp).toBeCloseTo(1 + ENEMIES.priest.healAmount! * g.waveHpMult * TIERS[3].enemyHp);
  });

  it("an enemy's bolt is its own: the Abbot's poisons, even after he falls", () => {
    const g = stage();
    const abbot = spawnEnemy(g, 'abbot', g.player.x + 120, g.player.y);
    shootAt(g, abbot, Math.PI);
    expect(g.projectiles.at(-1)!.owner).toBe(abbot);
    abbot.dead = true; // the shot is already in the air
    for (let i = 0; i < 120 && g.projectiles.length; i++) updateProjectiles(g, 1 / 60);
    expect(g.player.hp).toBeLessThan(g.player.stats.hp);
    expect(g.player.statuses.poison).toBeTruthy();
  });
});
