import { ABILITY_UPGRADES } from '../config/abilityUpgrades';
import type { ClassId } from '../config/classes';
import { EVOLUTION_IDS, EVOLUTIONS, type EvolutionId, type Requirement } from '../config/evolutions';
import { relicDef, TIER_NUMERALS, type RelicId } from '../config/relics';
import { TALENT_BRANCHES, TALENT_BY_ID } from '../config/talents';
import { UTILITY_UPGRADES } from '../config/utility';

/**
 * v0.6 evolution recipes, pure: what a build has, which recipes it meets, which it is one step from. The level-up offer, the tooltips,
 * the compendium and the tests all read these.
 */
export interface BuildState {
  classId: ClassId;
  upgrades: readonly string[];
  utilityUpgrades: readonly string[];
  talents: readonly string[];
  relicTiers: Partial<Record<RelicId, number>>;
  evolutions: readonly EvolutionId[]; // taken this run
}

export function requirementMet(b: BuildState, r: Requirement): boolean {
  switch (r.kind) {
    case 'upgrade':
      return b.upgrades.includes(r.id);
    case 'utility':
      return b.utilityUpgrades.includes(r.id);
    case 'keystone':
      return b.talents.some((id) => TALENT_BY_ID[id]?.branch === r.branch && TALENT_BY_ID[id]?.keystone);
    case 'branch':
      return b.talents.some((id) => TALENT_BY_ID[id]?.branch === r.branch && TALENT_BY_ID[id]!.row >= 1);
    case 'relic':
      return (b.relicTiers[r.id] ?? 0) >= r.tier;
  }
}

/** How many of its two requirements a build meets. */
export const recipeProgress = (b: BuildState, id: EvolutionId): number => EVOLUTIONS[id].requires.filter((r) => requirementMet(b, r)).length;

/** A class's recipes whose slot this run has not filled yet (one signature and one utility evolution a run). */
export function openRecipes(b: BuildState): EvolutionId[] {
  const filled = new Set(b.evolutions.map((id) => EVOLUTIONS[id].slot));
  return EVOLUTION_IDS.filter((id) => EVOLUTIONS[id].classId === b.classId && !filled.has(EVOLUTIONS[id].slot));
}

/** Recipes complete right now: the next level-up offers the first of them as a gold card. */
export const readyEvolutions = (b: BuildState): EvolutionId[] => openRecipes(b).filter((id) => recipeProgress(b, id) === 2);

/** Recipes one step away, and that missing step: what the tooltips point at. */
export function nearlyReady(b: BuildState): { id: EvolutionId; missing: Requirement }[] {
  return openRecipes(b).flatMap((id) => {
    const missing = EVOLUTIONS[id].requires.filter((r) => !requirementMet(b, r));
    return missing.length === 1 ? [{ id, missing: missing[0] }] : [];
  });
}

/** Does a requirement ask for this relic (at any tier) or this talent (by its branch)? */
export function requirementNames(r: Requirement, what: { relic?: RelicId; talent?: string }): boolean {
  if (what.relic) return r.kind === 'relic' && r.id === what.relic;
  const node = what.talent ? TALENT_BY_ID[what.talent] : undefined;
  if (!node) return false;
  return (r.kind === 'keystone' && node.branch === r.branch && node.keystone === true) || (r.kind === 'branch' && node.branch === r.branch && node.row >= 1);
}

/** For a relic or talent tooltip: the evolutions it would complete right now ("✦ completes Aegis of Dawn"). */
export const completes = (b: BuildState, what: { relic?: RelicId; talent?: string }): EvolutionId[] =>
  nearlyReady(b).filter((n) => requirementNames(n.missing, what)).map((n) => n.id);

const branchName = (id: string) => Object.values(TALENT_BRANCHES).flat().find((b) => b.id === id)?.name ?? id;

/** A requirement in words. `hint`: vaguer, for recipes not discovered yet (the compendium). */
export function requirementText(r: Requirement, hint = false): string {
  switch (r.kind) {
    case 'upgrade':
      return hint ? 'an upgrade of the signature ability' : `the ${ABILITY_UPGRADES[r.id].name} upgrade`;
    case 'utility':
      return hint ? 'an upgrade of the second ability' : `the ${UTILITY_UPGRADES[r.id].name} upgrade`;
    case 'keystone':
      return `the ${branchName(r.branch)} keystone`;
    case 'branch':
      return hint ? 'talents in one branch' : `a ${branchName(r.branch)} talent past the first row`;
    case 'relic':
      return hint ? `a ${relicDef(r.id).rarity} relic attuned to tier ${TIER_NUMERALS[r.tier]}` : `${relicDef(r.id).name} attuned to tier ${TIER_NUMERALS[r.tier]}`;
  }
}
