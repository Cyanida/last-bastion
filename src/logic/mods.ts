import type { Mods } from '../core/types';

export const neutralMods = (): Mods => ({
  damage: 1, atkSpd: 1, moveSpd: 1, cooldown: 1, pickup: 1, xp: 1, gold: 1, minionAtkSpd: 1, minionDamage: 1,
  abilityDur: 1, abilityCd: 1, utilityCd: 1, utilityPower: 1, bossDamage: 1,
  armor: 0, crit: 0, lifesteal: 0, regen: 0, pierce: 0, critDamage: 0, dodge: 0, thorns: 0, onKillHeal: 0, lowHpDamage: 0, minionMax: 0,
});

export const ADDITIVE = new Set<keyof Mods>(['armor', 'crit', 'lifesteal', 'regen', 'pierce', 'critDamage', 'dodge', 'thorns', 'onKillHeal', 'lowHpDamage', 'minionMax']);
/** Every other key multiplies (1.12 = +12%): the one list of which is which, for relic totals too (logic/relics.ts). */
export const isMultiplicative = (key: keyof Mods): boolean => !ADDITIVE.has(key);

/** Folds `part` into `into` (mutating it): additive keys add, everything else multiplies. */
export function combineMods(into: Mods, part: Partial<Mods>): Mods {
  for (const key of Object.keys(part) as (keyof Mods)[]) {
    const v = part[key]!;
    into[key] = ADDITIVE.has(key) ? into[key] + v : into[key] * v;
  }
  return into;
}
