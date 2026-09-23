import { ARMOR, BACK_ARC, RESISTS, STATUS_TUNING, STATUSES, type DamageType, type StatusId } from '../config/damage';
import type { EnemyId } from '../config/enemies';

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

/** Did a hit travelling along (kx, ky) strike an enemy facing `facing` in the back? */
export function fromBehind(kx: number, ky: number, facing: number): boolean {
  if (kx === 0 && ky === 0) return false;
  const d = Math.abs(Math.atan2(ky, kx) - facing) % (Math.PI * 2);
  return Math.min(d, Math.PI * 2 - d) < BACK_ARC;
}

export const armorFor = (id: EnemyId, maxHp: number) => (ARMOR[id] ? Math.round(maxHp * ARMOR[id]!.frac) : 0);
