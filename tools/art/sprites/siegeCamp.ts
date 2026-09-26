/**
 * #157: the Siege Camp: a red and white war tent behind a short palisade of sharpened stakes, a standard on the ridge pole. 46 px
 * tall, 60 wide. It never moves (its walk is the idle's flutter); when it musters troops the tent flap opens (held) and shuts.
 */
import { Bone, Figure } from '../rig';
import type { SpriteDef } from '../sheet';

const W = 80, H = 60, GROUND = 56, X0 = 40;

interface P { flap: number; sway: number; hit: number; fall: number }
const P0: P = { flap: 0, sway: 0, hit: 0, fall: 0 };

function camp(kw: Partial<P>): Figure {
  const p = { ...P0, ...kw };
  const f = new Figure(W, H);
  const g = new Bone(X0 + p.hit, GROUND, 0);
  const sag = 12 * p.fall; // collapsing: the ridge sinks
  // the tent: a peaked body in red and white panels, the dark doorway and its flap
  f.part(g, [[-22, 0], [-16, -30 + sag], [0, -38 + sag], [16, -30 + sag], [22, 0]], 'white', 1, { folds: [0.5, 3, 0] });
  for (const x of [-12, 4]) f.part(g, [[x, 0], [x + 1.6, -34 + sag], [x + 6, -34 + sag], [x + 8, 0]], 'red', 1.1, { profile: 'flat', folds: [0.4, 3, 1] });
  f.part(g, [[2, 0], [6, -22 + sag], [10, 0]], 'coal', 1.2, { profile: 'flat' }); // the doorway
  f.part(g.child(6, -22 + sag, 0.9 * p.flap), [[0, 0], [-1, 0], [-4 + 6 * p.flap, 22], [4, 22]], 'red', 1.3, { profile: 'flat', dim: 1 }); // flap
  f.part(g, [[-0.8, -38 + sag], [0.8, -38 + sag], [0.8, -48 + sag], [-0.8, -48 + sag]], 'leather', 0.9); // ridge pole
  f.part(g.child(0.8, -48 + sag, 0.1 * p.sway), [[0, 0], [9 + p.sway, 1], [7 + p.sway, 3.5], [9 + p.sway, 6], [0, 6]], 'red', 0.95, { profile: 'flat', folds: [0.4, 3, 0] }); // pennant
  // the palisade in front: sharpened stakes, tied with a rope rail
  for (let i = 0; i < 9; i++) {
    const x = -26 + i * 6.5, lean = 0.05 * ((i % 3) - 1) + (p.fall ? 0.15 * p.fall * (i % 2 ? 1 : -1) : 0);
    f.part(g.child(x, 0, lean), [[-1.6, 0], [1.6, 0], [1.6, -11], [0, -14], [-1.6, -11]], 'leather', 3 + i * 0.01, { folds: [0.3, 2, 1] });
  }
  f.part(g, [[-28, -7], [28, -7], [28, -6], [-28, -6]], 'straw', 3.5, { profile: 'flat' });
  return f;
}

export const sprite: SpriteDef = {
  id: 'siegeCamp', w: W, h: H, anchor: [X0, GROUND], tall: 46,
  anims: {
    idle: [0, 0.5, 1, 0.5].map((s) => [200, camp({ sway: s })]),
    walk: [0, 0.5, 1, 0.5, 0, -0.5, -1, -0.5].map((s) => [100, camp({ sway: s })]),
    attack: [
      [200, camp({})],
      [150, camp({ flap: 0.4, sway: 0.5 })],
      [100, camp({ flap: 0.8, sway: 1 })],
      [300, camp({ flap: 1, sway: 1 })],
      [200, camp({ flap: 0.4 })],
    ],
    hurt: [
      [90, camp({ hit: -1, sway: -1 })],
      [140, camp({ sway: -0.5 })],
    ],
    // the tent sags and falls in, the stakes splay
    death: [
      [120, camp({ hit: -1, sway: -1, fall: 0.1 })],
      [160, camp({ fall: 0.4, sway: 1 })],
      [180, camp({ fall: 0.8, sway: 2 })],
      [400, camp({ fall: 1.2, sway: 2 })],
    ],
  },
  impact: 3,
};
