import { describe, expect, it } from 'vitest';
import { MUSIC, REALM_THEMES, THEMES } from '../src/config/music';
import { relicDef } from '../src/config/relics';
import { REALMS, WORLD } from '../src/config/world';
import { createGame } from '../src/game';
import { classRelicOf, grantRewards, keepLockedPick, legendaryPickOptions, newChampion, rewardRelics } from '../src/logic/champions';
import { RANGES } from '../src/logic/music';
import { composeRunBar, moodOf } from '../src/logic/runMusic';
import { applyRun, defaultSave, type RunSummary, type Save } from '../src/logic/save';
import { clearRewards, levelPanel, type WorldProgress } from '../src/logic/world';

// #219: the Iron Hold's five levels, their rewards, its crown and its music theme
const run = (o: Partial<RunSummary>): RunSummary => ({
  classId: 'viking', tier: 0, wave: 1, wavesCleared: 0, kills: 0, time: 60, level: 1, gold: 0, bosses: [], elites: 0, flawlessBosses: 0, relics: [], abilityUpgrades: 0, wave10Time: 0, ...o,
});
const hold = (level: number) => ({ realm: 'ironHold' as const, level, cleared: true });
const withWorld = (world: WorldProgress, inventory: string[] = []): Save => {
  const s = defaultSave();
  return { ...s, champions: { viking: { ...newChampion('viking'), world, inventory: inventory as never } } };
};

describe('the Iron Hold: five levels (#219)', () => {
  it('waves 1-5, 6-10, 11-20, 21-30, 31-40; slots 1-5; tier I then II; its end bosses and rewards', () => {
    const lv = REALMS.ironHold.levels;
    expect(lv.map((l) => l.waves)).toEqual([[1, 5], [6, 10], [11, 20], [21, 30], [31, 40]]);
    expect(lv.map((l) => l.slots)).toEqual([1, 2, 3, 4, 5]);
    expect(lv.map((l) => l.relicTier)).toEqual([1, 1, 1, 2, 2]);
    expect(lv.every((l) => l.family === 'steel')).toBe(true);
    expect(lv.map((l) => l.boss)).toEqual([{ boss: 'pool' }, { boss: 'warden' }, { boss: 'forgemaster' }, { boss: 'warden', elite: true }, { boss: 'ironKing', crown: true }]);
    expect(lv.map((l) => l.reward?.kind)).toEqual(['keepLocked', 'keepLocked', 'classRelic', 'keepLocked', undefined]);
    expect(REALMS.ironHold.opens).toEqual({ crowns: 1 });
  });

  it('the road panel names each level\'s boss and what its first clear and crown pay', () => {
    const p: WorldProgress = { marches: [7] };
    expect(levelPanel(p, 'ironHold', 1, 0).rewards).toEqual([`Keep a locked relic of a family you held (or ${WORLD.keepLockedRunes} Runes)`]);
    expect(levelPanel(p, 'ironHold', 2, 0).boss).toBe('The Warden');
    expect(levelPanel(p, 'ironHold', 3, 0).rewards).toEqual(['Your class relic of Steel']);
    expect(levelPanel(p, 'ironHold', 5, 1).rewards).toEqual(['Pick 1 of 2 Steel legendaries']);
    expect(levelPanel({ ...p, ironHold: [0, 5] }, 'ironHold', 5, 2).rewards).toEqual(['The other Steel legendary']);
    expect(levelPanel(p, 'ironHold', 5, 0).rewards).toEqual([]); // Squire's crown gives no legendary
  });
});

describe('the Iron Hold: rewards (#219)', () => {
  it('a keep-locked pick: 1 of 2 locked Steel rares, the held ones first; no legendary, no class relic, none owned', () => {
    const c = newChampion('viking');
    const opts = keepLockedPick(c, 'viking', 'steel', ['rivetHammer', 'pavise']);
    expect(opts).toHaveLength(WORLD.keepLockedOf);
    expect(opts[0]).toBe('pavise');
    for (const id of opts) expect(relicDef(id)).toMatchObject({ family: 'steel', rarity: 'rare' });
    expect(opts.some((id) => relicDef(id).classId)).toBe(false);
    const owned = { ...c, inventory: ['pavise', 'anvilHeart', 'shockSigil'] as never };
    expect(keepLockedPick(owned, 'viking', 'steel', ['pavise'])).toEqual(['reprisalCuirass']);
    expect(keepLockedPick(c, 'viking', 'steel', ['emberheart'])).toEqual([]); // no Steel relic held: the Runes
    expect(keepLockedPick(c, 'viking', 'steel', [])).toEqual([]);
  });

  it('level 3 banks the class relic of Steel with the run, once', () => {
    expect(classRelicOf('viking', 'steel')).toBe('ironhide');
    expect(classRelicOf('angel', 'steel')).toBe('ironHalo');
    const s = applyRun(withWorld({ marches: [7], ironHold: [2] }), run({ wave: 20, wavesCleared: 20, realmLevel: hold(3) }));
    expect(s.levelRewards.level).toEqual([{ kind: 'classRelic' }]);
    expect(s.save.champions.viking!.inventory).toEqual(['ironhide']);
    const again = applyRun(s.save, run({ wave: 20, wavesCleared: 20, realmLevel: hold(3) }));
    expect(again.levelRewards.level).toEqual([]);
    expect(again.save.champions.viking!.inventory).toEqual(['ironhide']);
  });

  it('the Knight crown is a pick of the two Steel legendaries; the Champion crown banks the other; Squire\'s neither', () => {
    const p: WorldProgress = { marches: [7], ironHold: [4, 4] };
    expect(clearRewards(p, 'ironHold', 5, 0).crown).toEqual([]);
    expect(clearRewards(p, 'ironHold', 5, 1).crown).toEqual([{ kind: 'legendaryPick' }]);
    const c = newChampion('viking');
    expect(legendaryPickOptions(c, 'steel').sort()).toEqual(['heartOfTheHold', 'unbreakable']);
    // the Knight crown's pick is made on its screen: nothing is banked with the run
    const knight = applyRun(withWorld(p), run({ tier: 1, wave: 40, wavesCleared: 40, realmLevel: hold(5) }));
    expect(knight.levelRewards.crown).toEqual([{ kind: 'legendaryPick' }]);
    expect(knight.save.champions.viking!.inventory).toEqual([]);
    // it took Heart of the Hold; the Champion crown gives Unbreakable
    const champ = applyRun(withWorld({ marches: [7], ironHold: [5, 5, 4] }, ['heartOfTheHold']), run({ tier: 2, wave: 40, wavesCleared: 40, realmLevel: hold(5) }));
    expect(champ.levelRewards.crown).toEqual([{ kind: 'legendaryOther' }]);
    expect(champ.save.champions.viking!.inventory).toEqual(['heartOfTheHold', 'unbreakable']);
    // a champion holding both already gets nothing more
    expect(rewardRelics({ ...c, inventory: ['heartOfTheHold', 'unbreakable'] }, 'viking', 'steel', [{ kind: 'legendaryOther' }])).toEqual([]);
  });

  it('the Marches crown still banks the signature relic, once', () => {
    const c = grantRewards(newChampion('paladin'), 'paladin', undefined, [{ kind: 'rarePick', family: 'grave', of: 2 }, { kind: 'signature' }]);
    expect(c).toMatchObject({ signature: true, inventory: ['oathkeepersSeal'] });
    expect(grantRewards(c, 'paladin', undefined, [{ kind: 'signature' }]).inventory).toEqual(['oathkeepersSeal']);
  });
});

describe('the Iron Hold: its music theme (#219)', () => {
  it('its levels play the Iron Hold theme; a plain run in the Great Keep plays the Keep\'s', () => {
    expect(REALM_THEMES.ironHold).toBe('ironHold');
    const level = createGame('viking', 3, { level: { realm: 'ironHold', level: 1 } });
    expect(level.arena.id).toBe('keep');
    expect(moodOf(level).arena).toBe('ironHold');
    expect(moodOf(createGame('viking', 3, { arena: 'keep' })).arena).toBe('keep');
    expect(moodOf(createGame('viking', 3, { level: { realm: 'marches', level: 1 } })).arena).toBe('courtyard');
  });

  it('every note is in its mode, its voice range and its bar; a boss brings drums and a bass line', () => {
    const t = THEMES.ironHold;
    expect(t.bpm).toBeGreaterThanOrEqual(66);
    expect(t.bpm).toBeLessThanOrEqual(96);
    const scale = t.mode.map((s) => (t.root + s) % 12);
    for (let bar = 0; bar < 48; bar++)
      for (const layer of [0, 1, 2, 3] as const) {
        const notes = composeRunBar(t, 11, bar, layer);
        for (const n of notes) {
          if (n.voice !== 'drum') expect(scale).toContain(n.midi % 12);
          expect(n.midi).toBeGreaterThanOrEqual(RANGES[n.voice][0]);
          expect(n.midi).toBeLessThanOrEqual(RANGES[n.voice][1]);
          expect(n.time).toBeGreaterThanOrEqual(0);
          expect(n.time).toBeLessThan(t.meter);
        }
        if (layer === 3) expect(notes.some((n) => n.voice === 'bass') && notes.some((n) => n.voice === 'drum' && n.midi === t.boss.midi)).toBe(true);
        expect(notes.length).toBeLessThanOrEqual(MUSIC.voices.high);
      }
  });
});
