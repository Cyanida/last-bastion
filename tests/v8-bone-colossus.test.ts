import { describe, expect, it } from 'vitest';
import { CLASSES, type Cfg } from '../src/config/classes';
import { EVOLUTIONS } from '../src/config/evolutions';
import { createGame, updateGame } from '../src/game';
import { boneColossus, raiseDead } from '../src/logic/abilities';
import { attackDamage } from '../src/logic/formulas';
import { skeletonCount } from '../src/systems/minions';
import { spawnEnemy } from '../src/systems/spawning';

// #126: the Colossus compounded its damage on every feed and hit for about 100,000,000 by Act III
const n = EVOLUTIONS.boneColossus.n as { hp: number; damage: number; maxParts: number };
const c = CLASSES.necromancer.ability as Cfg<'raiseDead'>;
const each = (soul: number, int: number) => ({ hp: c.minionHp, damage: attackDamage(raiseDead(c, soul).damage, int) });

describe('Bone Colossus (v0.8)', () => {
  it('stops growing at its cap, however often it is fed', () => {
    const e = each(10, 40);
    expect(boneColossus(n, e, 1000)).toEqual(boneColossus(n, e, n.maxParts));
    expect(boneColossus(n, e, 3).damage).toBeLessThan(boneColossus(n, e, 4).damage);
  });

  it('hits hard but not run-ending at Act III', () => {
    // a lean Act III build (level 20) and a stacked one (level 35, twice the Intelligence), fed for a whole run
    const lean = boneColossus(n, each(5 + 0.25 * 20, 12 + 1.2 * 20), 1000).damage;
    const stacked = boneColossus(n, each(20, 90), 1000).damage;
    expect(lean).toBeGreaterThan(150);
    expect(stacked).toBeLessThan(1500);
  });

  it('rises beside the skeletons instead of eating them, and many casts keep it capped', () => {
    const g = createGame('necromancer', 7);
    g.pendingBoard = false;
    g.breather = 1e9;
    g.baseMods.xp = 0;
    const p = g.player;
    p.invulnT = 1e9;
    g.evolutions = ['boneColossus'];
    const foe = spawnEnemy(g, 'knight', p.x + 300, p.y);
    foe.hp = foe.maxHp = 1e9;
    let first = 0;
    for (let cast = 0; cast < 40; cast++) {
      for (let i = 0; i < 6; i++) g.corpses.push({ x: p.x + 30 * i, y: p.y, t: 0 });
      p.abilityCd = 0;
      g.input.ability = true;
      updateGame(g, 1 / 60);
      g.input.ability = false;
      for (let i = 0; i < 30; i++) updateGame(g, 1 / 60);
      const colossi = g.minions.filter((m) => m.cleave);
      expect(colossi).toHaveLength(1);
      expect(skeletonCount(g)).toBeGreaterThan(0);
      first ||= colossi[0].damage;
      expect(colossi[0].damage).toBeLessThanOrEqual(boneColossus(n, each(p.stats.secondary, p.stats.int), n.maxParts).damage + 1e-6);
    }
    expect(first).toBeGreaterThan(0);
  });
});
