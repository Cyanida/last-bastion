import { describe, expect, it } from 'vitest';
import { ARMOR, RESISTS, STATUS_TUNING, STATUSES } from '../src/config/damage';
import { createGame } from '../src/game';
import { applyStatusTo, damageTakenFactor, fromBehind, isStunned, slowStacks, speedFactor, throughArmor, tickStatuses, typeMultiplier, type StatusMap } from '../src/logic/status';
import { applyStatus, damageEnemy, hurtTarget } from '../src/systems/combat';
import { spawnEnemy } from '../src/systems/spawning';
import { updateStatuses } from '../src/systems/status';

describe('damage type multipliers', () => {
  it('weaknesses and resistances come from config; everything else is neutral', () => {
    expect(typeMultiplier('lich', 'holy')).toBe(RESISTS.lich!.holy);
    expect(typeMultiplier('lich', 'holy')).toBeGreaterThan(1);
    expect(typeMultiplier('lich', 'shadow')).toBeLessThan(1);
    expect(typeMultiplier('peasant', 'fire')).toBe(1);
    expect(typeMultiplier('wolf', 'physical')).toBe(1);
  });

  it('the same hit lands harder on a weakness and softer on a resistance', () => {
    const g = createGame('angel', 1);
    const hit = (type: 'holy' | 'shadow' | 'physical') => {
      const e = spawnEnemy(g, 'cultist', 400, 400);
      damageEnemy(g, e, 10, false, 0, 0, 'attack', type);
      return e.maxHp - e.hp;
    };
    expect(hit('physical')).toBe(10);
    expect(hit('holy')).toBe(15);
    expect(hit('shadow')).toBe(5);
  });
});

describe('status stacking', () => {
  it('burn and bleed add stacks up to a cap, refresh their time and tick damage of their type', () => {
    const map: StatusMap = {};
    for (let i = 0; i < 9; i++) applyStatusTo(map, { id: 'burn', power: 2 });
    expect(map.burn!.stacks).toBe(STATUSES.burn.maxStacks);
    const dots = tickStatuses(map, 1);
    expect(dots.fire).toBeCloseTo(2 * STATUSES.burn.maxStacks);
    expect(map.burn!.time).toBeCloseTo(STATUSES.burn.duration - 1);
    applyStatusTo(map, { id: 'burn', power: 1 }); // a weaker source refreshes the time but does not dilute the power
    expect(map.burn!.time).toBe(STATUSES.burn.duration);
    expect(map.burn!.power).toBe(2);
    tickStatuses(map, 99);
    expect(map.burn).toBeUndefined();
  });

  it('poison does not stack: the strongest dose wins and the time adds up (capped)', () => {
    const map: StatusMap = {};
    applyStatusTo(map, { id: 'poison', power: 3 });
    applyStatusTo(map, { id: 'poison', power: 8 });
    applyStatusTo(map, { id: 'poison', power: 1 });
    expect(map.poison).toMatchObject({ stacks: 1, power: 8 });
    expect(map.poison!.time).toBe(Math.min(STATUS_TUNING.poisonMaxTime, STATUSES.poison.duration * 3));
    expect(tickStatuses(map, 0.5).shadow).toBeCloseTo(4);
  });

  it('chill slows per stack, freezes at the threshold, then grants immunity', () => {
    const map: StatusMap = {};
    applyStatusTo(map, { id: 'slow', stacks: 2 });
    expect(speedFactor(map)).toBeCloseTo(1 - 2 * STATUS_TUNING.slowPerStack);
    expect(applyStatusTo(map, { id: 'slow', stacks: 3 })).toBe('frozen');
    expect(isStunned(map)).toBe(true);
    expect(speedFactor(map)).toBe(0);
    expect(map.slow).toBeUndefined();
    expect(applyStatusTo(map, { id: 'slow' })).toBe('immune');
    tickStatuses(map, STATUS_TUNING.freezeImmunity + 0.1);
    expect(applyStatusTo(map, { id: 'slow' })).toBe('applied');
    expect(slowStacks(0.1)).toBeLessThan(STATUS_TUNING.freezeAt); // one ability slow can never freeze by itself
  });

  it('stun takes the longer duration and cannot be chained; curse raises damage taken; bosses shrug off control', () => {
    const map: StatusMap = {};
    applyStatusTo(map, { id: 'stun', time: 2 });
    applyStatusTo(map, { id: 'stun', time: 0.5 });
    expect(map.stun!.time).toBe(2);
    tickStatuses(map, 2.1);
    expect(applyStatusTo(map, { id: 'stun' })).toBe('immune');

    const cursed: StatusMap = {};
    for (let i = 0; i < 6; i++) applyStatusTo(cursed, { id: 'curse' });
    expect(damageTakenFactor(cursed)).toBeCloseTo(1 + STATUSES.curse.maxStacks * STATUS_TUNING.cursePerStack);

    const boss: StatusMap = {};
    expect(applyStatusTo(boss, { id: 'stun' }, true)).toBe('immune');
    expect(applyStatusTo(boss, { id: 'slow' }, true)).toBe('immune');
    expect(applyStatusTo(boss, { id: 'burn', power: 1 }, true)).toBe('applied'); // but they do burn
  });

  it('in the game: burns tick on enemies, the v0.2 slow payload becomes chill, enemy hits mark the player', () => {
    const g = createGame('archer', 1);
    const e = spawnEnemy(g, 'knight', 400, 400);
    e.armorHp = 0;
    applyStatus(e, { apply: [{ id: 'burn', stacks: 3, power: 4 }], slowMul: 0.5, slowT: 2 }, g);
    expect(e.statuses.slow!.stacks).toBe(slowStacks(0.5));
    for (let i = 0; i < 95; i++) updateStatuses(g, 1 / 60); // damage lands in half-second ticks: three of them by now
    expect(e.maxHp - e.hp).toBeGreaterThan(11); // 12 fire damage per second
    const wolf = spawnEnemy(g, 'wolf', 410, 400);
    hurtTarget(g, g.player, 5, true, wolf);
    expect(g.player.statuses.bleed).toBeDefined();
  });
});

describe('armor breaks', () => {
  it('armor soaks a share of each hit until it is gone, then everything goes through', () => {
    const first = throughArmor(100, 50, 0.6);
    expect(first).toEqual({ dealt: 50, armorHp: 0, broke: true }); // wanted to soak 60, only had 50
    expect(throughArmor(10, 50, 0.6)).toEqual({ dealt: 4, armorHp: 44, broke: false });
    expect(throughArmor(10, 0, 0.6)).toEqual({ dealt: 10, armorHp: 0, broke: false });
  });

  it('a knight takes reduced damage until his armor breaks', () => {
    const g = createGame('viking', 1);
    const k = spawnEnemy(g, 'knight', 400, 400);
    expect(k.armorMax).toBe(Math.round(k.maxHp * ARMOR.knight!.frac));
    damageEnemy(g, k, 20, false, 0, 0, 'attack', 'fire'); // fire: no physical resistance in the way
    expect(k.maxHp - k.hp).toBeCloseTo(20 * (1 - ARMOR.knight!.reduction));
    damageEnemy(g, k, 1000, false, 0, 0, 'attack', 'fire');
    expect(k.armorHp).toBe(0);
  });

  it('a shield bearer only breaks from behind', () => {
    expect(fromBehind(1, 0, 0)).toBe(true); // hit travels the way he faces: it came from behind
    expect(fromBehind(-1, 0, 0)).toBe(false);
    expect(fromBehind(0, 0, 0)).toBe(false); // no direction (area damage)
    const g = createGame('archer', 1);
    const s = spawnEnemy(g, 'shieldBearer', 400, 400);
    s.angle = 0; // facing +x
    const armor = s.armorHp;
    damageEnemy(g, s, 10, false, -60, 0, 'attack', 'holy'); // from the front (holy: he has no opinion about it)
    expect(s.armorHp).toBe(armor);
    expect(s.maxHp - s.hp).toBeCloseTo(10 * (1 - ARMOR.shieldBearer!.reduction));
    damageEnemy(g, s, 1000, false, 60, 0, 'attack', 'fire'); // from behind
    expect(s.armorHp).toBe(0);
  });
});
