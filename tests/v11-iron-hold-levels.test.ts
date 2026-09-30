import { describe, expect, it } from 'vitest';
import { MUSIC, REALM_THEMES, THEMES } from '../src/config/music';
import { relicDef } from '../src/config/relics';
import { PALETTE_NAMES, SPRITE_PALETTES } from '../src/render/sprites';
import { REALMS, WORLD } from '../src/config/world';
import type { Enemy, Game } from '../src/core/types';
import { createGame } from '../src/game';
import { elitePhases, isEliteFight, wardenJudges, wardenMove, wardenSpecialCd } from '../src/logic/crownBoss';
import { WARDEN } from '../src/config/bosses';
import { damageEnemy } from '../src/systems/combat';
import { updateEnemies } from '../src/systems/enemyAI';
import { updateSpawning } from '../src/systems/spawning';
import { classRelicOf, grantRewards, keepLockedPick, legendaryPickOptions, newChampion, rewardRelics } from '../src/logic/champions';
import { RANGES } from '../src/logic/music';
import { composeRunBar, moodOf } from '../src/logic/runMusic';
import { applyRun, defaultSave, exportSave, importSave, type RunSummary, type Save } from '../src/logic/save';
import { checkpoint, newRealmRun } from '../src/logic/realmRun';
import { bossWaveIn, clearRewards, crownGifts, levelPanel, realmBosses, type WorldProgress } from '../src/logic/world';
import { takeCarry } from '../src/systems/levels';

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
  it('8 waves each (#243): 1-8, 9-16, 17-24, 25-32, 33-40; 3 slots for the run; tier I then II; its end bosses and rewards', () => {
    const lv = REALMS.ironHold.levels;
    expect(lv.map((l) => l.waves)).toEqual([[1, 8], [9, 16], [17, 24], [25, 32], [33, 40]]);
    expect(lv.map((l) => l.slots)).toEqual([3, 3, 3, 3, 3]); // #237: one run, one loadout
    expect(lv.map((l) => l.relicTier)).toEqual([1, 1, 1, 2, 2]);
    expect(lv.every((l) => l.family === 'steel')).toBe(true);
    expect(lv.map((l) => l.boss)).toEqual([{ boss: 'pool' }, { boss: 'warden' }, { boss: 'forgemaster' }, { boss: 'warden', elite: true }, { boss: 'ironKing', crown: true }]);
    expect(lv.map((l) => l.reward?.kind)).toEqual(['keepLocked', 'keepLocked', 'classRelic', 'keepLocked', undefined]);
    expect(REALMS.ironHold.opens).toEqual({ crowns: 1 });
  });

  it('the one boss wave of a level is its last; level 1 draws a pool boss that ends no other level, then the Warden, the Forgemaster, the Warden and the Iron King', () => {
    const bosses = realmBosses('ironHold');
    expect(bosses.slice(1)).toEqual(['warden', 'forgemaster', 'warden', 'ironKing']);
    expect(['warden', 'forgemaster', 'ironKing']).not.toContain(bosses[0]);
    expect(realmBosses('ironHold')[0]).toBe(bosses[0]); // the same one every run
    for (const [i, { waves: [first, last] }] of REALMS.ironHold.levels.entries()) {
      const lv = { realm: 'ironHold' as const, last };
      const boss = Array.from({ length: last - first + 1 }, (_, k) => first + k).filter((w) => bossWaveIn(lv, w));
      expect(boss, `level ${i + 1}`).toEqual([last]);
    }
  });

  it('the realm is one run (#237): levels 1-4 leave a checkpoint at the next level, the last level ends the run', () => {
    const carry = takeCarry(createGame('viking', 3, { level: { realm: 'ironHold', level: 1 } }));
    let run = newRealmRun(1, 7);
    for (let n = 1; n <= 4; n++) {
      const next = checkpoint(run, 'ironHold', carry, 100 + n);
      expect(next).toMatchObject({ level: n + 1, tier: 1, seed: 100 + n });
      run = next!;
    }
    expect(checkpoint(run, 'ironHold', carry, 9)).toBeNull();
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

/** Start wave `wave` and step spawning until its boss is on the field. */
function bossOf(g: Game, wave: number): Enemy {
  g.wave = wave - 1;
  g.breather = 0.001;
  updateSpawning(g, 0.016);
  for (let i = 0; i < 4000 && !g.enemies.some((e) => e.def.boss); i++) updateSpawning(g, 0.05);
  return g.enemies.find((e) => e.def.boss)!;
}

describe('the Iron Hold: level 4 ends on the Warden as an elite (#219)', () => {
  it('an elite end boss fights a phase more; the Warden’s is his Judgement, after his three', () => {
    expect(REALMS.ironHold.levels.map((l) => isEliteFight(l.boss))).toEqual([false, false, false, true, false]);
    expect(elitePhases(3)).toBe(3 + WORLD.eliteBoss.phases);
    expect([1, 2, 3, 4].map((p) => wardenJudges(p, false))).toEqual([false, false, false, true]);
    expect([1, 2, 3].map((p) => wardenJudges(p, true))).toEqual([false, false, true]); // the crown boss's is still his third
    expect(wardenMove(3, false, 0)).toMatchObject({ inner: false, close: true, hammer: false }); // his third phase stays the Act boss's
    expect(wardenMove(4, false, 0)).toEqual(wardenMove(3, true, 0));
    expect(wardenSpecialCd(7.5, 4, false)).toBe(WARDEN.crown.specialCd);
    expect(levelPanel({ marches: [7] }, 'ironHold', 4, 0)).toMatchObject({ boss: 'The Warden', eliteBoss: true, crownBoss: false });
    expect(levelPanel({ marches: [7] }, 'ironHold', 2, 0)).toMatchObject({ boss: 'The Warden', eliteBoss: false });
  });

  it('level 2’s Warden has three phases, level 4’s four on the same HP, and his fourth is the Judgement', () => {
    const plain = bossOf(createGame('paladin', 11, { level: { realm: 'ironHold', level: 2 } }), 16);
    expect(plain.def).toMatchObject({ id: 'warden', name: 'The Warden', phases: 3 });
    const g = createGame('paladin', 11, { level: { realm: 'ironHold', level: 4 } });
    const w = bossOf(g, 32);
    expect(w.def).toMatchObject({ id: 'warden', name: 'The Warden, Elite', phases: 4 });
    expect(w.crown).toBe(false);
    expect(g.banner?.text).toBe('The Warden, Elite · one phase more');
    for (const [hp, phase] of [[0.74, 2], [0.49, 3], [0.24, 4]] as const) {
      w.hp = w.maxHp * hp;
      updateEnemies(g, 0.016);
      expect(w.phase).toBe(phase);
    }
    expect(w.state).toBe(3);
    expect(g.banner?.text).toBe('The Warden’s judgement');
    damageEnemy(g, w, w.maxHp * 10); // no minimum phase time: that is the crown boss's
    expect(w.dead).toBe(true);
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

  it('a keep-locked pick counts what the run held when the level ended, the levels before it included (#237)', () => {
    const c = { ...newChampion('viking'), inventory: ['pavise'] as never }; // level 1's pick, kept
    // level 2 ends holding level 1's Pavise (owned now) and a rare found since: the pick is the locked ones, the held one first
    const opts = keepLockedPick(c, 'viking', 'steel', ['pavise', 'reprisalCuirass']);
    expect(opts[0]).toBe('reprisalCuirass');
    expect(opts).not.toContain('pavise');
    expect(opts).toHaveLength(WORLD.keepLockedOf);
  });

  it('a level played again in a later run pays its reward no second time (#242: start over)', () => {
    const s = withWorld({ marches: [7], ironHold: [0, 3] }, ['pavise', 'anvilHeart', 'ironhide']);
    for (const n of [1, 2, 3]) expect(applyRun(s, run({ tier: 0, wave: n * 8, wavesCleared: n * 8, realmLevel: hold(n) })).levelRewards).toEqual({ level: [], crown: [] });
    expect(applyRun(s, run({ tier: 0, wave: 32, wavesCleared: 32, realmLevel: hold(4) })).levelRewards.level).toEqual([{ kind: 'keepLocked' }]);
  });

  it('level 3 banks the class relic of Steel with the run, once', () => {
    expect(classRelicOf('viking', 'steel')).toBe('ironhide');
    expect(classRelicOf('angel', 'steel')).toBe('ironHalo');
    const s = applyRun(withWorld({ marches: [7], ironHold: [2] }), run({ wave: 24, wavesCleared: 24, realmLevel: hold(3) }));
    expect(s.levelRewards.level).toEqual([{ kind: 'classRelic' }]);
    expect(s.save.champions.viking!.inventory).toEqual(['ironhide']);
    const again = applyRun(s.save, run({ wave: 24, wavesCleared: 24, realmLevel: hold(3) }));
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

  it('the Legend crown banks a title and a palette for the account, once; a save keeps the title', () => {
    const legend = REALMS.ironHold.legend!;
    expect(SPRITE_PALETTES[legend.palette]).toBeTruthy();
    expect(PALETTE_NAMES[legend.palette]).toBe('Iron colours');
    const p: WorldProgress = { marches: [7], ironHold: [0, 5, 5, 4] };
    expect(levelPanel(p, 'ironHold', 5, 3).rewards).toEqual([`The title ${legend.title}`, 'A palette']);
    expect(crownGifts('ironHold', clearRewards(p, 'ironHold', 5, 3).crown)).toEqual(legend);
    expect(crownGifts('ironHold', clearRewards(p, 'ironHold', 5, 2).crown)).toEqual({}); // the Champion crown is already won
    expect(crownGifts('marches', [{ kind: 'title' }, { kind: 'palette' }])).toEqual({}); // a realm that names none gives none
    const won = applyRun(withWorld(p, ['heartOfTheHold', 'unbreakable']), run({ tier: 3, wave: 40, wavesCleared: 40, realmLevel: hold(5) }));
    expect(won.levelRewards.crown).toEqual([{ kind: 'title' }, { kind: 'palette' }]);
    expect(won.save.titles).toEqual([legend.title]);
    expect(won.save.palettes).toEqual([legend.palette]);
    const again = applyRun(won.save, run({ tier: 3, wave: 40, wavesCleared: 40, realmLevel: hold(5) }));
    expect(again.levelRewards.crown).toEqual([]);
    expect(again.save.titles).toEqual([legend.title]);
    expect(again.save.palettes).toEqual([legend.palette]);
    const back = importSave(exportSave({ ...won.save, title: legend.title }))!; // worn, saved and read back
    expect(back.titles).toEqual([legend.title]);
    expect(back.title).toBe(legend.title);
    expect(back.palettes).toEqual([legend.palette]);
    // a lower crown gives neither
    expect(applyRun(withWorld({ marches: [7], ironHold: [4] }), run({ tier: 0, wave: 40, wavesCleared: 40, realmLevel: hold(5) })).save.titles).toEqual([]);
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
