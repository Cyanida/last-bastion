import { describe, expect, it } from 'vitest';
import { CLASS_ORDER } from '../src/config/classes';
import { relicDef, type RelicId } from '../src/config/relics';
import { REALMS } from '../src/config/world';
import type { Enemy, Game } from '../src/core/types';
import { createGame } from '../src/game';
import { rarePickOptions, newChampion, slotBlock, slotCost } from '../src/logic/champions';
import { championPool, flares, isStarterRelic, leapStacks, pitchDrips, relicPoolFor } from '../src/logic/relics';
import { applyStatus, damageEnemy, updateFields } from '../src/systems/combat';
import { addRelic, updateRelics } from '../src/systems/relics';
import { spawnEnemy } from '../src/systems/spawning';
import { updateStatuses } from '../src/systems/status';

const NEW: RelicId[] = ['flashpowder', 'pitchPot', 'crownOfCinders'];

/** A headless game of `classId` holding `id` at `tier`, with sturdy knights around the player. Hits go through combat.damageEnemy, the real path. */
function arena(id: RelicId, at: [number, number][], tier = 1): { g: Game; foes: Enemy[] } {
  const g = createGame('paladin', 1);
  addRelic(g, id, 'other', tier);
  const foes = at.map(([dx, dy]) => spawnEnemy(g, 'knight', g.player.x + dx, g.player.y + dy));
  for (const f of foes) (f.armorHp = 0), (f.hp = f.maxHp = 5000), g.hash.insert(f);
  g.player.mods = { ...g.baseMods };
  updateRelics(g, 1 / 60);
  return { g, foes };
}
const burning = (e: Enemy) => e.statuses.burn?.stacks ?? 0;
const ignite = (g: Game, e: Enemy, stacks: number, power = 2) => applyStatus(e, { apply: [{ id: 'burn', stacks, power }] }, g);
const stat = (g: Game, id: RelicId) => g.player.relics.stats[id] ?? { damage: 0, healing: 0, prevented: 0 };
/** The game's own order within a frame: relics tick first, then statuses tick, then fields (game.updateGame). */
const frame = (g: Game, dt = 1 / 30) => {
  g.time += dt;
  g.player.mods = { ...g.baseMods };
  updateRelics(g, dt);
  updateStatuses(g, dt);
  updateFields(g, dt);
};

describe('the Cinderlands Flame relics (#229): the model', () => {
  it('two rares and a second legendary, all Flame and open to every class', () => {
    expect(NEW.map((id) => relicDef(id).rarity)).toEqual(['rare', 'rare', 'legendary']);
    for (const id of NEW) {
      expect(relicDef(id).family).toBe('flame');
      expect(relicDef(id).classId).toBeUndefined();
      for (const c of CLASS_ORDER) expect(relicPoolFor(c)).toContain(id);
    }
  });

  it('none is a starter relic: they come with the Cinderlands (its whole family) or the inventory', () => {
    for (const id of NEW) {
      expect(isStarterRelic(id)).toBe(false);
      expect(championPool('viking', [])).not.toContain(id);
      expect(championPool('viking', [], REALMS.cinderlands.family!)).toContain(id);
      expect(championPool('viking', [id])).toContain(id);
    }
  });

  it('the slot rules: the legendary takes 2 slots, only one Flame legendary goes in, at most 4 Flame relics', () => {
    expect(slotCost('crownOfCinders')).toBe(2);
    expect(slotCost('flashpowder')).toBe(1);
    expect(slotBlock('viking', ['dragonsTongue'], 'crownOfCinders', 5)).toBe('legendary');
    expect(slotBlock('viking', ['flashpowder', 'pitchPot', 'brimstoneOil', 'emberheart'], 'cinderCharm', 6)).toBe('family');
  });

  it('the Marches Flame level offers the new rares once the older two are owned', () => {
    const c = { ...newChampion('archer'), inventory: ['salamanderScale', 'emberMantle'] as RelicId[] };
    expect(rarePickOptions(c, 'flame', 2)).toEqual(['flashpowder', 'pitchPot']);
  });

  it('the pure rules: when a hit flares, which enemies drip pitch, what the leap passes on', () => {
    expect(flares(3, 3, 5, 3.9, 1)).toBe(true);
    expect(flares(2, 3, 5, 0, 1)).toBe(false); // not enough stacks
    expect(flares(5, 3, 5, 4.5, 1)).toBe(false); // too soon
    const foes = [{ x: 300, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }, { x: 900, y: 0 }];
    expect(pitchDrips(foes, 0, 0, 360, 2, () => false)).toEqual([foes[1], foes[2]]); // nearest first, as many as are free
    expect(pitchDrips(foes, 0, 0, 360, 5, (e) => e === foes[1])).toEqual([foes[2], foes[0]]); // one already in pitch, one out of reach
    expect(pitchDrips(foes, 0, 0, 360, 0, () => false)).toEqual([]);
    expect(leapStacks(3, 0)).toBe(3);
    expect(leapStacks(3, 1)).toBe(4);
    expect(leapStacks(0, 1)).toBe(0);
  });
});

describe('what each one does, through the real hit, kill and tick paths', () => {
  it('Flashpowder: an attack hit on an enemy at 3+ burn stacks flares round it, once a second; abilities count, relic bursts do not', () => {
    const { g, foes } = arena('flashpowder', [[60, 0], [110, 0], [60, 60]]);
    const [lit, a, b] = foes;
    ignite(g, lit, 2);
    damageEnemy(g, lit, 10, false, 0, 0, 'attack');
    expect(a.hp).toBe(a.maxHp); // 2 stacks: no flare
    ignite(g, lit, 1);
    damageEnemy(g, lit, 10, false, 0, 0, 'relic');
    expect(a.hp).toBe(a.maxHp); // a relic's own damage never sets it off
    damageEnemy(g, lit, 10, false, 0, 0, 'attack');
    expect(a.hp).toBeLessThan(a.maxHp);
    expect(b.hp).toBeLessThan(b.maxHp);
    expect(burning(a)).toBe(1);
    expect(stat(g, 'flashpowder').damage).toBeGreaterThan(0);
    const hp = a.hp;
    damageEnemy(g, lit, 10, false, 0, 0, 'ability');
    expect(a.hp).toBe(hp); // within its second
    g.time += 1;
    damageEnemy(g, lit, 10, false, 0, 0, 'ability');
    expect(a.hp).toBeLessThan(hp);
  });

  it('Flashpowder awakened (Chain Reaction): an enemy the flare brings to 3 stacks flares too, one link only', () => {
    const { g, foes } = arena('flashpowder', [[60, 0], [140, 0], [220, 0], [300, 0]], 3);
    const [lit, next, far, beyond] = foes;
    ignite(g, lit, 3);
    ignite(g, next, 2);
    ignite(g, far, 2); // 160 px from the first flare: only next's flare reaches it
    damageEnemy(g, lit, 10, false, 0, 0, 'attack');
    expect(burning(next)).toBe(4); // 3 from the first flare, then its own flare catches it too
    expect(far.hp).toBeLessThan(far.maxHp); // next flared
    expect(burning(far)).toBe(3);
    expect(beyond.hp).toBe(beyond.maxHp); // far reached 3 stacks from a linked flare: no third link
  });

  it('Pitch Pot: every 2 s a burning enemy near you drips a fire patch at its feet; the pitch burns and sets burns; no patch on a patch', () => {
    const { g, foes } = arena('pitchPot', [[80, 0], [100, 0]]);
    const [lit, beside] = foes;
    const patches = () => g.fields.filter((f) => f.by === 'pitchPot');
    ignite(g, lit, 1);
    for (let i = 0; i < 30; i++) frame(g); // 1 s
    expect(patches()).toHaveLength(0);
    expect(burning(beside)).toBe(0);
    for (let i = 0; i < 32; i++) frame(g); // past 2 s
    expect(patches()).toHaveLength(1);
    expect([patches()[0].x, patches()[0].y]).toEqual([lit.x, lit.y]);
    for (let i = 0; i < 15; i++) frame(g); // half a second in the pitch
    expect(burning(beside)).toBeGreaterThan(0);
    expect(beside.hp).toBeLessThan(beside.maxHp);
    expect(stat(g, 'pitchPot').damage).toBeGreaterThan(0);
    for (let i = 0; i < 50; i++) frame(g); // the next drip: both burn, both stand in pitch
    expect(patches()).toHaveLength(1);
  });

  it('Pitch Pot: at most 4 patches at once', () => {
    const at = Array.from({ length: 6 }, (_, i): [number, number] => [Math.cos(i) * 150, Math.sin(i) * 150]);
    const { g, foes } = arena('pitchPot', at);
    for (const f of foes) ignite(g, f, 1);
    for (let i = 0; i < 62; i++) frame(g);
    expect(g.fields.filter((f) => f.by === 'pitchPot')).toHaveLength(4);
  });

  it('Pitch Pot awakened (Tar Pit): an enemy that dies in the pitch bursts (a Pyre); tier I does not', () => {
    for (const tier of [1, 3]) {
      const { g, foes } = arena('pitchPot', [[80, 0], [140, 0]], tier);
      const [lit, near] = foes;
      ignite(g, lit, 1);
      for (let i = 0; i < 62; i++) frame(g);
      expect(g.fields.some((f) => f.by === 'pitchPot')).toBe(true);
      const hp = near.hp;
      damageEnemy(g, lit, 1e6, false, 0, 0, 'attack');
      expect(lit.dead).toBe(true);
      if (tier === 3) expect(near.hp).toBeLessThan(hp - 500); // 20% of a 5000 HP foe's max HP
      else expect(near.hp).toBe(hp);
    }
  });

  it('Crown of Cinders: a burning enemy that dies passes its burn stacks and a burst to everything within 110 px', () => {
    const { g, foes } = arena('crownOfCinders', [[60, 0], [140, 0], [260, 0], [60, 60]]);
    const [dead, near, far, cold] = foes;
    ignite(g, dead, 3, 4);
    damageEnemy(g, cold, 1e6, false, 0, 0, 'attack'); // no burn: nothing leaps
    expect(near.hp).toBe(near.maxHp);
    damageEnemy(g, dead, 1e6, false, 0, 0, 'attack');
    expect(burning(near)).toBe(3);
    expect(near.statuses.burn!.power).toBe(4);
    expect(near.hp).toBeLessThan(near.maxHp);
    expect(far.hp).toBe(far.maxHp);
    expect(burning(far)).toBe(0);
    expect(stat(g, 'crownOfCinders').damage).toBeGreaterThan(0);
  });

  it('Crown of Cinders: a burn tick that kills passes the fire on too (the burn is still on the enemy when it dies)', () => {
    const { g, foes } = arena('crownOfCinders', [[60, 0], [140, 0]]);
    const [dying, near] = foes;
    dying.hp = 3;
    ignite(g, dying, 2, 10);
    for (let i = 0; i < 30 && !dying.dead; i++) frame(g);
    expect(dying.dead).toBe(true);
    expect(burning(near)).toBe(2);
  });

  it('Crown of Cinders awakened (Conflagration): the fire leaps 200 px and adds a stack', () => {
    const { g, foes } = arena('crownOfCinders', [[60, 0], [240, 0]], 3);
    const [dead, far] = foes;
    ignite(g, dead, 3);
    damageEnemy(g, dead, 1e6, false, 0, 0, 'attack');
    expect(burning(far)).toBe(4);
  });
});
