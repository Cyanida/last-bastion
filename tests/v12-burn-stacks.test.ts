import { describe, expect, it } from 'vitest';
import { CARD_IDS, cardInfo } from '../src/config/cards';
import { UTILITY } from '../src/config/utility';
import { ENEMY_STATUS, STATUS_TUNING, STATUSES } from '../src/config/damage';
import { createGame } from '../src/game';
import { applyStatusTo, smother, tickStatuses, type StatusMap } from '../src/logic/status';
import { realmFoe } from '../src/logic/world';
import { hurtTarget } from '../src/systems/combat';
import { spawnEnemy } from '../src/systems/spawning';
import { updateStatuses } from '../src/systems/status';
import { updateUtility } from '../src/systems/utility';

// #225: the Cinderlands' torchbearers, whose blows leave burn stacks that fall off one at a time
const cfg = ENEMY_STATUS.torchbearer!;
const decay = cfg.decay!;

describe('decaying burn stacks (#225)', () => {
  it('adds a stack a blow, up to burn\'s cap', () => {
    const m: StatusMap = {};
    for (let i = 0; i < 8; i++) applyStatusTo(m, cfg);
    expect(m.burn).toMatchObject({ stacks: STATUSES.burn.maxStacks, decay });
  });

  it('drops one stack every `decay` seconds after the last blow, not all at once', () => {
    const m: StatusMap = {};
    for (let i = 0; i < 3; i++) applyStatusTo(m, cfg);
    tickStatuses(m, decay - 0.01);
    expect(m.burn?.stacks).toBe(3);
    tickStatuses(m, 0.02);
    expect(m.burn?.stacks).toBe(2);
    tickStatuses(m, decay);
    expect(m.burn?.stacks).toBe(1);
    tickStatuses(m, decay);
    expect(m.burn).toBeUndefined();
  });

  it('a fresh blow keeps the fire lit: the next stack falls `decay` after it', () => {
    const m: StatusMap = {};
    applyStatusTo(m, cfg);
    tickStatuses(m, decay * 0.9);
    applyStatusTo(m, cfg);
    tickStatuses(m, decay * 0.9);
    expect(m.burn?.stacks).toBe(2);
  });

  it('burns for power × stacks a second, a full 5-stack burn totalling what 15 stack-steps deal', () => {
    const m: StatusMap = {};
    for (let i = 0; i < 5; i++) applyStatusTo(m, cfg);
    let dealt = 0;
    for (let t = 0; t < decay * 6; t += 0.05) dealt += tickStatuses(m, 0.05, {}).fire ?? 0;
    expect(m.burn).toBeUndefined();
    expect(dealt).toBeCloseTo(cfg.power! * decay * 15, 0);
  });

  it('leaves a plain burn (the cultist\'s) as it was: all stacks go when its time runs out', () => {
    const m: StatusMap = {};
    applyStatusTo(m, ENEMY_STATUS.cultist!);
    tickStatuses(m, STATUSES.burn.duration + 0.01);
    expect(m.burn).toBeUndefined();
  });

  it('is put out by smother, a plain burn is not', () => {
    const m: StatusMap = {};
    applyStatusTo(m, cfg);
    applyStatusTo(m, cfg);
    expect(smother(m)).toBe(2);
    expect(m.burn).toBeUndefined();
    const plain: StatusMap = {};
    applyStatusTo(plain, ENEMY_STATUS.cultist!);
    expect(smother(plain)).toBe(0);
    expect(plain.burn).toBeDefined();
  });
});

describe('the Cinderlands march torchbearers (#225)', () => {
  it('swaps the peasant for the Torchbearer in the Cinderlands only', () => {
    expect(realmFoe('cinderlands', 'peasant')).toBe('torchbearer');
    expect(realmFoe('marches', 'peasant')).toBe('peasant');
    expect(realmFoe('ironHold', 'peasant')).toBe('peasant');
  });

  it('his blows stack burn on the champion, which ticks his HP down and falls off a stack at a time', () => {
    const g = createGame('paladin', 5, { level: { realm: 'cinderlands', level: 2 } });
    const p = g.player;
    const e = spawnEnemy(g, 'peasant', p.x + 30, p.y);
    expect(e.def.id).toBe('torchbearer');
    for (let i = 0; i < 3; i++) hurtTarget(g, p, e.def.damage, true, e);
    expect(p.statuses.burn).toMatchObject({ stacks: 3, decay });
    const hp = p.hp;
    for (let t = 0; t < decay + STATUS_TUNING.dotTick; t += 1 / 60) {
      g.time += 1 / 60;
      updateStatuses(g, 1 / 60);
    }
    expect(p.hp).toBeLessThan(hp);
    expect(p.statuses.burn?.stacks).toBe(2);
  });

  it('the champion\'s utility puts his burn out', () => {
    const g = createGame('paladin', 5, { level: { realm: 'cinderlands', level: 2 } });
    const p = g.player;
    const e = spawnEnemy(g, 'peasant', p.x + 30, p.y);
    hurtTarget(g, p, e.def.damage, true, e);
    hurtTarget(g, p, e.def.damage, true, e);
    p.level = Math.max(p.level, UTILITY.unlockLevel);
    p.utilityCd = 0;
    g.input.utility = true;
    updateUtility(g, 1 / 60);
    expect(p.statuses.burn).toBeUndefined();
    expect(g.vars['burn.smothered']).toBe(2);
  });

  it('the plain peasant sets no one alight', () => {
    const g = createGame('paladin', 5, { level: { realm: 'marches', level: 2 } });
    const p = g.player;
    const e = spawnEnemy(g, 'peasant', p.x + 30, p.y);
    hurtTarget(g, p, e.def.damage, true, e);
    expect(p.statuses.burn).toBeUndefined();
  });

  it('brings a flash card of his own', () => {
    expect(CARD_IDS).toContain('torchbearer');
    expect(cardInfo('torchbearer')).toMatchObject({ name: 'Torchbearer', boss: false });
  });
});
