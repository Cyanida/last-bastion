/**
 * #158: the robed casters (the Lich, the Grand Inquisitor, the Plague Abbot) share one rig and one set of moves: a long robe that
 * hides the feet, wide sleeves, a staff in the near hand. Their special is the cast: the staff rises and magic gathers in the far
 * hand over the telegraph, then it is thrust down and the ground flares in the damage type's colour. Each sprite file dresses it.
 */
import { Bone, ell, Figure, ik, limb, type Material, type Pt } from './rig';
import type { SpriteDef } from './sheet';

const W = 110, H = 112;
const GROUND = 106;
const X0 = 46;

export type Px = [number, number, Material, number];
/** Scaled drawing helpers: art is written at the Paladin's size and scaled by the figure's S. */
export const scaled = (S: number) => ({
  sc: (pts: Pt[]): Pt[] => pts.map(([x, y]) => [x * S, y * S] as const),
  E: (cx: number, cy: number, rx: number, ry: number): Pt[] => ell(cx * S, cy * S, rx * S, ry * S),
  dt: (d: Px[]): Px[] => d.map(([x, y, m, t]) => [x * S, y * S, m, t]),
});

export interface Robed {
  id: string;
  S: number; // size against the Paladin
  tall: number;
  robe: Material; panel: Material; trim: Material; hand: Material; // hand: bone or skin
  fx: Material; // the magic's colour: its damage type (STYLE.md trails)
  head(f: Figure, head: Bone, p: Pose): void; // face and headgear
  top(f: Figure, staff: Bone, p: Pose): void; // what crowns the staff
}

export interface Pose {
  hip: Pt; lean: number; head: number; robe: number; hem: number;
  fist: Pt; staff: number; far: Pt; // hand offsets from the shoulders
  magic: number; // magic gathering in the far hand (0: none)
  burst: number; // the cast: a flare at the staff's foot (0: none)
}
const pose = (kw: Partial<Pose> = {}): Pose => ({ hip: [0, 0], lean: 0, head: 0, robe: 0, hem: 0, fist: [5, 12], staff: 0.08, far: [-2, 13], magic: 0, burst: 0, ...kw });

function robed(c: Robed, p: Pose): Figure {
  const { S } = c, { sc, E, dt } = scaled(S), HIP_Y = GROUND - 26 * S;
  const f = new Figure(W, H);
  const hip = new Bone(X0 + p.hip[0] * S, HIP_Y + p.hip[1] * S);
  const torso = hip.child(0, 0, p.lean);
  const world = new Bone(0, 0);

  // far arm, behind
  const shF = torso.at(-6 * S, -17 * S);
  const farH: Pt = [shF[0] + p.far[0] * S, shF[1] + p.far[1] * S];
  const upF = limb(shF, ik(shF, farH, 8 * S, 7.5 * S, -1));
  const foF = limb(upF.at(0, 8 * S), farH);
  f.part(upF, sc([[-3, -1], [3, -1], [3.6, 8.5], [-3.6, 8.5]]), c.robe, 0.5, { dim: 1, folds: [0.4, 2.4, 0] });
  f.part(foF, sc([[-3.2, -0.5], [3.2, -0.5], [4.6, 6], [-4.6, 6]]), c.robe, 0.6, { dim: 1, folds: [0.4, 2.4, 0] }); // wide sleeve
  f.part(foF, sc([[-1.2, 5.5], [1.2, 5.5], [1.6, 9], [0, 10.4], [-1.6, 9]]), c.hand, 0.7, { dim: 1 }); // bone hand

  // the robe, hip to ground, swaying
  const skirt = hip.child(0, -2 * S, p.robe);
  f.part(skirt, sc([[-7.5, 0], [7.8, 0], [10, 12], [11.5 + p.hem, 22], [8, 25], [5, 23.5], [2, 26], [-1, 24], [-4, 26], [-7, 24], [-10.5 + p.hem, 25], [-10, 12]]), c.robe, 1, { folds: [0.9, 3, 0] });
  f.part(skirt, sc([[-1.8, 0], [2.4, 0], [3.6, 24.5], [2, 26], [-1, 24], [-2.8, 24.8]]), c.panel, 1.1, { profile: 'flat', folds: [0.3, 2, 0] }); // dark panel

  f.part(torso, sc([[-8, -19.5], [8, -19.5], [9, -9], [8, -1], [-7.8, -1], [-9, -9]]), c.robe, 3.1, { folds: [0.5, 3, 0] }); // robe body
  f.part(torso, sc([[-8.4, -4], [8.6, -4], [8.6, -1.4], [-8.4, -1.4]]), c.trim, 3.5, { details: dt([[1.5, -2.7, c.fx, 5]]) }); // girdle with a gem
  f.part(torso, sc([[-11, -21.5], [10.5, -21.5], [12, -16], [9, -13.5], [4, -15.5], [-2, -13.5], [-8, -15.5], [-12, -14]]), c.robe, 3.8, { trim: [c.trim, 1] }); // high collar mantle

  c.head(f, torso.child(0.8 * S, -21 * S, p.head), p);

  // near arm and the staff
  const sh = torso.at(6.4 * S, -17 * S);
  const fist: Pt = [sh[0] + p.fist[0] * S, sh[1] + p.fist[1] * S];
  const up = limb(sh, ik(sh, fist, 8 * S, 7.5 * S, -1));
  const fo = limb(up.at(0, 8 * S), fist);
  const st = new Bone(fist[0], fist[1], p.staff);
  f.part(st, sc([[-0.9, 16], [0.9, 16], [0.9, -24], [-0.9, -24]]), 'leather', 6.8, { dim: 1 }); // staff
  c.top(f, st, p);
  f.part(up, sc([[-3.2, -1], [3.2, -1], [3.8, 8.5], [-3.8, 8.5]]), c.robe, 7, { folds: [0.4, 2.4, 0] });
  f.part(fo, sc([[-3.2, -0.5], [3.2, -0.5], [4.6, 6], [-4.6, 6]]), c.robe, 7.1, { folds: [0.4, 2.4, 0], trim: [c.trim, 1] });
  f.part(st, E(0.2, 0.2, 2, 2.2), c.hand, 7.4, { details: dt([[1, -0.6, c.hand, 2], [1, 0.8, c.hand, 2]]) }); // grip

  if (p.magic) {
    const m = p.magic;
    f.part(world, ell(farH[0], farH[1] + 1, 2.5 + m * 1.6, 2.5 + m * 1.6, 16), c.fx, 9, { profile: 'round', outline: false });
    for (let k = 0; k < 3; k++) {
      const a = (k * 2 * Math.PI) / 3 + m;
      const r = 4 + m * 2.5;
      f.part(world, ell(farH[0] + r * Math.cos(a), farH[1] + 1 + r * Math.sin(a), 1.2, 1.2, 8), c.fx, 9.1, { profile: 'flat', outline: false });
    }
  }
  if (p.burst) {
    const [bx] = st.at(0, 16 * S), b = p.burst;
    f.part(world, ell(bx, GROUND - 1, b, b * 0.3, 28), c.fx, -1, { profile: 'flat', outline: false, dim: 1 });
    for (const [dx, h] of [[-0.7, 10], [-0.25, 16], [0.3, 13], [0.75, 8]])
      f.part(world, [[bx + dx * b - 1.8, GROUND - 1], [bx + dx * b + 1.8, GROUND - 1], [bx + dx * b * 1.15, GROUND - 1 - h * S]], c.fx, 8, { profile: 'flat', outline: false }); // tongues of magic
  }
  return f;
}

const IDLE = ([[0, 0], [-1, 0.03], [-1.5, 0.05], [-0.5, 0.02]] as const).map(([dy, r], i) => pose({ hip: [0, dy], robe: r, hem: i % 2 ? 0.6 : 0 }));
const WALK = Array.from({ length: 8 }, (_, i) => {
  const ph = (2 * Math.PI * i) / 8;
  return pose({ hip: [0, -1 - Math.sin(ph)], lean: 0.1, robe: -0.1 + 0.05 * Math.sin(ph), hem: -1.5 + Math.cos(ph), fist: [5, 11.5], staff: 0.2, far: [-3 + Math.cos(ph), 12] }); // he glides
});
// his touch: a jab with the staff's claw
const ATTACK: [number, Pose][] = [
  [250, pose()],
  [110, pose({ hip: [-1, -1], lean: -0.1, fist: [1, 7], staff: -0.3 })],
  [130, pose({ hip: [-1.5, -1.5], lean: -0.16, fist: [-1, 4], staff: -0.5, head: -0.1 })],
  [70, pose({ hip: [1, -1], lean: 0.12, fist: [9, 6], staff: 0.9, robe: -0.1 })],
  [180, pose({ hip: [2, -0.5], lean: 0.22, fist: [12, 7], staff: 1.3, robe: -0.15, hem: -2 })],
  [140, pose({ hip: [1, 0], lean: 0.08, fist: [7, 11], staff: 0.4 })],
];
// the cast: he rises, staff aloft, magic gathering (held to the end of the telegraph) | casts it down, the ground flares
const SPECIAL: [number, Pose][] = [
  [220, pose({ hip: [0, -1], lean: -0.05, fist: [4, 3], staff: -0.1, far: [10, 6], magic: 1 })],
  [260, pose({ hip: [0, -3], lean: -0.12, head: -0.15, fist: [3, -6], staff: -0.2, far: [14, 2], magic: 2, robe: 0.05, hem: 1 })],
  [320, pose({ hip: [0, -4], lean: -0.18, head: -0.25, fist: [2, -9], staff: -0.25, far: [16, -1], magic: 3, robe: 0.08, hem: 1.5 })],
  [200, pose({ hip: [2, -1], lean: 0.2, head: 0.1, fist: [11, 4], staff: 0.5, far: [12, 6], robe: -0.12, hem: -2, burst: 18 })],
  [300, pose({ hip: [2, -0.5], lean: 0.18, fist: [11, 6], staff: 0.45, far: [10, 8], robe: -0.1, hem: -1.5, burst: 26 })],
  [260, pose({ hip: [1, 0], lean: 0.06, fist: [6, 11], staff: 0.2 })],
];
const HURT: [number, Pose][] = [
  [100, pose({ hip: [-2, 0], lean: -0.22, head: -0.3, fist: [3, 10], staff: -0.15, robe: 0.15, hem: 2 })],
  [150, pose({ hip: [-1, 0], lean: -0.1, head: -0.12, fist: [4, 11], staff: 0, robe: 0.08, hem: 1 })],
];
// the spell unravels: he sags, the staff falls, he collapses into his robes
const DEATH: [number, Pose][] = [
  [160, pose({ hip: [0, 1], lean: -0.15, head: -0.25, fist: [4, 12], staff: 0.3, robe: 0.1 })],
  [180, pose({ hip: [0, 6], lean: 0.2, head: 0.4, fist: [7, 14], staff: 0.8, robe: 0.05, hem: 2 })],
  [180, pose({ hip: [1, 11], lean: 0.5, head: 0.6, fist: [9, 12], staff: 1.3, robe: 0, hem: 4 })],
  [200, pose({ hip: [2, 15], lean: 0.9, head: 0.7, fist: [12, 9], staff: 1.8, robe: -0.2, hem: 6 })],
  [400, pose({ hip: [3, 18], lean: 1.3, head: 0.8, fist: [14, 6], staff: 2.2, robe: -0.4, hem: 8 })],
];

/** A robed caster's sheet: the Lich's rig and moves, dressed by `c`. */
export function robedSprite(c: Robed): SpriteDef {
  const fig = (p: Pose) => robed(c, p);
  return {
    id: c.id, w: W, h: H, anchor: [X0, GROUND], tall: c.tall,
    anims: {
      idle: IDLE.map((p) => [220, fig(p)]),
      walk: WALK.map((p) => [120, fig(p)]),
      attack: ATTACK.map(([ms, p]) => [ms, fig(p)]),
      hurt: HURT.map(([ms, p]) => [ms, fig(p)]),
      death: DEATH.map(([ms, p]) => [ms, fig(p)]),
      special: SPECIAL.map(([ms, p]) => [ms, fig(p)]),
    },
    impact: 4,
    specialImpact: 3,
  };
}
