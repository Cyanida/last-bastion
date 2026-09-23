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
  engineer: [
    '....kkkk....',
    '...kBBBBk...',
    '...kssssk...',
    '...kckkck...',
    '...kssssk.DD',
    '..kkbbbbkkDD',
    '.kBkbBBbkskb',
    '.kBkbBBbk..b',
    '.kskbBBbk..b',
    '..kkbbbbk...',
    '...kBkkBk...',
    '...kBkkBk...',
    '...kBkkBk...',
    '...kk..kk...',
  ],
  ballista: [
    '....k....k....',
    '...kbk..kbk...',
    '..kbk....kbk..',
    '.kbkkkkkkkkbk.',
    'kbkBBBBBBBBkbk',
    '.kbkSSSSSSkbk.',
    '..kkBBBBBBkk..',
    '..kDk....kDk..',
    '..kDk....kDk..',
    '..kkk....kkk..',
  ],
  plagueDoctor: [
    '....kkkk....',
    '...khhhhk...',
    '..khhhhhhk..',
    '...knnnnk...',
    '...kcnnnnk..',
    '...knnnkk...',
    '..kkhhhhkk.L',
    '.khkhhhhkhkL',
    '.khkhGGhksLk',
    '.kskhhhhk.L.',
    '..kkhhhhk...',
    '..khhhhhhk..',
    '.khhhhhhhhk.',
    '.kkkkkkkkkk.',
  ],
  houndmaster: [
    '....kkkk....',
    '...kbbbbk...',
    '..kbbbbbbk..',
    '...kssssk...',
    '...kskksk.w.',
    '...kssssk.w.',
    '..kkBBBBkkw.',
    '.kBkBbbBksw.',
    '.kBkBbbBk...',
    '.kskBBBBk...',
    '..kkbbbbk...',
    '...kbkkbk...',
    '...kbkkbk...',
    '...kk..kk...',
  ],
  mirrorKnight: [
    '.....cc.....',
    '....kcck....',
    '...kSSSSk...',
    '...kSkkSk...',
    '...kSSSSk..w',
    '..kkccccckkw',
    '.kckcwwckSkw',
    'kcwkcwwckskw',
    'kwckcwwckkS.',
    'kcckcccck...',
    '.kkkSSSSk...',
    '...kSkkSk...',
    '...kSkkSk...',
    '...kk..kk...',
  ],
  siegeTower: [
    '..kkkkkkkkkkkk..',
    '..kBkBkBkBkBkk..',
    '..kBBBBBBBBBBk..',
    '..kbbbbbbbbbbk..',
    '..kBBkkBBkkBBk..',
    '..kBBkkBBkkBBk..',
    '..kbbbbbbbbbbk..',
    '..kBBBBBBBBBBk..',
    '..kBBBBRRBBBBk..',
    '..kBBBBRRBBBBk..',
    '..kbbbbbbbbbbk..',
    '..kBBBBBBBBBBk..',
    '..kBBBkkkkBBBk..',
    '..kBBBkhhkBBBk..',
    '..kBBBkhhkBBBk..',
    '.kkkkkkkkkkkkkk.',
    '.kDDk......kDDk.',
    '..kk........kk..',
  ],
  assassin: [
    '....kkkk....',
    '...khhhhk...',
    '..khhhhhhk..',
    '..khskkshk..',
    '...khhhhk...',
    '..kkhhhhkk.S',
    '.khkhrrhkhkS',
    '.khkhhhhkskk',
    '.kskhhhhk...',
    '..kkhhhhk...',
    '...khkkhk...',
    '...khkkhk...',
    '...kk..kk...',
  ],
  shieldwall: [
    '..........w.',
    '....kkkk..w.',
    '...kSSSSk.b.',
    '...kSkkSk.b.',
    '...kSSSSkkbk',
    '..kkGGGGkBBk',
    '.kGkGGGGkBBk',
    '.kGkGGGGkBgk',
    '.kskGGGGkBgk',
    '..kkGGGGkBBk',
    '...kGGGGkBBk',
    '...kDkkDkkkk',
    '...kDkkDk...',
    '...kk..kk...',
  ],
  boneCollector: [
    '............',
    '....kkkk....',
    '...knnnnk.kk',
    '...kcnnckknk',
    '...knnnnkknk',
    '..kkppppknnk',
    '.kpkppppknnk',
    '.knkpPPpkknk',
    '.knkpPPpk.kk',
    '..kkppppk...',
    '..kppppppk..',
    '..kpkkkkpk..',
    '..knk..knk..',
    '..kk....kk..',
  ],
  dragon: [
    '..................kk',
    '.k..............kkRk',
    'kRk....kkkk....kRRRk',
    'kRRk..kRRRRk..kRoRkk',
    '.kRRkkRRRRRRkkRRRk..',
    '..kRRRRRRRRRRRRRk...',
    '...kRRRRooRRRRRk....',
    '..kkRRRooooRRRkk....',
    '.kRkkRRRooRRRkkRk...',
    'kRk..kRRRRRRk..kRk..',
    'kk....kRkkRk....kk..',
    '......kRk.kRk.......',
    '......kkk.kkk.......',
  ],
  warden: [
    '......kkkk......',
    '.....kDDDDk.....',
    '....kDDDDDDk....',
    '....kDkggkDk....',
    '....kDDDDDDk..DD',
    '.....kkDDkk..DDD',
    '...kkkSSSSkkk.DD',
    '..kSSkSggSkSSk.b',
    '.kSSDkSggSkDSSkb',
    '.kSDDkSSSSkDDskb',
    '.kskkkSSSSkkk.b.',
    '..k.kDDDDDDk..b.',
    '....kDDggDDk....',
    '...kDDDkkDDDk...',
    '...kDDk..kDDk...',
    '...kDDk..kDDk...',
    '..kSSSk..kSSSk..',
    '..kkkkk..kkkkk..',
  ],
  bannerman: [
    '..kkkk.bRRRR',
    '.kSSSSkbRggR',
    '.kSkkSkbRRRR',
    '.kSSSSkbRRR.',
    '..kkkk.b....',
    '.kkRRRRsk...',
    'kRkRggRkk...',
    'kRkRggRk....',
    'kskRRRRk....',
    '.kkRRRRk....',
    '..kDkkDk....',
    '..kDkkDk....',
    '..kDkkDk....',
    '..kk..kk....',
  ],
  drummer: [
    '....kkkk....',
    '...kbbbbk...',
    '...kssssk...',
    '...kskksk...',
    '...kssssk...',
    '..kkGGGGkk..',
    '.kGkGGGGkGk.',
    '.kskkwwwkks.',
    '..kkBwwwBk..',
    '...kBBBBBk..',
    '...kkBBBkk..',
    '...kGkkGk...',
    '...kGkkGk...',
    '...kk..kk...',
  ],
  chaplain: [
    '....kkkk..g.',
    '...kwwwwkggg',
    '...kwwwwk.g.',
    '...kskksk.g.',
    '...kssssk.g.',
    '..kkwPPwkkg.',
    '.kwkwPPwksg.',
    '.kwkwPPwk.g.',
    '.kskwPPwk.g.',
    '..kkwPPwk.g.',
    '..kwwPPwwk..',
    '..kwwwwwwk..',
    '.kwwwwwwwwk.',
    '.kkkkkkkkkk.',
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
  // v0.6: the end of the run. A crowned king in black-and-gold plate, a red cape, the greatsword he took the throne with.
  usurper: [
    '.....g.gg.g.....',
    '.....gggggg.....',
    '....kgRggRgk....',
    '....khhhhhhk...w',
    '....khyhhyhk...w',
    '....kkhhhhkk...w',
    '.rrkkgggggggkk.w',
    'rRkhhkhggghkhhkw',
    'rRkhhkhgRghkhhkw',
    'rRkhhkhggghkkskw',
    'rRkggkhhhhhk.ggg',
    'rrkkkhhgghhk..y.',
    '.r.khhhhhhhhk...',
    '...khhhkkhhhk...',
    '...khhk..khhk...',
    '...khhk..khhk...',
    '..kgggk..kgggk..',
    '..kkkkk..kkkkk..',
  ],
  // his ward's anchor: a gilded brazier on an iron stand
  royalFlame: [
    '.....yy.....',
    '....yooy....',
    '...yoRRoy...',
    '..yoRRRRoy..',
    '..oRRyyRRo..',
    '..oRyyyyRo..',
    'kkkkkkkkkkkk',
    'kggggggggggk',
    '..kDDDDDDk..',
    '...kDDDDk...',
    '....kDDk....',
    '....kDDk....',
    '...kDDDDk...',
    '..kkkkkkkk..',
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

/** v0.4 mastery palettes: a canvas filter over the class sprite (0 = as drawn; Ashen, Gilded, Midnight). v0.5: Frost and Verdant tint treasure guardians only. */
export const SPRITE_PALETTES = ['', 'saturate(0.35) brightness(1.1)', 'sepia(1) saturate(2.2) hue-rotate(-10deg) brightness(1.1)', 'hue-rotate(200deg) saturate(1.3) brightness(0.8)', 'sepia(1) hue-rotate(160deg) saturate(2.5) brightness(1.15)', 'sepia(1) hue-rotate(60deg) saturate(2.2) brightness(0.95)'];

function rasterize(rows: string[], scale: number, white: boolean, flip: boolean, palette = 0): HTMLCanvasElement {
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
  if (palette > 0 && !white && SPRITE_PALETTES[palette] && 'filter' in ctx) {
    // recolour once, here, so the frame never pays for a filter
    const tinted = document.createElement('canvas');
    tinted.width = c.width;
    tinted.height = c.height;
    const t = tinted.getContext('2d')!;
    t.filter = SPRITE_PALETTES[palette];
    t.drawImage(c, 0, 0);
    return tinted;
  }
  return c;
}

const cache = new Map<string, Sprite>();

export function getSprite(id: SpriteId, scale: number, palette = 0): Sprite {
  const key = `${id}@${scale}@${palette}`;
  let s = cache.get(key);
  if (!s) {
    const rows = SPRITES[id];
    s = {
      w: rows[0].length * scale,
      h: rows.length * scale,
      img: rasterize(rows, scale, false, false, palette),
      flipped: rasterize(rows, scale, false, true, palette),
      flash: rasterize(rows, scale, true, false),
      flashFlipped: rasterize(rows, scale, true, true),
    };
    cache.set(key, s);
  }
  return s;
}

// ---------------------------------------------------------------- v0.4 render caches
// Paths (ellipse, arc, text outlines) are the expensive canvas commands. Anything drawn hundreds of times a frame
// is rendered once into a small canvas here and blitted with drawImage afterwards.

const shadows = new Map<number, HTMLCanvasElement>();
/** A soft ellipse shadow for a body of radius r (rounded to whole pixels, so hordes share a few sprites). */
export function shadowSprite(r: number): HTMLCanvasElement {
  const key = Math.round(r);
  let c = shadows.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = key * 2 + 2;
    c.height = Math.ceil(key * 0.9) + 2;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(c.width / 2, c.height / 2, key, key * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    shadows.set(key, c);
  }
  return c;
}

const rings = new Map<string, HTMLCanvasElement>();
/** A flat ground ring (elite affixes, commander auras): radius rx by ry, stroked in `color`. */
export function ringSprite(color: string, rx: number, ry: number, width = 3, dashed = false): HTMLCanvasElement {
  rx = Math.round(rx);
  ry = Math.round(ry);
  const key = `${color}|${rx}|${ry}|${width}|${dashed ? 1 : 0}`;
  let c = rings.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = rx * 2 + width * 2 + 2;
    c.height = ry * 2 + width * 2 + 2;
    const ctx = c.getContext('2d')!;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    if (dashed) ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.ellipse(c.width / 2, c.height / 2, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    rings.set(key, c);
  }
  return c;
}

const texts = new Map<string, HTMLCanvasElement>();
function renderText(text: string, size: number, color: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  const font = `bold ${size}px Georgia, serif`;
  const probe = c.getContext('2d')!;
  probe.font = font;
  c.width = Math.ceil(probe.measureText(text).width) + 6;
  c.height = size + 6;
  const ctx = c.getContext('2d')!;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#1a1614';
  ctx.strokeText(text, c.width / 2, c.height / 2);
  ctx.fillStyle = color;
  ctx.fillText(text, c.width / 2, c.height / 2);
  return c;
}
/** A word rendered once (outline + fill): "FROZEN", "blocked", "+18 gold". Bounded LRU so the map cannot grow forever. */
export function textSprite(text: string, size: number, color: string, limit: number): HTMLCanvasElement {
  const key = `${text}|${size}|${color}`;
  let c = texts.get(key);
  if (c) return c;
  c = renderText(text, size, color);
  if (texts.size >= limit) texts.delete(texts.keys().next().value!); // oldest entry
  texts.set(key, c);
  return c;
}

const GLYPHS = '0123456789!-+';
const atlases = new Map<string, HTMLCanvasElement[]>();
/**
 * Damage numbers change every hit, so caching whole strings would create a canvas per hit. Instead each
 * (size, colour) gets one atlas of glyphs, and a number is blitted digit by digit: 3 draws for "142", no allocation.
 */
export function digitGlyphs(size: number, color: string): HTMLCanvasElement[] {
  const key = `${size}|${color}`;
  let a = atlases.get(key);
  if (!a) atlases.set(key, (a = [...GLYPHS].map((ch) => renderText(ch, size, color))));
  return a;
}
export const isNumeric = (text: string): boolean => {
  for (let i = 0; i < text.length; i++) if (GLYPHS.indexOf(text[i]) < 0) return false;
  return true;
};
export const glyphIndex = (ch: string): number => GLYPHS.indexOf(ch);

let fogTile: { canvas: HTMLCanvasElement; zoom: number; vision: number } | null = null;
/**
 * The Fog modifier as a cached tile: a square of fog with a soft hole in the middle. The renderer blits it
 * centred on the player and fills the rest of the screen with four rectangles, instead of a full-screen
 * radial gradient every frame.
 */
export function fogSprite(vision: number, zoom: number): HTMLCanvasElement {
  if (fogTile && fogTile.zoom === zoom && fogTile.vision === vision) return fogTile.canvas;
  const outer = vision * 1.5 * zoom;
  const c = document.createElement('canvas');
  c.width = c.height = Math.ceil(outer * 2);
  const ctx = c.getContext('2d')!;
  const fog = ctx.createRadialGradient(outer, outer, vision * 0.55 * zoom, outer, outer, outer);
  fog.addColorStop(0, 'rgba(170,180,185,0)');
  fog.addColorStop(1, 'rgba(120,130,136,0.96)');
  ctx.fillStyle = fog;
  ctx.fillRect(0, 0, c.width, c.height);
  fogTile = { canvas: c, zoom, vision };
  return c;
}
