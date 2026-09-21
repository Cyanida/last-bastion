import type { ArenaDef } from '../config/arenas';
import type { ClassDef } from '../config/classes';
import type { AffixId } from '../config/elites';
import type { EnemyDef } from '../config/enemies';
import { GAME } from '../config/game';
import type { Buff, Enemy, Minion, Player, Stats, Status } from '../core/types';
import { applyAffixes } from '../logic/elites';
import { neutralMods } from '../logic/mods';

export const neutralBuff = (): Buff => ({ damage: 1, atkSpd: 1, lifesteal: 0, multishot: 0, fullCircle: false, range: 1 });

export function createPlayer(cls: ClassDef, arena: ArenaDef, stats: Stats = cls.base): Player {
  return {
    cls,
    stats: { ...stats },
    x: arena.w / 2,
    y: arena.h / 2,
    r: GAME.playerRadius,
    hp: stats.hp,
    level: 1,
    xp: 0,
    facing: 0,
    flip: false,
    attackTimer: 0,
    abilityCd: 0,
    abilityCdMax: 1,
    abilityTime: 0,
    abilityDur: 1,
    invulnerable: false,
    buff: neutralBuff(),
    mods: neutralMods(),
    upgrades: [],
    revives: 0,
    reviveT: 0,
    invulnT: 0,
    deathless: false,
    absorbed: 0,
    chillT: 0,
    still: 0,
    iFrames: 0,
    flash: 0,
  };
}

export function createEnemy(def: EnemyDef, x: number, y: number, hpMult: number, dmgMult: number, affixes: AffixId[] = []): Enemy {
  const elite = affixes.length > 0;
  const base = { hp: Math.round(def.hp * hpMult), damage: def.damage * dmgMult, speed: def.speed, radius: def.radius, xp: def.xp };
  const s = elite ? applyAffixes(base, affixes) : { ...base, shield: 0 };
  return {
    def,
    x,
    y,
    r: s.radius,
    hp: s.hp,
    maxHp: s.hp,
    damage: s.damage,
    xp: s.xp,
    speed: s.speed,
    baseSpeed: s.speed,
    elite,
    affixes,
    shield: s.shield,
    shieldMax: s.shield,
    shieldT: 0,
    slowT: 0,
    slowMul: 1,
    fearT: 0,
    markT: 0,
    markMul: 1,
    phase: 1,
    combo: 0,
    kx: 0,
    ky: 0,
    attackTimer: 0,
    flash: 0,
    flip: false,
    state: 0,
    timer: 0,
    special: def.specialCd ?? 0,
    angle: 0,
    charged: false,
    telegraph: null,
    dead: false,
  };
}

export function createMinion(
  x: number,
  y: number,
  o: { hp: number; damage: number; speed: number; attackCd: number; life: number; r?: number; scale?: number; volatile?: number; status?: Status | null },
): Minion {
  return {
    x, y,
    r: o.r ?? 11,
    hp: o.hp,
    maxHp: o.hp,
    damage: o.damage,
    speed: o.speed,
    attackCd: o.attackCd,
    life: o.life,
    attackTimer: 0,
    flash: 0,
    flip: false,
    scale: o.scale ?? GAME.spriteScale,
    volatile: o.volatile ?? 0,
    status: o.status ?? null,
  };
}
