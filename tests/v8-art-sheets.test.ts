import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pickFrame, type AnimInput, type SheetData } from '../src/logic/animation';
import { Bone, ik, limb } from '../tools/art/rig';
import { buildSheet, loadDefs, sheetJson, sheetPaths } from '../tools/art/sheet';

const defs = await loadDefs(); // #157: rendered per sprite below

describe('#155 art rig', () => {
  it('ik reaches its target and bends the joint forward; limb() aims local +y; local() inverts at()', () => {
    const j = ik([0, 0], [0, 20], 10.5, 10.5, 1);
    expect(j[0]).toBeGreaterThan(0);
    expect(Math.hypot(...j)).toBeCloseTo(10.5, 6);
    expect(Math.hypot(j[0], j[1] - 20)).toBeCloseTo(10.5, 6);
    const b = limb([3, 4], [10, 9]);
    expect(b.at(0, Math.hypot(7, 5))[0]).toBeCloseTo(10, 6);
    const [lx, ly] = b.local(...b.at(2, -3));
    expect(lx).toBeCloseTo(2, 9);
    expect(ly).toBeCloseTo(-3, 9);
    expect(new Bone(1, 2).child(3, 4).at(0, 0)).toEqual([4, 6]);
  });

  // #157: one test per sprite, each with room to render twice: two dozen sheets overrun one test's time on a busy machine
  it('has sheets to check', () => expect(defs.length).toBeGreaterThan(0));
  it.each(defs.map((d) => [d.id, d] as const))('the committed %s sheet matches its definition (run `npm run art` when this fails)', (_, def) => {
    const { png, data } = buildSheet(def);
    const p = sheetPaths(def.id);
    expect(existsSync(p.png), `${p.png} missing`).toBe(true);
    expect(Buffer.compare(png, readFileSync(p.png)) === 0, `${p.png} is out of date`).toBe(true);
    expect(readFileSync(p.json, 'utf8').replace(/\r\n/g, '\n')).toBe(sheetJson(data));
    expect(buildSheet(def).png.equals(png)).toBe(true); // deterministic
  }, 60_000);
});

describe('#155 animation state', () => {
  const d = JSON.parse(readFileSync('src/render/sheets/paladin.json', 'utf8')) as SheetData;
  const calm: AnimInput = { time: 0, walked: 0, moving: false, sinceHit: Infinity, untilHit: Infinity, attackCd: 1, cast: Infinity, skill: Infinity, hurt: Infinity, dead: Infinity };
  const at = (s: Partial<AnimInput>) => pickFrame(d, { ...calm, ...s }, 100);

  it('idles, and walks with the feet following the ground covered', () => {
    expect(at({ time: 0.25 })).toEqual({ anim: 'idle', frame: 1 });
    expect(at({ moving: true, walked: 0 })).toEqual({ anim: 'walk', frame: 0 });
    expect(at({ moving: true, walked: 30 })).toEqual({ anim: 'walk', frame: 3 }); // 80 px a cycle at base speed 100
  });

  it('shows the impact frame the moment the attack lands, winds up before it, recovers after', () => {
    expect(at({ sinceHit: 0 })).toEqual({ anim: 'attack', frame: d.impact });
    expect(at({ sinceHit: 0.2 })).toEqual({ anim: 'attack', frame: d.impact + 1 });
    expect(at({ sinceHit: 0.5 }).anim).toBe('idle');
    expect(at({ untilHit: 0.03 })).toEqual({ anim: 'attack', frame: d.impact - 1 });
    expect(at({ untilHit: 0.2 })).toEqual({ anim: 'attack', frame: 1 });
    // squeezed into a fast attack speed: still the impact frame on the hit
    expect(at({ attackCd: 0.25, sinceHit: 0 })).toEqual({ anim: 'attack', frame: d.impact });
    expect(at({ attackCd: 0.25, sinceHit: 0.1 })).toEqual({ anim: 'attack', frame: d.impact }); // #156: the short swing holds it
  });

  it('hurt and death hold their last frame', () => {
    expect(at({ hurt: 0 })).toEqual({ anim: 'hurt', frame: 0 });
    expect(at({ dead: 5 })).toEqual({ anim: 'death', frame: d.anims.death.length - 1 });
  });
});
