import type { Mods, StatKey } from '../core/types';

export const STAT_LABELS: Record<Exclude<StatKey, 'secondary'>, string> = {
  hp: 'HP',
  str: 'Strength',
  dex: 'Dexterity',
  int: 'Intelligence',
  atkSpd: 'Attack Speed',
  moveSpd: 'Move Speed',
};

/** Level-up choices. mode 'mult' multiplies the stat, 'add' adds to it. */
export const UPGRADES: Record<StatKey, { amount: number; mode: 'add' | 'mult'; desc: string }> = {
  hp: { amount: 25, mode: 'add', desc: '+25 max HP (healed at once)' },
  str: { amount: 3, mode: 'add', desc: '+3 Strength — melee / physical damage' },
  dex: { amount: 3, mode: 'add', desc: '+3 Dexterity — ranged damage and crit chance' },
  int: { amount: 3, mode: 'add', desc: '+3 Intelligence — magic damage, shorter cooldown' },
  atkSpd: { amount: 1.1, mode: 'mult', desc: '+10% attacks per second' },
  moveSpd: { amount: 15, mode: 'add', desc: '+15 movement speed' },
  secondary: { amount: 2, mode: 'add', desc: '+2' },
};

export const UPGRADE_CHOICES = 3;

// ---------- v0.2: rarity tiers, tradeoffs, rerolls ----------
export type UpgradeRarity = 'common' | 'rare' | 'epic';
/** mult scales the bonus part of the upgrade (so an epic +10% attack speed is +25%). */
export const UPGRADE_RARITIES: Record<UpgradeRarity, { name: string; weight: number; mult: number }> = {
  common: { name: 'Common', weight: 70, mult: 1 },
  rare: { name: 'Rare', weight: 24, mult: 1.6 },
  epic: { name: 'Epic', weight: 6, mult: 2.5 },
};

export const FREE_REROLLS = 1; // per level-up screen; the Keep adds more
export const TRADEOFF_CHANCE = 0.2; // chance that one of the offered boons is a tradeoff

export interface TradeoffDef {
  name: string;
  desc: string;
  stats?: Partial<Record<StatKey, { add?: number; mult?: number }>>;
  mods?: Partial<Mods>;
}
export const TRADEOFFS = {
  glassCannon: { name: 'Glass Cannon', desc: '+25% damage, but -20% max HP', mods: { damage: 1.25 }, stats: { hp: { mult: 0.8 } } },
  heavyPlate: { name: 'Heavy Plate', desc: '+12% armor, but -10% movement speed', mods: { armor: 0.12, moveSpd: 0.9 } },
  recklessHaste: { name: 'Reckless Haste', desc: '+25% attack speed, but -10% armor', mods: { atkSpd: 1.25, armor: -0.1 } },
  bloodPrice: { name: 'Blood Price', desc: '+5 to your secondary stat, but -25 max HP', stats: { secondary: { add: 5 }, hp: { add: -25 } } },
  miser: { name: "Miser's Bargain", desc: '+50% gold found, but -10% damage', mods: { gold: 1.5, damage: 0.9 } },
  tunnelVision: { name: 'Tunnel Vision', desc: '+15% crit chance, but -40% pickup radius', mods: { crit: 0.15, pickup: 0.6 } },
} satisfies Record<string, TradeoffDef>;
export type TradeoffId = keyof typeof TRADEOFFS;
export const TRADEOFF_IDS = Object.keys(TRADEOFFS) as TradeoffId[];
