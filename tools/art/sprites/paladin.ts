/**
 * The Paladin, redesigned (the look only: his abilities, stats and balance stay as they are). Polished silver-white
 * plate with gold rims, the sun of the dawn on his tabard, a royal-blue cape, a radiant holy sword; cape and tabard move as cloth;
 * the sword arm (his far arm in this three-quarter view) stays behind his body unless he swings; hurt is a shield block; the cast
 * (Divine Shield) blazes the blade; the skill (Challenge) rings the blade on the shield.
 */
import { Bone, ell, Figure, ik, limb, type Material, type Pt } from '../rig';
import type { SpriteDef } from '../sheet';

const W = 92, H = 80;
const GROUND = 75; // first empty row under the near foot
const X0 = 40; // anchor x between the feet
const HIP_Y = GROUND - 3 - 22.2; // legs are 23 long: a slight knee bend at rest

type Foot = [x: number, lift: number, angle: number];
interface Pose {
  hip: Pt; lean: number; head: number; cape: number; plume: number; skirt: number;
  wave: number; flap: number; // the cloth's ripple: its phase (0..1) and size in pixels
  holy: number; // the strength or progress of the light effect below (0..1)
  fx: 'burst' | 'spark' | 'clash' | null; // light drawn with the pose: the cast's burst, the block's sparks, the skill's clash and rings
  shine: number; // the blade blazing with light on the cast (0..1)
  feet: [far: Foot, near: Foot];
  fist: Pt; sword: number; za: number; zs: number; shield: Pt; shieldA: number;
  smear: [[Pt, number], [Pt, number]] | null; // swing trail: (fist offset, sword angle) from, to
}
const pose = (kw: Partial<Pose> = {}): Pose => ({
  hip: [0, 0], lean: 0, head: 0, cape: 0.12, plume: 0, skirt: 0, wave: 0, flap: 0, holy: 0, fx: null, shine: 0, feet: [[-4, 0, 0], [4, 0, 0]],
  fist: [7, 11.5], sword: 0.3, za: 2.2, zs: 2.5, shield: [0, 0], shieldA: 0, smear: null, ...kw, // the sword arm is his far one in this three-quarter view: behind his body, unless he swings
});

function paladin(p: Pose): Figure {
  const f = new Figure(W, H);
  const ARM = 'plate'; // the armour: polished silver-white
  const CAPE = 'blue'; // a royal-blue cape, gold-hemmed
  const hip = new Bone(X0 + p.hip[0], HIP_Y + p.hip[1]);
  const torso = hip.child(0, 0, p.lean);

  // the cape hangs from the collar by its own weight, whatever his torso does: `cape` swings it back (its lower part further
  // than its top, so it bends), a ripple runs down it and along the hem, and what reaches the ground lies on it, sliding
  // out behind him. `k` numbers the hem points, so the ripple runs along the hem too
  const collar = torso.at(-2.5, -16.5);
  const cloth = ([x, y]: Pt, k = 0): Pt => {
    const t = Math.max(0, y) / 28;
    const r = Math.sin(2 * Math.PI * p.wave - t * 3 - k * 1.2) * p.flap * t;
    const a = p.cape * (0.55 + 0.8 * t);
    let wx = collar[0] + (x + r) * Math.cos(a) - y * Math.sin(a), wy = collar[1] + (x + r) * Math.sin(a) + y * Math.cos(a) + r * 0.4 * (k > 0 ? 1 : 0);
    const g = GROUND - 1.5;
    if (wy > g) { const o = wy - g; wx -= o * 0.6; wy = g - o * 0.55; } // on the ground: it spreads out behind him, seen a little from above
    return [wx, wy];
  };
  const capeFold = (x0: number, x1: number): [number, number, Material, number][] =>
    Array.from({ length: 24 }, (_, i) => { const y = 5 + i; const [fx, fy] = cloth([x0 + ((x1 - x0) * i) / 23, y]); return [fx, fy, CAPE, 1]; });
  f.part(new Bone(0, 0), ([[-1, 0], [4, 0], [4.5, 12], [5, 26]] as Pt[]).map((q) => cloth(q))
    .concat(([[0, 27.5, 1], [-6, 28, 2], [-12, 26.5, 3]] as const).map(([x, y, k]) => cloth([x, y], k)))
    .concat(([[-12.5, 17], [-8, 6]] as Pt[]).map((q) => cloth(q))), CAPE, 0, {
    details: [...capeFold(-7.5, -9.5), ...capeFold(-4, -5), ...capeFold(-0.5, -0.8), ...capeFold(2.4, 2.6)], // the folds, running down with the cloth
  });

  const HEM = [[5, 26, 0], [0, 27.5, 1], [-6, 28, 2], [-12, 26.5, 3]] as const; // the gold hem, a band along the bottom edge
  f.part(new Bone(0, 0), [...HEM.map(([x, y, k]) => cloth([x, y], k)), ...[...HEM].reverse().map(([x, y, k]) => cloth([x, y - 1.6], k))], 'gold', 0.05, { outline: false });

  p.feet.forEach(([dx, lift, fa], i) => {
    const root = i === 0 ? hip.at(-2.5, -0.5) : hip.at(2, 0.5);
    const ankle: Pt = [X0 + dx, GROUND - 3 - lift - (i === 0 ? 1 : 0)]; // the far foot stands a row higher
    const knee = ik(root, ankle, 11.5, 11.5, 1);
    const th = limb(root, knee), sh = limb(knee, ankle);
    const z = 1 + i, dim = 1 - i; // the far leg is a tone darker
    f.part(th, [[-3.4, -1.5], [3.4, -1.5], [2.8, 11.5], [-2.8, 11.5]], ARM, z, { dim }); // cuisse
    f.part(sh, [[-2.5, 0], [2.5, 0], [2.2, 11], [-2.2, 11]], ARM, z + 0.1, { dim }); // greave
    f.part(new Bone(ankle[0], ankle[1], fa), [[-2.6, -1], [2.4, -1], [4.6, 0.6], [6, 2.2], [6, 3], [-2.8, 3]], ARM, z + 0.15, { dim: dim + 1 }); // sabaton
    f.part(th, ell(0.5, 11.3, 3.0, 2.6), ARM, z + 0.2, { dim, trim: ['gold', 1.1] }); // poleyn, gold-rimmed
    f.part(sh, [[-2.6, 2.4], [2.6, 2.4], [2.5, 3.6], [-2.5, 3.6]], 'gold', z + 0.12, { dim }); // a gold band round the greave
  });

  f.part(torso, [[-6.6, -3], [6.8, -3], [7.6, 7], [-7, 7]], ARM, 3.0, { mail: true }); // mail skirt
  f.part(torso, [[-7.6, -17.5], [7.2, -17.5], [8.2, -11], [7.2, -3], [-6.8, -3], [-8, -11]], ARM, 3.1); // breastplate
  f.part(torso, [[-4.8, -16], [5.6, -16], [6, -3], [-5.2, -3]], 'white', 3.2, { profile: 'flat', folds: [0.5, 3, 0], trim: ['gold', 1.1] }); // tabard, gold-edged
  // the sun of the dawn on his chest, as on his shield: a gold disc with a bright heart and eight rays
  const sun = torso.child(1.5, -10, 0);
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4, [c, n] = [Math.cos(a), Math.sin(a)], L = k % 2 ? 4.2 : 5.2;
    f.part(sun, [[c * 2 - n * 0.9, n * 2 + c * 0.9], [c * L, n * L], [c * 2 + n * 0.9, n * 2 - c * 0.9]], 'gold', 3.3, { profile: 'flat', outline: false });
  }
  f.part(sun, ell(0, 0, 2.4, 2.4), 'gold', 3.31, { details: [[-0.5, -0.5, 'gold', 6], [0.5, -0.5, 'gold', 5]] });
  // the tabard's skirt: cloth, so it hangs half towards the ground as he leans or falls, swings with `skirt`, and ripples
  const skirt = torso.child(0.3, -3, p.skirt - p.lean * 0.5 + Math.sin(2 * Math.PI * p.wave + 1) * p.flap * 0.03);
  f.part(skirt, [[-4.6, 0], [5.4, 0], [6, 10], [1.2, 10.5], [0.6, 6.5], [-0.2, 10.5], [-5, 10]], 'white', 3.4, { profile: 'flat', folds: [0.35, 3.4, 0] }); // tabard skirt
  f.part(skirt, [[-5, 8.7], [-0.1, 9.1], [-0.2, 10.5], [-5, 10]], 'gold', 3.45, { profile: 'flat' }); // gold hem
  f.part(skirt, [[1.1, 9.1], [5.9, 8.7], [6, 10], [1.2, 10.5]], 'gold', 3.45, { profile: 'flat' });
  f.part(torso, [[-7.2, -4.4], [7.5, -4.4], [7.5, -2.1], [-7.2, -2.1]], 'leather', 3.5); // belt
  f.part(torso, [[1, -4.8], [3.6, -4.8], [3.6, -1.7], [1, -1.7]], 'gold', 3.6); // buckle
  f.part(torso, [[-3.8, -20], [4.3, -20], [4.9, -16.5], [-4.3, -16.5]], ARM, 3.7, { trim: ['gold', 1.1] }); // gorget, gold-rimmed
  f.part(torso, ell(-6.2, -15.4, 3.6, 3.1), ARM, 3.8, { trim: ['gold', 1], dim: 1 }); // far pauldron

  const head = torso.child(0.8, -19, p.head);
  const eye: [number, number, Material, number][] = [-4, -3, -2, -1, 0, 3, 4, 4.6].flatMap((x) => [[x + 0.5, -4, ARM, 0]] as [number, number, Material, number][]); // the eye slit
  const holes: [number, number, Material, number][] = [[4.6, -1.5, ARM, 1], [4.6, 0, ARM, 1], [3.7, -0.8, ARM, 1]];
  f.part(head, [[-4.7, 0.5], [-5.1, -5], [-4.4, -8.9], [-1.7, -10.4], [2.2, -10.4], [4.8, -9], [5.6, -5], [5.4, 0.5], [2.6, 1.5], [-2.6, 1.3]], ARM, 5, { details: [...eye, ...holes] }); // great helm
  f.part(head, [[-4.8, -6.9], [5.5, -6.9], [5.5, -5.6], [-4.9, -5.6]], 'gold', 5.1); // brow band
  f.part(head, [[1.8, -5.8], [3.0, -5.8], [3.0, 1.2], [1.8, 1.2]], 'gold', 5.1); // nose strip
  f.part(head.child(-0.4, -10.2, p.plume), [[1.3, 0.4], [0.9, -2.1], [-1.7, -3.4], [-5.1, -3.2], [-8.1, -1.7], [-9.8, 0.9], [-9.4, 3.4], [-7.7, 1.7], [-5.1, 0.4], [-2.6, 0.9]], 'blue', 4.9, { folds: [0.6, 2.2, 1] }); // plume

  const shield = torso.child(-10 + p.shield[0], -5.5 + p.shield[1], p.shieldA);
  const K = 1.4; // a full kite shield, not a buckler
  const sc = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [x * K, y * K]);
  f.part(shield, sc([[-5.8, -7.4], [5.8, -7.4], [6.1, -1], [4.3, 3.6], [0, 8], [-4.3, 3.6], [-6.1, -1]]), ARM, 6);
  const rays = Array.from({ length: 8 }, (_, k) => [K * 3.9 * Math.cos((k * Math.PI) / 4), K * (-0.5 + 3.9 * Math.sin((k * Math.PI) / 4)), 'gold', 4] as [number, number, 'gold', number]);
  f.part(shield, sc([[-4.6, -6.2], [4.6, -6.2], [4.8, -1.2], [3.3, 2.8], [0, 6.4], [-3.3, 2.8], [-4.8, -1.2]]), 'blue', 6.1, { details: rays, trim: ['gold', 1] });
  f.part(shield, ell(0, -0.5 * K, 2.3 * K, 2.3 * K), 'gold', 6.2); // sun

  const sh = torso.at(5.2, -15.2);
  const fist: Pt = [sh[0] + p.fist[0], sh[1] + p.fist[1]];
  const up = limb(sh, ik(sh, fist, 8, 7, -1));
  const fo = limb(up.at(0, 8), fist);
  const { za, zs } = p;
  f.part(up, [[-2.4, -1], [2.4, -1], [2.1, 8], [-2.1, 8]], ARM, za, { mail: true }); // mail sleeve
  f.part(fo, [[-2.2, -0.5], [2.2, -0.5], [2.5, 6.2], [-2.5, 6.2]], ARM, za + 0.1); // vambrace
  f.part(up, ell(0, 8, 2.5, 2.2), ARM, za + 0.2); // couter
  const sw = new Bone(fist[0], fist[1], p.sword);
  f.part(sw, [[-0.9, -2], [0.9, -2], [0.9, 3.5], [-0.9, 3.5]], 'leather', zs); // grip
  f.part(sw, ell(0, 4.4, 1.5, 1.4), 'gold', zs + 0.1); // pommel
  f.part(sw, [[-4.2, -3], [4.2, -3], [4.5, -1.8], [-4.5, -1.8]], 'gold', zs + 0.1); // crossguard
  // a holy blade: the fuller burns white-gold, a soft golden radiance hugs the steel, and glints of light run up it and
  // twinkle at the point (their place follows the pose, so they move from frame to frame)
  if (p.shine > 0) { // on the cast the blade blazes: a wide halo of light round it, the steel itself turned to light
    const g = 1.2 * p.shine;
    f.part(sw, [[-3.1 - g, -3.4], [3.1 + g, -3.4], [3 + g, -19.4], [0, -26 - g * 2], [-3 - g, -19.4]], 'glow', zs - 0.03, { profile: 'flat', outline: false });
  }
  f.part(sw, [[-3.1, -3.4], [3.1, -3.4], [3, -19.4], [0, -26], [-3, -19.4]], p.shine > 0.4 ? 'blaze' : 'glow', zs - 0.02, { profile: 'flat', outline: false, dim: p.shine > 0.4 ? 0 : 1 });
  f.part(sw, [[-1.9, -2.8], [1.9, -2.8], [1.8, -19], [0, -23], [-1.8, -19]], p.shine > 0.6 ? 'blaze' : ARM, zs + 0.05, { details: Array.from({ length: 16 }, (_, k) => [0.1, -(k + 3) - 0.5, 'glow', k > 13 ? 5 : 6]) }); // blade + fuller (white-hot as it blazes)
  const ph = (((p.wave * 1.7 + p.sword * 0.37 + p.fist[1] * 0.13) % 1) + 1) % 1;
  const glint = (x: number, y: number, r: number) => f.part(sw, [[x - 0.5, y - r], [x + 0.5, y - r], [x + 0.5, y - 0.5], [x + r, y - 0.5], [x + r, y + 0.5], [x + 0.5, y + 0.5], [x + 0.5, y + r], [x - 0.5, y + r], [x - 0.5, y + 0.5], [x - r, y + 0.5], [x - r, y - 0.5], [x - 0.5, y - 0.5]], 'glow', zs + 0.2, { profile: 'flat', outline: false, details: [[x, y, 'glow', 6]] });
  glint(ph < 0.5 ? 1.4 : -1.4, -6 - ph * 13, 1.6); // a glint running up the edge
  glint(0, -24.5, ph < 0.5 ? 2.1 : 1.5); // the twinkle at the point
  f.part(sw, ell(0.3, 0.6, 2.7, 2.6), ARM, za + 0.4, { trim: ['gold', 1.1], details: [-0.6, 0.6, 1.8].map((y) => [1.6, y, ARM, 1]) }); // gauntlet, gold-cuffed
  f.part(new Bone(sh[0], sh[1], torso.a * 0.65 + up.a * 0.35), ell(0.5, 0.2, 4.4, 3.7), ARM, za + 0.5, { trim: ['gold', 1] }); // pauldron

  if (p.smear) {
    const [[f0, a0], [f1, a1]] = p.smear;
    const outer: Pt[] = [], inner: Pt[] = [], edge: Pt[] = [];
    for (let k = 0; k < 13; k++) {
      const s = k / 12;
      const fx = sh[0] + f0[0] + (f1[0] - f0[0]) * s, fy = sh[1] + f0[1] + (f1[1] - f0[1]) * s;
      const a = a0 + (a1 - a0) * s;
      const d = [Math.sin(a), -Math.cos(a)];
      const rIn = 21 - 10 * s ** 1.5;
      outer.push([fx + 23.5 * d[0], fy + 23.5 * d[1]]);
      inner.push([fx + rIn * d[0], fy + rIn * d[1]]);
      edge.push([fx + (23.5 - 2.5 * s) * d[0], fy + (23.5 - 2.5 * s) * d[1]]);
    }
    const world = new Bone(0, 0);
    f.part(world, [...outer, ...inner.reverse()], 'glow', zs - 0.3, { profile: 'flat', outline: false }); // the golden trail
    f.part(world, [...outer, ...edge.reverse()], 'smear', zs - 0.25, { profile: 'flat', outline: false });
  }
  if (p.fx) holyLight(f, p, torso, fist, shield);
  return f;
}

// the light of his abilities and his block: flat glow shapes, drawn over or around him
function holyLight(f: Figure, p: Pose, torso: Bone, fist: Pt, shield: Bone): void {
  const world = new Bone(0, 0);
  // a mote: a little cross of light with a white-hot heart
  const mote = (x: number, y: number, r: number, tone: number, z = 8) => {
    const q = r + 0.6;
    f.part(world, [[x - 0.6, y - q], [x + 0.6, y - q], [x + 0.6, y - 0.6], [x + q, y - 0.6], [x + q, y + 0.6], [x + 0.6, y + 0.6], [x + 0.6, y + q], [x - 0.6, y + q], [x - 0.6, y + 0.6], [x - q, y + 0.6], [x - q, y - 0.6], [x - 0.6, y - 0.6]], 'glow', z, { profile: 'flat', outline: false, details: [[x, y, 'glow', tone]] });
  };
  if (p.fx === 'burst') { // light bursting from the raised blade: rays round its tip and a halo of light about him
    const [tx, ty] = [fist[0], fist[1] - 22];
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4 + 0.2, L = (k % 2 ? 4 : 7) * p.holy;
      f.part(world, [[tx + Math.cos(a + 0.2) * 1.2, ty + Math.sin(a + 0.2) * 1.2], [tx + Math.cos(a) * L, ty + Math.sin(a) * L], [tx + Math.cos(a - 0.2) * 1.2, ty + Math.sin(a - 0.2) * 1.2]], 'glow', 8.1, { profile: 'flat', outline: false });
    }
    mote(tx, ty, 2 * p.holy + 0.5, 6, 8.2);
    const [hx, hy] = torso.at(0, -10); // and a sunburst of light behind him, as on his shield
    for (let k = 0; k < 16; k++) {
      const a = (k * Math.PI) / 8 + 0.1, r0 = 11 * p.holy, r1 = (k % 2 ? 17 : 23) * p.holy, [c, n] = [Math.cos(a), Math.sin(a)];
      f.part(world, [[hx + c * r0 - n * 1.6, hy + n * r0 + c * 1.6], [hx + c * r1, hy + n * r1], [hx + c * r0 + n * 1.6, hy + n * r0 - c * 1.6]], 'glow', -0.5, { profile: 'flat', outline: false, dim: k % 2 });
    }
  }
  if (p.fx === 'spark') { // holy sparks where the blow lands on the shield
    const [sx, sy] = shield.at(7.5, -5); // on the shield's front edge, where the blow lands, flying back at the attacker
    for (let k = 0; k < 7; k++) {
      const a = -1.35 + k * 0.45, L = (k % 2 ? 4.5 : 8) * p.holy;
      f.part(world, [[sx - Math.sin(a) * 1.1, sy + Math.cos(a) * 1.1], [sx + Math.cos(a) * L, sy + Math.sin(a) * L], [sx + Math.sin(a) * 1.1, sy - Math.cos(a) * 1.1]], 'glow', 8.1, { profile: 'flat' });
    }
    mote(sx, sy, 1.8 * p.holy, 6, 8.2);
  }
  if (p.fx === 'clash') { // Challenge: the blade rung on the shield, rings of sound going out at the enemies
    const [sx, sy] = [fist[0] + Math.sin(p.sword) * 7, fist[1] - Math.cos(p.sword) * 7]; // where the blade meets the shield
    // `holy` runs 0..1 over the ring's life: the flash where the blade strikes is biggest at once and gone by the middle;
    // two rings of light go out round him, one after the other, fading as they widen (the call reaching every enemy near)
    const flash = Math.max(0, 1 - p.holy * 1.6);
    if (flash > 0) {
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4 + 0.3, L = (k % 2 ? 3.5 : 7) * flash + 1;
        f.part(world, [[sx - Math.sin(a) * 0.9, sy + Math.cos(a) * 0.9], [sx + Math.cos(a) * L, sy + Math.sin(a) * L], [sx + Math.sin(a) * 0.9, sy - Math.cos(a) * 0.9]], 'glow', 8.1, { profile: 'flat' });
      }
      mote(sx, sy, 1.9 * flash, 6, 8.2);
    }
    const [cx, cy] = torso.at(0, -6);
    for (const lag of [0, 0.35]) {
      const t = p.holy - lag; if (t <= 0) continue;
      const r = 13 + 26 * t, th = 1.5, N = 40;
      for (let k = 0; k < N; k++) {
        const a0 = (k / N) * 2 * Math.PI, a1 = ((k + 1) / N) * 2 * Math.PI;
        const pt = (a: number, rr: number): Pt => [cx + Math.cos(a) * rr * 1.15, cy + Math.sin(a) * rr * 0.95];
        if (pt(a0, r)[1] > GROUND - 1 || pt(a1, r)[1] > GROUND - 1) continue; // not below the ground
        f.part(world, [pt(a0, r), pt(a1, r), pt(a1, r - th), pt(a0, r - th)], 'glow', Math.sin((a0 + a1) / 2) > 0.2 ? 8 : -0.4, { profile: 'flat', outline: false, dim: t < 0.45 ? 0 : t < 0.8 ? 1 : 2 });
      }
    }
  }
}

/** Walk-cycle foot: stance slides back from +S to -S, swing arcs forward. */
function foot(ph: number, S = 6.5): Foot {
  ph = ((ph % 1) + 1) % 1;
  if (ph < 0.5) {
    const s = ph / 0.5;
    const heel = Math.max(0, (s - 0.7) / 0.3);
    return [S - 2 * S * s, 1.5 * heel, 0.3 * heel];
  }
  const s = (ph - 0.5) / 0.5;
  return [-S + 2 * S * (0.5 - 0.5 * Math.cos(Math.PI * s)), 4 * Math.sin(Math.PI * s) + 2 * (1 - s) ** 2, 0.35 * (1 - s) - 0.15 * s];
}

const IDLE = ([[0, 0, 0], [1, 0.03, 0.06], [1, 0.05, 0.1], [0, 0.02, 0.04]] as const).map(([dy, c, pl]) => pose({ hip: [0, dy], cape: 0.12 + c, plume: pl }));
IDLE.forEach((q, i) => Object.assign(q, { wave: i / 4, flap: 0.8, skirt: 0.02 * Math.sin((2 * Math.PI * i) / 4) })); // a breeze in the cape
const WALK = Array.from({ length: 8 }, (_, i) => {
  const ph = i / 8, swing = Math.cos(2 * Math.PI * ph);
  return pose({
    hip: [0, [0, 1, 0, -1][i % 4]], lean: 0.06, feet: [foot(ph + 0.5), foot(ph)],
    cape: 0.3 + 0.06 * Math.sin(2 * Math.PI * ph), plume: 0.12 + 0.06 * Math.sin(2 * Math.PI * ph + 1),
    fist: [7 - 1.5 * swing, 11.5 - 0.6 * Math.abs(swing)], shield: [1.2 * swing, 0], skirt: 0.1 * Math.cos(2 * Math.PI * ph - 0.8), wave: 2 * ph, flap: 1.2, // the tabard swings a beat behind his stride
  });
});
// ready, wind-up, peak, swing with its golden trail, impact (held longest), recovery
const ATTACK: [number, Pose][] = [
  [250, pose({ flap: 0.6 })],
  [90, pose({ hip: [-1, 0], lean: -0.1, fist: [5, -8], sword: -0.3, zs: 4.6, shield: [1, -1], plume: 0.08, cape: 0.04, wave: 0.15, flap: 0.8 })],
  [110, pose({ hip: [-1, -1], lean: -0.14, fist: [3, -12.5], sword: -0.9, zs: 4.6, shield: [1.5, -1], plume: 0.15, cape: 0.02, wave: 0.3, flap: 0.8 })],
  [60, pose({ hip: [1, 0], lean: 0.06, fist: [11, -5], sword: 0.9, za: 7, zs: 7.2, smear: [[[3, -12.5], -0.9], [[11, -5], 0.9]], feet: [[-4, 0, 0], [7, 1.5, -0.1]], cape: 0.35, skirt: 0.15, wave: 0.45, flap: 1.2 })],
  [170, pose({ hip: [2, 1], lean: 0.18, fist: [12, 5], sword: 2.1, za: 7, zs: 7.2, smear: [[[11, -5], 0.9], [[12, 5], 2.1]], feet: [[-5, 1, 0.3], [9, 0, 0]], shield: [-1.5, 0], cape: 0.45, plume: 0.2, skirt: 0.12, wave: 0.6, flap: 1.4 })],
  [120, pose({ hip: [1, 0], lean: 0.08, fist: [9, 10], sword: 1.4, za: 7, zs: 7.2, feet: [[-5, 0, 0], [8, 0, 0]], cape: 0.22, skirt: -0.05, wave: 0.8, flap: 1 })],
];
// #156: Divine Shield: the sword raised straight up, the shield braced, light bursting from the blade, then lowered; the
// blade itself blazes (`shine`) from the moment it goes up until it comes back down, about a second
const CAST: [number, Pose][] = [
  [110, pose({ hip: [0, 1], fist: [4, 6], sword: -0.1, shield: [0.5, 0] })],
  [140, pose({ hip: [0, -1], lean: -0.08, head: -0.12, fist: [3, -6], sword: -0.05, zs: 4.6, shield: [1, -1], plume: 0.12, cape: 0.2, fx: 'burst', holy: 0.6, shine: 0.7 })],
  [520, pose({ hip: [0, -1], lean: -0.1, head: -0.15, fist: [3, -7], sword: 0, zs: 4.6, shield: [1, -1], plume: 0.16, cape: 0.25, fx: 'burst', holy: 1, shine: 1 })],
  [300, pose({ hip: [0, 0], fist: [6, 6], sword: 0.2, shield: [0.5, 0], shine: 0.5 })],
];
// hurt is a block: the shield snapped up across his body towards the blow, feet braced, a half step back; holy sparks
// fly where it lands, then he lowers the shield again
const HURT: [number, Pose][] = [
  [80, pose({ hip: [-1, 1], lean: -0.05, fist: [5, 10], sword: 0.25, shield: [8, -5], shieldA: 0.12, feet: [[-6, 0, 0], [4, 0, 0]], cape: -0.05, skirt: -0.06, wave: 0.1, flap: 1, fx: 'spark', holy: 1 })],
  [130, pose({ hip: [-1.5, 1], lean: -0.07, fist: [5, 10], sword: 0.25, shield: [7.5, -4.5], shieldA: 0.1, feet: [[-6, 0, 0], [4, 0, 0]], cape: 0.02, skirt: 0.03, wave: 0.35, flap: 1, fx: 'spark', holy: 0.45 })],
  [110, pose({ hip: [-0.5, 0.5], lean: -0.02, fist: [6, 11], sword: 0.28, shield: [3.5, -2], shieldA: 0.05, feet: [[-5, 0, 0], [4, 0, 0]], cape: 0.1, wave: 0.6, flap: 0.8 })],
];
// knees give, he sinks and topples backwards
const DEATH: [number, Pose][] = [
  [120, pose({ hip: [-1, 2], lean: -0.15, head: -0.15, fist: [5, 11], sword: 0.6, feet: [[-5, 0, 0], [4, 0, 0]], cape: 0.02, wave: 0.1, flap: 1 })],
  [120, pose({ hip: [0, 7], lean: 0.25, head: 0.3, fist: [8, 14], sword: 1.3, shield: [1, 2], cape: 0.1, skirt: 0.1, wave: 0.35, flap: 1.2, feet: [[-5, 0, 0], [5, 0, 0]] })],
  [140, pose({ hip: [1, 12], lean: -0.4, head: -0.2, fist: [10, 12], sword: 1.9, shield: [2, 3], cape: -0.15, wave: 0.55, flap: 1.4, plume: -0.3, feet: [[-4, 0, 0], [7, 0, 0.2]] })],
  [160, pose({ hip: [4, 14], lean: -1.0, head: -0.2, fist: [12, 10], sword: 2.4, shield: [2, 3], shieldA: -0.6, cape: 0.45, wave: 0.75, flap: 1.4, plume: -0.4, feet: [[0, 0, 0.3], [9, 0, 0.3]] })],
  [400, pose({ hip: [7, 16], lean: -1.4, head: -0.1, fist: [14, 6], sword: 2.9, shield: [2, 3], shieldA: -1.2, cape: 0.2, plume: -0.3, feet: [[4, 0, 0.5], [12, 0, 0.4]] })],
];

// #156: Challenge, one sharp gesture for its short time: the shield set forward, a quick lift of the sword and the flat of
// the blade slapped against the shield's face; he holds, chin up, while the flash fades and two rings of light go out round
// him, then eases back
const CLASH = { fist: [-5, 4] as Pt, sword: -1.4, za: 7, zs: 7.2, shield: [4, -1.5] as Pt, feet: [[-6, 0, 0], [6, 0, 0]] as Pose['feet'] };
const TAUNT: [number, Pose][] = [
  [90, pose({ hip: [0, 1], fist: [1, -2], sword: -0.5, za: 7, zs: 7.2, shield: [3.5, -1], feet: [[-5.5, 0, 0], [5.5, 0, 0]], cape: 0.1 })],
  [70, pose({ ...CLASH, hip: [0, 1.5], lean: 0.04, cape: 0.18, wave: 0.1, flap: 1, fx: 'clash', holy: 0.08 })],
  [120, pose({ ...CLASH, hip: [0, 1.5], lean: 0.04, head: -0.06, cape: 0.2, wave: 0.3, flap: 1, fx: 'clash', holy: 0.35 })],
  [140, pose({ ...CLASH, hip: [0, 1], lean: 0.02, head: -0.1, cape: 0.16, wave: 0.5, flap: 0.8, fx: 'clash', holy: 0.7 })],
  [220, pose({ hip: [0, 0.5], fist: [6.5, 10], sword: 0.25, shield: [2, -0.5], feet: [[-5, 0, 0], [5, 0, 0]], cape: 0.12, wave: 0.7, flap: 0.6, fx: 'clash', holy: 1.05 })],
];

export const sprite: SpriteDef = {
  id: 'paladin', w: W, h: H, anchor: [X0, GROUND], tall: 55,
  anims: {
    idle: IDLE.map((p) => [200, paladin(p)]),
    walk: WALK.map((p) => [100, paladin(p)]),
    attack: ATTACK.map(([ms, p]) => [ms, paladin(p)]),
    cast: CAST.map(([ms, p]) => [ms, paladin(p)]),
    hurt: HURT.map(([ms, p]) => [ms, paladin(p)]),
    death: DEATH.map(([ms, p]) => [ms, paladin(p)]),
    skill: TAUNT.map(([ms, p]) => [ms, paladin(p)]),
  },
  impact: 4,
};
