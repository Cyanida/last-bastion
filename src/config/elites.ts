export type AffixId = 'shielded' | 'vampiric' | 'swift' | 'splitting' | 'frostAura' | 'enraged';

/** Any regular enemy can roll as an elite. chance(wave) = base + perWave * (wave - fromWave), capped, times the difficulty tier. */
export const ELITES = {
  fromWave: 4,
  baseChance: 0.03,
  perWave: 0.006,
  actMult: [1, 2.2, 1] as number[], // Act II is the elite Act: the per-wave growth doubles there (v0.4 scaling axes)
  maxChance: 0.22,
  twoAffixFromWave: 10,
  twoAffixChance: 0.4,
  hpMult: 3,
  dmgMult: 1.3,
  xpMult: 4,
  goldMult: 5,
  scaleBonus: 1, // sprite scale
  radiusMult: 1.3,
};

export const AFFIXES: Record<AffixId, { name: string; color: string; desc: string; n: Record<string, number> }> = {
  shielded: { name: 'Shielded', color: '#7ec8d8', desc: 'A barrier soaks damage and regrows when left alone.', n: { frac: 0.4, regenDelay: 4, regenTime: 3 } },
  vampiric: { name: 'Vampiric', color: '#c23a2e', desc: 'Heals for a multiple of the damage it deals.', n: { heal: 4 } },
  swift: { name: 'Swift', color: '#f2e6a0', desc: 'Moves much faster.', n: { speed: 1.5 } },
  splitting: { name: 'Splitting', color: '#6f8f4e', desc: 'Splits into lesser copies when slain.', n: { count: 2, hpFrac: 0.35 } },
  frostAura: { name: 'Frost Aura', color: '#a9d8ef', desc: 'Slows you while you stand near it.', n: { radius: 150, slow: 0.7, linger: 0.3 } },
  enraged: { name: 'Enraged', color: '#e07b28', desc: 'Hits harder and runs faster below half HP.', n: { threshold: 0.5, damage: 1.6, speed: 1.35 } },
};

export const AFFIX_IDS = Object.keys(AFFIXES) as AffixId[];
