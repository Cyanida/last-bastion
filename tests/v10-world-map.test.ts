import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { REALM_IDS, REALMS } from '../src/config/world';
import { mapRealms, recordClear, saveWorldProgress } from '../src/logic/world';
import { buildWorld, worldPaths } from '../tools/art/ui/world';

describe('#198 the world map', () => {
  it('a save without world progress opens only the Marches; the rest sit under clouds', () => {
    const realms = mapRealms(saveWorldProgress({}));
    expect(realms.map((r) => r.id)).toEqual(REALM_IDS);
    expect(realms.filter((r) => r.open).map((r) => r.id)).toEqual(['marches']);
  });

  it('the Marches crown opens ring 2', () => {
    const p = REALMS.marches.levels.reduce((q, _, i) => recordClear(q, 'marches', i + 1, 0), saveWorldProgress({}));
    expect(mapRealms(saveWorldProgress({ world: p })).filter((r) => r.open).map((r) => r.id)).toEqual(['marches', 'ironHold', 'barrowvale', 'cinderlands']);
  });

  it('the committed map art is up to date, with clouds and a hit area for every realm', { timeout: 120000 }, () => {
    const w = buildWorld();
    expect(Buffer.compare(w.map, readFileSync(worldPaths.map)) === 0, `${worldPaths.map} is out of date: npm run art`).toBe(true);
    expect(Buffer.compare(w.clouds, readFileSync(worldPaths.clouds)) === 0, `${worldPaths.clouds} is out of date: npm run art`).toBe(true);
    expect(readFileSync(worldPaths.css, 'utf8').replace(/\r\n/g, '\n')).toBe(w.css);
    for (const id of REALM_IDS) expect(w.css).toContain(`.wm-cloud.r-${id} `), expect(w.css).toContain(`.wm-realm.r-${id} `);
  });
});
