import { describe, expect, it } from 'vitest';
import { FINAL } from '../src/config/acts';
import { BOSS_RESOLVE } from '../src/config/damage';
import type { Game } from '../src/core/types';
import { createGame, updateGame } from '../src/game';
import { damageEnemy, killEnemy } from '../src/systems/combat';
import { spawnEnemy } from '../src/systems/spawning';

const DT = 1 / 60;
const tick = (g: Game, s: number) => {
  for (let i = 0; i < Math.ceil(s / DT); i++) updateGame(g, DT);
};

/** #127: his last phase is a fight: the hold on his HP is short, and he attacks through it. */
describe('the Usurper: the last phase (#127)', () => {
  it('holds only a few seconds, he attacks in them, then a killing blow lands', () => {
    const keep = { ...BOSS_RESOLVE };
    Object.assign(BOSS_RESOLVE, { burst: Infinity, cap: Infinity }); // phases, not resolve
    try {
      const g = createGame('viking', 9, { arena: 'bastion' });
      g.breather = 1e9;
      g.player.invulnT = 1e9;
      g.player.attackTimer = 1e9;
      const u = spawnEnemy(g, FINAL.boss, g.player.x, g.player.y - 300);
      tick(g, FINAL.usurper.minPhase[0] + 0.1);
      damageEnemy(g, u, u.maxHp * 0.4);
      tick(g, 0.1);
      for (const f of g.enemies.filter((e) => e.def.id === 'royalFlame')) killEnemy(g, f);
      tick(g, 0.1);
      damageEnemy(g, u, u.hp - u.maxHp * 0.2); // below a third, whatever his resistances
      tick(g, 0.05);
      expect(u.phase).toBe(3);

      expect(FINAL.usurper.minPhase[2]).toBeLessThanOrEqual(10); // short: not a wait to walk away from
      let attacks = 0;
      for (let t = 0; t < FINAL.usurper.minPhase[2] - 1; t += DT) {
        updateGame(g, DT);
        if (g.zones.some((z) => z.owner === u) || u.telegraph) attacks++;
      }
      damageEnemy(g, u, 1e9);
      expect(u.dead).toBe(false); // still unyielding...
      expect(attacks).toBeGreaterThan(0); // ...and he attacks through it
      tick(g, 1.1);
      damageEnemy(g, u, 1e9);
      expect(u.dead).toBe(true);
    } finally {
      Object.assign(BOSS_RESOLVE, keep);
    }
  });
});
