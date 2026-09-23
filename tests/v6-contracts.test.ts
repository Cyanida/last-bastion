import { describe, expect, it } from 'vitest';
import { CONTRACTS, CONTRACTS_PER_WEEK } from '../src/config/contracts';
import { advanceContracts, currentProgress, weekKey, weeklyContracts, type ContractRun } from '../src/logic/contracts';
import { closestGoals } from '../src/logic/goals';
import { applyRun, defaultSave, type RunSummary } from '../src/logic/save';

const RUN: ContractRun = { classId: 'viking', kills: 0, elites: 0, bosses: 0, quests: 0, commanders: 0, wave: 0, acts: 0, evolutions: 0, relics: 0 };

describe('weekly contract seeding (v0.6)', () => {
  it('a week runs Monday to Sunday', () => {
    expect(weekKey('2026-09-21')).toBe(weekKey('2026-09-27')); // Monday .. Sunday
    expect(weekKey('2026-09-28')).not.toBe(weekKey('2026-09-27')); // the next Monday
  });

  it('the same week gives everyone the same three different contracts; weeks differ', () => {
    const w = weekKey('2026-09-23');
    const a = weeklyContracts(w);
    expect(weeklyContracts(w)).toEqual(a);
    expect(a).toHaveLength(CONTRACTS_PER_WEEK);
    expect(new Set(a.map((c) => c.kind)).size).toBe(CONTRACTS_PER_WEEK);
    for (const c of a) {
      expect(CONTRACTS[c.kind].targets).toContain(c.target);
      expect(c.runes).toBeGreaterThan(0);
      expect(c.text).not.toMatch(/\{/);
      expect(c.classId !== null).toBe(c.kind === 'waveWith');
    }
    const weeks = Array.from({ length: 8 }, (_, i) => JSON.stringify(weeklyContracts(`W${3000 + i}`)));
    expect(new Set(weeks).size).toBeGreaterThan(4);
  });
});

describe('weekly contract completion (v0.6)', () => {
  // a week whose contracts include a summing one, found by search so the test does not depend on the seed table
  const week = Array.from({ length: 50 }, (_, i) => `W${4000 + i}`).find((w) => weeklyContracts(w).some((c) => CONTRACTS[c.kind].sum && c.kind !== 'evolve'))!;
  const contracts = weeklyContracts(week);
  const i = contracts.findIndex((c) => CONTRACTS[c.kind].sum && c.kind !== 'evolve');
  const c = contracts[i];
  const half = { ...RUN, [c.kind]: Math.ceil(c.target / 2) } as ContractRun;

  it('sums over the week, pays once when a run completes it, and caps the count', () => {
    const one = advanceContracts({ week, progress: [0, 0, 0] }, week, half);
    expect(one.runes).toBe(0);
    expect(one.state.progress[i]).toBe(Math.ceil(c.target / 2));
    const two = advanceContracts(one.state, week, half);
    expect(two.completed).toEqual([c]);
    expect(two.runes).toBe(c.runes);
    expect(two.state.progress[i]).toBe(c.target);
    expect(advanceContracts(two.state, week, half).runes).toBe(0); // done is done
  });

  it('a new week starts from nothing', () => {
    expect(currentProgress({ week, progress: [5, 5, 5] }, 'W1')).toEqual([0, 0, 0]);
    expect(advanceContracts({ week: 'W1', progress: [99, 99, 99] }, week, RUN).state.progress).toEqual([0, 0, 0]);
  });

  it('a best-run contract takes the best run, not the sum; the class one counts only that class', () => {
    const w = Array.from({ length: 200 }, (_, k) => `W${5000 + k}`).find((x) => weeklyContracts(x).some((k) => k.kind === 'waveWith'))!;
    const j = weeklyContracts(w).findIndex((k) => k.kind === 'waveWith');
    const wc = weeklyContracts(w)[j];
    const other = wc.classId === 'viking' ? 'archer' : 'viking';
    const s1 = advanceContracts({ week: w, progress: [0, 0, 0] }, w, { ...RUN, classId: other, wave: 40 }).state;
    expect(s1.progress[j]).toBe(0);
    const s2 = advanceContracts(s1, w, { ...RUN, classId: wc.classId!, wave: wc.target - 1 }).state;
    const s3 = advanceContracts(s2, w, { ...RUN, classId: wc.classId!, wave: wc.target - 2 }).state;
    expect(s3.progress[j]).toBe(wc.target - 1);
  });

  it('banking a run advances the contracts and pays their Runes with the run', () => {
    const date = '2026-09-23';
    const wk = weeklyContracts(weekKey(date));
    const big: RunSummary = { classId: wk.find((k) => k.classId)?.classId ?? 'viking', tier: 0, wave: 40, wavesCleared: 40, kills: 5000, time: 2000, level: 30, gold: 0, bosses: Array(12).fill('dragon'), elites: 200, flawlessBosses: 0, relics: Array(9).fill('whetstone'), abilityUpgrades: 3, wave10Time: 300, quests: 9, commanders: 30, actsCleared: 4, evolutions: ['meteorArrow', 'stormVolley', 'huntersMark'] };
    const r = applyRun(defaultSave(), big, date);
    expect(r.contracts).toHaveLength(3);
    const quiet = applyRun(r.save, big, date);
    expect(quiet.contracts).toHaveLength(0);
    expect(r.runes - quiet.runes).toBe(wk.reduce((n, k) => n + k.runes, 0));
  });
});

describe('the closest goals (v0.6)', () => {
  it('three goals, nearest first, none already done', () => {
    const save = { ...defaultSave(), gold: 50 };
    const goals = closestGoals(save, 'archer', weekKey('2026-09-23'));
    expect(goals).toHaveLength(3);
    for (let i = 1; i < goals.length; i++) expect(goals[i - 1].frac).toBeGreaterThanOrEqual(goals[i].frac);
    expect(goals.every((g) => g.frac >= 0 && g.frac < 1 && g.text.length > 0)).toBe(true);
  });

  it('after a first win it points at the next Oath', () => {
    const save = { ...defaultSave(), wins: { ...defaultSave().wins, archer: 1 } };
    const goals = closestGoals(save, 'archer', 'W1', 20);
    expect(goals.some((g) => g.text.startsWith('Keep Oath 1'))).toBe(true);
    expect(goals.some((g) => g.text.startsWith('Beat the Usurper'))).toBe(false);
  });
});
