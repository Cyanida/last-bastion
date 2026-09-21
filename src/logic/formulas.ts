import { GAME } from '../config/game';
import { WAVES } from '../config/waves';
import type { Rng, Stats } from '../core/types';
import { STAT_KEYS } from '../core/types';

/** Damage of an attack whose scaling stat has the given value. */
export function attackDamage(base: number, stat: number, bonusMult = 1): number {
  return base * (1 + stat * GAME.statDamageScale) * bonusMult;
}

export function critChance(dex: number): number {
  return Math.min(GAME.critCap, GAME.baseCrit + dex * GAME.critPerDex);
}

export function rollCrit(amount: number, dex: number, rng: Rng, bonusChance = 0): { amount: number; crit: boolean } {
  const crit = rng() < Math.min(GAME.critCap, critChance(dex) + bonusChance);
  return { amount: crit ? amount * GAME.critMult : amount, crit };
}

export function abilityCooldown(base: number, int: number): number {
  return Math.max(base * GAME.cdrFloor, base / (1 + int * GAME.cdrPerInt));
}

export function mitigate(amount: number, armor: number): number {
  return Math.max(1, amount * (1 - armor));
}

export function xpToNext(level: number): number {
  return Math.round(GAME.xpBase * Math.pow(level, GAME.xpExp));
}

export function enemyHpMult(wave: number): number {
  const w = wave - 1;
  return 1 + WAVES.hp.linear * w + WAVES.hp.quad * w * w;
}

export function enemyDmgMult(wave: number): number {
  const w = wave - 1;
  return 1 + WAVES.dmg.linear * w + WAVES.dmg.quad * w * w;
}

/** Per-level automatic growth. Returns a new stats object. */
export function applyGrowth(stats: Stats, growth: Stats): Stats {
  const out = { ...stats };
  for (const k of STAT_KEYS) out[k] += growth[k];
  return out;
}
