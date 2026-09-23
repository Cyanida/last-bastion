import type { Mods } from '../core/types';
import type { ClassId } from './classes';

export type Rarity = 'common' | 'rare' | 'legendary';
/** Stacking category (BALANCE.md): plain mods of a category add up and pass a soft cap; procs of a category share their chance past a count. */
export type RelicCategory = 'damage' | 'attackSpeed' | 'defense' | 'utility' | 'onHit' | 'onKill';

export interface RelicTier {
  n?: Record<string, number>;
  mods?: Partial<Mods>;
}

export interface RelicDef {
  name: string;
  rarity: Rarity;
  icon: string;
  category: RelicCategory;
  desc: string; // tier 1 text
  describe: (n: Record<string, number>) => string; // text for any tier's numbers
  classId?: ClassId; // only offered to this class
  mods?: Partial<Mods>; // plain passive modifiers, no hook needed
  n: Record<string, number>; // numbers read by the hook in systems/relics.ts
  tiers: [RelicTier, RelicTier]; // tier 2 and tier 3: numbers and mods that change
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Keeps each relic's numbers typed (RELICS.stormPennant.n.chance) and its text in sync with them. */
function relic<N extends Record<string, number>>(r: Omit<RelicDef, 'desc' | 'describe' | 'n' | 'tiers'> & { n: N; desc: (n: N) => string; tiers: [{ n?: Partial<N>; mods?: Partial<Mods> }, { n?: Partial<N>; mods?: Partial<Mods> }] }) {
  return { ...r, desc: r.desc(r.n), describe: r.desc as (n: Record<string, number>) => string };
}

export const RELIC_MAX_TIER = 3;
export const TIER_NUMERALS = ['', 'I', 'II', 'III'];
export const RELIC_WEIGHTS: Record<Rarity, number> = { common: 60, rare: 30, legendary: 10 };
export const BOSS_RELIC_CHOICES = 3;

/**
 * v0.7: relics come only at fixed moments: every mid-Act and Act boss, lairs, strongboxes, a quest whose reward is a relic, a Merchant
 * purchase (the Merchant between Acts, or a wandering peddler) and the run start (Armorer's Choice). Every moment is a pick of one from
 * `choices`, with a visible Skip (paying run gold and a Rune shard) and `rerolls` rerolls. Offers lean `heldFamilyWeight` times toward the
 * families you hold, and always show at least one relic from a family you hold (once you hold one) and one from a family you don't.
 * Target: 12-16 moments in a full four-Act run (RELICS.md).
 */
export const RELIC_MOMENTS = {
  choices: 3,
  rerolls: 1,
  skip: { gold: 30, goldPerAct: 30, shards: 1 },
  heldFamilyWeight: 2,
  merchantPerVisit: 1, // the Merchant sells one relic moment a visit between Acts (not at the Merchant path's caravan): at most 3 a run
};
/** Relic damage has no attack stat behind it, so it grows with character level instead. */
export const RELIC_DAMAGE_PER_LEVEL = 0.09; // v0.3: 0.12, when a wave-30 character was level 18; now it is level 25

/** Drops: the share of new relics in an offer shrinks with every relic held (late drops are mostly upgrades). Selling and salvage at the Merchant. */
export const RELIC_DROPS = {
  newDecayPerHeld: 0.09,
  minNewShare: 0.25,
  sellFrac: 0.35, // of the Merchant's buy price for that rarity, per tier
  salvage: { common: 1, rare: 2, legendary: 4 } as Record<Rarity, number>, // Rune shards per tier
};

/**
 * Stacking (BALANCE.md): the same mod from several relics adds up (whetstone +12%, blood pact +50% = +62%) at face value up to the soft cap;
 * past it the excess has diminishing returns and never adds more than half the cap again (damage: +100% at face value, +150% at most).
 * Procs: past `procCap` relics of a category, every proc's chance is scaled by procCap/count. Healing from relics (the Fang, the Banner)
 * passes the same kind of soft cap per wave (`healCap`, a share of max HP): the sustain stack was what made a relic build immortal.
 * Proc chains stop at `procDepth`: a relic reacting to a relic's damage is fine, a third link is not.
 */
export const RELIC_STACKING = {
  softCaps: { damage: 1, atkSpd: 0.6, moveSpd: 0.5, cooldown: 0.5, pickup: 3, xp: 1, gold: 1.5, armor: 0.3, crit: 0.4, pierce: 4, minionAtkSpd: 0.8, minionDamage: 1 } as Partial<Record<keyof Mods, number>>,
  procCap: 3,
  procDepth: 2,
  healCap: 1, // relic healing per wave, as a share of max HP: face value up to this, diminishing past it (never more than 1.5x)
};

export const RELIC_CATEGORIES: Record<RelicCategory, { name: string; desc: string }> = {
  damage: { name: 'Damage', desc: 'Damage bonuses add up, then pass a soft cap of +100%.' },
  attackSpeed: { name: 'Attack speed', desc: 'Attack speed bonuses add up, then pass a soft cap of +60%.' },
  defense: { name: 'Defense', desc: 'Armor bonuses add up, then pass a soft cap of +30%.' },
  utility: { name: 'Utility', desc: 'Speed, gold, XP and pickup bonuses add up per kind, each with its own soft cap.' },
  onHit: { name: 'On hit', desc: 'Past three on-hit relics, every proc chance is shared out (three relics: full chance, six: half).' },
  onKill: { name: 'On kill', desc: 'Past three on-kill relics, every proc chance is shared out.' },
};

export const RELICS = {
  // ---------- common ----------
  whetstone: relic({ name: 'Whetstone', rarity: 'common', icon: '🗡️', category: 'damage', mods: { damage: 1.12 }, n: { bonus: 0.12 }, desc: (n) => `+${pct(n.bonus)} damage.`, tiers: [{ n: { bonus: 0.18 }, mods: { damage: 1.18 } }, { n: { bonus: 0.25 }, mods: { damage: 1.25 } }] }),
  swiftBoots: relic({ name: 'Swift Boots', rarity: 'common', icon: '🥾', category: 'utility', mods: { moveSpd: 1.1 }, n: { bonus: 0.1 }, desc: (n) => `+${pct(n.bonus)} movement speed.`, tiers: [{ n: { bonus: 0.15 }, mods: { moveSpd: 1.15 } }, { n: { bonus: 0.2 }, mods: { moveSpd: 1.2 } }] }),
  luckyCoin: relic({ name: 'Lucky Coin', rarity: 'common', icon: '🪙', category: 'utility', mods: { gold: 1.3 }, n: { bonus: 0.3 }, desc: (n) => `+${pct(n.bonus)} gold found.`, tiers: [{ n: { bonus: 0.45 }, mods: { gold: 1.45 } }, { n: { bonus: 0.6 }, mods: { gold: 1.6 } }] }),
  scholarTome: relic({ name: "Scholar's Tome", rarity: 'common', icon: '📖', category: 'utility', mods: { xp: 1.15 }, n: { bonus: 0.15 }, desc: (n) => `+${pct(n.bonus)} experience.`, tiers: [{ n: { bonus: 0.22 }, mods: { xp: 1.22 } }, { n: { bonus: 0.3 }, mods: { xp: 1.3 } }] }),
  lodestone: relic({ name: 'Lodestone', rarity: 'common', icon: '🧲', category: 'utility', mods: { pickup: 1.75 }, n: { bonus: 0.75 }, desc: (n) => `+${pct(n.bonus)} pickup radius.`, tiers: [{ n: { bonus: 1.25 }, mods: { pickup: 2.25 } }, { n: { bonus: 1.75 }, mods: { pickup: 2.75 } }] }),
  ironBand: relic({ name: 'Iron Band', rarity: 'common', icon: '💍', category: 'defense', mods: { armor: 0.08 }, n: { bonus: 0.08 }, desc: (n) => `+${pct(n.bonus)} armor.`, tiers: [{ n: { bonus: 0.12 }, mods: { armor: 0.12 } }, { n: { bonus: 0.16 }, mods: { armor: 0.16 } }] }),
  vampireFang: relic({
    name: 'Vampire Fang', rarity: 'common', icon: '🦷', category: 'onKill', n: { heal: 1.5 },
    desc: (n) => `Heal ${n.heal} HP for every enemy slain.`,
    tiers: [{ n: { heal: 2.5 } }, { n: { heal: 4 } }],
  }),
  thornMail: relic({
    name: 'Thorn Mail', rarity: 'common', icon: '🌵', category: 'defense', n: { mult: 4 },
    desc: (n) => `Enemies that hurt you take ${n.mult}× that damage back.`,
    tiers: [{ n: { mult: 6 } }, { n: { mult: 9 } }],
  }),
  rallyBanner: relic({
    name: 'Rally Banner', rarity: 'common', icon: '🚩', category: 'defense', n: { heal: 0.15 },
    desc: (n) => `Heal ${pct(n.heal)} of max HP at the start of every wave.`,
    tiers: [{ n: { heal: 0.22 } }, { n: { heal: 0.3 } }],
  }),

  // ---------- rare ----------
  stormPennant: relic({
    name: 'Storm Pennant', rarity: 'rare', icon: '⚡', category: 'onHit', n: { chance: 0.3, range: 170, mult: 0.6, arcs: 1 },
    desc: (n) => `Attacks have a ${pct(n.chance)} chance to arc to ${n.arcs > 1 ? `${n.arcs} more enemies` : 'a second enemy'} for ${pct(n.mult)} damage.`,
    tiers: [{ n: { chance: 0.4, mult: 0.7 } }, { n: { chance: 0.5, mult: 0.8, arcs: 2 } }],
  }),
  powderKeg: relic({
    name: 'Powder Keg', rarity: 'rare', icon: '💥', category: 'onKill', n: { chance: 0.2, radius: 85, hpFrac: 0.5 },
    desc: (n) => `Slain enemies have a ${pct(n.chance)} chance to explode for ${pct(n.hpFrac)} of their max HP.`,
    tiers: [{ n: { chance: 0.3, hpFrac: 0.65 } }, { n: { chance: 0.4, hpFrac: 0.8, radius: 100 } }],
  }),
  sentinelStance: relic({
    name: "Sentinel's Stance", rarity: 'rare', icon: '🗿', category: 'damage', n: { perSec: 0.2, max: 0.6 },
    desc: (n) => `Standing still charges up to +${pct(n.max)} damage. Moving resets it.`,
    tiers: [{ n: { perSec: 0.3, max: 0.8 } }, { n: { perSec: 0.4, max: 1 } }],
  }),
  shockSigil: relic({
    name: 'Shockwave Sigil', rarity: 'rare', icon: '🌀', category: 'defense', n: { cooldown: 4, radius: 150, damage: 30, knockback: 380 },
    desc: (n) => `Taking damage releases a shockwave (${n.damage}+ damage, ${n.cooldown}s cooldown).`,
    tiers: [{ n: { cooldown: 3, damage: 45 } }, { n: { cooldown: 2, damage: 60, radius: 180 } }],
  }),
  warHorn: relic({
    name: 'War Horn', rarity: 'rare', icon: '📯', category: 'attackSpeed', n: { atkSpd: 0.4, time: 12 },
    desc: (n) => `+${pct(n.atkSpd)} attack speed for ${n.time}s at the start of every wave.`,
    tiers: [{ n: { atkSpd: 0.55, time: 16 } }, { n: { atkSpd: 0.7, time: 20 } }],
  }),
  executioner: relic({
    name: "Executioner's Hood", rarity: 'rare', icon: '🪓', category: 'damage', n: { threshold: 0.25, bonus: 1 },
    desc: (n) => `Attacks deal +${pct(n.bonus)} damage to enemies below ${pct(n.threshold)} HP.`,
    tiers: [{ n: { threshold: 0.3, bonus: 1.5 } }, { n: { threshold: 0.35, bonus: 2 } }],
  }),
  echoBell: relic({
    name: 'Echo Bell', rarity: 'rare', icon: '🔔', category: 'damage', n: { radius: 150, damage: 28 },
    desc: (n) => `Using your ability rings the bell: ${n.damage}+ damage to everything nearby.`,
    tiers: [{ n: { damage: 42, radius: 170 } }, { n: { damage: 56, radius: 190 } }],
  }),
  frostBrand: relic({
    name: 'Frost Brand', rarity: 'rare', icon: '❄️', category: 'onHit', n: { chance: 0.25, slow: 0.5, time: 2 },
    desc: (n) => `Attacks have a ${pct(n.chance)} chance to chill: ${pct(1 - n.slow)} slower for ${n.time}s.`,
    tiers: [{ n: { chance: 0.35, time: 2.5 } }, { n: { chance: 0.45, time: 3, slow: 0.4 } }],
  }),

  brimstoneOil: relic({
    name: 'Brimstone Oil', rarity: 'rare', icon: '🔥', category: 'onHit', n: { chance: 0.3, power: 0.15 },
    desc: (n) => `Attacks have a ${pct(n.chance)} chance to ignite: a stacking burn worth ${pct(n.power)} of the hit per second.`,
    tiers: [{ n: { chance: 0.4, power: 0.2 } }, { n: { chance: 0.5, power: 0.25 } }],
  }),
  serratedEdge: relic({
    name: 'Serrated Edge', rarity: 'rare', icon: '🩹', category: 'onHit', n: { stacks: 2, power: 0.1 },
    desc: (n) => `Critical hits open wounds: ${n.stacks} stacks of bleed worth ${pct(n.power)} of the hit per second each.`,
    tiers: [{ n: { stacks: 3, power: 0.13 } }, { n: { stacks: 4, power: 0.16 } }],
  }),
  hexDoll: relic({
    name: 'Hex Doll', rarity: 'rare', icon: '🪆', category: 'onHit', n: { stacks: 1 },
    desc: (n) => `Your signature ability curses what it hits: ${n.stacks} stack${n.stacks > 1 ? 's' : ''} per hit, +12% damage taken per stack, up to 3.`,
    tiers: [{ n: { stacks: 2 } }, { n: { stacks: 3 } }],
  }),
  gravePact: relic({
    name: 'Grave Pact', rarity: 'rare', icon: '🕯️', category: 'utility', n: { time: 7 },
    desc: (n) => `Using your ability blesses your minions for ${n.time}s: +30% damage and they mend themselves.`,
    tiers: [{ n: { time: 10 } }, { n: { time: 13 } }],
  }),

  // ---------- legendary ----------
  bloodPact: relic({
    name: 'Blood Pact', rarity: 'legendary', icon: '🩸', category: 'damage', mods: { damage: 1.5 }, n: { hp: 0.7, bonus: 0.5 },
    desc: (n) => `+${pct(n.bonus)} damage, but max HP is cut to ${pct(n.hp)}.`,
    tiers: [{ n: { hp: 0.75, bonus: 0.65 }, mods: { damage: 1.65 } }, { n: { hp: 0.8, bonus: 0.8 }, mods: { damage: 1.8 } }],
  }),
  hourglass: relic({
    name: 'Sands of Chronos', rarity: 'legendary', icon: '⏳', category: 'utility', mods: { cooldown: 0.65 }, n: { cut: 0.35 },
    desc: (n) => `Signature ability cooldown reduced by ${pct(n.cut)}.`,
    tiers: [{ n: { cut: 0.45 }, mods: { cooldown: 0.55 } }, { n: { cut: 0.55 }, mods: { cooldown: 0.45 } }],
  }),
  phoenixFeather: relic({
    name: 'Phoenix Feather', rarity: 'legendary', icon: '🪶', category: 'defense', n: { charges: 1 },
    desc: (n) => (n.charges > 1 ? `${n.charges} times per run, rise from death with half your HP.` : 'Once per run, rise from death with half your HP.'),
    tiers: [{ n: { charges: 2 } }, { n: { charges: 3 } }],
  }),
  soulLantern: relic({
    name: 'Soul Lantern', rarity: 'legendary', icon: '🏮', category: 'onKill', n: { chance: 0.12, max: 4, life: 9, hp: 40, damage: 8 },
    desc: (n) => `Slain enemies have a ${pct(n.chance)} chance to rise as a skeleton ally (max ${n.max}).`,
    tiers: [{ n: { chance: 0.18, max: 6 } }, { n: { chance: 0.24, max: 8, damage: 12 } }],
  }),
  conquerorCrown: relic({
    name: "Conqueror's Crown", rarity: 'legendary', icon: '👑', category: 'damage', n: { perWave: 0.03, max: 0.75 },
    desc: (n) => `+${pct(n.perWave)} damage for every wave cleared while you wear it (max +${pct(n.max)}).`,
    tiers: [{ n: { perWave: 0.04, max: 1 } }, { n: { perWave: 0.05, max: 1.25 } }],
  }),

  // ---------- class relics: each leans on that class's secondary stat ----------
  reliquary: relic({
    name: 'Reliquary of Saints', rarity: 'rare', icon: '⚱️', category: 'defense', classId: 'paladin', n: { perFaith: 0.02 },
    desc: (n) => `Every hit you take shaves ${n.perFaith}s × Faith off Divine Shield's cooldown.`,
    tiers: [{ n: { perFaith: 0.03 } }, { n: { perFaith: 0.04 } }],
  }),
  wolfskin: relic({
    name: 'Wolfskin Cloak', rarity: 'rare', icon: '🐺', category: 'utility', classId: 'viking', n: { perRage: 0.03, cap: 1 },
    desc: (n) => `Kills during Berserker Rage extend it by ${n.perRage}s × Rage (up to ${n.cap === 1 ? 'double' : `${1 + n.cap}×`} length).`,
    tiers: [{ n: { perRage: 0.045, cap: 1.5 } }, { n: { perRage: 0.06, cap: 2 } }],
  }),
  seraphHalo: relic({
    name: "Seraph's Halo", rarity: 'rare', icon: '😇', category: 'damage', classId: 'angel', n: { base: 4, perGrace: 0.8, mult: 1.5 },
    desc: (n) => `Heavenly Radiance also fires ${n.base} + Grace × ${n.perGrace} light bolts in all directions.`,
    tiers: [{ n: { base: 6, mult: 1.8 } }, { n: { base: 8, mult: 2.1, perGrace: 1 } }],
  }),
  boneChime: relic({
    name: 'Bone Chime', rarity: 'rare', icon: '🎐', category: 'attackSpeed', classId: 'necromancer', n: { inherit: 0.5, perSoul: 0.02 },
    desc: (n) => `Minions inherit ${pct(n.inherit)} of your attack speed, plus ${pct(n.perSoul)} per Soul Power.`,
    tiers: [{ n: { inherit: 0.7, perSoul: 0.03 } }, { n: { inherit: 0.9, perSoul: 0.04 } }],
  }),
  hawkeyeQuiver: relic({
    name: 'Hawkeye Quiver', rarity: 'rare', icon: '🏹', category: 'utility', classId: 'archer', n: { per: 4 },
    desc: (n) => `Your arrows pierce one extra enemy for every ${n.per} Focus.`,
    tiers: [{ n: { per: 3 } }, { n: { per: 2 } }],
  }),
};

export type RelicId = keyof typeof RELICS;
export const RELIC_IDS = Object.keys(RELICS) as RelicId[];
export const relicDef = (id: RelicId): RelicDef => RELICS[id];

/** The numbers of a relic at a tier (1..RELIC_MAX_TIER). */
export function relicN(id: RelicId, tier: number): Record<string, number> {
  const def = RELICS[id];
  let n = def.n;
  for (let t = 2; t <= tier; t++) n = { ...n, ...def.tiers[t - 2].n };
  return n;
}

export function relicMods(id: RelicId, tier: number): Partial<Mods> | undefined {
  const def = RELICS[id];
  let mods = def.mods;
  for (let t = 2; t <= tier; t++) if (def.tiers[t - 2].mods) mods = { ...mods, ...def.tiers[t - 2].mods };
  return mods;
}

export const relicDesc = (id: RelicId, tier: number): string => (tier <= 1 ? RELICS[id].desc : RELICS[id].describe(relicN(id, tier)));

/**
 * Synergies: pairs that do something extra together (systems/relics.ts implements them), and clashes that only warn.
 * Every relic's tooltip lists the ones it is part of.
 */
export interface SynergyDef {
  name: string;
  relics: RelicId[];
  desc: string;
  anti?: boolean;
  n: Record<string, number>;
}

const SYN = {
  fireInTheHole: { name: 'Fire in the Hole', relics: ['brimstoneOil', 'powderKeg'], desc: 'Keg blasts ignite everything they hit.', n: { power: 0.2 } },
  shatter: { name: 'Shatter', relics: ['frostBrand', 'serratedEdge'], desc: 'Chilling a bleeding enemy doubles its bleed stacks.', n: { mult: 2 } },
  thunderclap: { name: 'Thunderclap', relics: ['stormPennant', 'echoBell'], desc: 'The bell also stuns what it hits for a moment.', n: { stun: 0.6 } },
  reaper: { name: 'Reaper', relics: ['vampireFang', 'executioner'], desc: "The Fang heals triple on enemies slain below the Hood's threshold.", n: { mult: 3 } },
  bulwark: { name: 'Bulwark', relics: ['thornMail', 'shockSigil'], desc: "The shockwave's cooldown is halved.", n: { mult: 0.5 } },
  muster: { name: 'Muster', relics: ['rallyBanner', 'warHorn'], desc: "The Banner's heal is doubled while the Horn sounds.", n: { mult: 2 } },
  bastion: { name: 'Bastion', relics: ['sentinelStance', 'ironBand'], desc: 'Standing still also charges armor: +2% a second, up to +20%.', n: { perSec: 0.02, max: 0.2 } },
  pilgrimsPurse: { name: "Pilgrim's Purse", relics: ['luckyCoin', 'scholarTome'], desc: '+10% gold and +10% experience on top.', n: { bonus: 0.1 } },
  necropolis: { name: 'Necropolis', relics: ['soulLantern', 'gravePact'], desc: 'Skeletons rise already blessed.', n: {} },
  forager: { name: 'Forager', relics: ['swiftBoots', 'lodestone'], desc: 'Pickups are drawn in from half again as far.', n: { mult: 1.5 } },
  rebirth: { name: 'Rebirth', relics: ['phoenixFeather', 'bloodPact'], desc: 'The Phoenix returns you at full HP.', n: {} },
  tempo: { name: 'Tempo', relics: ['hourglass', 'echoBell'], desc: 'Every ring of the bell refunds a second of cooldown.', n: { refund: 1 } },
  // ---- clashes: warnings only ----
  restless: { name: 'Restless', relics: ['sentinelStance', 'swiftBoots'], desc: 'Moving resets the Stance; speed does nothing for it.', anti: true, n: {} },
  overkill: { name: 'Overkill', relics: ['executioner', 'powderKeg'], desc: 'Keg blasts finish the enemies the Hood wants to execute.', anti: true, n: {} },
  thinBlood: { name: 'Thin Blood', relics: ['bloodPact', 'rallyBanner'], desc: 'The Banner heals a share of a smaller pool.', anti: true, n: {} },
  blunted: { name: 'Blunted', relics: ['thornMail', 'ironBand'], desc: 'Armor shrinks the hits Thorn Mail throws back.', anti: true, n: {} },
} satisfies Record<string, SynergyDef>;

export type SynergyId = keyof typeof SYN;
export const SYNERGIES: Record<SynergyId, SynergyDef> = SYN;
export const SYNERGY_IDS = Object.keys(SYN) as SynergyId[];
