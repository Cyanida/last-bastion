import { describe, expect, it } from 'vitest';
import { RELIC_IDS, RELIC_MOMENTS, type RelicId } from '../src/config/relics';
import { mulberry32 } from '../src/core/math';
import { createGame } from '../src/game';
import { relicStream, rollOffer } from '../src/logic/relics';
import { rollLevelUpOptions } from '../src/logic/upgrades';
import { killEnemy } from '../src/systems/combat';
import { offerRelics, rerollRelicOffer, resolveRelicOffer, skipRelicOffer, skipReward } from '../src/systems/relics';
import { spawnEnemy } from '../src/systems/spawning';

// families come in A3; the rule is generic, so a made-up split of the current relics tests it
const FAM = Object.fromEntries(RELIC_IDS.map((id, i) => [id, ['flame', 'frost', 'storm'][i % 3]])) as Record<RelicId, string>;
const familyOf = (id: RelicId) => FAM[id];

describe('relic offers (v0.7)', () => {
  it('once a family is held, every offer has one relic from a held family and one from another', () => {
    const pool = [...RELIC_IDS];
    const held: RelicId[] = [pool.find((id) => FAM[id] === 'flame')!];
    const rng = mulberry32(3);
    for (let i = 0; i < 200; i++) {
      const offer = rollOffer(pool, held, { [held[0]]: 3 }, rng, 3, familyOf, 2);
      expect(new Set(offer).size).toBe(3);
      expect(offer.some((id) => FAM[id] === 'flame')).toBe(true);
      expect(offer.some((id) => FAM[id] !== 'flame')).toBe(true);
      expect(offer).not.toContain(held[0]); // at the top tier: never offered again
    }
  });

  it('leans toward held families, and nothing held means no rule', () => {
    const pool = [...RELIC_IDS];
    const held = pool.filter((id) => FAM[id] === 'frost').slice(0, 1);
    const count = (lean: number) => {
      const rng = mulberry32(9);
      let frost = 0;
      for (let i = 0; i < 400; i++) frost += rollOffer(pool, held, { [held[0]]: 3 }, rng, 3, familyOf, lean).filter((id) => FAM[id] === 'frost').length;
      return frost;
    };
    expect(count(4)).toBeGreaterThan(count(1));
    expect(rollOffer(pool, [], {}, mulberry32(1), 3, familyOf, 2)).toHaveLength(3);
  });

  it('the same seed gives the same offers, whatever else draws on the run\'s randomness', () => {
    const offers = (burn: number) => {
      const g = createGame('archer', 424242);
      for (let i = 0; i < burn; i++) g.rng(); // combat, spawns, drops...
      offerRelics(g, 3, 'boss');
      rerollRelicOffer(g);
      offerRelics(g, 3, 'lair');
      return g.player.relics.offers.map((o) => o.options);
    };
    expect(offers(0)).toEqual(offers(0));
    expect(offers(500)).toEqual(offers(0));
    const a = relicStream(7, 0);
    const b = relicStream(7, 1); // a second player has a stream of their own
    expect([a(), a(), a()]).not.toEqual([b(), b(), b()]);
  });
});

describe('relic moments (v0.7)', () => {
  it('a moment: pick one of three, one reroll, or skip it for gold and a Rune shard', () => {
    const g = createGame('paladin', 5);
    offerRelics(g, 3, 'boss');
    const offer = g.player.relics.offers[0];
    expect(offer).toMatchObject({ from: 'boss', rerolls: RELIC_MOMENTS.rerolls });
    const first = [...offer.options];
    expect(rerollRelicOffer(g)).toBe(true);
    expect(offer.options).not.toEqual(first);
    expect(rerollRelicOffer(g)).toBe(false); // out of rerolls
    expect(resolveRelicOffer(g, RELIC_IDS.find((id) => !offer.options.includes(id))!)).toBe(false); // only an offered relic
    const gold = g.gold;
    const shards = g.salvage;
    expect(skipRelicOffer(g)).toBe(true);
    expect(g.gold).toBe(gold + skipReward(g).gold);
    expect(g.salvage).toBe(shards + RELIC_MOMENTS.skip.shards);
    expect(g.player.relics.offers).toHaveLength(0);
  });

  it('Cursed Luck and the Elite path add rerolls', () => {
    const lucky = createGame('viking', 1, { trait: 'cursedLuck' });
    offerRelics(lucky, 3, 'boss');
    expect(lucky.player.relics.offers[0].rerolls).toBe(RELIC_MOMENTS.rerolls + 1);
  });

  it('wave bosses are moments; elites, side bosses and the Usurper are not, and level-ups offer no relics', () => {
    const g = createGame('paladin', 2);
    const boss = spawnEnemy(g, 'blackKnight', 300, 300);
    killEnemy(g, boss);
    expect(g.player.relics.offers).toHaveLength(1);
    const side = spawnEnemy(g, 'blackKnight', 300, 300);
    side.side = true;
    killEnemy(g, side);
    const elite = spawnEnemy(g, 'peasant', 300, 300, ['swift']);
    killEnemy(g, elite);
    expect(g.player.relics.offers).toHaveLength(1);
    expect(g.pickups.some((k) => (k.kind as string) === 'relic')).toBe(false);
    const rng = mulberry32(1);
    for (let i = 0; i < 200; i++) expect(rollLevelUpOptions(rng, [], null).some((o) => o.kind === 'relic')).toBe(false);
  });
});
