import { describe, expect, it } from 'vitest';
import { DUO_IDS, DUOS, FAMILY_IDS, RELIC_IDS, relicDef, type RelicId } from '../src/config/relics';
import type { Game } from '../src/core/types';
import { createGame, summarizeRun } from '../src/game';
import { readyDuos } from '../src/logic/relics';
import { applyRun, defaultSave, migrate } from '../src/logic/save';
import { damagePlayer, killEnemy } from '../src/systems/combat';
import { chainFrom } from '../src/systems/relicCore';
import { addRelic, offerRelics, relicPreview, resolveRelicOffer, skipRelicOffer, updateRelics } from '../src/systems/relics';
import { freeze } from '../src/systems/relicFamilies/frost';
import { spawnEnemy } from '../src/systems/spawning';
import { keyTip } from '../src/ui/relicText';

function game(relics: RelicId[]): Game {
  const g = createGame('paladin', 1);
  g.rng = Object.assign(() => 0.999, { s: 0 }); // no random procs unless a test says otherwise
  for (const id of relics) addRelic(g, id);
  return g;
}
const tick = (g: Game, dt = 1 / 60) => {
  g.player.mods = { ...g.baseMods };
  updateRelics(g, dt);
};
const foe = (g: Game, dx: number) => {
  const e = spawnEnemy(g, 'knight', g.player.x + dx, g.player.y);
  e.armorHp = 0;
  g.hash.insert(e);
  return e;
};

describe('duo recipes (RELICS.md, A5 rules)', () => {
  it('12+ duos, each from two relics of two different families that every class can find, each relic in one recipe at most', () => {
    expect(DUO_IDS.length).toBeGreaterThanOrEqual(12);
    const sources = DUO_IDS.flatMap((d) => DUOS[d].from);
    expect(new Set(sources).size).toBe(sources.length);
    for (const d of DUO_IDS) {
      const [a, b] = DUOS[d].from;
      expect(DUOS[d].families, d).toEqual([relicDef(a).family, relicDef(b).family]);
      expect(relicDef(a).family).not.toBe(relicDef(b).family);
      expect(relicDef(a).classId ?? relicDef(b).classId, d).toBeUndefined();
      expect(RELIC_IDS).toEqual(expect.arrayContaining([a, b]));
    }
  });

  it('spread evenly: every family in 2 to 4 recipes', () => {
    for (const f of FAMILY_IDS) {
      const n = DUO_IDS.filter((d) => DUOS[d].families.includes(f)).length;
      expect(n, f).toBeGreaterThanOrEqual(2);
      expect(n, f).toBeLessThanOrEqual(4);
    }
  });
});

describe('duo offers', () => {
  it('a duo is ready once both sources are held, first completed first; a formed one is not ready again', () => {
    const g = game(['emberheart', 'frostBrand', 'stormPennant', 'brimstoneOil']); // Wildfire completes before Thermal Shock
    expect(readyDuos(g.player.relics)).toEqual(['wildfire', 'thermalShock']);
    offerRelics(g, 3, 'boss');
    expect(resolveRelicOffer(g, 'wildfire')).toBe(true);
    expect(readyDuos(g.player.relics)).toEqual(['thermalShock']);
  });

  it('one duo a moment, as a fourth option; queued moments offer different duos, and a skipped duo comes back', () => {
    const g = game(['emberheart', 'stormPennant', 'brimstoneOil', 'frostBrand']);
    offerRelics(g, 3, 'boss');
    offerRelics(g, 3, 'boss');
    offerRelics(g, 3, 'lair');
    expect(g.player.relics.offers.map((o) => o.duo)).toEqual(['wildfire', 'thermalShock', undefined]);
    expect(g.player.relics.offers[0].options).toHaveLength(3);
    expect(resolveRelicOffer(g, 'thermalShock')).toBe(false); // not this moment's duo
    skipRelicOffer(g);
    g.player.relics.offers = [];
    offerRelics(g, 3, 'boss');
    expect(g.player.relics.offers[0].duo).toBe('wildfire');
  });

  it('taking a duo costs the pick; its two relics keep their family counts', () => {
    const flame = RELIC_IDS.filter((id) => relicDef(id).family === 'flame' && !relicDef(id).classId); // 5, Brimstone Oil among them
    const g = game([...flame, 'frostBrand']);
    offerRelics(g, 3, 'boss');
    const held = g.player.relics.held.length;
    expect(resolveRelicOffer(g, 'thermalShock')).toBe(true);
    expect(g.player.relics.held.length).toBe(held);
    expect(g.player.relics.offers).toHaveLength(0);
    tick(g);
    expect(g.player.relics.sets.flame).toMatchObject({ count: 5, level: 4 }); // v0.7.5 (#96): the duo adds no count
    expect(g.player.relics.sets.frost).toMatchObject({ count: 1, level: 0 });
  });

  it('with nothing left to find, a ready duo still makes a moment', () => {
    const g = game(['brimstoneOil', 'frostBrand']);
    g.player.relics.pool = [...g.player.relics.held];
    offerRelics(g, 3, 'boss');
    expect(g.player.relics.offers[0]).toMatchObject({ options: [], duo: 'thermalShock' });
  });

  it('the pick screen says when a relic would complete a duo', () => {
    const g = game(['brimstoneOil']);
    expect(relicPreview(g.player, 'frostBrand').some((l) => l.includes('Completes the duo') && l.includes('Thermal Shock'))).toBe(true);
    expect(relicPreview(g.player, 'shatterglass').some((l) => l.includes('duo'))).toBe(false);
  });

  it('formed duos are saved for the compendium', () => {
    const g = game(['brimstoneOil', 'frostBrand']);
    offerRelics(g, 3, 'boss');
    resolveRelicOffer(g, 'thermalShock');
    const save = applyRun(defaultSave(), summarizeRun(g), 'd').save;
    expect(save.duos).toEqual(['thermalShock']);
    expect(migrate({ ...save, duos: ['thermalShock', 'nonsense'] }).duos).toEqual(['thermalShock']);
  });
});

describe('duo effects', () => {
  const formed = (relics: RelicId[], duo: (typeof DUO_IDS)[number]) => {
    const g = game(relics);
    offerRelics(g, 3, 'boss');
    expect(resolveRelicOffer(g, duo)).toBe(true);
    tick(g);
    return g;
  };

  it('Thermal Shock: a burning enemy that freezes takes the rest of its burn, multiplied, at once', () => {
    const g = formed(['brimstoneOil', 'frostBrand'], 'thermalShock');
    const e = foe(g, 300);
    e.hp = e.maxHp = 1e5;
    e.statuses.burn = { stacks: 2, time: 3, power: 10 };
    freeze(g, e, 1);
    expect(e.statuses.burn).toBeUndefined();
    expect(e.maxHp - e.hp).toBeGreaterThan(2 * 10 * 3 * DUOS.thermalShock.n.mult * 0.8); // stacks x power x time left x mult, before armor
  });

  it('Wildfire: a chain copies the burn of the enemy it jumps from', () => {
    const g = formed(['emberheart', 'stormPennant'], 'wildfire');
    const [a, b] = [foe(g, 300), foe(g, 340)];
    a.statuses.burn = { stacks: 3, time: 3, power: 2 };
    chainFrom(g, g.player, a, 1, 1, 200);
    expect(b.statuses.burn?.stacks).toBe(3);
  });

  it('Glacier Plate: a block freezes the attacker', () => {
    const g = formed(['shatterglass', 'towerShield'], 'glacierPlate');
    const e = foe(g, 40);
    g.rng = Object.assign(() => 0, { s: 0 }); // Tower Shield blocks
    damagePlayer(g, 20, true, e);
    expect(e.frozenT).toBeGreaterThan(g.time);
  });

  it("Martyr's Covenant: damage taken comes back as ward over a few seconds", () => {
    const g = formed(['bloodPact', 'guardiansAegis'], 'martyrsCovenant');
    g.vars['aegis.t'] = -999; // keep the Aegis's own ward out of it
    damagePlayer(g, 40, true);
    expect(g.player.ward).toBe(0);
    for (let i = 0; i < 300; i++) tick(g);
    expect(g.player.ward).toBeGreaterThan(0);
  });

  it('Requiem: a cursed enemy you kill heals you like a mercy orb', () => {
    const g = formed(['haloOfMercy', 'deathmask'], 'requiem');
    g.player.hp = g.player.stats.hp / 2;
    const e = foe(g, 300);
    e.statuses.curse = { stacks: 1, time: 3, power: 0 };
    killEnemy(g, e);
    expect(g.player.hp).toBeGreaterThan(g.player.stats.hp / 2);
  });
});

describe('the results table (v0.7.1 fix)', () => {
  it('its tooltips take rows of relics, duos and sets together (a set or duo row used to break the results and victory screens)', () => {
    const rows = ['brimstoneOil', 'emberheart', 'thermalShock', 'flame'] as const;
    for (const id of rows) expect(() => keyTip(id, 1, [...rows])).not.toThrow();
    expect(keyTip('brimstoneOil', 1, [...rows])).toContain('2 held');
    expect(keyTip('thermalShock', 0, [...rows])).toContain('Thermal Shock');
    expect(keyTip('flame', 0, [...rows])).toContain('Flame set bonuses');
  });
});

