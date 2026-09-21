import { describe, expect, it } from 'vitest';
import { shouldDownshift } from '../src/core/quality';
import { actionForKey, gamepadActions, joystickVector, keyboardMove, mergeIntents, stickVector, type Intent } from '../src/input/mapping';
import { densestCluster, resolveAim } from '../src/logic/aim';
import { defaultSave, migrate, SAVE_VERSION } from '../src/logic/save';

const idle: Intent = { moveX: 0, moveY: 0, ability: false, aim: { kind: 'auto' }, showAim: false };

describe('input mapping', () => {
  it('keys map to actions, including number picks; unknown keys map to nothing', () => {
    expect(actionForKey('Escape')).toBe('pause');
    expect(actionForKey('KeyP')).toBe('pause');
    expect(actionForKey('KeyM')).toBe('mute');
    expect(actionForKey('Enter')).toBe('confirm');
    expect(actionForKey('KeyR')).toBe('reroll');
    expect(actionForKey('Digit2')).toBe('pick2');
    expect(actionForKey('Numpad3')).toBe('pick3');
    expect(actionForKey('KeyW')).toBeNull();
    expect(actionForKey('Digit0')).toBeNull();
  });

  it('WASD and arrows give a unit move vector; opposite keys cancel', () => {
    expect(keyboardMove(new Set(['KeyD']))).toEqual({ x: 1, y: 0 });
    expect(keyboardMove(new Set(['ArrowUp']))).toEqual({ x: 0, y: -1 });
    const diag = keyboardMove(new Set(['KeyW', 'KeyA']));
    expect(Math.hypot(diag.x, diag.y)).toBeCloseTo(1);
    expect(keyboardMove(new Set(['KeyA', 'KeyD']))).toEqual({ x: 0, y: 0 });
  });

  it('sticks have a radial dead zone and still reach full speed', () => {
    expect(stickVector(0.1, 0.1)).toEqual({ x: 0, y: 0 });
    expect(stickVector(1, 0).x).toBeCloseTo(1);
    const half = stickVector(0.6, 0);
    expect(half.x).toBeGreaterThan(0);
    expect(half.x).toBeLessThan(0.6); // rescaled from the edge of the dead zone
    expect(Math.hypot(...Object.values(stickVector(5, 5)))).toBeCloseTo(1); // clamped
  });

  it('the floating joystick is relative to where the thumb landed, and the knob stays inside the base', () => {
    const still = joystickVector(100, 300, 102, 301, 56);
    expect(still.x).toBe(0);
    const right = joystickVector(100, 300, 400, 300, 56);
    expect(right.x).toBeCloseTo(1);
    expect(right.y).toBeCloseTo(0);
    expect(right.knobX).toBeCloseTo(156); // clamped to the radius
    const up = joystickVector(100, 300, 100, 272, 56);
    expect(up.y).toBeLessThan(0);
    expect(Math.abs(up.y)).toBeLessThan(1);
  });

  it('gamepad buttons fire actions on the press edge only', () => {
    const released = Array(12).fill(false);
    const start = released.map((_, i) => i === 9);
    expect(gamepadActions(released, start)).toEqual(['pause']);
    expect(gamepadActions(start, start)).toEqual([]);
    expect(gamepadActions(released, released.map((_, i) => i === 0 || i === 3))).toEqual(['confirm', 'pick2']);
  });

  it('merging devices: strongest movement wins, anyone can cast, aim follows the caster', () => {
    const keyboard: Intent = { ...idle, moveX: 1, aim: { kind: 'screen', x: 10, y: 20 }, showAim: true };
    const finger: Intent = { ...idle, moveX: 0.4, ability: true, aim: { kind: 'offset', dx: 5, dy: 0 } };
    const merged = mergeIntents([keyboard, finger, idle]);
    expect(merged.moveX).toBe(1);
    expect(merged.ability).toBe(true);
    expect(merged.aim).toEqual({ kind: 'offset', dx: 5, dy: 0 });
    expect(mergeIntents([keyboard, idle, idle]).aim.kind).toBe('screen');
    expect(mergeIntents([idle, idle, idle])).toEqual(idle);
  });
});

describe('auto-aim', () => {
  const me = { x: 0, y: 0 };
  const lone = { x: 60, y: 0 };
  const pack = [{ x: 300, y: 0 }, { x: 320, y: 10 }, { x: 310, y: -15 }, { x: 290, y: 20 }];

  it('prefers the densest cluster in range over the nearest enemy', () => {
    const aim = densestCluster([lone, ...pack], me, 500, 80)!;
    expect(aim.x).toBeGreaterThan(280);
    expect(aim.x).toBeLessThan(330);
  });

  it('ignores what is out of range, and returns null when nothing is in range', () => {
    expect(densestCluster([lone, ...pack], me, 100, 80)).toEqual(lone);
    expect(densestCluster(pack, me, 100, 80)).toBeNull();
    expect(densestCluster([], me, 100, 80)).toBeNull();
  });

  it('resolves every aim kind to a world point', () => {
    const toWorld = (x: number, y: number) => ({ x: x * 2 + 1000, y: y * 2 });
    const auto = { x: 300, y: 0 };
    expect(resolveAim({ kind: 'screen', x: 10, y: 5 }, me, auto, 400, toWorld, 2)).toEqual({ x: 1020, y: 10 });
    expect(resolveAim({ kind: 'auto' }, me, auto, 400, toWorld, 2)).toEqual(auto);
    expect(resolveAim({ kind: 'auto' }, me, null, 400, toWorld, 2)).toEqual(me); // nobody around: cast on yourself
    expect(resolveAim({ kind: 'offset', dx: 10, dy: -10 }, me, auto, 400, toWorld, 2)).toEqual({ x: 320, y: -20 });
    expect(resolveAim({ kind: 'stick', x: 0, y: -0.5 }, me, auto, 400, toWorld, 2)).toEqual({ x: 0, y: -200 });
  });
});

describe('quality', () => {
  it('auto mode only downshifts when frames are really slow', () => {
    expect(shouldDownshift(16.7)).toBe(false);
    expect(shouldDownshift(19)).toBe(false);
    expect(shouldDownshift(28)).toBe(true);
  });
});

describe('save migration v0.2 -> v0.3', () => {
  // a real v0.2 save (version 2): no quality, curses, daily, commander counters
  const v2 = {
    version: 2, gold: 966, meta: { hp: 1, str: 2 }, achievements: ['wave10', 'firstBlood'], tierUnlocked: 1,
    classes: { paladin: { bestWave: 7, runs: 3, kills: 300, time: 900, xp: 410 }, archer: { bestWave: 12, runs: 1, kills: 90, time: 200, xp: 106 } },
    relicPicks: { whetstone: 4 },
    counters: { kills: 390, bosses: 5, elites: 12, goldEarned: 1200, flawlessBosses: 1, maxRelics: 3, maxAbilityUpgrades: 2, fastestWave10: 340, bossKinds: ['blackKnight', 'abbot'] },
    settings: { arena: 'graveyard', tier: 1 },
  };

  it('keeps everything a v0.2 save had', () => {
    const s = migrate(v2);
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.gold).toBe(966);
    expect(s.meta).toEqual({ hp: 1, str: 2 });
    expect(s.achievements).toEqual(['wave10', 'firstBlood']);
    expect(s.tierUnlocked).toBe(1);
    expect(s.classes.paladin).toEqual(v2.classes.paladin);
    expect(s.classes.archer.bestWave).toBe(12);
    expect(s.relicPicks.whetstone).toBe(4);
    expect(s.counters.bossKinds).toEqual(['blackKnight', 'abbot']);
    expect(s.counters.fastestWave10).toBe(340);
    expect(s.settings.arena).toBe('graveyard');
    expect(s.settings.tier).toBe(1);
  });

  it('gives the new v0.3 fields their defaults', () => {
    const s = migrate(v2);
    const fresh = defaultSave();
    expect(s.settings.quality).toBe('auto');
    expect(s.settings.prerelease).toBe(false);
    expect(s.settings.curses).toEqual([]);
    expect(s.daily).toEqual({});
    expect(s.counters.commanders).toBe(fresh.counters.commanders);
    expect(s.counters.actsCleared).toBe(0);
  });

  it('is idempotent, and validates the v0.3 fields too', () => {
    const once = migrate(v2);
    expect(migrate(JSON.parse(JSON.stringify(once)))).toEqual(once);
    const odd = migrate({ version: 3, settings: { quality: 'ultra', curses: ['swarm', 'nonsense', 'swarm'], prerelease: 'yes' }, daily: { '2026-09-21': 9, bogus: 4, '2026-09-22': -1 } });
    expect(odd.settings.quality).toBe('auto');
    expect(odd.settings.curses).toEqual(['swarm']);
    expect(odd.settings.prerelease).toBe(false);
    expect(odd.daily).toEqual({ '2026-09-21': 9 });
  });
});
