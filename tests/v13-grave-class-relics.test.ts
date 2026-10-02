import { describe, expect, it } from 'vitest';
import { CLASS_ORDER, type ClassId } from '../src/config/classes';
import { DUOS, duoOf, relicDef, relicN, RELICS, type RelicId } from '../src/config/relics';
import { REALMS } from '../src/config/world';
import type { Enemy, Game } from '../src/core/types';
import { emit } from '../src/core/events';
import { createGame } from '../src/game';
import { slotBlock } from '../src/logic/champions';
import { championPool, corpsesNear, deadCount, devoured, relicPoolFor, wightBurst } from '../src/logic/relics';
import * as scale from '../src/logic/abilities';
import { updateAbility } from '../src/systems/abilities';
import { relicDamage, skeletonsBy } from '../src/systems/relicCore';
import { addRelic, offerRelics, resolveRelicOffer, updateRelics } from '../src/systems/relics';
import { spawnEnemy } from '../src/systems/spawning';

const CLASS_RELICS: [RelicId, ClassId][] = [['ossuarySeal', 'paladin'], ['draugrMead', 'viking'], ['lastRites', 'angel'], ['wightboneArrows', 'archer']];

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
const cursed = (e: Enemy) => e.statuses.curse?.stacks ?? 0;
const stat = (g: Game, id: RelicId | 'barrowFeast') => g.player.relics.stats[id] ?? { damage: 0, healing: 0, prevented: 0 };
const corpse = (g: Game, dx: number, dy: number) => g.corpses.push({ x: g.player.x + dx, y: g.player.y + dy, t: 0 });
/** A real cast of the signature ability, through systems/abilities. */
const cast = (g: Game) => {
  g.player.abilityCd = 0;
  g.input.ability = true;
  updateAbility(g, 1 / 60);
  g.input.ability = false;
};
/** Lets the ability run out (Divine Shield, Berserker Rage). */
const runOut = (g: Game) => {
  for (let i = 0; i < 20 && g.player.abilityTime > 0; i++) updateAbility(g, 1);
};
/** A foe killed where it stands, by `source`. */
const kill = (g: Game, e: Enemy, source: 'attack' | 'ability' = 'attack') => {
  e.dead = true;
  emit(g, 'onKill', { enemy: e, source });
};

describe('the Barrowvale class relics and duo (#280): the model', () => {
  it('one Grave class relic each for the Paladin, the Viking, the Angel and the Archer, offered to that class only; every class now has one', () => {
    for (const [id, c] of CLASS_RELICS) {
      expect(relicDef(id).family).toBe('grave');
      expect(relicDef(id).rarity).toBe('rare');
      expect(relicDef(id).classId).toBe(c);
      for (const other of CLASS_ORDER) expect(relicPoolFor(other).includes(id), `${id} ${other}`).toBe(other === c);
    }
    for (const c of CLASS_ORDER) expect(Object.values(RELICS).filter((r) => r.family === 'grave' && r.classId === c), c).toHaveLength(1);
  });

  it('a class relic is not in the starter pool: it comes with the Barrowvale (its level 3) or the inventory', () => {
    for (const [id, c] of CLASS_RELICS) {
      expect(championPool(c, [])).not.toContain(id);
      expect(championPool(c, [], REALMS.barrowvale.family!)).toContain(id);
      expect(championPool(c, [id])).toContain(id);
    }
  });

  it('the slot rules: a class relic counts toward the 2 class relics', () => {
    expect(slotBlock('paladin', ['reliquary', 'aegisFaithful'], 'ossuarySeal', 5)).toBe('classRelics');
    expect(slotBlock('archer', ['rimebow'], 'wightboneArrows', 5)).toBeNull();
  });

  it('the pure rules: how many of the dead answer, which corpses, the bone burst, what a champion walks over', () => {
    expect(deadCount(5, 1, 5)).toBe(2);
    expect(deadCount(9, 1, 4)).toBe(3);
    expect(deadCount(-3, 2, 5)).toBe(2);
    const cs = [{ x: 100, y: 0 }, { x: 10, y: 0 }, { x: 50, y: 0 }, { x: 300, y: 0 }];
    expect(corpsesNear(cs, 0, 0, 120, 2)).toEqual([{ x: 10, y: 0 }, { x: 50, y: 0 }]); // nearest first, at most 2
    expect(corpsesNear(cs, 0, 0, 120, 9)).toHaveLength(3); // never past the radius
    expect(corpsesNear(cs, 0, 0, 120, 0)).toEqual([]);
    expect(wightBurst(20, 0.03, 10)).toBeCloseTo(26);
    expect(wightBurst(20, 0.03, -4)).toBe(20);
    expect(devoured(cs, 0, 0, 16, 10)).toEqual([{ x: 10, y: 0 }]);
  });

  it('Barrow Feast: the Barrowvale duo, from Hex Doll and Berserker Tooth (Grave and Blood), each in no other recipe', () => {
    expect(DUOS.barrowFeast.families).toEqual(['grave', 'blood']);
    expect(DUOS.barrowFeast.from).toEqual(['hexDoll', 'berserkerTooth']);
    expect(duoOf('hexDoll')).toBe('barrowFeast');
    expect(duoOf('berserkerTooth')).toBe('barrowFeast');
  });
});

describe('what each one does', () => {
  it('Ossuary Seal: when Divine Shield ends, the nearest 1 + Faith/5 corpses within 220 px rise as skeletons; none before, none farther', () => {
    const { g } = arena('paladin', ['ossuarySeal']);
    const p = g.player;
    const n = relicN('ossuarySeal', 1);
    const want = deadCount(p.stats.secondary, n.base, n.per);
    for (let i = 0; i < want + 2; i++) corpse(g, 40 + i * 20, 0);
    corpse(g, 400, 0); // too far
    cast(g);
    expect(skeletonsBy(g, 'ossuarySeal')).toBe(0);
    runOut(g);
    expect(skeletonsBy(g, 'ossuarySeal')).toBe(want);
    expect(g.corpses).toHaveLength(3); // the two left over and the far one
  });

  it('Ossuary Seal: a shield that ends with no corpse near raises nothing; awakened (Sworn Dead) a blow the shield turns curses its striker', () => {
    const { g, foe } = arena('paladin', ['ossuarySeal'], 3);
    cast(g);
    emit(g, 'onBlocked', { amount: 10, attacker: foe });
    expect(cursed(foe)).toBe(RELICS.ossuarySeal.awaken.n.stacks);
    runOut(g);
    expect(skeletonsBy(g, 'ossuarySeal')).toBe(0);
    const { g: g1, foe: f1 } = arena('paladin', ['ossuarySeal'], 1);
    cast(g1);
    emit(g1, 'onBlocked', { amount: 10, attacker: f1 });
    expect(cursed(f1)).toBe(0); // not awakened
  });

  it("Draugr's Mead: only the foes your attacks kill during Rage rise, up to 2 + Rage/5 at once", () => {
    const at: [number, number][] = Array.from({ length: 8 }, (_, i) => [60 + i * 10, 0]);
    const { g, foes } = arena('viking', ['draugrMead'], 1, at);
    const p = g.player;
    kill(g, foes[0]);
    expect(skeletonsBy(g, 'draugrMead')).toBe(0); // no Rage
    cast(g);
    kill(g, foes[1], 'ability');
    expect(skeletonsBy(g, 'draugrMead')).toBe(0); // not an attack
    for (const f of foes.slice(2)) kill(g, f);
    const n = relicN('draugrMead', 1);
    expect(skeletonsBy(g, 'draugrMead')).toBe(deadCount(p.stats.secondary, n.base, n.per));
  });

  it("Draugr's Mead awakened (Einherjar): when Rage ends every draugr howls, shadow damage round it", () => {
    const { g, foes } = arena('viking', ['draugrMead'], 3, [[60, 0], [70, 0]]);
    cast(g);
    kill(g, foes[0]);
    expect(skeletonsBy(g, 'draugrMead')).toBe(1);
    expect(lost(foes[1])).toBe(0);
    runOut(g);
    expect(lost(foes[1])).toBeGreaterThan(0);
    expect(stat(g, 'draugrMead').damage).toBeGreaterThan(0);
  });

  it('Last Rites: Heavenly Radiance lays the nearest 4 + Grace/4 corpses within its radius to rest, and each heals 3% of max HP', () => {
    const { g } = arena('angel', ['lastRites'], 1, [[600, 0]]);
    const p = g.player;
    const n = relicN('lastRites', 1);
    const want = deadCount(p.stats.secondary, n.base, n.per);
    const radius = scale.heavenlyRadiance(p.cls.ability as never, p.stats.secondary).radius;
    for (let i = 0; i < want + 1; i++) corpse(g, 30 + i * 10, 0);
    corpse(g, radius + 60, 0); // outside the light
    p.hp = p.stats.hp * 0.3;
    p.relics.stats = {};
    cast(g);
    expect(g.corpses).toHaveLength(2);
    expect(stat(g, 'lastRites').healing).toBeCloseTo(p.stats.hp * n.heal * want, 1);
  });

  it('Last Rites: a rising corpse laid to rest never rises; awakened (Psychopomp) each one curses the foes round it', () => {
    const { g, foe } = arena('angel', ['lastRites'], 3, [[60, 0]]);
    g.corpses.push({ x: foe.x, y: foe.y, t: 0, rise: { id: 'knight', at: 4, side: false, hp: 10 } });
    cast(g);
    expect(g.corpses).toHaveLength(0);
    expect(cursed(foe)).toBe(RELICS.lastRites.awaken.n.stacks);
  });

  it('Wightbone Arrows: Arrow Volley makes every corpse in its area burst, its damage growing with Focus; corpses elsewhere stay', () => {
    const { g, foes } = arena('archer', ['wightboneArrows'], 1, [[300, 0], [300, 400]]);
    const [under, away] = foes;
    const p = g.player;
    g.input.aimX = under.x;
    g.input.aimY = under.y;
    corpse(g, 300, 20);
    corpse(g, 310, -20);
    corpse(g, 300, 400 - 200); // outside the Volley's 120 px
    cast(g);
    const n = relicN('wightboneArrows', 1);
    expect(g.corpses).toHaveLength(1);
    expect(lost(under)).toBeCloseTo(2 * wightBurst(relicDamage(p, n.damage), n.perFocus, p.stats.secondary));
    expect(lost(away)).toBe(0);
  });

  it('Wightbone Arrows awakened (Barrow Wights): foes the ability kills rise as skeletons, up to 3; an attack kill raises none', () => {
    const at: [number, number][] = Array.from({ length: 5 }, (_, i) => [300 + i * 10, 0]);
    const { g, foes } = arena('archer', ['wightboneArrows'], 3, at);
    kill(g, foes[0], 'attack');
    expect(skeletonsBy(g, 'wightboneArrows')).toBe(0);
    for (const f of foes.slice(1)) kill(g, f, 'ability');
    expect(skeletonsBy(g, 'wightboneArrows')).toBe(RELICS.wightboneArrows.awaken.n.max);
  });

  it('Barrow Feast: formed, walking over a corpse devours it: it heals 1.5% of max HP and curses the foes round it; the two relics alone do not', () => {
    const { g, foe } = arena('viking', ['hexDoll', 'berserkerTooth'], 1, [[40, 0]]);
    const p = g.player;
    corpse(g, 0, 0);
    p.hp = p.stats.hp * 0.5;
    updateRelics(g, 1 / 60);
    expect(g.corpses).toHaveLength(1); // no duo yet
    offerRelics(g, 3, 'boss');
    expect(resolveRelicOffer(g, 'barrowFeast')).toBe(true);
    g.player.mods = { ...g.baseMods };
    corpse(g, 200, 0); // not under his feet
    updateRelics(g, 1 / 60);
    expect(g.corpses).toHaveLength(1);
    expect(p.hp - p.stats.hp * 0.5).toBeCloseTo(p.stats.hp * DUOS.barrowFeast.n.heal, 1);
    expect(stat(g, 'barrowFeast').healing).toBeGreaterThan(0);
    expect(cursed(foe)).toBe(DUOS.barrowFeast.n.stacks);
  });
});
