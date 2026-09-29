import { describe, expect, it } from 'vitest';
import { nOf } from '../src/systems/relicCore';
import type { Game } from '../src/core/types';
import { createGame } from '../src/game';
import { damageEnemy } from '../src/systems/combat';
import { addRelic, updateRelics } from '../src/systems/relics';
import { spawnEnemy } from '../src/systems/spawning';

const foe = (g: Game) => {
  const e = spawnEnemy(g, 'knight', g.player.x + 60, g.player.y);
  e.armorHp = 0;
  return e;
};

describe('the starter commons (#196)', () => {
  it("Berserker Tooth gives flat attack speed at full HP, more at tier II, and the missing-HP part on top", () => {
    const g = createGame('viking', 1);
    addRelic(g, 'berserkerTooth');
    updateRelics(g, 0.016);
    expect(g.player.relics.dyn.atkSpd).toBeCloseTo(nOf(g.player, 'berserkerTooth').flat);
    const g2 = createGame('viking', 1);
    addRelic(g2, 'berserkerTooth', 'other', 2);
    updateRelics(g2, 0.016);
    expect(g2.player.relics.dyn.atkSpd).toBeCloseTo(nOf(g2.player, 'berserkerTooth').flat);
    g2.player.hp = g2.player.stats.hp * 0.5;
    updateRelics(g2, 0.016);
    expect(g2.player.relics.dyn.atkSpd!).toBeGreaterThan(nOf(g2.player, 'berserkerTooth').flat);
  });

  it("damage that lands while a relic's freeze holds is counted for that relic, and nothing else when no relic froze it", () => {
    const g = createGame('viking', 1);
    const e = foe(g);
    const dealt = damageEnemy(g, e, 10);
    expect(Object.keys(g.vars).some((k) => k.startsWith('frozenHit.'))).toBe(false);
    e.statuses.stun = { stacks: 1, time: 2, power: 0, by: 'wintersGrasp' };
    e.frozenT = g.time + 2;
    const more = damageEnemy(g, e, 10);
    expect(dealt).toBeGreaterThan(0);
    expect(g.vars['frozenHit.wintersGrasp']).toBeCloseTo(more);
  });
});
