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

/**
 * v0.6: what beating the Usurper pays (logic/save.ts applyRun), on top of the run's own gold, Runes and class XP and outside their caps.
 * Front-loaded: the first win with a class pays far more than any later one.
 */
export const VICTORY = {
  firstWin: { runes: 10, gold: 1000, classXp: 600 },
  win: { runes: 2, classXp: 250 },
  scorePerWave: 100, // Endless score for every wave cleared past the Usurper (plus one per kill)
  leaderboard: 5, // Endless scores kept per class
};

export type MetaId =
  | 'hp' | 'moveSpd' | 'traitSlot' | 'startRelic' | 'banish' // Armory (v0.6: str, dex, int and atkSpd became the three sidegrades)
  | 'classXp' | 'utilityCd' | 'startLevel' // Barracks
  | 'relicChance' | 'relicSlot' | 'salvage' // Chapel (v0.7: relicChance = rerolls at relic moments, relicSlot = a fourth boss option)
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
 * Gold buys the base ranks; the top ranks of a track also cost Runes, and a track's rank cap follows its building's level (BUILDINGS).
 * v0.6: the Keep adds options, not power. The Armory's four damage tracks (Strength, Dexterity, Intelligence, attack speed: +35% DPS
 * when maxed) became three sidegrades, HP and speed stop at three ranks, and Veteran Levies at one (BALANCE.md). Old ranks were
 * refunded in the save migration (logic/save.ts LEGACY_META).
 */
export const META: Record<MetaId, MetaDef> = {
  hp: { name: 'Hearty Stock', desc: '+4% max HP per rank', max: 3, baseCost: 65, growth: 1.6, perRank: 0.04, runesFrom: 2, runeCost: 1 },
  moveSpd: { name: 'Good Boots', desc: '+2% movement speed per rank', max: 3, baseCost: 80, growth: 1.6, perRank: 0.02, runesFrom: 2, runeCost: 1 },
  traitSlot: { name: 'Second Banner', desc: 'Choose two starting traits instead of one', max: 1, baseCost: 900, growth: 1, perRank: 1, runesFrom: 0, runeCost: 3 },
  startRelic: { name: "Armorer's Choice", desc: 'Every run starts with a choice of three common relics', max: 1, baseCost: 700, growth: 1, perRank: 1, runesFrom: 0, runeCost: 2 },
  banish: { name: "Quartermaster's Ledger", desc: 'Strike one level-up card from the run for good, once per rank a run', max: 3, baseCost: 260, growth: 1.8, perRank: 1, runesFrom: 2, runeCost: 1 },

  classXp: { name: 'Drill Sergeant', desc: '+10% class XP per rank', max: 3, baseCost: 190, growth: 1.8, perRank: 0.1 },
  utilityCd: { name: 'Sparring Ring', desc: 'Utility ability recharges 5% faster per rank', max: 3, baseCost: 240, growth: 1.8, perRank: 0.05, runesFrom: 2, runeCost: 1 },
  startLevel: { name: 'Veteran Levies', desc: 'Start every run one level higher', max: 1, baseCost: 800, growth: 2, perRank: 1, runesFrom: 1, runeCost: 2 },

  relicChance: { name: 'Reliquary Guard', desc: 'One more reroll at every relic moment per rank', max: 2, baseCost: 190, growth: 1.8, perRank: 1 }, // v0.7: was elite relic drops (max 3; the third rank is refunded)
  relicSlot: { name: 'Reliquary Vault', desc: 'Wave bosses offer a fourth relic to choose from', max: 1, baseCost: 1440, growth: 1, perRank: 1, runesFrom: 0, runeCost: 4 },
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
    name: 'Armory', icon: '⚔️', desc: 'Sturdier bodies, and more ways to start a run.',
    upgrades: ['hp', 'moveSpd', 'traitSlot', 'startRelic', 'banish'],
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
    name: 'Library', icon: '📚', desc: 'Its first level opens the talent keystones; boons and experience.',
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
    name: 'Watchtower', icon: '🗼', desc: 'Curses and bounties: more gold for curses, elites and bosses.',
    upgrades: ['curseBonus', 'eliteGold', 'bossGold'],
    levels: [{ gold: 400, runes: 1, achievement: 'bossSlayer' }, { gold: 1280, runes: 3, achievement: 'bossHunter' }, { gold: 3200, runes: 6, achievement: 'knight' }],
    capFrac: [0.34, 0.67, 1, 1],
  },
};
export const BUILDING_IDS = Object.keys(BUILDINGS) as BuildingId[];

/** The Library's level caps the talent rows: three rows in a ruin, the keystones (row 3) from level 1. (v0.4 opened only two rows at first: it read as a broken tree.) */
export const TALENT_ROW_CAP = [2, 3, 3, 3];

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
  | { kind: 'treasureStep'; step: number }; // v0.5 sacred treasures: 1 opens the chain, 2 the tier III follow-up (logic/treasures.ts)

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
  ['Relic-Bearer', { kind: 'treasureStep', step: 2 }],
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
/** Clearing wave TIER_UNLOCK_WAVE on Squire unlocks Knight (#79; also the pacing mark in BALANCE.md). */
export const TIER_UNLOCK_WAVE = 15;
/** v0.8 (#79): what opens each difficulty, by index into TIERS. Every key present must be met, in any order:
 * `wave` = clear that wave on that tier, `win` = beat the Usurper on that tier. Squire has none: it is open from the start. */
export const TIER_UNLOCK: { wave?: { tier: number; wave: number }; win?: number }[] = [
  {},
  { wave: { tier: 0, wave: TIER_UNLOCK_WAVE } },
  { wave: { tier: 1, wave: 30 }, win: 0 },
  { win: 2 },
];
export const TIERS: TierDef[] = [
  { name: 'Squire', enemyHp: 1, enemyDmg: 1, eliteMult: 1, gold: 1, classXp: 1 },
  { name: 'Knight', enemyHp: 1.45, enemyDmg: 1.25, eliteMult: 1.5, gold: 1.6, classXp: 1.5 },
  { name: 'Champion', enemyHp: 2.1, enemyDmg: 1.6, eliteMult: 2.2, gold: 2.5, classXp: 2.2 },
  { name: 'Legend', enemyHp: 3.2, enemyDmg: 2.1, eliteMult: 3, gold: 4, classXp: 3.5 },
];
