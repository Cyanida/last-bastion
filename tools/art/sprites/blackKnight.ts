/**
 * #158: The Black Knight. Built on the Paladin's rig at 1.15× his size (63 art px tall; the game draws bosses at 4/3, so about
 * 1.5× the Paladin on screen): blackened plate, horned great helm with a red eye slit, a red horsehair crest, a torn red cape,
 * a heater shield and a greatsword. His special is the charge: he braces and crouches over the telegraph, then bursts forward
 * down the line, sword levelled, with a pale steel streak behind him (physical).
 */
import { Bone, ell, Figure, ik, limb, type Material, type Pt } from '../rig';
import type { SpriteDef } from '../sheet';

const S = 1.15; // his size against the Paladin
const W = 120, H = 92;
const GROUND = 86; // first empty row under the near foot
const X0 = 48; // anchor x between the feet
const HIP_Y = GROUND - 3 * S - 25.5;
const sc = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [x * S, y * S] as const);
const E = (cx: number, cy: number, rx: number, ry: number): Pt[] => ell(cx * S, cy * S, rx * S, ry * S);
type Px = [number, number, Material, number];
const dt = (d: Px[]): Px[] => d.map(([x, y, m, t]) => [x * S, y * S, m, t]);

type Foot = [x: number, lift: number, angle: number];
interface Pose {
  hip: Pt; lean: number; head: number; cape: number; crest: number;
  feet: [far: Foot, near: Foot];
  fist: Pt; sword: number; zs: number; shield: Pt; shieldA: number;
  smear: [[Pt, number], [Pt, number]] | null; // a swing trail: (fist offset, sword angle) from, to
  streak: number; // charge: length of the speed streak behind him (0: none)
}
const pose = (kw: Partial<Pose> = {}): Pose => ({
  hip: [0, 0], lean: 0, head: 0, cape: 0.14, crest: 0, feet: [[-5, 0, 0], [5, 0, 0]],
  fist: [7, 11.5], sword: 0.35, zs: 7.2, shield: [0, 0], shieldA: 0, smear: null, streak: 0, ...kw,
});

function knight(p: Pose): Figure {
  const f = new Figure(W, H);
  const hip = new Bone(X0 + p.hip[0] * S, HIP_Y + p.hip[1] * S);
  const torso = hip.child(0, 0, p.lean);

  if (p.streak) {
    const world = new Bone(0, 0);
    const y0 = hip.y - 30, x1 = hip.x - 10;
    for (const [dy, len, th] of [[4, 1, 2], [14, 0.8, 1.5], [24, 1, 2.2], [34, 0.65, 1.5]]) {
      const x0 = x1 - p.streak * len;
      f.part(world, [[x0, y0 + dy], [x1, y0 + dy - th / 2], [x1, y0 + dy + th], [x0, y0 + dy + 0.6]], 'smear', -1, { profile: 'flat', outline: false });
    }
  }

  const cape = torso.child(-2.8 * S, -16.5 * S, p.cape - p.lean);
  f.part(cape, sc([[-1, 0], [4, 0], [4.5, 12], [5, 26], [2, 24], [0, 28], [-3, 25.5], [-6, 28.5], [-9, 25], [-12.5, 27], [-13, 17], [-8, 6]]), 'red', 0, { folds: [0.9, 3.2, 0], dim: 1 });

  p.feet.forEach(([dx, lift, fa], i) => {
    const root = i === 0 ? hip.at(-2.8 * S, -0.5) : hip.at(2.2 * S, 0.5);
    const ankle: Pt = [X0 + dx * S, GROUND - 3 * S - lift * S - (i === 0 ? 1 : 0)];
    const knee = ik(root, ankle, 11.5 * S, 11.5 * S, 1);
    const th = limb(root, knee), sh = limb(knee, ankle);
    const z = 1 + i, dim = 1 - i;
    f.part(th, sc([[-3.8, -1.5], [3.8, -1.5], [3.1, 11.5], [-3.1, 11.5]]), 'darksteel', z, { dim }); // cuisse
    f.part(sh, sc([[-2.8, 0], [2.8, 0], [2.5, 11], [-2.5, 11]]), 'darksteel', z + 0.1, { dim }); // greave
    f.part(new Bone(ankle[0], ankle[1], fa), sc([[-2.8, -1], [2.6, -1], [5, 0.6], [6.6, 2.2], [6.6, 3], [-3, 3]]), 'darksteel', z + 0.15, { dim, details: [[5.6, 1.4, 'steel', 4]] }); // sabaton
    f.part(th, E(0.5, 11.3, 3.3, 2.8), 'darksteel', z + 0.2, { dim, details: [[1.4 * S, 11.3 * S, 'red', 3]] }); // spiked poleyn
  });

  f.part(torso, sc([[-7.4, -3], [7.6, -3], [8.4, 7.5], [-7.8, 7.5]]), 'darksteel', 3.0, { mail: true }); // mail skirt
  f.part(torso, sc([[-8.6, -18], [8.2, -18], [9.4, -11], [8.2, -3], [-7.6, -3], [-9, -11]]), 'darksteel', 3.1, {
    details: dt([[1, -14, 'darksteel', 5], [1, -13, 'darksteel', 5], [1, -12, 'darksteel', 4], [-3.5, -8, 'darksteel', 1], [5.5, -8, 'darksteel', 1]]),
  }); // breastplate with a ridge
  f.part(torso, sc([[-3, -15], [4.6, -15], [3.6, -10.6], [0.8, -8.4], [-2, -10.6]]), 'red', 3.2, { profile: 'flat' }); // red chevron
  f.part(torso, sc([[-7.8, -4.6], [8.2, -4.6], [8.2, -2.1], [-7.8, -2.1]]), 'leather', 3.5); // belt
  f.part(torso, sc([[1, -5], [3.8, -5], [3.8, -1.7], [1, -1.7]]), 'steel', 3.6); // buckle
  f.part(torso, sc([[-4.2, -21], [4.8, -21], [5.4, -17], [-4.8, -17]]), 'darksteel', 3.7); // gorget
  f.part(torso, E(-6.8, -16, 4.2, 3.6), 'darksteel', 3.8, { trim: ['red', 1], dim: 1 }); // far pauldron

  const head = torso.child(0.8 * S, -20 * S, p.head);
  const slit: Px[] = [...[-3, -2, -1, 0, 1, 2, 3, 4].map((x) => [x + 0.5, -4.5, 'red', x > 1 ? 6 : 5] as Px)];
  f.part(head.child(-2.6 * S, -7.4 * S, -0.5), sc([[-1.4, 0], [1.4, 0], [0.6, -5], [-2.8, -8.4], [-1.2, -4]]), 'white', 4.8, { dim: 1 }); // far horn
  f.part(head, sc([[-5, 0.8], [-5.4, -5.4], [-4.6, -9.4], [-1.8, -11], [2.4, -11], [5, -9.4], [5.9, -5.4], [5.7, 0.8], [2.8, 1.8], [-2.8, 1.6]]), 'darksteel', 5, {
    details: dt([...slit, [4.6, -1.5, 'darksteel', 0], [4.6, 0, 'darksteel', 0], [3.6, -0.8, 'darksteel', 0]]),
  }); // great helm
  f.part(head, sc([[1.9, -6.2], [3.1, -6.2], [3.1, 1.2], [1.9, 1.2]]), 'darksteel', 5.1); // nose ridge
  f.part(head.child(3.2 * S, -7.8 * S, 0.45), sc([[-1.4, 0], [1.4, 0], [1.8, -4.6], [4, -8.8], [0.4, -5]]), 'white', 5.2); // near horn
  f.part(head.child(-0.2 * S, -10.8 * S, p.crest), sc([[1.5, 0.4], [1, -2.2], [-1.8, -3.4], [-5.4, -3], [-8.6, -1.2], [-10.6, 1.8], [-10, 5], [-8.2, 2.4], [-5.2, 0.8], [-2.6, 1.2]]), 'red', 4.9, { folds: [0.6, 2.2, 1] }); // crest

  const shield = torso.child((-8.6 + p.shield[0]) * S, (-7 + p.shield[1]) * S, p.shieldA);
  f.part(shield, sc([[-6.4, -8], [6.4, -8], [6.6, -1], [4.6, 4], [0, 9], [-4.6, 4], [-6.6, -1]]), 'darksteel', 6);
  f.part(shield, sc([[-5.2, -6.8], [5.2, -6.8], [5.3, -1.2], [3.6, 3.2], [0, 7.4], [-3.6, 3.2], [-5.3, -1.2]]), 'red', 6.1, { trim: ['darksteel', 1] });
  f.part(shield, sc([[-5, -2.4], [0, 1.6], [5, -2.4], [5, 0], [0, 4.2], [-5, 0]]), 'darksteel', 6.2, { profile: 'flat' }); // black chevron

  const sh = torso.at(5.6 * S, -15.6 * S);
  const fist: Pt = [sh[0] + p.fist[0] * S, sh[1] + p.fist[1] * S];
  const up = limb(sh, ik(sh, fist, 8 * S, 7 * S, -1));
  const fo = limb(up.at(0, 8 * S), fist);
  const za = 7, zs = p.zs;
  f.part(up, sc([[-2.7, -1], [2.7, -1], [2.4, 8], [-2.4, 8]]), 'darksteel', za, { mail: true });
  f.part(fo, sc([[-2.5, -0.5], [2.5, -0.5], [2.8, 6.2], [-2.8, 6.2]]), 'darksteel', za + 0.1);
  f.part(up, E(0, 8, 2.8, 2.4), 'darksteel', za + 0.2);
  const sw = new Bone(fist[0], fist[1], p.sword);
  f.part(sw, sc([[-1, -2], [1, -2], [1, 4.5], [-1, 4.5]]), 'leather', zs); // long grip
  f.part(sw, E(0, 5.4, 1.6, 1.5), 'darksteel', zs + 0.1); // pommel
  f.part(sw, sc([[-5, -3.2], [5, -3.2], [5.4, -1.8], [-5.4, -1.8]]), 'darksteel', zs + 0.1); // crossguard
  f.part(sw, sc([[-2.2, -3], [2.2, -3], [2, -24], [0, -28.5], [-2, -24]]), 'steel', zs + 0.05, { details: Array.from({ length: 18 }, (_, k) => [0.1, -(k + 4) * S - 0.5, 'steel', 2] as Px) }); // greatsword
  f.part(sw, E(0.3, 0.6, 3, 2.9), 'darksteel', za + 0.4, { details: [-0.6, 0.6, 1.8].map((y) => [1.8 * S, y * S, 'darksteel', 1] as Px) }); // gauntlet
  f.part(new Bone(sh[0], sh[1], torso.a * 0.65 + up.a * 0.35), E(0.5, 0.2, 5, 4.2), 'darksteel', za + 0.5, { trim: ['red', 1], details: [[0.5 * S, -3 * S, 'white', 4]] }); // pauldron, a spike

  if (p.smear) {
    const [[f0, a0], [f1, a1]] = p.smear;
    const outer: Pt[] = [], inner: Pt[] = [];
    for (let k = 0; k < 13; k++) {
      const s = k / 12;
      const fx = sh[0] + (f0[0] + (f1[0] - f0[0]) * s) * S, fy = sh[1] + (f0[1] + (f1[1] - f0[1]) * s) * S;
      const a = a0 + (a1 - a0) * s;
      const d = [Math.sin(a), -Math.cos(a)];
      outer.push([fx + 28 * S * d[0], fy + 28 * S * d[1]]);
      inner.push([fx + (25 - 11 * s ** 1.5) * S * d[0], fy + (25 - 11 * s ** 1.5) * S * d[1]]);
    }
    f.part(new Bone(0, 0), [...outer, ...inner.reverse()], 'smear', zs - 0.3, { profile: 'flat', outline: false }); // physical: pale steel
  }
  return f;
}

function foot(ph: number, St = 6): Foot {
  ph = ((ph % 1) + 1) % 1;
  if (ph < 0.5) {
    const s = ph / 0.5;
    const heel = Math.max(0, (s - 0.7) / 0.3);
    return [St - 2 * St * s, 1.5 * heel, 0.3 * heel];
  }
  const s = (ph - 0.5) / 0.5;
  return [-St + 2 * St * (0.5 - 0.5 * Math.cos(Math.PI * s)), 3.5 * Math.sin(Math.PI * s) + 2 * (1 - s) ** 2, 0.35 * (1 - s) - 0.15 * s];
}

const IDLE = ([[0, 0, 0], [1, 0.03, 0.06], [1, 0.05, 0.1], [0, 0.02, 0.04]] as const).map(([dy, c, cr]) => pose({ hip: [0, dy], cape: 0.14 + c, crest: cr }));
const WALK = Array.from({ length: 8 }, (_, i) => {
  const ph = i / 8, swing = Math.cos(2 * Math.PI * ph);
  return pose({
    hip: [0, [0, 1, 0, -1][i % 4]], lean: 0.08, feet: [foot(ph + 0.5), foot(ph)],
    cape: 0.3 + 0.06 * Math.sin(2 * Math.PI * ph), crest: 0.12 + 0.06 * Math.sin(2 * Math.PI * ph + 1),
    fist: [7 - 1.5 * swing, 11.5 - 0.6 * Math.abs(swing)], shield: [1.2 * swing, 0],
  });
});
// his touch: a heavy overhead chop
const ATTACK: [number, Pose][] = [
  [250, pose()],
  [100, pose({ hip: [-1, 0], lean: -0.1, fist: [5, -8], sword: -0.3, zs: 4.6, shield: [1, -1] })],
  [120, pose({ hip: [-1, -1], lean: -0.16, fist: [3, -12.5], sword: -0.9, zs: 4.6, shield: [1.5, -1], crest: 0.15, cape: 0.2 })],
  [60, pose({ hip: [1, 0], lean: 0.06, fist: [11, -5], sword: 0.9, smear: [[[3, -12.5], -0.9], [[11, -5], 0.9]], feet: [[-5, 0, 0], [8, 1.5, -0.1]], cape: 0.24 })],
  [180, pose({ hip: [2, 1], lean: 0.2, fist: [12, 5], sword: 2.1, smear: [[[11, -5], 0.9], [[12, 5], 2.1]], feet: [[-6, 1, 0.3], [10, 0, 0]], shield: [-1.5, 0], cape: 0.32, crest: 0.2 })],
  [130, pose({ hip: [1, 0], lean: 0.08, fist: [9, 10], sword: 1.4, feet: [[-6, 0, 0], [9, 0, 0]], cape: 0.2 })],
];
// the charge: brace, crouch, coil (held to the end of the telegraph) | burst down the line, sword levelled (impact), skid to a stop
const SPECIAL: [number, Pose][] = [
  [200, pose({ hip: [-1, 1], lean: -0.08, fist: [2, 12], sword: -1.9, zs: 2.5, shield: [3, -1], feet: [[-7, 0, 0], [6, 0, 0]], crest: 0.1 })],
  [250, pose({ hip: [-2, 3], lean: 0.12, head: -0.1, fist: [-2, 11], sword: -2.2, zs: 2.5, shield: [4, -1], feet: [[-9, 0, 0.2], [7, 0, 0]], cape: 0.3 })],
  [300, pose({ hip: [-2, 4], lean: 0.26, head: -0.2, fist: [-4, 9], sword: -2.4, zs: 2.5, shield: [5, 0], feet: [[-10, 1, 0.4], [8, 0, 0]], cape: 0.45, crest: 0.25 })],
  [450, pose({ hip: [4, 2], lean: 0.42, head: -0.3, fist: [12, 1], sword: 1.57, shield: [4, 1], feet: [[-9, 2, 0.5], [11, 1, -0.1]], cape: 0.95, crest: 0.6, streak: 34 })],
  [300, pose({ hip: [3, 1], lean: 0.3, head: -0.2, fist: [12, 3], sword: 1.6, shield: [3, 1], feet: [[-8, 0, 0.3], [11, 0, 0]], cape: 0.7, crest: 0.45, streak: 16 })],
  [250, pose({ hip: [1, 1], lean: 0.1, fist: [9, 9], sword: 1.1, feet: [[-6, 0, 0], [8, 0, 0]], cape: 0.3, crest: 0.2 })],
];
const HURT: [number, Pose][] = [
  [100, pose({ hip: [-2, 1], lean: -0.2, head: -0.2, cape: 0.04, crest: -0.15, fist: [4, 9], sword: 0.1, shield: [2, -1], feet: [[-6, 0, 0], [4, 0, 0]] })],
  [150, pose({ hip: [-1, 1], lean: -0.1, head: -0.1, cape: 0.08, crest: -0.05, fist: [5, 10], sword: 0.2, shield: [1, 0], feet: [[-6, 0, 0], [4, 0, 0]] })],
];
// he drops to a knee on his sword, then pitches forward
const DEATH: [number, Pose][] = [
  [150, pose({ hip: [-1, 2], lean: -0.15, head: -0.15, fist: [6, 11], sword: 0.5, feet: [[-6, 0, 0], [5, 0, 0]] })],
  [200, pose({ hip: [0, 8], lean: 0.1, head: 0.2, fist: [10, 12], sword: 0.1, shield: [1, 2], cape: 0.2, feet: [[-7, 0, 0.6], [6, 0, 0]] })],
  [300, pose({ hip: [0, 10], lean: 0.3, head: 0.35, fist: [10, 11], sword: 0.05, shield: [1, 3], cape: 0.25, crest: 0.2, feet: [[-8, 0, 0.9], [6, 0, 0]] })],
  [160, pose({ hip: [3, 14], lean: 0.9, head: 0.3, fist: [12, 12], sword: 1.2, shield: [1, 4], shieldA: 0.5, cape: 0.8, crest: 0.4, feet: [[-7, 0, 1], [8, 0, 0.3]] })],
  [400, pose({ hip: [6, 17], lean: 1.4, head: 0.2, fist: [14, 8], sword: 2.2, shield: [0, 4], shieldA: 1.1, cape: 1.4, crest: 0.6, feet: [[-4, 0, 1.2], [10, 0, 0.5]] })],
];

export const sprite: SpriteDef = {
  id: 'blackKnight', w: W, h: H, anchor: [X0, GROUND], tall: 63,
  anims: {
    idle: IDLE.map((p) => [200, knight(p)]),
    walk: WALK.map((p) => [110, knight(p)]),
    attack: ATTACK.map(([ms, p]) => [ms, knight(p)]),
    hurt: HURT.map(([ms, p]) => [ms, knight(p)]),
    death: DEATH.map(([ms, p]) => [ms, knight(p)]),
    special: SPECIAL.map(([ms, p]) => [ms, knight(p)]),
  },
  impact: 4,
  specialImpact: 3,
};
