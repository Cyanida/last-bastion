/**
 * #184: the menus' icon atlas, drawn by the rig like the sprites and props, and rendered by `npm run art` into
 * public/sprites/ui-icons.png (one row, a 20 px cell per icon) plus src/ui/icons.css (a class per icon: `kit-icon i-<id>`).
 * Same light, ramps and outlines as the Paladin. The CSS scales them with --s, pixelated.
 */
import { Bone, ell, Figure, limb, type Material, type Pt } from '../rig';
import { png } from '../png';

const S = 20; // cell size
const O = new Bone(0, 0);
const dots = (pts: Pt[], mat: Material, tone: number): [number, number, Material, number][] => pts.map(([x, y]) => [x + 0.5, y + 0.5, mat, tone]);

function coin(): Figure {
  const f = new Figure(S, S);
  f.part(O, ell(10, 10, 7, 7, 24), 'gold', 0, { trim: ['gold', 1], details: dots([[7, 6], [7, 7], [8, 6]], 'gold', 6) });
  f.part(O, ell(10, 10, 4, 4, 16), 'gold', 1, { dim: 1, outline: false }); // the stamped face
  return f;
}
function rune(): Figure {
  const f = new Figure(S, S);
  f.part(O, [[10, 2], [17, 10], [10, 18], [3, 10]], 'violet', 0, { details: dots([[7, 8], [8, 7]], 'violet', 6) });
  f.part(O, [[10, 6], [13, 10], [10, 14], [7, 10]], 'shade', 1); // the glowing core
  return f;
}
function crown(): Figure {
  const f = new Figure(S, S);
  f.part(O, [[2, 6], [6, 10], [10, 3], [14, 10], [18, 6], [16, 16], [4, 16]], 'gold', 0, { details: dots([[10, 5], [2, 7], [17, 7]], 'gold', 6) });
  f.part(O, ell(10, 12.5, 1.8, 1.8, 10), 'red', 1);
  return f;
}
function sword(): Figure {
  const f = new Figure(S, S);
  const b = limb([16, 4], [3, 17]); // down the blade, point at the top right
  f.part(b, [[-1.8, 0], [1.8, 0], [1.8, 10], [-1.8, 10]], 'steel', 0, { details: [[0, 3, 'steel', 6], [0, 5, 'steel', 6]] });
  f.part(b, [[-1.8, 0], [0, -2.2], [1.8, 0]], 'steel', 0.1);
  f.part(b, [[-4.5, 10], [4.5, 10], [4.5, 12], [-4.5, 12]], 'gold', 1); // guard
  f.part(b, [[-1.1, 12], [1.1, 12], [1.1, 15], [-1.1, 15]], 'leather', 0.5);
  return f;
}
function flame(): Figure {
  const f = new Figure(S, S);
  f.part(O, [[10, 2], [15, 8], [16, 13], [13, 18], [7, 18], [4, 13], [5, 9], [8, 11]], 'fire', 0);
  f.part(O, [[10, 8], [13, 13], [11, 17], [9, 17], [7, 14]], 'glow', 1, { profile: 'flat', outline: false });
  return f;
}
function frost(): Figure {
  const f = new Figure(S, S);
  f.part(O, [[10, 2], [14, 6], [14, 14], [10, 18], [6, 14], [6, 6]], 'blue', 0, { details: dots([[8, 5], [8, 6], [8, 7]], 'blue', 6) });
  f.part(O, [[3, 8], [6, 7], [6, 13], [3, 12]], 'blue', -1, { dim: 1 }); // side shards
  f.part(O, [[17, 8], [14, 7], [14, 13], [17, 12]], 'blue', -1, { dim: 1 });
  return f;
}
function storm(): Figure {
  const f = new Figure(S, S);
  f.part(O, [[12, 2], [5, 11], [9.5, 11], [7, 18], [15, 8], [10.5, 8], [14.5, 2]], 'glow', 0);
  return f;
}
function holy(): Figure {
  const f = new Figure(S, S);
  f.part(O, ell(10, 8, 4.5, 4.5, 16), 'glow', 0, { profile: 'flat' }); // the halo behind the crossing
  f.part(O, [[8.5, 2], [11.5, 2], [11.5, 6.5], [16, 6.5], [16, 9.5], [11.5, 9.5], [11.5, 18], [8.5, 18], [8.5, 9.5], [4, 9.5], [4, 6.5], [8.5, 6.5]], 'white', 1);
  return f;
}
function blood(): Figure {
  const f = new Figure(S, S);
  f.part(O, [[10, 2], [14, 8], [15.5, 12], ...ell(10, 12.5, 5.5, 5.5, 16).filter(([, y]) => y > 12.5), [4.5, 12], [6, 8]], 'red', 0, { details: dots([[7, 11], [7, 12]], 'red', 6) });
  return f;
}
function skull(): Figure {
  const f = new Figure(S, S);
  const dome = Array.from({ length: 15 }, (_, i): Pt => { const a = Math.PI * (0.85 + 1.3 * (i / 14)); return [10 + 7 * Math.cos(a), 9 + 6.5 * Math.sin(a)]; }); // over the top, left to right
  f.part(O, [...dome, [14, 13], [13, 17], [7, 17], [6, 13]], 'bone', 0, { details: dots([[9, 16], [11, 16]], 'bone', 1) });
  f.part(O, ell(7.5, 10, 1.9, 1.9, 10), 'stone', 1, { dim: 3 });
  f.part(O, ell(12.5, 10, 1.9, 1.9, 10), 'stone', 1, { dim: 3 });
  return f;
}
/** The tab bar's Map and Keep. */
function flag(): Figure {
  const f = new Figure(S, S);
  f.part(O, [[4, 2], [6, 2], [6, 18], [4, 18]], 'bark', 0);
  f.part(O, [[6, 3], [17, 4], [14, 7.5], [17, 11], [6, 11]], 'red', 1, { folds: [0.6, 4, 0], details: dots([[9, 6]], 'gold', 5) });
  return f;
}
function tower(): Figure {
  const f = new Figure(S, S);
  f.part(O, [[3, 3], [6, 3], [6, 5], [8.5, 5], [8.5, 3], [11.5, 3], [11.5, 5], [14, 5], [14, 3], [17, 3], [17, 8], [3, 8]], 'stone', 0); // battlements
  f.part(O, [[4, 8], [16, 8], [16, 18], [4, 18]], 'stone', 0.5, { details: dots([[7, 11], [8, 11], [13, 14], [12, 14]], 'stone', 2) });
  f.part(O, [[8, 18], [8, 13], [10, 11], [12, 13], [12, 18]], 'bark', 1); // the gate
  return f;
}

/** Atlas order: the CSS indexes by it. */
export const ICONS: [id: string, draw: () => Figure][] = [
  ['gold', coin], ['runes', rune], ['crown', crown],
  ['steel', sword], ['flame', flame], ['frost', frost], ['storm', storm], ['holy', holy], ['blood', blood], ['grave', skull],
  ['map', flag], ['keep', tower],
];

export const iconPaths = { png: 'public/sprites/ui-icons.png', css: 'src/ui/icons.css' };

export function buildIcons(): { png: Buffer; css: string } {
  const W = S * ICONS.length;
  const px = new Uint8Array(W * S * 4);
  ICONS.forEach(([id, draw], i) => {
    for (const [q, c] of draw().render()) {
      const x = q % S, y = (q - x) / S;
      if (x === 0 || y === 0 || x === S - 1 || y === S - 1) throw new Error(`icon ${id} touches its cell edge`);
      px.set([1, 3, 5].map((k) => parseInt(c.slice(k, k + 2), 16)).concat(255), (y * W + i * S + x) * 4);
    }
  });
  const css = [
    '/* Generated by `npm run art` from tools/art/ui/icons.ts (#184): do not edit. */',
    `.kit-icon { --s: 1; display: inline-block; flex: none; width: calc(${S}px * var(--s)); height: calc(${S}px * var(--s)); vertical-align: middle; background: url('/sprites/ui-icons.png') no-repeat; background-size: calc(${W}px * var(--s)) calc(${S}px * var(--s)); image-rendering: pixelated; }`,
    ...ICONS.map(([id], i) => `.kit-icon.i-${id} { background-position: calc(${-i * S}px * var(--s)) 0; }`),
  ].join('\n') + '\n';
  return { png: png(W, S, px), css };
}
