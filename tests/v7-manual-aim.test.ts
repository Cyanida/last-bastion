import { describe, expect, it } from 'vitest';
import type { ClassId } from '../src/config/classes';
import { createGame } from '../src/game';
import { defaultSave, migrate } from '../src/logic/save';
import { updatePlayerAttack } from '../src/systems/combat';
import { spawnEnemy } from '../src/systems/spawning';

/** A near enemy to the east, a farther one to the south, and the aim point to the south. */
function setup(cls: ClassId, manualAim: boolean) {
  const g = createGame(cls, 1);
  const p = g.player;
  const reach = p.cls.attack.range * 0.8;
  const near = spawnEnemy(g, 'peasant', p.x + reach * 0.5, p.y);
  spawnEnemy(g, 'peasant', p.x, p.y + reach);
  for (const e of g.enemies) g.hash.insert(e);
  g.input = { ...g.input, aimX: p.x, aimY: p.y + 300, manualAim };
  p.attackTimer = 0;
  updatePlayerAttack(g, 0);
  return { g, near };
}

describe('manual aiming (v0.7.5, #81)', () => {
  it('with Manual, swings and shots go toward the aim point even when a nearer enemy is elsewhere', () => {
    for (const cls of ['viking', 'archer'] as ClassId[]) {
      const { g } = setup(cls, true);
      expect(g.player.facing).toBeCloseTo(Math.PI / 2, 5);
      if (cls === 'archer') expect(g.projectiles.some((s) => !s.hostile)).toBe(true);
    }
  });

  it('with Auto, the nearest enemy is still the target', () => {
    for (const cls of ['viking', 'archer'] as ClassId[]) {
      const { g, near } = setup(cls, false);
      expect(g.player.facing).toBeCloseTo(Math.atan2(near.y - g.player.y, near.x - g.player.x), 5);
    }
  });

  it('with nothing in reach, Manual holds its fire like Auto', () => {
    const g = createGame('archer', 1);
    g.input = { ...g.input, aimX: g.player.x + 100, aimY: g.player.y, manualAim: true };
    g.player.attackTimer = 0;
    updatePlayerAttack(g, 0);
    expect(g.projectiles).toHaveLength(0);
  });

  it('the setting is saved with the others and defaults to Auto', () => {
    expect(defaultSave().settings.manualAim).toBe(false);
    const save = defaultSave();
    save.settings.manualAim = true;
    expect(migrate(JSON.parse(JSON.stringify(save))).settings.manualAim).toBe(true);
  });
});
