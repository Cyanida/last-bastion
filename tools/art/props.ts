/**
 * #159: the arenas' props (pillars, braziers, tombstones, dead trees, the throne), drawn by the rig like the sprites and rendered
 * by `npm run art` into one atlas: public/sprites/props.png (a row per prop, a column per frame) plus src/render/props.json. The
 * anchor is the obstacle's centre (its collision circle) on the ground; `r` is the radius the prop is drawn for, the game scales
 * it to the obstacle's own. Light from the top left, the same ramps and outlines as the Paladin.
 */
import { Bone, ell, Figure, limb, type Material, type Pt } from './rig';
import { png } from './png';

export interface PropDef {
  id: string;
  w: number;
  h: number;
  anchor: [number, number];
  r: number;
  frames: Figure[]; // more than one: the game loops them (the brazier's flame)
}
export interface PropData {
  x: number; // the prop's row in the atlas
  y: number;
  w: number;
  h: number;
  anchor: [number, number];
  r: number;
  frames: number;
}

const O = new Bone(0, 0);
const rect = (x0: number, y0: number, x1: number, y1: number): Pt[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const dots = (pts: Pt[], mat: Material, tone: number): [number, number, Material, number][] => pts.map(([x, y]) => [x + 0.5, y + 0.5, mat, tone]);

/** A fluted stone column on a plinth; 88 px tall, about 1.6 Paladins. */
function pillar(): Figure {
  const f = new Figure(76, 100);
  f.part(O, rect(6, 72, 70, 90), 'stone', 0, { details: dots([[14, 80], [15, 81], [52, 84], [60, 78]], 'stone', 2) }); // plinth
  f.part(O, ell(38, 72, 32, 8), 'stone', 0.2);
  f.part(O, rect(17, 24, 59, 74), 'stone', 1, { folds: [0.7, 6, 0], details: dots([[24, 50], [25, 51], [25, 52], [26, 53], [48, 36]], 'stone', 1) }); // shaft, with a crack
  f.part(O, rect(11, 14, 65, 28), 'stone', 2); // capital
  f.part(O, ell(38, 14, 27, 6), 'stone', 2.1);
  return f;
}

/** An iron fire bowl on three legs; the flame licks in four frames. */
function brazier(k: number): Figure {
  const f = new Figure(56, 72);
  f.part(O, [[20, 44], [23, 44], [17, 62], [13, 62]], 'darksteel', 0, { dim: 1 });
  f.part(O, [[33, 44], [36, 44], [43, 62], [39, 62]], 'darksteel', 0.1);
  f.part(O, rect(26.5, 46, 29.5, 64), 'darksteel', 0.2);
  f.part(O, [[7, 34], [49, 34], [45, 42], [37, 48], [19, 48], [11, 42]], 'darksteel', 1, { trim: ['gold', 1] }); // bowl
  f.part(O, ell(28, 34, 20, 5), 'red', 1.5, { details: dots([[20, 34], [31, 33], [37, 35]], 'fire', 5) }); // coals
  const t = (i: number) => 22 + 7 * Math.sin((k * Math.PI) / 2 + i * 2.1); // tongue heights
  const flame: Pt[] = [[10, 35], [14, 28], [16, 34 - t(0)], [21, 25], [24, 30], [28, 34 - t(1) - 6], [32, 29], [35, 25], [40, 34 - t(2)], [42, 28], [46, 35], [28, 38]];
  f.part(O, flame, 'fire', 2);
  const core: Pt[] = [[17, 35], [22, 28], [28, 34 - (t(1) + 6) * 0.55], [34, 28], [39, 35], [28, 37]];
  f.part(O, core, 'glow', 2.1, { profile: 'flat', outline: false });
  return f;
}

/** A leaning headstone with a carved cross on a stone footing. */
function tomb(): Figure {
  const f = new Figure(48, 64);
  f.part(O, rect(7, 46, 41, 56), 'stone', 0, { dim: 1 }); // footing
  const top = ell(24, 20, 14, 12, 24).filter(([, y]) => y <= 20);
  f.part(O, [[10, 48], [10, 20], ...top.sort((a, b) => a[0] - b[0]), [38, 20], [38, 48]], 'stone', 1, {
    details: [...dots([[24, 17], [24, 18], [24, 19], [24, 20], [24, 21], [24, 22], [24, 23], [24, 24], [24, 25], [24, 26], [21, 20], [22, 20], [23, 20], [25, 20], [26, 20], [27, 20]], 'stone', 1), ...dots([[14, 38], [15, 39], [15, 40], [34, 30]], 'stone', 2)],
  });
  return f;
}

/** A dead tree: a grooved trunk, roots and bare branches; about 1.7 Paladins tall. */
function tree(): Figure {
  const f = new Figure(120, 120);
  const branch = (a: Pt, b: Pt, w: number, z: number, dim = 0) => {
    const bone = limb(a, b), len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    f.part(bone, [[-w / 2, 0], [w / 2, 0], [w * 0.15, len], [-w * 0.15, len]], 'bark', z, { dim });
  };
  branch([52, 98], [34, 108], 8, 0); // roots
  branch([68, 98], [88, 106], 8, 0);
  branch([60, 100], [62, 112], 7, 0);
  f.part(O, [[49, 102], [71, 102], [67, 80], [65, 58], [66, 40], [56, 40], [55, 60], [52, 80]], 'bark', 1, { folds: [0.9, 3.5, 0] }); // trunk
  branch([58, 44], [30, 16], 7, 0.5, 1); // far branches
  branch([64, 46], [98, 22], 7, 0.5, 1);
  branch([62, 42], [66, 6], 6, 1.5);
  branch([56, 62], [20, 48], 6, 1.6);
  branch([66, 56], [104, 46], 6, 1.6);
  branch([40, 26], [28, 6], 3.5, 0.6, 1); // twigs
  branch([88, 30], [104, 10], 3.5, 0.6, 1);
  branch([30, 52], [16, 32], 3, 1.7);
  branch([92, 49], [112, 34], 3, 1.7);
  return f;
}

/** v0.6: the Usurper's throne: a dark dais, a gilded back with three spikes, red cushions. */
function throne(): Figure {
  const f = new Figure(120, 152);
  f.part(O, rect(3, 91, 117, 146), 'stone', 0, { dim: 2 }); // dais
  f.part(O, rect(14, 132, 106, 150), 'stone', 0.1, { dim: 1 }); // step
  f.part(O, [[25, 34], [34, 14], [43, 34]], 'gold', 0.9);
  f.part(O, [[51, 34], [60, 4], [69, 34]], 'gold', 0.9);
  f.part(O, [[77, 34], [86, 14], [95, 34]], 'gold', 0.9);
  f.part(O, rect(23, 32, 97, 112), 'gold', 1, { details: dots([[60, 39], [59, 40], [61, 40], [60, 41]], 'red', 5) }); // back, a ruby
  f.part(O, rect(36, 46, 84, 104), 'red', 2, { folds: [0.6, 5, 1] }); // back cushion
  f.part(O, rect(27, 98, 93, 120), 'red', 3); // seat
  f.part(O, rect(18, 86, 32, 122), 'gold', 3.5);
  f.part(O, rect(88, 86, 102, 122), 'gold', 3.5);
  return f;
}

export const PROPS: PropDef[] = [
  { id: 'pillar', w: 76, h: 100, anchor: [38, 80], r: 30, frames: [pillar()] },
  { id: 'brazier', w: 56, h: 72, anchor: [28, 54], r: 20, frames: [0, 1, 2, 3].map(brazier) },
  { id: 'tomb', w: 48, h: 64, anchor: [24, 48], r: 18, frames: [tomb()] },
  { id: 'tree', w: 120, h: 120, anchor: [60, 98], r: 26, frames: [tree()] },
  { id: 'throne', w: 120, h: 152, anchor: [60, 100], r: 44, frames: [throne()] },
];

export const propPaths = { png: 'public/sprites/props.png', json: 'src/render/props.json' };

/** The atlas: a row per prop, a column per frame. */
export function buildProps(defs = PROPS): { png: Buffer; data: Record<string, PropData> } {
  const W = Math.max(...defs.map((d) => d.w * d.frames.length)), H = defs.reduce((s, d) => s + d.h, 0);
  const px = new Uint8Array(W * H * 4);
  const data: Record<string, PropData> = {};
  let y0 = 0;
  for (const d of defs) {
    d.frames.forEach((fig, i) => {
      for (const [q, c] of fig.render()) {
        const x = q % d.w, y = (q - x) / d.w;
        px.set([1, 3, 5].map((k) => parseInt(c.slice(k, k + 2), 16)).concat(255), ((y0 + y) * W + i * d.w + x) * 4);
      }
    });
    data[d.id] = { x: 0, y: y0, w: d.w, h: d.h, anchor: d.anchor, r: d.r, frames: d.frames.length };
    y0 += d.h;
  }
  return { png: png(W, H, px), data };
}
