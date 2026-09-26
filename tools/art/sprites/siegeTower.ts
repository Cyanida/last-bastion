/**
 * #157: the Siege Tower: a timber tower on four wheels, its front hung with wet hides against fire, a drawbridge at the top that
 * drops when it unloads troops. 62 art px tall (the game draws it at scale 4, so about 80 on screen, the old tower's height).
 */
import { Bone, ell, Figure } from '../rig';
import type { SpriteDef } from '../sheet';

const W = 104, H = 76, GROUND = 72, X0 = 34; // wide: it topples forward when destroyed

interface P { roll: number; bob: number; bridge: number; sway: number; hit: number; fall: number }
const P0: P = { roll: 0, bob: 0, bridge: 0, sway: 0, hit: 0, fall: 0 };

function tower(kw: Partial<P>): Figure {
  const p = { ...P0, ...kw };
  const f = new Figure(W, H);
  const g = new Bone(X0 + p.hit, GROUND + p.bob, 0.35 * p.fall);
  const wheel = (x: number, far: number) => {
    const c = g.child(x, -5, p.roll);
    f.part(c, ell(0, 0, 5, 5), 'leather', far ? 0.5 : 6, { dim: far, trim: ['darksteel', 1] });
    f.part(c, [[-0.7, -4], [0.7, -4], [0.7, 4], [-0.7, 4]], 'leather', (far ? 0.5 : 6) + 0.05, { dim: far + 1, profile: 'flat' });
    f.part(c, ell(0, 0, 1.3, 1.3), 'darksteel', (far ? 0.5 : 6) + 0.1);
  };
  wheel(-9, 1); wheel(13, 1);
  // the frame: a tapering box of planks, cross-braced, with a railing on top
  f.part(g, [[-16, -6], [18, -6], [15, -56], [-13, -56]], 'leather', 2, { folds: [0.4, 3, 0], details: [-2, 6].flatMap((x) => [[x, -20, 'darksteel', 4], [x, -38, 'darksteel', 4]] as [number, number, 'darksteel', number][]) });
  for (const y of [-22, -40]) f.part(g, [[-15, y], [17, y], [17, y + 2], [-15, y + 2]], 'leather', 2.2, { dim: 1 }); // floors
  f.part(g, [[-14, -56], [16, -56], [16, -62], [-14, -62]], 'leather', 2.3, { profile: 'flat', folds: [0.5, 3, 0] }); // railing
  // wet hides hung down the front, swaying
  f.part(g.child(9, -54, 0.03 * p.sway), [[-5, 0], [7, 0], [8, 44], [2, 46], [-4, 44]], 'wool', 3, { folds: [0.6, 3, 1], dim: 1 });
  // the drawbridge: hinged at the top front, up against the tower until it drops forward
  const hinge = g.child(16, -44, 0);
  f.part(hinge.child(0, 0, Math.PI + 1.5 * p.bridge), [[-2, 0], [2, 0], [2, 16], [-2, 16]], 'leather', 4, { trim: ['darksteel', 0.8], folds: [0.3, 2.5, 1] });
  f.part(g, [[-12, -56], [-11, -66], [-5, -66], [-6, -56]], 'red', 2.1, { profile: 'flat' }); // the enemy's pennon
  wheel(-7, 0); wheel(15, 0);
  return f;
}

export const sprite: SpriteDef = {
  id: 'siegeTower', w: W, h: H, anchor: [X0, GROUND], tall: 62,
  anims: {
    idle: [0, 0.5, 1, 0.5].map((s) => [200, tower({ sway: s })]),
    walk: Array.from({ length: 8 }, (_, i) => [100, tower({ roll: (i * Math.PI) / 8, bob: i % 2 ? -0.5 : 0, sway: Math.sin((i * Math.PI) / 4) })]),
    // the bridge swings down (held while the troops pour out) and back up
    attack: [
      [200, tower({})],
      [150, tower({ bridge: 0.35 })],
      [120, tower({ bridge: 0.7, sway: 1 })],
      [300, tower({ bridge: 1, bob: 0.5, sway: 1 })],
      [200, tower({ bridge: 0.5 })],
    ],
    hurt: [
      [90, tower({ hit: -1, fall: -0.04, sway: -1 })],
      [140, tower({ sway: -0.5 })],
    ],
    // it leans, then topples forward
    death: [
      [120, tower({ hit: -1, fall: -0.06, sway: -1 })],
      [160, tower({ fall: 0.3, bridge: 0.5, sway: 1 })],
      [180, tower({ fall: 0.8, bridge: 1, sway: 2, bob: 1 })],
      [400, tower({ fall: 1.25, bridge: 1, sway: 2, bob: 2 })],
    ],
  },
  impact: 3,
};
