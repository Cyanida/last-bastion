import { describe, expect, it } from 'vitest';
import { readRunLog } from '../src/logic/runlog';
import { defaultSave, exportSave, importSave } from '../src/logic/save';

const XSS = '<img src=x onerror=alert(1)>';
const run = (daily: unknown) => ({ at: '', classId: 'paladin', tier: 0, arena: 'courtyard', seed: 1, daily, curses: [], oath: 0, trait: 'none', time: 60, wave: 3, level: 2, kills: 5, end: 'slain', cause: '', relics: {}, talents: [], upgrades: [], waves: [], marks: [] });

describe('shared saves carry no markup (#105)', () => {
  it('an imported save keeps only titles the game can award', () => {
    const raw = { ...JSON.parse(exportSave(defaultSave())), title: XSS, titles: [XSS, 'the Steadfast', 'Initiate'] };
    const save = importSave(JSON.stringify(raw))!;
    expect(save.title).toBeNull();
    expect(save.titles).toEqual(['the Steadfast', 'Initiate']);
    expect(importSave(JSON.stringify({ ...raw, title: 'Grandmaster' }))!.title).toBe('Grandmaster'); // a mastery title is real too
  });

  it("a run log's Daily Trial is a date or nothing", () => {
    expect(readRunLog(run(XSS))!.daily).toBeNull();
    expect(readRunLog(run('2026-09-25'))!.daily).toBe('2026-09-25');
    const raw = { ...JSON.parse(exportSave(defaultSave())), runs: [run(XSS)] };
    expect(importSave(JSON.stringify(raw))!.runs[0].daily).toBeNull();
  });
});
