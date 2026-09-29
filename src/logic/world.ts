// v0.10 (#190): what opens on the world map, a level's slots and ring step, and what a clear pays (config/world.ts)
import { ACTS, FINAL } from '../config/acts';
import { BOSSES, type BossKey } from '../config/bosses';
import { relicDef, type RelicId } from '../config/relics';
import { WAVES } from '../config/waves';
import { REALM_IDS, REALMS, WORLD, type CrownReward, type EndBoss, type LevelReward, type RealmId } from '../config/world';
import { actBoss, actOf, bossForWave, type BossDraw } from './acts';
import { expectedLevel } from './formulas';

// ---------- #191: the level runner's rules (systems/levels.ts plays them) ----------

/**
 * The head start's level at a level's first wave: the level the pace expects once wave `wave - 1` is cleared (BALANCE.md's "level at
 * the end of wave"). Decided: rounded, so 1, 6, 11, 15, 19, 21, 24 at waves 1, 6, 11, 16, 21, 26, 31.
 */
export const headStartLevel = (wave: number): number => Math.round(expectedLevel(wave));

/** Wings open by a start wave: the one this Act's mid-Act boss opens, once it is behind. Decided: quest wings are not counted. */
export const wingsOpenBy = (wave: number): number => ((wave - 1) % ACTS.length >= WAVES.bossEvery ? 1 : 0);

/**
 * A level's end boss on its last wave: a named one (config/bosses.ts), the Usurper, or the usual draw for 'pool' and for a realm boss not
 * built yet. Outside the Last Bastion a wave-40 draw is an Act boss, never the Usurper.
 */
export function levelBoss(end: EndBoss, wave: number, draw: BossDraw): BossKey | null {
  if (end.boss === 'usurper') return FINAL.boss;
  if (BOSSES[end.boss]) return end.boss;
  const key = bossForWave(wave, draw);
  return key === FINAL.boss ? actBoss(actOf(wave)) : key;
}

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
