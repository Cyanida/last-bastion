/**
 * #268: the Angel, redesigned (the look only: her abilities, stats and balance stay as they are). A fighting angel, the first
 * female champion design: a holy battle caster with no armour, in durable clerical cloth of white and gold embroidered with
 * crosses (a long robe open at the front, a tabard, a gold stole, a small collar mantle, a gold-brocade bodice, a braided
 * rope belt, embroidered cuffs, wrapped linen boots), an auburn braid and a halo. Her weapon is a scepter-staff whose
 * sun-ring holds the light she shoots. The staff is in her far hand, in front of her body; the near arm is behind it.
 * She always flies: she hovers a few pixels off the ground, legs hanging. Her great wings are one pixel drawing (WING),
 * turned to each angle by RotSprite so the feathers stay crisp, and they beat by folding over onto themselves like a
 * turned page. The cast (Heavenly Radiance) raises the staff with the wings at full spread; the hurt is a parry with the
 * staff; death is an ascension, her body turning to light and drawing into a holy orb; Blink is that run backwards. 54 px tall.
 */
import { arm, H, HIP_Y, legs, pose, W, X0, type Pose } from '../humanoid';
import { Bone, ell, Figure, RAMPS, type Material, type Pt } from '../rig';
import type { Frame, SpriteDef } from '../sheet';

const FAIR: Material = 'angelSkin', PEARL: Material = 'angelPearl', CLOTH: Material = 'angelLinen';

type D = [number, number, Material, number];
const line = (a: Pt, b: Pt, mat: Material, tone: number, step = 0.7): D[] => { // a row of detail pixels from a to b
  const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
  return Array.from({ length: n + 1 }, (_, k) => [a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n, mat, tone] as D);
};

// her wing, drawn pixel by pixel as a pixel artist would (one clean silhouette, the feathers drawn inside it): the top edge
// arches up from her back and tapers up into the tip, the body is deepest just before the middle, and the bottom edge is
// scalloped by the flight feathers. Its root (where it joins her back) is at the right edge, row WING_ROOT. Shades on the
// pearl ramp: O outline, D dark, M mid, L light, W white, H highlight
const WING = [
  '..OOO....................................................',
  'OOMMMOOOOO...............................................',
  'OMMMMMMMMMOOOO...........................................',
  '.OMMMMMMMMMMMMOO.........................................',
  '.OMMMMMMMMMMMMMOOO.......................................',
  'OOOOOMMMMMMMMMMOMHOOOOOOO................................',
  '.OMMMOOOMMMMMMMOWHHHHHHHHOOOOOOOOOOO.....................',
  '..OMMMMMOOOMMMMOMWWWWWWWWWWWHHHHHHHHOOOOOOOOO............',
  '..OOOOOOMMMOOOOMMMOLLLLLLLWWWWWWWWWWWWWWHHHHHOO..........',
  '.OMMMMMMOOOOOOOOOMOMMLLLDLLLDLLLLLLLLLWWWWWWWWHO.........',
  '..OMMMMMMMMMMMMMMOMMMOMMLDDDLDLDDLLLDLLLDLLLLWWWOO.......',
  '...OMOOOOOOOOOOOOOOOOMMMOMMLLLDLLDDDLDDDLDLDDLLWWHO......',
  '...OOMMMMMMMMMMMMMMMOOOOMMMOMMOLLLLLLLLLLLDLLDLLLWHO.....',
  '..OMMMMMMMMMMMMOOOOOMMMMOOOMMOMMMOMLLLDLLLLLLLDDDLWWO....',
  '...OMMMMMMOOOOOMMMMMMMOOMMMMOMMMOMMMOMMOLDDDLLLLLDLWWO...',
  '....OMOOOOMMMMMMMMMOOOMMMMOOMMMOMMMOMMMOMMOMDDDLLLLLWWO..',
  '.....OMMMMMMMMMMOOOMMMMMOOMMMOOMMMOMMMOMMOMMOMLDLLDDDWHO.',
  '.....OMMMMMMMMOOMMMMMMOOMMMMOMMMMOMMMOMMMOMMOMMODDDLLLWO.',
  '....OOMMOMMOOOMMMMMMOOMMMMMOMMMMOMMMOMMMOMMOMMMOMLLLLDLO.',
  '......OO.OOMMMMMMMMOMMMMMOOMMMMOMMMOMMMOMMMOMMMOMMLDLLLO.',
  '........OMMMMMMMMOOMMMMMOMMMMMOMMMOMMMMOMMOMMMOMMMOLDLDDO',
  '........OMMMMMMOOMMMMMMOMMMMMOMMMMOMMMOMMMOMMMOMMMOMLDDLO',
  '........OMMOMOOMMMMMMOOMMMMMOMMMMOMMMOMMMOMMMOMMMOMMMLLLO',
  '.........OO.OMMMMMMMOMMMMMMOMMMMOMMMMOMMMOMMMOMMMOMMMOLDO',
  '...........OMMMMMOMOMMMMMOOMMMMOMMMMOMMMOMMMOMMMOMMMOMMO.',
  '...........OMMMMO.OMMMMMOMMMMMOMMMMOMMMMOMMMOMMMOMMMOMMO.',
  '...........OOMMO.OMMMMMOMMMMMOMMMMMOMMMOMMMOMMMMOMMMOMMO.',
  '.............OO.OMMMMOOMMMMMMOMMMMOMMMMOMMMOMMMOMMMOMMO..',
  '................OMMMO.OMMMMMOMMMMOMMMMOMMMMOMMMOMMMOMMO..',
  '................OMMO.OMMMMMOMMMMOMMMMOMMMMOMMMMOMMMOMMO..',
  '................OOO.OMMMMOOMMMMMOMMMMOMMMMOMMMOMMMOMMO...',
  '....................OMMMO.OMMMMOMMMMOMMMMOMMMMOMMMOMMO...',
  '....................OOOO.OMMMMOMMMMMOMMMMOMMMMOMMMOMMO...',
  '.........................OMMMOOMMMMOMMMMOMMMMOMMMOOMMO...',
  '..........................OOO..OMMO.OMMOOMMMOOMMO.OOO....',
  '...............................OOO..OOO..OOO..OO..O......',
];
const WING_ROOT = 21;
const TONE: Record<string, number> = { O: 0, D: 2, M: 3, L: 4, W: 5, H: 6 };

// RotSprite: the drawing scaled up 8x by Scale2x three times (which keeps its edges clean), turned about its root and
// sampled back at 1x, so it turns to any angle and stays crisp pixel art. `turned(deg)`: the wing turned `deg` degrees up
// from level (the tip rising), as rows with the root at the right edge, and the root's row
const scale2x = (g: string[][]): string[][] => {
  const h = g.length, w = g[0].length, at = (y: number, x: number) => g[Math.min(Math.max(y, 0), h - 1)][Math.min(Math.max(x, 0), w - 1)];
  const o = Array.from({ length: 2 * h }, () => Array<string>(2 * w).fill('.'));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const P = g[y][x], A = at(y - 1, x), B = at(y, x + 1), C = at(y, x - 1), E = at(y + 1, x);
    o[2 * y][2 * x] = C === A && C !== E && A !== B ? A : P;
    o[2 * y][2 * x + 1] = A === B && A !== C && B !== E ? B : P;
    o[2 * y + 1][2 * x] = E === C && E !== B && C !== A ? C : P;
    o[2 * y + 1][2 * x + 1] = B === E && B !== A && E !== C ? E : P;
  }
  return o;
};
const BIG = scale2x(scale2x(scale2x(WING.map((r) => [...r])))), S = 8;
const TURNS = new Map<number, [string[], number]>();
const turned = (deg: number): [string[], number] => {
  const hit = TURNS.get(deg);
  if (hit) return hit;
  const w = WING[0].length, h = WING.length, a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a), R = w + h;
  const px = new Map<string, string>();
  let x0 = 0, y0 = R, y1 = -R;
  for (let oy = -R; oy < R; oy++) for (let ox = -R; ox < 0; ox++) { // each screen pixel left of the root takes the one it came from
    const x = ox + 0.5, y = oy + 0.5, dx = x * c + y * s, dy = -x * s + y * c;
    const bx = Math.floor((dx + w) * S), by = Math.floor((dy + WING_ROOT) * S);
    if (bx < 0 || bx >= w * S || by < 0 || by >= h * S || BIG[by][bx] === '.') continue;
    px.set(`${ox},${oy}`, BIG[by][bx]);
    (x0 = Math.min(x0, ox)), (y0 = Math.min(y0, oy)), (y1 = Math.max(y1, oy));
  }
  const rows = Array.from({ length: y1 - y0 + 1 }, (_, j) => Array.from({ length: -x0 }, (_, i) => px.get(`${x0 + i},${y0 + j}`) ?? '.').join(''));
  const out: [string[], number] = [rows, -y0];
  TURNS.set(deg, out);
  return out;
};

// where a wing is this frame: `turn` its angle (degrees up from level), and `fold` how far it has folded over (below)
// `fold` folds the wing over onto itself, like a page being turned: its tip travels in a straight line from where it is
// towards `end` (`s` of the way, 0..1), and everything past the crease (the line halfway between where the tip was and where
// it is heading, square to its path) turns over across it and lies on top at `z` (the folded layers in reverse order, as a
// turned page shows its underside). The crease slides in from the tip as the fold goes on, so the whole wing changes shape.
// The part right by the crease turns fully over first and the outer part of the wing less, so the fold's edge leads and the
// tip trails behind it, catching up as the fold finishes
type Fold = { s: number; end: Pt; z: number };
function drawnWing(f: Figure, root: Bone, turn: number, dim: number, z: number, fold?: Fold): void {
  // each run of same-shade pixels in a row becomes one small flat part, placed on whole pixels from the root, its shade
  // set exactly (a detail on every pixel it covers)
  const parts: { pts: Pt[]; z: number; det: D[] }[] = [];
  const [rows, ay] = turned(turn), ax = rows[0].length;
  const place = ([x, y]: Pt): Pt => [x - ax, y - ay];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; ) {
      const ch = row[x];
      if (ch === '.') { x++; continue; }
      let e = x;
      while (e < row.length && row[e] === ch) e++;
      const det: D[] = [];
      for (let i = x; i < e; i += 0.5) for (const j of [0.25, 0.75]) det.push([...place([i + 0.25, y + j]), PEARL, TONE[ch]] as D);
      const g = 0.45; // each run a little bigger than its pixels, so, folded over, the runs still close up with no gaps (under half a pixel, so square on the grid it never spills into a neighbour)
      parts.push({ pts: ([[x - g, y - g], [e + g, y - g], [e + g, y + 1 + g], [x - g, y + 1 + g]] as Pt[]).map(place), z: z + y * 0.0001 + (ch === 'O' ? 0 : 0.001), det });
      x = e;
    }
  });
  const look = { outline: false, profile: 'flat' as const, dim };
  if (!fold || fold.s <= 0.001) { for (const p of parts) f.part(root, p.pts, PEARL, p.z, { ...look, details: p.det }); return; }
  let T: Pt = [0, 0];
  for (const p of parts) for (const q of p.pts) if (Math.hypot(...q) > Math.hypot(...T)) T = q;
  const T2: Pt = [T[0] + (fold.end[0] - T[0]) * fold.s, T[1] + (fold.end[1] - T[1]) * fold.s];
  const dl = Math.hypot(T2[0] - T[0], T2[1] - T[1]) || 1, n: Pt = [(T2[0] - T[0]) / dl, (T2[1] - T[1]) / dl];
  const M: Pt = [(T[0] + T2[0]) / 2, (T[1] + T2[1]) / 2];
  const side = (q: Pt) => (q[0] - M[0]) * n[0] + (q[1] - M[1]) * n[1]; // < 0: past the crease
  const reach = Math.max(3, -side(T)); // how far past the crease the tip is
  const lag = 0.85 * (1 - fold.s ** 2); // how far the tip trails: most early on, none once it is over
  const flip = (q: Pt): Pt => {
    // the whole outer part of the wing (the long flight feathers, out past about half way along it) trails as one, not
    // just the last feather: how far along the wing a point is, from her back to the tip, eased in from 45% to 70%
    const d = side(q), w = Math.min(1, Math.hypot(...q) / Math.hypot(...T));
    const r = Math.max(0, Math.min(1, (w - 0.45) / 0.25)), outer = r * r * (3 - 2 * r);
    const phi = Math.PI * (1 - lag * outer * Math.min(1, (-d / reach) * 3)); // turned fully over by the crease, less out to the tip (eased in just past the crease, so it bends there rather than tears)
    const moved = d * Math.cos(phi) - d; // its new distance from the crease, seen from the front
    return [q[0] + moved * n[0], q[1] + moved * n[1]];
  };
  const fine = (poly: Pt[]): Pt[] => poly.flatMap((a, i) => { // extra points along each edge, so the rolled part bends smoothly
    const b = poly[(i + 1) % poly.length], k = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1.5));
    return Array.from({ length: k }, (_, j) => [a[0] + ((b[0] - a[0]) * j) / k, a[1] + ((b[1] - a[1]) * j) / k] as Pt);
  });
  const clip = (poly: Pt[], keep: (d: number) => boolean): Pt[] => { // the part of a polygon on one side of the crease
    const out: Pt[] = [];
    poly.forEach((a, i) => {
      const b = poly[(i + 1) % poly.length], da = side(a), db = side(b);
      if (keep(da)) out.push(a);
      if (keep(da) !== keep(db)) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    });
    return out;
  };
  const zs = parts.map((p) => p.z), zMax = Math.max(...zs);
  for (const p of parts) {
    const stay = clip(p.pts, (d) => d >= 0), over = fine(clip(p.pts, (d) => d < 0));
    if (stay.length >= 3) f.part(root, stay, PEARL, p.z, { ...look, details: p.det.filter(([x, y]) => side([x, y]) >= 0) });
    if (over.length >= 3) // folded over: mirrored across the crease, on top of everything, the stacking turned upside down
      f.part(root, over.map(flip), PEARL, fold.z + (zMax - p.z), { ...look, dim: Math.max(0, dim - 1), details: p.det.filter(([x, y]) => side([x, y]) < 0).map(([x, y, m, t]) => [...flip([x, y]), m, t] as D) });
  }
}

// clerical embroidery: a gold band with small white crosses in it, from x0 to x1 at y (3 px tall)
const crosses = (x0: number, x1: number, y: number, step = 3.2): D[] => {
  const out: D[] = [];
  for (let x = x0 + 1; x <= x1 - 1; x += step) out.push([x, y - 1, 'white', 6], [x - 1, y, 'white', 6], [x, y, 'white', 6], [x + 1, y, 'white', 6], [x, y + 1, 'white', 6]);
  return out;
};

type WingPose = { s: number; turn: number; farTurn: number; tuck?: Pt; end?: Pt; farEnd?: Pt };
type FPose = Pose & { wings: WingPose; shot?: number; glory?: number };

function angel(p: FPose): Figure {
  const f = new Figure(W, H);
  const hip = new Bone(X0 + p.hip[0], HIP_Y + p.hip[1]);
  const torso = hip.child(0, 0, p.lean);

  // the wings, both behind her: the far one set higher and a tone darker. A drawn wing sits square on the pixel grid: its
  // root takes her back's position (in whole pixels) but not its tilt; `tuck` moves both roots in along her back
  const wg = p.wings, [tx, ty] = wg.tuck ?? [0, 0];
  const sq = (b: Bone) => new Bone(Math.round(b.x), Math.round(b.y), 0);
  drawnWing(f, sq(torso.child(1.5 + tx, -15.6 + ty, 0)), wg.farTurn, 1, 0, { s: wg.s, end: wg.farEnd ?? FOLD_END_FAR, z: 0.2 });
  drawnWing(f, sq(torso.child(-2.6 + tx, -14.8 + ty, 0)), wg.turn, 0, 0.4, { s: wg.s, end: wg.end ?? FOLD_END, z: 7.6 }); // folded over, it lies over her arm and the staff too
  const head = torso.child(0.8, -19.5, p.head);
  const hb = new Bone(Math.round(head.x), Math.round(head.y), head.a); // the face sits on whole pixels
  // her braid, down her back between the wings, bound in gold
  const nape = head.at(-3.8, -2.8);
  const braid = new Bone(nape[0], nape[1], 0.22 - p.lean * 0.6 + p.plume);
  const plaits: D[] = [];
  for (let y = 0.8; y < 13; y += 1.7) plaits.push([-0.5, y, 'hair', 1], [0.6, y + 0.8, 'hair', 5]);
  f.part(braid, [[-1.7, 0], [1.7, 0], [1.4, 12], [0, 14.5], [-1.4, 12]], 'hair', 0.8, { details: plaits });
  f.part(braid, ell(0, 13.2, 1.4, 1.1), 'gold', 0.85);

  // no armour: durable cloth. Linen hose, and soft boots of wrapped linen bound with gold cord
  legs(hip, p.feet, (th, sh, ft, z, dim) => {
    f.part(th, [[-3.2, -1.5], [3.2, -1.5], [2.6, 11.4], [-2.6, 11.4]], CLOTH, z, { dim: dim + 1, folds: [0.35, 2.4, 1] });
    const cord: D[] = [];
    for (let y = 1; y < 10.5; y += 2.2) cord.push([-1.2, y, 'gold', 4], [0, y + 0.6, 'gold', 4], [1.2, y + 1.2, 'gold', 4]);
    f.part(sh, [[-2.4, 0], [2.4, 0], [2.3, 11], [-2.3, 11]], 'bone', z + 0.1, { dim, details: cord, folds: [0.4, 1.8, 1] });
    f.part(ft, [[-2.6, -1.5], [2.3, -1.5], [4.8, 0.8], [5.4, 3], [-2.8, 3]], 'bone', z + 0.15, { dim: dim + 1 });
  });

  // the robe: long, to her calves, open at the front over the near leg; its hem embroidered with a band of crosses
  const skirt = torso.child(0, -3, p.skirt * 0.6 - p.lean * 0.4);
  f.part(skirt, [[-6.6, 0], [0.6, 0], [-0.4, 19.6], [-10, 18.4]], CLOTH, 2.95, { dim: 1, folds: [0.5, 2.4, 0] }); // the back of the robe
  f.part(skirt, [[-10, 16.4], [-0.5, 17.6], [-0.4, 19.6], [-10, 18.4]], 'gold', 2.96, { profile: 'flat', dim: 1, details: crosses(-10, -0.5, 17.8) });
  f.part(skirt, [[3.6, 0], [6.8, 0], [10.2, 17.8], [5.2, 18.8]], CLOTH, 3.0, { folds: [0.5, 2.4, 0] }); // its front edge, falling open past the near leg
  f.part(skirt, [[5, 16.8], [10.1, 15.8], [10.2, 17.8], [5.2, 18.8]], 'gold', 3.01, { profile: 'flat', details: crosses(5, 10.1, 17.1, 3) });
  // the tabard: a long panel down the front, edged in gold, one gold cross embroidered on it and a gold band at its foot
  const tab = torso.child(2.6, -4, p.skirt * 0.9 - p.lean * 0.5);
  const cross: D[] = [];
  for (let y = 5; y <= 11; y++) cross.push([0, y, 'gold', y === 7 ? 6 : 4]);
  for (let x = -2; x <= 2; x++) cross.push([x, 7, 'gold', x === 0 ? 6 : 4]);
  f.part(tab, [[-3, 0], [3, 0], [3.2, 16], [0, 17.8], [-3.2, 16]], CLOTH, 3.4, { trim: ['gold', 0.9], folds: [0.3, 3, 1], details: [...cross, ...line([-2.4, 14.6], [2.4, 14.6], 'gold', 4, 0.6)] });
  // the bodice, fitted to her: narrower shoulders, the bust curving forward on the side she faces with a soft shadow under
  // it, a narrow waist where the belt cinches it, and the hips widening into the robe
  f.part(torso, [[-5, -17.6], [4.6, -17.6], [6.2, -14.6], [7.4, -12], [7, -10.2], [5.2, -8.6], [4.4, -7], [4.8, -5], [6.6, -2], [-6.4, -2], [-4.6, -5], [-4.2, -7.6], [-5.4, -12.4]], CLOTH, 3.1, {
    folds: [0.35, 2.4, 0], details: [...line([3.4, -9.6], [6.6, -10], CLOTH, 2, 0.6), ...line([5.2, -13.4], [6.4, -12], CLOTH, 5, 0.6)],
  });
  // over it a fitted bodice of gold brocade, laced up the front: it follows her shape (the bust, the narrow waist) so her
  // figure reads against the white of the robe and sleeves
  const brocade: D[] = [];
  for (let y = -15; y <= -7.5; y += 2) for (let x = -3.8 + ((y + 15) % 4 ? 1 : 0); x <= 5; x += 2) brocade.push([x, y, 'gold', 2]);
  const lace: D[] = [];
  for (let y = -13; y <= -7; y += 1.5) lace.push([4.6 - (y + 13) * 0.08, y, 'white', 6]);
  f.part(torso, [[-4.2, -15.6], [4.8, -15.6], [6.6, -13.4], [7.2, -11.6], [6.6, -10], [4.9, -8.6], [4.3, -6.4], [-4.3, -6.4], [-4, -8.2], [-4.8, -12.6]], 'gold', 3.2, {
    trim: ['gold', 0.9], details: [...brocade, ...lace, ...line([3.2, -9.6], [6.4, -10.2], 'gold', 1, 0.6)],
  });
  // the stole: a gold band from the far shoulder down her front past the belt to her knees, a cross near its end, fringed
  const stole = torso.child(-2.6, -16.4, p.skirt * 0.5 - p.lean * 0.4);
  f.part(stole, [[-1.3, 0], [1.3, 0], [1.4, 25], [-1.4, 25]], 'gold', 3.6, { details: [[0, 20, 'white', 6], [-1, 21, 'white', 6], [0, 21, 'white', 6], [1, 21, 'white', 6], [0, 22, 'white', 6], ...line([-1.2, 25.6], [1.2, 25.6], 'gold', 2, 0.8)] });
  // a braided rope belt cinched at her waist, knotted at the side, its ends hanging with tassels
  const rope: D[] = [];
  for (let x = -4.4; x <= 4.8; x += 1.2) rope.push([x, -5.8, 'bone', 5], [x + 0.6, -5, 'bone', 2]);
  f.part(torso, [[-4.6, -6.6], [4.9, -6.6], [4.9, -4.2], [-4.6, -4.2]], 'bone', 3.65, { profile: 'flat', details: rope });
  const knot = torso.child(4, -5, p.skirt * 0.8 - p.lean * 0.4);
  f.part(knot, ell(0, 0, 1.6, 1.4), 'bone', 3.66);
  for (const [x, len] of [[-0.6, 9], [0.8, 7]] as const) f.part(knot, [[x - 0.5, 0.6], [x + 0.5, 0.6], [x + 0.5, len], [x - 0.5, len]], 'bone', 3.64, { profile: 'flat', details: [[x, len - 0.6, 'gold', 4], [x, len - 1.6, 'gold', 5]] });
  f.part(torso, [[-2.4, -20.6], [2, -20.6], [2.6, -17], [-2.8, -17]], FAIR, 3.15); // a slender neck
  // a small collar mantle round her shoulders only, its edge embroidered in gold, so the shape of the bodice shows under it
  const mantle: Pt[] = [[-6.2, -18.8], [5.4, -18.8], [6.6, -16.4], [5.2, -14.6], [2, -15.4], [-1.4, -15], [-4.6, -14.6], [-6.8, -16]];
  const edge: D[] = [...line([5.6, -15.2], [2, -16], 'gold', 4, 0.6), ...line([2, -16], [-1.4, -15.6], 'gold', 4, 0.6), ...line([-1.4, -15.6], [-4.6, -15.2], 'gold', 4, 0.6), ...line([-4.6, -15.2], [-6.4, -16.2], 'gold', 4, 0.6)];
  f.part(torso, mantle, CLOTH, 3.7, { folds: [0.4, 2.2, 0], details: [...edge, ...line([-3.6, -18.2], [3.4, -18.2], 'gold', 5, 0.6)] });
  // a long lock of hair falling behind her far shoulder, down her back past the mantle
  const lock = head.child(-3, 0.6, 0.35 + p.lean * 0.3);
  f.part(lock, [[-1.4, -1], [1.4, -1], [1.6, 6], [0.8, 10], [0, 11.4], [-0.8, 9], [-1.2, 4]], 'hair', 3.05, { details: [...line([0.2, 0], [0.4, 9], 'hair', 5, 0.8)] });

  // the head: hair behind the face, the face (a three-quarter face like the champions', both eyes showing), the halo
  f.part(head, [[-5.6, 1.6], [-6, -5.6], [-4, -10.2], [0, -11.8], [3.8, -10.8], [5.6, -8.6], [5.2, -5.6], [-1, -4], [-2.4, 2.4]], 'hair', 4.9, { folds: [0.5, 1.4, 0], details: [...line([-4.4, -8.4], [1.8, -10.8], 'hair', 5), ...line([-5, -4], [-3.4, -9], 'hair', 2)] });
  // three-quarter face, columns x -3..5 and rows y -8..1 from the head bone, turned towards the side she faces: the near eye
  // wide, the far eye narrower by the nose, the nose's edge just past the cheek, the mouth under it. h/l hair, S skin edge,
  // M skin, L light, K lashes and brows, W the eye's white, E the iris, N the shadow by the nose, P the lips
  const FACE = [
    '.hhllhhh.',
    'hllLLllh.',
    'hhLLLLMh.',
    'hKKKMMKK.',
    'hMWEMMWES',
    'hMMMMNMMS',
    'hSLMMNMS.',
    '.SMMLPPS.',
    '..SMMPS..',
    '...SS....',
  ];
  const tone: Record<string, [Material, number]> = {
    h: ['hair', 2], l: ['hair', 4], S: [FAIR, 2], M: [FAIR, 4], L: [FAIR, 5], K: ['black', 2], W: ['white', 6], E: ['blue', 2], N: [FAIR, 3], P: ['red', 5],
  };
  const fd: D[] = [];
  FACE.forEach((row, r) => [...row].forEach((ch, c) => { if (tone[ch]) fd.push([c - 3 + 0.5, r - 8 + 0.5, ...tone[ch]]); }));
  // the face, the fringe and the halo sit above everything else, so a wing folded over her never hides her face
  f.part(hb, [[-3, -8], [5, -8], [6, -5], [6, -3], [5, -1], [3, 2], [0, 2], [-3, 0]], FAIR, 8.5, { profile: 'flat', details: fd });
  f.part(hb, [[-4.6, -9.4], [-1, -11.4], [3.6, -10.8], [5.8, -8.6], [4.6, -8.2], [1, -8.8], [-2.6, -7.6], [-3.4, -4], [-4.8, -3]], 'hair', 8.6, { details: [...line([-3, -9], [3.4, -10.2], 'hair', 5)] }); // hair over the brow, swept back
  f.part(head.child(-0.6, -14.6, -0.12 - p.plume), ell(0, 0, 4.8, 1.3, 24), 'glow', 8.7, { profile: 'flat', details: [[-2.6, -0.3, 'glow', 6], [1.8, -0.3, 'glow', 6]] }); // halo

  // the sleeves widen to embroidered cuffs. The near arm behind her body, the hand just past her hip
  const sleeve = (up: Bone, fo: Bone, z: number, dim: number) => {
    f.part(up, [[-1.9, -1], [1.9, -1], [1.7, 8], [-1.7, 8]], CLOTH, z, { dim, folds: [0.4, 2.5, 1] });
    f.part(fo, [[-1.8, -0.5], [1.8, -0.5], [2.8, 5.6], [-2.8, 5.6]], CLOTH, z + 0.1, { dim, folds: [0.4, 2.2, 1] });
    f.part(fo, [[-2.9, 4.2], [2.9, 4.2], [3.1, 5.8], [-3.1, 5.8]], 'gold', z + 0.11, { dim, profile: 'flat', details: [[0, 5, 'white', 6]] });
  };
  const nsh = torso.at(4.8, -15.4);
  const [nup, nfo] = arm(nsh, [nsh[0] + p.off[0], nsh[1] + p.off[1]]);
  sleeve(nup, nfo, 2.5, 1);
  f.part(nfo, ell(0, 6.8, 1.6, 1.7), FAIR, 2.65, { dim: 1 });
  // the casting arm, the far one, in front of her body, the hand on the staff
  const fsh = torso.at(-4.6, -15.6);
  const fist: Pt = [fsh[0] + p.fist[0], fsh[1] + p.fist[1]];
  const [up, fo] = arm(fsh, fist);
  const za = p.za;
  // the scepter-staff through her hand: a white shaft bound in gold, a gold foot, and at the top a gold sun-ring with small
  // wings, holding the light; `fx` swells the light as she charges a bolt
  const st = new Bone(fist[0], fist[1], p.wpn);
  const bands: D[] = [];
  for (const y of [-19, -10, 6, 14]) bands.push([-0.5, y, 'gold', 4], [0.5, y, 'gold', 4]);
  f.part(st, [[-0.9, -26], [0.9, -26], [0.9, 17], [-0.9, 17]], PEARL, za - 0.05, { details: bands });
  f.part(st, [[-1.3, 16.5], [1.3, 16.5], [0, 19.5]], 'gold', za - 0.04);
  const top = st.child(0, -31);
  f.part(top, [[-1.6, 5.8], [1.6, 5.8], [1.1, 3.6], [-1.1, 3.6]], 'gold', za - 0.03); // the collar under the ring
  for (const s of [-1, 1]) f.part(top, [[s * 2, 2.6], [s * 6.2, -1.4], [s * 7.2, 1.2], [s * 5.4, 2.2], [s * 6, 3.6], [s * 3, 4.2]], 'gold', za - 0.035, { dim: s < 0 ? 1 : 0 }); // its little gold wings
  const ring: Pt[] = [], hole: Pt[] = [];
  for (let k = 0; k <= 24; k++) { const a = (k / 24) * 2 * Math.PI; ring.push([Math.cos(a) * 3.8, Math.sin(a) * 3.8]); hole.unshift([Math.cos(a) * 2.5, Math.sin(a) * 2.5]); }
  f.part(top, [...ring, ...hole], 'gold', za - 0.02); // the sun-ring
  for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4 + 0.39; f.part(top, [[Math.cos(a - 0.2) * 3.6, Math.sin(a - 0.2) * 3.6], [Math.cos(a) * 5.4, Math.sin(a) * 5.4], [Math.cos(a + 0.2) * 3.6, Math.sin(a + 0.2) * 3.6]], 'gold', za - 0.025, { profile: 'flat' }); } // its rays
  const r = 1.6 + 1.8 * p.fx;
  f.part(top, ell(0, 0, r, r, 16), 'glow', za - 0.01, { outline: false, details: [[0, 0, 'glow', 6]] }); // the light it holds
  const shot = p.shot ?? 0; // the bolt leaving the ring (0..1): a flash of rays, the bolt just clear
  if (shot > 0) {
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4 + 0.2, L = (k % 2 ? 4 : 7) * (1.2 - shot * 0.5), c = Math.cos(a), n = Math.sin(a);
      f.part(top, [[c * 2 - n * 0.8, n * 2 + c * 0.8], [c * (2 + L), n * (2 + L)], [c * 2 + n * 0.8, n * 2 - c * 0.8]], 'glow', 8.1, { profile: 'flat', outline: false });
    }
    const b = 5 + shot * 7; // the bolt, flying out ahead of the staff with a short trail
    f.part(top, [[-1.2, -b + 3.4], [1.2, -b + 3.4], [0.6, -b - 1], [-0.6, -b - 1]], 'glow', 8.15, { profile: 'flat', outline: false, dim: 2 });
    f.part(top, ell(0, -b - 1.6, 2.1, 2.1, 14), 'glow', 8.2, { outline: false, details: [[0, -b - 1.6, 'glow', 6]] });
  }
  const glory = p.glory ?? 0; // the cast's burst (0..1): a star of long and short rays round
  // the ring and a wide soft light behind it, over everything
  if (glory > 0) {
    const lit: D[] = []; // lit all through, so it reads as light, not a gold ball
    for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) lit.push([x, y, 'glow', Math.hypot(x, y) < 3 ? 6 : 5]);
    f.part(top, ell(0, 0, 2.5 + 3.5 * glory, 2.5 + 3.5 * glory, 24), 'glow', 8.05, { outline: false, profile: 'flat', details: lit });
    for (let k = 0; k < 12; k++) {
      const a = (k * Math.PI) / 6, L = (k % 2 ? 6 : 13) * glory, c = Math.cos(a), n = Math.sin(a), w = k % 2 ? 0.8 : 1.2;
      f.part(top, [[c * 3 - n * w, n * 3 + c * w], [c * (4 + L), n * (4 + L)], [c * 3 + n * w, n * 3 - c * w]], 'glow', 8.1, { profile: 'flat', outline: false });
    }
    f.part(top, ell(0, 0, 3.4, 3.4, 16), 'glow', 8.15, { outline: false, details: [[0, 0, 'glow', 6]] });
  }
  sleeve(up, fo, za, 0);
  f.part(st, ell(0.2, 0.2, 1.8, 2), FAIR, za + 0.15); // her hand round the shaft
  return f;
}

// `fist` is the casting hand, the far one in front of her body, with the staff (`wpn` its angle); `off` the near hand
const REST: Partial<Pose> = { fist: [12, 15], wpn: 0.2, off: [2.4, 11.5], za: 7 };
// she flies: she hovers HOVER px off the ground (the game draws her shadow on the ground under her, so the gap shows), her
// legs hanging, toes pointed, the far foot a little behind the near one. `up` lifts her further; `back` moves her that many
// whole pixels backwards (whole, so the drawn wing keeps landing on the screen's pixels)
const HOVER = 5;
const DANGLE: Pose['feet'] = [[-3.5, HOVER + 2.2, 0.95], [0.5, HOVER + 1, 0.8]];
const fly = (kw: Partial<FPose>, up = 0, back = 0): FPose => {
  const q = pose(REST, kw as Partial<Pose>) as FPose;
  const feet = (kw.feet ? kw.feet.map(([x, l, a]) => [x, l + HOVER + up, a]) : DANGLE.map(([x, l, a]) => [x, l + up, a])).map(([x, l, a]) => [x - back, l, a]) as Pose['feet'];
  return { ...q, hip: [q.hip[0] - back, q.hip[1] - HOVER - up], feet };
};
// the wings at rest: the drawing turned 20 degrees up, so they point up and back (level, she'd look as if flying backwards);
// the far one the same, behind her. `s` folds them (0 spread .. 1 folded over her): the tip travels down across her to below
// her near hip (FOLD_END, from the wing's root: low enough that the folded wing lies over her body, not her face)
const FOLD_END: Pt = [16, 44], FOLD_END_FAR: Pt = [14, 40];
const rest = (s = 0): WingPose => ({ s, turn: 20, farTurn: 20 });
// the wing's sweep forward over her pushes her back a little; she drifts forward again as it opens (a touch behind the wing)
const drift = (s: number) => Math.round(3 * s);

// idle: she hovers, the wings beating by the fold (it eases in and out, so it starts and settles slowly); she rises with each
// beat and drifts back and forward with it
const HOVER_FRAMES = 16, HOVER_MS = 55;
const IDLE = Array.from({ length: HOVER_FRAMES }, (_, i) => {
  const ph = (2 * Math.PI * i) / HOVER_FRAMES;
  return fly({ lean: 0.04, head: -0.04, wings: rest(0.5 - 0.5 * Math.cos(ph)), skirt: 0.03 * Math.sin(ph - 1) }, 2.2 - Math.cos(ph - 2.6) * 2, drift(0.5 - 0.5 * Math.cos(ph - 0.8)));
});
// the glide that replaces the walk: leaning into the way she goes, legs trailing, the robe streaming back. The wings beat by
// the same fold, quicker, and turned further up (her lean tips them forward). Turned up this far a wing would stand off her
// back, so its root moves in and down her back until its bottom edge tucks behind her; and with the lean her hip sits further
// back under the root, so the tip travels less far forward
const GLIDE_FRAMES = 8, GLIDE_MS = 60;
const GLIDE = Array.from({ length: GLIDE_FRAMES }, (_, i) => {
  const ph = (2 * Math.PI * i) / GLIDE_FRAMES;
  const wings: WingPose = { s: 0.5 - 0.5 * Math.cos(ph), turn: 45, farTurn: 55, tuck: [4, 5], end: [8, 42], farEnd: [6, 38] };
  return fly({ lean: 0.42, head: -0.34, wings, wpn: 0.5, skirt: -0.38 - 0.05 * Math.sin(ph), feet: [[-11, 6.4, 1.35], [-7.5, 4.8, 1.25]] }, 1.4 - Math.cos(ph - 2.6) * 1.2); // the fold lifts her, a touch after it
});
// the attack: she draws the staff back as the light in its ring swells, swings it forward to point at her target and the
// bolt leaves the ring in a flash (the impact frame), then she brings the staff back up. The wings beat through it
const SHOT: [number, Partial<FPose>][] = [
  [200, { fist: [12, 15], wpn: 0.2, fx: 0.3 }],
  [100, { fist: [11, 10], wpn: -0.08, fx: 0.7, head: -0.04 }],
  [110, { fist: [13, 8], wpn: -0.2, fx: 1, head: -0.06 }],
  [60, { fist: [13, 6], wpn: 0.9, fx: 1 }],
  [170, { fist: [15, 6], wpn: 1.3, fx: 0, shot: 0.4 }],
  [120, { fist: [13, 11], wpn: 0.7, fx: 0.2, shot: 1 }],
];
const ATTACK: [number, FPose][] = SHOT.map(([ms, kw], i) => [ms, fly({ lean: 0.06 + (i === 4 ? 0.08 : 0), head: -0.04, wings: rest([0, 0.2, 0.5, 0.8, 1, 0.4][i]), ...kw }, [1.2, 1.6, 2, 2.2, 1.6, 1][i], drift([0, 0.1, 0.3, 0.6, 0.9, 0.7][i]))]);
// the cast, Heavenly Radiance (a burst of light round her that heals her and smites everything near): still hovering, she
// raises the staff over her head as both wings sweep up and open to their full spread, the far one high above the near one
// so the two fan apart (their roots tucked in along her back as they rise, as in the glide); the ring's light swells, and at
// the top it bursts (the game's ring and sparks go out from her then); she holds it a moment, then lowers the staff and the
// wings settle
const tuck = (t: number): Pt => { const k = Math.max(0, Math.min(1.6, (t - 20) / 25)); return [Math.round(4 * k), Math.round(5 * k)]; };
const RADIANCE: [number, Partial<FPose>, number, number, number][] = [ // ms, pose, near wing's turn, far wing's, lift
  [140, { fist: [13, 10], wpn: 0.1, fx: 0.5 }, 25, 40, 2],
  [120, { fist: [14, 2], wpn: 0.12, fx: 0.8, head: -0.08 }, 35, 60, 3],
  [120, { fist: [14, -5], wpn: 0.12, fx: 1, head: -0.12 }, 40, 75, 4],
  [260, { fist: [14, -7], wpn: 0.12, fx: 1, glory: 1, head: -0.14 }, 45, 80, 5],
  [200, { fist: [14, -6], wpn: 0.12, fx: 0.7, glory: 0.55, head: -0.12 }, 45, 80, 5],
  [160, { fist: [13, 4], wpn: 0.15, fx: 0.3 }, 35, 55, 3],
  [140, { fist: [12, 13], wpn: 0.18, fx: 0.3 }, 20, 35, 2],
];
const CAST: [number, FPose][] = RADIANCE.map(([ms, kw, t, ft, up]) => [ms, fly({ lean: 0.02, head: -0.04, wings: { s: 0, turn: t, farTurn: ft, tuck: tuck(t) }, ...kw }, up)]);
// hurt: too quick for the wings, so she parries with the staff: she snaps it across in front of her body, its head tipped
// forward towards what struck her, as she flinches back a pixel or two, then brings it back up. Her wings stay spread
const HURT: [number, FPose][] = ([
  [50, { lean: -0.12, head: -0.1, fist: [15, 9], wpn: 0.48, fx: 0.6 }, 1.6, 1],
  [130, { lean: -0.1, head: -0.12, fist: [16, 8], wpn: 0.6, fx: 0.8 }, 1.4, 2],
  [70, { lean: -0.04, head: -0.05, fist: [14, 11], wpn: 0.3, fx: 0.5 }, 1.2, 1],
] as [number, Partial<FPose>, number, number][]).map(([ms, kw, up, back]) => [ms, fly({ wings: rest(), ...kw }, up, back)]);

// death: she doesn't fall, she ascends. She rises with her wings spread and her head raised, and turns to light: her whole
// body, wings and staff take on the glow's colours (their shading kept, so she still reads as herself) with a light round
// her edge; then the glowing figure draws in on her heart into a holy orb, which rises, shrinks and goes out (the last
// frame is empty)
const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mix = (a: string, b: string, t: number) => '#' + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');
/** `src` turned to light by `t` (0..1), drawn in on (cx, cy) to `k` of its size, with `over` (the orb) drawn on top */
class Glowing extends Figure {
  constructor(readonly src: Figure, readonly t: number, readonly k: number, readonly cx: number, readonly cy: number, readonly over?: Figure) { super(src.w, src.h); }
  moved(dx: number, dy: number, w: number, h: number): Figure {
    return new Glowing(this.src.moved(dx, dy, w, h), this.t, this.k, this.cx + dx, this.cy + dy, this.over?.moved(dx, dy, w, h));
  }
  render(): Map<number, string> {
    const { w, h, t, k, cx, cy } = this, base = this.src.render(), G = RAMPS.glow;
    const out = new Map<number, string>();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { // each pixel takes the one it came from, before drawing in
      const sx = Math.floor(cx + (x + 0.5 - cx) / k), sy = Math.floor(cy + (y + 0.5 - cy) / k);
      if (sx < 0 || sx >= w || sy < 0 || sy >= h) continue;
      const c = base.get(sy * w + sx);
      if (!c) continue;
      const [r, g, b] = hex(c), lum = (0.3 * r + 0.59 * g + 0.11 * b) / 255;
      out.set(y * w + x, mix(c, G[Math.min(6, 2 + Math.round(lum * 4.4))], t));
    }
    if (t >= 0.8) { // the light round her edge
      const edge: number[] = [];
      for (const q of out.keys()) { const x = q % w; for (const d of [-1, 1, -w, w]) { const n = q + d; if (!out.has(n) && !(d === -1 && x === 0) && !(d === 1 && x === w - 1)) edge.push(n); } }
      for (const q of edge) if (q >= 0 && q < w * h) out.set(q, G[3]);
    }
    if (this.over) for (const [q, c] of this.over.render()) out.set(q, c);
    return out;
  }
}
const orb = (f: Figure, x: number, y: number, r: number, rays = 0): Figure => {
  const lit: D[] = [];
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) { const d = Math.hypot(i, j) / r; lit.push([i, j, 'glow', d < 0.4 ? 6 : d < 0.75 ? 5 : 4]); }
  const at = new Bone(x, y);
  f.part(at, ell(0, 0, r, r, 28), 'glow', 9, { outline: false, profile: 'flat', details: lit });
  for (let k = 0; k < 8 && rays > 0; k++) {
    const a = (k * Math.PI) / 4 + 0.39, L = (k % 2 ? 0.5 : 1) * rays, c = Math.cos(a), n = Math.sin(a);
    f.part(at, [[c * r - n, n * r + c], [c * (r + L), n * (r + L)], [c * r + n, n * r - c]], 'glow', 9.1, { outline: false, profile: 'flat' });
  }
  return f;
};
const heart = (p: Pose): Pt => new Bone(X0 + p.hip[0], HIP_Y + p.hip[1]).child(0, 0, p.lean).at(1, -11);
const none = () => new Figure(W, H);
const DEATH = (): Frame[] => {
  const q = (up: number, head: number) => fly({ wings: { s: 0, turn: 45, farTurn: 55, tuck: tuck(45) }, lean: -0.08, head, fist: [12, 12], wpn: 0.08, fx: 1 }, up);
  const a = q(3, -0.2), b = q(6, -0.28), me = angel(b), [hx, hy] = heart(b);
  return [
    [150, angel(a)], // she rises, head raised
    [110, new Glowing(me, 0.5, 1, hx, hy)], // the light takes her
    [160, new Glowing(me, 1, 1, hx, hy)], // all light
    [90, new Glowing(me, 1, 0.7, hx, hy, orb(none(), hx, hy, 4))], // drawing in on her heart
    [90, new Glowing(me, 1, 0.42, hx, hy - 1, orb(none(), hx, hy - 1, 6, 3))],
    [100, orb(none(), hx, hy - 3, 8, 6)], // the holy orb
    [110, orb(none(), hx, hy - 9, 6, 4)], // rising, going out
    [110, orb(none(), hx, hy - 15, 4, 2)],
    [90, orb(none(), hx, hy - 20, 2)],
    [400, none()], // gone
  ];
};
// Blink: the game moves her at once, so this is her reappearing where she lands, the death run backwards and quicker: a
// spark of light swells to an orb, she grows out of it as a figure of light, and the light leaves her
const BLINK = (): Frame[] => {
  const p = fly({ wings: rest(), fx: 1 }, 2), me = angel(p), [hx, hy] = heart(p);
  return [
    [50, orb(none(), hx, hy, 2, 3)],
    [60, orb(none(), hx, hy, 6, 5)], // the orb
    [60, new Glowing(me, 1, 0.5, hx, hy, orb(none(), hx, hy, 4))], // she grows out of it
    [60, new Glowing(me, 1, 0.8, hx, hy)],
    [80, new Glowing(me, 1, 1, hx, hy)],
    [80, new Glowing(me, 0.45, 1, hx, hy)], // the light leaves her
    [100, angel(fly({ wings: rest(), fx: 0.7 }, 2))],
  ];
};

export const sprite: SpriteDef = {
  id: 'angel', w: W, h: H, anchor: [X0, 75], tall: 54,
  anims: {
    idle: IDLE.map((p) => [HOVER_MS, angel(p)]),
    walk: GLIDE.map((p) => [GLIDE_MS, angel(p)]),
    attack: ATTACK.map(([ms, p]) => [ms, angel(p)]),
    cast: CAST.map(([ms, p]) => [ms, angel(p)]),
    hurt: HURT.map(([ms, p]) => [ms, angel(p)]),
    death: DEATH(),
    skill: BLINK(),
  },
  impact: 4,
};
