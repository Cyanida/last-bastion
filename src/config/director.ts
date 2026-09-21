import type { Formation } from '../logic/squads';
import type { ClassId } from './classes';
import type { EnemyId } from './enemies';
import type { ModifierId } from './waves';

/**
 * The spawn director buys each wave from a budget. An enemy costs its XP value.
 * budget(wave) = enemyCount(wave) * costPerHead(wave), so early waves match v0.2 and later waves trade
 * some bodies for nastier ones.
 */
export const DIRECTOR = {
  costPerHead: { base: 1.3, perWave: 0.07, max: 3.4 },
  maxUnits: 320, // hard cap for performance
  squads: { fromWave: 4, chance: 0.55, perWave: 0.03, maxShare: 0.45, maxPerWave: 4 },
  // mild rubber band on the player's recent performance (-1 struggling .. +1 cruising)
  rubberBand: { eliteBonus: 0.6, budgetCut: 0.15, smoothing: 0.5, fastClear: 0.7 },
};

export type Bias = Partial<Record<EnemyId, number>>;

/** What each class is weak to shows up more often against it. */
export const CLASS_BIAS: Record<ClassId, Bias> = {
  paladin: { crossbow: 1.6, engineer: 1.8, plagueDoctor: 1.5, priest: 1.4 }, // things that will not come to him
  viking: { crossbow: 1.4, shieldwall: 1.6, cavalry: 1.3, plagueDoctor: 1.3 },
  angel: { wolf: 1.5, assassin: 1.8, cavalry: 1.4, mirrorKnight: 1.6 },
  necromancer: { cultist: 1.9, boneCollector: 2.5, plagueDoctor: 1.6, cavalry: 1.4 }, // anti-minion: blasts, tramplers, corpse thieves
  archer: { shieldBearer: 2.2, wolf: 1.7, assassin: 1.9, mirrorKnight: 2, cavalry: 1.5, shieldwall: 1.8 }, // shields and fast flankers
};

export const MODIFIER_BIAS: Record<ModifierId, Bias> = {
  fog: { assassin: 2, wolf: 1.5 },
  bloodMoon: { wolf: 1.6, cavalry: 1.6 },
  siege: { engineer: 3, siegeTower: 3 }, // crossbows are multiplied by WAVES.rangedTypes already
  plague: { plagueDoctor: 3, cultist: 1.5, boneCollector: 1.5 },
};

export interface SquadTemplate {
  id: string;
  from: number; // first wave
  weight: number;
  formation: Formation;
  spacing: number;
  commander: EnemyId | null;
  members: [EnemyId, number][];
  holdUntil: number; // the squad marches in formation until it is this close to its target
}

export const SQUADS: SquadTemplate[] = [
  { id: 'levy', from: 4, weight: 5, formation: 'line', spacing: 34, commander: 'bannerman', members: [['peasant', 6]], holdUntil: 260 },
  { id: 'huntingPack', from: 5, weight: 4, formation: 'wedge', spacing: 30, commander: null, members: [['wolf', 5]], holdUntil: 320 },
  { id: 'warband', from: 6, weight: 4, formation: 'wedge', spacing: 36, commander: 'drummer', members: [['peasant', 4], ['knight', 1]], holdUntil: 280 },
  { id: 'firingLine', from: 7, weight: 3, formation: 'line', spacing: 40, commander: 'bannerman', members: [['crossbow', 5]], holdUntil: 360 },
  { id: 'procession', from: 8, weight: 3, formation: 'circle', spacing: 44, commander: 'chaplain', members: [['cultist', 3], ['shieldBearer', 2]], holdUntil: 240 },
  { id: 'shieldwall', from: 9, weight: 3, formation: 'line', spacing: 30, commander: 'drummer', members: [['shieldwall', 5]], holdUntil: 70 },
  { id: 'kennel', from: 10, weight: 3, formation: 'circle', spacing: 46, commander: 'houndmaster', members: [['wolf', 4]], holdUntil: 300 },
  { id: 'lances', from: 12, weight: 2, formation: 'wedge', spacing: 48, commander: 'bannerman', members: [['cavalry', 3]], holdUntil: 420 },
  { id: 'crusade', from: 13, weight: 2, formation: 'line', spacing: 38, commander: 'chaplain', members: [['knight', 3], ['mirrorKnight', 1]], holdUntil: 240 },
];
