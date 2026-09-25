import { describe, expect, it } from 'vitest';
import { EVENTS } from '../src/config/events';
import { MERCHANT } from '../src/config/acts';
import { createGame, updateGame } from '../src/game';
import { rollEvent } from '../src/logic/quests';
import { applyChoice, levelRerolls } from '../src/sim/commands';
import { peddlerBuy, peddlerToken, peddlerTokenPrice } from '../src/systems/events';
import { takeQuests } from '../src/systems/quests';

const DT = 1 / 60;

function atPeddler() {
  let seed = 1;
  while (rollEvent(seed, 3) !== 'peddler') seed++;
  const g = createGame('paladin', seed);
  takeQuests(g, []);
  g.wave = 2;
  g.breather = DT / 2;
  updateGame(g, DT);
  expect(g.event?.kind).toBe('peddler');
  return g;
}

describe('#128: the wandering merchant sells a reroll token, worth buying at full health', () => {
  it('costs its base price in Act I and rises with the Merchant per Act', () => {
    const g = atPeddler();
    expect(peddlerTokenPrice(g)).toBe(EVENTS.peddler.token);
    g.act = 3;
    expect(peddlerTokenPrice(g)).toBe(Math.round(EVENTS.peddler.token * (1 + MERCHANT.priceGrowth * 2)));
  });

  it('at full health: one more free reroll on the next level-up screen, and it is cleared when that screen is answered', () => {
    const g = atPeddler();
    g.player.hp = g.player.stats.hp;
    g.gold = 0;
    expect(peddlerToken(g)).toBe(false);
    g.gold = 500;
    expect(peddlerBuy(g)).toBe(false); // the draught does nothing at full health
    expect(peddlerToken(g)).toBe(true);
    expect(g.gold).toBe(500 - peddlerTokenPrice(g));
    expect(g.merchantSpent).toBe(peddlerTokenPrice(g));
    expect(g.event!.stock).toBe(0);
    expect(peddlerToken(g)).toBe(false); // one sale a visit
    expect(levelRerolls(g).free).toBe(g.rerolls + 1);
    g.pendingLevelUps = 1;
    expect(applyChoice(g, { c: 'levelUp', index: 0 })).toBe(true);
    expect(levelRerolls(g).free).toBe(g.rerolls); // the next screen is back to usual
  });
});
