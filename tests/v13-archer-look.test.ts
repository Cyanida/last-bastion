import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pickFrame, type AnimInput, type SheetData } from '../src/logic/animation';
import { RAMPS, type Material } from '../tools/art/rig';
import { sprite } from '../tools/art/sprites/archer';

// #270: the Archer redrawn as a hooded woodland ranger; the look only, so his size, impact frame and every number of his class stay
// the pixels of a frame in a material's own tones (a colour shared with another ramp doesn't count)
const colours = (frame: Map<number, string>, mat: Material) => {
  const shared = new Set<string>(Object.entries(RAMPS).flatMap(([m, r]) => (m === mat ? [] : [...r])));
  const ramp = new Set<string>(RAMPS[mat].filter((c) => !shared.has(c)));
  return [...frame.values()].filter((c) => ramp.has(c)).length;
};
const at = (anim: keyof typeof sprite.anims, i: number) => sprite.anims[anim]![i][1].render();
const rows = (frame: Map<number, string>) => [...frame.keys()].map((q) => Math.floor(q / sprite.w));

describe('#270 the Archer redesign', () => {
  it('wears a moss-green hood and cloak over a hide tunic, a bark bow, and no steel kettle hat', () => {
    const idle = at('idle', 0);
    expect(colours(idle, 'moss')).toBeGreaterThan(300);
    expect(colours(idle, 'hide')).toBeGreaterThan(200);
    expect(colours(idle, 'bark')).toBeGreaterThan(10);
    expect(colours(idle, 'steel')).toBeLessThan(10); // the buckle; the old kettle hat was dozens
  });

  it('the cloak moves as cloth: no two idle frames, and no two walk frames, are the same', () => {
    for (const anim of ['idle', 'walk'] as const) {
      const keys = sprite.anims[anim]!.map(([, f]) => JSON.stringify([...f.render()]));
      expect(new Set(keys).size, anim).toBe(keys.length);
    }
  });

  it('Arrow Volley looses three arrows that fly up, and the death ends lying on the ground', () => {
    const drawn = at('cast', 1), loosed = at('cast', 3);
    expect(Math.min(...rows(loosed))).toBeLessThan(Math.min(...rows(drawn))); // the arrows rise above the drawn bow
    const stand = Math.min(...rows(at('idle', 0))), lying = Math.min(...rows(at('death', 4)));
    expect(lying - stand).toBeGreaterThan(25);
  });

  it('keeps his size and impact frame; hurt, the volley and the roll play their new frames', () => {
    const d = JSON.parse(readFileSync('src/render/sheets/archer.json', 'utf8')) as SheetData;
    expect([d.tall, d.impact, sprite.tall, sprite.impact]).toEqual([54, 4, 54, 4]);
    expect([d.anims.attack, d.anims.cast, d.anims.hurt, d.anims.death, d.anims.skill].map((a) => a!.length)).toEqual([6, 5, 3, 5, 5]);
    const calm: AnimInput = { time: 0, walked: 0, moving: false, sinceHit: Infinity, untilHit: Infinity, attackCd: 1, cast: Infinity, skill: Infinity, hurt: Infinity, dead: Infinity };
    expect(pickFrame(d, { ...calm, hurt: 0.03 }, 60)).toEqual({ anim: 'hurt', frame: 0 });
    expect(pickFrame(d, { ...calm, hurt: 0.22 }, 60)).toEqual({ anim: 'hurt', frame: 2 });
    expect(pickFrame(d, { ...calm, skill: 0.01 }, 60)).toEqual({ anim: 'skill', frame: 0 });
    expect(pickFrame(d, { ...calm, skill: 0.43 }, 60)).toEqual({ anim: 'skill', frame: 4 });
  });
});
