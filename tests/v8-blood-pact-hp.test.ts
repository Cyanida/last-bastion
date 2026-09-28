import { describe, expect, it } from 'vitest';
import { relicN } from '../src/config/relics';
import type { Game } from '../src/core/types';
import { createGame } from '../src/game';
import { addRelic, removeRelic, updateRelics } from '../src/systems/relics';

const tick = (g: Game) => {
  g.player.mods = { ...g.baseMods };
  updateRelics(g, 1 / 60);
};

/** Fills a held relic's attunement bar and ticks once, so it tiers up exactly once (systems/relics.ts tierUp). */
const tierUp = (g: Game, id: 'bloodPact' | 'crimsonChalice') => {
  g.player.relics.attune[id] = 1;
  tick(g);
};

const game = (): Game => {
  const g = createGame('paladin', 1);
  g.rng = Object.assign(() => 0.999, { s: 0 });
  return g;
};

describe('Blood Pact + Crimson Chalice max HP (v0.8.3 #174)', () => {
  const bp1 = relicN('bloodPact', 1).hp;
  const bp2 = relicN('bloodPact', 2).hp;
  const cc1 = relicN('crimsonChalice', 1).hp;

  it('both cuts multiply onto the same pool when both are held', () => {
    const base = game().player.stats.hp;
    const g = game();
    addRelic(g, 'bloodPact');
    addRelic(g, 'crimsonChalice');
    expect(g.player.stats.hp).toBeCloseTo(base * bp1 * cc1, 5);
  });

  it('a tier-up on either one lands on the same max HP, whichever tiers up first', () => {
    const base = game().player.stats.hp;

    // Blood Pact tiers up while Crimson Chalice is still held (cursed) at tier I
    const a = game();
    addRelic(a, 'bloodPact');
    addRelic(a, 'crimsonChalice');
    tierUp(a, 'bloodPact'); // II
    expect(a.player.stats.hp, 'Blood Pact II beside Crimson Chalice I').toBeCloseTo(base * bp2 * cc1, 5);
    tierUp(a, 'crimsonChalice'); // II (n2 has no hp: the cut is unchanged)
    tierUp(a, 'crimsonChalice'); // III: awakened, the curse (its HP cut) lifts
    expect(a.player.stats.hp, 'both at their final tier').toBeCloseTo(base * bp2, 5);

    // same end state, reached by awakening Crimson Chalice before Blood Pact ever tiers up
    const b = game();
    addRelic(b, 'crimsonChalice');
    addRelic(b, 'bloodPact');
    tierUp(b, 'crimsonChalice'); // II
    tierUp(b, 'crimsonChalice'); // III: awakened first this time
    tierUp(b, 'bloodPact'); // II
    expect(b.player.stats.hp, 'order of the tier-ups must not change the result').toBeCloseTo(a.player.stats.hp, 5);
  });

  it('selling both after tier-ups gives back exactly the HP they took, round-tripping to the base', () => {
    const base = game().player.stats.hp;
    const g = game();
    addRelic(g, 'bloodPact');
    addRelic(g, 'crimsonChalice');
    tierUp(g, 'bloodPact');
    removeRelic(g, 'crimsonChalice');
    removeRelic(g, 'bloodPact');
    expect(g.player.stats.hp).toBeCloseTo(base, 5);
  });
});
