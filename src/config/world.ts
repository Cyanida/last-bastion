import type { ArenaId } from './arenas';
import type { EnemyId } from './enemies';
import type { FamilyId } from './relics';

/**
 * v0.10 (#190): the world of the Road to the Crown (docs/road-to-the-crown.md, "The world" and rules 1-9). The Marches (7 levels), a
 * relic realm per family (5 levels each) in rings 2-4, and the Last Bastion (one 40-wave finale). Every level is its own short run on the
 * 40-wave scale. Every realm is here from the start, built or not, so the map can show it under clouds with what opens it
 * (`release`: the release that builds it). Tiers are indices into config/economy TIERS (0 Squire, 1 Knight, 2 Champion, 3 Legend).
 * logic/world.ts reads this.
 */
export type RealmId = 'marches' | 'ironHold' | 'barrowvale' | 'cinderlands' | 'frozenPass' | 'stormspire' | 'hallowedReach' | 'crimsonFields' | 'lastBastion';

/** Realm arenas still to be built (#141's Ember Forge, Frozen Pass and Sunken Cathedral; a storm peak and a battlefield are new). */
export type WorldArenaId = ArenaId | 'emberForge' | 'frozenPass' | 'stormPeak' | 'sunkenCathedral' | 'battlefield';

/** Bosses the realms add, not in config/bosses.ts yet. Their releases build them. */
export const WORLD_BOSSES = {
  ironKing: { name: 'The Iron King', realm: 'ironHold' },
  gravedigger: { name: 'The Gravedigger', realm: 'barrowvale' }, // Decided: the plan leaves the Barrowvale's level-3 boss unnamed
  barrowKing: { name: 'The Barrow King', realm: 'barrowvale' },
  emberQueen: { name: 'The Ember Queen', realm: 'cinderlands' },
  cinderColossus: { name: 'The Cinder Colossus', realm: 'cinderlands' },
  rimeWitch: { name: 'The Rime Witch', realm: 'frozenPass' },
  frostJotun: { name: 'The Frost Jötun', realm: 'frozenPass' },
  stormCaller: { name: 'The Storm Caller', realm: 'stormspire' },
  thunderRoc: { name: 'The Thunder Roc', realm: 'stormspire' },
  wardKeeper: { name: 'The Ward-Keeper', realm: 'hallowedReach' },
  fallenSaint: { name: 'The Fallen Saint', realm: 'hallowedReach' },
  butcher: { name: 'The Butcher', realm: 'crimsonFields' },
  crimsonBaron: { name: 'The Crimson Baron', realm: 'crimsonFields' },
} satisfies Record<string, { name: string; realm: RealmId }>;

/**
 * A level's end boss. `boss`: a config/bosses.ts key, a WORLD_BOSSES key, 'usurper', or 'pool' (a draw from today's pool: the mid-Act
 * draw on a wave x5, the Act boss on a wave x0). `elite`: as an elite with an extra phase. `crown`: the crown boss, 3 phases with
 * WORLD.crownBoss's minimum phase length.
 */
export interface EndBoss { boss: string; elite?: true; crown?: true }

/** A level's first-clear reward (logic/world.ts clearRewards). */
export type LevelReward =
  | { kind: 'rarePick'; family: FamilyId; of: number } // the Marches: pick 1 of `of` rares of the featured family
  | { kind: 'keepLocked' } // keep one locked relic of a family held when the level ended; none held: WORLD.keepLockedRunes
  | { kind: 'classRelic' } // unlock the champion's class relic of the realm's family
  | { kind: 'win' }; // the Last Bastion: the run's win (config/economy VICTORY pays it)

/** What a realm's crown gives: `first` on the first crown on any tier, `tiers[t]` on the first crown on tier t. */
export type CrownReward = { kind: 'signature' } | { kind: 'legendaryPick' } | { kind: 'legendaryOther' } | { kind: 'title' } | { kind: 'palette' };

export interface LevelDef {
  waves: [number, number]; // first and last wave, on the 40-wave scale
  slots: number; // starting relic slots, before Armorer's Choice and Keepsake
  relicTier: number; // the tier starting relics come in at
  family?: FamilyId; // the opening pick's family: the realm's own, or the Marches level's featured family; none in the Last Bastion (any family)
  boss: EndBoss;
  reward?: LevelReward;
}

/** What opens a realm: this many crowns, of which `fromRing[1]` from ring `fromRing[0]`. */
export interface Opens { crowns: number; fromRing?: [number, number] }

export interface RealmDef {
  name: string;
  ring: number; // 1 the Marches, 2-4 the relic realms, 5 the Last Bastion
  opens: Opens;
  arena: WorldArenaId;
  family?: FamilyId; // a relic realm's family
  foes?: Partial<Record<EnemyId, EnemyId>>; // #212: the realm's variants: a foe that marches in its levels as its own kind (logic/world.ts realmFoe)
  hazard?: 'presses'; // #211: the realm's own hazard in its arena, on top of the arena's (the Iron Hold's forge presses, config/arenas.ts PRESSES)
  teaches: string;
  release: string;
  levels: LevelDef[];
  crown: { first: CrownReward[]; tiers: CrownReward[][] };
}

/** Rule 3: a relic realm's five levels. Ends: a pool boss, the realm's first boss, a new boss, the first boss as an elite, the crown boss. */
function relicRealmLevels(family: FamilyId, first: string, third: string, crown: string, opener = 'pool'): LevelDef[] {
  const waves: [number, number][] = [[1, 5], [6, 10], [11, 20], [21, 30], [31, 40]];
  const bosses: EndBoss[] = [{ boss: opener }, { boss: first }, { boss: third }, { boss: first, elite: true }, { boss: crown, crown: true }];
  const rewards: (LevelReward | undefined)[] = [{ kind: 'keepLocked' }, { kind: 'keepLocked' }, { kind: 'classRelic' }, { kind: 'keepLocked' }, undefined];
  return waves.map((w, i) => ({ waves: w, slots: i + 1, relicTier: i < 3 ? 1 : 2, family, boss: bosses[i], reward: rewards[i] }));
}

const RELIC_CROWN: RealmDef['crown'] = { first: [], tiers: [[], [{ kind: 'legendaryPick' }], [{ kind: 'legendaryOther' }], [{ kind: 'title' }, { kind: 'palette' }]] };

/** The Marches: one featured family per level, in this order (levels 1 and 2 are the tutorial). */
export const MARCHES_FAMILIES: FamilyId[] = ['steel', 'flame', 'blood', 'storm', 'frost', 'holy', 'grave'];
const MARCHES_WAVES: [number, number][] = [[1, 5], [6, 10], [11, 15], [16, 20], [21, 25], [26, 30], [31, 40]];
const MARCHES_SLOTS = [1, 1, 2, 2, 3, 3, 4];

export const REALMS: Record<RealmId, RealmDef> = {
  marches: {
    name: 'The Marches', ring: 1, opens: { crowns: 0 }, arena: 'courtyard', release: '0.10.0',
    teaches: 'Marked attacks and the perfect dodge, commanders, and one relic family per level',
    levels: MARCHES_WAVES.map((waves, i) => ({
      waves, slots: MARCHES_SLOTS[i], relicTier: i < 4 ? 1 : 2, family: MARCHES_FAMILIES[i],
      boss: i === 6 ? { boss: 'warden', crown: true } : { boss: 'pool' },
      reward: { kind: 'rarePick', family: MARCHES_FAMILIES[i], of: 2 },
    })),
    crown: { first: [{ kind: 'signature' }], tiers: [[], [], [], [{ kind: 'title' }, { kind: 'palette' }]] }, // Decided: the signature comes with the first crown on any tier
  },
  ironHold: {
    name: 'The Iron Hold', ring: 2, opens: { crowns: 1 }, arena: 'keep', family: 'steel', release: '0.11.0',
    teaches: 'Armor you break, shields that block from the front, thorns that hit back',
    foes: { knight: 'ironKnight', shieldwall: 'ironShieldwall', shieldBearer: 'thornBearer' }, // #214: thorn bearers
    hazard: 'presses',
    levels: relicRealmLevels('steel', 'warden', 'forgemaster', 'ironKing'), crown: RELIC_CROWN,
  },
  barrowvale: {
    name: 'The Barrowvale', ring: 2, opens: { crowns: 1 }, arena: 'graveyard', family: 'grave', release: '0.13.0', // the Drowned Fen comes later as a second arena
    teaches: 'Corpses that rise unless you trample them, plague ground that lasts',
    levels: relicRealmLevels('grave', 'lich', 'gravedigger', 'barrowKing', 'abbot'), crown: RELIC_CROWN, // Decided: the Plague Abbot is its level-1 pool boss
  },
  cinderlands: {
    name: 'The Cinderlands', ring: 2, opens: { crowns: 1 }, arena: 'emberForge', family: 'flame', release: '0.12.0',
    teaches: 'Fire that spreads, burn stacks on you, bursts of fire when foes die',
    levels: relicRealmLevels('flame', 'inquisitor', 'emberQueen', 'cinderColossus'), crown: RELIC_CROWN,
  },
  frozenPass: {
    name: 'The Frozen Pass', ring: 3, opens: { crowns: 2 }, arena: 'frozenPass', family: 'frost', release: '0.14.0',
    teaches: 'Chill that stacks on you until you freeze, thin ice, foes that shatter',
    levels: relicRealmLevels('frost', 'frostLich', 'rimeWitch', 'frostJotun'), crown: RELIC_CROWN, // Decided: the Frost Lich is its first boss
  },
  stormspire: {
    name: 'The Stormspire', ring: 3, opens: { crowns: 2 }, arena: 'stormPeak', family: 'storm', release: '1.1.0',
    teaches: 'Lightning that chains between foes and into you, fast rushers, wind that pushes',
    levels: relicRealmLevels('storm', 'warlord', 'stormCaller', 'thunderRoc'), crown: RELIC_CROWN, // Decided: the Warlord is its first boss
  },
  hallowedReach: {
    name: 'The Hallowed Reach', ring: 4, opens: { crowns: 4 }, arena: 'sunkenCathedral', family: 'holy', release: '1.2.0',
    teaches: 'Ward-bearers that make squads untouchable, healers you must reach first',
    levels: relicRealmLevels('holy', 'heretic', 'wardKeeper', 'fallenSaint'), crown: RELIC_CROWN, // Decided: the Heretic is its first boss
  },
  crimsonFields: {
    name: 'The Crimson Fields', ring: 4, opens: { crowns: 4 }, arena: 'battlefield', family: 'blood', release: '1.3.0',
    teaches: 'Bleed on you, foes that grow stronger as they bleed',
    levels: relicRealmLevels('blood', 'headsman', 'butcher', 'crimsonBaron'), crown: RELIC_CROWN, // Decided: the Headsman is its first boss
  },
  lastBastion: {
    name: 'The Last Bastion', ring: 5, opens: { crowns: 5, fromRing: [3, 1] }, arena: 'bastion', release: '0.14.0',
    teaches: 'Everything, with elite foes',
    levels: [{ waves: [1, 40], slots: 5, relicTier: 1, boss: { boss: 'usurper' }, reward: { kind: 'win' } }],
    crown: { first: [], tiers: [[], [], [], []] },
  },
};
export const REALM_IDS = Object.keys(REALMS) as RealmId[];

export const WORLD = {
  maxSlots: 6, // Armorer's Choice and the Keepsake mastery rank each add a slot, up to this
  openingPick: 3, // every level opens with a pick of 1 from this many relics of its family
  keepLockedRunes: 2, // Decided: a keep-a-locked-relic level cleared holding no family relic pays this many Runes
  crownBoss: { phases: 3, minPhaseSeconds: 12 }, // Decided: 12 s per phase, so a crown boss can't be burst through a phase
  /** Rule 4: loadout limits (the slot rules issue enforces them). */
  loadout: { perFamily: 4, legendarySlots: 2, legendaries: 1, legendariesFinale: 2, classRelics: 2 },
  /** Rule 7: enemy HP and damage by ring (rings 1-4, then the finale). One tier step (config/economy TIERS) outweighs the whole ladder. */
  ringStep: { hp: [1, 1.07, 1.14, 1.21, 1.28], damage: [1, 1.04, 1.08, 1.12, 1.16] },
  /** Rule 6: the Last Bastion's elite foes and limits. */
  finale: { minAffixes: 2, eliteCap: 0.35, eliteChanceMult: 1.5, armorersChoice: false, merchantRelics: false },
  /**
   * Rule 3 (#191): the head start's missing level-up boons, one per level skipped, taken round this cycle ('attack': the class's attack
   * stat). Decided: at rare strength, about what the best of three rolled cards is worth.
   */
  headStart: { boons: ['attack', 'hp', 'atkSpd', 'secondary'] as const, rarity: 'rare' as const },
};
