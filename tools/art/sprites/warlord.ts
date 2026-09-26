/**
 * #158: The Warlord. The Paladin's rig at 1.25× (69 art px tall; bosses draw at 4/3, so about 1.65× the Paladin on screen) and
 * broader: horned iron helm, a fur mantle over a studded leather hauberk, bare arms, a red sash and a two-handed war hammer. His
 * special is the ground slam: he heaves the hammer overhead with both hands over the telegraph, then brings it down in front of
 * him with a ring of dust and pale steel shock (physical).
 */
import { Bone, ell, Figure, ik, limb, type Material, type Pt } from '../rig';
import type { SpriteDef } from '../sheet';

const S = 1.25;
const W = 124, H = 104;
const GROUND = 97;
const X0 = 50;
const HIP_Y = GROUND - 3 * S - 25;
const sc = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [x * S, y * S] as const);
const E = (cx: number, cy: number, rx: number, ry: number): Pt[] => ell(cx * S, cy * S, rx * S, ry * S);
type Px = [number, number, Material, number];
const dt = (d: Px[]): Px[] => d.map(([x, y, m, t]) => [x * S, y * S, m, t]);

type Foot = [x: number, lift: number, angle: number];
interface Pose {
  hip: Pt; lean: number; head: number; mantle: number;
  feet: [far: Foot, near: Foot];
  fist: Pt; hammer: number; zh: number;
  far: Pt | null; // the far hand: on the haft (null: hanging free)
  smear: [[Pt, number], [Pt, number]] | null;
  quake: number; // slam: size of the dust and shock ring on the ground (0: none)
}
const pose = (kw: Partial<Pose> = {}): Pose => ({
  hip: [0, 0], lean: 0.04, head: 0, mantle: 0, feet: [[-5.5, 0, 0], [5.5, 0, 0]],
  fist: [6, 12], hammer: 0.25, zh: 7.2, far: null, smear: null, quake: 0, ...kw,
});

function warlord(p: Pose): Figure {
  const f = new Figure(W, H);
  const hip = new Bone(X0 + p.hip[0] * S, HIP_Y + p.hip[1] * S);
  const torso = hip.child(0, 0, p.lean);
  const world = new Bone(0, 0);

  // far arm first: behind the body
  const shF = torso.at(-6.5 * S, -16 * S);
  const farFist: Pt = p.far ? [shF[0] + p.far[0] * S, shF[1] + p.far[1] * S] : [shF[0] - 1 * S, shF[1] + 14 * S];
  const upF = limb(shF, ik(shF, farFist, 8 * S, 7.5 * S, -1));
  const foF = limb(upF.at(0, 8 * S), farFist);
  f.part(upF, sc([[-2.8, -1], [2.8, -1], [2.5, 8], [-2.5, 8]]), 'flesh', 0.5, { dim: 1 });
  f.part(foF, sc([[-2.6, -0.5], [2.6, -0.5], [2.6, 6.5], [-2.6, 6.5]]), 'hide', 0.6, { dim: 1 }); // fur bracer
  f.part(foF, E(0, 7.4, 2.5, 2.4), 'flesh', 0.7, { dim: 1 });

  p.feet.forEach(([dx, lift, fa], i) => {
    const root = i === 0 ? hip.at(-3 * S, -0.5) : hip.at(2.6 * S, 0.5);
    const ankle: Pt = [X0 + dx * S, GROUND - 3 * S - lift * S - (i === 0 ? 1 : 0)];
    const knee = ik(root, ankle, 11 * S, 11 * S, 1);
    const th = limb(root, knee), sh = limb(knee, ankle);
    const z = 1 + i, dim = 1 - i;
    f.part(th, sc([[-4, -1.5], [4, -1.5], [3.4, 11], [-3.4, 11]]), 'leather', z, { dim, folds: [0.4, 3, 1] }); // breeches
    f.part(sh, sc([[-3.2, 0], [3.2, 0], [2.8, 11], [-2.8, 11]]), 'hide', z + 0.1, { dim, folds: [0.5, 2.5, 1] }); // fur wraps
    f.part(new Bone(ankle[0], ankle[1], fa), sc([[-3, -1], [2.6, -1], [5, 0.6], [6.4, 2.2], [6.4, 3], [-3.2, 3]]), 'leather', z + 0.15, { dim });
    f.part(sh, sc([[-3.4, 0], [3.4, 0], [3.4, 2.4], [-3.4, 2.4]]), 'steel', z + 0.2, { dim }); // knee band
  });

  f.part(torso, sc([[-8.4, -4], [8.6, -4], [10, 8], [3, 9], [-3, 8.6], [-9.6, 8]]), 'leather', 3.0, { folds: [0.4, 3.4, 0], details: dt([[-6, 5, 'steel', 5], [-1, 6, 'steel', 5], [4, 6, 'steel', 5], [8, 5, 'steel', 5]]) }); // hauberk skirt
  f.part(torso, sc([[-9.6, -19], [9.4, -19], [10.6, -11], [9, -4], [-8.6, -4], [-10.2, -11]]), 'leather', 3.1, {
    details: dt([...[-6, -2, 2, 6].flatMap((x): Px[] => [[x, -14, 'steel', 5], [x, -9, 'steel', 5]])]),
  }); // studded hauberk
  f.part(torso, sc([[-9, -7], [9.4, -7], [9.4, -3.4], [-9, -3.4]]), 'red', 3.5, { folds: [0.4, 2.5, 0] }); // sash
  f.part(torso, sc([[-1, -7.6], [3.8, -7.6], [3.8, -2.8], [-1, -2.8]]), 'gold', 3.6); // clasp
  f.part(torso, sc([[-11.5, -22], [9.5, -22], [12, -17], [10, -12.5], [4, -14.5], [-2, -12.5], [-8, -14], [-12.5, -12]]), 'hide', 3.8, { folds: [0.7, 2.2, 0] }); // fur mantle
  f.part(torso.child(-9 * S, -21 * S, p.mantle), sc([[-1, 0], [3, 0], [3, 14], [0, 22], [-4, 20], [-5, 10]]), 'hide', 0.2, { folds: [0.8, 2.6, 1], dim: 1 }); // mantle tail behind

  const head = torso.child(1.2 * S, -21 * S, p.head);
  f.part(head, sc([[-4.4, 0.8], [-4.8, -4], [4.8, -4], [5.4, 0.2], [3.6, 3.6], [-1, 4], [-3.8, 2.8]]), 'hide', 4.9, { folds: [0.5, 1.8, 1] }); // beard
  f.part(head, sc([[-4.6, -3], [-4.6, -6], [5, -6], [5.2, -3], [3.8, -1.2], [-2, -1.2]]), 'flesh', 5, { details: dt([[2.6, -4.2, 'white', 6], [3.6, -4.2, 'darksteel', 0], [4.8, -3, 'flesh', 1]]) }); // face
  f.part(head, sc([[-5.2, -5.4], [-5.2, -9.2], [-2.6, -11.4], [2.8, -11.4], [5.4, -9.2], [5.8, -5.4]]), 'steel', 5.1, { trim: ['darksteel', 1], details: dt([[0.5, -10, 'steel', 6]]) }); // iron cap
  f.part(head, sc([[1.6, -5.8], [3, -5.8], [3, -2.2], [1.6, -2.2]]), 'steel', 5.2); // nasal
  f.part(head.child(-4.6 * S, -8 * S, -0.3), sc([[0, -1.6], [0, 1.6], [-4, 0.6], [-8, -3], [-9, -7], [-5.6, -3.6]]), 'white', 5.15); // horn
  f.part(head.child(4.6 * S, -8.4 * S, 0.2), sc([[0, -1.6], [0, 1.6], [3, 0], [6, -4], [6.4, -8], [3.4, -3.4]]), 'white', 4.8, { dim: 1 }); // far horn

  const sh = torso.at(6.8 * S, -16 * S);
  const fist: Pt = [sh[0] + p.fist[0] * S, sh[1] + p.fist[1] * S];
  const up = limb(sh, ik(sh, fist, 8 * S, 7.5 * S, -1));
  const fo = limb(up.at(0, 8 * S), fist);
  const za = 7, zh = p.zh;
  f.part(up, sc([[-3, -1], [3, -1], [2.7, 8], [-2.7, 8]]), 'flesh', za); // bare arm
  f.part(fo, sc([[-2.8, -0.5], [2.8, -0.5], [2.8, 6.5], [-2.8, 6.5]]), 'hide', za + 0.1, { folds: [0.4, 2, 1] });
  const hm = new Bone(fist[0], fist[1], p.hammer);
  f.part(hm, sc([[-1, 5], [1, 5], [1, -30], [-1, -30]]), 'leather', zh, { details: dt([...[1, -3, -7].map((y): Px => [0, y, 'leather', 1])]) }); // haft
  f.part(hm, sc([[-6.5, -36], [6.5, -36], [7, -29], [-7, -29]]), 'darksteel', zh + 0.1, { trim: ['steel', 1] }); // hammer head
  f.part(hm, sc([[-1.8, -38.5], [1.8, -38.5], [1.8, -35.5], [-1.8, -35.5]]), 'steel', zh + 0.15); // spike
  f.part(hm, E(0, 0.2, 3, 2.8), 'flesh', za + 0.4); // fist
  if (p.far) f.part(new Bone(farFist[0], farFist[1], p.hammer), E(0, 0, 2.8, 2.6), 'flesh', zh + 0.2); // the far hand, on the haft
  f.part(new Bone(sh[0], sh[1], torso.a * 0.6 + up.a * 0.4), E(0.3, 0, 4.8, 4.2), 'hide', za + 0.5, { folds: [0.5, 2, 0] }); // fur shoulder

  if (p.quake) {
    const cx = hm.at(0, -32 * S)[0], q = p.quake; // under the hammer head
    f.part(world, ell(cx, GROUND - 1, q, q * 0.28, 28), 'smear', -2, { profile: 'flat', outline: false });
    f.part(world, ell(cx, GROUND - 1, q * 0.75, q * 0.2, 24), 'hide', -1.9, { profile: 'flat', outline: false, dim: 0 });
    for (const [dx, h] of [[-0.8, 6], [-0.35, 9], [0.3, 8], [0.75, 5]])
      f.part(world, [[cx + dx * q - 2, GROUND - 1], [cx + dx * q + 2, GROUND - 1], [cx + dx * q * 1.1 + 1, GROUND - 1 - h * S], [cx + dx * q * 1.1 - 1, GROUND - 1 - h * S]], 'hide', 8, { dim: 1 }); // flung earth
  }

  if (p.smear) {
    const [[f0, a0], [f1, a1]] = p.smear;
    const outer: Pt[] = [], inner: Pt[] = [];
    for (let k = 0; k < 13; k++) {
      const s = k / 12;
      const fx = sh[0] + (f0[0] + (f1[0] - f0[0]) * s) * S, fy = sh[1] + (f0[1] + (f1[1] - f0[1]) * s) * S;
      const a = a0 + (a1 - a0) * s, d = [Math.sin(a), -Math.cos(a)];
      outer.push([fx + 37 * S * d[0], fy + 37 * S * d[1]]);
      inner.push([fx + (30 - 8 * s) * S * d[0], fy + (30 - 8 * s) * S * d[1]]);
    }
    f.part(world, [...outer, ...inner.reverse()], 'smear', zh - 0.3, { profile: 'flat', outline: false });
  }
  return f;
}

function foot(ph: number, St = 5.5): Foot {
  ph = ((ph % 1) + 1) % 1;
  if (ph < 0.5) {
    const s = ph / 0.5, heel = Math.max(0, (s - 0.7) / 0.3);
    return [St - 2 * St * s, 1.5 * heel, 0.3 * heel];
  }
  const s = (ph - 0.5) / 0.5;
  return [-St + 2 * St * (0.5 - 0.5 * Math.cos(Math.PI * s)), 3 * Math.sin(Math.PI * s) + 2 * (1 - s) ** 2, 0.35 * (1 - s) - 0.15 * s];
}

const IDLE = ([[0, 0], [1, 0.04], [1, 0.07], [0, 0.03]] as const).map(([dy, m]) => pose({ hip: [0, dy], mantle: m, fist: [6, 12 + dy * 0.5] }));
const WALK = Array.from({ length: 8 }, (_, i) => {
  const ph = i / 8, swing = Math.cos(2 * Math.PI * ph);
  return pose({ hip: [0, [0, 1.2, 0, -1][i % 4]], lean: 0.1, feet: [foot(ph + 0.5), foot(ph)], mantle: 0.1 + 0.05 * swing, fist: [6 - 1.5 * swing, 12 - 0.5 * Math.abs(swing)], hammer: 0.35 });
});
// his touch: a backhand sweep of the hammer
const ATTACK: [number, Pose][] = [
  [250, pose()],
  [110, pose({ hip: [-1, 0], lean: -0.12, fist: [2, -6], hammer: -0.5, zh: 2.5 })],
  [130, pose({ hip: [-1.5, -1], lean: -0.18, fist: [0, -10], hammer: -1.0, zh: 2.5, mantle: 0.1 })],
  [60, pose({ hip: [1, 0], lean: 0.08, fist: [11, -4], hammer: 0.9, smear: [[[0, -10], -1.0], [[11, -4], 0.9]], feet: [[-6, 0, 0], [8, 1, 0]] })],
  [190, pose({ hip: [2, 1], lean: 0.2, fist: [12, 6], hammer: 2.0, smear: [[[11, -4], 0.9], [[12, 6], 2.0]], feet: [[-6, 1, 0.3], [9, 0, 0]], mantle: 0.15 })],
  [140, pose({ hip: [1, 0], lean: 0.1, fist: [9, 11], hammer: 1.3, feet: [[-6, 0, 0], [8, 0, 0]] })],
];
// the slam: grip with both hands, heave overhead, rise on his toes (held to the end of the telegraph) | smash down, the ground bursts
const SPECIAL: [number, Pose][] = [
  [220, pose({ hip: [-1, 1], lean: 0, fist: [3, 4], far: [8, 5], hammer: -0.3, feet: [[-6, 0, 0], [6, 0, 0]] })],
  [260, pose({ hip: [-2, -1], lean: -0.14, head: -0.15, fist: [-1, -10], far: [3, -9], hammer: -0.9, zh: 2.5, mantle: 0.15, feet: [[-7, 0, 0], [6, 0.5, 0]] })],
  [320, pose({ hip: [-2, -3], lean: -0.26, head: -0.25, fist: [-4, -13], far: [0, -13], hammer: -1.8, zh: 2.5, mantle: 0.25, feet: [[-8, 1.5, 0.4], [6, 2, 0.3]] })],
  [180, pose({ hip: [2, 4], lean: 0.42, head: 0.1, fist: [12, 8], far: [16, 9], hammer: 1.9, smear: [[[-4, -13], -1.8], [[12, 8], 1.9]], feet: [[-9, 0, 0], [9, 0, 0]], mantle: 0.05, quake: 22 })],
  [330, pose({ hip: [2, 4], lean: 0.4, head: 0.05, fist: [12, 8], far: [16, 9], hammer: 1.95, feet: [[-9, 0, 0], [9, 0, 0]], quake: 32 })],
  [260, pose({ hip: [1, 1], lean: 0.15, fist: [9, 10], hammer: 1.3, feet: [[-7, 0, 0], [7, 0, 0]] })],
];
const HURT: [number, Pose][] = [
  [100, pose({ hip: [-2, 1], lean: -0.2, head: -0.25, fist: [4, 10], hammer: 0.1, mantle: -0.1, feet: [[-7, 0, 0], [4, 0, 0]] })],
  [150, pose({ hip: [-1, 1], lean: -0.1, head: -0.1, fist: [5, 11], hammer: 0.2, feet: [[-6, 0, 0], [4, 0, 0]] })],
];
// he staggers, drops the hammer and topples backwards
const DEATH: [number, Pose][] = [
  [150, pose({ hip: [-1, 2], lean: -0.2, head: -0.2, fist: [5, 12], hammer: 0.6, feet: [[-6, 0, 0], [5, 0, 0]] })],
  [180, pose({ hip: [-1, 7], lean: -0.1, head: 0.2, fist: [8, 15], hammer: 1.6, feet: [[-7, 0, 0.4], [6, 0, 0]] })],
  [160, pose({ hip: [-3, 13], lean: -0.6, head: -0.1, fist: [10, 12], hammer: 2.2, mantle: 0.5, feet: [[-5, 0, 0.5], [8, 0, 0.2]] })],
  [180, pose({ hip: [-6, 16], lean: -1.1, head: -0.2, fist: [13, 8], hammer: 2.6, mantle: 1, feet: [[1, 0, 0.6], [11, 0, 0.5]] })],
  [400, pose({ hip: [-9, 18], lean: -1.45, head: -0.1, fist: [15, 5], hammer: 2.9, mantle: 1.3, feet: [[5, 0, 0.7], [14, 0, 0.6]] })],
];

export const sprite: SpriteDef = {
  id: 'warlord', w: W, h: H, anchor: [X0, GROUND], tall: 69,
  anims: {
    idle: IDLE.map((p) => [220, warlord(p)]),
    walk: WALK.map((p) => [120, warlord(p)]),
    attack: ATTACK.map(([ms, p]) => [ms, warlord(p)]),
    hurt: HURT.map(([ms, p]) => [ms, warlord(p)]),
    death: DEATH.map(([ms, p]) => [ms, warlord(p)]),
    special: SPECIAL.map(([ms, p]) => [ms, warlord(p)]),
  },
  impact: 4,
  specialImpact: 3,
};
