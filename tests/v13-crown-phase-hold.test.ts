import { describe, expect, it } from 'vitest';
import { WORLD } from '../src/config/world';
import type { Enemy, Game } from '../src/core/types';
import { createGame } from '../src/game';
import { crownHpFloor } from '../src/logic/crownBoss';
import { damageEnemy } from '../src/systems/combat';
import { updateEnemies } from '../src/systems/enemyAI';
import { updateSpawning } from '../src/systems/spawning';

/** Start wave `wave` and step spawning until its boss is on the field. */
function bossOf(g: Game, wave: number): Enemy {
  g.wave = wave - 1;
  g.breather = 0.001;
  updateSpawning(g, 0.016);
  for (let i = 0; i < 4000 && !g.enemies.some((e) => e.def.boss); i++) updateSpawning(g, 0.05);
  return g.enemies.find((e) => e.def.boss)!;
}

/** A strong build: a blow of `share` of his max HP every tick until he falls. When each phase began, and his HP then. */
function burst(realm: 'cinderlands' | 'ironHold', share: number): { id: string; crown: boolean; maxHp: number; phases: { at: number; hp: number }[]; fell: number } {
  const g = createGame('paladin', 11, { level: { realm, level: 5 } });
  const c = bossOf(g, g.level!.last);
  const t0 = g.time, dt = 1 / 60;
  const phases = [{ at: 0, hp: c.hp }];
  for (let i = 0; i < 6000 && !c.dead; i++) {
    g.time += dt;
    updateEnemies(g, dt);
    if (c.phase > phases.length) phases.push({ at: g.time - t0, hp: c.hp });
    damageEnemy(g, c, c.maxHp * share);
  }
  return { id: c.def.id, crown: c.crown, maxHp: c.maxHp, phases, fell: c.dead ? g.time - t0 : -1 };
}

describe('a crown boss holds each phase against a burst (#264)', () => {
  const min = WORLD.crownBoss.minPhaseSeconds;

  it('until its time is run, held just above its threshold; then on it, so a burst ends the phase and no more', () => {
    expect(crownHpFloor(1200, 1, 3, 0)).toBe(801);
    expect(crownHpFloor(1200, 1, 3, min - 0.1)).toBe(801);
    expect(crownHpFloor(1200, 1, 3, min)).toBe(800); // the top of phase 2, not the bottom
    expect(crownHpFloor(1200, 2, 3, min - 0.1)).toBe(401);
    expect(crownHpFloor(1200, 2, 3, min)).toBe(400); // the top of phase 3: it is fought through, not stood out at 1 HP
    expect(crownHpFloor(1200, 3, 3, min - 0.1)).toBe(1); // the last phase runs its time before he can fall
    expect(crownHpFloor(1200, 3, 3, min)).toBe(0);
    for (const hp of [1000, 1201, 10264, 11078]) for (const ph of [1, 2]) expect(crownHpFloor(hp, ph, 3, min)).toBeLessThanOrEqual(hp * (1 - ph / 3)); // on it enterPhase (<=) moves on
  });

  for (const [realm, id] of [['cinderlands', 'cinderColossus'], ['ironHold', 'ironKing']] as const) {
    it(`${id}: a blow of a fifth of his HP every tick meets all three phases, each its whole share of the bar and its ${min} s`, () => {
      const f = burst(realm, 0.2);
      expect(f.id).toBe(id);
      expect(f.crown).toBe(true);
      expect(f.phases).toHaveLength(3);
      f.phases.forEach((p, i) => expect(p.hp).toBeGreaterThanOrEqual(Math.floor(f.maxHp * (1 - i / 3)))); // each phase begins at the top of its share
      expect(f.phases[1].at).toBeGreaterThanOrEqual(min);
      expect(f.phases[2].at - f.phases[1].at).toBeGreaterThanOrEqual(min);
      expect(f.fell - f.phases[2].at).toBeGreaterThanOrEqual(min);
      expect(f.fell).toBeLessThan(min * 3 + 1); // ...and no longer than the hold: the burst still ends each phase once its time is run
    });
  }
});
