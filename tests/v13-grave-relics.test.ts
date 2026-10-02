import { describe, expect, it } from 'vitest';
import { CLASS_ORDER } from '../src/config/classes';
import { relicDef, type RelicId } from '../src/config/relics';
import { REALMS } from '../src/config/world';
import type { Corpse, Enemy, Game } from '../src/core/types';
import { createGame } from '../src/game';
import { grantRelic, legendaryPickOptions, newChampion, rarePickOptions, rewardRelics, slotBlock, slotCost } from '../src/logic/champions';
import { censerLays, guardCut, stompable, tollCorpses } from '../src/logic/graveRelics';
import { championPool, isStarterRelic, relicPoolFor } from '../src/logic/relics';
import { damagePlayer, killEnemy } from '../src/systems/combat';
import { raiseSkeleton } from '../src/systems/relicCore';
import { addRelic, updateRelics } from '../src/systems/relics';
import { spawnEnemy } from '../src/systems/spawning';

const NEW: RelicId[] = ['barrowBoots', 'plagueCenser', 'sextonsBell', 'crownOfAntlers'];

/** A headless game holding `id` at `tier`, with sturdy knights around the player, as the Cinderlands relics' test (v12-flame-relics). */
function arena(id: RelicId, at: [number, number][], tier = 1): { g: Game; foes: Enemy[] } {
  const g = createGame('paladin', 1);
  addRelic(g, id, 'other', tier);
  const foes = at.map(([dx, dy]) => spawnEnemy(g, 'knight', g.player.x + dx, g.player.y + dy));
  for (const f of foes) (f.armorHp = 0), (f.hp = f.maxHp = 5000), g.hash.insert(f);
  g.player.mods = { ...g.baseMods };
  updateRelics(g, 1 / 60);
  return { g, foes };
}
const stat = (g: Game, id: RelicId) => g.player.relics.stats[id] ?? { damage: 0, healing: 0, prevented: 0 };
const corpse = (g: Game, dx: number, dy: number, rise = false): Corpse => {
  const c: Corpse = { x: g.player.x + dx, y: g.player.y + dy, t: 0, ...(rise ? { rise: { id: 'barrowThrall', at: 5, side: false, hp: 10 } } : {}) };
  g.corpses.push(c);
  return c;
};
const tick = (g: Game, dt: number) => {
  g.time += dt;
  g.player.mods = { ...g.baseMods };
  updateRelics(g, dt);
};

describe('the Barrowvale Grave relics (#279): the model', () => {
  it('a common, two rares and a second legendary, all Grave and open to every class', () => {
    expect(NEW.map((id) => relicDef(id).rarity)).toEqual(['common', 'rare', 'rare', 'legendary']);
    for (const id of NEW) {
      expect(relicDef(id).family).toBe('grave');
      expect(relicDef(id).classId).toBeUndefined();
      for (const c of CLASS_ORDER) expect(relicPoolFor(c)).toContain(id);
    }
  });

  it('Barrow Boots joins the starter pool; the rares, the legendary and now Soul Lantern come with the Barrowvale or the inventory', () => {
    expect(isStarterRelic('barrowBoots')).toBe(true);
    expect(championPool('angel', [])).toContain('barrowBoots');
    for (const id of ['plagueCenser', 'sextonsBell', 'crownOfAntlers', 'soulLantern'] as RelicId[]) {
      expect(isStarterRelic(id), id).toBe(false);
      expect(championPool('angel', []), id).not.toContain(id);
      expect(championPool('angel', [], REALMS.barrowvale.family!), id).toContain(id);
      expect(championPool('angel', [id]), id).toContain(id);
    }
    expect(isStarterRelic('phoenixFeather') && isStarterRelic('stormcallersHorn')).toBe(true); // their realms are still to come
  });

  it('the Knight crown picks 1 of the two Grave legendaries, the Champion crown gives the other', () => {
    const c = newChampion('viking');
    expect(legendaryPickOptions(c, 'grave')).toEqual(['soulLantern', 'crownOfAntlers']);
    expect(rewardRelics(grantRelic(c, 'crownOfAntlers'), 'viking', 'grave', [{ kind: 'legendaryOther' }])).toEqual(['soulLantern']);
    expect(rewardRelics(grantRelic(c, 'soulLantern'), 'viking', 'grave', [{ kind: 'legendaryOther' }])).toEqual(['crownOfAntlers']);
  });

  it('the slot rules, and the Marches Grave level offers the new rares once the older two are owned', () => {
    expect(slotCost('crownOfAntlers')).toBe(2);
    expect(slotCost('barrowBoots')).toBe(1);
    expect(slotBlock('viking', ['soulLantern'], 'crownOfAntlers', 5)).toBe('legendary');
    expect(slotBlock('viking', ['barrowBoots', 'plagueCenser', 'sextonsBell', 'deathmask'], 'hexDoll', 6)).toBe('family');
    const c = { ...newChampion('archer'), inventory: ['hexDoll', 'gravePact'] as RelicId[] };
    expect(rarePickOptions(c, 'grave', 2)).toEqual(['plagueCenser', 'sextonsBell']);
  });

  it('the pure rules: which corpses are stomped, when the censer lays, which corpses the bell raises, what the guard takes off', () => {
    const cs: Corpse[] = [{ x: 10, y: 0, t: 0 }, { x: 40, y: 0, t: 0 }, { x: 5, y: 0, t: 0, stomped: true }];
    expect(stompable(cs, 0, 0, 20, 16)).toEqual([cs[0]]);
    expect(censerLays(4, 4, 0, 3, false, false)).toBe(true);
    expect(censerLays(5, 4, 0, 3, true, false)).toBe(false);
    expect(censerLays(5, 4, 0, 3, true, true)).toBe(true); // Blight Bloom
    expect(censerLays(8, 4, 3, 3, false, false)).toBe(false); // at the cap
    const near: Corpse = { x: 20, y: 0, t: 0 }, far: Corpse = { x: 100, y: 0, t: 0 }, out: Corpse = { x: 500, y: 0, t: 0 };
    const rising: Corpse = { x: 150, y: 0, t: 0, rise: { id: 'barrowThrall', at: 5, side: false, hp: 10 } };
    expect(tollCorpses([far, out, near, rising], 0, 0, 160, 2)).toEqual([rising, near]);
    expect(tollCorpses([out], 0, 0, 160, 2)).toEqual([]);
    expect(guardCut(2, 0.05, 3)).toBeCloseTo(0.1);
    expect(guardCut(6, 0.05, 3)).toBeCloseTo(0.15);
    expect(guardCut(0, 0.05, 3)).toBe(0);
  });
});

describe('what each one does, through the real tick, kill and hit paths', () => {
  it('Barrow Boots: a corpse walked over is stomped once, a shadow burst round it; awakened, it curses', () => {
    const { g, foes } = arena('barrowBoots', [[50, 0], [300, 0]]);
    const c = corpse(g, 5, 0);
    corpse(g, 200, 0); // not walked over
    tick(g, 1 / 60);
    expect(c.stomped).toBe(true);
    expect(foes[0].hp).toBeLessThan(foes[0].maxHp);
    expect(foes[1].hp).toBe(foes[1].maxHp);
    expect(g.corpses).toHaveLength(2); // it stays a corpse
    const hp = foes[0].hp;
    tick(g, 1 / 60);
    expect(foes[0].hp).toBe(hp); // once per corpse
    expect(stat(g, 'barrowBoots').damage).toBeGreaterThan(0);
    const woke = arena('barrowBoots', [[50, 0]], 3);
    corpse(woke.g, 0, 0);
    tick(woke.g, 1 / 60);
    expect(woke.foes[0].statuses.curse?.stacks ?? 0).toBeGreaterThan(0); // Grave Stomp
  });

  it('Plague Censer: every 4th kill leaves poisoning plague ground, up to 3; awakened, a kill in it spreads it', () => {
    const { g, foes } = arena('plagueCenser', [[60, 0], [80, 0], [100, 0], [120, 0], [400, 0]]);
    const laid = () => g.fields.filter((f) => f.by === 'plagueCenser');
    for (const e of foes.slice(0, 3)) killEnemy(g, e);
    expect(laid()).toHaveLength(0);
    killEnemy(g, foes[3]);
    expect(laid()).toHaveLength(1);
    expect(laid()[0].apply?.id).toBe('poison');
    expect(laid()[0].hostile).toBe(false);
    killEnemy(g, foes[4]); // the 5th kill: nothing (not awakened)
    expect(laid()).toHaveLength(1);
    const woke = arena('plagueCenser', [[60, 0], [80, 0], [100, 0], [120, 0], [125, 0], [400, 0]], 3);
    for (const e of woke.foes.slice(0, 3)) killEnemy(woke.g, e); // the 3rd kill lays ground at 100 px (tier III: every 3)
    expect(woke.g.fields.filter((f) => f.by === 'plagueCenser')).toHaveLength(1);
    killEnemy(woke.g, woke.foes[3]); // the 4th dies in it: Blight Bloom
    expect(woke.g.fields.filter((f) => f.by === 'plagueCenser')).toHaveLength(2);
    killEnemy(woke.g, woke.foes[5]); // the 5th, far off: nothing
    expect(woke.g.fields.filter((f) => f.by === 'plagueCenser')).toHaveLength(2);
  });

  it("Sexton's Bell: it tolls when a corpse lies near, raising up to 3 skeletons, a thrall's corpse first; awakened, the toll curses", () => {
    const { g, foes } = arena('sextonsBell', [[100, 0]]);
    tick(g, 9);
    expect(g.minions).toHaveLength(0); // no corpse: it waits
    const thrall = corpse(g, 170, 0, true), far = corpse(g, 120, 0), near = corpse(g, 20, 0), nearer = corpse(g, 10, 0);
    tick(g, 1 / 60);
    expect(g.minions.filter((m) => m.relicBy === 'sextonsBell')).toHaveLength(3);
    expect(g.corpses).toEqual([far]); // the thrall's corpse and the two nearest rose; the fourth lies on
    expect(g.corpses).not.toContain(thrall);
    expect([near, nearer].some((c) => g.corpses.includes(c))).toBe(false);
    tick(g, 1);
    expect(g.minions).toHaveLength(3); // the bell's clock started again
    expect(foes[0].statuses.curse).toBeUndefined();
    const woke = arena('sextonsBell', [[100, 0]], 3);
    corpse(woke.g, 10, 0);
    tick(woke.g, 7);
    expect(woke.foes[0].statuses.curse?.stacks ?? 0).toBeGreaterThan(0); // Death Toll
  });

  it('Crown of Antlers: each skeleton near you takes 5% off a hit, up to 3; kills may raise a guard; awakened, 3 guards mend you', () => {
    const { g, foes } = arena('crownOfAntlers', [[60, 0]]);
    const p = g.player;
    damagePlayer(g, 20, true, foes[0]);
    expect(stat(g, 'crownOfAntlers').prevented).toBe(0); // no guard
    for (const dx of [20, -20]) raiseSkeleton(g, p, p.x + dx, p.y, 'grave', { hp: 50, damage: 5, life: 30 });
    raiseSkeleton(g, p, p.x + 500, p.y, 'grave', { hp: 50, damage: 5, life: 30 }); // too far to guard
    damagePlayer(g, 20, true, foes[0]);
    expect(stat(g, 'crownOfAntlers').prevented).toBeCloseTo(2);
    for (const dx of [30, -30, 40]) raiseSkeleton(g, p, p.x + dx, p.y, 'grave', { hp: 50, damage: 5, life: 30 });
    damagePlayer(g, 20, true, foes[0]);
    expect(stat(g, 'crownOfAntlers').prevented).toBeCloseTo(2 + 3); // 3 count, not 5
    const raised = () => g.minions.filter((m) => m.relicBy === 'crownOfAntlers').length;
    for (let i = 0; i < 200 && raised() < 3; i++) killEnemy(g, spawnEnemy(g, 'peasant', p.x + 80, p.y));
    expect(raised()).toBe(3);
    for (let i = 0; i < 50; i++) killEnemy(g, spawnEnemy(g, 'peasant', p.x + 80, p.y));
    expect(raised()).toBe(3); // up to 3
    const woke = arena('crownOfAntlers', [[60, 0]], 3);
    const wp = woke.g.player;
    wp.hp = wp.stats.hp / 2;
    tick(woke.g, 1);
    expect(wp.hp).toBe(wp.stats.hp / 2); // no guard
    for (const dx of [20, -20, 30]) raiseSkeleton(woke.g, wp, wp.x + dx, wp.y, 'grave', { hp: 50, damage: 5, life: 30 });
    tick(woke.g, 1);
    expect(wp.hp).toBeGreaterThan(wp.stats.hp / 2); // Court of Bones
  });
});
