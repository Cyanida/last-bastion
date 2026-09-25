import { describe, expect, it } from 'vitest';
import { createGame } from '../src/game';
import { botStep } from '../src/sim/bot';
import { applyChoice, choiceCommand, intentCommand, levelHand, levelRerolls, step, type Command } from '../src/sim/commands';

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
    g.player.pendingLevelUps = 2;
    const hand = levelHand(g);
    expect(levelHand(g)).toBe(hand);
    expect(applyChoice(g, { c: 'levelUp', index: 0 })).toBe(true);
    expect(g.player.pendingLevelUps).toBe(1);
    expect(g.player.levelHand).toBeNull();
    expect(levelHand(g)).not.toBe(hand);
  });

  it('rerolls use the free ones first, then gold at a doubling price, and reset on a pick', () => {
    const g = createGame('viking', 3);
    g.player.pendingLevelUps = 1;
    g.player.rerolls = 1;
    g.player.gold = 100;
    expect(applyChoice(g, { c: 'levelReroll' })).toBe(true);
    expect(g.player.gold).toBe(100);
    expect(applyChoice(g, { c: 'levelReroll' })).toBe(true);
    expect(g.player.gold).toBe(85);
    expect(levelRerolls(g)).toEqual({ free: 0, paid: 1 });
    applyChoice(g, { c: 'levelUp', index: 0 });
    expect(g.player.levelRerolls).toBeNull();
  });

  it('a replayed reroll draws the same cards as the screen did', () => {
    const screen = createGame('angel', 77);
    const replay = createGame('angel', 77);
    screen.player.pendingLevelUps = replay.player.pendingLevelUps = 1;
    levelHand(screen); // the screen deals on open; the replay never looks
    applyChoice(screen, { c: 'levelReroll' });
    applyChoice(replay, { c: 'levelReroll' });
    expect(levelHand(replay)).toEqual(levelHand(screen));
  });
});

describe('v0.8 choice commands (#113)', () => {
  it('a choice for a screen that is not up is refused, changes nothing and is not recorded', () => {
    const g = createGame('paladin', 5);
    g.player.gold = 500;
    expect(step(g, [choiceCommand(g, { c: 'merchantHeal' })], false)).toBe(false);
    expect(step(g, [choiceCommand(g, { c: 'endless' })], false)).toBe(false);
    expect(step(g, [choiceCommand(g, { c: 'levelReroll' })], false)).toBe(false);
    expect([g.player.gold, g.victory, g.player.levelHand, g.replay.length]).toEqual([500, 'none', null, 0]);
  });

  it('a choice is made only on its own tick and for a player in the run', () => {
    const g = createGame('archer', 9);
    g.player.pendingLevelUps = 1;
    expect(step(g, [{ ...choiceCommand(g, { c: 'levelUp', index: 0 }), tick: g.tick + 1 }], false)).toBe(false);
    expect(step(g, [choiceCommand(g, { c: 'levelUp', index: 0 }, 1)], false)).toBe(false);
    expect(g.player.pendingLevelUps).toBe(1);
    const cmd = choiceCommand(g, { c: 'levelUp', index: 0 });
    expect(step(g, [cmd], false)).toBe(true);
    expect(g.player.pendingLevelUps).toBe(0);
    expect(g.tick).toBe(0); // a paused screen's answer takes no time
    expect(g.replay).toEqual([cmd]);
  });

  it('an intent for another tick or player is ignored', () => {
    const g = createGame('paladin', 5);
    step(g, [{ ...intentCommand(g, { ...idle, moveX: 1 }), tick: 7 }, intentCommand(g, { ...idle, moveY: 1 }, 2)]);
    expect([g.input.moveX, g.input.moveY]).toEqual([0, 0]);
  });

  it("the bot's choices land in the replay log with their ticks", () => {
    const g = createGame('viking', 3);
    const log: Command[] = [];
    while (g.player.level < 3 && g.tick < 60 * 120) botStep(g, 0, log);
    botStep(g, 0, log); // the level-up just earned is answered at the start of the next step
    const choices = log.filter((c) => c.kind === 'choice');
    expect(choices.length).toBeGreaterThan(0);
    expect(g.replay).toEqual(choices);
  });
});
