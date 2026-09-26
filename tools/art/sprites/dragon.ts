/**
 * #158: The Dragon, the Act's flying boss, on its own four-legged flying rig: a red body with a cream belly, a long neck to a horned
 * head, two bat wings with finger bones, four clawed legs tucked under and a spade tail. About 2× the Paladin long and 64 art px
 * from the ground to the raised wing tip (the game draws bosses at 4/3). It hovers, so its feet stay off the ground; its shadow is
 * the game's. Wings beat on idle and walk; it snaps its jaws on attack; on its special it rears back, fire gathers in its throat over
 * the telegraph, and it breathes a cone of fire (the fire pools land where the telegraph showed). Hurt: it rears; death: it drops out
 * of the air and folds its wings.
 */
import { Bone, ell, Figure, type Pt } from '../rig';
import type { SpriteDef } from '../sheet';

const W = 160, H = 112;
const GROUND = 106;
const X0 = 70;
const world = new Bone(0, 0);

interface Pose {
  y: number; // hover height of the body above the ground
  tilt: number; // body pitch (radians, + nose down)
  wing: number; // wing beat: 1 fully up, -1 fully down
  neck: number; // neck raise: + up and back, - forward and down
  jaw: number; // jaw open (radians)
  legs: number; // 0 tucked (flying), 1 hanging down (landed / dead)
  tail: number; // tail wave phase
  breath: number; // fire cone length (0: none)
  gather: number; // fire in the throat (0: none)
  fold: number; // wings folded (death)
}
const pose = (kw: Partial<Pose> = {}): Pose => ({ y: 40, tilt: 0, wing: 0, neck: 0, jaw: 0, legs: 0, tail: 0, breath: 0, gather: 0, fold: 0, ...kw });

/** A tapering tube through `pts` with radii `r`: an outline polygon. */
function tube(pts: Pt[], r: number[]): Pt[] {
  const l: Pt[] = [], rr: Pt[] = [];
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy) || 1;
    const nx = -dy / n, ny = dx / n;
    l.push([p[0] + nx * r[i], p[1] + ny * r[i]]);
    rr.push([p[0] - nx * r[i], p[1] - ny * r[i]]);
  });
  return [...l, ...rr.reverse()];
}

function dragon(p: Pose): Figure {
  const f = new Figure(W, H);
  const body = new Bone(X0, GROUND - p.y, p.tilt);
  const B = (x: number, y: number): Pt => body.at(x, y);

  // tail: from the rump, sweeping back and down with a wave, a spade at the tip
  const tail: Pt[] = [0, 1, 2, 3, 4, 5].map((k) => {
    const s = k / 5;
    return [B(-20, 2)[0] - 46 * s, B(-20, 2)[1] + 10 * s + 6 * Math.sin(p.tail + s * 3) * s];
  });
  f.part(world, tube(tail, [6, 5, 4, 3, 2, 1.2]), 'red', 1, { dim: 1 });
  const tip = tail[5], pre = tail[4], ta = Math.atan2(tip[1] - pre[1], tip[0] - pre[0]);
  f.part(new Bone(tip[0], tip[1], ta + Math.PI / 2), [[0, 0], [-5, -2], [-2, 6], [0, 4], [2, 6], [5, -2]], 'red', 1.1, { dim: 1 }); // spade

  // wings: far one behind everything, near one in front; a wing is an arm (shoulder -> wrist) and three finger bones fanned out
  const wing = (near: boolean) => {
    const z = near ? 9 : 0.5, dim = near ? 0 : 1;
    const sh = B(near ? 6 : 10, -8);
    const up = p.wing * (1 - p.fold), fold = p.fold;
    const wa = -Math.PI / 2 - 0.35 - up * 0.9 + fold * 1.6 + (near ? 0 : 0.18); // the arm's direction (world, from +x)
    const wrist: Pt = [sh[0] + Math.cos(wa) * 26 * (1 - 0.4 * fold), sh[1] + Math.sin(wa) * 26 * (1 - 0.4 * fold)];
    const tips = [0.55, 1.2, 1.9].map((d, k): Pt => {
      const a = wa - Math.PI + d + 0.4 + up * 0.25 - fold * 0.5;
      const len = [34, 30, 22][k] * (1 - 0.55 * fold);
      return [wrist[0] - Math.cos(a) * len, wrist[1] - Math.sin(a) * len];
    });
    const root: Pt = B(-14, -2);
    // the membrane: scalloped between the finger tips
    const mem: Pt[] = [sh, wrist, tips[0]];
    for (let k = 0; k < 2; k++) {
      const a = tips[k], b = tips[k + 1];
      mem.push([(a[0] + b[0]) / 2 + (wrist[0] - (a[0] + b[0]) / 2) * 0.3, (a[1] + b[1]) / 2 + (wrist[1] - (a[1] + b[1]) / 2) * 0.3], b);
    }
    mem.push([(tips[2][0] + root[0]) / 2 + (wrist[0] - root[0]) * 0.15, (tips[2][1] + root[1]) / 2 + 4], root);
    f.part(world, mem, 'red', z, { profile: 'flat', folds: [0.8, 5, 0], dim: dim + 1 });
    f.part(world, tube([sh, wrist], [2.6, 1.8]), 'red', z + 0.1, { dim });
    tips.forEach((t) => f.part(world, tube([wrist, t], [1.2, 0.5]), 'red', z + 0.05, { dim }));
    f.part(world, [[wrist[0] - 1, wrist[1]], [wrist[0] + 2, wrist[1] - 4], [wrist[0] + 1.5, wrist[1] + 0.5]], 'white', z + 0.12, { dim }); // thumb claw
  };
  wing(false);

  // legs: two pairs, each thigh -> shin -> clawed foot; tucked when flying, hanging when landed
  const leg = (hx: number, near: boolean) => {
    const z = near ? 6 : 1.5, dim = near ? 0 : 1, off = near ? 0 : 3;
    const hip = B(hx + off, 7);
    const t = p.legs;
    const knee: Pt = [hip[0] + 6 - t * 4, hip[1] + 8 + t * 4];
    const ankle: Pt = [knee[0] - 7 + t * 5, knee[1] + 4 + t * 7];
    const toe: Pt = [ankle[0] + 5, ankle[1] + 2 + t * 1];
    f.part(world, tube([hip, knee], [5, 3.6]), 'red', z, { dim });
    f.part(world, tube([knee, ankle], [3, 2.2]), 'red', z + 0.05, { dim });
    f.part(world, [[ankle[0] - 2, ankle[1] - 2], [toe[0], toe[1] - 1.5], [toe[0] + 2.5, toe[1] + 1.5], [ankle[0] - 2, ankle[1] + 2]], 'red', z + 0.1, { dim, details: [[toe[0] + 1.5, toe[1] + 1, 'white', 4]] });
    for (const k of [0, 1.8]) f.part(world, [[toe[0] - k, toe[1] + 0.5], [toe[0] - k + 1.5, toe[1] + 3.5], [toe[0] - k - 0.5, toe[1] + 1]], 'white', z + 0.12, { dim, outline: false }); // claws
  };
  leg(-13, false);
  leg(12, false);

  // body: a barrel with a cream belly, dorsal spines along the back
  f.part(body, [[-24, -2], [-18, -10], [-4, -13], [10, -13], [22, -9], [26, -2], [22, 7], [8, 11], [-8, 11], [-20, 8]], 'red', 3);
  f.part(body, [[-18, 6], [-6, 9], [8, 9], [20, 5], [22, 8], [8, 12.5], [-8, 12.5], [-20, 9]], 'white', 3.1, { folds: [0.9, 2.2, 0] }); // belly scales
  for (const x of [-16, -8, 0, 8, 16]) f.part(body, [[x - 2.5, -11 - (x > 10 ? -1 : 0)], [x + 2, -12], [x - 2, -17]], 'white', 2.9, { dim: 1 }); // spines

  // neck and head: an S-curve from the chest up to the head
  const n0 = B(22, -6);
  const nr = p.neck;
  const n1: Pt = [n0[0] + 8 - nr * 4, n0[1] - 10 - nr * 3];
  const n2: Pt = [n1[0] + 4 - nr * 5, n1[1] - 10 - nr * 2];
  const hd: Pt = [n2[0] + 6 - nr * 4, n2[1] - 3 + nr * 1];
  f.part(world, tube([n0, n1, n2, hd], [7, 5.5, 4.6, 4.2]), 'red', 4);
  f.part(world, tube([[n0[0] + 3, n0[1] + 4], [n1[0] + 3, n1[1] + 2], [n2[0] + 2.5, n2[1] + 1.5]], [2.6, 2.2, 1.8]), 'white', 4.1, { folds: [0.8, 2, 1] }); // throat scales
  const ha = Math.atan2(hd[1] - n2[1], hd[0] - n2[0]) * 0.4 + p.neck * -0.25 + p.tilt;
  const head = new Bone(hd[0], hd[1], ha);
  // the jaw hangs from the back of the head and opens down
  const jaw = head.child(-2, 2, p.jaw);
  f.part(jaw, [[-2, -1], [14, 0], [15, 2], [12, 3.5], [-1, 3]], 'red', 4.9, { dim: 1, details: [[4, -0.5, 'white', 5], [8, -0.5, 'white', 5], [12, 0, 'white', 5]] });
  if (p.gather) f.part(jaw, ell(6, 0, 3 * p.gather + 1, 1.5 * p.gather + 0.5, 12), 'fire', 4.95, { outline: false }); // fire in the throat
  f.part(head, [[-5, -4], [0, -6], [8, -5], [16, -2.5], [17, 0], [14, 2], [2, 3], [-5, 2]], 'red', 5, {
    details: [[5, -3, 'fire', 6], [6, -3, 'fire', 5], [15, -1.5, 'red', 1], [4, 1.5, 'white', 5], [9, 1.5, 'white', 5]],
  }); // skull and snout: a burning eye, a nostril, teeth
  f.part(head, [[3, -5], [8, -5.5], [7, -6.8], [3.5, -6.2]], 'red', 5.05, { dim: 1 }); // brow ridge
  f.part(head.child(-3, -4, -0.9), [[-1.5, 0], [1.5, 0], [0, -9]], 'white', 4.8, { dim: 1 }); // far horn
  f.part(head.child(-1, -4.5, -1.1), [[-1.8, 0], [1.8, 0], [-0.5, -11]], 'white', 5.2); // near horn
  f.part(head.child(-5, 0, 0.4), [[0, -2], [0, 2], [-5, 0]], 'red', 4.7, { dim: 1 }); // cheek frill

  if (p.breath) {
    const m = jaw.at(15, -1), a = ha + p.jaw * 0.5, L = p.breath;
    const cone = new Bone(m[0], m[1], a - Math.PI / 2);
    const s = L * 0.28;
    f.part(cone, [[0, -1.5], [s * 0.5, L * 0.3], [s * 0.8, L * 0.6], [s * 1.2, L * 0.85], [s * 0.4, L], [-s * 0.3, L * 0.9], [-s * 1.1, L * 0.75], [-s * 0.7, L * 0.4], [-2, 0]], 'fire', 12, { profile: 'flat', outline: false });
    f.part(cone, [[0, 0], [s * 0.35, L * 0.4], [0, L * 0.7], [-s * 0.4, L * 0.45]], 'glow', 12.1, { profile: 'flat', outline: false }); // white-hot core
  }

  leg(-13, true);
  leg(12, true);
  wing(true);
  return f;
}

const beat = (i: number, n: number) => Math.cos((2 * Math.PI * i) / n); // wing beat, 1 = up
const IDLE = Array.from({ length: 4 }, (_, i) => pose({ wing: beat(i, 4), y: 40 - 2 * beat(i, 4), tail: (i * Math.PI) / 2, neck: 0.05 * beat(i, 4) }));
const WALK = Array.from({ length: 8 }, (_, i) => pose({ wing: beat(i, 4), y: 40 - 2.5 * beat(i, 4), tilt: 0.08, tail: (i * Math.PI) / 4, neck: -0.2 }));
// a snap of the jaws: rear, open wide, lunge and bite (impact), recover
const ATTACK: [number, Pose][] = [
  [200, pose({ wing: 0.3 })],
  [120, pose({ wing: 0.8, neck: 0.6, jaw: 0.3, tilt: -0.08 })],
  [100, pose({ wing: 1, neck: 0.9, jaw: 0.7, tilt: -0.12, y: 42 })],
  [70, pose({ wing: -0.4, neck: -0.7, jaw: 0.6, tilt: 0.12 })],
  [180, pose({ wing: -0.9, neck: -0.9, jaw: 0.05, tilt: 0.16, y: 38 })],
  [150, pose({ wing: -0.2, neck: -0.2, tilt: 0.04 })],
];
// fire breath: rear up and draw breath, fire gathering in the throat (held over the telegraph) | the cone bursts out (impact), sweeps, dies
const SPECIAL: [number, Pose][] = [
  [220, pose({ wing: 0.6, neck: 0.5, tilt: -0.1, y: 44 })],
  [260, pose({ wing: 1, neck: 1, tilt: -0.18, y: 46, jaw: 0.25, gather: 0.6 })],
  [320, pose({ wing: 1, neck: 1.2, tilt: -0.22, y: 47, jaw: 0.35, gather: 1 })],
  [200, pose({ wing: -0.8, neck: -0.5, tilt: 0.1, y: 42, jaw: 0.7, breath: 44 })],
  [300, pose({ wing: -0.3, neck: -0.7, tilt: 0.14, y: 41, jaw: 0.7, breath: 52 })],
  [220, pose({ wing: 0.2, neck: -0.2, tilt: 0.04, jaw: 0.2, breath: 14 })],
];
const HURT: [number, Pose][] = [
  [100, pose({ wing: 0.9, neck: 0.8, tilt: -0.2, jaw: 0.5, y: 43 })],
  [150, pose({ wing: 0.4, neck: 0.4, tilt: -0.1, jaw: 0.2, y: 42 })],
];
// it lurches, falls out of the air, and slumps on the ground with its wings folded
const DEATH: [number, Pose][] = [
  [150, pose({ wing: 1, neck: 1, tilt: -0.25, jaw: 0.6, y: 44 })],
  [180, pose({ wing: 0.5, neck: 0.4, tilt: 0.15, jaw: 0.4, y: 30, legs: 0.4, fold: 0.2 })],
  [180, pose({ wing: 0.2, neck: -0.3, tilt: 0.25, jaw: 0.3, y: 20, legs: 0.8, fold: 0.5 })],
  [220, pose({ neck: -0.9, tilt: 0.12, jaw: 0.2, y: 16, legs: 1, fold: 0.8 })],
  [400, pose({ neck: -1.1, tilt: 0.05, jaw: 0.25, y: 15, legs: 1, fold: 1, tail: 1 })],
];

export const sprite: SpriteDef = {
  id: 'dragon', w: W, h: H, anchor: [X0, GROUND], tall: 64,
  anims: {
    idle: IDLE.map((p) => [180, dragon(p)]),
    walk: WALK.map((p) => [100, dragon(p)]),
    attack: ATTACK.map(([ms, p]) => [ms, dragon(p)]),
    hurt: HURT.map(([ms, p]) => [ms, dragon(p)]),
    death: DEATH.map(([ms, p]) => [ms, dragon(p)]),
    special: SPECIAL.map(([ms, p]) => [ms, dragon(p)]),
  },
  impact: 4,
  specialImpact: 3,
};
