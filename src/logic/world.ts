// v0.10 (#190): what opens on the world map, a level's slots and ring step, and what a clear pays (config/world.ts)
import { relicDef, type RelicId } from '../config/relics';
import { REALM_IDS, REALMS, WORLD, type CrownReward, type LevelReward, type RealmId } from '../config/world';

/** One champion's world progress: per realm, the highest level cleared on each tier (index into config/economy TIERS). */
export type WorldProgress = Partial<Record<RealmId, number[]>>;

/** The highest level of `realm` cleared on `tier` or any higher one: a Knight clear counts as a Squire clear too. */
export function bestCleared(p: WorldProgress, realm: RealmId, tier: number): number {
  return Math.max(0, ...(p[realm] ?? []).slice(tier));
}

/** Crowned: its last level cleared on `tier` or higher (by default on any tier). */
export const isCrowned = (p: WorldProgress, realm: RealmId, tier = 0): boolean => bestCleared(p, realm, tier) >= REALMS[realm].levels.length;

export const crownedRealms = (p: WorldProgress): RealmId[] => REALM_IDS.filter((r) => isCrowned(p, r));

/** A realm opens with its count of crowns (any tier), `fromRing` of them from that ring. */
export function realmOpen(p: WorldProgress, realm: RealmId): boolean {
  const { crowns, fromRing } = REALMS[realm].opens;
  const won = crownedRealms(p);
  return won.length >= crowns && (!fromRing || won.filter((r) => REALMS[r].ring === fromRing[0]).length >= fromRing[1]);
}

/** Squire and Knight open with the realm; Champion once it is crowned on Knight, Legend once crowned on Champion. */
export const tierOpen = (p: WorldProgress, realm: RealmId, tier: number): boolean => realmOpen(p, realm) && (tier < 2 || isCrowned(p, realm, tier - 1));

/** Levels open in order on each tier: level n (1-based) once n - 1 is cleared on that tier or higher. */
export const levelOpen = (p: WorldProgress, realm: RealmId, level: number, tier: number): boolean =>
  level >= 1 && level <= REALMS[realm].levels.length && tierOpen(p, realm, tier) && bestCleared(p, realm, tier) >= level - 1;

/** Starting relic slots: the level's own plus `extra` (Armorer's Choice, the Keepsake rank), up to WORLD.maxSlots. */
export const slotsFor = (realm: RealmId, level: number, extra = 0): number => Math.min(WORLD.maxSlots, REALMS[realm].levels[level - 1].slots + extra);

/** Enemy HP and damage multipliers for the realm's ring (the finale is ring 5). */
export function ringStep(realm: RealmId): { hp: number; damage: number } {
  const i = REALMS[realm].ring - 1;
  return { hp: WORLD.ringStep.hp[i], damage: WORLD.ringStep.damage[i] };
}

/** What clearing `level` on `tier` pays, judged by the progress before it: the level's reward on its first clear on any tier, the crown's on a first crown. */
export function clearRewards(p: WorldProgress, realm: RealmId, level: number, tier: number): { level: LevelReward[]; crown: CrownReward[] } {
  const def = REALMS[realm];
  const reward = def.levels[level - 1].reward;
  const out = { level: reward && bestCleared(p, realm, 0) < level ? [reward] : [], crown: [] as CrownReward[] };
  if (level === def.levels.length) {
    if (!isCrowned(p, realm)) out.crown.push(...def.crown.first);
    if (!isCrowned(p, realm, tier)) out.crown.push(...def.crown.tiers[tier]);
  }
  return out;
}

/** Fold one clear into the progress (a new object; the old one is untouched). */
export function recordClear(p: WorldProgress, realm: RealmId, level: number, tier: number): WorldProgress {
  const best = [...(p[realm] ?? [])];
  while (best.length <= tier) best.push(0);
  best[tier] = Math.max(best[tier], level);
  return { ...p, [realm]: best };
}

/**
 * A 'keepLocked' reward's choice: the locked relics of the families held when the level ended. Empty: the level pays
 * WORLD.keepLockedRunes instead.
 */
export function keepLockedOptions(held: RelicId[], locked: RelicId[]): RelicId[] {
  const families = new Set(held.map((id) => relicDef(id).family).filter((f) => f));
  return locked.filter((id) => families.has(relicDef(id).family));
}

/**
 * #198: the world progress a save holds. Save v7 (another issue) adds it; until then, and for any save without it, the progress is
 * empty, so only the Marches are open. Wire the save's field in here once it lands.
 */
export const saveWorldProgress = (save: object): WorldProgress => (save as { world?: WorldProgress }).world ?? {};

/** What opens a shut realm, in words for the map: "Opens with 5 crowns, one from the Frozen Pass or the Stormspire". */
export function opensText(realm: RealmId): string {
  const { crowns, fromRing } = REALMS[realm].opens;
  const from = fromRing ? REALM_IDS.filter((r) => REALMS[r].ring === fromRing[0]).map((r) => REALMS[r].name.replace(/^The /, 'the ')) : [];
  return `Opens with ${crowns} crown${crowns === 1 ? '' : 's'}${fromRing ? `, ${fromRing[1] === 1 ? 'one' : fromRing[1]} from ${from.join(' or ')}` : ''}`;
}

/** The world map's realms, in REALM_IDS order: open, or still under clouds with what opens it. */
export const mapRealms = (p: WorldProgress): { id: RealmId; name: string; open: boolean; opens: string }[] =>
  REALM_IDS.map((id) => ({ id, name: REALMS[id].name, open: realmOpen(p, id), opens: opensText(id) }));
