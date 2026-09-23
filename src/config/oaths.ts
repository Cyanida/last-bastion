import type { CurseId } from './curses';

/**
 * v0.6 Oath ladder: after a class's first win, Oaths 1-20. Each level adds one fixed modifier on top of every level below it, built
 * from the curses and wave modifiers plus a few of its own. An Oath run takes no free curses (custom runs still choose them freely).
 * Numeric knobs listed in logic/oaths.ts MULTIPLY multiply as they stack; the others are set by the level that names them.
 */
export type OathKnob =
  | 'hp' | 'damage' | 'eliteMult' | 'bossHp' | 'modifierChance' // multiply
  | 'modifierFrom' // wave modifiers from this wave on
  | 'secondWind' // bosses rise once more from the brink, with this fraction of their HP
  | 'affixes' // every elite carries at least this many affixes
  | 'noMerchant' // no Merchant in this Act (its visit at the end, or the Merchant path's halfway)
  | 'noLastStand'
  | 'rerollsLess';

export interface OathDef { name: string; desc: string; curse?: CurseId; n?: Partial<Record<OathKnob, number>> }

export const OATHS: OathDef[] = [
  { name: 'Iron Horde', desc: 'Enemies have +20% HP.', curse: 'ironHorde' },
  { name: 'Ill Omens', desc: 'Wave modifiers come twice as often.', n: { modifierChance: 2 } },
  { name: 'Frenzy', desc: 'Enemies move 15% faster.', curse: 'frenzy' },
  { name: 'Unbowed Crowns', desc: 'Bosses gain a phase: slain, they rise once more with 30% of their HP.', n: { secondWind: 0.3 } },
  { name: 'Officer Corps', desc: 'Every commander is an elite, and squads are twice as common.', curse: 'eliteCommanders' },
  { name: 'Glass Bones', desc: 'You take +25% damage.', curse: 'glassBones' },
  { name: 'Veterans', desc: 'Elites are 50% more common.', n: { eliteMult: 1.5 } },
  { name: 'Swarm', desc: 'The spawn budget is 30% larger.', curse: 'swarm' },
  { name: 'Thrice-Marked', desc: 'Every elite carries three affixes.', n: { affixes: 3 } },
  { name: 'Empty Road', desc: 'No Merchant in Act II.', n: { noMerchant: 2 } },
  { name: 'Hourglass', desc: 'The next wave arrives 25 seconds after the last spawn, ready or not.', curse: 'timedWaves' },
  { name: 'Early Omens', desc: 'Wave modifiers from wave 2 on.', n: { modifierFrom: 2 } },
  { name: 'Blindfold', desc: 'No minimap.', curse: 'blind' },
  { name: 'No Last Stand', desc: 'The Last Stand never comes.', n: { noLastStand: 1 } },
  { name: 'Iron Crowns', desc: 'Bosses have +30% HP.', n: { bossHp: 1.3 } },
  { name: 'No Respite', desc: 'No regeneration or healing between waves, and the breather is 1 second.', curse: 'noRespite' },
  { name: 'Thin Purse', desc: 'One free reroll fewer.', n: { rerollsLess: 1 } },
  { name: 'Hardened Horde', desc: 'Enemies have +15% HP.', n: { hp: 1.15 } },
  { name: 'Sharpened Steel', desc: 'Enemies deal +15% damage.', n: { damage: 1.15 } },
  { name: 'The Last Oath', desc: 'Enemies have +10% HP and deal +10% damage, and elites are 30% more common.', n: { hp: 1.1, damage: 1.1, eliteMult: 1.3 } },
];

/** A class's first win at an Oath level pays this, on top of the win itself (VICTORY), rising with the level. */
export const OATH_REWARD = { runes: 2, runesPer5: 1, gold: 300, goldPerLevel: 40 };
