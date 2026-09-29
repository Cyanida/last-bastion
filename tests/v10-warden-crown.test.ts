import { describe, expect, it } from 'vitest';
import { WARDEN } from '../src/config/bosses';
import { ENEMIES } from '../src/config/enemies';
import { REALMS, WORLD } from '../src/config/world';
import type { Enemy, Game } from '../src/core/types';
import { createGame } from '../src/game';
import { crownHpFloor, hammerZones, isCrownFight, wardenMove, wardenSpecialCd } from '../src/logic/crownBoss';
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

describe('the crown boss rules (#202)', () => {
  it('only the Marches level 7 is a crown fight there: the Warden', () => {
    expect(REALMS.marches.levels.map((l) => isCrownFight(l.boss))).toEqual([false, false, false, false, false, false, true]);
    expect(REALMS.marches.levels[6].boss.boss).toBe('warden');
    expect(ENEMIES.warden.phases).toBe(WORLD.crownBoss.phases);
  });

  it('no blow carries a crown boss through a phase: held above its threshold until its time is run, then above the next one', () => {
    const min = WORLD.crownBoss.minPhaseSeconds;
    expect(crownHpFloor(900, 1, 3, 0)).toBe(601);
    expect(crownHpFloor(900, 1, 3, min)).toBe(301); // a burst lands in phase 2 and starts its clock
    expect(crownHpFloor(900, 2, 3, min - 0.1)).toBe(301);
    expect(crownHpFloor(900, 2, 3, min)).toBe(1); // phase 3 must still run its time
    expect(crownHpFloor(900, 3, 3, 5)).toBe(1);
    expect(crownHpFloor(900, 3, 3, min)).toBe(0);
    expect(crownHpFloor(1000, 1, 3, 0)).toBeGreaterThan(1000 * (2 / 3)); // never on the threshold itself (enterPhase uses <=)
  });
});

describe("the Warden's third phase as the crown boss (#202)", () => {
  it('outside the crown he seals as before: gaps by phase, hands from phase 2, the closing circle and knights in phase 3', () => {
    expect([1, 2, 3].map((p) => wardenMove(p, false, 0))).toEqual([
      { gaps: 3, inner: false, sweep: false, close: false, hammer: false, summon: false },
      { gaps: 2, inner: false, sweep: true, close: false, hammer: false, summon: false },
      { gaps: 2, inner: false, sweep: true, close: true, hammer: false, summon: true },
    ]);
    expect(wardenMove(2, true, 0)).toEqual(wardenMove(2, false, 0)); // the crown changes only his third phase
    expect(wardenSpecialCd(7.5, 3, false)).toBe(7.5);
  });

  it("the crown's Judgement: a ring inside the ring and his hammer, quicker seals, knights every other seal", () => {
    const moves = [0, 1, 2, 3].map((n) => wardenMove(3, true, n));
    expect(moves.every((m) => m.inner && m.hammer && !m.sweep && !m.close)).toBe(true);
    expect(moves.map((m) => m.summon)).toEqual([true, false, true, false]);
    expect(wardenSpecialCd(7.5, 3, true)).toBe(WARDEN.crown.specialCd);
    expect(wardenSpecialCd(7.5, 2, true)).toBe(7.5);
    expect(WARDEN.crown.inner.radius).toBeLessThan(WARDEN.seal.radius - WARDEN.stone.radius * 2); // room to walk between the rings
  });

  it('the hammer rolls out ring after ring from where he stands', () => {
    const h = WARDEN.crown.hammer;
    const zones = hammerZones(100, 200, 0);
    const delays = [...new Set(zones.map((z) => z.delay))];
    expect(delays).toEqual(Array.from({ length: h.rings }, (_, k) => h.first + k * h.gap));
    for (const z of zones) {
      const k = Math.round(Math.hypot(z.x - 100, z.y - 200) / h.step);
      expect(Math.hypot(z.x - 100, z.y - 200)).toBeCloseTo(k * h.step, 6);
      expect(z.delay).toBeCloseTo(h.first + (k - 1) * h.gap, 6);
    }
    // neighbouring zones on a ring overlap: no safe spot between them
    const outer = zones.filter((z) => z.delay === delays[delays.length - 1]);
    expect(Math.hypot(outer[0].x - outer[1].x, outer[0].y - outer[1].y)).toBeLessThan(h.radius * 2);
  });

  it('in the Marches level 7 the wave-40 Warden is the crown boss and each phase runs its minimum time', () => {
    const g = createGame('paladin', 11, { level: { realm: 'marches', level: 7 } });
    const w = bossOf(g, 40);
    expect(w.def.id).toBe('warden');
    expect(w.crown).toBe(true);
    // a huge blow at once: he holds just above phase 2's threshold
    damageEnemy(g, w, w.maxHp * 10);
    updateEnemies(g, 0.016);
    damageEnemy(g, w, w.maxHp * 10);
    expect(w.phase).toBe(1);
    expect(w.hp).toBeGreaterThan(w.maxHp * (2 / 3));
    // once the phase has run its time, the next blow lands in phase 2, but not past it
    g.time += WORLD.crownBoss.minPhaseSeconds;
    updateEnemies(g, 0.016);
    damageEnemy(g, w, w.maxHp * 10);
    updateEnemies(g, 0.016);
    expect(w.phase).toBe(2);
    expect(w.hp).toBeGreaterThan(w.maxHp / 3);
    // the third phase: the Judgement begins, and he cannot fall until it has run its time
    g.time += WORLD.crownBoss.minPhaseSeconds;
    updateEnemies(g, 0.016);
    damageEnemy(g, w, w.maxHp * 10);
    updateEnemies(g, 0.016);
    expect(w.phase).toBe(3);
    expect(w.state).toBe(3);
    expect(g.banner?.text).toBe('The Warden’s judgement');
    damageEnemy(g, w, w.maxHp * 10);
    expect(w.hp).toBe(1);
    expect(w.dead).toBe(false);
    g.time += WORLD.crownBoss.minPhaseSeconds;
    updateEnemies(g, 0.016);
    expect(w.hpFloor).toBe(0);
  });

  it('the same Warden ending Act II of a plain run is no crown boss', () => {
    const g = createGame('paladin', 11);
    const w = bossOf(g, 20);
    expect(w.def.id).toBe('warden');
    expect(w.crown).toBe(false);
    updateEnemies(g, 0.016);
    expect(w.hpFloor).toBe(0); // nothing holds his HP
    expect(wardenMove(3, w.crown, 0).close).toBe(true); // and his third phase stays the Act boss's
  });
});
