import { describe, expect, it } from 'vitest';
import { CLASS_ORDER, type ClassId } from '../src/config/classes';
import { DUO_IDS, DUOS, duoOf, relicDef, relicN, RELICS, type RelicId } from '../src/config/relics';
import { REALMS } from '../src/config/world';
import type { Enemy, Game, Minion } from '../src/core/types';
import { emit } from '../src/core/events';
import { createGame } from '../src/game';
import { createMinion } from '../src/entities/actors';
import { slotBlock } from '../src/logic/champions';
import { baptismHeal, bonefireBurn, championPool, relicPoolFor, stoke } from '../src/logic/relics';
import { applyStatus } from '../src/systems/combat';
import { updateAbility } from '../src/systems/abilities';
import { relicDamage } from '../src/systems/relicCore';
import { addRelic, offerRelics, resolveRelicOffer, updateRelics } from '../src/systems/relics';
import { spawnEnemy } from '../src/systems/spawning';
import { updateStatuses } from '../src/systems/status';

const CLASS_RELICS: [RelicId, ClassId][] = [['surtrsBrand', 'viking'], ['bonefire', 'necromancer']];

/** A headless game of `classId` holding `ids` at `tier`, with bare, tough knights at `at` (offsets from the player). */
function arena(classId: ClassId, ids: RelicId[], tier = 1, at: [number, number][] = [[60, 0]]): { g: Game; foes: Enemy[]; foe: Enemy } {
  const g = createGame(classId, 1);
  g.rng = Object.assign(() => 0.999, { s: 0 }); // no random procs
  for (const id of ids) addRelic(g, id, 'other', tier);
  const foes = at.map(([dx, dy]) => spawnEnemy(g, 'knight', g.player.x + dx, g.player.y + dy));
  for (const f of foes) (f.armorHp = 0), (f.hp = f.maxHp = 1e6), g.hash.insert(f);
  g.player.mods = { ...g.baseMods };
  updateRelics(g, 1 / 60);
  return { g, foes, foe: foes[0] };
}
const lost = (e: Enemy) => e.maxHp - e.hp;
const burning = (e: Enemy) => e.statuses.burn?.stacks ?? 0;
const stat = (g: Game, id: RelicId | 'baptismOfFire') => g.player.relics.stats[id] ?? { damage: 0, healing: 0, prevented: 0 };
const hit = (g: Game, e: Enemy, source: 'attack' | 'ability' | 'minion', amount = 50) => emit(g, 'onHit', { enemy: e, amount, crit: false, source });
/** The game's own order within a frame: relics tick first, then statuses tick (game.updateGame). */
const frame = (g: Game, dt = 1 / 30) => {
  g.time += dt;
  g.player.mods = { ...g.baseMods };
  updateRelics(g, dt);
  updateStatuses(g, dt);
};
/** A real cast of the signature ability, through systems/abilities. */
const cast = (g: Game) => {
  g.player.abilityCd = 0;
  g.input.ability = true;
  updateAbility(g, 1 / 60);
  g.input.ability = false;
};
const skeleton = (g: Game, x: number, y: number): Minion => {
  const m = createMinion(x, y, { hp: 100, damage: 10, speed: 160, attackCd: 0.7, life: 30 });
  g.minions.push(m);
  return m;
};

describe('the Cinderlands class relics and duo (#230): the model', () => {
  it('one Flame class relic each for the Viking and the Necromancer, offered to that class only; every class now has one', () => {
    for (const [id, c] of CLASS_RELICS) {
      expect(relicDef(id).family).toBe('flame');
      expect(relicDef(id).rarity).toBe('rare');
      expect(relicDef(id).classId).toBe(c);
      for (const other of CLASS_ORDER) expect(relicPoolFor(other).includes(id), `${id} ${other}`).toBe(other === c);
    }
    for (const c of CLASS_ORDER) expect(Object.values(RELICS).filter((r) => r.family === 'flame' && r.classId === c), c).toHaveLength(1);
  });

  it('a class relic is not in the starter pool: it comes with the Cinderlands (its level 3) or the inventory', () => {
    for (const [id, c] of CLASS_RELICS) {
      expect(championPool(c, [])).not.toContain(id);
      expect(championPool(c, [], REALMS.cinderlands.family!)).toContain(id);
      expect(championPool(c, [id])).toContain(id);
    }
  });

  it('the slot rules: a class relic counts toward the 2 class relics', () => {
    expect(slotBlock('viking', ['wolfskin', 'ironhide'], 'surtrsBrand', 5)).toBe('classRelics');
    expect(slotBlock('viking', ['wolfskin'], 'surtrsBrand', 5)).toBeNull();
    expect(slotBlock('necromancer', ['boneChime', 'legionPlate'], 'bonefire', 5)).toBe('classRelics');
  });

  it('the pure rules: the stokes and their cap, the burn a skeleton sets, what a flare heals', () => {
    expect(stoke(0, 8, 5)).toEqual({ count: 1, full: false });
    expect(stoke(12, 8, 5)).toEqual({ count: 13, full: true });
    expect(stoke(13, 8, 5.9)).toEqual({ count: 13, full: true }); // never past 8 + Rage
    expect(stoke(7, 8, -2)).toEqual({ count: 8, full: true });
    expect(bonefireBurn(10, 0.04, 5)).toBeCloseTo(12);
    expect(bonefireBurn(10, 0.04, -5)).toBe(10);
    expect(baptismHeal(200, 0.01, 3, 4)).toBeCloseTo(6);
    expect(baptismHeal(200, 0.01, 9, 4)).toBeCloseTo(8); // no more than 4 enemies count
    expect(baptismHeal(200, 0.01, 0, 4)).toBe(0);
  });

  it('Baptism of Fire: the Cinderlands duo, from Flashpowder and Blessed Water (Flame and Holy), each in no other recipe', () => {
    expect(DUOS.baptismOfFire.families).toEqual(['flame', 'holy']);
    expect(DUOS.baptismOfFire.from).toEqual(['flashpowder', 'blessedWater']);
    expect(duoOf('flashpowder')).toBe('baptismOfFire');
    expect(duoOf('blessedWater')).toBe('baptismOfFire');
    expect(DUO_IDS.length).toBeGreaterThanOrEqual(14); // a realm's duo each since: 15 with the Barrowvale's (#280)
  });
});

describe('what each one does', () => {
  it("Surtr's Brand: only Rage's attack hits stoke the axe, up to 8 + Rage; when Rage ends it bursts for damage per stoke and 2 burn stacks, near the Viking only", () => {
    const { g, foes } = arena('viking', ['surtrsBrand'], 1, [[60, 0], [400, 0]]);
    const [near, far] = foes;
    const p = g.player;
    hit(g, near, 'attack');
    expect(g.vars['surtr.n'] ?? 0).toBe(0); // no Rage, no stoke
    cast(g);
    expect(p.abilityTime).toBeGreaterThan(0);
    hit(g, near, 'ability');
    hit(g, near, 'minion');
    expect(g.vars['surtr.n'] ?? 0).toBe(0);
    for (let i = 0; i < 3; i++) hit(g, near, 'attack');
    expect(g.vars['surtr.n']).toBe(3);
    expect(lost(near)).toBe(0); // nothing until Rage ends
    for (let i = 0; i < 12 && p.abilityTime > 0; i++) updateAbility(g, 1);
    expect(p.abilityTime).toBe(0);
    const three = stat(g, 'surtrsBrand').damage;
    expect(three).toBeGreaterThan(0);
    expect(lost(near)).toBeCloseTo(three);
    expect(burning(near)).toBeGreaterThanOrEqual(relicN('surtrsBrand', 1).stacks);
    expect(lost(far)).toBe(0);
    expect(burning(far)).toBe(0);
    expect(g.vars['surtr.n']).toBe(0);

    // the next Rage, stoked to the brim: 8 + Rage stokes however many hits land, and the burst grows with them
    cast(g);
    for (let i = 0; i < 40; i++) hit(g, near, 'attack');
    const cap = relicN('surtrsBrand', 1).base + Math.floor(p.stats.secondary);
    expect(g.vars['surtr.n']).toBe(cap);
    expect(stat(g, 'surtrsBrand').damage).toBeCloseTo(three); // not awakened: full stokes wait for the end
    for (let i = 0; i < 12 && p.abilityTime > 0; i++) updateAbility(g, 1);
    expect(stat(g, 'surtrsBrand').damage - three).toBeCloseTo((three / 3) * cap, 0);
  });

  it("Surtr's Brand: a Rage with no hit ends without a burst", () => {
    const { g, foe } = arena('viking', ['surtrsBrand']);
    cast(g);
    for (let i = 0; i < 12 && g.player.abilityTime > 0; i++) updateAbility(g, 1);
    expect(lost(foe)).toBe(0);
  });

  it("Surtr's Brand awakened (Twilight): at full stokes the fire bursts at once, during Rage, and the count starts again", () => {
    const { g, foe } = arena('viking', ['surtrsBrand'], 3);
    const p = g.player;
    cast(g);
    const cap = relicN('surtrsBrand', 3).base + Math.floor(p.stats.secondary);
    for (let i = 0; i < cap - 1; i++) hit(g, foe, 'attack');
    expect(lost(foe)).toBe(0);
    hit(g, foe, 'attack');
    expect(p.abilityTime).toBeGreaterThan(0);
    expect(lost(foe)).toBeGreaterThan(0);
    expect(g.vars['surtr.n']).toBe(0);
    hit(g, foe, 'attack');
    expect(g.vars['surtr.n']).toBe(1);
  });

  it('Bonefire: every 1.5 s each skeleton sets the enemies within 90 px of it alight, at a burn that grows with Soul Power; its ticks are its damage', () => {
    const { g, foes } = arena('necromancer', ['bonefire'], 1, [[200, 0], [200, 300]]);
    const [near, far] = foes;
    const p = g.player;
    const n = relicN('bonefire', 1);
    skeleton(g, near.x - 40, near.y);
    for (let i = 0; i < 30 * n.every - 2; i++) frame(g);
    expect(burning(near)).toBe(0); // not yet
    for (let i = 0; i < 4; i++) frame(g);
    expect(burning(near)).toBe(1);
    expect(near.statuses.burn!.power).toBeCloseTo(bonefireBurn(relicDamage(p, n.power), n.perSoul, p.stats.secondary));
    expect(burning(far)).toBe(0);
    for (let i = 0; i < 60; i++) frame(g);
    expect(stat(g, 'bonefire').damage).toBeGreaterThan(0);
    expect(stat(g, 'bonefire').damage).toBeCloseTo(lost(near));
    // two skeletons beside one enemy: a stack from each
    const { g: g2, foe } = arena('necromancer', ['bonefire'], 1, [[200, 0]]);
    skeleton(g2, foe.x - 40, foe.y);
    skeleton(g2, foe.x + 40, foe.y);
    for (let i = 0; i < 30 * n.every + 2; i++) frame(g2);
    expect(burning(foe)).toBe(2);
  });

  it('Bonefire: with no skeletons nothing burns, and tier II burns every second', () => {
    const { g, foe } = arena('necromancer', ['bonefire']);
    for (let i = 0; i < 90; i++) frame(g);
    expect(burning(foe)).toBe(0);
    expect(relicN('bonefire', 2).every).toBeLessThan(relicN('bonefire', 1).every);
  });

  it('Bonefire awakened (Balefire): a skeleton you raise rises in a burst of fire, once; a relic\'s skeleton does not', () => {
    const { g, foe } = arena('necromancer', ['bonefire'], 3, [[200, 0]]);
    const a = RELICS.bonefire.awaken.n;
    const m = skeleton(g, foe.x - 60, foe.y);
    updateRelics(g, 1 / 60);
    const burst = lost(foe);
    expect(burst).toBeGreaterThan(0);
    expect(burning(foe)).toBeGreaterThanOrEqual(a.stacks);
    expect(m.bonefire).toBe(true);
    updateRelics(g, 1 / 60);
    expect(lost(foe)).toBe(burst); // once
    const lantern = skeleton(g, foe.x - 60, foe.y);
    lantern.relicBy = 'soulLantern';
    updateRelics(g, 1 / 60);
    expect(lost(foe)).toBe(burst);
  });

  it('Bonefire: a skeleton that rose before the awakening does not burst when it comes', () => {
    const { g, foe } = arena('necromancer', ['bonefire'], 2, [[200, 0]]);
    skeleton(g, foe.x - 60, foe.y);
    updateRelics(g, 1 / 60);
    expect(lost(foe)).toBe(0);
    g.player.relics.tiers.bonefire = 3;
    updateRelics(g, 1 / 60);
    expect(lost(foe)).toBe(0);
  });

  it('Baptism of Fire: formed, a flare heals 1% of max HP for every enemy it catches, up to 4', () => {
    const at: [number, number][] = [[60, 0], [80, 20], [80, -20], [100, 0], [100, 30], [100, -30]];
    const { g, foes, foe } = arena('paladin', ['flashpowder', 'blessedWater'], 1, at);
    offerRelics(g, 3, 'boss');
    expect(resolveRelicOffer(g, 'baptismOfFire')).toBe(true);
    g.player.mods = { ...g.baseMods };
    updateRelics(g, 1 / 60);
    const p = g.player;
    p.hp = p.stats.hp * 0.5;
    hit(g, foe, 'attack'); // not burning enough: the powder lights it, no flare, no heal
    expect(stat(g, 'baptismOfFire').healing).toBe(0);
    applyStatus(foe, { apply: [{ id: 'burn', stacks: 2, power: 2 }] }, g);
    g.time += 5;
    hit(g, foe, 'attack');
    expect(foes.every((f) => burning(f) > 0)).toBe(true); // the flare caught all six
    const d = DUOS.baptismOfFire.n;
    const healed = p.hp - p.stats.hp * 0.5;
    expect(healed).toBeGreaterThan(0);
    expect(healed).toBeLessThanOrEqual(baptismHeal(p.stats.hp, d.heal, d.max, d.max) * (1 + relicN('blessedWater', 1).bonus) + 1e-6); // 4 count, Blessed Water's own bonus on top
    expect(stat(g, 'baptismOfFire').healing).toBeGreaterThan(0);
  });

  it('Flashpowder alone heals nothing', () => {
    const { g, foe } = arena('paladin', ['flashpowder', 'blessedWater']);
    const p = g.player;
    p.hp = p.stats.hp * 0.5;
    applyStatus(foe, { apply: [{ id: 'burn', stacks: 2, power: 2 }] }, g);
    hit(g, foe, 'attack');
    expect(lost(foe)).toBeGreaterThan(0); // it flared
    expect(p.hp).toBe(p.stats.hp * 0.5);
  });
});
