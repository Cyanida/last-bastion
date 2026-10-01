/**
 * #270: the Archer, redesigned (the look only: his abilities, stats and balance stay as they are). A hooded ranger of the
 * woods, masked and mottled to hide among the trees: a grey-green hood with a cowl over his shoulders and a point down his
 * back, a brown cloth mask over his nose and mouth so only his eyes show in the hood's shadow, a long cloak to his calves
 * with a ragged hem, all of it dappled darker green and brown; a dark leather jerkin laced up the front over a dull green
 * tunic, a belt with a buckle, a pouch and a sheathed hunting knife; a long bracer on the bow arm and a shooting glove on
 * the drawing hand; a quiver of green- and white-fletched arrows over his far shoulder; wool trousers and wrapped boots; and
 * a great longbow of brown wood. At rest the far hand, behind him, holds the bow hanging in front of him; the near hand
 * draws. The cloak moves as cloth. Attack: one smooth draw and loose. Cast (Arrow Volley): three arrows into the sky. Hurt:
 * the blow caught on the bow. Death: to one knee on the bow, then forward onto the ground. Skill (Dodge Roll): the end of
 * the roll, from his back up onto his feet. 54 px tall.
 */
import { arm, common, H, HIP_Y, legs, pose, W, X0, type Pose } from '../humanoid';
import { Bone, ell, Figure, type Material, type Pt } from '../rig';
import type { SpriteDef } from '../sheet';

type Px = [number, number, Material, number];

// the Archer's own pose fields: `draw` how far the string is drawn (0 slack .. 1 at the cheek); `zo` the bow arm's depth
// (behind him, or brought in front to take a blow); the cloth's ripple (`wave` its phase, `flap` its size); `volley` arrows on
// the string (three for Arrow Volley); `loosed` (0..1) the volley flying up out of the frame; `closed` his eyes shut; `dropped`
// the bow fallen from his hand onto the ground in front of him; `drape` how far the cloak hangs to the ground rather than
// lying along his back (0.75 standing, about 0 lying down)
type RPose = Pose & { draw?: number; zo?: number; wave?: number; flap?: number; volley?: number; loosed?: number; closed?: boolean; dropped?: boolean; drape?: number };

/** A thin strip from a to b, `w` either side: strings, shafts, streaks. */
const strip = (a: Pt, b: Pt, w = 0.5): Pt[] => {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = (-(b[1] - a[1]) / l) * w, ny = ((b[0] - a[0]) / l) * w;
  return [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]];
};

/** Cloth that bends and ripples. Each point moves by how far down the cloth it is (0 at the top .. 1 at `len`): `swing` streams
 * the lower part back further than the top (so it bends), and a ripple (`wave` its phase, `flap` its size) runs down to the hem. */
function cloth(len: number, swing: number, wave: number, flap: number): (q: Pt) => Pt {
  return ([x, y]) => {
    const d = Math.max(0, Math.min(1, y / len));
    const r = Math.sin(2 * Math.PI * wave - y * 0.3 - x * 0.2) * flap * d;
    return [x - swing * 11 * d * d + r * 1.3, y - swing * swing * 5 * d * d + Math.abs(r) * 0.3];
  };
}
/** Long edges cut into short ones, so the cloth can bend along them. */
const cut = (poly: Pt[], step = 1.6): Pt[] => poly.flatMap((a, i) => {
  const b = poly[(i + 1) % poly.length], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
  return Array.from({ length: n }, (_, k) => [a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n] as Pt);
});

/** Woodland camouflage: dapples of darker green and brown in a fixed scatter over a box, moved with the cloth so they stay
 * put on it as it bends. */
function dapples(x0: number, y0: number, x1: number, y1: number, n: number, move: (q: Pt) => Pt = (q) => q): Px[] {
  const out: Px[] = [];
  for (let k = 0; k < n; k++) {
    const x = x0 + (((k * 29 + 7) % 37) / 37) * (x1 - x0), y = y0 + (((k * 17 + 3) % 41) / 41) * (y1 - y0);
    const [mat, tone]: [Material, number] = k % 3 === 2 ? ['hide', 2] : ['moss', 2];
    for (const [dx, dy] of [[0, 0], [0.9, 0.3], [0.3, 0.9]] as const) out.push([...move([x + dx, y + dy]), mat, tone]);
  }
  return out;
}

function archer(p: RPose): Figure {
  const f = new Figure(W, H);
  const hip = new Bone(X0 + p.hip[0], HIP_Y + p.hip[1]);
  const torso = hip.child(0, 0, p.lean);
  const wv = p.wave ?? 0, fl = p.flap ?? 0.5;

  // the cloak, hanging from his shoulders down his back to his calves; it hangs towards the ground however he leans, streams
  // back with `cape` and ripples down to its ragged hem
  const cloak = torso.child(-2.5, -18, (p.cape - 0.12) * 0.5 - p.lean * (p.drape ?? 0.75));
  const flow = cloth(33, (p.cape - 0.12) * 1.4, wv, fl * 1.2);
  const hem: Pt[] = [[2, 31], [0, 33], [-2, 31.4], [-4.4, 33.2], [-6.6, 31.2], [-9, 32.6], [-11, 30.4]];
  f.part(cloak, cut([[-4.5, 0], [4, 0], [4.2, 10], [3, 22], ...hem, [-11.4, 20], [-9, 8]]).map(flow), 'sage', 0.1, { folds: [0.6, 2.8, 0], details: dapples(-11, 2, 3.5, 31, 22, flow) });

  // the quiver on his back over the far shoulder, its arrows rising above it, fletched green and white
  const quiver = torso.child(-5.5, -19, -0.5 + (p.cape - 0.12) * 0.3);
  f.part(quiver, [[-2.6, 0], [2.6, 0], [2.3, 14], [-2.3, 14]], 'leather', 0.3, { dim: 1, trim: ['hide', 0.7] });
  [-1.5, 0, 1.4].forEach((x, k) => {
    const top = -5.5 - k;
    f.part(quiver, [[x - 0.3, top + 3], [x + 0.3, top + 3], [x + 0.3, 0.5], [x - 0.3, 0.5]], 'wood', 0.2, { profile: 'flat' }); // the shafts
    f.part(quiver, [[x - 0.9, top], [x + 0.9, top], [x + 0.8, top + 3.2], [x - 0.8, top + 3.2]], k === 1 ? 'white' : 'fern', 0.25, { dim: k === 1 ? 1 : 0 }); // the fletching
  });

  legs(hip, p.feet, (th, sh, ft, z, dim) => {
    f.part(th, [[-3.4, -1.5], [3.4, -1.5], [2.9, 11.5], [-2.9, 11.5]], 'wool', z, { dim, folds: [0.3, 3, 1] }); // wool trousers
    const wrap: Px[] = [];
    for (let y = 1; y < 10; y += 2) for (let x = -2.1; x <= 2.1; x += 0.8) wrap.push([x, y + (x + 2.1) * 0.4, 'leather', 1]);
    f.part(sh, [[-2.6, 0], [2.6, 0], [2.3, 11], [-2.3, 11]], 'hide', z + 0.1, { dim, details: wrap }); // boots wrapped in strips
    f.part(ft, [[-2.6, -1], [2.4, -1], [5, 1], [5.6, 3], [-2.8, 3]], 'leather', z + 0.15, { dim: dim + 1 });
  });

  // the far arm, behind him (or brought up in front to take a blow): a green sleeve and a long leather bracer
  const zo = p.zo ?? 2.4;
  const fsh = torso.at(-4, -15);
  const off: Pt = [fsh[0] + p.off[0], fsh[1] + p.off[1]];
  const [fup, ffo] = arm(fsh, off);
  f.part(fup, [[-2.4, -1], [2.4, -1], [2.1, 8], [-2.1, 8]], 'green', zo, { dim: 1 });
  const laces: Px[] = [1.5, 3.5, 5.5].map((y) => [0, y, 'hide', 4]);
  f.part(ffo, [[-2.2, -0.5], [2.2, -0.5], [2, 6.6], [-2, 6.6]], 'leather', zo + 0.1, { dim: zo > 3 ? 0 : 1, details: laces });

  // the tunic's skirt and the jerkin's tails over it, split at the sides; both swing as cloth
  const skirt = torso.child(0, -3, p.skirt * 0.6 - p.lean * 0.4);
  const tails = cloth(10, p.skirt + (p.cape - 0.12) * 0.3, wv - 0.1, fl * 0.6);
  f.part(skirt, cut([[-6.6, 0], [6.8, 0], [7.6, 9.4], [-7.2, 9.4]]).map(tails), 'green', 2.95, { dim: 1, folds: [0.5, 3, 0] });
  f.part(skirt, cut([[-7, 0], [-0.3, 0], [-0.7, 7.6], [-7.4, 7]]).map(tails), 'leather', 3.0, { dim: 1 });
  f.part(skirt, cut([[0.5, 0], [7.2, 0], [7.9, 7], [0.9, 7.6]]).map(tails), 'leather', 3.02);
  // the jerkin, laced up the front over the tunic
  const lacing: Px[] = [];
  for (let y = -16; y <= -7; y += 1.8) lacing.push([1.6, y, 'straw', 2], [2.6, y + 0.9, 'straw', 2], [2.1, y + 0.45, 'straw', 4]);
  f.part(torso, [[-7, -17.5], [6.8, -17.5], [7.6, -10], [7, -3], [-6.6, -3], [-7.6, -10]], 'leather', 3.1, { folds: [0.3, 3, 0], details: lacing });
  // the belt and its buckle, a pouch at the hip and a hunting knife in its sheath
  f.part(torso, [[-7, -5], [7.4, -5], [7.4, -2.6], [-7, -2.6]], 'hide', 3.5);
  f.part(torso, [[2.2, -5.4], [4.2, -5.4], [4.2, -2.2], [2.2, -2.2]], 'steel', 3.55, { dim: 1 });
  f.part(torso, [[-6.6, -3.6], [-2.6, -3.6], [-2.8, 1.2], [-6.4, 1.2]], 'hide', 3.52, { trim: ['leather', 0.6] });
  f.part(torso.child(5.8, -3, 0.3), [[-0.9, 0], [0.9, 0], [0.9, 5.4], [0, 6.6], [-0.9, 5.4]], 'leather', 3.53, { details: [[0, 0.6, 'steel', 5]] });
  f.part(torso, [[-5.4, -17.4], [-3.2, -17.4], [6.4, -4.8], [4.2, -4.8]], 'hide', 3.56, { profile: 'flat' }); // the quiver's strap

  // the cowl over his shoulders, the hood and its point, mottled like the cloak
  f.part(torso, [[-8.2, -19], [6.4, -19], [7.8, -16], [6.4, -13.4], [2, -14.4], [-3, -13.8], [-7.6, -14], [-9, -16]], 'sage', 3.7, { folds: [0.5, 2.4, 0], details: dapples(-8, -18.5, 6.5, -14.5, 6) });
  const head = torso.child(0.8, -19.4, p.head);
  const hb = new Bone(Math.round(head.x), Math.round(head.y), head.a); // the face on whole pixels, so the eyes stay crisp
  f.part(head.child(-5.4, -6.5, 0.45 + (p.cape - 0.12) * 0.8), [[-1.2, 0], [1.4, 0], [-0.6, 6.4]], 'sage', 4.8, { dim: 1 }); // the hood's point, falling behind
  f.part(head, [[-5.6, 2], [-6.4, -4], [-5.6, -8.4], [-3, -11], [0.6, -11.8], [4.2, -10.8], [6.4, -7.8], [7, -4.2], [6.6, 0], [4, 2.6], [-2.4, 2.8]], 'sage', 4.9, { folds: [0.4, 1.8, 0], details: dapples(-5.4, -11, 2, -3, 4) });
  // the face in the hood's shadow: only the eyes show, between the hood's brim and the mask
  const eyes: Px[] = p.closed
    ? [[1.5, -4.5, 'skin', 1], [2.5, -4.5, 'skin', 1], [4.5, -4.5, 'skin', 1], [5.5, -4.5, 'skin', 1]]
    : [[1.5, -4.5, 'white', 4], [2.5, -4.5, 'fern', 1], [4.5, -4.5, 'white', 5], [5.5, -4.5, 'fern', 1]];
  f.part(hb, [[0, -6.4], [6.2, -6.4], [6.2, -3.4], [0, -3.4]], 'skin', 5.2, { profile: 'flat', details: [[0.5, -5.5, 'skin', 1], [3.5, -4.5, 'skin', 3], [0.5, -4.5, 'skin', 2], ...eyes] });
  f.part(hb, [[-0.4, -3.6], [6, -3.6], [7, -2.4], [6.6, 0.2], [3.6, 2.2], [-0.4, 2]], 'wool', 5.25, { folds: [0.5, 1.6, 1] }); // the mask over his nose and mouth
  f.part(head, [[-0.6, -8.8], [3.6, -10.6], [6.6, -8.2], [7.2, -5.8], [5.6, -6.6], [0, -6.6]], 'sage', 5.3, { dim: 1 }); // the brim, its shadow over his brow

  // the longbow in the far hand, the string drawn by the near hand. Bow space: y along the bow (-y the upper limb), +x towards
  // the target; the string runs between the tips
  const bowAt: Pt = p.dropped ? [X0 + 12, 71] : off;
  const bow = new Bone(bowAt[0], bowAt[1], p.dropped ? Math.PI / 2 - 0.04 : p.offA);
  const L = 20, belly: Pt[] = [], back: Pt[] = [];
  for (let k = 0; k <= 16; k++) {
    const t = (k / 16) * 2 - 1;
    belly.push([4.4 * (1 - t * t) + 0.5 - 0.7 * t ** 4, t * L]);
    back.push([4.4 * (1 - t * t) - 1.3 + 0.8 * t * t, t * L]);
  }
  f.part(bow, [...belly, ...back.reverse()], 'wood', 7.5);
  f.part(bow, [[2.6, -2.4], [5.6, -2.4], [5.6, 2.4], [2.6, 2.4]], 'leather', 7.55); // the leather grip
  if (!p.dropped) f.part(bow, ell(4.2, 0, 1.8, 1.8), 'skin', 7.6, { dim: 1 }); // the far hand on the grip

  const sh = torso.at(5, -15);
  const draw = p.draw ?? 0;
  const rest: Pt = bow.at(-0.6, 0), cheek: Pt = torso.at(3, -17.5);
  const pull: Pt = [rest[0] + (cheek[0] - rest[0]) * draw, rest[1] + (cheek[1] - rest[1]) * draw];
  const fist: Pt = draw > 0 ? pull : [sh[0] + p.fist[0], sh[1] + p.fist[1]];
  const [up, fo] = arm(sh, fist);
  const top = bow.at(-0.4, -L + 0.5), bot = bow.at(-0.4, L - 0.5);
  const nock: Pt = draw > 0 ? [pull[0] + 0.6, pull[1]] : rest;
  const world = new Bone(0, 0);
  f.part(world, strip(top, nock, 0.45), 'white', 7.4, { profile: 'flat', outline: false }); // the string
  f.part(world, strip(nock, bot, 0.45), 'white', 7.4, { profile: 'flat', outline: false });
  if (draw > 0) { // the arrow on the string (three, fanned, for the volley), its head past the bow
    const n = p.volley ?? 1, head0 = bow.at(9, 0), len = Math.hypot(head0[0] - nock[0], head0[1] - nock[1]);
    const a0 = Math.atan2(head0[1] - nock[1], head0[0] - nock[0]);
    for (let k = 0; k < n; k++) {
      const a = a0 + (k - (n - 1) / 2) * 0.17, tip: Pt = [nock[0] + Math.cos(a) * len, nock[1] + Math.sin(a) * len];
      f.part(world, strip(nock, tip, 0.55), 'wood', 7.7 + k * 0.01, { profile: 'flat', outline: false });
      f.part(new Bone(tip[0], tip[1], a - Math.PI / 2), [[-1.5, -0.5], [1.5, -0.5], [0, 3]], 'steel', 7.75 + k * 0.01);
      f.part(new Bone(nock[0] + Math.cos(a) * 1.6, nock[1] + Math.sin(a) * 1.6, a), [[-1.7, -1.5], [1.4, -0.4], [1.4, 0.4], [-1.7, 1.5]], k === 1 ? 'white' : 'fern', 7.72 + k * 0.01, { profile: 'flat' });
    }
  }
  const loosed = p.loosed ?? 0;
  if (loosed > 0) for (let k = 0; k < 3; k++) { // the volley flying up and out of the frame along the bow's aim, a pale streak behind each
    const dir = p.offA + (k - 1) * 0.17, [bx, by] = bow.at(4, 0), d = 10 + loosed * 16 + k * 2;
    const t: Pt = [bx + Math.cos(dir) * d, by + Math.sin(dir) * d], tail: Pt = [t[0] - Math.cos(dir) * 8, t[1] - Math.sin(dir) * 8];
    f.part(world, strip([tail[0] - Math.cos(dir) * 6, tail[1] - Math.sin(dir) * 6], tail, 0.4), 'smear', 7.79, { profile: 'flat', outline: false });
    f.part(world, strip(tail, t, 0.5), 'wood', 7.8, { profile: 'flat', outline: false });
    f.part(new Bone(t[0], t[1], dir - Math.PI / 2), [[-1.4, -0.5], [1.4, -0.5], [0, 2.8]], 'steel', 7.85);
  }
  // the near arm, in front: a green sleeve, a leather cuff and the shooting glove
  f.part(up, [[-2.5, -1], [2.5, -1], [2.2, 8], [-2.2, 8]], 'green', 7.8, { folds: [0.3, 2.2, 1] });
  f.part(fo, [[-2.3, -0.5], [2.3, -0.5], [2.1, 6.4], [-2.1, 6.4]], 'green', 7.85);
  f.part(fo, [[-2.3, 3.6], [2.3, 3.6], [2.1, 6.6], [-2.1, 6.6]], 'leather', 7.88); // the glove's cuff
  f.part(new Bone(fist[0], fist[1]), ell(0, 0, 1.9, 1.9), 'leather', 8, { details: [[0.5, -0.5, 'leather', 5]] }); // the shooting glove
  return f;
}

// `off` the bow hand (the far one, behind him) and `offA` the bow's angle; `fist` the free near hand, at his side at rest
const REST: Partial<RPose> = { fist: [-1, 12], off: [11, 10], offA: 0.08 };
const C = common(REST);
const P = (kw: Partial<RPose>): RPose => pose(REST, kw as Partial<Pose>) as RPose;
const PLANT: Partial<RPose> = { feet: [[-5, 0, 0], [5, 0, 0]] };
// the attack, one smooth draw: the bow comes up and out in front of him already nocked, the string comes back to his cheek
// as the bow levels; he looses on the impact frame (the arrow gone, the string hand flying back past his ear) and lowers it
const AIM: Partial<RPose> = { off: [14, -1], offA: 0, ...PLANT };
const ATTACK: [number, RPose][] = [
  [90, P({ off: [12, 6], offA: 0.1, draw: 0.15 })],
  [80, P({ off: [13, 2], offA: 0.04, draw: 0.5, lean: -0.03 })],
  [80, P({ ...AIM, draw: 0.85, lean: -0.06 })],
  [90, P({ ...AIM, draw: 1, lean: -0.08, head: 0.04 })],
  [150, P({ ...AIM, fist: [-9, -5], lean: -0.04, cape: 0.2 })],
  [130, P({ off: [12, 7], offA: 0.08, fist: [1, 10] })],
];
// Arrow Volley: the bow raised high with three arrows fanned on the string, drawn and loosed into the sky; they fly up out of
// the frame (the game rains them on the target then) as he holds the follow-through, then he lowers the bow
const UP: Partial<RPose> = { off: [11, -11], offA: -0.75, lean: -0.12, head: -0.22, ...PLANT };
const CAST: [number, RPose][] = [
  [120, P({ ...UP, draw: 0.3, volley: 3 })],
  [170, P({ ...UP, draw: 1, volley: 3, lean: -0.16 })],
  [70, P({ ...UP, fist: [-7, -9], loosed: 0.2, lean: -0.14, cape: 0.24 })],
  [200, P({ ...UP, fist: [-8, -10], loosed: 1, lean: -0.12, cape: 0.2 })],
  [150, P({ off: [12, 7], offA: 0.08, fist: [1, 10] })],
];
// hurt: he takes the blow on his bow: snaps it up across in front of his face, chin tucked into the hood, the bracer beside it
// in front of him, then lowers it. He keeps his feet
const HURT: [number, RPose][] = [
  [60, P({ lean: -0.04, head: 0.12, off: [13, -3], offA: -0.55, zo: 7.3, fist: [0, 9], cape: 0.24 })],
  [120, P({ hip: [-1, 0.5], lean: -0.08, head: 0.2, off: [12, -5], offA: -0.7, zo: 7.3, fist: [0, 8], cape: 0.3, feet: [[-5, 0, 0], [4, 0, 0]] })],
  [80, P({ lean: -0.02, head: 0.06, off: [12, 6], offA: 0.06, fist: [0, 10], cape: 0.18 })],
];
// death: struck, he sinks to one knee and leans on his bow; his head drops; he falls forward onto the ground and lies there,
// eyes closed and face turned to us, the cloak settled over his back and the bow fallen in front of him
const DEATH: [number, RPose][] = [
  [130, P({ hip: [-1.5, 1], lean: -0.18, head: -0.2, off: [10, 9], fist: [1, 10], feet: [[-7, 0, 0], [4, 0, 0]] })],
  [180, P({ hip: [-1, 9], lean: 0.1, head: 0.2, off: [14, 4], offA: 0.02, fist: [5, 8], feet: [[-9, 0, 1.2], [4, 0, 0]] })],
  [300, P({ hip: [-1, 9.5], lean: 0.22, head: 0.45, off: [14, 5], offA: 0.04, fist: [6, 8], feet: [[-9, 0, 1.2], [4, 0, 0]] })],
  [160, P({ hip: [3, 14], lean: 0.95, head: 0.4, off: [16, 6], offA: 0.9, fist: [10, 4], cape: 0.2, drape: 0.45, feet: [[-6, 0, 0.9], [0, 0, 0.6]] })],
  [700, P({ hip: [-2, 18], lean: 1.5, head: -0.25, off: [8, 1], fist: [7, 1], closed: true, dropped: true, cape: 0.12, drape: 0.05, feet: [[-22, 1, 1.5], [-20, 0, 1.5]] })],
];
// Dodge Roll: the game moves him at once, so this is the end of the roll: on his back with his knees tucked, he rocks up onto
// his feet into a crouch and rises, the bow kept in his hand and the cloak swirling round him
const ROLL: [number, RPose][] = [
  [80, P({ hip: [-3, 15], lean: -1.3, drape: -0.25, head: 0.5, fist: [12, 6], off: [9, 2], offA: -0.7, feet: [[1, 9, 0.7], [5, 11, 0.8]], cape: 0.14 })],
  [90, P({ hip: [0, 13], lean: -0.3, drape: 0.5, head: 0.45, fist: [11, 8], off: [10, 6], offA: -0.25, feet: [[2, 4, 0.4], [6, 5, 0.3]], cape: 0.45 })],
  [90, P({ hip: [2, 9], lean: 0.55, head: 0.3, fist: [9, 9], off: [10, 9], offA: 0.1, feet: [[-3, 0, 0.3], [5, 0, 0]], cape: 0.4 })],
  [100, P({ hip: [1, 4], lean: 0.22, head: 0.1, feet: [[-4, 0, 0], [5, 0, 0]], cape: 0.3 })],
  [120, P({ hip: [0, 0.5], cape: 0.2 })],
];

// the cloth per frame: [how far it streams back, ripple phase, ripple size]; a pose that sets its own `cape` keeps it
type Cloth = (i: number, n: number) => readonly [number, number, number];
const clothed = (frames: [number, RPose][], c: Cloth) => frames.map(([ms, q], i) => {
  const [cape, wave, flap] = c(i, frames.length);
  return [ms, archer({ ...q, cape: q.cape !== 0.12 ? q.cape : cape, wave, flap })] as [number, Figure];
});
const still = (q: Pose): RPose => ({ ...q, fx: 0, cape: 0.12 }); // the shared idle and walk, their cloak set by `clothed`

export const sprite: SpriteDef = {
  id: 'archer', w: W, h: H, anchor: [X0, 75], tall: 54,
  anims: {
    idle: clothed(C.idle.map((q) => [200, still(q)]), (i, n) => [0.15 + 0.03 * Math.sin((2 * Math.PI * i) / n), i / n, 0.6]),
    walk: clothed(C.walk.map((q) => [100, still(q)]), (i, n) => [0.34 + 0.08 * Math.sin((2 * Math.PI * i) / n), (2 * i) / n, 1.2]),
    attack: clothed(ATTACK, (i, n) => [0.16, i / n, 0.8]),
    cast: clothed(CAST, (i, n) => [0.18, i / n, 1.1]),
    hurt: clothed(HURT, (i, n) => [0.3, i / n, 1.4]),
    death: clothed(DEATH, (i, n) => [0.2, i / n, i === n - 1 ? 0.2 : 1]),
    skill: clothed(ROLL, (i, n) => [0.4, i / n, 1.5]),
  },
  impact: 4,
};
