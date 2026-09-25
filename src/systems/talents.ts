import { TALENT_BY_ID } from '../config/talents';
import { TRAITS, type TraitId } from '../config/traits';
import { sfx } from '../sim/view';
import { addListener, type GameEvents } from '../core/events';
import type { Game, StatKey } from '../core/types';
import { combineMods } from '../logic/mods';
import { canTakeTalent, talentMods } from '../logic/talents';
import { damageEnemy, healPlayer } from './combat';
import { floatText, ring } from './effects';

/**
 * Talents and the starting trait are data (config/talents.ts, config/traits.ts): plain mods folded into p.mods every tick,
 * flat stat changes applied once, and a few keys (thorns, onKillHeal, lowHpDamage, bossDamage, dodge, critDamage, minionMax,
 * abilityDur/abilityCd, utilityCd/utilityPower) that combat, abilities and the utility read from p.mods.
 */

/** Spend a talent point. False when the node cannot be taken (prerequisites, keystone rules, no points). */
export function spendTalent(g: Game, id: string): boolean {
  const p = g.player;
  if (!canTakeTalent(p.talents, id, g.talentPoints, g.talentRowCap, g.treasure?.id)) return false;
  const node = TALENT_BY_ID[id];
  p.talents = [...p.talents, id];
  g.talentPoints--;
  for (const [key, add] of Object.entries(node.stats ?? {}) as [StatKey, number][]) {
    p.stats[key] += add;
    if (key === 'hp') p.hp += add;
  }
  g.talentModsCache = null;
  floatText(g, p.x, p.y - 50, node.name, '#e9c95a', 16);
  ring(g, p.x, p.y, 100, '#e9c95a', 0.5);
  sfx(g, 'levelup');
  return true;
}

/** Apply the starting trait once, at run start: multipliers on the base stats, mods into the run's base mods. */
export function applyTrait(g: Game, id: TraitId, second = false): void {
  const t = TRAITS[id];
  const p = g.player;
  for (const [key, mult] of Object.entries(t.stats ?? {}) as [StatKey, number][]) p.stats[key] = Math.round(p.stats[key] * mult);
  p.hp = Math.min(p.hp, p.stats.hp);
  if (t.mods) combineMods(g.baseMods, t.mods);
  if (second) g.trait2 = id; // v0.6: the Second Banner's
  else g.trait = id;
  if (t.n) for (const [k, v] of Object.entries(t.n)) g.vars[`trait.${k}`] = v;
}

/** Every tick after relics: talent mods, and the conditional ones (below half HP). */
export function talentPassives(g: Game): void {
  const p = g.player;
  if (p.talents.length === 0) return;
  g.talentModsCache ??= talentMods(p.talents);
  combineMods(p.mods, g.talentModsCache);
  if (p.mods.lowHpDamage > 0 && p.hp < p.stats.hp * 0.5) p.mods.damage *= 1 + p.mods.lowHpDamage;
}

addListener((g, name, ev) => {
  const p = g.player;
  if (name === 'onKill' && p.mods.onKillHeal > 0) healPlayer(g, p.mods.onKillHeal, false);
  if (name === 'onDamageTaken') {
    const { attacker, amount } = ev as GameEvents['onDamageTaken'];
    if (p.mods.thorns > 0 && attacker) damageEnemy(g, attacker, amount * p.mods.thorns, false, 0, 0, 'relic');
  }
});
