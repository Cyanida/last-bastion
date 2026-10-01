/**
 * #247: the Viking, redesigned (the look only: his abilities, stats and balance stay as they are). A raider: a conical helm with a
 * spectacle mask and a mail curtain over the lower face, a sheepskin collar, a leather cuirass with a diagonal strap over a
 * grey-teal padded coat, a rope-and-leather belt with hanging leather strips, a knee-length tunic trimmed with fur, baggy
 * trousers, leg wraps, and a long Dane axe held level across his hips in both hands. The tunic and strips move as cloth;
 * hurt is taking the blow and carrying on; death is a fall to the knees and then onto his back; the skill (Leap) is the
 * landing; the cast (Berserker Rage) is a war cry with the axe raised to the sky. 56 px tall.
 */
import { common, arm, GROUND, H, HIP_Y, legs, pose, smear, W, X0, type Pose } from '../humanoid';
import { Bone, ell, Figure, type Material, type Pt } from '../rig';
import type { SpriteDef } from '../sheet';

// a strap wound round a limb: diagonal bands of `mat` across a part `len` long and `w` wide, every `gap`
const wraps = (len: number, w: number, gap: number, mat: Material, tone: number, y0 = 0): [number, number, Material, number][] => {
  const out: [number, number, Material, number][] = [];
  for (let y = y0; y < len; y += gap) for (let x = -w; x <= w; x += 0.8) out.push([x, y + (x + w) * 0.35, mat, tone]);
  return out;
};

// the Viking's own pose fields on top of the shared ones: the cloth's ripple, where his hands hold the haft, the axe's
// depth and the far hand's, and the effects drawn with a pose (the dropped axe, the landing, the blow, the rage)
type VPose = Pose & { wave?: number; flap?: number; nearAt?: number; farAt?: number; zax?: number; zoff?: number; dropped?: boolean; slam?: number; hit?: number; roar?: number };

function viking(p: VPose): Figure {
  const f = new Figure(W, H);
  const hip = new Bone(X0 + p.hip[0], HIP_Y + p.hip[1]);
  const torso = hip.child(0, 0, p.lean);

  legs(hip, p.feet, (th, sh, ft, z, dim) => {
    f.part(th, [[-4.2, -1.5], [4.2, -1.5], [4, 11], [-3.8, 11]], 'teal', z, { dim, folds: [0.45, 2.6, 1] }); // baggy trousers
    f.part(sh, [[-2.7, 0], [2.7, 0], [2.4, 10.6], [-2.4, 10.6]], 'leather', z + 0.1, { dim, details: wraps(10, 2.2, 2.4, 'bone', 3, 0.8) }); // leg wraps, cross-strapped
    f.part(th, ell(0.3, 11.2, 3.9, 2.2), 'teal', z + 0.12, { dim, profile: 'flat' }); // the trouser blousing over the wraps at the knee
    f.part(ft, [[-2.8, -2], [2.6, -2], [5, 0.6], [6, 3], [-3, 3]], 'leather', z + 0.15, { dim: dim + 1 }); // boot
  });

  // the tunic's skirt, knee-length and flaring, embroidered at the hem and trimmed with fur; a glimpse of mail under it
  f.part(torso, [[-6.6, 7], [6.8, 7], [6.4, 10.4], [-6.2, 10.4]], 'steel', 2.9, { mail: true }); // mail under the tunic
  // it moves as cloth: `skirt` swings it from the belt, it hangs half towards the ground as he leans or falls, its lower part
  // swings further than its top (so it bends), and a ripple (`wave` its phase, `flap` its size) runs along the hem
  const wv = p.wave ?? 0, fl = p.flap ?? 0;
  const skirt = torso.child(0, -3, p.skirt * 0.6 - p.lean * 0.5);
  const cloth = ([x, y]: Pt): Pt => {
    const d = Math.max(0, y) / 12; // 0 at the belt, 1 at the hem
    const r = Math.sin(2 * Math.PI * wv - x * 0.35) * fl * d; // the ripple running along the hem
    return [x - p.skirt * 9 * d * d + r * 0.8, y + r * 0.45 * d];
  };
  const stitch: [number, number, Material, number][] = [];
  for (let x = -7.5; x <= 8; x += 1.6) { const [a, b] = cloth([x, 8.2]), [c, e] = cloth([x + 0.8, 8.2]); stitch.push([a, b, 'red', 3], [c, e, 'gold', 4]); } // an embroidered band above the hem
  const hemL: Pt[] = [], hemR: Pt[] = [];
  for (let x = -9.2; x <= 9.6; x += 2.1) { hemL.push(cloth([x, 10.2])); hemR.unshift(cloth([x, 12])); } // the hem's own points, so it ripples
  f.part(skirt, ([[-7.8, 0], [8, 0], [9.6, 11], [4.8, 11.3], [0.8, 11.6], [-4.2, 11.3], [-9.2, 11]] as Pt[]).map(cloth), 'teal', 3.0, { folds: [0.5, 2.8, 0], details: stitch });
  f.part(skirt, [...hemL, ...hemR], 'bone', 3.02, { folds: [0.8, 1.2, 1] }); // fur trim at the hem
  f.part(skirt, ([[-8.6, 0], [-7.4, 0], [-9, 11], [-10.2, 11]] as Pt[]).map(cloth), 'bone', 3.03, { profile: 'flat' }); // and down its open edge
  // the padded coat, the leather cuirass over it with a diagonal strap, and the rope-and-leather belt with hanging straps
  f.part(torso, [[-8.4, -17.5], [8, -17.5], [9, -11], [8, -3], [-7.6, -3], [-8.8, -11]], 'teal', 3.1, { folds: [0.4, 3, 0] });
  const seams: [number, number, Material, number][] = [];
  for (const y of [-13.2, -10.2]) for (let x = -7; x <= 7.6; x += 1) seams.push([x, y, 'leather', 1], [x + 0.5, y + 0.8, 'leather', 5]); // the edges of the layered panels
  for (let y = -16; y <= -7; y += 1.4) seams.push([3.2, y, 'leather', 2]); // a stitched seam down the front
  f.part(torso, [[-8.2, -17.6], [8, -17.6], [9, -11], [8.2, -6.4], [-7.4, -6.4], [-8.6, -11]], 'leather', 3.2, { details: seams }); // the leather cuirass, over the whole chest
  f.part(torso, [[-7.8, -17.2], [-5.2, -17.6], [7.8, -7.2], [6, -6.2]], 'hide', 3.3); // the diagonal strap, from the far shoulder to the near hip
  for (const [bx, by] of [[-1.8, -13.4], [3.6, -9.2]] as const) f.part(torso, [[bx - 1.1, by - 1], [bx + 1.1, by - 1], [bx + 1.1, by + 1], [bx - 1.1, by + 1]], 'steel', 3.31, { details: [[bx, by, 'darksteel', 1]] }); // its buckles
  const rope: [number, number, Material, number][] = [];
  for (let x = -7.5; x <= 8; x += 1.2) rope.push([x, -6.3, 'bone', 5], [x + 0.6, -5.7, 'bone', 2]); // a twisted rope
  f.part(torso, [[-8, -6.8], [8.2, -6.8], [8.2, -5.2], [-8, -5.2]], 'bone', 3.4, { profile: 'flat', details: rope });
  f.part(torso, [[-8, -5.2], [8.2, -5.2], [8.2, -2.4], [-8, -2.4]], 'leather', 3.45); // the leather belt
  f.part(torso, ell(2.2, -3.8, 1.6, 1.4), 'steel', 3.5, { details: [[2.2, -3.8, 'leather', 1]] }); // its ring buckle
  const hang = torso.child(0, -2.4, p.skirt * 0.9 - p.lean * 0.6); // the strips and straps hang from the belt, towards the ground
  // a few leather strips hanging from the cuirass and belt over the tunic, fanning out a little, of different lengths,
  // each riveted at the top, the grey cloth showing between them; the far ones a tone darker
  for (const [x, len, a] of [[-6.2, 5.6, 0.12], [-3.4, 7.6, 0.05], [2.8, 6.4, -0.04], [5.8, 8.2, -0.1], [8, 5, -0.16]] as const) {
    f.part(hang.child(x, 0, a + p.skirt * 0.5 + Math.sin(2 * Math.PI * wv - x * 0.5) * fl * 0.07), [[-1.15, -0.4], [1.15, -0.4], [1.05, len], [0, len + 0.9], [-1.05, len]], 'leather', 3.5 + (x + 8) * 0.001, { dim: x < -3 ? 1 : 0, details: [[0, 0.8, 'steel', 5], [0.5, len * 0.6, 'leather', 2]] });
  }
  for (const [x, len, w] of [[0.4, 12.5, 1.3], [-3.8, 6.5, 1.2]] as const) {
    f.part(hang.child(x, 0, p.skirt * 0.7 + Math.sin(2 * Math.PI * wv - x * 0.5 - 0.7) * fl * 0.08), [[-w / 2, 0], [w / 2, 0], [w / 2 - 0.2, len], [-w / 2 + 0.2, len]], 'leather', 3.55, { dim: x > 0 ? 0 : 1, details: [[0, len - 1.5, 'steel', 5]] }); // hanging straps, each with a metal tip; the long one in the middle
  }
  // the sheepskin collar round the shoulders, falling in a lapel down one side of the chest
  const lap = Math.sin(2 * Math.PI * wv) * fl * 0.5 - p.lean * 2; // the lapel hanging down his chest sways a little; the rest sits on his shoulders
  f.part(torso.child(0, -17, 0), [[-11, -3.4], [5.6, -3.6], [6.4, 0.6], [3.4, 2.8], [0.4, 3.2], [-2 + lap * 0.4, 6.4], [-3.4 + lap, 12], [-5.8 + lap, 11.4], [-6.4 + lap * 0.4, 5.6], [-11.8, 3.8]], 'bone', 3.7, { folds: [0.8, 1.6, 0], details: [[-3.4, 8.6, 'bone', 2], [-2.2, 7, 'bone', 5], [6, 3.8, 'bone', 2], [-8, 2.4, 'bone', 2]] }); // thick fleece, tufted at its edges

  // the head: a conical helm with a spectacle mask, the mail curtain hanging from it over the lower face and neck
  const head = torso.child(1, -19, p.head);
  f.part(head, [[-5, -4.4], [6, -4.4], [6.2, 1.8], [3.6, 4.8], [-3.2, 4.8], [-5.2, 2]], 'darksteel', 5.0, { mail: true }); // mail aventail, darker than the helm
  f.part(head, [[-5.1, -4.4], [-5, -8], [-3, -11], [0.8, -14.2], [3.8, -11], [5.4, -8], [5.7, -4.4]], 'steel', 5.1, { details: [[0.4, -12, 'steel', 6], [-0.8, -10, 'steel', 5]] }); // conical helm, its point turned a little towards us
  f.part(head, [[-5.2, -7.6], [5.7, -7.6], [5.8, -6.2], [-5.2, -6.2]], 'darksteel', 5.15); // the rim band
  // the spectacle mask across the front of the face: two rings round dark eye holes, the nasal between them running down
  const eyes: [number, number, Material, number][] = [];
  const roar = p.roar ?? 0; // Berserker Rage: 0 calm, 1 the full war cry
  const eye: [Material, number, number] = roar > 0.5 ? ['red', 6, 4] : roar > 0 ? ['red', 3, 2] : ['black', 0, 1]; // the eye holes kindle red
  for (const cx of [1.9, 5.1]) eyes.push([cx - 0.5, -4.5, eye[0], eye[1]], [cx + 0.5, -4.5, eye[0], eye[1]], [cx - 0.5, -3.5, eye[0], eye[2]], [cx + 0.5, -3.5, eye[0], eye[2]]);
  f.part(head, [[-0.4, -7], [6.8, -7], [7, -3.6], [6.2, -2.4], [4.4, -2.2], [3.5, -3], [2.6, -2.2], [0.8, -2.4], [-0.4, -3.4]], 'steel', 5.2, {
    details: [...eyes, [3.5, -5.5, 'steel', 6], [3.5, -4.5, 'steel', 5], [3.5, -3.5, 'steel', 4], [0.2, -6.2, 'steel', 6]],
  });

  const sh = torso.at(5.8, -15.5);
  const fist: Pt = [sh[0] + p.fist[0], sh[1] + p.fist[1]];
  const [up, fo] = arm(sh, fist);
  const za = p.za;
  const zax = p.zax ?? za; // the axe's own depth: at rest it is in front of him while the arm is behind
  f.part(up, [[-2.9, -1], [2.9, -1], [2.5, 8], [-2.5, 8]], 'teal', za, { folds: [0.4, 2, 1] }); // padded sleeve
  f.part(fo, [[-2.5, -0.5], [2.5, -0.5], [2.6, 6.2], [-2.6, 6.2]], 'leather', za + 0.1, { details: wraps(6, 2.2, 1.8, 'bone', 2, 0.4) }); // wrapped leather bracer
  // the Dane axe: a long haft wound with leather, a spiked butt, and a big bearded head lashed on below the top of the haft
  // where the hands hold the haft, along it from the head (negative) to the butt (positive): `nearAt` for the near hand,
  // `farAt` for the far one; at rest he holds it level across his hips, one hand under the head and one at the butt
  const nearAt = p.nearAt ?? 0, farAt = p.farAt ?? 8;
  // `dropped`: the axe has left his hands (the death) and lies flat on the ground in front of him, seen a little from above:
  // the head just in front of him, the blade up, the haft running away from him
  const dropped = p.dropped;
  const ax = dropped ? new Bone(X0 + 40, GROUND - 2.4, -Math.PI / 2 + 0.03) : new Bone(fist[0] + Math.sin(p.wpn) * nearAt, fist[1] - Math.cos(p.wpn) * nearAt, p.wpn);
  const hw: [number, number, Material, number][] = [];
  for (let y = -24; y < 18; y += 2.4) hw.push([-0.5, y, 'leather', 2], [0.6, y + 0.9, 'leather', 2]); // the haft's crossed leather wrap
  f.part(ax, [[-1.4, 17.6], [1.4, 17.6], [1.4, -27], [-1.4, -27]], 'wood', zax + 0.3, { details: hw }); // a long, stout haft
  f.part(ax, [[-1.6, 17.6], [1.6, 17.6], [0, 21.6]], 'darksteel', zax + 0.3); // the butt spike
  f.part(ax, [[-1.8, 15.6], [1.8, 15.6], [1.8, 17.8], [-1.8, 17.8]], 'leather', zax + 0.31); // its lashing
  // the far hand lower on the haft
  const fsh = torso.at(-5, -15.5), grip: Pt = dropped ? [fsh[0] + p.off[0], fsh[1] + p.off[1]] : ax.at(0, farAt); // with the axe dropped the far hand just hangs
  const [fup, ffo] = arm(fsh, grip);
  // the far (left) arm is always in front of him: its upper arm tucked under the fleece on his shoulders (3.7); at rest the
  // forearm stays under it too, in the overhead wind-up (the haft behind his head) the forearm and fist come in front of the
  // head, and in the swing across his body
  const atRest = zax !== za, overhead = !atRest && za < 3;
  const zoff = p.zoff; // an explicit depth for the far forearm and fist (the cast's axe held high)
  const zfo = zoff ?? (atRest ? 3.61 : overhead ? 5.5 : 3.95), zfist = zoff !== undefined ? zoff + 0.1 : atRest ? zax + 0.4 : overhead ? 5.6 : za + 0.4;
  f.part(fup, [[-2.7, -1], [2.7, -1], [2.3, 8], [-2.3, 8]], 'teal', 3.6, { dim: 1 });
  f.part(ffo, [[-2.3, -0.5], [2.3, -0.5], [2.4, 6.5], [-2.4, 6.5]], 'leather', zfo, { dim: 1, details: wraps(6, 2, 1.8, 'bone', 2, 0.4) });
  f.part(new Bone(grip[0], grip[1]), ell(0.2, 0.3, 2.5, 2.4), 'tan', zfist, { dim: 1 }); // far fist on the haft
  // the bearded head: a narrow neck out of the socket, a near-straight top edge, and a long curved cutting edge that drops
  // well below the socket (the beard) before curving back to the haft; dark worn steel with one bright line along the edge
  const q = (a: Pt, c: Pt, b: Pt, n: number): Pt[] => Array.from({ length: n + 1 }, (_, k) => { const t = k / n; return [(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]]; });
  const TOE: Pt = [10.4, -29.6], BEARD: Pt = [9.4, -11.6];
  const HEAD: Pt[] = [
    [1.2, -25], ...q([4.2, -24.6], [7.6, -25.2], TOE, 6), // the top edge, sweeping up to the toe
    ...q(TOE, [15.4, -21.4], BEARD, 12).slice(1), // the cutting edge: one full, bulging arc down to the tip of the beard
    ...q(BEARD, [8.8, -18.4], [4.2, -20.4], 8).slice(1), // the beard's back edge, hooking in towards the haft
    [1.2, -21],
  ];
  const arc = q(TOE, [15.4, -21.4], BEARD, 40);
  const cut = (t: number): Pt => { // along the cutting edge, a pixel in from it
    const [x, y] = arc[Math.round(t * 40)], [cx, cy] = [9.6, -21];
    const d = Math.hypot(x - cx, y - cy);
    return [x - ((x - cx) / d) * 0.9, y - ((y - cy) / d) * 0.9];
  };
  const K = 1.3, big = ([x, y]: Pt): Pt => [1.2 + (x - 1.2) * K, -23 + (y + 23) * K]; // scaled up from the socket, to suit the long haft
  const edge: [number, number, Material, number][] = Array.from({ length: 44 }, (_, k) => [...big(cut(k / 43)), 'steel', 6] as [number, number, Material, number]);
  for (const q of [[6.2, -22.4], [8.6, -20], [5.4, -20.6], [8.2, -24.6]] as Pt[]) edge.push([...big(q), 'darksteel', 2]); // pitting on its face
  f.part(ax, HEAD.map(big), 'steel', zax + 0.35, { dim: 1, details: edge }); // the bearded head, dark and worn
  f.part(ax, [[-1.5, -27.6], [1.5, -27.6], [1.5, -18.6], [-1.5, -18.6]], 'leather', zax + 0.36, { details: [[-0.6, -26, 'bone', 3], [0.6, -24, 'bone', 3], [-0.6, -22, 'bone', 3], [0.6, -20, 'bone', 3]] }); // the lashing where it meets the haft
  if (dropped) f.part(new Bone(fist[0], fist[1]), ell(0.3, 0.5, 2.7, 2.6), 'tan', za + 0.4); // the empty hand
  else f.part(ax, ell(0.3, 0.5 + nearAt, 2.7, 2.6), 'tan', zax + 0.4); // fist
  const pb = new Bone(sh[0], sh[1], torso.a * 0.65 + up.a * 0.35);
  f.part(pb, ell(0.3, 0.6, 4.4, 3.8), 'leather', Math.max(za, 3.95) + 0.5, { trim: ['hide', 1.1] }); // leather shoulder guard
  f.part(pb, [[-4.4, -1.8], [3.6, -3.2], [4.4, -1], [-3.6, 0.6]], 'bone', Math.max(za, 3.95) + 0.52, { folds: [0.8, 1.4, 0] }); // the sheepskin over its top

  if (p.smear) smear(f, sh, p.smear, 27, 'smear', za - 0.3, 'white');
  const slam = p.slam; // the landing: where the axe head bites the ground, cracks and dust (0..1)
  if (slam !== undefined) {
    const [ix] = ax.at(14, -21), iy = GROUND - 1.5, w = new Bone(0, 0); // under the middle of the cutting edge
    for (const [dx, len] of [[-1, -9], [1, 8], [-0.4, -5], [0.5, 12]] as const) { // cracks running out along the ground
      const L = len * Math.min(1, slam * 1.6);
      f.part(w, [[ix, iy - 0.5], [ix + L, iy - 0.2 + dx * 0.4], [ix + L * 0.6, iy + 0.5], [ix, iy + 0.6]], 'black', 0.3, { profile: 'flat', outline: false });
    }
    if (slam < 1) for (let k = 0; k < 6; k++) { // dust thrown up round the impact, rising and spreading as it fades
      const a = -Math.PI + (k + 0.5) * (Math.PI / 6), r = 3 + slam * 9, [x, y] = [ix + Math.cos(a) * r * 1.6, iy + Math.sin(a) * r * 0.8 - slam * 2];
      f.part(w, ell(x, y, 1.6 + slam * 2.2, 1.2 + slam * 1.4), 'pelt', k % 2 ? 8 : 0.4, { profile: 'flat', outline: false, dim: slam > 0.6 ? 2 : 0 });
    }
  }
  if (roar > 0) { // the rage takes him: at its height the war cry (the game draws the red aura and sparks, so no haze here)
    const w = new Bone(0, 0), [mx, my] = head.at(6.6, 1.2);
    if (roar > 0.6) for (let k = 0; k < 3; k++) { // the war cry: short arcs thrown out from under the mail
      const r = 3.5 + k * 3 + (roar - 0.6) * 6, a0 = -0.7 - k * 0.1, a1 = 0.7 + k * 0.1;
      const pts: Pt[] = [];
      for (let t = 0; t <= 1.001; t += 0.25) { const a = a0 + (a1 - a0) * t; pts.push([mx + Math.cos(a) * r, my + Math.sin(a) * r * 1.1]); }
      for (let t = 1; t >= -0.001; t -= 0.25) { const a = a0 + (a1 - a0) * t; pts.push([mx + Math.cos(a) * (r + 0.9), my + Math.sin(a) * (r + 0.9) * 1.1]); }
      f.part(w, pts, 'bone', 6.5, { profile: 'flat', outline: false, dim: k }); // under the raised axe
    }
  }
  const hit = p.hit ?? 0;
  if (hit > 0) { // the blow lands: blood sprays from his chest, flying back past him
    const [hx, hy] = torso.at(6, -11);
    for (let k = 0; k < 13; k++) {
      const a = -2.6 + k * 0.2, r = 3 + hit * 10 + (k % 4) * 1.8, sz = k % 3 ? 1.1 : 1.6, [x, y] = [hx + Math.cos(a) * r * -1, hy + Math.sin(a) * r * 0.75 + hit * hit * 5];
      f.part(new Bone(x, y), [[0, -1.3 * sz], [0.9 * sz, 0], [0.5 * sz, 0.9 * sz], [-0.5 * sz, 0.9 * sz], [-0.9 * sz, 0]], 'red', 8.1, { profile: 'flat', outline: false });
    }
    f.part(torso, [[3.4, -13.4], [7.8, -9.6], [7.2, -8.4], [2.6, -12.2]], 'red', 3.35, { profile: 'flat', outline: false, dim: 1 }); // a streak of blood across the cuirass where it landed
  }
  return f;
}

const REST = { fist: [7, 11], wpn: Math.PI / 2 - 0.08, off: [-1, 10], offA: 0, nearAt: -14.5, farAt: 13.5, za: 2.4, zax: 7 } as Partial<Pose>; // the axe held level across his hips
const C = common(REST);
const P = (kw: Partial<Pose>) => pose({ ...REST, nearAt: 0, farAt: 8, za: 7, zax: undefined } as Partial<Pose>, kw); // the attack and the leap: the normal grip, near hand by the far one
const ATTACK: [number, Pose][] = [
  [220, pose(REST)],
  [100, P({ hip: [-1, 0], lean: -0.14, fist: [2, -7], wpn: -0.6, za: 2, off: [1, 8], cape: 0.16 })],
  [120, P({ hip: [-2, -1], lean: -0.22, fist: [-1, -11], wpn: -1.3, za: 2, off: [2, 7], cape: 0.22, plume: 0.1 })],
  [60, P({ hip: [1, 0], lean: 0.08, fist: [10, -6], wpn: 0.7, smear: [[[-1, -11], -1.3], [[10, -6], 0.7]], feet: [[-4, 0, 0], [7, 1.5, -0.1]] })],
  [170, P({ hip: [2, 2], lean: 0.24, fist: [12, 6], wpn: 2.0, smear: [[[10, -6], 0.7], [[12, 6], 2.0]], feet: [[-6, 1, 0.3], [9, 0, 0]], off: [-3, 11], cape: 0.3 })],
  [130, P({ hip: [1, 1], lean: 0.1, fist: [9, 11], wpn: 1.4, feet: [[-5, 0, 0], [8, 0, 0]], cape: 0.2 })],
];
// Leap: the game moves him to the target at once and hits everything where he lands, so this is the landing: he drops in,
// knees tucked and the axe overhead; crashes into a deep crouch and drives the axe head into the ground (cracks, dust);
// holds low with it buried; pulls it free as he rises; and is back in the level hold
const LEAP: [number, Pose][] = [
  [60, P({ hip: [0, -6], lean: -0.05, head: -0.12, fist: [1, -6], wpn: -1.5, za: 2, feet: [[-5, 5, 0.4], [5, 4, 0.3]], off: [1, 6] })],
  [70, P({ hip: [1, 6], lean: 0.36, head: 0.18, fist: [12, 8], wpn: 2.05, feet: [[-8, 0, 0], [8, 0, 0]], off: [-3, 10], slam: 0.15 } as Partial<VPose>)],
  [170, P({ hip: [1, 6.5], lean: 0.38, head: 0.14, fist: [12, 8.5], wpn: 2.05, feet: [[-8, 0, 0], [8, 0, 0]], off: [-3, 10], slam: 0.55 } as Partial<VPose>)],
  [130, P({ hip: [0.5, 2.5], lean: 0.15, head: 0, fist: [10, 8], wpn: 1.7, feet: [[-6, 0, 0], [6.5, 0, 0]], off: [-2, 10], slam: 0.9 } as Partial<VPose>)],
  [120, pose(REST, { hip: [0, 0.5] } as Partial<VPose>)],
];

// cast, Berserker Rage: he goes berserk. He hunches over the axe, head down, shoulders heaving as the rage builds (the eye
// holes kindle red); then throws himself up, heaves the axe to the sky in both hands and roars; holds the roar; and drops
// back into the level hold, eyes still burning. No red haze on him: the game adds the red ring, the shake, and the pulsing
// aura and sparks for as long as the rage lasts, and more red on the sprite reads as blood
const H2 = (kw: Partial<VPose>) => pose(REST, kw as Partial<Pose>);
const CAST: [number, Pose][] = [
  [110, H2({ hip: [-0.5, 2.5], lean: 0.2, head: 0.26, fist: [6, 6], wpn: Math.PI / 2 + 0.1, feet: [[-6, 0, 0], [5, 0, 0]], roar: 0.2 })],
  [130, H2({ hip: [-1, 3.5], lean: 0.28, head: 0.32, fist: [6, 5], wpn: Math.PI / 2 + 0.16, feet: [[-7, 0, 0], [5.5, 0, 0]], roar: 0.4 })],
  [80, H2({ hip: [0.5, -1.5], lean: -0.16, head: -0.3, fist: [9, -10], wpn: 0.55, nearAt: -5, farAt: 11, za: 7, zax: 7, zoff: 6.9, feet: [[-8, 0, 0], [7, 0, 0]], roar: 0.9 })],
  [300, H2({ hip: [0.5, -1], lean: -0.2, head: -0.36, fist: [9.5, -11.5], wpn: 0.48, nearAt: -5, farAt: 11, za: 7, zax: 7, zoff: 6.9, feet: [[-8, 0, 0], [7, 0, 0]], roar: 1 })],
  [150, H2({ hip: [0, 1], lean: 0.06, head: 0, fist: [7, 9], feet: [[-6, 0, 0], [5.5, 0, 0]], roar: 0.35 })],
];

// hurt: he takes the hit and keeps going. No block and no step back: he hunches into the blow, knees giving, head down, as
// blood sprays from his chest; holds it for a moment, chin tucked; then straightens with his chest out and his head up
const HURT: [number, Pose][] = [
  [80, pose(REST, { hip: [0, 2], lean: 0.12, head: 0.16, fist: [7, 12.5], feet: [[-6, 0, 0], [5, 0, 0]], hit: 0.3 } as Partial<VPose>)],
  [120, pose(REST, { hip: [-0.5, 2.5], lean: 0.17, head: 0.2, fist: [7, 12], feet: [[-6, 0, 0], [5, 0, 0]], hit: 0.8 } as Partial<VPose>)],
  [130, pose(REST, { hip: [0.5, -0.5], lean: -0.1, head: -0.16, fist: [8, 9.5], feet: [[-5, 0, 0], [5, 0, 0]] } as Partial<VPose>)],
];
// death: he staggers back a step; drops to both knees as the axe slips from his hands; kneels there with his arms hanging
// and lifts his head to the sky; then falls back and lies on his back beside his axe
const D = (kw: Partial<VPose>) => pose({ ...REST, za: 2.4 } as Partial<Pose>, kw as Partial<Pose>);
const DEATH: [number, Pose][] = [
  [140, D({ hip: [-1.5, 1.5], lean: -0.16, head: -0.14, fist: [7, 10], feet: [[-7, 0, 0], [4, 0, 0]] })],
  [160, D({ hip: [0, 10], lean: 0.12, head: 0.18, fist: [9, 13], wpn: 2.3, nearAt: 0, farAt: 8, feet: [[-9, 0, 1.2], [-3, 0, 1.2]] } as Partial<VPose>)],
  [480, D({ hip: [0, 10.5], lean: -0.08, head: -0.34, fist: [2, 16], off: [-1, 14], dropped: true, feet: [[-9, 0, 1.2], [-3, 0, 1.2]] })],
  [160, D({ hip: [-3, 13], lean: -0.8, head: -0.3, fist: [9, -2], off: [3, -7], dropped: true, feet: [[-7, 0, 0.8], [0, 0, 0.6]] })], // his arms fly up as he goes over
  [600, D({ hip: [-6, 16], lean: -1.45, head: -0.1, fist: [7, 12], off: [-10, 3], dropped: true, feet: [[-2, 0, 0.4], [5, 0, 0.3]] })], // on his back: the near arm along his side, the far one flung out above his head
];

// the cloth per frame: [skirt swing, ripple phase, ripple size]. The attack lags then flares, the leap flies up in the air,
// the hurt jerks, the death falls with gravity (the skirt's own lean term does most of it)
const CLOTH = (q: Pose, skirt: number, wave: number, flap: number) => ({ ...q, skirt, wave, flap }) as Pose;
const ATK_CLOTH = [[0, 0, 0.5], [-0.1, 0.15, 0.8], [-0.16, 0.3, 1], [0.18, 0.45, 1.3], [0.24, 0.6, 1.4], [0.06, 0.8, 1]] as const;
const LEAP_CLOTH = [[-0.34, 0.1, 1.6], [0.32, 0.3, 1.6], [0.2, 0.5, 1.2], [0.04, 0.7, 1], [0, 0.9, 0.6]] as const;
const CAST_CLOTH = [[0.08, 0.1, 0.8], [0.12, 0.25, 1], [-0.22, 0.4, 1.6], [-0.1, 0.6, 1.3], [0.04, 0.85, 0.9]] as const;
const HURT_CLOTH = [[0.14, 0.1, 1.3], [0.08, 0.35, 1.1], [-0.1, 0.6, 1]] as const;
const DEATH_CLOTH = [[-0.12, 0.1, 1], [0.15, 0.3, 1.3], [0.02, 0.5, 0.6], [-0.2, 0.7, 1.3], [0, 0.9, 0.2]] as const;
const withCloth = (frames: [number, Pose][], c: readonly (readonly [number, number, number])[]) =>
  frames.map(([ms, q], i) => [ms, viking(CLOTH(q, ...(c[Math.min(i, c.length - 1)] as [number, number, number])))] as [number, Figure]);

export const sprite: SpriteDef = {
  id: 'viking', w: W, h: H, anchor: [X0, 75], tall: 56,
  anims: {
    idle: C.idle.map((p, i) => [200, viking(CLOTH(p, 0.03 * Math.sin((2 * Math.PI * i) / 4), i / 4, 0.7))]), // a stir in the idle
    walk: C.walk.map((p, i) => [100, viking(CLOTH(p, 0.12 * Math.cos((2 * Math.PI * i) / 8 - 0.8), (2 * i) / 8, 1.3))]), // it swings a beat behind his stride
    attack: withCloth(ATTACK, ATK_CLOTH),
    cast: withCloth(CAST, CAST_CLOTH),
    hurt: withCloth(HURT, HURT_CLOTH),
    death: withCloth(DEATH, DEATH_CLOTH), // he lets go of the level hold as he falls: the axe drops as it did
    skill: withCloth(LEAP, LEAP_CLOTH),
  },
  impact: 4,
};
