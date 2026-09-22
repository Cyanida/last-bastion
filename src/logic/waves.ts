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

/** Enemy count: Act I ramps it up, later Acts add only `lateGrowth` a wave (their difficulty comes from stats, then composition). */
export function enemyCount(wave: number): number {
  const c = WAVES.count;
  const w = Math.min(wave, 10);
  const n = Math.round(c.base + c.perWave * w + Math.pow(w, c.exp) + Math.max(0, wave - 10) * c.lateGrowth);
  return isBossWave(wave) ? Math.max(1, Math.round(n * WAVES.bossEscortFrac)) : n;
}

// ---- rules shared by this simple generator and the spawn director (logic/director.ts) ----

/** Non-boss waves from modifierFromWave on sometimes roll a modifier. Consumes rng only when eligible. */
export function rollModifier(wave: number, rng: Rng): ModifierId | null {
  if (isBossWave(wave) || wave < WAVES.modifierFromWave || rng() >= WAVES.modifierChance) return null;
  return MODIFIER_IDS[Math.floor(rng() * MODIFIER_IDS.length)];
}

/** Enemy types unlocked at this wave with their base weights (Siege multiplies the ranged ones). */
export function unlockedPool(wave: number, modifier: ModifierId | null): { weight: number; value: EnemyId }[] {
  return WAVES.pool
    .filter((p) => wave >= p.from)
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
