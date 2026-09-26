/** #155: a sprite definition becomes one PNG sheet (a row per animation, a column per frame) plus its frame data. */
import type { AnimName, SheetData } from '../../src/logic/animation';
import { readdirSync } from 'node:fs';
import { png } from './png';
import type { Figure } from './rig';

export type Frame = [ms: number, frame: Figure, fade?: number];

/** 4x4 Bayer thresholds: a dither fade drops the same pixels at every size and every run. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

export interface SpriteDef {
  id: string;
  w: number; // cell size
  h: number;
  anchor: [number, number]; // the ground point between the feet, in the cell
  tall: number; // figure height in art pixels (1 art pixel = 1 world pixel)
  // rows in this order; `fade` (0..1, #156): that share of the frame's pixels left out in an ordered dither, for the Angel's Blink
  anims: Record<Exclude<AnimName, 'skill'>, Frame[]> & { skill?: Frame[] };
  impact: number; // attack frame where the weapon connects
}

export function buildSheet(def: SpriteDef): { png: Buffer; data: SheetData } {
  const rows = Object.values(def.anims);
  const cols = Math.max(...rows.map((r) => r.length));
  const W = cols * def.w, H = rows.length * def.h;
  const px = new Uint8Array(W * H * 4);
  rows.forEach((row, ry) =>
    row.forEach(([, fig, fade = 0], cx) => {
      for (const [q, c] of fig.render()) {
        const x = q % def.w, y = (q - x) / def.w;
        if ((BAYER[(y % 4) * 4 + (x % 4)] + 0.5) / 16 < fade) continue;
        px.set([1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)).concat(255), ((ry * def.h + y) * W + cx * def.w + x) * 4);
      }
    }),
  );
  const anims = Object.fromEntries(Object.entries(def.anims).map(([k, r]) => [k, r.map(([ms]) => ms)])) as SheetData['anims'];
  return { png: png(W, H, px), data: { w: def.w, h: def.h, anchor: def.anchor, tall: def.tall, anims, impact: def.impact } };
}

export const SPRITE_DIR = 'tools/art/sprites';
export const sheetPaths = (id: string) => ({ png: `public/sprites/${id}.png`, json: `src/render/sheets/${id}.json` });
export const sheetJson = (data: object) => JSON.stringify(data) + '\n';

export async function loadDefs(): Promise<SpriteDef[]> {
  const files = readdirSync(SPRITE_DIR).filter((f) => f.endsWith('.ts')).sort();
  return Promise.all(files.map(async (f) => ((await import(`./sprites/${f}`)) as { sprite: SpriteDef }).sprite));
}

