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

/** v0.7.3 (#53): what is left of the signature ability's minimum downtime (g.vars['ability.readyAt']): refunds cannot cut the cooldown below it. */
export const cooldownFloor = (g: { vars: Record<string, number>; time: number }): number => Math.max(0, (g.vars['ability.readyAt'] ?? 0) - g.time);

export function abilityCooldown(base: number, int: number): number {
  return Math.max(base * GAME.cdrFloor, base / (1 + int * GAME.cdrPerInt));
}

export function mitigate(amount: number, armor: number): number {
  return Math.max(1, amount * (1 - armor));
}

/** XP to go from `level` to the next: almost linear, so the pace of level-ups holds up all run long (v0.4). */
export function xpToNext(level: number): number {
  return Math.round(GAME.xpBase + GAME.xpPerLevel * level);
}

const ACT_LENGTH = 10;
const actIndex = (wave: number) => Math.max(0, Math.ceil(wave / ACT_LENGTH) - 1);

/** The level a player is expected to have at the start of `wave`, from the target pace per Act. */
export function expectedLevel(wave: number): number {
  const pace = WAVES.pace.levelsPerWave;
  let level = 1;
  for (let w = 1; w < wave; w++) level += pace[Math.min(pace.length - 1, actIndex(w))];
  return level;
}

/** Catch-up: XP multiplier for a player `level` on `wave`. 1 at or above the expected level, mildly more below it. */
export function catchUpMult(level: number, wave: number): number {
  const behind = Math.floor(expectedLevel(wave) - level);
  return behind <= 0 ? 1 : 1 + Math.min(WAVES.pace.catchUpMax, behind * WAVES.pace.catchUpPerLevel);
}

/** Enemy XP value multiplier: grows per wave and jumps per Act, so leveling keeps pace with the enemy curve. */
export function enemyXpMult(wave: number): number {
  return (1 + WAVES.xp.perWave * (wave - 1)) * Math.pow(WAVES.xp.actDecay, actIndex(wave));
}

/** Wave-clear XP: a share of what the next level costs at the expected pace. */
export function waveClearXp(wave: number): number {
  return Math.round(xpToNext(Math.round(expectedLevel(wave))) * WAVES.xp.clearFrac);
}

/** Piecewise-linear growth with one slope per Act, plus a quadratic tail beyond `beyondFrom` so runs do end. */
function actScaled(wave: number, c: { slopes: number[]; beyondFrom: number; beyondQuad: number }): number {
  let mult = 1;
  for (let w = 2; w <= wave; w++) mult += c.slopes[Math.min(c.slopes.length - 1, actIndex(w))];
  const over = Math.max(0, wave - c.beyondFrom);
  return mult + c.beyondQuad * over * over;
}

export const enemyHpMult = (wave: number): number => actScaled(wave, WAVES.hp);

/** v0.5: how much of any heal still lands on this wave (1 until WAVES.healFalloff.from, then less each wave, never below the floor). */
export function healFactor(wave: number): number {
  const f = WAVES.healFalloff;
  return Math.max(f.floor, 1 - Math.max(0, wave - f.from) * f.perWave);
}
export const enemyDmgMult = (wave: number): number => actScaled(wave, WAVES.dmg);

/** Per-level automatic growth. Returns a new stats object. */
export function applyGrowth(stats: Stats, growth: Stats): Stats {
  const out = { ...stats };
  for (const k of STAT_KEYS) out[k] += growth[k];
  return out;
}
