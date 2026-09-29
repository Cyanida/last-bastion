import { describe, expect, it } from 'vitest';
import { CLASS_ORDER, type ClassId } from '../src/config/classes';
import { DUOS, duoOf, relicDef, relicN, RELICS, type RelicId } from '../src/config/relics';
import { REALMS } from '../src/config/world';
import type { Enemy, Game } from '../src/core/types';
import { emit } from '../src/core/events';
import { createGame } from '../src/game';
import { createMinion } from '../src/entities/actors';
import { slotBlock } from '../src/logic/champions';
import { bodkinShare, bodkinStep, championPool, haloStacks, perStack, relicPoolFor } from '../src/logic/relics';
import { damagePlayer } from '../src/systems/combat';
import { armorStacksMax } from '../src/systems/relicCore';
import { addRelic, offerRelics, resolveRelicOffer, updateRelics } from '../src/systems/relics';
import { spawnEnemy } from '../src/systems/spawning';

const CLASS_RELICS: [RelicId, ClassId][] = [['ironHalo', 'angel'], ['legionPlate', 'necromancer'], ['bodkinPoints', 'archer']];

/** A headless game of `classId` holding `ids` at `tier`, with a bare, tough knight next to the player. */
function arena(classId: ClassId, ids: RelicId[], tier = 1): { g: Game; foe: Enemy } {
  const g = createGame(classId, 1);
  g.rng = Object.assign(() => 0.999, { s: 0 }); // no random procs
  for (const id of ids) addRelic(g, id, 'other', tier);
  const foe = spawnEnemy(g, 'knight', g.player.x + 60, g.player.y);
  foe.armorHp = 0;
  foe.hp = foe.maxHp = 1e6;
  g.hash.insert(foe);
  g.player.mods = { ...g.baseMods };
  updateRelics(g, 1 / 60);
  return { g, foe };
}
const lost = (e: Enemy) => e.maxHp - e.hp;
const stat = (g: Game, id: RelicId | 'ironTithe') => g.player.relics.stats[id] ?? { damage: 0, healing: 0, prevented: 0 };
const hit = (g: Game, e: Enemy, source: 'attack' | 'ability' | 'minion', amount = 50) => emit(g, 'onHit', { enemy: e, amount, crit: false, source });

describe('the Iron Hold class relics (#218): the model', () => {
  it('one Steel class relic each for the Angel, the Necromancer and the Archer, offered to that class only', () => {
    for (const [id, c] of CLASS_RELICS) {
      expect(relicDef(id).family).toBe('steel');
      expect(relicDef(id).rarity).toBe('rare');
      expect(relicDef(id).classId).toBe(c);
      for (const other of CLASS_ORDER) expect(relicPoolFor(other).includes(id), `${id} ${other}`).toBe(other === c);
    }
    // every class now has a Steel class relic
    for (const c of CLASS_ORDER) expect(Object.values(RELICS).some((r) => r.family === 'steel' && r.classId === c), c).toBe(true);
  });

  it('a class relic is not in the starter pool: it comes with the Iron Hold (its level 3) or the inventory', () => {
    for (const [id, c] of CLASS_RELICS) {
      expect(championPool(c, [])).not.toContain(id);
      expect(championPool(c, [], REALMS.ironHold.family!)).toContain(id);
      expect(championPool(c, [id])).toContain(id);
    }
  });

  it('the slot rules: a class relic counts toward the 2 class relics', () => {
    expect(slotBlock('archer', ['rimebow', 'galeforceQuiver'], 'bodkinPoints', 5)).toBe('classRelics');
    expect(slotBlock('archer', ['rimebow'], 'bodkinPoints', 5)).toBeNull();
  });

  it('the pure rules: Radiance stacks, the per-stack bonus, the bodkin share and count', () => {
    expect(haloStacks(0, 5)).toBe(1);
    expect(haloStacks(14, 5)).toBe(3);
    expect(haloStacks(-3, 5)).toBe(1);
    expect(perStack(100, 4, 0.03)).toBeCloseTo(12);
    expect(perStack(100, -1, 0.03)).toBe(0);
    expect(bodkinShare(0.4, 0.02, 10)).toBeCloseTo(0.6);
    let s = { count: 0, bodkin: false };
    expect(Array.from({ length: 6 }, () => (s = bodkinStep(s.count, 3, false)).bodkin)).toEqual([false, false, true, false, false, true]);
    expect(bodkinStep(0, 3, true).bodkin).toBe(true); // Armor-Piercer
  });

  it('Iron Tithe: the new Steel duo, from Reprisal Cuirass and Vampire Fang (Steel and Blood), each in no other recipe', () => {
    expect(DUOS.ironTithe.families).toEqual(['steel', 'blood']);
    expect(DUOS.ironTithe.from).toEqual(['reprisalCuirass', 'vampireFang']);
    expect(duoOf('reprisalCuirass')).toBe('ironTithe');
    expect(duoOf('vampireFang')).toBe('ironTithe');
  });
});

describe('what each one does', () => {
  it('Iron Halo: Heavenly Radiance gives 1 + Grace/5 armor stacks, and its hits strike for damage per stack', () => {
    const { g, foe } = arena('angel', ['ironHalo']);
    const p = g.player;
    emit(g, 'onAbilityUsed', { cooldown: 16 });
    expect(p.armorStacks).toBe(Math.min(armorStacksMax(p), haloStacks(p.stats.secondary, 5)));
    hit(g, foe, 'attack');
    expect(lost(foe)).toBe(0); // only Radiance's hits
    hit(g, foe, 'ability');
    expect(lost(foe)).toBeGreaterThan(0);
    expect(stat(g, 'ironHalo').damage).toBeGreaterThan(0);
  });

  it('Iron Halo awakened (Aureole): Radiance heals more per armor stack', () => {
    const { g } = arena('angel', ['ironHalo'], 3);
    g.player.hp = 1;
    emit(g, 'onAbilityUsed', { cooldown: 16 });
    expect(stat(g, 'ironHalo').healing).toBeGreaterThan(0);
  });

  it('Legion Plate: every 6th minion hit gives an armor stack; minion hits deal 3% more per stack held', () => {
    const { g, foe } = arena('necromancer', ['legionPlate']);
    const p = g.player;
    for (let i = 0; i < 5; i++) hit(g, foe, 'minion');
    expect(p.armorStacks).toBe(0);
    expect(lost(foe)).toBe(0); // no stacks, no bonus
    hit(g, foe, 'minion');
    expect(p.armorStacks).toBe(1);
    p.armorStacks = 4;
    const before = lost(foe);
    hit(g, foe, 'minion', 100);
    expect(lost(foe) - before).toBeCloseTo(perStack(100, 4, relicN('legionPlate', 1).per), 0);
    hit(g, foe, 'attack', 100); // the champion's own attack does not count
    expect(stat(g, 'legionPlate').damage).toBeCloseTo(lost(foe));
  });

  it('Legion Plate awakened (Iron Legion): a skeleton you raise gets 50% more HP, once', () => {
    const { g } = arena('necromancer', ['legionPlate'], 3);
    const m = createMinion(g.player.x, g.player.y, { hp: 100, damage: 10, speed: 160, attackCd: 0.7, life: 10 });
    g.minions.push(m);
    updateRelics(g, 1 / 60);
    updateRelics(g, 1 / 60);
    expect(m.maxHp).toBeCloseTo(150);
  });

  it('Bodkin Points: every 3rd arrow hit adds 40% (+2% per Focus) of the hit and an armor stack; abilities do not count', () => {
    const { g, foe } = arena('archer', ['bodkinPoints']);
    const p = g.player;
    hit(g, foe, 'attack', 100);
    hit(g, foe, 'ability', 100);
    hit(g, foe, 'attack', 100);
    expect(lost(foe)).toBe(0);
    hit(g, foe, 'attack', 100);
    expect(lost(foe)).toBeCloseTo(100 * bodkinShare(0.4, 0.02, p.stats.secondary), 0);
    expect(p.armorStacks).toBe(1);
  });

  it('Bodkin Points: a bodkin is not turned by a tower shield it strikes from the front', () => {
    const { g } = arena('archer', ['bodkinPoints']);
    const wall = spawnEnemy(g, 'ironShieldwall', g.player.x + 80, g.player.y);
    wall.hp = wall.maxHp = 1e6;
    wall.angle = Math.PI; // facing the archer
    for (let i = 0; i < 3; i++) hit(g, wall, 'attack', 100);
    expect(lost(wall)).toBeCloseTo(100 * bodkinShare(0.4, 0.02, g.player.stats.secondary), 0);
  });

  it('Bodkin Points awakened (Armor-Piercer): at full armor stacks every arrow hit is a bodkin', () => {
    const { g, foe } = arena('archer', ['bodkinPoints'], 3);
    g.player.armorStacks = armorStacksMax(g.player);
    hit(g, foe, 'attack', 100);
    expect(lost(foe)).toBeGreaterThan(0);
  });

  it('Iron Tithe: formed, a reprisal opens bleed stacks on its target and heals you', () => {
    const { g, foe } = arena('viking', ['reprisalCuirass', 'vampireFang']);
    offerRelics(g, 3, 'boss');
    expect(resolveRelicOffer(g, 'ironTithe')).toBe(true);
    g.player.mods = { ...g.baseMods };
    updateRelics(g, 1 / 60);
    const p = g.player;
    damagePlayer(g, 20, true, foe);
    p.hp = p.stats.hp * 0.5;
    hit(g, foe, 'attack');
    expect(foe.statuses.bleed?.stacks ?? 0).toBeGreaterThanOrEqual(DUOS.ironTithe.n.bleed);
    expect(stat(g, 'ironTithe').healing).toBeGreaterThan(0);
    expect(p.hp).toBeGreaterThan(p.stats.hp * 0.5);
  });
});
