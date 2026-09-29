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
  ironKnight: { frost: 1.25 }, // #212: his plates (PLATES below) are his defence
  cultist: { shadow: 0.5, holy: 1.5, fire: 0.75 },
  shieldBearer: { physical: 0.85, fire: 1.25 },
  thornBearer: { physical: 0.85, fire: 1.25 }, // #214: the shield bearer's, spikes and all
  priest: { holy: 0.5, shadow: 1.5 },
  chaplain: { holy: 0.5, shadow: 1.5 },
  cavalry: { frost: 1.3 },
  blackKnight: { shadow: 0.5, holy: 1.3 },
  warlord: { frost: 0.75, fire: 1.25 },
  lich: { shadow: 0.25, frost: 0.5, holy: 1.5, fire: 1.25 },
  inquisitor: { fire: 0.25, holy: 0.5, frost: 1.5, shadow: 1.25 },
  abbot: { shadow: 0.5, fire: 1.5 },
  ballista: { physical: 0.7, fire: 1.75 }, // wood
  siegeTower: { physical: 0.7, fire: 1.75, frost: 0.5 },
  plagueDoctor: { shadow: 0.5, fire: 1.25 },
  boneCollector: { shadow: 0.5, holy: 1.5 },
  mirrorKnight: { holy: 0.75, frost: 1.25 },
  assassin: { holy: 1.25 },
  dragon: { fire: 0.1, frost: 1.5, physical: 0.9 },
  warden: { physical: 0.85, shadow: 1.3 },
  forgemaster: { fire: 0.5, frost: 1.3 }, // #215: forge-hot iron: fire barely warms it, frost cracks it
  emberQueen: { fire: 0.5, frost: 1.3 }, // #227: fire barely warms her, frost bites (as the Forgemaster: a fire build still hurts her)
  usurper: { shadow: 0.7, holy: 1.25, physical: 0.9 },
  royalFlame: { fire: 0.1, frost: 2 }, // fire feeds it; frost puts it out
};

/**
 * Armor: a second health bar that soaks `reduction` of every hit until it breaks (hp = frac of max HP).
 * After that the enemy takes full damage. backBreak: a shield that only damage from behind can break.
 */
export const ARMOR: Partial<Record<EnemyId, { frac: number; reduction: number; backBreak?: boolean }>> = {
  knight: { frac: 0.5, reduction: 0.6 },
  cavalry: { frac: 0.3, reduction: 0.4 },
  shieldBearer: { frac: 0.3, reduction: 0.5, backBreak: true },
  thornBearer: { frac: 0.3, reduction: 0.5, backBreak: true },
  mirrorKnight: { frac: 0.4, reduction: 0.5 },
};
/**
 * #212: plate armor that counts hits, not damage (the Iron Hold's knights). While a plate is left every hit does `reduction` less, and
 * every hit breaks a plate, plus one more for each full `heavy` share of max HP it carried, so a slow heavy hitter needs no more
 * swings than a fast one. Damage over time slips under the plate: it is reduced and breaks none. At 0 plates he takes full damage.
 */
export const PLATES: Partial<Record<EnemyId, { plates: number; reduction: number; heavy: number }>> = {
  ironKnight: { plates: 6, reduction: 0.75, heavy: 0.2 },
  forgemaster: { plates: 6, reduction: 0.6, heavy: 0.2 }, // #215: reforged at every new phase (config/bosses.ts FORGEMASTER)
  ironKing: { plates: 8, reduction: 0.6, heavy: 0.2 }, // #216: his phase 1 only; he casts off what is left at phase 2 (config/bosses.ts IRON_KING)
};
/**
 * #213: an iron tower shield that is always up (the Iron Hold's shieldwalls). A hit that comes at its front (within the foe's
 * `frontBlock` of his facing) does `reduction` less, and shots from the front are stopped outright; from the side or behind it lands in
 * full, as does damage with no direction (areas, ticks). The man behind it turns at most `turn` radians a second, so you can step round.
 */
export const TOWER_SHIELDS: Partial<Record<EnemyId, { reduction: number; turn: number }>> = {
  ironShieldwall: { reduction: 0.85, turn: 1.8 },
  ironKing: { reduction: 0.85, turn: 1.4 }, // #216: his phase 2 only (logic/ironKing towerShieldOf); a king turns slower than a shieldwall, so stepping round him works
};
/**
 * #214: thorns that hit back (the Iron Hold's Thorn Bearers). A blow of the champion's own (his attack or an ability, not a status or field
 * tick, a relic's proc, a minion or the arena) that lands while he stands within `reach` of the bearer's edge bites him for `share` of
 * the blow, at most `cap` of his max HP, at most once per `cd` seconds per bearer. Armor and blocks apply; thorns never take his last HP.
 */
export const THORNS: Partial<Record<EnemyId, { share: number; cap: number; reach: number; cd: number }>> = {
  thornBearer: { share: 0.2, cap: 0.05, reach: 100, cd: 0.35 },
  ironKing: { share: 0.15, cap: 0.04, reach: 100, cd: 0.5 }, // #216: his phase 3 only (logic/ironKing thornsOf); a boss takes many blows, so a smaller, slower bite
};
/** v0.7.3 (#59): how much of a blocked (shield bearer) or thrown-back (mirror knight) shot's damage wears the shield or mirror down. */
export const ARMOR_WEAR = { block: 1, reflect: 0.5 };
/**
 * v0.7.5 (#95): a boss's resolve. Up to `burst` of its max HP lands in full at once, and that allowance refills at `perSec` of its max HP a
 * second; damage past it does `excess` of itself, and no burst takes more than `cap` of its max HP. So one ability cannot end a boss
 * fight, and a strong build still shortens it.
 */
export const BOSS_RESOLVE = { burst: 0.15, perSec: 0.1, excess: 0.25, cap: 0.35 };
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
  assassin: { id: 'bleed', stacks: 3, power: 2 },
  dragon: { id: 'burn', power: 2 },
};
