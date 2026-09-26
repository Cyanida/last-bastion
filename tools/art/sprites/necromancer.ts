/** #156: the Necromancer: a tall pointed hood over a shadowed face with green eyes, a torn purple robe with bone clasps, a staff crowned with a soul crystal. 55 px tall. */
import { arm, common, H, HIP_Y, legs, pose, W, X0, type Pose } from '../humanoid';
import { Bone, ell, Figure, type Pt } from '../rig';
import type { SpriteDef } from '../sheet';

function necromancer(p: Pose): Figure {
  const f = new Figure(W, H);
  const hip = new Bone(X0 + p.hip[0], HIP_Y + p.hip[1]);
  const torso = hip.child(0, 0, p.lean);

  f.part(torso.child(-3, -17, p.cape - p.lean), [[-1, 0], [4, 0], [3, 12], [2, 24], [-2, 27.5], [-5, 25], [-8, 27], [-11, 24], [-10, 14], [-6, 4]], 'violet', 0, { dim: 1, folds: [0.8, 3, 0] }); // cloak behind

  legs(hip, p.feet, (_th, sh, ft, z, dim) => {
    f.part(sh, [[-2.6, 0], [2.6, 0], [2.3, 11], [-2.3, 11]], 'violet', z, { dim, profile: 'flat', folds: [0.4, 3, 0] });
    f.part(ft, [[-2.4, -1.5], [2.2, -1.5], [5, 1], [5.8, 3], [-2.6, 3]], 'darksteel', z + 0.15, { dim }); // pointed boot
  });

  const skirt = torso.child(0, -3, p.skirt);
  f.part(skirt, [[-6.8, 0], [7, 0], [8.5, 12], [9, 19.5], [6, 18], [3.5, 20.5], [0, 18.5], [-3, 20.5], [-6, 18.5], [-9, 20], [-8.4, 12]], 'violet', 3.0, { folds: [0.6, 3, 0] }); // torn robe
  f.part(torso, [[-7, -17], [6.6, -17], [7.4, -10], [7, -3], [-6.6, -3], [-7.6, -10]], 'violet', 3.1, { folds: [0.4, 2.6, 0] });
  f.part(torso, [[-0.6, -17], [2, -17], [2.4, -3], [-1, -3]], 'violet', 3.15, { dim: 1, profile: 'flat' }); // front seam
  f.part(torso, [[-7, -5], [7.2, -5], [7.2, -2.6], [-7, -2.6]], 'leather', 3.5); // belt
  f.part(torso, ell(0.7, -3.8, 1.8, 1.6), 'bone', 3.6); // skull buckle
  f.part(torso, ell(-4, -15.5, 1.5, 1.5), 'bone', 3.6);
  f.part(torso, ell(5, -15.5, 1.5, 1.5), 'bone', 3.6); // clasps

  const head = torso.child(0.8, -19, p.head);
  f.part(head, [[-5.6, 2], [-6, -4], [-5, -9], [-3, -13], [-1, -17], [1.5, -21 - p.plume * 10], [2.5, -15], [5, -9], [6.2, -4], [6, 1.5], [0, 3]], 'violet', 5, { folds: [0.4, 2.4, 1] }); // tall hood
  f.part(head, [[-1, 0.5], [0, -6], [3, -7.5], [5.2, -5], [5.2, 0.5], [2, 2]], 'darksteel', 5.1, { profile: 'flat', details: [[2.6, -4.3, 'necro', 5], [4.4, -4.3, 'necro', 5]] }); // shadowed face, green eyes

  // the far hand held up with a soul flame over it
  const fsh = torso.at(-5, -15);
  const off: Pt = [fsh[0] + p.off[0], fsh[1] + p.off[1]];
  const [fup, ffo] = arm(fsh, off);
  f.part(fup, [[-2.6, -1], [2.6, -1], [2.2, 8], [-2.2, 8]], 'violet', 2.5, { dim: 1 });
  f.part(ffo, [[-2.4, -0.5], [2.4, -0.5], [3, 5], [-3, 5]], 'violet', 2.6, { dim: 1 });
  f.part(ffo, ell(0, 6.4, 1.6, 1.6), 'bone', 2.65, { dim: 1 }); // bony hand
  const fl = 1.6 + 1.8 * p.fx;
  f.part(new Bone(off[0], off[1] - 3 - fl), [[0, -fl * 1.8], [fl, 0], [0, fl * 0.8], [-fl, 0]], 'necro', 5.5, { outline: false }); // soul flame

  // the staff in the near hand
  const sh = torso.at(5, -15);
  const fist: Pt = [sh[0] + p.fist[0], sh[1] + p.fist[1]];
  const [up, fo] = arm(sh, fist);
  const st = new Bone(fist[0], fist[1], p.wpn);
  f.part(st, [[-0.9, 16], [0.9, 16], [0.9, -26], [-0.9, -26]], 'leather', p.za - 0.1, { folds: [0.3, 3, 1] }); // staff
  f.part(st, [[-2.5, -25], [2.5, -25], [3, -28], [1.5, -27], [0, -29], [-1.5, -27], [-3, -28]], 'bone', p.za - 0.05); // claw
  const cr = 2 + 0.8 * p.fx;
  f.part(st, [[0, -27 - cr * 2.2], [cr, -27 - cr], [0, -27], [-cr, -27 - cr]], 'necro', p.za, { details: [[0, -27 - cr * 1.4, 'necro', 6]] }); // crystal
  f.part(up, [[-2.6, -1], [2.6, -1], [2.4, 8], [-2.4, 8]], 'violet', p.za + 0.1);
  f.part(fo, [[-2.4, -0.5], [2.4, -0.5], [3, 5], [-3, 5]], 'violet', p.za + 0.2, { trim: ['bone', 0] }); // wide sleeve
  f.part(st, ell(0.3, 0.5, 2, 2), 'bone', p.za + 0.3); // bony fist
  if (p.fx > 0.9) f.part(st, ell(0, -27 - cr, cr * 2.4, cr * 2.4, 16), 'necro', p.za - 0.2, { profile: 'flat', outline: false }); // the crystal flares
  return f;
}

const REST: Partial<Pose> = { fist: [5, 11], wpn: 0.12, off: [-7, 1], za: 7 };
const C = common(REST);
const P = (kw: Partial<Pose>) => pose(REST, kw);
// ready, draw the staff back, raise it as the crystal flares, thrust, cast (the bolt leaves the crystal), settle
const ATTACK: [number, Pose][] = [
  [220, P({ fx: 0.4 })],
  [110, P({ hip: [-1, 0], lean: -0.1, fist: [2, 8], wpn: -0.3, fx: 0.7, cape: 0.18 })],
  [120, P({ hip: [-1, -1], lean: -0.16, fist: [3, 1], wpn: -0.45, fx: 1, cape: 0.22, plume: 0.1 })],
  [60, P({ hip: [1, 0], lean: 0.08, fist: [9, 4], wpn: 0.6, fx: 1, feet: [[-4, 0, 0], [6, 1, -0.1]] })],
  [170, P({ hip: [2, 1], lean: 0.16, fist: [12, 6], wpn: 1.0, fx: 0.2, plume: -0.1, feet: [[-5, 0, 0.2], [8, 0, 0]], cape: 0.3 })],
  [130, P({ hip: [1, 0], lean: 0.06, fist: [7, 9], wpn: 0.4, fx: 0.3, feet: [[-5, 0, 0], [6, 0, 0]] })],
];

// #156: Corpse Explosion: the staff drawn up as the crystal flares, then swept down at the dead with the free hand clawed open
const BLAST: [number, Pose][] = [
  [100, P({ hip: [0, -1], lean: -0.12, head: -0.1, fist: [3, 2], wpn: -0.3, off: [-8, -3], fx: 0.8, cape: 0.2 })],
  [240, P({ hip: [2, 2], lean: 0.22, head: 0.15, fist: [11, 7], wpn: 1.1, off: [-4, 5], offA: 0.5, fx: 1, feet: [[-6, 0, 0.2], [8, 0, 0]], cape: 0.35 })],
  [150, P({ hip: [1, 0], lean: 0.08, fist: [7, 10], wpn: 0.4, fx: 0.4, feet: [[-5, 0, 0], [6, 0, 0]] })],
];

export const sprite: SpriteDef = {
  id: 'necromancer', w: W, h: H, anchor: [X0, 75], tall: 55,
  anims: {
    idle: C.idle.map((p) => [200, necromancer(p)]),
    walk: C.walk.map((p) => [100, necromancer(p)]),
    attack: ATTACK.map(([ms, p]) => [ms, necromancer(p)]),
    cast: C.cast.map(([ms, p]) => [ms, necromancer({ ...p, fist: [p.fist[0] + 2, p.fist[1] + 9] })]), // the long staff stays in the cell
    hurt: C.hurt.map(([ms, p]) => [ms, necromancer(p)]),
    death: C.death.map(([ms, p]) => [ms, necromancer(p)]),
    skill: BLAST.map(([ms, p]) => [ms, necromancer(p)]),
  },
  impact: 4,
};
