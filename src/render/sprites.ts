import { spriteSize } from '../logic/spriteRes';

/** Pixel-grid sprites. One char = one pixel, looked up in PALETTE. '.' is transparent. Sprites face right. #138: the champions, the regular foes and the commanders are drawn on a grid twice as fine (SPRITE_RES). */
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
  W: '#9a4a22', // wood (#80: the Viking's axe shaft)
  E: '#5fe07a', // bright emerald (#80: the Necromancer's crystal)
  e: '#2e9a4a', // dark emerald
  // #138: shades for the finer grid's 1 px shading
  a: '#9c7656', // shaded skin
  d: '#2a3f25', // shaded green
  q: '#33203f', // shaded purple
  m: '#94761a', // shaded gold
};

export const SPRITES = {
  // #80: a steel kite shield with a gold sun, a Latin cross on the tabard, a straight longsword with a glowing tip; padded on the far side so the body stays centred on the player
  paladin: [
    '..........kkkkkkkk..........',
    '..........kwwwwwDk..........',
    '........kkSSSSSSSSkk........',
    '........kwSSSSSSSSDk........',
    '........kwSSggggSSDk....yy..',
    '........kwSSggggSSDk....yy..',
    '........kDDDkyykDDDk....ww..',
    '........kDDDSSSSDDDk....ww..',
    '........kwSSSSSSSSDk....ww..',
    '........kwSSSSSSSSDk....ww..',
    '......kkkkwwwwrrwwkkkk..ww..',
    '......kkkkwwwwrrwwkSDk..ww..',
    '..kkkkkkkkkkrrrrrrkSSSkwww..',
    '..kkggkkkkkkrrrrrrkSSSwwww..',
    '..kgggSSggkwwwrrwwkSSSgggggg',
    '..kgggSSggkwwwrrwwkSSSgggggg',
    '..kwSSyySSkwwwrrwwkSDDSSDk..',
    '..kwSSyySSkwwwrrwwkkkkSSSg..',
    '..kgggSSggkwwwrrwwnk....gg..',
    '..kgggSSggkwwwrrwwnk....gg..',
    '..kDSSSSSSkwwwrrwwnk........',
    '..kkSSSSSSkwwwrrwwnk........',
    '....kDSSkSSSkkkkSSDk........',
    '....kkSSkSSSSkkSSSDk........',
    '......kDkSSSDkDDSSDk........',
    '......kkkkSSkkkkSSDk........',
    '........kkDk....kDkk........',
    '........kkkk....kkkk........',
  ],
  // #80: short horns, a big beard and a two-handed Dane axe (W: the shaft); padded on the far side so the body stays centred on the player
  viking: [
    '....................................................',
    '....................................................',
    '..................kk............kk..................',
    '..................kk............kk..................',
    '................kknnkk..kkkk..kknnkk................',
    '................knnnBk..kwDk..knnnBk................',
    '................kBnnkSSSSSSSSSknnnBk................',
    '................kknnSSSSSSSSSSkSnnkk................',
    '..................kwSSSSSSSSSSSSDk..................',
    '..................kwSSSSSSSSSSSSDk..................',
    '..................kssskSSSSSksssak..................',
    '..................ksssooSSSSoossak..................',
    '................kkBBooooooooooBBbk..................',
    '................kBBBooooooooooBBbk..................',
    '..............kkBBssoooooooooooossBBkk..............',
    '..............kBBBssoooooooooooossBBbk..............',
    '..............kssskooooooooooooosskkkkkkkkkk........',
    '..............ksssWWoooooooooooossWWWkWWWWkk........',
    '..............kassWWWWWWWWWWWWWWssWWWWWWWWWk........',
    '..............kkssWWWWWWWWWWWWWWssWWWWWWWWWk........',
    '................kk..kbbbggbbbbbk....kwSSSSDk........',
    '................kk..kbbbggbbbbbk....SSSSSSDk........',
    '....................kbbbkkkkbbbk..kkSSSSSSSSkk......',
    '....................kbbbBkkBbbbk..kwSSSSSSSSDk......',
    '....................kBBBbkbbBBkkkkSSSSSSSSSSSSwwkk..',
    '....................kBBBkkkkBBkkkkSSSSSSSSSSSSwwkk..',
    '....................kkbk....kbkk..knwwSSSSSSwwnk....',
    '....................kkkk....kkkk..kkwwSSSSSSwwkk....',
    '....................................knwwwwwwnk......',
    '....................................kkwwwwwwkk......',
    '......................................knnnnk........',
    '......................................kkkkkk........',
  ],
  // #80: a gold collar between face and robe, blond hair, the halo above, outlined wings, a glowing orb; padded on the far side so the body stays centred on the player
  angel: [
    '......gggggggggggg......',
    '......g..........g......',
    'kk....................kk',
    'kk....................kk',
    'nnkk..kkyyyyyyyykk..kknn',
    'nnBk..kyyyyyyyyygk..knnn',
    'nnnnkyyyyyyyyyyyyyknnnnn',
    'nnnnnyyyyyyyyyyyyyynnnnn',
    'nnnnkyyykssssskyyyknnnnn',
    'nnnnkyyyssssssssyyknnnnn',
    'nnnnkyyyssssssssyyknnnnn',
    'nnnnkyyyssssssssyyknnnnn',
    'nnnnnnkkkksssskkkknnnnnn',
    'nnnnnnggggssssggggnnnnnn',
    'nnnnkgggggggggggggknnnnn',
    'nnnnkgggggggggggggknnnnn',
    'kBnnkwwwwwwwwwwwwwknnnBk',
    'kknnkwwwwwwwwwwwwwknnnkk',
    '..kBkwwwssyyyysswwknBk..',
    '..kkkkwwssyyyysswwkkkk..',
    '....kwwwwwggggwwwwnk....',
    '....kwwwwwggggwwwwnk....',
    '....kwwwwwwwwwwwwwnk....',
    '....kwwwwwwwwwwwwwnk....',
    '..kkwwwwwwwwwwwwwwwwkk..',
    '..kwwwwwwwwwwwwwwwwwnk..',
    '..kknnnnnnnnnnnnnnnnkk..',
    '..kkkkkkkkkkkkkkkkkkkk..',
  ],
  // #80: a tall pointed hood, a soul flame over a raised hand, a torn hem, a staff with an emerald (E, e) crystal; padded on the far side so the body stays centred on the player
  necromancer: [
    '..............kkkk......kkEEkk..',
    '..............kpqk......kEEEEk..',
    '............kkppppkk..kkEEEEeekk',
    '............kpppppqk..kkEEEEeekk',
    '..........kkppppppppkk..keeeek..',
    '..........kpppppppppqk..keeeek..',
    '......cckppphhnnnnhhppkkkkbbbk..',
    '......cccppphhnnnnhhpppkkkbbbk..',
    '....cccckpppccnnnnccppkkkkbbbk..',
    '....cccckpppccnnnnccppkkkkbbbk..',
    '......nnkpppppnnnnppppkkkkbbbk..',
    '......nnkpppppnnnnppppkkkkbbbk..',
    '......kBkkkkPPppppPPkkkkkknnBk..',
    '......kkkkppPPppppPPppkkkknnBk..',
    '........kpppPPppppPPppkkkkbbbk..',
    '........kpppPPppppPPppkkkkbbbk..',
    '........kpppPPppppPPppkkkkbbbk..',
    '........kpppPPppppPPppkkkkbbbk..',
    '......kkppppPPppppPPppppkbbbbk..',
    '......kpppppPPppppPPppppkbbbbk..',
    '......kpppppPPppppPPppppkbbbbk..',
    '......kpppppPPppppPPppppkbbbbk..',
    '....kkppppppPPppppPPppppppbbbk..',
    '....kpppppppPPppppPPppppppbbbk..',
    '....kpppkpppPPppppPPkpppkbbbbk..',
    '....kpppkpppPPkpppPPkpppkbbbbk..',
    '....kk..kk..kk..kk..kk..kkbbkk..',
    '....kk..kk..kk..kk..kk..kkkkkk..',
  ],
  // #80: a longbowman: steel kettle hat, quilted green gambeson, a curved bow held close; padded on the far side so the body stays centred on the player
  archer: [
    '............kkkkkkkk............',
    '............kwwwwwDk............',
    '..........kkSSSSSSSSkk....kk....',
    '..........kwSSSSSSSSDk....kk....',
    '......kkSSSSSSSSSSSSSSSSkBBBkk..',
    '......kkSSSSSSSSSSSSSSSSkBBBbk..',
    '........kassksssssksssak..kBBBkk',
    '........kksssssssssssskk..kBBBbk',
    '..........ksssaassssak....kBBBbk',
    '..........kssssssssssk....kBBBbk',
    '........kkGGGGGGGGGGGGkk..kBBBbk',
    '........kGGGGGGGGGGGGGdk..kBBBbk',
    '......kkGGkLLLGGGGLLkGGGkkkkBBbk',
    '......kGGGkLLLGGGGLLkGGGGsksBBbk',
    '......kasskGGGLLLLGGkGGGssssBBbk',
    '......kksskGGGLLLLGGkGGGssssBBbk',
    '........kakbbbggbbbbbk....kBBBbk',
    '........kkkkbbggbbbbbk....kBBBbk',
    '..........kGGGLLLLGGdk....kBBBbk',
    '..........kGGGLLLLGGdk....kBBBkk',
    '..........kGGGGGGGGGdk....BBbk..',
    '..........kGGGGGGGGGdk....BBkk..',
    '..........kbbbkkkkbbbk....kk....',
    '..........kbbbbkkbbbbk....kk....',
    '..........kbbbbkbbbbbk..........',
    '..........kbbbkkkkbbbk..........',
    '..........kkbk....kbkk..........',
    '..........kkkk....kkkk..........',
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
    '....................DD..',
    '....................DD..',
    '........kkkkkkkk..DDDDDD',
    '........kBBBBBbk..DDDDDD',
    '....kkBBBBBBBBBBBBhbbb..',
    '....kkbBbbbbbbbbBbkkbb..',
    '......ksssssssssak..bb..',
    '......ksssassassak..bb..',
    '......kssaksskssak..bb..',
    '......ksssssssssak..bb..',
    '......kssssaasssak..bb..',
    '......kassssssssak..bb..',
    '....kkkkBBBBBBBbkkkkbb..',
    '....kbkkBBBBBBBbkkssbb..',
    '..kkBbkBBBbbbbBbksssbb..',
    '..kBBbkBBBbBbbBbkassbb..',
    '..kBBbkBBBbbBbBBbk..bb..',
    '..kBBbkBBBbbbbBBbk..bb..',
    '..kasakBBBBBBBBBbk..bb..',
    '..kkaakbBBBBBBBBbk..bb..',
    '....kakkbbbbbbbbbk......',
    '....kkkkbbbbbbbbbk......',
    '......kbbbkkkkbbbk......',
    '......kbbbkkkkbbbk......',
    '......kbbbkkkkbbbk......',
    '......kbbbkkkkbbbk......',
    '......kkbk....kbkk......',
    '......kkkk....kkkk......',
  ],
  wolf: [
    '....................kk..kk..',
    '....................hk..hk..',
    'kk................kkSDDDDhkk',
    'kk................kSDDDDDDhk',
    'kkkk....kkkkkkkkkkSDDDRyDDhk',
    'kkkk....kSDDDDDDDDDDDDRRDDhk',
    '..kkkkkkSDDDDDDDDDDDDDDDhhkk',
    '..kkkkSDDDDDDDDDDDDDDDDhkkkk',
    '....kSDDDDSSSSSSDDDDDDhk....',
    '....kDDDDDSSSSSSDDDDDDhk....',
    '....kDDDDDDDDDDDDDDDDDhk....',
    '....kDDDDhDDhDDDDDhhDDhk....',
    '....kDDDhk..kDDDhhkkDDhk....',
    '....khDhkk..khDhkkkkDDhk....',
    '....kkhk....kkhk..kkhhkk....',
    '....kkkk....kkkk..kkkkkk....',
  ],
  crossbow: [
    '........................',
    '........................',
    '........kkkkkkkk........',
    '........kbbbbbbk........',
    '......kkbbbbbbbbkk......',
    '......kbbbbbbbbbbk......',
    '......ksssssssssak......',
    '......ksssassassak......',
    '......kssaksskssak......',
    '......ksssssssssak......',
    '......kssssaasssak..bb..',
    '......kassssssssak..bb..',
    '....kkkkbGGGGGGdkkkkbbkk',
    '....kdkkGbGGGGGdkkssbbbk',
    '..kkLdkLGGbGGGGdksssbbbb',
    '..kLGdkGGGGbGGGdkassbbbb',
    '..kGGdkGGGBBBBGdkkaabbbk',
    '..kGGdkGGGBBBBGdkkkkbbkk',
    '..kasakGGGGGGGbGdk..bb..',
    '..kkaakdGGGGGGGbdk..bb..',
    '....kakkbbbbbbbbbk......',
    '....kkkkbbbbbbbbbk......',
    '......kbbbkkkkbbbk......',
    '......kbbbkkkkbbbk......',
    '......kbbbkkkkbbbk......',
    '......kbbbkkkkbbbk......',
    '......kkbk....kbkk......',
    '......kkkk....kkkk......',
  ],
  knight: [
    '..........RRRR..........',
    '..........RRRR..........',
    '........kkRRRrkk........',
    '........koRRRRrk........',
    '......kkSDDDDDDhkk......',
    '......kSDDhhhhDDhk......',
    '......kDDhkyykDDhk......',
    '......kDDDDDDDDDhk......',
    '......kDDDDDDDDDhk....ww',
    '......khDDDDDDDDhk....ww',
    '....kkkkSSSSSSSDkkkk..ww',
    '....khkkSSSSSSSDkkhk..ww',
    '..kkShkwSSDDDDSDkSDhkkww',
    '..kSDhkSSSDDDDSDkDDhkwww',
    'kkwSSDkSSSDDDDSDkssakwww',
    'kwSSSDkSSSDDDDSDkasakwww',
    'kSggSDkSSSDDDDSDkkaaDD..',
    'kSmmSDkSSSDDDDSDkkkkDD..',
    'kDSSSDkSSSSggSSSDk......',
    'kkDSSDkDSSSSSSSSDk......',
    '..kDDDkkDDDDDDDDhk......',
    '..kkkkkkDDhhhhDDhk......',
    '......kSDhkkkkDDhk......',
    '......kDDhkkkkDDhk......',
    '......kDDhkkkkDDhk......',
    '......khDhkkkkhDhk......',
    '......kkhk....khkk......',
    '......kkkk....kkkk......',
  ],
  cultist: [
    '........kkkkkkkk........',
    '........kRrrrrrk........',
    '......kkRrrrrrrrkk......',
    '......kRrrrrrrrrrk......',
    '....kkRrrrrrrrrrrrkk....',
    '....kRrrrrrrrrrrrrrk....',
    '....krrrkkkkkkkkrrrk....',
    '....krrryokkkkoyrrrk....',
    '....krrrookkkkoorrrk....',
    '....krrrookkkkoorrrk....',
    '....krrrrrkkkkrrrrrk....',
    '....krrrrrkkkkrrrrrk....',
    '..kkkkrrrrrrrrrrrrkkkk..',
    '..kkkkrrrrrrrrrrrrkkkk..',
    'ookRrrRRrrrrrrrrRRrrkooo',
    'ookrrrRRrrrrrrrrRRrrkooo',
    '..krrrRRrrrrrrrrRRrrrk..',
    '..krrrRRrrrrrrrrRRrrrk..',
    '..kkkkrrrrrrrrrrrrkkkk..',
    '..kkkkrrrrrrrrrrrrkkkk..',
    '....kmmmmmmmmmmmmmmk....',
    '....krrrrrrrgrrrrrrk....',
    '....krrrrrrrmrrrrrrk....',
    '....krrrrrrrrrrrrrrk....',
    '..kkRrrrrrrrrrrrrrrrkk..',
    '..kRrrrrrrrrrrrrrrrrrk..',
    '..kkrrrrrrrrrrrrrrrrkk..',
    '..kkkkkkkkkkkkkkkkkkkk..',
  ],
  shieldBearer: [
    '........kkkkkkkk........',
    '........kwSSSSDk........',
    '......kkwSSSSSSDkk......',
    '......kwSSDDDDSSDk......',
    '......kSSDkyykSSDk......',
    '......kSSSSSSSSSDk......',
    '......kSSSSSSSSDkkkkkk..',
    '......kDSSSSSSSDkkBBbk..',
    '....kkkkDDDDDDDhkBSBBbSk',
    '....khkkDDDDDDDhkBBBBBbk',
    '..kkShkSDDDDDDDhkBBBggmk',
    '..kSDhkDDDDDDDDhkBBBggmk',
    '..kDDhkDDDDDDDDhkBBBggmk',
    '..kDDhkDDDDDDDDhkBBBggmk',
    '..kasakDDDDDDDDhkBBBggmk',
    '..kkaakhDDDDDDDhkBBBggmk',
    '....kakkDDDDDDDhkBBBBBbk',
    '....kkkkDDDDDDDhkBBBBBbk',
    '......kSDDDDDDDhkBBBBBbk',
    '......kDDDhhhhDhkbSBBbkk',
    '......kDDhkkkkDhkkbbbk..',
    '......kDDhkkkkDhkkkkkk..',
    '......kDDhkkkkDDhk......',
    '......kDDhkkkkDDhk......',
    '......kDDhkkkkDDhk......',
    '......khDhkkkkhDhk......',
    '......kkhk....khkk......',
    '......kkkk....kkkk......',
  ],
  priest: [
    '..........kkkk......gg..',
    '..........kwnk......mg..',
    '........kkwwwnkk..gmRggg',
    '........kwwwwwnk..gggggg',
    '........kwwwggmk....gg..',
    '........kwwwggmk....gg..',
    '......kkwwwwwwwnkk..bb..',
    '......kwwwnssnwwnk..bb..',
    '......kssaksskssak..bb..',
    '......ksssssssssak..bb..',
    '......kssssaasssak..bb..',
    '......kassssssssak..bb..',
    '....kkkkwwwwwwwnkkkkbb..',
    '....knkkwwwwwwwnkkssbb..',
    '..kkwnkwwwrrrrwnksssbb..',
    '..kwwnkwwwrwrrwnkassbb..',
    '..kwwnkwwwwwwrwwnk..bb..',
    '..kwwnkwwwrwrrwwnk..bb..',
    '..kasakwwwrrrrwwnk..bb..',
    '..kkaaknwwrrrrwwnk..bb..',
    '....kkkkwwwwwwwwnk..bb..',
    '....kkkkwwwwwwwwnk..bb..',
    '....kwwwwwwwwwwwwnkk....',
    '....kwwwwwwwwwwwwwnk....',
    '..kkwwwwwwwwwwwwwwwnkk..',
    '..knwwwwwwwwwwwwwwwwnk..',
    '..kknnnnnnnnnnnnnnnnkk..',
    '..kkkkkkkkkkkkkkkkkkkk..',
  ],
  cavalry: [
    '............kkkkkk..............',
    '............kwSSDk..............',
    '..........kkwSSSSDkk............',
    '..........kwSSDSSSDk............',
    '..........kSSDkkkSDk............',
    '..........kSSSSSSSDk............',
    '..........kSSSSSSDkwwwwwwwwwwwSS',
    '..........kDSSSSSDknnnwwnnnnnnwS',
    '........kkkkRRRRRrkkkk..kkkkkk..',
    '........kkkkRRRRRrkkkk..kkBBbk..',
    '........koRRRRRRRRRRrk..kBBBkbkk',
    '........krRRRRRRRRRRrk..kBBBBBbk',
    'kkkk..kkkkRRRRRRRRRrkkkkBBBBBBbk',
    'kkbk..kbkkRRRRRRRRRrkkBBBBbbBBbk',
    'kbbbkkBBBBBBBBBBBBBBBBBBBbkkbbkk',
    'kkbbkbBBBBBBBBBBBBBBBBBBBbkkkkkk',
    '..kbkkBBBBBBBBBBBBBBBBBBBBbk....',
    '..kkkkBBBBBBBBDBBBBBBBBBBBbk....',
    '....kBBBBBBBBBSBBBBBBBBBBBbk....',
    '....kBBBbbBBBBbbbbBBBBbBBBbk....',
    '....kBBbkkbbBbkkkkbbBbkBBBbk....',
    '....kBBbkkkkbBBbkkkkbBBBBBbk....',
    '....kBBBbk..kBBBbk..kBBBbbBbkk..',
    '....kbBbkk..kbBbkk..kbBbkkbBbk..',
    '....kkbk....kkbk....kkbk..kbkk..',
    '....kkkk....kkkk....kkkk..kkkk..',
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
    '........kkkkkkkk........',
    '........kBBBBBbk........',
    '......kkBBBBBBBbkk......',
    '......kBBBBBBBBBbk......',
    '......ksssssssssak......',
    '......ksssaaaassak......',
    '......kcwckkkkcwck......',
    '......kcccssssccck......',
    '......ksssssssssak..SSDD',
    '......kassssssssak..DDDD',
    '....kkkkbbbbbbbbkkkkDDDD',
    '....kbkkbbbbbbbbkkssDDDD',
    '..kkBbkbbbBBBBbbkssshbbb',
    '..kBBbkbbbBBBBbbkasakkbb',
    '..kBBbkbbbBBBBbbbk....bb',
    '..kBBbkbbbbbbbbbbk....bb',
    '..kasakbbbBBBBbbbk....bb',
    '..kkaakbbbBBBBbbbk....bb',
    '....kakkbbbggbbbbk......',
    '....kkkkbbbbbbbbbk......',
    '......kBBbkkkkBBbk......',
    '......kBBbkkkkBBbk......',
    '......kBBbkkkkBBbk......',
    '......kBBbkkkkBBbk......',
    '......kBBbkkkkBBbk......',
    '......kbBbkkkkbBbk......',
    '......kkbk....kbkk......',
    '......kkkk....kkkk......',
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
    '........kkkkkkkk........',
    '........kDhhhhhk........',
    '......kkDhhhhhhhkk......',
    '......kDDDDDDDDDDk......',
    '....kkDhhhhhhhhhhhkk....',
    '....kkhhhhhhhhhhhhkk....',
    '......knnnnnnnnnnk......',
    '......knnnnnnnnnnk......',
    '......kcwcnnnnnnnnkk....',
    '......kcccnnnnBBBBBk....',
    '......knnnnnnnkkkk......',
    '......knnnnnnnhhkk......',
    '....kkkkhhhhhhhhkkkk..LL',
    '....kDkkhhhhhhhhkkDk..LL',
    '..kkDhkDhhhhhhhhkDhhkkLL',
    '..kDhhkhhhhhhhhhkhhhLLLG',
    '..khhhkhhhGGGGEhksssLLGk',
    '..khhhkhhhGGGGehkassLGkk',
    '..kasakhhhhhhhhhhk..LL..',
    '..kkaakhhhhhhhhhhk..LL..',
    '....kkkkhhhhhhhhhk......',
    '....kkkkhhhhhhhhhk......',
    '....kDhhhhhhhhhhhhkk....',
    '....khhhhhhhhhhhhhhk....',
    '..kkDhhhhhhhhhhhhhhhkk..',
    '..kDhhhhhhhhhhhhhhhhhk..',
    '..kkhhhhhhhhhhhhhhhhkk..',
    '..kkkkkkkkkkkkkkkkkkkk..',
  ],
  houndmaster: [
    '........kkkkkkkk........',
    '........kbbbbbbk........',
    '......kkbbbbbbbbkk......',
    '......kbbbbbbbbbbk......',
    '....kkbbbbbbbbbbbbkk....',
    '....kkbbbbbbbbbbbbkk....',
    '......ksssssssssak......',
    '......ksssassassak......',
    '......kssaksskssak..ww..',
    '......ksssssssssak..ww..',
    '......kssssaasssak..ww..',
    '......kassssssssak..ww..',
    '....kkkknnnnnnnnkkkkww..',
    '....kbkkBBBBBBBbkkssww..',
    '..kkBbkBBBbbbbBbksssbb..',
    '..kBBbkBBBbbbbBbkassbb..',
    '..kBBbkBBBbbbbBBbk......',
    '..kBBbkBBBbbbbBBbk......',
    '..kasakBBBBBBBBBbk......',
    '..kkaakbBBBBBBBBbk......',
    '....kakkbbbbbbbbbk......',
    '....kkkkbbbbbbbbbk......',
    '......kbbbkkkkbbbk......',
    '......kbbbkkkkbbbk......',
    '......kbbbkkkkbbbk......',
    '......kbbbkkkkbbbk......',
    '......kkbk....kbkk......',
    '......kkkk....kkkk......',
  ],
  mirrorKnight: [
    '..........cccc..........',
    '..........cccc..........',
    '........kkcccckk........',
    '........kcccccck........',
    '......kkwSSSSSSDkk......',
    '......kwSSDDDDSSDk......',
    '......kSSDkcckSSDk......',
    '......kSSSSSSSSSDk......',
    '......kSSSSSSSSSDk....ww',
    '......kDSSSSSSSSDk....ww',
    '....kkkkcccccccccckkkkww',
    '....kckkccccccccccSDkkww',
    '..kkcckcccwwwwcckSSDkwww',
    '..kccckcccwywwcckSSDkwww',
    'kkccwnkcccwwywcckssakwww',
    'kcccwnkcccwwwwcckasakwww',
    'kwwwcckcccwwwwcckkaaSS..',
    'kwwwcckcccwwwwcckkkkSS..',
    'kccccckcccccccccck......',
    'kkcccckcccccccccck......',
    '..kccckkSSSSSSSSDk......',
    '..kkkkkkSSDDDDSSDk......',
    '......kwSDkkkkSSDk......',
    '......kSSDkkkkSSDk......',
    '......kSSDkkkkSSDk......',
    '......kDSDkkkkDSDk......',
    '......kkDk....kDkk......',
    '......kkkk....kkkk......',
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
    '........kkkkkkkk........',
    '........kDhhhhhk........',
    '......kkDhhhhhhhkk......',
    '......kDhhhhhhhhhk......',
    '....kkDhhhhhhhhhhhkk....',
    '....kDhhhhhhhhhhhhhk....',
    '....khhhskkkkkkshhhk....',
    '....kkhhsRhhhhRshhkk....',
    '......khhhhhhhhhhk......',
    '......khhhhhhhhhhk......',
    '....kkkkhhhhhhhhkkkk..wS',
    '....kDkkhhhhhhhhkkDk..SS',
    '..kkDhkDhhrrrrhhkDhhkkSS',
    '..kDhhkhhhrrrrhhkhhhkDSD',
    '..khhhkhhhhhhrhhkssakkDk',
    '..khhhkhhhhhhhrhkasakkkk',
    '..kasakhhhhhhhhhhk......',
    '..kkaakhhhhhhhhhhk......',
    '....kakkhhhhhhhhhk......',
    '....kkkkhhhhhhhhhk......',
    '......kDhhkkkkhhhk......',
    '......khhhkkkkhhhk......',
    '......khhhkkkkhhhk......',
    '......khhhkkkkhhhk......',
    '......kkhk....khkk......',
    '......kkkk....kkkk......',
  ],
  shieldwall: [
    '....................w...',
    '....................ww..',
    '........kkkkkkkk....ww..',
    '........kwSSSSDk....ww..',
    '......kkwSSyySSDkk..bb..',
    '......kwSSDDDDSSDk..bb..',
    '......kSSDkkkkSSDk..DD..',
    '......kSSSSSSSSSDk..bb..',
    '......kSSSSSSSSDkkkkbbkk',
    '......kDSSSSSSSDkkBBbbbk',
    '....kkkkGGGGGGGdkBBBBBbk',
    '....kdkkGGGGGGGdkBBBBBbk',
    '..kkLdkLGGGGGGGdkBBBBBbk',
    '..kLGdkGGGGGGGGdkBBBBBbk',
    '..kGGdkGGGGGGGGdkBBBggmk',
    '..kGGdkGGGGGGGGdkBBBggmk',
    '..kasakGGGGGGGGdkBBBggmk',
    '..kkaakdGGGGGGGdkBBBggmk',
    '....kakkGGGGGGGdkBBBBBbk',
    '....kkkkGGGGGGGdkBBBBBbk',
    '......kLbbbgbbbbkBBBBBbk',
    '......kGGGddddGdkbBBBBbk',
    '......kDDhkkkkDhkkbbbbkk',
    '......kDDhkkkkDhkkkkkkkk',
    '......kDDhkkkkDDhk......',
    '......khDhkkkkhDhk......',
    '......kkhk....khkk......',
    '......kkkk....kkkk......',
  ],
  boneCollector: [
    '........................',
    '........................',
    '........kkkkkkkk........',
    '........knnnnnnk........',
    '......kknnnnnnnnkk..kkkk',
    '......knnnnnnnnnnk..knkk',
    '......kcycnnnnyckkkknnnk',
    '......kcccnnnncckkkknnnk',
    '......knnnnnnnnnkkkBnnnk',
    '......knnknknknnkkkkBnnk',
    '....kkkkpppppppqknnnnBnk',
    '....kqkkpppppppqknnnnnnk',
    '..kkPqkPpppppppqknnnnnnk',
    '..kPpqkppppppppqknnnBnnk',
    '..knnnkpppPPPPpqkknBnnnk',
    '..knnnkpppPPPPpqkkkknnnk',
    '..knnnkpppPPPPppqk..knkk',
    '..kknnkqppPPPPppqk..kkkk',
    '....kkkkppppppppqk......',
    '....kkkkppppppppqk......',
    '....kPpppppppppppqkk....',
    '....kpppqqppppqqppqk....',
    '....kppqkkqqqqkkppqk....',
    '....kppqkkkkkkkkppqk....',
    '....knnnnk....knnnnk....',
    '....knnnkk....kknnnk....',
    '....kknk........knkk....',
    '....kkkk........kkkk....',
  ],
  // #68: seen from the side, facing right: horned head on a long neck, a bat wing with finger bones, a spade tail, two clawed legs
  dragon: [
    '.........kknk......knk.......',
    '.......kkrRRRk......knkk.....',
    '.....kkrRRRRRk.......knnkk...',
    '...kkrRRrrRrrRk.....kRRRRRk..',
    '..kRRRrrRRrrrRk.....kRRyRRRk.',
    '.kRRrrrRRrrrrRk.....kRRRRRRRk',
    '..kkrrRrrrrrrrRk...kRRRRRRRRk',
    '....kRrrrrrrrrRk..kRRRkkooook',
    '.....kkrrrrrrrRk.kRRRok.kkkk.',
    '.k.....krrrrrrrRkkRRok.......',
    'kRk.....kkrrrrrRkRRok........',
    'kRRk...kkkRRRRRRRRRok........',
    'kRRRkkkRRRRRRRRRRRRk.........',
    'kRkkRRRRRRRRooooRRRk.........',
    '.k..kRRRRRRRooooRRok.........',
    '.....kkkkRRRkkkkRRkk.........',
    '.......kRRRRRk.kRRRRk........',
    '.......knknknk..knknk........',
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
    '....kkkkkkkk..ggRRRRRRRR',
    '....kwSSSSDk..bbRRRRRRRR',
    '..kkwSSSSSSDkkbbRRggggRR',
    '..kwSSDDDDSDkbbbRRggggRR',
    '..kSSDkyykSDkbbbRRRRRRRR',
    '..kSSSSSSSSDkbbbRRRRRRRR',
    '..kDSSSSSSSDkbbbRRRRRR..',
    '..kkDDDDDDDDkkbbmmmmmm..',
    '....kkkkkkkk..bb........',
    '....kkoRRRrk..bb........',
    '..kkkkRRRRRRRRsakk......',
    '..krkkRRRRRRRRaaak......',
    'kkorkoRRggggRrkkkk......',
    'koRrkRRRggggRrkkkk......',
    'kRRrkRRRggggRRrk........',
    'kRRrkRRRggggRRrk........',
    'kasakRRRRRRRRRrk........',
    'kkaakrRRRRRRRRrk........',
    '..kakkRRRRRRRRrk........',
    '..kkkkRRrrrrRRrk........',
    '....kSDhkkkkDDhk........',
    '....kDDhkkkkDDhk........',
    '....kDDhkkkkDDhk........',
    '....kDDhkkkkDDhk........',
    '....kDDhkkkkDDhk........',
    '....khDhkkkkhDhk........',
    '....kkhk....khkk........',
    '....kkkk....kkkk........',
  ],
  drummer: [
    '........kkkkkkkk........',
    '........kbbbbbbk........',
    '......kkbbbbbbbbkk......',
    '......kbbbbbbbbbbk......',
    '......ksssssssssak......',
    '......ksssassassak......',
    '......kssaksskssak......',
    '......ksssssssssak......',
    '......kssssaasssak......',
    '......kassssssssak......',
    '....kkkkGGGGGGGdkkkk....',
    '....kdkkGGGGGGGdkkdk....',
    '..kkLdkLGGGGGGGdkLGdkk..',
    '..kLGdkdddGGGGGdkddddk..',
    '..kasakkkkwwwwwnkkkkss..',
    '..kkaakkBBwwwwwnkkkkss..',
    '....kakkBBwwwwwwBBbk....',
    '....kkkkBBwwwwwwBBbk....',
    '......kBrBrBrBrBrBbk....',
    '......kbbrBrBrBrbbbk....',
    '......kkkkBBBBBbkkkk....',
    '......kkLGbbbbBbkkkk....',
    '......kLGdkkkkGGdk......',
    '......kGGdkkkkGGdk......',
    '......kGGdkkkkGGdk......',
    '......kdGdkkkkdGdk......',
    '......kkdk....kdkk......',
    '......kkkk....kkkk......',
  ],
  chaplain: [
    '........kkkkkkkk....gg..',
    '........kwwwwwnk....gg..',
    '......kkwwwwwwwnkkggyggg',
    '......kwwwwwwwwnkmgggggg',
    '......kwwwwwwwwwnk..gg..',
    '......kwwwnssnwwnk..gg..',
    '......kssaksskssak..gg..',
    '......ksssssssssak..gg..',
    '......kssssaasssak..gg..',
    '......kassssssssak..gg..',
    '....kkkkwwPPPPwnkkkkgg..',
    '....knkkwwPPPPwnkkssgg..',
    '..kkwnkwwwPPPPwnksssgg..',
    '..kwwnkwwwPgPPwnkassgg..',
    '..kwwnkwwwgggPwwnk..gg..',
    '..kwwnkwwwPgPPwwnk..gg..',
    '..kasakwwwPPPPwwnk..gg..',
    '..kkaaknwwPPPPwwnk..gg..',
    '....kkkkwwPPPPwwnk..gg..',
    '....kkkkwwPPPPwwnk..gg..',
    '....kwwwwwPPPPwwwnkk....',
    '....kwwwwwPPPPwwwwnk....',
    '....kwwwwwwwwwwwwwnk....',
    '....kwwwwwwwwwwwwwnk....',
    '..kkwwwwwwwwwwwwwwwnkk..',
    '..knwwwwwwwwwwwwwwwwnk..',
    '..kknnnnnnnnnnnnnnnnkk..',
    '..kkkkkkkkkkkkkkkkkkkk..',
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

/** #138: sprites redrawn on the finer grid, by their resolution; anything not listed is the old 1x grid. Same on-screen size either way. */
export const SPRITE_RES: Partial<Record<SpriteId, number>> = {
  paladin: 2, viking: 2, angel: 2, necromancer: 2, archer: 2,
  // the 15 regular foes and the three commanders (#138, part 2)
  peasant: 2, wolf: 2, crossbow: 2, knight: 2, cultist: 2, shieldBearer: 2, priest: 2, cavalry: 2, engineer: 2,
  plagueDoctor: 2, houndmaster: 2, mirrorKnight: 2, assassin: 2, shieldwall: 2, boneCollector: 2,
  bannerman: 2, drummer: 2, chaplain: 2, // the commanders
};

export interface Sprite {
  w: number; // on-screen size: draw the canvases at w × h (a finer grid rasterizes larger and is drawn down)
  h: number;
  img: HTMLCanvasElement;
  flipped: HTMLCanvasElement;
  flash: HTMLCanvasElement; // white silhouette for hit flashes
  flashFlipped: HTMLCanvasElement;
}

/** v0.4 mastery palettes: a canvas filter over the class sprite (0 = as drawn; Ashen, Gilded, Midnight). v0.5: Frost and Verdant tint treasure guardians only. */
export const SPRITE_PALETTES = ['', 'saturate(0.35) brightness(1.1)', 'sepia(1) saturate(2.2) hue-rotate(-10deg) brightness(1.1)', 'hue-rotate(200deg) saturate(1.3) brightness(0.8)', 'sepia(1) hue-rotate(160deg) saturate(2.5) brightness(1.15)', 'sepia(1) hue-rotate(60deg) saturate(2.2) brightness(0.95)'];

/** `scale` is device pixels per grid pixel here: getSprite passes spriteSize's cell. */
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

/** `scale` is the old grid's pixels per grid pixel: a sprite's own resolution (SPRITE_RES) keeps it the same size on screen. */
export function getSprite(id: SpriteId, scale: number, palette = 0): Sprite {
  const key = `${id}@${scale}@${palette}`;
  let s = cache.get(key);
  if (!s) {
    const rows = SPRITES[id];
    const { w, h, cell } = spriteSize(rows[0].length, rows.length, scale, SPRITE_RES[id]);
    s = {
      w,
      h,
      img: rasterize(rows, cell, false, false, palette),
      flipped: rasterize(rows, cell, false, true, palette),
      flash: rasterize(rows, cell, true, false),
      flashFlipped: rasterize(rows, cell, true, true),
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
const outlines = new WeakMap<Sprite, Map<string, [HTMLCanvasElement, HTMLCanvasElement]>>();
/**
 * v0.6: a 2 px silhouette outline of a sprite in one colour, [facing right, flipped], drawn under the sprite: elites, commanders,
 * and anything winding up a telegraphed attack. Rendered once per sprite and colour from its white hit-flash silhouette.
 */
export function outlineSprite(s: Sprite, color: string): [HTMLCanvasElement, HTMLCanvasElement] {
  let byColor = outlines.get(s);
  if (!byColor) outlines.set(s, (byColor = new Map()));
  let o = byColor.get(color);
  if (o) return o;
  const make = (silhouette: HTMLCanvasElement) => {
    const c = document.createElement('canvas');
    c.width = s.w + 4;
    c.height = s.h + 4;
    const ctx = c.getContext('2d')!;
    for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, -2], [-2, 2], [2, 2]]) ctx.drawImage(silhouette, 2 + dx, 2 + dy, s.w, s.h);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, c.width, c.height);
    return c;
  };
  o = [make(s.flash), make(s.flashFlipped)];
  byColor.set(color, o);
  return o;
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
