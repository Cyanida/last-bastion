import type { StatKey } from '../core/types';
import type { ClassId } from './classes';
import type { UpgradeRarity } from './upgrades';

/**
 * v0.11 (#238): champion levels (docs/road-to-the-crown.md rule 2, as changed on 29-09). A champion levels up between levels, not during
 * them: a level's XP is banked as champion XP when it is cleared, and each champion level gives stat points and a talent point to spend
 * on the level-cleared screen or the champion screen. logic/championLevels.ts reads this.
 */

/** The four stats a champion puts points in, named for players. Each is one of the class's own stats (CHAMPION_STAT_KEYS). */
export const CHAMPION_STATS = ['strength', 'dexterity', 'focus', 'vitality'] as const;
export type ChampionStat = (typeof CHAMPION_STATS)[number];
/** Stat points spent, per stat. */
export type StatPoints = Partial<Record<ChampionStat, number>>;

export const CHAMPION_STAT_NAMES: Record<ChampionStat, { name: string; desc: string }> = {
  strength: { name: 'Strength', desc: 'Your attacks hit harder.' },
  dexterity: { name: 'Dexterity', desc: 'You attack faster.' },
  focus: { name: 'Focus', desc: 'Your signature ability grows stronger.' },
  vitality: { name: 'Vitality', desc: 'More health.' },
};

/** The one table: what each of the four is for a class. Strength is its attack stat, Dexterity attack speed, Focus its secondary stat, Vitality HP. */
export const CHAMPION_STAT_KEYS: Record<ClassId, Record<ChampionStat, StatKey>> = {
  paladin: { strength: 'str', dexterity: 'atkSpd', focus: 'secondary', vitality: 'hp' },
  viking: { strength: 'str', dexterity: 'atkSpd', focus: 'secondary', vitality: 'hp' },
  angel: { strength: 'int', dexterity: 'atkSpd', focus: 'secondary', vitality: 'hp' },
  necromancer: { strength: 'int', dexterity: 'atkSpd', focus: 'secondary', vitality: 'hp' },
  archer: { strength: 'dex', dexterity: 'atkSpd', focus: 'secondary', vitality: 'hp' },
};

export const CHAMPION = {
  statPoints: 3, // per champion level
  talentPoints: 1, // per champion level
  tierCost: 2, // stat points for an ability or utility tier (the upgrades level-ups used to offer)
  /**
   * Decided: a champion level is worth this many of the old in-run levels: it gives this many times the class's growth, and relic damage
   * and the utility's unlock count a champion level as this many. At 5, a champion entering Marches level 1-6 at level 1-5 (5 is the cap
   * before its crown) stands where the old head start put it (run levels 1, 6, 11, 15, 19, 21).
   */
  runLevels: 5,
  /**
   * A stat point is worth `boons` level-up boons of its stat at `rarity` (config/upgrades.ts): six rare boons a champion level, for the
   * five the run levels it stands for gave and the ability tiers the points now also pay for. Decided: a stat that boons multiply
   * (attack speed) takes that share of the class's base value per point, so points add up and never compound.
   */
  point: { rarity: 'rare' as UpgradeRarity, boons: 2 },
  /** So farming can't break balance: no level past `base` + `perCrown` per crown held (any tier). Decided: never past `max`, the level the Last Bastion expects. */
  cap: { base: 5, perCrown: 5, max: 30 },
  replayXp: 0.25, // a level cleared before banks this share of the XP it collected
  /**
   * XP from a champion level to the next: `perLevel` x the level, at most `most`. Fitted to the XP the Marches' levels pay at the pace
   * (logic/championLevels levelXp; #243, on the longer levels: 252, 612, 768, 816, 864, 822, 912, was 180 to 1734 with 140 for the first): a level per Marches level up to the cap of 5, with a quarter to spare on each, and 8 at its crown, the level a relic realm's
   * first level expects; after that a relic realm's 5046 XP is about six levels, so past the Marches the crown cap is what holds a champion back.
   */
  xp: { perLevel: 180, most: 840 },
  /** The champion level enemy scaling expects per ring (1 the Marches, 2-4 the relic realms, 5 the Last Bastion): at a realm's first level, and once it is crowned. The sim's champions have it. */
  expected: [[1, 8], [8, 15], [15, 22], [22, 30], [30, 30]] as [number, number][],
  /**
   * Enemy scaling by the champion level a level expects (logic/championLevels championStep), on top of the tier, the ring step and the
   * level step. The waves were tuned for a player who levels up along the pace inside them; a champion keeps one level all level long.
   * A player's strength is taken as 1 + `perRunLevel` per run level (damage and HP both grow about that much a level with growth and
   * boons); enemy HP and damage take the ratio of the expected champion's strength to the pace's midway through the level's waves.
   * `worth`: a champion's run levels count for this much each, since its points also pay for the ability tiers a run got for free
   * (fitted with the bot: at 1 it cleared no Marches level 4 and few crown levels of the Iron Hold).
   */
  scaling: { perRunLevel: 0.12, worth: 0.8 },
  /**
   * The bot's build (the sim's yardstick, logic/championLevels botBuild): it buys an ability tier at each of these champion levels and a
   * utility tier at each of those (about where the old levels 5, 10, 15 and 8, 14 fall, leaving it points for stats), and cycles the rest of its points over `stats`.
   */
  bot: { abilityAt: [3, 5, 7], utilityAt: [4, 6], stats: ['strength', 'vitality', 'dexterity', 'focus'] as ChampionStat[] },
};
