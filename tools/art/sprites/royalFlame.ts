/**
 * #158: a Royal Flame, one of the Usurper's three braziers: a gold bowl on an iron tripod with a tall fire, 42 art px (the game
 * draws it at 4/3, about the Paladin's height). It never walks or strikes: its idle is the fire's flicker, a hit makes the fire
 * gutter, and when it breaks the stand topples and the fire goes out.
 */
import { Bone, ell, Figure, type Pt } from '../rig';
import type { SpriteDef } from '../sheet';

const W = 56, H = 62;
const GROUND = 58;
const X0 = 24;

interface Pose { fire: number; sway: number; tilt: number; drop: number; embers: number }
const pose = (kw: Partial<Pose> = {}): Pose => ({ fire: 1, sway: 0, tilt: 0, drop: 0, embers: 0, ...kw });

function brazier(p: Pose): Figure {
  const f = new Figure(W, H);
  const base = new Bone(X0, GROUND - p.drop, p.tilt);
  for (const [x, d] of [[-7, 1], [7, 0], [0, 0]] as const) f.part(base, [[x - 1, 0], [x + 1, 0], [x * 0.3 + 1, -20], [x * 0.3 - 1, -20]], 'darksteel', 1 + (d ? 0 : 1), { dim: d }); // tripod
  f.part(base, [[-4, -18], [4, -18], [4, -16], [-4, -16]], 'darksteel', 2.5); // collar
  f.part(base, [[-11, -27], [11, -27], [9, -21], [5, -18.5], [-5, -18.5], [-9, -21]], 'gold', 3, { trim: ['gold', 1], details: [[-6, -23, 'red', 5], [0, -22.5, 'blue', 5], [6, -23, 'red', 5]] }); // bowl, set with gems
  f.part(base, [[-10, -28], [10, -28], [10, -26.4], [-10, -26.4]], 'gold', 3.1); // rim
  if (p.fire > 0) {
    const h = 24 * p.fire, s = p.sway;
    const flame: Pt[] = [[-9, -27], [9, -27], [8, -27 - h * 0.35], [4 + s, -27 - h * 0.6], [5 + s * 1.5, -27 - h * 0.8], [1 + s * 2, -27 - h], [-1 + s, -27 - h * 0.7], [-4 + s * 1.5, -27 - h * 0.85], [-5 + s, -27 - h * 0.5], [-8, -27 - h * 0.3]];
    f.part(base, flame, 'fire', 4, { profile: 'flat' });
    f.part(base, [[-5, -27], [5, -27], [3 + s, -27 - h * 0.45], [0 + s * 1.5, -27 - h * 0.65], [-3 + s, -27 - h * 0.4]], 'glow', 4.1, { profile: 'flat', outline: false }); // white-hot heart
  }
  for (let k = 0; k < p.embers; k++) f.part(new Bone(0, 0), ell(X0 - 6 + k * 5 + p.sway, GROUND - 48 + ((k * 7) % 5), 0.9, 0.9, 6), 'fire', 5, { outline: false });
  return f;
}

const IDLE = [pose({ sway: 0, embers: 1 }), pose({ fire: 1.08, sway: 1, embers: 2 }), pose({ fire: 0.95, sway: -1, embers: 1 }), pose({ fire: 1.04, sway: 0.5, embers: 3 })];

export const sprite: SpriteDef = {
  id: 'royalFlame', w: W, h: H, anchor: [X0, GROUND], tall: 42,
  anims: {
    idle: IDLE.map((p) => [150, brazier(p)]),
    walk: IDLE.map((p) => [150, brazier(p)]), // it never moves
    attack: IDLE.map((p) => [150, brazier(p)]), // nor strikes
    hurt: [[90, brazier(pose({ fire: 0.6, sway: -2, tilt: -0.06 }))], [120, brazier(pose({ fire: 0.8, sway: -1 }))]],
    death: [
      [120, brazier(pose({ fire: 0.5, sway: -2, tilt: 0.15 }))],
      [140, brazier(pose({ fire: 0.3, sway: -3, tilt: 0.45, drop: 1 }))],
      [160, brazier(pose({ fire: 0.15, tilt: 0.7, drop: 2 }))],
      [400, brazier(pose({ fire: 0, tilt: 0.9, drop: 3 }))],
    ],
  },
  impact: 0,
};
