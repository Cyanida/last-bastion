import { describe, expect, it } from 'vitest';
import { BEST_WAVE_LABEL, wavesText } from '../src/logic/best-wave';

// #254: the results' best-wave line counts waves played in one level, and says so, next to the realm's "Reached ... wave 22".
describe('best wave label', () => {
  it('says it counts one level, not the realm wave', () => {
    expect(BEST_WAVE_LABEL).toMatch(/one level/);
    expect(wavesText(6)).toBe('6 waves');
    expect(wavesText(1)).toBe('1 wave');
  });
});
