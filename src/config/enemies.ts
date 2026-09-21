import type { SpriteId } from '../render/sprites';

export type EnemyId =
  | 'peasant'
  | 'wolf'
  | 'crossbow'
  | 'knight'
  | 'cultist'
  | 'shieldBearer'
  | 'priest'
  | 'cavalry'
  | 'blackKnight'
  | 'warlord'
  | 'lich'
  | 'inquisitor'
  | 'abbot';

export type Behavior =
  | 'chaser'
  | 'lunger'
  | 'ranged'
  | 'exploder'
  | 'healer'
  | 'bossKnight'
  | 'bossWarlord'
  | 'bossLich'
  | 'bossInquisitor'
  | 'bossAbbot';

export interface EnemyDef {
  id: EnemyId;
  name: string;
  sprite: SpriteId;
  behavior: Behavior;
  boss: boolean;
  scale: number; // sprite scale
  hp: number;
  damage: number;
  speed: number;
  radius: number;
  xp: number;
  attackCd: number;
  knockbackResist: number; // 0..1
  // behavior parameters (only the ones the behavior hook reads)
  range?: number; // ranged: preferred distance
  fireCd?: number;
  projSpeed?: number;
  lungeRange?: number;
  lungeSpeed?: number;
  lungeTime?: number;
  recover?: number;
  telegraphLunge?: boolean; // draw the charge line during the windup (cavalry)
  frontBlock?: number; // half-angle (rad) of the frontal arc in which projectiles are blocked
  healAmount?: number; // healer
  healCd?: number;
  healRange?: number;
  fuse?: number; // exploder
  blastRadius?: number;
  specialCd?: number; // bosses
  windup?: number;
  specialMult?: number; // special attack damage = damage * specialMult
  chargeSpeed?: number;
  chargeDist?: number;
  slamRadius?: number;
  summon?: EnemyId;
  summonCount?: number;
  zoneCount?: number;
  zoneRadius?: number;
  lineZones?: number; // inquisitor: pyres per line
  lineSpacing?: number;
  flasks?: number; // abbot
  poolLife?: number;
  poolDps?: number;
  // phase 2 (below half HP)
  p2Combo?: number; // black knight: extra chained charges
  p2Boulders?: number; // warlord
  p2RingBolts?: number; // lich
  p2ExtraZones?: number;
  p2Lines?: number; // inquisitor: fan of lines
  p2RingFlasks?: number; // abbot: ring of flasks closing in on the player
  p2SpeedMult?: number;
}

const base = { boss: false, scale: 3, knockbackResist: 0, attackCd: 0.8 };
const boss = { boss: true, scale: 4, knockbackResist: 1, attackCd: 1.3 };

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  peasant: { ...base, id: 'peasant', name: 'Peasant', sprite: 'peasant', behavior: 'chaser', hp: 22, damage: 8, speed: 72, radius: 12, xp: 1 },
  wolf: {
    ...base, id: 'wolf', name: 'Wolf', sprite: 'wolf', behavior: 'lunger',
    hp: 12, damage: 6, speed: 135, radius: 10, xp: 1, lungeRange: 130, lungeSpeed: 380, windup: 0.35, lungeTime: 0.4, recover: 0.6,
  },
  crossbow: {
    ...base, id: 'crossbow', name: 'Crossbowman', sprite: 'crossbow', behavior: 'ranged',
    hp: 18, damage: 10, speed: 62, radius: 12, xp: 2, range: 300, fireCd: 2.4, projSpeed: 260,
  },
  knight: {
    ...base, id: 'knight', name: 'Armored Knight', sprite: 'knight', behavior: 'chaser',
    hp: 120, damage: 18, speed: 52, radius: 15, xp: 5, knockbackResist: 0.85, attackCd: 1.1,
  },
  cultist: {
    ...base, id: 'cultist', name: 'Cultist', sprite: 'cultist', behavior: 'exploder',
    hp: 26, damage: 30, speed: 98, radius: 12, xp: 3, fuse: 0.8, blastRadius: 85,
  },
  // pressures ranged classes: arrows and bolts from the front just clang off
  shieldBearer: {
    ...base, id: 'shieldBearer', name: 'Shield Bearer', sprite: 'shieldBearer', behavior: 'chaser',
    hp: 70, damage: 12, speed: 58, radius: 14, xp: 4, knockbackResist: 0.6, frontBlock: 1.1,
  },
  // pressures slow killers: keeps the horde topped up until you hunt him down
  priest: {
    ...base, id: 'priest', name: 'War Priest', sprite: 'priest', behavior: 'healer',
    hp: 30, damage: 0, speed: 66, radius: 12, xp: 4, range: 330, healAmount: 22, healCd: 2.5, healRange: 230,
  },
  // pressures kiters and the slow: a long telegraphed charge that outruns everyone
  cavalry: {
    ...base, id: 'cavalry', name: 'Cavalry', sprite: 'cavalry', behavior: 'lunger',
    hp: 60, damage: 20, speed: 95, radius: 16, xp: 5, knockbackResist: 0.5,
    lungeRange: 380, lungeSpeed: 560, windup: 0.75, lungeTime: 0.9, recover: 1.2, telegraphLunge: true,
  },
  blackKnight: {
    ...boss, id: 'blackKnight', name: 'The Black Knight', sprite: 'blackKnight', behavior: 'bossKnight',
    hp: 700, damage: 22, speed: 82, radius: 28, xp: 40,
    specialCd: 4.5, windup: 0.9, specialMult: 1.7, chargeSpeed: 640, chargeDist: 460, p2Combo: 2, p2SpeedMult: 1.2,
  },
  warlord: {
    ...boss, id: 'warlord', name: 'The Warlord', sprite: 'warlord', behavior: 'bossWarlord',
    hp: 1000, damage: 26, speed: 70, radius: 30, xp: 60,
    specialCd: 5, windup: 1.1, specialMult: 1.8, slamRadius: 180, summon: 'wolf', summonCount: 4, p2Boulders: 4, p2SpeedMult: 1.15,
  },
  lich: {
    ...boss, id: 'lich', name: 'The Lich', sprite: 'lich', behavior: 'bossLich',
    hp: 850, damage: 18, speed: 66, radius: 26, xp: 80,
    range: 320, fireCd: 1.8, projSpeed: 280,
    specialCd: 5, windup: 1.1, specialMult: 1.8, zoneCount: 5, zoneRadius: 75, p2RingBolts: 12, p2ExtraZones: 3,
  },
  inquisitor: {
    ...boss, id: 'inquisitor', name: 'The Grand Inquisitor', sprite: 'inquisitor', behavior: 'bossInquisitor',
    hp: 950, damage: 24, speed: 76, radius: 27, xp: 70,
    specialCd: 4, windup: 0.9, specialMult: 1.6, lineZones: 7, lineSpacing: 78, zoneRadius: 50,
    p2Lines: 3, summon: 'cultist', summonCount: 2, p2SpeedMult: 1.15,
  },
  abbot: {
    ...boss, id: 'abbot', name: 'The Plague Abbot', sprite: 'abbot', behavior: 'bossAbbot',
    hp: 900, damage: 16, speed: 64, radius: 26, xp: 70,
    range: 340, fireCd: 2.2, projSpeed: 250,
    specialCd: 4.5, windup: 1.2, specialMult: 1.4, flasks: 3, zoneRadius: 70, poolLife: 6, poolDps: 14,
    p2RingFlasks: 7, summon: 'priest', summonCount: 2,
  },
};
