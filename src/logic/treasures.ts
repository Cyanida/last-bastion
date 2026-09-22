import type { ClassId } from '../config/classes';
import { MASTERY, TIERS } from '../config/economy';
import type { EnemyId } from '../config/enemies';
import { TREASURE_RULES, TREASURES, type FollowUpGoal } from '../config/treasures';

/**
 * v0.5 sacred treasures: the chain's rules, pure (config/treasures.ts has the rows, systems/treasures.ts plays them out).
 * The step is never stored: it follows from the fragments, the trial and the tier, and mastery's unlock (treasureStep).
 */

/** A class's chain in the save. */
export interface TreasureRecord {
  fragments: number; // 0..3
  trial: boolean; // passed
  tier: number; // 0 = not earned yet, then I..III
  equipped: boolean; // taken into the next run (the class select chip)
}
export const emptyTreasure = (): TreasureRecord => ({ fragments: 0, trial: false, tier: 0, equipped: true });

/** What one run did for its class's chain (RunSummary.treasure). */
export interface ChainRun {
  found: number; // fragments picked up
  passed: boolean; // the trial
  slain: boolean; // the guardian
  carried: number; // tier of the treasure equipped at run start, 0 = none
}

type ChainState = { fragments: number; trial: boolean; tier: number };
export type ChainStep = 'locked' | 'fragments' | 'trial' | 'guardian' | 'tierII' | 'tierIII' | 'complete';

/** Where a chain stands. `unlocked`: masteryBonus().treasureStep (1 opens the chain). */
export function chainStep(c: ChainState, unlocked: number): ChainStep {
  if (c.tier >= 3) return 'complete';
  if (c.tier >= 1) return c.tier === 1 ? 'tierII' : 'tierIII';
  if (unlocked < 1) return 'locked';
  if (c.fragments < TREASURE_RULES.fragments) return 'fragments';
  return c.trial ? 'guardian' : 'trial';
}

/** The Act boss that drops the next fragment, or null when none is due. */
export const nextFragmentBoss = (classId: ClassId, c: ChainState & { unlocked: number }): EnemyId | null =>
  chainStep(c, c.unlocked) === 'fragments' ? TREASURES[classId].fragmentBosses[c.fragments] : null;

/** The follow-up that raises a treasure from `tier` (1 -> II, 2 -> III). */
export const followUpFrom = (classId: ClassId, tier: number) => (tier >= 1 && tier <= 2 ? TREASURES[classId].followUps[tier - 1] : undefined);

interface GoalCtx {
  carried: number;
  acts: number;
  unlocked: number;
  difficulty: number;
  slain: boolean;
}
export const goalMet = (g: FollowUpGoal, r: GoalCtx): boolean =>
  (!g.acts || (r.carried > 0 && r.acts >= g.acts)) && (!g.mastery || r.unlocked >= g.mastery) && (g.difficulty === undefined || r.difficulty >= g.difficulty) && (!g.guardian || r.slain);

/** Does the guardian wait in the vault in this run? After the trial, and again for a follow-up that asks for it, once the rest of that goal is met. */
export function guardianDue(classId: ClassId, c: ChainState & { unlocked: number; slain: boolean }, difficulty: number): boolean {
  if (c.slain) return false;
  if (chainStep(c, c.unlocked) === 'guardian') return true;
  const f = followUpFrom(classId, c.tier);
  return !!f?.goal.guardian && goalMet({ ...f.goal, acts: undefined, guardian: false }, { carried: 0, acts: 0, unlocked: c.unlocked, difficulty, slain: false });
}

/** Folds a run into its class's record: fragments, the trial, then at most one tier (the guardian's, or a follow-up's). */
export function advanceChain(classId: ClassId, rec: TreasureRecord, run: ChainRun, ctx: { unlocked: number; difficulty: number; acts: number }): TreasureRecord {
  const out = { ...rec, fragments: Math.min(TREASURE_RULES.fragments, rec.fragments + run.found), trial: rec.trial || run.passed };
  const f = followUpFrom(classId, out.tier);
  if (out.tier === 0 && run.slain) out.tier = 1;
  else if (f && goalMet(f.goal, { ...ctx, carried: run.carried, slain: run.slain })) out.tier++;
  return out;
}

/** The mastery rank whose reward is treasureStep `step`. */
export const rankFor = (step: number): number => MASTERY.findIndex((r) => r.reward.kind === 'treasureStep' && r.reward.step >= step) + 1;

/** A name inside a sentence: "The Holy Grail" -> "the Holy Grail". */
export const inText = (name: string): string => name.replace(/^The /, 'the ');

/** A follow-up's goal in words, from its row. */
export function followUpText(classId: ClassId, i: 0 | 1): string {
  const t = TREASURES[classId];
  const g = t.followUps[i].goal;
  const parts = [
    ...(g.acts ? [`carry ${inText(t.name)} through ${g.acts} Acts in one run`] : []),
    ...(g.mastery ? [`reach mastery rank ${rankFor(g.mastery)}`] : []),
    ...(g.guardian ? [`slay ${inText(t.guardian.name)} again${g.difficulty ? ` on ${TIERS[g.difficulty].name} or higher` : ''}`] : []),
  ];
  const text = parts.join(', then ');
  return `${text[0].toUpperCase()}${text.slice(1)}.`;
}
