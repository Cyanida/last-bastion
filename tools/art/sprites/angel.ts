/** #156: the Angel: great white wings, a halo, golden hair, a white robe with a gold collar and sash; her orb of light gathers in her hand. 54 px tall. */
import { arm, common, H, HIP_Y, legs, pose, W, X0, type Pose } from '../humanoid';
import { Bone, ell, Figure, type Pt } from '../rig';
import type { SpriteDef } from '../sheet';

const feathers = (n: number, x0: number, y0: number, dx: number, dy: number) =>
  Array.from({ length: n }, (_, k) => [x0 + dx * k, y0 + dy * k, 'white', 2] as [number, number, 'white', number]);

function angel(p: Pose): Figure {
  const f = new Figure(W, H);
  const hip = new Bone(X0 + p.hip[0], HIP_Y + p.hip[1]);
  const torso = hip.child(0, 0, p.lean);

  // wings from between the shoulders, sweeping back and up; `plume` beats them
  const wingPts: Pt[] = [[0, 0], [-4, -6], [-10, -12], [-17, -15], [-22, -14], [-19, -10], [-22, -7], [-18, -4], [-20, 0], [-15, 2], [-16, 6], [-10, 5], [-5, 6]];
  f.part(torso.child(-3, -14, 0.5 - p.plume * 2), wingPts, 'white', 0, { dim: 1, folds: [0.8, 3, 1], details: feathers(4, -18, -9, 3, 3) }); // far wing
  f.part(torso.child(-1, -14, 0.3 - p.plume * 2.5), wingPts, 'white', 0.4, { folds: [0.8, 3, 1], details: feathers(5, -20, -8, 3.5, 3) }); // near wing

  legs(hip, p.feet, (th, sh, ft, z, dim) => {
    f.part(sh, [[-2.6, 0], [2.6, 0], [2.3, 11], [-2.3, 11]], 'white', z, { dim, profile: 'flat', folds: [0.4, 3, 0] }); // robe over the shin
    f.part(ft, [[-2.4, -1], [2.2, -1], [5, 1.5], [5.4, 3], [-2.6, 3]], 'skin', z + 0.15, { dim, details: [[1, 0.5, 'leather', 1], [3, 1.2, 'leather', 1]] }); // sandal
    void th;
  });

  const skirt = torso.child(0, -3, p.skirt);
  f.part(skirt, [[-6.5, 0], [6.8, 0], [8.5, 12], [9.5, 20], [0, 21], [-9, 20], [-8, 12]], 'white', 3.0, { folds: [0.5, 3.2, 0] }); // long robe
  f.part(skirt, [[-9, 18.5], [9.5, 18.5], [9.5, 20], [0, 21], [-9, 20]], 'gold', 3.05, { profile: 'flat' }); // hem
  f.part(torso, [[-6.6, -17], [6.4, -17], [7.2, -10], [6.8, -3], [-6.4, -3], [-7.2, -10]], 'white', 3.1, { folds: [0.4, 2.6, 0] }); // bodice
  f.part(torso, [[-6.8, -5], [7, -5], [7, -2.5], [-6.8, -2.5]], 'gold', 3.5); // sash
  f.part(torso, [[-5, -19], [5.4, -19], [6.2, -15.5], [0.5, -13], [-5.6, -15.5]], 'gold', 3.6, { trim: ['glow', 0] }); // collar

  const head = torso.child(0.8, -19, p.head);
  f.part(head, [[-5, 1], [-5.5, -5], [-3, -9.6], [2, -10], [5, -7], [4, -3], [-1, -3], [-2, 3], [-3, 8], [-6, 6]], 'gold', 4.8, { folds: [0.6, 2, 1] }); // hair down her back
  f.part(head, [[-3, 0.5], [-3.5, -6], [0, -8], [4.4, -6.5], [5, -3], [4.4, 0], [2, 1.5], [-1.5, 1.5]], 'skin', 5, { details: [[3.3, -3.6, 'blue', 1], [4, -0.6, 'red', 3]] }); // face
  f.part(head, [[-4.5, -4], [-4, -8.6], [-0.5, -10.4], [3.6, -9.6], [5.4, -6.8], [2, -7.2], [-1, -6], [-3, -2]], 'gold', 5.1, { folds: [0.5, 1.6, 0] }); // fringe
  f.part(head.child(0, -13.5, -p.plume), ell(0, 0, 5.5, 1.6, 24), 'glow', 5.2, { profile: 'flat', details: [[-3, -0.3, 'glow', 6], [2, -0.3, 'glow', 6]] }); // halo

  // the far hand clasped at the sash, the near hand bearing the light
  const fsh = torso.at(-5, -15);
  const [fup, ffo] = arm(fsh, [fsh[0] + p.off[0], fsh[1] + p.off[1]]);
  f.part(fup, [[-2.4, -1], [2.4, -1], [2.2, 8], [-2.2, 8]], 'white', 2.5, { dim: 1, folds: [0.4, 2.5, 1] });
  f.part(ffo, [[-2.2, -0.5], [2.2, -0.5], [1.8, 6.5], [-1.8, 6.5]], 'skin', 2.6, { dim: 1 });
  const sh = torso.at(5, -15);
  const fist: Pt = [sh[0] + p.fist[0], sh[1] + p.fist[1]];
  const [up, fo] = arm(sh, fist);
  f.part(up, [[-2.6, -1], [2.6, -1], [2.4, 8], [-2.4, 8]], 'white', p.za, { folds: [0.4, 2.5, 1] }); // sleeve
  f.part(fo, [[-2.4, -0.5], [2.4, -0.5], [3, 5], [-3, 5]], 'white', p.za + 0.1, { trim: ['gold', 0] }); // wide cuff
  f.part(fo, ell(0, 6.5, 1.8, 1.8), 'skin', p.za + 0.15);
  const r = 1.4 + 2.2 * p.fx; // the orb swells as it charges
  f.part(new Bone(...fo.at(0, 8.5 + r * 0.6)), ell(0, 0, r, r, 16), 'glow', p.za + 0.3, { profile: 'round', outline: false });
  return f;
}

const REST: Partial<Pose> = { fist: [4, 10], off: [5, 12], za: 7 };
const C = common(REST);
const P = (kw: Partial<Pose>) => pose(REST, kw);
// ready, draw the light in, raise it, throw, release (the orb leaves her hand), settle; the wings beat with it
const ATTACK: [number, Pose][] = [
  [200, P({ fx: 0.4 })],
  [100, P({ hip: [-1, 0], lean: -0.1, fist: [0, 4], za: 2.8, fx: 0.7, plume: 0.06 })],
  [110, P({ hip: [-1, -1], lean: -0.14, fist: [-1, -6], za: 7, fx: 1, plume: 0.12, cape: 0.2 })],
  [60, P({ hip: [1, 0], lean: 0.06, fist: [9, -3], fx: 1, plume: -0.04, feet: [[-4, 0, 0], [6, 1, -0.1]] })],
  [170, P({ hip: [2, 0], lean: 0.14, fist: [13, 2], fx: 0, plume: -0.1, feet: [[-5, 0, 0.2], [8, 0, 0]] })],
  [120, P({ hip: [1, 0], lean: 0.06, fist: [8, 8], fx: 0.2, plume: 0.02, feet: [[-5, 0, 0], [6, 0, 0]] })],
];

export const sprite: SpriteDef = {
  id: 'angel', w: W, h: H, anchor: [X0, 75], tall: 54,
  anims: {
    idle: C.idle.map((p) => [200, angel(p)]),
    walk: C.walk.map((p) => [100, angel(p)]),
    attack: ATTACK.map(([ms, p]) => [ms, angel(p)]),
    hurt: C.hurt.map(([ms, p]) => [ms, angel(p)]),
    death: C.death.map(([ms, p]) => [ms, angel(p)]),
  },
  impact: 4,
};
