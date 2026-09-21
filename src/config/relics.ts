import type { Mods } from '../core/types';
import type { ClassId } from './classes';

export type Rarity = 'common' | 'rare' | 'legendary';

export interface RelicDef {
  name: string;
  rarity: Rarity;
  icon: string;
  desc: string;
  classId?: ClassId; // only offered to this class
  mods?: Partial<Mods>; // plain passive modifiers, no hook needed
  n: Record<string, number>; // numbers read by the hook in systems/relics.ts
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Keeps each relic's numbers typed (RELICS.stormPennant.n.chance) and its text in sync with them. */
function relic<N extends Record<string, number>>(r: Omit<RelicDef, 'desc' | 'n'> & { n: N; desc: (n: N) => string }) {
  return { ...r, desc: r.desc(r.n) };
}

export const RELIC_SLOTS = 6;
export const RELIC_WEIGHTS: Record<Rarity, number> = { common: 60, rare: 30, legendary: 10 };
export const BOSS_RELIC_CHOICES = 3;
/** Relic damage has no attack stat behind it, so it grows with character level instead. */
export const RELIC_DAMAGE_PER_LEVEL = 0.12;

export const RELICS = {
  // ---------- common ----------
  whetstone: relic({ name: 'Whetstone', rarity: 'common', icon: '🗡️', mods: { damage: 1.12 }, n: {}, desc: () => '+12% damage.' }),
  swiftBoots: relic({ name: 'Swift Boots', rarity: 'common', icon: '🥾', mods: { moveSpd: 1.1 }, n: {}, desc: () => '+10% movement speed.' }),
  luckyCoin: relic({ name: 'Lucky Coin', rarity: 'common', icon: '🪙', mods: { gold: 1.3 }, n: {}, desc: () => '+30% gold found.' }),
  scholarTome: relic({ name: "Scholar's Tome", rarity: 'common', icon: '📖', mods: { xp: 1.15 }, n: {}, desc: () => '+15% experience.' }),
  lodestone: relic({ name: 'Lodestone', rarity: 'common', icon: '🧲', mods: { pickup: 1.75 }, n: {}, desc: () => '+75% pickup radius.' }),
  ironBand: relic({ name: 'Iron Band', rarity: 'common', icon: '💍', mods: { armor: 0.08 }, n: {}, desc: () => '+8% armor.' }),
  vampireFang: relic({
    name: 'Vampire Fang', rarity: 'common', icon: '🦷', n: { heal: 1.5 },
    desc: (n) => `Heal ${n.heal} HP for every enemy slain.`,
  }),
  thornMail: relic({
    name: 'Thorn Mail', rarity: 'common', icon: '🌵', n: { mult: 4 },
    desc: (n) => `Enemies that hurt you take ${n.mult}× that damage back.`,
  }),
  rallyBanner: relic({
    name: 'Rally Banner', rarity: 'common', icon: '🚩', n: { heal: 0.15 },
    desc: (n) => `Heal ${pct(n.heal)} of max HP at the start of every wave.`,
  }),

  // ---------- rare ----------
  stormPennant: relic({
    name: 'Storm Pennant', rarity: 'rare', icon: '⚡', n: { chance: 0.3, range: 170, mult: 0.6 },
    desc: (n) => `Attacks have a ${pct(n.chance)} chance to arc to a second enemy for ${pct(n.mult)} damage.`,
  }),
  powderKeg: relic({
    name: 'Powder Keg', rarity: 'rare', icon: '💥', n: { chance: 0.2, radius: 85, hpFrac: 0.5 },
    desc: (n) => `Slain enemies have a ${pct(n.chance)} chance to explode for ${pct(n.hpFrac)} of their max HP.`,
  }),
  sentinelStance: relic({
    name: "Sentinel's Stance", rarity: 'rare', icon: '🗿', n: { perSec: 0.2, max: 0.6 },
    desc: (n) => `Standing still charges up to +${pct(n.max)} damage. Moving resets it.`,
  }),
  shockSigil: relic({
    name: 'Shockwave Sigil', rarity: 'rare', icon: '🌀', n: { cooldown: 4, radius: 150, damage: 30, knockback: 380 },
    desc: (n) => `Taking damage releases a shockwave (${n.damage}+ damage, ${n.cooldown}s cooldown).`,
  }),
  warHorn: relic({
    name: 'War Horn', rarity: 'rare', icon: '📯', n: { atkSpd: 0.4, time: 12 },
    desc: (n) => `+${pct(n.atkSpd)} attack speed for ${n.time}s at the start of every wave.`,
  }),
  executioner: relic({
    name: "Executioner's Hood", rarity: 'rare', icon: '🪓', n: { threshold: 0.25, bonus: 1 },
    desc: (n) => `Attacks deal +${pct(n.bonus)} damage to enemies below ${pct(n.threshold)} HP.`,
  }),
  echoBell: relic({
    name: 'Echo Bell', rarity: 'rare', icon: '🔔', n: { radius: 150, damage: 28 },
    desc: (n) => `Using your ability rings the bell: ${n.damage}+ damage to everything nearby.`,
  }),
  frostBrand: relic({
    name: 'Frost Brand', rarity: 'rare', icon: '❄️', n: { chance: 0.25, slow: 0.5, time: 2 },
    desc: (n) => `Attacks have a ${pct(n.chance)} chance to chill: ${pct(1 - n.slow)} slower for ${n.time}s.`,
  }),

  // ---------- legendary ----------
  bloodPact: relic({
    name: 'Blood Pact', rarity: 'legendary', icon: '🩸', mods: { damage: 1.5 }, n: { hp: 0.7 },
    desc: (n) => `+50% damage, but max HP is cut to ${pct(n.hp)}.`,
  }),
  hourglass: relic({
    name: 'Sands of Chronos', rarity: 'legendary', icon: '⏳', mods: { cooldown: 0.65 }, n: {},
    desc: () => 'Signature ability cooldown reduced by 35%.',
  }),
  phoenixFeather: relic({
    name: 'Phoenix Feather', rarity: 'legendary', icon: '🪶', n: { charges: 1 },
    desc: () => 'Once per run, rise from death with half your HP.',
  }),
  soulLantern: relic({
    name: 'Soul Lantern', rarity: 'legendary', icon: '🏮', n: { chance: 0.12, max: 4, life: 9, hp: 40, damage: 8 },
    desc: (n) => `Slain enemies have a ${pct(n.chance)} chance to rise as a skeleton ally (max ${n.max}).`,
  }),
  conquerorCrown: relic({
    name: "Conqueror's Crown", rarity: 'legendary', icon: '👑', n: { perWave: 0.03, max: 0.75 },
    desc: (n) => `+${pct(n.perWave)} damage for every wave cleared while you wear it (max +${pct(n.max)}).`,
  }),

  // ---------- class relics: each leans on that class's secondary stat ----------
  reliquary: relic({
    name: 'Reliquary of Saints', rarity: 'rare', icon: '⚱️', classId: 'paladin', n: { perFaith: 0.02 },
    desc: (n) => `Every hit you take shaves ${n.perFaith}s × Faith off Divine Shield's cooldown.`,
  }),
  wolfskin: relic({
    name: 'Wolfskin Cloak', rarity: 'rare', icon: '🐺', classId: 'viking', n: { perRage: 0.03, cap: 1 },
    desc: (n) => `Kills during Berserker Rage extend it by ${n.perRage}s × Rage (up to double length).`,
  }),
  seraphHalo: relic({
    name: "Seraph's Halo", rarity: 'rare', icon: '😇', classId: 'angel', n: { base: 4, perGrace: 0.8, mult: 1.5 },
    desc: (n) => `Heavenly Radiance also fires ${n.base} + Grace × ${n.perGrace} light bolts in all directions.`,
  }),
  boneChime: relic({
    name: 'Bone Chime', rarity: 'rare', icon: '🎐', classId: 'necromancer', n: { inherit: 0.5, perSoul: 0.02 },
    desc: (n) => `Minions inherit ${pct(n.inherit)} of your attack speed, plus ${pct(n.perSoul)} per Soul Power.`,
  }),
  hawkeyeQuiver: relic({
    name: 'Hawkeye Quiver', rarity: 'rare', icon: '🏹', classId: 'archer', n: { per: 4 },
    desc: (n) => `Your arrows pierce one extra enemy for every ${n.per} Focus.`,
  }),
};

export type RelicId = keyof typeof RELICS;
export const RELIC_IDS = Object.keys(RELICS) as RelicId[];
export const relicDef = (id: RelicId): RelicDef => RELICS[id];
