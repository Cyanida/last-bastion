import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BUILDINGS, KEEP_BANNERS, META } from '../src/config/economy';
import { keepStage } from '../src/logic/keep';
import { buildKeep, keepPaths } from '../tools/art/ui/keep';

describe('#67 the Keep as a castle', () => {
  it('a building grows with its level and flies a banner per share of its ranks bought', () => {
    expect(keepStage({}, {}, 'armory')).toEqual({ level: 0, banners: 0, frame: 0 });
    const ups = BUILDINGS.chapel.upgrades;
    const all = Object.fromEntries(ups.map((u) => [u, META[u].max]));
    expect(keepStage({ chapel: 3 }, all, 'chapel')).toEqual({ level: 3, banners: KEEP_BANNERS.length, frame: 3 * 4 + 3 });
    expect(keepStage({ chapel: 1 }, { [ups[0]]: 1 }, 'chapel').banners).toBeLessThan(KEEP_BANNERS.length);
    // ranks past a track's max and levels past the top don't draw a stage that isn't in the atlas
    expect(keepStage({ chapel: 9 }, { ...all, [ups[0]]: 99 }, 'chapel').frame).toBe(15);
    // another building's ranks don't count
    expect(keepStage({}, all, 'armory').banners).toBe(0);
  });

  it('the committed castle art is up to date', { timeout: 60000 }, () => {
    const k = buildKeep();
    expect(Buffer.compare(k.castle, readFileSync(keepPaths.castle)) === 0, `${keepPaths.castle} is out of date: npm run art`).toBe(true);
    expect(Buffer.compare(k.yard, readFileSync(keepPaths.yard)) === 0, `${keepPaths.yard} is out of date: npm run art`).toBe(true);
    expect(readFileSync(keepPaths.css, 'utf8').replace(/\r\n/g, '\n')).toBe(k.css);
  });
});
