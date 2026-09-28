/** #155: a sprite definition becomes one PNG sheet (a row per animation, a column per frame) plus its frame data. */
import type { BaseAnim, SheetData } from '../../src/logic/animation';
import { readdirSync } from 'node:fs';
import { png } from './png';
import type { Figure } from './rig';

export type Frame = [ms: number, frame: Figure, fade?: number];

/** 4x4 Bayer thresholds: a dither fade drops the same pixels at every size and every run. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

export interface SpriteDef {
  id: string;
  w: number; // cell size: the sheet grows it where a pose reaches past it (#167)
  h: number;
  anchor: [number, number]; // the ground point between the feet, in the cell
  tall: number; // figure height in art pixels (1 art pixel = 1 world pixel)
  // rows in this order; `fade` (0..1, #156): that share of the frame's pixels left out in an ordered dither, for the Angel's Blink
  anims: Record<BaseAnim, Frame[]> & { cast?: Frame[]; skill?: Frame[]; special?: Frame[]; phase?: Frame[] };
  impact: number; // attack frame where the weapon connects
  specialImpact?: number; // #158 bosses: special frame shown when the telegraph fires
}

/** #167: room rendered around a cell to find how far its frames reach past it; a frame reaching past this throws. */
const REACH = 64;

/**
 * #167: renders frames drawn for a w x h cell, growing the cell on each side until no pixel touches its edge (1 px clear), so a
 * wide swing, a fallen body or a burst of fire is never cut off. The anchor moves with the grown cell; the frames come back as
 * pixel index (y * w + x) -> colour in it.
 */
export function fitCell(id: string, figs: Figure[], w: number, h: number, anchor: [number, number]): { w: number; h: number; anchor: [number, number]; frames: Map<number, string>[] } {
  const bw = w + 2 * REACH, bh = h + 2 * REACH;
  const big = figs.map((fig) => fig.moved(REACH, REACH, bw, bh).render());
  let x0 = REACH + 1, y0 = REACH + 1, x1 = REACH + w - 2, y1 = REACH + h - 2;
  for (const px of big)
    for (const q of px.keys()) {
      const x = q % bw, y = (q - x) / bw;
      if (x === 0 || y === 0 || x === bw - 1 || y === bh - 1) throw new Error(`${id}: a frame reaches more than ${REACH} px past its cell`);
      (x0 = Math.min(x0, x)), (y0 = Math.min(y0, y)), (x1 = Math.max(x1, x)), (y1 = Math.max(y1, y));
    }
  const cw = x1 - x0 + 3, ch = y1 - y0 + 3, dx = 1 - x0, dy = 1 - y0; // big canvas -> grown cell
  const at = (q: number) => (Math.floor(q / bw) + dy) * cw + (q % bw) + dx;
  const frames = big.map((px) => new Map([...px].map(([q, c]) => [at(q), c] as const)));
  return { w: cw, h: ch, anchor: [anchor[0] + dx + REACH, anchor[1] + dy + REACH], frames };
}

export function buildSheet(def: SpriteDef): { png: Buffer; data: SheetData } {
  const rows = Object.values(def.anims);
  const fit = fitCell(def.id, rows.flat().map(([, fig]) => fig), def.w, def.h, def.anchor);
  const { w, h } = fit;
  const cols = Math.max(...rows.map((r) => r.length));
  const W = cols * w, H = rows.length * h;
  const px = new Uint8Array(W * H * 4);
  let i = 0;
  rows.forEach((row, ry) =>
    row.forEach(([, , fade = 0], cx) => {
      for (const [q, c] of fit.frames[i++]) {
        const x = q % w, y = (q - x) / w;
        if ((BAYER[(y % 4) * 4 + (x % 4)] + 0.5) / 16 < fade) continue;
        px.set([1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)).concat(255), ((ry * h + y) * W + cx * w + x) * 4);
      }
    }),
  );
  const anims = Object.fromEntries(Object.entries(def.anims).map(([k, r]) => [k, r.map(([ms]) => ms)])) as SheetData['anims'];
  return { png: png(W, H, px), data: { w, h, anchor: fit.anchor, tall: def.tall, anims, impact: def.impact, ...(def.specialImpact !== undefined && { specialImpact: def.specialImpact }) } };
}

export const SPRITE_DIR = 'tools/art/sprites';
export const sheetPaths = (id: string) => ({ png: `public/sprites/${id}.png`, json: `src/render/sheets/${id}.json` });
export const sheetJson = (data: object) => JSON.stringify(data) + '\n';

export async function loadDefs(): Promise<SpriteDef[]> {
  const files = readdirSync(SPRITE_DIR).filter((f) => f.endsWith('.ts')).sort();
  return Promise.all(files.map(async (f) => ((await import(`./sprites/${f}`)) as { sprite: SpriteDef }).sprite));
}

