import { describe, expect, it } from 'vitest';
import { slotBlock, slotView } from '../src/logic/champions';
import { CHAMPION_HELP, SLOT_BLOCK_TEXT } from '../src/config/glossary';
import { WORLD } from '../src/config/world';

describe('champion screen: slots that explain themselves (#239)', () => {
  it('a legendary with one slot free says it takes two; with none free, that no slot is left', () => {
    expect(slotBlock('viking', ['brimstoneOil'], 'dragonsTongue', 2)).toBe('double');
    expect(slotBlock('viking', ['brimstoneOil', 'emberheart'], 'dragonsTongue', 2)).toBe('slots');
    expect(slotBlock('viking', ['brimstoneOil'], 'emberheart', 1)).toBe('slots'); // a common is never 'double'
    expect(SLOT_BLOCK_TEXT.double).toMatch(new RegExp(`takes ${WORLD.loadout.legendarySlots} slots`));
  });

  it('a legendary fills two slots in a row, its second marked, so the screen draws one wide frame', () => {
    const v = slotView('viking', ['brimstoneOil', 'dragonsTongue'], 6);
    expect(v.map((s) => (s.id ? (s.second ? '2' : 'R') : 'o')).join('')).toBe('RR2ooo');
  });

  it('the reasons and the ⓘ texts carry the rule numbers from config', () => {
    const L = WORLD.loadout;
    expect(SLOT_BLOCK_TEXT.family).toContain(String(L.perFamily));
    expect(SLOT_BLOCK_TEXT.classRelics).toContain(String(L.classRelics));
    for (const n of [L.legendarySlots, L.perFamily, L.legendaries, L.legendariesFinale, L.classRelics]) expect(CHAMPION_HELP.slots).toContain(String(n));
    for (const t of Object.values(CHAMPION_HELP)) expect(t.split(/[.!?](\s|$)/).filter((x) => x && x.trim()).length).toBeLessThanOrEqual(2);
  });
});
