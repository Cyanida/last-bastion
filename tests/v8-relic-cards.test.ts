import { describe, expect, it } from 'vitest';
import { CURSED_IDS, FAMILIES, RELIC_IDS, relicDef } from '../src/config/relics';
import { relicCardLine } from '../src/logic/relics';

// #98: a relic offer card shows its effect and one compact line; the rest is in its tooltip
describe('relic offer card line', () => {
  const steel = RELIC_IDS.find((id) => relicDef(id).family === 'steel')!;
  const none = { upgrade: false, duo: false, evolution: false };

  it('shows the family count it raises, and marks a set bonus it reaches', () => {
    expect(relicCardLine(steel, 0, none)).toBe(`${FAMILIES.steel.icon} Steel 0 → 1`);
    expect(relicCardLine(steel, 1, none)).toBe(`${FAMILIES.steel.icon} Steel 1 → 2 ★ set bonus`);
  });

  it('an upgrade leaves the family count as it is', () => {
    expect(relicCardLine(steel, 2, { ...none, upgrade: true })).toBe(`${FAMILIES.steel.icon} Steel 2`);
  });

  it('marks a duo and an evolution, and stays one line', () => {
    const line = relicCardLine(steel, 3, { upgrade: false, duo: true, evolution: true });
    expect(line).toBe(`${FAMILIES.steel.icon} Steel 3 → 4 ★ set bonus · ✦ duo · ✦ evolution`);
    expect(line).not.toContain('\n');
  });

  it('a cursed relic has no family', () => {
    expect(relicCardLine(CURSED_IDS[0], 0, none)).toBe('☠ no family');
  });
});
