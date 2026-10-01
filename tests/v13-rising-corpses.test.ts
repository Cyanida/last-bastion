import { describe, expect, it } from 'vitest';
import { CARD_IDS, cardInfo } from '../src/config/cards';
import { ENEMIES, RISING } from '../src/config/enemies';
import { GAME } from '../src/config/game';
import type { Corpse } from '../src/core/types';
import { createGame } from '../src/game';
import { corpseRise, riseProgress, risingOf, stepRising, tramples } from '../src/logic/risingCorpse';
import { realmFoe } from '../src/logic/world';
import { killEnemy, updateRisingCorpses } from '../src/systems/combat';
import { spawnEnemy } from '../src/systems/spawning';

// #275: the Barrowvale's Barrow Thralls, whose corpses rise again unless the champion tramples them
const cfg = RISING.barrowThrall!;
const corpse = (x: number, y: number, t = 0): Corpse => ({ x, y, t, rise: corpseRise({ id: 'barrowThrall', side: false, maxHp: 22 }) });
const far = { x: 1000, y: 1000, r: 14 };

describe('a rising corpse (#275)', () => {
  it('only the kinds that rise carry a rise, and never twice', () => {
    expect(risingOf('barrowThrall')).toBe(cfg);
    expect(corpseRise({ id: 'barrowThrall', side: true, maxHp: 31 })).toEqual({ id: 'barrowThrall', at: cfg.delay, side: true, hp: 16 });
    expect(corpseRise({ id: 'barrowThrall', side: false, maxHp: 1 })!.hp).toBe(1);
    expect(corpseRise({ id: 'barrowThrall', risen: true, side: false, maxHp: 22 })).toBeUndefined();
    for (const id of ['peasant', 'torchbearer', 'cinderHound', 'knight'] as const) expect(corpseRise({ id, side: false, maxHp: 22 })).toBeUndefined();
  });

  it('rises when its time comes, not before, and leaves the ground', () => {
    const cs = [corpse(0, 0, cfg.delay - 0.01), { x: 5, y: 5, t: 9 }];
    expect(stepRising(cs, far)).toEqual([]);
    expect(cs).toHaveLength(2);
    cs[0].t = cfg.delay;
    const up = stepRising(cs, far);
    expect(up).toHaveLength(1);
    expect(up[0].rise!.id).toBe('barrowThrall');
    expect(cs).toEqual([{ x: 5, y: 5, t: 9 }]); // the plain corpse stays
  });

  it('a champion who walks over it tramples it: it stays a plain corpse and never rises', () => {
    const c = corpse(100, 0, 1);
    expect(tramples(c, 100 - 14 - cfg.trample - 1, 0, 14)).toBe(false);
    expect(tramples(c, 100 - 14 - cfg.trample, 0, 14)).toBe(true);
    const cs = [c];
    let heard = 0;
    expect(stepRising(cs, { x: 95, y: 0, r: 14 }, () => heard++)).toEqual([]);
    expect(heard).toBe(1);
    expect(cs).toHaveLength(1);
    expect(cs[0].rise).toBeUndefined();
    cs[0].t = 9;
    expect(stepRising(cs, far)).toEqual([]);
  });

  it('its mark fills as it nears rising', () => {
    expect(riseProgress(corpse(0, 0, 0))).toBe(0);
    expect(riseProgress(corpse(0, 0, cfg.delay / 2))).toBeCloseTo(0.5);
    expect(riseProgress(corpse(0, 0, cfg.delay * 2))).toBe(1);
    expect(riseProgress({ x: 0, y: 0, t: 3 })).toBe(0);
  });

  it('is balanced: time to turn back for it inside a corpse\'s life, and a risen thrall is half of one', () => {
    expect(cfg.delay).toBeGreaterThanOrEqual(3);
    expect(cfg.delay).toBeLessThan(GAME.corpseLifetime);
    expect(cfg.trample).toBeGreaterThan(0);
    expect(cfg.hp).toBe(0.5);
    expect(corpseRise({ id: 'barrowThrall', side: false, maxHp: ENEMIES.barrowThrall.hp })!.hp).toBe(11);
  });
});

describe('the Barrowvale marches barrow thralls (#275)', () => {
  const fight = (realm: 'barrowvale' | 'marches' = 'barrowvale') => createGame('paladin', 5, { level: { realm, level: 2 } });
  const age = (g: ReturnType<typeof fight>, seconds: number) => {
    for (let t = 0; t < seconds; t += 1 / 60) {
      for (const c of g.corpses) c.t += 1 / 60;
      updateRisingCorpses(g);
    }
  };

  it('swaps the peasant for the Barrow Thrall in the Barrowvale only', () => {
    expect(realmFoe('barrowvale', 'peasant')).toBe('barrowThrall');
    expect(realmFoe('marches', 'peasant')).toBe('peasant');
    expect(realmFoe('cinderlands', 'peasant')).toBe('torchbearer');
  });

  it('is the peasant in body and blow, with his own look', () => {
    const { id: _i, name: _n, sprite, ...thrall } = ENEMIES.barrowThrall;
    const { id: _pi, name: _pn, sprite: _ps, ...peasant } = ENEMIES.peasant;
    expect(thrall).toEqual(peasant);
    expect(sprite).toBe('barrowThrall');
  });

  it('rises where he fell with half his HP, once, unless trampled', () => {
    const g = fight();
    const p = g.player;
    const e = spawnEnemy(g, 'peasant', p.x + 200, p.y);
    expect(e.def.id).toBe('barrowThrall');
    killEnemy(g, e);
    const before = g.enemies.length;
    age(g, cfg.delay - 0.1);
    expect(g.enemies.length).toBe(before);
    age(g, 0.2);
    expect(g.vars['corpsesRisen']).toBe(1);
    const r = g.enemies[g.enemies.length - 1];
    expect(r).toMatchObject({ x: e.x, y: e.y, risen: true, side: e.side, maxHp: Math.round(e.maxHp / 2), hp: Math.round(e.maxHp / 2) });
    expect(r.def.id).toBe('barrowThrall');
    // felled again, he stays down
    killEnemy(g, r);
    age(g, cfg.delay + 1);
    expect(g.vars['corpsesRisen']).toBe(1);
  });

  it('stays down when the champion walks over his corpse', () => {
    const g = fight();
    const p = g.player;
    const e = spawnEnemy(g, 'peasant', p.x + 200, p.y);
    killEnemy(g, e);
    age(g, 1);
    p.x = e.x;
    p.y = e.y;
    age(g, 1 / 60);
    expect(g.vars['corpsesTrampled']).toBe(1);
    p.x += 400;
    age(g, cfg.delay + 1);
    expect(g.vars['corpsesRisen']).toBeUndefined();
  });

  it('has his own flash card', () => {
    expect(CARD_IDS).toContain('barrowThrall');
    expect(cardInfo('barrowThrall')).toMatchObject({ name: 'Barrow Thrall', boss: false });
    expect(cardInfo('barrowThrall').text).toMatch(/rises again/i);
  });
});
