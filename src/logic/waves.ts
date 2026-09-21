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

export function enemyCount(wave: number): number {
  const c = WAVES.count;
  const n = Math.round(c.base + c.perWave * wave + Math.pow(wave, c.exp));
  return isBossWave(wave) ? Math.max(1, Math.round(n * WAVES.bossEscortFrac)) : n;
}

export function generateWave(wave: number, rng: Rng, opts: WaveOptions = {}): WavePlan {
  const bossWave = isBossWave(wave);
  const modifier = !bossWave && wave >= WAVES.modifierFromWave && rng() < WAVES.modifierChance ? MODIFIER_IDS[Math.floor(rng() * MODIFIER_IDS.length)] : null;

  const pool = WAVES.pool
    .filter((p) => wave >= p.from)
    .map((p) => ({ weight: p.weight * (modifier === 'siege' && WAVES.rangedTypes.includes(p.id) ? MODIFIERS.siege.n.rangedWeight : 1), value: p.id }));
  const count = enemyCount(wave);
  const spawns: EnemyId[] = [];
  for (let i = 0; i < count; i++) spawns.push(pickWeighted(pool, rng));

  let boss: EnemyId | null = null;
  if (bossWave) {
    const bosses = opts.bosses ?? WAVES.bosses;
    boss = bosses[(wave / WAVES.bossEvery - 1) % bosses.length];
    spawns.unshift(boss);
  }

  const elites: Record<number, AffixId[]> = {};
  const chance = eliteChance(wave, opts.eliteMult ?? 1);
  if (chance > 0) {
    for (let i = boss ? 1 : 0; i < spawns.length; i++) if (rng() < chance) elites[i] = rollAffixes(wave, rng);
  }

  const s = WAVES.spawn;
  const duration = clamp(count * s.perEnemy, s.minDuration, s.maxDuration);
  return { wave, boss, spawns, elites, modifier, hpMult: enemyHpMult(wave), dmgMult: enemyDmgMult(wave), spawnInterval: duration / spawns.length };
}
