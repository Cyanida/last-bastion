import { describe, expect, it } from 'vitest';
import { MERCHANT } from '../src/config/acts';
import { ROUTES } from '../src/config/routes';
import { createGame } from '../src/game';
import { caravanSellsRelic, merchantPrice } from '../src/logic/acts';
import { rollLevelUpOptions } from '../src/logic/upgrades';
import { mulberry32 } from '../src/core/math';
import { applyChoice, levelHand } from '../src/sim/commands';
import { leaveMerchant, merchantBuy } from '../src/systems/acts';

/** A run at the Merchant path's caravan, with gold to spend; `relic` is this visit's roll. */
function atCaravan(relic: boolean) {
  const g = createGame('viking', 7);
  g.pendingBoard = false;
  g.pendingMerchant = g.midMerchant = true;
  g.vars.caravanRelic = relic ? 1 : 0;
  g.gold = 1000;
  return g;
}

describe('#144: the caravan sells books in the relic slots, and now and then a relic', () => {
  it('sells a relic on about one visit in ten, from a seeded stream', () => {
    const rng = mulberry32(1);
    const n = 20000;
    let hits = 0;
    for (let i = 0; i < n; i++) if (caravanSellsRelic(rng)) hits++;
    expect(hits / n).toBeCloseTo(ROUTES.merchant.relicChance, 1.5);
    const a = mulberry32(9), b = mulberry32(9);
    expect([0, 1, 2, 3, 4].map(() => caravanSellsRelic(a))).toEqual([0, 1, 2, 3, 4].map(() => caravanSellsRelic(b)));
  });

  it('prices the books like the rest of his wares, rising per Act', () => {
    expect(merchantPrice('book:haste', 1)).toBe(MERCHANT.books.haste.cost);
    expect(merchantPrice('book:fortune', 2)).toBe(Math.round(MERCHANT.books.fortune.cost * (1 + MERCHANT.priceGrowth)));
  });

  it('Tome of Haste: +10% attack speed for the run, one a visit', () => {
    const g = atCaravan(false);
    const spd = g.player.stats.atkSpd;
    expect(applyChoice(g, { c: 'merchantBook', book: 'haste' })).toBe(true);
    expect(g.player.stats.atkSpd).toBeCloseTo(spd * 1.1);
    expect(g.gold).toBe(1000 - MERCHANT.books.haste.cost);
    expect(applyChoice(g, { c: 'merchantBook', book: 'haste' })).toBe(false);
    expect(merchantBuy(g, 'common')).toBe(false); // no relic on a book visit
  });

  it('Tome of Fortune: the next level-up offers only epic stat boons, then it is spent', () => {
    const g = atCaravan(false);
    expect(applyChoice(g, { c: 'merchantBook', book: 'fortune' })).toBe(true);
    leaveMerchant(g);
    g.pendingMerchant = false;
    g.pendingLevelUps = 2;
    const hand = levelHand(g);
    expect(hand.every((o) => o.kind === 'evolution' || (o.kind === 'stat' && o.rarity === 'epic'))).toBe(true);
    applyChoice(g, { c: 'levelUp', index: 0 });
    expect(g.vars.epicLevelUp).toBe(0);
    expect(rollLevelUpOptions(mulberry32(3), [], null, [], false, true)).toHaveLength(3);
  });

  it('on a relic visit he sells one relic and no books', () => {
    const g = atCaravan(true);
    expect(applyChoice(g, { c: 'merchantBook', book: 'haste' })).toBe(false);
    expect(merchantBuy(g, 'common')).toBe(true);
    g.player.relics.offers = [];
    expect(merchantBuy(g, 'common')).toBe(false);
  });

  it('the end-of-Act Merchant sells no books', () => {
    const g = atCaravan(false);
    g.midMerchant = false;
    expect(applyChoice(g, { c: 'merchantBook', book: 'haste' })).toBe(false);
  });
});
