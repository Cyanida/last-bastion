import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ARENAS } from '../src/config/arenas';
import { FEATURES } from '../src/config/regions';
import { FEATURE_PROPS, propFrame } from '../src/render/arena';
import PROPS from '../src/render/props.json';
import { buildProps, propPaths } from '../tools/art/props';
import { sheetJson } from '../tools/art/sheet';

describe('#159 arena props', () => {
  it('the committed atlas matches its definitions (run `npm run art` when this fails)', () => {
    const { png, data } = buildProps();
    expect(Buffer.compare(png, readFileSync(propPaths.png)) === 0, `${propPaths.png} is out of date`).toBe(true);
    expect(readFileSync(propPaths.json, 'utf8').replace(/\r\n/g, '\n')).toBe(sheetJson(data));
  });

  it('every obstacle in every arena has a prop', () => {
    for (const a of Object.values(ARENAS)) for (const o of a.obstacles) expect(PROPS[o.kind], `${a.id}: ${o.kind}`).toBeDefined();
  });

  it('the brazier flame loops through its frames', () => {
    const seen = new Set(Array.from({ length: 16 }, (_, i) => propFrame('brazier', i / 16)));
    expect(seen.size).toBe(PROPS.brazier.frames);
    expect(propFrame('brazier', 0)).toBe(propFrame('brazier', PROPS.brazier.frames / 8));
    expect(propFrame('pillar', 3.7)).toBe(0);
  });

  it('every wing feature and every hazard telegraph has a prop', () => {
    for (const k of Object.keys(FEATURES) as (keyof typeof FEATURES)[]) expect(PROPS[FEATURE_PROPS[k]], k).toBeDefined();
    expect(PROPS.hand.frames).toBe(3); // the hand claws up in three steps
    expect(PROPS.flare.frames).toBe(4);
  });
});
