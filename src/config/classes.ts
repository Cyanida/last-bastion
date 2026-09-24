import type { Stats } from '../core/types';
import type { SpriteId } from '../render/sprites';
import type { DamageType } from './damage';

export type ClassId = 'paladin' | 'viking' | 'angel' | 'necromancer' | 'archer';
type Scaling = 'str' | 'dex' | 'int';

export type AttackCfg =
  | { kind: 'melee'; type?: DamageType; scaling: Scaling; damage: number; range: number; arc: number; knockback: number; color: string }
  | {
      kind: 'projectile';
      type?: DamageType; // default physical
      scaling: Scaling;
      damage: number;
      range: number;
      speed: number;
      pierce: number; // extra enemies a shot passes through
      radius: number;
      shape: 'arrow' | 'orb';
      color: string;
    };

interface AbilityBase {
  name: string;
  desc: string;
  cooldown: number;
  aura: string; // colour drawn around the player while active
}

export type AbilityCfg =
  | (AbilityBase & {
      id: 'divineShield';
      duration: number;
      durationPerFaith: number;
      burstRadius: number;
      burstDamage: number;
      burstPerFaith: number; // +x burst damage multiplier per Faith
      burstKnockback: number;
      minDowntime: number; // v0.7.3 (#53): after the shield, the cooldown lasts at least this × the time it was up
      earlyBurst: number; // v0.7.4 (#63): detonated at the cast the burst deals this share, rising to 1 when the shield runs out
    })
  | (AbilityBase & {
      id: 'berserkerRage';
      duration: number;
      durationPerRage: number;
      atkSpdBonus: number;
      damageBonus: number;
      lifesteal: number;
      bonusPerRage: number; // all bonuses * (1 + rage * x)
      lowHpBonus: number; // all bonuses * (1 + missingHpFraction * x)
    })
  | (AbilityBase & {
      id: 'heavenlyRadiance';
      radius: number;
      radiusPerGrace: number;
      heal: number;
      healPerGrace: number;
      damage: number;
    })
  | (AbilityBase & {
      id: 'raiseDead';
      minions: number;
      minionsPerSoul: number;
      minionDamage: number;
      damagePerSoul: number;
      lifetime: number;
      lifetimePerSoul: number;
      minionHp: number;
      minionSpeed: number;
      minionAttackCd: number;
    })
  | (AbilityBase & {
      id: 'arrowVolley';
      radius: number;
      castRange: number;
      arrows: number;
      arrowsPerFocus: number;
      pierce: number; // enemies each falling arrow can hit
      piercePerFocus: number;
      damage: number;
      duration: number;
      arrowRadius: number;
    });

export type AbilityId = AbilityCfg['id'];
export type Cfg<K extends AbilityId> = Extract<AbilityCfg, { id: K }>;

export interface ClassDef {
  id: ClassId;
  name: string;
  role: string;
  sprite: SpriteId;
  base: Stats;
  growth: Stats; // added automatically on every level-up
  armor: number; // fraction of incoming damage ignored
  regen: number; // HP per second
  secondary: { name: string; desc: string };
  attack: AttackCfg;
  ability: AbilityCfg;
}

export const CLASSES: Record<ClassId, ClassDef> = {
  paladin: {
    id: 'paladin',
    name: 'Paladin',
    role: 'Tank / frontline',
    sprite: 'paladin',
    base: { hp: 170, str: 12, dex: 4, int: 6, atkSpd: 1.1, moveSpd: 150, secondary: 5 },
    growth: { hp: 14, str: 1, dex: 0.2, int: 0.4, atkSpd: 0.01, moveSpd: 0, secondary: 0 },
    armor: 0.4,
    regen: 2,
    secondary: { name: 'Faith', desc: 'Longer Divine Shield and a bigger holy burst.' },
    attack: { kind: 'melee', scaling: 'str', damage: 14, range: 72, arc: 2.2, knockback: 260, color: '#e8e2d0' },
    ability: {
      id: 'divineShield',
      name: 'Divine Shield',
      desc: 'Become invulnerable for a few seconds. When the shield ends it erupts in a holy burst. Press again to end it early, for a weaker burst.',
      cooldown: 18,
      aura: '#f2d675',
      duration: 3,
      durationPerFaith: 0.12,
      burstRadius: 160,
      burstDamage: 45,
      burstPerFaith: 0.1,
      burstKnockback: 420,
      minDowntime: 1, // v0.7.3 (#53): with Sanctuary, Faith, Second Wind and refunds the shield was up most of Act III
      earlyBurst: 0.5,
    },
  },
  viking: {
    id: 'viking',
    name: 'Viking',
    role: 'Melee berserker',
    sprite: 'viking',
    base: { hp: 150, str: 14, dex: 6, int: 3, atkSpd: 1.3, moveSpd: 172, secondary: 5 },
    growth: { hp: 9, str: 1.2, dex: 0.3, int: 0.1, atkSpd: 0.02, moveSpd: 0.5, secondary: 0 },
    armor: 0.28,
    regen: 1.5,
    secondary: { name: 'Rage', desc: 'Longer Berserker Rage with stronger bonuses.' },
    attack: { kind: 'melee', scaling: 'str', damage: 14, range: 88, arc: 3.6, knockback: 120, color: '#d8d2bd' },
    ability: {
      id: 'berserkerRage',
      name: 'Berserker Rage',
      desc: 'Attack faster, hit harder and drain life for a while. Stronger the lower your HP.',
      cooldown: 13,
      aura: '#b8322a',
      duration: 5,
      durationPerRage: 0.15,
      atkSpdBonus: 0.4,
      damageBonus: 0.3,
      lifesteal: 0.08,
      bonusPerRage: 0.05,
      lowHpBonus: 1,
    },
  },
  angel: {
    id: 'angel',
    name: 'Angel',
    role: 'Support / holy caster',
    sprite: 'angel',
    base: { hp: 95, str: 3, dex: 6, int: 13, atkSpd: 1.6, moveSpd: 175, secondary: 5 },
    growth: { hp: 6, str: 0.1, dex: 0.3, int: 1.2, atkSpd: 0.02, moveSpd: 0.5, secondary: 0 },
    armor: 0,
    regen: 1,
    secondary: { name: 'Grace', desc: 'Heavenly Radiance heals more and reaches further.' },
    attack: {
      kind: 'projectile',
      type: 'holy',
      scaling: 'int',
      damage: 9,
      range: 380,
      speed: 520,
      pierce: 1,
      radius: 6,
      shape: 'orb',
      color: '#f2e6a0',
    },
    ability: {
      id: 'heavenlyRadiance',
      name: 'Heavenly Radiance',
      desc: 'A burst of light heals you and smites every enemy in a radius.',
      cooldown: 16,
      aura: '#f2e6a0',
      radius: 150,
      radiusPerGrace: 8,
      heal: 13,
      healPerGrace: 2,
      damage: 35,
    },
  },
  necromancer: {
    id: 'necromancer',
    name: 'Necromancer',
    role: 'Summoner',
    sprite: 'necromancer',
    base: { hp: 85, str: 3, dex: 4, int: 12, atkSpd: 0.8, moveSpd: 160, secondary: 5 },
    growth: { hp: 5, str: 0.1, dex: 0.2, int: 1.2, atkSpd: 0.01, moveSpd: 0.5, secondary: 0.25 },
    armor: 0,
    regen: 0.5,
    secondary: { name: 'Soul Power', desc: 'More skeletons that hit harder and last longer.' },
    attack: {
      kind: 'projectile',
      type: 'shadow',
      scaling: 'int',
      damage: 10,
      range: 340,
      speed: 300,
      pierce: 0,
      radius: 7,
      shape: 'orb',
      color: '#7a4fa0',
    },
    ability: {
      id: 'raiseDead',
      name: 'Raise Dead',
      desc: 'Raise skeletons from recently slain enemies. They fight for you and draw enemy attention.',
      cooldown: 8,
      aura: '#7ec8d8',
      minions: 2,
      minionsPerSoul: 0.25,
      minionDamage: 11,
      damagePerSoul: 0.08,
      lifetime: 14,
      lifetimePerSoul: 0.6,
      minionHp: 60,
      minionSpeed: 165,
      minionAttackCd: 0.7,
    },
  },
  archer: {
    id: 'archer',
    name: 'Archer',
    role: 'Ranged glass cannon',
    sprite: 'archer',
    base: { hp: 95, str: 4, dex: 14, int: 4, atkSpd: 2.2, moveSpd: 205, secondary: 5 }, // v0.6: was 80; the fresh Archer died in Act I (BALANCE.md)
    growth: { hp: 4, str: 0.1, dex: 1.3, int: 0.2, atkSpd: 0.03, moveSpd: 1, secondary: 0 },
    armor: 0,
    regen: 0.3,
    secondary: { name: 'Focus', desc: 'Arrow Volley rains more arrows that pierce more enemies.' },
    attack: {
      kind: 'projectile',
      scaling: 'dex',
      damage: 12,
      range: 460,
      speed: 780,
      pierce: 1,
      radius: 5,
      shape: 'arrow',
      color: '#e8e2d0',
    },
    ability: {
      id: 'arrowVolley',
      name: 'Arrow Volley',
      desc: 'Rain piercing arrows on the area under your cursor.',
      cooldown: 10,
      aura: '#6f8f4e',
      radius: 120,
      castRange: 520,
      arrows: 10,
      arrowsPerFocus: 1.2,
      pierce: 1,
      piercePerFocus: 0.25,
      damage: 20,
      duration: 1.2,
      arrowRadius: 36,
    },
  },
};

export const CLASS_ORDER: ClassId[] = ['paladin', 'viking', 'angel', 'necromancer', 'archer'];
