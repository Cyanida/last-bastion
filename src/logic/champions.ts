// v0.10 (#193): save v7's champions, one per class (docs/road-to-the-crown.md rules 2 and 8). Read, validated and migrated here;
// the champion screen, the slot rules and the level runner build on this shape.
import { CLASSES, CLASS_ORDER, type ClassId } from '../config/classes';
import { META, TIERS } from '../config/economy';
import { isCursedRelic, RELIC_IDS, relicDef, SIGNATURE, type FamilyId, type RelicId } from '../config/relics';
import { REALM_IDS, REALMS, WORLD, type CrownReward, type LevelReward, type RealmId } from '../config/world';
import { masteryBonus, type MetaRanks } from './economy';
import { championPool, lockedIn } from './relics';
import type { RunLog } from './runlog';
import { newRealmRun, readRealmRun, type RealmRun } from './realmRun';
import { newGrowth, readGrowth, type ChampionGrowth } from './championLevels';
import { isCrowned, keepLockedOptions, realmOpen, roadTier, slotsFor, type WorldProgress } from './world';

export interface Champion extends ChampionGrowth { // #238: its XP, level and spent points (logic/championLevels.ts)
  name: string;
  inventory: RelicId[]; // the relics it owns, to fill a level's starting slots from
  loadouts: Partial<Record<RealmId, RelicId[]>>; // the slots last filled per realm; a level with fewer slots takes the first ones
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
  name: championName(name, classId), inventory: [], loadouts: {}, world: {}, signature: false, lastBastion: false, runs: {}, ...newGrowth(),
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
  // #238: its XP, level and spent points; a v7 champion starts at the level its crowns and cleared levels would have given
  return { ...c, ...readGrowth(raw, classId, c.world) };
}

/** Save v7's champions from a stored map (a v7 save). */
export function readChampions(raw: unknown): Partial<Record<ClassId, Champion>> {
  if (!isObj(raw)) return {};
  return Object.fromEntries(CLASS_ORDER.filter((id) => isObj(raw[id])).map((id) => [id, readChampion(raw[id], id)]));
}

/**
 * v6 -> v7 (rule 8): every class the save has played becomes a champion. A v6 save counts relic picks for the whole account, not per
 * class, so each gets every relic it could have picked: all the account's picked family relics, less other classes' class relics.
 * No relic is lost. A class with a win gets the Last Bastion open; its last logged run's talents become its talents, as far as its
 * points reach (#238: a run takes as many as the champion has points for).
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
 * Veteran Levies (and the Seasoned mastery rank) add levels: in a realm level their growth, on top of the champion's (#238).
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
export type SlotBlock = 'cursed' | 'otherClass' | 'slotted' | 'slots' | 'double' | 'family' | 'legendary' | 'classRelics';

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
  const used = loadout.reduce((n, r) => n + slotCost(r), 0);
  if (used + slotCost(id) > slots) return used < slots ? 'double' : 'slots'; // #239: 'double', a legendary with one slot free: it takes two
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

/** #237: the level a realm is played at on `tier`: its run's checkpoint, else level 1 (a realm run always starts at wave 1: no head start). */
export const runLevel = (c: Champion, realm: RealmId, tier: number): number => (c.runs[realm]?.tier === tier ? c.runs[realm]!.level : 1);

/** #237: can `level` be played now? Only where the realm's run stands, or level 1 (which starts the run, or starts it over). */
export const runStarts = (c: Champion, realm: RealmId, level: number, tier: number): boolean => level === 1 || !!runAt(c, realm, level, tier);

/**
 * #237: the run a fight at `level` plays: the one standing there, as it is (its seed and carry: a Continue, or a restart after a death),
 * else a new run from level 1 on `seed` (it replaces the realm's run in progress; #242 asks first).
 */
export const runFor = (c: Champion, realm: RealmId, level: number, tier: number, seed: number): RealmRun => runAt(c, realm, level, tier) ?? newRealmRun(tier, seed);

/**
 * The level the champion screen's PLAY starts: the first built realm (REALM_IDS order) open to the champion and not crowned on the tier it
 * would play, at its realm run's checkpoint, or level 1 with no run in progress (#237). Decided: with every open realm crowned, the last open one (a replay).
 */
export function nextStop(c: Champion, tier: number): { realm: RealmId; level: number; tier: number } {
  const open = REALM_IDS.filter((r) => championRealmOpen(c, r));
  const todo = (r: RealmId) => !isCrowned(c.world, r, roadTier(c.world, r, tier));
  // #258: a built realm first (an unbuilt one is a stand-in); one not crowned yet, else the last built one to replay, else the old pick
  const built = open.filter((r) => REALMS[r].built);
  const realm = built.find(todo) ?? built[built.length - 1] ?? open.find(todo) ?? open[open.length - 1];
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

// ---------- #219: a relic realm's rewards ----------

/**
 * A relic realm level's 'keepLocked' pick: the champion's locked relics of the families held when the level ended (logic/world
 * keepLockedOptions), WORLD.keepLockedOf at most, the ones it held first (the pick keeps one of them). Decided: rares only, since the
 * crown gives the legendaries and level 3 the class relic. Empty: the level pays WORLD.keepLockedRunes Runes instead.
 */
export function keepLockedPick(c: Champion, classId: ClassId, family: FamilyId | undefined, held: RelicId[], of = WORLD.keepLockedOf): RelicId[] {
  const locked = lockedIn(championPool(classId, c.inventory, family), c.inventory).filter((id) => { const d = relicDef(id); return d.rarity === 'rare' && !d.classId && !d.signature; });
  const opts = keepLockedOptions(held, locked);
  return [...opts.filter((id) => held.includes(id)), ...opts.filter((id) => !held.includes(id))].slice(0, of);
}

/**
 * #257: the sentence on a keep-locked level's reward when keepLockedPick is empty, saying which of its two reasons applies: no rare of
 * the family left to win (all owned), or none of the family held when the level ended (keepLockedOptions keeps only held families).
 */
export function keepLockedEmptyText(c: Champion, classId: ClassId, family: FamilyId, name: string, runes = WORLD.keepLockedRunes): string {
  const none = lockedIn(championPool(classId, c.inventory, family), c.inventory).every((id) => { const d = relicDef(id); return d.rarity !== 'rare' || !!d.classId || !!d.signature; });
  return none
    ? `You already own every ${name} relic this level offers, so you get ${runes} Runes instead.`
    : `You held no ${name} relic when the level ended, so there is none to keep, and you get ${runes} Runes instead.`;
}

/** The champion's class relic of a family (every class has one per family), or null. */
export const classRelicOf = (classId: ClassId, family: FamilyId | undefined): RelicId | null =>
  RELIC_IDS.find((id) => relicDef(id).family === family && relicDef(id).classId === classId) ?? null;

/** A family's legendaries (two per realm family): the Knight crown's pick is those the champion doesn't own yet. */
export const legendaryPickOptions = (c: Champion, family: FamilyId | undefined): RelicId[] =>
  RELIC_IDS.filter((id) => relicDef(id).family === family && relicDef(id).rarity === 'legendary' && !relicDef(id).classId && !c.inventory.includes(id));

/**
 * The relics a clear's rewards give with no choice, as `c` stood before it: the signature relic (the Marches crown), the class relic of
 * the realm's family (level 3), and the Champion crown's "other" legendary (the first one it doesn't own: the Knight crown's pick took the
 * other). One already owned (a v6 save brought it) gives nothing.
 */
export function rewardRelics(c: Champion, classId: ClassId, family: FamilyId | undefined, rewards: (LevelReward | CrownReward)[]): RelicId[] {
  const out: RelicId[] = [];
  for (const r of rewards) {
    const id = r.kind === 'signature' ? (c.signature ? null : SIGNATURE.relic[classId]) : r.kind === 'classRelic' ? classRelicOf(classId, family) : r.kind === 'legendaryOther' ? legendaryPickOptions(c, family)[0] ?? null : null;
    if (id && !c.inventory.includes(id) && !out.includes(id)) out.push(id);
  }
  return out;
}

/** Bank a clear's rewards with no choice (rewardRelics); the picks (a rare, a locked relic, a legendary) come on their screens. */
export function grantRewards(c: Champion, classId: ClassId, family: FamilyId | undefined, rewards: (LevelReward | CrownReward)[]): Champion {
  const got = rewardRelics(c, classId, family, rewards).reduce((ch, id) => grantRelic(ch, id), c);
  return rewards.some((r) => r.kind === 'signature') ? { ...got, signature: true } : got; // #201: the signature relic is won
}
