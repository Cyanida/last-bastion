import { describe, expect, it } from 'vitest';
import { CLASS_ORDER } from '../src/config/classes';
import { FAMILIES, relicDef, type RelicId } from '../src/config/relics';
import { REALMS } from '../src/config/world';
import type { Enemy, Game } from '../src/core/types';
import { emit } from '../src/core/events';
import { createGame } from '../src/game';
import { slotBlock, slotCost } from '../src/logic/champions';
import { championPool, holdThorns, inFront, isStarterRelic, keepReprisal, relicPoolFor, rivetStep } from '../src/logic/relics';
import { damagePlayer } from '../src/systems/combat';
import { armorStacksMax } from '../src/systems/relicCore';
import { addRelic, updateRelics } from '../src/systems/relics';
import { spawnEnemy } from '../src/systems/spawning';

const NEW: RelicId[] = ['rivetHammer', 'pavise', 'reprisalCuirass', 'heartOfTheHold'];

/** A headless game of `classId` holding `id` at `tier`, with bare knights next to the player (who faces right). */
function arena(id: RelicId, at: [number, number][], tier = 1, classId: Parameters<typeof createGame>[0] = 'paladin'): { g: Game; foes: Enemy[] } {
  const g = createGame(classId, 1);
  g.rng = Object.assign(() => 0, { s: 0 }); // every chance procs
  addRelic(g, id, 'other', tier);
  const foes = at.map(([dx, dy]) => spawnEnemy(g, 'knight', g.player.x + dx, g.player.y + dy));
  for (const f of foes) (f.armorHp = 0), g.hash.insert(f);
  g.player.mods = { ...g.baseMods };
  g.player.facing = 0;
  updateRelics(g, 1 / 60);
  return { g, foes };
}
const hurt = (e: Enemy) => e.hp < e.maxHp;
const stat = (g: Game, id: RelicId) => g.player.relics.stats[id] ?? { damage: 0, healing: 0, prevented: 0 };
const attack = (g: Game, e: Enemy) => emit(g, 'onHit', { enemy: e, amount: 50, crit: false, source: 'attack' });

describe('the Iron Hold Steel relics (#217): the model', () => {
  it('a common, two rares and a second legendary, all Steel and open to every class', () => {
    expect(NEW.map((id) => relicDef(id).rarity)).toEqual(['common', 'rare', 'rare', 'legendary']);
    for (const id of NEW) {
      expect(relicDef(id).family).toBe('steel');
      expect(relicDef(id).classId).toBeUndefined();
      for (const c of CLASS_ORDER) expect(relicPoolFor(c)).toContain(id);
    }
  });

  it('the common is in the starter pool; the rares and the legendary come with the Iron Hold or the inventory', () => {
    expect(isStarterRelic('rivetHammer')).toBe(true);
    expect(championPool('archer', [])).toContain('rivetHammer');
    for (const id of NEW.slice(1)) {
      expect(isStarterRelic(id)).toBe(false);
      expect(championPool('archer', [])).not.toContain(id);
      expect(championPool('archer', [], REALMS.ironHold.family!)).toContain(id);
      expect(championPool('archer', [id])).toContain(id);
    }
  });

  it('the slot rules: the legendary takes 2 slots and only one Steel legendary goes in', () => {
    expect(slotCost('heartOfTheHold')).toBe(2);
    expect(slotBlock('viking', ['unbreakable'], 'heartOfTheHold', 5)).toBe('legendary');
    expect(slotBlock('viking', ['rivetHammer', 'pavise', 'reprisalCuirass', 'towerShield'], 'thornMail', 6)).toBe('family');
  });

  it('the pure rules: the front arc, the rivet count, what the cuirass keeps, the thorns', () => {
    expect(inFront(0, 100, 0, 60)).toBe(true);
    expect(inFront(0, 100, 150, 60)).toBe(true); // 56°
    expect(inFront(0, 100, 200, 60)).toBe(false); // 63°
    expect(inFront(Math.PI, -50, 0, 60)).toBe(true);
    expect(inFront(0, -50, 0, 60)).toBe(false);
    expect(inFront(0, 0, 0, 60)).toBe(false);
    let s = { count: 0, rivet: false };
    const rivets = Array.from({ length: 8 }, () => (s = rivetStep(s.count, 4)).rivet);
    expect(rivets).toEqual([false, false, false, true, false, false, false, true]);
    expect(keepReprisal(10, 30, 100)).toBe(40);
    expect(keepReprisal(90, 30, 100)).toBe(100);
    expect(keepReprisal(10, -5, 100)).toBe(10);
    expect(holdThorns(5, 12)).toBe(60);
    expect(holdThorns(0, 12)).toBe(0);
  });
});

describe('what each one does', () => {
  it('Rivet Hammer: every 4th attack hit rivets for damage and an armor stack; abilities do not count', () => {
    const { g, foes } = arena('rivetHammer', [[60, 0]]);
    for (let i = 0; i < 3; i++) attack(g, foes[0]);
    emit(g, 'onHit', { enemy: foes[0], amount: 50, crit: false, source: 'ability' });
    expect(hurt(foes[0])).toBe(false);
    expect(g.player.armorStacks).toBe(0);
    attack(g, foes[0]);
    expect(hurt(foes[0])).toBe(true);
    expect(g.player.armorStacks).toBe(1);
    expect(stat(g, 'rivetHammer').damage).toBeGreaterThan(0);
  });

  it('Rivet Hammer awakened (Sunder): a rivet breaks armor, never a boss’s', () => {
    const { g, foes } = arena('rivetHammer', [[60, 0]], 3);
    foes[0].armorHp = 40;
    for (let i = 0; i < 3; i++) attack(g, foes[0]); // tier II+: every 3rd
    expect(foes[0].armorHp).toBe(0);
  });

  it('Pavise: blocks hits from the front only; awakened, the block strikes back', () => {
    const { g, foes } = arena('pavise', [[60, 0], [-60, 0]]);
    const p = g.player;
    const hp = p.hp;
    damagePlayer(g, 20, true, foes[0]);
    expect(p.hp).toBe(hp);
    expect(stat(g, 'pavise').prevented).toBe(20);
    damagePlayer(g, 20, true, foes[1]);
    expect(p.hp).toBeLessThan(hp);
    expect(hurt(foes[0])).toBe(false);
    const woke = arena('pavise', [[60, 0]], 3);
    damagePlayer(woke.g, 20, true, woke.foes[0]);
    expect(woke.foes[0].maxHp - woke.foes[0].hp).toBeCloseTo(60); // Riposte: 3× the hit
  });

  it('Reprisal Cuirass: keeps what comes at you (capped) and the next attack hit spends it 8×', () => {
    const { g, foes } = arena('reprisalCuirass', [[60, 0], [100, 0]]);
    foes[1].hp = foes[1].maxHp = 1e6; // room for the whole reprisal
    const p = g.player;
    damagePlayer(g, 20, true, foes[0]);
    expect(g.vars['reprisal.kept']).toBe(20); // at full force, before armor
    damagePlayer(g, p.stats.hp * 0.9, true, foes[0]);
    expect(g.vars['reprisal.kept']).toBeLessThanOrEqual(p.stats.hp * 0.25 + 1e-9);
    const spent = g.vars['reprisal.kept'];
    p.hp = p.stats.hp;
    attack(g, foes[1]);
    expect(foes[1].maxHp - foes[1].hp).toBeCloseTo(spent * 8);
    expect(g.vars['reprisal.kept']).toBe(0);
    expect(stat(g, 'reprisalCuirass').damage).toBeGreaterThan(0);
  });

  it('Heart of the Hold: 3 more stacks that never fade, a stack per hit, thorns per stack', () => {
    const { g, foes } = arena('heartOfTheHold', [[60, 0]]);
    const p = g.player;
    const plain = createGame('paladin', 1).player;
    expect(armorStacksMax(p)).toBe(armorStacksMax(plain) + 3);
    damagePlayer(g, 10, true, foes[0]);
    expect(p.armorStacks).toBe(1);
    expect(hurt(foes[0])).toBe(true);
    expect(stat(g, 'heartOfTheHold').damage).toBeGreaterThan(0);
    g.time += FAMILIES.steel.n.fade * 3;
    updateRelics(g, 1 / 60);
    expect(p.armorStacks).toBe(1);
  });

  it('Heart of the Hold awakened (Iron Keep): at full stacks a hit is cut by 20%', () => {
    const { g, foes } = arena('heartOfTheHold', [[60, 0]], 3);
    const p = g.player;
    p.armorStacks = armorStacksMax(p);
    damagePlayer(g, 50, true, foes[0]);
    expect(stat(g, 'heartOfTheHold').prevented).toBeCloseTo(10);
  });
});
