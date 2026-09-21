import type { EnemyId } from './enemies';

export type ModifierId = 'fog' | 'bloodMoon' | 'siege' | 'plague';

/** Wave composition and scaling. count(w) = base + perWave*w + w^exp */
export const WAVES = {
  count: { base: 5, perWave: 3, exp: 1.4 },
  hp: { linear: 0.1, quad: 0.01 }, // hpMult = 1 + linear*(w-1) + quad*(w-1)^2
  dmg: { linear: 0.05, quad: 0.004 }, // dmgMult = 1 + linear*(w-1) + quad*(w-1)^2: sustain builds must eventually lose
  spawn: { minDuration: 4, perEnemy: 0.2, maxDuration: 25 }, // seconds over which a wave trickles in
  breather: 3,
  overtime: 60, // seconds after the last spawn; then the next wave arrives anyway (never while a boss lives)
  firstWaveDelay: 1.5,
  bossEvery: 5,
  bossEscortFrac: 0.4, // boss waves get this fraction of the normal enemy count
  bosses: ['blackKnight', 'warlord', 'lich'] as EnemyId[],
  // first wave each type may appear in, and its spawn weight once unlocked
  pool: [
    { id: 'peasant', from: 1, weight: 10 },
    { id: 'wolf', from: 2, weight: 5 },
    { id: 'crossbow', from: 3, weight: 3 },
    { id: 'knight', from: 6, weight: 2 },
    { id: 'cultist', from: 7, weight: 2 },
    { id: 'shieldBearer', from: 8, weight: 2 },
    { id: 'priest', from: 9, weight: 1.5 },
    { id: 'cavalry', from: 11, weight: 2 },
    // v0.3 roster (hound masters and shieldwall spearmen only arrive in squads: config/director.ts)
    { id: 'assassin', from: 8, weight: 2 },
    { id: 'engineer', from: 9, weight: 1.5 },
    { id: 'plagueDoctor', from: 10, weight: 1.5 },
    { id: 'boneCollector', from: 11, weight: 1.5 },
    { id: 'mirrorKnight', from: 12, weight: 1.5 },
    { id: 'siegeTower', from: 14, weight: 0.6 },
  ] as { id: EnemyId; from: number; weight: number }[],
  // wave modifiers: rolled for non-boss waves, announced in the wave banner
  modifierFromWave: 6,
  modifierChance: 0.35,
  rangedTypes: ['crossbow'] as EnemyId[], // what Siege multiplies
};

export const MODIFIERS: Record<ModifierId, { name: string; desc: string; n: Record<string, number> }> = {
  fog: { name: 'Fog', desc: 'You can barely see past your sword arm.', n: { vision: 250 } },
  bloodMoon: { name: 'Blood Moon', desc: 'Enemies are faster, but carry more gold.', n: { speed: 1.25, gold: 1.6 } },
  siege: { name: 'Siege', desc: 'The enemy brings up the crossbows.', n: { rangedWeight: 7 } },
  plague: { name: 'Plague', desc: 'The slain leave poison pools.', n: { radius: 44, life: 4, dps: 10 } },
};
export const MODIFIER_IDS = Object.keys(MODIFIERS) as ModifierId[];
