/**
 * #155: rigged, shaded pixel art. A character is a list of parts (polygons with a material) on bones. A pose places the
 * bones (limbs by 2-bone IK) and every frame is rasterized from scratch: each part gets a height field from its distance to
 * its own edge, lit from the top left with hue-shifted 7-tone ramps and metal glints, plus cloth folds, chainmail, trims,
 * a shadow where one part overlaps another and a 1 px outline. Ported from the approved Python prototype. See STYLE.md.
 */

/** [outline, deep shadow, shadow, mid, light, highlight, glint]: shadows lean cool, highlights warm. */
export const RAMPS = {
  steel: ['#191b25', '#2e3242', '#485064', '#6c768a', '#96a1b2', '#c7ced6', '#f5f3ea'],
  darksteel: ['#0f1118', '#1b1f29', '#2a303c', '#3c4352', '#555f70', '#788393', '#b0b7c1'],
  gold: ['#3a1f0b', '#6b3b12', '#9a6118', '#c98d27', '#e5b545', '#f6d97a', '#fff7cf'],
  red: ['#2a0710', '#4f0f1c', '#7a1a24', '#a3282a', '#c7422f', '#e0683f', '#f19a6a'],
  white: ['#3d3632', '#6e6558', '#9b917d', '#c4bba4', '#ded7c2', '#f2eddf', '#ffffff'],
  blue: ['#0b1331', '#142459', '#1e3a86', '#2b58b4', '#4480d9', '#77aaf0', '#c2dcff'],
  leather: ['#1e110a', '#3a2114', '#56321c', '#744627', '#935f37', '#b27b4c', '#d09d6d'],
  glow: ['#6b5516', '#a88a2b', '#d6bb50', '#f0dc82', '#fff2b0', '#fffadd', '#ffffff'],
  // #157: the foes
  skin: ['#2a1612', '#4e2b22', '#7a4636', '#a8664c', '#c98a66', '#e2ad86', '#f4d2ae'],
  wool: ['#1c1712', '#342a1f', '#4f4030', '#6b5942', '#877356', '#a38f6d', '#c4b18c'],
  straw: ['#2e2210', '#5a4318', '#86662a', '#b08d3e', '#cfae5a', '#e6cc80', '#f7e8b4'],
  green: ['#0d1a12', '#18301f', '#25472c', '#35613a', '#4b7f4a', '#6e9e62', '#a3c58c'],
  fur: ['#16161a', '#2a2a31', '#43434c', '#5f5f69', '#7e7e86', '#a2a1a4', '#cfccc6'],
  black: ['#08090c', '#111318', '#1a1d24', '#252a33', '#343a45', '#4a5261', '#8a93a3'], // blackened steel: the foes' plate
  purple: ['#150a1f', '#28123a', '#3e1d57', '#562a76', '#734096', '#935fb4', '#c49ad8'],
  coal: ['#0c0b0e', '#17151b', '#221f27', '#2f2b35', '#403a48', '#57505f', '#7a7282'], // dark cloth: robes, hoods, coats
  poison: ['#16300d', '#2c5a14', '#48861d', '#6cb02a', '#94d044', '#bfe67a', '#e8fbc0'], // the poison trail and clouds
  ember: ['#4a1406', '#86260a', '#c2410f', '#ec6a17', '#fb9a2c', '#ffc95a', '#fff1b8'], // #157: the fire trail and sparks
  // #158: the bosses
  flesh: ['#2b140e', '#4f2618', '#7a3f27', '#a35e3b', '#c47f55', '#dea276', '#f2c79d'], // #158
  hide: ['#171210', '#2b221c', '#43362b', '#5e4c3b', '#7b6650', '#9a8469', '#b8a386'], // #158
  violet: ['#150a22', '#2a1242', '#43205f', '#5e3280', '#7c4a9f', '#9d6bbd', '#c79be0'], // #158
  soulfire: ['#2a0f45', '#4d1f7a', '#7a3fb0', '#a66ad8', '#c99bf0', '#e6cffb', '#ffffff'], // #158: shadow magic, the trail colour
  flame: ['#5a1a06', '#8f2e08', '#c24d0c', '#e8761a', '#f6a23a', '#fcd070', '#fff4c4'], // #158: fire, the trail colour
  venom: ['#10240c', '#1f4214', '#33651c', '#4d8a26', '#6fae34', '#9dd052', '#d4f08c'], // #158: poison, the trail colour
  moss: ['#12160f', '#1f261a', '#303a28', '#434f38', '#59664a', '#737f5f', '#959f7d'], // #158: the Plague Abbot's habit
  smear: ['#9fb4d0', '#c4d4ea', '#dce6f4', '#eaf1fa', '#f4f8fd', '#fbfcff', '#ffffff'],
  // #159: the arenas' props
  stone: ['#1b1a20', '#302f38', '#46454e', '#605e64', '#7e7b76', '#a19c90', '#c9c2b0'],
  bark: ['#130d0a', '#231812', '#34241a', '#483325', '#5d4431', '#755940', '#927559'],
  soul: ['#0c2a33', '#155066', '#2182a0', '#3eb1cc', '#7ed8e8', '#c2f1f8', '#ffffff'],
  fire: ['#5a1a06', '#9a3208', '#d4560f', '#f08a1c', '#f8b73c', '#fde38a', '#fffbe0'],
  rot: ['#10170f', '#1f2b1d', '#34452f', '#4f6547', '#6d8763', '#94ab86', '#c6d6b4'], // the Graveyard's grasping hands
} as const;
export type Material = keyof typeof RAMPS;
const METALS = new Set<Material>(['steel', 'darksteel', 'gold', 'black']);
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

export type Pt = readonly [number, number];
const unit = (x: number, y: number, z: number): [number, number, number] => {
  const n = Math.sqrt(x * x + y * y + z * z);
  return [x / n, y / n, z / n];
};
const LIGHT = unit(-0.5, -0.7, 0.8); // from the top left, towards the viewer
const HALF = unit(LIGHT[0], LIGHT[1], LIGHT[2] + 1);

/** An ellipse as a polygon. */
export const ell = (cx: number, cy: number, rx: number, ry: number, n = 20): Pt[] =>
  Array.from({ length: n }, (_, i) => [cx + rx * Math.cos((2 * Math.PI * i) / n), cy + ry * Math.sin((2 * Math.PI * i) / n)] as const);

/** A frame: origin plus angle. Local +y is "down the limb" at angle 0; positive angles turn clockwise on screen. */
export class Bone {
  constructor(readonly x: number, readonly y: number, readonly a = 0) {}
  child(lx: number, ly: number, la = 0): Bone {
    const [x, y] = this.at(lx, ly);
    return new Bone(x, y, this.a + la);
  }
  at(lx: number, ly: number): [number, number] {
    const c = Math.cos(this.a), s = Math.sin(this.a);
    return [this.x + c * lx - s * ly, this.y + s * lx + c * ly];
  }
  local(wx: number, wy: number): [number, number] {
    const c = Math.cos(this.a), s = Math.sin(this.a);
    const dx = wx - this.x, dy = wy - this.y;
    return [c * dx + s * dy, -s * dx + c * dy];
  }
}

/** Bone at point a whose local +y points at point b. */
export const limb = (a: Pt, b: Pt): Bone => new Bone(a[0], a[1], Math.atan2(-(b[0] - a[0]), b[1] - a[1]));

/** Joint of a two-segment limb from s reaching for t; bend = +1 bends a downward limb forward (+x). */
export function ik(s: Pt, t: Pt, l1: number, l2: number, bend = 1): [number, number] {
  const dx = t[0] - s[0], dy = t[1] - s[1];
  const d = Math.max(1e-6, Math.min(Math.hypot(dx, dy), l1 + l2 - 1e-3));
  const a = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  const base = Math.atan2(dy, dx) - bend * a;
  return [s[0] + l1 * Math.cos(base), s[1] + l1 * Math.sin(base)];
}

export interface PartOpts {
  profile?: 'round' | 'flat';
  details?: [lx: number, ly: number, mat: Material, tone: number][]; // single pixels on the part
  folds?: [amp: number, period: number, axis: 0 | 1]; // cloth ripples across local x (0) or y (1)
  mail?: boolean; // chainmail checker
  trim?: [mat: Material, width: number]; // an edge band in another material
  outline?: boolean;
  dim?: number; // tones darker: far-side limbs
}
interface Part extends Required<Omit<PartOpts, 'folds' | 'trim'>> {
  poly: Pt[];
  bone: Bone;
  mat: Material;
  z: number;
  folds?: PartOpts['folds'];
  trim?: PartOpts['trim'];
}

/** Pixels whose 4x4 subsamples are at least 9/16 inside the polygon (even-odd). */
function mask(poly: Pt[], w: number, h: number): Set<number> {
  const out = new Set<number>();
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (const [x, y] of poly) (x0 = Math.min(x0, x)), (y0 = Math.min(y0, y)), (x1 = Math.max(x1, x)), (y1 = Math.max(y1, y));
  const inside = (px: number, py: number) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(h - 1, Math.floor(y1)); y++) {
    for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(w - 1, Math.floor(x1)); x++) {
      let n = 0;
      for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) if (inside(x + (sx + 0.5) / 4, y + (sy + 0.5) / 4)) n++;
      if (n >= 9) out.add(y * w + x);
    }
  }
  return out;
}

export class Figure {
  parts: Part[] = [];
  constructor(readonly w: number, readonly h: number) {}

  part(bone: Bone, pts: Pt[], mat: Material, z: number, o: PartOpts = {}): void {
    this.parts.push({
      poly: pts.map(([x, y]) => bone.at(x, y)), bone, mat, z,
      profile: o.profile ?? 'round', details: o.details ?? [], folds: o.folds, mail: o.mail ?? false, trim: o.trim, outline: o.outline ?? true, dim: o.dim ?? 0,
    });
  }

  /** Pixel index (y * w + x) -> '#rrggbb'. */
  render(): Map<number, string> {
    const { w, h } = this;
    const parts = [...this.parts].sort((a, b) => a.z - b.z); // stable: equal z keeps insertion order
    const masks = parts.map((p) => mask(p.poly, w, h));
    const owner = new Map<number, number>();
    masks.forEach((m, r) => m.forEach((q) => owner.set(q, r)));
    const col = new Map<number, string>();
    const cmat = new Map<number, Material>();
    parts.forEach((p, r) => {
      const m = masks[r];
      const vis = [...m].filter((q) => owner.get(q) === r);
      if (!vis.length) return;
      const edge: [number, number][] = [];
      for (const q of m) {
        const x = q % w, y = (q - x) / w;
        for (const [dx, dy] of N4) if (!m.has((y + dy) * w + x + dx) || x + dx < 0 || x + dx >= w) edge.push([x + dx, y + dy]);
      }
      const dist = new Map<number, number>();
      let R = 0;
      for (const q of m) {
        const x = q % w, y = (q - x) / w;
        let d = Infinity;
        for (const [ex, ey] of edge) d = Math.min(d, Math.hypot(x - ex, y - ey));
        dist.set(q, d);
        R = Math.max(R, d);
      }
      const height = new Map<number, number>();
      for (const q of m) {
        const x = q % w, y = (q - x) / w;
        const d = dist.get(q)!;
        let hq = p.profile === 'flat' ? Math.min(d, 1.5) : Math.sqrt(Math.max(0, R * R - (R - d) ** 2));
        if (p.folds) {
          const [amp, period, axis] = p.folds;
          hq += amp * Math.sin((2 * Math.PI * p.bone.local(x + 0.5, y + 0.5)[axis]) / period);
        }
        height.set(q, hq);
      }
      const hf = (x: number, y: number) => (x < 0 || x >= w ? 0 : height.get(y * w + x) ?? 0);
      for (const q of vis) {
        const x = q % w, y = (q - x) / w;
        const n = unit(-(hf(x + 1, y) - hf(x - 1, y)) / 2, -(hf(x, y + 1) - hf(x, y - 1)) / 2, 1);
        const diff = n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2];
        let tone = diff < 0.15 ? 1 : diff < 0.45 ? 2 : diff < 0.72 ? 3 : diff < 0.9 ? 4 : 5;
        const mat = p.trim && dist.get(q)! <= p.trim[1] ? p.trim[0] : p.mat;
        if (METALS.has(mat) && n[0] * HALF[0] + n[1] * HALF[1] + n[2] * HALF[2] > 0.985) tone = 6;
        tone = Math.max(1, tone - p.dim);
        if (p.mail) {
          const [lx, ly] = p.bone.local(x + 0.5, y + 0.5);
          if ((Math.floor(lx) + Math.floor(ly)) % 2) tone = Math.max(1, tone - 1);
        }
        // a part in front casts a one-pixel shadow down and right
        for (const [dx, dy] of [[-1, 0], [0, -1], [-1, -1]]) {
          const o = x + dx >= 0 ? owner.get((y + dy) * w + x + dx) : undefined;
          if (o !== undefined && o > r && parts[o].outline) {
            tone = Math.max(1, tone - 1);
            break;
          }
        }
        col.set(q, RAMPS[mat][tone]);
        cmat.set(q, mat);
      }
      for (const [lx, ly, mat, tone] of p.details) {
        const [px, py] = p.bone.at(lx, ly);
        const q = Math.floor(py) * w + Math.floor(px);
        if (px >= 0 && px < w && owner.get(q) === r) col.set(q, RAMPS[mat][tone]);
      }
    });
    const out = new Map<number, string>();
    for (const [q, r] of owner) {
      if (!parts[r].outline) continue;
      const x = q % w, y = (q - x) / w;
      for (const [dx, dy] of N4) {
        const ox = x + dx, oy = y + dy, o = oy * w + ox;
        if (ox >= 0 && ox < w && oy >= 0 && oy < h && !owner.has(o) && !out.has(o)) out.set(o, RAMPS[cmat.get(q)!][0]);
      }
    }
    for (const [q, c] of out) col.set(q, c);
    return col;
  }
}
