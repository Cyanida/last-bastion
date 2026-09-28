/**
 * #67: the Keep as a castle courtyard, drawn by the rig like the sprites and icons, and rendered by `npm run art` into
 * public/sprites/keep-yard.png (the courtyard: its curtain wall, gate and cobbles) and public/sprites/keep-castle.png (a row per
 * building in BUILDING_IDS order, a column per stage: level 0..3 times banners 0..3, see keepStage in src/logic/keep.ts), plus
 * src/ui/keep-castle.css. A building grows with its level (a ruin at 0, then walls and a roof, then taller, lit and gilded) and
 * flies a banner for each share of its ranks bought. Same light, ramps and outlines as the Paladin.
 */
import { BUILDING_IDS, KEEP_BANNERS, type BuildingId } from '../../../src/config/economy';
import { Bone, ell, Figure, type Material, type PartOpts, type Pt } from '../rig';
import { png } from '../png';

export const CELL = { w: 80, h: 96, ground: 92 };
export const YARD = { w: 320, h: 200 };
const LEVELS = 4;
const BANNERS = KEEP_BANNERS.length + 1;
const O = new Bone(0, 0);
const rect = (x0: number, y0: number, x1: number, y1: number): Pt[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const dots = (pts: Pt[], mat: Material, tone: number): [number, number, Material, number][] => pts.map(([x, y]) => [x + 0.5, y + 0.5, mat, tone]);
/** Fixed pseudo-random numbers, so the same definition gives the same bytes. */
const hash = (i: number) => {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

type Roof = 'gable' | 'spire' | 'dome' | 'crenel';
interface Plan {
  w: number; // wall width
  h: [number, number, number]; // wall height at levels 1, 2, 3
  wall: Material;
  roof: Roof;
  roofMat: Material;
  /** Its sign: what makes it read as this building at a glance, drawn from level 1. */
  sign: (f: Figure, cx: number, top: number, level: number) => Pt | void; // a new roof point for the top banner
}

const PLANS: Record<BuildingId, Plan> = {
  armory: {
    w: 44, h: [24, 30, 36], wall: 'stone', roof: 'crenel', roofMat: 'stone',
    sign(f, cx, top, level) { // crossed swords over the door, and a smithy chimney that glows once it is raised twice
      for (const s of [-1, 1]) f.part(new Bone(cx, top + 12, s * 0.7), rect(-1, -7, 1, 7), 'steel', 3, { details: dots([[0, -5]], 'steel', 6) });
      f.part(O, rect(cx - 5, top + 12, cx + 5, top + 14), 'gold', 3.1);
      if (level >= 2) {
        f.part(O, rect(cx + 12, top - 12, cx + 18, top), 'stone', -0.5, { dim: 1 });
        f.part(O, ell(cx + 15, top - 13, 2.5, 1.5, 10), 'ember', -0.4, { profile: 'flat' });
      }
    },
  },
  barracks: {
    w: 56, h: [18, 22, 26], wall: 'bark', roof: 'gable', roofMat: 'straw',
    sign(f, cx, top, level) { // a round shield on the wall, and a weapon rack beside the door
      f.part(O, ell(cx - 16, top + 8, 4, 4, 16), 'red', 3, { trim: ['steel', 1], details: dots([[cx - 17, top + 7]], 'gold', 5) });
      if (level >= 2) for (const x of [cx + 14, cx + 17, cx + 20]) f.part(O, rect(x - 0.6, top + 4, x + 0.6, top + 16), 'steel', 3);
    },
  },
  chapel: {
    w: 40, h: [26, 32, 38], wall: 'white', roof: 'gable', roofMat: 'blue',
    sign(f, cx, top, level) { // a rose window, and a bell tower with a gold cross
      f.part(O, ell(cx, top + 8, 4.5, 4.5, 16), level >= 2 ? 'glow' : 'darksteel', 3, { trim: ['gold', 1] });
      const bx = cx + 12, bh = 10 + level * 4;
      f.part(O, rect(bx - 4, top - bh, bx + 4, top + 4), 'white', 2.5);
      f.part(O, [[bx - 5, top - bh], [bx, top - bh - 10], [bx + 5, top - bh]], 'blue', 2.6);
      f.part(O, rect(bx - 0.7, top - bh - 17, bx + 0.7, top - bh - 9), 'gold', 2.7);
      f.part(O, rect(bx - 2.5, top - bh - 15, bx + 2.5, top - bh - 13.5), 'gold', 2.7);
    },
  },
  library: {
    w: 32, h: [32, 40, 48], wall: 'stone', roof: 'spire', roofMat: 'blue',
    sign(f, cx, top, level) { // an open book over the door, more of it lit the higher it stands
      f.part(O, [[cx - 6, top + 13], [cx, top + 15], [cx + 6, top + 13], [cx + 6, top + 18], [cx, top + 20], [cx - 6, top + 18]], 'bone', 3, { details: dots([[cx - 4, top + 15], [cx + 3, top + 15]], 'bone', 2) });
      if (level >= 3) f.part(O, ell(cx, top - 4, 3, 3, 12), 'soul', 3.2, { profile: 'flat' }); // a scholar's lamp in the spire
    },
  },
  treasury: {
    w: 44, h: [20, 24, 28], wall: 'stone', roof: 'dome', roofMat: 'gold',
    sign(f, cx, top, level) { // a coin over the door, and a heap of coins by the wall
      f.part(O, ell(cx, top + 7, 3.5, 3.5, 14), 'gold', 3, { details: dots([[cx - 1, top + 6]], 'gold', 6) });
      if (level >= 2) f.part(O, [[cx + 14, CELL.ground], [cx + 17, CELL.ground - 5], [cx + 21, CELL.ground - 7], [cx + 25, CELL.ground - 4], [cx + 27, CELL.ground]], 'gold', 4, { details: dots([[cx + 19, CELL.ground - 5], [cx + 22, CELL.ground - 6]], 'gold', 6) });
    },
  },
  watchtower: {
    w: 22, h: [40, 52, 62], wall: 'stone', roof: 'crenel', roofMat: 'stone',
    sign(f, cx, top, level) { // a lit brazier on the top, under a pointed roof once it is raised twice
      if (level >= 2) {
        f.part(O, [[cx - 13, top - 4], [cx, top - 18], [cx + 13, top - 4]], 'red', 2.4, { trim: level >= 3 ? ['gold', 1] : undefined });
        f.part(O, ell(cx, top - 1, 3, 2, 10), 'fire', 2.3, { profile: 'flat' });
        return [cx, top - 18];
      } else f.part(O, ell(cx, top - 5, 3, 3, 10), 'fire', 2.3, { profile: 'flat' });
    },
  },
};

/** One building at one level (0: the ruin) with some banners. */
export function building(id: BuildingId, level: number, banners: number): Figure {
  const p = PLANS[id];
  const f = new Figure(CELL.w, CELL.h);
  const G = CELL.ground, cx = CELL.w / 2, x0 = cx - p.w / 2, x1 = cx + p.w / 2;
  const bricks = (top: number) => dots(Array.from({ length: 10 }, (_, i): Pt => [x0 + 2 + Math.floor(hash(i + p.w) * (p.w - 4)), top + 2 + Math.floor(hash(i * 7 + p.w) * (G - top - 4))]), p.wall, 2);
  f.part(O, ell(cx, G, p.w / 2 + 6, 3, 20), 'stone', -2, { dim: 2, outline: false, profile: 'flat' }); // the flagstones it stands on
  if (level === 0) {
    // a ruin: broken walls without a roof, and its stones in the grass
    const h = p.h[0] * 0.8;
    const n = 7;
    const jag = Array.from({ length: n + 1 }, (_, i): Pt => [x0 + (p.w * i) / n, G - h * (0.35 + 0.65 * hash(i + p.w * 3))]);
    f.part(O, [[x0, G], ...jag, [x1, G]], p.wall, 0, { dim: 1, details: bricks(G - h) });
    f.part(O, rect(cx - 4, G - 10, cx + 4, G), 'bark', 0.5, { dim: 3, outline: false }); // the empty doorway
    for (let i = 0; i < 4; i++) f.part(O, ell(x0 - 4 + hash(i + 9) * (p.w + 8), G - 1, 2.5 + hash(i) * 1.5, 1.8, 10), p.wall, 1 + i * 0.01, { dim: 1 });
    return withBanners(f, id, [[x0 + 3, G - h * 0.8], [x1 - 3, G - h * 0.7], [cx, G - h * 0.6]], banners);
  }
  const h = p.h[level - 1], top = G - h;
  f.part(O, rect(x0, top, x1, G), p.wall, 0, { details: bricks(top) });
  // the door, an arch in dark wood with iron bands
  const door: Pt[] = [[cx - 4.5, G], [cx - 4.5, G - 8], ...ell(cx, G - 8, 4.5, 4.5, 16).filter(([, y]) => y < G - 8).sort((a, b) => a[0] - b[0]), [cx + 4.5, G - 8], [cx + 4.5, G]];
  f.part(O, door, 'bark', 1, { details: dots([[cx - 3, G - 6], [cx + 2, G - 6], [cx - 3, G - 3], [cx + 2, G - 3]], 'darksteel', 4) });
  // windows: dark at level 1, lit from level 2, a second row once it stands tall
  const lit: Material = level >= 2 ? 'glow' : 'darksteel';
  const rows = h >= 34 ? [top + 6, top + 18] : [top + 5];
  for (const y of rows) for (const x of [x0 + 5, x1 - 8]) f.part(O, rect(x, y, x + 3, y + 5), lit, 1, { trim: level >= 3 ? ['gold', 0.6] : undefined, profile: 'flat' });
  // the roof
  let peak: Pt = [cx, top];
  if (p.roof === 'gable' || p.roof === 'spire') {
    const rise = p.roof === 'spire' ? p.w * 0.9 : p.w * 0.36;
    f.part(O, [[x0 - 3, top + 1], [cx, top - rise], [x1 + 3, top + 1]], p.roofMat, 2, { folds: [0.5, 3, 0], trim: level >= 3 ? ['gold', 1] : undefined });
    peak = [cx, top - rise];
  } else if (p.roof === 'dome') {
    const r = p.w * 0.36;
    const mat: Material = level >= 2 ? p.roofMat : 'leather';
    f.part(O, [[x0 + 2, top + 1], ...ell(cx, top + 1, r, r * 0.9, 24).filter(([, y]) => y < top + 1).sort((a, b) => a[0] - b[0]), [x1 - 2, top + 1]], mat, 2, { details: dots([[cx - r * 0.4, top - r * 0.5]], mat, 6) });
    peak = [cx, top - r * 0.9];
  } else {
    const n = Math.max(3, Math.round(p.w / 7));
    const merlons: Pt[] = [];
    for (let i = 0; i < n; i++) {
      const a = x0 - 1 + ((p.w + 2) * i) / n, b = a + (p.w + 2) / n * 0.6;
      merlons.push([a, top], [a, top - 5], [b, top - 5], [b, top]);
    }
    f.part(O, [[x0 - 1, top + 3], ...merlons, [x1 + 1, top], [x1 + 1, top + 3]], p.roofMat, 2, { trim: level >= 3 ? ['gold', 1] : undefined });
    peak = [cx, top - 5];
  }
  if (level >= 3 && p.roof !== 'crenel') f.part(O, ell(peak[0], peak[1] - 1, 1.8, 1.8, 10), 'glow', 2.2); // a gilded finial
  peak = p.sign(f, cx, top, level) ?? peak;
  return withBanners(f, id, [peak, [x0, top], [x1, top]], banners);
}

/** Banners on poles at the first `n` of the given roof points: red, with the building's gold stripe. */
function withBanners(f: Figure, id: BuildingId, at: Pt[], n: number): Figure {
  at.slice(0, n).forEach(([x, y], i) => {
    const top = Math.max(2, y - 12);
    f.part(O, rect(x - 0.8, top, x + 0.8, y), 'bark', 5 + i * 0.1);
    const dir = i === 1 ? -1 : 1; // the left corner's flag flies left, off the roof
    f.part(O, [[x, top + 0.5], [x + dir * 8, top + 1.5], [x + dir * 6, top + 3.5], [x + dir * 8, top + 5.5], [x, top + 6]], id === 'chapel' ? 'white' : 'red', 5.05 + i * 0.1, { profile: 'flat', details: dots([[x + dir * 3, top + 3]], 'gold', 5) });
  });
  return f;
}

/** The courtyard: the night falls through where nothing is drawn (the screen's CSS paints the sky). */
export function yard(): Figure {
  const { w, h } = YARD;
  const f = new Figure(w, h);
  const wallTop = 50, wallBot = 84;
  // cobbles and wall blocks are laid one by one: small parts shade as stones, and a big one would take the rig seconds
  const lay = (y0: number, y1: number, bw: number, bh: number, z: number, mat: (x: number, y: number) => [Material, number] | null, o: PartOpts = {}) => {
    for (let y = y0, r = 0; y < y1; y += bh, r++) {
      for (let x = (r % 2) * (-bw / 2); x < w; x += bw) {
        const m = mat(x + bw / 2, y + bh / 2);
        if (m) f.part(O, rect(x + 0.5, y + 0.5, x + bw - 0.5, Math.min(y1, y + bh) - 0.5), m[0], z, { ...o, dim: m[1] });
      }
    }
  };
  // the courtyard's cobbles, lighter on the path from the gate
  const onPath = (x: number, y: number) => Math.abs(x - 160) < 14 + ((y - wallBot) / (h - wallBot)) * 22;
  lay(wallBot, h, 9, 5, 0, (x, y) => ['stone', (onPath(x, y) ? 1 : 2) + Math.round(hash(x * 3 + y) * 0.7)], { profile: 'flat', outline: false });
  for (const [x, y, rx, ry] of [[20, 120, 26, 10], [300, 150, 28, 12], [160, 192, 50, 8], [40, 190, 34, 8], [290, 92, 22, 7]]) f.part(O, ell(x, y, rx, ry, 20), 'green', 0.5, { profile: 'flat', dim: 1 });
  // the curtain wall: blocks with battlements on top
  lay(wallTop, wallBot, 12, 6, 1, () => ['stone', 0]);
  for (let x = 0; x < w; x += 12) f.part(O, rect(x + 0.5, wallTop - 6, x + 7.5, wallTop + 0.5), 'stone', 1.1);
  // the gatehouse, its portcullis and banners
  f.part(O, rect(138, wallTop - 14, 182, wallBot), 'stone', 2, { details: dots([[142, wallTop - 4], [176, wallTop + 6]], 'stone', 2) });
  for (let x = 138; x < 182; x += 11) f.part(O, rect(x, wallTop - 20, x + 6, wallTop - 13), 'stone', 2.1);
  f.part(O, [[148, wallBot], [148, wallTop + 14], ...ell(160, wallTop + 14, 12, 10, 20).filter(([, y]) => y < wallTop + 14).sort((a, b) => a[0] - b[0]), [172, wallTop + 14], [172, wallBot]], 'darksteel', 3, { dim: 2, details: dots([150, 154, 158, 162, 166, 170].flatMap((x) => [[x, wallTop + 16], [x, wallTop + 22], [x, wallTop + 28]] as Pt[]), 'darksteel', 4) });
  for (const x of [131, 189]) f.part(O, [[x - 5, wallTop - 4], [x + 5, wallTop - 4], [x + 5, wallTop + 14], [x, wallTop + 10], [x - 5, wallTop + 14]], 'red', 3, { folds: [0.5, 4, 1], details: dots([[x, wallTop + 2]], 'gold', 5) });
  // a round tower at each corner, with a pointed roof
  for (const x of [18, w - 18]) {
    f.part(O, rect(x - 14, wallTop - 20, x + 14, wallBot + 6), 'stone', 4, { details: dots([[x - 8, wallTop + 6], [x + 5, wallTop + 22]], 'stone', 2) });
    f.part(O, [[x - 17, wallTop - 19], [x, wallTop - 44], [x + 17, wallTop - 19]], 'blue', 4.1, { folds: [0.5, 3, 0] });
    f.part(O, rect(x - 2, wallTop - 8, x + 2, wallTop), 'glow', 4.2, { profile: 'flat' });
  }
  return f;
}

/** Where each building stands in the yard: its middle and its ground line, in the yard's pixels (the back row first, clear of the gate). */
const PLOTS: Record<BuildingId, Pt> = { library: [40, 120], watchtower: [122, 120], chapel: [276, 120], barracks: [60, 184], armory: [160, 184], treasury: [260, 184] };

export const keepPaths = { castle: 'public/sprites/keep-castle.png', yard: 'public/sprites/keep-yard.png', css: 'src/ui/keep-castle.css' };

const paint = (fig: Figure, px: Uint8Array, W: number, ox: number, oy: number) => {
  for (const [q, c] of fig.render()) {
    const x = q % fig.w, y = (q - x) / fig.w;
    px.set([1, 3, 5].map((k) => parseInt(c.slice(k, k + 2), 16)).concat(255), ((oy + y) * W + ox + x) * 4);
  }
};

export function buildKeep(): { castle: Buffer; yard: Buffer; css: string } {
  const cols = LEVELS * BANNERS, W = CELL.w * cols, H = CELL.h * BUILDING_IDS.length;
  const px = new Uint8Array(W * H * 4);
  BUILDING_IDS.forEach((id, row) => {
    for (let level = 0; level < LEVELS; level++) for (let b = 0; b < BANNERS; b++) paint(building(id, level, b), px, W, (level * BANNERS + b) * CELL.w, row * CELL.h);
  });
  const ypx = new Uint8Array(YARD.w * YARD.h * 4);
  paint(yard(), ypx, YARD.w, 0, 0);
  // the building's box is a share of the yard's; the atlas is positioned by percentages, so it scales with the yard
  const css = [
    '/* Generated by `npm run art` from tools/art/ui/keep.ts (#67): do not edit. */',
    `.keep-yard { aspect-ratio: ${YARD.w} / ${YARD.h}; background: url('/sprites/keep-yard.png') center / 100% 100% no-repeat, linear-gradient(#0b1026, #1d2447 40%, #1b1a20 40%); image-rendering: pixelated; }`,
    `.keep-bld { position: absolute; width: ${(CELL.w / YARD.w) * 100}%; height: ${(CELL.h / YARD.h) * 100}%; background: url('/sprites/keep-castle.png') no-repeat; background-size: ${cols * 100}% ${BUILDING_IDS.length * 100}%; background-position: calc(var(--col) * ${100 / (cols - 1)}%) calc(var(--row) * ${100 / (BUILDING_IDS.length - 1)}%); image-rendering: pixelated; }`,
    ...BUILDING_IDS.map((id, i) => {
      const [x, y] = PLOTS[id], pc = (v: number, of: number) => `${+((v / of) * 100).toFixed(3)}%`;
      return `.keep-bld.b-${id} { --row: ${i}; left: ${pc(x - CELL.w / 2, YARD.w)}; top: ${pc(y - CELL.ground, YARD.h)}; z-index: ${y}; }`;
    }),
    ...Array.from({ length: cols }, (_, i) => `.keep-bld.s-${i} { --col: ${i}; }`),
  ].join('\n') + '\n';
  return { castle: png(W, H, px), yard: png(YARD.w, YARD.h, ypx), css };
}
