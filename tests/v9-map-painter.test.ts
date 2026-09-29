import { describe, expect, it } from 'vitest';
import { type LevelPoint, paintMap, paintRealm, type Painted, type RealmLayout, SAMPLE_WORLD, type Terrain, TERRAINS, trail } from '../tools/art/map';

const tile = (terrain: Terrain, points: LevelPoint[] = trail([0, 0, 160, 110], 3, [2, 1, 0])): RealmLayout => ({ terrain, name: terrain, rect: [0, 0, 160, 110], points });

/** Every road pixel reachable from (x, y) through 4-connected road pixels. */
function reach(p: Painted, x: number, y: number): Uint8Array {
  const seen = new Uint8Array(p.w * p.h), stack = [y * p.w + x];
  while (stack.length) {
    const q = stack.pop()!;
    if (seen[q] || !p.road[q]) continue;
    seen[q] = 1;
    const qx = q % p.w;
    if (qx > 0) stack.push(q - 1);
    if (qx < p.w - 1) stack.push(q + 1);
    if (q >= p.w) stack.push(q - p.w);
    if (q < p.w * (p.h - 1)) stack.push(q + p.w);
  }
  return seen;
}

describe('#188 map painter', () => {
  it('the same layout and seed give the same pixels; another seed does not', () => {
    const a = paintRealm(tile('marches'), 7), b = paintRealm(tile('marches'), 7), c = paintRealm(tile('marches'), 8);
    expect(Buffer.compare(Buffer.from(a.rgba), Buffer.from(b.rgba))).toBe(0);
    expect(Buffer.compare(Buffer.from(a.rgba), Buffer.from(c.rgba))).not.toBe(0);
  });

  it('every terrain paints the whole tile, each in its own colours', () => {
    const looks = TERRAINS.map((t) => {
      const p = paintRealm(tile(t), 188);
      for (let i = 3; i < p.rgba.length; i += 4) expect(p.rgba[i], `${t}: a pixel left blank`).toBe(255);
      const counts = new Map<number, number>();
      for (let i = 0; i < p.rgba.length; i += 4) {
        const c = (p.rgba[i] << 16) | (p.rgba[i + 1] << 8) | p.rgba[i + 2];
        counts.set(c, (counts.get(c) ?? 0) + 1);
      }
      return [...counts].sort((x, y) => y[1] - x[1])[0][0]; // its most common colour
    });
    expect(new Set(looks).size).toBe(TERRAINS.length);
  });

  it('roads connect the given points, in a realm and across the world', () => {
    const pts: LevelPoint[] = [{ x: 20, y: 90, n: 1 }, { x: 60, y: 30, n: 2 }, { x: 110, y: 85, n: 3 }, { x: 145, y: 25, n: 4 }];
    const p = paintRealm(tile('frost', pts), 3);
    const seen = reach(p, pts[0].x, pts[0].y);
    for (const q of pts) expect(seen[q.y * p.w + q.x], `point ${q.n}`).toBe(1);

    const world = paintMap(SAMPLE_WORLD), start = SAMPLE_WORLD.realms[0].points[0];
    const all = reach(world, start.x, start.y);
    for (const rl of SAMPLE_WORLD.realms) for (const q of rl.points) expect(all[q.y * world.w + q.x], `${rl.name} ${q.n}`).toBe(1);
  });

  it('a sealed realm is under clouds, an open one is not', () => {
    const ground = (sealed: boolean) => paintRealm({ ...tile('holy'), name: '', sealed }, 5);
    const open = ground(false), shut = ground(true);
    const y = 100, row = (p: Painted) => Buffer.from(p.rgba.subarray(y * p.w * 4, (y + 1) * p.w * 4));
    expect(Buffer.compare(row(open), row(shut))).not.toBe(0);
  });
});
