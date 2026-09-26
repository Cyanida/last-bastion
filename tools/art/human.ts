/**
 * #157: the common foot soldier's rig, shared by the human foes. The Paladin (sprites/paladin.ts) is drawn by hand-set parts; the
 * foes are simpler people, so one body (legs, torso, two arms, head) is dressed per sprite by a Kit, and the idle, walk, hurt and
 * death poses are shared. Each sprite still sets its own attack.
 */
import { Bone, ell, Figure, ik, limb, type Material, type Pt } from './rig';
import type { SpriteDef } from './sheet';

export const W = 84, H = 72;
export const GROUND = 67; // first empty row under the near foot
export const X0 = 34; // anchor x between the feet
const HIP_Y = GROUND - 3 - 21.2; // legs are 22 long: a slight knee bend at rest

type Foot = [x: number, lift: number, angle: number];
export interface Pose {
  hip: Pt; lean: number; head: number; feet: [far: Foot, near: Foot];
  fist: Pt; far: Pt; // near fist from the near shoulder, far fist from the far shoulder
  weapon: number; zw: number; // the weapon's angle (0 points up) and depth
  smear: number; // 0: none, else the trail's strength this frame
  sway: number; // cloth and hair
}
export const pose = (kw: Partial<Pose> = {}): Pose => ({
  hip: [0, 0], lean: 0, head: 0, feet: [[-4, 0, 0], [4, 0, 0]], fist: [5, 12], far: [3, 12], weapon: 0.2, zw: 7.2, smear: 0, sway: 0, ...kw,
});

export interface Kit {
  legs: Material; boots: Material; sleeve: Material; hand: Material;
  back?: (f: Figure, torso: Bone, p: Pose) => void; // behind everything: capes, quivers
  body: (f: Figure, torso: Bone, p: Pose) => void; // z 3 to 4
  head: (f: Figure, head: Bone, p: Pose) => void; // z 5
  weapon: (f: Figure, grip: Bone, p: Pose) => void; // at p.zw, grip at the near fist
}

export function human(k: Kit, p: Pose): Figure {
  const f = new Figure(W, H);
  const hip = new Bone(X0 + p.hip[0], HIP_Y + p.hip[1]);
  const torso = hip.child(0, 0, p.lean);
  k.back?.(f, torso, p);

  // the far arm, a tone darker, behind the body
  const fsh = torso.at(-3.5, -13.5);
  const ffist: Pt = [fsh[0] + p.far[0], fsh[1] + p.far[1]];
  const fup = limb(fsh, ik(fsh, ffist, 7, 6.5, -1));
  const ffo = limb(fup.at(0, 7), ffist);
  f.part(fup, [[-2, -1], [2, -1], [1.8, 7.5], [-1.8, 7.5]], k.sleeve, 0.6, { dim: 1 });
  f.part(ffo, [[-1.7, 0], [1.7, 0], [1.9, 5.5], [-1.9, 5.5]], k.sleeve, 0.61, { dim: 1 });
  f.part(new Bone(ffist[0], ffist[1]), ell(0, 0.3, 2.1, 2), k.hand, 0.62, { dim: 1 });

  p.feet.forEach(([dx, lift, fa], i) => {
    const root = i === 0 ? hip.at(-2.3, -0.5) : hip.at(2, 0.5);
    const ankle: Pt = [X0 + dx, GROUND - 3 - lift - (i === 0 ? 1 : 0)]; // the far foot stands a row higher
    const knee = ik(root, ankle, 11, 11, 1);
    const th = limb(root, knee), sh = limb(knee, ankle);
    const z = 1 + i, dim = 1 - i;
    f.part(th, [[-3.1, -1.5], [3.1, -1.5], [2.6, 11], [-2.6, 11]], k.legs, z, { dim });
    f.part(sh, [[-2.4, 0], [2.4, 0], [2.1, 10.5], [-2.1, 10.5]], k.boots, z + 0.1, { dim, folds: [0.4, 3, 1] });
    f.part(new Bone(ankle[0], ankle[1], fa), [[-2.4, -1], [2.2, -1], [4.2, 0.6], [5.4, 2.2], [5.4, 3], [-2.6, 3]], k.boots, z + 0.15, { dim: dim + 1 });
  });

  k.body(f, torso, p);
  k.head(f, torso.child(0.8, -17.5, p.head), p);

  const sh = torso.at(4.5, -13.5);
  const fist: Pt = [sh[0] + p.fist[0], sh[1] + p.fist[1]];
  const up = limb(sh, ik(sh, fist, 7.5, 6.5, -1));
  const fo = limb(up.at(0, 7.5), fist);
  f.part(up, [[-2.3, -1], [2.3, -1], [2, 8], [-2, 8]], k.sleeve, 7, { folds: [0.4, 2.5, 1] });
  f.part(fo, [[-2, -0.5], [2, -0.5], [2.2, 5.8], [-2.2, 5.8]], k.sleeve, 7.1);
  k.weapon(f, new Bone(fist[0], fist[1], p.weapon), p);
  f.part(new Bone(fist[0], fist[1]), ell(0.3, 0.4, 2.4, 2.3), k.hand, p.zw + 0.4); // the fist over the grip
  return f;
}

/** Walk-cycle foot: stance slides back from +S to -S, swing arcs forward. */
function foot(ph: number, S = 6): Foot {
  ph = ((ph % 1) + 1) % 1;
  if (ph < 0.5) {
    const s = ph / 0.5;
    const heel = Math.max(0, (s - 0.7) / 0.3);
    return [S - 2 * S * s, 1.5 * heel, 0.3 * heel];
  }
  const s = (ph - 0.5) / 0.5;
  return [-S + 2 * S * (0.5 - 0.5 * Math.cos(Math.PI * s)), 3.5 * Math.sin(Math.PI * s) + 2 * (1 - s) ** 2, 0.35 * (1 - s) - 0.15 * s];
}

const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];

/** The shared idle, walk, hurt and death around a sprite's own rest pose, plus its attack; `impact` indexes the attack. */
export function humanSprite(id: string, tall: number, k: Kit, rest: Partial<Pose>, attack: [number, Partial<Pose>][], impact: number): SpriteDef {
  const r = pose(rest);
  const at = (kw: Partial<Pose>) => human(k, { ...r, ...kw });
  const idle = [0, 1, 1, 0].map((dy, i) => at({ hip: [0, dy], fist: add(r.fist, [0, dy * 0.5]), far: add(r.far, [0, dy * 0.5]), sway: [0, 0.5, 1, 0.5][i] }));
  const walk = Array.from({ length: 8 }, (_, i) => {
    const ph = i / 8, swing = Math.cos(2 * Math.PI * ph);
    return at({ hip: [0, [0, 1, 0, -1][i % 4]], lean: 0.06, feet: [foot(ph + 0.5), foot(ph)], fist: add(r.fist, [-1.2 * swing, 0]), far: add(r.far, [1.5 * swing, 0]), sway: 1 + 0.5 * Math.sin(2 * Math.PI * ph) });
  });
  const hurt: [number, Pose][] = [
    [90, { ...r, hip: [-2, 1], lean: -0.22, head: -0.2, fist: add(r.fist, [-2, -1]), far: add(r.far, [-2, -2]), feet: [[-6, 0, 0], [3, 0, 0]], sway: -1 }],
    [140, { ...r, hip: [-1, 1], lean: -0.12, head: -0.1, fist: add(r.fist, [-1, 0]), feet: [[-5, 0, 0], [3, 0, 0]], sway: -0.5 }],
  ];
  // knees give, the body sinks and topples backwards, the weapon falls away
  const death: [number, Pose][] = [
    [120, { ...r, hip: [-1, 2], lean: -0.15, head: -0.15, feet: [[-5, 0, 0], [4, 0, 0]] }],
    [120, { ...r, hip: [0, 7], lean: 0.25, head: 0.3, fist: add(r.fist, [2, 2]), weapon: r.weapon + 0.6, feet: [[-5, 0, 0], [5, 0, 0]] }],
    [140, { ...r, hip: [1, 12], lean: -0.4, head: -0.2, fist: add(r.fist, [4, 0]), far: add(r.far, [3, -3]), weapon: r.weapon + 1.2, feet: [[-4, 0, 0], [7, 0, 0.2]], sway: 1 }],
    [160, { ...r, hip: [4, 14], lean: -1.0, head: -0.2, fist: add(r.fist, [6, -2]), far: add(r.far, [4, -6]), weapon: r.weapon + 1.7, feet: [[0, 0, 0.3], [9, 0, 0.3]], sway: 1.5 }],
    [400, { ...r, hip: [7, 16], lean: -1.4, head: -0.1, fist: add(r.fist, [8, -6]), far: add(r.far, [5, -9]), weapon: r.weapon + 2.3, feet: [[4, 0, 0.5], [12, 0, 0.4]], sway: 2 }],
  ];
  return {
    id, w: W, h: H, anchor: [X0, GROUND], tall,
    anims: {
      idle: idle.map((fig) => [200, fig]),
      walk: walk.map((fig) => [100, fig]),
      attack: attack.map(([ms, kw]) => [ms, at(kw)]),
      hurt: hurt.map(([ms, p]) => [ms, human(k, p)]),
      death: death.map(([ms, p]) => [ms, human(k, p)]),
    },
    impact,
  };
}
