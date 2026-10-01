import { describe, expect, it } from 'vitest';
import { REALMS } from '../src/config/world';
import { levelName, placeName } from '../src/logic/acts';

describe('a realm run speaks of levels, not Acts (#265)', () => {
  it('names a realm level "Level N of M", M from the realm', () => {
    expect(levelName('ironHold', 2)).toBe(`Level 2 of ${REALMS.ironHold.levels.length}`);
    expect(levelName('marches', 3)).toBe(`Level 3 of ${REALMS.marches.levels.length}`);
    expect(placeName(2, { realm: 'ironHold', level: 4 })).toBe('Level 4 of 5');
  });
  it('keeps Acts for a run outside a realm', () => {
    expect(placeName(1, null)).toBe('Act I');
    expect(placeName(4, undefined)).toBe('Act IV');
  });
});
