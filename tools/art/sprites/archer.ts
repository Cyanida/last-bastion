/** #156: the Archer: a steel kettle hat, a quilted green gambeson, a leather quiver on his back and a longbow drawn to the cheek. 54 px tall. */
import { arm, common, H, HIP_Y, legs, pose, W, X0, type Pose } from '../humanoid';
import { Bone, ell, Figure, type Pt } from '../rig';
import type { SpriteDef } from '../sheet';

function archer(p: Pose): Figure {
  const f = new Figure(W, H);
  const hip = new Bone(X0 + p.hip[0], HIP_Y + p.hip[1]);
  const torso = hip.child(0, 0, p.lean);

  const quiver = torso.child(-5, -16, -0.5 + p.cape * 0.5);
  f.part(quiver, [[-2.5, 0], [2.5, 0], [2.3, 14], [-2.3, 14]], 'leather', 0.2, { trim: ['darksteel', 0] });
  [-1.5, 0, 1.5].forEach((x, k) => f.part(quiver, [[x - 0.6, -4 - k], [x + 0.6, -4 - k], [x + 0.6, 0.5], [x - 0.6, 0.5]], 'white', 0.1, { profile: 'flat' })); // fletchings

  legs(hip, p.feet, (th, sh, ft, z, dim) => {
    f.part(th, [[-3.4, -1.5], [3.4, -1.5], [2.8, 11.5], [-2.8, 11.5]], 'leather', z, { dim, folds: [0.3, 3, 1] }); // breeches
    f.part(sh, [[-2.5, 0], [2.5, 0], [2.3, 11], [-2.3, 11]], 'leather', z + 0.1, { dim: dim + 1 }); // tall boots
    f.part(sh, [[-2.8, -0.5], [2.8, -0.5], [2.8, 2], [-2.8, 2]], 'leather', z + 0.12, { dim }); // boot cuff
    f.part(ft, [[-2.6, -1], [2.4, -1], [5, 1], [5.6, 3], [-2.8, 3]], 'leather', z + 0.15, { dim: dim + 1 });
  });

  const skirt = torso.child(0, -3, p.skirt);
  f.part(skirt, [[-6.6, 0], [6.8, 0], [7.6, 8], [-7.2, 8]], 'green', 3.0, { folds: [0.5, 3, 0] }); // gambeson skirt
  f.part(torso, [[-7.2, -17.5], [6.8, -17.5], [7.6, -10], [7, -3], [-6.6, -3], [-7.6, -10]], 'green', 3.1, { folds: [0.6, 2.5, 1] }); // quilted gambeson
  f.part(torso, [[-7, -5], [7.4, -5], [7.4, -2.6], [-7, -2.6]], 'leather', 3.5); // belt
  f.part(torso, [[1, -5.4], [3.4, -5.4], [3.4, -2.2], [1, -2.2]], 'steel', 3.6);
  f.part(torso, [[-5, -17], [-3, -17], [6, -4.5], [4, -4.5]], 'leather', 3.55, { profile: 'flat' }); // quiver strap

  const head = torso.child(0.8, -19, p.head);
  f.part(head, [[-4, 1], [-4.4, -5], [-2, -7.5], [3.5, -7.5], [5, -4], [4.8, 0], [2, 1.8], [-1, 1.8]], 'skin', 5, { details: [[3.2, -3.6, 'darksteel', 0]] }); // face
  f.part(head, [[-4.6, -1.5], [-4.6, -5], [-2, -5], [-2.2, -1.5]], 'hair', 5.05); // hair at the nape
  f.part(head.child(0, -6, p.plume * 0.5), [[-8, 0.8], [-5, -0.8], [-4, -4.5], [0, -5.6], [4.5, -4.5], [5.5, -0.8], [8.5, 0.8], [8, 2], [-7.5, 2]], 'steel', 5.1, { trim: ['steel', 0] }); // kettle hat

  // the longbow in the far hand, the string drawn by the near one
  const fsh = torso.at(-4, -15);
  const off: Pt = [fsh[0] + p.off[0], fsh[1] + p.off[1]];
  const [fup, ffo] = arm(fsh, off);
  f.part(fup, [[-2.5, -1], [2.5, -1], [2.2, 8], [-2.2, 8]], 'green', 2.5, { dim: 1 });
  f.part(ffo, [[-2.2, -0.5], [2.2, -0.5], [2, 6.5], [-2, 6.5]], 'leather', 2.6, { dim: 1 });
  const bow = new Bone(off[0], off[1], p.offA);
  const bowPts: [number, number][] = [];
  for (let k = 0; k <= 12; k++) {
    const t = (k / 12) * 2 - 1; // -1 top .. 1 bottom
    bowPts.push([4.5 * (1 - t * t) + 0.4, t * 17]);
  }
  const bowIn: Pt[] = bowPts.map(([x, y]): Pt => [x - 2.4 + 1 * Math.abs(y / 17), y]).reverse();
  f.part(bow, [...bowPts, ...bowIn], 'leather', 7.5, { trim: ['leather', 0] });
  f.part(bow, ell(0.8, 0, 1.8, 1.8), 'skin', 7.6, { dim: 1 }); // the far hand on the grip

  const sh = torso.at(5, -15);
  const draw = p.fx; // 0 slack .. 1 drawn to the cheek
  const pull: Pt = [off[0] - 1 - 12 * draw, off[1]];
  const fist: Pt = draw > 0 ? pull : [sh[0] + p.fist[0], sh[1] + p.fist[1]];
  const [up, fo] = arm(sh, fist);
  const top = bow.at(0.2, -17), bot = bow.at(0.2, 17);
  const nock: Pt = draw > 0 ? [pull[0] + 1, pull[1]] : bow.at(-0.8, 0);
  const world = new Bone(0, 0);
  const line = (a: Pt, b: Pt): Pt[] => {
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / l * 0.6, ny = (b[0] - a[0]) / l * 0.6;
    return [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]];
  };
  f.part(world, line(top, nock), 'white', 7.4, { profile: 'flat', outline: false }); // string
  f.part(world, line(nock, bot), 'white', 7.4, { profile: 'flat', outline: false });
  if (draw > 0) {
    f.part(world, line(nock, bow.at(8, 0)), 'leather', 7.7, { profile: 'flat', outline: false }); // the arrow on the string
    f.part(new Bone(...bow.at(8, 0), -Math.PI / 2), [[-1.6, -0.5], [1.6, -0.5], [0, 3.2]], 'steel', 7.75); // arrowhead
  }
  f.part(up, [[-2.6, -1], [2.6, -1], [2.3, 8], [-2.3, 8]], 'green', 7.8);
  f.part(fo, [[-2.3, -0.5], [2.3, -0.5], [2.1, 6.4], [-2.1, 6.4]], 'leather', 7.9); // bracer
  f.part(new Bone(fist[0], fist[1]), ell(0, 0, 1.8, 1.8), 'skin', 8);
  return f;
}

const REST: Partial<Pose> = { fist: [3, 12], off: [11, 5], offA: 0.15, za: 7 };
const C = common(REST);
const P = (kw: Partial<Pose>) => pose(REST, kw);
const AIM: Partial<Pose> = { off: [13, -1], offA: 0 };
// ready, raise the bow and nock, draw, full draw, loose (the arrow is gone), follow through
const ATTACK: [number, Pose][] = [
  [200, P({})],
  [100, P({ ...AIM, off: [11, 1], fx: 0.2, lean: -0.03 })],
  [140, P({ ...AIM, fx: 0.6, lean: -0.06, feet: [[-5, 0, 0], [5, 0, 0]] })],
  [100, P({ ...AIM, fx: 1, lean: -0.08, head: 0.05, feet: [[-5, 0, 0], [5, 0, 0]] })],
  [150, P({ ...AIM, fist: [-2, -4], lean: -0.04, feet: [[-5, 0, 0], [5, 0, 0]], cape: 0.2 })],
  [130, P({ off: [10, 4], offA: 0.05, fist: [0, 8] })],
];

export const sprite: SpriteDef = {
  id: 'archer', w: W, h: H, anchor: [X0, 75], tall: 54,
  anims: {
    idle: C.idle.map((p) => [200, archer({ ...p, fx: 0 })]),
    walk: C.walk.map((p) => [100, archer({ ...p, fx: 0 })]),
    attack: ATTACK.map(([ms, p]) => [ms, archer(p)]),
    hurt: C.hurt.map(([ms, p]) => [ms, archer({ ...p, fx: 0 })]),
    death: C.death.map(([ms, p]) => [ms, archer({ ...p, fx: 0 })]),
  },
  impact: 4,
};
