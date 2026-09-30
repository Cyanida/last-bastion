import type { DamageSource } from '../core/types';
import { ARMOR, BACK_ARC, PLATES, BOSS_RESOLVE, RESISTS, STATUS_TUNING, STATUSES, type DamageType, type StatusId } from '../config/damage';
import type { EnemyId } from '../config/enemies';
import { angleDiff } from '../core/math';

/** Pure status-effect and damage-type rules, shared by enemies, the player and minions. */

export interface StatusInst {
  stacks: number;
  time: number;
  power: number; // damage per second per stack, for damage-over-time effects
  by?: string; // v0.7: the relic or duo that last put it on (its ticks are credited to it)
}
export type StatusMap = Partial<Record<StatusId, StatusInst>> & { immune?: Partial<Record<StatusId, number>> };

export interface StatusApply {
  id: StatusId;
  stacks?: number;
  time?: number;
  power?: number;
  max?: number; // v0.7: a higher stack cap for this application (Flame's Stoked)
}

/** Applies one effect following its stacking rule. Returns 'frozen' when Chilled stacks tipped over into a freeze. */
export function applyStatusTo(map: StatusMap, a: StatusApply, boss = false): 'applied' | 'immune' | 'frozen' {
  const def = STATUSES[a.id];
  if ((boss && def.bossImmune) || (map.immune?.[a.id] ?? 0) > 0) return 'immune';
  const time = a.time ?? def.duration;
  const power = a.power ?? 0;
  const cur = map[a.id];
  const max = Math.max(def.maxStacks, a.max ?? 0);
  if (!cur) map[a.id] = { stacks: Math.min(max, a.stacks ?? 1), time, power };
  else if (def.stacking === 'stacks') Object.assign(cur, { stacks: Math.min(max, cur.stacks + (a.stacks ?? 1)), time: Math.max(cur.time, time), power: Math.max(cur.power, power) });
  else if (def.stacking === 'strongest') Object.assign(cur, { power: Math.max(cur.power, power), time: Math.min(STATUS_TUNING.poisonMaxTime, cur.time + time) });
  else cur.time = Math.max(cur.time, time);

  if (a.id === 'slow' && map.slow!.stacks >= STATUS_TUNING.freezeAt) {
    delete map.slow;
    map.stun = { stacks: 1, time: Math.max(map.stun?.time ?? 0, STATUS_TUNING.freezeTime), power: 0 };
    map.immune = { ...map.immune, slow: STATUS_TUNING.freezeImmunity };
    return 'frozen';
  }
  return 'applied';
}

export const STATUS_IDS = Object.keys(STATUSES) as StatusId[];

/** Advances timers; returns damage-over-time per type into `dots` (reused by the caller: no allocation per enemy per tick). */
export function tickStatuses(map: StatusMap, dt: number, dots: Partial<Record<DamageType, number>> = {}): Partial<Record<DamageType, number>> {
  for (const id of STATUS_IDS) {
    const s = map[id];
    if (!s) continue;
    const dot = STATUSES[id].dot;
    if (dot) dots[dot] = (dots[dot] ?? 0) + s.power * s.stacks * Math.min(dt, s.time);
    if ((s.time -= dt) <= 0) {
      delete map[id];
      if (id === 'stun') map.immune = { ...map.immune, stun: STATUS_TUNING.stunImmunity }; // no stun-locking
    }
  }
  if (map.immune) for (const id of Object.keys(map.immune) as StatusId[]) if ((map.immune[id]! -= dt) <= 0) delete map.immune[id];
  return dots;
}

export const cleanse = (map: StatusMap): void => void (['burn', 'slow', 'bleed', 'poison', 'stun', 'fear', 'curse'] as StatusId[]).forEach((id) => delete map[id]);
export const speedFactor = (map: StatusMap) => (map.stun ? 0 : 1 - (map.slow?.stacks ?? 0) * STATUS_TUNING.slowPerStack);
export const damageTakenFactor = (map: StatusMap) => 1 + (map.curse?.stacks ?? 0) * STATUS_TUNING.cursePerStack;
export const isStunned = (map: StatusMap) => map.stun !== undefined;
export const activeStatuses = (map: StatusMap) => STATUS_IDS.filter((id) => map[id]);
/** How many effects are on it, without allocating (the renderer asks this for every enemy every frame). */
export function statusCount(map: StatusMap): number {
  let n = 0;
  for (const id of STATUS_IDS) if (map[id]) n++;
  return n;
}

/** v0.2 slow multipliers (0.5 = half speed) expressed as Chilled stacks. Ability slows never freeze by themselves. */
export const slowStacks = (mult: number) => Math.max(1, Math.min(STATUS_TUNING.maxSlowStacksFromAbility, Math.round((1 - mult) / STATUS_TUNING.slowPerStack)));
export const curseStacks = (mult: number) => Math.max(1, Math.min(STATUSES.curse.maxStacks, Math.round((mult - 1) / STATUS_TUNING.cursePerStack)));

// ---------- damage types and armor ----------

export const typeMultiplier = (id: EnemyId, type: DamageType) => RESISTS[id]?.[type] ?? 1;

/** Armor soaks `reduction` of a hit until it breaks; what is soaked wears the armor down. */
export function throughArmor(amount: number, armorHp: number, reduction: number): { dealt: number; armorHp: number; broke: boolean } {
  if (armorHp <= 0) return { dealt: amount, armorHp: 0, broke: false };
  const soaked = Math.min(armorHp, amount * reduction);
  const left = armorHp - soaked;
  return { dealt: amount - soaked, armorHp: left, broke: left <= 0 };
}

/**
 * #212: a hit on plate armor (config/damage.ts PLATES). While a plate is left the hit does `reduction` less; a hit (`breaks`: not a
 * status tick) breaks one plate, plus one per full `heavy` share of `maxHp` it carried. At 0 plates it lands in full.
 */
export function throughPlates(amount: number, plates: number, maxHp: number, cfg: { reduction: number; heavy: number }, breaks = true): { dealt: number; plates: number; broke: boolean } {
  if (plates <= 0) return { dealt: amount, plates: 0, broke: false };
  const broken = breaks && amount > 0 ? 1 + Math.floor(amount / (cfg.heavy * maxHp)) : 0;
  const left = Math.max(0, plates - broken);
  return { dealt: amount * (1 - cfg.reduction), plates: left, broke: left === 0 && broken > 0 };
}

/**
 * #214: what a thorn bearer's spikes (config/damage.ts THORNS) bite back for one hit on it: `share` of the blow, at most `cap` of the
 * champion's `maxHp`. Only his own blows count (an attack or an ability, not a tick), struck from within `reach` of the bearer's edge
 * (`gap`: the distance from the champion to that edge), and at most once per `cd` seconds (`since`: seconds since the last bite).
 */
export function thornsBite(blow: number, hit: { source: DamageSource; tick: boolean; gap: number; since: number }, maxHp: number, cfg: { share: number; cap: number; reach: number; cd: number }): number {
  if (blow <= 0 || hit.tick || (hit.source !== 'attack' && hit.source !== 'ability')) return 0;
  if (hit.gap > cfg.reach || hit.since < cfg.cd) return 0;
  return Math.min(blow * cfg.share, cfg.cap * maxHp);
}

/**
 * v0.7.5 (#95): a hit on a boss through its resolve (BOSS_RESOLVE). `load` is the damage it took lately (as of time `t`), draining at
 * `perSec` of its max HP a second; what lands past the `burst` allowance does `excess` of itself, up to `cap` in all. Returns the
 * damage and the new load.
 */
export function throughResolve(amount: number, maxHp: number, load: number, t: number, now: number): { dealt: number; load: number } {
  const { burst, perSec, excess, cap } = BOSS_RESOLVE;
  const cur = Math.max(0, load - (now - t) * perSec * maxHp);
  const room = Math.max(0, burst * maxHp - cur);
  const dealt = Math.min(Math.min(amount, room) + Math.max(0, amount - room) * excess, Math.max(0, cap * maxHp - cur));
  return { dealt, load: cur + dealt };
}

/** Did a hit travelling along (kx, ky) strike an enemy facing `facing` in the back? */
export function fromBehind(kx: number, ky: number, facing: number): boolean {
  if (kx === 0 && ky === 0) return false;
  const d = Math.abs(Math.atan2(ky, kx) - facing) % (Math.PI * 2);
  return Math.min(d, Math.PI * 2 - d) < BACK_ARC;
}

/** #213: did a hit travelling along (kx, ky) come at the front of an enemy facing `facing`, within `arc` radians either side? */
export function atFront(kx: number, ky: number, facing: number, arc: number): boolean {
  if (kx === 0 && ky === 0) return false; // no direction (an area, a tick): no front to come at
  return angleDiff(Math.atan2(-ky, -kx), facing) < arc;
}

/**
 * #213: a hit on an iron tower shield (config/damage.ts TOWER_SHIELDS). From the front (within `arc` of his facing) it does `reduction`
 * less and counts as blocked; from the side, from behind or with no direction it lands in full.
 */
export function throughTowerShield(amount: number, kx: number, ky: number, facing: number, arc: number, reduction: number): { dealt: number; blocked: boolean } {
  const blocked = amount > 0 && atFront(kx, ky, facing, arc);
  return { dealt: blocked ? amount * (1 - reduction) : amount, blocked };
}

/** #213: turn a facing toward `want` by at most `step` radians, the short way round (a slow-turning shield bearer). */
export function turnToward(facing: number, want: number, step: number): number {
  const d = Math.atan2(Math.sin(want - facing), Math.cos(want - facing));
  const to = Math.abs(d) <= step ? want : facing + Math.sign(d) * step;
  return Math.atan2(Math.sin(to), Math.cos(to)); // kept in -PI..PI
}

/** The armor bar an enemy starts with: an ARMOR soak pool in HP, or #212's PLATES as a count of plates. */
export const armorFor = (id: EnemyId, maxHp: number) => (PLATES[id] ? PLATES[id]!.plates : ARMOR[id] ? Math.round(maxHp * ARMOR[id]!.frac) : 0);
