import { describe, expect, it } from 'vitest';
import { createGame, summarizeRun } from '../src/game';
import { newChampion } from '../src/logic/champions';
import { checkpoint, newRealmRun, readRealmRun } from '../src/logic/realmRun';
import { applyRun, defaultSave, exportSave, importSave, migrate } from '../src/logic/save';
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
    expect(readRealmRun({ level: 3, tier: 1, seed: 4, carry: 'x' }, 'marches')).toEqual({ level: 3, tier: 1, seed: 4, carry: null }); // a fresh start there
    expect(readRealmRun({ level: 9, tier: 1, seed: 4 }, 'marches')).toBeNull();
    expect(readRealmRun({ level: 1, tier: 1, seed: 4 }, 'marches')).toEqual({ level: 1, tier: 1, seed: 4, carry: null });
    const bad = checkpoint(newRealmRun(1, 1), 'marches', takeCarry(level1()), 3)!;
    const read = readRealmRun(JSON.parse(JSON.stringify({ ...bad, carry: { ...bad.carry, relics: { ...bad.carry!.relics, held: ['nope', 'thornMail'] } } })), 'marches');
    expect(read!.carry!.relics.held).toEqual(['thornMail']);
  });
});
