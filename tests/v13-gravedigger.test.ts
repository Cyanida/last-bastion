import { describe, expect, it } from 'vitest';
import { BOSSES, GRAVEDIGGER } from '../src/config/bosses';
import { ENEMIES } from '../src/config/enemies';
import { GAME } from '../src/config/game';
import { REALMS, WORLD_BOSSES } from '../src/config/world';
import type { Enemy, Game, Grave } from '../src/core/types';
import { createGame } from '../src/game';
import { actBoss, bossForWave } from '../src/logic/acts';
import { diggerCd, diggerMove, digGraves, digZones, riseTime, rotZones, spadeZones, tickGraves } from '../src/logic/gravedigger';
import { bossName, levelBoss } from '../src/logic/world';
import { updateZones } from '../src/systems/combat';
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

const draw = { seed: 7, arena: 'graveyard' as const, seen: [], quests: [] };
const level3 = REALMS.barrowvale.levels[2];

/** The Barrowvale level 3's boss, alone on the field, `d` px right of the champion. */
function digger(d = 200): { g: Game; e: Enemy } {
  const g = createGame('paladin', 11, { level: { realm: 'barrowvale', level: 3 } });
  const e = bossOf(g, level3.waves[1]);
  g.enemies = [e];
  e.x = g.player.x + d;
  e.y = g.player.y;
  g.zones.length = 0;
  g.fields.length = 0;
  return { g, e };
}

describe('the Gravedigger, the Barrowvale level 3 boss (#277)', () => {
  it('ends the Barrowvale level 3, three phases, and is never drawn outside it', () => {
    expect(level3.boss).toEqual({ boss: 'gravedigger' });
    expect(levelBoss('barrowvale', 3)).toBe('gravedigger');
    expect(bossName(level3.boss, level3.waves[1])).toBe('The Gravedigger');
    expect('gravedigger' in WORLD_BOSSES).toBe(false); // built now: config/bosses.ts has him
    expect(ENEMIES.gravedigger).toMatchObject({ boss: true, phases: 3 });
    expect(BOSSES.gravedigger.slot).toBe('realm');
    for (let act = 1; act <= 6; act++) expect(actBoss(act)).not.toBe('gravedigger');
    for (let w = 5; w <= 40; w += 5) for (let seed = 1; seed < 30; seed++) expect(bossForWave(w, { ...draw, seed })).not.toBe('gravedigger');
  });

  it('phase 1 alternates his Digging and his spade; from phase 2 every third blow is his Rot; he strikes quicker each phase', () => {
    expect([0, 1, 2, 3].map((n) => diggerMove(1, n))).toEqual(['dig', 'spade', 'dig', 'spade']);
    expect([0, 1, 2, 3, 4, 5].map((n) => diggerMove(2, n))).toEqual(['dig', 'spade', 'rot', 'dig', 'spade', 'rot']);
    expect([0, 1, 2].map((n) => diggerMove(3, n))).toEqual(['dig', 'spade', 'rot']);
    expect([1, 2, 3].map(diggerCd)).toEqual(GRAVEDIGGER.specialCd);
    expect(diggerCd(9)).toBe(diggerCd(3));
    expect(riseTime(3)).toBeLessThan(riseTime(1));
  });

  it('his Digging: the first clod on you, the rest round you with room between, landing one after another; more each phase', () => {
    const d = GRAVEDIGGER.dig;
    for (const phase of [1, 2, 3]) {
      const z = digZones(300, 200, phase, 0.4);
      expect(z).toHaveLength(d.count[phase - 1]);
      expect([z[0].x, z[0].y]).toEqual([300, 200]);
      for (const s of z.slice(1)) expect(Math.hypot(s.x - 300, s.y - 200)).toBeCloseTo(d.spread, 6);
      expect(z.map((s) => s.delay)).toEqual(z.map((_, i) => d.first + i * d.gap));
      const ring = z.slice(1);
      for (let i = 0; i < ring.length; i++) for (let j = i + 1; j < ring.length; j++) expect(Math.hypot(ring[i].x - ring[j].x, ring[i].y - ring[j].y)).toBeGreaterThan(d.radius * 2 + GAME.playerRadius * 2);
    }
  });

  it('his spade is an arc in front of him; his Rot a line from his edge towards you, landing outward', () => {
    const s = spadeZones(0, 0, 30, 0);
    expect(s).toHaveLength(GRAVEDIGGER.spade.zones);
    for (const z of s) expect(Math.hypot(z.x, z.y)).toBeCloseTo(30 + GRAVEDIGGER.spade.reach, 6);
    expect(s.every((z) => z.x > 0)).toBe(true);
    const r = rotZones(0, 0, 30, Math.PI / 2);
    expect(r).toHaveLength(GRAVEDIGGER.rot.zones);
    r.forEach((z, i) => {
      expect(z.x).toBeCloseTo(0, 6);
      expect(z.y).toBeCloseTo(30 + GRAVEDIGGER.rot.step * (i + 1), 6);
      expect(z.delay).toBeCloseTo(GRAVEDIGGER.rot.delay + i * GRAVEDIGGER.rot.gap, 6);
    });
  });

  it('an open grave opens when its clod lands, is trampled shut by a step, and otherwise rises on time (sooner each phase), or all at once', () => {
    const graves: Grave[] = [];
    digGraves(graves, [{ x: 0, y: 0, delay: 1 }, { x: 200, y: 0, delay: 1 }]);
    expect(graves.map((g) => g.t)).toEqual([-1, -1]);
    // in the air: standing on it does nothing yet
    expect(tickGraves(graves, 0.5, 0, 0, 12, 1)).toEqual({ trampled: [], risen: [] });
    let out = tickGraves(graves, 0.6, 0, 0, 12, 1);
    expect(out.trampled.map((g) => g.x)).toEqual([0]);
    expect(graves).toHaveLength(1);
    out = tickGraves(graves, riseTime(1) - 0.2, 600, 0, 12, 1);
    expect(out.risen).toEqual([]);
    out = tickGraves(graves, 0.15, 600, 0, 12, 1);
    expect(out.risen.map((g) => g.x)).toEqual([200]);
    expect(graves).toHaveLength(0);
    // a new phase: every open grave rises now
    digGraves(graves, [{ x: 0, y: 0, delay: 0 }, { x: 100, y: 0, delay: 0 }]);
    expect(tickGraves(graves, 0.01, 600, 0, 12, 2, true).risen).toHaveLength(2);
    // never more than `max` open
    digGraves(graves, Array.from({ length: GRAVEDIGGER.grave.max + 3 }, (_, i) => ({ x: i * 80, y: 0, delay: 0 })));
    expect(graves).toHaveLength(GRAVEDIGGER.grave.max);
  });

  it('on the field: his Digging digs graves, an untrampled one rises as a plain villager, a trampled one does not', () => {
    const { g, e } = digger();
    e.combo = 0;
    e.special = 0;
    updateEnemies(g, 0.016);
    const n = GRAVEDIGGER.dig.count[0];
    expect(g.zones.filter((z) => z.owner === e)).toHaveLength(n);
    expect(e.graves).toHaveLength(n);
    expect(g.banner?.text).toBe('Graves are dug: trample them');
    // the champion steps off the first clod's spot: no grave is trampled, and they all rise on time
    g.player.x -= 400;
    e.special = 99;
    for (let t = 0; t < riseTime(1) + GRAVEDIGGER.dig.first + 1; t += 0.05) (updateEnemies(g, 0.05), updateZones(g, 0.05));
    const risen = g.enemies.filter((x) => x !== e);
    expect(risen).toHaveLength(n);
    expect(risen.every((x) => x.def.id === GRAVEDIGGER.risen && x.hp <= Math.ceil(x.maxHp * GRAVEDIGGER.risenHp))).toBe(true);
    expect(e.graves).toHaveLength(0);
    // a second Digging, and this time the champion walks over every grave once it opens
    g.enemies = [e];
    e.special = 0;
    updateEnemies(g, 0.016);
    e.special = 99;
    for (let t = 0; t < GRAVEDIGGER.dig.first + n * GRAVEDIGGER.dig.gap + 0.2; t += 0.05) updateEnemies(g, 0.05);
    for (const gr of [...e.graves!]) (g.player.x = gr.x), (g.player.y = gr.y), updateEnemies(g, 0.016);
    expect(e.graves).toHaveLength(0);
    expect(g.enemies.filter((x) => x !== e)).toHaveLength(0);
  });

  it('his Rot leaves plague ground that lasts; each new phase calls every open grave up; from phase 3 a risen grave leaves rot', () => {
    const { g, e } = digger();
    e.phase = e.state = 2;
    e.combo = 2;
    e.special = 0;
    updateEnemies(g, 0.016);
    const rot = g.zones.filter((z) => z.owner === e);
    expect(rot).toHaveLength(GRAVEDIGGER.rot.zones);
    expect(rot.every((z) => z.dtype === 'shadow' && z.leaveField?.apply?.id === 'poison' && z.leaveField.life === ENEMIES.gravedigger.poolLife)).toBe(true);
    expect(ENEMIES.gravedigger.poolLife!).toBeGreaterThan(ENEMIES.abbot.poolLife! * 2); // it lasts
    // open graves, then phase 3: they rise at once, each in a pool of rot
    g.zones.length = 0;
    e.graves = [{ x: g.player.x + 300, y: g.player.y, t: 0.1 }, { x: g.player.x - 300, y: g.player.y, t: 0.1 }];
    e.special = 99;
    e.hp = e.maxHp * 0.3;
    updateEnemies(g, 0.016);
    expect(e.phase).toBe(3);
    expect(g.banner?.text).toBe('The Gravedigger calls up his dead');
    expect(e.graves).toHaveLength(0);
    expect(g.enemies.filter((x) => x.def.id === GRAVEDIGGER.risen)).toHaveLength(2);
    expect(g.fields.filter((f) => f.hostile && f.r === GRAVEDIGGER.spill.radius && f.apply?.id === 'poison')).toHaveLength(2);
    expect(e.crown).toBe(false); // no crown hold: a level-3 boss
    expect(e.hpFloor).toBe(0);
  });
});
