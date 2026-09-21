import { ARENA_IDS, type ArenaId } from '../config/arenas';
import { CLASS_ORDER, type ClassId } from '../config/classes';
import { META, META_IDS, TIER_UNLOCK_WAVE, TIERS, type MetaId } from '../config/economy';
import type { EnemyId } from '../config/enemies';
import type { RelicId } from '../config/relics';
import { classXpForRun, metaCost, type MetaRanks } from './economy';

export const SAVE_VERSION = 2;
export const SAVE_KEY = 'lastbastion.save';
export const LEGACY_BEST_KEY = 'lastbastion.best'; // v0.1: { [classId]: bestWave }

export interface ClassRecord {
  bestWave: number;
  runs: number;
  kills: number;
  time: number; // seconds
  xp: number; // mastery
}

export interface Save {
  version: typeof SAVE_VERSION;
  gold: number;
  meta: MetaRanks;
  classes: Record<ClassId, ClassRecord>;
  relicPicks: Partial<Record<RelicId, number>>;
  achievements: string[];
  tierUnlocked: number; // highest difficulty index available
  counters: {
    kills: number;
    bosses: number;
    elites: number;
    goldEarned: number;
    flawlessBosses: number;
    maxRelics: number; // most relics held in one run
    maxAbilityUpgrades: number;
    fastestWave10: number; // seconds, 0 = never
    bossKinds: EnemyId[];
  };
  settings: { arena: ArenaId; tier: number };
}

/** What a finished (or abandoned) run reports. */
export interface RunSummary {
  classId: ClassId;
  tier: number;
  wave: number;
  wavesCleared: number;
  kills: number;
  time: number;
  level: number;
  gold: number; // to bank
  bosses: EnemyId[];
  elites: number;
  flawlessBosses: number;
  relics: RelicId[];
  abilityUpgrades: number;
  wave10Time: number;
}

const emptyClass = (): ClassRecord => ({ bestWave: 0, runs: 0, kills: 0, time: 0, xp: 0 });

export function defaultSave(): Save {
  return {
    version: SAVE_VERSION,
    gold: 0,
    meta: {},
    classes: Object.fromEntries(CLASS_ORDER.map((id) => [id, emptyClass()])) as Record<ClassId, ClassRecord>,
    relicPicks: {},
    achievements: [],
    tierUnlocked: 0,
    counters: { kills: 0, bosses: 0, elites: 0, goldEarned: 0, flawlessBosses: 0, maxRelics: 0, maxAbilityUpgrades: 0, fastestWave10: 0, bossKinds: [] },
    settings: { arena: 'courtyard', tier: 0 },
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback);

/**
 * Any stored value -> a valid current save. Handles: nothing stored, the v0.1 best-wave map, a v2 save
 * (re-validated field by field, so a hand-edited or partial import cannot break the game).
 */
export function migrate(raw: unknown, legacyBest?: unknown): Save {
  const save = defaultSave();
  if (isObj(raw) && raw.version === SAVE_VERSION) {
    save.gold = Math.floor(num(raw.gold));
    if (isObj(raw.meta)) {
      for (const id of META_IDS) {
        const rank = Math.min(META[id].max, Math.floor(num(raw.meta[id])));
        if (rank > 0) save.meta[id] = rank; // only real ranks, so migrating a save twice changes nothing
      }
    }
    if (isObj(raw.classes)) {
      for (const id of CLASS_ORDER) {
        const c = raw.classes[id];
        if (isObj(c)) save.classes[id] = { bestWave: num(c.bestWave), runs: num(c.runs), kills: num(c.kills), time: num(c.time), xp: num(c.xp) };
      }
    }
    if (isObj(raw.relicPicks)) for (const [k, v] of Object.entries(raw.relicPicks)) save.relicPicks[k as RelicId] = num(v);
    if (Array.isArray(raw.achievements)) save.achievements = raw.achievements.filter((a): a is string => typeof a === 'string');
    save.tierUnlocked = Math.min(TIERS.length - 1, Math.floor(num(raw.tierUnlocked)));
    if (isObj(raw.counters)) {
      const c = raw.counters;
      for (const k of ['kills', 'bosses', 'elites', 'goldEarned', 'flawlessBosses', 'maxRelics', 'maxAbilityUpgrades', 'fastestWave10'] as const) save.counters[k] = num(c[k]);
      if (Array.isArray(c.bossKinds)) save.counters.bossKinds = c.bossKinds.filter((b): b is EnemyId => typeof b === 'string');
    }
    if (isObj(raw.settings)) {
      const arena = raw.settings.arena as ArenaId;
      save.settings = { arena: ARENA_IDS.includes(arena) ? arena : 'courtyard', tier: Math.min(save.tierUnlocked, Math.floor(num(raw.settings.tier))) };
    }
    return save;
  }
  // v0.1 (or empty): carry the best-wave records over
  if (isObj(legacyBest)) for (const id of CLASS_ORDER) save.classes[id].bestWave = num(legacyBest[id]);
  return save;
}

export const exportSave = (save: Save) => JSON.stringify(save, null, 2);

/** null when the text is not a recognisable save. */
export function importSave(text: string): Save | null {
  try {
    const raw: unknown = JSON.parse(text);
    return isObj(raw) && raw.version === SAVE_VERSION ? migrate(raw) : null;
  } catch {
    return null;
  }
}

/** Buy one rank. Returns the same object when it cannot be bought (capped or too poor). */
export function buyMeta(save: Save, id: MetaId): Save {
  const rank = save.meta[id] ?? 0;
  const cost = metaCost(id, rank);
  if (cost === null || save.gold < cost) return save;
  return { ...save, gold: save.gold - cost, meta: { ...save.meta, [id]: rank + 1 } };
}

/** Fold a run into the save: gold, class XP, records, counters, difficulty unlock. Achievements are evaluated separately. */
export function applyRun(save: Save, run: RunSummary): { save: Save; classXp: number; tierUnlocked: boolean } {
  const classXp = classXpForRun({ wavesCleared: run.wavesCleared, bosses: run.bosses.length, level: run.level }, TIERS[run.tier]);
  const prev = save.classes[run.classId];
  const c = save.counters;
  const tierUnlocked = run.tier === save.tierUnlocked && run.wavesCleared >= TIER_UNLOCK_WAVE && save.tierUnlocked < TIERS.length - 1;
  const relicPicks = { ...save.relicPicks };
  for (const id of run.relics) relicPicks[id] = (relicPicks[id] ?? 0) + 1;
  return {
    classXp,
    tierUnlocked,
    save: {
      ...save,
      gold: save.gold + run.gold,
      classes: {
        ...save.classes,
        [run.classId]: { bestWave: Math.max(prev.bestWave, run.wave), runs: prev.runs + 1, kills: prev.kills + run.kills, time: prev.time + run.time, xp: prev.xp + classXp },
      },
      relicPicks,
      tierUnlocked: save.tierUnlocked + (tierUnlocked ? 1 : 0),
      counters: {
        kills: c.kills + run.kills,
        bosses: c.bosses + run.bosses.length,
        elites: c.elites + run.elites,
        goldEarned: c.goldEarned + run.gold,
        flawlessBosses: c.flawlessBosses + run.flawlessBosses,
        maxRelics: Math.max(c.maxRelics, run.relics.length),
        maxAbilityUpgrades: Math.max(c.maxAbilityUpgrades, run.abilityUpgrades),
        fastestWave10: run.wave10Time > 0 && (c.fastestWave10 === 0 || run.wave10Time < c.fastestWave10) ? run.wave10Time : c.fastestWave10,
        bossKinds: [...new Set([...c.bossKinds, ...run.bosses])],
      },
    },
  };
}
