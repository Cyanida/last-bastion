/** #156: the Necromancer's skeleton: bare bones, a skull with green soul-lit eyes, a notched short sword. About 40 px tall (the old 14-row grid at scale 3), smaller than a champion. */
import { foot } from '../humanoid';
import { Bone, ell, Figure, ik, limb, type Pt } from '../rig';
import type { SpriteDef } from '../sheet';

const W = 60, H = 56;
const GROUND = 52, X0 = 26;
const HIP_Y = GROUND - 2 - 15.4; // legs 16 long

interface P { hip: Pt; lean: number; head: number; feet: [[number, number, number], [number, number, number]]; fist: Pt; wpn: number; fall: number }
const pose = (kw: Partial<P> = {}): P => ({ hip: [0, 0], lean: 0, head: 0, feet: [[-3, 0, 0], [3, 0, 0]], fist: [5, 8], wpn: 0.4, fall: 0, ...kw });

function skeleton(p: P): Figure {
  const f = new Figure(W, H);
  const hip = new Bone(X0 + p.hip[0], HIP_Y + p.hip[1]);
  const torso = hip.child(0, 0, p.lean);
  p.feet.forEach(([dx, lift, fa], i) => {
    const root = hip.at(i ? 1.5 : -2, 0.5);
    const ankle: Pt = [X0 + dx, GROUND - 2 - lift - (i ? 0 : 1)];
    const knee = ik(root, ankle, 8, 8, 1);
    const th = limb(root, knee), sh = limb(knee, ankle), dim = 1 - i, z = 1 + i;
    f.part(th, [[-1, 0], [1, 0], [1, 8], [-1, 8]], 'bone', z, { dim });
    f.part(sh, [[-1, 0], [1, 0], [0.9, 8], [-0.9, 8]], 'bone', z + 0.1, { dim });
    f.part(th, ell(0, 8, 1.6, 1.4), 'bone', z + 0.2, { dim }); // knee
    f.part(new Bone(ankle[0], ankle[1], fa), [[-1.4, -0.6], [1.6, -0.6], [3.8, 1.2], [3.8, 2], [-1.6, 2]], 'bone', z + 0.15, { dim });
  });
  f.part(torso, [[-3.6, -1.5], [3.6, -1.5], [2.6, 1.8], [-2.6, 1.8]], 'bone', 3); // pelvis
  f.part(torso, [[-0.8, -9], [0.8, -9], [0.8, -1], [-0.8, -1]], 'bone', 3.1); // spine
  const ribs: [number, number, 'bone', number][] = [-11, -10, -9, -8, -7, -6].flatMap((y) => (y % 2 ? [] : [[-2.5, y + 0.5, 'bone', 0], [-1.5, y + 0.5, 'bone', 0]] as [number, number, 'bone', number][]));
  f.part(torso, [[-4.6, -13], [4.4, -13], [4.8, -8.5], [3, -5], [-3, -5], [-5, -8.5]], 'bone', 3.2, { details: [...ribs, ...ribs.map(([x, y]) => [x + 4.2, y, 'bone', 0] as [number, number, 'bone', number])] }); // ribcage
  const head = torso.child(0.6, -13.5, p.head);
  f.part(head, [[-3.6, 0], [-4, -4], [-2.4, -7], [1.6, -7.4], [4, -5], [4, -1.4], [2.6, 0.4], [2.6, 1.8], [-1, 1.8]], 'bone', 5, { details: [[1.6, -3.4, 'necro', 5], [3.2, -3.4, 'necro', 5], [2.6, -1.2, 'bone', 0], [1.5, 1, 'bone', 1], [2.5, 1, 'bone', 1]] }); // skull
  const sh = torso.at(3.5, -11.5), fsh = torso.at(-3.5, -11.5);
  const off: Pt = [fsh[0] + 1, fsh[1] + 9];
  f.part(limb(fsh, ik(fsh, off, 5, 5, -1)), [[-0.8, 0], [0.8, 0], [0.8, 5], [-0.8, 5]], 'bone', 2.5, { dim: 1 });
  f.part(limb(ik(fsh, off, 5, 5, -1), off), [[-0.8, 0], [0.8, 0], [0.8, 5], [-0.8, 5]], 'bone', 2.55, { dim: 1 });
  const fist: Pt = [sh[0] + p.fist[0], sh[1] + p.fist[1]];
  const el = ik(sh, fist, 5, 5, -1);
  const sw = new Bone(fist[0], fist[1], p.wpn);
  f.part(sw, [[-1.1, -1.8], [1.1, -1.8], [1, -12], [0, -14], [-1, -12]], 'steel', 6, { details: [[1, -6, 'steel', 0], [-0.9, -9, 'steel', 0]] }); // notched blade
  f.part(sw, [[-2.8, -2.2], [2.8, -2.2], [2.8, -1.2], [-2.8, -1.2]], 'leather', 6.1); // guard
  f.part(sw, [[-0.7, -1.2], [0.7, -1.2], [0.7, 2], [-0.7, 2]], 'leather', 6.1);
  f.part(limb(sh, el), [[-0.9, 0], [0.9, 0], [0.9, 5], [-0.9, 5]], 'bone', 6.2);
  f.part(limb(el, fist), [[-0.9, 0], [0.9, 0], [0.9, 5], [-0.9, 5]], 'bone', 6.3);
  f.part(sw, ell(0, 0, 1.3, 1.3), 'bone', 6.4);
  return f;
}

const IDLE = [0, 1, 1, 0].map((dy, i) => pose({ hip: [0, dy], head: [0, 0.05, 0.08, 0.03][i] }));
const WALK = Array.from({ length: 8 }, (_, i) => {
  const ph = i / 8, swing = Math.cos(2 * Math.PI * ph);
  return pose({ hip: [0, [0, 1, 0, -1][i % 4]], lean: 0.08, feet: [foot(ph + 0.5, 4.5), foot(ph, 4.5)].map(([x, l, a]) => [x, l * 0.7, a]) as P['feet'], fist: [5 - swing, 8] });
});
const ATTACK: [number, P][] = [
  [180, pose()],
  [100, pose({ hip: [-1, 0], lean: -0.15, fist: [2, -5], wpn: -0.6 })],
  [90, pose({ hip: [-1, -1], lean: -0.2, fist: [0, -8], wpn: -1.1, head: -0.1 })],
  [60, pose({ hip: [1, 0], lean: 0.1, fist: [7, -3], wpn: 0.8, feet: [[-3, 0, 0], [5, 1, 0]] })],
  [150, pose({ hip: [1, 1], lean: 0.2, fist: [8, 5], wpn: 1.9, feet: [[-4, 0, 0.2], [6, 0, 0]] })],
  [110, pose({ lean: 0.08, fist: [6, 8], wpn: 1.1 })],
];
const HURT: [number, P][] = [
  [90, pose({ hip: [-2, 1], lean: -0.25, head: -0.3, fist: [3, 6], wpn: 0.1 })],
  [130, pose({ hip: [-1, 0], lean: -0.1, head: -0.15, fist: [4, 7], wpn: 0.3 })],
];
// the bones give way and clatter into a heap
const DEATH: [number, P][] = [
  [100, pose({ hip: [-1, 2], lean: -0.2, head: -0.3 })],
  [110, pose({ hip: [0, 6], lean: 0.3, head: 0.5, fist: [6, 10], wpn: 1.4, feet: [[-4, 0, 0], [4, 0, 0]] })],
  [130, pose({ hip: [1, 8], lean: 0.9, head: 1.0, fist: [8, 12], wpn: 2.2, feet: [[-4, 0, 0.3], [5, 0, 0.3]] })],
  [400, pose({ hip: [2, 10], lean: 1.4, head: 1.6, fist: [10, 10], wpn: 2.9, feet: [[-3, 0, 0.6], [6, 0, 0.5]] })],
];

export const sprite: SpriteDef = {
  id: 'skeleton', w: W, h: H, anchor: [X0, GROUND], tall: 40,
  anims: {
    idle: IDLE.map((p) => [200, skeleton(p)]),
    walk: WALK.map((p) => [100, skeleton(p)]),
    attack: ATTACK.map(([ms, p]) => [ms, skeleton(p)]),
    cast: IDLE.map((p) => [120, skeleton(p)]), // skeletons have no ability: a rattle of the idle
    hurt: HURT.map(([ms, p]) => [ms, skeleton(p)]),
    death: DEATH.map(([ms, p]) => [ms, skeleton(p)]),
  },
  impact: 4,
};
