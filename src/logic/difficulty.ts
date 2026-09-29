// v0.10 (#203): which difficulties are open in a run with no realm, from the wins on each tier (config TIER_UNLOCK; realms: logic/world tierOpen)
import { TIER_UNLOCK, TIERS } from '../config/economy';

/** Per tier (index into TIERS): the most waves cleared in one run, and the runs won. */
export interface TierRecords {
  tierWaves: number[];
  tierWins: number[];
}

const met = (i: number, r: TierRecords): boolean => {
  const u = TIER_UNLOCK[i];
  return u.win === undefined || (r.tierWins[u.win] ?? 0) > 0;
};

/** The highest open difficulty: never below `unlocked` (a save keeps what it opened), then each next tier whose requirement is met. */
export function tierUnlockedFor(unlocked: number, r: TierRecords): number {
  let top = unlocked;
  while (top < TIERS.length - 1 && met(top + 1, r)) top++;
  return top;
}

/** What still opens tier `i`, for its lock hint ("win a run on Knight"); '' when nothing is left. */
export function nextTierRequirement(i: number, r: TierRecords): string {
  return met(i, r) ? '' : `win a run on ${TIERS[TIER_UNLOCK[i].win!].name}`;
}

/** Fold one run into the records. */
export const recordTierRun = (r: TierRecords, tier: number, wavesCleared: number, won: boolean): TierRecords => ({
  tierWaves: r.tierWaves.map((w, i) => (i === tier ? Math.max(w, wavesCleared) : w)),
  tierWins: r.tierWins.map((w, i) => (i === tier && won ? w + 1 : w)),
});

/** The knight deed's progress: the highest tier won on (1 Knight, 2 Champion, 3 Legend), 0 when none past Squire. */
export const topTierWon = (r: TierRecords): number => Math.max(0, ...r.tierWins.map((w, i) => (w > 0 ? i : 0)));
