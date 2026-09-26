import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CLASSES } from '../src/config/classes';
import { GAME } from '../src/config/game';
import { pickFrame, SHORT_SWING, type AnimInput, type SheetData } from '../src/logic/animation';

/** #156, Jesse's feedback: fast attacks play a short swing, and the utility ability has its own frames. */
describe('#156 fast attacks and mobility frames', () => {
  const calm: AnimInput = { time: 0, walked: 0, moving: false, sinceHit: Infinity, untilHit: Infinity, attackCd: 1, cast: Infinity, skill: Infinity, hurt: Infinity, dead: Infinity };
  const sheet = (id: string) => JSON.parse(readFileSync(`src/render/sheets/${id}.json`, 'utf8')) as SheetData;
  const sum = (ms: number[]) => ms.reduce((a, b) => a + b, 0);

  it('at the attack-speed cap every champion skips the wind-up, keeps the swing frame and lands on the impact frame', () => {
    const cd = 1 / GAME.maxAttackRate;
    for (const c of Object.values(CLASSES)) {
      const d = sheet(c.sprite);
      expect(cd * 1000, c.id).toBeLessThan(SHORT_SWING * sum(d.anims.attack)); // the cap is squeezed enough to shorten
      const at = (s: Partial<AnimInput>) => pickFrame(d, { ...calm, attackCd: cd, ...s }, 100);
      expect(at({ sinceHit: 0 }), c.id).toEqual({ anim: 'attack', frame: d.impact });
      // over a whole interval: only the swing frame, impact and recovery show, never the ready or wind-up frames
      const frames = new Set<number>();
      for (let t = 0; t < cd; t += 0.005) {
        const f = at({ sinceHit: t, untilHit: cd - t });
        expect(f.anim, `${c.id} at ${t}`).toBe('attack');
        frames.add(f.frame);
      }
      expect([...frames].sort(), c.id).toEqual([d.impact - 1, d.impact, d.impact + 1].filter((i) => i < d.anims.attack.length));
    }
  });

  it('a slow attack still plays its full wind-up', () => {
    const d = sheet('viking');
    expect(pickFrame(d, { ...calm, attackCd: 1, untilHit: 0.25 }, 100)).toEqual({ anim: 'attack', frame: 1 });
  });

  it('the utility ability plays its own row: no running legs, it outranks walk, swing and cast, and death outranks it', () => {
    for (const c of Object.values(CLASSES)) {
      const d = sheet(c.sprite);
      expect(d.anims.skill?.length, c.id).toBeGreaterThan(1);
      const at = (s: Partial<AnimInput>) => pickFrame(d, { ...calm, moving: true, walked: 30, sinceHit: 0, cast: 0, ...s }, 100);
      expect(at({ skill: 0 }), c.id).toEqual({ anim: 'skill', frame: 0 });
      expect(at({ skill: 0, dead: 0 }).anim, c.id).toBe('death');
      expect(at({ skill: sum(d.anims.skill!) / 1000 }).anim, c.id).toBe('cast');
    }
  });
});
