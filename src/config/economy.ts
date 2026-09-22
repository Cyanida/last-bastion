/** Gold, Runes, the Keep (buildings and permanent upgrades), class mastery, the account level and difficulty tiers. */

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

/**
 * Runes (v0.4): the Keep's second currency. Only Act bosses, quests, treasure steps and achievement tiers pay them
 * (plus salvaged relics, ten shards to a Rune). Gold from curses and the Daily Trial is capped per day (BALANCE.md).
 */
export const RUNES = {
  perActBoss: [1, 1, 2] as number[], // the Act I, II, III+ boss
  runCap: 4, // Runes one run can pay from its bosses (shards come on top)
  shardsPerRune: 10,
  quest: 1,
  achievementTier: [1, 2, 4] as number[], // bronze, silver, gold (v0.4 achievements)
  dailyCaps: { curseGold: 600, trialGold: 400 }, // per calendar day, raised by the Treasury
  /** Gold banked by one run: face value up to the cap, then diminishing (never more than twice the cap). A single deep run must not buy the Keep (BALANCE.md). */
  runGoldCap: 1200,
};

export type MetaId =
  | 'hp' | 'str' | 'dex' | 'int' | 'atkSpd' | 'moveSpd' // Armory
  | 'classXp' | 'utilityCd' | 'startLevel' // Barracks
  | 'relicChance' | 'relicSlot' | 'salvage' // Chapel (relicSlot became the tier III vault in v0.4)
  | 'talentPoint' | 'rerolls' | 'xp' // Library
  | 'startGold' | 'pickup' | 'goldIncome' | 'runeIncome' | 'dailyCap' // Treasury
  | 'curseBonus' | 'eliteGold' | 'bossGold'; // Watchtower

export interface MetaDef {
  name: string;
  desc: string;
  max: number;
  baseCost: number;
  growth: number; // cost(rank) = baseCost * growth^rank
  perRank: number;
  runesFrom?: number; // ranks from this one on also cost Runes (runeCost each)
  runeCost?: number;
}

/**
 * Power budget: all six stat tracks maxed is about +20% EHP and +35% DPS (BALANCE.md). Gold buys the base ranks; the top ranks of
 * every track also cost Runes, and a track's rank cap follows its building's level (BUILDINGS).
 */
export const META: Record<MetaId, MetaDef> = {
  hp: { name: 'Hearty Stock', desc: '+4% max HP per rank', max: 5, baseCost: 65, growth: 1.6, perRank: 0.04, runesFrom: 3, runeCost: 1 },
  str: { name: 'Drill Yard', desc: '+1 Strength per rank', max: 5, baseCost: 65, growth: 1.6, perRank: 1, runesFrom: 3, runeCost: 1 },
  dex: { name: 'Archery Butts', desc: '+1 Dexterity per rank', max: 5, baseCost: 65, growth: 1.6, perRank: 1, runesFrom: 3, runeCost: 1 },
  int: { name: 'Scriptorium', desc: '+1 Intelligence per rank', max: 5, baseCost: 65, growth: 1.6, perRank: 1, runesFrom: 3, runeCost: 1 },
  atkSpd: { name: 'Balanced Arms', desc: '+2% attack speed per rank', max: 5, baseCost: 80, growth: 1.6, perRank: 0.02, runesFrom: 3, runeCost: 1 },
  moveSpd: { name: 'Good Boots', desc: '+2% movement speed per rank', max: 5, baseCost: 80, growth: 1.6, perRank: 0.02, runesFrom: 3, runeCost: 1 },

  classXp: { name: 'Drill Sergeant', desc: '+10% class XP per rank', max: 3, baseCost: 190, growth: 1.8, perRank: 0.1 },
  utilityCd: { name: 'Sparring Ring', desc: 'Utility ability recharges 5% faster per rank', max: 3, baseCost: 240, growth: 1.8, perRank: 0.05, runesFrom: 2, runeCost: 1 },
  startLevel: { name: 'Veteran Levies', desc: 'Start every run one level higher per rank', max: 2, baseCost: 800, growth: 2, perRank: 1, runesFrom: 1, runeCost: 2 },

  relicChance: { name: 'Reliquary Guard', desc: 'Elites drop relics 10% more often per rank', max: 3, baseCost: 190, growth: 1.8, perRank: 0.1 },
  relicSlot: { name: 'Reliquary Vault', desc: 'Relics can be raised to tier III', max: 1, baseCost: 1440, growth: 1, perRank: 1, runesFrom: 0, runeCost: 4 },
  salvage: { name: 'Smelter', desc: 'Salvage yields 50% more shards per rank', max: 2, baseCost: 320, growth: 2, perRank: 0.5 },

  talentPoint: { name: 'Lectern', desc: 'Start every run with one talent point per rank', max: 2, baseCost: 640, growth: 2, perRank: 1, runesFrom: 1, runeCost: 2 },
  rerolls: { name: 'Fickle Fortune', desc: '+1 free reroll on every level-up', max: 2, baseCost: 400, growth: 3, perRank: 1 },
  xp: { name: 'Chronicler', desc: '+5% experience per rank', max: 5, baseCost: 95, growth: 1.7, perRank: 0.05, runesFrom: 3, runeCost: 1 },

  startGold: { name: 'War Chest', desc: '+20 starting gold per rank (for paid rerolls)', max: 5, baseCost: 50, growth: 1.5, perRank: 20 },
  pickup: { name: 'Squire', desc: '+10% pickup radius per rank', max: 5, baseCost: 40, growth: 1.5, perRank: 0.1 },
  goldIncome: { name: 'Tax Collector', desc: '+8% gold banked per rank', max: 5, baseCost: 160, growth: 1.7, perRank: 0.08, runesFrom: 3, runeCost: 1 },
  runeIncome: { name: 'Rune Carver', desc: 'Act bosses pay one more Rune per rank', max: 2, baseCost: 960, growth: 2, perRank: 1, runesFrom: 0, runeCost: 3 },
  dailyCap: { name: 'Toll Gate', desc: 'A run banks 400 more gold at face value per rank; daily caps +200', max: 3, baseCost: 240, growth: 1.8, perRank: 200 },

  curseBonus: { name: 'Gallows', desc: 'Every curse pays 5% more gold and class XP per rank', max: 3, baseCost: 240, growth: 1.8, perRank: 0.05 },
  eliteGold: { name: 'Bounty Board', desc: 'Elites drop 20% more gold per rank', max: 3, baseCost: 160, growth: 1.8, perRank: 0.2 },
  bossGold: { name: 'Trophy Hall', desc: 'Boss kills pay 30 more gold per rank', max: 3, baseCost: 190, growth: 1.8, perRank: 30, runesFrom: 2, runeCost: 1 },
};
export const META_IDS = Object.keys(META) as MetaId[];

export type BuildingId = 'armory' | 'barracks' | 'chapel' | 'library' | 'treasury' | 'watchtower';

export interface BuildingLevel {
  gold: number;
  runes: number;
  achievement?: string; // an achievement id that must be earned first
}

export interface BuildingDef {
  name: string;
  icon: string;
  desc: string;
  upgrades: MetaId[];
  /** Raising the building to level i+1 costs levels[i]. Level 0 is the ruin you start with. */
  levels: BuildingLevel[];
  /** Rank cap of its upgrades at building level 0, 1, 2, 3 (as a fraction of each track's max, rounded up). */
  capFrac: number[];
}

/**
 * The Keep (v0.4): six buildings. Each holds a few upgrade tracks; the building's level caps how far they can be bought,
 * and raising a building costs gold, Runes and a deed (an achievement). Full price of everything: BALANCE.md, tuned with
 * `npm run sim -- economy` to about 40-60 average runs.
 */
export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  armory: {
    name: 'Armory', icon: '⚔️', desc: 'Core stats for every champion.',
    upgrades: ['hp', 'str', 'dex', 'int', 'atkSpd', 'moveSpd'],
    levels: [{ gold: 320, runes: 1, achievement: 'firstBlood' }, { gold: 1120, runes: 3, achievement: 'wave10' }, { gold: 2880, runes: 6, achievement: 'act1' }],
    capFrac: [0.4, 0.6, 0.8, 1],
  },
  barracks: {
    name: 'Barracks', icon: '🏕️', desc: 'Class mastery, traits and the second ability.',
    upgrades: ['classXp', 'utilityCd', 'startLevel'],
    levels: [{ gold: 400, runes: 1, achievement: 'allClasses' }, { gold: 1280, runes: 3, achievement: 'veteran' }, { gold: 3200, runes: 6, achievement: 'master' }],
    capFrac: [0.34, 0.67, 1, 1],
  },
  chapel: {
    name: 'Chapel', icon: '⛪', desc: 'The relic compendium, relic tiers and the treasure quests.',
    upgrades: ['relicChance', 'relicSlot', 'salvage'],
    levels: [{ gold: 400, runes: 1, achievement: 'collector' }, { gold: 1280, runes: 3, achievement: 'eliteHunter' }, { gold: 3200, runes: 6, achievement: 'rogues' }],
    capFrac: [0.34, 0.67, 1, 1],
  },
  library: {
    name: 'Library', icon: '📚', desc: 'Talent rows and keystones, boons and experience.',
    upgrades: ['talentPoint', 'rerolls', 'xp'],
    levels: [{ gold: 400, runes: 1, achievement: 'ascended' }, { gold: 1280, runes: 3, achievement: 'wave20' }, { gold: 3200, runes: 6, achievement: 'act2' }],
    capFrac: [0.34, 0.67, 1, 1],
  },
  treasury: {
    name: 'Treasury', icon: '💰', desc: 'Gold and Rune income, daily caps.',
    upgrades: ['startGold', 'pickup', 'goldIncome', 'runeIncome', 'dailyCap'],
    levels: [{ gold: 320, runes: 1, achievement: 'treasurer' }, { gold: 1120, runes: 3, achievement: 'patron' }, { gold: 2880, runes: 6, achievement: 'slayer' }],
    capFrac: [0.4, 0.6, 0.8, 1],
  },
  watchtower: {
    name: 'Watchtower', icon: '🗼', desc: 'Curses, bounties and the higher difficulties.',
    upgrades: ['curseBonus', 'eliteGold', 'bossGold'],
    levels: [{ gold: 400, runes: 1, achievement: 'bossSlayer' }, { gold: 1280, runes: 3, achievement: 'bossHunter' }, { gold: 3200, runes: 6, achievement: 'knight' }],
    capFrac: [0.34, 0.67, 1, 1],
  },
};
export const BUILDING_IDS = Object.keys(BUILDINGS) as BuildingId[];

/** The Library's level caps the talent rows anyone can take: rows 0-1 in a ruin, row 2 at level 1, keystones at level 2. */
export const TALENT_ROW_CAP = [1, 2, 3, 3];

/** Class XP from one run, before the tier multiplier. */
export const CLASS_XP = { perWaveCleared: 10, perBoss: 30, perLevel: 2 };

export type MasteryReward =
  | { kind: 'secondary'; amount: number }
  | { kind: 'reroll'; amount: number }
  | { kind: 'relic' } // start with a random common relic
  | { kind: 'talentPoint'; amount: number }
  | { kind: 'utilityCd'; amount: number }
  | { kind: 'classXp'; amount: number }
  | { kind: 'startLevel'; amount: number }
  | { kind: 'utilityTier' } // the second utility upgrade (level 14) is offered
  | { kind: 'title'; title: string }
  | { kind: 'palette'; palette: number } // sprite recolour
  | { kind: 'treasureStep'; step: number }; // sacred treasure quest step unlocked (increment 8)

export interface MasteryRank {
  xp: number; // total class XP needed
  name: string;
  reward: MasteryReward;
}

/** 25 ranks per class, every one a named unlock. Thresholds: MASTERY_XP_TOTAL * (rank / 25)^1.5, about 40 runs of a class. */
const MASTERY_XP_TOTAL = 8000;
const ranks: [string, MasteryReward][] = [
  ['Squire', { kind: 'secondary', amount: 1 }],
  ['Initiate', { kind: 'title', title: 'Initiate' }],
  ['Keepsake', { kind: 'relic' }],
  ['Second Thoughts', { kind: 'reroll', amount: 1 }],
  ['Drilled', { kind: 'utilityTier' }],
  ['Devoted', { kind: 'secondary', amount: 1 }],
  ['Ashen Colours', { kind: 'palette', palette: 1 }],
  ['Quick Hands', { kind: 'utilityCd', amount: 0.05 }],
  ['Chronicled', { kind: 'classXp', amount: 0.05 }],
  ['Rumours of Relics', { kind: 'treasureStep', step: 1 }],
  ['Steadfast', { kind: 'secondary', amount: 1 }],
  ['Veteran', { kind: 'title', title: 'Veteran' }],
  ['Prodigy', { kind: 'talentPoint', amount: 1 }],
  ['Quicker Hands', { kind: 'utilityCd', amount: 0.05 }],
  ['Gilded Colours', { kind: 'palette', palette: 2 }],
  ['Exalted', { kind: 'secondary', amount: 2 }],
  ['Storied', { kind: 'classXp', amount: 0.05 }],
  ['Third Thoughts', { kind: 'reroll', amount: 1 }],
  ['Seasoned', { kind: 'startLevel', amount: 1 }],
  ['The Trial', { kind: 'treasureStep', step: 2 }],
  ['Paragon', { kind: 'secondary', amount: 2 }],
  ['Master', { kind: 'title', title: 'Master' }],
  ['Midnight Colours', { kind: 'palette', palette: 3 }],
  ['Quickest Hands', { kind: 'utilityCd', amount: 0.05 }],
  ['Grandmaster', { kind: 'title', title: 'Grandmaster' }],
];
export const MASTERY: MasteryRank[] = ranks.map(([name, reward], i) => ({ xp: Math.round(MASTERY_XP_TOTAL * Math.pow((i + 1) / ranks.length, 1.5)), name, reward }));

/** Account level = the sum of every class's mastery rank (0-125); milestones unlock account-wide perks. */
export const ACCOUNT_MILESTONES: { level: number; name: string; desc: string; mods?: { gold?: number; xp?: number; damage?: number }; reroll?: number; talentPoint?: number }[] = [
  { level: 10, name: 'Household', desc: '+5% gold banked', mods: { gold: 1.05 } },
  { level: 25, name: 'Retinue', desc: '+1 free reroll on every level-up', reroll: 1 },
  { level: 50, name: 'Company', desc: '+5% experience', mods: { xp: 1.05 } },
  { level: 75, name: 'Host', desc: 'Start every run with a talent point', talentPoint: 1 },
  { level: 100, name: 'Legend of the Bastion', desc: '+10% damage', mods: { damage: 1.1 } },
];

export interface TierDef {
  name: string;
  enemyHp: number;
  enemyDmg: number;
  eliteMult: number;
  gold: number;
  classXp: number;
}
/** Clearing wave TIER_UNLOCK_WAVE on your highest tier unlocks the next one (and the Watchtower must be one level higher). */
export const TIER_UNLOCK_WAVE = 15;
export const TIERS: TierDef[] = [
  { name: 'Squire', enemyHp: 1, enemyDmg: 1, eliteMult: 1, gold: 1, classXp: 1 },
  { name: 'Knight', enemyHp: 1.45, enemyDmg: 1.25, eliteMult: 1.5, gold: 1.6, classXp: 1.5 },
  { name: 'Champion', enemyHp: 2.1, enemyDmg: 1.6, eliteMult: 2.2, gold: 2.5, classXp: 2.2 },
  { name: 'Legend', enemyHp: 3.2, enemyDmg: 2.1, eliteMult: 3, gold: 4, classXp: 3.5 },
];
