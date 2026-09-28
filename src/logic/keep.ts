import { BUILDINGS, KEEP_BANNERS, META, type BuildingId } from '../config/economy';
import { buildingLevel, type BuildingLevels, type MetaRanks } from './economy';

export interface KeepStage {
  level: number; // 0 (the ruin) .. the building's top level
  banners: number; // 0 .. KEEP_BANNERS.length: how much of its ranks are bought
  frame: number; // its drawing in the castle atlas (tools/art/ui/keep.ts): a column per level x banners
}

/** #67: which drawing of the castle a building shows: it grows with its level and flies banners as its ranks are bought. */
export function keepStage(levels: BuildingLevels, meta: MetaRanks, id: BuildingId): KeepStage {
  const level = buildingLevel(levels, id);
  const ups = BUILDINGS[id].upgrades;
  const max = ups.reduce((n, u) => n + META[u].max, 0);
  const ranks = ups.reduce((n, u) => n + Math.min(META[u].max, meta[u] ?? 0), 0);
  const banners = KEEP_BANNERS.filter((t) => ranks >= t * max - 1e-9).length;
  return { level, banners, frame: level * (KEEP_BANNERS.length + 1) + banners };
}
