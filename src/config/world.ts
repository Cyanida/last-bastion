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
  slots: number; // starting relic slots, before Armorer's Choice and Keepsake. #237: a realm's levels all have its run's loadout size (RUN_SLOTS): the loadout goes in at level 1 only
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
  fields?: EnemyId[]; // #249: foes its levels field on every difficulty, whatever the tier roster says (config/waves.ts tierRoster): the realm's own foes are its lesson
  fieldsWeight?: number; // #249: how often a squad of `fields` comes on a tier below its own: a multiplier on its squad weight (config/director.ts SQUADS); its own tiers keep 1
  hazard?: 'presses' | 'fire' | 'hands'; // #211: the realm's own hazard in its arena, on top of the arena's (the Iron Hold's forge presses, config/arenas.ts PRESSES; #224: the Cinderlands' spreading fire, SPREADING_FIRE; #274: the Barrowvale's grasping hands, GRAVE_HANDS, in place of the arena's plain hands)
  teaches: string;
  release: string;
  built: boolean; // #258: its own foes, bosses and relics are in the game; false: a playable stand-in (#191: what isn't built falls back to the usual draw), and its road says so
  levels: LevelDef[];
  crown: { first: CrownReward[]; tiers: CrownReward[][] };
  legend?: { title: string; palette: number }; // #219: what its crown's 'title' and 'palette' rewards are (the Legend crown's): a title to wear and a sprite palette (render/sprites SPRITE_PALETTES), for the whole account
}

/** #237 (rule 4): a realm is one run, so its loadout size is one number for all its levels: a relic realm 3, the Marches 3. */
const RUN_SLOTS = { realm: 3, marches: 3 };

/** Rule 3: a relic realm's five levels. Ends: a pool boss, the realm's first boss, a new boss, the first boss as an elite, the crown boss. */
function relicRealmLevels(family: FamilyId, first: string, third: string, crown: string, opener = 'pool'): LevelDef[] {
  const waves: [number, number][] = [[1, 8], [9, 16], [17, 24], [25, 32], [33, 40]]; // #243: 8 waves each (was 5, 5, 10, 10, 10)
  const bosses: EndBoss[] = [{ boss: opener }, { boss: first }, { boss: third }, { boss: first, elite: true }, { boss: crown, crown: true }];
  const rewards: (LevelReward | undefined)[] = [{ kind: 'keepLocked' }, { kind: 'keepLocked' }, { kind: 'classRelic' }, { kind: 'keepLocked' }, undefined];
  return waves.map((w, i) => ({ waves: w, slots: RUN_SLOTS.realm, relicTier: i < 3 ? 1 : 2, family, boss: bosses[i], reward: rewards[i] }));
}

const RELIC_CROWN: RealmDef['crown'] = { first: [], tiers: [[], [{ kind: 'legendaryPick' }], [{ kind: 'legendaryOther' }], [{ kind: 'title' }, { kind: 'palette' }]] };

/** The Marches: one featured family per level, in this order (levels 1 and 2 are the tutorial). */
export const MARCHES_FAMILIES: FamilyId[] = ['steel', 'flame', 'blood', 'storm', 'frost', 'holy', 'grave'];
const MARCHES_WAVES: [number, number][] = [[1, 6], [7, 12], [13, 18], [19, 24], [25, 30], [31, 35], [36, 40]]; // #243: 6, 6, 6, 6, 6, 5, 5 waves (was 5 each and 10)

export const REALMS: Record<RealmId, RealmDef> = {
  marches: {
    name: 'The Marches', ring: 1, opens: { crowns: 0 }, arena: 'courtyard', release: '0.10.0', built: true,
    teaches: 'Marked attacks and the perfect dodge, commanders, and one relic family per level',
    levels: MARCHES_WAVES.map((waves, i) => ({
      waves, slots: RUN_SLOTS.marches, relicTier: i < 4 ? 1 : 2, family: MARCHES_FAMILIES[i],
      boss: i === 6 ? { boss: 'warden', crown: true } : { boss: 'pool' },
      reward: { kind: 'rarePick', family: MARCHES_FAMILIES[i], of: 2 },
    })),
    crown: { first: [{ kind: 'signature' }], tiers: [[], [], [], [{ kind: 'title' }, { kind: 'palette' }]] }, // Decided: the signature comes with the first crown on any tier
  },
  ironHold: {
    name: 'The Iron Hold', ring: 2, opens: { crowns: 1 }, arena: 'keep', family: 'steel', release: '0.11.0', built: true,
    teaches: 'Armor you break, shields that block from the front, thorns that hit back',
    foes: { knight: 'ironKnight', shieldwall: 'ironShieldwall', shieldBearer: 'thornBearer' }, // #214: thorn bearers
    fields: ['shieldwall'], // #249: a Champion foe elsewhere; here Squire and Knight (the tiers the realm opens with) meet its shieldwall squads too
    fieldsWeight: 0.25, // #249: at full weight (and at 0.5) they crowded the Knight tier's other squads out and level 4 cleared 80% against 65%; at 0.25 it is 78%, level 5 60% (BALANCE.md)
    hazard: 'presses',
    levels: relicRealmLevels('steel', 'warden', 'forgemaster', 'ironKing'), crown: RELIC_CROWN,
    legend: { title: 'Ironsworn', palette: 6 }, // #219 Decided: the plan names neither
  },
  barrowvale: {
    name: 'The Barrowvale', ring: 2, opens: { crowns: 1 }, arena: 'graveyard', family: 'grave', release: '0.13.0', built: true, // #281: built. The Drowned Fen comes later as a second arena
    teaches: 'Corpses that rise unless you trample them, plague ground that lasts',
    foes: { peasant: 'barrowThrall', wolf: 'blightHound' }, // #275: barrow thralls; #276: blight hounds
    hazard: 'hands', // #274: the graveyard's hands rise from marked graves and hold you
    levels: relicRealmLevels('grave', 'lich', 'gravedigger', 'barrowKing', 'abbot'), crown: RELIC_CROWN, // Decided: the Plague Abbot is its level-1 pool boss
    legend: { title: 'Gravewarden', palette: 8 }, // #281 Decided: the plan names neither
  },
  cinderlands: {
    name: 'The Cinderlands', ring: 2, opens: { crowns: 1 }, arena: 'emberForge', family: 'flame', release: '0.12.0', built: true,
    teaches: 'Fire that spreads, burn stacks on you, bursts of fire when foes die',
    foes: { peasant: 'torchbearer', wolf: 'cinderHound' }, // #225: torchbearers; #226: cinder hounds
    hazard: 'fire', // #224: fire that spreads from the lava
    levels: relicRealmLevels('flame', 'inquisitor', 'emberQueen', 'cinderColossus'), crown: RELIC_CROWN,
    legend: { title: 'Cinderborn', palette: 7 }, // #231 Decided: the plan names neither
  },
  frozenPass: {
    name: 'The Frozen Pass', ring: 3, opens: { crowns: 2 }, arena: 'frozenPass', family: 'frost', release: '0.14.0', built: false,
    teaches: 'Chill that stacks on you until you freeze, thin ice, foes that shatter',
    levels: relicRealmLevels('frost', 'frostLich', 'rimeWitch', 'frostJotun'), crown: RELIC_CROWN, // Decided: the Frost Lich is its first boss
  },
  stormspire: {
    name: 'The Stormspire', ring: 3, opens: { crowns: 2 }, arena: 'stormPeak', family: 'storm', release: '1.1.0', built: false,
    teaches: 'Lightning that chains between foes and into you, fast rushers, wind that pushes',
    levels: relicRealmLevels('storm', 'warlord', 'stormCaller', 'thunderRoc'), crown: RELIC_CROWN, // Decided: the Warlord is its first boss
  },
  hallowedReach: {
    name: 'The Hallowed Reach', ring: 4, opens: { crowns: 4 }, arena: 'sunkenCathedral', family: 'holy', release: '1.2.0', built: false,
    teaches: 'Ward-bearers that make squads untouchable, healers you must reach first',
    levels: relicRealmLevels('holy', 'heretic', 'wardKeeper', 'fallenSaint'), crown: RELIC_CROWN, // Decided: the Heretic is its first boss
  },
  crimsonFields: {
    name: 'The Crimson Fields', ring: 4, opens: { crowns: 4 }, arena: 'battlefield', family: 'blood', release: '1.3.0', built: false,
    teaches: 'Bleed on you, foes that grow stronger as they bleed',
    levels: relicRealmLevels('blood', 'headsman', 'butcher', 'crimsonBaron'), crown: RELIC_CROWN, // Decided: the Headsman is its first boss
  },
  lastBastion: {
    name: 'The Last Bastion', ring: 5, opens: { crowns: 5, fromRing: [3, 1] }, arena: 'bastion', release: '0.14.0', built: true,
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
  keepLockedOf: 2, // #219 Decided: a keep-locked level shows a pick of 1 of this many rares (like a Marches level's), the ones held at the end first
  crownBoss: { phases: 3, minPhaseSeconds: 12 }, // Decided: 12 s per phase, so a crown boss can't be burst through a phase
  eliteBoss: { phases: 1, hp: 1.4, damage: 1.15 }, // #219 (rule 3): an elite end boss fights this many phases more than its plain self. #220: on this much more HP, hitting this much harder (it had its plain self's numbers, and level 4 fell easier than level 3)
  /** Rule 4: loadout limits (the slot rules issue enforces them). */
  loadout: { perFamily: 4, legendarySlots: 2, legendaries: 1, legendariesFinale: 2, classRelics: 2 },
  /** Rule 7: enemy HP and damage by ring (rings 1-4, then the finale). One tier step (config/economy TIERS) outweighs the whole ladder. */
  ringStep: { hp: [1, 1.07, 1.14, 1.21, 1.28], damage: [1, 1.04, 1.08, 1.12, 1.16] },
  /**
   * #221 (rule 9): enemy HP and damage by a level's place in its realm, on top of the tier and the ring step (logic/world levelStep). A
   * level is a short run whose head start holds fewer relics than a run that played the waves before, so its foes ease to meet the
   * first-try clear rates. Pass 2 eases realm level 1's HP and the Marches levels 3 and 7 (the dips) most. Decided: the Last Bastion is a whole run and keeps 1. Each stays over Squire's on Knight (a tier step still
   * outweighs it). #243: tuned again for the longer levels and champion levels (#238): the Marches and a realm's late levels sit just
   * over Squire's (HP 0.72 of Knight's 1.45, damage 0.82 of its 1.25), as far as this step goes (BALANCE.md). #220: measured with the
   * bot playing a realm as one run, the late levels were far too easy (a run carries its relics on, 18 of them by the last level), so
   * they step up from that floor, the later the more; only the Marches' level 2 stays on it. Level 1 steps up to stay where it was:
   * champion scaling eases it most (config/champion.ts).
   */
  levelStep: {
    marches: { hp: [0.89, 0.72, 0.74, 0.82, 0.88, 1.1, 0.93], damage: [1.02, 0.82, 0.84, 0.93, 1, 1.25, 1.06] },
    realm: { hp: [0.77, 0.77, 0.83, 0.99, 1.07], damage: [0.92, 0.86, 0.93, 1.12, 1.23] },
    /**
     * #232: a relic realm's own steps, in place of `realm`'s, where its foes and hazard ask for them. The Cinderlands (BALANCE.md): its
     * level 1 eases (burn stacks and the spreading fire cost the bot first tries the Iron Hold's level 1 did not), its level 3 hits a
     * little harder (88% of first tries cleared it, against 73%) and its crown level eases most (the waves before the Cinder Colossus
     * felled 12 of 40 first tries and he 16 more). Level 2 eases a touch for its longer waves (levelWaves). #262: levels 2 and 4 ease
     * (level 2 to the floor), for a champion with only the Marches crown (a playtest's Paladin fell 3 times on level 2 at level 8-9).
     */
    own: { cinderlands: { hp: [0.77, 0.72, 0.83, 0.95, 0.95], damage: [0.85, 0.82, 0.98, 1.08, 0.95] } } as Partial<Record<RealmId, { hp: number[]; damage: number[] }>>,
  },
  /**
   * #243 (rule 9): how long a level's waves are, by its place in its realm, so a realm's level 1 takes 4-6 minutes and its last 7-10
   * (the Marches' level 1 at least 4): `foes` on the number of foes a wave brings (the director's budget) and `pace` on the time they
   * trickle in over. A foe's XP is divided by `foes`, so a level still pays what its waves pay at the pace. Levels only: the Daily Trial
   * and a plain run keep 1, and so does the Last Bastion (a whole run; logic/world levelWaves).
   */
  levelWaves: {
    marches: { foes: [1.6, 0.9, 0.9, 0.9, 0.9, 0.8, 0.8], pace: [2.8, 2, 2, 2, 2, 2.2, 2.2] }, // #220: level 1 foes 1.6 and pace 2.8 (were 1.5, 2.5): eased, it ran under its 4 minutes
    realm: { foes: [1.6, 1.2, 1.1, 0.95, 0.9], pace: [2, 1.5, 1.5, 1.8, 2.2] },
    /**
     * #232: a relic realm's own wave lengths, in place of `realm`'s. The Cinderlands' levels 2-4 are longer (more foes over a longer time): the
     * realm ran 29 minutes clean against rule 9's 35. #262: level 2 brings a relic realm's 1.2 foes (was 1.3) over its longer time: fewer at once.
     */
    own: { cinderlands: { foes: [1.6, 1.2, 1.25, 1.05, 0.9], pace: [2, 1.65, 1.7, 2, 2.2] } } as Partial<Record<RealmId, { foes: number[]; pace: number[] }>>,
  },
  /**
   * #259: a level whose road features one of its realm's `fields` foes (the Iron Hold's Iron Shieldwall) brings a squad of it for sure,
   * on a wave drawn per seed from the level's first `within` waves where that squad is fielded; any more come at `fieldsWeight`.
   */
  featuredSquad: { within: 3 },
  /** Rule 6: the Last Bastion's elite foes and limits. */
  finale: { minAffixes: 2, eliteCap: 0.35, eliteChanceMult: 1.5, armorersChoice: false, merchantRelics: false },
  /**
   * Rule 3 (#191; #238: realm levels have no head start any more, so this is test mode's, for a plain run at a chosen wave): the head start's missing level-up boons, one per level skipped, taken round this cycle ('attack': the class's attack
   * stat). Decided: at rare strength, about what the best of three rolled cards is worth. #221: the levels from `lateFrom` on give
   * `lateRarity` boons, since a run that played those waves also holds twice the relics a loadout does (rule 9's power band).
   */
  headStart: { boons: ['attack', 'hp', 'atkSpd', 'secondary'] as const, rarity: 'rare' as const, lateRarity: 'epic' as const, lateFrom: 11 },
  /**
   * Rule 6 (#204): the Daily Trial is today's 40-wave run with the fixed pool and no loadout, open once any champion holds this realm's
   * crown (any tier). Decided: a save that already took a Daily Trial keeps it open; the Armorer's offer and the Keepsake's free common
   * are slots now, so a trial (no slots) opens with neither.
   */
  daily: { opensWith: 'marches' as RealmId, startRelics: false },
};
