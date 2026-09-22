import { FEAT_KEYS, type FeatKey } from '../config/achievements';
import { ARENA_IDS, type ArenaId } from '../config/arenas';
import { CLASS_ORDER, type ClassId } from '../config/classes';
import { CURSE_IDS, type CurseId } from '../config/curses';
import { ACTS } from '../config/acts';
import { BUILDING_IDS, BUILDINGS, META, META_IDS, RUNES, TIER_UNLOCK_WAVE, TIERS, type BuildingId, type MetaId } from '../config/economy';
import type { EnemyId } from '../config/enemies';
import type { QualitySetting } from '../config/game';
import type { RelicId } from '../config/relics';
import { TRAIT_IDS, type TraitId } from '../config/traits';
import { TREASURE_RULES } from '../config/treasures';
import { curseMultiplier } from './curses';
import { buildingLevel, classXpForRun, masteryBonus, metaCost, metaLoadout, runesForActBoss, type BuildingLevels, type MetaRanks } from './economy';
import { advanceChain, emptyTreasure, type ChainRun, type TreasureRecord } from './treasures';
import { keepRuns, readRunLog, type RunLog } from './runlog';

export const SAVE_VERSION = 4;
const READABLE_VERSIONS = [2, 3, 4]; // v2 (game v0.2) and v3 (v0.3) have the same shape minus later fields, which get defaults
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
  relicPicks: Partial<Record<RelicId, number>>; // how often each relic was picked up or tiered up (the compendium)
  runeShards: number; // v0.4: salvaged relics; RUNES.shardsPerRune of them become a Rune at the end of a run
  runes: number; // v0.4: the Keep's second currency
  buildings: BuildingLevels; // v0.4: the Keep's buildings, level 0..3
  dailyGold: { date: string; curse: number; trial: number }; // v0.4: gold from curses and the Daily Trial banked today (capped)
  achievements: string[]; // earned tiers: "id" (bronze), "id:2", "id:3"
  // v0.4 achievement rewards
  titles: string[]; // earned titles (mastery adds more, logic/achievements earnedTitles)
  title: string | null; // the one worn
  palettes: number[]; // sprite palettes unlocked for every class
  talentPoints: number; // permanent extra talent points a run starts with
  treasures: Record<ClassId, TreasureRecord>; // v0.5 sacred treasure chain per class (logic/treasures.ts); was treasureSteps
  tierUnlocked: number; // highest difficulty index available
  counters: Record<FeatKey, number> & {
    kills: number;
    bosses: number;
    elites: number;
    goldEarned: number;
    flawlessBosses: number;
    maxRelics: number; // most relics held in one run
    maxAbilityUpgrades: number;
    fastestWave10: number; // seconds, 0 = never
    bossKinds: EnemyId[];
    // v0.3
    commanders: number;
    actsCleared: number; // most Acts cleared in one run
    cursedActs: number; // most curses active in a run that cleared Act I
    dailies: number;
    // v0.5
    quests: number; // side quests completed
    events: number; // wave events come upon
  };
  daily: Record<string, number>; // v0.3: 'YYYY-MM-DD' -> best wave in that day's trial
  runs: RunLog[]; // v0.6: the last RUN_LOG.keep runs' timelines, oldest first (Run History)
  settings: { arena: ArenaId; tier: number; quality: QualitySetting; prerelease: boolean; curses: CurseId[]; trait: TraitId; palettes: Partial<Record<ClassId, number>> };
}

/** What a finished (or abandoned) run reports. The v0.3 fields are optional so older callers keep working. */
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
  commanders?: number;
  actsCleared?: number;
  curses?: CurseId[];
  daily?: string | null; // date of the Daily Trial this run was, if any
  seed?: number;
  levelAtWave?: number[];
  talents?: string[]; // v0.4 build, for the results screen and achievements
  utilityUpgrades?: string[];
  trait?: string;
  relicsFound?: RelicId[]; // every pickup and tier-up (the compendium counts them)
  relicTiers?: Partial<Record<RelicId, number>>;
  salvage?: number; // Rune shards from salvaged relics
  feats?: Record<string, number>; // v0.4 class feats this run (config/achievements FEAT_KEYS)
  quests?: number; // v0.5 side quests completed
  events?: number; // v0.5 wave events come upon
  questRunes?: number; // Runes from quest rewards, banked on top of the per-run boss cap
  treasure?: ChainRun; // v0.5: what the run did for its class's treasure chain
  log?: RunLog; // v0.6: the run's timeline, for Run History
}

const emptyClass = (): ClassRecord => ({ bestWave: 0, runs: 0, kills: 0, time: 0, xp: 0 });
const zeroFeats = (): Record<FeatKey, number> => Object.fromEntries(FEAT_KEYS.map((k) => [k, 0])) as Record<FeatKey, number>;

export function defaultSave(): Save {
  return {
    version: SAVE_VERSION,
    gold: 0,
    meta: {},
    classes: Object.fromEntries(CLASS_ORDER.map((id) => [id, emptyClass()])) as Record<ClassId, ClassRecord>,
    relicPicks: {},
    runeShards: 0,
    runes: 0,
    buildings: {},
    dailyGold: { date: '', curse: 0, trial: 0 },
    achievements: [],
    titles: [],
    title: null,
    palettes: [],
    talentPoints: 0,
    treasures: Object.fromEntries(CLASS_ORDER.map((id) => [id, emptyTreasure()])) as Record<ClassId, TreasureRecord>,
    tierUnlocked: 0,
    counters: { ...zeroFeats(), kills: 0, bosses: 0, elites: 0, goldEarned: 0, flawlessBosses: 0, maxRelics: 0, maxAbilityUpgrades: 0, fastestWave10: 0, bossKinds: [], commanders: 0, actsCleared: 0, cursedActs: 0, dailies: 0, quests: 0, events: 0 },
    daily: {},
    runs: [],
    settings: { arena: 'courtyard', tier: 0, quality: 'auto', prerelease: false, curses: [], trait: 'none', palettes: {} },
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback);
const NUMERIC_COUNTERS = ['kills', 'bosses', 'elites', 'goldEarned', 'flawlessBosses', 'maxRelics', 'maxAbilityUpgrades', 'fastestWave10', 'commanders', 'actsCleared', 'cursedActs', 'dailies', 'quests', 'events', ...FEAT_KEYS] as const;

/** v0.4: achievements that became a tier of another one. Anything not listed keeps its id. */
const RENAMED_ACHIEVEMENTS: Record<string, string> = { champion: 'knight:2', legend: 'knight:3' };

/**
 * Any stored value -> a valid current save. Handles: nothing stored, the v0.1 best-wave map, a v2 save (v0.2) and a v3 save.
 * Every field is re-validated, so a hand-edited or partial import cannot break the game, and fields a version
 * did not have yet simply get their defaults: that is the whole v2 -> v3 migration.
 */
export function migrate(raw: unknown, legacyBest?: unknown): Save {
  const save = defaultSave();
  if (isObj(raw) && READABLE_VERSIONS.includes(raw.version as number)) {
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
    save.runeShards = Math.max(0, Math.floor(num(raw.runeShards)));
    if (isObj(raw.buildings)) {
      for (const id of BUILDING_IDS) {
        const level = Math.min(BUILDINGS[id].levels.length, Math.floor(num(raw.buildings[id])));
        if (level > 0) save.buildings[id] = level; // only real levels, so migrating a save twice changes nothing
      }
    }
    if (isObj(raw.dailyGold) && typeof raw.dailyGold.date === 'string') save.dailyGold = { date: raw.dailyGold.date, curse: num(raw.dailyGold.curse), trial: num(raw.dailyGold.trial) };
    if (Array.isArray(raw.achievements)) save.achievements = raw.achievements.filter((a): a is string => typeof a === 'string').map((a) => RENAMED_ACHIEVEMENTS[a] ?? a);
    if (Array.isArray(raw.titles)) save.titles = [...new Set(raw.titles.filter((t): t is string => typeof t === 'string'))];
    if (typeof raw.title === 'string') save.title = raw.title;
    if (Array.isArray(raw.palettes)) save.palettes = [...new Set(raw.palettes.map((p) => Math.floor(num(p))).filter((p) => p > 0))];
    save.talentPoints = Math.floor(num(raw.talentPoints));
    for (const id of CLASS_ORDER) {
      const t = isObj(raw.treasures) ? raw.treasures[id] : undefined;
      // v0.5: the old treasureSteps (a gold mastery deed's "step") became a fragment each
      const fragments = (v: unknown) => Math.min(TREASURE_RULES.fragments, Math.floor(num(v)));
      if (isObj(t)) save.treasures[id] = { fragments: fragments(t.fragments), trial: t.trial === true, tier: Math.min(3, Math.floor(num(t.tier))), equipped: t.equipped !== false };
      else if (isObj(raw.treasureSteps)) save.treasures[id].fragments = fragments(raw.treasureSteps[id]);
    }
    // v3 -> v4: Runes did not exist; a save arriving from v0.3 is granted one per achievement earned (what the achievement tiers would have paid)
    save.runes = raw.version === 4 ? Math.max(0, Math.floor(num(raw.runes))) : save.achievements.length;
    save.tierUnlocked = Math.min(TIERS.length - 1, Math.floor(num(raw.tierUnlocked)));
    if (isObj(raw.counters)) {
      const c = raw.counters;
      for (const k of NUMERIC_COUNTERS) save.counters[k] = num(c[k]);
      if (Array.isArray(c.bossKinds)) save.counters.bossKinds = c.bossKinds.filter((b): b is EnemyId => typeof b === 'string');
    }
    if (Array.isArray(raw.runs)) save.runs = keepRuns(raw.runs.map(readRunLog).filter((r): r is RunLog => r !== null));
    if (isObj(raw.daily)) for (const [day, wave] of Object.entries(raw.daily)) if (/^\d{4}-\d{2}-\d{2}$/.test(day) && num(wave) > 0) save.daily[day] = num(wave);
    if (isObj(raw.settings)) {
      const s = raw.settings;
      save.settings = {
        arena: ARENA_IDS.includes(s.arena as ArenaId) ? (s.arena as ArenaId) : 'courtyard',
        tier: Math.min(save.tierUnlocked, Math.floor(num(s.tier))),
        quality: s.quality === 'low' || s.quality === 'high' ? s.quality : 'auto',
        trait: TRAIT_IDS.includes(s.trait as TraitId) ? (s.trait as TraitId) : 'none',
        palettes: isObj(s.palettes) ? Object.fromEntries(CLASS_ORDER.filter((c) => num((s.palettes as Record<string, unknown>)[c]) > 0).map((c) => [c, Math.floor(num((s.palettes as Record<string, unknown>)[c]))])) : {},
        prerelease: s.prerelease === true,
        curses: Array.isArray(s.curses) ? CURSE_IDS.filter((id) => (s.curses as unknown[]).includes(id)) : [],
      };
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
    return isObj(raw) && READABLE_VERSIONS.includes(raw.version as number) ? migrate(raw) : null;
  } catch {
    return null;
  }
}

/** Buy one rank. Returns the same object when it cannot be bought (capped by the track or its building, or too poor). */
export function buyMeta(save: Save, id: MetaId): Save {
  const rank = save.meta[id] ?? 0;
  const cost = metaCost(id, rank, save.buildings);
  if (cost === null || save.gold < cost.gold || save.runes < cost.runes) return save;
  return { ...save, gold: save.gold - cost.gold, runes: save.runes - cost.runes, meta: { ...save.meta, [id]: rank + 1 } };
}

/** Raise a building one level: gold, Runes and its deed (an achievement). Same object back when it cannot be done. */
export function buyBuilding(save: Save, id: BuildingId): Save {
  const level = buildingLevel(save.buildings, id);
  const next = BUILDINGS[id].levels[level];
  if (!next || save.gold < next.gold || save.runes < next.runes || (next.achievement && !save.achievements.includes(next.achievement))) return save;
  return { ...save, gold: save.gold - next.gold, runes: save.runes - next.runes, buildings: { ...save.buildings, [id]: level + 1 } };
}

/** The date a run is banked on, for the daily caps (local calendar day). */
export const today = (): string => new Date().toISOString().slice(0, 10);

/** Fold a run into the save: gold, class XP, records, counters, difficulty unlock. Achievements are evaluated separately. */
export function applyRun(save: Save, run: RunSummary, date = today(), at = new Date().toISOString()): { save: Save; classXp: number; tierUnlocked: boolean; runes: number; gold: number } {
  const curses = run.curses ?? [];
  const loadout = metaLoadout(save.meta);
  const curseMult = curseMultiplier(curses) + curses.length * loadout.curseBonus;
  // gold already carries the curse multiplier (it is applied as it drops); class XP gets it here
  const classXp = Math.round(classXpForRun({ wavesCleared: run.wavesCleared, bosses: run.bosses.length, level: run.level }, TIERS[run.tier]) * curseMult * (1 + (save.meta.classXp ?? 0) * META.classXp.perRank));
  const prev = save.classes[run.classId];
  const c = save.counters;
  const acts = run.actsCleared ?? 0;
  // v0.4: the Treasury's income multiplier, then the daily caps on what curses and the Daily Trial add (BALANCE.md)
  const dailyGold = save.dailyGold.date === date ? save.dailyGold : { date, curse: 0, trial: 0 };
  const runCap = RUNES.runGoldCap + (save.meta.dailyCap ?? 0) * 400;
  let gold = Math.round(run.gold * loadout.goldIncome);
  if (gold > runCap) gold = Math.round(runCap + runCap * (1 - Math.exp(-(gold - runCap) / runCap))); // the same soft cap as relic stacking: at most twice the cap
  const curseCap = RUNES.dailyCaps.curseGold + loadout.dailyCap;
  const trialCap = RUNES.dailyCaps.trialGold + loadout.dailyCap;
  const cursePart = curses.length > 0 ? Math.round(gold * (1 - 1 / curseMult)) : 0;
  const curseAllowed = Math.min(cursePart, Math.max(0, curseCap - dailyGold.curse));
  gold -= cursePart - curseAllowed;
  const trialAllowed = run.daily ? Math.min(gold, Math.max(0, trialCap - dailyGold.trial)) : gold;
  gold = trialAllowed;
  // Runes: every Act boss slain pays, shards convert
  const actBosses = run.bosses.filter((b) => ACTS.bosses.includes(b)).length;
  let runes = 0;
  for (let i = 0; i < actBosses; i++) runes += runesForActBoss(i, save.meta);
  runes = Math.min(runes, RUNES.runCap + (save.meta.runeIncome ?? 0)) + (run.questRunes ?? 0); // v0.5: quest Runes are not capped
  const shards = save.runeShards + Math.round((run.salvage ?? 0) * (1 + loadout.salvageBonus));
  runes += Math.floor(shards / RUNES.shardsPerRune);
  const tierUnlocked = run.tier === save.tierUnlocked && run.wavesCleared >= TIER_UNLOCK_WAVE && save.tierUnlocked < TIERS.length - 1;
  const relicPicks = { ...save.relicPicks };
  for (const id of run.relicsFound ?? run.relics) relicPicks[id] = (relicPicks[id] ?? 0) + 1; // v0.4: every pickup and tier-up counts
  // class feats are kept as "the best a single run managed", so an achievement can ask for something within one run
  const feats = Object.fromEntries(FEAT_KEYS.map((k) => [k, Math.max(c[k], run.feats?.[k] ?? 0)])) as Record<FeatKey, number>;
  return {
    classXp,
    tierUnlocked,
    runes,
    gold,
    save: {
      ...save,
      gold: save.gold + gold,
      runes: save.runes + runes,
      dailyGold: { date, curse: dailyGold.curse + curseAllowed, trial: dailyGold.trial + (run.daily ? trialAllowed : 0) },
      classes: {
        ...save.classes,
        [run.classId]: { bestWave: Math.max(prev.bestWave, run.wave), runs: prev.runs + 1, kills: prev.kills + run.kills, time: prev.time + run.time, xp: prev.xp + classXp },
      },
      relicPicks,
      treasures: run.treasure
        ? { ...save.treasures, [run.classId]: advanceChain(run.classId, save.treasures[run.classId], run.treasure, { unlocked: masteryBonus(prev.xp).treasureStep, difficulty: run.tier, acts }) }
        : save.treasures,
      runeShards: Math.round(shards % RUNES.shardsPerRune),
      tierUnlocked: save.tierUnlocked + (tierUnlocked ? 1 : 0),
      daily: run.daily ? { ...save.daily, [run.daily]: Math.max(save.daily[run.daily] ?? 0, run.wave) } : save.daily,
      runs: keepRuns(save.runs, run.log && { ...run.log, at }),
      counters: {
        ...feats,
        kills: c.kills + run.kills,
        bosses: c.bosses + run.bosses.length,
        elites: c.elites + run.elites,
        goldEarned: c.goldEarned + run.gold,
        flawlessBosses: c.flawlessBosses + run.flawlessBosses,
        maxRelics: Math.max(c.maxRelics, run.relics.length),
        maxAbilityUpgrades: Math.max(c.maxAbilityUpgrades, run.abilityUpgrades),
        fastestWave10: run.wave10Time > 0 && (c.fastestWave10 === 0 || run.wave10Time < c.fastestWave10) ? run.wave10Time : c.fastestWave10,
        bossKinds: [...new Set([...c.bossKinds, ...run.bosses])],
        commanders: c.commanders + (run.commanders ?? 0),
        actsCleared: Math.max(c.actsCleared, acts),
        cursedActs: acts > 0 ? Math.max(c.cursedActs, curses.length) : c.cursedActs,
        dailies: c.dailies + (run.daily ? 1 : 0),
        quests: c.quests + (run.quests ?? 0),
        events: c.events + (run.events ?? 0),
      },
    },
  };
}
