/**
 * #157: the Cavalry: a lancer in a sallet and red caparison on a dark bay horse. 66 px to the helm (a head over the Paladin) and
 * 60 long. The horse gallops; the charge: rear back on the wind-up, then lunge with the lance couched and a pale streak.
 */
import { Bone, ell, Figure, ik, limb, type Pt } from '../rig';
import type { SpriteDef } from '../sheet';

const W = 104, H = 80, GROUND = 75, X0 = 48;

interface P {
  body: Pt; tilt: number; neck: number; lance: number;
  legs: [fb: Pt, fn: Pt, hb: Pt, hn: Pt]; // far fore, near fore, far hind, near hind: foot offsets (dy < 0 lifts)
  smear: number; sway: number;
}
const P0: P = { body: [0, 0], tilt: 0, neck: 0, lance: 1.35, legs: [[0, 0], [0, 0], [0, 0], [0, 0]], smear: 0, sway: 0 };

function cavalry(kw: Partial<P>): Figure {
  const p = { ...P0, ...kw };
  const f = new Figure(W, H);
  const body = new Bone(X0 + p.body[0], GROUND - 29 + p.body[1], p.tilt);
  const roots: Pt[] = [body.at(13, 3), body.at(15, 4), body.at(-15, 2), body.at(-13, 3)];
  const rest: Pt[] = [[X0 + 14, GROUND - 2], [X0 + 17, GROUND - 2], [X0 - 16, GROUND - 2], [X0 - 13, GROUND - 2]];
  rest.forEach(([x, y], i) => {
    const far = i % 2 === 0, hind = i >= 2;
    const foot: Pt = [x + p.legs[i][0], Math.min(GROUND - 2, y + p.legs[i][1]) - (far ? 1 : 0)];
    const knee = ik(roots[i], foot, 13, 13, hind ? 1 : -1);
    const up = limb(roots[i], knee), lo = limb(knee, foot);
    const z = far ? 0.5 : 4, dim = far ? 1 : 0;
    f.part(up, [[-3.6, -3], [3.6, -3], [2.4, 13], [-2.4, 13]], 'leather', z, { dim });
    f.part(lo, [[-1.7, 0], [1.7, 0], [1.6, 13], [-1.6, 13]], 'leather', z + 0.1, { dim });
    f.part(new Bone(foot[0], foot[1]), [[-2.2, -2], [2.4, -2], [2.8, 1], [-2.4, 1]], 'coal', z + 0.2, { dim }); // hoof
  });
  // tail, barrel, the red caparison over it, neck and head
  f.part(body.child(-19, -4, 0.5 - 0.2 * p.sway), [[-2, 0], [2, 0], [1, 14], [-3, 13]], 'coal', 1, { folds: [0.4, 1.6, 1] });
  f.part(body, ell(0, 0, 20, 9.5), 'leather', 2);
  f.part(body, [[-17, -4], [14, -4], [16, 6], [9, 10 + 0.5 * p.sway], [-6, 10], [-18, 6]], 'red', 2.2, { profile: 'flat', folds: [0.5, 3, 0], trim: ['black', 1] });
  const neck = body.child(15, -4, 0.6 + p.neck);
  f.part(neck, [[-4.4, 2], [4, 2], [3.4, -14], [-2.4, -14]], 'leather', 2.3);
  f.part(neck, [[-3.8, 2], [-2.2, -14], [-0.6, -14], [-2, 2]], 'coal', 2.35, { folds: [0.4, 1.6, 1] }); // mane
  const head = neck.child(0.4, -13, -1.5);
  f.part(head, [[-3, -3], [3, -3.4], [4, 8], [2, 12], [-1.6, 12], [-3.4, 4]], 'leather', 2.4, { details: [[1.6, -0.4, 'coal', 0]] });
  f.part(head, [[-1.6, -3], [-0.6, -7], [0.8, -3]], 'leather', 2.45); // ear
  // the rider: legs astride, torso, sallet, arms and lance
  const seat = body.child(-1, -9, -p.tilt * 0.5);
  f.part(seat.child(2, 0, 0.3), [[-3, -1], [3, -1], [2.6, 12], [-2.4, 12]], 'black', 5, {}); // near leg
  f.part(seat.child(3, 11, -0.3), [[-2.2, 0], [4.8, 0], [4.8, 3], [-2.2, 3]], 'black', 5.1); // stirruped foot
  const torso = seat.child(0, 0, 0.08 * p.smear);
  f.part(torso, [[-6, -16], [6, -16], [7, -2], [-6.4, -2]], 'black', 4.6); // breastplate
  f.part(torso, [[-5, -14], [5.4, -14], [6.2, 2], [-5.8, 2]], 'red', 4.7, { profile: 'flat', folds: [0.4, 3, 0] }); // tabard
  const helm = torso.child(0.8, -17, 0);
  f.part(helm, [[-3.8, 0.4], [-4.2, -5], [-3, -8.6], [1, -9.4], [4.4, -7.4], [5.2, -4], [5.6, -2.2], [4.4, -1.4], [4.4, 0.6], [1.2, 1.6]], 'skin', 5);
  f.part(helm, [[-7, -2], [-5, -8.4], [-1.4, -11.2], [3, -10.8], [5.4, -7.6], [5.6, -4.6], [-2.6, -5], [-4.6, -1]], 'black', 5.2, { details: [[2, -5.8, 'red', 3], [3, -5.8, 'red', 3]] }); // sallet
  // the lance couched under the near arm; its angle swings from upright (1.35 is level) as he charges
  const sh = torso.at(3, -13), grip: Pt = torso.at(8, -6);
  f.part(limb(sh, grip), [[-2.2, -1], [2.2, -1], [2, 9], [-2, 9]], 'black', 7);
  const lance = new Bone(grip[0], grip[1], p.lance);
  if (p.smear) f.part(lance, [[-1.6, -40], [1.6, -40], [4 * p.smear, 6], [-4 * p.smear, 6]], 'smear', 6.8, { profile: 'flat', outline: false });
  f.part(lance, [[-1, -40], [1, -40], [1.4, 10], [-1.4, 10]], 'leather', 6.9); // shaft
  f.part(lance, [[-2.6, -2], [2.6, -2], [1.6, 3], [-1.6, 3]], 'black', 6.95); // vamplate
  f.part(lance, [[-1.4, -40], [1.4, -40], [0, -45]], 'steel', 6.95); // point
  f.part(lance.child(0, -36, 0), [[0, 0], [-6, 1 + p.sway], [0, 4]], 'red', 6.85, { profile: 'flat' }); // pennon
  f.part(new Bone(grip[0], grip[1]), ell(0, 0, 2.4, 2.3), 'black', 7.2); // gauntlet
  return f;
}

// a gallop: the hind pair lands, then the fore pair, with a moment of flight
const leg = (ph: number): Pt => {
  ph = ((ph % 1) + 1) % 1;
  return ph < 0.45 ? [7 - 31 * ph, 0] : [-7 + 14 * ((ph - 0.45) / 0.55), -7 * Math.sin((Math.PI * (ph - 0.45)) / 0.55)];
};
const gallop = Array.from({ length: 8 }, (_, i) => {
  const ph = i / 8;
  return cavalry({ body: [0, -1.5 * Math.sin(2 * Math.PI * ph)], tilt: 0.05 * Math.sin(2 * Math.PI * ph), neck: 0.1 * Math.cos(2 * Math.PI * ph), sway: 1 + Math.sin(2 * Math.PI * ph), lance: 1.2, legs: [leg(ph + 0.1), leg(ph), leg(ph + 0.6), leg(ph + 0.5)] });
});

export const sprite: SpriteDef = {
  id: 'cavalry', w: W, h: H, anchor: [X0, GROUND], tall: 66,
  anims: {
    idle: [0, 0.5, 1, 0.5].map((b) => [200, cavalry({ body: [0, b * 0.5], neck: 0.05 * b, lance: 0.85, sway: b })]),
    walk: gallop.map((fig) => [100, fig]),
    // rear back and lower the lance, hold, lunge, the lance strikes at full stretch (held), recover
    attack: [
      [200, cavalry({ lance: 0.85, neck: -0.1 })],
      [180, cavalry({ body: [-3, -3], tilt: -0.25, neck: -0.3, lance: 1.1, legs: [[4, -9], [6, -10], [-2, 0], [0, 0]] })],
      [70, cavalry({ body: [4, -1], tilt: 0.05, lance: 1.4, smear: 0.6, legs: [[8, -4], [10, -6], [-6, 0], [-4, 0]] })],
      [180, cavalry({ body: [8, 0], tilt: 0.08, neck: 0.15, lance: 1.45, smear: 1, sway: 2, legs: [[12, 0], [14, -2], [-8, -3], [-6, 0]] })],
      [160, cavalry({ body: [5, 0], lance: 1.1, sway: 1 })],
    ],
    hurt: [
      [90, cavalry({ body: [-3, 0], tilt: -0.12, neck: -0.3, lance: 0.8, sway: -1 })],
      [140, cavalry({ body: [-1, 0], tilt: -0.05, neck: -0.1, lance: 0.8 })],
    ],
    // the horse's legs fold and it goes down on its side, the lance falling
    death: [
      [120, cavalry({ body: [0, 3], tilt: -0.15, neck: -0.3, lance: 0.9 })],
      [140, cavalry({ body: [1, 10], tilt: 0.1, neck: 0.2, lance: 1.6, legs: [[4, 0], [6, 0], [-4, 0], [-2, 0]] })],
      [160, cavalry({ body: [2, 16], tilt: 0.05, neck: 0.5, lance: 1.9, legs: [[10, 0], [12, 0], [-10, 0], [-8, 0]] })],
      [400, cavalry({ body: [3, 19], tilt: 0, neck: 0.8, lance: 2.1, legs: [[14, 0], [16, 0], [-14, 0], [-12, 0]] })],
    ],
  },
  impact: 3,
};
