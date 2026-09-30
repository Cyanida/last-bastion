import { describe, expect, it } from 'vitest';
import { createGame, summarizeRun } from '../src/game';
import { newChampion, runAt, runFor, runLevel, runStarts } from '../src/logic/champions';
import { checkpoint, newRealmRun, readRealmRun } from '../src/logic/realmRun';
import { applyRun, defaultSave, exportSave, importSave, migrate } from '../src/logic/save';
import { REALMS } from '../src/config/world';
import { recordClear, slotsFor } from '../src/logic/world';
import { addRelic } from '../src/systems/relics';
import { takeCarry } from '../src/systems/levels';
import { oldSave } from './fixtures/saves';

/** #237: a realm is one run with a checkpoint after every level; its relics stay between the levels, a death replays only the level. */
describe('realm runs: checkpoints and the carry (#237)', () => {
  const level1 = () => {
    const g = createGame('viking', 11, { level: { realm: 'marches', level: 1, relics: ['brimstoneOil'] } });
    addRelic(g, 'thornMail', 'boss');
    g.player.relics.tiers.thornMail = 2;
    g.gold += 120;
    g.level!.cleared = true;
    return g;
  };

  it('clearing level 1 carries its relics, tiers, gold and level into level 2, which starts at its first wave with no head start', () => {
    const g1 = level1();
    const run = checkpoint(newRealmRun(1, 11), 'marches', takeCarry(g1), 22)!;
    expect(run).toMatchObject({ level: 2, tier: 1, seed: 22 });
    const g2 = createGame('viking', run.seed, { tier: 1, level: { realm: 'marches', level: 2, relics: ['serratedEdge'], carry: run.carry } });
    const r = g2.player.relics;
    expect(r.held).toEqual(g1.player.relics.held); // the loadout went in at level 1 only
    expect(r.held).toContain('thornMail');
    expect(r.tiers.thornMail).toBe(2);
    expect(g2.gold).toBe(g1.gold);
    expect(g2.goldStart).toBe(g1.gold); // level 2 banks only what it earns
    expect(g2.player.level).toBe(g1.player.level); // no head start: the level the run grew
    expect(g2.player.stats).toEqual(g1.player.stats);
    expect([g2.startWave, g2.wave]).toEqual([6, 5]);
    expect(g2.level).toMatchObject({ realm: 'marches', level: 2, from: g1.player.level });
    expect(r.offers[0]?.from).toBe('start'); // the opening pick stays at every level
  });

  it("the loadout is the run's: 3 slots at every level of a realm and of the Marches, in at level 1 only; the Keep's two on top", () => {
    for (const realm of ['marches', 'ironHold'] as const) expect(REALMS[realm].levels.map((_, i) => slotsFor(realm, i + 1))).toEqual(REALMS[realm].levels.map(() => 3));
    expect(slotsFor('ironHold', 1, 2)).toBe(5);
    expect(slotsFor('lastBastion', 1)).toBe(5);
    const g = createGame('viking', 11, { level: { realm: 'marches', level: 1, relics: ['brimstoneOil', 'emberheart', 'cinderCharm', 'serratedEdge'] } });
    expect(g.player.relics.held).toEqual(['brimstoneOil', 'emberheart', 'cinderCharm']);
  });

  it('the head start is gone: a realm run starts at level 1, wave 1; only the level its run stands at goes on', () => {
    const c = newChampion('viking');
    c.world = recordClear(c.world, 'marches', 4, 0); // a save from before v0.11: four levels cleared, no run in progress
    expect(runLevel(c, 'marches', 0)).toBe(1);
    expect([1, 2, 5].map((n) => runStarts(c, 'marches', n, 0))).toEqual([true, false, false]);
    const fresh = runFor(c, 'marches', 5, 0, 77); // a fight asked for at level 5 is a new run from level 1
    expect(fresh).toEqual({ level: 1, tier: 0, seed: 77, carry: null });
    const g = createGame('viking', fresh.seed, { level: { realm: 'marches', level: fresh.level, relics: ['brimstoneOil'], carry: fresh.carry } });
    expect([g.startWave, g.wave, g.player.level]).toEqual([1, 0, 1]);
    expect(g.pendingAbilityTiers).toEqual([]); // no queued picks before the fight
    // its checkpoint after level 1: level 2 goes on, level 1 starts over, nothing else starts
    c.runs.marches = checkpoint(fresh, 'marches', takeCarry(level1()), 22)!;
    expect(runLevel(c, 'marches', 0)).toBe(2);
    expect(runLevel(c, 'marches', 1)).toBe(1); // another tier has no run
    expect([1, 2, 3].map((n) => runStarts(c, 'marches', n, 0))).toEqual([true, true, false]);
    expect(runFor(c, 'marches', 2, 0, 5)).toBe(c.runs.marches); // Continue: the same seed and carry
    expect(runAt(c, 'marches', 2, 1)).toBeUndefined();
    expect(runFor(c, 'marches', 1, 0, 5)).toEqual({ level: 1, tier: 0, seed: 5, carry: null }); // Start over
  });

  it('a checkpoint survives a save round trip, and the level goes on the same from it', () => {
    const run = checkpoint(newRealmRun(1, 11), 'marches', takeCarry(level1()), 22)!;
    const save = defaultSave();
    save.champions.viking = { ...newChampion('viking'), runs: { marches: run } };
    const back = importSave(exportSave(save))!;
    expect(back.champions.viking!.runs.marches).toEqual(run);
    const start = (c: typeof run) => createGame('viking', c.seed, { tier: c.tier, level: { realm: 'marches', level: c.level, carry: c.carry } });
    const [a, b] = [start(run), start(back.champions.viking!.runs.marches!)];
    expect(b.player.relics.held).toEqual(a.player.relics.held);
    expect(b.player.relics.offers).toEqual(a.player.relics.offers);
  });

  it('a death restarts only the current level: its checkpoint, the same seed, the same offers', () => {
    const run = checkpoint(newRealmRun(1, 11), 'marches', takeCarry(level1()), 22)!;
    const first = createGame('viking', run.seed, { level: { realm: 'marches', level: 2, carry: run.carry } });
    addRelic(first, 'vampireFang', 'boss'); // found in the level, then the run falls
    first.gold += 500;
    first.over = true;
    const again = createGame('viking', run.seed, { level: { realm: 'marches', level: 2, carry: run.carry } });
    expect(again.level!.level).toBe(2);
    expect(again.player.relics.held).not.toContain('vampireFang');
    expect(again.player.relics.held).toContain('thornMail'); // what level 1 gave stays
    expect(again.gold).toBe(run.carry!.gold);
    expect(again.player.relics.offers).toEqual(createGame('viking', run.seed, { level: { realm: 'marches', level: 2, carry: run.carry } }).player.relics.offers);
    expect(first.player.relics.offers[0]).toEqual(again.player.relics.offers[0]);
  });

  it('the last level ends the run; a banked later level counts only the levels it grew', () => {
    const last = { ...newRealmRun(1, 1), level: 7 };
    expect(checkpoint(last, 'marches', takeCarry(level1()), 5)).toBeNull();
    const run = checkpoint(newRealmRun(0, 11), 'marches', takeCarry(level1()), 22)!;
    const g2 = createGame('viking', run.seed, { level: { realm: 'marches', level: 2, carry: run.carry } });
    g2.wavesCleared = 10;
    const s = summarizeRun(g2);
    expect(s.realmLevel).toMatchObject({ level: 2, from: run.carry!.level });
    expect(applyRun(defaultSave(), s).classXp).toBeGreaterThanOrEqual(0);
  });

  it('save v8: a v7 save loads with no realm run in progress; a stored run is read back to what it can hold', () => {
    const v7 = oldSave('v0.10.0');
    const s = migrate(v7);
    expect(Object.keys(s.champions).length).toBeGreaterThan(0);
    for (const c of Object.values(s.champions)) expect(c!.runs).toEqual({});
    expect(readRealmRun({ level: 3, tier: 1, seed: 4, carry: 'x' }, 'marches')).toBeNull(); // no checkpoint to go on from: the realm starts again at level 1
    expect(readRealmRun({ level: 9, tier: 1, seed: 4 }, 'marches')).toBeNull();
    expect(readRealmRun({ level: 1, tier: 1, seed: 4 }, 'marches')).toEqual({ level: 1, tier: 1, seed: 4, carry: null });
    const bad = checkpoint(newRealmRun(1, 1), 'marches', takeCarry(level1()), 3)!;
    const read = readRealmRun(JSON.parse(JSON.stringify({ ...bad, carry: { ...bad.carry, relics: { ...bad.carry!.relics, held: ['nope', 'thornMail'] } } })), 'marches');
    expect(read!.carry!.relics.held).toEqual(['thornMail']);
  });
});
