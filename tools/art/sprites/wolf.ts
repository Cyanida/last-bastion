/**
 * #157: the Wolf: a lean grey wolf with a pale belly and a dark saddle, 30 px at the shoulder (a little over half the Paladin's
 * height) and 52 long. His attack is the lunger's: crouch low on the wind-up, then leap with the jaws open.
 */
import { Bone, ell, Figure, ik, limb, type Pt } from '../rig';
import type { SpriteDef } from '../sheet';

const W = 84, H = 60, GROUND = 55, X0 = 40;

interface P {
  body: Pt; tilt: number; head: number; jaw: number; tail: number;
  legs: [fb: Pt, fn: Pt, hb: Pt, hn: Pt]; // foot offsets from rest: far fore, near fore, far hind, near hind (dy < 0 lifts)
  smear: number;
}
const P0: P = { body: [0, 0], tilt: 0, head: 0, jaw: 0, tail: 0, legs: [[0, 0], [0, 0], [0, 0], [0, 0]], smear: 0 };

function wolf(kw: Partial<P>): Figure {
  const p = { ...P0, ...kw };
  const f = new Figure(W, H);
  const body = new Bone(X0 + p.body[0], GROUND - 24 + p.body[1], p.tilt);
  // legs: hips and shoulders on the body, feet on the ground (or where the pose lifts them)
  const roots: Pt[] = [body.at(10, 2), body.at(12, 3), body.at(-12, 1), body.at(-10, 2)];
  const rest: Pt[] = [[X0 + 11, GROUND - 2], [X0 + 14, GROUND - 2], [X0 - 13, GROUND - 2], [X0 - 10, GROUND - 2]];
  rest.forEach(([x, y], i) => {
    const far = i % 2 === 0, hind = i >= 2;
    const foot: Pt = [x + p.legs[i][0], Math.min(GROUND - 2, y + p.legs[i][1]) - (far ? 1 : 0)];
    const knee = ik(roots[i], foot, 11, 11, hind ? 1 : -1);
    const up = limb(roots[i], knee), lo = limb(knee, foot);
    const z = far ? 0.5 : 4, dim = far ? 1 : 0;
    f.part(up, [[-3, -2], [3, -2], [2, 11], [-2, 11]], 'fur', z, { dim });
    f.part(lo, [[-1.6, 0], [1.6, 0], [1.4, 11], [-1.4, 11]], 'fur', z + 0.1, { dim });
    f.part(new Bone(foot[0], foot[1]), ell(1, 0.4, 2.6, 1.5), 'fur', z + 0.2, { dim: dim + 1 });
  });
  // the tail, then the body with its pale belly and dark saddle
  const tail = body.child(-15, -3, 1.1 - 0.6 * p.tail); // hangs back and down; p.tail lifts it
  f.part(tail, [[-2.4, 0], [2.4, 0], [3, 8], [0.6, 15], [-2, 9]], 'fur', 1, { folds: [0.4, 2, 1] });
  f.part(body, ell(0, 0, 17, 8), 'fur', 2, { folds: [0.3, 2.2, 0] });
  f.part(body, [[-12, 3], [12, 3], [10, 7], [-10, 7]], 'white', 2.1, { dim: 2, profile: 'flat' }); // belly
  f.part(body, [[-14, -6], [4, -8], [10, -6], [-8, -3]], 'coal', 2.2, { profile: 'flat' }); // saddle
  f.part(body, ell(12, -2, 7, 8), 'fur', 2.3, { folds: [0.5, 1.6, 1] }); // ruff
  // the head: skull, snout, ears, jaw and an amber eye
  const head = body.child(17, -6, p.head);
  const jaw = head.child(5, 2, 0.5 * p.jaw);
  f.part(jaw, [[-2, -0.6], [9, 0.4], [8.4, 2.2], [-2, 2]], 'fur', 2.4, { dim: 1 }); // lower jaw
  if (p.jaw > 0.2) f.part(jaw, [[0, -0.6], [7, 0], [7, 0.8], [0, 0.4]], 'red', 2.45, { profile: 'flat', outline: false }); // the mouth
  f.part(head, [[-5, -5], [2, -6.4], [6, -3], [14, -1], [14.6, 1.2], [5, 2.4], [-4, 3]], 'fur', 2.5, { details: [[3.2, -3, 'straw', 5], [14, -0.6, 'coal', 0]] });
  f.part(head, [[-3, -4.6], [-1.4, -10], [1.2, -5.4]], 'fur', 2.55); // ear
  if (p.smear) f.part(body, [[-20, -4], [-4, -10 - 4 * p.smear], [18, -6], [-8, -2]], 'smear', 1.5, { profile: 'flat', outline: false }); // the leap's streak
  return f;
}

// a trot: diagonal pairs move together (near fore with far hind)
const step = (ph: number): Pt => {
  ph = ((ph % 1) + 1) % 1;
  return ph < 0.5 ? [5 - 20 * ph, 0] : [-5 + 20 * (ph - 0.5), -4 * Math.sin(Math.PI * (ph - 0.5) * 2)];
};
const walk = Array.from({ length: 8 }, (_, i) => {
  const ph = i / 8;
  return wolf({ body: [0, [0, -1, 0, -1][i % 4]], head: 0.05, tail: 0.3 + 0.2 * Math.sin(2 * Math.PI * ph), legs: [step(ph + 0.5), step(ph), step(ph), step(ph + 0.5)] });
});

export const sprite: SpriteDef = {
  id: 'wolf', w: W, h: H, anchor: [X0, GROUND], tall: 32,
  anims: {
    idle: [0, 0.5, 1, 0.5].map((b) => [200, wolf({ body: [0, b * 0.6], tail: 0.1 * b, jaw: 0.1 * b })]),
    walk: walk.map((fig) => [100, fig]),
    // crouch low and snarl, gather, spring, the bite at full stretch (held), land
    attack: [
      [200, wolf({ body: [-1, 3], tilt: 0.08, head: 0.15, jaw: 0.6, tail: -0.3 })],
      [160, wolf({ body: [-3, 6], tilt: 0.12, head: 0.2, jaw: 0.8, tail: -0.4, legs: [[-2, 0], [-2, 0], [2, 0], [2, 0]] })],
      [70, wolf({ body: [4, -6], tilt: -0.2, head: -0.1, jaw: 1.4, tail: 0.6, legs: [[6, -6], [8, -8], [-2, 0], [0, 0]], smear: 0.6 })],
      [160, wolf({ body: [9, -8], tilt: -0.05, head: 0.1, jaw: 2, tail: 0.8, legs: [[10, -8], [12, -8], [4, -3], [6, -4]], smear: 1 })],
      [140, wolf({ body: [6, 0], tilt: 0.06, head: 0.1, jaw: 0.4, tail: 0.3, legs: [[6, 0], [7, 0], [5, 0], [6, 0]] })],
    ],
    hurt: [
      [90, wolf({ body: [-3, 2], tilt: -0.15, head: -0.35, jaw: 0.8, tail: -0.6 })],
      [140, wolf({ body: [-2, 1], tilt: -0.06, head: -0.15, jaw: 0.3, tail: -0.3 })],
    ],
    // the legs give and he rolls onto his side
    death: [
      [120, wolf({ body: [-1, 3], tilt: -0.1, head: -0.3, jaw: 0.8, tail: -0.4 })],
      [120, wolf({ body: [0, 8], tilt: 0.1, head: 0.3, jaw: 0.5, tail: -0.6 })],
      [160, wolf({ body: [1, 12], tilt: 0.05, head: 0.5, jaw: 0.4, tail: -0.8, legs: [[4, 0], [6, 0], [-4, 0], [-2, 0]] })],
      [400, wolf({ body: [2, 15], tilt: 0, head: 0.6, jaw: 0.6, tail: -1, legs: [[8, 0], [10, 0], [-8, 0], [-6, 0]] })],
    ],
  },
  impact: 3,
};
