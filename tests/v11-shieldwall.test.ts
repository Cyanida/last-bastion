import { describe, expect, it } from 'vitest';
import { CARD_IDS, cardInfo } from '../src/config/cards';
import { TOWER_SHIELDS } from '../src/config/damage';
import { ENEMIES } from '../src/config/enemies';
import { angleDiff } from '../src/core/math';
import type { Player } from '../src/core/types';
import { createGame } from '../src/game';
import { atFront, throughTowerShield, turnToward } from '../src/logic/status';
import { realmFoe } from '../src/logic/world';
import { seek } from '../src/systems/aiHelpers';
import { damageEnemy } from '../src/systems/combat';
import { spawnEnemy } from '../src/systems/spawning';

// #213: the Iron Hold's shieldwall, whose iron tower shield turns blows from the front, on a man who turns slowly
const cfg = TOWER_SHIELDS.ironShieldwall!;
const arc = ENEMIES.ironShieldwall.frontBlock!;

describe('the iron tower shield (#213)', () => {
  // facing left (PI): a blow travelling right (+x) comes at his front, one travelling left comes from behind
  it('turns a blow at his front, within the arc either side of his facing', () => {
    expect(atFront(60, 0, Math.PI, arc)).toBe(true);
    expect(atFront(60, 20, Math.PI, arc)).toBe(true); // a little off-centre is still the front
    expect(throughTowerShield(10, 60, 0, Math.PI, arc, cfg.reduction)).toEqual({ dealt: 10 * (1 - cfg.reduction), blocked: true });
  });

  it('lets a blow from the side or from behind land in full', () => {
    expect(throughTowerShield(10, 0, 60, Math.PI, arc, cfg.reduction)).toEqual({ dealt: 10, blocked: false }); // from the side
    expect(throughTowerShield(10, -60, 0, Math.PI, arc, cfg.reduction)).toEqual({ dealt: 10, blocked: false }); // from behind
  });

  it('has no front for damage with no direction (areas, ticks)', () => {
    expect(throughTowerShield(10, 0, 0, Math.PI, arc, cfg.reduction)).toEqual({ dealt: 10, blocked: false });
  });

  it('greatly reduces what it turns', () => {
    expect(cfg.reduction).toBeGreaterThanOrEqual(0.75);
    expect(arc).toBeLessThan(Math.PI / 2); // the sides stay open
  });
});

describe('turning slowly (#213)', () => {
  it('turns by at most a step, the short way round, and lands on the target when close', () => {
    expect(turnToward(0, Math.PI / 2, 0.1)).toBeCloseTo(0.1);
    expect(turnToward(0, -Math.PI / 2, 0.1)).toBeCloseTo(-0.1);
    expect(turnToward(3, -3, 0.1)).toBeCloseTo(3.1); // across PI, not the long way
    expect(turnToward(1, 1.05, 0.1)).toBeCloseTo(1.05);
  });

  it('stays within -PI..PI', () => {
    const a = turnToward(3.1, -3.1, 0.2);
    expect(a).toBeGreaterThanOrEqual(-Math.PI);
    expect(a).toBeLessThanOrEqual(Math.PI);
  });
});

describe('the Iron Hold marches its own shieldwalls (#213)', () => {
  it('swaps the shieldwall for the Iron Shieldwall in the Iron Hold only', () => {
    expect(realmFoe('ironHold', 'shieldwall')).toBe('ironShieldwall');
    expect(realmFoe('marches', 'shieldwall')).toBe('shieldwall');
    expect(realmFoe(undefined, 'shieldwall')).toBe('shieldwall');
  });

  it('spawns him in an Iron Hold level: his front turns a blow that lands in full on his back', () => {
    const g = createGame('paladin', 5, { level: { realm: 'ironHold', level: 2 } });
    const e = spawnEnemy(g, 'shieldwall', g.player.x + 200, g.player.y);
    expect(e.def.id).toBe('ironShieldwall');
    e.angle = Math.PI; // facing the champion on his left
    e.hp = e.maxHp;
    const front = damageEnemy(g, e, 20, false, 60, 0);
    e.hp = e.maxHp;
    const back = damageEnemy(g, e, 20, false, -60, 0);
    expect(front).toBeCloseTo(20 * (1 - cfg.reduction));
    expect(back).toBeCloseTo(20);
    const m = createGame('paladin', 5, { level: { realm: 'marches', level: 2 } });
    expect(spawnEnemy(m, 'shieldwall', m.player.x + 200, m.player.y).def.id).toBe('shieldwall');
  });

  it('turns toward you at his turn rate, while the plain spearman faces you at once', () => {
    const g = createGame('paladin', 5, { level: { realm: 'ironHold', level: 2 } });
    const e = spawnEnemy(g, 'shieldwall', 500, 500);
    const plain = spawnEnemy(createGame('paladin', 5), 'shieldwall', 500, 500);
    const behind = { x: 300, y: 500, r: 14 } as Player; // straight behind a man facing right
    e.angle = plain.angle = 0;
    seek(e, behind, e.speed, 0.1);
    seek(plain, behind, plain.speed, 0.1);
    expect(angleDiff(e.angle, 0)).toBeCloseTo(cfg.turn * 0.1);
    expect(angleDiff(plain.angle, Math.PI)).toBeCloseTo(0);
    expect(e.x).toBeLessThan(500); // he still walks at you while he turns
  });

  it('brings a flash card of his own', () => {
    expect(CARD_IDS).toContain('ironShieldwall');
    expect(cardInfo('ironShieldwall')).toMatchObject({ name: 'Iron Shieldwall', boss: false });
  });
});
