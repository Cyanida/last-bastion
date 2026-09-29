import { describe, expect, it } from 'vitest';
import { FAMILY_IDS, RELIC_IDS, relicDef } from '../src/config/relics';
import { relicRarity } from '../src/ui/relicText';
import * as kit from '../src/ui/kit';

describe('#187 the compendium in the kit', () => {
  it('every relic has a rarity frame: a champion’s own is class green, the rest their rarity', () => {
    for (const id of RELIC_IDS) {
      const r = relicDef(id);
      expect(relicRarity(id)).toBe(r.signature ? 'signature' : r.classId ? 'class' : r.rarity); // #201: a signature relic is gold
    }
    expect(RELIC_IDS.some((id) => relicRarity(id) === 'class')).toBe(true);
  });

  it('a glyph sits in the same frame as an atlas icon', () => {
    expect(kit.rarityGlyph('legendary', '🐉')).toBe('<span class="kit-rarity legendary"><b class="kit-glyph">🐉</b></span>');
    expect(kit.rarityIcon('rare', 'frost')).toBe('<span class="kit-rarity rare"><i class="kit-icon i-frost"></i></span>');
  });

  it('every family heading has its atlas icon', () => {
    for (const f of FAMILY_IDS) expect(kit.ICON_IDS).toContain(f);
  });
});
