import type { ClassId } from './classes';

export interface AbilityUpgradeDef {
  name: string;
  desc: string;
  n: Record<string, number>;
}

function up<N extends Record<string, number>>(name: string, n: N, desc: (n: N) => string) {
  return { name, n, desc: desc(n) };
}
const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Character levels at which tier 1 / 2 / 3 of the track is chosen. */
export const ABILITY_TIER_LEVELS = [5, 10, 15];

/**
 * Behaviour lives in systems/abilities.ts, keyed by these ids. Every upgrade either builds on the
 * secondary-scaled base values (duration, radius, arrows, minion stats) or has its own per-secondary term.
 */
export const ABILITY_UPGRADES = {
  // ----- Paladin / Divine Shield (Faith) -----
  mirrorShield: up('Mirror Shield', { reflect: 2, perFaith: 0.1 }, (n) => `Blocked hits are reflected for ${n.reflect}× damage, +${pct(n.perFaith)} per Faith.`),
  sanctuary: up('Sanctuary', { heal: 6, perFaith: 0.08, enemies: 3, radius: 150, slowdown: 0.5, maxExtend: 1 }, (n) => `The shield heals ${n.heal} HP/s (+${pct(n.perFaith)} per Faith) and drains half as fast while ${n.enemies}+ enemies are near.`),
  judgement: up('Judgement', { radius: 1.4, slow: 0.4, time: 3 }, (n) => `The holy burst is ${pct(n.radius - 1)} larger and slows survivors by ${pct(1 - n.slow)} for ${n.time}s.`),
  zeal: up('Zeal', { atkSpd: 0.5, perFaith: 0.03 }, (n) => `While shielded you attack ${pct(n.atkSpd)} faster (+${pct(n.perFaith)} per Faith).`),
  martyr: up('Martyrdom', { mult: 1.5 }, (n) => `All damage the shield absorbed is added to the burst at ${pct(n.mult)}.`),
  secondWind: up('Second Wind', { heal: 0.15, cooldown: 0.7 }, (n) => `Casting heals ${pct(n.heal)} of max HP and the cooldown is ${pct(1 - n.cooldown)} shorter.`),

  // ----- Viking / Berserker Rage (Rage) -----
  dreadHowl: up('Dread Howl', { radius: 220, time: 1.2, perRage: 0.04 }, (n) => `Raging stuns nearby enemies for ${n.time}s +${n.perRage}s per Rage. Bosses shrug it off.`), // #134: a stun, not a flee
  earthshaker: up('Earthshaker', { radius: 170, damage: 40, perRage: 0.1, knockback: 380 }, (n) => `Rage ends in a ground slam: ${n.damage} base damage, +${pct(n.perRage)} per Rage.`),
  bloodthirst: up('Bloodthirst', { mult: 2.5 }, (n) => `Rage leeches ${n.mult}× as much life.`),
  whirlwind: up('Whirlwind', { range: 1.25 }, (n) => `While raging your cleave hits all around you with +${pct(n.range - 1)} reach.`),
  undying: up('Undying', {}, () => 'You cannot drop below 1 HP while raging.'),
  frenzy: up('Frenzy', { perKill: 0.03, cap: 0.3, capPerRage: 0.04 }, (n) => `Each kill while raging adds +${pct(n.perKill)} damage for that rage (cap ${pct(n.cap)} +${pct(n.capPerRage)} per Rage).`),

  // ----- Angel / Heavenly Radiance (Grace) -----
  consecration: up('Consecration', { radius: 0.7, time: 5, dps: 14, heal: 3, healPerGrace: 0.3 }, (n) => `Leaves holy ground for ${n.time}s (${pct(n.radius)} of the radius) that burns enemies and heals you.`),
  guardianAngel: up('Guardian Angel', { time: 6, perGrace: 0.3, hp: 0.4 }, (n) => `For ${n.time}s +${n.perGrace}s per Grace after casting, death revives you at ${pct(n.hp)} HP instead.`),
  blindingLight: up('Blinding Light', { slow: 0.45, time: 3 }, (n) => `Radiance slows everything it hits by ${pct(1 - n.slow)} for ${n.time}s.`),
  twinPulse: up('Twin Pulse', { delay: 0.9, mult: 0.7 }, (n) => `A second pulse follows after ${n.delay}s for ${pct(n.mult)} damage.`),
  ascension: up('Ascension', { time: 4, perGrace: 0.15, bolts: 2 }, (n) => `For ${n.time}s +${n.perGrace}s per Grace after casting, you fire ${n.bolts + 1} bolts at once.`),
  benediction: up('Benediction', { refund: 0.06, cap: 0.6 }, (n) => `Every enemy Radiance slays refunds ${pct(n.refund)} of its cooldown (max ${pct(n.cap)}).`),

  // ----- Necromancer / Raise Dead (Soul Power) -----
  boneGolems: up('Bone Golems', { divisor: 2, hp: 4, damage: 2.4, scale: 5, radius: 18 }, (n) => `Raise half as many minions, but they are golems: ${n.hp}× HP, ${n.damage}× damage.`),
  volatileBones: up('Volatile Bones', { mult: 3, radius: 80 }, (n) => `Minions explode when they fall for ${n.mult}× their damage.`),
  graveChill: up('Grave Chill', { slow: 0.55, time: 1.5 }, (n) => `Minion hits slow enemies by ${pct(1 - n.slow)}.`),
  endlessLegion: up('Endless Legion', { free: 2 }, (n) => `Raise Dead needs no corpses for its first ${n.free} skeletons.`),
  boneArmor: up('Bone Armor', { armor: 0.06 }, (n) => `Each living minion grants you ${pct(n.armor)} armor.`),
  frenziedDead: up('Frenzied Dead', { mult: 1.4 }, (n) => `Minions attack ${pct(n.mult - 1)} faster.`),

  // ----- Archer / Arrow Volley (Focus) -----
  burningRain: up('Burning Rain', { time: 4, dps: 12, perFocus: 0.05 }, (n) => `The volley sets the ground ablaze for ${n.time}s (+${pct(n.perFocus)} burn per Focus).`),
  ballista: up('Ballista Shot', { mult: 0.55, speed: 950, radius: 16, range: 900 }, (n) => `The volley becomes one massive bolt that pierces everything: ${pct(n.mult)} of the whole volley's damage per enemy.`),
  pinning: up('Pinning Arrows', { slow: 0.5, time: 2.5 }, (n) => `Volley hits slow enemies by ${pct(1 - n.slow)} for ${n.time}s.`),
  quickDraw: up('Quick Draw', { atkSpd: 0.6, time: 4 }, (n) => `+${pct(n.atkSpd)} attack speed for ${n.time}s after the volley.`),
  doubleVolley: up('Double Volley', { delay: 0.8 }, (n) => `The volley fires a second time after ${n.delay}s.`),
  markedForDeath: up('Marked for Death', { mult: 1.3, time: 5 }, (n) => `Enemies hit by the volley take +${pct(n.mult - 1)} damage from everything for ${n.time}s.`),
};

export type AbilityUpgradeId = keyof typeof ABILITY_UPGRADES;
type Pair = [AbilityUpgradeId, AbilityUpgradeId];

/** Three tiers per class; within a tier the two options are mutually exclusive. */
export const ABILITY_TRACKS: Record<ClassId, [Pair, Pair, Pair]> = {
  paladin: [['mirrorShield', 'sanctuary'], ['judgement', 'zeal'], ['martyr', 'secondWind']],
  viking: [['dreadHowl', 'earthshaker'], ['bloodthirst', 'whirlwind'], ['undying', 'frenzy']],
  angel: [['consecration', 'guardianAngel'], ['blindingLight', 'twinPulse'], ['ascension', 'benediction']],
  necromancer: [['boneGolems', 'volatileBones'], ['graveChill', 'endlessLegion'], ['boneArmor', 'frenziedDead']],
  archer: [['burningRain', 'ballista'], ['pinning', 'quickDraw'], ['doubleVolley', 'markedForDeath']],
};
