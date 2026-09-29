// v0.10 (#193): save v7's champions, one per class (docs/road-to-the-crown.md rules 2 and 8). Read, validated and migrated here;
// the champion screen, the slot rules and the level runner build on this shape.
import { CLASSES, CLASS_ORDER, type ClassId } from '../config/classes';
import { META, TIERS } from '../config/economy';
import { isCursedRelic, RELIC_IDS, relicDef, SIGNATURE, type FamilyId, type RelicId } from '../config/relics';
import { TALENT_BY_ID } from '../config/talents';
import { REALM_IDS, REALMS, WORLD, type RealmId } from '../config/world';
import { masteryBonus, type MetaRanks } from './economy';
import type { RunLog } from './runlog';
import { readRealmRun, type RealmRun } from './realmRun';
import { isCrowned, nextLevel, realmOpen, roadTier, slotsFor, type WorldProgress } from './world';

export interface Champion {
  name: string;
  inventory: RelicId[]; // the relics it owns, to fill a level's starting slots from
  loadouts: Partial<Record<RealmId, RelicId[]>>; // the slots last filled per realm; a level with fewer slots takes the first ones
  talentPlan: string[]; // talent ids in the order the head start spends points on them
  world: WorldProgress; // levels cleared and crowns, per realm and tier (logic/world.ts)
  signature: boolean; // its signature relic is won (the Marches crown); the relic itself is the class's own
  lastBastion: boolean; // the Last Bastion is open whatever its crowns: a class that won a v6 run
  runs: Partial<Record<RealmId, RealmRun>>; // v0.11 (#237, save v8): its unfinished realm runs, one per realm, at their checkpoints
}

export const MAX_NAME = 24;
/** Letters, digits, spaces and a little punctuation: an imported save can't carry markup into the page (#105). */
export const championName = (v: unknown, classId: ClassId): string =>
  (typeof v === 'string' ? v.replace(/[^\p{L}\p{N} '’.-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME) : '') || CLASSES[classId].name;

export const newChampion = (classId: ClassId, name?: string): Champion => ({
  name: championName(name, classId), inventory: [], loadouts: {}, talentPlan: [], world: {}, signature: false, lastBastion: false, runs: {},
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
      const slots = fitLoadout(classId, relics(raw.loadouts[r], (id) => c.inventory.includes(id)), WORLD.maxSlots, r === 'lastBastion');
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
  if (c.signature && !c.inventory.includes(SIGNATURE.relic[classId])) c.inventory.push(SIGNATURE.relic[classId]); // #201: won, so owned
  c.lastBastion = raw.lastBastion === true;
  if (isObj(raw.runs))
    for (const r of REALM_IDS) {
      const run = readRealmRun(raw.runs[r], r);
      if (run) c.runs[r] = run;
    }
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

/** #201: the Marches crown's reward: the champion's signature relic joins its inventory (once). */
export const grantSignature = (c: Champion, classId: ClassId): Champion =>
  c.signature ? c : { ...c, signature: true, inventory: [...c.inventory, SIGNATURE.relic[classId]] };

/** v0.10 (#194): a champion's relics never picked on this save (`picks`: save.relicPicks), offered 3x as often until first picked (rule 5). */
export const freshRelics = (c: Champion, picks: Partial<Record<RelicId, number>>): RelicId[] => c.inventory.filter((id) => !(picks[id] ?? 0));

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

// ---------- #195: the slot rules (rule 4) ----------

/** A relic's cost in slots: a legendary takes WORLD.loadout.legendarySlots. */
export const slotCost = (id: RelicId): number => (relicDef(id).rarity === 'legendary' ? WORLD.loadout.legendarySlots : 1);

/** Why a relic can't be slotted: the champion screen names it. */
export type SlotBlock = 'cursed' | 'otherClass' | 'slotted' | 'slots' | 'family' | 'legendary' | 'classRelics';

/**
 * Why `id` can't join `loadout` in `slots` slots, or null when it fits (rule 4): no cursed relic, no other class's relic, at most 4 of one
 * family, a legendary takes 2 slots and at most 1 goes in (2 in the Last Bastion, `finale`), at most 2 class relics. Duos are not limited.
 * #201: the signature relic takes 1 slot and is not one of the class relics (it has no family either).
 */
export function slotBlock(classId: ClassId, loadout: RelicId[], id: RelicId, slots: number, finale = false): SlotBlock | null {
  const def = relicDef(id);
  const rule = WORLD.loadout;
  const count = (f: (d: ReturnType<typeof relicDef>) => boolean) => loadout.filter((r) => f(relicDef(r))).length;
  if (isCursedRelic(id)) return 'cursed';
  if (!ownable(classId, id)) return 'otherClass';
  if (loadout.includes(id)) return 'slotted';
  if (loadout.reduce((n, r) => n + slotCost(r), slotCost(id)) > slots) return 'slots';
  if (def.family && count((d) => d.family === def.family) >= rule.perFamily) return 'family';
  if (def.rarity === 'legendary' && count((d) => d.rarity === 'legendary') >= (finale ? rule.legendariesFinale : rule.legendaries)) return 'legendary';
  if (def.classId && !def.signature && count((d) => !!d.classId && !d.signature) >= rule.classRelics) return 'classRelics';
  return null;
}

/** A loadout cut to the rules for `slots` slots: in order, every relic that still fits. A level with fewer slots takes the first ones. */
export const fitLoadout = (classId: ClassId, ids: RelicId[], slots: number, finale = false): RelicId[] =>
  ids.reduce<RelicId[]>((out, id) => (slotBlock(classId, out, id, slots, finale) ? out : [...out, id]), []);

// ---------- #197: the champion screen ----------

/** #237: the realm run standing at `level` of `realm` on `tier` (its checkpoint), if the champion has one. */
export const runAt = (c: Champion, realm: RealmId, level: number, tier: number): RealmRun | undefined => {
  const run = c.runs[realm];
  return run && run.level === level && run.tier === tier ? run : undefined;
};

/** #237: the level a realm goes on at on `tier`: its run's checkpoint, else the first level not cleared. */
export const runLevel = (c: Champion, realm: RealmId, tier: number): number => (c.runs[realm]?.tier === tier ? c.runs[realm]!.level : nextLevel(c.world, realm, tier));

/**
 * The level the champion screen's PLAY starts: the first realm (REALM_IDS order) open to the champion and not crowned on the tier it
 * would play, at its first level not cleared (#237: or its realm run's checkpoint). Decided: with every open realm crowned, the last open one's last level (a replay).
 */
export function nextStop(c: Champion, tier: number): { realm: RealmId; level: number; tier: number } {
  const open = REALM_IDS.filter((r) => championRealmOpen(c, r));
  const realm = open.find((r) => !isCrowned(c.world, r, roadTier(c.world, r, tier))) ?? open[open.length - 1];
  const t = roadTier(c.world, realm, tier);
  return { realm, level: runLevel(c, realm, t), tier: t };
}

/**
 * The six slots around the pedestal for a saved loadout: each relic in its slot (a legendary also fills the next one, `second`), then the
 * empty ones. `live`: the relic goes into a level with `slots` slots (fitLoadout, so one that no longer fits is left out and a later one
 * still goes in), or the empty slot is one of the level's.
 */
export function slotView(classId: ClassId, loadout: RelicId[], slots: number, finale = false): { id: RelicId | null; second: boolean; live: boolean }[] {
  const goes = fitLoadout(classId, loadout, slots, finale);
  const out: { id: RelicId | null; second: boolean; live: boolean }[] = loadout.flatMap((id) => [{ id, second: false, live: goes.includes(id) }, ...(slotCost(id) > 1 ? [{ id, second: true, live: goes.includes(id) }] : [])]);
  const used = goes.reduce((n, id) => n + slotCost(id), 0);
  for (let i = 0, empty = WORLD.maxSlots - out.length; i < empty; i++) out.push({ id: null, second: false, live: i < slots - used });
  return out.slice(0, WORLD.maxSlots);
}

// ---------- #200: the Marches' rare pick ----------

/**
 * A Marches level's first-clear pick (its 'rarePick' reward): the family's rares any class can find that the champion doesn't own yet,
 * `of` at most. Decided: none left (a v6 save brought them all) pays WORLD.keepLockedRunes Runes instead, as a keep-locked level does.
 */
export const rarePickOptions = (c: Champion, family: FamilyId, of: number): RelicId[] =>
  RELIC_IDS.filter((id) => { const d = relicDef(id); return d.family === family && d.rarity === 'rare' && !d.classId && !c.inventory.includes(id); }).slice(0, of);

/** A reward relic joins the champion's inventory (relics found in a run never do). */
export const grantRelic = (c: Champion, id: RelicId): Champion => (c.inventory.includes(id) ? c : { ...c, inventory: [...c.inventory, id] });
