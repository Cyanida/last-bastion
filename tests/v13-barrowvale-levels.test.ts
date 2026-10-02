import { describe, expect, it } from 'vitest';
import { LICH } from '../src/config/bosses';
import { ENEMIES, RISING } from '../src/config/enemies';
import { MUSIC, REALM_THEMES, THEMES } from '../src/config/music';
import { relicDef } from '../src/config/relics';
import { PALETTE_NAMES, SPRITE_PALETTES } from '../src/render/sprites';
import { REALMS, WORLD } from '../src/config/world';
import type { Enemy, Game } from '../src/core/types';
import { createGame } from '../src/game';
import { barrowCall, elitePhases, isEliteFight, lichCalls, lichGraveRise } from '../src/logic/crownBoss';
import { damageEnemy, updateRisingCorpses } from '../src/systems/combat';
import { updateEnemies } from '../src/systems/enemyAI';
import { updateSpawning } from '../src/systems/spawning';
import { classRelicOf, keepLockedPick, legendaryPickOptions, newChampion, nextStop } from '../src/logic/champions';
import { CLASS_ORDER } from '../src/config/classes';
import { RANGES } from '../src/logic/music';
import { composeRunBar, moodOf } from '../src/logic/runMusic';
import { applyRun, defaultSave, type RunSummary, type Save } from '../src/logic/save';
import { checkpoint, newRealmRun } from '../src/logic/realmRun';
import { bossWaveIn, clearRewards, crownGifts, levelPanel, realmBosses, recordClear, unbuiltNotice, type WorldProgress } from '../src/logic/world';
import { takeCarry } from '../src/systems/levels';

// #281: the Barrowvale's five levels, their rewards, its crown and its music theme, on the Iron Hold's recipe (#219, #231)
const run = (o: Partial<RunSummary>): RunSummary => ({
  classId: 'viking', tier: 0, wave: 1, wavesCleared: 0, kills: 0, time: 60, level: 1, gold: 0, bosses: [], elites: 0, flawlessBosses: 0, relics: [], abilityUpgrades: 0, wave10Time: 0, ...o,
});
const barrow = (level: number) => ({ realm: 'barrowvale' as const, level, cleared: true });
const withWorld = (world: WorldProgress, inventory: string[] = []): Save => {
  const s = defaultSave();
  return { ...s, champions: { viking: { ...newChampion('viking'), world, inventory: inventory as never } } };
};

describe('the Barrowvale: five levels (#281)', () => {
  it('8 waves each, 3 slots for the run, tier I then II; the Abbot, the Lich, the Gravedigger, the Lich as an elite, the Barrow King', () => {
    const lv = REALMS.barrowvale.levels;
    expect(lv.map((l) => l.waves)).toEqual([[1, 8], [9, 16], [17, 24], [25, 32], [33, 40]]);
    expect(lv.map((l) => l.slots)).toEqual([3, 3, 3, 3, 3]);
    expect(lv.map((l) => l.relicTier)).toEqual([1, 1, 1, 2, 2]);
    expect(lv.every((l) => l.family === 'grave')).toBe(true);
    expect(lv.map((l) => l.boss)).toEqual([{ boss: 'abbot' }, { boss: 'lich' }, { boss: 'gravedigger' }, { boss: 'lich', elite: true }, { boss: 'barrowKing', crown: true }]);
    expect(lv.map((l) => l.reward?.kind)).toEqual(['keepLocked', 'keepLocked', 'classRelic', 'keepLocked', undefined]);
    expect(realmBosses('barrowvale')).toEqual(['abbot', 'lich', 'gravedigger', 'lich', 'barrowKing']);
    for (const [i, { waves: [first, last] }] of lv.entries()) {
      const at = { realm: 'barrowvale' as const, last };
      expect(Array.from({ length: last - first + 1 }, (_, k) => first + k).filter((w) => bossWaveIn(at, w)), `level ${i + 1}`).toEqual([last]);
    }
  });

  it('it is built: no stand-in notice, and PLAY goes there after the Marches crown and the Iron Hold', () => {
    expect(REALMS.barrowvale.built).toBe(true);
    expect(unbuiltNotice('barrowvale')).toBeNull();
    const c = newChampion('viking');
    c.world = recordClear(c.world, 'marches', 7, 0);
    c.world = recordClear(c.world, 'ironHold', 5, 0);
    expect(nextStop(c, 0).realm).toBe('barrowvale');
  });

  it('the realm is one run: levels 1-4 leave a checkpoint at the next level, the last level ends the run', () => {
    const carry = takeCarry(createGame('viking', 3, { level: { realm: 'barrowvale', level: 1 } }));
    let r = newRealmRun(1, 7);
    for (let n = 1; n <= 4; n++) {
      const next = checkpoint(r, 'barrowvale', carry, 100 + n);
      expect(next).toMatchObject({ level: n + 1, tier: 1, seed: 100 + n });
      r = next!;
    }
    expect(checkpoint(r, 'barrowvale', carry, 9)).toBeNull();
  });

  it("the road panel names each level's boss and what its first clear and crown pay", () => {
    const p: WorldProgress = { marches: [7] };
    expect(levelPanel(p, 'barrowvale', 1, 0)).toMatchObject({ boss: 'The Plague Abbot', rewards: [`Keep a locked relic of a family you held (or ${WORLD.keepLockedRunes} Runes)`] });
    expect(levelPanel(p, 'barrowvale', 2, 0)).toMatchObject({ boss: 'The Lich', eliteBoss: false });
    expect(levelPanel(p, 'barrowvale', 3, 0)).toMatchObject({ boss: 'The Gravedigger', rewards: ['Your class relic of Grave'] });
    expect(levelPanel(p, 'barrowvale', 4, 0)).toMatchObject({ boss: 'The Lich', eliteBoss: true, crownBoss: false });
    expect(levelPanel(p, 'barrowvale', 5, 1)).toMatchObject({ boss: 'The Barrow King', crownBoss: true, rewards: ['Pick 1 of 2 Grave legendaries'] });
    expect(levelPanel({ ...p, barrowvale: [0, 5] }, 'barrowvale', 5, 2).rewards).toEqual(['The other Grave legendary']);
    expect(levelPanel(p, 'barrowvale', 5, 0).rewards).toEqual([]);
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
const waiting = (g: Game) => g.corpses.filter((c) => c.rise);

describe('the Barrowvale: level 4 ends on the Lich as an elite, with his Barrow Call (#281)', () => {
  it('the call: graves evenly round him, none before his third phase, fewer while the field is full of the waiting dead', () => {
    expect(REALMS.barrowvale.levels.map((l) => isEliteFight(l.boss))).toEqual([false, false, false, true, false]);
    expect(elitePhases(2)).toBe(LICH.callFrom);
    expect([1, 2, 3].map(lichCalls)).toEqual([false, false, true]);
    expect(barrowCall(2, 0, 0, 0, 0)).toEqual([]);
    const spots = barrowCall(3, 100, 50, 0.3, 0);
    expect(spots).toHaveLength(LICH.graves);
    for (const s of spots) expect(Math.hypot(s.x - 100, s.y - 50)).toBeCloseTo(LICH.ring);
    expect(barrowCall(3, 0, 0, 0, LICH.maxRising - 1)).toHaveLength(1);
    expect(barrowCall(3, 0, 0, 0, LICH.maxRising + 4)).toEqual([]);
    // each grave is a Barrow Thrall's corpse: its delay, its share of a thrall's HP at this wave
    expect(lichGraveRise(2)).toEqual({ id: 'barrowThrall', at: RISING.barrowThrall!.delay, side: false, hp: Math.round(ENEMIES.barrowThrall.hp * 2 * RISING.barrowThrall!.hp) });
  });

  it("level 2's Lich has two phases and calls no dead; level 4's has three on more HP, and his third opens graves that rise unless trampled", () => {
    const g2 = createGame('paladin', 11, { level: { realm: 'barrowvale', level: 2 } });
    const plain = bossOf(g2, 16);
    expect(plain.def).toMatchObject({ id: 'lich', name: 'The Lich' });
    expect(plain.def.phases ?? 2).toBe(2);
    plain.hp = plain.maxHp * 0.3;
    for (let i = 0; i < 400; i++) updateEnemies(g2, 0.016);
    expect(plain.phase).toBe(2);
    expect(waiting(g2)).toHaveLength(0);

    const g = createGame('paladin', 11, { level: { realm: 'barrowvale', level: 4 } });
    const l = bossOf(g, 32);
    expect(l.def).toMatchObject({ id: 'lich', name: 'The Lich, Elite', phases: 3 });
    expect(l.crown).toBe(false);
    for (const [hp, phase] of [[0.6, 2], [0.3, 3]] as const) {
      l.hp = l.maxHp * hp;
      updateEnemies(g, 0.016);
      expect(l.phase).toBe(phase);
    }
    expect(g.banner?.text).toBe('The Lich’s barrow call');
    expect(waiting(g)).toHaveLength(LICH.graves); // the first graves open as the phase begins
    for (const c of waiting(g)) expect(Math.hypot(c.x - l.x, c.y - l.y)).toBeCloseTo(LICH.ring, -1); // round him (he stepped on in the same tick)
    // his next volley of hexes calls again
    l.special = 0;
    updateEnemies(g, 0.016);
    expect(waiting(g)).toHaveLength(LICH.graves * 2);
    // the champion tramples one; the rest rise as Barrow Thralls with half a thrall's HP, and stay down when they fall
    const [first] = waiting(g);
    g.player.x = first.x;
    g.player.y = first.y;
    updateRisingCorpses(g);
    expect(waiting(g)).toHaveLength(LICH.graves * 2 - 1);
    g.player.x = first.x + 2000; // far from every grave
    for (const c of g.corpses) c.t = c.rise ? c.rise.at : c.t;
    const before = g.enemies.length;
    updateRisingCorpses(g);
    const risen = g.enemies.slice(before);
    expect(risen).toHaveLength(LICH.graves * 2 - 1);
    expect(risen.every((e) => e.def.id === 'barrowThrall' && e.risen && !e.side && e.hp === lichGraveRise(g.waveHpMult * g.tier.enemyHp)!.hp)).toBe(true);
    damageEnemy(g, l, l.maxHp * 10); // no minimum phase time: that is the crown boss's
    expect(l.dead).toBe(true);
  });
});

describe('the Barrowvale: rewards (#281)', () => {
  it('a keep-locked pick: 1 of 2 locked Grave rares, the held ones first; no legendary, no class relic', () => {
    const c = newChampion('viking');
    const opts = keepLockedPick(c, 'viking', 'grave', ['barrowBoots', 'plagueCenser']);
    expect(opts).toHaveLength(WORLD.keepLockedOf);
    expect(opts[0]).toBe('plagueCenser');
    for (const id of opts) expect(relicDef(id)).toMatchObject({ family: 'grave', rarity: 'rare' });
    expect(opts.some((id) => relicDef(id).classId)).toBe(false);
    const more = keepLockedPick({ ...c, inventory: opts as never }, 'viking', 'grave', ['plagueCenser']);
    expect(more.length).toBeGreaterThan(0); // three picks never run dry
    expect(more.some((id) => opts.includes(id))).toBe(false);
    expect(keepLockedPick(c, 'viking', 'grave', ['pavise'])).toEqual([]); // no Grave relic held: the Runes
  });

  it('level 3 banks the class relic of Grave with the run, once; every champion has one', () => {
    expect(classRelicOf('paladin', 'grave')).toBe('ossuarySeal');
    expect(classRelicOf('viking', 'grave')).toBe('draugrMead');
    for (const id of CLASS_ORDER) expect(classRelicOf(id, 'grave'), id).toBeTruthy();
    const s = applyRun(withWorld({ marches: [7], barrowvale: [2] }), run({ wave: 24, wavesCleared: 24, realmLevel: barrow(3) }));
    expect(s.levelRewards.level).toEqual([{ kind: 'classRelic' }]);
    expect(s.save.champions.viking!.inventory).toEqual(['draugrMead']);
    expect(applyRun(s.save, run({ wave: 24, wavesCleared: 24, realmLevel: barrow(3) })).levelRewards.level).toEqual([]);
  });

  it('the Knight crown picks Soul Lantern or Crown of Antlers; the Champion crown banks the other; Squire\'s neither', () => {
    const p: WorldProgress = { marches: [7], barrowvale: [4, 4] };
    expect(clearRewards(p, 'barrowvale', 5, 0).crown).toEqual([]);
    expect(clearRewards(p, 'barrowvale', 5, 1).crown).toEqual([{ kind: 'legendaryPick' }]);
    expect(legendaryPickOptions(newChampion('viking'), 'grave').sort()).toEqual(['crownOfAntlers', 'soulLantern']);
    const champ = applyRun(withWorld({ marches: [7], barrowvale: [5, 5, 4] }, ['soulLantern']), run({ tier: 2, wave: 40, wavesCleared: 40, realmLevel: barrow(5) }));
    expect(champ.levelRewards.crown).toEqual([{ kind: 'legendaryOther' }]);
    expect(champ.save.champions.viking!.inventory).toEqual(['soulLantern', 'crownOfAntlers']);
  });

  it('the Legend crown banks the title Gravewarden and the Barrow colours for the account, once', () => {
    const legend = REALMS.barrowvale.legend!;
    expect(legend.title).toBe('Gravewarden');
    expect(SPRITE_PALETTES[legend.palette]).toBeTruthy();
    expect(PALETTE_NAMES[legend.palette]).toBe('Barrow colours');
    expect(PALETTE_NAMES).toHaveLength(SPRITE_PALETTES.length);
    for (const other of [REALMS.ironHold.legend!, REALMS.cinderlands.legend!]) {
      expect(legend.title).not.toBe(other.title);
      expect(legend.palette).not.toBe(other.palette);
    }
    const p: WorldProgress = { marches: [7], barrowvale: [0, 5, 5, 4] };
    expect(levelPanel(p, 'barrowvale', 5, 3).rewards).toEqual([`The title ${legend.title}`, 'A palette']);
    expect(crownGifts('barrowvale', clearRewards(p, 'barrowvale', 5, 3).crown)).toEqual(legend);
    const won = applyRun(withWorld(p, ['soulLantern', 'crownOfAntlers']), run({ tier: 3, wave: 40, wavesCleared: 40, realmLevel: barrow(5) }));
    expect(won.levelRewards.crown).toEqual([{ kind: 'title' }, { kind: 'palette' }]);
    expect(won.save.titles).toEqual([legend.title]);
    expect(won.save.palettes).toEqual([legend.palette]);
    expect(applyRun(won.save, run({ tier: 3, wave: 40, wavesCleared: 40, realmLevel: barrow(5) })).levelRewards.crown).toEqual([]);
  });
});

describe('the Barrowvale: its music theme (#281)', () => {
  it("its levels play the Barrowvale theme; a plain run in the Forsaken Graveyard keeps the graveyard's", () => {
    expect(REALM_THEMES.barrowvale).toBe('barrowvale');
    const level = createGame('viking', 3, { level: { realm: 'barrowvale', level: 1 } });
    expect(level.arena.id).toBe('graveyard');
    expect(moodOf(level).arena).toBe('barrowvale');
    expect(moodOf(createGame('viking', 3, { arena: 'graveyard' })).arena).toBe('graveyard');
  });

  it("it is its own tune: not the graveyard's, the Iron Hold's or the Cinderlands' key, mode or lead", () => {
    const t = THEMES.barrowvale;
    expect(t.name).toBe('The Barrowvale');
    for (const other of [THEMES.graveyard, THEMES.ironHold, THEMES.cinderlands]) {
      expect(t.mode).not.toEqual(other.mode);
      expect(t.lead).not.toBe(other.lead);
      expect(t.root).not.toBe(other.root);
    }
    expect(t.meter).not.toBe(THEMES.graveyard.meter);
  });

  it('every note is in its mode, its voice range and its bar; a boss brings drums and a bass line', () => {
    const t = THEMES.barrowvale;
    expect(t.bpm).toBeGreaterThanOrEqual(60);
    expect(t.bpm).toBeLessThanOrEqual(96);
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
