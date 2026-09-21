/** Pixel-grid sprites. One char = one pixel, looked up in PALETTE. '.' is transparent. Sprites face right. */
export const PALETTE: Record<string, string> = {
  k: '#1a1614', // outline
  s: '#c9a27a', // skin
  S: '#9a9aa0', // steel
  D: '#55565c', // dark steel
  h: '#2b2b33', // black plate
  w: '#e8e2d0', // parchment white
  g: '#c9a227', // gold
  r: '#8e1b1b', // blood red
  R: '#c23a2e', // bright red
  G: '#3d5a35', // forest green
  L: '#6f8f4e', // light green
  b: '#5a3d25', // brown
  B: '#8a6a42', // light brown
  p: '#4a2d5e', // purple
  P: '#7a4fa0', // light purple
  y: '#f2e6a0', // pale light
  c: '#7ec8d8', // soul cyan
  n: '#d8d2bd', // bone
  o: '#e07b28', // orange
};

export const SPRITES = {
  paladin: [
    '....kkkk....',
    '...kSSSSk...',
    '...kSggSk...',
    '...kDkkDk...',
    '...kSSSSk..w',
    '..kkwwwwkk.w',
    '.kSkwrrwkSkw',
    'kggkrrrrkskw',
    'kggkwrrwkkg.',
    'kggkwrrwk...',
    '.kkkwwwwk...',
    '...kSkkSk...',
    '...kSkkSk...',
    '...kk..kk...',
  ],
  viking: [
    '.w........w.',
    '.wk.kkkk.kw.',
    '..kkSSSSkk..',
    '...kSDDSk...',
    '...kskksk...',
    '...koooook..',
    '..kkoooookSS',
    '.kbkbookbkSS',
    '.kskbbbbkskS',
    '.kkkbBBbkkb.',
    '...kbbbbk.b.',
    '...kbkkbk.b.',
    '...kbkkbk...',
    '...kk..kk...',
  ],
  angel: [
    '....gggg....',
    '............',
    '....kkkk....',
    '...kyyyyk...',
    '...kskksk...',
    'w..kssssk..w',
    'ww.kwwwwk.ww',
    'wwwkwggwkwww',
    'wwwkwwwwkwww',
    '.wwkwwwwkww.',
    '..wkwwwwkw..',
    '...kwwwwk...',
    '..kwwwwwwk..',
    '..kkkkkkkk..',
  ],
  necromancer: [
    '....kkkk..c.',
    '...kppppkckc',
    '..kppppppkc.',
    '..kpkkkkpkb.',
    '..kpcnncpkb.',
    '..kppnnppkb.',
    '.kkppppppsb.',
    '.kpPppppPkb.',
    '.kpPppppPkb.',
    '.kspppppkkb.',
    '..kppppppkb.',
    '..kppppppk..',
    '.kppppppppk.',
    '.kkkkkkkkkk.',
  ],
  archer: [
    '....kkkk....',
    '...kGGGGk...',
    '..kGGGGGGk..',
    '..kGskksGk..',
    '...kssssk.b.',
    '..kkGGGGkb..',
    '.kGkGLLGkb..',
    '.kGkGLLGsb..',
    '.kskGGGGkb..',
    '..kkGbbGk.b.',
    '...kbbbbk...',
    '...kbkkbk...',
    '...kbkkbk...',
    '...kk..kk...',
  ],
  skeleton: [
    '....kkkk....',
    '...knnnnk...',
    '...kcnnck...',
    '...knnnnk...',
    '....knnk...w',
    '..kkknnkkk.w',
    '.knknnnnknkw',
    '.knkknnkknkw',
    '.knknnnnkkng',
    '..kkknnkk...',
    '...knnnnk...',
    '...knkknk...',
    '...knkknk...',
    '...kk..kk...',
  ],
  peasant: [
    '..........D.',
    '....kkkk.DDD',
    '..kBBBBBBkb.',
    '...kssssk.b.',
    '...kskksk.b.',
    '...kssssk.b.',
    '..kkBBBBkkb.',
    '.kBkBbbBksb.',
    '.kBkBbbBk.b.',
    '.kskBBBBk.b.',
    '..kkbbbbk...',
    '...kbkkbk...',
    '...kbkkbk...',
    '...kk..kk...',
  ],
  wolf: [
    '..........k.k.',
    'k........kDDDk',
    'kk..kkkkkDDRDk',
    '.kkkDDDDDDDDkk',
    '..kDDSSSDDDk..',
    '..kDDDDDDDDk..',
    '..kDk.kDkkDk..',
    '..kk..kk.kkk..',
  ],
  crossbow: [
    '............',
    '....kkkk....',
    '...kbbbbk...',
    '...kssssk...',
    '...kskksk...',
    '...kssssk.b.',
    '..kkGGGGkkbk',
    '.kGkGGGGksbb',
    '.kGkGBBGkkbk',
    '.kskGGGGk.b.',
    '..kkbbbbk...',
    '...kbkkbk...',
    '...kbkkbk...',
    '...kk..kk...',
  ],
  knight: [
    '.....RR.....',
    '....kRRk....',
    '...kDDDDk...',
    '...kDkkDk...',
    '...kDDDDk..w',
    '..kkSSSSkk.w',
    '.kDkSDDSkDkw',
    'kSSkSDDSkskw',
    'kSSkSDDSkkD.',
    'kSSkSSSSk...',
    '.kkkDDDDk...',
    '...kDkkDk...',
    '...kDkkDk...',
    '...kk..kk...',
  ],
  cultist: [
    '....kkkk....',
    '...krrrrk...',
    '..krrrrrrk..',
    '..krkkkkrk..',
    '..krokkork..',
    '..krrkkrrk..',
    '.kkrrrrrrkk.',
    'okrRrrrrRrko',
    '.krRrrrrRrk.',
    '.kkrrrrrrkk.',
    '..krrrrrrk..',
    '..krrrrrrk..',
    '.krrrrrrrrk.',
    '.kkkkkkkkkk.',
  ],
  shieldBearer: [
    '....kkkk....',
    '...kSSSSk...',
    '...kSkkSk...',
    '...kSSSSkkk.',
    '..kkDDDDkBBk',
    '.kDkDDDDkBgk',
    '.kDkDDDDkBgk',
    '.kskDDDDkBgk',
    '..kkDDDDkBBk',
    '...kDDDDkBBk',
    '...kDkkDkkk.',
    '...kDkkDk...',
    '...kDkkDk...',
    '...kk..kk...',
  ],
  priest: [
    '.....kk...g.',
    '....kwwk.gkg',
    '....kwgk..g.',
    '...kwwwwk.b.',
    '...kskksk.b.',
    '...kssssk.b.',
    '..kkwwwwkkb.',
    '.kwkwrrwksb.',
    '.kwkwrrwk.b.',
    '.kskwrrwk.b.',
    '..kkwwwwk.b.',
    '..kwwwwwwk..',
    '.kwwwwwwwwk.',
    '.kkkkkkkkkk.',
  ],
  cavalry: [
    '......kkk.......',
    '.....kSSSk......',
    '.....kSkSk......',
    '.....kSSSkwwwwww',
    '....kkRRRkk.kkk.',
    '....kRRRRRk.kBBk',
    'kk.kkRRRRRkkBBBk',
    'kbkBBBBBBBBBBkkk',
    '.kkBBBBBBBBBBk..',
    '..kBBBBBBBBBBk..',
    '..kBkkBkkkBkBk..',
    '..kBk.kBk.kBkBk.',
    '..kk..kk..kk.kk.',
  ],
  inquisitor: [
    '................',
    '...kkkkkkkkkk...',
    '..khhhhhhhhhhk..',
    '...kkkhhhhkkk.o.',
    '.....kssssk..oRo',
    '.....kskksk...o.',
    '.....kssssk...b.',
    '...kkkrrrrkkk.b.',
    '..krrkrggrkrrkb.',
    '.krrrkrggrkrrsb.',
    '.krrkkrrrrkkk.b.',
    '.kskkrrrrrrk..b.',
    '..k.krrrrrrk....',
    '....krrhhrrk....',
    '...krrrhhrrrk...',
    '...krrrhhrrrk...',
    '..krrrrhhrrrrk..',
    '..kkkkkkkkkkkk..',
  ],
  abbot: [
    '......kkkk......',
    '.....khhhhk.....',
    '....khhhhhhk....',
    '....khnnnnhk....',
    '....khcnnnnnk...',
    '....khnnnnkk....',
    '...kkkhhhhkkk...',
    '..kGGkhhhhkGGk..',
    '.kGGhkhLLhkhGGk.',
    '.kGhhkhLLhkhhnk.',
    '.knkkhhhhhhkkbk.',
    '..k.khhhhhhk.b..',
    '....khhhhhhk.L..',
    '...khhGhhGhhkLL.',
    '...khhGhhGhhk...',
    '..khhhGhhGhhhk..',
    '..khhhhhhhhhhk..',
    '..kkkkkkkkkkkk..',
  ],
  blackKnight: [
    '......kkkk......',
    '.k...khhhhk...k.',
    '.kk.khhhhhhk.kk.',
    '..kkkhRhhRhkkk..',
    '....khhhhhhk...w',
    '....kkhDDhkk...w',
    '..kkkDDDDDDkkk.w',
    '.khhkDhRRhDkhhkw',
    '.khhkDhRRhDkhhkw',
    '.khhkDDDDDDkkskw',
    '.kDDkDDDDDDk.ggg',
    '..kkkhhhhhhk..b.',
    '...khhhhhhhhk...',
    '...khhhkkhhhk...',
    '...khhk..khhk...',
    '...khhk..khhk...',
    '..kDDDk..kDDDk..',
    '..kkkkk..kkkkk..',
  ],
  warlord: [
    'w..............w',
    'wk....kkkk....kw',
    '.kk..kSSSSk..kk.',
    '..kkkSSSSSSkkk..',
    '....kssssssk....',
    '....kskssksk.DDD',
    '....kroooork.DDD',
    '..kkkkooookkkDDD',
    '.kBBkbbbbbbkBBb.',
    '.kBBkbRRRRbkBsb.',
    '.ksskbbbbbbk..b.',
    '..kkkbbggbbk..b.',
    '....kbbbbbbk....',
    '...kbbbkkbbbk...',
    '...kbbk..kbbk...',
    '...kbbk..kbbk...',
    '..kBBBk..kBBBk..',
    '..kkkkk..kkkkk..',
  ],
  lich: [
    '....g.g..g.g....',
    '....gggggggg..c.',
    '....knnnnnnk.ckc',
    '....kncnncnk..c.',
    '....knnnnnnk..b.',
    '.....knkknk...b.',
    '...kkkppppkkk.b.',
    '..kPPkppppkPPkb.',
    '.kPPpkpggpkpPnb.',
    '.kPppkppppkppkb.',
    '.knkkpppppkkk.b.',
    '..k.kppppppk..b.',
    '....kppppppk..b.',
    '...kppPppPppk...',
    '...kppPppPppk...',
    '..kpppPppPpppk..',
    '..kppppppppppk..',
    '..kkkkkkkkkkkk..',
  ],
} satisfies Record<string, string[]>;

export type SpriteId = keyof typeof SPRITES;

export interface Sprite {
  w: number;
  h: number;
  img: HTMLCanvasElement;
  flipped: HTMLCanvasElement;
  flash: HTMLCanvasElement; // white silhouette for hit flashes
  flashFlipped: HTMLCanvasElement;
}

function rasterize(rows: string[], scale: number, white: boolean, flip: boolean): HTMLCanvasElement {
  const w = rows[0].length;
  const c = document.createElement('canvas');
  c.width = w * scale;
  c.height = rows.length * scale;
  const ctx = c.getContext('2d')!;
  rows.forEach((row, y) => {
    for (let x = 0; x < w; x++) {
      const color = PALETTE[row[x]];
      if (!color) continue;
      ctx.fillStyle = white ? '#ffffff' : color;
      ctx.fillRect((flip ? w - 1 - x : x) * scale, y * scale, scale, scale);
    }
  });
  return c;
}

const cache = new Map<string, Sprite>();

export function getSprite(id: SpriteId, scale: number): Sprite {
  const key = `${id}@${scale}`;
  let s = cache.get(key);
  if (!s) {
    const rows = SPRITES[id];
    s = {
      w: rows[0].length * scale,
      h: rows.length * scale,
      img: rasterize(rows, scale, false, false),
      flipped: rasterize(rows, scale, false, true),
      flash: rasterize(rows, scale, true, false),
      flashFlipped: rasterize(rows, scale, true, true),
    };
    cache.set(key, s);
  }
  return s;
}
