/**
 * #277: The Gravedigger, the Barrowvale's level-3 boss, 1.3× the Paladin but hunched (70 art px with his hat; the Ember Queen 68, the Iron
 * King 74): a dead sexton in a long, patched hide greatcoat with a hump of a back, a rope belt, grey-green rotted skin, a lipless grin
 * and pale grave-light in his eye under a broad, sagging hat. He leans on a great iron spade and carries a lantern of the same pale
 * light in his far hand. Not robed like the Lich and the Plague Abbot, not in plate like a knight. His touch is the spade swung over and
 * down (physical: a pale steel trail); his special is the dig: the spade driven into the ground over the telegraph, then heaved up and
 * the grave-dirt flung ahead; a new phase raises the lantern and its light flares over the ground.
 */
import { Bone, ell, Figure, ik, limb, type Pt } from '../rig';
import { scaled } from '../robed';
import type { SpriteDef } from '../sheet';

const S = 1.3;
const { sc, E, dt } = scaled(S);
const W = 120, H = 104;
const GROUND = 98; // first empty row under the near foot
const X0 = 48; // anchor x between the feet
const HIP_Y = GROUND - 3 * S - 21 * S;

type Foot = [x: number, lift: number, angle: number];
interface Pose {
  hip: Pt; lean: number; head: number; coat: number;
  feet: [far: Foot, near: Foot];
  fist: Pt; spade: number; zs: number; // near hand from the near shoulder; the spade's angle (0 points up from the hand) and depth
  far: Pt; lamp: number; // far hand from the far shoulder; the lantern's light (0: its glow, 1: flaring)
  smear: [[Pt, number], [Pt, number]] | null; // the spade's trail: (fist offset, spade angle) from, to
  clods: number; // grave-dirt flung ahead (0: none)
  quake: number; // a burst on the ground under the blade (0: none)
}
const pose = (kw: Partial<Pose> = {}): Pose => ({
  hip: [0, 0], lean: 0.2, head: -0.12, coat: 0, feet: [[-5, 0, 0], [5, 0, 0]],
  fist: [7, 9], spade: 2.85, zs: 7.2, far: [-11, 9], lamp: 0, smear: null, clods: 0, quake: 0, ...kw,
});

function digger(p: Pose): Figure {
  const f = new Figure(W, H);
  const hip = new Bone(X0 + p.hip[0] * S, HIP_Y + p.hip[1] * S);
  const torso = hip.child(0, 0, p.lean);
  const world = new Bone(0, 0);

  // the far arm, a tone darker, and the lantern hanging from it
  const shF = torso.at(-5.5 * S, -16 * S);
  const farH: Pt = [shF[0] + p.far[0] * S, shF[1] + p.far[1] * S];
  const upF = limb(shF, ik(shF, farH, 8 * S, 7.5 * S, -1));
  const foF = limb(upF.at(0, 8 * S), farH);
  f.part(upF, sc([[-2.8, -1], [2.8, -1], [2.6, 8.5], [-2.6, 8.5]]), 'hide', 0.5, { dim: 1, folds: [0.4, 2.4, 0] });
  f.part(foF, sc([[-2.6, -0.5], [2.6, -0.5], [3.2, 6], [-3.2, 6]]), 'hide', 0.6, { dim: 1 });
  f.part(foF, sc([[-1.6, 5.5], [1.6, 5.5], [1.8, 8.4], [-1.4, 8.8]]), 'rot', 0.7, { dim: 1 }); // a rotted hand
  const lamp = new Bone(farH[0], farH[1] + 2 * S, 0.1 * p.coat);
  f.part(lamp, sc([[-0.4, 0], [0.4, 0], [0.4, 3.4], [-0.4, 3.4]]), 'darksteel', 0.45, { outline: false }); // its ring
  f.part(lamp, sc([[-3, 3], [3, 3], [2.4, 4.4], [-2.4, 4.4]]), 'darksteel', 0.46); // its cap
  f.part(lamp, sc([[-2.4, 4.4], [2.4, 4.4], [2.6, 10.6], [-2.6, 10.6]]), 'soul', 0.47, { details: dt([[0, 6.4, 'soul', 6], [0.6, 8, 'soul', 6]]) }); // the pale light behind its glass
  f.part(lamp, sc([[-0.4, 4.4], [0.4, 4.4], [0.4, 10.6], [-0.4, 10.6]]), 'darksteel', 0.48, { outline: false }); // a bar across it
  f.part(lamp, sc([[-3, 10.4], [3, 10.4], [3, 11.8], [-3, 11.8]]), 'darksteel', 0.49); // its base
  if (p.lamp > 0) {
    const k = p.lamp;
    f.part(lamp, E(0, 7.5, 4.5 + 4 * k, 5 + 4 * k), 'soul', 0.44, { profile: 'flat', outline: false }); // the light flares
  }

  // legs: hide breeches into heavy boots, mostly under the coat
  p.feet.forEach(([dx, lift, fa], i) => {
    const root = i === 0 ? hip.at(-2.6 * S, -0.5) : hip.at(2.2 * S, 0.5);
    const ankle: Pt = [X0 + dx * S, GROUND - 3 * S - lift * S - (i === 0 ? 1 : 0)];
    const knee = ik(root, ankle, 11 * S, 11 * S, 1);
    const th = limb(root, knee), sh = limb(knee, ankle);
    const z = 1 + i, dim = 1 - i;
    f.part(th, sc([[-3.4, -1.5], [3.4, -1.5], [2.8, 11], [-2.8, 11]]), 'wool', z, { dim });
    f.part(sh, sc([[-2.8, 0], [2.8, 0], [2.6, 10.5], [-2.6, 10.5]]), 'leather', z + 0.1, { dim, folds: [0.4, 3, 1] });
    f.part(new Bone(ankle[0], ankle[1], fa), sc([[-2.8, -1], [2.6, -1], [5, 0.6], [6.4, 2.2], [6.4, 3], [-3, 3]]), 'leather', z + 0.15, { dim: dim + 1 });
  });

  // the greatcoat: a hump of a back, a turned-up collar, a ragged hem to the knees that swings
  f.part(torso, sc([[-8, 0], [-9.6, -8], [-10.4, -14], [-8.6, -19], [-4.6, -21.6], [1.4, -21], [5.6, -18.4], [7.6, -12], [8.2, -4], [8.4, 0]]), 'hide', 3, {
    folds: [0.5, 3, 0], details: dt([[-6, -15, 'hide', 1], [-5, -15, 'hide', 1], [-4, -15, 'hide', 1], [-6, -12, 'hide', 1], [-4, -12, 'hide', 1], [4.6, -9, 'wool', 3], [5.6, -9, 'wool', 3]]),
  }); // back and chest, a patch stitched on the hump
  f.part(torso, sc([[-6.6, -14.2], [-3, -14.2], [-3, -10.4], [-6.6, -10.4]]), 'wool', 3.05, { details: dt([[-6.2, -12.2, 'leather', 1], [-3.4, -12.2, 'leather', 1]]) }); // the patch
  f.part(torso.child(0, -1 * S, p.coat), sc([[-8.4, 0], [8.8, 0], [10.2, 8], [11, 15.4], [7.6, 13.8], [4.6, 16], [1.6, 13.6], [-1.8, 16.4], [-4.8, 13.8], [-8.2, 16], [-10.4, 13.4], [-9.8, 6]]), 'hide', 3.1, {
    profile: 'flat', folds: [0.5, 2.8, 0],
  }); // the skirts, torn at the hem
  f.part(torso, sc([[-8.4, -1.6], [8.6, -1.6], [8.6, 0.6], [-8.4, 0.6]]), 'straw', 3.3, { details: dt([[5.4, 0.8, 'straw', 2], [5.8, 2.4, 'straw', 2], [5.4, 3.8, 'straw', 1]]) }); // a rope belt, its knotted end
  f.part(torso, sc([[-3.6, -21.6], [2.6, -21.2], [3.6, -18.6], [-4.2, -18.6]]), 'hide', 3.6, { trim: ['leather', 0.6] }); // the collar, turned up

  // the head, thrust forward on the hunch
  const head = torso.child(2.4 * S, -19.4 * S, p.head);
  f.part(head, sc([[-1.6, -1], [2, -1], [2.4, 2.4], [-1.2, 2.6]]), 'rot', 4.9, { dim: 1 }); // neck
  f.part(head, sc([[-4, 0.4], [-4.4, -5], [-3, -8.6], [1, -9.2], [4.4, -7.6], [5, -4.6], [4.6, -3], [5.4, -1.2], [4.6, 0.4], [3.6, 2], [0.4, 2.6], [-2.6, 1.8]]), 'rot', 5, {
    details: dt([[2.8, -5.2, 'darksteel', 0], [3.6, -5.2, 'darksteel', 0], [3.2, -5.2, 'soul', 6], [4.8, -3.4, 'darksteel', 1], [2.4, 0, 'bone', 5], [3.2, 0, 'bone', 4], [4, 0, 'bone', 5], [2.8, 0.8, 'darksteel', 0], [3.6, 0.8, 'darksteel', 0], [-0.6, -3, 'rot', 1], [0.4, -1.4, 'rot', 1]]),
  }); // a sunken face: a grave-lit eye, a nose rotted away, a lipless grin
  f.part(head, sc([[-4.4, -4.6], [-5.4, -1.4], [-4.2, 1.6], [-2.8, -3.6]]), 'white', 5.05, { dim: 2, profile: 'flat' }); // thin grey hair at the nape
  f.part(head, sc([[-10, -6.4], [-4, -8.4], [4, -8.4], [10.4, -7.2], [11.6, -5.2], [8.2, -5.6], [4, -6.6], [-4, -6.6], [-9.4, -4.6], [-11.2, -4.4]]), 'coal', 5.2, { folds: [0.3, 2.4, 0] }); // a broad brim, sagging
  f.part(head, sc([[-4.4, -8], [-4, -12.4], [-1.6, -13.8], [2.6, -13.4], [4, -11.6], [4.4, -8]]), 'coal', 5.25, { folds: [0.3, 2, 1] }); // a battered crown
  f.part(head, sc([[-4.4, -9.6], [4.4, -9.6], [4.4, -8], [-4.4, -8]]), 'leather', 5.3); // its band

  // the near arm and the spade
  const sh = torso.at(4.6 * S, -16.4 * S);
  const fist: Pt = [sh[0] + p.fist[0] * S, sh[1] + p.fist[1] * S];
  const up = limb(sh, ik(sh, fist, 8 * S, 7 * S, -1));
  const fo = limb(up.at(0, 8 * S), fist);
  f.part(up, sc([[-3, -1], [3, -1], [2.6, 8.4], [-2.6, 8.4]]), 'hide', 7, { folds: [0.4, 2.5, 1] });
  f.part(fo, sc([[-2.6, -0.5], [2.6, -0.5], [3, 6], [-3, 6]]), 'hide', 7.1);
  const sp = new Bone(fist[0], fist[1], p.spade);
  f.part(sp, sc([[-0.9, 5.2], [0.9, 5.2], [0.9, -20], [-0.9, -20]]), 'wood', p.zs); // the haft
  f.part(sp, sc([[-2.8, 5], [2.8, 5], [2.8, 6.4], [-2.8, 6.4]]), 'wood', p.zs + 0.02); // its grip
  f.part(sp, sc([[-1.4, -19.4], [1.4, -19.4], [1.6, -21.4], [-1.6, -21.4]]), 'darksteel', p.zs + 0.03); // the socket
  f.part(sp, sc([[-4.4, -21], [4.4, -21], [4.8, -28.6], [3.6, -31.2], [0, -32.4], [-3.6, -31.2], [-4.8, -28.6]]), 'darksteel', p.zs + 0.04, {
    details: dt([[-2.4, -24, 'leather', 2], [1.6, -27.6, 'leather', 2], [-0.6, -30, 'leather', 3], [2.8, -23, 'darksteel', 5]]),
  }); // a broad iron blade, rusted and caked with earth
  f.part(new Bone(fist[0], fist[1]), E(0.3, 0.4, 2.5, 2.4), 'rot', p.zs + 0.4); // the hand over the haft

  if (p.smear) {
    const [[f0, a0], [f1, a1]] = p.smear;
    const outer: Pt[] = [], inner: Pt[] = [];
    for (let k = 0; k < 13; k++) {
      const s = k / 12;
      const fx = sh[0] + (f0[0] + (f1[0] - f0[0]) * s) * S, fy = sh[1] + (f0[1] + (f1[1] - f0[1]) * s) * S;
      const a = a0 + (a1 - a0) * s;
      const d = [Math.sin(a), -Math.cos(a)];
      outer.push([fx + 33 * S * d[0], fy + 33 * S * d[1]]);
      inner.push([fx + (30 - 10 * s ** 1.5) * S * d[0], fy + (30 - 10 * s ** 1.5) * S * d[1]]);
    }
    f.part(world, [...outer, ...inner.reverse()], 'smear', p.zs - 0.3, { profile: 'flat', outline: false }); // physical: pale steel
  }
  const tip = sp.at(0, -30 * S);
  if (p.quake) {
    const q = p.quake;
    f.part(world, ell(tip[0], GROUND - 1, q, q * 0.3, 24), 'leather', -2, { profile: 'flat', outline: false }); // the earth breaks
  }
  if (p.clods) {
    // the grave-dirt, flung ahead in an arc
    const k = p.clods;
    for (const [i, r] of [[0, 2.2], [1, 1.6], [2, 2.6], [3, 1.4], [4, 1.9]] as const) {
      const x = tip[0] + (6 + i * 7) * k * S, y = tip[1] - (10 - (i - 2) ** 2 * 1.6) * k * S;
      f.part(world, ell(x, y, r * S, r * 0.8 * S, 10), i % 2 ? 'wool' : 'leather', 8, { dim: 1 });
    }
  }
  return f;
}

function foot(ph: number, St = 5): Foot {
  ph = ((ph % 1) + 1) % 1;
  if (ph < 0.5) {
    const s = ph / 0.5;
    const heel = Math.max(0, (s - 0.7) / 0.3);
    return [St - 2 * St * s, 1.2 * heel, 0.3 * heel];
  }
  const s = (ph - 0.5) / 0.5;
  return [-St + 2 * St * (0.5 - 0.5 * Math.cos(Math.PI * s)), 2.6 * Math.sin(Math.PI * s) + 1.5 * (1 - s) ** 2, 0.3 * (1 - s) - 0.15 * s];
}

// he breathes in his hunch, the lantern swaying a little
const IDLE = [0, 1, 1, 0].map((dy, i) => pose({ hip: [0, dy], coat: [0, 0.03, 0.05, 0.02][i], far: [-11 + [0, 0.4, 0.6, 0.2][i], 9 + dy * 0.5], fist: [7, 9 + dy * 0.5] }));
// a heavy, lurching shuffle, the spade trailing
const WALK = Array.from({ length: 8 }, (_, i) => {
  const ph = i / 8, swing = Math.cos(2 * Math.PI * ph);
  return pose({ hip: [0, [0, 1, 0, -1][i % 4]], lean: 0.26, head: -0.16, feet: [foot(ph + 0.5), foot(ph)], coat: 0.08 + 0.05 * Math.sin(2 * Math.PI * ph), fist: [7 - 1.2 * swing, 9], spade: 2.6, far: [-11 + 1.6 * swing, 9] });
});
// his touch: the spade raised over his shoulder, then brought down in front of him
const ATTACK: [number, Pose][] = [
  [250, pose()],
  [110, pose({ hip: [-1, 0], lean: 0.05, fist: [4, -4], spade: 0.2, zs: 4.6 })],
  [140, pose({ hip: [-1, -1], lean: -0.1, head: -0.25, fist: [2, -9], spade: -0.5, zs: 4.6, coat: -0.05 })],
  [60, pose({ hip: [1, 0], lean: 0.24, fist: [10, -3], spade: 1.1, smear: [[[2, -9], -0.5], [[10, -3], 1.1]], feet: [[-5, 0, 0], [8, 1.2, -0.1]], coat: 0.1 })],
  [180, pose({ hip: [2, 1], lean: 0.36, fist: [11, 6], spade: 2.2, smear: [[[10, -3], 1.1], [[11, 6], 2.2]], feet: [[-6, 1, 0.3], [9, 0, 0]], coat: 0.16 })],
  [130, pose({ hip: [1, 0], lean: 0.26, fist: [8, 8], spade: 2.6, feet: [[-6, 0, 0], [8, 0, 0]], coat: 0.08 })],
];
// the dig: the spade driven in (held over the telegraph) | heaved up, the grave-dirt flung ahead
const DIG: [number, Pose][] = [
  [220, pose({ hip: [0, 1], lean: 0.3, fist: [8, 4], spade: 3.0, coat: 0.06 })],
  [260, pose({ hip: [1, 2], lean: 0.42, head: -0.05, fist: [10, 10], spade: 3.1, feet: [[-6, 0, 0], [7, 0, 0]], coat: 0.12, quake: 8 })],
  [320, pose({ hip: [1, 3], lean: 0.48, head: 0, fist: [10, 13], spade: 3.12, feet: [[-7, 0, 0.1], [7, 0, 0]], coat: 0.14, quake: 12 })],
  [200, pose({ hip: [-1, -1], lean: -0.06, head: -0.3, fist: [9, -2], spade: 1.3, smear: [[[10, 13], 3.12], [[9, -2], 1.3]], feet: [[-6, 0, 0], [6, 0, 0]], coat: -0.08, clods: 0.7, quake: 10 })],
  [300, pose({ hip: [-1, -1], lean: -0.1, head: -0.32, fist: [8, -5], spade: 0.9, feet: [[-6, 0, 0], [6, 0, 0]], coat: -0.1, clods: 1.2 })],
  [260, pose({ hip: [0, 0], lean: 0.16, fist: [7, 7], spade: 2.6, coat: 0.02 })],
];
const HURT: [number, Pose][] = [
  [100, pose({ hip: [-2, 1], lean: 0.02, head: -0.35, coat: -0.08, fist: [5, 8], spade: 2.9, far: [-12, 7], feet: [[-6, 0, 0], [4, 0, 0]] })],
  [150, pose({ hip: [-1, 1], lean: 0.1, head: -0.24, coat: -0.04, fist: [6, 9], far: [-11.5, 8], feet: [[-6, 0, 0], [4, 0, 0]] })],
];
// he sinks onto his spade, drops to his knees, and pitches forward into the dirt
const DEATH: [number, Pose][] = [
  [160, pose({ hip: [-1, 2], lean: 0.1, head: -0.3, fist: [7, 7], spade: 3.0, feet: [[-6, 0, 0], [5, 0, 0]] })],
  [180, pose({ hip: [0, 8], lean: 0.32, head: 0.1, fist: [9, 9], spade: 3.05, far: [1, 12], feet: [[-7, 0, 0.6], [6, 0, 0]], coat: 0.2 })],
  [200, pose({ hip: [1, 11], lean: 0.6, head: 0.25, fist: [11, 10], spade: 2.4, far: [4, 11], feet: [[-8, 0, 0.9], [6, 0, 0]], coat: 0.4 })],
  [200, pose({ hip: [4, 15], lean: 1.1, head: 0.3, fist: [12, 9], spade: 1.9, far: [6, 8], feet: [[-6, 0, 1], [8, 0, 0.3]], coat: 0.4 })],
  [400, pose({ hip: [7, 17], lean: 1.45, head: 0.2, fist: [13, 6], spade: 1.6, far: [7, 5], feet: [[-3, 0, 1.2], [10, 0, 0.5]], coat: 0.5 })],
];
// a new phase: he straightens, lifts the lantern high and its light flares over the ground, then hunches again
const PHASE: [number, Pose][] = [
  [150, pose({ hip: [0, 2], lean: 0.32, head: 0.05, fist: [7, 7], far: [0, 10] })],
  [200, pose({ hip: [0, -1], lean: 0, head: -0.4, fist: [6, 6], spade: 2.95, far: [3, -10], lamp: 0.6, quake: 10 })],
  [450, pose({ hip: [0, -1.5], lean: -0.05, head: -0.45, fist: [6, 6], spade: 2.95, far: [3, -12], lamp: 1, quake: 16 })],
  [250, pose({ hip: [0, 0], lean: 0.14, fist: [7, 8], far: [0, 8], lamp: 0.3 })],
];

export const sprite: SpriteDef = {
  id: 'gravedigger', w: W, h: H, anchor: [X0, GROUND], tall: 70,
  anims: {
    idle: IDLE.map((p) => [220, digger(p)]),
    walk: WALK.map((p) => [125, digger(p)]),
    attack: ATTACK.map(([ms, p]) => [ms, digger(p)]),
    hurt: HURT.map(([ms, p]) => [ms, digger(p)]),
    death: DEATH.map(([ms, p]) => [ms, digger(p)]),
    special: DIG.map(([ms, p]) => [ms, digger(p)]),
    phase: PHASE.map(([ms, p]) => [ms, digger(p)]),
  },
  impact: 4,
  specialImpact: 3,
};
