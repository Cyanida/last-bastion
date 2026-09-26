/** #155: the Paladin, the approved prototype: great helm with a blue plume, tabard with the cross, kite shield with the sun, longsword. */
import { Bone, ell, Figure, ik, limb, type Pt } from '../rig';
import type { SpriteDef } from '../sheet';

const W = 92, H = 80;
const GROUND = 75; // first empty row under the near foot
const X0 = 40; // anchor x between the feet
const HIP_Y = GROUND - 3 - 22.2; // legs are 23 long: a slight knee bend at rest

type Foot = [x: number, lift: number, angle: number];
interface Pose {
  hip: Pt; lean: number; head: number; cape: number; plume: number; skirt: number;
  feet: [far: Foot, near: Foot];
  fist: Pt; sword: number; za: number; zs: number; shield: Pt; shieldA: number;
  smear: [[Pt, number], [Pt, number]] | null; // swing trail: (fist offset, sword angle) from, to
}
const pose = (kw: Partial<Pose> = {}): Pose => ({
  hip: [0, 0], lean: 0, head: 0, cape: 0.12, plume: 0, skirt: 0, feet: [[-4, 0, 0], [4, 0, 0]],
  fist: [7, 11.5], sword: 0.3, za: 7, zs: 7.2, shield: [0, 0], shieldA: 0, smear: null, ...kw,
});

function paladin(p: Pose): Figure {
  const f = new Figure(W, H);
  const hip = new Bone(X0 + p.hip[0], HIP_Y + p.hip[1]);
  const torso = hip.child(0, 0, p.lean);

  const cape = torso.child(-2.5, -16.5, p.cape - p.lean);
  f.part(cape, [[-1, 0], [4, 0], [4.5, 12], [5, 26], [0, 27.5], [-6, 28], [-12, 26.5], [-12.5, 17], [-8, 6]], 'red', 0, { folds: [0.9, 3.2, 0] });

  p.feet.forEach(([dx, lift, fa], i) => {
    const root = i === 0 ? hip.at(-2.5, -0.5) : hip.at(2, 0.5);
    const ankle: Pt = [X0 + dx, GROUND - 3 - lift - (i === 0 ? 1 : 0)]; // the far foot stands a row higher
    const knee = ik(root, ankle, 11.5, 11.5, 1);
    const th = limb(root, knee), sh = limb(knee, ankle);
    const z = 1 + i, dim = 1 - i; // the far leg is a tone darker
    f.part(th, [[-3.4, -1.5], [3.4, -1.5], [2.8, 11.5], [-2.8, 11.5]], 'steel', z, { dim }); // cuisse
    f.part(sh, [[-2.5, 0], [2.5, 0], [2.2, 11], [-2.2, 11]], 'steel', z + 0.1, { dim }); // greave
    f.part(new Bone(ankle[0], ankle[1], fa), [[-2.6, -1], [2.4, -1], [4.6, 0.6], [6, 2.2], [6, 3], [-2.8, 3]], 'darksteel', z + 0.15, { dim }); // sabaton
    f.part(th, ell(0.5, 11.3, 3.0, 2.6), 'steel', z + 0.2, { dim }); // poleyn
  });

  f.part(torso, [[-6.6, -3], [6.8, -3], [7.6, 7], [-7, 7]], 'steel', 3.0, { mail: true }); // mail skirt
  f.part(torso, [[-7.6, -17.5], [7.2, -17.5], [8.2, -11], [7.2, -3], [-6.8, -3], [-8, -11]], 'steel', 3.1); // breastplate
  f.part(torso, [[-4.8, -16], [5.6, -16], [6, -3], [-5.2, -3]], 'white', 3.2, { profile: 'flat', folds: [0.5, 3, 0] }); // tabard
  f.part(torso, [[0.4, -14.6], [2.6, -14.6], [2.6, -11.6], [5.4, -11.6], [5.4, -9.4], [2.6, -9.4], [2.6, -4.4], [0.4, -4.4], [0.4, -9.4], [-2.6, -9.4], [-2.6, -11.6], [0.4, -11.6]], 'red', 3.3, { profile: 'flat' }); // cross
  const skirt = torso.child(0.3, -3, p.skirt);
  f.part(skirt, [[-4.6, 0], [5.4, 0], [6, 10], [1.2, 10.5], [0.6, 6.5], [-0.2, 10.5], [-5, 10]], 'white', 3.4, { profile: 'flat', folds: [0.35, 3.4, 0] }); // tabard skirt
  f.part(skirt, [[-5, 8.7], [-0.1, 9.1], [-0.2, 10.5], [-5, 10]], 'red', 3.45, { profile: 'flat' }); // hem
  f.part(skirt, [[1.1, 9.1], [5.9, 8.7], [6, 10], [1.2, 10.5]], 'red', 3.45, { profile: 'flat' });
  f.part(torso, [[-7.2, -4.4], [7.5, -4.4], [7.5, -2.1], [-7.2, -2.1]], 'leather', 3.5); // belt
  f.part(torso, [[1, -4.8], [3.6, -4.8], [3.6, -1.7], [1, -1.7]], 'gold', 3.6); // buckle
  f.part(torso, [[-3.8, -20], [4.3, -20], [4.9, -16.5], [-4.3, -16.5]], 'steel', 3.7); // gorget
  f.part(torso, ell(-6.2, -15.4, 3.6, 3.1), 'steel', 3.8, { trim: ['gold', 1], dim: 1 }); // far pauldron

  const head = torso.child(0.8, -19, p.head);
  const eye: [number, number, 'steel' | 'glow', number][] = [...[-4, -3, -2, -1, 0, 3, 4].map((x) => [x + 0.5, -4, 'steel', 0] as [number, number, 'steel', number]), [4.6, -4, 'glow', 5]];
  const holes: [number, number, 'steel', number][] = [[4.6, -1.5, 'steel', 1], [4.6, 0, 'steel', 1], [3.7, -0.8, 'steel', 1]];
  f.part(head, [[-4.7, 0.5], [-5.1, -5], [-4.4, -8.9], [-1.7, -10.4], [2.2, -10.4], [4.8, -9], [5.6, -5], [5.4, 0.5], [2.6, 1.5], [-2.6, 1.3]], 'steel', 5, { details: [...eye, ...holes] }); // great helm
  f.part(head, [[-4.8, -6.9], [5.5, -6.9], [5.5, -5.6], [-4.9, -5.6]], 'gold', 5.1); // brow band
  f.part(head, [[1.8, -5.8], [3.0, -5.8], [3.0, 1.2], [1.8, 1.2]], 'gold', 5.1); // nose strip
  f.part(head.child(-0.4, -10.2, p.plume), [[1.3, 0.4], [0.9, -2.1], [-1.7, -3.4], [-5.1, -3.2], [-8.1, -1.7], [-9.8, 0.9], [-9.4, 3.4], [-7.7, 1.7], [-5.1, 0.4], [-2.6, 0.9]], 'blue', 4.9, { folds: [0.6, 2.2, 1] }); // plume

  const shield = torso.child(-7.8 + p.shield[0], -7 + p.shield[1], p.shieldA);
  f.part(shield, [[-5.8, -7.4], [5.8, -7.4], [6.1, -1], [4.3, 3.6], [0, 8], [-4.3, 3.6], [-6.1, -1]], 'steel', 6);
  const rays = Array.from({ length: 8 }, (_, k) => [3.9 * Math.cos((k * Math.PI) / 4), -0.5 + 3.9 * Math.sin((k * Math.PI) / 4), 'gold', 4] as [number, number, 'gold', number]);
  f.part(shield, [[-4.6, -6.2], [4.6, -6.2], [4.8, -1.2], [3.3, 2.8], [0, 6.4], [-3.3, 2.8], [-4.8, -1.2]], 'blue', 6.1, { details: rays, trim: ['gold', 1] });
  f.part(shield, ell(0, -0.5, 2.3, 2.3), 'gold', 6.2); // sun

  const sh = torso.at(5.2, -15.2);
  const fist: Pt = [sh[0] + p.fist[0], sh[1] + p.fist[1]];
  const up = limb(sh, ik(sh, fist, 8, 7, -1));
  const fo = limb(up.at(0, 8), fist);
  const { za, zs } = p;
  f.part(up, [[-2.4, -1], [2.4, -1], [2.1, 8], [-2.1, 8]], 'steel', za, { mail: true }); // mail sleeve
  f.part(fo, [[-2.2, -0.5], [2.2, -0.5], [2.5, 6.2], [-2.5, 6.2]], 'steel', za + 0.1); // vambrace
  f.part(up, ell(0, 8, 2.5, 2.2), 'steel', za + 0.2); // couter
  const sw = new Bone(fist[0], fist[1], p.sword);
  f.part(sw, [[-0.9, -2], [0.9, -2], [0.9, 3.5], [-0.9, 3.5]], 'leather', zs); // grip
  f.part(sw, ell(0, 4.4, 1.5, 1.4), 'gold', zs + 0.1); // pommel
  f.part(sw, [[-4.2, -3], [4.2, -3], [4.5, -1.8], [-4.5, -1.8]], 'gold', zs + 0.1); // crossguard
  f.part(sw, [[-1.9, -2.8], [1.9, -2.8], [1.8, -19], [0, -23], [-1.8, -19]], 'steel', zs + 0.05, { details: Array.from({ length: 14 }, (_, k) => [0.1, -(k + 4) - 0.5, 'glow', 4]) }); // blade + fuller
  f.part(sw, ell(0.3, 0.6, 2.7, 2.6), 'darksteel', za + 0.4, { details: [-0.6, 0.6, 1.8].map((y) => [1.6, y, 'darksteel', 1]) }); // gauntlet
  f.part(new Bone(sh[0], sh[1], torso.a * 0.65 + up.a * 0.35), ell(0.5, 0.2, 4.4, 3.7), 'steel', za + 0.5, { trim: ['gold', 1] }); // pauldron

  if (p.smear) {
    const [[f0, a0], [f1, a1]] = p.smear;
    const outer: Pt[] = [], inner: Pt[] = [], edge: Pt[] = [];
    for (let k = 0; k < 13; k++) {
      const s = k / 12;
      const fx = sh[0] + f0[0] + (f1[0] - f0[0]) * s, fy = sh[1] + f0[1] + (f1[1] - f0[1]) * s;
      const a = a0 + (a1 - a0) * s;
      const d = [Math.sin(a), -Math.cos(a)];
      const rIn = 21 - 10 * s ** 1.5;
      outer.push([fx + 23.5 * d[0], fy + 23.5 * d[1]]);
      inner.push([fx + rIn * d[0], fy + rIn * d[1]]);
      edge.push([fx + (23.5 - 2.5 * s) * d[0], fy + (23.5 - 2.5 * s) * d[1]]);
    }
    const world = new Bone(0, 0);
    f.part(world, [...outer, ...inner.reverse()], 'glow', zs - 0.3, { profile: 'flat', outline: false }); // the golden trail
    f.part(world, [...outer, ...edge.reverse()], 'smear', zs - 0.25, { profile: 'flat', outline: false });
  }
  return f;
}

/** Walk-cycle foot: stance slides back from +S to -S, swing arcs forward. */
function foot(ph: number, S = 6.5): Foot {
  ph = ((ph % 1) + 1) % 1;
  if (ph < 0.5) {
    const s = ph / 0.5;
    const heel = Math.max(0, (s - 0.7) / 0.3);
    return [S - 2 * S * s, 1.5 * heel, 0.3 * heel];
  }
  const s = (ph - 0.5) / 0.5;
  return [-S + 2 * S * (0.5 - 0.5 * Math.cos(Math.PI * s)), 4 * Math.sin(Math.PI * s) + 2 * (1 - s) ** 2, 0.35 * (1 - s) - 0.15 * s];
}

const IDLE = ([[0, 0, 0], [1, 0.03, 0.06], [1, 0.05, 0.1], [0, 0.02, 0.04]] as const).map(([dy, c, pl]) => pose({ hip: [0, dy], cape: 0.12 + c, plume: pl }));
const WALK = Array.from({ length: 8 }, (_, i) => {
  const ph = i / 8, swing = Math.cos(2 * Math.PI * ph);
  return pose({
    hip: [0, [0, 1, 0, -1][i % 4]], lean: 0.06, feet: [foot(ph + 0.5), foot(ph)],
    cape: 0.3 + 0.06 * Math.sin(2 * Math.PI * ph), plume: 0.12 + 0.06 * Math.sin(2 * Math.PI * ph + 1),
    fist: [7 - 1.5 * swing, 11.5 - 0.6 * Math.abs(swing)], shield: [1.2 * swing, 0], skirt: 0.08 * swing,
  });
});
// ready, wind-up, peak, swing with its golden trail, impact (held longest), recovery
const ATTACK: [number, Pose][] = [
  [250, pose()],
  [90, pose({ hip: [-1, 0], lean: -0.1, fist: [5, -8], sword: -0.3, zs: 4.6, shield: [1, -1], plume: 0.08 })],
  [110, pose({ hip: [-1, -1], lean: -0.14, fist: [3, -12.5], sword: -0.9, zs: 4.6, shield: [1.5, -1], plume: 0.15, cape: 0.18 })],
  [60, pose({ hip: [1, 0], lean: 0.06, fist: [11, -5], sword: 0.9, smear: [[[3, -12.5], -0.9], [[11, -5], 0.9]], feet: [[-4, 0, 0], [7, 1.5, -0.1]], cape: 0.22 })],
  [170, pose({ hip: [2, 1], lean: 0.18, fist: [12, 5], sword: 2.1, smear: [[[11, -5], 0.9], [[12, 5], 2.1]], feet: [[-5, 1, 0.3], [9, 0, 0]], shield: [-1.5, 0], cape: 0.3, plume: 0.2 })],
  [120, pose({ hip: [1, 0], lean: 0.08, fist: [9, 10], sword: 1.4, feet: [[-5, 0, 0], [8, 0, 0]], cape: 0.2 })],
];
// #156: his ability: the sword raised straight up, the shield braced, then lowered
const CAST: [number, Pose][] = [
  [110, pose({ hip: [0, 1], fist: [4, 6], sword: -0.1, shield: [0.5, 0] })],
  [140, pose({ hip: [0, -1], lean: -0.08, head: -0.12, fist: [3, -6], sword: -0.05, zs: 4.6, shield: [1, -1], plume: 0.12, cape: 0.2 })],
  [220, pose({ hip: [0, -1], lean: -0.1, head: -0.15, fist: [3, -7], sword: 0, zs: 4.6, shield: [1, -1], plume: 0.16, cape: 0.25 })],
  [160, pose({ hip: [0, 0], fist: [6, 6], sword: 0.2, shield: [0.5, 0] })],
];
// knocked back a step, head snapped back
const HURT: [number, Pose][] = [
  [90, pose({ hip: [-2, 1], lean: -0.22, head: -0.2, cape: 0.02, plume: -0.15, fist: [4, 9], sword: 0.1, shield: [2, -1], feet: [[-6, 0, 0], [3, 0, 0]] })],
  [140, pose({ hip: [-1, 1], lean: -0.12, head: -0.1, cape: 0.06, plume: -0.05, fist: [5, 10], sword: 0.2, shield: [1, 0], feet: [[-5, 0, 0], [3, 0, 0]] })],
];
// knees give, he sinks and topples backwards
const DEATH: [number, Pose][] = [
  [120, pose({ hip: [-1, 2], lean: -0.15, head: -0.15, fist: [5, 11], sword: 0.6, feet: [[-5, 0, 0], [4, 0, 0]] })],
  [120, pose({ hip: [0, 7], lean: 0.25, head: 0.3, fist: [8, 14], sword: 1.3, shield: [1, 2], cape: 0.3, feet: [[-5, 0, 0], [5, 0, 0]] })],
  [140, pose({ hip: [1, 12], lean: -0.4, head: -0.2, fist: [10, 12], sword: 1.9, shield: [2, 3], cape: 0.6, plume: -0.3, feet: [[-4, 0, 0], [7, 0, 0.2]] })],
  [160, pose({ hip: [4, 14], lean: -1.0, head: -0.2, fist: [12, 10], sword: 2.4, shield: [2, 3], shieldA: -0.6, cape: 1.1, plume: -0.4, feet: [[0, 0, 0.3], [9, 0, 0.3]] })],
  [400, pose({ hip: [7, 16], lean: -1.4, head: -0.1, fist: [14, 6], sword: 2.9, shield: [2, 3], shieldA: -1.2, cape: 1.45, plume: -0.3, feet: [[4, 0, 0.5], [12, 0, 0.4]] })],
];

export const sprite: SpriteDef = {
  id: 'paladin', w: W, h: H, anchor: [X0, GROUND], tall: 55,
  anims: {
    idle: IDLE.map((p) => [200, paladin(p)]),
    walk: WALK.map((p) => [100, paladin(p)]),
    attack: ATTACK.map(([ms, p]) => [ms, paladin(p)]),
    cast: CAST.map(([ms, p]) => [ms, paladin(p)]),
    hurt: HURT.map(([ms, p]) => [ms, paladin(p)]),
    death: DEATH.map(([ms, p]) => [ms, paladin(p)]),
  },
  impact: 4,
};
