import { describe, expect, it } from 'vitest';
import { META } from '../src/config/economy';
import { createGame } from '../src/game';
import { relicDef } from '../src/config/relics';
import { levelUpOptions, banishOption } from '../src/systems/leveling';
import { legacyRefund, migrate, SAVE_VERSION } from '../src/logic/save';

/** A v0.5 save (version 4) with ranks v0.6 took away: all of Strength, the top two of HP, the second Veteran Levies. */
const V4 = { version: 4, gold: 100, runes: 5, meta: { str: 5, hp: 5, startLevel: 2, rerolls: 1 } };

describe('the Keep rework migration (v0.6)', () => {
  it('refunds exactly what the removed and trimmed ranks cost at v0.5 prices', () => {
    // Strength ranks 1-5: 65+104+166+266+426; HP ranks 4-5: 266+426; Levies rank 2: 1600. Runes from rank 4 up (HP, Str), rank 2 (Levies).
    expect(legacyRefund(V4.meta)).toEqual({ gold: 1027 + 692 + 1600, runes: 2 + 2 + 2 });
    expect(legacyRefund({ hp: 3, moveSpd: 2, startLevel: 1 })).toEqual({ gold: 0, runes: 0 }); // ranks that survive cost nothing back
    expect(legacyRefund({ str: 99 })).toEqual(legacyRefund({ str: 5 })); // a hand-edited rank refunds no more than the cap
  });

  it('caps ranks, drops the removed tracks and records the refund once', () => {
    const s = migrate(V4);
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.meta).toEqual({ hp: META.hp.max, startLevel: 1, rerolls: 1 });
    expect(s.gold).toBe(100 + 3319);
    expect(s.runes).toBe(5 + 6);
    expect(s.refund).toEqual({ gold: 3319, runes: 6 });
  });

  it('migrating a migrated save changes nothing (no second refund)', () => {
    const once = migrate(V4);
    const twice = migrate(JSON.parse(JSON.stringify(once)));
    expect(twice).toEqual(once);
    expect(migrate({ ...once, refund: null }).refund).toBeNull();
  });

  it('a v0.5 save with nothing to refund gets no notice', () => {
    expect(migrate({ version: 4, gold: 10, meta: { hp: 2 } }).refund).toBeNull();
  });
});

describe('the Armory sidegrades (v0.6)', () => {
  it('Second Banner: two starting traits, and only with the rank', () => {
    const two = createGame('viking', 1, { meta: { traitSlot: 1 }, trait: 'stalwart', trait2: 'pilgrim' });
    expect([two.trait, two.trait2]).toEqual(['stalwart', 'pilgrim']);
    const one = createGame('viking', 1, { trait: 'stalwart', trait2: 'pilgrim' });
    expect([one.trait, one.trait2]).toEqual(['stalwart', 'none']);
  });

  it("Armorer's Choice: the run opens on three common relics", () => {
    const g = createGame('archer', 3, { meta: { startRelic: 1 } });
    expect(g.player.relics.offers).toHaveLength(1);
    expect(g.player.relics.offers[0]).toMatchObject({ from: 'start' });
    expect(g.player.relics.offers[0].options).toHaveLength(3);
    expect(g.player.relics.offers[0].options.every((id) => relicDef(id).rarity === 'common')).toBe(true);
    expect(createGame('archer', 3).player.relics.offers).toHaveLength(0);
  });

  it("Quartermaster's Ledger: a banished card never comes back, and banishes run out", () => {
    const g = createGame('paladin', 5, { meta: { banish: 2 } });
    expect(g.banishes).toBe(2);
    expect(banishOption(g, { kind: 'stat', key: 'str', rarity: 'common' })).toBe(true);
    expect(banishOption(g, { kind: 'talent' })).toBe(true);
    expect(banishOption(g, { kind: 'stat', key: 'dex', rarity: 'common' })).toBe(false); // none left
    for (let i = 0; i < 300; i++) {
      for (const o of levelUpOptions(g)) {
        expect(o.kind === 'stat' && o.key === 'str').toBe(false);
        expect(o.kind).not.toBe('talent');
      }
    }
    const r = createGame('paladin', 5, { meta: { banish: 1 } });
    const id = r.player.relics.pool[0];
    banishOption(r, { kind: 'relic', id });
    expect(r.player.relics.pool).not.toContain(id);
  });
});
