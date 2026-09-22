import type { FeatKey } from '../config/achievements';
import type { Game } from '../core/types';

/**
 * Class feats: the per-run numbers the v0.4 achievements ask for (config/achievements.ts FEAT_KEYS).
 * `feat` keeps the best one attempt reached, `featAdd` counts attempts. applyRun folds them into the save.
 */
export const feat = (g: Game, key: FeatKey, value: number): void => void (g.feats[key] = Math.max(g.feats[key] ?? 0, value));
export const featAdd = (g: Game, key: FeatKey, n = 1): void => void (g.feats[key] = (g.feats[key] ?? 0) + n);
