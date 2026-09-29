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
/** The crown; the tier crowns (#185) are the same crown in their metal with their stone. */
function crown(metal: Material = 'gold', stone: Material = 'red'): () => Figure {
  return () => {
    const f = new Figure(S, S);
    f.part(O, [[2, 6], [6, 10], [10, 3], [14, 10], [18, 6], [16, 16], [4, 16]], metal, 0, { details: dots([[10, 5], [2, 7], [17, 7]], metal, 6) });
    f.part(O, ell(10, 12.5, 1.8, 1.8, 10), stone, 1);
    return f;
  };
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

/** #185: the champion tab: a great helm. */
function helm(): Figure {
  const f = new Figure(S, S);
  f.part(O, [[5, 5], [8, 2.5], [12, 2.5], [15, 5], [15.5, 17], [4.5, 17]], 'steel', 0, { details: dots([[7, 5], [7, 6]], 'steel', 6) });
  f.part(O, [[5, 8.5], [15, 8.5], [15, 10], [5, 10]], 'darksteel', 1, { dim: 2, outline: false }); // the eye slit
  f.part(O, [[9.3, 10], [10.7, 10], [10.7, 16], [9.3, 16]], 'gold', 1, { profile: 'flat' }); // the brass nasal
  return f;
}
/** #185: the relics tab: a cut gem in a gold setting. Also the rarity gems, one per frame colour. */
function gem(mat: Material): () => Figure {
  return () => {
    const f = new Figure(S, S);
    f.part(O, [[6, 3], [14, 3], [18, 8], [10, 18], [2, 8]], mat, 0, { details: dots([[6, 5], [7, 4], [8, 4]], mat, 6) });
    f.part(O, [[2, 8], [18, 8], [10, 18]], mat, 1, { dim: 1, profile: 'flat' }); // the lower facets, in shadow
    return f;
  };
}
function relic(): Figure {
  const f = new Figure(S, S);
  f.part(O, ell(10, 10.5, 7.5, 7.5, 24), 'gold', 0, { details: dots([[5, 6], [6, 5]], 'gold', 6) });
  f.part(O, [[10, 5], [14.5, 10.5], [10, 16], [5.5, 10.5]], 'amethyst', 1, { details: dots([[8, 9], [9, 8]], 'amethyst', 6) });
  return f;
}
/** #185: the deeds tab: a sealed scroll. */
function scroll(): Figure {
  const f = new Figure(S, S);
  f.part(O, [[4, 4], [16, 4], [16, 16], [4, 16]], 'bone', 0, { details: dots([[6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [11, 7], [12, 7], [13, 7], [6, 10], [7, 10], [8, 10], [9, 10], [10, 10], [11, 10]], 'bone', 2) });
  f.part(O, [[2.5, 2.5], [17.5, 2.5], [17.5, 5.5], [2.5, 5.5]], 'leather', 1); // the rollers
  f.part(O, [[2.5, 14.5], [17.5, 14.5], [17.5, 17.5], [2.5, 17.5]], 'leather', 1);
  f.part(O, ell(13.5, 12.5, 2.2, 2.2, 12), 'red', 2); // the wax seal
  return f;
}
/** #185: settings: a gear. */
function gear(): Figure {
  const f = new Figure(S, S);
  const teeth = Array.from({ length: 32 }, (_, i): Pt => {
    const a = (i / 32) * Math.PI * 2 + Math.PI / 32, r = i % 4 < 2 ? 8.2 : 6;
    return [10 + r * Math.cos(a), 10 + r * Math.sin(a)];
  });
  f.part(O, teeth, 'steel', 0, { details: dots([[6, 5], [5, 6]], 'steel', 6) });
  f.part(O, ell(10, 10, 2.4, 2.4, 12), 'darksteel', 1, { dim: 2 }); // the axle hole
  return f;
}
/** #185: back: an arrow pointing left. */
function back(): Figure {
  const f = new Figure(S, S);
  f.part(O, [[2.5, 10], [9, 3.5], [9, 7.5], [17, 7.5], [17, 12.5], [9, 12.5], [9, 16.5]], 'white', 0, { details: dots([[10, 8]], 'white', 6) });
  return f;
}
/** #185: close: a red cross. */
function close(): Figure {
  const f = new Figure(S, S);
  f.part(O, [[3, 5.5], [5.5, 3], [10, 7.5], [14.5, 3], [17, 5.5], [12.5, 10], [17, 14.5], [14.5, 17], [10, 12.5], [5.5, 17], [3, 14.5], [7.5, 10]], 'red', 0, { details: dots([[5, 5], [6, 5]], 'red', 6) });
  return f;
}
/** #185: sound: a horn-speaker with its waves. */
function sound(): Figure {
  const f = new Figure(S, S);
  f.part(O, [[2.5, 7.5], [6, 7.5], [11, 3], [11, 17], [6, 12.5], [2.5, 12.5]], 'steel', 0, { details: dots([[4, 8]], 'steel', 6) });
  f.part(O, [[13, 7], [14.5, 6], [16, 10], [14.5, 14], [13, 13], [14, 10]], 'white', 1, { profile: 'flat' });
  return f;
}
/** #185: music: a pair of joined notes. */
function music(): Figure {
  const f = new Figure(S, S);
  f.part(O, [[7, 4.5], [17, 2.5], [17, 5], [8.5, 7]], 'gold', 1, { profile: 'flat' }); // the beam
  f.part(O, [[7, 5], [8.5, 5], [8.5, 15], [7, 15]], 'gold', 0.5, { profile: 'flat', outline: false });
  f.part(O, [[15.5, 3], [17, 3], [17, 13], [15.5, 13]], 'gold', 0.5, { profile: 'flat', outline: false });
  f.part(O, ell(5.8, 15, 2.8, 2.2, 14), 'gold', 1, { details: dots([[5, 14]], 'gold', 6) });
  f.part(O, ell(14.3, 13, 2.8, 2.2, 14), 'gold', 1);
  return f;
}
/** #185: locked: a padlock. */
function lock(): Figure {
  const f = new Figure(S, S);
  const arc = (r: number): Pt[] => Array.from({ length: 11 }, (_, i): Pt => [10 - r * Math.cos((Math.PI * i) / 10), 8 - r * Math.sin((Math.PI * i) / 10)]);
  f.part(O, [...arc(5.5), [15.5, 10], [13.5, 10], ...arc(3.5).reverse(), [6.5, 10], [4.5, 10]], 'steel', 0); // the shackle
  f.part(O, [[3.5, 9], [16.5, 9], [16.5, 18], [3.5, 18]], 'gold', 1, { details: dots([[5, 10], [6, 10]], 'gold', 6) });
  f.part(O, [[9, 12], [11, 12], [11, 15.5], [9, 15.5]], 'gold', 2, { dim: 4, outline: false }); // the keyhole
  return f;
}

/** Atlas order: the CSS indexes by it. New icons go at the end, so their classes keep their place. */
export const ICONS: [id: string, draw: () => Figure][] = [
  ['gold', coin], ['runes', rune], ['crown', crown()],
  ['steel', sword], ['flame', flame], ['frost', frost], ['storm', storm], ['holy', holy], ['blood', blood], ['grave', skull],
  ['map', flag], ['keep', tower],
  // #185: the rest of the tab bar, the controls and the tier crowns and rarity gems the next screens need
  ['champion', helm], ['relics', relic], ['deeds', scroll], ['settings', gear], ['back', back], ['close', close], ['sound', sound], ['music', music], ['lock', lock],
  ['crown-squire', crown('leather', 'stone')], ['crown-knight', crown('steel', 'blue')], ['crown-champion', crown('gold', 'red')], ['crown-legend', crown('glow', 'soul')],
  ['common', gem('white')], ['rare', gem('blue')], ['legendary', gem('ember')], ['class', gem('venom')], ['signature', gem('glow')],
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
