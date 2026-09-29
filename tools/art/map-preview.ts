/**
 * #188: renders the map painter's previews into docs/review/0.9.0/.   npm run art:map
 * The sample world (map.ts SAMPLE_WORLD: the Marches, the seven realms and the Last Bastion; ring 3 and up sealed) and a swatch
 * per terrain.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { png } from './png';
import { paintMap, paintRealm, type RealmLayout, SAMPLE_WORLD, type Terrain, TERRAINS, toPng, trail } from './map';

const dir = 'docs/review/0.9.0';
mkdirSync(dir, { recursive: true });
writeFileSync(`${dir}/188-world-map.png`, toPng(paintMap(SAMPLE_WORLD)));

// Swatches: each terrain on its own 240 x 150 tile, three to a row.
const TW = 240, TH = 150, cols = 3, rows = Math.ceil(TERRAINS.length / cols);
const W = TW * cols, H = TH * rows, out = new Uint8Array(W * H * 4);
const names: Record<Terrain, string> = { marches: 'Marches', steel: 'Steel', flame: 'Flame', grave: 'Grave', frost: 'Frost', storm: 'Storm', holy: 'Holy', blood: 'Blood', bastion: 'Bastion' };
TERRAINS.forEach((t, i) => {
  const rect: RealmLayout['rect'] = [0, 0, TW, TH];
  const p = paintRealm({ terrain: t, name: names[t], rect, points: t === 'bastion' ? [{ x: 120, y: 118, n: 1, castle: true }] : trail(rect, 3, [3, 1, 0]) }, 188 + i);
  const ox = (i % cols) * TW, oy = Math.floor(i / cols) * TH;
  for (let y = 0; y < TH; y++) out.set(p.rgba.subarray(y * TW * 4, (y + 1) * TW * 4), ((oy + y) * W + ox) * 4);
});
writeFileSync(`${dir}/188-map-swatches.png`, png(W, H, out));
console.log(`${dir}/188-world-map.png, ${dir}/188-map-swatches.png`);
