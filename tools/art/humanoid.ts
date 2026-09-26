/**
 * #156: what the champions share with the Paladin's rig: the same cell, ground line, leg length, walk cycle and the idle, walk,
 * hurt and death poses. Each champion's file draws its own body from a `Pose` and writes its own attack.
 */
import { Bone, ik, limb, type Figure, type Material, type Pt } from './rig';

export const W = 92, H = 80;
export const GROUND = 75; // first empty row under the near foot
export const X0 = 40; // anchor x between the feet
export const HIP_Y = GROUND - 3 - 22.2; // legs are 23 long: a slight knee bend at rest

export type Foot = [x: number, lift: number, angle: number];
export interface Pose {
  hip: Pt; lean: number; head: number; cape: number; plume: number; skirt: number;
  feet: [far: Foot, near: Foot];
  fist: Pt; // near hand, offset from the near shoulder
  wpn: number; // weapon angle in the near hand
  za: number; // near arm depth: behind the body (<3) or in front
  off: Pt; // far hand, offset from the far shoulder
  offA: number; // angle of whatever the far hand holds
  smear: [[Pt, number], [Pt, number]] | null; // swing trail: (fist offset, weapon angle) from, to
  fx: number; // 0..1: a glow (a spell charging, a string drawn)
}
export const pose = (base: Partial<Pose>, kw: Partial<Pose> = {}): Pose => ({
  hip: [0, 0], lean: 0, head: 0, cape: 0.12, plume: 0, skirt: 0, feet: [[-4, 0, 0], [4, 0, 0]],
  fist: [7, 11.5], wpn: 0.3, za: 7, off: [-2, 11], offA: 0, smear: null, fx: 0, ...base, ...kw,
});

/** Walk-cycle foot: stance slides back from +S to -S, swing arcs forward. */
export function foot(ph: number, S = 6.5): Foot {
  ph = ((ph % 1) + 1) % 1;
  if (ph < 0.5) {
    const s = ph / 0.5;
    const heel = Math.max(0, (s - 0.7) / 0.3);
    return [S - 2 * S * s, 1.5 * heel, 0.3 * heel];
  }
  const s = (ph - 0.5) / 0.5;
  return [-S + 2 * S * (0.5 - 0.5 * Math.cos(Math.PI * s)), 4 * Math.sin(Math.PI * s) + 2 * (1 - s) ** 2, 0.35 * (1 - s) - 0.15 * s];
}

/** Idle, walk, hurt and death around a champion's rest pose `b` (its hands and weapon at rest). */
export function common(b: Partial<Pose>): { idle: Pose[]; walk: Pose[]; cast: [number, Pose][]; hurt: [number, Pose][]; death: [number, Pose][] } {
  const P = (kw: Partial<Pose>) => pose(b, kw);
  const [fx, fy] = b.fist ?? [7, 11.5];
  const [ox, oy] = b.off ?? [-2, 11];
  const w0 = b.wpn ?? 0.3;
  return {
    idle: ([[0, 0, 0], [1, 0.03, 0.06], [1, 0.05, 0.1], [0, 0.02, 0.04]] as const).map(([dy, c, pl], i) =>
      P({ hip: [0, dy], cape: 0.12 + c, plume: pl, fist: [fx, fy + dy * 0.5], off: [ox, oy + dy * 0.5], fx: [0.3, 0.5, 0.7, 0.5][i] })),
    walk: Array.from({ length: 8 }, (_, i) => {
      const ph = i / 8, swing = Math.cos(2 * Math.PI * ph);
      return P({
        hip: [0, [0, 1, 0, -1][i % 4]], lean: 0.06, feet: [foot(ph + 0.5), foot(ph)],
        cape: 0.3 + 0.06 * Math.sin(2 * Math.PI * ph), plume: 0.12 + 0.06 * Math.sin(2 * Math.PI * ph + 1),
        fist: [fx - 1.5 * swing, fy - 0.6 * Math.abs(swing)], off: [ox + 1.5 * swing, oy], skirt: 0.08 * swing, fx: 0.5,
      });
    }),
    // the signature ability: gather, raise the hand high, release with a flare, hold, settle
    cast: [
      [110, P({ hip: [0, 1], lean: -0.05, fist: [fx - 3, fy - 3], off: [ox + 2, oy - 2], fx: 0.6 })],
      [130, P({ hip: [0, -1], lean: -0.12, head: -0.15, fist: [3, -6], wpn: w0 - 0.4, off: [ox - 2, oy - 8], fx: 1, cape: 0.2, plume: 0.1 })],
      [220, P({ hip: [0, 0], lean: -0.08, head: -0.1, fist: [5, -5], wpn: w0 - 0.2, off: [ox - 3, oy - 10], fx: 1, cape: 0.25, plume: 0.14 })],
      [160, P({ hip: [0, 1], lean: 0, fist: [fx, fy - 2], off: [ox, oy - 1], fx: 0.4 })],
    ],
    hurt: [
      [90, P({ hip: [-2, 1], lean: -0.22, head: -0.2, cape: 0.02, plume: -0.15, fist: [fx - 3, fy - 2], wpn: w0 - 0.2, off: [ox + 2, oy - 1], feet: [[-6, 0, 0], [3, 0, 0]] })],
      [140, P({ hip: [-1, 1], lean: -0.12, head: -0.1, cape: 0.06, plume: -0.05, fist: [fx - 2, fy - 1], wpn: w0 - 0.1, off: [ox + 1, oy], feet: [[-5, 0, 0], [3, 0, 0]] })],
    ],
    death: [
      [120, P({ hip: [-1, 2], lean: -0.15, head: -0.15, fist: [fx - 2, fy], wpn: w0 + 0.3, feet: [[-5, 0, 0], [4, 0, 0]] })],
      [120, P({ hip: [0, 7], lean: 0.25, head: 0.3, fist: [fx + 1, fy + 3], wpn: w0 + 1.0, off: [ox + 1, oy + 2], cape: 0.3, feet: [[-5, 0, 0], [5, 0, 0]] })],
      [140, P({ hip: [1, 12], lean: -0.4, head: -0.2, fist: [fx + 3, fy + 1], wpn: w0 + 1.6, off: [ox + 2, oy + 2], cape: 0.6, plume: -0.3, feet: [[-4, 0, 0], [7, 0, 0.2]] })],
      [160, P({ hip: [4, 14], lean: -1.0, head: -0.2, fist: [fx + 5, fy - 1], wpn: w0 + 2.1, off: [ox + 2, oy + 2], offA: -0.6, cape: 1.1, plume: -0.4, feet: [[0, 0, 0.3], [9, 0, 0.3]] })],
      [400, P({ hip: [7, 16], lean: -1.4, head: -0.1, fist: [fx + 7, fy - 5], wpn: w0 + 2.6, off: [ox + 2, oy + 2], offA: -1.2, cape: 1.45, plume: -0.3, feet: [[4, 0, 0.5], [12, 0, 0.4]] })],
    ],
  };
}

/** Both legs reaching their feet by IK; the far one a tone darker and a row higher. `wear` draws each leg's parts. */
export function legs(hip: Bone, feet: Pose['feet'], wear: (th: Bone, sh: Bone, foot: Bone, z: number, dim: number) => void): void {
  feet.forEach(([dx, lift, fa], i) => {
    const root = i === 0 ? hip.at(-2.5, -0.5) : hip.at(2, 0.5);
    const ankle: Pt = [X0 + dx, GROUND - 3 - lift - (i === 0 ? 1 : 0)];
    const knee = ik(root, ankle, 11.5, 11.5, 1);
    wear(limb(root, knee), limb(knee, ankle), new Bone(ankle[0], ankle[1], fa), 1 + i, 1 - i);
  });
}

/** An arm from the shoulder to a hand target: upper arm and forearm bones, elbow bent back (`bend` -1) like the Paladin's. */
export function arm(sh: Pt, fist: Pt, bend = -1): [up: Bone, fo: Bone] {
  const up = limb(sh, ik(sh, fist, 8, 7, bend));
  return [up, limb(up.at(0, 8), fist)];
}

/** A swing trail between two (fist offset, weapon angle) states around the shoulder, radius r at the weapon's head. */
export function smear(f: Figure, sh: Pt, s: NonNullable<Pose['smear']>, r: number, mat: Material, z: number, edgeMat: Material = 'smear'): void {
  const [[f0, a0], [f1, a1]] = s;
  const outer: Pt[] = [], inner: Pt[] = [], edge: Pt[] = [];
  for (let k = 0; k < 13; k++) {
    const t = k / 12;
    const fx = sh[0] + f0[0] + (f1[0] - f0[0]) * t, fy = sh[1] + f0[1] + (f1[1] - f0[1]) * t;
    const a = a0 + (a1 - a0) * t;
    const d = [Math.sin(a), -Math.cos(a)];
    const rIn = r * 0.9 - r * 0.42 * t ** 1.5;
    outer.push([fx + r * d[0], fy + r * d[1]]);
    inner.push([fx + rIn * d[0], fy + rIn * d[1]]);
    edge.push([fx + (r - 2.5 * t) * d[0], fy + (r - 2.5 * t) * d[1]]);
  }
  const world = new Bone(0, 0);
  f.part(world, [...outer, ...inner.reverse()], mat, z, { profile: 'flat', outline: false });
  f.part(world, [...outer, ...edge.reverse()], edgeMat, z + 0.05, { profile: 'flat', outline: false });
}
