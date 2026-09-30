// v0.11 (#237): a realm is one run, split into its levels (docs/road-to-the-crown.md rule 3, as changed on 29-09). What the run gains in a
// level (relics and their tiers, gold, the build) stays for the realm's later levels; every cleared level is a checkpoint in the save, and
// a death plays that level again from it: the state it entered with, the same seed, so the same opening offers.
// systems/levels.ts takes the carry from a game and puts it into the next one; the save keeps one run per champion per realm.
import { ABILITY_UPGRADES, type AbilityUpgradeId } from '../config/abilityUpgrades';
import { EVOLUTION_IDS, type EvolutionId } from '../config/evolutions';
import { DUO_IDS, RELIC_IDS, type DuoId, type RelicId } from '../config/relics';
import { TALENT_BY_ID } from '../config/talents';
import { UTILITY_UPGRADES, type UtilityUpgradeId } from '../config/utility';
import { REALMS, type RealmId } from '../config/world';
import { TIERS } from '../config/economy';
import { CHAMPION_STATS, type StatPoints } from '../config/champion';
import { STAT_KEYS, type RelicSource, type StatKey } from '../core/types';

/**
 * The run's state entering a level: everything the levels before it gained. Decided: HP refills and the level's own finds start empty.
 * #238: the build is the champion's; the carry notes the champion level and stat points its stats hold, so what the champion gained or
 * spent since goes on top at the next level (systems/levels.ts applyChampion).
 */
export interface RunCarry {
  level: number; // the champion's level the run holds (#238): a level gained since is grown on entering the next level
  points: StatPoints; // #238: the champion's stat points the run's stats hold, the same way
  stats: Record<string, number>; // Stats, with the level-ups, talents and relic HP cuts already in
  baseMods: Record<string, number>; // Mods: the tradeoffs taken
  upgrades: AbilityUpgradeId[];
  talents: string[];
  utilityUpgrades: UtilityUpgradeId[];
  evolutions: EvolutionId[];
  revives: number;
  relics: { held: RelicId[]; tiers: Partial<Record<RelicId, number>>; attune: Partial<Record<RelicId, number>>; from: Partial<Record<RelicId, RelicSource>>; duos: DuoId[]; cursedAct: number };
  gold: number;
  talentPoints: number; // the run's own (a quest's reward), not the champion's
  rerolls: number;
  banishes: number;
  bannedStats: StatKey[];
  vars: Record<string, number>; // run flags the build set (tradeoffs taken, the relics' HP cuts, the Phoenix's one revive)
}

/** One unfinished realm run: the level it goes on at (its checkpoint), on which tier, that level's seed, and the carry into it. */
export interface RealmRun {
  level: number;
  tier: number;
  seed: number;
  carry: RunCarry | null; // null at level 1 only: a fresh start from the loadout. There is no head start: a later level always has its carry
}

export const newRealmRun = (tier: number, seed: number): RealmRun => ({ level: 1, tier, seed, carry: null });

/** A cleared level's checkpoint: the next level with the run as it stands (`seed` is that level's). The realm's last level ends the run: null. */
export const checkpoint = (run: RealmRun, realm: RealmId, carry: RunCarry, seed: number): RealmRun | null =>
  run.level >= REALMS[realm].levels.length ? null : { level: run.level + 1, tier: run.tier, seed: seed >>> 0, carry };

// ---------- reading a stored run (save v8): any value -> a valid run or none ----------

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const count = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const ids = <T extends string>(v: unknown, known: readonly T[] | ((id: string) => boolean)): T[] =>
  Array.isArray(v) ? [...new Set(v)].filter((x): x is T => typeof x === 'string' && (typeof known === 'function' ? known(x) : known.includes(x as T))) : [];
const numbers = (v: unknown, keep: (k: string) => boolean = () => true): Record<string, number> =>
  isObj(v) ? Object.fromEntries(Object.entries(v).filter(([k, x]) => keep(k) && typeof x === 'number' && Number.isFinite(x))) as Record<string, number> : {};
const SOURCES: RelicSource[] = ['boss', 'lair', 'strongbox', 'quest', 'merchant', 'start', 'loadout', 'other'];

export function readCarry(raw: unknown): RunCarry | null {
  if (!isObj(raw) || !isObj(raw.relics) || !isObj(raw.stats)) return null;
  const r = raw.relics;
  const held = ids<RelicId>(r.held, RELIC_IDS);
  const perHeld = (v: unknown) => numbers(v, (k) => held.includes(k as RelicId)) as Partial<Record<RelicId, number>>;
  const from = isObj(r.from) ? Object.fromEntries(held.filter((id) => SOURCES.includes((r.from as Record<string, RelicSource>)[id])).map((id) => [id, (r.from as Record<string, RelicSource>)[id]])) : {};
  return {
    level: Math.max(1, count(raw.level)),
    points: Object.fromEntries(CHAMPION_STATS.map((s) => [s, count(isObj(raw.points) ? raw.points[s] : 0)]).filter(([, n]) => n)) as StatPoints,
    stats: numbers(raw.stats, (k) => STAT_KEYS.includes(k as StatKey)),
    baseMods: numbers(raw.baseMods),
    upgrades: ids<AbilityUpgradeId>(raw.upgrades, (id) => Object.hasOwn(ABILITY_UPGRADES, id)),
    talents: ids<string>(raw.talents, (id) => Object.hasOwn(TALENT_BY_ID, id)),
    utilityUpgrades: ids<UtilityUpgradeId>(raw.utilityUpgrades, (id) => Object.hasOwn(UTILITY_UPGRADES, id)),
    evolutions: ids<EvolutionId>(raw.evolutions, EVOLUTION_IDS),
    revives: count(raw.revives),
    relics: { held, tiers: perHeld(r.tiers), attune: perHeld(r.attune), from, duos: ids<DuoId>(r.duos, DUO_IDS), cursedAct: count(r.cursedAct) },
    gold: count(raw.gold),
    talentPoints: count(raw.talentPoints),
    rerolls: count(raw.rerolls),
    banishes: count(raw.banishes),
    bannedStats: ids<StatKey>(raw.bannedStats, STAT_KEYS),
    vars: numbers(raw.vars),
  };
}

/** A stored realm run of `realm`, or null (none, or not one this realm can hold). */
export function readRealmRun(raw: unknown, realm: RealmId): RealmRun | null {
  if (!isObj(raw)) return null;
  const level = count(raw.level);
  if (level < 1 || level > REALMS[realm].levels.length) return null;
  const carry = level > 1 ? readCarry(raw.carry) : null;
  if (level > 1 && !carry) return null; // a run past level 1 is its checkpoint; without one the realm starts again at level 1
  return { level, tier: Math.min(TIERS.length - 1, count(raw.tier)), seed: count(raw.seed) >>> 0, carry };
}
