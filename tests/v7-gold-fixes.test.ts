// a zone ahead of UTC, where the first hours of a local day are still the previous UTC day
process.env.TZ = 'Europe/Amsterdam';

import { afterEach, describe, expect, it, vi } from 'vitest';
import { META } from '../src/config/economy';
import { createGame } from '../src/game';
import { todayString } from '../src/logic/acts';
import { curseMultiplier } from '../src/logic/curses';
import { defaultSave } from '../src/logic/save';
import { banked } from '../src/systems/testMode';

describe('v0.7.5 gold fixes (#109)', () => {
  afterEach(() => vi.useRealTimers());

  it('the Gallows adds to the gold a cursed run earns while it plays', () => {
    const curses = ['ironHorde', 'swarm'] as const;
    const plain = createGame('paladin', 1, { curses: [...curses] });
    const gallows = createGame('paladin', 1, { curses: [...curses], meta: { curseBonus: 3 } });
    expect(plain.vars.curseMult).toBeCloseTo(curseMultiplier([...curses]));
    expect(gallows.vars.curseMult).toBeCloseTo(curseMultiplier([...curses]) + 2 * 3 * META.curseBonus.perRank);
    expect(createGame('paladin', 1, { meta: { curseBonus: 3 } }).vars.curseMult).toBe(1); // no curses, nothing to add to
  });

  it('a run is banked on the local day, the one the Daily Trial uses', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 25, 0, 30)); // just past local midnight
    const g = createGame('paladin', 1, { curses: ['ironHorde'], daily: todayString(new Date()) });
    g.gold = g.goldStart + 500;
    expect(banked(defaultSave(), g, new Date())!.save.dailyGold.date).toBe('2026-09-25');
  });
});
