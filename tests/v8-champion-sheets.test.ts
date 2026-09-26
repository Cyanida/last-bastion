import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CLASSES } from '../src/config/classes';
import { pickFrame, type AnimInput, type SheetData } from '../src/logic/animation';

describe('#156 champion sheets', () => {
  const calm: AnimInput = { time: 0, walked: 0, moving: false, sinceHit: Infinity, untilHit: Infinity, attackCd: 1, cast: Infinity, skill: Infinity, hurt: Infinity, dead: Infinity };

  it('every champion has a rigged sheet with idle, walk, attack, cast, hurt, death and skill, in that row order', () => {
    for (const c of Object.values(CLASSES)) {
      const d = JSON.parse(readFileSync(`src/render/sheets/${c.sprite}.json`, 'utf8')) as SheetData;
      expect(Object.keys(d.anims), c.id).toEqual(['idle', 'walk', 'attack', 'cast', 'hurt', 'death', 'skill']);
      expect(d.impact, c.id).toBeGreaterThan(0);
      expect(d.impact, c.id).toBeLessThan(d.anims.attack.length);
    }
  });

  it('the cast plays when the ability is used, outranks a swing, then gives way', () => {
    const d = JSON.parse(readFileSync('src/render/sheets/viking.json', 'utf8')) as SheetData;
    const at = (s: Partial<AnimInput>) => pickFrame(d, { ...calm, ...s }, 100);
    expect(at({ cast: 0 })).toEqual({ anim: 'cast', frame: 0 });
    expect(at({ cast: 0.3, sinceHit: 0 })).toEqual({ anim: 'cast', frame: 2 });
    expect(at({ cast: 0.3, dead: 0 }).anim).toBe('death');
    expect(at({ cast: 5 }).anim).toBe('idle');
  });
});
