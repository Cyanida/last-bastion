/**
 * #188: the world map painter (prototype). Paints Kingdom Rush-like terrain per family in the night palette, dirt roads with a dark
 * edge between level points, castles, level flags with their number and crown pips, clouds over sealed land and ribbons for names,
 * all from code and a seed: the same layout and seed always give the same pixels. Props on the map (trees, peaks, barrows, flags,
 * castles) are rig figures, so they share the sprites' light and outlines (STYLE.md). Not in the game yet: v0.10.0 builds the real
 * world map from data with `paintMap` / `paintRealm`. Previews: `npm run art:map` (tools/art/map-preview.ts).
 */
import { ell, Figure, limb, type Material, type Pt, RAMPS } from './rig';
import { png } from './png';

/** The nine regions: the Marches, the seven family realms and the Last Bastion. */
export type Terrain = 'marches' | 'steel' | 'flame' | 'grave' | 'frost' | 'storm' | 'holy' | 'blood' | 'bastion';
export const TERRAINS: Terrain[] = ['marches', 'steel', 'flame', 'grave', 'frost', 'storm', 'holy', 'blood', 'bastion'];

export interface LevelPoint {
  x: number;
  y: number;
  n: number; // the number on its flag
  crowns?: number; // 0-4 tier crowns won (Squire, Knight, Champion, Legend); left out: no pips
  castle?: boolean; // a castle instead of a flag (a crown level, the Last Bastion)
}
export interface RealmLayout {
  terrain: Terrain;
  name: string;
  rect: [x: number, y: number, w: number, h: number]; // its land; borders are warped so they don't read as boxes
  points: LevelPoint[]; // in map coordinates, joined by a road in this order
  sealed?: boolean; // under clouds
}
export interface MapLayout {
  w: number;
  h: number;
  seed: number;
  realms: RealmLayout[];
  links?: [from: number, to: number][]; // a road from realm `from`'s last point to realm `to`'s first
  names?: false; // #198: leave the name ribbons out (the game sets the names in Cinzel on top, readable at any scale)
}
export interface Painted {
  w: number;
  h: number;
  rgba: Uint8Array;
  road: Uint8Array; // 1 where a road runs (under the flags): v0.10.0 can hit-test it, the tests walk it
  region: Uint8Array; // the realm index each pixel belongs to
}

/** Night ground ramps in the rig's shape: [outline, deep shadow, shadow, mid, light, highlight, glint]; cool shadows, warm lights. */
const GROUND = {
  marches: ['#0b140f', '#122017', '#1a2d1f', '#233c28', '#2f4d31', '#41613c', '#5d7c4d'],
  field: ['#17130b', '#261f12', '#362c19', '#473b20', '#5a4b29', '#705e33', '#8e7a47'],
  steel: ['#101118', '#1a1c25', '#262933', '#343844', '#454a57', '#5c616d', '#80858f'],
  flame: ['#0a080a', '#131012', '#1c1619', '#261d20', '#322628', '#413133', '#574240'],
  grave: ['#0b1012', '#12191a', '#1a2424', '#22302e', '#2c3c38', '#3a4a44', '#50605a'],
  frost: ['#161d2d', '#253047', '#374661', '#4f6182', '#6c80a0', '#91a4bf', '#c4d2e3'],
  storm: ['#0b0e1c', '#131829', '#1c233a', '#28304c', '#363f60', '#4a5577', '#697694'],
  holy: ['#1b1508', '#2f250d', '#463714', '#5f4b1d', '#7b6228', '#987c36', '#bca153'],
  meadow: ['#11160c', '#1b2412', '#263318', '#324220', '#40522a', '#536636', '#6f8148'], // the Reach's grass between its fields
  blood: ['#140808', '#220d0c', '#321412', '#431b16', '#56241c', '#6c2f24', '#8a4232'],
  bastion: ['#0d0c12', '#16141d', '#1f1c28', '#2a2634', '#363142', '#464054', '#5e576d'],
  cloud: ['#161a26', '#262c3e', '#353d54', '#46506b', '#5a6583', '#737e9a', '#949eb5'],
  mist: ['#4a5760', '#61707a'],
  road: ['#140c07', '#27180e', '#3a2516', '#4f3420', '#66452b', '#7e5937', '#9a7250'],
} as const;
type Ramp = readonly string[];

// Seeded noise: an integer hash, smooth value noise and a few octaves of it. No Math.random anywhere.
const hash = (x: number, y: number, s: number): number => {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
function vnoise(x: number, y: number, s: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, s), b = hash(ix + 1, iy, s), c = hash(ix, iy + 1, s), d = hash(ix + 1, iy + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, y: number, s: number, oct = 4): number {
  let t = 0, amp = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) (t += amp * vnoise(x * f, y * f, s + i * 101)), (n += amp), (amp *= 0.5), (f *= 2);
  return t / n;
}
/** mulberry32: the seeded RNG for placing things. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x: number, y: number) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;

// ---- the map's rig figures (drawn once each, then stamped) ----
const O = limb([0, 0], [0, 1]);
const rect = (x0: number, y0: number, x1: number, y1: number): Pt[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const upper = (cx: number, cy: number, rx: number, ry: number): Pt[] => ell(cx, cy, rx, ry, 24).filter(([, y]) => y <= cy + 0.01);

interface Stamp { w: number; h: number; ax: number; ay: number; px: Map<number, string> }
const stamp = (f: Figure, ax: number, ay: number): Stamp => ({ w: f.w, h: f.h, ax, ay, px: f.render() });

function oak(k: number): Stamp {
  const f = new Figure(18, 22);
  f.part(O, rect(8, 13, 10, 20), 'bark', 0);
  f.part(O, ell(9, 9, 6 + (k % 2), 6, 16), 'green', 1, { dim: 1 });
  f.part(O, ell(6 + k, 7, 3.5, 3.5, 12), 'green', 1.1, { dim: 1 });
  return stamp(f, 9, 20);
}
function peak(k: number): Stamp {
  const f = new Figure(50, 40);
  const t = 12 + k * 3;
  f.part(O, [[2, 38], [t, 6], [t + 7, 14], [t + 13, 9], [48, 38]], 'stone', 0, { dim: 1 });
  f.part(O, [[t - 5, 15], [t, 6], [t + 7, 14], [t + 4, 17], [t + 1, 14]], 'white', 1, { dim: 2 });
  return stamp(f, 25, 37);
}
function spire(k: number): Stamp {
  const f = new Figure(18, 28);
  f.part(O, [[2, 26], [7 + k, 3], [10 + k, 8], [16, 26]], 'coal', 0, { details: [[6, 24, 'ember', 4], [11, 23, 'ember', 5], [9, 25, 'ember', 3]] });
  return stamp(f, 9, 26);
}
function barrow(k: number): Stamp {
  const f = new Figure(34, 18);
  f.part(O, upper(17, 15, 14 - k, 9 - k), 'moss', 0);
  f.part(O, [[14, 15.5], [14, 11], [17, 9], [20, 11], [20, 15.5]], 'stone', 1, { dim: 3 });
  f.part(O, rect(26 - k, 5, 29 - k, 15), 'stone', 0.5, { dim: 1 }); // a standing stone
  return stamp(f, 17, 15);
}
function pine(k: number): Stamp {
  const f = new Figure(16, 26);
  f.part(O, rect(7, 20, 9, 24), 'bark', 0);
  for (const [i, [y0, y1, r]] of [[10, 21, 7], [6, 15, 5.5], [2, 10, 4]].entries()) f.part(O, [[8, y0 - (k % 2)], [8 + r, y1], [8 - r, y1]], 'fern', 1 + i, { dim: 1 });
  f.part(O, [[8, 1], [10.5, 5], [5.5, 5]], 'white', 4, { dim: 1 });
  return stamp(f, 8, 24);
}
function crag(k: number): Stamp {
  const f = new Figure(32, 32);
  f.part(O, [[2, 30], [5, 14], [10, 6 + k], [14, 12], [19, 3], [24, 10], [30, 30]], 'stone', 0, { dim: 2, folds: [0.6, 4, 0] });
  if (k === 2) f.part(O, [[19, 0], [15, 7], [18, 7], [14, 14], [21, 5], [18, 5]], 'soul', 1, { profile: 'flat', outline: false }); // a lightning strike
  return stamp(f, 16, 30);
}
function stack(): Stamp {
  const f = new Figure(16, 13);
  f.part(O, upper(8, 11, 6.5, 8), 'straw', 0, { dim: 1, folds: [0.5, 3, 1] });
  return stamp(f, 8, 11);
}
function wreck(k: number): Stamp {
  const f = new Figure(18, 22);
  const lean = [[4, 20, 12, 3], [13, 20, 6, 4], [8, 20, 9, 2]][k];
  f.part(limb([lean[0], lean[1]], [lean[2], lean[3]]), rect(-0.8, 0, 0.8, 16), 'bark', 0);
  f.part(limb([lean[2], lean[3]], [lean[2] + (lean[2] - lean[0]) * 0.2, lean[3] - 3]), [[-1.5, -1], [1.5, -1], [0, 4]], 'darksteel', 0.5);
  if (k === 2) f.part(O, [[9, 3], [16, 4], [14, 7], [16, 10], [9, 9]], 'wool', 1, { dim: 1 }); // a torn, muddied banner (not red: red flags are levels)
  return stamp(f, 9, 20);
}

/** A castle with lit windows; `big` is the Last Bastion. */
function castle(big: boolean, roof: Material): Stamp {
  const s = big ? 1.7 : 1;
  const f = new Figure(Math.ceil(56 * s), Math.ceil(52 * s));
  const r = (x0: number, y0: number, x1: number, y1: number) => rect(x0 * s, y0 * s, x1 * s, y1 * s);
  const win = (x: number, y: number): [number, number, Material, number] => [x * s, y * s, 'glow', 4];
  f.part(O, r(8, 26, 48, 48), 'stone', 0, { dim: 1, details: [win(16, 34), win(40, 34)] }); // curtain wall
  for (let x = 8; x < 48; x += 5) f.part(O, r(x, 23, x + 3, 26), 'stone', 0.1, { dim: 1 });
  f.part(O, [[23 * s, 48 * s], [23 * s, 38 * s], [28 * s, 34 * s], [33 * s, 38 * s], [33 * s, 48 * s]], 'darksteel', 0.5); // gate
  for (const x of [2, 42]) {
    f.part(O, r(x, 14, x + 12, 48), 'stone', 1, { details: [win(x + 6, 24)] });
    f.part(O, [[(x - 1) * s, 14 * s], [(x + 6) * s, 2 * s], [(x + 13) * s, 14 * s]], roof, 1.5, { dim: 1 });
  }
  if (big) {
    f.part(O, r(19, 8, 37, 30), 'stone', 0.8, { details: [win(28, 16), win(24, 22), win(32, 22)] }); // the keep
    f.part(O, [[18 * s, 8 * s], [28 * s, -4 * s + 4], [38 * s, 8 * s]], roof, 0.9, { dim: 1 });
  }
  return stamp(f, Math.round(28 * s), Math.round(48 * s));
}
function flag(): Stamp {
  const f = new Figure(22, 30);
  f.part(O, ell(7, 27, 6, 2.5, 14), 'stone', 0, { dim: 1 });
  f.part(O, rect(6, 3, 8, 27), 'darksteel', 1);
  f.part(O, [[8, 4], [21, 4], [18, 9.5], [21, 15], [8, 15]], 'red', 2, { trim: ['gold', 1] });
  f.part(O, ell(7, 3, 1.6, 1.6, 8), 'gold', 3);
  return stamp(f, 7, 27);
}
function ribbon(tw: number): Stamp {
  const w = tw + 18;
  const f = new Figure(w + 4, 17);
  f.part(O, [[0, 5], [8, 5], [8, 14], [0, 14], [3, 9.5]], 'red', 0, { dim: 2 }); // tails
  f.part(O, [[w + 4, 5], [w - 4, 5], [w - 4, 14], [w + 4, 14], [w + 1, 9.5]], 'red', 0, { dim: 2 });
  f.part(O, rect(5, 2, w - 1, 12), 'red', 1, { trim: ['gold', 1] });
  return stamp(f, 0, 0);
}

/** 5x5 capitals and 3x5 digits: flag numbers and ribbon names. v0.10.0 may set the names in Cinzel on top instead. */
const FONT: Record<string, string> = {
  A: '.###. #...# ##### #...# #...#', B: '####. #...# ####. #...# ####.', C: '.#### #.... #.... #.... .####', D: '####. #...# #...# #...# ####.',
  E: '##### #.... ####. #.... #####', F: '##### #.... ####. #.... #....', G: '.#### #.... #.### #...# .####', H: '#...# #...# ##### #...# #...#',
  I: '### .#. .#. .#. ###', J: '..### ...#. ...#. #..#. .##..', K: '#...# #..#. ###.. #..#. #...#', L: '#.... #.... #.... #.... #####',
  M: '#...# ##.## #.#.# #...# #...#', N: '#...# ##..# #.#.# #..## #...#', O: '.###. #...# #...# #...# .###.', P: '####. #...# ####. #.... #....',
  Q: '.###. #...# #.#.# #..#. .##.#', R: '####. #...# ####. #..#. #...#', S: '.#### #.... .###. ....# ####.', T: '##### ..#.. ..#.. ..#.. ..#..',
  U: '#...# #...# #...# #...# .###.', V: '#...# #...# #...# .#.#. ..#..', W: '#...# #...# #.#.# ##.## #...#', X: '#...# .#.#. ..#.. .#.#. #...#',
  Y: '#...# .#.#. ..#.. ..#.. ..#..', Z: '##### ...#. ..#.. .#... #####', ' ': '.. .. .. .. ..',
  0: '### #.# #.# #.# ###', 1: '.#. ##. .#. .#. ###', 2: '##. ..# .#. #.. ###', 3: '##. ..# .#. ..# ##.', 4: '#.# #.# ### ..# ..#',
  5: '### #.. ##. ..# ##.', 6: '.## #.. ### #.# ###', 7: '### ..# .#. .#. .#.', 8: '### #.# ### #.# ###', 9: '### #.# ### ..# ##.',
};
const glyph = (c: string) => (FONT[c.toUpperCase()] ?? FONT[' ']).split(' ');
const textWidth = (t: string) => [...t].reduce((s, c) => s + glyph(c)[0].length + 1, -1);

interface TerrainDef {
  ramp: Ramp;
  scale: number; // noise feature size in px
  terraces?: number; // cliff bands (the Iron Hold, the Stormspire)
  fields?: [ramp: Ramp, share: number]; // patchwork: this share of the cells are fields
  props: Stamp[];
  density: number; // props per 1000 px
}
let DEFS: Record<Terrain, TerrainDef> | undefined;
const defs = (): Record<Terrain, TerrainDef> =>
  (DEFS ??= {
    marches: { ramp: GROUND.marches, scale: 70, fields: [GROUND.field, 0.45], props: [0, 1, 2].map(oak), density: 0.55 },
    steel: { ramp: GROUND.steel, scale: 50, terraces: 5, props: [0, 1, 2].map(peak), density: 0.45 },
    flame: { ramp: GROUND.flame, scale: 55, props: [0, 1, 2].map(spire), density: 0.4 },
    grave: { ramp: GROUND.grave, scale: 60, props: [0, 1, 2].map(barrow), density: 0.35 },
    frost: { ramp: GROUND.frost, scale: 60, props: [0, 1].map(pine), density: 0.9 },
    storm: { ramp: GROUND.storm, scale: 45, terraces: 6, props: [0, 1, 2].map(crag), density: 0.45 },
    holy: { ramp: GROUND.meadow, scale: 70, fields: [GROUND.holy, 0.8], props: [stack()], density: 0.3 },
    blood: { ramp: GROUND.blood, scale: 50, props: [0, 1, 2].map(wreck), density: 0.9 },
    bastion: { ramp: GROUND.bastion, scale: 40, props: [], density: 0 },
  });
const ROOF: Record<Terrain, Material> = { marches: 'blue', steel: 'darksteel', flame: 'ember', grave: 'violet', frost: 'blue', storm: 'purple', holy: 'gold', blood: 'red', bastion: 'gold' };

/** Paints a whole map: every realm's ground, its roads, props, flags and castles, then clouds over sealed realms and the name ribbons. */
export function paintMap(L: MapLayout): Painted {
  const { w, h, seed, realms } = L;
  const T = defs();
  const rgba = new Uint8Array(w * h * 4), road = new Uint8Array(w * h), region = new Uint8Array(w * h);
  const put = (x: number, y: number, c: string) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    rgba.set([parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16), 255], (y * w + x) * 4);
  };
  const blit = (s: Stamp, x: number, y: number) => {
    for (const [q, c] of s.px) {
      const sx = q % s.w;
      put(Math.round(x) - s.ax + sx, Math.round(y) - s.ay + (q - sx) / s.w, c);
    }
  };

  // Regions: the nearest rect to a noise-warped point, so borders wander.
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const wx = x + (fbm(x / 40, y / 40, seed + 11, 3) - 0.5) * 36, wy = y + (fbm(x / 40, y / 40, seed + 12, 3) - 0.5) * 36;
      let best = 0, bd = Infinity;
      realms.forEach(({ rect: [rx, ry, rw, rh] }, i) => {
        const d = Math.hypot(Math.max(rx - wx, 0, wx - rx - rw), Math.max(ry - wy, 0, wy - ry - rh));
        if (d < bd) (bd = d), (best = i);
      });
      region[y * w + x] = best;
    }

  // Ground: a lit height field quantised to the ramp with an ordered dither, plus each family's own marks.
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const r = region[y * w + x], ter = realms[r].terrain, d = T[ter], s = seed + r * 7919;
      const f = (xx: number, yy: number) => fbm(xx / d.scale, yy / d.scale, s);
      let hgt = f(x, y);
      const slope = (f(x - 1, y - 1) - f(x + 1, y + 1)) * d.scale * 0.9; // lit from the top left
      let ramp = d.ramp;
      let bump = 0;
      if (d.terraces) {
        const band = Math.floor(hgt * d.terraces), below = Math.floor(f(x + 1, y + 2) * d.terraces);
        hgt = band / d.terraces + 0.1;
        if (below < band) bump = -3; // the cliff face under a terrace edge
        else if (Math.floor(f(x - 1, y - 1) * d.terraces) < band) bump = 1.2; // its lit lip
      }
      if (d.fields) {
        // Patchwork: jittered cells, some of them fields with furrows one way or the other, a hedge where a field meets a neighbour.
        const S = 30, gx = Math.floor(x / S), gy = Math.floor(y / S);
        let d1 = Infinity, d2 = Infinity, c1 = 0, c2 = 0;
        for (let j = gy - 1; j <= gy + 1; j++)
          for (let i = gx - 1; i <= gx + 1; i++) {
            const dd = Math.hypot((i + 0.15 + 0.7 * hash(i, j, s + 1)) * S - x, (j + 0.15 + 0.7 * hash(i, j, s + 2)) * S - y), id = i * 7349 + j;
            if (dd < d1) (d2 = d1), (c2 = c1), (d1 = dd), (c1 = id);
            else if (dd < d2) (d2 = dd), (c2 = id);
          }
        const isField = (id: number) => hash(id, 3, s) < d.fields![1];
        if (isField(c1) || isField(c2)) {
          if (d2 - d1 < 1.6) bump -= 3;
          else if (isField(c1)) {
            ramp = d.fields[0];
            if ((hash(c1, 4, s) < 0.5 ? x + (y >> 1) : y) % 4 === 0) bump -= 1; // furrows
          }
        }
      }
      if (ter === 'bastion' && (x % 9 === 0 || (y % 6 === 0 && (x + ((y / 6) & 1) * 4) % 9 !== 4))) bump -= 1.5; // paving
      if (ter === 'blood') {
        const c = fbm(x / 9, y / 9, s + 3, 2);
        if (c > 0.74) bump -= 2.5; // shell pits
        else if (c > 0.7) bump += 1;
      }
      let tone = Math.floor(3.3 + (hgt - 0.5) * 2.4 + slope * 2.4 + bump + bayer(x, y) - 0.5);
      tone = Math.max(1, Math.min(5, tone));
      let c: string = ramp[tone];
      if (ter === 'flame') {
        const k = Math.abs(fbm(x / 60, y / 60, s + 5, 3) - 0.5);
        if (k < 0.006) c = RAMPS.ember[5];
        else if (k < 0.012) c = RAMPS.ember[3];
        else if (k < 0.019) c = RAMPS.ember[1];
        else if (k < 0.03 && bayer(x, y) < 0.25) c = RAMPS.ember[0]; // the glow dies into the basalt
      }
      if (ter === 'frost' && hash(x, y, s + 9) > 0.996) c = ramp[6]; // frost glints
      put(x, y, c);
    }
  // Borders: a dark seam where two realms meet.
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const r = region[y * w + x];
      if ((x + 1 < w && region[y * w + x + 1] !== r) || (y + 1 < h && region[(y + 1) * w + x] !== r) || (x > 0 && region[y * w + x - 1] !== r) || (y > 0 && region[(y - 1) * w + x] !== r))
        put(x, y, T[realms[r].terrain].ramp[0]);
    }

  // Roads: a gentle curve through each pair of points, a dark edge first, then the dirt on top.
  const legs: [LevelPoint, LevelPoint][] = [];
  for (const rl of realms) for (let i = 1; i < rl.points.length; i++) legs.push([rl.points[i - 1], rl.points[i]]);
  for (const [a, b] of L.links ?? []) {
    const p = realms[a].points, q = realms[b].points;
    if (p.length && q.length) legs.push([p[p.length - 1], q[0]]);
  }
  const rand = rng(seed);
  const paths = legs.map(([a, b]) => {
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy), bend = (rand() - 0.5) * 0.5;
    const cx = (a.x + b.x) / 2 - dy * bend, cy = (a.y + b.y) / 2 + dx * bend;
    const n = Math.ceil(len * 2) + 1;
    return Array.from({ length: n + 1 }, (_, i): Pt => {
      const t = i / n, u = 1 - t;
      return [u * u * a.x + 2 * u * t * cx + t * t * b.x, u * u * a.y + 2 * u * t * cy + t * t * b.y];
    });
  });
  const disc = (px: number, py: number, r: number, fn: (x: number, y: number) => void) => {
    for (let y = Math.floor(py - r); y <= Math.ceil(py + r); y++)
      for (let x = Math.floor(px - r); x <= Math.ceil(px + r); x++) if ((x + 0.5 - px) ** 2 + (y + 0.5 - py) ** 2 <= r * r && x >= 0 && y >= 0 && x < w && y < h) fn(x, y);
  };
  for (const p of paths) for (const [x, y] of p) disc(x, y, 3.6, (x, y) => put(x, y, GROUND.road[0]));
  for (const p of paths) for (const [px, py] of p) disc(px, py, 2.6, (x, y) => (road[y * w + x] = 1));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!road[y * w + x]) continue;
      const lit = !road[(y - 1) * w + x] || !road[y * w + x - 1] ? 1 : !road[(y + 1) * w + x] || !road[y * w + x + 1] ? -1 : 0; // a lit near edge, a rutted far one
      const t = 3 + lit + (bayer(x, y) + fbm(x / 6, y / 6, seed + 77, 2) > 1.25 ? 1 : 0) - (hash(x, y, seed + 5) > 0.93 ? 1 : 0);
      put(x, y, GROUND.road[Math.max(1, Math.min(5, t))]);
    }

  // Props: scattered by the seed, kept off the roads and the level points, drawn back to front.
  const clear = (x: number, y: number) => {
    for (let yy = y - 7; yy <= y + 3; yy++) for (let xx = x - 8; xx <= x + 8; xx++) if (xx >= 0 && yy >= 0 && xx < w && yy < h && road[yy * w + xx]) return false;
    return realms.every((rl) => rl.points.every((p) => Math.hypot(p.x - x, p.y - y) > (p.castle ? 40 : 18)));
  };
  const placed: [number, number, Stamp][] = [];
  realms.forEach((rl, r) => {
    const d = T[rl.terrain], [rx, ry, rw, rh] = rl.rect, pick = rng(seed + r * 131);
    const tries = Math.round((rw * rh * d.density) / 1000);
    for (let i = 0; i < tries && d.props.length; i++) {
      const x = Math.floor(rx + pick() * rw), y = Math.floor(ry + pick() * rh), s = d.props[Math.floor(pick() * d.props.length)];
      if (x < 4 || y < s.ay || x >= w - 4 || y >= h - 2 || region[y * w + x] !== r || !clear(x, y)) continue;
      if (placed.some(([px, py]) => Math.abs(px - x) < s.w * 0.45 && Math.abs(py - y) < 6)) continue;
      placed.push([x, y, s]);
    }
  });
  placed.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  for (const [x, y, s] of placed) blit(s, x, y);

  // The Barrowvale's mist: pale bands dithered over everything low.
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const r = region[y * w + x];
      if (realms[r].terrain !== 'grave') continue;
      const m = fbm(x / 50, y / 16, seed + r * 7919 + 5, 3) - 0.56;
      if (m > 0 && bayer(x, y) < m * 5) put(x, y, GROUND.mist[m > 0.08 ? 1 : 0]);
    }

  // Castles and flags, with the flag's number and crown pips.
  const FLAG = flag();
  const text = (t: string, x: number, y: number, c: string, shadow: string) => {
    for (const [ox, oy, col] of [[1, 1, shadow], [0, 0, c]] as const) {
      let cx = x;
      for (const ch of t) {
        const g = glyph(ch);
        g.forEach((row, gy) => [...row].forEach((v, gx) => v === '#' && put(cx + gx + ox, y + gy + oy, col)));
        cx += g[0].length + 1;
      }
    }
  };
  const pips = (x: number, y: number, n: number) => {
    const x0 = x - 12;
    for (let yy = y - 1; yy <= y + 3; yy++) for (let xx = x0 - 1; xx <= x0 + 23; xx++) put(xx, yy, GROUND.road[0]);
    for (let i = 0; i < 4; i++) {
      const on = i < n, bx = x0 + i * 6;
      ['#.#.#', '#####', '#####'].forEach((row, gy) => [...row].forEach((v, gx) => v === '#' && put(bx + gx, y + gy, on ? RAMPS.gold[gy ? 3 : 5] : RAMPS.darksteel[gy ? 2 : 3])));
    }
  };
  const points = realms.flatMap((rl) => rl.points.map((p) => [p, rl.terrain] as const)).sort((a, b) => a[0].y - b[0].y);
  for (const [p, ter] of points) {
    if (p.castle) blit(castle(ter === 'bastion', ROOF[ter]), p.x, p.y + 3);
    else {
      blit(FLAG, p.x, p.y);
      const n = String(p.n);
      text(n, p.x + 8 - Math.floor(textWidth(n) / 2) + 2, p.y - 20, RAMPS.white[5], RAMPS.red[0]);
    }
    if (p.crowns !== undefined) pips(p.x, p.y + 5, p.crowns);
  }

  // Clouds over sealed realms: overlapping round puffs, each lit like a ball from the top left with a dark rim at its lower right,
  // drawn back to front; a few are left out so a little of the land shows through.
  if (realms.some((rl) => rl.sealed)) {
    const cloud = new Uint8Array(w * h), rnd = rng(seed + 33), puffs: [number, number, number][] = [];
    for (let gy = -8; gy < h + 20; gy += 17)
      for (let gx = -8; gx < w + 20; gx += 22) {
        const px = gx + (rnd() - 0.5) * 12, py = gy + (rnd() - 0.5) * 10, r = 9 + 34 * fbm(gx / 120, gy / 80, seed + 34, 2) * (0.5 + 0.5 * rnd()), skip = rnd() < 0.05;
        const sx = Math.min(w - 1, Math.max(0, Math.round(px))), sy = Math.min(h - 1, Math.max(0, Math.round(py)));
        if (!skip && realms[region[sy * w + sx]].sealed) puffs.push([px, py, r]);
      }
    puffs.sort((p, q) => p[1] - q[1] || p[0] - q[0]);
    for (const [px, py, r] of puffs)
      disc(px, py, r, (x, y) => {
        const out = (dx: number, dy: number) => (x + 0.5 + dx - px) ** 2 + (y + 0.5 + dy - py) ** 2 > r * r;
        let tone = (y + 0.5 - py) / r < -0.45 ? 4 : 3; // flat, lighter on top
        if (out(1.5, 2)) tone = 1; // the lower right rim in shadow
        else if (out(3, 4)) tone = 2;
        else if (out(-2, -3)) tone = 5; // the upper left rim catches the light
        else if (out(-4, -5)) tone = 4;
        put(x, y, GROUND.cloud[tone]);
        cloud[y * w + x] = 1;
      });
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        if (!cloud[y * w + x] && ((x > 0 && cloud[y * w + x - 1]) || (x + 1 < w && cloud[y * w + x + 1]) || (y > 0 && cloud[(y - 1) * w + x]) || (y + 1 < h && cloud[(y + 1) * w + x])))
          put(x, y, GROUND.cloud[0]);
  }

  // Ribbons with the realm names, at the top of each realm.
  if (L.names !== false) for (const rl of realms) {
    const name = rl.name.toUpperCase(), tw = textWidth(name), rb = ribbon(tw);
    const [rx, ry, rw] = rl.rect, x = Math.round(rx + rw / 2 - rb.w / 2), y = ry + 4;
    blit(rb, x, y);
    text(name, x + 11, y + 5, RAMPS.white[5], RAMPS.red[0]);
  }
  return { w, h, rgba, road, region };
}

/** One realm on its own canvas the size of its rect (points in map coordinates, as in `paintMap`). */
export function paintRealm(realm: RealmLayout, seed: number): Painted {
  const [rx, ry, rw, rh] = realm.rect;
  return paintMap({ w: rw, h: rh, seed, realms: [{ ...realm, rect: [0, 0, rw, rh], points: realm.points.map((p) => ({ ...p, x: p.x - rx, y: p.y - ry })) }] });
}

/** A winding line of `n` level points across a rect, the last one a castle; `flip` runs it right to left. For previews and tests. */
export function trail(rect: RealmLayout['rect'], n: number, crowns: number[] = [], flip = false): LevelPoint[] {
  const [x, y, w, h] = rect;
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    return { x: Math.round(x + w * (flip ? 0.86 - 0.74 * t : 0.14 + 0.74 * t)), y: Math.round(y + h * (0.68 + (i % 2 ? -0.18 : 0.1))), n: i + 1, crowns: crowns[i], castle: i === n - 1 && n > 1 };
  });
}

const R = (terrain: Terrain, name: string, rect: RealmLayout['rect'], n: number, crowns: number[] = [], sealed = false, flip = false): RealmLayout => ({ terrain, name, rect, points: trail(rect, n, crowns, flip), sealed });

/** Sample data for the previews and tests: the nine regions in their rings, the Marches cleared, rings 2 and 3 part way, ring 4 and the Last Bastion sealed. */
export const SAMPLE_WORLD: MapLayout = {
  w: 960,
  h: 600,
  seed: 188,
  realms: [
    R('marches', 'The Marches', [0, 450, 960, 150], 7, [4, 4, 3, 3, 2, 2, 1]),
    R('steel', 'Iron Hold', [0, 300, 320, 150], 5, [1, 0], false, true),
    R('grave', 'Barrowvale', [320, 300, 320, 150], 5, [2, 1, 1, 0, 0], false, true),
    R('flame', 'Cinderlands', [640, 300, 320, 150], 5, [3, 2, 2, 1, 1], false, true),
    R('frost', 'Frozen Pass', [0, 150, 480, 150], 5, [1, 0]),
    R('storm', 'Stormspire', [480, 150, 480, 150], 5, [0]),
    R('holy', 'Hallowed Reach', [0, 0, 330, 150], 5, [], true, true),
    { terrain: 'bastion', name: 'The Last Bastion', rect: [330, 0, 300, 150], points: [{ x: 480, y: 118, n: 1, castle: true }], sealed: true },
    R('blood', 'Crimson Fields', [630, 0, 330, 150], 5, [], true, true),
  ],
  links: [[0, 3], [3, 2], [2, 1], [1, 4], [4, 5], [4, 6], [5, 8], [8, 7]],
};

export const toPng = (p: Painted): Buffer => png(p.w, p.h, p.rgba);
