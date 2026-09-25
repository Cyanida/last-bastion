import { describe, expect, it } from 'vitest';
import { TEXT_SIZES } from '../src/config/game';
import { defaultSave, migrate } from '../src/logic/save';
import { textScale } from '../src/logic/textSize';

describe('text size (v0.8, #123)', () => {
  it('a desktop window gets the chosen size', () => {
    for (const size of ['normal', 'large', 'larger'] as const) expect(textScale(size, 1400, 800)).toBe(TEXT_SIZES[size]);
  });

  it('a phone in landscape caps it so the HUD still fits, but Large still grows', () => {
    const large = textScale('large', 844, 390);
    const larger = textScale('larger', 844, 390);
    expect(large).toBeGreaterThan(1);
    expect(larger).toBeGreaterThanOrEqual(large);
    expect(larger).toBeLessThan(TEXT_SIZES.larger);
    expect(390 / larger).toBeGreaterThanOrEqual(320);
  });

  it('never shrinks below Normal on a tiny window', () => {
    expect(textScale('larger', 500, 280)).toBe(1);
  });

  it('an older save without the setting loads as Normal; a stored one is kept, a bad one dropped', () => {
    const old = JSON.parse(JSON.stringify(defaultSave()));
    delete old.settings.textSize;
    expect(migrate(old).settings.textSize).toBe('normal');
    expect(migrate({ ...old, settings: { ...old.settings, textSize: 'larger' } }).settings.textSize).toBe('larger');
    expect(migrate({ ...old, settings: { ...old.settings, textSize: 'toString' } }).settings.textSize).toBe('normal');
  });
});
