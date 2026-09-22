import type { Mods, StatKey } from '../core/types';
import type { FeatKey } from './achievements';
import type { ClassId } from './classes';
import type { EnemyId } from './enemies';

/**
 * Sacred treasures (v0.5): one per class, permanent, earned through a chain that spans runs of that class. Mastery rank 10 opens it:
 * three fragments, each dropped by one Act boss (`fragmentBosses`, in order) in a run of that class; then the trial, a quest on the
 * next Act board (a free fourth card); then the guardian, woken in the hidden vault (config/regions.ts), which opens after the
 * mid-Act boss. Slaying it earns tier I; the two follow-ups raise it to II and III. Equipped at run start (one per run), it changes how
 * the class's signature ability plays, scaled by the secondary stat; it also unlocks one hidden talent node while equipped.
 * Numbers per tier are read by systems/treasures.ts; the text is generated from them, like the relics'.
 */
export const TREASURE_RULES = {
  fragments: 3,
  guardianHp: 2.5, // times the base boss's HP, on top of the wave scaling
  guardianRunes: 2, // paid every time the guardian falls
};

/** A follow-up's goal. Every key present must be met: carry the treasure through `acts` Acts; mastery unlock `mastery`; `difficulty` or higher; slay the guardian. */
export interface FollowUpGoal {
  acts?: number;
  mastery?: number; // masteryBonus().treasureStep: 2 = the tier III rank
  difficulty?: number; // TIERS index: 1 = Knight
  guardian?: boolean;
}
const TIER_II: FollowUpGoal = { acts: 2 };
const TIER_III: FollowUpGoal = { mastery: 2, difficulty: 1, guardian: true };

export type TreasureId = 'holyGrail' | 'mjolnirShard' | 'haloOfDawn' | 'bookOfTheDead' | 'wildHuntBow';

export interface TreasureDef {
  id: TreasureId;
  name: string;
  icon: string;
  guardian: { name: string; from: EnemyId; palette: number }; // reuses the base boss's def and script (SPRITE_PALETTES tint)
  fragmentBosses: [EnemyId, EnemyId, EnemyId];
  trial: { name: string; desc: string; feat: FeatKey; n: number }; // done when this Act's feat (systems/feats.ts actFeats) reaches n
  tiers: [Record<string, number>, Record<string, number>, Record<string, number>];
  describe: (n: Record<string, number>) => string;
  followUps: [{ name: string; goal: FollowUpGoal }, { name: string; goal: FollowUpGoal }];
  talent: { branch: string; name: string; desc: string; mods?: Partial<Mods>; stats?: Partial<Record<StatKey, number>> }; // the hidden node (config/talents.ts)
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Keeps each treasure's numbers typed and its text in sync with them. */
function treasure<N extends Record<string, number>>(t: Omit<TreasureDef, 'tiers' | 'describe'> & { tiers: [N, N, N]; describe: (n: N) => string }): TreasureDef {
  return t as unknown as TreasureDef;
}

export const TREASURES: Record<ClassId, TreasureDef> = {
  paladin: treasure({
    id: 'holyGrail', name: 'The Holy Grail', icon: '🏆',
    guardian: { name: 'Sir Galahad the Unfallen', from: 'blackKnight', palette: 2 },
    fragmentBosses: ['dragon', 'warden', 'dragon'],
    trial: { name: 'Trial of the Grail', desc: 'Absorb 600 damage with a single Divine Shield this Act.', feat: 'absorb', n: 600 },
    tiers: [{ heal: 0.2, perFaith: 0.01, ground: 3, dps: 14 }, { heal: 0.3, perFaith: 0.01, ground: 4, dps: 14 }, { heal: 0.4, perFaith: 0.01, ground: 5, dps: 14 }],
    describe: (n) => `When Divine Shield ends, heal ${pct(n.heal)} of the damage it absorbed plus ${pct(n.perFaith)} of max HP per Faith, and the burst consecrates the ground for ${n.ground}s.`,
    followUps: [{ name: 'Bearer of the Grail', goal: TIER_II }, { name: 'The Grail Achieved', goal: TIER_III }],
    talent: { branch: 'paladin.bulwark', name: 'Grail-Warden', desc: '+2 Faith and Divine Shield lasts 15% longer.', mods: { abilityDur: 1.15 }, stats: { secondary: 2 } },
  }),
  viking: treasure({
    id: 'mjolnirShard', name: "Mjölnir's Shard", icon: '🔨',
    guardian: { name: 'Thrymr the Frost-Jarl', from: 'warlord', palette: 4 },
    fragmentBosses: ['dragon', 'warden', 'dragon'],
    trial: { name: 'Trial of Thunder', desc: 'Slay 30 enemies during a single Berserker Rage this Act.', feat: 'rageKills', n: 30 },
    tiers: [{ chance: 0.02, cap: 0.6, chains: 3, mult: 0.8, range: 180 }, { chance: 0.03, cap: 0.6, chains: 4, mult: 0.8, range: 180 }, { chance: 0.04, cap: 0.6, chains: 5, mult: 0.8, range: 180 }],
    describe: (n) => `During Berserker Rage, attacks have ${pct(n.chance)} chance per Rage (at most ${pct(n.cap)}) to call lightning that chains to ${n.chains} enemies for ${pct(n.mult)} of the hit.`,
    followUps: [{ name: 'Thunder Carried', goal: TIER_II }, { name: 'The Hammer Whole', goal: TIER_III }],
    talent: { branch: 'viking.berserk', name: 'Thunder-Blooded', desc: '+2 Rage and +8% attack speed.', mods: { atkSpd: 1.08 }, stats: { secondary: 2 } },
  }),
  angel: treasure({
    id: 'haloOfDawn', name: 'The Halo of Dawn', icon: '☀️',
    guardian: { name: 'The Eclipse Seraph', from: 'inquisitor', palette: 3 },
    fragmentBosses: ['dragon', 'warden', 'dragon'],
    trial: { name: 'Trial of Dawn', desc: 'Heal 800 with Heavenly Radiance this Act.', feat: 'radiance', n: 800 },
    tiers: [{ time: 4, radius: 90, perGrace: 6, heal: 4, dps: 12 }, { time: 5, radius: 90, perGrace: 6, heal: 5, dps: 15 }, { time: 6, radius: 90, perGrace: 6, heal: 6, dps: 18 }],
    describe: (n) => `Heavenly Radiance leaves a sun for ${n.time}s that heals you ${n.heal} HP a second and burns enemies inside; radius ${n.radius}, +${n.perGrace} per Grace.`,
    followUps: [{ name: 'Dawn Carried', goal: TIER_II }, { name: 'High Noon', goal: TIER_III }],
    talent: { branch: 'angel.mercy', name: 'Dawnbringer', desc: '+2 Grace and +1.5 HP regeneration a second.', mods: { regen: 1.5 }, stats: { secondary: 2 } },
  }),
  necromancer: treasure({
    id: 'bookOfTheDead', name: 'The Book of the Dead', icon: '📕',
    guardian: { name: 'The First Lich', from: 'lich', palette: 1 },
    fragmentBosses: ['dragon', 'warden', 'dragon'],
    trial: { name: 'Trial of the Grave', desc: 'Command 10 minions at once this Act.', feat: 'minions', n: 10 },
    tiers: [{ minions: 1, blast: 1, perSoul: 0.1 }, { minions: 2, blast: 1.5, perSoul: 0.1 }, { minions: 3, blast: 2, perSoul: 0.1 }],
    describe: (n) => `+${n.minions} minion${n.minions > 1 ? 's' : ''}. Minions that fall explode for ${n.blast}× their damage, +${n.perSoul}× per Soul Power.`,
    followUps: [{ name: 'The Book Carried', goal: TIER_II }, { name: 'The Last Page', goal: TIER_III }],
    talent: { branch: 'necromancer.horde', name: 'Keeper of the Book', desc: '+2 Soul Power and +1 minion.', mods: { minionMax: 1 }, stats: { secondary: 2 } },
  }),
  archer: treasure({
    id: 'wildHuntBow', name: 'The Bow of the Wild Hunt', icon: '🏹',
    guardian: { name: 'Herne the Horned Hunter', from: 'warlord', palette: 5 },
    fragmentBosses: ['dragon', 'warden', 'dragon'],
    trial: { name: 'Trial of the Hunt', desc: 'Catch 20 enemies under a single Arrow Volley this Act.', feat: 'volleyHits', n: 20 },
    tiers: [{ every: 7, perFocus: 8, min: 3, hounds: 1, time: 8, damage: 10, hp: 90 }, { every: 6, perFocus: 8, min: 3, hounds: 2, time: 8, damage: 10, hp: 90 }, { every: 5, perFocus: 8, min: 3, hounds: 3, time: 8, damage: 10, hp: 90 }],
    describe: (n) => `Every ${n.every}th arrow splits into three (one sooner per ${n.perFocus} Focus, at least every ${n.min}th). Arrow Volley calls ${n.hounds} spectral hound${n.hounds > 1 ? 's' : ''} for ${n.time}s.`,
    followUps: [{ name: 'The Long Chase', goal: TIER_II }, { name: 'Master of the Hunt', goal: TIER_III }],
    talent: { branch: 'archer.ranger', name: 'Wild Huntsman', desc: '+2 Focus and +8% movement speed.', mods: { moveSpd: 1.08 }, stats: { secondary: 2 } },
  }),
};

export const treasureN = (classId: ClassId, tier: number): Record<string, number> => TREASURES[classId].tiers[Math.min(3, Math.max(1, tier)) - 1];
export const treasureDesc = (classId: ClassId, tier: number): string => TREASURES[classId].describe(treasureN(classId, tier));
