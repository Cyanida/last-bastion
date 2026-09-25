import { describe, expect, it } from 'vitest';
import { MERCHANT } from '../src/config/acts';
import { RELIC_DROPS, RELIC_IDS, relicDef, relicDesc, relicMods, relicN, type RelicId } from '../src/config/relics';
import { createGame, updateGame } from '../src/game';
import { relicModTotals, relicModsCombined, softCap } from '../src/logic/relics';
import { merchantSalvage, merchantSell, salvageValue, sellPrice } from '../src/systems/acts';
import { damageEnemy } from '../src/systems/combat';
import { addRelic, offerRelics, removeRelic, resolveRelicOffer } from '../src/systems/relics';
import { spawnEnemy } from '../src/systems/spawning';

describe('relic tiers (v0.7: tier II strengthens, tier III awakens)', () => {
  it('tier II changes the numbers or mods; tier III keeps them and adds a named awakening to the text', () => {
    for (const id of RELIC_IDS) {
      const n1 = JSON.stringify(relicN(id, 1)) + JSON.stringify(relicMods(id, 1));
      const n2 = JSON.stringify(relicN(id, 2)) + JSON.stringify(relicMods(id, 2));
      expect(n2, id).not.toBe(n1);
      expect(relicN(id, 3)).toEqual(relicN(id, 2));
      expect(relicDesc(id, 3)).toContain(relicDef(id).awaken.name);
      expect(relicDesc(id, 1)).not.toContain(relicDef(id).awaken.name);
    }
    expect(relicN('shockSigil', 2).cooldown).toBeLessThan(relicN('shockSigil', 1).cooldown); // "stronger" can mean a shorter cooldown
  });

  it('no duplicates (v0.7): taking a held relic does nothing, and no offer shows one', () => {
    const g = createGame('paladin', 1);
    expect(addRelic(g, 'frostBrand')).toBe(true);
    expect(addRelic(g, 'frostBrand')).toBe(false);
    expect(g.player.relics.tiers.frostBrand).toBe(1);
    expect(g.player.relics.held.filter((id) => id === 'frostBrand')).toHaveLength(1);
    for (let i = 0; i < 30; i++) {
      offerRelics(g);
      expect(g.player.relics.offers[0].options).not.toContain('frostBrand');
      g.player.relics.offers = [];
    }
  });

  it('a tiered relic is stronger in play: attuned Blood Pact II cuts less HP, and removing it gives the HP back', () => {
    const g = createGame('paladin', 1);
    const base = g.player.stats.hp;
    addRelic(g, 'bloodPact');
    expect(g.player.stats.hp).toBeCloseTo(base * relicN('bloodPact', 1).hp);
    g.player.relics.attune.bloodPact = 1;
    updateGame(g, 1 / 60);
    expect(g.player.relics.tiers.bloodPact).toBe(2);
    expect(g.player.stats.hp).toBeCloseTo(base * relicN('bloodPact', 2).hp);
    removeRelic(g, 'bloodPact');
    expect(g.player.stats.hp).toBeCloseTo(base);
    updateGame(g, 1 / 60);
    expect(g.player.mods.damage).toBe(1);
  });
});

describe('relic stacking (v0.7: face value)', () => {
  it('plain bonuses add up at face value, and relic healing keeps its soft cap', () => {
    expect(softCap(0.2, 1)).toBe(0.2);
    expect(softCap(1.5, 1)).toBeLessThan(1.5);
    expect(softCap(50, 1)).toBeLessThanOrEqual(1.5);
    const totals = relicModTotals(['bloodPact', 'tempestEye'], { bloodPact: 1, tempestEye: 1 });
    expect(totals.damage!.eff).toBeCloseTo(0.4);
    expect(totals.crit!.eff).toBeCloseTo(0.1);
    expect(relicModsCombined(['bloodPact'], { bloodPact: 2 }).damage).toBeCloseTo(1.55);
  });

  it('proc chains stop at depth 2 and the counter always unwinds', () => {
    const g = createGame('paladin', 1);
    g.rng = Object.assign(() => 0, { s: 0 }); // every proc fires
    for (const id of ['brimstoneOil', 'emberheart', 'cinderCharm', 'salamanderScale'] as RelicId[]) addRelic(g, id); // Flame 4: Pyre
    updateGame(g, 1 / 60);
    g.wave = 5;
    const ring = Array.from({ length: 6 }, (_, i) => spawnEnemy(g, 'peasant', g.player.x + 300 + Math.cos(i) * 20, g.player.y + Math.sin(i) * 20));
    for (const e of ring) {
      e.hp = 1;
      e.statuses.burn = { stacks: 1, time: 3, power: 1 };
    }
    g.hash.clear();
    for (const e of g.enemies) g.hash.insert(e);
    damageEnemy(g, ring[0], 5, false, 0, 0, 'attack'); // kill -> Pyre (depth 1) -> kills the rest -> their Pyres stop at depth 2
    expect(ring.filter((e) => e.dead).length).toBeGreaterThan(1);
    expect(g.procDepth).toBe(0);
  });
});

describe('drops, selling and salvage', () => {
  it('a boss moment offers three distinct relics; a taken one is held', () => {
    const g = createGame('paladin', 1);
    offerRelics(g);
    expect(new Set(g.player.relics.offers[0].options).size).toBe(3);
    const pick = g.player.relics.offers[0].options[0];
    expect(resolveRelicOffer(g, pick)).toBe(true);
    expect(g.player.relics.held).toContain(pick);
    expect(g.player.relics.offers.length).toBe(0);
  });

  it('the Merchant buys relics back for gold or salvages them into Rune shards', () => {
    const g = createGame('paladin', 1);
    addRelic(g, 'frostBrand', 'other', 2);
    expect(sellPrice('frostBrand', 2, 1)).toBe(Math.round(MERCHANT.buy.common * RELIC_DROPS.sellFrac * 2));
    expect(sellPrice('bloodPact', 1, 2)).toBeGreaterThan(sellPrice('bloodPact', 1, 1));
    expect(salvageValue('bloodPact', 3)).toBe(RELIC_DROPS.salvage.legendary * 3);
    const gold = g.gold;
    expect(merchantSell(g, 'frostBrand')).toBe(true);
    expect(g.gold).toBe(gold + sellPrice('frostBrand', 2, g.act));
    expect(g.player.relics.held).not.toContain('frostBrand');
    expect(merchantSell(g, 'frostBrand')).toBe(false);
    addRelic(g, 'shatterglass');
    expect(merchantSalvage(g, 'shatterglass')).toBe(true);
    expect(g.salvage).toBe(RELIC_DROPS.salvage.rare);
  });
});
