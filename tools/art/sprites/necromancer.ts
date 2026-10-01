/**
 * The Necromancer, redesigned (the look only: his abilities, stats and balance stay as they are). A bone priest: gaunt, with
 * pale grey skin and dark sunken eyes that glow green; a long black coat with a high collar, torn at the hem, and over it a
 * ribcage of bone as a chest plate, a skull belt buckle and bone plates hanging from the belt; a tattered black cloak; a
 * green orb of magic floating over the palm of his far hand, in front of him, and in his near hand, behind him, a tall black
 * staff crowned with a ram-horned skull. The cloak and coat move as cloth. The attack throws the orb; the cast (Raise Dead)
 * drives the staff into the ground in a circle of green light; the hurt is blocked by a ward; the skill (Corpse Explosion)
 * crushes the orb in his fist; in death the souls he held tear out of him and his robes crumple empty. Black, bone and a
 * sickly green. 55 px tall.
 */
import { arm, common, GROUND, H, HIP_Y, legs, pose, W, X0, type Pose } from '../humanoid';
import { Bone, ell, Figure, type Material, type Pt } from '../rig';
import type { Frame, SpriteDef } from '../sheet';

const ASH: Material = 'pallor'; // #269: his pale grey, bloodless skin

type D = [number, number, Material, number];
const line = (a: Pt, b: Pt, mat: Material, tone: number, step = 0.7): D[] => {
  const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
  return Array.from({ length: n + 1 }, (_, k) => [a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n, mat, tone] as D);
};

// his own pose fields: `orbAt` moves the orb off his palm (thrown ahead of him), `orbGone` his hand is empty, `sigil` the
// green circle of Raise Dead glowing on the ground round him (0..1), `burst` the orb bursting in his fist (Corpse Explosion),
// `ward` the ward that blocks a blow (0..1), `dead` the light gone out of the staff's skull, and the cloth's ripple (`wave`
// its phase, `flap` its size)
type NPose = Pose & { orbAt?: Pt; orbGone?: boolean; sigil?: number; burst?: number; dead?: boolean; wave?: number; flap?: number; ward?: number };

// cloth that moves: a polygon cut into short edges (so it can bend), then each point moved by how far down the cloth it is
// (`d`, 0 at the top .. 1 at the hem): `swing` sways the lower part further than the top, so the cloth bends rather than
// turning stiffly, and a ripple (`wave` its phase, `flap` its size) runs down and along it, strongest at the hem
const fine = (poly: Pt[], step = 1.5): Pt[] => poly.flatMap((a, i) => {
  const b = poly[(i + 1) % poly.length], k = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
  return Array.from({ length: k }, (_, j) => [a[0] + ((b[0] - a[0]) * j) / k, a[1] + ((b[1] - a[1]) * j) / k] as Pt);
});
const wavy = (poly: Pt[], len: number, swing: number, wave: number, flap: number, billow = 1): Pt[] => fine(poly).map(([x, y]) => {
  const d = Math.max(0, Math.min(1, y / len));
  const r = Math.sin(2 * Math.PI * wave - y * 0.32 - x * 0.25) * flap * d; // the ripple, travelling down the cloth
  return [x - swing * 10 * d * d + r * 1.3 * billow, y + Math.abs(r) * 0.35 - swing * swing * 6 * d * d];
});

function necromancer(p: NPose): Figure {
  const f = new Figure(W, H);
  const hip = new Bone(X0 + p.hip[0], HIP_Y + p.hip[1]);
  const torso = hip.child(0, 0, p.lean);

  // the cloak behind him, black and tattered, its hem torn into ragged points; it moves as cloth, streaming back as he leans
  // or moves (`cape`) and rippling
  const wv = p.wave ?? 0, fl = p.flap ?? 0.6;
  f.part(torso.child(-3, -18, (p.cape - 0.12) * 0.4 - p.lean * 0.7), wavy([[-1, 0], [5, 0], [4, 12], [3, 26], [0, 30], [-2, 26.5], [-4.5, 31], [-6.5, 26], [-9, 30], [-11, 25], [-12.5, 28], [-13, 20], [-11, 10], [-6, 3]], 30, (p.cape - 0.12) * 1.6, wv, fl * 1.3, 1.4), 'coal', 0, { dim: 1, folds: [0.8, 3, 0], details: [...line([-3, 8], [-6, 24], 'coal', 1), ...line([0, 6], [-1, 22], 'coal', 1)] });

  const sg = p.sigil ?? 0;
  if (sg > 0) { // Raise Dead: a circle of green light on the ground round him, its runes lit, motes rising from it
    const rx = 10 + 12 * sg, ry = 2.4 + 2.6 * sg, g0 = new Bone(X0, GROUND - 1);
    for (const [k2, dimR] of [[1, 0], [0.62, 1]] as const) for (let k = 0; k < 56; k++) { // two rings, the inner one fainter
      const a = (k / 56) * 2 * Math.PI, x = Math.cos(a) * rx * k2, y = Math.sin(a) * ry * k2;
      f.part(g0, [[x - 0.8, y - 0.5], [x + 0.8, y - 0.5], [x + 0.8, y + 0.5], [x - 0.8, y + 0.5]], 'necro', y < 0 ? 0.05 : 8, { outline: false, profile: 'flat', dim: dimR, details: k % 7 ? [] : [[x, y, 'necro', 6]] }); // the brighter points are its runes
    }
    for (let k = 0; k < 5; k++) { const x = -rx * 0.8 + (k * rx * 1.6) / 4, h = 3 + ((k * 7) % 5) * sg * 2; f.part(g0, [[x - 0.5, -h - 1.2], [x + 0.5, -h - 1.2], [x + 0.5, -h], [x - 0.5, -h]], 'necro', 8.1, { outline: false, profile: 'flat' }); } // motes of green light rising
  }

  // the far arm, in front of his body: a black sleeve, a bone gauntlet, the hand held out at his side, palm up, a
  // green orb of magic floating over it
  const fsh = torso.at(-5, -15);
  const off: Pt = [fsh[0] + p.off[0], fsh[1] + p.off[1]];
  const [fup, ffo] = arm(fsh, off);
  f.part(fup, [[-2.4, -1], [2.4, -1], [2.1, 8], [-2.1, 8]], 'coal', 6.5, { folds: [0.3, 2.2, 1] });
  f.part(ffo, [[-2.2, -0.5], [2.2, -0.5], [2.4, 5.6], [-2.4, 5.6]], 'bone', 6.6, { details: [...line([-1.6, 1.6], [1.6, 1.6], 'bone', 1, 0.6), ...line([-1.8, 3.8], [1.8, 3.8], 'bone', 1, 0.6)] });
  f.part(ffo, ell(0, 6.8, 1.7, 1.7), ASH, 6.65); // bony hand
  const orb = 2.2 + 1.2 * p.fx, [ax, ay] = p.orbAt ?? [0, 0], oc: Pt = [off[0] + 0.5 + ax, off[1] - 2.6 - orb + ay];
  if (!p.orbGone) {
    const lit: D[] = [];
    for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) { const d = Math.hypot(x, y) / orb; if (d < 1) lit.push([x, y, 'necro', d < 0.35 ? 6 : x + y < 0 ? 5 : 3]); }
    f.part(new Bone(oc[0], oc[1]), ell(0, 0, orb, orb, 16), 'necro', 7.8, { outline: false, details: lit }); // the orb, lit from its heart
    if (p.fx > 0.6) f.part(new Bone(oc[0], oc[1]), ell(0, 0, orb + 1.6, orb + 1.6, 18), 'necro', 7.75, { outline: false, profile: 'flat', dim: 2 }); // its glow as it charges
    if (ax > 4) f.part(new Bone(oc[0], oc[1]), [[-orb * 0.4, -orb * 0.7], [-ax * 0.7, -0.5], [-ax * 0.7, 0.5], [-orb * 0.4, orb * 0.7]], 'necro', 7.7, { outline: false, profile: 'flat', dim: 2 }); // its trail, thrown
  }
  const ward = p.ward ?? 0;
  if (ward > 0) { // the hurt, blocked: the orb flares into a ward in front of him, a tall oval of green light with shards of
    // bone turning round it, a spark bursting from its edge where the blow strikes
    const wb = torso.child(19, -11, 0), ry = 14 * (0.55 + 0.45 * ward), rx = 2.2 + 2.6 * ward;
    const rim: D[] = [];
    for (let k = 0; k < 40; k++) { const a = (k / 40) * 2 * Math.PI; if (Math.cos(a) > -0.2) rim.push([Math.cos(a) * (rx - 0.5), Math.sin(a) * (ry - 0.5), 'necro', 6]); }
    for (let k = -3; k <= 3; k++) rim.push([rx * 0.1, k * ry * 0.2, 'necro', 4]); // faint runes across it
    f.part(wb, ell(0, 0, rx, ry, 28), 'necro', 7.95, { outline: false, profile: 'flat', dim: 2, details: rim }); // a tall oval ward of green light
    for (const [x, y, a] of [[-rx - 1, -9, 0.6], [rx + 0.6, -2, -0.4], [-rx - 0.6, 7, 1.1]] as const) f.part(wb.child(x, y * (0.55 + 0.45 * ward), a), [[-1.2, -0.6], [1.3, -0.4], [0.9, 0.7], [-1, 0.6]], 'bone', 7.97); // bone shards turning round it
    if (ward > 0.8) for (let k = 0; k < 5; k++) { const a = -0.9 + k * 0.45; f.part(wb, [[rx - 0.5, -0.6], [rx + Math.cos(a) * 6, Math.sin(a) * 6], [rx - 0.5, 0.6]], 'necro', 7.99, { outline: false, profile: 'flat' }); } // the spark where the blow meets it
  }
  const burst = p.burst ?? 0;
  if (burst > 0) { // the orb crushed in his fist: a flash of green, and shards of bone flying out
    const at = new Bone(off[0], off[1] + 5);
    f.part(at, ell(0, 0, 2 + 3 * burst, 2 + 3 * burst, 18), 'necro', 7.8, { outline: false, profile: 'flat', details: [[0, 0, 'necro', 6], [-1, 0, 'necro', 6], [1, 0, 'necro', 6]] });
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4 + 0.3, r = 4 + burst * 7, c = Math.cos(a), n = Math.sin(a);
      f.part(at, [[c * 2 - n * 0.7, n * 2 + c * 0.7], [c * (r + 3), n * (r + 3)], [c * 2 + n * 0.7, n * 2 - c * 0.7]], 'necro', 7.85, { outline: false, profile: 'flat', dim: 1 }); // rays
      if (k % 2) f.part(new Bone(off[0] + c * (r + 2), off[1] + 5 + n * (r + 2), a), [[-1, -0.6], [1.2, -0.4], [0.8, 0.7], [-0.9, 0.6]], 'bone', 7.9); // bone shards
    }
  }

  // legs: black trousers and tall boots of dark leather
  legs(hip, p.feet, (th, sh, ft, z, dim) => {
    f.part(th, [[-3.4, -1.5], [3.4, -1.5], [2.8, 11], [-2.8, 11]], 'coal', z, { dim, folds: [0.3, 2.4, 1] });
    f.part(sh, [[-2.6, 0], [2.6, 0], [2.4, 11], [-2.4, 11]], 'hide', z + 0.1, { dim: dim + 1 });
    f.part(ft, [[-2.6, -1.5], [2.4, -1.5], [5.2, 1], [5.6, 3], [-2.8, 3]], 'hide', z + 0.15, { dim: dim + 1 });
  });

  // the long coat: split at the front and torn at the hem, falling to his shins
  const skirt = torso.child(0, -3, p.skirt * 0.4 - p.lean * 0.5);
  const coat = (poly: Pt[], lag: number) => wavy(poly, 20, p.skirt + (p.cape - 0.12) * 0.4, wv - lag, fl);
  f.part(skirt, coat([[-7, 0], [0.4, 0], [-0.6, 19], [-3, 17.4], [-5.4, 20], [-7.6, 17.6], [-9.6, 19.2]], 0.15), 'coal', 2.95, { dim: 1, folds: [0.5, 2.6, 0] }); // its back
  f.part(skirt, coat([[1.6, 0], [7.4, 0], [10, 19], [8, 17.6], [6, 20], [4, 18], [2.2, 19.4]], 0), 'coal', 3.0, { folds: [0.5, 2.6, 0], trim: ['hide', 0.8] }); // its front flap
  // two curved bone plates hanging from the belt over the front of the coat, swinging with it
  const hang = torso.child(0, -2.6, p.skirt * 0.9 - p.lean * 0.5);
  for (let k = 0; k < 2; k++) f.part(hang.child(3.6, k * 2.6, Math.sin(2 * Math.PI * wv - k) * fl * 0.06), [[-2, 0], [2, 0], [1.8, 2.4], [0, 3.4], [-1.8, 2.4]], 'bone', 3.35 + k * 0.01, { details: [[0, 1.4, 'bone', 5]] });
  // the torso: a black leather coat, and over it a ribcage of bone as a chest plate, a breastbone down its middle
  f.part(torso, [[-7, -17.6], [6.6, -17.6], [7.6, -11], [7, -3], [-6.6, -3], [-7.6, -11]], 'coal', 3.1, { folds: [0.35, 2.6, 0] });
  const ribs: D[] = [];
  for (let k = 0; k < 3; k++) { const y = -14.6 + k * 2.2; ribs.push(...line([-5.6 + k * 0.5, y + 1.2], [0.6, y], 'coal', 1, 0.5), ...line([1.6, y], [6.4 - k * 0.3, y + 1.4], 'coal', 1, 0.5)); }
  f.part(torso, [[-4.8, -16.6], [6.2, -16.6], [6.6, -12.6], [5.4, -9], [3, -8.4], [1.1, -9.6], [-0.8, -8.4], [-3.6, -9], [-5.2, -12.6]], 'bone', 3.4, { dim: 1, details: [...ribs, ...line([1.1, -16], [1.1, -9.8], 'bone', 4, 0.6)] });
  // a leather belt with a skull buckle
  f.part(torso, [[-7, -5.4], [7.2, -5.4], [7.2, -2.8], [-7, -2.8]], 'hide', 3.5);
  f.part(torso, ell(1.4, -4.1, 2, 1.8), 'bone', 3.55, { details: [[0.7, -4.4, 'black', 0], [2.1, -4.4, 'black', 0], [1.4, -3.2, 'bone', 2]] }); // skull buckle
  // a high black collar standing up round his neck, edged in bone
  f.part(torso, [[-6.4, -17], [5.6, -17], [6.2, -20.4], [4.6, -22.2], [3, -19], [-3.6, -19], [-5.2, -22.4], [-6.8, -20.4]], 'coal', 3.7, { trim: ['bone', 0.7] });

  // the head: gaunt and pale, dark hair swept back from a high forehead, the eyes sunk in shadow and glowing green
  const head = torso.child(0.8, -19.8, p.head);
  const hb = new Bone(Math.round(head.x), Math.round(head.y), head.a);
  f.part(head, [[-5.4, 0.6], [-5.8, -5.6], [-4, -10], [0, -11.4], [3.6, -10.6], [5.2, -8.6], [4.6, -7], [-1, -5], [-2.6, 1.8]], 'coal', 4.9, { folds: [0.5, 1.4, 0], details: [...line([-4.4, -8.4], [2, -10.4], 'coal', 5), ...line([-5, -4], [-3.6, -9], 'coal', 5)] });
  // a three-quarter face, columns x -3..5 and rows y -8..1 from the head bone: h hair, S skin edge, M skin, L light, K brows,
  // D the dark of the sunken sockets and hollow cheeks, G the green glow of the eyes, N the nose's shadow, P the thin mouth
  const FACE = [
    '.hhhhhh..',
    'hhLLLhhh.',
    'hLLLLLLh.',
    'hKKLMKKK.',
    'hDGDMDGDS',
    'hMDMMNDMS',
    'hSMMMNMMS',
    '.SDMMPPS.',
    '..SMMMS..',
    '...SS....',
  ];
  const tone: Record<string, [Material, number]> = {
    h: ['coal', 3], S: [ASH, 2], M: [ASH, 4], L: [ASH, 5], K: ['coal', 1], D: [ASH, 1], G: ['necro', 5], N: [ASH, 3], P: ['coal', 2],
  };
  const fd: D[] = [];
  FACE.forEach((row, r) => [...row].forEach((ch, c) => { if (tone[ch]) fd.push([c - 3 + 0.5, r - 8 + 0.5, ...tone[ch]]); }));
  f.part(hb, [[-3, -8], [5, -8], [6, -5], [6, -3], [5, -1], [3, 2], [0, 2], [-3, 0]], ASH, 5.2, { profile: 'flat', details: fd });

  // the near arm, behind his body, and the staff in its hand
  const sh = torso.at(5, -15.4);
  const fist: Pt = [sh[0] + p.fist[0], sh[1] + p.fist[1]];
  const [up, fo] = arm(sh, fist);
  const za = p.za;
  // the staff: a long black shaft bound with bone rings, and at its top a horned skull, green light in its eyes and a soul
  // wisp over it; `fx` swells the light as he charges a spell
  const st = new Bone(fist[0], fist[1], p.wpn);
  const rings: D[] = [];
  for (const y of [-19, -11, 7]) rings.push([-0.5, y, 'bone', 4], [0.5, y, 'bone', 4], [-0.5, y + 1, 'bone', 2], [0.5, y + 1, 'bone', 2]);
  f.part(st, [[-0.9, 17], [0.9, 17], [0.9, -23], [-0.9, -23]], 'bark', za - 0.1, { details: rings });
  const top = st.child(0, -27); // short enough that his idle, wisp and all, stands within the class card's portrait (#156)
  for (const s of [-1, 1]) f.part(top, [[s * 2.6, -3], [s * 5, -3.6], [s * 6.6, -2], [s * 7, 0.6], [s * 6.2, 3], [s * 4.6, 4.2], [s * 3.6, 3.2], [s * 5, 2.2], [s * 5.4, 0.4], [s * 4.6, -1.2], [s * 3, -1]], 'bone', za - 0.07, { dim: s < 0 ? 2 : 1, details: [[s * 5, -2.6, 'bone', 4], [s * 6.2, -0.8, 'bone', 2], [s * 6, 1.6, 'bone', 2]] }); // ram's horns curling down round the skull
  const eye = p.dead ? 0 : p.fx > 0.5 ? 6 : 5;
  f.part(top, [[-3.2, -3.4], [3.2, -3.4], [3.8, 0], [2.6, 2.6], [1.6, 4.4], [-1.6, 4.4], [-2.6, 2.6], [-3.8, 0]], 'bone', za - 0.06, {
    details: [[-1.5, -0.6, p.dead ? 'black' : 'necro', eye], [-1.5, 0.4, p.dead ? 'black' : 'necro', Math.max(0, eye - 1)], [1.5, -0.6, p.dead ? 'black' : 'necro', eye], [1.5, 0.4, p.dead ? 'black' : 'necro', Math.max(0, eye - 1)], [0, 1.8, 'black', 0], ...line([-1.2, 3.4], [1.2, 3.4], 'bone', 1, 0.5)],
  }); // the skull
  const wr = 1.4 + 1.6 * p.fx;
  if (!p.dead) f.part(top, [[0, -4 - wr * 2.6], [wr, -4 - wr], [0.6, -4], [-0.6, -4], [-wr, -4 - wr]], 'necro', za - 0.03, { outline: false, details: [[0, -4 - wr * 1.2, 'necro', 6]] }); // the soul wisp
  if (p.fx > 0.9) f.part(top, ell(0, -1, 6, 6, 18), 'necro', za - 0.2, { profile: 'flat', outline: false, dim: 1 }); // the skull flares
  // the sleeve and a leather bracer
  f.part(up, [[-2.5, -1], [2.5, -1], [2.2, 8], [-2.2, 8]], 'coal', za + 0.1, { folds: [0.3, 2.2, 1] });
  f.part(fo, [[-2.3, -0.5], [2.3, -0.5], [2.6, 6], [-2.6, 6]], 'hide', za + 0.2, { details: [...line([-2, 1.6], [2, 1.6], 'bone', 4, 0.6), ...line([-2.2, 4.2], [2.2, 4.2], 'bone', 4, 0.6)] }); // a dark leather bracer bound with bone, so the arm reads against the ribcage
  f.part(st, ell(0.3, 0.5, 2, 2), ASH, za + 0.3); // bony fist
  return f;
}

// `fist` is the staff hand (the near one, behind him), `wpn` the staff's angle; `off` the orb hand (the far one, in front)
const REST: Partial<NPose> = { fist: [7, 12], wpn: 0.1, off: [-1, 11], za: 2.4 };
const C = common(REST);
const P = (kw: Partial<NPose>): NPose => pose(REST, kw as Partial<Pose>) as NPose;
// idle: he breathes, the orb floats a little over his palm and its light pulses
const IDLE = C.idle.map((q, i) => ({ ...q, orbAt: [0, -[0, 0.6, 1.2, 0.6][i]] }) as NPose);
// the attack, his shadow bolt: he draws the orb back beside him as it swells, then throws it forward, his arm reaching out
// after it (the impact frame, the orb flying from his hand with a trail); a new, small orb gathers on his palm
const ATTACK: [number, NPose][] = [
  [200, P({ fx: 0.4 })],
  [110, P({ hip: [-0.5, 0], lean: -0.08, off: [-5, 8], fx: 0.7, cape: 0.16 })],
  [110, P({ hip: [-1, 0], lean: -0.14, head: -0.06, off: [-7, 5], fx: 1, cape: 0.2 })],
  [60, P({ hip: [1, 0], lean: 0.1, off: [12, 3], fx: 1, orbAt: [3, 1], feet: [[-4, 0, 0], [6, 1, -0.1]] })],
  [170, P({ hip: [2, 1], lean: 0.16, off: [15, 4], fx: 0.6, orbAt: [13, 2], cape: 0.28, feet: [[-5, 0, 0.2], [8, 0, 0]] })],
  [130, P({ hip: [1, 0], lean: 0.06, off: [5, 9], fx: 0, feet: [[-5, 0, 0], [6, 0, 0]] })],
];
// the cast, Raise Dead: he lifts the staff high as the skull's light swells and raises the orb hand, palm up; then drives the
// staff's foot down into the ground, and a circle of green light spreads round him with motes rising from it (the game
// raises the skeletons from the dead then); he holds it, the hand lifted as if calling them up, then settles
const CAST: [number, NPose][] = [
  [120, P({ lean: -0.06, head: -0.1, fist: [6, 5], wpn: 0.02, off: [-3, 4], fx: 0.6 })],
  [120, P({ lean: -0.1, head: -0.16, fist: [6, 1], wpn: 0, off: [-2, 1], fx: 1, sigil: 0.2 })],
  [80, P({ hip: [0, 1.5], lean: 0.1, head: 0.05, fist: [8, 10], wpn: 0.05, off: [0, 6], fx: 1, sigil: 0.7, feet: [[-5, 0, 0], [5, 0, 0]] })],
  [280, P({ hip: [0, 1], lean: 0.02, head: -0.14, fist: [8, 11], wpn: 0.05, off: [-3, -2], fx: 1, sigil: 1, feet: [[-5, 0, 0], [5, 0, 0]] })],
  [160, P({ fx: 0.4, sigil: 0.4 })],
];
// Corpse Explosion (his skill): he thrusts the orb hand out at the dead, the orb swells, and he crushes it in his fist: it
// bursts in a flash of green and shards of bone (the game bursts every corpse near him then); the orb gathers again
const BLAST: [number, NPose][] = [
  [100, P({ lean: 0.04, off: [11, 4], fx: 0.8, cape: 0.18 })],
  [110, P({ lean: 0.08, off: [13, 3], fx: 1, orbAt: [1, -1] })],
  [220, P({ hip: [1, 1], lean: 0.14, head: 0.08, off: [13, 5], orbGone: true, burst: 1, fx: 1, cape: 0.3, feet: [[-5, 0, 0.2], [7, 0, 0]] })],
  [150, P({ lean: 0.04, off: [6, 9], fx: 0.1 })],
];
// hurt, blocked: he doesn't flinch; he snaps the orb hand up and the orb flares into a ward in front of him that takes the
// blow, then it fades and the orb settles back on his palm
const HURT: [number, NPose][] = [
  [50, P({ lean: -0.03, off: [10, 0], fx: 1, orbGone: true, ward: 0.6 })],
  [120, P({ lean: -0.05, head: -0.04, off: [11, -1], fx: 1, orbGone: true, ward: 1 })],
  [80, P({ lean: -0.02, off: [5, 6], fx: 0.5, ward: 0.3 })],
];
// death: his own magic leaves him. He staggers as the orb gutters out, drops to his knees, and the green souls he held tear
// out of him and rise; his body gives way inside the robes, which crumple to the ground empty, leaving a heap of black cloth
// with his bones and skull spilled over it and the staff fallen beside it, its light gone out
const DEATH_POSES: NPose[] = [
  P({ hip: [-1.5, 1], lean: -0.16, head: -0.16, off: [-3, 9], fx: 0.1, feet: [[-7, 0, 0], [4, 0, 0]] }),
  P({ hip: [0, 10], lean: 0.14, head: 0.22, fist: [9, 10], wpn: 0.5, off: [1, 13], orbGone: true, fx: 0, feet: [[-9, 0, 1.2], [-3, 0, 1.2]] }),
  P({ hip: [0, 10.5], lean: -0.1, head: -0.34, fist: [9, 11], wpn: 0.8, off: [-2, 12], orbGone: true, fx: 0, dead: true, feet: [[-9, 0, 1.2], [-3, 0, 1.2]] }),
];
// the souls leaving him: wisps of green rising from (x, y), `t` how far they have risen (0..1)
const souls = (f: Figure, x: number, y: number, t: number): Figure => {
  for (let k = 0; k < 5; k++) {
    const sx = x - 6 + k * 3, sy = y - 4 - t * (10 + ((k * 5) % 7) * 2), r = 1.3 + (1 - t) * 0.8 + (k % 2) * 0.4;
    f.part(new Bone(sx + Math.sin(k * 2 + t * 6) * 1.5, sy), [[0, -r * 2.6], [r, -r * 0.3], [r * 0.6, r * 0.8], [0, r], [-r * 0.6, r * 0.8], [-r, -r * 0.3]], 'necro', 9, { outline: false, dim: t > 0.7 ? 2 : k % 2, details: [[0, 0, 'necro', 6]] });
  }
  return f;
};
// what is left: his robes crumpled empty on the ground, his skull and bones spilled over them, the staff fallen beside him
// `tall` stretches the heap up (the robes still slumping down as he gives way)
const remains = (wisps: number, tall = 1): Figure => {
  const f = new Figure(W, H), g = new Bone(X0, GROUND);
  const up = (q: Pt[]): Pt[] => q.map(([x, y]) => [x * (1 - (tall - 1) * 0.25), y * tall]);
  f.part(g, up([[-16, 0], [-14, -3], [-9, -5], [-3, -7], [3, -6.4], [8, -4.4], [12, -2], [14, 0]]), 'coal', 2, { folds: [0.6, 2.4, 0], details: [...line([-10, -2], [-4, -5], 'coal', 1), ...line([2, -4], [9, -1.6], 'coal', 1)] }); // the heap of cloak and coat
  f.part(g, [[-19, 0], [-17, -1.6], [-14, -1], [-12, 0]], 'coal', 1.9, { dim: 1 }); // a ragged edge of the cloak
  f.part(new Bone(X0, GROUND - 7 * (tall - 1)), [[-3, -5.6], [5, -5.6], [5.4, -3.8], [-3.4, -3.8]], 'bone', 2.5, { dim: 1, details: [...line([-2, -4.7], [4.2, -4.7], 'coal', 1, 0.5)] }); // the ribcage plate, fallen on the heap
  f.part(new Bone(X0, GROUND - 7 * (tall - 1)), ell(-6, -6.2, 2.6, 2.2), 'bone', 2.6, { details: [[-6.9, -6.4, 'black', 0], [-5.1, -6.4, 'black', 0], [-6, -5, 'bone', 2]] }); // his skull
  for (const [x, y, a, L] of [[2, -7, 0.4, 4], [8, -3.4, -0.3, 4.6], [-12, -2.2, 0.2, 3.6]] as const) f.part(new Bone(X0 + x, GROUND + y, a), [[-L / 2, -0.6], [L / 2, -0.6], [L / 2, 0.6], [-L / 2, 0.6]], 'bone', 2.7, { dim: 1 }); // bones
  const st = new Bone(X0 + 6, GROUND - 1.2, Math.PI / 2 - 0.04); // the staff, lying along the ground, its skull dark
  f.part(st, [[-0.9, -18], [0.9, -18], [0.9, 16], [-0.9, 16]], 'bark', 1.5);
  f.part(new Bone(X0 + 25, GROUND - 3.4), [[-3.2, -3.4], [3.2, -3.4], [3.8, 0], [2.6, 2.6], [-2.6, 2.6], [-3.8, 0]], 'bone', 1.6, { dim: 1, details: [[-1.5, -0.6, 'black', 0], [1.5, -0.6, 'black', 0]] });
  if (wisps > 0) souls(f, X0, GROUND - 14 - 7 * tall, wisps);
  return f;
};
const DEATH = (): Frame[] => [
  [150, necromancer({ ...DEATH_POSES[0], cape: 0.3, wave: 0.1, flap: 1.3 })],
  [170, souls(necromancer({ ...DEATH_POSES[1], cape: 0.2, wave: 0.3, flap: 1.4 }), X0 - 1, HIP_Y - 2, 0.1)], // the souls tear out of him
  [200, souls(necromancer({ ...DEATH_POSES[2], cape: 0.12, wave: 0.5, flap: 1 }), X0 - 1, HIP_Y - 12, 0.45)], // and rise
  [110, remains(0.65, 2.2)], // he gives way: the robes slump
  [110, remains(0.8, 1.4)],
  [600, remains(0)],
];

// the cloth per frame: [how far it streams back (cape), ripple phase, ripple size]. Idle: a slow stir; walk: it streams back
// and flaps with the stride; the attack flares it with the throw; the cast billows it up as the circle's power rises; the
// hurt jerks it; the death lets it fall with him
type Cloth = readonly [number, number, number];
const clothed = (frames: [number, NPose][], c: (i: number, n: number) => Cloth) =>
  frames.map(([ms, q], i) => { const [cape, wave, flap] = c(i, frames.length); return [ms, necromancer({ ...q, cape, wave, flap })] as [number, Figure]; });
const table = (t: Cloth[]) => (i: number) => t[Math.min(i, t.length - 1)];

export const sprite: SpriteDef = {
  id: 'necromancer', w: W, h: H, anchor: [X0, 75], tall: 55,
  anims: {
    idle: clothed(IDLE.map((q) => [200, q]), (i, n) => [0.16 + 0.04 * Math.sin((2 * Math.PI * i) / n), i / n, 0.7]),
    walk: clothed(C.walk.map((q) => [100, q as NPose]), (i, n) => [0.36 + 0.08 * Math.sin((2 * Math.PI * i) / n), (2 * i) / n, 1.3]),
    attack: clothed(ATTACK, table([[0.16, 0, 0.7], [0.1, 0.15, 0.9], [0.06, 0.3, 1.1], [0.34, 0.45, 1.5], [0.42, 0.6, 1.6], [0.26, 0.8, 1.1]])),
    cast: clothed(CAST, table([[0.2, 0.1, 1], [0.3, 0.25, 1.3], [0.08, 0.45, 1.8], [0.46, 0.65, 2], [0.24, 0.9, 1.2]])),
    hurt: clothed(HURT, table([[0.24, 0.1, 1.2], [0.3, 0.3, 1.4], [0.2, 0.55, 1]])),
    death: DEATH(),
    skill: clothed(BLAST, table([[0.22, 0.1, 1], [0.3, 0.3, 1.3], [0.46, 0.5, 1.8], [0.22, 0.8, 1.1]])),
  },
  impact: 4,
};
