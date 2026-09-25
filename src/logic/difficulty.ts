// v0.8 (#79): which difficulties are open, from the best wave cleared and the wins on each tier (config TIER_UNLOCK)
import { TIER_UNLOCK, TIERS } from '../config/economy';

/** Per tier (index into TIERS): the most waves cleared in one run, and the runs won. */
export interface TierRecords {
  tierWaves: number[];
  tierWins: number[];
}

const met = (i: number, r: TierRecords): boolean => {
  const u = TIER_UNLOCK[i];
  return (!u.wave || (r.tierWaves[u.wave.tier] ?? 0) >= u.wave.wave) && (u.win === undefined || (r.tierWins[u.win] ?? 0) > 0);
};

/** The highest open difficulty: never below `unlocked` (a save keeps what it opened), then each next tier whose requirement is met. */
export function tierUnlockedFor(unlocked: number, r: TierRecords): number {
  let top = unlocked;
  while (top < TIERS.length - 1 && met(top + 1, r)) top++;
  return top;
}

/** What still opens tier `i`, for its lock hint ("clear wave 30 on Knight and win a run on Squire"); '' when nothing is left. */
export function nextTierRequirement(i: number, r: TierRecords): string {
  const u = TIER_UNLOCK[i];
  const parts: string[] = [];
  if (u.wave && (r.tierWaves[u.wave.tier] ?? 0) < u.wave.wave) parts.push(`clear wave ${u.wave.wave} on ${TIERS[u.wave.tier].name}`);
  if (u.win !== undefined && !((r.tierWins[u.win] ?? 0) > 0)) parts.push(`win a run on ${TIERS[u.win].name}`);
  return parts.join(' and ');
}

/** Fold one run into the records. */
export const recordTierRun = (r: TierRecords, tier: number, wavesCleared: number, won: boolean): TierRecords => ({
  tierWaves: r.tierWaves.map((w, i) => (i === tier ? Math.max(w, wavesCleared) : w)),
  tierWins: r.tierWins.map((w, i) => (i === tier && won ? w + 1 : w)),
});
