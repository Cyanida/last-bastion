import { describe, expect, it } from 'vitest';
import type { Enemy, Game } from '../src/core/types';
import { createGame } from '../src/game';
import { stopsShot, updatePlayerAttack, updateProjectiles } from '../src/systems/combat';
import { spawnEnemy } from '../src/systems/spawning';

/** An Archer with the given enemies around, each facing the player unless told otherwise. */
function range(kinds: [Parameters<typeof spawnEnemy>[1], number, number][]): { g: Game; foes: Enemy[] } {
  const g = createGame('archer', 1);
  const p = g.player;
  const foes = kinds.map(([id, dx, dy]) => {
    const e = spawnEnemy(g, id, p.x + dx, p.y + dy);
    e.angle = Math.atan2(p.y - e.y, p.x - e.x); // facing the player
    e.hp = e.maxHp = 1e4; // sturdy enough to watch the shield, not the kill
    return e;
  });
  for (const e of g.enemies) g.hash.insert(e);
  return { g, foes };
}
const shoot = (g: Game) => {
  g.player.attackTimer = 0;
  updatePlayerAttack(g, 0);
};
const fly = (g: Game, seconds: number) => {
  for (let t = 0; t < seconds; t += 1 / 60) updateProjectiles(g, 1 / 60);
};

describe("the Archer's hard counters (v0.7.3, #59)", () => {
  it('a shield bearer or a mirror knight facing the shooter stops the shot; from behind, or a mirror knight mid-swing, does not', () => {
    const { g, foes } = range([['shieldBearer', 200, 0], ['mirrorKnight', 0, 200]]);
    const [shield, mirror] = foes;
    const p = g.player;
    expect(stopsShot(shield, p.x, p.y)).toBe(true);
    expect(stopsShot(mirror, p.x, p.y)).toBe(true);
    shield.angle += Math.PI; // turned away
    expect(stopsShot(shield, p.x, p.y)).toBe(false);
    mirror.attackTimer = 1; // just swung
    expect(stopsShot(mirror, p.x, p.y)).toBe(false);
  });

  it('auto-aim looks past a shield bearer in front to an enemy the arrow can hurt', () => {
    const { g, foes } = range([['shieldBearer', 120, 0], ['peasant', 0, 300]]);
    shoot(g);
    const aim = Math.atan2(foes[1].y - g.player.y, foes[1].x - g.player.x);
    expect(g.player.facing).toBeCloseTo(aim, 1);
  });

  it("alone, a shield bearer is shot at, and the blocked arrows wear his shield down until it breaks", () => {
    const { g, foes } = range([['shieldBearer', 150, 0]]);
    const [shield] = foes;
    const armor = shield.armorHp;
    expect(armor).toBeGreaterThan(0);
    let broke = false;
    for (let i = 0; i < 60 && !broke; i++) {
      shoot(g);
      fly(g, 0.4);
      broke = shield.armorHp === 0;
    }
    expect(broke).toBe(true);
    const hp = shield.hp;
    shoot(g);
    fly(g, 0.4);
    expect(shield.hp).toBeLessThan(hp); // the shield is gone: arrows land
  });

  it('v0.7.5 (#92): alone, a mirror knight is shot at, and the thrown-back arrows wear his mirror down until it breaks', () => {
    const { g, foes } = range([['mirrorKnight', 150, 0]]);
    const [mirror] = foes;
    g.player.hp = 1e6; // survive the arrows coming back
    let broke = false;
    for (let i = 0; i < 120 && !broke; i++) {
      mirror.attackTimer = 0; // mirror up for every shot
      shoot(g);
      expect(g.projectiles.filter((pr) => !pr.hostile).length).toBeGreaterThan(0);
      fly(g, 0.6);
      broke = mirror.armorHp === 0;
    }
    expect(broke).toBe(true);
    const hp = mirror.hp;
    shoot(g);
    fly(g, 0.6);
    expect(mirror.hp).toBeLessThan(hp); // the mirror is gone: arrows land
  });

  it('auto-aim still prefers an enemy the arrow can hurt over a mirror knight that would throw it back', () => {
    const { g, foes } = range([['mirrorKnight', 120, 0], ['peasant', 0, 300]]);
    shoot(g);
    const aim = Math.atan2(foes[1].y - g.player.y, foes[1].x - g.player.x);
    expect(g.player.facing).toBeCloseTo(aim, 1);
  });

  it('a thrown-back arrow costs the mirror half its damage', () => {
    const { g, foes } = range([['mirrorKnight', 150, 0]]);
    const [mirror] = foes;
    const armor = mirror.armorHp;
    const hp = g.player.hp;
    mirror.attackTimer = 1;
    shoot(g); // aimed while he swings...
    mirror.attackTimer = 0; // ...but the mirror is up again when the arrow arrives
    fly(g, 0.6);
    expect(mirror.armorHp).toBeLessThan(armor);
    expect(g.player.hp).toBeLessThan(hp); // and it still came back at the Archer
  });
});
