/**
 * The Archer, redesigned (the look only: his abilities, stats and balance stay as they are). A hooded ranger of the woods,
 * masked and mottled for hiding in them: a hood and long cloak of grey-green cloth dappled with darker green and brown, a
 * brown cloth mask over his nose and mouth so only his eyes show, a laced leather jerkin over a green tunic, a belt with a
 * pouch and a hunting knife, a long leather bracer and a shooting glove, a quiver of fletched arrows on his back, wool
 * trousers and wrapped boots, and a great longbow. The bow is in his near hand, behind him, and hangs in front of his body;
 * the far hand, in front, draws the string. The cloak moves as cloth. The attack is one smooth draw and loose; the cast
 * (Arrow Volley) looses three arrows into the sky; the hurt catches the blow on the bow; the death is a fall to one knee and
 * onto his face; the skill (Dodge Roll) is the end of the roll, from his back to his feet. 54 px tall.
 */
import { arm, common, H, HIP_Y, legs, pose, W, X0, type Pose } from '../humanoid';
import { Bone, ell, Figure, type Material, type Pt } from '../rig';
import type { SpriteDef } from '../sheet';

type D = [number, number, Material, number];
const line = (a: Pt, b: Pt, mat: Material, tone: number, step = 0.7): D[] => {
  const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
  return Array.from({ length: n + 1 }, (_, k) => [a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n, mat, tone] as D);
};
const fine = (poly: Pt[], step = 1.5): Pt[] => poly.flatMap((a, i) => {
  const b = poly[(i + 1) % poly.length], k = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
  return Array.from({ length: k }, (_, j) => [a[0] + ((b[0] - a[0]) * j) / k, a[1] + ((b[1] - a[1]) * j) / k] as Pt);
});
// cloth that bends and ripples: a polygon cut into short edges, then each point moved by how far down the cloth it is
// (`d`, 0 at the top .. 1 at the hem): `swing` sways the lower part further than the top, and a ripple (`wave` its phase,
// `flap` its size) runs down to the hem
const wavy = (poly: Pt[], len: number, swing: number, wave: number, flap: number): Pt[] => fine(poly).map(([x, y]) => {
  const d = Math.max(0, Math.min(1, y / len));
  const r = Math.sin(2 * Math.PI * wave - y * 0.32 - x * 0.25) * flap * d;
  return [x - swing * 10 * d * d + r * 1.3, y + Math.abs(r) * 0.35 - swing * swing * 6 * d * d];
});

// mottled cloth, the woodland camouflage of a ranger: dapples of darker green and brown over the cloth, scattered in a fixed
// pattern so they stay put on the cloth as it moves
const mottle = (x0: number, y0: number, x1: number, y1: number, n = 40): D[] => {
  const out: D[] = [];
  for (let k = 0; k < n; k++) {
    const x = x0 + (((k * 37) % 41) / 41) * (x1 - x0), y = y0 + (((k * 23) % 43) / 43) * (y1 - y0);
    out.push([x, y, k % 3 ? 'moss' : 'hide', k % 3 ? 1 : 2], [x + 0.6, y + 0.4, k % 3 ? 'moss' : 'hide', 1]);
  }
  return out;
};

// his own pose fields: the cloth's ripple (`wave`, `flap`); `volley` how many arrows are on the string (Arrow Volley fans
// three); `loosed` (0..1) the volley's arrows flying up out of the frame; `closed` his eyes shut (dead)
type RPose = Pose & { wave?: number; flap?: number; volley?: number; loosed?: number; closed?: boolean };

function archer(p: RPose): Figure {
  const f = new Figure(W, H);
  const hip = new Bone(X0 + p.hip[0], HIP_Y + p.hip[1]);
  const torso = hip.child(0, 0, p.lean);
  const wv = p.wave ?? 0, fl = p.flap ?? 0.5;

  // the cloak, long and mottled, hanging from his shoulders down behind him to his calves, its hem a little ragged
  f.part(torso.child(-3, -18, (p.cape - 0.12) * 0.4 - p.lean * 0.7), wavy([[-1, 0], [5, 0], [4.4, 12], [3, 26], [1, 31], [-1.5, 29.6], [-4, 31.4], [-6.5, 29.4], [-9, 31], [-11, 29], [-11.6, 18], [-9, 7], [-5, 2]], 31, (p.cape - 0.12) * 1.5, wv, fl * 1.3), 'moss', 0, { dim: 1, folds: [0.7, 3, 0], details: mottle(-11, 2, 4, 30, 56) });

  // the quiver on his back, over the far shoulder: brown leather, arrows standing out of it with green and white fletching
  const quiver = torso.child(-6, -20, -0.55 + p.cape * 0.3);
  f.part(quiver, [[-2.6, 0], [2.6, 0], [2.4, 15], [-2.4, 15]], 'leather', 0.2, { trim: ['hide', 0.7], details: [...line([-2.2, 3], [2.2, 3], 'hide', 2, 0.6), ...line([-2.2, 11], [2.2, 11], 'hide', 2, 0.6)] });
  [-1.6, -0.2, 1.2, 2.2].forEach((x, k) => {
    f.part(quiver, [[x - 0.35, -3 - k * 0.8], [x + 0.35, -3 - k * 0.8], [x + 0.35, 0.5], [x - 0.35, 0.5]], 'bark', 0.1, { profile: 'flat' }); // shafts
    f.part(quiver, [[x - 0.9, -7 - k * 0.8], [x + 0.9, -7 - k * 0.8], [x + 0.8, -3.4 - k * 0.8], [x - 0.8, -3.4 - k * 0.8]], k % 2 ? 'white' : 'moss', 0.15, { dim: k % 2 ? 1 : 0 }); // fletching
  });

  legs(hip, p.feet, (th, sh, ft, z, dim) => {
    f.part(th, [[-3.4, -1.5], [3.4, -1.5], [2.8, 11.5], [-2.8, 11.5]], 'wool', z, { dim, folds: [0.3, 3, 1] }); // trousers
    const wrap: D[] = [];
    for (let y = 1; y < 9; y += 1.8) for (let x = -2.2; x <= 2.2; x += 0.8) wrap.push([x, y + (x + 2.2) * 0.35, 'hide', 2]);
    f.part(sh, [[-2.5, 0], [2.5, 0], [2.3, 11], [-2.3, 11]], 'hide', z + 0.1, { dim: dim + 1, details: wrap }); // wrapped boots
    f.part(ft, [[-2.6, -1], [2.4, -1], [5, 1], [5.6, 3], [-2.8, 3]], 'leather', z + 0.15, { dim: dim + 1 });
  });

  // the jerkin's tails over a green tunic skirt, split at the sides
  const skirt = torso.child(0, -3, p.skirt * 0.5 - p.lean * 0.4);
  const tails = (poly: Pt[], lag: number) => wavy(poly, 10, p.skirt + (p.cape - 0.12) * 0.3, wv - lag, fl * 0.7);
  f.part(skirt, tails([[-6.6, 0], [6.8, 0], [7.4, 9], [-7, 9]], 0.1), 'moss', 2.95, { dim: 1, folds: [0.5, 3, 0] }); // tunic
  f.part(skirt, tails([[-7, 0], [-0.4, 0], [-0.8, 7.6], [-7.4, 7]], 0.15), 'hide', 3.0, { dim: 1, trim: ['leather', 0.6] }); // jerkin tails
  f.part(skirt, tails([[0.6, 0], [7.2, 0], [7.8, 7], [1, 7.6]], 0), 'hide', 3.02, { trim: ['leather', 0.6] });
  // the jerkin: brown leather, laced up the front, over the green tunic whose sleeves show
  const lace: D[] = [];
  for (let y = -15.5; y <= -6.5; y += 1.6) lace.push([1.6, y, 'hide', 1], [2.6, y + 0.8, 'hide', 1], [2.1, y + 0.4, 'straw', 4]);
  f.part(torso, [[-7, -17.5], [6.8, -17.5], [7.6, -10], [7, -3], [-6.6, -3], [-7.6, -10]], 'hide', 3.1, { folds: [0.3, 3, 0], details: [...lace, ...line([-6, -11], [6.6, -11], 'hide', 2, 0.6)] });
  // the belt: a pouch at the hip and a hunting knife
  f.part(torso, [[-7, -5], [7.4, -5], [7.4, -2.6], [-7, -2.6]], 'hide', 3.5);
  f.part(torso, [[2.4, -5.4], [4.4, -5.4], [4.4, -2.2], [2.4, -2.2]], 'steel', 3.55, { dim: 1 }); // buckle
  f.part(torso, [[-6.6, -3.4], [-2.6, -3.4], [-2.8, 1.2], [-6.4, 1.2]], 'leather', 3.52, { trim: ['hide', 0.6], details: [[-4.6, -1.6, 'straw', 4]] }); // pouch
  f.part(torso.child(5.6, -3, 0.25), [[-0.9, 0], [0.9, 0], [0.9, 5.6], [0, 6.6], [-0.9, 5.6]], 'hide', 3.53, { details: [[0, 1, 'steel', 5]] }); // knife sheath
  f.part(torso, [[-5.4, -17.4], [-3.2, -17.4], [6.4, -4.8], [4.2, -4.8]], 'hide', 3.55, { profile: 'flat' }); // the quiver's strap

  // the hood and its cowl over the shoulders, mottled; the face in its shadow
  const head = torso.child(0.8, -19.4, p.head);
  const hb = new Bone(Math.round(head.x), Math.round(head.y), head.a);
  f.part(torso, [[-7.6, -18.6], [7, -18.6], [7.8, -15.6], [6.2, -13.4], [2.6, -14.6], [-2, -14], [-6.4, -14.2], [-8.2, -15.8]], 'moss', 3.7, { folds: [0.4, 2.2, 0], details: [...mottle(-7, -18, 7, -14.6, 14), ...line([6, -13.4], [2.6, -14.6], 'moss', 1, 0.6)] }); // the cowl
  f.part(head.child(0, 0, p.plume * 0.4), [[-5.6, 1.6], [-6.2, -4], [-5.6, -8], [-3.2, -10.6], [0.4, -11.4], [4, -10.4], [6, -7.6], [6.4, -3.6], [5.8, 0.4], [3.6, 2.4], [-2.4, 2.6]], 'moss', 4.9, { folds: [0.4, 1.8, 0], details: mottle(-5.4, -10.6, 5.6, -3, 10) }); // the hood, lightly dappled so his eyes still read
  f.part(head.child(-5.6, -6, 0.5 + p.cape * 0.6), [[-1, 0], [1.4, 0], [0, 5.6]], 'moss', 4.85, { dim: 1 }); // its point, falling behind
  // a three-quarter face in the hood's shadow, columns x -3..5 and rows y -8..1, masked like a ranger of the woods: a cloth
  // drawn up over his nose and mouth, only his eyes showing. s the hood's shadow, h hair under it, S skin edge, M skin,
  // K brows, W the eye's white, E the iris, m the mask, n its folds
  const FACE = [
    '.sssssss.',
    'sssssssss',
    'shhsssshs',
    'hKKSMSKKS',
    'hMWEMSWES',
    'mmmmmmmmm',
    'mmnmmnmmm',
    '.mmmmnmm.',
    '..mmnmm..',
    '...mm....',
  ];
  const tone: Record<string, [Material, number]> = {
    s: ['moss', 0], h: ['hair', 1], S: ['skin', 2], M: ['skin', 4], K: ['hair', 0], W: ['white', 5], E: ['fern', 4],
    m: ['wool', 4], n: ['wool', 2], // the mask a dull brown, so it reads against the green hood
    C: ['skin', 1], // closed eyes: a dark line of lashes
  };
  const fd: D[] = [];
  const face = p.closed ? FACE.map((row, r) => (r === 4 ? row.replace(/[WE]/g, 'C') : row)) : FACE;
  face.forEach((row, r) => [...row].forEach((ch, c) => { if (tone[ch]) fd.push([c - 3 + 0.5, r - 8 + 0.5, ...tone[ch]]); }));
  f.part(hb, [[-3, -8], [5, -8], [6, -5], [6, -3], [5, -1], [3, 2], [0, 2], [-3, 0]], 'skin', 5.2, { profile: 'flat', details: fd });

  // the longbow in the near hand, behind him; the string drawn by the far hand, in front of him
  const fsh = torso.at(5, -15);
  const off: Pt = [fsh[0] + p.off[0], fsh[1] + p.off[1]];
  const [fup, ffo] = arm(fsh, off);
  f.part(fup, [[-2.4, -1], [2.4, -1], [2.1, 8], [-2.1, 8]], 'moss', p.za, { dim: 1 });
  f.part(ffo, [[-2.2, -0.5], [2.2, -0.5], [2, 6.5], [-2, 6.5]], 'leather', p.za + 0.1, { dim: 1, details: [...line([-1.6, 2], [1.6, 2], 'hide', 1, 0.6), ...line([-1.6, 4.4], [1.6, 4.4], 'hide', 1, 0.6)] }); // bracer
  const bow = new Bone(off[0], off[1], p.offA);
  const bowPts: Pt[] = [];
  for (let k = 0; k <= 14; k++) { const t = (k / 14) * 2 - 1; bowPts.push([4.8 * (1 - t * t) + 0.4 - 0.6 * t ** 4, t * 19]); } // a tall longbow, its tips curling back a little
  const bowIn: Pt[] = bowPts.map(([x, y]): Pt => [x - 2 + 0.9 * Math.abs(y / 19), y]).reverse();
  f.part(bow, [...bowPts, ...bowIn], 'leather', 7.5); // a great longbow of dark wood, in front of his body
  f.part(bow, [[2.6, -2.4], [5.4, -2.4], [5.4, 2.4], [2.6, 2.4]], 'hide', 7.55); // the leather grip
  f.part(bow, ell(4, 0, 1.8, 1.8), 'skin', 7.6, { dim: 1 }); // the hand on the grip

  const sh = torso.at(-4, -15);
  const draw = p.fx;
  const pull: Pt = bow.at(-1 - 13 * draw, 0); // drawn straight back from the bow, square to it, however it is tilted
  const fist: Pt = draw > 0 ? pull : [sh[0] + p.fist[0], sh[1] + p.fist[1]];
  const [up, fo] = arm(sh, fist);
  const top = bow.at(-0.2, -19), bot = bow.at(-0.2, 19);
  const nock: Pt = draw > 0 ? [pull[0] + 1, pull[1]] : bow.at(-1.2, 0);
  const world = new Bone(0, 0);
  const seg = (a: Pt, b: Pt, w = 0.5): Pt[] => {
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = (-(b[1] - a[1]) / l) * w, ny = ((b[0] - a[0]) / l) * w;
    return [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]];
  };
  f.part(world, seg(top, nock), 'white', 7.4, { profile: 'flat', outline: false }); // the string
  f.part(world, seg(nock, bot), 'white', 7.4, { profile: 'flat', outline: false });
  if (draw > 0) { // the arrow on the string (or, for the volley, three fanned out), its head past the bow
    const n = p.volley ?? 1, [hx, hy] = bow.at(9, 0), L = Math.hypot(hx - nock[0], hy - nock[1]);
    for (let k = 0; k < n; k++) {
      const a = p.offA + (k - (n - 1) / 2) * 0.16;
      const tip: Pt = [nock[0] + Math.cos(a) * L, nock[1] + Math.sin(a) * L];
      f.part(world, seg(nock, tip, 0.6), 'bark', 7.7 + k * 0.01, { profile: 'flat', outline: false }); // the shaft
      f.part(new Bone(...tip, a - Math.PI / 2), [[-1.6, -0.5], [1.6, -0.5], [0, 3.2]], 'steel', 7.75 + k * 0.01); // its head
      f.part(new Bone(nock[0] + Math.cos(a) * 1.5, nock[1] + Math.sin(a) * 1.5, a), [[-1.6, -1.6], [1.6, -0.4], [1.6, 0.4], [-1.6, 1.6]], 'moss', 7.72 + k * 0.01, { profile: 'flat' }); // its fletching
    }
  }
  const loosed = p.loosed ?? 0;
  if (loosed > 0) for (let k = 0; k < 3; k++) { // the volley, flying up and away from the bow
    const a = p.offA - 0.16 + k * 0.16, d = 10 + loosed * 26 + k * 3, [bx, by] = bow.at(4, 0);
    const t: Pt = [bx + Math.cos(a) * d, by + Math.sin(a) * d], tail: Pt = [t[0] - Math.cos(a) * 9, t[1] - Math.sin(a) * 9];
    f.part(world, seg(tail, t, 0.5), 'bark', 7.8, { profile: 'flat', outline: false });
    f.part(new Bone(...t, a - Math.PI / 2), [[-1.4, -0.5], [1.4, -0.5], [0, 2.8]], 'steel', 7.85);
    f.part(world, seg([tail[0] - Math.cos(a) * 5, tail[1] - Math.sin(a) * 5], tail, 0.35), 'white', 7.79, { profile: 'flat', outline: false, dim: 2 }); // a streak behind it
  }
  f.part(up, [[-2.5, -1], [2.5, -1], [2.2, 8], [-2.2, 8]], 'moss', 7.8, { folds: [0.3, 2.2, 1] });
  f.part(fo, [[-2.3, -0.5], [2.3, -0.5], [2.1, 6.4], [-2.1, 6.4]], 'hide', 7.9, { details: [...line([-1.8, 2], [1.8, 2], 'leather', 2, 0.6), ...line([-1.8, 4.4], [1.8, 4.4], 'leather', 2, 0.6)] }); // a long leather bracer
  f.part(new Bone(fist[0], fist[1]), ell(0, 0, 1.9, 1.9), 'leather', 8, { details: [[0.4, -0.4, 'leather', 5]] }); // the shooting glove
  return f;
}

// `off` the bow hand (the near one, behind him), `offA` the bow's angle; `fist` the drawing hand (the far one, in front);
// `za` how deep the bow arm is (behind him at rest, raised in front of him to shoot)
const REST: Partial<RPose> = { fist: [10, 13], off: [4, 11], offA: 0.1, za: 2.4 };
const C = common(REST);
const P = (kw: Partial<RPose>): RPose => pose(REST, kw as Partial<Pose>) as RPose;
// the attack, in one smooth motion: the bow comes up and out in front of him as he draws, already nocked, the string coming
// back to his cheek as the bow levels; he looses (the impact frame: the arrow gone, the string hand flying back past his
// ear) and lowers the bow
const AIM: Partial<RPose> = { off: [10, -1], offA: 0, za: 7.5 };
const ATTACK: [number, RPose][] = [
  [90, P({ off: [8, 5], offA: 0.06, za: 7.5, fx: 0.25 })],
  [80, P({ off: [9, 2], offA: 0.03, za: 7.5, fx: 0.55, lean: -0.03 })],
  [80, P({ ...AIM, fx: 0.85, lean: -0.06, feet: [[-5, 0, 0], [5, 0, 0]] })],
  [80, P({ ...AIM, fx: 1, lean: -0.08, head: 0.05, feet: [[-5, 0, 0], [5, 0, 0]] })],
  [150, P({ ...AIM, fist: [7, -4], lean: -0.04, feet: [[-5, 0, 0], [5, 0, 0]], cape: 0.2 })],
  [130, P({ off: [6, 6], offA: 0.06, fist: [9, 8], za: 7.5 })],
];
// the cast, Arrow Volley: he raises the bow high with three arrows fanned on the string, draws them all, and looses them
// into the sky; they fly up and out of sight (the game rains them down on the target then) as he holds the follow-through,
// then lowers the bow
const UP: Partial<RPose> = { off: [6, -9], offA: -0.7, lean: -0.12, head: -0.2, za: 7.5 };
const CAST: [number, RPose][] = [
  [120, P({ ...UP, fx: 0.3, volley: 3 })],
  [170, P({ ...UP, fx: 1, volley: 3, lean: -0.16, feet: [[-5, 0, 0], [5, 0, 0]] })],
  [70, P({ ...UP, fist: [6, -14], loosed: 0.15, lean: -0.14, feet: [[-5, 0, 0], [5, 0, 0]], cape: 0.24 })],
  [200, P({ ...UP, fist: [5, -15], loosed: 0.75, lean: -0.12, feet: [[-5, 0, 0], [5, 0, 0]], cape: 0.2 })],
  [150, P({ off: [6, 6], offA: 0.06, fist: [9, 8], za: 7.5 })],
];
// Dodge Roll: the game moves him at once, so this is the end of the roll: on his back, knees tucked to his chest, he rocks
// up onto his feet into a crouch and rises, the bow kept in his hand and the cloak swirling round him
const ROLL: [number, RPose][] = [
  [80, P({ hip: [-3, 14], lean: -1.25, head: 0.5, fist: [12, 6], off: [6, 4], offA: -0.6, feet: [[1, 9, 0.7], [5, 11, 0.8]], cape: 0.5 })],
  [90, P({ hip: [0, 13], lean: -0.25, head: 0.45, fist: [11, 8], off: [6, 6], offA: -0.2, feet: [[2, 4, 0.4], [6, 5, 0.3]], cape: 0.45 })],
  [90, P({ hip: [2, 9], lean: 0.55, head: 0.3, fist: [11, 9], off: [6, 7], offA: 0.1, feet: [[-3, 0, 0.3], [5, 0, 0]], cape: 0.4 })],
  [100, P({ hip: [1, 4], lean: 0.22, head: 0.1, feet: [[-4, 0, 0], [5, 0, 0]], cape: 0.3 })],
  [120, P({ hip: [0, 0.5], cape: 0.2 })],
];
// hurt: he turns into the blow and takes it on his bow: he snaps the bow up across in front of his face, chin tucked into
// the hood, catching the hit on the wood and his bracer, then lowers it again. He keeps his feet
const HURT: [number, RPose][] = [
  [60, P({ lean: -0.05, head: 0.14, off: [6, 2], offA: -0.5, za: 7.5, fist: [9, 9], cape: 0.24 })],
  [120, P({ hip: [-1, 0.5], lean: -0.08, head: 0.2, off: [7, 0], offA: -0.6, za: 7.5, fist: [9, 8], cape: 0.32, feet: [[-5, 0, 0], [4, 0, 0]] })],
  [80, P({ lean: -0.02, head: 0.06, off: [6, 6], offA: 0.06, za: 7.5, fist: [9, 9], cape: 0.2 })],
];
// death: struck, he sinks to one knee and leans on his bow; his head drops and he falls forward onto his face, and lies
// there with his cloak settled half over his back, the bow fallen from his hand beside him
const DEATH_POSES: RPose[] = [
  P({ hip: [-1.5, 1], lean: -0.2, head: -0.22, off: [3, 8], fist: [8, 10], feet: [[-7, 0, 0], [4, 0, 0]] }),
  P({ hip: [0, 9], lean: 0.12, head: 0.22, off: [8, 2], offA: 0.02, za: 7.5, fist: [9, 9], feet: [[-9, 0, 1.2], [4, 0, 0]] }),
  P({ hip: [0, 9.5], lean: 0.24, head: 0.44, off: [8, 3], offA: 0.04, za: 7.5, fist: [10, 10], feet: [[-9, 0, 1.2], [4, 0, 0]] }),
  P({ hip: [4, 14], lean: 0.95, head: 0.5, off: [10, 6], offA: 1.1, za: 7.5, fist: [12, 6], feet: [[-6, 0, 0.9], [0, 0, 0.6]] }),
  P({ hip: [0, 11], lean: 1.4, head: -0.3, off: [6, 13], offA: 1.55, za: 7.5, fist: [6, 12], closed: true, feet: [[-5, 0, 1.3], [-1, 0, 1.2]] }), // his head turned to the side on the ground, so his face shows; the bow fallen on the ground in front of him
];
// the cloth per frame: [how far it streams back (cape), ripple phase, ripple size]; a pose that sets its own `cape` keeps it
type Cloth = readonly [number, number, number];
const clothed = (frames: [number, RPose][], c: (i: number, n: number) => Cloth) =>
  frames.map(([ms, q], i) => { const [cape, wave, flap] = c(i, frames.length); return [ms, archer({ ...q, cape: q.cape !== 0.12 ? q.cape : cape, wave, flap })] as [number, Figure]; });

export const sprite: SpriteDef = {
  id: 'archer', w: W, h: H, anchor: [X0, 75], tall: 54,
  anims: {
    idle: clothed(C.idle.map((q) => [200, { ...q, fx: 0 } as RPose]), (i, n) => [0.15 + 0.03 * Math.sin((2 * Math.PI * i) / n), i / n, 0.6]),
    walk: clothed(C.walk.map((q) => [100, { ...q, fx: 0 } as RPose]), (i, n) => [0.34 + 0.08 * Math.sin((2 * Math.PI * i) / n), (2 * i) / n, 1.2]),
    attack: clothed(ATTACK, (i, n) => [0.16, i / n, 0.8]),
    cast: clothed(CAST, (i, n) => [0.18, i / n, 1.1]),
    hurt: clothed(HURT, (i, n) => [0.3, i / n, 1.4]),
    death: clothed(DEATH_POSES.map((q, i) => [[130, 180, 300, 160, 700][i], q] as [number, RPose]), (i, n) => [i === 4 ? -0.1 : 0.2, i / n, i === 4 ? 0.2 : 1]),
    skill: clothed(ROLL, (i, n) => [0.4, i / n, 1.5]),
  },
  impact: 4,
};
