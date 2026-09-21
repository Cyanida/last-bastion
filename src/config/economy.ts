/** Gold, the Keep (permanent upgrades), class mastery and difficulty tiers. */

export const GOLD = {
  dropChance: 0.4, // regular enemies; elites and bosses always drop
  perXp: 1, // drop size = enemy xp value * perXp * (1 ± variance)
  variance: 0.5,
  bossDrop: 40,
  bossBonus: 60, // straight into the purse on a boss kill
  waveBonusBase: 2, // wave clear bonus = base + perWave * wave
  waveBonusPerWave: 1,
  rerollCost: 15, // paid rerolls once the free ones are used; doubles each time within a screen
  rerollCostGrowth: 2,
};

export type MetaId = 'hp' | 'str' | 'dex' | 'int' | 'atkSpd' | 'moveSpd' | 'startGold' | 'rerolls' | 'xp' | 'pickup' | 'relicSlot';

export interface MetaDef {
  name: string;
  desc: string;
  max: number;
  baseCost: number;
  growth: number; // cost(rank) = baseCost * growth^rank
  perRank: number;
}

/**
 * Power budget: all six stat tracks maxed is about +20% EHP and +35% DPS. See BALANCE.md:
 * that should move a run roughly 1.5-2x further on the same tier, never 10x.
 */
export const META: Record<MetaId, MetaDef> = {
  hp: { name: 'Hearty Stock', desc: '+4% max HP per rank', max: 5, baseCost: 40, growth: 1.6, perRank: 0.04 },
  str: { name: 'Drill Yard', desc: '+1 Strength per rank', max: 5, baseCost: 40, growth: 1.6, perRank: 1 },
  dex: { name: 'Archery Butts', desc: '+1 Dexterity per rank', max: 5, baseCost: 40, growth: 1.6, perRank: 1 },
  int: { name: 'Scriptorium', desc: '+1 Intelligence per rank', max: 5, baseCost: 40, growth: 1.6, perRank: 1 },
  atkSpd: { name: 'Balanced Arms', desc: '+2% attack speed per rank', max: 5, baseCost: 50, growth: 1.6, perRank: 0.02 },
  moveSpd: { name: 'Good Boots', desc: '+2% movement speed per rank', max: 5, baseCost: 50, growth: 1.6, perRank: 0.02 },
  startGold: { name: 'War Chest', desc: '+20 starting gold per rank (for paid rerolls)', max: 5, baseCost: 30, growth: 1.5, perRank: 20 },
  rerolls: { name: 'Fickle Fortune', desc: '+1 free reroll on every level-up', max: 2, baseCost: 250, growth: 3, perRank: 1 },
  xp: { name: 'Chronicler', desc: '+5% experience per rank', max: 5, baseCost: 60, growth: 1.7, perRank: 0.05 },
  pickup: { name: 'Squire', desc: '+10% pickup radius per rank', max: 5, baseCost: 25, growth: 1.5, perRank: 0.1 },
  relicSlot: { name: 'Seventh Reliquary', desc: 'One extra relic slot', max: 1, baseCost: 4000, growth: 1, perRank: 1 },
};
export const META_IDS = Object.keys(META) as MetaId[];

/** Class XP from one run, before the tier multiplier. */
export const CLASS_XP = { perWaveCleared: 10, perBoss: 30, perLevel: 2 };

export interface MasteryRank {
  xp: number; // total class XP needed
  secondary: number; // added to the class's starting secondary stat
  relic: boolean; // start the run with a random common relic
  reroll: number; // extra free rerolls
  reward: string;
}
export const MASTERY: MasteryRank[] = [
  { xp: 150, secondary: 1, relic: false, reroll: 0, reward: '+1 starting secondary stat' },
  { xp: 400, secondary: 1, relic: false, reroll: 0, reward: '+1 starting secondary stat' },
  { xp: 900, secondary: 0, relic: true, reroll: 0, reward: 'Start with a random common relic' },
  { xp: 1800, secondary: 2, relic: false, reroll: 0, reward: '+2 starting secondary stat' },
  { xp: 3200, secondary: 1, relic: false, reroll: 1, reward: '+1 secondary stat and +1 free reroll' },
];

export interface TierDef {
  name: string;
  enemyHp: number;
  enemyDmg: number;
  eliteMult: number;
  gold: number;
  classXp: number;
}
/** Clearing wave TIER_UNLOCK_WAVE on your highest tier unlocks the next one. */
export const TIER_UNLOCK_WAVE = 15;
export const TIERS: TierDef[] = [
  { name: 'Squire', enemyHp: 1, enemyDmg: 1, eliteMult: 1, gold: 1, classXp: 1 },
  { name: 'Knight', enemyHp: 1.45, enemyDmg: 1.25, eliteMult: 1.5, gold: 1.6, classXp: 1.5 },
  { name: 'Champion', enemyHp: 2.1, enemyDmg: 1.6, eliteMult: 2.2, gold: 2.5, classXp: 2.2 },
  { name: 'Legend', enemyHp: 3.2, enemyDmg: 2.1, eliteMult: 3, gold: 4, classXp: 3.5 },
];
