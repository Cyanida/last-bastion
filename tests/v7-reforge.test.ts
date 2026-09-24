import { describe, expect, it } from 'vitest';
import { RELIC_MAX_TIER, relicDef, type RelicId } from '../src/config/relics';
import type { Game } from '../src/core/types';
import { createGame } from '../src/game';
import { merchantPrice } from '../src/logic/acts';
import { halfAttunement, relicStream } from '../src/logic/relics';
import { merchantReforge, reforgeChoices } from '../src/systems/acts';
import { addRelic } from '../src/systems/relics';

/** A game at the Merchant after Act I, holding `held` (id -> [tier, bar]), with gold to spend. */
function atMerchant(held: Partial<Record<RelicId, [number, number]>>, seed = 3): Game {
  const g = createGame('paladin', seed);
  g.gold = 1000;
  for (const [id, [tier, bar]] of Object.entries(held) as [RelicId, [number, number]][]) {
    addRelic(g, id, 'boss', tier);
    g.player.relics.attune[id] = bar;
  }
  return g;
}

describe('Merchant Reforge (v0.7.1 B7)', () => {
  it('keeps half the attunement: half of (tier - 1 + bar), carried over as tier plus bar', () => {
    expect(halfAttunement(1, 0)).toEqual({ tier: 1, attune: 0 });
    expect(halfAttunement(1, 0.6)).toEqual({ tier: 1, attune: 0.3 });
    expect(halfAttunement(2, 0)).toEqual({ tier: 1, attune: 0.5 });
    expect(halfAttunement(2, 0.5)).toEqual({ tier: 1, attune: 0.75 });
    expect(halfAttunement(2, 0.9).tier).toBe(1);
    expect(halfAttunement(RELIC_MAX_TIER, 0)).toEqual({ tier: 2, attune: 0 }); // awakened: tier II with an empty bar
    expect(halfAttunement(RELIC_MAX_TIER, 0.7)).toEqual({ tier: 2, attune: 0 }); // an awakened relic's bar no longer counts
  });

  it('swaps for another relic of the same family that is not held, at half the attunement, for its price', () => {
    const g = atMerchant({ brimstoneOil: [2, 0.5], emberheart: [1, 0], frostBrand: [1, 0.2] });
    const choices = reforgeChoices(g, 'brimstoneOil');
    expect(choices.length).toBeGreaterThan(0);
    for (const id of choices) {
      expect(relicDef(id).family).toBe('flame');
      expect(['brimstoneOil', 'emberheart']).not.toContain(id);
    }
    const gold = g.gold;
    expect(merchantReforge(g, 'brimstoneOil')).toBe(true);
    const r = g.player.relics;
    const next = r.held.at(-1)!;
    expect(r.held).not.toContain('brimstoneOil');
    expect(choices).toContain(next);
    expect(r.tiers[next]).toBe(1);
    expect(r.attune[next]).toBeCloseTo(0.75);
    expect(r.from[next]).toBe('merchant');
    expect(g.gold).toBe(gold - merchantPrice('reforge', g.act));
    expect(r.held).toHaveLength(3); // a swap: the family count stays
  });

  it('draws from the player\'s relic stream: the same stream reforges the same way', () => {
    const pick = (streamSeed: number) => {
      const g = atMerchant({ everfrostCrown: [3, 0] });
      g.player.relics.rng = relicStream(streamSeed, 0);
      g.rng = () => 0.5; // the run's own randomness plays no part
      merchantReforge(g, 'everfrostCrown');
      return { next: g.player.relics.held[0], tier: g.player.relics.tiers[g.player.relics.held[0]] };
    };
    expect(pick(11)).toEqual(pick(11));
    expect(pick(11).tier).toBe(2);
    const seen = new Set(Array.from({ length: 12 }, (_, i) => pick(i).next));
    expect(seen.size).toBeGreaterThan(1);
  });

  it('refuses without gold, without another relic of the family to become, or for a cursed relic (no family)', () => {
    const poor = atMerchant({ brimstoneOil: [1, 0] });
    poor.gold = 0;
    expect(merchantReforge(poor, 'brimstoneOil')).toBe(false);
    expect(poor.player.relics.held).toEqual(['brimstoneOil']);
    const cursed = atMerchant({ doomBell: [2, 0] });
    expect(reforgeChoices(cursed, 'doomBell')).toEqual([]);
    expect(merchantReforge(cursed, 'doomBell')).toBe(false);
    expect(cursed.gold).toBe(1000);
    const full = atMerchant({ brimstoneOil: [1, 0] });
    full.player.relics.pool = ['brimstoneOil'];
    expect(merchantReforge(full, 'brimstoneOil')).toBe(false);
    expect(merchantReforge(atMerchant({}), 'brimstoneOil')).toBe(false); // not held
  });
});
