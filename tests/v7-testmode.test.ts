import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { talentsFor } from '../src/config/talents';
import { createGame } from '../src/game';
import { defaultSave } from '../src/logic/save';
import { botStep } from '../src/sim/bot';
import { banked, createTestRun, isTestRun, type TestSetup } from '../src/systems/testMode';

const row0 = talentsFor('viking').filter((n) => n.row === 0).slice(0, 2).map((n) => n.id);
const keystone = talentsFor('viking').find((n) => n.keystone)!.id; // needs points in its branch first: cannot be taken
const SETUP: TestSetup = { classId: 'viking', arena: 'keep', act: 2, wave: 4, level: 12, talents: [keystone, ...row0] };

describe('test mode (v0.7.1)', () => {
  it('starts a run at the chosen Act, wave, arena, level and talents', () => {
    const g = createTestRun(SETUP, 11);
    expect(isTestRun(g)).toBe(true);
    expect(isTestRun(createGame('viking', 11))).toBe(false);
    expect(g.player.cls.id).toBe('viking');
    expect(g.act).toBe(2);
    expect(g.arena.id).toBe('keep');
    expect(g.wave).toBe(13); // wave 4 of Act II comes next
    expect(g.player.level).toBe(12);
    expect(g.player.hp).toBe(g.player.stats.hp);
    expect(g.player.talents).toEqual(row0);
    expect(g.talentPoints).toBeGreaterThanOrEqual(1); // the keystone it could not take stays a point
  });

  it('never grants rewards: a played test run leaves the save exactly as it was', () => {
    const save = defaultSave();
    const before = JSON.stringify(save);
    const play = (g: ReturnType<typeof createGame>) => {
      for (let i = 0; i < 60 * 90 && !g.over; i++) botStep(g);
      return g;
    };
    const test = play(createTestRun({ ...SETUP, act: 1, wave: 1, arena: 'courtyard', level: 1, talents: [] }, 5));
    expect(test.kills).toBeGreaterThan(0); // it was played: there was something to pay
    expect(banked(save, test)).toBeNull();
    expect(JSON.stringify(save)).toBe(before);
    // the same play as a real run does pay, so the guard is what stops it
    const real = banked(save, play(createGame('viking', 5)))!;
    expect(real.save.classes.viking.runs).toBe(1);
    expect(real.save.runs.length).toBe(1);
    expect(real.save.classes.viking.xp).toBeGreaterThan(0);
  });

  it('main.ts has no other way to rewards: every applyRun goes through banked, and a test run ends before the results', () => {
    const main = readFileSync('src/main.ts', 'utf8');
    expect(main).not.toMatch(/applyRun\(/);
    expect(main).toMatch(/function endRun\(g: Game\): void \{\s+if \(isTestRun\(g\)\) return/);
  });
});
