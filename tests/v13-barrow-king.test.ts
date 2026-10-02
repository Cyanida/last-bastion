import { describe, expect, it } from 'vitest';
import { BARROW_KING, BOSSES } from '../src/config/bosses';
import { ENEMIES } from '../src/config/enemies';
import { REALMS, WORLD, WORLD_BOSSES } from '../src/config/world';
import type { Enemy, Game } from '../src/core/types';
import { createGame } from '../src/game';
import { actBoss, bossForWave } from '../src/logic/acts';
import { barrowCd, barrowLesson, barrowMove, barrowWard, graveSpots, kingGraves, reapZones, trampled } from '../src/logic/barrowKing';
import { bossName, levelBoss } from '../src/logic/world';
import { damageEnemy, updateZones } from '../src/systems/combat';
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

/** His blow now, with the champion `d` px to his left. */
function blow(g: Game, k: Enemy, d = 260): void {
  k.x = g.player.x + d;
  k.y = g.player.y;
  k.special = 0;
  g.zones.length = 0;
  updateEnemies(g, 0.016);
}

const draw = { seed: 7, arena: 'keep' as const, seen: [], quests: [] };

describe('the Barrow King as the Barrowvale crown boss (#278)', () => {
  it('ends the Barrowvale level 5 as its crown boss, three phases, and is never drawn outside it', () => {
    const lv = REALMS.barrowvale.levels[4];
    expect(lv.boss).toEqual({ boss: 'barrowKing', crown: true });
    expect(levelBoss('barrowvale', 5)).toBe('barrowKing');
    expect(bossName(lv.boss, lv.waves[1])).toBe('The Barrow King');
    expect('barrowKing' in WORLD_BOSSES).toBe(false); // built now: config/bosses.ts has him
    expect(ENEMIES.barrowKing.boss).toBe(true);
    expect(ENEMIES.barrowKing.phases).toBe(WORLD.crownBoss.phases);
    expect(BOSSES.barrowKing.slot).toBe('realm');
    for (let act = 1; act <= 6; act++) expect(actBoss(act)).not.toBe('barrowKing');
    for (let w = 5; w <= 40; w += 5) for (let seed = 1; seed < 30; seed++) expect(bossForWave(w, { ...draw, seed })).not.toBe('barrowKing');
  });

  it('a lesson for each phase: the dead rise, plague ground, his guard; his blows by phase', () => {
    expect([1, 2, 3].map(barrowLesson)).toEqual(['rise', 'plague', 'guard']);
    expect([0, 1, 2].map((n) => barrowMove(1, n))).toEqual(Array(3).fill({ graves: 'you', plague: false }));
    expect([0, 1, 2].map((n) => barrowMove(2, n))).toEqual([{ graves: null, plague: true }, { graves: null, plague: false }, { graves: null, plague: true }]);
    expect([0, 1].map((n) => barrowMove(3, n))).toEqual([{ graves: 'him', plague: true }, { graves: null, plague: false }]);
    expect([1, 2, 3].map(barrowCd)).toEqual(BARROW_KING.specialCd);
    expect(barrowCd(3)).toBeLessThan(barrowCd(1));
  });

  it('the Reap: two rows of crescent at you, the far one wider; graves open round a spot, never on it; a step onto one tramples it', () => {
    const R = BARROW_KING.reap;
    const zones = reapZones(100, 100, 30, 0);
    expect(zones).toHaveLength(R.zones + R.zones + 1);
    for (const z of zones) expect(z.x).toBeGreaterThan(100); // all in front of him
    expect(Math.hypot(zones[0].x - 100, zones[0].y - 100)).toBeCloseTo(30 + R.near, 6);
    expect(Math.hypot(zones[R.zones].x - 100, zones[R.zones].y - 100)).toBeCloseTo(30 + R.near + R.step, 6);
    const spots = graveSpots(0, 0, 0, 2, 120);
    expect(spots).toHaveLength(2);
    for (const s of spots) expect(Math.hypot(s.x, s.y)).toBeCloseTo(120, 6);
    expect(trampled(0, 0, BARROW_KING.graves.radius + 10, 0, 12)).toBe(true);
    expect(trampled(0, 0, BARROW_KING.graves.radius + 14, 0, 12)).toBe(false);
    expect(barrowWard(3, 1)).toBeCloseTo(1 - BARROW_KING.guard.reduction, 6);
    expect(barrowWard(3, 0)).toBe(1);
    expect(barrowWard(2, 4)).toBe(1); // his guard is his last lesson only
  });

  it('in the Barrowvale level 5 the wave-40 boss is the Barrow King: graves rise unless trampled, plague lasts, his guard turns blows', () => {
    const g = createGame('paladin', 11, { level: { realm: 'barrowvale', level: 5 } });
    const k = bossOf(g, 40);
    expect(k.def.id).toBe('barrowKing');
    expect(k.crown).toBe(true);
    expect(g.banner?.text).toBe('The Barrow King · Crown boss');
    g.enemies = [k];
    const p = g.player;
    const G = BARROW_KING.graves;
    // phase 1: the Reap and graves round you; trample one, the other rises
    blow(g, k);
    expect(g.zones.filter((z) => z.owner === k)).toHaveLength(2 * BARROW_KING.reap.zones + 1);
    const graves = kingGraves.get(k)!;
    expect(graves).toHaveLength(G.count);
    for (const gr of graves) expect(Math.hypot(gr.x - p.x, gr.y - p.y)).toBeCloseTo(G.dist, 6);
    k.x = p.x + 600; // out of reach: no new blow while the graves run their time
    k.special = 99;
    p.x = graves[0].x;
    p.y = graves[0].y;
    updateEnemies(g, 0.016);
    expect(g.vars['barrow.trampled']).toBe(1);
    p.x -= 400; // off the other grave
    for (let t = 0; t < G.rise + 0.1; t += 0.05) updateEnemies(g, 0.05);
    expect(g.vars['barrow.risen']).toBe(1);
    expect(kingGraves.get(k)).toHaveLength(0);
    expect(g.enemies.filter((e) => !e.dead && !e.def.boss)).toHaveLength(1);
    // phase 2: no more graves round you; the first Reap leaves plague ground that lasts
    g.enemies = [k];
    toPhase(g, k, 2);
    expect(g.banner?.text).toBe('The Barrow King spreads the plague');
    g.fields.length = 0;
    blow(g, k);
    expect(kingGraves.get(k)).toHaveLength(0);
    const marks = g.zones.filter((z) => z.owner === k);
    expect(marks.every((z) => z.leaveField?.life === BARROW_KING.plague.life)).toBe(true);
    for (const z of marks) z.t = z.delay;
    updateZones(g, 0.001);
    expect(g.fields.filter((f) => f.hostile)).toHaveLength(marks.length);
    expect(g.fields[0].apply?.id).toBe('poison');
    // phase 3: graves open round him; while one of his risen stands near him, a blow does him less
    toPhase(g, k, 3);
    expect(g.banner?.text).toBe('The Barrow King calls his guard');
    blow(g, k);
    const round = kingGraves.get(k)!;
    expect(round).toHaveLength(BARROW_KING.guard.count);
    for (const gr of round) expect(Math.hypot(gr.x - k.x, gr.y - k.y)).toBeCloseTo(BARROW_KING.guard.dist, 6);
    k.special = 99;
    p.x = k.x - 500; // well clear of the graves at his feet
    for (let t = 0; t < G.rise + 0.1; t += 0.05) updateEnemies(g, 0.05);
    expect(g.vars['barrow.guards']).toBeGreaterThan(0);
    k.hpFloor = 0;
    k.resolve = 0;
    const guarded = damageEnemy(g, k, 10, false, 0, 0, 'hazard');
    for (const e of g.enemies) if (!e.def.boss) e.dead = true;
    updateEnemies(g, 0.016);
    expect(g.vars['barrow.guards']).toBe(0);
    k.flash = 0;
    k.resolve = 0;
    const open = damageEnemy(g, k, 10, false, 0, 0, 'hazard');
    expect(guarded).toBeCloseTo(open * (1 - BARROW_KING.guard.reduction), 6);
    // his crown hold: a last-phase blow that runs out of its time holds at 1 HP
    k.phaseAt = g.time;
    updateEnemies(g, 0.016);
    expect(k.hpFloor).toBe(1);
  });
});
