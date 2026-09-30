import { describe, expect, it } from 'vitest';
import { INQUISITOR } from '../src/config/bosses';
import { ENEMY_STATUS } from '../src/config/damage';
import { MUSIC, REALM_THEMES, THEMES } from '../src/config/music';
import { relicDef } from '../src/config/relics';
import { PALETTE_NAMES, SPRITE_PALETTES } from '../src/render/sprites';
import { REALMS, WORLD } from '../src/config/world';
import type { Enemy, Game } from '../src/core/types';
import { createGame } from '../src/game';
import { elitePhases, inquisitorPyres, isEliteFight, pyreField } from '../src/logic/crownBoss';
import { damageEnemy } from '../src/systems/combat';
import { updateEnemies } from '../src/systems/enemyAI';
import { updateSpawning } from '../src/systems/spawning';
import { classRelicOf, keepLockedPick, legendaryPickOptions, newChampion, rewardRelics } from '../src/logic/champions';
import { CLASS_ORDER } from '../src/config/classes';
import { RANGES } from '../src/logic/music';
import { composeRunBar, moodOf } from '../src/logic/runMusic';
import { applyRun, defaultSave, exportSave, importSave, type RunSummary, type Save } from '../src/logic/save';
import { checkpoint, newRealmRun } from '../src/logic/realmRun';
import { bossWaveIn, clearRewards, crownGifts, levelPanel, realmBosses, type WorldProgress } from '../src/logic/world';
import { takeCarry } from '../src/systems/levels';

// #231: the Cinderlands' five levels, their rewards, its crown and its music theme, on the Iron Hold's recipe (#219)
const run = (o: Partial<RunSummary>): RunSummary => ({
  classId: 'viking', tier: 0, wave: 1, wavesCleared: 0, kills: 0, time: 60, level: 1, gold: 0, bosses: [], elites: 0, flawlessBosses: 0, relics: [], abilityUpgrades: 0, wave10Time: 0, ...o,
});
const cinder = (level: number) => ({ realm: 'cinderlands' as const, level, cleared: true });
const withWorld = (world: WorldProgress, inventory: string[] = []): Save => {
  const s = defaultSave();
  return { ...s, champions: { viking: { ...newChampion('viking'), world, inventory: inventory as never } } };
};

describe('the Cinderlands: five levels (#231)', () => {
  it('8 waves each: 1-8, 9-16, 17-24, 25-32, 33-40; 3 slots for the run; tier I then II; its end bosses and rewards', () => {
    const lv = REALMS.cinderlands.levels;
    expect(lv.map((l) => l.waves)).toEqual([[1, 8], [9, 16], [17, 24], [25, 32], [33, 40]]);
    expect(lv.map((l) => l.slots)).toEqual([3, 3, 3, 3, 3]);
    expect(lv.map((l) => l.relicTier)).toEqual([1, 1, 1, 2, 2]);
    expect(lv.every((l) => l.family === 'flame')).toBe(true);
    expect(lv.map((l) => l.boss)).toEqual([{ boss: 'pool' }, { boss: 'inquisitor' }, { boss: 'emberQueen' }, { boss: 'inquisitor', elite: true }, { boss: 'cinderColossus', crown: true }]);
    expect(lv.map((l) => l.reward?.kind)).toEqual(['keepLocked', 'keepLocked', 'classRelic', 'keepLocked', undefined]);
    expect(REALMS.cinderlands.opens).toEqual({ crowns: 1 });
  });

  it('the one boss wave of a level is its last; level 1 draws a pool boss that ends no other level, then the Inquisitor, the Ember Queen, the Inquisitor and the Cinder Colossus', () => {
    const bosses = realmBosses('cinderlands');
    expect(bosses.slice(1)).toEqual(['inquisitor', 'emberQueen', 'inquisitor', 'cinderColossus']);
    expect(['inquisitor', 'emberQueen', 'cinderColossus']).not.toContain(bosses[0]);
    expect(realmBosses('cinderlands')[0]).toBe(bosses[0]); // the same one every run
    for (const [i, { waves: [first, last] }] of REALMS.cinderlands.levels.entries()) {
      const lv = { realm: 'cinderlands' as const, last };
      const boss = Array.from({ length: last - first + 1 }, (_, k) => first + k).filter((w) => bossWaveIn(lv, w));
      expect(boss, `level ${i + 1}`).toEqual([last]);
    }
  });

  it('the realm is one run (#237): levels 1-4 leave a checkpoint at the next level, the last level ends the run', () => {
    const carry = takeCarry(createGame('viking', 3, { level: { realm: 'cinderlands', level: 1 } }));
    let run = newRealmRun(1, 7);
    for (let n = 1; n <= 4; n++) {
      const next = checkpoint(run, 'cinderlands', carry, 100 + n);
      expect(next).toMatchObject({ level: n + 1, tier: 1, seed: 100 + n });
      run = next!;
    }
    expect(checkpoint(run, 'cinderlands', carry, 9)).toBeNull();
  });

  it('the road panel names each level\'s boss and what its first clear and crown pay', () => {
    const p: WorldProgress = { marches: [7] };
    expect(levelPanel(p, 'cinderlands', 1, 0).rewards).toEqual([`Keep a locked relic of a family you held (or ${WORLD.keepLockedRunes} Runes)`]);
    expect(levelPanel(p, 'cinderlands', 2, 0)).toMatchObject({ boss: 'The Grand Inquisitor', eliteBoss: false });
    expect(levelPanel(p, 'cinderlands', 3, 0)).toMatchObject({ boss: 'The Ember Queen', rewards: ['Your class relic of Flame'] });
    expect(levelPanel(p, 'cinderlands', 4, 0)).toMatchObject({ boss: 'The Grand Inquisitor', eliteBoss: true, crownBoss: false });
    expect(levelPanel(p, 'cinderlands', 5, 1)).toMatchObject({ boss: 'The Cinder Colossus', crownBoss: true, rewards: ['Pick 1 of 2 Flame legendaries'] });
    expect(levelPanel({ ...p, cinderlands: [0, 5] }, 'cinderlands', 5, 2).rewards).toEqual(['The other Flame legendary']);
    expect(levelPanel(p, 'cinderlands', 5, 0).rewards).toEqual([]); // Squire's crown gives no legendary
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

/** Stand the boss by the champion and step his script until his next fan of pyres is marked; the zones it marked. */
function nextFan(g: Game, e: Enemy) {
  g.zones.length = 0;
  e.x = g.player.x + 200;
  e.y = g.player.y;
  e.state = 0;
  e.special = 0;
  for (let i = 0; i < 200 && !g.zones.length; i++) updateEnemies(g, 0.016);
  return g.zones.filter((z) => z.owner === e);
}

describe('the Cinderlands: level 4 ends on the Grand Inquisitor as an elite (#231)', () => {
  it('an elite end boss fights a phase more; the Inquisitor’s is his Auto-da-fé, after his two', () => {
    expect(REALMS.cinderlands.levels.map((l) => isEliteFight(l.boss))).toEqual([false, false, false, true, false]);
    expect(elitePhases(2)).toBe(2 + WORLD.eliteBoss.phases);
    expect([1, 2, 3].map(inquisitorPyres)).toEqual([false, false, true]);
    expect(pyreField(2, 1)).toBeNull(); // a plain Inquisitor's pyres go out
    // a pyre's burning ground: its fire scaled like a foe's blow, and the Torchbearers' falling burn, a stack a tick
    const torch = ENEMY_STATUS.torchbearer!;
    expect(pyreField(3, 2)).toEqual({ life: INQUISITOR.pyre.life, dps: INQUISITOR.pyre.dps * 2, apply: { ...torch, power: torch.power! * 2 } });
    expect(pyreField(3, 1)!.apply).toMatchObject({ id: 'burn', stacks: 1, decay: torch.decay });
  });

  it('level 2’s Inquisitor has two phases and his pyres go out; level 4’s has three on the same HP, and in his third they stay alight', () => {
    const g2 = createGame('paladin', 11, { level: { realm: 'cinderlands', level: 2 } });
    const plain = bossOf(g2, 16);
    expect(plain.def).toMatchObject({ id: 'inquisitor', name: 'The Grand Inquisitor' });
    expect(plain.def.phases ?? 2).toBe(2);
    plain.hp = plain.maxHp * 0.4;
    updateEnemies(g2, 0.016);
    expect(plain.phase).toBe(2);
    const fan2 = nextFan(g2, plain);
    expect(fan2).toHaveLength(plain.def.p2Lines! * plain.def.lineZones!);
    expect(fan2.every((z) => z.leaveField === null)).toBe(true);

    const g = createGame('paladin', 11, { level: { realm: 'cinderlands', level: 4 } });
    const w = bossOf(g, 32);
    expect(w.def).toMatchObject({ id: 'inquisitor', name: 'The Grand Inquisitor, Elite', phases: 3 });
    expect(w.crown).toBe(false);
    expect({ ...w.def, name: plain.def.name, phases: plain.def.phases }).toEqual(plain.def); // no stat step: the same boss, a phase more
    expect(g.banner?.text).toBe('The Grand Inquisitor, Elite · one phase more');
    for (const [hp, phase] of [[0.6, 2], [0.3, 3]] as const) {
      w.hp = w.maxHp * hp;
      updateEnemies(g, 0.016);
      expect(w.phase).toBe(phase);
    }
    expect(g.banner?.text).toBe('The Inquisitor’s auto-da-fé');
    expect(w.special).toBeLessThanOrEqual(0.8); // the next fan comes at once
    const fan3 = nextFan(g, w);
    expect(fan3).toHaveLength(w.def.p2Lines! * w.def.lineZones!); // no more lines than his second phase
    const scale = g.waveDmgMult * g.tier.enemyDmg;
    for (const z of fan3) expect(z.leaveField).toMatchObject({ life: INQUISITOR.pyre.life, dps: INQUISITOR.pyre.dps * scale, dtype: 'fire', apply: { id: 'burn', stacks: 1 } });
    damageEnemy(g, w, w.maxHp * 10); // no minimum phase time: that is the crown boss's
    expect(w.dead).toBe(true);
  });
});

describe('the Cinderlands: rewards (#231)', () => {
  it('a keep-locked pick: 1 of 2 locked Flame rares, the held ones first; no legendary, no class relic, none owned', () => {
    const c = newChampion('viking');
    const opts = keepLockedPick(c, 'viking', 'flame', ['cinderCharm', 'emberMantle']);
    expect(opts).toHaveLength(WORLD.keepLockedOf);
    expect(opts[0]).toBe('emberMantle');
    for (const id of opts) expect(relicDef(id)).toMatchObject({ family: 'flame', rarity: 'rare' });
    expect(opts.some((id) => relicDef(id).classId)).toBe(false);
    // owned ones are never offered again, and a realm's three picks never run dry: Flame has more than three plain rares
    const owned = { ...c, inventory: opts as never };
    const more = keepLockedPick(owned, 'viking', 'flame', ['emberMantle']);
    expect(more.length).toBeGreaterThan(0);
    expect(more.some((id) => opts.includes(id))).toBe(false);
    expect(keepLockedPick(c, 'viking', 'flame', ['pavise'])).toEqual([]); // no Flame relic held: the Runes
    expect(keepLockedPick(c, 'viking', 'flame', [])).toEqual([]);
  });

  it('level 3 banks the class relic of Flame with the run, once; every champion has one', () => {
    expect(classRelicOf('viking', 'flame')).toBe('surtrsBrand');
    expect(classRelicOf('necromancer', 'flame')).toBe('bonefire');
    for (const id of CLASS_ORDER) expect(classRelicOf(id, 'flame'), id).toBeTruthy();
    const s = applyRun(withWorld({ marches: [7], cinderlands: [2] }), run({ wave: 24, wavesCleared: 24, realmLevel: cinder(3) }));
    expect(s.levelRewards.level).toEqual([{ kind: 'classRelic' }]);
    expect(s.save.champions.viking!.inventory).toEqual(['surtrsBrand']);
    const again = applyRun(s.save, run({ wave: 24, wavesCleared: 24, realmLevel: cinder(3) }));
    expect(again.levelRewards.level).toEqual([]);
    expect(again.save.champions.viking!.inventory).toEqual(['surtrsBrand']);
  });

  it('a level played again in a later run pays its reward no second time', () => {
    const s = withWorld({ marches: [7], cinderlands: [0, 3] }, ['emberMantle', 'flashpowder', 'surtrsBrand']);
    for (const n of [1, 2, 3]) expect(applyRun(s, run({ tier: 0, wave: n * 8, wavesCleared: n * 8, realmLevel: cinder(n) })).levelRewards).toEqual({ level: [], crown: [] });
    expect(applyRun(s, run({ tier: 0, wave: 32, wavesCleared: 32, realmLevel: cinder(4) })).levelRewards.level).toEqual([{ kind: 'keepLocked' }]);
  });

  it('the Knight crown is a pick of the two Flame legendaries; the Champion crown banks the other; Squire\'s neither', () => {
    const p: WorldProgress = { marches: [7], cinderlands: [4, 4] };
    expect(clearRewards(p, 'cinderlands', 5, 0).crown).toEqual([]);
    expect(clearRewards(p, 'cinderlands', 5, 1).crown).toEqual([{ kind: 'legendaryPick' }]);
    const c = newChampion('viking');
    expect(legendaryPickOptions(c, 'flame').sort()).toEqual(['crownOfCinders', 'dragonsTongue']);
    const knight = applyRun(withWorld(p), run({ tier: 1, wave: 40, wavesCleared: 40, realmLevel: cinder(5) }));
    expect(knight.levelRewards.crown).toEqual([{ kind: 'legendaryPick' }]);
    expect(knight.save.champions.viking!.inventory).toEqual([]); // the pick is made on its screen
    // it took Crown of Cinders; the Champion crown gives Dragon's Tongue
    const champ = applyRun(withWorld({ marches: [7], cinderlands: [5, 5, 4] }, ['crownOfCinders']), run({ tier: 2, wave: 40, wavesCleared: 40, realmLevel: cinder(5) }));
    expect(champ.levelRewards.crown).toEqual([{ kind: 'legendaryOther' }]);
    expect(champ.save.champions.viking!.inventory).toEqual(['crownOfCinders', 'dragonsTongue']);
    expect(rewardRelics({ ...c, inventory: ['crownOfCinders', 'dragonsTongue'] }, 'viking', 'flame', [{ kind: 'legendaryOther' }])).toEqual([]);
  });

  it('the Legend crown banks the title Cinderborn and the Cinder colours for the account, once; a save keeps the title', () => {
    const legend = REALMS.cinderlands.legend!;
    expect(legend.title).toBe('Cinderborn');
    expect(SPRITE_PALETTES[legend.palette]).toBeTruthy();
    expect(PALETTE_NAMES[legend.palette]).toBe('Cinder colours');
    expect(PALETTE_NAMES).toHaveLength(SPRITE_PALETTES.length);
    // its own, not the Iron Hold's
    expect(legend.title).not.toBe(REALMS.ironHold.legend!.title);
    expect(legend.palette).not.toBe(REALMS.ironHold.legend!.palette);
    const p: WorldProgress = { marches: [7], cinderlands: [0, 5, 5, 4] };
    expect(levelPanel(p, 'cinderlands', 5, 3).rewards).toEqual([`The title ${legend.title}`, 'A palette']);
    expect(crownGifts('cinderlands', clearRewards(p, 'cinderlands', 5, 3).crown)).toEqual(legend);
    expect(crownGifts('cinderlands', clearRewards(p, 'cinderlands', 5, 2).crown)).toEqual({}); // the Champion crown is already won
    const won = applyRun(withWorld(p, ['crownOfCinders', 'dragonsTongue']), run({ tier: 3, wave: 40, wavesCleared: 40, realmLevel: cinder(5) }));
    expect(won.levelRewards.crown).toEqual([{ kind: 'title' }, { kind: 'palette' }]);
    expect(won.save.titles).toEqual([legend.title]);
    expect(won.save.palettes).toEqual([legend.palette]);
    const again = applyRun(won.save, run({ tier: 3, wave: 40, wavesCleared: 40, realmLevel: cinder(5) }));
    expect(again.levelRewards.crown).toEqual([]);
    expect(again.save.titles).toEqual([legend.title]);
    expect(again.save.palettes).toEqual([legend.palette]);
    const back = importSave(exportSave({ ...won.save, title: legend.title }))!; // worn, saved and read back
    expect(back.titles).toEqual([legend.title]);
    expect(back.title).toBe(legend.title);
    expect(back.palettes).toEqual([legend.palette]);
    expect(applyRun(withWorld({ marches: [7], cinderlands: [4] }), run({ tier: 0, wave: 40, wavesCleared: 40, realmLevel: cinder(5) })).save.titles).toEqual([]); // a lower crown gives neither
  });
});

describe('the Cinderlands: its music theme (#231)', () => {
  it('its levels play the Cinderlands theme; a plain run in the Ember Forge plays the Forge\'s, the Iron Hold its own', () => {
    expect(REALM_THEMES.cinderlands).toBe('cinderlands');
    const level = createGame('viking', 3, { level: { realm: 'cinderlands', level: 1 } });
    expect(level.arena.id).toBe('emberForge');
    expect(moodOf(level).arena).toBe('cinderlands');
    expect(moodOf(createGame('viking', 3, { arena: 'emberForge' })).arena).toBe('emberForge');
    expect(moodOf(createGame('viking', 3, { level: { realm: 'ironHold', level: 1 } })).arena).toBe('ironHold');
  });

  it('it is its own tune: not the Ember Forge\'s key, mode, meter or lead, nor the Iron Hold\'s', () => {
    const t = THEMES.cinderlands;
    expect(t.name).toBe('The Cinderlands');
    for (const other of [THEMES.emberForge, THEMES.ironHold]) {
      expect(t.mode).not.toEqual(other.mode);
      expect(t.meter).not.toBe(other.meter);
      expect(t.lead).not.toBe(other.lead);
      expect(t.root).not.toBe(other.root);
    }
  });

  it('every note is in its mode, its voice range and its bar; a boss brings drums and a bass line', () => {
    const t = THEMES.cinderlands;
    expect(t.bpm).toBeGreaterThanOrEqual(66);
    expect(t.bpm).toBeLessThanOrEqual(96);
    expect(t.mode).toHaveLength(7);
    expect(t.chords).toHaveLength(8);
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
