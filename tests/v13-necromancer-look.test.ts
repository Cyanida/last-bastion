import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pickFrame, type AnimInput, type SheetData } from '../src/logic/animation';
import { RAMPS, type Material } from '../tools/art/rig';
import { sprite } from '../tools/art/sprites/necromancer';

// #269: the Necromancer redrawn as a bone priest; the look only, so his size, impact frame and every number of his class stay
// the pixels of a frame in a material's own tones (a colour shared with another ramp doesn't count)
const colours = (frame: Map<number, string>, mat: Material) => {
  const shared = new Set<string>(Object.entries(RAMPS).flatMap(([m, r]) => (m === mat ? [] : [...r])));
  const ramp = new Set<string>(RAMPS[mat].filter((c) => !shared.has(c)));
  return [...frame.values()].filter((c) => ramp.has(c)).length;
};
const at = (anim: keyof typeof sprite.anims, i: number) => sprite.anims[anim]![i][1].render();
const W = sprite.w;
// the rows a frame's pixels span, top to bottom
const rows = (frame: Map<number, string>) => { const ys = [...frame.keys()].map((k) => Math.floor(k / W)); return [Math.min(...ys), Math.max(...ys)]; };

describe('#269 the Necromancer redesign', () => {
  it('wears black, bone and a sickly green over pale grey skin: the purple is gone from every frame', () => {
    const idle = at('idle', 0);
    expect(colours(idle, 'coal')).toBeGreaterThan(300);
    expect(colours(idle, 'bone')).toBeGreaterThan(60);
    expect(colours(idle, 'pallor')).toBeGreaterThan(15);
    expect(colours(idle, 'necro')).toBeGreaterThan(10);
    for (const row of Object.values(sprite.anims)) for (const [, fig] of row) {
      const f = fig.render();
      for (const m of ['amethyst', 'purple', 'violet', 'shade', 'soulfire'] as const) expect(colours(f, m), m).toBe(0);
    }
  });

  it('Raise Dead lights a circle of green at his feet; his death ends in a heap of empty robes on the ground', () => {
    const feet = (f: Map<number, string>) => [...f].filter(([k, c]) => Math.floor(k / W) >= 70 && RAMPS.necro.includes(c as never)).length;
    expect(feet(at('cast', 3))).toBeGreaterThan(3 * Math.max(1, feet(at('idle', 0))));
    const death = sprite.anims.death!, [top, bottom] = rows(death[death.length - 1][1].render());
    const [standTop] = rows(at('idle', 0));
    expect(bottom - top).toBeLessThan(15); // a heap, not a body
    expect(top).toBeGreaterThan(standTop + 30);
  });

  it('keeps his size and impact frame; his hurt is a three-frame ward that plays through', () => {
    const d = JSON.parse(readFileSync('src/render/sheets/necromancer.json', 'utf8')) as SheetData;
    expect([d.tall, d.impact, sprite.tall, sprite.impact]).toEqual([55, 4, 55, 4]);
    const calm: AnimInput = { time: 0, walked: 0, moving: false, sinceHit: Infinity, untilHit: Infinity, attackCd: 1, cast: Infinity, skill: Infinity, hurt: Infinity, dead: Infinity };
    expect(d.anims.hurt).toHaveLength(3);
    expect(pickFrame(d, { ...calm, hurt: 0.02 }, 60)).toEqual({ anim: 'hurt', frame: 0 });
    expect(pickFrame(d, { ...calm, hurt: 0.22 }, 60)).toEqual({ anim: 'hurt', frame: 2 });
    expect(d.anims.death!.length).toBe(6);
  });

  it('no other sprite has his pale skin, so a foe never looks like him', () => {
    const others = readdirSync('tools/art/sprites').filter((f) => f.endsWith('.ts') && f !== 'necromancer.ts');
    expect(others.length).toBeGreaterThan(5);
    for (const f of others) expect(readFileSync(`tools/art/sprites/${f}`, 'utf8'), f).not.toMatch(/'pallor'/);
  });
});
