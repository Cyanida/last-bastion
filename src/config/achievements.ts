import type { Save } from '../logic/save';
import type { ArenaId } from './arenas';
import { CLASS_ORDER } from './classes';
import { MASTERY, META_IDS } from './economy';
import type { CurseId } from './curses';
import type { RelicId } from './relics';

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  target: number;
  progress: (s: Save) => number; // earned when progress >= target
  unlocks?: { arena?: ArenaId; relic?: RelicId; curse?: CurseId };
}

const classes = (s: Save) => CLASS_ORDER.map((id) => s.classes[id]);
const bestWave = (s: Save) => Math.max(...classes(s).map((c) => c.bestWave));

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'firstBlood', name: 'First Blood', desc: 'Slay 100 enemies.', target: 100, progress: (s) => s.counters.kills, unlocks: { curse: 'ironHorde' } },
  { id: 'slayer', name: 'Butcher of the Bastion', desc: 'Slay 5,000 enemies.', target: 5000, progress: (s) => s.counters.kills },
  { id: 'wave10', name: 'Holding the Line', desc: 'Reach wave 10 with any class.', target: 10, progress: bestWave, unlocks: { arena: 'graveyard', curse: 'timedWaves' } },
  { id: 'wave20', name: 'Unbroken', desc: 'Reach wave 20 with any class.', target: 20, progress: bestWave },
  { id: 'wave20all', name: 'Five Banners', desc: 'Reach wave 20 with all five classes.', target: 5, progress: (s) => classes(s).filter((c) => c.bestWave >= 20).length, unlocks: { relic: 'conquerorCrown' } },
  { id: 'allClasses', name: 'Jack of All Arms', desc: 'Finish a run with every class.', target: 5, progress: (s) => classes(s).filter((c) => c.runs > 0).length },
  { id: 'bossSlayer', name: 'Giant Killer', desc: 'Defeat a boss.', target: 1, progress: (s) => s.counters.bosses, unlocks: { curse: 'glassBones' } },
  { id: 'bossHunter', name: 'Boss Hunter', desc: 'Defeat 5 bosses.', target: 5, progress: (s) => s.counters.bosses, unlocks: { arena: 'keep', curse: 'blind' } },
  { id: 'rogues', name: "Rogues' Gallery", desc: 'Defeat all five different bosses.', target: 5, progress: (s) => s.counters.bossKinds.length },
  { id: 'flawless', name: 'Untouchable', desc: 'Defeat a boss without taking damage while it lives.', target: 1, progress: (s) => s.counters.flawlessBosses, unlocks: { relic: 'phoenixFeather' } },
  { id: 'eliteHunter', name: 'Elite Hunter', desc: 'Slay 50 elite enemies.', target: 50, progress: (s) => s.counters.elites, unlocks: { relic: 'soulLantern' } },
  { id: 'collector', name: 'Reliquarian', desc: 'Hold 6 relics in a single run.', target: 6, progress: (s) => s.counters.maxRelics },
  { id: 'ascended', name: 'Ascended', desc: 'Choose all three ability upgrades in one run.', target: 3, progress: (s) => s.counters.maxAbilityUpgrades },
  { id: 'swift', name: 'Forced March', desc: 'Reach wave 10 in under 6 minutes.', target: 1, progress: (s) => (s.counters.fastestWave10 > 0 && s.counters.fastestWave10 <= 360 ? 1 : 0) },
  { id: 'treasurer', name: 'Treasurer', desc: 'Bank 5,000 gold in total.', target: 5000, progress: (s) => s.counters.goldEarned, unlocks: { curse: 'swarm' } },
  { id: 'patron', name: 'Lord of the Keep', desc: 'Buy 15 ranks of permanent upgrades.', target: 15, progress: (s) => META_IDS.reduce((n, id) => n + (s.meta[id] ?? 0), 0) },
  { id: 'master', name: 'Master-at-Arms', desc: 'Reach mastery rank 5 with any class.', target: MASTERY[4].xp, progress: (s) => Math.max(...classes(s).map((c) => c.xp)) },
  { id: 'veteran', name: 'Veteran', desc: 'Finish 25 runs.', target: 25, progress: (s) => classes(s).reduce((n, c) => n + c.runs, 0) },
  { id: 'knight', name: 'Dubbed a Knight', desc: 'Clear wave 15 on Squire to unlock Knight difficulty.', target: 1, progress: (s) => s.tierUnlocked },
  { id: 'champion', name: 'Champion of the Realm', desc: 'Clear wave 15 on Knight to unlock Champion difficulty.', target: 2, progress: (s) => s.tierUnlocked },
  { id: 'legend', name: 'Living Legend', desc: 'Clear wave 15 on Champion to unlock Legend difficulty.', target: 3, progress: (s) => s.tierUnlocked },
  // v0.3
  { id: 'act1', name: 'Curtain Call', desc: 'Clear Act I: ten waves and its boss.', target: 1, progress: (s) => s.counters.actsCleared, unlocks: { curse: 'noRespite' } },
  { id: 'act2', name: 'Second Act', desc: 'Clear two Acts in one run.', target: 2, progress: (s) => s.counters.actsCleared, unlocks: { curse: 'frenzy' } },
  { id: 'commanders', name: 'Cut Off the Head', desc: 'Slay 10 commanders.', target: 10, progress: (s) => s.counters.commanders, unlocks: { curse: 'eliteCommanders' } },
  { id: 'daily', name: 'Trial by Date', desc: 'Finish a Daily Trial.', target: 1, progress: (s) => s.counters.dailies },
  { id: 'cursed', name: 'Thrice Cursed', desc: 'Clear Act I with three curses active.', target: 3, progress: (s) => s.counters.cursedActs },
];
