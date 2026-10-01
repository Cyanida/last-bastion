import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pickFrame, type AnimInput, type SheetData } from '../src/logic/animation';
import { RAMPS, type Material } from '../tools/art/rig';
import { sprite } from '../tools/art/sprites/paladin';

// #245: the Paladin redrawn as a holy warrior; the look only, so his size, impact frame and every number of his class stay
// the pixels of a frame in a material's own tones (a white glint shared with another ramp doesn't count)
const colours = (frame: Map<number, string>, mat: Material) => {
  const shared = new Set<string>(Object.entries(RAMPS).flatMap(([m, r]) => (m === mat ? [] : [...r])));
  const ramp = new Set<string>(RAMPS[mat].filter((c) => !shared.has(c)));
  return [...frame.values()].filter((c) => ramp.has(c)).length;
};
const at = (anim: keyof typeof sprite.anims, i: number) => sprite.anims[anim]![i][1].render();

describe('#245 the Paladin redesign', () => {
  it('wears silver-white plate, gold and blue: no grey steel and no red cross or cape left', () => {
    const idle = at('idle', 0);
    expect(colours(idle, 'plate')).toBeGreaterThan(200);
    expect(colours(idle, 'gold')).toBeGreaterThan(40);
    expect(colours(idle, 'blue')).toBeGreaterThan(40);
    expect(colours(idle, 'steel')).toBe(0);
    for (const row of Object.values(sprite.anims)) for (const [, fig] of row) expect(colours(fig.render(), 'red')).toBe(0);
  });

  it('his blade blazes white-hot on the cast (Divine Shield), not when he stands', () => {
    expect(colours(at('cast', 2), 'blaze')).toBeGreaterThan(20);
    expect(colours(at('idle', 0), 'blaze')).toBe(0);
  });

  it('keeps his size and impact frame; hurt is a three-frame block that plays through, the cast blazes about a second', () => {
    const d = JSON.parse(readFileSync('src/render/sheets/paladin.json', 'utf8')) as SheetData;
    expect([d.tall, d.impact, sprite.tall, sprite.impact]).toEqual([55, 4, 55, 4]);
    const calm: AnimInput = { time: 0, walked: 0, moving: false, sinceHit: Infinity, untilHit: Infinity, attackCd: 1, cast: Infinity, skill: Infinity, hurt: Infinity, dead: Infinity };
    expect(d.anims.hurt).toHaveLength(3);
    expect(pickFrame(d, { ...calm, hurt: 0.05 }, 60)).toEqual({ anim: 'hurt', frame: 0 });
    expect(pickFrame(d, { ...calm, hurt: 0.3 }, 60)).toEqual({ anim: 'hurt', frame: 2 });
    const cast = d.anims.cast!.reduce((a, b) => a + b, 0);
    expect(cast).toBeGreaterThanOrEqual(900);
    expect(cast).toBeLessThanOrEqual(1200);
  });

  it('no other sprite wears his plate or his blaze, so a foe never looks like him', () => {
    const others = readdirSync('tools/art/sprites').filter((f) => f.endsWith('.ts') && f !== 'paladin.ts');
    expect(others.length).toBeGreaterThan(5);
    for (const f of others) expect(readFileSync(`tools/art/sprites/${f}`, 'utf8'), f).not.toMatch(/'(plate|blaze)'/);
  });
});
