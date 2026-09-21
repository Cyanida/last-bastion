import { AFFIX_IDS, AFFIXES, ELITES, type AffixId } from '../config/elites';
import type { Rng } from '../core/types';

export function eliteChance(wave: number, tierMult: number): number {
  if (wave < ELITES.fromWave) return 0;
  return Math.min(ELITES.maxChance, (ELITES.baseChance + ELITES.perWave * (wave - ELITES.fromWave)) * tierMult);
}

/** One affix, or two from twoAffixFromWave on (with twoAffixChance). Never the same affix twice. */
export function rollAffixes(wave: number, rng: Rng): AffixId[] {
  const pool = [...AFFIX_IDS];
  const count = wave >= ELITES.twoAffixFromWave && rng() < ELITES.twoAffixChance ? 2 : 1;
  const out: AffixId[] = [];
  for (let i = 0; i < count; i++) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return out;
}

export interface EliteStats {
  hp: number;
  damage: number;
  speed: number;
  radius: number;
  xp: number;
  shield: number;
}

/** Base stats (already wave-scaled) -> elite stats with its affixes applied. Conditional affixes (Enraged) act at runtime. */
export function applyAffixes(base: { hp: number; damage: number; speed: number; radius: number; xp: number }, affixes: AffixId[]): EliteStats {
  const hp = Math.round(base.hp * ELITES.hpMult);
  return {
    hp,
    damage: base.damage * ELITES.dmgMult,
    speed: base.speed * (affixes.includes('swift') ? AFFIXES.swift.n.speed : 1),
    radius: base.radius * ELITES.radiusMult,
    xp: base.xp * ELITES.xpMult,
    shield: affixes.includes('shielded') ? Math.round(hp * AFFIXES.shielded.n.frac) : 0,
  };
}
