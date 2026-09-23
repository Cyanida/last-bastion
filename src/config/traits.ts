import type { Mods, StatKey } from '../core/types';

/**
 * Starting traits: one is chosen on the class select screen, from a pool unlocked by achievements (v0.4; mastery ranks
 * add to it with the Keep rework). All of them are plain mods and flat stat changes applied at run start; `n` holds the
 * odd number another system reads (Cursed Luck's relic drop chance, in combat.ts).
 */
export interface TraitDef {
  name: string;
  desc: string;
  icon: string;
  unlock: { achievement?: string }; // nothing = available from the start
  mods?: Partial<Mods>;
  stats?: Partial<Record<StatKey, number>>; // multipliers on the base stats
  n?: Record<string, number>;
}

const T = {
  none: { name: 'No trait', desc: 'A plain start.', icon: '—', unlock: {} },
  glassCannon: { name: 'Glass Cannon', desc: '+30% damage, -25% max HP.', icon: '💥', unlock: {}, mods: { damage: 1.3 }, stats: { hp: 0.75 } },
  stalwart: { name: 'Stalwart', desc: '+25% max HP and +8% armor, -12% movement speed.', icon: '🛡️', unlock: {}, mods: { armor: 0.08, moveSpd: 0.88 }, stats: { hp: 1.25 } },
  scavenger: { name: 'Scavenger', desc: '+40% gold and +50% pickup radius, -10% damage.', icon: '🪙', unlock: { achievement: 'treasurer' }, mods: { gold: 1.4, pickup: 1.5, damage: 0.9 } },
  cursedLuck: { name: 'Cursed Luck', desc: 'Every relic moment has an extra reroll; you take 15% more damage.', icon: '🎲', unlock: { achievement: 'eliteHunter' }, mods: { armor: -0.15 }, n: { rerolls: 1 } }, // v0.7: was twice the elite relic drops
  pilgrim: { name: 'Pilgrim', desc: '+25% experience and +10% movement speed, -15% max HP.', icon: '🚶', unlock: { achievement: 'wave10' }, mods: { xp: 1.25, moveSpd: 1.1 }, stats: { hp: 0.85 } },
  duelist: { name: 'Duelist', desc: '+15% crit chance and +25% crit damage, -10% attack speed.', icon: '⚔️', unlock: { achievement: 'flawless' }, mods: { crit: 0.15, critDamage: 0.25, atkSpd: 0.9 } },
} satisfies Record<string, TraitDef>;

export type TraitId = keyof typeof T;
export const TRAITS: Record<TraitId, TraitDef> = T;
export const TRAIT_IDS = Object.keys(TRAITS) as TraitId[];
export const traitDef = (id: TraitId): TraitDef => TRAITS[id];
