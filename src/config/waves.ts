import type { EnemyId } from './enemies';

export type ModifierId = 'fog' | 'bloodMoon' | 'siege' | 'plague';

/** Wave composition and scaling. count(w) = base + perWave*w + w^exp */
export const WAVES = {
  // enemy count: Act I grows it (base + perWave*w + w^exp up to wave 10), later Acts add only `lateGrowth` per wave:
  // from Act II on, difficulty comes from stats and elites, then from composition and commanders, not from more bodies
  count: { base: 5, perWave: 3, exp: 1.4, lateGrowth: 1.2 },
  /**
   * HP and damage multipliers grow piecewise-linearly, with a different slope per Act (one scaling axis per Act, BALANCE.md):
   * Act I gentle (count does the work), Act II steep (stats and elites), Act III gentle again (composition does the work),
   * and beyond wave `beyondFrom` a quadratic term makes sure every run eventually ends.
   */
  hp: { slopes: [0.05, 0.11, 0.05] as number[], beyondFrom: 30, beyondQuad: 0.03 }, // v0.5: was 0.012; runs past the Dragon ran on to wave 45+ (BALANCE.md)
  dmg: { slopes: [0.03, 0.06, 0.03] as number[], beyondFrom: 30, beyondQuad: 0.012 }, // v0.5: was 0.005
  /**
   * v0.5: past wave `from` every heal (lifesteal, kills, relics, treasures, regen) is `perWave` weaker per wave, down to `floor`.
   * Sustain scales with the kill count, and late waves are huge: without this a sustain build never died (BALANCE.md).
   */
  healFalloff: { from: 30, perWave: 0.04, floor: 0.15 },
  /**
   * Enemy XP value = unit XP (which the director buys more of every wave: raw XP per wave grows about linearly, 60 at wave 5
   * to 330 at wave 35) x (1 + perWave*(w-1)) x actDecay^(act-1). The Act factor is what makes the pace slide from one level a
   * wave to one every two: without it a linear XP curve gives a flat pace. clearFrac: a cleared wave pays this share of the next level.
   */
  xp: { perWave: 0, actDecay: 0.55, clearFrac: 0.1 },
  /**
   * Target pace, levels per wave, per Act (Act III's value holds from then on). The level a player "should" have on a wave
   * comes from these; being below it earns a mild XP bonus (catch-up), never a penalty above it.
   */
  pace: { levelsPerWave: [1.0, 0.75, 0.55] as number[], catchUpPerLevel: 0.15, catchUpMax: 0.6 },
  spawn: { minDuration: 4, perEnemy: 0.2, maxDuration: 25 }, // seconds over which a wave trickles in
  breather: 3,
  /**
   * v0.5 pacing inside every Act of 10 waves: breathers are a lighter wave that always brings an event (config/events.ts),
   * the wave after one is heavier. Boss waves (x5, x0) are left alone. Positions are 1..10 within the Act.
   */
  pacing: { breather: [3, 8] as number[], heavy: [4, 9] as number[], breatherBudget: 0.55, heavyBudget: 1.2 },
  overtime: 60, // seconds after the last spawn; then the next wave arrives anyway (never while a boss lives)
  /**
   * v0.6: the tail of a wave. Once the spawns are done and at most `count` enemies are left, none of them elite or a boss, they get `grace`
   * seconds; then they come to you (straight at you, `speed` times faster) and siege structures give up the field. Nobody hunts stragglers.
   */
  stragglers: { count: 4, grace: 5, speed: 1.6 },
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
