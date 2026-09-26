/** #156: the Viking: horned helm, ginger beard, fur mantle over a mail shirt, bare arms, a round shield and a bearded axe. 56 px tall. */
import { common, arm, H, HIP_Y, legs, pose, smear, W, X0, type Pose } from '../humanoid';
import { Bone, ell, Figure, type Pt } from '../rig';
import type { SpriteDef } from '../sheet';

function viking(p: Pose): Figure {
  const f = new Figure(W, H);
  const hip = new Bone(X0 + p.hip[0], HIP_Y + p.hip[1]);
  const torso = hip.child(0, 0, p.lean);

  // the round shield on the far arm, behind the body
  const fsh = torso.at(-5.5, -15.5);
  const [fup, ffo] = arm(fsh, [fsh[0] + p.off[0], fsh[1] + p.off[1]]);
  f.part(fup, [[-2.6, -1], [2.6, -1], [2.2, 8], [-2.2, 8]], 'skin', 0.5, { dim: 1 });
  f.part(ffo, [[-2.3, -0.5], [2.3, -0.5], [2.4, 6.5], [-2.4, 6.5]], 'leather', 0.6, { dim: 1 });
  const shield = new Bone(...ffo.at(0, 5), p.offA);
  f.part(shield, ell(-2, -1, 9, 9.5, 24), 'leather', 0.7, { trim: ['steel', 1], details: [0, 1, 2, 3, 4, 5].flatMap((k) => [[-9 + k * 3.5, -1, 'leather', 1]] as [number, number, 'leather', number][]) });
  f.part(shield, [[-7.5, -3], [5.5, -3], [5.5, 1], [-7.5, 1]], 'red', 0.75, { profile: 'flat' });
  f.part(shield, ell(-1, -1, 2.6, 2.6), 'steel', 0.8); // boss

  legs(hip, p.feet, (th, sh, ft, z, dim) => {
    f.part(th, [[-3.8, -1.5], [3.8, -1.5], [3.2, 11.5], [-3.2, 11.5]], 'leather', z, { dim, folds: [0.4, 3, 1] }); // trousers
    f.part(sh, [[-2.8, 0], [2.8, 0], [2.4, 11], [-2.4, 11]], 'fur', z + 0.1, { dim, folds: [0.6, 2.4, 1] }); // leg wraps
    f.part(ft, [[-2.8, -2], [2.6, -2], [5, 0.6], [6, 3], [-3, 3]], 'leather', z + 0.15, { dim }); // boot
  });

  f.part(torso, [[-7.4, -3], [7.6, -3], [8.4, 7], [-7.8, 7]], 'steel', 3.0, { mail: true }); // mail skirt
  f.part(torso, [[-8.4, -17.5], [8, -17.5], [9, -11], [8, -3], [-7.6, -3], [-8.8, -11]], 'steel', 3.1, { mail: true }); // mail shirt
  f.part(torso, [[-8, -6], [8.2, -6], [8.2, -2], [-8, -2]], 'leather', 3.5); // belt
  f.part(torso, [[1, -6.4], [4, -6.4], [4, -1.6], [1, -1.6]], 'steel', 3.6); // buckle
  f.part(torso.child(0, -17, p.cape - p.lean), [[-9.5, -2], [9.5, -2], [10, 3], [4, 5.5], [-4, 5], [-10.5, 3.5]], 'fur', 3.7, { folds: [0.7, 2, 0] }); // fur mantle

  const head = torso.child(1, -19, p.head);
  f.part(head, [[-4.4, -1], [4.8, -1], [5.2, 3.5], [3, 8.5], [0, 10], [-3, 8.5], [-4.5, 3]], 'hair', 4.8, { folds: [0.5, 1.8, 0] }); // beard
  f.part(head, [[-4.4, 1], [-4.8, -5], [-2, -7], [4, -7], [5.4, -3.5], [5.4, 0.5], [2.5, 1.5]], 'skin', 5, { details: [[3.4, -3.3, 'darksteel', 0], [1.2, -3.3, 'darksteel', 0]] }); // face
  f.part(head, [[-2, 1.5], [5.4, 0.5], [5, 3], [-1, 3.5]], 'hair', 5.05); // moustache
  f.part(head, [[-5.2, -4.3], [-4.8, -8.5], [-2, -11], [2, -11.2], [4.8, -9], [5.6, -4.3]], 'steel', 5.1, { trim: ['darksteel', 1] }); // helm
  f.part(head, [[0.3, -4.5], [1.8, -4.5], [1.8, -0.6], [0.3, -0.6]], 'steel', 5.2); // nasal
  f.part(head, [[-5.6, -5], [-6.5, -8.5], [-9, -12], [-10, -16.5], [-7.5, -13.5], [-4.4, -8]], 'bone', 5.0); // far horn
  f.part(head, [[3.8, -8.8], [6.6, -10.5], [8.8, -14.5], [9.2, -18.5], [11, -14], [9.5, -9.5], [5.8, -6.2]], 'bone', 5.3); // near horn

  const sh = torso.at(5.8, -15.5);
  const fist: Pt = [sh[0] + p.fist[0], sh[1] + p.fist[1]];
  const [up, fo] = arm(sh, fist);
  const za = p.za;
  f.part(up, [[-2.8, -1], [2.8, -1], [2.4, 8], [-2.4, 8]], 'skin', za);
  f.part(fo, [[-2.5, -0.5], [2.5, -0.5], [2.6, 6.2], [-2.6, 6.2]], 'leather', za + 0.1, { trim: ['fur', 1] }); // bracer
  const ax = new Bone(fist[0], fist[1], p.wpn);
  f.part(ax, [[-0.9, 4.5], [0.9, 4.5], [0.9, -24], [-0.9, -24]], 'leather', za + 0.3); // haft
  f.part(ax, [[0.6, -24.5], [4, -26], [8, -28.5], [9.8, -23], [9.6, -17], [8, -12.5], [5.5, -15], [2.5, -18.5], [0.6, -18.5]], 'steel', za + 0.35, { trim: ['steel', 0], details: [[8.6, -25, 'steel', 6], [9, -21, 'steel', 6], [8.7, -17, 'steel', 6]] }); // bearded head
  f.part(ax, [[-2.5, -23], [-0.6, -24], [-0.6, -19.5], [-2.5, -20.5]], 'darksteel', za + 0.32); // back spike
  f.part(ax, ell(0.3, 0.5, 2.7, 2.6), 'skin', za + 0.4); // fist
  f.part(new Bone(sh[0], sh[1], torso.a * 0.65 + up.a * 0.35), ell(0.3, 0.3, 4.6, 3.9), 'fur', za + 0.5); // near shoulder pelt

  if (p.smear) smear(f, sh, p.smear, 27, 'smear', za - 0.3, 'white');
  return f;
}

const REST: Partial<Pose> = { fist: [6, 12], wpn: 0.35, off: [-1, 10], offA: 0 };
const C = common(REST);
const P = (kw: Partial<Pose>) => pose(REST, kw);
// ready, wind-up over the shoulder, peak, the chop with its trail, impact (held longest), recovery
const ATTACK: [number, Pose][] = [
  [220, P({})],
  [100, P({ hip: [-1, 0], lean: -0.14, fist: [2, -7], wpn: -0.6, za: 2, off: [1, 8], cape: 0.16 })],
  [120, P({ hip: [-2, -1], lean: -0.22, fist: [-1, -11], wpn: -1.3, za: 2, off: [2, 7], cape: 0.22, plume: 0.1 })],
  [60, P({ hip: [1, 0], lean: 0.08, fist: [10, -6], wpn: 0.7, smear: [[[-1, -11], -1.3], [[10, -6], 0.7]], feet: [[-4, 0, 0], [7, 1.5, -0.1]] })],
  [170, P({ hip: [2, 2], lean: 0.24, fist: [12, 6], wpn: 2.0, smear: [[[10, -6], 0.7], [[12, 6], 2.0]], feet: [[-6, 1, 0.3], [9, 0, 0]], off: [-3, 11], cape: 0.3 })],
  [130, P({ hip: [1, 1], lean: 0.1, fist: [9, 11], wpn: 1.4, feet: [[-5, 0, 0], [8, 0, 0]], cape: 0.2 })],
];

// #156: Leap: crouch with the axe drawn back, airborne with it overhead, land with it buried in the ground, rise
const LEAP: [number, Pose][] = [
  [90, P({ hip: [0, 6], lean: 0.25, head: 0.1, fist: [2, 3], wpn: -0.5, za: 2, feet: [[-6, 0, 0], [6, 0, 0]], cape: 0.2 })],
  [170, P({ hip: [1, -5], lean: 0.05, head: -0.1, fist: [1, -5], wpn: -1.7, za: 2, feet: [[-6, 6, 0.4], [5, 4, 0.3]], off: [1, 6], cape: 0.55, plume: 0.2 })],
  [200, P({ hip: [2, 5], lean: 0.35, fist: [12, 8], wpn: 2.0, feet: [[-8, 0, 0], [9, 0, 0]], off: [-3, 10], cape: 0.35 })],
  [120, P({ hip: [1, 2], lean: 0.12, fist: [9, 11], wpn: 1.3, feet: [[-6, 0, 0], [7, 0, 0]], cape: 0.2 })],
];

export const sprite: SpriteDef = {
  id: 'viking', w: W, h: H, anchor: [X0, 75], tall: 56,
  anims: {
    idle: C.idle.map((p) => [200, viking(p)]),
    walk: C.walk.map((p) => [100, viking(p)]),
    attack: ATTACK.map(([ms, p]) => [ms, viking(p)]),
    cast: C.cast.map(([ms, p]) => [ms, viking(p)]),
    hurt: C.hurt.map(([ms, p]) => [ms, viking(p)]),
    death: C.death.map(([ms, p]) => [ms, viking(p)]),
    skill: LEAP.map(([ms, p]) => [ms, viking(p)]),
  },
  impact: 4,
};
