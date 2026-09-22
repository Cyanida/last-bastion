import type { FeatKey } from '../config/achievements';
import type { Game } from '../core/types';

/**
 * Class feats: the per-run numbers the v0.4 achievements ask for (config/achievements.ts FEAT_KEYS).
 * `feat` keeps the best one attempt reached, `featAdd` counts attempts. applyRun folds them into the save.
 * v0.5: g.actFeats keeps the same for the current Act only (systems/quests.ts clears it), for the treasure trials.
 */
export function feat(g: Game, key: FeatKey, value: number): void {
  g.feats[key] = Math.max(g.feats[key] ?? 0, value);
  g.actFeats[key] = Math.max(g.actFeats[key] ?? 0, value);
}
export function featAdd(g: Game, key: FeatKey, n = 1): void {
  g.feats[key] = (g.feats[key] ?? 0) + n;
  g.actFeats[key] = (g.actFeats[key] ?? 0) + n;
}
