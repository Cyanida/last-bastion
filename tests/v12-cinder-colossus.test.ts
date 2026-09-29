import { describe, expect, it } from 'vitest';
import { BOSSES, CINDER_COLOSSUS } from '../src/config/bosses';
import { ENEMY_STATUS } from '../src/config/damage';
import { ENEMIES } from '../src/config/enemies';
import { REALMS, WORLD, WORLD_BOSSES } from '../src/config/world';
import type { Enemy, Game } from '../src/core/types';
import { createGame } from '../src/game';
import { actBoss, bossForWave } from '../src/logic/acts';
import { burstsIn, colossusCd, colossusLesson, colossusMove, kindleSeeds, slamFan, spreadNext } from '../src/logic/cinderColossus';
import { bossName, levelBoss } from '../src/logic/world';
import { killEnemy, updateZones } from '../src/systems/combat';
import { updateEnemies } from '../src/systems/enemyAI';
import { spawnEnemy, updateSpawning } from '../src/systems/spawning';
import { runTimer } from '../src/entities/hazards';

/** Start wave `wave` and step spawning until its boss is on the field. */
function bossOf(g: Game, wave: number): Enemy {
  g.wave = wave - 1;
  g.breather = 0.001;
  updateSpawning(g, 0.016);
  for (let i = 0; i < 4000 && !g.enemies.some((e) => e.def.boss); i++) updateSpawning(g, 0.05);
  return g.enemies.find((e) => e.def.boss)!;
}

/** Move him into `phase` as a crown boss does once its time has run: HP under the threshold, the phase's clock long run. */
function toPhase(g: Game, c: Enemy, phase: number): void {
  c.hpFloor = 0;
  c.phaseAt = g.time - WORLD.crownBoss.minPhaseSeconds - 1;
  c.hp = c.maxHp * (1 - (phase - 1) / 3) - 1;
  updateEnemies(g, 0.016);
  expect(c.phase).toBe(phase);
}

/** Run the game's delayed actions that are due within `seconds` (the spreading fire), as the tick does. */
function runTimers(g: Game, seconds: number): void {
  for (const t of g.timers) t.t -= seconds;
  const due = g.timers.filter((t) => t.t <= 0);
  g.timers = g.timers.filter((t) => t.t > 0);
  for (const t of due) runTimer(g, t);
}

const draw = { seed: 7, arena: 'keep' as const, seen: [], quests: [] };

describe('the Cinder Colossus as the Cinderlands crown boss (#228)', () => {
  it('ends the Cinderlands level 5 as its crown boss, three phases, and is never drawn outside it', () => {
    const lv = REALMS.cinderlands.levels[4];
    expect(lv.boss).toEqual({ boss: 'cinderColossus', crown: true });
    expect(levelBoss(lv.boss, lv.waves[1], draw)).toBe('cinderColossus');
    expect(bossName(lv.boss, lv.waves[1])).toBe('The Cinder Colossus');
    expect('cinderColossus' in WORLD_BOSSES).toBe(false); // built now: config/bosses.ts has him
    expect(ENEMIES.cinderColossus.boss).toBe(true);
    expect(ENEMIES.cinderColossus.phases).toBe(WORLD.crownBoss.phases);
    expect(BOSSES.cinderColossus.slot).toBe('realm');
    for (let act = 1; act <= 6; act++) expect(actBoss(act)).not.toBe('cinderColossus');
    for (let w = 5; w <= 40; w += 5) for (let seed = 1; seed < 30; seed++) expect(bossForWave(w, { ...draw, seed })).not.toBe('cinderColossus');
  });

  it('a lesson for each phase: burn stacks, fire that spreads, bursts; his blows by phase', () => {
    expect([1, 2, 3].map(colossusLesson)).toEqual(['burn', 'spread', 'burst']);
    expect(ENEMY_STATUS.cinderColossus).toMatchObject({ id: 'burn', stacks: 2 });
    expect([0, 1, 2].map((n) => colossusMove(1, n))).toEqual(Array(3).fill({ slam: true, kindle: false, brood: false }));
    expect([0, 1].map((n) => colossusMove(2, n))).toEqual([{ slam: false, kindle: true, brood: false }, { slam: true, kindle: false, brood: false }]);
    expect([0, 1, 2, 3].map((n) => colossusMove(3, n).brood)).toEqual([true, false, false, true]);
    expect(colossusMove(3, 0).kindle).toBe(true);
    expect([1, 2, 3].map(colossusCd)).toEqual(CINDER_COLOSSUS.specialCd);
    expect(colossusCd(3)).toBeLessThan(colossusCd(1));
  });

  it('the Slam: a fan of lines from his edge, the middle one at you, landing from the inside out', () => {
    const s = CINDER_COLOSSUS.slam;
    const zones = slamFan(100, 100, 30, 0);
    expect(zones).toHaveLength(s.lines * s.zones);
    const mid = zones.slice(s.zones, 2 * s.zones); // the middle of 3 lines
    for (const z of mid) expect(z.y).toBeCloseTo(100, 6);
    expect(mid[0].x - 130).toBeCloseTo(s.step / 2, 6);
    expect(mid.map((z) => z.delay)).toEqual(mid.map((_, i) => s.first + i * s.gap));
    expect(zones[0].y).toBeLessThan(100); // the outer lines fan out either side
    expect(zones[2 * s.zones].y).toBeGreaterThan(100);
  });

  it('kindling: an ember on you and the rest round you; each fire forks once, then creeps outward to its last patch', () => {
    const k = CINDER_COLOSSUS.kindle;
    const seeds = kindleSeeds(500, 500, 0);
    expect(seeds).toHaveLength(k.seeds);
    expect(seeds[0]).toEqual({ x: 500, y: 500 });
    for (const s of seeds.slice(1)) expect(Math.hypot(s.x - 500, s.y - 500)).toBeCloseTo(k.scatter, 6);
    const first = spreadNext(0, 0, 0, 0);
    expect(first).toHaveLength(2);
    for (const n of first) expect(Math.hypot(n.x, n.y)).toBeCloseTo(k.step, 6);
    expect(first[0].angle).toBeCloseTo(-k.fork / 2, 6);
    expect(spreadNext(0, 0, 0, 1)).toEqual([{ x: k.step, y: 0, angle: 0 }]);
    expect(spreadNext(0, 0, 0, k.gens - 1)).toEqual([]);
    // one seed makes 1 + 2 * (gens - 1) patches in all
    let gen = [{ x: 0, y: 0, angle: 0 }], n = 0;
    for (let g = 0; gen.length; g++) (n += gen.length), (gen = gen.flatMap((p) => spreadNext(p.x, p.y, p.angle, g)));
    expect(n).toBe(1 + 2 * (k.gens - 1));
  });

  it('bursts: only in his burst phase and only within his heat', () => {
    const r = CINDER_COLOSSUS.burst.reach;
    expect(burstsIn(3, 0, 0, r - 1, 0)).toBe(true);
    expect(burstsIn(3, 0, 0, r + 1, 0)).toBe(false);
    expect(burstsIn(2, 0, 0, 10, 0)).toBe(false);
  });

  it('in the Cinderlands level 5 the wave-40 boss is the Cinder Colossus: his hits burn, his fire spreads, foes burst in his heat', () => {
    const g = createGame('paladin', 11, { level: { realm: 'cinderlands', level: 5 } });
    const c = bossOf(g, 40);
    expect(c.def.id).toBe('cinderColossus');
    expect(c.crown).toBe(true);
    expect(g.banner?.text).toBe('The Cinder Colossus · Crown boss');
    g.enemies = [c];
    const p = g.player;
    // phase 1: the Slam; standing on its middle line, its hit burns you
    c.x = p.x + 200;
    c.y = p.y;
    c.special = 0;
    g.zones.length = 0;
    updateEnemies(g, 0.016);
    const mine = g.zones.filter((z) => z.owner === c);
    expect(mine).toHaveLength(CINDER_COLOSSUS.slam.lines * CINDER_COLOSSUS.slam.zones);
    p.invulnerable = false;
    p.iFrames = 0;
    for (const z of mine) z.t = z.delay; // land them all at once
    const hp = p.hp;
    c.x = p.x + 400; // step him back so only his marks touch you
    updateZones(g, 0.001);
    expect(p.hp).toBeLessThan(hp);
    expect(p.statuses.burn?.stacks ?? 0).toBeGreaterThanOrEqual(2);
    // phase 2: the first blow kindles the ground round you, and the fire spreads patch by patch
    toPhase(g, c, 2);
    expect(g.banner?.text).toBe('The Cinder Colossus kindles the ground');
    c.x = p.x + 300;
    c.special = 0;
    g.zones.length = 0;
    g.fields.length = 0;
    updateEnemies(g, 0.016);
    expect(g.zones.filter((z) => z.owner === c)).toHaveLength(CINDER_COLOSSUS.kindle.seeds);
    const k = CINDER_COLOSSUS.kindle;
    runTimers(g, k.delay);
    expect(g.fields.filter((f) => f.hostile)).toHaveLength(k.seeds);
    for (let i = 1; i < k.gens; i++) runTimers(g, k.every);
    expect(g.fields.filter((f) => f.hostile)).toHaveLength(k.seeds * (1 + 2 * (k.gens - 1)));
    expect(g.vars['colossus.patches']).toBe(k.seeds * (1 + 2 * (k.gens - 1)));
    // phase 3: his brood, and a foe that falls in his heat bursts; one outside it does not
    toPhase(g, c, 3);
    expect(g.banner?.text).toBe('The Cinder Colossus erupts');
    c.special = 0;
    updateEnemies(g, 0.016);
    expect(g.enemies.filter((e) => e.def.id === 'cultist')).toHaveLength(ENEMIES.cinderColossus.summonCount!);
    g.zones.length = 0;
    const near = spawnEnemy(g, 'peasant', c.x + 100, c.y);
    const far = spawnEnemy(g, 'peasant', c.x + CINDER_COLOSSUS.burst.reach + 200, c.y);
    killEnemy(g, near);
    killEnemy(g, far);
    const bursts = g.zones.filter((z) => z.owner === c && z.r === CINDER_COLOSSUS.burst.radius);
    expect(bursts).toHaveLength(1);
    expect(bursts[0].x).toBeCloseTo(near.x, 6);
    expect(g.vars['colossus.bursts']).toBe(1);
    // his crown hold: a last-phase blow that runs out of its time holds at 1 HP
    c.phaseAt = g.time;
    updateEnemies(g, 0.016);
    expect(c.hpFloor).toBe(1);
  });
});
