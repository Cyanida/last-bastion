import { describe, expect, it } from 'vitest';
import { createGame } from '../src/game';
import { newChampion, runFor, type Champion } from '../src/logic/champions';
import { fellLine, roadGo, roadOpensOn, roadRun, runMark } from '../src/logic/realmRoad';
import { checkpoint, newRealmRun } from '../src/logic/realmRun';
import { addRelic } from '../src/systems/relics';
import { takeCarry } from '../src/systems/levels';

const SQUIRE = 0, KNIGHT = 1;

/** A Viking whose Marches run cleared `cleared` levels on `tier`, holding its loadout relic and Thorn Mail at tier II. */
function champion(cleared: number, tier = SQUIRE): Champion {
  const c = newChampion('viking');
  let run = newRealmRun(tier, 11);
  const g = createGame('viking', 11, { level: { realm: 'marches', level: 1, relics: ['brimstoneOil'] } });
  addRelic(g, 'thornMail', 'boss');
  g.player.relics.tiers.thornMail = 2;
  for (let n = 0; n < cleared; n++) run = checkpoint(run, 'marches', takeCarry(g), 22 + n)!;
  c.runs.marches = run;
  return c;
}

/** #242: the realm road's side of a realm run: its checkpoint on the road, Continue and Start over in the level panel. */
describe('the realm road shows a run in progress (#242)', () => {
  it('no run, or one still at level 1, marks nothing: level 1 fights, a later level cannot start a run', () => {
    for (const c of [newChampion('viking'), champion(0)]) {
      expect(roadRun(c, 'marches', SQUIRE)).toBeNull();
      expect(roadOpensOn(c, 'marches', KNIGHT)).toBe(KNIGHT);
      expect(roadGo(null, 1, SQUIRE, true)).toEqual({ label: 'Fight!', enabled: true, plays: 1, ask: null, over: null, note: null });
      expect(roadGo(null, 3, SQUIRE, true)).toMatchObject({ label: 'Fight!', enabled: false, over: null, note: 'The run starts at level 1' });
      expect(roadGo(null, 3, SQUIRE, false)).toMatchObject({ enabled: false, note: null }); // a locked level says nothing more
      expect([1, 2, 3].map((n) => runMark(null, n))).toEqual([null, null, null]);
    }
  });

  it('a run past level 1 is read with its checkpoint, tier and the relics it holds at their tiers', () => {
    const run = roadRun(champion(2), 'marches', SQUIRE)!;
    expect(run).toEqual({ level: 3, tier: SQUIRE, here: true, relics: [{ id: 'brimstoneOil', tier: 1 }, { id: 'thornMail', tier: 2 }] });
    expect(roadRun(champion(2), 'ironHold', SQUIRE)).toBeNull(); // one run per realm: another realm has none
  });

  it('the flags before the checkpoint are cleared in this run, the checkpoint glows, the rest are plain', () => {
    const run = roadRun(champion(2), 'marches', SQUIRE);
    expect([1, 2, 3, 4, 7].map((n) => runMark(run, n))).toEqual(['done', 'done', 'next', null, null]);
  });

  it('the panel offers Continue from the checkpoint and Start over, whichever flag is picked', () => {
    const run = roadRun(champion(2), 'marches', SQUIRE);
    const at = roadGo(run, 3, SQUIRE, true);
    expect(at).toMatchObject({ label: 'Continue from level 3', enabled: true, plays: 3, ask: null, note: null });
    expect(at.over).toBe('Start over from level 1? This run and its 2 relics are lost.');
    expect(roadGo(run, 1, SQUIRE, true)).toMatchObject({ label: 'Continue from level 3', plays: 3, note: 'cleared in this run' });
    expect(roadGo(run, 4, SQUIRE, true)).toMatchObject({ label: 'Continue from level 3', plays: 3, enabled: true, note: 'the run stands at level 3' });
  });

  it('Continue plays the run as it stands; Start over is a new run from level 1 on a new seed', () => {
    const c = champion(2);
    const go = roadGo(roadRun(c, 'marches', SQUIRE), 3, SQUIRE, true);
    expect(runFor(c, 'marches', go.plays, SQUIRE, 99)).toBe(c.runs.marches); // the same seed and carry
    expect(runFor(c, 'marches', 1, SQUIRE, 99)).toEqual({ level: 1, tier: SQUIRE, seed: 99, carry: null });
  });

  it("a run on another tier: the road opens on the run's tier; on the other one only level 1 fights, and it asks first", () => {
    const c = champion(2, KNIGHT);
    expect(roadOpensOn(c, 'marches', SQUIRE)).toBe(KNIGHT);
    const run = roadRun(c, 'marches', SQUIRE)!;
    expect(run.here).toBe(false);
    expect([1, 2, 3].map((n) => runMark(run, n))).toEqual([null, null, null]);
    const one = roadGo(run, 1, SQUIRE, true);
    expect(one).toMatchObject({ label: 'Fight!', enabled: true, plays: 1, over: null, note: 'a Knight run stands at level 3' });
    expect(one.ask).toBe('Start a new run on Squire? The Knight run at level 3 and its 2 relics are lost.');
    expect(roadGo(run, 3, SQUIRE, true)).toMatchObject({ enabled: false, ask: null });
  });

  it('one relic is "1 relic"; the fall line names the wave and the level', () => {
    const c = champion(1);
    c.runs.marches!.carry!.relics.held = ['thornMail'];
    expect(roadGo(roadRun(c, 'marches', SQUIRE), 2, SQUIRE, true).over).toBe('Start over from level 1? This run and its 1 relic are lost.');
    expect(fellLine(9, 2)).toBe('fell at wave 9, restart level 2');
  });
});
