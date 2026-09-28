// v0.10 (#193): save v7's champions, one per class (docs/road-to-the-crown.md rules 2 and 8). Read, validated and migrated here;
// the champion screen, the slot rules and the level runner build on this shape.
import { CLASSES, CLASS_ORDER, type ClassId } from '../config/classes';
import { META, TIERS } from '../config/economy';
import { isCursedRelic, RELIC_IDS, relicDef, type RelicId } from '../config/relics';
import { TALENT_BY_ID } from '../config/talents';
import { REALM_IDS, REALMS, WORLD, type RealmId } from '../config/world';
import { masteryBonus, type MetaRanks } from './economy';
import type { RunLog } from './runlog';
import { realmOpen, slotsFor, type WorldProgress } from './world';

export interface Champion {
  name: string;
  inventory: RelicId[]; // the relics it owns, to fill a level's starting slots from
  loadouts: Partial<Record<RealmId, RelicId[]>>; // the slots last filled per realm; a level with fewer slots takes the first ones
  talentPlan: string[]; // talent ids in the order the head start spends points on them
  world: WorldProgress; // levels cleared and crowns, per realm and tier (logic/world.ts)
  signature: boolean; // its signature relic is won (the Marches crown); the relic itself is the class's own
  lastBastion: boolean; // the Last Bastion is open whatever its crowns: a class that won a v6 run
}

export const MAX_NAME = 24;
/** Letters, digits, spaces and a little punctuation: an imported save can't carry markup into the page (#105). */
export const championName = (v: unknown, classId: ClassId): string =>
  (typeof v === 'string' ? v.replace(/[^\p{L}\p{N} '’.-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME) : '') || CLASSES[classId].name;

export const newChampion = (classId: ClassId, name?: string): Champion => ({
  name: championName(name, classId), inventory: [], loadouts: {}, talentPlan: [], world: {}, signature: false, lastBastion: false,
});

/** A relic a champion can own: not cursed, and not another class's class relic. */
export const ownable = (classId: ClassId, id: RelicId): boolean => !isCursedRelic(id) && (!relicDef(id).classId || relicDef(id).classId === classId);

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const int = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const relics = (v: unknown, keep: (id: RelicId) => boolean): RelicId[] =>
  Array.isArray(v) ? [...new Set(v)].filter((id): id is RelicId => RELIC_IDS.includes(id as RelicId) && keep(id as RelicId)) : [];

/** Any stored value -> a valid champion of `classId`. */
export function readChampion(raw: unknown, classId: ClassId): Champion {
  const c = newChampion(classId);
  if (!isObj(raw)) return c;
  c.name = championName(raw.name, classId);
  c.inventory = relics(raw.inventory, (id) => ownable(classId, id));
  if (isObj(raw.loadouts))
    for (const r of REALM_IDS) {
      const slots = relics(raw.loadouts[r], (id) => c.inventory.includes(id)).slice(0, WORLD.maxSlots);
      if (slots.length) c.loadouts[r] = slots;
    }
  if (Array.isArray(raw.talentPlan)) c.talentPlan = [...new Set(raw.talentPlan)].filter((t): t is string => typeof t === 'string' && TALENT_BY_ID[t]?.classId === classId);
  if (isObj(raw.world))
    for (const r of REALM_IDS) {
      const tiers = raw.world[r];
      if (!Array.isArray(tiers)) continue;
      const best = TIERS.map((_, t) => Math.min(REALMS[r].levels.length, int(tiers[t])));
      while (best.length && !best[best.length - 1]) best.pop(); // only real clears, so reading a save twice changes nothing
      if (best.length) c.world[r] = best;
    }
  c.signature = raw.signature === true;
  c.lastBastion = raw.lastBastion === true;
  return c;
}

/** Save v7's champions from a stored map (a v7 save). */
export function readChampions(raw: unknown): Partial<Record<ClassId, Champion>> {
  if (!isObj(raw)) return {};
  return Object.fromEntries(CLASS_ORDER.filter((id) => isObj(raw[id])).map((id) => [id, readChampion(raw[id], id)]));
}

/**
 * v6 -> v7 (rule 8): every class the save has played becomes a champion. A v6 save counts relic picks for the whole account, not per
 * class, so each gets every relic it could have picked: all the account's picked family relics, less other classes' class relics.
 * No relic is lost. A class with a win gets the Last Bastion open; its last logged run's talents become its talent plan.
 */
export function championsFromV6(
  classes: Record<ClassId, { runs: number }>,
  relicPicks: Partial<Record<RelicId, number>>,
  wins: Record<ClassId, number>,
  runs: RunLog[],
): Partial<Record<ClassId, Champion>> {
  const picked = RELIC_IDS.filter((id) => (relicPicks[id] ?? 0) > 0);
  const out: Partial<Record<ClassId, Champion>> = {};
  for (const id of CLASS_ORDER) {
    if (classes[id].runs <= 0) continue;
    const last = runs.filter((r) => r.classId === id).at(-1);
    out[id] = readChampion({ inventory: picked, talentPlan: last?.talents ?? [], lastBastion: wins[id] > 0 }, id);
  }
  return out;
}

/** The Last Bastion also opens for a champion carried over with a win; every other realm by its crowns. */
export const championRealmOpen = (c: Champion, realm: RealmId): boolean => (realm === 'lastBastion' && c.lastBastion) || realmOpen(c.world, realm);

/**
 * The Keep and mastery, repurposed for levels (rule 8): Armorer's Choice and the Keepsake mastery rank each add a starting slot;
 * Veteran Levies (and the Seasoned mastery rank) add levels on top of the head start.
 */
export function championBonus(meta: MetaRanks, classXp: number): { slots: number; levels: number } {
  const mastery = masteryBonus(classXp);
  return {
    slots: ((meta.startRelic ?? 0) > 0 ? 1 : 0) + (mastery.relic ? 1 : 0),
    levels: Math.min(META.startLevel.max, meta.startLevel ?? 0) * META.startLevel.perRank + mastery.startLevel,
  };
}

/** A level's starting slots for a champion with this Keep and class XP. */
export const championSlots = (meta: MetaRanks, classXp: number, realm: RealmId, level: number): number => slotsFor(realm, level, championBonus(meta, classXp).slots);
