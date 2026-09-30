import { describe, expect, it } from 'vitest';
import { FINAL } from '../src/config/acts';
import { relicDef } from '../src/config/relics';
import { talentsFor } from '../src/config/talents';
import type { Game } from '../src/core/types';
import { createGame, type RunOptions } from '../src/game';
import { newBuild } from '../src/logic/championLevels';
import { applyGrowth } from '../src/logic/formulas';
import { headStartLevel, levelBoss, wingsOpenBy } from '../src/logic/world';
import { updateSpawning } from '../src/systems/spawning';

/** Stand the run at the end of wave `wave` with the field empty, and let one spawning step close it. */
function clearWave(g: Game, wave: number): void {
  g.wave = wave;
  g.breather = 0;
  g.spawnQueue.length = 0;
  g.enemies.length = 0;
  updateSpawning(g, 0.016);
}

/** Step spawning until wave `wave` starts (its boss is drawn on the way). */
function startWave(g: Game, wave: number): void {
  g.wave = wave - 1;
  g.breather = 0.001;
  updateSpawning(g, 0.016);
}

describe('levels: the head start (#191)', () => {
  it('the level at a first wave is the pace after the wave before', () => {
    expect([1, 6, 11, 16, 21, 26, 31].map(headStartLevel)).toEqual([1, 6, 11, 15, 19, 21, 24]);
  });

  it('wings open by a start wave: the mid-Act boss behind it opened one', () => {
    expect([1, 6, 11, 16, 21, 26, 31].map(wingsOpenBy)).toEqual([0, 1, 0, 1, 0, 1, 0]);
  });

  it('a plain run starts at wave 1, as today', () => {
    const g = createGame('paladin', 3);
    expect(g.startWave).toBe(1);
    expect(g.level).toBeNull();
    expect(g.wave).toBe(0);
    expect(g.player.level).toBe(1);
  });

  it('a level starts at its first wave with no head start: the player is its champion, and nothing is queued (#238)', () => {
    const g = createGame('paladin', 3, { level: { realm: 'marches', level: 3 } }); // waves 11-15
    const p = g.player;
    expect(g.startWave).toBe(11);
    expect([g.wave, g.wavesCleared, g.act]).toEqual([10, 10, 2]);
    expect(g.level).toMatchObject({ realm: 'marches', level: 3, last: 15, cleared: false });
    expect(g.arena.id).toBe('courtyard');
    expect(p.level).toBe(1); // no champion given: a level-1 one
    expect([g.pendingAbilityTiers, g.pendingUtilityTiers, g.pendingLevelUps, g.talentPoints]).toEqual([[], [], 0, 0]);
    expect(p.stats).toEqual(createGame('paladin', 3).player.stats);
    expect(p.hp).toBe(p.stats.hp);
    expect(g.pendingBoard).toBe(true); // Act II's board is up
  });

  it("Keep and mastery start levels give their growth, and the level stays the champion's (#238)", () => {
    const g = createGame('viking', 3, { level: { realm: 'marches', level: 2 }, meta: { startLevel: 1 } });
    expect(g.player.level).toBe(1);
    expect(g.player.stats).toEqual(applyGrowth(createGame('viking', 3).player.stats, g.player.cls.growth));
  });

  it('a mid-Act start opens the wing its mid-Act boss would have', () => {
    const open = (o: RunOptions) => Object.values(createGame('archer', 9, o).regionOpen).filter(Boolean).length;
    expect(open({ level: { realm: 'marches', level: 2 } })).toBe(open({}) + 1);
    expect(open({ level: { realm: 'marches', level: 3 } })).toBe(open({}));
  });

  it("the champion's talents are in the level; the account's points are not the run's to spend (#238)", () => {
    const talents = talentsFor('viking').filter((n) => n.row === 0).map((n) => n.id).slice(0, 2);
    const g = createGame('viking', 3, { level: { realm: 'marches', level: 2, champion: { ...newBuild(), level: 3, talents } }, bonusTalentPoints: 2 });
    expect(g.player.talents).toEqual(talents);
    expect(g.talentPoints).toBe(0);
  });

  it('slotted relics come after the growth, at the level tier, from the loadout; the opening pick (#194) never offers one', () => {
    const g = createGame('angel', 3, { level: { realm: 'ironHold', level: 4, relics: ['brimstoneOil', 'bloodPact'] }, meta: { startRelic: 1 } });
    const r = g.player.relics;
    expect(r.held).toEqual(['brimstoneOil', 'bloodPact']);
    expect(r.tiers).toEqual({ brimstoneOil: 2, bloodPact: 2 }); // realm level 4: tier II
    expect(r.from.brimstoneOil).toBe('loadout');
    expect(g.arena.id).toBe('keep'); // the Iron Hold's arena
    expect(g.player.hp).toBe(g.player.stats.hp); // Blood Pact's cut is taken off the grown HP
    expect(g.player.level).toBe(1);
    const opening = r.offers.find((o) => o.from === 'start')!;
    expect(opening.options.every((id) => relicDef(id).family === 'steel' && !r.held.includes(id))).toBe(true); // the Iron Hold's family
  });
});

describe('levels: the end boss and "level cleared" (#191)', () => {
  it('the end boss: named, the Usurper, or the draw; never the Usurper at wave 40 outside the Last Bastion', () => {
    expect(levelBoss('marches', 7)).toBe('warden');
    expect(levelBoss('lastBastion', 1)).toBe(FINAL.boss);
    expect(levelBoss('ironHold', 5)).toBe('ironKing'); // #216: built now
    expect(levelBoss('barrowvale', 5)).not.toBe(FINAL.boss); // not built yet: an Act boss
    expect(levelBoss('marches', 1)).toBe('blackKnight'); // Act I keeps the arena's opener
  });

  it("the level's last wave brings its realm's boss", () => {
    const g = createGame('paladin', 3, { level: { realm: 'marches', level: 7 } });
    startWave(g, 40);
    expect(g.bossesSeen.at(-1)).toBe('warden');
    const h = createGame('paladin', 3, { level: { realm: 'ironHold', level: 2 } }); // ends on the Warden at wave 10
    startWave(h, 10);
    expect(h.bossesSeen.at(-1)).toBe('warden');
  });

  it('a level ends on its last wave: cleared, before any Merchant or fork, and nothing more spawns', () => {
    const g = createGame('paladin', 3, { level: { realm: 'marches', level: 2 } }); // waves 6-10
    clearWave(g, 10);
    expect(g.level!.cleared).toBe(true);
    expect([g.pendingMerchant, g.pendingRoute]).toEqual([false, null]);
    expect(g.wavesCleared).toBe(10);
    g.breather = 0.001;
    updateSpawning(g, 1);
    expect(g.wave).toBe(10);
    const plain = createGame('paladin', 3);
    clearWave(plain, 10);
    expect(plain.pendingMerchant).toBe(true); // a plain run goes on to the Merchant, as today
  });

  it('a wave before the last is just a wave', () => {
    const g = createGame('paladin', 3, { level: { realm: 'marches', level: 7 } });
    clearWave(g, 35);
    expect(g.level!.cleared).toBe(false);
  });
});
