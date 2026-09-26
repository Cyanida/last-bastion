/** #155: a sprite definition becomes one PNG sheet (a row per animation, a column per frame) plus its frame data. */
import type { BaseAnim, SheetData } from '../../src/logic/animation';
import { readdirSync } from 'node:fs';
import { png } from './png';
import type { Figure } from './rig';

export interface SpriteDef {
  id: string;
  w: number; // cell size
  h: number;
  anchor: [number, number]; // the ground point between the feet, in the cell
  tall: number; // figure height in art pixels (1 art pixel = 1 world pixel)
  anims: Record<BaseAnim, [ms: number, frame: Figure][]> & { special?: [ms: number, frame: Figure][] }; // rows in this order
  impact: number; // attack frame where the weapon connects
  specialImpact?: number; // #158 bosses: special frame shown when the telegraph fires
}

export function buildSheet(def: SpriteDef): { png: Buffer; data: SheetData } {
  const rows = Object.values(def.anims);
  const cols = Math.max(...rows.map((r) => r.length));
  const W = cols * def.w, H = rows.length * def.h;
  const px = new Uint8Array(W * H * 4);
  rows.forEach((row, ry) =>
    row.forEach(([, fig], cx) => {
      for (const [q, c] of fig.render()) {
        const x = q % def.w, y = (q - x) / def.w;
        px.set([1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)).concat(255), ((ry * def.h + y) * W + cx * def.w + x) * 4);
      }
    }),
  );
  const anims = Object.fromEntries(Object.entries(def.anims).map(([k, r]) => [k, r.map(([ms]) => ms)])) as SheetData['anims'];
  return { png: png(W, H, px), data: { w: def.w, h: def.h, anchor: def.anchor, tall: def.tall, anims, impact: def.impact, ...(def.specialImpact !== undefined && { specialImpact: def.specialImpact }) } };
}

export const SPRITE_DIR = 'tools/art/sprites';
export const sheetPaths = (id: string) => ({ png: `public/sprites/${id}.png`, json: `src/render/sheets/${id}.json` });
export const sheetJson = (data: object) => JSON.stringify(data) + '\n';

export async function loadDefs(): Promise<SpriteDef[]> {
  const files = readdirSync(SPRITE_DIR).filter((f) => f.endsWith('.ts')).sort();
  return Promise.all(files.map(async (f) => ((await import(`./sprites/${f}`)) as { sprite: SpriteDef }).sprite));
}

