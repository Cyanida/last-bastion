import { describe, expect, it } from 'vitest';
import { RUN_LOG } from '../src/config/game';
import { createGame, summarizeRun } from '../src/game';
import { actionForKey } from '../src/input/mapping';
import { actMinutes, exportRunLogs, keepRuns, quietStretches, waveAt, type RunLog } from '../src/logic/runlog';
import { applyRun, defaultSave, exportSave, importSave, migrate } from '../src/logic/save';
import { simulateRun } from '../src/sim/bot';
import { damagePlayer } from '../src/systems/combat';
import { markBored } from '../src/systems/runlog';
import { spawnEnemy } from '../src/systems/spawning';

/** A hand-made log: three waves of 60 s with 10 s breaks, one level-up and one relic. */
const LOG: RunLog = {
  at: '2026-09-22T20:00:00.000Z', classId: 'viking', tier: 0, arena: 'courtyard', seed: 7, daily: null, curses: [], oath: 0, trait: 'none',
  time: 220, wave: 3, level: 4, kills: 50, end: 'slain', won: false, cause: 'an Orc', relics: { whetstone: 2 }, relicShares: { whetstone: [12.5, 0, 0] }, talents: [], upgrades: [],
  waves: [[10, 70, 12, 5], [80, 140, 30, 0], [150, 0, 99, 2]],
  marks: [[40, 'level', '2'], [100, 'relic', 'Whetstone II'], [200, 'bored', 'wave 3']],
};

describe('run log (v0.6)', () => {
  const run = simulateRun('viking', 11, {}, 0, 240);
  const log = run.log!;

  it('a run records one row per wave, in order, with its clear time, damage and quiet time', () => {
    expect(log.waves.length).toBe(run.wave);
    log.waves.forEach(([start, end, dmg, quiet], i) => {
      if (i > 0) expect(start).toBeGreaterThan(log.waves[i - 1][0]);
      if (i < run.wavesCleared) expect(end).toBeGreaterThanOrEqual(start);
      expect(dmg).toBeGreaterThanOrEqual(0);
      expect(quiet).toBeGreaterThanOrEqual(0);
      expect(quiet).toBeLessThanOrEqual((end || log.time) - start + 30); // the breather after a wave counts toward it
    });
    expect(log.waves.slice(run.wavesCleared).every((w) => w[1] === 0)).toBe(true);
  });

  it('marks every level-up and relic, in time order', () => {
    const times = log.marks.map((m) => m[0]);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(log.marks.filter((m) => m[1] === 'level').length).toBe(run.level - 1);
    expect(log.marks.filter((m) => m[1] === 'relic').length).toBe(run.relicsFound!.length);
    for (const m of log.marks.filter((m) => m[1] === 'relic')) expect(m[2]).not.toMatch(/ (I|II|III)$/); // v0.7: the name; tier-ups are 'attune' marks
    expect(log.marks.some((m) => m[1] === 'board')).toBe(true); // Act I's quest board comes up at the start
  });

  it('keeps the build and how the run ended', () => {
    expect(log.classId).toBe('viking');
    expect(log.level).toBe(run.level);
    expect(Object.keys(log.relics)).toEqual(run.relics);
    expect(log.end).toBe(run.time < 240 ? 'slain' : 'quit'); // died, or the sim stopped it at 4 minutes
    if (log.end === 'slain') expect(log.cause).not.toBe('');
  });

  it('records what dealt the killing blow, and bored marks with the moment', () => {
    const g = createGame('archer', 3);
    markBored(g);
    expect(g.log.marks.at(-1)).toEqual([0, 'bored', expect.stringContaining('wave 0')]);
    const orc = spawnEnemy(g, 'peasant', g.player.x + 40, g.player.y);
    g.lastStand = 'off';
    damagePlayer(g, 1e6, true, orc);
    expect(g.over).toBe(true);
    const done = summarizeRun(g).log!;
    expect(done.end).toBe('slain');
    expect(done.cause).toContain(orc.def.name);
    const burnt = createGame('archer', 3);
    burnt.lastStand = 'off';
    damagePlayer(burnt, 1e6, true, null, 'fire on the ground');
    expect(summarizeRun(burnt).log!.cause).toBe('fire on the ground');
  });

  it('the save keeps the last RUN_LOG.keep runs, survives export and import, and drops broken entries', () => {
    let save = defaultSave();
    for (let i = 0; i < RUN_LOG.keep + 3; i++) save = applyRun(save, { ...run, log: { ...log, seed: i } }).save;
    expect(save.runs.length).toBe(RUN_LOG.keep);
    expect(save.runs[0].seed).toBe(3); // oldest first; the first three fell off
    const back = importSave(exportSave(save))!;
    expect(back.runs).toEqual(save.runs);
    const raw = JSON.parse(exportSave(save));
    raw.runs = [LOG, { classId: 'nobody' }, 'junk', { ...LOG, waves: [[1, 2]], marks: [[1, 'dance', 'x'], [2, 'relic', 'Whetstone']] }];
    const read = migrate(raw).runs;
    expect(read.length).toBe(2);
    expect(read[1].waves).toEqual([]); // a malformed row is dropped, not guessed at
    expect(read[1].marks).toEqual([[2, 'relic', 'Whetstone']]);
    expect(migrate({ ...raw, runs: undefined }).runs).toEqual([]); // a v0.5 save has none
    expect(keepRuns([], undefined)).toEqual([]);
  });

  it('reads Acts and quiet stretches off the timeline', () => {
    expect(actMinutes(LOG, 2)).toEqual([140 / 60, 70 / 60]); // waves 1-2: 10 s to wave 3's start; wave 3: to the end
    expect(waveAt(LOG, 5)).toBe(0);
    expect(waveAt(LOG, 80)).toBe(2);
    // beats: 0, 10, 40, 80, 100, 150, 220 (the bored mark is not one): the longest gap is 150 -> 220 in wave 3
    expect(quietStretches(LOG, 2)).toEqual([{ from: 150, length: 70, wave: 3 }, { from: 100, length: 50, wave: 2 }]);
    const file = JSON.parse(exportRunLogs([LOG]));
    expect(file.format).toMatch(/run log v1/);
    expect(file.runs[0]).toEqual(LOG);
  });

  it('F8 is the boredom key', () => {
    expect(actionForKey('F8')).toBe('bored');
  });
});
