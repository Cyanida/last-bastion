import { describe, expect, it } from 'vitest';
import { CARD_IDS, cardInfo } from '../src/config/cards';
import { THORNS } from '../src/config/damage';
import { createGame } from '../src/game';
import { thornsBite } from '../src/logic/status';
import { realmFoe } from '../src/logic/world';
import { damageEnemy, damagePlayer } from '../src/systems/combat';
import { spawnEnemy } from '../src/systems/spawning';

// #214: the Iron Hold's shield bearer, whose spiked shield bites back at blows struck up close
const cfg = THORNS.thornBearer!;
const close = { source: 'attack' as const, tick: false, gap: 20, since: 99 };

describe('thorns (#214)', () => {
  it('bite back a share of a blow struck up close', () => {
    expect(thornsBite(20, close, 1000, cfg)).toBeCloseTo(20 * cfg.share);
    expect(thornsBite(20, { ...close, source: 'ability' }, 1000, cfg)).toBeCloseTo(20 * cfg.share);
  });

  it('never bite for more than their cap of the champion\'s max HP', () => {
    expect(thornsBite(10000, close, 200, cfg)).toBeCloseTo(cfg.cap * 200);
  });

  it('leave blows from past their reach alone', () => {
    expect(thornsBite(20, { ...close, gap: cfg.reach + 1 }, 1000, cfg)).toBe(0);
    expect(thornsBite(20, { ...close, gap: cfg.reach }, 1000, cfg)).toBeGreaterThan(0);
  });

  it('only answer the champion\'s own blows: no ticks, relic procs, minions or hazards', () => {
    expect(thornsBite(20, { ...close, tick: true }, 1000, cfg)).toBe(0);
    for (const source of ['relic', 'minion', 'hazard'] as const) expect(thornsBite(20, { ...close, source }, 1000, cfg)).toBe(0);
  });

  it('bite at most once per cooldown', () => {
    expect(thornsBite(20, { ...close, since: cfg.cd / 2 }, 1000, cfg)).toBe(0);
    expect(thornsBite(20, { ...close, since: cfg.cd }, 1000, cfg)).toBeGreaterThan(0);
  });
});

describe('the Iron Hold marches its own shield bearers (#214)', () => {
  it('swaps the shield bearer for the Thorn Bearer in the Iron Hold only', () => {
    expect(realmFoe('ironHold', 'shieldBearer')).toBe('thornBearer');
    expect(realmFoe('marches', 'shieldBearer')).toBe('shieldBearer');
    expect(realmFoe(undefined, 'shieldBearer')).toBe('shieldBearer');
  });

  it('bites the champion for a blow struck beside him, and not for one from afar or a tick', () => {
    const g = createGame('paladin', 5, { level: { realm: 'ironHold', level: 2 } });
    const p = g.player;
    const e = spawnEnemy(g, 'shieldBearer', p.x + 30, p.y);
    expect(e.def.id).toBe('thornBearer');
    expect(e.armorHp).toBeGreaterThan(0); // he keeps the shield bearer's shield
    const hp = p.hp;
    damageEnemy(g, e, 20, false, 0, 0, 'attack');
    expect(p.hp).toBeLessThan(hp);
    expect(g.vars['thorns.bites']).toBe(1);
    // within the cooldown a second blow does not bite again
    const after = p.hp;
    damageEnemy(g, e, 20, false, 0, 0, 'attack');
    expect(p.hp).toBe(after);
    g.time += cfg.cd;
    damageEnemy(g, e, 20, false, 0, 0, 'hazard', 'fire', true);
    damageEnemy(g, e, 20, false, 0, 0, 'relic');
    expect(g.vars['thorns.bites']).toBe(1);
    e.x = p.x + e.r + cfg.reach + 50; // out of reach: an arrow from afar
    damageEnemy(g, e, 20, false, 0, 0, 'attack');
    expect(g.vars['thorns.bites']).toBe(1);
    expect(p.hp).toBe(after);
  });

  it('never takes the champion\'s last HP', () => {
    const g = createGame('paladin', 5, { level: { realm: 'ironHold', level: 2 } });
    const p = g.player;
    const e = spawnEnemy(g, 'shieldBearer', p.x + 30, p.y);
    p.hp = 1;
    damageEnemy(g, e, 500, false, 0, 0, 'attack');
    expect(p.hp).toBe(1);
    expect(g.over).toBe(false);
    damagePlayer(g, 5, true, null, 'a blow', true); // spared: a hit that would drop him under 1 HP stops at 1
    expect(p.hp).toBe(1);
  });

  it('leaves the plain shield bearer without thorns', () => {
    const g = createGame('paladin', 5, { level: { realm: 'marches', level: 2 } });
    const p = g.player;
    const e = spawnEnemy(g, 'shieldBearer', p.x + 30, p.y);
    const hp = p.hp;
    damageEnemy(g, e, 20, false, 0, 0, 'attack');
    expect(p.hp).toBe(hp);
  });

  it('brings a flash card of his own', () => {
    expect(CARD_IDS).toContain('thornBearer');
    expect(cardInfo('thornBearer')).toMatchObject({ name: 'Thorn Bearer', boss: false });
  });
});
