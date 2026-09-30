import { ACTS } from '../config/acts';
import type { AffixId } from '../config/elites';
import type { EnemyId } from '../config/enemies';
import { MODIFIER_IDS, MODIFIERS, WAVES, type ModifierId } from '../config/waves';
import { clamp, pickWeighted } from '../core/math';
import type { Rng } from '../core/types';
import { eliteChance, rollAffixes } from './elites';
import { enemyDmgMult, enemyHpMult } from './formulas';

export interface WavePlan {
  wave: number;
  boss: EnemyId | null;
  spawns: EnemyId[]; // spawn order; the boss (if any) comes first
  elites: Record<number, AffixId[]>; // index into spawns -> affixes
  modifier: ModifierId | null;
  hpMult: number;
  dmgMult: number;
  spawnInterval: number;
}

export interface WaveOptions {
  bosses?: EnemyId[]; // the arena's boss rotation
  eliteMult?: number; // difficulty tier
}

export const isBossWave = (wave: number) => wave % WAVES.bossEvery === 0;

/**
 * v0.5 pacing (WAVES.pacing): a breather, a heavy wave, or neither, from the wave's place in its Act. Boss waves are never either.
 * `boss` (here and below): whether this wave is a boss wave; by default the 40-wave scale's (x5, x0). #243: a realm level has its own,
 * its last wave only (logic/world bossWaveIn).
 */
export function pacingOf(wave: number, boss = isBossWave(wave)): 'breather' | 'heavy' | null {
  const at = ((wave - 1) % ACTS.length) + 1;
  if (boss) return null;
  return WAVES.pacing.breather.includes(at) ? 'breather' : WAVES.pacing.heavy.includes(at) ? 'heavy' : null;
}

/** The director's budget multiplier for that pacing. */
export function pacingBudget(wave: number, boss = isBossWave(wave)): number {
  const pace = pacingOf(wave, boss);
  return pace === 'breather' ? WAVES.pacing.breatherBudget : pace === 'heavy' ? WAVES.pacing.heavyBudget : 1;
}

/** Enemy count: Act I ramps it up, later Acts add only `lateGrowth` a wave (their difficulty comes from stats, then composition). */
export function enemyCount(wave: number, boss = isBossWave(wave)): number {
  const c = WAVES.count;
  const w = Math.min(wave, ACTS.length);
  const n = Math.round(c.base + c.perWave * w + Math.pow(w, c.exp) + Math.max(0, wave - ACTS.length) * c.lateGrowth);
  return boss ? Math.max(1, Math.round(n * WAVES.bossEscortFrac)) : n;
}

// ---- rules shared by this simple generator and the spawn director (logic/director.ts) ----

/** Non-boss waves from modifierFromWave on sometimes roll a modifier. Consumes rng only when eligible. */
export function rollModifier(wave: number, rng: Rng, chanceMult = 1, from = WAVES.modifierFromWave, boss = isBossWave(wave)): ModifierId | null {
  if (boss || wave < from || rng() >= WAVES.modifierChance * chanceMult) return null;
  return MODIFIER_IDS[Math.floor(rng() * MODIFIER_IDS.length)];
}

/**
 * v0.8 (#101): whether this difficulty tier fields the type (WAVES.tierRoster). No tier: every type. #249: `fields`: types fielded on
 * every tier where the run is (a realm's own foes in its levels, config/world.ts `fields`).
 */
export function tierAllows(id: EnemyId, tier?: number, fields?: readonly EnemyId[]): boolean {
  if (tier === undefined || fields?.includes(id)) return true;
  const at = WAVES.tierRoster.findIndex((types) => types.includes(id));
  return at <= tier; // -1: in no list, so on every tier
}

/** Enemy types unlocked at this wave (and difficulty tier) with their base weights (Siege multiplies the ranged ones). */
export function unlockedPool(wave: number, modifier: ModifierId | null, tier?: number, fields?: readonly EnemyId[]): { weight: number; value: EnemyId }[] {
  return WAVES.pool
    .filter((p) => wave >= p.from && tierAllows(p.id, tier, fields))
    .map((p) => ({ weight: p.weight * (modifier === 'siege' && WAVES.rangedTypes.includes(p.id) ? MODIFIERS.siege.n.rangedWeight : 1), value: p.id }));
}

export function bossFor(wave: number, bosses: EnemyId[] = WAVES.bosses): EnemyId | null {
  return isBossWave(wave) ? bosses[(wave / WAVES.bossEvery - 1) % bosses.length] : null;
}

export function spawnIntervalFor(count: number, total: number): number {
  const s = WAVES.spawn;
  return clamp(count * s.perEnemy, s.minDuration, s.maxDuration) / Math.max(1, total);
}

/** The v0.2 generator: a flat weighted list. The game itself uses the director, which builds on the same rules. */
export function generateWave(wave: number, rng: Rng, opts: WaveOptions = {}): WavePlan {
  const modifier = rollModifier(wave, rng);
  const pool = unlockedPool(wave, modifier);
  const count = enemyCount(wave);
  const spawns: EnemyId[] = [];
  for (let i = 0; i < count; i++) spawns.push(pickWeighted(pool, rng));

  const boss = bossFor(wave, opts.bosses);
  if (boss) spawns.unshift(boss);

  const elites: Record<number, AffixId[]> = {};
  const chance = eliteChance(wave, opts.eliteMult ?? 1);
  if (chance > 0) {
    for (let i = boss ? 1 : 0; i < spawns.length; i++) if (rng() < chance) elites[i] = rollAffixes(wave, rng);
  }
  return { wave, boss, spawns, elites, modifier, hpMult: enemyHpMult(wave), dmgMult: enemyDmgMult(wave), spawnInterval: spawnIntervalFor(count, spawns.length) };
}
