import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pickFrame, type AnimInput, type SheetData } from '../src/logic/animation';
import { RAMPS, type Figure, type Material } from '../tools/art/rig';
import { sprite } from '../tools/art/sprites/angel';

// #268: the Angel redrawn as a fighting angel; the look only, so her size, impact frame and every number of her class stay
// the pixels of a frame in a material's own tones (a white glint shared with another ramp doesn't count)
const colours = (frame: Map<number, string>, mat: Material) => {
  const shared = new Set<string>(Object.entries(RAMPS).flatMap(([m, r]) => (m === mat ? [] : [...r])));
  const ramp = new Set<string>(RAMPS[mat].filter((c) => !shared.has(c)));
  return [...frame.values()].filter((c) => ramp.has(c)).length;
};
// a frame on the sheet's cell, which grows past the drawing's canvas so the raised staff and the rising orb aren't cut off (#167)
const sheet = JSON.parse(readFileSync('src/render/sheets/angel.json', 'utf8')) as SheetData;
const [dx, dy] = [sheet.anchor[0] - sprite.anchor[0], sheet.anchor[1] - sprite.anchor[1]];
const cell = (fig: Figure) => fig.moved(dx, dy, sheet.w, sheet.h).render();
const at = (anim: keyof typeof sprite.anims, i: number) => cell(sprite.anims[anim]![i][1]);
// her lowest pixel that isn't a feather (a wing folded down over her may reach lower than her feet)
const lowest = (frame: Map<number, string>) => {
  const pearl = new Set<string>(RAMPS.angelPearl);
  return Math.max(...[...frame].filter(([, c]) => !pearl.has(c)).map(([q]) => Math.floor(q / sheet.w)));
};

describe('#268 the Angel redesign', () => {
  it('wears white linen and gold, with great pearl wings and fair skin', () => {
    const idle = at('idle', 0);
    expect(colours(idle, 'angelLinen')).toBeGreaterThan(150);
    expect(colours(idle, 'angelPearl')).toBeGreaterThan(300); // the wings: bigger than her robe
    expect(colours(idle, 'gold')).toBeGreaterThan(60);
    expect(colours(idle, 'angelSkin')).toBeGreaterThan(10);
  });

  it('always flies: in every idle, walk, attack, cast and hurt frame her feet hang clear of the ground', () => {
    const ground = sheet.anchor[1];
    for (const anim of ['idle', 'walk', 'attack', 'cast', 'hurt'] as const)
      for (let i = 0; i < sprite.anims[anim]!.length; i++) expect(ground - lowest(at(anim, i)), `${anim} ${i}`).toBeGreaterThanOrEqual(3);
  });

  it('her cast bursts into a star of light; her death ascends to nothing; Blink ends on her whole self', () => {
    expect(colours(at('cast', 3), 'glow')).toBeGreaterThan(colours(at('cast', 0), 'glow') + 40);
    const death = sprite.anims.death!;
    expect(cell(death[death.length - 1][1]).size).toBe(0);
    const blink = sprite.anims.skill!;
    expect(cell(blink[0][1]).size).toBeLessThan(80); // a spark
    expect(colours(cell(blink[blink.length - 1][1]), 'angelPearl')).toBeGreaterThan(300);
  });

  it('keeps her size and impact frame; hurt is a three-frame parry that plays through', () => {
    const d = sheet;
    expect([d.tall, d.impact, sprite.tall, sprite.impact]).toEqual([54, 4, 54, 4]);
    const calm: AnimInput = { time: 0, walked: 0, moving: false, sinceHit: Infinity, untilHit: Infinity, attackCd: 1, cast: Infinity, skill: Infinity, hurt: Infinity, dead: Infinity };
    expect(d.anims.hurt).toHaveLength(3);
    expect(pickFrame(d, { ...calm, hurt: 0.02 }, 60)).toEqual({ anim: 'hurt', frame: 0 });
    expect(pickFrame(d, { ...calm, hurt: 0.22 }, 60)).toEqual({ anim: 'hurt', frame: 2 });
    for (const anim of ['idle', 'walk', 'attack', 'cast', 'hurt', 'death', 'skill'] as const) expect(d.anims[anim]?.length, anim).toBeGreaterThan(0);
  });

  it('no other sprite wears her linen, pearl or skin, so a foe never looks like her', () => {
    const others = readdirSync('tools/art/sprites').filter((f) => f.endsWith('.ts') && f !== 'angel.ts');
    expect(others.length).toBeGreaterThan(5);
    for (const f of others) expect(readFileSync(`tools/art/sprites/${f}`, 'utf8'), f).not.toMatch(/'angel(Linen|Pearl|Skin)'/);
  });
});
