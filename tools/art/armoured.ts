/**
 * #158: the armoured bosses (the Black Knight, the Warden, the Usurper) share one rig and one set of moves, built on the Paladin's:
 * plate, a cape, a heater shield and a greatsword or a mace. The special is a charge down the line (a speed streak behind) or a
 * slam (the weapon high over the telegraph, then smashed into the ground). Each sprite file dresses it: materials and the helm.
 */
import { Bone, ell, Figure, ik, limb, type Material, type Pt } from './rig';
import { scaled, type Px } from './robed';
import type { SpriteDef } from './sheet';

const W = 120;
const X0 = 48; // anchor x between the feet
const cell = (c: Armoured) => ({ H: c.h ?? 100, GROUND: (c.h ?? 100) - 6 }); // GROUND: first empty row under the near foot

export interface Armoured {
  id: string;
  S: number; // size against the Paladin
  tall: number;
  plate: Material; accent: Material; trim: Material; cape: Material; blade: Material;
  fx: Material; // the special's streak, trail and burst: its damage type (STYLE.md trails)
  mace?: boolean; // a flanged mace instead of the greatsword
  special: 'charge' | 'slam';
  h?: number; // cell height, for a boss too tall for the default 100
  regal?: boolean; // the Usurper: a broad ermine-collared cloak to the ground and heavier pauldrons
  head(f: Figure, head: Bone, p: Pose): void; // helm, crest, horns, crown
}

type Foot = [x: number, lift: number, angle: number];
export interface Pose {
  hip: Pt; lean: number; head: number; cape: number; crest: number;
  feet: [far: Foot, near: Foot];
  fist: Pt; sword: number; zs: number; shield: Pt; shieldA: number;
  smear: [[Pt, number], [Pt, number]] | null; // a swing trail: (fist offset, sword angle) from, to
  streak: number; // charge: length of the speed streak behind him (0: none)
  quake: number; // slam: size of the burst on the ground (0: none)
}
const pose = (kw: Partial<Pose> = {}): Pose => ({
  hip: [0, 0], lean: 0, head: 0, cape: 0.14, crest: 0, feet: [[-5, 0, 0], [5, 0, 0]],
  fist: [7, 11.5], sword: 0.35, zs: 7.2, shield: [0, 0], shieldA: 0, smear: null, streak: 0, quake: 0, ...kw,
});

function armoured(c: Armoured, p: Pose): Figure {
  const { S } = c, { sc, E, dt } = scaled(S), { H, GROUND } = cell(c), HIP_Y = GROUND - 3 * S - 22.2 * S;
  const f = new Figure(W, H);
  const hip = new Bone(X0 + p.hip[0] * S, HIP_Y + p.hip[1] * S);
  const torso = hip.child(0, 0, p.lean);

  if (p.streak) {
    const world = new Bone(0, 0);
    const y0 = hip.y - 30, x1 = hip.x - 10;
    for (const [dy, len, th] of [[4, 1, 2], [14, 0.8, 1.5], [24, 1, 2.2], [34, 0.65, 1.5]]) {
      const x0 = x1 - p.streak * len;
      f.part(world, [[x0, y0 + dy], [x1, y0 + dy - th / 2], [x1, y0 + dy + th], [x0, y0 + dy + 0.6]], c.fx, -1, { profile: 'flat', outline: false });
    }
  }

  const cape = torso.child(-2.8 * S, -16.5 * S, p.cape - p.lean);
  if (c.regal) f.part(cape, sc([[-3, -1], [6, -1], [7.5, 12], [8.5, 29.5], [4, 28.5], [0, 30.5], [-5, 28.5], [-10, 30.5], [-15, 28], [-20, 29.5], [-19, 16], [-12, 4]]), c.cape, 0, { folds: [0.9, 4.2, 0], dim: 1, trim: ['gold', 1] });
  else f.part(cape, sc([[-1, 0], [4, 0], [4.5, 12], [5, 26], [2, 24], [0, 28], [-3, 25.5], [-6, 28.5], [-9, 25], [-12.5, 27], [-13, 17], [-8, 6]]), c.cape, 0, { folds: [0.9, 3.2, 0], dim: 1 });

  p.feet.forEach(([dx, lift, fa], i) => {
    const root = i === 0 ? hip.at(-2.8 * S, -0.5) : hip.at(2.2 * S, 0.5);
    const ankle: Pt = [X0 + dx * S, GROUND - 3 * S - lift * S - (i === 0 ? 1 : 0)];
    const knee = ik(root, ankle, 11.5 * S, 11.5 * S, 1);
    const th = limb(root, knee), sh = limb(knee, ankle);
    const z = 1 + i, dim = 1 - i;
    f.part(th, sc([[-3.8, -1.5], [3.8, -1.5], [3.1, 11.5], [-3.1, 11.5]]), c.plate, z, { dim }); // cuisse
    f.part(sh, sc([[-2.8, 0], [2.8, 0], [2.5, 11], [-2.5, 11]]), c.plate, z + 0.1, { dim }); // greave
    f.part(new Bone(ankle[0], ankle[1], fa), sc([[-2.8, -1], [2.6, -1], [5, 0.6], [6.6, 2.2], [6.6, 3], [-3, 3]]), c.plate, z + 0.15, { dim, details: [[5.6, 1.4, c.trim, 4]] }); // sabaton
    f.part(th, E(0.5, 11.3, 3.3, 2.8), c.plate, z + 0.2, { dim, details: [[1.4 * S, 11.3 * S, c.accent, 3]] }); // spiked poleyn
  });

  f.part(torso, sc([[-7.4, -3], [7.6, -3], [8.4, 7.5], [-7.8, 7.5]]), c.plate, 3.0, { mail: true }); // mail skirt
  f.part(torso, sc([[-8.6, -18], [8.2, -18], [9.4, -11], [8.2, -3], [-7.6, -3], [-9, -11]]), c.plate, 3.1, {
    details: dt([[1, -14, c.plate, 5], [1, -13, c.plate, 5], [1, -12, c.plate, 4], [-3.5, -8, c.plate, 1], [5.5, -8, c.plate, 1]]),
  }); // breastplate with a ridge
  f.part(torso, sc([[-3, -15], [4.6, -15], [3.6, -10.6], [0.8, -8.4], [-2, -10.6]]), c.accent, 3.2, { profile: 'flat' }); // chevron
  f.part(torso, sc([[-7.8, -4.6], [8.2, -4.6], [8.2, -2.1], [-7.8, -2.1]]), 'leather', 3.5); // belt
  f.part(torso, sc([[1, -5], [3.8, -5], [3.8, -1.7], [1, -1.7]]), c.trim, 3.6); // buckle
  f.part(torso, sc([[-4.2, -21], [4.8, -21], [5.4, -17], [-4.8, -17]]), c.plate, 3.7); // gorget
  const pd = c.regal ? 1.35 : 1; // pauldron size
  f.part(torso, E(-6.8, -16, 4.2 * pd, 3.6 * pd), c.plate, 3.8, { trim: [c.trim, 1], dim: 1 }); // far pauldron
  if (c.regal) f.part(torso, sc([[-10, -22.5], [10, -22.5], [11, -18.5], [6, -16.8], [0, -18], [-6, -16.8], [-11, -18.5]]), 'white', 3.75, { details: dt([[-7, -19.5, 'white', 0], [-3, -20.5, 'white', 0], [1, -19.5, 'white', 0], [5, -20.5, 'white', 0], [8.5, -19.5, 'white', 0]]) }); // ermine collar

  c.head(f, torso.child(0.8 * S, -20 * S, p.head), p);

  const shield = torso.child((-8.6 + p.shield[0]) * S, (-7 + p.shield[1]) * S, p.shieldA);
  f.part(shield, sc([[-6.4, -8], [6.4, -8], [6.6, -1], [4.6, 4], [0, 9], [-4.6, 4], [-6.6, -1]]), c.plate, 6);
  f.part(shield, sc([[-5.2, -6.8], [5.2, -6.8], [5.3, -1.2], [3.6, 3.2], [0, 7.4], [-3.6, 3.2], [-5.3, -1.2]]), c.accent, 6.1, { trim: [c.trim, 1] });
  f.part(shield, sc([[-5, -2.4], [0, 1.6], [5, -2.4], [5, 0], [0, 4.2], [-5, 0]]), c.plate, 6.2, { profile: 'flat' }); // chevron

  const sh = torso.at(5.6 * S, -15.6 * S);
  const fist: Pt = [sh[0] + p.fist[0] * S, sh[1] + p.fist[1] * S];
  const up = limb(sh, ik(sh, fist, 8 * S, 7 * S, -1));
  const fo = limb(up.at(0, 8 * S), fist);
  const za = 7, zs = p.zs;
  f.part(up, sc([[-2.7, -1], [2.7, -1], [2.4, 8], [-2.4, 8]]), c.plate, za, { mail: true });
  f.part(fo, sc([[-2.5, -0.5], [2.5, -0.5], [2.8, 6.2], [-2.8, 6.2]]), c.plate, za + 0.1);
  f.part(up, E(0, 8, 2.8, 2.4), c.plate, za + 0.2);
  const sw = new Bone(fist[0], fist[1], p.sword);
  f.part(sw, sc([[-1, -2], [1, -2], [1, 4.5], [-1, 4.5]]), 'leather', zs); // long grip
  f.part(sw, E(0, 5.4, 1.6, 1.5), c.plate, zs + 0.1); // pommel
  f.part(sw, sc([[-5, -3.2], [5, -3.2], [5.4, -1.8], [-5.4, -1.8]]), c.plate, zs + 0.1); // crossguard
  if (c.mace) {
    f.part(sw, sc([[-1, -3], [1, -3], [1, -18], [-1, -18]]), 'leather', zs + 0.05); // haft
    f.part(sw, sc([[-4, -17], [4, -17], [4.6, -21], [3.2, -25], [0, -26.4], [-3.2, -25], [-4.6, -21]]), c.blade, zs + 0.06, { details: dt([[-2.6, -21, c.blade, 1], [0, -21, c.blade, 1], [2.6, -21, c.blade, 1]]) }); // flanged head
  } else f.part(sw, sc([[-2.2, -3], [2.2, -3], [2, -24], [0, -28.5], [-2, -24]]), c.blade, zs + 0.05, { details: Array.from({ length: 18 }, (_, k) => [0.1, -(k + 4) * S - 0.5, c.blade, 2] as Px) }); // greatsword
  f.part(sw, E(0.3, 0.6, 3, 2.9), c.plate, za + 0.4, { details: [-0.6, 0.6, 1.8].map((y) => [1.8 * S, y * S, c.plate, 1] as Px) }); // gauntlet
  f.part(new Bone(sh[0], sh[1], torso.a * 0.65 + up.a * 0.35), E(0.5, 0.2, 5 * pd, 4.2 * pd), c.plate, za + 0.5, { trim: [c.trim, 1] }); // pauldron

  if (p.smear) {
    const [[f0, a0], [f1, a1]] = p.smear;
    const outer: Pt[] = [], inner: Pt[] = [];
    for (let k = 0; k < 13; k++) {
      const s = k / 12;
      const fx = sh[0] + (f0[0] + (f1[0] - f0[0]) * s) * S, fy = sh[1] + (f0[1] + (f1[1] - f0[1]) * s) * S;
      const a = a0 + (a1 - a0) * s;
      const d = [Math.sin(a), -Math.cos(a)];
      outer.push([fx + 28 * S * d[0], fy + 28 * S * d[1]]);
      inner.push([fx + (25 - 11 * s ** 1.5) * S * d[0], fy + (25 - 11 * s ** 1.5) * S * d[1]]);
    }
    f.part(new Bone(0, 0), [...outer, ...inner.reverse()], c.fx, zs - 0.3, { profile: 'flat', outline: false }); // the swing trail
  }
  if (p.quake) {
    const cx = sw.at(0, -24 * S)[0], q = p.quake; // under the weapon's head
    const world = new Bone(0, 0);
    f.part(world, ell(cx, GROUND - 1, q, q * 0.28, 28), c.fx, -2, { profile: 'flat', outline: false });
    for (const [dx, h] of [[-0.8, 6], [-0.35, 10], [0.3, 9], [0.75, 5]])
      f.part(world, [[cx + dx * q - 2, GROUND - 1], [cx + dx * q + 2, GROUND - 1], [cx + dx * q * 1.1 + 1, GROUND - 1 - h * S], [cx + dx * q * 1.1 - 1, GROUND - 1 - h * S]], 'darksteel', 8, { dim: 1 }); // flung stone
  }
  return f;
}

function foot(ph: number, St = 6): Foot {
  ph = ((ph % 1) + 1) % 1;
  if (ph < 0.5) {
    const s = ph / 0.5;
    const heel = Math.max(0, (s - 0.7) / 0.3);
    return [St - 2 * St * s, 1.5 * heel, 0.3 * heel];
  }
  const s = (ph - 0.5) / 0.5;
  return [-St + 2 * St * (0.5 - 0.5 * Math.cos(Math.PI * s)), 3.5 * Math.sin(Math.PI * s) + 2 * (1 - s) ** 2, 0.35 * (1 - s) - 0.15 * s];
}

const IDLE = ([[0, 0, 0], [1, 0.03, 0.06], [1, 0.05, 0.1], [0, 0.02, 0.04]] as const).map(([dy, c, cr]) => pose({ hip: [0, dy], cape: 0.14 + c, crest: cr }));
const WALK = Array.from({ length: 8 }, (_, i) => {
  const ph = i / 8, swing = Math.cos(2 * Math.PI * ph);
  return pose({
    hip: [0, [0, 1, 0, -1][i % 4]], lean: 0.08, feet: [foot(ph + 0.5), foot(ph)],
    cape: 0.3 + 0.06 * Math.sin(2 * Math.PI * ph), crest: 0.12 + 0.06 * Math.sin(2 * Math.PI * ph + 1),
    fist: [7 - 1.5 * swing, 11.5 - 0.6 * Math.abs(swing)], shield: [1.2 * swing, 0],
  });
});
// his touch: a heavy overhead chop
const ATTACK: [number, Pose][] = [
  [250, pose()],
  [100, pose({ hip: [-1, 0], lean: -0.1, fist: [5, -8], sword: -0.3, zs: 4.6, shield: [1, -1] })],
  [120, pose({ hip: [-1, -1], lean: -0.16, fist: [3, -12.5], sword: -0.9, zs: 4.6, shield: [1.5, -1], crest: 0.15, cape: 0.2 })],
  [60, pose({ hip: [1, 0], lean: 0.06, fist: [11, -5], sword: 0.9, smear: [[[3, -12.5], -0.9], [[11, -5], 0.9]], feet: [[-5, 0, 0], [8, 1.5, -0.1]], cape: 0.24 })],
  [180, pose({ hip: [2, 1], lean: 0.2, fist: [12, 5], sword: 2.1, smear: [[[11, -5], 0.9], [[12, 5], 2.1]], feet: [[-6, 1, 0.3], [10, 0, 0]], shield: [-1.5, 0], cape: 0.32, crest: 0.2 })],
  [130, pose({ hip: [1, 0], lean: 0.08, fist: [9, 10], sword: 1.4, feet: [[-6, 0, 0], [9, 0, 0]], cape: 0.2 })],
];
// charge: brace, crouch, coil (held to the end of the telegraph) | burst down the line, sword levelled (impact), skid to a stop
const CHARGE: [number, Pose][] = [
  [200, pose({ hip: [-1, 1], lean: -0.08, fist: [2, 12], sword: -1.9, zs: 2.5, shield: [3, -1], feet: [[-7, 0, 0], [6, 0, 0]], crest: 0.1 })],
  [250, pose({ hip: [-2, 3], lean: 0.12, head: -0.1, fist: [-2, 11], sword: -2.2, zs: 2.5, shield: [4, -1], feet: [[-9, 0, 0.2], [7, 0, 0]], cape: 0.3 })],
  [300, pose({ hip: [-2, 4], lean: 0.26, head: -0.2, fist: [-4, 9], sword: -2.4, zs: 2.5, shield: [5, 0], feet: [[-10, 1, 0.4], [8, 0, 0]], cape: 0.45, crest: 0.25 })],
  [450, pose({ hip: [4, 2], lean: 0.42, head: -0.3, fist: [12, 1], sword: 1.57, shield: [4, 1], feet: [[-9, 2, 0.5], [11, 1, -0.1]], cape: 0.95, crest: 0.6, streak: 34 })],
  [300, pose({ hip: [3, 1], lean: 0.3, head: -0.2, fist: [12, 3], sword: 1.6, shield: [3, 1], feet: [[-8, 0, 0.3], [11, 0, 0]], cape: 0.7, crest: 0.45, streak: 16 })],
  [250, pose({ hip: [1, 1], lean: 0.1, fist: [9, 9], sword: 1.1, feet: [[-6, 0, 0], [8, 0, 0]], cape: 0.3, crest: 0.2 })],
];
// slam: weapon high, rising on the toes (held to the end of the telegraph) | smash it into the ground ahead, the stone bursts
const SLAM: [number, Pose][] = [
  [220, pose({ hip: [-1, 1], lean: -0.05, fist: [4, 2], sword: -0.6, zs: 4.6, shield: [2, -1] })],
  [260, pose({ hip: [-1.5, -1], lean: -0.14, head: -0.15, fist: [2, -11], sword: -1.1, zs: 4.6, shield: [2, -2], cape: 0.2, crest: 0.15 })],
  [320, pose({ hip: [-2, -2.5], lean: -0.22, head: -0.25, fist: [0, -13], sword: -1.9, zs: 4.6, shield: [2.5, -2], cape: 0.26, crest: 0.25, feet: [[-7, 1.5, 0.4], [6, 1.5, 0.3]] })],
  [180, pose({ hip: [2, 4], lean: 0.38, head: 0.1, fist: [9, 10], sword: 2.6, smear: [[[0, -13], -1.9], [[9, 10], 2.6]], shield: [0, 1], feet: [[-8, 0, 0], [9, 0, 0]], cape: 0.1, quake: 18 })],
  [330, pose({ hip: [2, 4], lean: 0.36, fist: [9, 10], sword: 2.65, shield: [0, 1], feet: [[-8, 0, 0], [9, 0, 0]], quake: 26 })],
  [260, pose({ hip: [1, 1], lean: 0.12, fist: [9, 10], sword: 1.3, feet: [[-6, 0, 0], [8, 0, 0]] })],
];
const HURT: [number, Pose][] = [
  [100, pose({ hip: [-2, 1], lean: -0.2, head: -0.2, cape: 0.04, crest: -0.15, fist: [4, 9], sword: 0.1, shield: [2, -1], feet: [[-6, 0, 0], [4, 0, 0]] })],
  [150, pose({ hip: [-1, 1], lean: -0.1, head: -0.1, cape: 0.08, crest: -0.05, fist: [5, 10], sword: 0.2, shield: [1, 0], feet: [[-6, 0, 0], [4, 0, 0]] })],
];
// he drops to a knee on his sword, then pitches forward
const DEATH: [number, Pose][] = [
  [150, pose({ hip: [-1, 2], lean: -0.15, head: -0.15, fist: [6, 11], sword: 0.5, feet: [[-6, 0, 0], [5, 0, 0]] })],
  [200, pose({ hip: [0, 8], lean: 0.1, head: 0.2, fist: [10, 12], sword: 0.1, shield: [1, 2], cape: 0.2, feet: [[-7, 0, 0.6], [6, 0, 0]] })],
  [300, pose({ hip: [0, 10], lean: 0.3, head: 0.35, fist: [10, 11], sword: 0.05, shield: [1, 3], cape: 0.25, crest: 0.2, feet: [[-8, 0, 0.9], [6, 0, 0]] })],
  [160, pose({ hip: [3, 14], lean: 0.9, head: 0.3, fist: [12, 12], sword: 1.2, shield: [1, 4], shieldA: 0.5, cape: 0.8, crest: 0.4, feet: [[-7, 0, 1], [8, 0, 0.3]] })],
  [400, pose({ hip: [6, 17], lean: 1.4, head: 0.2, fist: [14, 8], sword: 2.2, shield: [0, 4], shieldA: 1.1, cape: 1.4, crest: 0.6, feet: [[-4, 0, 1.2], [10, 0, 0.5]] })],
];

/** An armoured boss's sheet: the Black Knight's rig and moves, dressed by `c`. */
export function armouredSprite(c: Armoured): SpriteDef {
  const fig = (p: Pose) => armoured(c, p), { H, GROUND } = cell(c);
  return {
    id: c.id, w: W, h: H, anchor: [X0, GROUND], tall: c.tall,
    anims: {
      idle: IDLE.map((p) => [200, fig(p)]),
      walk: WALK.map((p) => [110, fig(p)]),
      attack: ATTACK.map(([ms, p]) => [ms, fig(p)]),
      hurt: HURT.map(([ms, p]) => [ms, fig(p)]),
      death: DEATH.map(([ms, p]) => [ms, fig(p)]),
      special: (c.special === 'charge' ? CHARGE : SLAM).map(([ms, p]) => [ms, fig(p)]),
    },
    impact: 4,
    specialImpact: 3,
  };
}
