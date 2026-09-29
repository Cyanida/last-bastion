import { describe, expect, it } from 'vitest';
import { BOSSES, IRON_KING } from '../src/config/bosses';
import { PLATES, THORNS, TOWER_SHIELDS } from '../src/config/damage';
import { ENEMIES } from '../src/config/enemies';
import { REALMS, WORLD, WORLD_BOSSES } from '../src/config/world';
import type { Enemy, Game } from '../src/core/types';
import { createGame } from '../src/game';
import { actBoss, bossForWave } from '../src/logic/acts';
import { decreeZones, kingCd, kingGuard, kingMove, platesOf, thornsOf, towerShieldOf } from '../src/logic/ironKing';
import { bossName, levelBoss } from '../src/logic/world';
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

/** Move him into `phase` as a crown boss does once its time has run: HP under the threshold, the phase's clock long run. */
function toPhase(g: Game, k: Enemy, phase: number): void {
  k.hpFloor = 0;
  k.phaseAt = g.time - WORLD.crownBoss.minPhaseSeconds - 1;
  k.hp = k.maxHp * (1 - (phase - 1) / 3) - 1;
  updateEnemies(g, 0.016);
  expect(k.phase).toBe(phase);
}

const draw = { seed: 7, arena: 'keep' as const, seen: [], quests: [] };

describe('the Iron King as the Iron Hold crown boss (#216)', () => {
  it('ends the Iron Hold level 5 as its crown boss, three phases, and is never drawn outside it', () => {
    const lv = REALMS.ironHold.levels[4];
    expect(lv.boss).toEqual({ boss: 'ironKing', crown: true });
    expect(levelBoss(lv.boss, lv.waves[1], draw)).toBe('ironKing');
    expect(bossName(lv.boss, lv.waves[1])).toBe('The Iron King');
    expect('ironKing' in WORLD_BOSSES).toBe(false); // built now: config/bosses.ts has him
    expect(ENEMIES.ironKing.boss).toBe(true);
    expect(ENEMIES.ironKing.phases).toBe(WORLD.crownBoss.phases);
    expect(BOSSES.ironKing.slot).toBe('realm');
    for (let act = 1; act <= 6; act++) expect(actBoss(act)).not.toBe('ironKing');
    for (let w = 5; w <= 40; w += 5) for (let seed = 1; seed < 30; seed++) expect(bossForWave(w, { ...draw, seed })).not.toBe('ironKing');
  });

  it('a guard for each phase: his plate, then his tower shield, then his thorns; other foes keep theirs always', () => {
    expect([1, 2, 3].map(kingGuard)).toEqual(['plate', 'shield', 'thorns']);
    expect([1, 2, 3].map((ph) => [!!platesOf('ironKing', ph), !!towerShieldOf('ironKing', ph), !!thornsOf('ironKing', ph)])).toEqual([
      [true, false, false],
      [false, true, false],
      [false, false, true],
    ]);
    expect(towerShieldOf('ironKing', 2)).toBe(TOWER_SHIELDS.ironKing);
    expect(thornsOf('ironKing', 3)).toBe(THORNS.ironKing);
    for (const ph of [1, 2, 3]) {
      expect(towerShieldOf('ironShieldwall', ph)).toBe(TOWER_SHIELDS.ironShieldwall);
      expect(thornsOf('thornBearer', ph)).toBe(THORNS.thornBearer);
      expect(platesOf('ironKnight', ph)).toBe(PLATES.ironKnight);
    }
    // a king turns slower than a shieldwall; his thorns bite smaller and slower than a thorn bearer's
    expect(TOWER_SHIELDS.ironKing!.turn).toBeLessThan(TOWER_SHIELDS.ironShieldwall!.turn);
    expect(THORNS.ironKing!.cap).toBeLessThan(THORNS.thornBearer!.cap);
    expect(THORNS.ironKing!.cd).toBeGreaterThan(THORNS.thornBearer!.cd);
  });

  it('his blows: the Decree, with his guard every 3rd blow in phase 1; from phase 2 every other blow a rush; phase 3 a star of 8 lines', () => {
    expect([0, 1, 2, 3].map((n) => kingMove(1, n))).toEqual([
      { decree: 4, rush: false, guard: true },
      { decree: 4, rush: false, guard: false },
      { decree: 4, rush: false, guard: false },
      { decree: 4, rush: false, guard: true },
    ]);
    expect([0, 1].map((n) => kingMove(2, n))).toEqual([{ decree: 4, rush: false, guard: false }, { decree: 0, rush: true, guard: false }]);
    expect([0, 1].map((n) => kingMove(3, n))).toEqual([{ decree: 8, rush: false, guard: false }, { decree: 0, rush: true, guard: false }]);
    expect([1, 2, 3].map(kingCd)).toEqual(IRON_KING.specialCd);
    expect(kingCd(3)).toBeLessThan(kingCd(1));
  });

  it('the Decree: lines from his edge outward, the first straight at you, landing from the inside out', () => {
    const d = IRON_KING.decree;
    const zones = decreeZones(100, 100, 30, 0, 4);
    expect(zones).toHaveLength(4 * d.zones);
    const first = zones.slice(0, d.zones);
    for (const z of first) expect(z.y).toBeCloseTo(100, 6); // the line at you (to the right)
    expect(first[0].x - 100 - 30).toBeCloseTo(d.step / 2, 6); // it starts at his edge
    expect(first.map((z) => z.delay)).toEqual(first.map((_, i) => d.first + i * d.gap));
    expect(zones[d.zones].x).toBeCloseTo(100, 6); // the next line a quarter turn round
    expect(decreeZones(0, 0, 30, 0, 8)).toHaveLength(8 * d.zones);
  });

  it('in the Iron Hold level 5 the wave-40 boss is the Iron King, a crown boss: plated, then shielded, then thorned', () => {
    const g = createGame('paladin', 11, { level: { realm: 'ironHold', level: 5 } });
    const k = bossOf(g, 40);
    expect(k.def.id).toBe('ironKing');
    expect(k.crown).toBe(true);
    expect(g.banner?.text).toBe('The Iron King · Crown boss');
    const plates = PLATES.ironKing!.plates;
    expect([k.armorHp, k.armorMax]).toEqual([plates, plates]);
    const small = k.maxHp * 0.01;
    let hp = k.hp;
    damageEnemy(g, k, small, false, -60, 0);
    expect(k.armorHp).toBe(plates - 1);
    expect(hp - k.hp).toBeLessThan(small); // dulled by the plate
    // phase 2: the plate is cast off, the shield is up: a blow at his front is turned, one at his back lands
    k.x = g.player.x + 200;
    k.y = g.player.y;
    toPhase(g, k, 2);
    expect(k.armorHp).toBe(0);
    expect(g.banner?.text).toBe('The Iron King raises his shield');
    k.angle = 0; // facing right
    k.resolve = 0;
    hp = k.hp;
    damageEnemy(g, k, small, false, -60, 0); // travelling left: into his face
    const front = hp - k.hp;
    expect(front).toBeCloseTo(small * (1 - TOWER_SHIELDS.ironKing!.reduction), 3);
    hp = k.hp;
    damageEnemy(g, k, small, false, 60, 0); // travelling right: into his back
    expect(hp - k.hp).toBeCloseTo(small, 3);
    // phase 3: the shield is down, the thorns are out: a blow struck beside him bites the champion
    toPhase(g, k, 3);
    expect(g.banner?.text).toBe('The Iron King’s thorns');
    hp = k.hp;
    damageEnemy(g, k, small, false, -60, 0);
    expect(hp - k.hp).toBeCloseTo(small, 3); // the front is open now
    k.x = g.player.x + k.r + 20;
    const php = g.player.hp;
    damageEnemy(g, k, small, false, -60, 0, 'attack');
    expect(g.player.hp).toBeLessThan(php);
    expect(g.vars['thorns.bites']).toBe(1);
    // his crown hold: a last-phase blow that runs out of its time holds at 1 HP
    k.phaseAt = g.time;
    updateEnemies(g, 0.016);
    expect(k.hpFloor).toBe(1);
  });

  it('his blows reach the field: the Decree and his guard, then a telegraphed rush', () => {
    const g = createGame('paladin', 11, { level: { realm: 'ironHold', level: 5 } });
    const k = bossOf(g, 40);
    g.enemies = [k];
    k.x = g.player.x + 250;
    k.y = g.player.y;
    k.special = 0;
    g.zones.length = 0;
    updateEnemies(g, 0.016);
    expect(g.zones.filter((z) => z.owner === k)).toHaveLength(4 * IRON_KING.decree.zones);
    expect(g.enemies.filter((e) => e.def.id === 'ironKnight')).toHaveLength(ENEMIES.ironKing.summonCount!); // his guard, on the first blow
    g.enemies = [k];
    toPhase(g, k, 2);
    g.zones.length = 0;
    k.special = 0;
    k.combo = 1; // the rush's turn
    updateEnemies(g, 0.016);
    expect(k.telegraph).not.toBeNull();
    expect(k.state).toBe(1);
    const x0 = k.x;
    for (let i = 0; i < 60; i++) updateEnemies(g, 0.03);
    expect(k.state).toBe(0); // wound up, rushed, done
    expect(x0 - k.x).toBeGreaterThan(ENEMIES.ironKing.chargeDist! * 0.8); // straight at where you stood
  });
});
