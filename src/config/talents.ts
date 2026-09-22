import type { Mods, StatKey } from '../core/types';
import type { ClassId } from './classes';
import { TREASURES, type TreasureId } from './treasures';

/**
 * Talent trees: three branches per class, seven nodes each in four rows. A node needs one of `requires` taken first;
 * the keystone (row 3) needs `TALENTS.keystonePoints` points in its branch and no other keystone. Every node is data:
 * plain mods (folded into p.mods every tick), flat stat adds (applied when taken), or numbers other systems read
 * through talentN(). A point every `levelsPerPoint` levels, spendable any time from the pause menu.
 */
export const TALENTS = {
  levelsPerPoint: 3,
  keystonePoints: 4,
  rows: 4,
};

export interface TalentNode {
  id: string;
  classId: ClassId;
  branch: string;
  row: number; // 0..3, the keystone is row 3
  name: string;
  desc: string;
  requires: string[]; // any one of these taken
  keystone?: boolean;
  mods?: Partial<Mods>;
  stats?: Partial<Record<StatKey, number>>; // flat adds
  n?: Record<string, number>; // read by systems: talentN(g, key)
  treasure?: TreasureId; // v0.5: a hidden node, shown and takeable only while this sacred treasure is equipped
}

export interface BranchDef {
  id: string;
  name: string;
  desc: string;
}

type NodeSpec = { name: string; desc: string; mods?: Partial<Mods>; stats?: Partial<Record<StatKey, number>>; n?: Record<string, number> };

/** Seven nodes per branch in the fixed shape 2-2-2-1: [a0, a1] need nothing, [b0, b1] need a0/a1, [c0, c1] need b0/b1, k (the keystone) needs c0/c1. */
function branch(classId: ClassId, id: string, name: string, desc: string, nodes: [NodeSpec, NodeSpec, NodeSpec, NodeSpec, NodeSpec, NodeSpec, NodeSpec]): { def: BranchDef; nodes: TalentNode[] } {
  const key = (i: number) => `${classId}.${id}.${i}`;
  const rowOf = [0, 0, 1, 1, 2, 2, 3];
  const reqOf = (i: number): string[] => (i < 2 ? [] : i < 4 ? [key(0), key(1)] : i < 6 ? [key(2), key(3)] : [key(4), key(5)]);
  return {
    def: { id: `${classId}.${id}`, name, desc },
    nodes: nodes.map((n, i) => ({ id: key(i), classId, branch: `${classId}.${id}`, row: rowOf[i], requires: reqOf(i), keystone: i === 6 || undefined, ...n })),
  };
}

const TREES = {
  paladin: [
    branch('paladin', 'bulwark', 'Bulwark', 'Take the hits, and give them back.', [
      { name: 'Plated', desc: '+6% armor.', mods: { armor: 0.06 } },
      { name: 'Vigor', desc: '+30 max HP.', stats: { hp: 30 } },
      { name: 'Thorned Aegis', desc: 'Enemies that hurt you take 50% of it back.', mods: { thorns: 0.5 } },
      { name: 'Mending', desc: '+1.5 HP regeneration a second.', mods: { regen: 1.5 } },
      { name: 'Unbreakable', desc: 'Divine Shield lasts 25% longer.', mods: { abilityDur: 1.25 } },
      { name: 'Steadfast', desc: '+8% armor and +20 max HP.', mods: { armor: 0.08 }, stats: { hp: 20 } },
      { name: 'Aegis of the Faithful', desc: 'Keystone: thorns 150%, +10% armor, Divine Shield lasts half again as long.', mods: { thorns: 1.5, armor: 0.1, abilityDur: 1.5 } },
    ]),
    branch('paladin', 'zealot', 'Zealot', 'Fight harder the closer you are to death.', [
      { name: 'Fervor', desc: '+8% attack speed.', mods: { atkSpd: 1.08 } },
      { name: 'Smite', desc: '+3 Strength.', stats: { str: 3 } },
      { name: 'Martyrdom', desc: '+25% damage below half HP.', mods: { lowHpDamage: 0.25 } },
      { name: 'Blood of Saints', desc: 'Every kill heals 1 HP.', mods: { onKillHeal: 1 } },
      { name: 'Righteous Fury', desc: '+12% damage.', mods: { damage: 1.12 } },
      { name: 'Zeal', desc: '+12% attack speed and +2 Faith.', mods: { atkSpd: 1.12 }, stats: { secondary: 2 } },
      { name: 'Wrath of Heaven', desc: 'Keystone: +50% damage below half HP, +20% attack speed, kills heal 2 more HP.', mods: { lowHpDamage: 0.5, atkSpd: 1.2, onKillHeal: 2 } },
    ]),
    branch('paladin', 'crusader', 'Crusader', 'Bring the fight to the enemy.', [
      { name: 'March', desc: '+8% movement speed.', mods: { moveSpd: 1.08 } },
      { name: 'Devotion', desc: '+2 Faith.', stats: { secondary: 2 } },
      { name: 'Giant Slayer', desc: '+20% damage to bosses.', mods: { bossDamage: 1.2 } },
      { name: 'Quick Prayers', desc: 'Divine Shield recharges 15% faster.', mods: { abilityCd: 0.85 } },
      { name: 'Challenger', desc: 'Challenge recharges 25% faster and pulls harder.', mods: { utilityCd: 0.75, utilityPower: 1.25 } },
      { name: 'Vanguard', desc: '+10% damage and +8% movement speed.', mods: { damage: 1.1, moveSpd: 1.08 } },
      { name: 'Crusade', desc: 'Keystone: +50% damage to bosses, Divine Shield recharges 30% faster, +10% movement speed.', mods: { bossDamage: 1.5, abilityCd: 0.7, moveSpd: 1.1 } },
    ]),
  ],
  viking: [
    branch('viking', 'berserk', 'Berserk', 'Rage, and keep raging.', [
      { name: 'Frenzy', desc: '+8% attack speed.', mods: { atkSpd: 1.08 } },
      { name: 'Brawn', desc: '+3 Strength.', stats: { str: 3 } },
      { name: 'Blood Rage', desc: '+25% damage below half HP.', mods: { lowHpDamage: 0.25 } },
      { name: 'Long Rage', desc: 'Berserker Rage lasts 25% longer.', mods: { abilityDur: 1.25 } },
      { name: 'Savagery', desc: '+15% crit damage.', mods: { critDamage: 0.15 } },
      { name: 'Unending', desc: 'Berserker Rage recharges 20% faster.', mods: { abilityCd: 0.8 } },
      { name: 'Wrath Unbound', desc: 'Keystone: +50% damage below half HP, Rage lasts half again as long, +25% crit damage.', mods: { lowHpDamage: 0.5, abilityDur: 1.5, critDamage: 0.25 } },
    ]),
    branch('viking', 'raider', 'Raider', 'Fast, greedy, hard to pin down.', [
      { name: 'Fleet', desc: '+8% movement speed.', mods: { moveSpd: 1.08 } },
      { name: 'Plunder', desc: '+15% gold found.', mods: { gold: 1.15 } },
      { name: 'Sidestep', desc: '8% chance to dodge a hit.', mods: { dodge: 0.08 } },
      { name: 'Leaper', desc: 'Leap recharges 25% faster and hits harder.', mods: { utilityCd: 0.75, utilityPower: 1.25 } },
      { name: 'Reaver', desc: 'Every kill heals 1 HP.', mods: { onKillHeal: 1 } },
      { name: 'Sea Legs', desc: '+10% movement speed and +8% dodge.', mods: { moveSpd: 1.1, dodge: 0.08 } },
      { name: 'Raid Leader', desc: 'Keystone: +15% dodge, +30% gold, kills heal 2 more HP.', mods: { dodge: 0.15, gold: 1.3, onKillHeal: 2 } },
    ]),
    branch('viking', 'jarl', 'Jarl', 'Stand like a wall of shields.', [
      { name: 'Hardy', desc: '+30 max HP.', stats: { hp: 30 } },
      { name: 'Shield Arm', desc: '+6% armor.', mods: { armor: 0.06 } },
      { name: 'Thick Hide', desc: '+1.5 HP regeneration a second.', mods: { regen: 1.5 } },
      { name: 'Spite', desc: 'Enemies that hurt you take 50% of it back.', mods: { thorns: 0.5 } },
      { name: 'Giant Slayer', desc: '+20% damage to bosses.', mods: { bossDamage: 1.2 } },
      { name: 'Iron Jarl', desc: '+8% armor and +2 Rage.', mods: { armor: 0.08 }, stats: { secondary: 2 } },
      { name: 'Hall of the Slain', desc: 'Keystone: +60 max HP, +10% armor, +40% damage to bosses.', stats: { hp: 60 }, mods: { armor: 0.1, bossDamage: 1.4 } },
    ]),
  ],
  angel: [
    branch('angel', 'mercy', 'Mercy', 'Heal, endure, outlast.', [
      { name: 'Grace', desc: '+2 Grace.', stats: { secondary: 2 } },
      { name: 'Serenity', desc: '+1.5 HP regeneration a second.', mods: { regen: 1.5 } },
      { name: 'Vigil', desc: '+30 max HP.', stats: { hp: 30 } },
      { name: 'Renewal', desc: 'Every kill heals 1 HP.', mods: { onKillHeal: 1 } },
      { name: 'Sanctuary', desc: 'Heavenly Radiance recharges 20% faster.', mods: { abilityCd: 0.8 } },
      { name: 'Benediction', desc: '+3 Grace and +6% armor.', stats: { secondary: 3 }, mods: { armor: 0.06 } },
      { name: 'Font of Life', desc: 'Keystone: +3 HP regeneration a second, kills heal 2 more HP, Radiance recharges 30% faster.', mods: { regen: 3, onKillHeal: 2, abilityCd: 0.7 } },
    ]),
    branch('angel', 'wrath', 'Wrath', 'Light that burns.', [
      { name: 'Radiant', desc: '+3 Intelligence.', stats: { int: 3 } },
      { name: 'Searing', desc: '+10% damage.', mods: { damage: 1.1 } },
      { name: 'Judgement', desc: '+20% damage to bosses.', mods: { bossDamage: 1.2 } },
      { name: 'Keen Light', desc: '+8% crit chance.', mods: { crit: 0.08 } },
      { name: 'Piercing Light', desc: 'Bolts pierce one more enemy.', mods: { pierce: 1 } },
      { name: 'Consuming Fire', desc: '+12% damage and +15% crit damage.', mods: { damage: 1.12, critDamage: 0.15 } },
      { name: 'Avenging Angel', desc: 'Keystone: +25% damage, +40% damage to bosses, bolts pierce two more.', mods: { damage: 1.25, bossDamage: 1.4, pierce: 2 } },
    ]),
    branch('angel', 'herald', 'Herald', 'Never where the blow lands.', [
      { name: 'Swift Wings', desc: '+8% movement speed.', mods: { moveSpd: 1.08 } },
      { name: 'Foresight', desc: '8% chance to dodge a hit.', mods: { dodge: 0.08 } },
      { name: 'Far Blink', desc: 'Blink recharges 25% faster.', mods: { utilityCd: 0.75 } },
      { name: 'Quickened', desc: '+10% attack speed.', mods: { atkSpd: 1.1 } },
      { name: 'Untouchable', desc: '+8% dodge and +8% movement speed.', mods: { dodge: 0.08, moveSpd: 1.08 } },
      { name: 'Herald of Dawn', desc: 'Heavenly Radiance lasts 25% longer.', mods: { abilityDur: 1.25 } },
      { name: 'Wings of the Morning', desc: 'Keystone: +15% dodge, +15% movement and attack speed, Blink recharges 40% faster.', mods: { dodge: 0.15, moveSpd: 1.15, atkSpd: 1.15, utilityCd: 0.6 } },
    ]),
  ],
  necromancer: [
    branch('necromancer', 'horde', 'Horde', 'More of them, and faster.', [
      { name: 'Grave Call', desc: '+1 minion.', mods: { minionMax: 1 } },
      { name: 'Soul Power', desc: '+2 Soul Power.', stats: { secondary: 2 } },
      { name: 'Restless Dead', desc: 'Minions attack 15% faster.', mods: { minionAtkSpd: 1.15 } },
      { name: 'Mass Grave', desc: '+1 minion.', mods: { minionMax: 1 } },
      { name: 'Sharpened Bones', desc: 'Minions deal 20% more damage.', mods: { minionDamage: 1.2 } },
      { name: 'Deathless March', desc: 'Raise Dead recharges 20% faster.', mods: { abilityCd: 0.8 } },
      { name: 'Legion', desc: 'Keystone: +3 minions, minions deal 30% more damage and attack 20% faster.', mods: { minionMax: 3, minionDamage: 1.3, minionAtkSpd: 1.2 } },
    ]),
    branch('necromancer', 'lich', 'Lich', 'Power for the master himself.', [
      { name: 'Dark Study', desc: '+3 Intelligence.', stats: { int: 3 } },
      { name: 'Withering', desc: '+10% damage.', mods: { damage: 1.1 } },
      { name: 'Phylactery', desc: '+30 max HP.', stats: { hp: 30 } },
      { name: 'Drain', desc: 'Every kill heals 1 HP.', mods: { onKillHeal: 1 } },
      { name: 'Bone Armor', desc: '+8% armor.', mods: { armor: 0.08 } },
      { name: 'Necrotic Bolt', desc: '+12% damage and +8% crit chance.', mods: { damage: 1.12, crit: 0.08 } },
      { name: 'Lichdom', desc: 'Keystone: +25% damage, +10% armor, kills heal 2 more HP.', mods: { damage: 1.25, armor: 0.1, onKillHeal: 2 } },
    ]),
    branch('necromancer', 'plague', 'Plague', 'Corpses are a weapon.', [
      { name: 'Miasma', desc: 'Corpse Explosion recharges 25% faster.', mods: { utilityCd: 0.75 } },
      { name: 'Rot', desc: '+2 Soul Power.', stats: { secondary: 2 } },
      { name: 'Detonation', desc: 'Corpse Explosion deals 30% more damage.', mods: { utilityPower: 1.3 } },
      { name: 'Pale Rider', desc: '+8% movement speed.', mods: { moveSpd: 1.08 } },
      { name: 'Carrion', desc: '+15% gold and +15% XP.', mods: { gold: 1.15, xp: 1.15 } },
      { name: 'Grave Tide', desc: '+1 minion and Corpse Explosion recharges 15% faster.', mods: { minionMax: 1, utilityCd: 0.85 } },
      { name: 'Black Death', desc: 'Keystone: Corpse Explosion deals 60% more damage and recharges 40% faster, +20% damage.', mods: { utilityPower: 1.6, utilityCd: 0.6, damage: 1.2 } },
    ]),
  ],
  archer: [
    branch('archer', 'ranger', 'Ranger', 'Fast on foot, hard to catch.', [
      { name: 'Fleet Foot', desc: '+8% movement speed.', mods: { moveSpd: 1.08 } },
      { name: 'Forager', desc: '+15% gold found.', mods: { gold: 1.15 } },
      { name: 'Evasion', desc: '8% chance to dodge a hit.', mods: { dodge: 0.08 } },
      { name: 'Tumbler', desc: 'Dodge Roll recharges 25% faster.', mods: { utilityCd: 0.75 } },
      { name: 'Second Wind', desc: '+1.5 HP regeneration a second.', mods: { regen: 1.5 } },
      { name: 'Wild Runner', desc: '+10% movement speed and +8% dodge.', mods: { moveSpd: 1.1, dodge: 0.08 } },
      { name: 'Lord of the Wild', desc: 'Keystone: +15% dodge, +15% movement speed, Dodge Roll recharges 40% faster and its caltrops hurt 50% more.', mods: { dodge: 0.15, moveSpd: 1.15, utilityCd: 0.6, utilityPower: 1.5 } },
    ]),
    branch('archer', 'hunter', 'Hunter', 'One arrow, one kill.', [
      { name: 'Keen Eye', desc: '+3 Dexterity.', stats: { dex: 3 } },
      { name: 'Deadly Aim', desc: '+8% crit chance.', mods: { crit: 0.08 } },
      { name: 'Headshot', desc: '+20% crit damage.', mods: { critDamage: 0.2 } },
      { name: 'Big Game', desc: '+20% damage to bosses.', mods: { bossDamage: 1.2 } },
      { name: 'Focus', desc: '+2 Focus.', stats: { secondary: 2 } },
      { name: 'Trophy Hunter', desc: '+12% damage and kills heal 1 HP.', mods: { damage: 1.12, onKillHeal: 1 } },
      { name: 'Apex Predator', desc: 'Keystone: +15% crit chance, +50% crit damage, +40% damage to bosses.', mods: { crit: 0.15, critDamage: 0.5, bossDamage: 1.4 } },
    ]),
    branch('archer', 'marksman', 'Marksman', 'Volume of fire.', [
      { name: 'Quick Nock', desc: '+8% attack speed.', mods: { atkSpd: 1.08 } },
      { name: 'Bodkin', desc: 'Arrows pierce one more enemy.', mods: { pierce: 1 } },
      { name: 'Rapid Fire', desc: '+10% attack speed.', mods: { atkSpd: 1.1 } },
      { name: 'Rain of Arrows', desc: 'Arrow Volley recharges 20% faster.', mods: { abilityCd: 0.8 } },
      { name: 'Heavy Draw', desc: '+12% damage.', mods: { damage: 1.12 } },
      { name: 'Long Volley', desc: 'Arrow Volley lasts 25% longer and +2 Focus.', mods: { abilityDur: 1.25 }, stats: { secondary: 2 } },
      { name: 'Storm of Arrows', desc: 'Keystone: +25% attack speed, arrows pierce two more, Arrow Volley recharges 30% faster.', mods: { atkSpd: 1.25, pierce: 2, abilityCd: 0.7 } },
    ]),
  ],
};

/** v0.5: one hidden node per class (config/treasures.ts), in the branch that fits its treasure, on the first row with no prerequisite. */
export const HIDDEN_TALENTS: TalentNode[] = (Object.keys(TREASURES) as ClassId[]).map((classId) => {
  const t = TREASURES[classId];
  return { id: `${classId}.treasure`, classId, row: 0, requires: [], treasure: t.id, ...t.talent };
});

export const TALENT_BRANCHES: Record<ClassId, BranchDef[]> = Object.fromEntries(Object.entries(TREES).map(([c, bs]) => [c, bs.map((b) => b.def)])) as Record<ClassId, BranchDef[]>;
export const TALENT_NODES: TalentNode[] = Object.values(TREES).flatMap((bs) => bs.flatMap((b) => b.nodes));
export const TALENT_BY_ID: Record<string, TalentNode> = Object.fromEntries([...TALENT_NODES, ...HIDDEN_TALENTS].map((n) => [n.id, n]));
/** A class's tree; `treasure`: with the hidden node of that treasure, when it is the one equipped. */
export const talentsFor = (classId: ClassId, treasure?: TreasureId | null): TalentNode[] => [...TALENT_NODES, ...HIDDEN_TALENTS].filter((n) => n.classId === classId && (!n.treasure || n.treasure === treasure));
