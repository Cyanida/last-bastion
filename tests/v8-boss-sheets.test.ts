import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pickFrame, type AnimInput, type SheetData } from '../src/logic/animation';

describe('#158 boss special animation', () => {
  const d = JSON.parse(readFileSync('src/render/sheets/blackKnight.json', 'utf8')) as SheetData;
  const calm: AnimInput = { time: 0, walked: 0, moving: false, sinceHit: Infinity, untilHit: Infinity, attackCd: 1.3, hurt: Infinity, dead: Infinity };
  const at = (s: Partial<AnimInput>) => pickFrame(d, { ...calm, ...s }, 82);
  const imp = d.specialImpact!;

  it('winds up over the whole telegraph and holds the last wind-up frame until it fires', () => {
    expect(d.anims.special!.length).toBeGreaterThan(imp);
    expect(at({ windup: 0 })).toEqual({ anim: 'special', frame: 0 });
    expect(at({ windup: 0.99 })).toEqual({ anim: 'special', frame: imp - 1 });
    expect(at({ windup: 1.5 })).toEqual({ anim: 'special', frame: imp - 1 });
    expect(at({ windup: 0.5, moving: true }).anim).toBe('special'); // over walking
  });

  it('shows the impact frame the moment it fires, then recovers', () => {
    expect(at({ sinceSpecial: 0 })).toEqual({ anim: 'special', frame: imp });
    const postMs = d.anims.special!.slice(imp).reduce((a, b) => a + b, 0);
    expect(at({ sinceSpecial: postMs / 1000 + 0.01 }).anim).toBe('idle');
    expect(at({ dead: 0, windup: 0.5 }).anim).toBe('death'); // death wins
  });

  it('plays the phase pose through once on entering a new phase, over the special but not over death', () => {
    const ms = d.anims.phase!, total = ms.reduce((a, b) => a + b, 0);
    expect(ms.length).toBeGreaterThan(1);
    expect(at({ sincePhase: 0 })).toEqual({ anim: 'phase', frame: 0 });
    expect(at({ sincePhase: (total - 1) / 1000 })).toEqual({ anim: 'phase', frame: ms.length - 1 });
    expect(at({ sincePhase: 0.1, windup: 0.5 }).anim).toBe('phase');
    expect(at({ sincePhase: total / 1000 + 0.01 }).anim).toBe('idle');
    expect(at({ sincePhase: 0, dead: 0 }).anim).toBe('death');
  });

  it('a sheet without a special row ignores the telegraph', () => {
    const p = JSON.parse(readFileSync('src/render/sheets/paladin.json', 'utf8')) as SheetData;
    expect(pickFrame(p, { ...calm, windup: 0.5 }, 100).anim).toBe('idle');
  });
});
