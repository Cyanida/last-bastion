import { describe, expect, it } from 'vitest';
import { RENDER } from '../src/config/game';
import { WAVES } from '../src/config/waves';
import type { Enemy, Game } from '../src/core/types';
import { createMinion } from '../src/entities/actors';
import { addField } from '../src/entities/hazards';
import { createGame, updateGame } from '../src/game';
import { livePad, unlatch } from '../src/input/mapping';
import { updateArena } from '../src/systems/arena';
import { killEnemy, updateFields } from '../src/systems/combat';
import { chainFrom } from '../src/systems/relicCore';
import { spawnEnemy } from '../src/systems/spawning';

const DT = 1 / 60;

/** A quiet arena: no waves, no board, an unkillable player who never attacks. */
function stage(cls: Parameters<typeof createGame>[0] = 'paladin', opts: Parameters<typeof createGame>[2] = {}): Game {
  const g = createGame(cls, 7, opts);
  g.pendingBoard = false;
  g.breather = 1e9;
  g.player.invulnerable = true;
  g.player.attackTimer = 1e9;
  return g;
}
const sturdy = (g: Game, id: Parameters<typeof spawnEnemy>[1], dx: number, dy = 0): Enemy => {
  const e = spawnEnemy(g, id, g.player.x + dx, g.player.y + dy);
  e.hp = e.maxHp = 1e7;
  e.armorHp = 0;
  return e;
};
const rehash = (g: Game) => {
  g.hash.clear();
  for (const e of g.enemies) g.hash.insert(e);
};

describe('combat fixes (v0.7.5, #111)', () => {
  it('a chain never bounces back to an enemy it already hit', () => {
    const g = stage();
    const a = sturdy(g, 'knight', 300);
    const b = sturdy(g, 'knight', 340);
    rehash(g);
    const hits: Enemy[] = [];
    chainFrom(g, g.player, a, 10, 4, 200, (e) => hits.push(e));
    expect(hits).toEqual([b]); // before: B, A, B, A
    expect(a.hp).toBe(a.maxHp);
  });

  it('fields past the cap: the oldest are trimmed after the update, none lost or ticked twice mid-loop', () => {
    const g = stage();
    for (let i = 0; i < RENDER.maxFields + 5; i++) addField(g, { x: i, y: 0, r: 10, life: 10, dps: 0, hostile: false, color: '#fff' });
    expect(g.fields.length).toBe(RENDER.maxFields + 5); // adding only pushes
    updateFields(g, DT);
    expect(g.fields.length).toBe(RENDER.maxFields);
    expect(g.fields[0].x).toBe(5); // the five oldest went
    expect(g.fields.every((f) => f.life === 10 - DT)).toBe(true); // each ticked once
  });

  it('Blood Tide: every tide hits each enemy around it once, its own kills included', () => {
    // a line of weak enemies 90 apart (each tide reaches the next), a sturdy one halfway between each pair: two tides reach each
    const tide = (weak: number) => {
      const g = stage('viking');
      g.evolutions = ['bloodTide'];
      g.player.abilityTime = 10; // raging
      const x0 = g.player.x + 200;
      const foes = Array.from({ length: weak }, (_, i) => Object.assign(spawnEnemy(g, 'knight', x0 + i * 90, g.player.y), { hp: 1 }));
      const big = Array.from({ length: Math.max(1, weak - 1) }, (_, i) => sturdy(g, 'knight', 245 + i * 90));
      rehash(g);
      killEnemy(g, foes[0], 'attack');
      return { lost: big.map((b) => b.maxHp - b.hp), dead: foes.every((e) => e.dead) };
    };
    const one = tide(1).lost[0];
    const line = tide(5);
    expect(one).toBeGreaterThan(0);
    expect(line.dead).toBe(true);
    for (const l of line.lost) expect(l).toBeCloseTo(one * 2, 3); // before: some hit three times, some once
  });

  it('a charge hits a minion once, not every tick it runs through it', () => {
    const g = stage();
    const k = sturdy(g, 'blackKnight', 400);
    const m = createMinion(k.x + 30, k.y, { hp: 1e6, damage: 0, speed: 0, attackCd: 1e9, life: 1e9 });
    g.minions.push(m);
    Object.assign(k, { state: 2, timer: 0.3, angle: 0, telegraph: null, special: 1e9 });
    const losses: number[] = [];
    for (let i = 0; i < 18; i++) {
      const before = m.hp;
      updateGame(g, DT);
      if (m.hp < before) losses.push(before - m.hp);
    }
    expect(losses).toHaveLength(1);
  });

  it('a pulled assassin comes out of hiding', () => {
    const g = stage();
    g.wave = 1;
    g.breather = 0;
    g.spawnQueue = [];
    const a = spawnEnemy(g, 'assassin', g.player.x + 500, g.player.y);
    a.hidden = true;
    g.vars.stragglers = WAVES.stragglers.grace;
    updateGame(g, DT);
    expect(a.pulled).toBe(true);
    expect(a.hidden).toBe(false);
  });

  it("the arena's own fire zones are hazard damage, not your ability", () => {
    for (const arena of ['keep', 'bastion'] as const) {
      const g = createGame('paladin', 3, { arena });
      g.wave = 1;
      g.hazardT = 0;
      updateArena(g, DT);
      const friendly = g.zones.filter((z) => !z.hostile);
      expect(friendly.length).toBeGreaterThan(0);
      expect(friendly.every((z) => z.source === 'hazard')).toBe(true);
    }
  });

  it('gamepad: a button held when a screen closes casts nothing until released', () => {
    let latched = [true, false, true]; // A and X held as the screen closed
    expect(livePad(latched, [true, false, true])).toEqual([false, false, false]);
    latched = unlatch(latched, [true, false, false]); // X let go
    expect(latched).toEqual([true, false, false]);
    expect(livePad(latched, [true, false, true])).toEqual([false, false, true]); // X pressed again: casts
    latched = unlatch(latched, [false, false, false]);
    expect(livePad(latched, [true, false, false])).toEqual([true, false, false]);
  });
});
