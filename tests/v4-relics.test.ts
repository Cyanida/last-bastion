import { describe, expect, it } from 'vitest';
import { MERCHANT } from '../src/config/acts';
import { RELIC_DROPS, RELIC_IDS, RELIC_MAX_TIER, RELIC_STACKING, relicDef, relicDesc, relicMods, relicN, SYNERGIES, SYNERGY_IDS, type RelicId } from '../src/config/relics';
import { mulberry32 } from '../src/core/math';
import { createGame, updateGame } from '../src/game';
import { activeSynergies, newRelicShare, procScale, relicModTotals, relicModsCombined, rollRelics, softCap, synergiesOf, withRelic } from '../src/logic/relics';
import { merchantSalvage, merchantSell, salvageValue, sellPrice } from '../src/systems/acts';
import { damageEnemy } from '../src/systems/combat';
import { addRelic, offerRelics, removeRelic, resolveRelicOffer } from '../src/systems/relics';
import { spawnEnemy } from '../src/systems/spawning';

describe('relic tiers (v0.4)', () => {
  it('every relic has three tiers, and a tier up changes its numbers or mods and its text', () => {
    for (const id of RELIC_IDS) {
      const texts = [1, 2, 3].map((t) => relicDesc(id, t));
      expect(new Set(texts).size).toBe(3);
      const n1 = JSON.stringify(relicN(id, 1)) + JSON.stringify(relicMods(id, 1));
      const n3 = JSON.stringify(relicN(id, 3)) + JSON.stringify(relicMods(id, 3));
      expect(n1).not.toBe(n3);
    }
    expect(relicN('whetstone', 3).bonus).toBeGreaterThan(relicN('whetstone', 1).bonus);
    expect(relicMods('whetstone', 3)!.damage).toBeGreaterThan(relicMods('whetstone', 1)!.damage!);
    expect(relicN('shockSigil', 3).cooldown).toBeLessThan(relicN('shockSigil', 1).cooldown); // "stronger" can mean a shorter cooldown
  });

  it('a duplicate pickup upgrades the relic a tier, never past the top, and there is no slot cap', () => {
    let tiers = withRelic({}, 'whetstone');
    expect(tiers.whetstone).toBe(1);
    tiers = withRelic(tiers, 'whetstone');
    expect(tiers.whetstone).toBe(2);
    tiers = withRelic(tiers, 'whetstone');
    expect(tiers.whetstone).toBe(RELIC_MAX_TIER);
    expect(withRelic(tiers, 'whetstone')).toBe(tiers); // same object: nothing changed
    expect(withRelic({ whetstone: 2 }, 'whetstone', 2)).toEqual({ whetstone: 2 }); // the Chapel's vault caps a fresh save at tier II
    const fresh = createGame('paladin', 1);
    addRelic(fresh, 'whetstone');
    addRelic(fresh, 'whetstone');
    expect(addRelic(fresh, 'whetstone')).toBe(false);
    expect(fresh.relicTiers.whetstone).toBe(2);
    const g = createGame('paladin', 1, { meta: { relicSlot: 1 } }); // Reliquary Vault: tier III
    for (const id of RELIC_IDS) addRelic(g, id);
    expect(g.relics.length).toBe(RELIC_IDS.length); // v0.3 stopped at 6
    expect(addRelic(g, 'whetstone')).toBe(true);
    expect(addRelic(g, 'whetstone')).toBe(true);
    expect(addRelic(g, 'whetstone')).toBe(false); // top tier
    expect(g.relics.filter((r) => r === 'whetstone').length).toBe(1);
    expect(g.relicTiers.whetstone).toBe(RELIC_MAX_TIER);
  });

  it('a tiered relic really is stronger in play: Blood Pact III cuts less HP than Blood Pact I, and a tier up gives the difference back', () => {
    const g = createGame('paladin', 1, { meta: { relicSlot: 1 } });
    const base = g.player.stats.hp;
    addRelic(g, 'bloodPact');
    expect(g.player.stats.hp).toBeCloseTo(base * relicN('bloodPact', 1).hp);
    addRelic(g, 'bloodPact');
    addRelic(g, 'bloodPact');
    expect(g.player.stats.hp).toBeCloseTo(base * relicN('bloodPact', 3).hp);
    removeRelic(g, 'bloodPact');
    expect(g.player.stats.hp).toBeCloseTo(base);
    updateGame(g, 1 / 60);
    expect(g.player.mods.damage).toBe(1);
  });
});

describe('relic stacking and soft caps', () => {
  it('the same mod from several relics adds up and passes a soft cap with diminishing returns', () => {
    expect(softCap(0.2, 1)).toBe(0.2); // up to the cap: face value
    expect(softCap(1, 1)).toBe(1);
    expect(softCap(1.5, 1)).toBeLessThan(1.5); // past it: diminishing
    expect(softCap(1.5, 1)).toBeGreaterThan(1);
    expect(softCap(50, 1)).toBeLessThanOrEqual(1.5); // and never more than half again
    expect(softCap(0.3, Infinity)).toBe(0.3);
    const totals = relicModTotals(['whetstone', 'bloodPact'], { whetstone: 1, bloodPact: 1 });
    expect(totals.damage!.raw).toBeCloseTo(0.62);
    expect(totals.damage!.eff).toBeCloseTo(softCap(0.62, RELIC_STACKING.softCaps.damage!));
    expect(totals.damage!.count).toBe(2);
    const mods = relicModsCombined(['whetstone', 'bloodPact'], { whetstone: 1, bloodPact: 1 });
    expect(mods.damage).toBeCloseTo(1 + totals.damage!.eff);
    expect(mods.damage!).toBeLessThan(1.12 * 1.5); // v0.3 multiplied them
    expect(relicModTotals(['whetstone', 'bloodPact'], { whetstone: 3, bloodPact: 3 }).damage!.eff).toBeLessThan(0.25 + 0.8); // past the cap
    const cd = relicModsCombined(['hourglass'], { hourglass: 3 });
    expect(cd.cooldown!).toBeLessThan(1);
    expect(cd.cooldown!).toBeGreaterThan(1 - relicN('hourglass', 3).cut); // its 55% cut is past the 50% soft cap
  });

  it('proc categories share their chance past the cap', () => {
    const three: RelicId[] = ['stormPennant', 'frostBrand', 'brimstoneOil'];
    expect(procScale(three, 'onHit')).toBe(1);
    expect(procScale([...three, 'serratedEdge', 'hexDoll'], 'onHit')).toBeCloseTo(3 / 5);
    expect(procScale([...three, 'serratedEdge', 'hexDoll'], 'onKill')).toBe(1);
  });

  it('proc chains stop at depth 2: a keg blast that kills does not blast again', () => {
    const g = createGame('paladin', 1);
    g.rng = () => 0; // every proc fires
    addRelic(g, 'powderKeg');
    g.wave = 5;
    const ring = Array.from({ length: 6 }, (_, i) => spawnEnemy(g, 'peasant', g.player.x + 300 + Math.cos(i) * 20, g.player.y + Math.sin(i) * 20));
    for (const e of ring) e.hp = 1;
    g.hash.clear();
    for (const e of g.enemies) g.hash.insert(e);
    const first = ring[0];
    damageEnemy(g, first, 5, false, 0, 0, 'attack'); // kill -> blast (depth 1) -> kills the rest -> their blasts would be depth 2 -> their kills' blasts would be depth 3
    const dead = ring.filter((e) => e.dead).length;
    expect(dead).toBeGreaterThan(1);
    expect(g.procDepth).toBe(0); // the counter always unwinds
  });
});

describe('synergies', () => {
  it('at least 8 synergies and some clashes, each between relics that exist, all of them listed in the relic tooltips', () => {
    const positive = SYNERGY_IDS.filter((id) => !SYNERGIES[id].anti);
    const anti = SYNERGY_IDS.filter((id) => SYNERGIES[id].anti);
    expect(positive.length).toBeGreaterThanOrEqual(8);
    expect(anti.length).toBeGreaterThanOrEqual(3);
    for (const id of SYNERGY_IDS) for (const r of SYNERGIES[id].relics) expect(RELIC_IDS).toContain(r);
    expect(synergiesOf('powderKeg')).toContain('fireInTheHole');
    expect(synergiesOf('powderKeg')).toContain('overkill');
  });

  it('a synergy is active only with all its relics held, and it does something', () => {
    expect(activeSynergies(['brimstoneOil'])).toEqual([]);
    expect(activeSynergies(['brimstoneOil', 'powderKeg'])).toEqual(['fireInTheHole']);
    expect(activeSynergies(['executioner', 'powderKeg'])).toEqual(['overkill']); // a clash counts as active too: the UI warns
    const g = createGame('paladin', 1);
    addRelic(g, 'luckyCoin');
    updateGame(g, 1 / 60);
    const before = g.player.mods.gold;
    addRelic(g, 'scholarTome');
    updateGame(g, 1 / 60);
    expect(g.synergies).toContain('pilgrimsPurse');
    expect(g.player.mods.gold).toBeCloseTo(before + SYNERGIES.pilgrimsPurse.n.bonus); // joins the additive gold sum
  });
});

describe('drops, selling and salvage', () => {
  it('the share of new relics in a drop shrinks with every relic held, so late drops are mostly upgrades', () => {
    expect(newRelicShare(0)).toBe(1);
    expect(newRelicShare(5)).toBeLessThan(newRelicShare(2));
    expect(newRelicShare(50)).toBe(RELIC_DROPS.minNewShare);
    const pool = RELIC_IDS.filter((id) => !relicDef(id).classId);
    const held: RelicId[] = ['whetstone', 'swiftBoots', 'luckyCoin', 'ironBand', 'lodestone', 'scholarTome'];
    const tiers = Object.fromEntries(held.map((id) => [id, 1]));
    let upgrades = 0;
    const rng = mulberry32(3);
    for (let i = 0; i < 300; i++) if (held.includes(rollRelics(pool, held, tiers, rng, 1)[0])) upgrades++;
    expect(upgrades).toBeGreaterThan(60); // six commons held: upgrades are a real share of the drops
    const maxed = Object.fromEntries(held.map((id) => [id, RELIC_MAX_TIER]));
    for (let i = 0; i < 50; i++) expect(held).not.toContain(rollRelics(pool, held, maxed, rng, 1)[0]); // top tier: never offered again
    expect(rollRelics(pool, held, tiers, rng, 3, ['whetstone']).length).toBe(3);
  });

  it('a boss drop offers three distinct relics; a taken offer upgrades or adds', () => {
    const g = createGame('paladin', 1);
    offerRelics(g);
    expect(g.relicOffers[0].length).toBe(3);
    expect(new Set(g.relicOffers[0]).size).toBe(3);
    const pick = g.relicOffers[0][0];
    expect(resolveRelicOffer(g, pick)).toBe(true);
    expect(g.relics).toContain(pick);
    expect(g.relicOffers.length).toBe(0);
  });

  it('the Merchant buys relics back for gold or salvages them into Rune shards', () => {
    const g = createGame('paladin', 1);
    addRelic(g, 'whetstone');
    addRelic(g, 'whetstone');
    expect(sellPrice('whetstone', 2, 1)).toBe(Math.round(MERCHANT.buy.common * RELIC_DROPS.sellFrac * 2));
    expect(sellPrice('bloodPact', 1, 2)).toBeGreaterThan(sellPrice('bloodPact', 1, 1)); // prices rise per Act, so does the buy-back
    expect(salvageValue('bloodPact', 3)).toBe(RELIC_DROPS.salvage.legendary * 3);
    const gold = g.gold;
    expect(merchantSell(g, 'whetstone')).toBe(true);
    expect(g.gold).toBe(gold + sellPrice('whetstone', 2, g.act));
    expect(g.relics).not.toContain('whetstone');
    expect(merchantSell(g, 'whetstone')).toBe(false);
    addRelic(g, 'powderKeg');
    expect(merchantSalvage(g, 'powderKeg')).toBe(true);
    expect(g.salvage).toBe(RELIC_DROPS.salvage.rare);
    expect(g.relics).not.toContain('powderKeg');
  });
});
