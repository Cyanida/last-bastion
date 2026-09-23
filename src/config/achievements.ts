import { buildingLevel, masteryRank } from '../logic/economy';
import type { Save } from '../logic/save';
import type { ArenaId } from './arenas';
import { CLASS_ORDER, type ClassId } from './classes';
import type { CurseId } from './curses';
import { BUILDING_IDS, MASTERY, META_IDS, RUNES } from './economy';
import { RELIC_IDS, type RelicId } from './relics';
import type { TraitId } from './traits';

export type AchievementCategory = 'survival' | 'combat' | 'class' | 'collection' | 'challenges' | 'secrets';

export const CATEGORIES: Record<AchievementCategory, string> = {
  survival: 'Survival',
  combat: 'Combat',
  class: 'Champions',
  collection: 'Collection',
  challenges: 'Challenges',
  secrets: 'Secrets',
};

/** What one tier pays on top of its Runes. A `trait` only names the trait that config/traits.ts already gates on this id. */
export interface AchievementReward {
  runes?: number; // extra, on top of RUNES.achievementTier
  title?: string;
  trait?: TraitId;
  palette?: number; // account-wide sprite palette (SPRITE_PALETTES)
  talentPoint?: number; // permanent starting talent point
  fragment?: boolean; // v0.5: a fragment of the class's sacred treasure (a Rune once it has all three)
}

export interface AchievementTier {
  target: number;
  reward: AchievementReward;
}

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  category: AchievementCategory;
  classId?: ClassId; // class feats
  tiers: AchievementTier[]; // 1-3, rising targets: bronze, silver, gold
  progress: (s: Save) => number;
  hidden?: boolean; // only its hint is shown until the bronze tier is earned
  hint?: string;
  unlocks?: { arena?: ArenaId; relic?: RelicId; curse?: CurseId }; // granted with the bronze tier
}

/** Per-run class feats, recorded by systems/feats.ts and kept as "best run" counters in the save. */
export const FEAT_KEYS = ['absorb', 'taunted', 'rageKills', 'leapHits', 'radiance', 'blinks', 'minions', 'corpseHits', 'volleyHits', 'rolls'] as const;
export type FeatKey = (typeof FEAT_KEYS)[number];

/** Runes a tier pays: the tier's share (RUNES.achievementTier) plus anything the tier adds itself. */
export const tierReward = (a: AchievementDef, tier: number): AchievementReward => ({
  ...a.tiers[tier - 1].reward,
  runes: RUNES.achievementTier[Math.min(RUNES.achievementTier.length - 1, tier - 1)] + (a.tiers[tier - 1].reward.runes ?? 0),
});

/** Rising targets; `rewards` is keyed by tier number (1 = bronze). Every tier pays Runes whether or not it is listed. */
const tiers = (targets: number[], rewards: Record<number, AchievementReward> = {}): AchievementTier[] => targets.map((target, i) => ({ target, reward: rewards[i + 1] ?? {} }));

const classes = (s: Save) => CLASS_ORDER.map((id) => s.classes[id]);
const bestWave = (s: Save) => Math.max(...classes(s).map((c) => c.bestWave));
const totalTime = (s: Save) => classes(s).reduce((n, c) => n + c.time, 0);
const minRank = (s: Save) => Math.min(...classes(s).map((c) => masteryRank(c.xp)));
const relicPicks = (s: Save) => Object.values(s.relicPicks).map((n) => n ?? 0);
const top = (xs: number[]) => Math.max(0, ...xs);

export const ACHIEVEMENTS: AchievementDef[] = [
  // ---------------------------------------------------------------- survival
  { id: 'wave10', name: 'Holding the Line', desc: 'Reach wave 10, 12 and 15 with any class.', category: 'survival', tiers: tiers([10, 12, 15], { 1: { trait: 'pilgrim' }, 3: { title: 'the Steadfast', talentPoint: 1 } }), progress: bestWave, unlocks: { arena: 'graveyard', curse: 'timedWaves' } },
  { id: 'wave20', name: 'Unbroken', desc: 'Reach wave 20, 25 and 30 with any class.', category: 'survival', tiers: tiers([20, 25, 30], { 3: { title: 'the Unbroken', palette: 1 } }), progress: bestWave },
  { id: 'wave20all', name: 'Five Banners', desc: 'Reach wave 20 with all five classes.', category: 'survival', tiers: tiers([5], { 1: { title: 'Banner-Bearer' } }), progress: (s) => classes(s).filter((c) => c.bestWave >= 20).length, unlocks: { relic: 'stormcallersHorn' } }, // v0.7: Conqueror's Crown left with the stat relics
  { id: 'fiveMarches', name: 'Five Marches', desc: 'Reach wave 10 with three, four and all five classes.', category: 'survival', tiers: tiers([3, 4, 5]), progress: (s) => classes(s).filter((c) => c.bestWave >= 10).length },
  { id: 'allClasses', name: 'Jack of All Arms', desc: 'Finish a run with every class.', category: 'survival', tiers: tiers([5]), progress: (s) => classes(s).filter((c) => c.runs > 0).length },
  { id: 'veteran', name: 'Veteran', desc: 'Finish 25, 100 and 250 runs.', category: 'survival', tiers: tiers([25, 100, 250], { 3: { title: 'the Tireless' } }), progress: (s) => classes(s).reduce((n, c) => n + c.runs, 0) },
  { id: 'marathon', name: 'Long Campaign', desc: 'Spend 5, 20 and 50 hours in the courtyard.', category: 'survival', tiers: tiers([18000, 72000, 180000], { 3: { title: 'the Sleepless' } }), progress: totalTime },
  { id: 'act1', name: 'Curtain Call', desc: 'Clear Act I: ten waves and its boss.', category: 'survival', tiers: tiers([1]), progress: (s) => s.counters.actsCleared, unlocks: { curse: 'noRespite' } },
  { id: 'act2', name: 'Second Act', desc: 'Clear two, three and four Acts in one run.', category: 'survival', tiers: tiers([2, 3, 4], { 3: { title: 'the Relentless', talentPoint: 1 } }), progress: (s) => s.counters.actsCleared, unlocks: { curse: 'frenzy' } },
  // v0.6: the Usurper and beyond
  { id: 'usurper', name: 'Kingslayer', desc: 'Beat the Usurper: win 1, 5 and 20 runs.', category: 'survival', tiers: tiers([1, 5, 20], { 1: { title: 'Kingslayer' }, 3: { title: 'the Liberator', talentPoint: 1 } }), progress: (s) => CLASS_ORDER.reduce((n, id) => n + s.wins[id], 0) },
  { id: 'crowns', name: 'Five Crowns', desc: 'Win with two, four and all five champions.', category: 'survival', tiers: tiers([2, 4, 5], { 3: { title: 'Crownbreaker', talentPoint: 1 } }), progress: (s) => CLASS_ORDER.filter((id) => s.wins[id] > 0).length },
  { id: 'endless', name: 'Beyond the Throne', desc: 'Past the Usurper, in Endless: reach wave 45, 50 and 60.', category: 'survival', tiers: tiers([45, 50, 60], { 3: { title: 'the Endless' } }), progress: bestWave },
  { id: 'swift', name: 'Forced March', desc: 'Reach wave 10 in under 6, 5 and 4 minutes.', category: 'survival', tiers: tiers([1, 2, 3], { 3: { title: 'the Swift' } }), progress: (s) => [360, 300, 240].filter((limit) => s.counters.fastestWave10 > 0 && s.counters.fastestWave10 <= limit).length },

  // ---------------------------------------------------------------- combat
  { id: 'firstBlood', name: 'First Blood', desc: 'Slay 100, 500 and 2,000 enemies.', category: 'combat', tiers: tiers([100, 500, 2000], { 3: { title: 'Blooded' } }), progress: (s) => s.counters.kills, unlocks: { curse: 'ironHorde' } },
  { id: 'slayer', name: 'Butcher of the Bastion', desc: 'Slay 5,000, 20,000 and 50,000 enemies.', category: 'combat', tiers: tiers([5000, 20000, 50000], { 3: { title: 'the Butcher' } }), progress: (s) => s.counters.kills },
  { id: 'eliteHunter', name: 'Elite Hunter', desc: 'Slay 50, 250 and 1,000 elite enemies.', category: 'combat', tiers: tiers([50, 250, 1000], { 1: { trait: 'cursedLuck' }, 3: { title: 'Elitebane' } }), progress: (s) => s.counters.elites, unlocks: { relic: 'soulLantern' } },
  { id: 'bossSlayer', name: 'Giant Killer', desc: 'Defeat a boss.', category: 'combat', tiers: tiers([1]), progress: (s) => s.counters.bosses, unlocks: { curse: 'glassBones' } },
  { id: 'bossHunter', name: 'Boss Hunter', desc: 'Defeat 5, 25 and 100 bosses.', category: 'combat', tiers: tiers([5, 25, 100], { 3: { title: 'Kingsbane' } }), progress: (s) => s.counters.bosses, unlocks: { arena: 'keep', curse: 'blind' } },
  { id: 'rogues', name: "Rogues' Gallery", desc: 'Defeat all five different bosses.', category: 'combat', tiers: tiers([5], { 1: { palette: 2 } }), progress: (s) => s.counters.bossKinds.length },
  { id: 'flawless', name: 'Untouchable', desc: 'Defeat 1, 10 and 25 bosses without taking damage while they live.', category: 'combat', tiers: tiers([1, 10, 25], { 1: { trait: 'duelist' }, 3: { title: 'the Untouched' } }), progress: (s) => s.counters.flawlessBosses, unlocks: { relic: 'phoenixFeather' } },
  { id: 'commanders', name: 'Cut Off the Head', desc: 'Slay 10, 50 and 200 commanders.', category: 'combat', tiers: tiers([10, 50, 200], { 3: { title: 'Headtaker' } }), progress: (s) => s.counters.commanders, unlocks: { curse: 'eliteCommanders' } },
  { id: 'championKills', name: "Champion's Tally", desc: 'Slay 2,000, 6,000 and 15,000 enemies with a single champion.', category: 'combat', tiers: tiers([2000, 6000, 15000], { 3: { title: 'Warlord' } }), progress: (s) => top(classes(s).map((c) => c.kills)) },
  { id: 'evenHand', name: 'Even Hand', desc: 'Slay 250, 1,000 and 3,000 enemies with every champion.', category: 'combat', tiers: tiers([250, 1000, 3000], { 3: { title: 'the Even-Handed' } }), progress: (s) => Math.min(...classes(s).map((c) => c.kills)) },

  // ---------------------------------------------------------------- champions (class feats, two per class plus its mastery track)
  { id: 'paladinShield', name: 'Bulwark', desc: 'Absorb 2,000, 5,000 and 12,000 damage with one Divine Shield.', category: 'class', classId: 'paladin', tiers: tiers([2000, 5000, 12000], { 3: { title: 'the Bulwark' } }), progress: (s) => s.counters.absorb },
  { id: 'paladinTaunt', name: 'Challenger', desc: 'Pull 10, 20 and 35 enemies with one Challenge.', category: 'class', classId: 'paladin', tiers: tiers([10, 20, 35]), progress: (s) => s.counters.taunted },
  { id: 'paladinMastery', name: 'Oath-Keeper', desc: 'Reach Paladin mastery rank 5, 12 and 20.', category: 'class', classId: 'paladin', tiers: tiers([5, 12, 20], { 3: { fragment: true } }), progress: (s) => masteryRank(s.classes.paladin.xp) },
  { id: 'vikingRage', name: 'Blood Frenzy', desc: 'Slay 25, 60 and 100 enemies during one Berserker Rage.', category: 'class', classId: 'viking', tiers: tiers([25, 60, 100], { 3: { title: 'the Wrathful' } }), progress: (s) => s.counters.rageKills },
  { id: 'vikingLeap', name: 'Thunderfoot', desc: 'Strike 10, 20 and 30 enemies with one Leap.', category: 'class', classId: 'viking', tiers: tiers([10, 20, 30]), progress: (s) => s.counters.leapHits },
  { id: 'vikingMastery', name: 'Shieldbiter', desc: 'Reach Viking mastery rank 5, 12 and 20.', category: 'class', classId: 'viking', tiers: tiers([5, 12, 20], { 3: { fragment: true } }), progress: (s) => masteryRank(s.classes.viking.xp) },
  { id: 'angelHeal', name: 'Mercy', desc: 'Heal 1,000, 4,000 and 10,000 with Heavenly Radiance in one run.', category: 'class', classId: 'angel', tiers: tiers([1000, 4000, 10000], { 3: { title: 'the Merciful' } }), progress: (s) => s.counters.radiance },
  { id: 'angelBlink', name: 'Featherfoot', desc: 'Blink 20, 50 and 100 times in one run.', category: 'class', classId: 'angel', tiers: tiers([20, 50, 100]), progress: (s) => s.counters.blinks },
  { id: 'angelMastery', name: 'Choir of One', desc: 'Reach Angel mastery rank 5, 12 and 20.', category: 'class', classId: 'angel', tiers: tiers([5, 12, 20], { 3: { fragment: true } }), progress: (s) => masteryRank(s.classes.angel.xp) },
  { id: 'necroHorde', name: 'Grave Legion', desc: 'Have 8, 14 and 20 minions alive at once.', category: 'class', classId: 'necromancer', tiers: tiers([8, 14, 20], { 3: { title: 'the Grave-Caller' } }), progress: (s) => s.counters.minions },
  { id: 'necroBlast', name: 'Corpse Carnival', desc: 'Catch 15, 30 and 50 enemies in one Corpse Explosion.', category: 'class', classId: 'necromancer', tiers: tiers([15, 30, 50]), progress: (s) => s.counters.corpseHits },
  { id: 'necroMastery', name: 'Lord of Bones', desc: 'Reach Necromancer mastery rank 5, 12 and 20.', category: 'class', classId: 'necromancer', tiers: tiers([5, 12, 20], { 3: { fragment: true } }), progress: (s) => masteryRank(s.classes.necromancer.xp) },
  { id: 'archerVolley', name: 'Arrow Storm', desc: 'Catch 12, 25 and 40 enemies under one Arrow Volley.', category: 'class', classId: 'archer', tiers: tiers([12, 25, 40], { 3: { title: 'the Storm' } }), progress: (s) => s.counters.volleyHits },
  { id: 'archerRoll', name: 'Tumbler', desc: 'Dodge roll 20, 50 and 100 times in one run.', category: 'class', classId: 'archer', tiers: tiers([20, 50, 100]), progress: (s) => s.counters.rolls },
  { id: 'archerMastery', name: 'Keen Eye', desc: 'Reach Archer mastery rank 5, 12 and 20.', category: 'class', classId: 'archer', tiers: tiers([5, 12, 20], { 3: { fragment: true } }), progress: (s) => masteryRank(s.classes.archer.xp) },

  // ---------------------------------------------------------------- collection
  { id: 'collector', name: 'Reliquarian', desc: 'Hold 6, 10 and 15 relics in a single run.', category: 'collection', tiers: tiers([6, 10, 15]), progress: (s) => s.counters.maxRelics },
  { id: 'curator', name: 'Curator', desc: 'Discover 10, 20 and 28 different relics.', category: 'collection', tiers: tiers([10, 20, 28], { 3: { palette: 3 } }), progress: (s) => relicPicks(s).filter((n) => n > 0).length },
  { id: 'hoarder', name: 'Devoted', desc: 'Find the same relic 5, 15 and 30 times.', category: 'collection', tiers: tiers([5, 15, 30]), progress: (s) => top(relicPicks(s)) },
  { id: 'treasurer', name: 'Treasurer', desc: 'Bank 5,000, 25,000 and 100,000 gold in total.', category: 'collection', tiers: tiers([5000, 25000, 100000], { 1: { trait: 'scavenger' }, 3: { title: 'the Wealthy' } }), progress: (s) => s.counters.goldEarned, unlocks: { curse: 'swarm' } },
  { id: 'patron', name: 'Lord of the Keep', desc: 'Buy 15, 45 and 82 ranks of permanent upgrades.', category: 'collection', tiers: tiers([15, 45, 82], { 3: { title: 'Lord of the Keep', talentPoint: 1 } }), progress: (s) => META_IDS.reduce((n, id) => n + (s.meta[id] ?? 0), 0) },
  { id: 'mason', name: 'Master Mason', desc: 'Raise the Keep to 6, 12 and 18 building levels.', category: 'collection', tiers: tiers([6, 12, 18], { 3: { title: 'the Architect' } }), progress: (s) => BUILDING_IDS.reduce((n, id) => n + buildingLevel(s.buildings, id), 0) },
  { id: 'runeHoard', name: 'Rune Hoard', desc: 'Hold 10, 30 and 60 Runes at once.', category: 'collection', tiers: tiers([10, 30, 60]), progress: (s) => s.runes },
  { id: 'ascended', name: 'Ascended', desc: 'Choose all three ability upgrades in one run.', category: 'collection', tiers: tiers([3]), progress: (s) => s.counters.maxAbilityUpgrades },
  { id: 'master', name: 'Master-at-Arms', desc: 'Reach mastery rank 5, 15 and 25 with any class.', category: 'collection', tiers: tiers([MASTERY[4].xp, MASTERY[14].xp, MASTERY[24].xp], { 3: { title: 'Master-at-Arms' } }), progress: (s) => top(classes(s).map((c) => c.xp)) },
  { id: 'keeperOfRelics', name: 'Keeper of Relics', desc: 'Earn 1, 3 and 5 sacred treasures.', category: 'collection', tiers: tiers([1, 3, 5], { 3: { title: 'Keeper of Relics' } }), progress: (s) => CLASS_ORDER.filter((id) => s.treasures[id].tier > 0).length },
  { id: 'fiveMasters', name: 'Five Masters', desc: 'Reach mastery rank 3, 5 and 10 with every class.', category: 'collection', tiers: tiers([3, 5, 10], { 3: { title: 'the Paragon' } }), progress: minRank },

  // ---------------------------------------------------------------- challenges
  { id: 'knight', name: 'Dubbed a Knight', desc: 'Clear wave 15 on Squire, Knight and Champion to unlock the next difficulty.', category: 'challenges', tiers: tiers([1, 2, 3], { 3: { title: 'the Legend', talentPoint: 1 } }), progress: (s) => s.tierUnlocked },
  { id: 'cursed', name: 'Thrice Cursed', desc: 'Clear Act I with three, five and all eight curses active.', category: 'challenges', tiers: tiers([3, 5, 8], { 3: { title: 'the Damned' } }), progress: (s) => s.counters.cursedActs },
  { id: 'daily', name: 'Trial by Date', desc: 'Finish 1, 10 and 30 Daily Trials.', category: 'challenges', tiers: tiers([1, 10, 30], { 3: { title: 'the Dutiful' } }), progress: (s) => s.counters.dailies },
  { id: 'dailyDeep', name: 'Trial Master', desc: 'Reach wave 10, 20 and 30 in a Daily Trial.', category: 'challenges', tiers: tiers([10, 20, 30]), progress: (s) => top(Object.values(s.daily)) },
  { id: 'dailyDevotee', name: 'Faithful Attendance', desc: 'Take the Daily Trial on 5, 15 and 30 different days.', category: 'challenges', tiers: tiers([5, 15, 30]), progress: (s) => Object.keys(s.daily).length },
  { id: 'errant', name: 'Errant', desc: 'Complete 5, 25 and 100 side quests.', category: 'challenges', tiers: tiers([5, 25, 100], { 3: { title: 'the Errant' } }), progress: (s) => s.counters.quests },
  { id: 'worldly', name: 'Worldly', desc: 'Come upon 5, 20 and 60 wave events.', category: 'challenges', tiers: tiers([5, 20, 60], { 3: { title: 'the Well-Travelled' } }), progress: (s) => s.counters.events },
  { id: 'deeds', name: 'Chronicler', desc: 'Earn 20, 40 and 70 deeds.', category: 'challenges', tiers: tiers([20, 40, 70], { 3: { title: 'the Chronicler' } }), progress: (s) => s.achievements.length },

  // ---------------------------------------------------------------- secrets (hidden until earned)
  { id: 'shardMiser', name: 'Chaff and Dust', desc: 'Hold nine Rune shards at once — one short of a Rune.', category: 'secrets', hidden: true, hint: 'Something glitters in the dust.', tiers: tiers([RUNES.shardsPerRune - 1]), progress: (s) => s.runeShards },
  { id: 'speedDemon', name: 'Ahead of the Horde', desc: 'Reach wave 10 in under three minutes.', category: 'secrets', hidden: true, hint: 'Faster than the horde can march.', tiers: tiers([1], { 1: { title: 'the Fleet' } }), progress: (s) => (s.counters.fastestWave10 > 0 && s.counters.fastestWave10 <= 180 ? 1 : 0) },
  { id: 'relicLord', name: 'Nothing Left to Find', desc: 'Discover every relic in the compendium.', category: 'secrets', hidden: true, hint: 'Every last one of them.', tiers: tiers([RELIC_IDS.length], { 1: { title: 'the Reliquary' } }), progress: (s) => relicPicks(s).filter((n) => n > 0).length },
  { id: 'grandmasters', name: 'Five Grandmasters', desc: 'Reach the final mastery rank with every class.', category: 'secrets', hidden: true, hint: 'Master all five, to the last rank.', tiers: tiers([MASTERY.length], { 1: { title: 'the Grandmaster', talentPoint: 1 } }), progress: minRank },
  { id: 'thirteen', name: 'Thirteen Banners', desc: 'Reach wave 13 with all five classes.', category: 'secrets', hidden: true, hint: 'Thirteen banners on the wall.', tiers: tiers([5]), progress: (s) => classes(s).filter((c) => c.bestWave >= 13).length },
  { id: 'dragonHoard', name: "Dragon's Hoard", desc: 'Bank half a million gold.', category: 'secrets', hidden: true, hint: 'Gold enough to shame a dragon.', tiers: tiers([500000], { 1: { title: 'the Gilded' } }), progress: (s) => s.counters.goldEarned },
  { id: 'legion', name: 'Endless Legion', desc: 'Have twenty-five minions alive at once.', category: 'secrets', hidden: true, hint: 'An army that never tires.', tiers: tiers([25]), progress: (s) => s.counters.minions },
  { id: 'atlas', name: 'Weight of the World', desc: 'Absorb 25,000 damage with one Divine Shield.', category: 'secrets', hidden: true, hint: 'Carry the world on one shield.', tiers: tiers([25000]), progress: (s) => s.counters.absorb },
  { id: 'completionist', name: 'The Whole Chronicle', desc: 'Earn a hundred deeds.', category: 'secrets', hidden: true, hint: 'Fill the Chronicle.', tiers: tiers([100], { 1: { title: 'the Complete' } }), progress: (s) => s.achievements.length },
  { id: 'timeless', name: 'A Hundred Hours', desc: 'Spend a hundred hours in the courtyard.', category: 'secrets', hidden: true, hint: 'A hundred hours among the fallen.', tiers: tiers([360000]), progress: totalTime },
  { id: 'manyNames', name: 'Many Names', desc: 'Earn ten titles.', category: 'secrets', hidden: true, hint: 'Collect names like coins.', tiers: tiers([10]), progress: (s) => s.titles.length },
];
