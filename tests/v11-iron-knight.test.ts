import { describe, expect, it } from 'vitest';
import { CARD_IDS, cardInfo } from '../src/config/cards';
import { PLATES } from '../src/config/damage';
import { createGame } from '../src/game';
import { armorFor, throughPlates } from '../src/logic/status';
import { levelPanel, realmFoe } from '../src/logic/world';
import { damageEnemy } from '../src/systems/combat';
import { spawnEnemy } from '../src/systems/spawning';

// #212: the Iron Hold's knight, whose plates count hits before he takes full damage
const cfg = PLATES.ironKnight!;

describe('iron plates (#212)', () => {
  it('dull every hit while a plate is left, and each hit breaks one', () => {
    const r = throughPlates(10, 6, 200, cfg);
    expect(r.dealt).toBeCloseTo(10 * (1 - cfg.reduction));
    expect(r.plates).toBe(5);
    expect(r.broke).toBe(false);
  });

  it('break one more plate per full heavy share of max HP, so a heavy blow needs fewer swings', () => {
    expect(throughPlates(cfg.heavy * 200, 6, 200, cfg).plates).toBe(4);
    expect(throughPlates(cfg.heavy * 200 * 3.5, 6, 200, cfg).plates).toBe(2);
    expect(throughPlates(9999, 2, 200, cfg)).toMatchObject({ plates: 0, broke: true });
  });

  it('let a status tick slip under: dulled, but no plate breaks', () => {
    const r = throughPlates(10, 3, 200, cfg, false);
    expect(r.plates).toBe(3);
    expect(r.dealt).toBeCloseTo(10 * (1 - cfg.reduction));
  });

  it('land in full once the plates are gone', () => {
    expect(throughPlates(10, 0, 200, cfg)).toEqual({ dealt: 10, plates: 0, broke: false });
  });

  it('start as a count of plates, not a share of HP', () => {
    expect(armorFor('ironKnight', 500)).toBe(cfg.plates);
    expect(armorFor('knight', 120)).toBe(60); // the plain knight keeps his soak pool
  });
});

describe('the Iron Hold marches its own knights (#212)', () => {
  it('swaps the knight for the Iron Knight in the Iron Hold only', () => {
    expect(realmFoe('ironHold', 'knight')).toBe('ironKnight');
    expect(realmFoe('ironHold', 'peasant')).toBe('peasant');
    expect(realmFoe('marches', 'knight')).toBe('knight');
    expect(realmFoe(undefined, 'knight')).toBe('knight');
  });

  it('names him on the level panel', () => {
    const foes = (realm: 'ironHold' | 'marches', n: number) => [1, 2, 3, 4, 5].slice(0, n).flatMap((l) => levelPanel({ marches: [7] }, realm, l, 0).foes);
    expect(foes('ironHold', 5)).toContain('Iron Knight');
    expect(foes('ironHold', 5)).not.toContain('Armored Knight');
    expect(foes('marches', 5)).not.toContain('Iron Knight');
  });

  it('spawns him in an Iron Hold level, where six hits strip his plates and he turns bare', () => {
    const g = createGame('paladin', 5, { level: { realm: 'ironHold', level: 2 } });
    const e = spawnEnemy(g, 'knight', g.player.x + 200, g.player.y);
    expect(e.def.id).toBe('ironKnight');
    expect(e.armorHp).toBe(cfg.plates);
    const first = damageEnemy(g, e, 5);
    expect(first).toBeCloseTo(5 * (1 - cfg.reduction));
    for (let i = 1; i < cfg.plates; i++) damageEnemy(g, e, 1);
    expect(e.armorHp).toBe(0);
    expect(e.def.sprite).toBe('ironKnightBare');
    expect(damageEnemy(g, e, 5)).toBeCloseTo(5);
    const m = createGame('paladin', 5, { level: { realm: 'marches', level: 2 } });
    expect(spawnEnemy(m, 'knight', m.player.x + 200, m.player.y).def.id).toBe('knight');
  });

  it('brings a flash card of his own', () => {
    expect(CARD_IDS).toContain('ironKnight');
    expect(cardInfo('ironKnight')).toMatchObject({ name: 'Iron Knight', boss: false });
  });
});
