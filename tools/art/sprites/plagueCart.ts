/**
 * #157: the Plague Cart: a rickety two-wheeled cart under a rotten tarp, piled with leaking barrels that drip green. 42 px tall and
 * 62 long (a structure that rolls: its wheels turn in the walk). Its attack is a green belch from the barrels.
 */
import { Bone, ell, Figure } from '../rig';
import type { SpriteDef } from '../sheet';

const W = 96, H = 64, GROUND = 59, X0 = 46;

interface P { roll: number; bob: number; puff: number; drip: number; hit: number; fall: number }
const P0: P = { roll: 0, bob: 0, puff: 0, drip: 0, hit: 0, fall: 0 };

function cart(kw: Partial<P>): Figure {
  const p = { ...P0, ...kw };
  const f = new Figure(W, H);
  const g = new Bone(X0 + p.hit, GROUND + p.bob, 0.3 * p.fall);
  const wheel = (x: number, far: number) => {
    const c = g.child(x, -9, p.roll);
    f.part(c, ell(0, 0, 9, 9), 'leather', far ? 0.5 : 5, { dim: far, trim: ['darksteel', 1] });
    for (let i = 0; i < 4; i++) f.part(c.child(0, 0, (i * Math.PI) / 4), [[-0.8, -7.4], [0.8, -7.4], [0.8, 7.4], [-0.8, 7.4]], 'leather', (far ? 0.5 : 5) + 0.05, { dim: far + 1, profile: 'flat' });
    f.part(c, ell(0, 0, 2, 2), 'darksteel', (far ? 0.5 : 5) + 0.1);
  };
  wheel(-4, 1);
  // the bed and the shafts trailing forward to the ground
  f.part(g, [[-26, -22], [22, -22], [22, -15], [-26, -15]], 'leather', 2, { folds: [0.3, 4, 0] });
  f.part(g.child(20, -18, -1.2), [[-1.2, 0], [1.2, 0], [1.2, 22], [-1.2, 22]], 'leather', 1.5); // shaft
  // barrels, and the rotten tarp over the back half
  for (const [x, y, r] of [[-17, -29, 6], [-5, -30, 7], [8, -29, 6]] as const) {
    f.part(g, [[x - r, y - 7], [x + r, y - 7], [x + r + 1, y], [x + r, y + 7], [x - r, y + 7], [x - r - 1, y]], 'leather', 2.5, { trim: ['darksteel', 0.8], folds: [0.3, 2.4, 0] });
    f.part(g, [[x - r + 1, y - 2], [x + r - 1, y - 2], [x + r - 1, y - 1], [x - r + 1, y - 1]], 'darksteel', 2.55, { profile: 'flat' }); // hoop
  }
  f.part(g, [[-27, -22], [-25, -38], [-12, -42], [-4, -38], [-2, -22]], 'wool', 2.7, { folds: [0.5, 2.6, 1], dim: 1 }); // tarp
  // green ooze over the barrels' lips and dripping off the bed
  for (const x of [-5, 8]) f.part(g, [[x - 3, -37], [x + 3, -37], [x + 2, -33], [x + 0.5, -30], [x - 1, -34]], 'poison', 2.8);
  for (const x of [-14, 4, 16]) f.part(g, [[x - 1, -15], [x + 1, -15], [x + 0.6, -12 + 3 * p.drip], [x - 0.6, -12 + 3 * p.drip]], 'poison', 2.9, { profile: 'flat' });
  wheel(-2, 0);
  if (p.puff) for (const [dx, dy, r] of [[-5, -44, 5], [3, -48, 6], [10, -44, 5]] as const) f.part(g, ell(dx + 4 * p.puff, dy - 4 * p.puff, r * p.puff, r * p.puff * 0.8), 'poison', 6, { outline: false, profile: 'round' });
  return f;
}

export const sprite: SpriteDef = {
  id: 'plagueCart', w: W, h: H, anchor: [X0, GROUND], tall: 42,
  anims: {
    idle: [0, 0.3, 0.6, 0.3].map((d) => [200, cart({ drip: d })]),
    walk: Array.from({ length: 8 }, (_, i) => [100, cart({ roll: (i * Math.PI) / 16, bob: i % 2 ? -0.5 : 0, drip: (i % 4) / 3 })]),
    // the barrels heave, then belch a green cloud (held), which drifts off
    attack: [
      [200, cart({ drip: 0.5 })],
      [160, cart({ bob: -1, drip: 1 })],
      [70, cart({ bob: -1.5, puff: 0.5 })],
      [220, cart({ bob: -0.5, puff: 1 })],
      [160, cart({ puff: 1.3 })],
    ],
    hurt: [
      [90, cart({ hit: -2, fall: -0.05 })],
      [140, cart({ hit: -1 })],
    ],
    // it lurches, tips and spills
    death: [
      [120, cart({ hit: -2, fall: -0.08, drip: 1 })],
      [140, cart({ hit: -2, fall: 0.2, bob: 1, puff: 0.6 })],
      [160, cart({ hit: -1, fall: 0.45, bob: 2, puff: 1 })],
      [400, cart({ hit: 0, fall: 0.6, bob: 3, puff: 1.4 })],
    ],
  },
  impact: 3,
};
