import { describe, expect, it } from 'vitest';
import { newlyEarned } from '../src/logic/achievements';
import { CLASS_ORDER } from '../src/config/classes';
import { CURSED, CURSED_IDS, FAMILY_IDS, isCursedRelic, RELIC_IDS, relicDef, relicMods, type RelicId } from '../src/config/relics';
import type { Enemy, Game } from '../src/core/types';
import { createGame } from '../src/game';
import { relicPoolFor } from '../src/logic/relics';
import { applyRun, defaultSave, migrate, SAVE_VERSION } from '../src/logic/save';
import { damagePlayer, killEnemy } from '../src/systems/combat';
import { addRelic, familyOf, HOOKS, offerRelics, removeRelic, rerollRelicOffer, updateRelics } from '../src/systems/relics';
import { spawnEnemy } from '../src/systems/spawning';
import { summarizeRun } from '../src/game';

/** A headless game holding `relics` (at `tier`), its relic stream fixed so a cursed card comes (0) or never does (0.99). */
function game(relics: RelicId[] = [], tier = 1, roll = 0.99): Game {
  const g = createGame('viking', 7);
  g.rng = g.player.rng = Object.assign(() => 0.999, { s: 0 });
  g.player.relics.rng = Object.assign(() => roll, { s: 0 });
  for (const id of relics) addRelic(g, id, 'other', tier);
  tick(g);
  return g;
}
const tick = (g: Game) => {
  g.player.mods = { ...g.baseMods };
  updateRelics(g, 1 / 60);
};
const knight = (g: Game, dx: number): Enemy => {
  const e = spawnEnemy(g, 'knight', g.player.x + dx, g.player.y);
  e.armorHp = 0;
  g.hash.insert(e);
  return e;
};

describe('cursed relics (v0.7.1 B6): the model', () => {
  it('six of them, with no family, a curse in their text and an awakening that lifts it; no class ever finds one in its pool', () => {
    expect(CURSED_IDS).toHaveLength(6);
    for (const id of CURSED_IDS) {
      const r = relicDef(id);
      expect(r.family, id).toBeUndefined();
      expect(familyOf(id)).toBeUndefined();
      expect(r.desc, id).toMatch(/Curse: /);
      expect(r.awaken.desc, id).toMatch(/^The curse lifts/);
      expect(HOOKS[id], id).toBeTruthy();
    }
    for (const id of RELIC_IDS.filter((r) => !isCursedRelic(r))) expect(FAMILY_IDS).toContain(relicDef(id).family);
    for (const c of CLASS_ORDER) expect(relicPoolFor(c, []).filter(isCursedRelic)).toEqual([]);
  });
});

describe('cursed relics: the offer rule', () => {
  it('a wave boss or lair moment can put one on the third card, at most once an Act; never the other moments', () => {
    const g = game(['brimstoneOil'], 1, 0);
    const p = g.player;
    for (const from of ['quest', 'merchant', 'start', 'other'] as const) offerRelics(g, 3, from);
    expect(p.relics.offers.flatMap((o) => o.options).filter(isCursedRelic)).toEqual([]);
    p.relics.offers = [];
    offerRelics(g, 3, 'boss');
    const [first] = p.relics.offers;
    expect(first.options).toHaveLength(3);
    expect(isCursedRelic(first.options[2])).toBe(true);
    expect(first.options.slice(0, 2).some(isCursedRelic)).toBe(false);
    // the family rule still holds for the other two: one of a family held, one of a family not held
    expect(first.options.slice(0, 2).map((id) => familyOf(id) === 'flame').sort()).toEqual([false, true]);
    offerRelics(g, 3, 'lair');
    offerRelics(g, 4, 'boss');
    expect(p.relics.offers.slice(1).flatMap((o) => o.options).filter(isCursedRelic)).toEqual([]); // once this Act
    g.act = 2;
    offerRelics(g, 4, 'lair');
    expect(p.relics.offers.at(-1)!.options).toHaveLength(4);
    expect(isCursedRelic(p.relics.offers.at(-1)!.options[2])).toBe(true); // a new Act, a new chance; still the third card
    expect(p.relics.cursedAct).toBe(2);
  });

  it('comes CURSED.chance of the time; a held one is never offered again; a reroll keeps the cursed card', () => {
    const miss = game([], 1, CURSED.chance);
    offerRelics(miss, 3, 'boss');
    expect(miss.player.relics.offers[0].options.filter(isCursedRelic)).toEqual([]);
    expect(miss.player.relics.cursedAct).toBe(0); // not offered: the Act's chance is still open
    const g = game(CURSED_IDS.slice(0, 5), 1, 0);
    offerRelics(g, 3, 'boss');
    const offer = g.player.relics.offers[0];
    expect(offer.options[2]).toBe(CURSED_IDS[5]);
    const before = offer.options.slice(0, 2);
    g.player.relics.rng = Object.assign(() => 0.5, { s: 0 });
    expect(rerollRelicOffer(g)).toBe(true);
    expect(offer.options[2]).toBe(CURSED_IDS[5]);
    expect(offer.options.slice(0, 2)).not.toEqual(before);
    const all = game(CURSED_IDS, 1, 0);
    offerRelics(all, 3, 'boss');
    expect(all.player.relics.offers[0].options.filter(isCursedRelic)).toEqual([]); // none left to offer
  });
});

describe('cursed relics: their power, their curse, and the awakening that lifts it', () => {
  it('Hungering Blade: kills this wave add damage; a fight without kills bites (never below 1 HP)', () => {
    const g = game(['hungeringBlade']);
    const p = g.player;
    for (let i = 0; i < 5; i++) killEnemy(g, knight(g, 900));
    tick(g);
    expect(p.mods.damage).toBeCloseTo(g.baseMods.damage + 0.1, 5);
    knight(g, 900);
    g.breather = 0;
    const hp = p.hp;
    g.time += 5.1;
    tick(g);
    expect(p.hp).toBeCloseTo(hp - p.stats.hp * 0.06, 5);
    const lifted = game(['hungeringBlade'], 3);
    knight(lifted, 900);
    lifted.breather = 0;
    lifted.time += 30;
    tick(lifted);
    expect(lifted.player.hp).toBe(lifted.player.stats.hp);
  });

  it('Doom Bell: the dead burst into their neighbours; the horde moves faster until it awakens', () => {
    const g = game(['doomBell']);
    const dead = knight(g, 300);
    const near = knight(g, 360);
    const hp = near.hp;
    killEnemy(g, dead);
    expect(near.hp).toBeLessThan(hp);
    expect(g.vars['relic.enemySpeed']).toBeCloseTo(1.15);
    const lifted = game(['doomBell'], 3);
    expect(lifted.vars['relic.enemySpeed']).toBe(1);
  });

  it('Scepter of Ruin: a much shorter cooldown; every cast costs 10% of current HP until it awakens', () => {
    const g = game(['scepterOfRuin']);
    expect(relicMods('scepterOfRuin', 1)!.cooldown).toBeCloseTo(0.55);
    expect(g.player.mods.cooldown).toBeCloseTo(g.baseMods.cooldown * 0.55, 5);
    const hp = g.player.hp;
    HOOKS.scepterOfRuin!.onAbilityUsed!(g, { cooldown: 5 }, g.player);
    expect(g.player.hp).toBeCloseTo(hp * 0.9, 5);
    const lifted = game(['scepterOfRuin'], 3);
    HOOKS.scepterOfRuin!.onAbilityUsed!(lifted, { cooldown: 5 }, lifted.player);
    expect(lifted.player.hp).toBe(lifted.player.stats.hp);
  });

  it('Abyssal Eye: close enemies hit harder, far ones do not; awakened, nobody does', () => {
    const lost = (g: Game, dx: number) => {
      const e = knight(g, dx);
      g.player.hp = g.player.stats.hp;
      damagePlayer(g, 20, true, e);
      return g.player.stats.hp - g.player.hp;
    };
    const plain = lost(game(), 100);
    expect(lost(game(['abyssalEye']), 100)).toBeCloseTo(plain * 1.25, 3);
    expect(lost(game(['abyssalEye']), 600)).toBeCloseTo(plain, 3);
    expect(lost(game(['abyssalEye'], 3), 100)).toBeCloseTo(plain, 3);
  });

  it('Crimson Chalice: max HP cut to 70%, back when it awakens or is sold', () => {
    const full = game().player.stats.hp;
    const g = game(['crimsonChalice']);
    expect(g.player.stats.hp).toBeCloseTo(full * 0.7, 5);
    removeRelic(g, 'crimsonChalice');
    expect(g.player.stats.hp).toBeCloseTo(full, 5);
    const t = game(['crimsonChalice']);
    t.player.relics.attune.crimsonChalice = 1;
    tick(t);
    t.player.relics.attune.crimsonChalice = 1;
    tick(t);
    expect(t.player.relics.tiers.crimsonChalice).toBe(3);
    expect(t.player.stats.hp).toBeCloseTo(full, 5);
  });

  it("Tyrant's Banner: elites slain add damage and attack speed; more elites come until it awakens", () => {
    const g = game(['tyrantsBanner']);
    for (let i = 0; i < 3; i++) {
      const e = spawnEnemy(g, 'knight', g.player.x + 900, g.player.y, ['enraged']);
      expect(e.elite).toBe(true);
      killEnemy(g, e);
    }
    tick(g);
    expect(g.player.mods.damage).toBeCloseTo(g.baseMods.damage + 0.12, 5);
    expect(g.player.mods.atkSpd).toBeCloseTo(g.baseMods.atkSpd + 0.12, 5);
    expect(g.vars['relic.eliteMult']).toBeCloseTo(1.6);
    expect(game(['tyrantsBanner'], 3).vars['relic.eliteMult']).toBe(1);
  });
});

describe('cursed relics: the deed, and no save format change', () => {
  it('Cursebearer counts the most cursed relics carried in a won run; the collection deeds leave them out', () => {
    const g = game(['brimstoneOil', 'doomBell', 'abyssalEye']);
    const run = summarizeRun(g);
    const lost = applyRun(defaultSave(), { ...run, won: false }).save;
    expect(lost.counters.cursedWin).toBe(0);
    const won = applyRun(defaultSave(), { ...run, won: true }).save;
    expect(won.counters.cursedWin).toBe(2);
    const earned = newlyEarned(won).map((e) => `${e.id}:${e.tier}`);
    expect(earned).toEqual(expect.arrayContaining(['cursebearer:1', 'cursebearer:2']));
    expect(earned).not.toContain('cursebearer:3');
    const curator = (s: typeof won) => newlyEarned(s).some((e) => e.id === 'curator');
    expect(curator({ ...defaultSave(), relicPicks: Object.fromEntries([...RELIC_IDS.filter((id) => !isCursedRelic(id)).slice(0, 4), ...CURSED_IDS].map((id) => [id, 1])) })).toBe(false); // 4 + 6 cursed is not 10
  });

  it('the save format stays 6: an older save reads the new counter as 0, and it survives a round trip', () => {
    expect(SAVE_VERSION).toBe(6);
    const old = JSON.parse(JSON.stringify(defaultSave()));
    delete old.counters.cursedWin;
    expect(migrate(old).counters.cursedWin).toBe(0);
    const s = defaultSave();
    s.counters.cursedWin = 2;
    s.relicPicks.doomBell = 1;
    const back = migrate(JSON.parse(JSON.stringify(s)));
    expect(back.counters.cursedWin).toBe(2);
    expect(back.relicPicks.doomBell).toBe(1);
  });
});
