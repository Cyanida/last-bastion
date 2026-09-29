import { describe, expect, it } from 'vitest';
import { BOSSES, EMBER_QUEEN } from '../src/config/bosses';
import { ENEMIES } from '../src/config/enemies';
import { GAME } from '../src/config/game';
import { REALMS, WORLD_BOSSES } from '../src/config/world';
import type { Enemy, Game } from '../src/core/types';
import { createGame } from '../src/game';
import { actBoss, bossForWave } from '../src/logic/acts';
import { flareZones, kindleZones, queenCd, queenMove } from '../src/logic/emberQueen';
import { bossName, levelBoss } from '../src/logic/world';
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

const draw = { seed: 7, arena: 'keep' as const, seen: [], quests: [] };

describe('the Ember Queen as the Cinderlands level 3 boss (#227)', () => {
  it('ends the Cinderlands level 3, three phases, and is never drawn outside it', () => {
    const lv = REALMS.cinderlands.levels[2];
    expect(lv.boss).toEqual({ boss: 'emberQueen' });
    expect(levelBoss(lv.boss, lv.waves[1], draw)).toBe('emberQueen');
    expect(bossName(lv.boss, lv.waves[1])).toBe('The Ember Queen');
    expect('emberQueen' in WORLD_BOSSES).toBe(false); // built now: config/bosses.ts has her
    expect(ENEMIES.emberQueen.boss).toBe(true);
    expect(ENEMIES.emberQueen.phases).toBe(3);
    expect(BOSSES.emberQueen.slot).toBe('realm');
    for (let act = 1; act <= 6; act++) expect(actBoss(act)).not.toBe('emberQueen');
    for (let w = 5; w <= 40; w += 5) for (let seed = 1; seed < 30; seed++) expect(bossForWave(w, { ...draw, seed })).not.toBe('emberQueen');
  });

  it('phase 1 alternates Kindling and the Ember volley; from phase 2 every third blow is her Flare; she casts quicker each phase', () => {
    expect([0, 1, 2, 3].map((n) => queenMove(1, n))).toEqual(['kindle', 'volley', 'kindle', 'volley']);
    expect([0, 1, 2, 3, 4, 5].map((n) => queenMove(2, n))).toEqual(['kindle', 'volley', 'flare', 'kindle', 'volley', 'flare']);
    expect([0, 1, 2].map((n) => queenMove(3, n))).toEqual(['kindle', 'volley', 'flare']);
    expect([1, 2, 3].map(queenCd)).toEqual(EMBER_QUEEN.specialCd);
    expect(queenCd(3)).toBeLessThan(queenCd(1));
    expect(queenCd(9)).toBe(queenCd(3));
  });

  it('the Kindling: the first spot on you, the rest round you, bursting one after another; more spots each phase', () => {
    const k = EMBER_QUEEN.kindle;
    for (const phase of [1, 2, 3]) {
      const z = kindleZones(300, 200, phase, 0.4);
      expect(z).toHaveLength(k.count[phase - 1]);
      expect([z[0].x, z[0].y]).toEqual([300, 200]);
      for (const s of z.slice(1)) expect(Math.hypot(s.x - 300, s.y - 200)).toBeCloseTo(k.spread, 6);
      expect(z.map((s) => s.delay)).toEqual(z.map((_, i) => k.first + i * k.gap));
      // the spots round you are spread out, with room to stand between them
      const ring = z.slice(1);
      for (let i = 0; i < ring.length; i++) for (let j = i + 1; j < ring.length; j++) expect(Math.hypot(ring[i].x - ring[j].x, ring[i].y - ring[j].y)).toBeGreaterThan(k.radius * 2 + GAME.playerRadius * 2);
    }
  });

  it('the Flare: closed rings of fire round her, the near ring first', () => {
    const f = EMBER_QUEEN.flare;
    const zones = flareZones(0, 0, 28, 3);
    const rings = f.rings[2];
    expect(new Set(zones.map((z) => z.ring)).size).toBe(rings);
    for (let r = 0; r < rings; r++) {
      const ring = zones.filter((z) => z.ring === r);
      for (const z of ring) expect(Math.hypot(z.x, z.y)).toBeCloseTo(28 + f.step * (r + 1), 6);
      expect(ring.every((z) => z.delay === f.first + r * f.gap)).toBe(true);
      // no gap to slip through: neighbouring zones overlap
      expect(Math.hypot(ring[0].x - ring[1].x, ring[0].y - ring[1].y)).toBeLessThan(f.radius * 2);
    }
    expect(flareZones(0, 0, 28, 2).filter((z) => z.ring === 0)).toEqual(zones.filter((z) => z.ring === 0));
    // standing at her side is clear of the near ring
    expect(28 + f.step - f.radius).toBeGreaterThan(28 + GAME.playerRadius * 2);
  });

  it('in the Cinderlands level 3 the wave-20 boss is the Ember Queen; she flares up at each new phase, and burns her path in phase 3', () => {
    const g = createGame('paladin', 11, { level: { realm: 'cinderlands', level: 3 } });
    const q = bossOf(g, 20);
    expect(q.def.id).toBe('emberQueen');
    g.enemies = [q];
    q.special = 99;
    q.hp = q.maxHp * 0.6;
    g.zones.length = 0;
    updateEnemies(g, 0.016);
    expect(q.phase).toBe(2);
    expect(g.banner?.text).toBe('The Ember Queen flares up');
    expect(g.zones.filter((z) => z.owner === q)).toHaveLength(flareZones(0, 0, q.r, 2).length);
    expect(q.crown).toBe(false); // no crown hold: a level-3 boss
    expect(q.hpFloor).toBe(0);
    // no trail before phase 3
    g.fields.length = 0;
    for (let i = 0; i < 60; i++) updateEnemies(g, 0.016);
    expect(g.fields.filter((f) => f.hostile)).toHaveLength(0);
    q.hp = q.maxHp * 0.3;
    updateEnemies(g, 0.016);
    expect(q.phase).toBe(3);
    for (let i = 0; i < 60; i++) updateEnemies(g, 0.016);
    const trail = g.fields.filter((f) => f.hostile && f.r === EMBER_QUEEN.trail.radius);
    expect(trail.length).toBeGreaterThanOrEqual(2);
    expect(trail.every((f) => f.dtype === 'fire' && f.apply?.id === 'burn')).toBe(true);
  });

  it('her blows reach the field: the Kindling leaves burning ground, the volley aims, the Flare rings her', () => {
    const g = createGame('paladin', 11, { level: { realm: 'cinderlands', level: 3 } });
    const q = bossOf(g, 20);
    g.enemies = [q];
    q.x = g.player.x + 200;
    q.y = g.player.y;
    q.phase = q.state = 2;
    q.combo = 0;
    q.special = 0;
    g.zones.length = 0;
    updateEnemies(g, 0.016);
    const kindled = g.zones.filter((z) => z.owner === q);
    expect(kindled).toHaveLength(EMBER_QUEEN.kindle.count[1]);
    expect(kindled.every((z) => z.dtype === 'fire' && z.leaveField?.apply?.id === 'burn')).toBe(true);
    expect(g.banner?.text).toBe('The ground is kindled');
    q.special = 0;
    updateEnemies(g, 0.016);
    expect(q.telegraph).not.toBeNull(); // the volley's aim lines
    g.zones.length = 0;
    q.special = 0;
    updateEnemies(g, 0.016);
    expect(g.zones.filter((z) => z.owner === q)).toHaveLength(flareZones(0, 0, q.r, 2).length);
  });

  it('a plain run still ends Act II on the Warden', () => {
    const g = createGame('paladin', 11);
    expect(bossOf(g, 20).def.id).toBe('warden');
  });
});
