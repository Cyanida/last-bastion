import type { AbilityUpgradeId } from './abilityUpgrades';
import type { ClassId } from './classes';
import type { RelicId } from './relics';
import type { UtilityUpgradeId } from './utility';

/**
 * v0.6 evolutions: each class has three for its signature ability and two for its utility. Each needs a pair of requirements
 * (an ability or utility upgrade, and a keystone, a talent from a branch, or a relic at a tier). When both are met the next
 * level-up offers it as a gold card; a run holds one signature evolution and one utility evolution. An evolution changes what the
 * ability does, not just its numbers, and still scales with the class's secondary stat (the `per` numbers). Behaviour lives in
 * systems/evolutions.ts, keyed by id.
 */
export type Requirement =
  | { kind: 'upgrade'; id: AbilityUpgradeId } // a signature-ability upgrade (config/abilityUpgrades.ts)
  | { kind: 'utility'; id: UtilityUpgradeId } // a utility upgrade (config/utility.ts)
  | { kind: 'keystone'; branch: string } // the keystone of that talent branch ('paladin.bulwark')
  | { kind: 'branch'; branch: string } // any talent of that branch past its first row
  | { kind: 'relic'; id: RelicId; tier: number }; // that relic at this tier or higher

export type EvolutionSlot = 'signature' | 'utility';

export interface EvolutionDef {
  id: string;
  classId: ClassId;
  slot: EvolutionSlot;
  name: string;
  icon: string;
  desc: string;
  requires: [Requirement, Requirement];
  n: Record<string, number>;
}

const evo = (classId: ClassId, slot: EvolutionSlot, name: string, icon: string, requires: [Requirement, Requirement], n: Record<string, number>, desc: string) => ({ classId, slot, name, icon, requires, n, desc });

export const EVOLUTIONS = {
  // ---------------------------------------------------------------- Paladin: Divine Shield (Faith), Challenge
  aegisOfDawn: evo('paladin', 'signature', 'Aegis of Dawn', '🌅', [{ kind: 'upgrade', id: 'mirrorShield' }, { kind: 'keystone', branch: 'paladin.bulwark' }],
    { radius: 150, radiusPer: 4, dps: 10, dpsPer: 1, reflect: 1.5, reflectPer: 0.05 },
    'The shield becomes a golden dome around you. Enemy shots that enter it turn and fly back as holy bolts, and enemies inside it burn.'),
  dayOfJudgement: evo('paladin', 'signature', 'Day of Judgement', '⚖️', [{ kind: 'upgrade', id: 'judgement' }, { kind: 'relic', id: 'thunderDrum', tier: 2 }],
    { waves: 3, gap: 0.35, grow: 0.6, sword: 3, swordPer: 0.1 },
    'The burst rolls out as three rings of holy fire, one after another, and a sword of light falls on the strongest enemy near you.'),
  crusadersCharge: evo('paladin', 'signature', "Crusader's Charge", '🐎', [{ kind: 'upgrade', id: 'zeal' }, { kind: 'keystone', branch: 'paladin.crusader' }],
    { dist: 300, distPer: 6, damage: 1.2, damagePer: 0.04, width: 60, knockback: 420 },
    'Raising the shield throws you forward in a charge that tramples everything in your path, then the shield holds as ever.'),
  lionsRoar: evo('paladin', 'utility', "Lion's Roar", '🦁', [{ kind: 'utility', id: 'chains' }, { kind: 'relic', id: 'rallyBanner', tier: 2 }],
    { damage: 30, damagePer: 3, mark: 1.3, markT: 5 },
    'The Challenge is a roar: everything it pulls is burnt by holy light and marked, taking 30% more damage from everything for 5s.'),
  standardOfFaith: evo('paladin', 'utility', 'Standard of Faith', '🚩', [{ kind: 'utility', id: 'ironWill' }, { kind: 'branch', branch: 'paladin.bulwark' }],
    { hp: 220, hpPer: 20, life: 8, lifePer: 0.2, radius: 200, regen: 4, regenPer: 0.3 },
    'The Challenge plants a holy standard where you stand. The horde turns on the standard instead of you, and near it you heal.'),

  // ---------------------------------------------------------------- Viking: Berserker Rage (Rage), Leap
  avatarOfWrath: evo('viking', 'signature', 'Avatar of Wrath', '🗿', [{ kind: 'upgrade', id: 'undying' }, { kind: 'keystone', branch: 'viking.berserk' }],
    { radius: 70, shock: 0.35, shockPer: 0.02 },
    'Raging, you grow into a giant: every swing sweeps all around you, and every hit sends a shockwave out from where it lands.'),
  maelstrom: evo('viking', 'signature', 'Maelstrom', '🌀', [{ kind: 'upgrade', id: 'whirlwind' }, { kind: 'relic', id: 'stormPennant', tier: 2 }],
    { every: 0.4, radius: 110, radiusPer: 2, damage: 0.5, pull: 140 },
    'Raging, you become a spinning storm of steel: every moment a full spin cuts everything around you and drags it closer.'),
  bloodTide: evo('viking', 'signature', 'Blood Tide', '🩸', [{ kind: 'upgrade', id: 'bloodthirst' }, { kind: 'relic', id: 'vampireFang', tier: 2 }],
    { radius: 95, damage: 0.6, damagePer: 0.03, heal: 3 },
    'Every enemy slain while raging bursts in a tide of blood: it hurts and bleeds everything around, and heals you.'),
  thunderfall: evo('viking', 'utility', 'Thunderfall', '⚡', [{ kind: 'utility', id: 'earthshatter' }, { kind: 'relic', id: 'shockSigil', tier: 2 }],
    { chains: 5, chainsPer: 0.2, range: 240, damage: 26, stun: 0.6 },
    'The Leap lands as a thunderbolt: lightning jumps from the landing to the enemies around it and stuns them.'),
  valkyrie: evo('viking', 'utility', "Valkyrie's Descent", '🪽', [{ kind: 'utility', id: 'longJump' }, { kind: 'branch', branch: 'viking.raider' }],
    { window: 1.5, fire: 4, dps: 12, dpsPer: 1 },
    'Every Leap can be followed by a second one straight away, and every landing leaves a burning crater.'),

  // ---------------------------------------------------------------- Angel: Heavenly Radiance (Grace), Blink
  sunburst: evo('angel', 'signature', 'Sunburst', '☀️', [{ kind: 'upgrade', id: 'twinPulse' }, { kind: 'keystone', branch: 'angel.wrath' }],
    { life: 3, lifePer: 0.1, speed: 70, radius: 120, dps: 30, dpsPer: 2, heal: 0.15 },
    'Radiance sets a small sun loose that drifts at your aim, burning everything it passes over and healing you for part of it.'),
  choir: evo('angel', 'signature', 'Choir of Angels', '🎶', [{ kind: 'upgrade', id: 'ascension' }, { kind: 'relic', id: 'seraphHalo', tier: 2 }],
    { wisps: 3, wispsPer: 0.1, life: 6, every: 0.6, damage: 0.6, orbit: 70 },
    'Radiance calls a choir of spectral wisps that circle you and loose holy bolts at the nearest enemies.'),
  sanctuaryWings: evo('angel', 'signature', 'Sanctuary Wings', '🕊️', [{ kind: 'upgrade', id: 'guardianAngel' }, { kind: 'keystone', branch: 'angel.mercy' }],
    { life: 5, lifePer: 0.1, radius: 170, damage: 20, damagePer: 2, knockback: 320, heal: 0.03 },
    'Radiance raises a ring of light around you: enemies that cross it are burnt and thrown back, and inside it you heal.'),
  starfall: evo('angel', 'utility', 'Starfall', '🌠', [{ kind: 'utility', id: 'afterimage' }, { kind: 'relic', id: 'thunderDrum', tier: 2 }],
    { stars: 5, starsPer: 0.2, damage: 34, radius: 60 },
    'Blinking rains falling stars along the way you went.'),
  phaseWalk: evo('angel', 'utility', 'Phase Walk', '👥', [{ kind: 'utility', id: 'quickBlink' }, { kind: 'branch', branch: 'angel.herald' }],
    { hp: 120, hpPer: 10, life: 4, radius: 120, damage: 40, damagePer: 3 },
    'Blinking leaves a mirror image where you stood. The horde goes for it, and it bursts into light when it fades or falls.'),

  // ---------------------------------------------------------------- Necromancer: Raise Dead (Soul Power), Corpse Explosion
  boneColossus: evo('necromancer', 'signature', 'Bone Colossus', '💀', [{ kind: 'upgrade', id: 'boneGolems' }, { kind: 'keystone', branch: 'necromancer.horde' }],
    { hp: 1.2, damage: 0.7, cleave: 70, scale: 7, grow: 0.25 },
    'Raise Dead fuses your skeletons into one Bone Colossus that cleaves everything around what it strikes. Raising again feeds it.'),
  plagueLegion: evo('necromancer', 'signature', 'Plague Legion', '🦠', [{ kind: 'upgrade', id: 'volatileBones' }, { kind: 'relic', id: 'gravePact', tier: 2 }],
    { every: 0.9, radius: 40, dps: 6, dpsPer: 0.6, life: 3, cloud: 90 },
    'Your skeletons rise as plague-bearers: they leave poison where they walk and burst into a plague cloud when they fall.'),
  soulHarvest: evo('necromancer', 'signature', 'Soul Harvest', '👻', [{ kind: 'upgrade', id: 'frenziedDead' }, { kind: 'keystone', branch: 'necromancer.lich' }],
    { max: 10, maxPer: 0.2, damage: 18, damagePer: 1.5, speed: 380 },
    'Every enemy your minions slay leaves a soul circling you. Raise Dead also looses every stored soul as a seeking bolt.'),
  corpseLance: evo('necromancer', 'utility', 'Corpse Lance', '🦴', [{ kind: 'utility', id: 'boneShards' }, { kind: 'branch', branch: 'necromancer.plague' }],
    { damage: 1.4, speed: 700, range: 700 },
    'Corpses do not burst where they lie: each one hurls a lance of bone at the nearest enemy that pierces everything in its line.'),
  deathsDoor: evo('necromancer', 'utility', "Death's Door", '🚪', [{ kind: 'utility', id: 'harvest' }, { kind: 'relic', id: 'vampireFang', tier: 2 }],
    { raised: 3, raisedPer: 0.1 },
    'Every Corpse Explosion also raises skeletons from the bursting dead, beyond your usual limit.'),

  // ---------------------------------------------------------------- Archer: Arrow Volley (Focus), Dodge Roll
  meteorArrow: evo('archer', 'signature', 'Meteor Arrow', '☄️', [{ kind: 'upgrade', id: 'ballista' }, { kind: 'keystone', branch: 'archer.hunter' }],
    { delay: 0.8, radius: 150, radiusPer: 3, mult: 1.2, fire: 4 },
    'The volley is one arrow loosed into the sky that comes down as a meteor: one huge blast, and the ground burns after.'),
  stormVolley: evo('archer', 'signature', 'Storm Volley', '🌩️', [{ kind: 'upgrade', id: 'doubleVolley' }, { kind: 'relic', id: 'stormPennant', tier: 2 }],
    { mult: 0.5, multPer: 0.01, range: 160 },
    'Every arrow of the volley that strikes calls lightning down on a second enemy nearby.'),
  huntersMark: evo('archer', 'signature', "Hunter's Mark", '🎯', [{ kind: 'upgrade', id: 'markedForDeath' }, { kind: 'keystone', branch: 'archer.marksman' }],
    { damage: 0.5, damagePer: 0.02, time: 10 },
    'The volley marks the toughest enemy it hits as your prey: your arrows seek it out, and when it falls a free volley follows.'),
  shadowStep: evo('archer', 'utility', 'Shadow Step', '🥷', [{ kind: 'utility', id: 'ghostStep' }, { kind: 'branch', branch: 'archer.ranger' }],
    { life: 3, every: 0.45, damage: 0.7, hp: 90 },
    'Rolling leaves a shadow of you behind that keeps shooting, and draws the horde while it lasts.'),
  frostTrap: evo('archer', 'utility', 'Frost Trap', '❄️', [{ kind: 'utility', id: 'sharpCaltrops' }, { kind: 'relic', id: 'frostBrand', tier: 2 }],
    { delay: 0.6, radius: 110, damage: 30, damagePer: 2, freeze: 1.5 },
    'Rolling drops a frost trap: a moment later it bursts, freezing everything around it solid.'),
} satisfies Record<string, Omit<EvolutionDef, 'id'>>;

export type EvolutionId = keyof typeof EVOLUTIONS;
export const EVOLUTION_IDS = Object.keys(EVOLUTIONS) as EvolutionId[];
export const evolutionDef = (id: EvolutionId): EvolutionDef => ({ id, ...EVOLUTIONS[id] }) as EvolutionDef;
