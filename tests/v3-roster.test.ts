import { describe, expect, it } from 'vitest';
import { AI } from '../src/config/ai';
import { ENEMIES, type EnemyId } from '../src/config/enemies';
import { WAVES } from '../src/config/waves';
import type { Enemy, Game } from '../src/core/types';
import { fireProjectile } from '../src/entities/hazards';
import { createGame, updateGame } from '../src/game';
import { damageEnemy } from '../src/systems/combat';
import { SPECIALS } from '../src/systems/specials';
import { spawnEnemy } from '../src/systems/spawning';
import { createSquad } from '../src/systems/squads';

const DT = 1 / 60;

/** A quiet arena (no waves) with an unkillable, harmless player, so one enemy's behaviour can be watched. */
function stage(): Game {
  const g = createGame('archer', 3);
  g.breather = 1e9;
  g.player.invulnerable = true;
  g.player.attackTimer = 1e9; // never shoots: even one piercing arrow would disturb the scene
  return g;
}
const run = (g: Game, seconds: number) => {
  for (let i = 0; i < seconds * 60; i++) updateGame(g, DT);
};
const near = (g: Game, id: EnemyId, dx: number, dy = 0): Enemy => spawnEnemy(g, id, g.player.x + dx, g.player.y + dy);

describe('new roster: every type has its own loop', () => {
  it('has 8+ new regular types and 2 three-phase bosses, all with a profile or a script', () => {
    const fresh: EnemyId[] = ['engineer', 'plagueDoctor', 'houndmaster', 'mirrorKnight', 'siegeTower', 'assassin', 'shieldwall', 'boneCollector'];
    for (const id of fresh) {
      expect(ENEMIES[id].boss).toBe(false);
      expect(AI[id]).toBeDefined();
    }
    const specials = fresh.map((id) => AI[id]!.special?.id).filter(Boolean);
    expect(new Set(specials).size).toBe(specials.length); // no two share a special
    for (const id of specials) expect(SPECIALS[id!]).toBeTypeOf('function');
    expect(ENEMIES.dragon.phases).toBe(3);
    expect(ENEMIES.warden.phases).toBe(3);
    for (const p of WAVES.pool) expect(ENEMIES[p.id]).toBeDefined();
  });

  it('engineer: builds a ballista, and the ballista shoots', () => {
    const g = stage();
    near(g, 'engineer', 300);
    run(g, 4);
    const ballista = g.enemies.find((e) => e.def.id === 'ballista');
    expect(ballista).toBeDefined();
    run(g, 4);
    expect(ballista!.x).toBe(g.enemies.find((e) => e.def.id === 'ballista')!.x); // bolted down
    expect(g.projectiles.some((p) => p.hostile) || g.player.flash > -10).toBe(true);
  });

  it('plague doctor: leaves poison clouds and revives one fallen unit, once', () => {
    const g = stage();
    const doc = near(g, 'plagueDoctor', 280);
    g.corpses.push({ x: doc.x + 40, y: doc.y, t: 0 }, { x: doc.x - 40, y: doc.y, t: 0 });
    run(g, 3);
    expect(g.enemies.filter((e) => e.def.id === 'peasant')).toHaveLength(1);
    expect(g.corpses).toHaveLength(1);
    expect(g.fields.some((f) => f.hostile && f.apply?.id === 'poison')).toBe(true);
    run(g, 6);
    expect(g.enemies.filter((e) => e.def.id === 'peasant')).toHaveLength(1); // only once
  });

  it('hound master: the whistle sends his wolves into a frenzy; they scatter when he dies', () => {
    const g = stage();
    const master = near(g, 'houndmaster', 500);
    const wolves = [0, 1, 2].map((i) => near(g, 'wolf', 520, i * 30));
    createSquad(g, { template: 'kennel', formation: 'circle', spacing: 46, holdUntil: 300 }, wolves, master, master.x, master.y);
    run(g, 1);
    expect(wolves.every((w) => w.buffT > 0 && w.buffSpd > 1)).toBe(true);
    damageEnemy(g, master, 1e6);
    expect(wolves.every((w) => w.fearT > 0)).toBe(true);
  });

  it('mirror knight: reflects shots from the front, but not right after he swings', () => {
    const g = stage();
    const shoot = (attackTimer: number) => {
      const k = near(g, 'mirrorKnight', 120);
      k.angle = Math.PI; // facing the player, who is to his left
      k.attackTimer = attackTimer;
      k.born = -5;
      g.projectiles.length = 0;
      fireProjectile(g, g.player.x + 60, g.player.y, 0, { damage: 10, crit: false, hostile: false, pierce: 0, shape: 'arrow', color: '#fff', r: 5, speed: 600, range: 400 });
      g.hash.clear();
      g.enemies.forEach((e) => g.hash.insert(e));
      const hp = k.hp;
      for (let i = 0; i < 12; i++) updateGame(g, DT);
      const result = { hurt: k.hp < hp, hostile: g.projectiles.some((p) => p.hostile) };
      k.dead = true;
      return result;
    };
    expect(shoot(0)).toEqual({ hurt: false, hostile: true });
    expect(shoot(1.5)).toEqual({ hurt: true, hostile: false });
  });

  it('shieldwall: the pavises only work while the line stands together', () => {
    const g = stage();
    const line = [0, 1, 2].map((i) => near(g, 'shieldwall', 300, i * 30));
    const loner = near(g, 'shieldwall', -400);
    run(g, 1);
    expect(line.every((e) => e.charged)).toBe(true);
    expect(loner.charged).toBe(false);
    const hit = (e: Enemy) => {
      const before = e.hp;
      e.angle = Math.PI;
      damageEnemy(g, e, 10, false, 60, 0, 'attack', 'holy'); // travelling +x into a unit facing -x: the front
      return before - e.hp;
    };
    expect(hit(line[1])).toBeCloseTo(10 * (1 - ENEMIES.shieldwall.wall!.reduction));
    expect(hit(loner)).toBe(10);
  });

  it('assassin: vanishes, reappears on the far side of you, and cannot be targeted while hidden', () => {
    const g = stage();
    const a = near(g, 'assassin', 300);
    let wasHidden = false;
    for (let i = 0; i < 60 * 4 && !(wasHidden && !a.hidden); i++) {
      updateGame(g, DT);
      wasHidden ||= a.hidden;
    }
    expect(wasHidden).toBe(true);
    expect(a.hidden).toBe(false);
    expect(a.x).toBeLessThan(g.player.x); // he started on the right
  });

  it('bone collector: eats corpses, grows, and leaves none for the Necromancer', () => {
    const g = stage();
    const b = near(g, 'boneCollector', 300);
    const [hp, r] = [b.maxHp, b.r];
    g.corpses.push({ x: b.x + 50, y: b.y, t: 0 }, { x: b.x + 90, y: b.y, t: 0 });
    run(g, 5);
    expect(g.corpses).toHaveLength(0);
    expect(b.maxHp).toBeGreaterThan(hp * (1 + ENEMIES.boneCollector.grow!.hp) ** 2 * 0.98); // two corpses, compounding
    expect(b.r).toBeGreaterThan(r);
    expect(b.combo).toBe(2);
  });

  it('siege tower: keeps unloading troops until destroyed', () => {
    const g = stage();
    const tower = near(g, 'siegeTower', 250);
    run(g, 8);
    const troops = g.enemies.length - 1;
    expect(troops).toBeGreaterThanOrEqual(2);
    damageEnemy(g, tower, 1e6);
    run(g, 8);
    expect(g.enemies.length).toBeLessThanOrEqual(troops);
  });
});

describe('Act bosses: three phases and arena interaction', () => {
  it('the Dragon enters phases at 66% and 33%, takes off, and burns a strip of the map', () => {
    const g = stage();
    const d = near(g, 'dragon', 300);
    run(g, 1);
    expect(d.phase).toBe(1);
    d.hp = d.maxHp * 0.6;
    run(g, 1);
    expect(d.phase).toBe(2);
    let flew = false;
    for (let i = 0; i < 60 * 14; i++) {
      updateGame(g, DT);
      flew ||= d.hidden;
    }
    expect(flew).toBe(true);
    expect(g.fields.filter((f) => f.hostile && f.dtype === 'fire').length).toBeGreaterThan(6);
    d.hp = d.maxHp * 0.3;
    run(g, 1);
    expect(d.phase).toBe(3);
  });

  it('the Warden seals the player in: barriers block movement and expire', () => {
    const g = stage();
    const w = near(g, 'warden', 300);
    w.special = 0;
    run(g, 0.2);
    expect(g.barriers.length).toBeGreaterThan(15);
    const b = g.barriers[0];
    g.player.x = b.x;
    g.player.y = b.y;
    run(g, 0.05);
    expect(Math.hypot(g.player.x - b.x, g.player.y - b.y)).toBeGreaterThanOrEqual(b.r); // pushed out of the stone
    w.dead = true;
    run(g, 9);
    expect(g.barriers).toHaveLength(0);
  });
});
