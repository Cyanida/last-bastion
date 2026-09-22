import { describe, expect, it } from 'vitest';
import { ELITES } from '../src/config/elites';
import { ENEMIES } from '../src/config/enemies';
import { directWave } from '../src/logic/director';
import { GAME } from '../src/config/game';
import { WAVES } from '../src/config/waves';
import { createGame } from '../src/game';
import { eliteChance } from '../src/logic/elites';
import { catchUpMult, enemyDmgMult, enemyHpMult, enemyXpMult, expectedLevel, waveClearXp, xpToNext } from '../src/logic/formulas';
import { enemyCount } from '../src/logic/waves';
import { gainXp } from '../src/systems/leveling';
import { spawnEnemy } from '../src/systems/spawning';

describe('XP curve (v0.4)', () => {
  it('XP to the next level grows linearly and never faster', () => {
    expect(xpToNext(1)).toBe(GAME.xpBase + GAME.xpPerLevel);
    const steps = Array.from({ length: 40 }, (_, l) => xpToNext(l + 2) - xpToNext(l + 1));
    for (const d of steps) expect(d).toBe(GAME.xpPerLevel);
  });

  it('the expected level follows the target pace: ~1 per wave in Act I, slower later', () => {
    expect(expectedLevel(1)).toBe(1);
    expect(expectedLevel(11)).toBeCloseTo(1 + 10 * WAVES.pace.levelsPerWave[0]);
    expect(expectedLevel(21)).toBeCloseTo(1 + 10 * WAVES.pace.levelsPerWave[0] + 10 * WAVES.pace.levelsPerWave[1]);
    const act3Step = expectedLevel(26) - expectedLevel(25);
    expect(act3Step).toBeCloseTo(WAVES.pace.levelsPerWave[2]);
    expect(act3Step).toBeLessThan(expectedLevel(2) - expectedLevel(1));
    expect(expectedLevel(41) - expectedLevel(31)).toBeCloseTo(10 * WAVES.pace.levelsPerWave[2]); // Act III's pace holds on
  });

  it('catch-up is a mild bonus below the expected level, capped, and never a penalty above it', () => {
    expect(catchUpMult(30, 5)).toBe(1); // far ahead
    expect(catchUpMult(Math.round(expectedLevel(12)), 12)).toBe(1); // on pace
    const behind2 = catchUpMult(Math.floor(expectedLevel(12)) - 2, 12);
    expect(behind2).toBeCloseTo(1 + 2 * WAVES.pace.catchUpPerLevel);
    expect(catchUpMult(1, 30)).toBe(1 + WAVES.pace.catchUpMax);
  });

  it('enemy XP value steps per Act (the director already makes waves richer); wave clears pay a share of a level', () => {
    expect(enemyXpMult(1)).toBe(1);
    expect(enemyXpMult(10)).toBeGreaterThanOrEqual(enemyXpMult(5));
    expect(enemyXpMult(11)).toBeCloseTo(enemyXpMult(10) * WAVES.xp.actDecay); // the Act step
    const g = createGame('archer', 1);
    g.wave = 12;
    expect(spawnEnemy(g, 'peasant', 1, 1).xp).toBeCloseTo(enemyXpMult(12));
    expect(waveClearXp(5)).toBeGreaterThan(0);
    expect(waveClearXp(25)).toBeGreaterThan(waveClearXp(5));
  });

  it("the pace holds against the director's real waves: within 1.5 levels of the target through wave 30", () => {
    // feed a run every enemy the director would spawn (elites worth x4) plus the clear bonus, wave by wave
    const g = createGame('paladin', 1);
    for (let w = 1; w <= 30; w++) {
      g.wave = w;
      const plan = directWave({ seed: 7, wave: w, classId: 'paladin' });
      for (const u of plan.units) gainXp(g, ENEMIES[u.id].xp * (u.affixes.length ? ELITES.xpMult : 1) * enemyXpMult(w));
      gainXp(g, waveClearXp(w));
      if (w % 10 === 0) expect(Math.abs(g.player.level - expectedLevel(w + 1))).toBeLessThanOrEqual(1.5);
    }
    expect(g.player.level).toBeGreaterThan(20); // and the curve does not stall
  });
});

describe('one scaling axis per Act', () => {
  it('count ramps through Act I and only creeps afterwards', () => {
    expect(enemyCount(9) - enemyCount(2)).toBeGreaterThan(30);
    expect(enemyCount(19) - enemyCount(12)).toBeLessThan(12);
    expect(enemyCount(29) - enemyCount(22)).toBeLessThan(12);
    for (let w = 11; w < 40; w++) if (w % 5 && (w + 1) % 5) expect(enemyCount(w + 1)).toBeGreaterThan(enemyCount(w)); // still monotonic
  });

  it('HP and damage grow fastest in Act II, gently in Acts I and III, and quadratically far beyond', () => {
    const slope = (f: (w: number) => number, a: number, b: number) => (f(b) - f(a)) / (b - a);
    expect(enemyHpMult(1)).toBe(1);
    expect(slope(enemyHpMult, 12, 19)).toBeGreaterThan(slope(enemyHpMult, 2, 9) * 1.8);
    expect(slope(enemyHpMult, 22, 29)).toBeLessThan(slope(enemyHpMult, 12, 19));
    expect(slope(enemyDmgMult, 12, 19)).toBeGreaterThan(slope(enemyDmgMult, 2, 9) * 1.8);
    expect(slope(enemyHpMult, 40, 45)).toBeGreaterThan(slope(enemyHpMult, 22, 29) * 2); // the tail: every run ends
    for (let w = 1; w < 60; w++) expect(enemyHpMult(w + 1)).toBeGreaterThan(enemyHpMult(w));
  });

  it('elites are the Act II axis: the chance climbs fastest there', () => {
    const grow = (a: number, b: number) => eliteChance(b, 1) - eliteChance(a, 1);
    expect(grow(12, 18)).toBeCloseTo(grow(4, 10) * ELITES.actMult[1], 3);
    expect(eliteChance(60, 3)).toBe(ELITES.maxChance);
  });
});
