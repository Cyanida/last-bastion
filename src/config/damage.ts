import type { EnemyId } from './enemies';

export type DamageType = 'physical' | 'fire' | 'holy' | 'shadow' | 'frost';
export const DAMAGE_TYPES: Record<DamageType, { name: string; color: string }> = {
  physical: { name: 'Physical', color: '#e8e2d0' },
  fire: { name: 'Fire', color: '#e07b28' },
  holy: { name: 'Holy', color: '#f2e6a0' },
  shadow: { name: 'Shadow', color: '#a77fd0' },
  frost: { name: 'Frost', color: '#a9d8ef' },
};

/** Damage multipliers per enemy: below 1 resists, above 1 is a weakness. Shown in the inspect tooltip. */
export const RESISTS: Partial<Record<EnemyId, Partial<Record<DamageType, number>>>> = {
  wolf: { fire: 1.5, frost: 0.75 },
  knight: { frost: 1.25 }, // his armor (below) is his physical defence
  cultist: { shadow: 0.5, holy: 1.5, fire: 0.75 },
  shieldBearer: { physical: 0.85, fire: 1.25 },
  priest: { holy: 0.5, shadow: 1.5 },
  chaplain: { holy: 0.5, shadow: 1.5 },
  cavalry: { frost: 1.3 },
  blackKnight: { shadow: 0.5, holy: 1.3 },
  warlord: { frost: 0.75, fire: 1.25 },
  lich: { shadow: 0.25, frost: 0.5, holy: 1.5, fire: 1.25 },
  inquisitor: { fire: 0.25, holy: 0.5, frost: 1.5, shadow: 1.25 },
  abbot: { shadow: 0.5, fire: 1.5 },
};

/**
 * Armor: a second health bar that soaks `reduction` of every hit until it breaks (hp = frac of max HP).
 * After that the enemy takes full damage. backBreak: a shield that only damage from behind can break.
 */
export const ARMOR: Partial<Record<EnemyId, { frac: number; reduction: number; backBreak?: boolean }>> = {
  knight: { frac: 0.5, reduction: 0.6 },
  cavalry: { frac: 0.3, reduction: 0.4 },
  shieldBearer: { frac: 0.3, reduction: 0.5, backBreak: true },
};
export const BACK_ARC = 1.2; // radians: a hit travelling within this angle of the enemy's facing came from behind

export type StatusId = 'burn' | 'slow' | 'bleed' | 'poison' | 'stun' | 'fear' | 'curse' | 'blessed';

export interface StatusDef {
  name: string;
  color: string;
  maxStacks: number;
  duration: number; // default; an application may bring its own
  stacking: 'stacks' | 'strongest' | 'duration'; // add stacks (refreshing time) | keep the stronger power, extend time | just take the longer time
  dot?: DamageType; // deals power * stacks per second of this type
  bossImmune?: boolean;
}

export const STATUSES: Record<StatusId, StatusDef> = {
  burn: { name: 'Burning', color: '#e07b28', maxStacks: 5, duration: 4, stacking: 'stacks', dot: 'fire' },
  slow: { name: 'Chilled', color: '#a9d8ef', maxStacks: 5, duration: 2.5, stacking: 'stacks', bossImmune: true },
  bleed: { name: 'Bleeding', color: '#c23a2e', maxStacks: 8, duration: 5, stacking: 'stacks', dot: 'physical' },
  poison: { name: 'Poisoned', color: '#6f8f4e', maxStacks: 1, duration: 4, stacking: 'strongest', dot: 'shadow' },
  stun: { name: 'Stunned', color: '#f2c94c', maxStacks: 1, duration: 1, stacking: 'duration', bossImmune: true },
  fear: { name: 'Afraid', color: '#9a9aa0', maxStacks: 1, duration: 2, stacking: 'duration', bossImmune: true },
  curse: { name: 'Cursed', color: '#a77fd0', maxStacks: 3, duration: 6, stacking: 'stacks' },
  blessed: { name: 'Blessed', color: '#f2e6a0', maxStacks: 1, duration: 6, stacking: 'duration' },
};

export const STATUS_TUNING = {
  slowPerStack: 0.12, // movement speed lost per Chilled stack
  freezeAt: 5, // Chilled stacks that turn into a freeze (a stun)...
  freezeTime: 1.5,
  freezeImmunity: 5, // ...after which it cannot be chilled for a while
  stunImmunity: 3,
  cursePerStack: 0.12, // extra damage taken per Cursed stack
  poisonMaxTime: 10,
  blessedDamage: 1.3,
  blessedRegen: 4, // HP per second
  dotTick: 0.5, // damage-over-time lands this often
  maxSlowStacksFromAbility: 4, // ability slows never freeze on their own
};

/** What enemy hits put on the player (and on minions). */
export const ENEMY_STATUS: Partial<Record<EnemyId, { id: StatusId; stacks?: number; power?: number; time?: number }>> = {
  wolf: { id: 'bleed', power: 1.5 },
  cultist: { id: 'burn', stacks: 2, power: 3 },
  lich: { id: 'curse' },
  abbot: { id: 'poison', power: 5 },
};
