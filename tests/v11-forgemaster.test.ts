import { describe, expect, it } from 'vitest';
import { BOSSES, FORGEMASTER } from '../src/config/bosses';
import { PLATES } from '../src/config/damage';
import { GAME } from '../src/config/game';
import { ENEMIES } from '../src/config/enemies';
import { REALMS, WORLD_BOSSES } from '../src/config/world';
import type { Enemy, Game } from '../src/core/types';
import { createGame } from '../src/game';
import { actBoss, bossForWave } from '../src/logic/acts';
import { forgeCd, forgeMove, pressTiles, slamZones } from '../src/logic/forgemaster';
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

const draw = { seed: 7, arena: 'keep' as const, seen: [], quests: [] };

describe('the Forgemaster as the Iron Hold level 3 boss (#215)', () => {
  it('ends the Iron Hold level 3, three phases, and is never drawn outside it', () => {
    const lv = REALMS.ironHold.levels[2];
    expect(lv.boss).toEqual({ boss: 'forgemaster' });
    expect(levelBoss(lv.boss, lv.waves[1], draw)).toBe('forgemaster');
    expect(bossName(lv.boss, lv.waves[1])).toBe('The Forgemaster');
    expect('forgemaster' in WORLD_BOSSES).toBe(false); // built now: config/bosses.ts has him
    expect(ENEMIES.forgemaster.boss).toBe(true);
    expect(ENEMIES.forgemaster.phases).toBe(3);
    expect(BOSSES.forgemaster.slot).toBe('realm');
    for (let act = 1; act <= 6; act++) expect(actBoss(act)).not.toBe('forgemaster');
    for (let w = 5; w <= 40; w += 5) for (let seed = 1; seed < 30; seed++) expect(bossForWave(w, { ...draw, seed })).not.toBe('forgemaster');
  });

  it('phase 1 swings the hammer; from phase 2 every other blow is the presses, and the hammer throws sparks; phase 3 adds slag and a stroke', () => {
    expect([0, 1, 2].map((n) => forgeMove(1, n))).toEqual(Array(3).fill({ slam: true, sparks: false, slag: false, strokes: 0 }));
    expect([0, 1, 2, 3].map((n) => forgeMove(2, n))).toEqual([
      { slam: true, sparks: true, slag: false, strokes: 0 },
      { slam: false, sparks: false, slag: false, strokes: 2 },
      { slam: true, sparks: true, slag: false, strokes: 0 },
      { slam: false, sparks: false, slag: false, strokes: 2 },
    ]);
    expect(forgeMove(3, 0)).toEqual({ slam: true, sparks: true, slag: true, strokes: 0 });
    expect(forgeMove(3, 1).strokes).toBe(3);
    expect([1, 2, 3].map(forgeCd)).toEqual(FORGEMASTER.specialCd);
    expect(forgeCd(3)).toBeLessThan(forgeCd(1));
  });

  it('the hammer lands on an arc in front of him, past his edge', () => {
    const s = FORGEMASTER.slam;
    const zones = slamZones(100, 100, 30, 0);
    expect(zones).toHaveLength(s.zones);
    for (const z of zones) {
      expect(Math.hypot(z.x - 100, z.y - 100)).toBeCloseTo(30 + s.reach, 6);
      expect(z.x).toBeGreaterThan(100); // all in front (facing right)
    }
    expect(zones[Math.floor(s.zones / 2)].y).toBeCloseTo(100, 6); // centred on his aim
  });

  it('the presses: a checkerboard round you, the first stroke on your tile, each next one on the tiles beside it', () => {
    const p = FORGEMASTER.press;
    const tiles = pressTiles(500, 400, 3);
    const stroke = (k: number) => tiles.filter((t) => t.stroke === k);
    expect(stroke(0).length + stroke(1).length).toBe(p.size * p.size);
    expect(stroke(0).some((t) => t.x === 500 && t.y === 400)).toBe(true); // where you stand is struck first
    expect(stroke(1).some((t) => t.x === 500 && t.y === 400)).toBe(false);
    expect(stroke(2)).toEqual(stroke(0).map((t) => ({ ...t, stroke: 2, delay: p.first + 2 * p.gap })));
    expect(stroke(1).every((t) => t.delay === p.first + p.gap)).toBe(true);
    // a tile's centre is clear of every zone of the other colour: somewhere safe to stand, one step away
    for (const a of stroke(1)) for (const b of stroke(0)) expect(Math.hypot(a.x - b.x, a.y - b.y) - p.radius).toBeGreaterThan(GAME.playerRadius * 2);
    // and the tiles of one stroke cover the ground between them (edge to edge along a row, with the other colour's)
    expect(p.radius * 2).toBeGreaterThan(p.cell);
    expect(pressTiles(0, 0, 0)).toEqual([]);
  });

  it('in the Iron Hold level 3 the wave-20 boss is the Forgemaster; his plate breaks blow by blow and is reforged whole at each phase', () => {
    const g = createGame('paladin', 11, { level: { realm: 'ironHold', level: 3 } });
    const f = bossOf(g, 20);
    expect(f.def.id).toBe('forgemaster');
    const plates = PLATES.forgemaster!.plates;
    expect([f.armorHp, f.armorMax]).toEqual([plates, plates]);
    // a plated blow is dulled and takes one plate
    const hp = f.hp;
    const small = f.maxHp * 0.01;
    damageEnemy(g, f, small);
    expect(f.armorHp).toBe(plates - 1);
    expect(hp - f.hp).toBeLessThan(small);
    // phase 2: plate reforged whole
    for (let i = 0; i < plates; i++) damageEnemy(g, f, small);
    expect(f.armorHp).toBe(0);
    f.hp = f.maxHp * 0.6;
    updateEnemies(g, 0.016);
    expect(f.phase).toBe(2);
    expect(f.armorHp).toBe(plates);
    expect(g.banner?.text).toBe('The Forgemaster reforges his plate');
    f.armorHp = 0;
    f.hp = f.maxHp * 0.3;
    updateEnemies(g, 0.016);
    expect(f.phase).toBe(3);
    expect(f.armorHp).toBe(plates);
    expect(f.crown).toBe(false); // no crown hold: a level-3 boss
    expect(f.hpFloor).toBe(0);
  });

  it('his blows reach the field: the hammer zones, then the presses', () => {
    const g = createGame('paladin', 11, { level: { realm: 'ironHold', level: 3 } });
    const f = bossOf(g, 20);
    g.enemies = [f];
    f.x = g.player.x + 150;
    f.y = g.player.y;
    f.phase = f.state = 2; // phase 2, plate already reforged
    f.special = 0;
    g.zones.length = 0;
    updateEnemies(g, 0.016);
    expect(g.zones.filter((z) => z.owner === f)).toHaveLength(FORGEMASTER.slam.zones);
    expect(f.telegraph).not.toBeNull(); // the sparks' aim lines
    g.zones.length = 0;
    f.special = 0;
    updateEnemies(g, 0.016);
    expect(g.zones).toHaveLength(pressTiles(0, 0, 2).length);
    expect(g.banner?.text).toBe('The presses fall');
  });

  it('a plain run still ends Act II on the Warden', () => {
    const g = createGame('paladin', 11);
    expect(bossOf(g, 20).def.id).toBe('warden');
  });
});
