import { describe, expect, it } from 'vitest';
import { ABILITY_UPGRADES } from '../src/config/abilityUpgrades';
import { createGame } from '../src/game';
import { dreadHowlStun } from '../src/logic/abilities';
import { updateAbility } from '../src/systems/abilities';
import { spawnEnemy } from '../src/systems/spawning';

const n = ABILITY_UPGRADES.dreadHowl.n;

describe('Dread Howl stuns instead of scaring (#134)', () => {
  it('lasts its base time plus a bit per Rage', () => {
    expect(dreadHowlStun(n, 0)).toBe(n.time);
    expect(dreadHowlStun(n, 10)).toBeCloseTo(n.time + 10 * n.perRage);
  });

  it('rage stuns the enemies around the Viking, not far ones or bosses, and nobody flees', () => {
    const g = createGame('viking', 1);
    const p = g.player;
    p.upgrades.push('dreadHowl');
    p.stats.secondary = 10;
    const close = spawnEnemy(g, 'peasant', p.x + 60, p.y);
    const far = spawnEnemy(g, 'peasant', p.x + n.radius + 200, p.y);
    const boss = spawnEnemy(g, 'blackKnight', p.x - 80, p.y);
    for (const e of g.enemies) g.hash.insert(e);
    g.input.ability = true;
    updateAbility(g, 1 / 60);
    expect(p.abilityTime).toBeGreaterThan(0);
    expect(close.statuses.stun?.time).toBeCloseTo(dreadHowlStun(n, 10));
    expect(far.statuses.stun).toBeUndefined();
    expect(boss.statuses.stun).toBeUndefined();
    expect([close, far, boss].every((e) => e.fearT <= 0)).toBe(true);
  });
});
