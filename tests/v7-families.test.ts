import { describe, expect, it } from 'vitest';
import { CLASS_ORDER } from '../src/config/classes';
import { DUO_SIX_STRENGTH, FAMILIES, FAMILY_IDS, preferredFamilies, RELIC_IDS, relicDef, SET_LEVELS, type FamilyId, type RelicId } from '../src/config/relics';
import { STATUSES } from '../src/config/damage';
import type { Enemy, Game } from '../src/core/types';
import { createGame } from '../src/game';
import { familySets, relicPoolFor } from '../src/logic/relics';
import { applyStatus, damageEnemy, damagePlayer, healPlayer, killEnemy } from '../src/systems/combat';
import { armorStacksMax, gainArmorStacks } from '../src/systems/relicCore';
import { addRelic, HOOKS, updateRelics } from '../src/systems/relics';
import { spawnEnemy } from '../src/systems/spawning';

const anyClass = (f: FamilyId): RelicId[] => RELIC_IDS.filter((id) => relicDef(id).family === f && !relicDef(id).classId);

/** A headless game holding the given relics, with bare knights placed next to the player. */
function arena(relics: RelicId[], enemies: [number, number][] = [], classId: Parameters<typeof createGame>[0] = 'paladin'): { g: Game; foes: Enemy[] } {
  const g = createGame(classId, 1);
  g.rng = () => 0.999; // no crits, no random procs unless a test says otherwise
  for (const id of relics) addRelic(g, id);
  const foes = enemies.map(([dx, dy]) => spawnEnemy(g, 'knight', g.player.x + dx, g.player.y + dy));
  for (const f of foes) f.armorHp = 0;
  for (const e of g.enemies) g.hash.insert(e);
  tick(g);
  return { g, foes };
}
const tick = (g: Game) => {
  g.player.mods = { ...g.baseMods };
  updateRelics(g, 1 / 60);
};

describe('family rules (RELICS.md, revision 2)', () => {
  it('50 relics: 5 any class can find in every family, and 3 class relics per class, one in each of its preferred families', () => {
    expect(RELIC_IDS).toHaveLength(50);
    for (const f of FAMILY_IDS) expect(anyClass(f), f).toHaveLength(5);
    for (const c of CLASS_ORDER) {
      expect(preferredFamilies(c), c).toHaveLength(3);
      const own = RELIC_IDS.filter((id) => relicDef(id).classId === c).map((id) => relicDef(id).family);
      expect(own.sort()).toEqual([...preferredFamilies(c)].sort());
    }
  });

  it('a class finds 6 relics in a preferred family and 5 in any other, so only a preferred family maxes with straight pieces', () => {
    for (const c of CLASS_ORDER) {
      const pool = relicPoolFor(c, []);
      for (const f of FAMILY_IDS) expect(pool.filter((id) => relicDef(id).family === f).length, `${c} ${f}`).toBe(preferredFamilies(c).includes(f) ? 6 : 5);
    }
  });

  it('every relic does something beyond plain stats, and every set level says what it does', () => {
    for (const id of RELIC_IDS) expect(HOOKS[id], id).toBeTruthy();
    for (const f of FAMILY_IDS) for (const l of SET_LEVELS) expect(FAMILIES[f].sets[l][1].length, `${f} ${l}`).toBeGreaterThan(10);
  });
});

describe('set thresholds', () => {
  const flame = anyClass('flame');

  it('levels at 2, 4 and 6; a duo counts for both its families; a 6 completed with a duo works at 125% (rarity is strength)', () => {
    expect(familySets(flame.slice(0, 1), []).flame).toEqual({ count: 1, straight: 1, level: 0, strength: 1 });
    expect(familySets(flame.slice(0, 3), []).flame!.level).toBe(2);
    expect(familySets(flame.slice(0, 5), []).flame!.level).toBe(4);
    expect(familySets([...flame, 'fireArrows'], []).flame).toEqual({ count: 6, straight: 6, level: 6, strength: 1 });
    const duo = familySets(flame, [['flame', 'frost']]);
    expect(duo.flame).toEqual({ count: 6, straight: 5, level: 6, strength: DUO_SIX_STRENGTH });
    expect(duo.frost).toEqual({ count: 1, straight: 0, level: 0, strength: 1 });
    expect(DUO_SIX_STRENGTH).toBeGreaterThan(1);
  });

  it('a player\'s set levels follow what they hold', () => {
    const { g } = arena(flame.slice(0, 2));
    expect(g.player.relics.sets.flame?.level).toBe(2);
    expect(g.player.relics.sets.frost).toBeUndefined();
  });
});

describe('family mechanics', () => {
  it('status rules: Stoked raises the burn cap, Biting Cold chills 50% more, Open Wounds adds a bleed stack', () => {
    const { g, foes } = arena([...anyClass('flame').slice(0, 2), ...anyClass('frost').slice(0, 2), ...anyClass('blood').slice(0, 2)], [[300, 0]]);
    const e = foes[0];
    applyStatus(e, { apply: [{ id: 'burn', stacks: 99, time: 3, power: 1 }] }, g);
    expect(e.statuses.burn!.stacks).toBe(STATUSES.burn.maxStacks + FAMILIES.flame.n.stacksBonus);
    applyStatus(e, { apply: [{ id: 'slow', stacks: 2, time: 3 }] }, g);
    expect(e.statuses.slow!.stacks).toBe(3);
    applyStatus(e, { apply: [{ id: 'bleed', stacks: 1, time: 3, power: 1 }] }, g);
    expect(e.statuses.bleed!.stacks).toBe(2);
  });

  it('ward takes a hit before HP; Blessed (Holy 2) turns healing into ward, up to its maximum', () => {
    const { g } = arena(anyClass('holy').slice(0, 2));
    const p = g.player;
    p.hp = p.stats.hp / 2;
    healPlayer(g, 20, false);
    expect(p.ward).toBeGreaterThan(0);
    const hp = p.hp;
    p.ward = 1000;
    damagePlayer(g, 30, true);
    expect(p.hp).toBe(hp);
    expect(p.ward).toBeLessThan(1000);
  });

  it('a blocked hit does nothing, and Bulwark (Steel 2) gives an armor stack for it; armor stacks cap and fade', () => {
    const { g } = arena(['towerShield', 'thornMail']);
    const p = g.player;
    g.rng = () => 0; // Tower Shield blocks
    const hp = p.hp;
    damagePlayer(g, 30, true);
    expect(p.hp).toBe(hp);
    expect(p.armorStacks).toBe(1);
    gainArmorStacks(g, p, 99);
    expect(p.armorStacks).toBe(armorStacksMax(p));
    tick(g);
    expect(p.mods.armor).toBeGreaterThan(g.baseMods.armor);
    g.time += FAMILIES.steel.n.fade + 1;
    tick(g);
    expect(p.armorStacks).toBe(0);
  });

  it('Shatter (Frost 4): a frozen enemy that dies bursts into its neighbours', () => {
    const { g, foes } = arena(anyClass('frost').slice(0, 4), [[300, 0], [330, 0]]);
    const [a, b] = foes;
    a.frozenT = g.time + 1;
    killEnemy(g, a);
    expect(b.hp).toBeLessThan(b.maxHp);
  });

  it('Arc (Storm 2): every 5th attack hit (4th at 15 Secondary) chains to another enemy', () => {
    const { g, foes } = arena(['stormPennant', 'quicksilverSpurs'], [[300, 0], [330, 0]]);
    const [a, b] = foes;
    a.hp = a.maxHp = 1e6;
    const every = g.player.stats.secondary >= 15 ? FAMILIES.storm.n.arcEveryAt15 : FAMILIES.storm.n.arcEvery;
    for (let i = 1; i < every; i++) damageEnemy(g, a, 10);
    expect(b.hp).toBe(b.maxHp);
    damageEnemy(g, a, 10);
    expect(b.hp).toBeLessThan(b.maxHp);
  });
});
