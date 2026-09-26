/**
 * #157: the Ballista: a timber bolt thrower on a trestle, iron-bound, with a great steel-tipped bolt. 40 px tall, 60 long (a
 * structure: it never walks, so its walk is the idle's creak). The shot: winch back, aim (held), loose with a pale streak, recoil.
 */
import { Bone, ell, Figure, type Pt } from '../rig';
import type { SpriteDef } from '../sheet';

const W = 96, H = 60, GROUND = 55, X0 = 44;

interface P { aim: number; draw: number; loosed: number; recoil: number; hit: number; fall: number }
const P0: P = { aim: 0, draw: 0.3, loosed: 0, recoil: 0, hit: 0, fall: 0 };

function ballista(kw: Partial<P>): Figure {
  const p = { ...P0, ...kw };
  const f = new Figure(W, H);
  const g = new Bone(X0 - p.recoil + p.hit, GROUND, -0.35 * p.fall);
  // the trestle: two splayed legs and a crossbar
  for (const [x, a, far] of [[-12, 0.3, 1], [10, -0.3, 0], [-6, 0.1, 1], [14, -0.2, 0]] as const)
    f.part(g.child(x, -2, a), [[-2, 0], [2, 0], [1.8, -26], [-1.8, -26]], 'leather', far ? 0.5 : 3, { dim: far });
  f.part(g, [[-15, -19], [17, -19], [17, -15.5], [-15, -15.5]], 'leather', 2, { details: [[-10, -17.2, 'darksteel', 4], [12, -17.2, 'darksteel', 4]] });
  f.part(g, ell(1, -25, 4, 4), 'darksteel', 2.5); // the pivot
  // the stock, tilted by the aim, with the bow arms at its front
  const s = g.child(1, -27, -1.57 + p.aim); // +y along the stock points forward (right)
  f.part(s, [[-4, -16], [4, -16], [4, 26], [-4, 26]], 'leather', 4, { trim: ['darksteel', 0.8], folds: [0.3, 3, 1] });
  f.part(s, [[-4, -18], [4, -18], [4, -14], [-4, -14]], 'darksteel', 4.1); // winch
  const bend = 0.35 * p.draw;
  for (const side of [-1, 1]) {
    const arm = s.child(side * 2.6, 22, side * (1.35 - bend));
    f.part(arm, [[-2, 0], [2, 0], [1.2, 17], [-1.2, 17]], 'leather', side < 0 ? 3.5 : 4.5, { trim: ['darksteel', 0.6] });
  }
  // the string runs from the arm tips back to the nut, drawn further by the winch
  const tip = (side: number): Pt => {
    const a = s.child(side * 2.6, 22, side * (1.35 - bend));
    return a.at(0, 17);
  };
  const nut = s.at(0, 22 - 16 * p.draw);
  for (const side of [-1, 1]) {
    const t = tip(side);
    const b = new Bone(nut[0], nut[1], Math.atan2(-(t[0] - nut[0]), t[1] - nut[1]));
    const len = Math.hypot(t[0] - nut[0], t[1] - nut[1]);
    f.part(b, [[-0.4, 0], [0.4, 0], [0.4, len], [-0.4, len]], 'white', 4.6, { profile: 'flat', outline: false });
  }
  if (!p.loosed) {
    f.part(s, [[-1.2, 22 - 16 * p.draw], [1.2, 22 - 16 * p.draw], [1.2, 50 - 16 * p.draw], [-1.2, 50 - 16 * p.draw]], 'leather', 4.7); // the bolt
    f.part(s, [[-2.4, 50 - 16 * p.draw], [2.4, 50 - 16 * p.draw], [0, 56 - 16 * p.draw]], 'steel', 4.8);
    f.part(s, [[-2.6, 22 - 16 * p.draw], [2.6, 22 - 16 * p.draw], [1.2, 27 - 16 * p.draw], [-1.2, 27 - 16 * p.draw]], 'white', 4.75, { profile: 'flat' });
  } else {
    f.part(s, [[-1.6, 30], [1.6, 30], [0.6, 30 + 30 * p.loosed], [-0.6, 30 + 30 * p.loosed]], 'smear', 4.7, { profile: 'flat', outline: false }); // loosed: the streak
  }
  return f;
}

export const sprite: SpriteDef = {
  id: 'ballista', w: W, h: H, anchor: [X0, GROUND], tall: 40,
  anims: {
    idle: [0, 0.02, 0.04, 0.02].map((a) => [200, ballista({ aim: a })]),
    walk: [0, 0.02, 0.04, 0.02, 0, -0.02, -0.04, -0.02].map((a) => [100, ballista({ aim: a })]),
    attack: [
      [150, ballista({ draw: 0.3 })],
      [200, ballista({ draw: 0.7, aim: -0.04 })],
      [250, ballista({ draw: 1, aim: -0.06 })],
      [150, ballista({ draw: 0, loosed: 1, recoil: 3, aim: -0.1 })],
      [150, ballista({ draw: 0, loosed: 0, recoil: 1, aim: -0.03 })],
    ],
    hurt: [
      [90, ballista({ hit: -2, aim: 0.08 })],
      [140, ballista({ hit: -1, aim: 0.03 })],
    ],
    // it tips over and the stock drops
    death: [
      [120, ballista({ hit: -2, aim: 0.15, draw: 0 })],
      [140, ballista({ hit: -3, aim: 0.3, fall: 0.4, draw: 0 })],
      [160, ballista({ hit: -4, aim: 0.5, fall: 0.8, draw: 0 })],
      [400, ballista({ hit: -5, aim: 0.6, fall: 1, draw: 0 })],
    ],
  },
  impact: 3,
};
