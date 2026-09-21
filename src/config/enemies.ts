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
  | 'bannerman'
  | 'drummer'
  | 'chaplain'
  | 'engineer'
  | 'ballista'
  | 'plagueDoctor'
  | 'houndmaster'
  | 'mirrorKnight'
  | 'siegeTower'
  | 'assassin'
  | 'shieldwall'
  | 'boneCollector'
  | 'dragon'
  | 'warden'
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
  | 'support'
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
  // commanders: an aura for nearby allies, a squad reaction when they fall, and a bounty
  aura?: { kind: 'damage' | 'speed' | 'heal'; radius: number; value: number; every?: number };
  onDeath?: 'enrage' | 'scatter' | 'flee';
  bonusGold?: number;
  phases?: number; // bosses: how many phases the HP bar is split into (default 2)
  structure?: boolean; // built things: cannot be feared, pushed or made to flee
  reflect?: number; // mirror knight: half-angle of the frontal arc that throws projectiles back (down while he recovers from a swing)
  wall?: { radius: number; neighbors: number; reduction: number }; // shieldwall: frontal protection only while enough squadmates stand close
  grow?: { hp: number; damage: number; radius: number; max: number }; // bone collector: per corpse absorbed
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
  // ---- v0.3 roster: each has its own behaviour loop (config/ai.ts profile + a special in systems/specials.ts) ----
  // builds ballistae until someone stops him
  engineer: {
    ...base, id: 'engineer', name: 'Siege Engineer', sprite: 'engineer', behavior: 'support',
    hp: 40, damage: 0, speed: 72, radius: 12, xp: 5, range: 330, windup: 2.5, summon: 'ballista', summonCount: 2,
  },
  ballista: {
    ...base, id: 'ballista', name: 'Ballista', sprite: 'ballista', behavior: 'ranged', structure: true,
    hp: 150, damage: 24, speed: 0, radius: 18, xp: 4, knockbackResist: 1, range: 600, fireCd: 3.2, projSpeed: 520,
  },
  // poison clouds, and once in his life he gets a fallen unit back on its feet
  plagueDoctor: {
    ...base, id: 'plagueDoctor', name: 'Plague Doctor', sprite: 'plagueDoctor', behavior: 'support',
    hp: 45, damage: 10, speed: 68, radius: 12, xp: 6, range: 300, zoneRadius: 70, windup: 1.1, poolLife: 6, poolDps: 6, summon: 'peasant',
  },
  // his wolves answer the whistle: faster, meaner, leaping at once. Without him they scatter.
  houndmaster: {
    ...base, id: 'houndmaster', name: 'Hound Master', sprite: 'houndmaster', behavior: 'support',
    hp: 70, damage: 0, speed: 82, radius: 13, xp: 7, range: 300, onDeath: 'scatter', bonusGold: 12,
  },
  // throws arrows and bolts back at you, except in the moment after he swings
  mirrorKnight: {
    ...base, id: 'mirrorKnight', name: 'Mirror Knight', sprite: 'mirrorKnight', behavior: 'chaser',
    hp: 130, damage: 16, speed: 56, radius: 15, xp: 7, knockbackResist: 0.8, attackCd: 1.6, reflect: 1.3,
  },
  // rolls in slowly and keeps unloading troops until it is destroyed
  siegeTower: {
    ...base, id: 'siegeTower', name: 'Siege Tower', sprite: 'siegeTower', behavior: 'support', structure: true, scale: 4,
    hp: 520, damage: 0, speed: 18, radius: 30, xp: 14, knockbackResist: 1, range: 260, summonCount: 2,
  },
  // vanishes, reappears behind you, stabs, runs
  assassin: {
    ...base, id: 'assassin', name: 'Assassin', sprite: 'assassin', behavior: 'chaser',
    hp: 34, damage: 14, speed: 122, radius: 11, xp: 5, specialMult: 2.2, windup: 0.45,
  },
  // a wall of pavises: nearly untouchable from the front while the line holds. Break the line or get behind it.
  shieldwall: {
    ...base, id: 'shieldwall', name: 'Shieldwall Spearman', sprite: 'shieldwall', behavior: 'chaser',
    hp: 60, damage: 11, speed: 54, radius: 13, xp: 4, knockbackResist: 0.7, frontBlock: 1.2, wall: { radius: 72, neighbors: 2, reduction: 0.8 },
  },
  // goes for the corpses before he goes for you, and every one makes him bigger. The Necromancer's rival.
  boneCollector: {
    ...base, id: 'boneCollector', name: 'Bone Collector', sprite: 'boneCollector', behavior: 'chaser',
    hp: 80, damage: 12, speed: 66, radius: 14, xp: 6, knockbackResist: 0.4, grow: { hp: 0.25, damage: 0.12, radius: 1.5, max: 10 },
  },
  // ---- commanders: they do not fight, they make everyone around them worse to fight. Kill them first. ----
  bannerman: {
    ...base, id: 'bannerman', name: 'Bannerman', sprite: 'bannerman', behavior: 'support',
    hp: 70, damage: 0, speed: 74, radius: 13, xp: 6, range: 260,
    aura: { kind: 'damage', radius: 230, value: 1.3 }, onDeath: 'enrage', bonusGold: 12,
  },
  drummer: {
    ...base, id: 'drummer', name: 'War Drummer', sprite: 'drummer', behavior: 'support',
    hp: 60, damage: 0, speed: 78, radius: 13, xp: 6, range: 280,
    aura: { kind: 'speed', radius: 250, value: 1.3 }, onDeath: 'scatter', bonusGold: 12,
  },
  chaplain: {
    ...base, id: 'chaplain', name: 'Chaplain', sprite: 'chaplain', behavior: 'support',
    hp: 80, damage: 0, speed: 70, radius: 13, xp: 7, range: 300,
    aura: { kind: 'heal', radius: 220, value: 0.07, every: 3 }, onDeath: 'flee', bonusGold: 15,
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
  // ---- Act bosses: three phases, and they change the arena itself (systems/bosses.ts) ----
  dragon: {
    ...boss, id: 'dragon', name: 'The Dragon', sprite: 'dragon', behavior: 'support', scale: 5, phases: 3,
    hp: 1500, damage: 22, speed: 92, radius: 40, xp: 120,
    range: 330, fireCd: 2.4, projSpeed: 300,
    specialCd: 6.5, windup: 1.3, specialMult: 1.5, zoneRadius: 62, lineZones: 12, lineSpacing: 92, poolLife: 8, poolDps: 9,
  },
  warden: {
    ...boss, id: 'warden', name: 'The Warden', sprite: 'warden', behavior: 'chaser', phases: 3,
    hp: 1400, damage: 26, speed: 80, radius: 30, xp: 120,
    specialCd: 7.5, windup: 1.0, specialMult: 1.5, zoneRadius: 46, summon: 'knight', summonCount: 2, p2SpeedMult: 1.1,
  },
  abbot: {
    ...boss, id: 'abbot', name: 'The Plague Abbot', sprite: 'abbot', behavior: 'bossAbbot',
    hp: 900, damage: 16, speed: 64, radius: 26, xp: 70,
    range: 340, fireCd: 2.2, projSpeed: 250,
    specialCd: 4.5, windup: 1.2, specialMult: 1.4, flasks: 3, zoneRadius: 70, poolLife: 6, poolDps: 14,
    p2RingFlasks: 7, summon: 'priest', summonCount: 2,
  },
};
