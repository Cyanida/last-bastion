import type { AiProfile } from '../logic/fsm';
import type { EnemyId } from './enemies';

/**
 * Per-type AI profiles: how each enemy moves between the states of logic/fsm.ts.
 * Bosses are scripted (systems/enemyAI.ts BOSSES) and have no profile. Anything missing here fights as DEFAULT_AI.
 */
export const DEFAULT_AI: AiProfile = { reach: 'melee', flank: 0.3 };

export const AI: Partial<Record<EnemyId, AiProfile>> = {
  // the levy: circles round to get at you, and runs for the nearest priest when it is going badly
  peasant: { reach: 'melee', flank: 0.65, fleeBelow: 0.3, fleeToHealer: true },
  // pack hunter: always comes from the side, leaps, backs off, comes again
  wolf: { reach: 'melee', flank: 0.95, special: { id: 'lunge', cd: 2.2, range: 130, minRange: 30 }, retreatAfterSpecial: 0.7 },
  // keeps its distance, sidesteps after every bolt, retreats to a healer when hurt
  crossbow: { reach: 'ranged', flank: 0, range: [170, 300], strafe: true, fleeBelow: 0.35, fleeToHealer: true },
  // walks straight at you. Armor does the thinking.
  knight: { reach: 'melee', flank: 0.15 },
  cultist: { reach: 'melee', flank: 0.35, special: { id: 'fuse', cd: 0, range: 51 } },
  // never turns its shield away from you
  shieldBearer: { reach: 'melee', flank: 0 },
  priest: { reach: 'support', flank: 0, range: [210, 330], special: { id: 'heal', cd: 2.5, range: 9999 }, fleeBelow: 0.4 },
  // rides a long telegraphed charge, wheels away, charges again
  cavalry: { reach: 'melee', flank: 0.5, special: { id: 'lunge', cd: 3.5, range: 380, minRange: 110 }, retreatAfterSpecial: 1.3 },
  // v0.3 roster
  engineer: { reach: 'support', flank: 0, range: [260, 380], special: { id: 'build', cd: 12, range: 460 }, fleeBelow: 0.5 },
  ballista: { reach: 'ranged', flank: 0, range: [0, 9999] }, // bolted to the ground: it just shoots
  plagueDoctor: { reach: 'support', flank: 0, range: [220, 340], special: { id: 'plague', cd: 5, range: 400 } },
  houndmaster: { reach: 'support', flank: 0, range: [240, 340], special: { id: 'whistle', cd: 6, range: 9999 } },
  mirrorKnight: { reach: 'melee', flank: 0.1 },
  siegeTower: { reach: 'support', flank: 0, range: [200, 270], special: { id: 'deploy', cd: 6, range: 9999 } },
  assassin: { reach: 'melee', flank: 1, special: { id: 'ambush', cd: 7, range: 520, minRange: 110 }, retreatAfterSpecial: 1.6, fleeBelow: 0.3 },
  shieldwall: { reach: 'melee', flank: 0 },
  boneCollector: { reach: 'melee', flank: 0.2, special: { id: 'collect', cd: 1.5, range: 9999 } },
  bannerman: { reach: 'support', flank: 0, range: [200, 300] },
  drummer: { reach: 'support', flank: 0, range: [220, 320] },
  chaplain: { reach: 'support', flank: 0, range: [230, 340] },
  // v0.5 side content: they hold their ground (the cart is moved by its event)
  siegeCamp: { reach: 'support', flank: 0, range: [0, 9999], special: { id: 'muster', cd: 12, range: 650 } }, // musters only when you come near
  plagueCart: { reach: 'support', flank: 0, range: [0, 9999] },
  royalFlame: { reach: 'support', flank: 0, range: [0, 9999] }, // v0.6: stands and burns (the Usurper's script makes it flare)
};

/** Shared movement numbers for the states. */
export const AI_TUNING = {
  thinkEvery: 0.4, // seconds between the more expensive checks (crowding, nearest healer)
  crowdProbe: 46, // how far ahead it looks for friends in the way
  crowdRadius: 30,
  crowdCount: 2,
  flankAngle: 1.0, // radians it swings round the target while flanking
  strafeTime: 0.7,
  fleeCooldown: 8,
  fleeSpeed: 1.15,
  regroupSpeed: 1.2, // catching up with the formation
  healerSearch: 600,
};

/** What a squad does when its commander falls (EnemyDef.onDeath). fear > 0: they run; otherwise a rage buff. */
export const SQUAD_REACTIONS = {
  enrage: { fear: 0, damage: 1.4, speed: 1.25, time: 7, text: 'ENRAGED' },
  scatter: { fear: 2.5, damage: 1, speed: 1, time: 0, text: 'scattered' },
  flee: { fear: 4.5, damage: 1, speed: 1, time: 0, text: 'routed' },
};

/** Commander auras pulse this often; a buff outlives one missed pulse. */
export const AURA_PULSE = { every: 0.25, lasts: 0.6 };
