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
  smear: ['#9fb4d0', '#c4d4ea', '#dce6f4', '#eaf1fa', '#f4f8fd', '#fbfcff', '#ffffff'],
  // #156: the other champions
  skin: ['#2b150e', '#5a2f1f', '#8a4d33', '#b87354', '#d6966f', '#ecb993', '#f8dcc0'],
  fur: ['#1a1410', '#33281f', '#4d3e30', '#6b5843', '#8a7459', '#a8927a', '#c9b79f'],
  bone: ['#2a2419', '#534833', '#807154', '#a99a78', '#cabd98', '#e4dbbd', '#fbf6e4'],
  purple: ['#120a1c', '#241335', '#361d4f', '#4c2a6b', '#663d88', '#8657a6', '#a97cc4'],
  green: ['#0c1a10', '#16301c', '#23472a', '#34623a', '#4a7f4c', '#6b9e62', '#9cc58a'],
  soul: ['#0f3a26', '#1b6b43', '#2fa062', '#58c985', '#8fe3ad', '#c6f5d6', '#ffffff'],
  hair: ['#2a1206', '#4f220b', '#7a3a12', '#a85a1c', '#cf7f2e', '#e8a54c', '#f6cc7e'],
  shade: ['#1c0f2e', '#3a1d5c', '#5a2f8a', '#7d4fb3', '#a57ad6', '#cbaaf0', '#f0e2ff'],
} as const;
export type Material = keyof typeof RAMPS;
const METALS = new Set<Material>(['steel', 'darksteel', 'gold']);
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
