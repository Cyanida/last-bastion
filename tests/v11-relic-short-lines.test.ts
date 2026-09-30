import { describe, expect, it } from 'vitest';
import { DUO_IDS, RELIC_IDS } from '../src/config/relics';
import { RELIC_SHORT, RELIC_SHORT_MAX } from '../src/config/relicShort';

// #235: a card shows one short line per relic; the full text lives in the compendium
describe('v0.11 relic short lines (#235)', () => {
  it('every relic and duo has a short line of at most 90 characters, one sentence-ish line', () => {
    for (const id of [...RELIC_IDS, ...DUO_IDS]) {
      const s = RELIC_SHORT[id];
      expect(s, id).toBeTruthy();
      expect(s.length, `${id}: "${s}"`).toBeLessThanOrEqual(RELIC_SHORT_MAX);
      expect(s, id).not.toContain('\n');
      expect(s.split(/\s+/).length, `${id}: about 12 words`).toBeLessThanOrEqual(14);
    }
    expect(RELIC_SHORT_MAX).toBe(90);
  });

  it('has no line for a relic that does not exist', () => {
    const known = new Set<string>([...RELIC_IDS, ...DUO_IDS]);
    expect(Object.keys(RELIC_SHORT).filter((k) => !known.has(k))).toEqual([]);
  });
});
