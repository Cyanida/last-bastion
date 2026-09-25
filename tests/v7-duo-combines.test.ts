import { describe, expect, it } from 'vitest';
import { CLASSES, type ClassId } from '../src/config/classes';
import { FAMILY_IDS, RELIC_IDS, RELIC_MAX_TIER, RELIC_MOMENTS, type RelicId } from '../src/config/relics';
import { mulberry32 } from '../src/core/math';
import type { Game } from '../src/core/types';
import { createGame } from '../src/game';
import { addWork, duoTier, familySets, joinTiers, looseRelics, relicPoolFor, rollOffer } from '../src/logic/relics';
import { addRelic, familyOf, offerRelics, relicShares, resolveRelicOffer, updateRelics } from '../src/systems/relics';

function game(relics: RelicId[]): Game {
  const g = createGame('paladin', 1);
  g.rng = () => 0.999;
  for (const id of relics) addRelic(g, id);
  return g;
}
const tick = (g: Game) => {
  g.player.mods = { ...g.baseMods };
  updateRelics(g, 1 / 60);
};
const form = (g: Game) => {
  offerRelics(g, 3, 'boss');
  expect(resolveRelicOffer(g, 'wildfire')).toBe(true);
  tick(g);
};

describe('a duo combines its two relics into one (#96)', () => {
  it('the two sources show as the duo; the families keep their counts, the duo adds none', () => {
    const g = game(['emberheart', 'stormPennant', 'frostBrand']);
    form(g);
    const r = g.player.relics;
    expect(looseRelics(r.held, r.duos)).toEqual(['frostBrand']);
    expect(r.sets.flame).toEqual({ count: 1, level: 0 });
    expect(r.sets.storm).toEqual({ count: 1, level: 0 });
    expect(relicShares(g).map((s) => s.id)).toEqual(expect.arrayContaining(['wildfire', 'frostBrand']));
    expect(relicShares(g).map((s) => s.id)).not.toContain('emberheart');
  });

  it('forming takes the higher tier and that tier\'s fuller bar', () => {
    const r = { tiers: { emberheart: 2, stormPennant: 1 }, attune: { emberheart: 0.3, stormPennant: 0.9 } } as Parameters<typeof joinTiers>[0];
    joinTiers(r, 'wildfire');
    expect(r.tiers).toMatchObject({ emberheart: 2, stormPennant: 2 });
    expect(r.attune).toMatchObject({ emberheart: 0.3, stormPennant: 0.3 });
    expect(duoTier(r.tiers, 'wildfire')).toBe(2);
  });

  it('the duo attunes as one relic, up to tier III', () => {
    const g = game(['emberheart', 'stormPennant']);
    form(g);
    const r = g.player.relics;
    for (let tier = 2; tier <= RELIC_MAX_TIER; tier++) {
      r.attune.stormPennant = 1;
      tick(g);
      expect(duoTier(r.tiers, 'wildfire')).toBe(tier);
      expect(r.tiers.emberheart).toBe(tier);
      expect(r.attune.emberheart).toBe(0);
    }
    r.work = {};
    addWork(r, 'wildfire', 0.05); // the duo's own work feeds the relic it made
    expect(r.attune.emberheart ?? 0).toBe(0); // already tier III: no more
  });

  it('a duo\'s own work attunes it', () => {
    const g = game(['emberheart', 'stormPennant']);
    form(g);
    addWork(g.player.relics, 'wildfire', 0.05);
    expect(g.player.relics.attune.emberheart).toBeCloseTo(0.05);
  });

  it('every class can still reach a 6-set with the relics it can find', () => {
    for (const c of Object.keys(CLASSES) as ClassId[]) {
      const sets = familySets(relicPoolFor(c, []));
      expect(FAMILY_IDS.some((f) => sets[f]?.level === 6), c).toBe(true);
    }
  });
});

describe('offers lean toward held families, so a 6-set stays reachable (#96)', () => {
  it('the game\'s lean shows two cards of your family clearly more often than no lean', () => {
    expect(RELIC_MOMENTS.heldFamilyWeight).toBeGreaterThan(1);
    const held = RELIC_IDS.filter((id) => familyOf(id) === 'flame').slice(0, 3);
    const doubles = (lean: number) => { // one held-family card is guaranteed anyway; the lean shows in the second
      const rng = mulberry32(96);
      let n = 0;
      for (let i = 0; i < 2000; i++) if (rollOffer([...RELIC_IDS], held, rng, 3, familyOf, lean).filter((id) => familyOf(id) === 'flame').length >= 2) n++;
      return n;
    };
    expect(doubles(RELIC_MOMENTS.heldFamilyWeight)).toBeGreaterThan(doubles(1) * 1.3);
  });
});
