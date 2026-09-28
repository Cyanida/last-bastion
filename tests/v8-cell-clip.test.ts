import { readdirSync, readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import type { SheetData } from '../src/logic/animation';

/** The alpha of every pixel of a PNG written by tools/art/png.ts (8-bit RGBA, one IDAT, filter 0 on every row). */
function alpha(path: string): { w: number; h: number; a: (x: number, y: number) => number } {
  const b = readFileSync(path);
  const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
  let i = 8, idat = Buffer.alloc(0);
  while (i < b.length) {
    const n = b.readUInt32BE(i), type = b.toString('ascii', i + 4, i + 8);
    if (type === 'IDAT') idat = Buffer.concat([idat, b.subarray(i + 8, i + 8 + n)]);
    i += n + 12;
  }
  const raw = inflateSync(idat);
  return { w, h, a: (x, y) => raw[y * (w * 4 + 1) + 1 + x * 4 + 3] };
}

/** Cells (x, y, w, h) with an opaque pixel on their border: a pose that reached past its cell and was cut off there. */
function clipped(path: string, cells: [number, number, number, number][]): string[] {
  const img = alpha(path), out: string[] = [];
  for (const [x0, y0, w, h] of cells) {
    let hit = false;
    for (let x = 0; x < w && !hit; x++) hit = !!(img.a(x0 + x, y0) || img.a(x0 + x, y0 + h - 1));
    for (let y = 0; y < h && !hit; y++) hit = !!(img.a(x0, y0 + y) || img.a(x0 + w - 1, y0 + y));
    if (hit) out.push(`${x0},${y0}`);
  }
  return out;
}

describe('#167 no frame is cut off at its sheet cell', () => {
  const ids = readdirSync('src/render/sheets').filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));

  it.each(ids)('%s: no opaque pixel touches a cell border', (id) => {
    const d = JSON.parse(readFileSync(`src/render/sheets/${id}.json`, 'utf8')) as SheetData;
    const cells = Object.values(d.anims).flatMap((row, r) => row!.map((_, c): [number, number, number, number] => [c * d.w, r * d.h, d.w, d.h]));
    expect(clipped(`public/sprites/${id}.png`, cells)).toEqual([]);
  });

  it('the props too', () => {
    const props = JSON.parse(readFileSync('src/render/props.json', 'utf8')) as Record<string, { x: number; y: number; w: number; h: number; frames: number }>;
    const cells = Object.values(props).flatMap((p) => Array.from({ length: p.frames }, (_, i): [number, number, number, number] => [p.x + i * p.w, p.y, p.w, p.h]));
    expect(clipped('public/sprites/props.png', cells)).toEqual([]);
  });
});
