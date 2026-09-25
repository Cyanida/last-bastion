import { describe, expect, it } from 'vitest';
import { createGame } from '../src/game';
import { applyChoice, intentCommand, levelHand, levelRerolls, step } from '../src/sim/commands';

const idle = { moveX: 0, moveY: 0, aimX: 0, aimY: 0, ability: false, utility: false, showAim: false };

describe('v0.8 command layer (#25)', () => {
  it('step applies the intent, counts the tick, and a tick without an intent keeps the last one', () => {
    const g = createGame('paladin', 5);
    step(g, [intentCommand(g, { ...idle, moveX: 1 })]);
    expect(g.tick).toBe(1);
    expect(g.input.moveX).toBe(1);
    step(g, []);
    expect(g.tick).toBe(2);
    expect(g.input.moveX).toBe(1);
  });

  it('a level-up hand is dealt once, kept until answered, and a pick clears it', () => {
    const g = createGame('archer', 9);
    g.pendingLevelUps = 2;
    const hand = levelHand(g);
    expect(levelHand(g)).toBe(hand);
    expect(applyChoice(g, { c: 'levelUp', index: 0 })).toBe(true);
    expect(g.pendingLevelUps).toBe(1);
    expect(g.levelHand).toBeNull();
    expect(levelHand(g)).not.toBe(hand);
  });

  it('rerolls use the free ones first, then gold at a doubling price, and reset on a pick', () => {
    const g = createGame('viking', 3);
    g.pendingLevelUps = 1;
    g.rerolls = 1;
    g.gold = 100;
    expect(applyChoice(g, { c: 'levelReroll' })).toBe(true);
    expect(g.gold).toBe(100);
    expect(applyChoice(g, { c: 'levelReroll' })).toBe(true);
    expect(g.gold).toBe(85);
    expect(levelRerolls(g)).toEqual({ free: 0, paid: 1 });
    applyChoice(g, { c: 'levelUp', index: 0 });
    expect(g.levelRerolls).toBeNull();
  });

  it('a replayed reroll draws the same cards as the screen did', () => {
    const screen = createGame('angel', 77);
    const replay = createGame('angel', 77);
    screen.pendingLevelUps = replay.pendingLevelUps = 1;
    levelHand(screen); // the screen deals on open; the replay never looks
    applyChoice(screen, { c: 'levelReroll' });
    applyChoice(replay, { c: 'levelReroll' });
    expect(levelHand(replay)).toEqual(levelHand(screen));
  });
});
