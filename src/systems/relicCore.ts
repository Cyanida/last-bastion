import { STATUSES, type DamageType } from '../config/damage';
import { ATTUNEMENT, FAMILIES, RELIC_DAMAGE_PER_LEVEL, RELIC_MAX_TIER, RELIC_STACKING, RELICS, relicN, type DuoId, type FamilyId, type RelicId, type RelicKey, type SetLevel } from '../config/relics';
import { TAU } from '../core/math';
import type { Enemy, Game, Minion, Mods, Player } from '../core/types';
import { createMinion } from '../entities/actors';
import { emit, type EventName, type GameEvents } from '../core/events';
import { addWork, familySets, softCap, type SetState } from '../logic/relics';
export { familySets, type SetState };
import { credit, flash, relicContext } from './relicContext';
export { credit, flash };
import { applyStatus, damageEnemy, healPlayer, nearestEnemy } from './combat';
import { burst, floatText, line, ring } from './effects';

/**
 * v0.7: what every relic family builds on (RELICS.md): reading a player's relics and set levels, and the shared mechanics (ward, armor stacks,
 * block, lightning strikes, chains, burns and chills that honour the set bonuses, skeletons for any class). Everything takes the player it is
 * about, never "the player", so a second player's relics work the same way.
 */

// ---------------------------------------------------------------- reading a player's relics

export const tierOf = (p: Player, id: RelicId): number => p.relics.tiers[id] ?? 0;
export const has = (p: Player, id: RelicId): boolean => tierOf(p, id) > 0;
export const nOf = (p: Player, id: RelicId) => relicN(id, tierOf(p, id));
export const awakened = (p: Player, id: RelicId): boolean => tierOf(p, id) >= RELIC_MAX_TIER;
export const hasDuo = (p: Player, id: DuoId): boolean => p.relics.duos.includes(id);
/** The class's secondary stat: Faith, Rage, Grace, Soul Power, Focus. */
export const sOf = (p: Player): number => p.stats.secondary;
export const relicDamage = (p: Player, base: number): number => base * (1 + p.level * RELIC_DAMAGE_PER_LEVEL);

const NO_SET: SetState = { count: 0, straight: 0, level: 0, strength: 1 };
export const setOf = (p: Player, f: FamilyId): SetState => p.relics.sets[f] ?? NO_SET;
export const setAt = (p: Player, f: FamilyId, level: SetLevel): boolean => setOf(p, f).level >= level;
/** The strength a family's set works at: a 6 completed with a duo is stronger (DUO_SIX_STRENGTH); every other level is 1. */
export const strength = (p: Player, f: FamilyId): number => setOf(p, f).strength;

// ---------------------------------------------------------------- hits

/**
 * An attack hit for on-hit relics: the player's own attacks, and with Grave's Legion (6) its minions' hits too. Abilities are separate
 * (`ev.source === 'ability'`).
 */
export const attackHit = (p: Player, source: string): boolean => source === 'attack' || (source === 'minion' && setAt(p, 'grave', 6));

export function nova(g: Game, x: number, y: number, radius: number, damage: number, knockback: number, color: string, type: DamageType = 'physical', each?: (e: Enemy) => void): number {
  let hit = 0;
  for (const e of g.hash.query(x, y, radius, [])) {
    const a = Math.atan2(e.y - y, e.x - x);
    damageEnemy(g, e, damage, false, Math.cos(a) * knockback, Math.sin(a) * knockback, 'relic', type);
    each?.(e);
    hit++;
  }
  ring(g, x, y, radius, color, 0.45);
  return hit;
}

/** A lightning strike: a bolt from the sky at (x, y), damage to everything in `radius`. */
export function strike(g: Game, x: number, y: number, damage: number, radius: number): number {
  line(g, x + 20, y - 220, x, y, FAMILIES.storm.color);
  burst(g, x, y, FAMILIES.storm.color, 10, 200);
  return nova(g, x, y, radius, damage, 60, FAMILIES.storm.color);
}

/**
 * A chain: from `from` to the nearest other enemy within `range`, `jumps` times, each for `amount`. Storm's Tempest (6) makes the range 50%
 * longer. Emits onChain per link (Quicksilver Spurs counts them). `each` runs on every enemy chained to.
 */
export function chainFrom(g: Game, p: Player, from: Enemy, amount: number, jumps: number, range: number, each?: (e: Enemy) => void, crit = false): void {
  const reach = range * (setAt(p, 'storm', 6) ? FAMILIES.storm.n.rangeMult : 1);
  let at = from;
  for (let i = 0; i < jumps; i++) {
    const next = nearestEnemy(g, at.x, at.y, reach, at);
    if (!next) return;
    line(g, at.x, at.y, next.x, next.y, FAMILIES.storm.color);
    damageEnemy(g, next, amount, crit, 0, 0, 'relic');
    each?.(next);
    emit(g, 'onChain', { enemy: next, from: at, amount });
    at = next;
  }
}

// ---------------------------------------------------------------- statuses that honour the set bonuses

/** A burn from the player (Flame's Stoked is applied to every player burn in combat.applyStatus). */
export function addBurn(g: Game, _p: Player, e: Enemy, stacks: number, power: number): void {
  applyStatus(e, { apply: [{ id: 'burn', stacks, power }] }, g);
}
export const burnStacks = (e: Enemy): number => e.statuses.burn?.stacks ?? 0;
export const maxBurn = (p: Player): number => STATUSES.burn.maxStacks + (setAt(p, 'flame', 2) ? FAMILIES.flame.n.stacksBonus : 0);

/** Chill from the player (Frost's Biting Cold is applied to every player chill in combat.applyStatus). */
export function addChill(g: Game, _p: Player, e: Enemy, stacks: number, time = STATUSES.slow.duration): void {
  applyStatus(e, { apply: [{ id: 'slow', stacks, time }] }, g);
}
export const isChilled = (e: Enemy): boolean => (e.statuses.slow?.stacks ?? 0) > 0;
export const isFrozen = (g: Game, e: Enemy): boolean => e.frozenT > g.time;

/** A bleed from the player: Berserker Tooth's Last Blood doubles it below 25% HP (Blood's Open Wounds is in combat.applyStatus). */
export function addBleed(g: Game, p: Player, e: Enemy, stacks: number, power: number): void {
  const s = awakened(p, 'berserkerTooth') && p.hp < p.stats.hp * 0.25 ? stacks * 2 : stacks;
  applyStatus(e, { apply: [{ id: 'bleed', stacks: s, power }] }, g);
}
export const isBleeding = (e: Enemy): boolean => (e.statuses.bleed?.stacks ?? 0) > 0;
export const isCursed = (e: Enemy): boolean => (e.statuses.curse?.stacks ?? 0) > 0;

// ---------------------------------------------------------------- ward, armor stacks

/** Ward: absorbs damage before HP (combat.damagePlayer). Its maximum comes from Holy's Blessed (2), Communion (6) doubles it. */
export function wardMax(p: Player): number {
  const n = FAMILIES.holy.n;
  const base = setAt(p, 'holy', 2) ? p.stats.hp * (n.wardMax + n.wardMaxPerS * sOf(p)) : p.stats.hp * 0.1;
  return base * (setAt(p, 'holy', 6) ? n.wardMaxMult : 1) * Math.max(1, strength(p, 'holy'));
}
export function gainWard(g: Game, p: Player, amount: number): void {
  if (amount <= 0) return;
  const before = p.ward;
  p.ward = Math.min(Math.max(p.ward, wardMax(p)), p.ward + amount);
  if (relicContext.acting) credit(g, p, relicContext.acting, 'prevented', p.ward - before); // ward is damage it will stop
  if (hasDuo(p, 'consecration') && p.ward - before >= 1) gainArmorStacks(g, p, 1); // Consecration
  ring(g, p.x, p.y, p.r + 14, FAMILIES.holy.color, 0.3);
}

/** Armor stacks (Steel): +3% armor each, they fade `fade` s after the last one was gained. */
export function armorStacksMax(p: Player): number {
  const n = FAMILIES.steel.n;
  return n.stacksMax + Math.floor(sOf(p) / 10) * n.stacksPer10S;
}
export function gainArmorStacks(g: Game, p: Player, count: number): void {
  if (count <= 0) return;
  p.armorStacks = Math.min(armorStacksMax(p), p.armorStacks + count);
  p.armorStackT = g.time;
  if (relicContext.acting) addWork(p.relics, relicContext.acting, ATTUNEMENT.proc * count);
}
export const fullArmorStacks = (p: Player): boolean => p.armorStacks >= armorStacksMax(p);

// ---------------------------------------------------------------- skeletons for any class

/** Skeletons raised by relics and sets (tagged in `relicBy`, so a family can count its own). */
export function raiseSkeleton(g: Game, p: Player, x: number, y: number, by: RelicKey | FamilyId, o: { hp: number; damage: number; life: number }): Minion {
  const m = createMinion(x, y, { hp: o.hp, damage: relicDamage(p, o.damage), speed: 165, attackCd: 0.7, life: o.life });
  m.relicBy = by;
  g.minions.push(m);
  if (by in RELICS) addWork(p.relics, by as RelicId, ATTUNEMENT.summon);
  ring(g, x, y, 30, FAMILIES.grave.color);
  return m;
}
export const skeletonsBy = (g: Game, by: RelicKey | FamilyId): number => g.minions.filter((m) => m.relicBy === by).length;

/** A cone in front of the player (Dragon's Tongue): every enemy within `range` and `arc` radians of `angle`. */
export function cone(g: Game, p: Player, angle: number, range: number, arc: number): Enemy[] {
  return g.hash.query(p.x, p.y, range, []).filter((e) => {
    let d = Math.atan2(e.y - p.y, e.x - p.x) - angle;
    d = ((d + Math.PI) % TAU + TAU) % TAU - Math.PI;
    return Math.abs(d) <= arc / 2;
  });
}

export const say = (g: Game, p: Player, text: string, color: string): void => floatText(g, p.x, p.y - p.r - 40, text, color, 14);

// ---------------------------------------------------------------- hooks, credit, healing, conditional bonuses

/** A relic's (or a set bonus's) behaviour: event handlers and a tick, each told which player it belongs to. */
export type RelicHooks = { [K in EventName]?: (g: Game, ev: GameEvents[K], p: Player) => void } & {
  tick?: (g: Game, dt: number, p: Player) => void;
  acquire?: (g: Game, p: Player) => void; // taken, and again at every tier-up
  remove?: (g: Game, p: Player) => void; // v0.7.1: sold or salvaged (what acquire changed goes back)
};

/**
 * A relic that cuts max HP to `frac` (Blood Pact; Crimson Chalice's curse), under its own key: unrounded, so tier-ups, a lifted curse and
 * removal round-trip exactly.
 */
export function cutMaxHp(g: Game, p: Player, key: string, frac: number): void {
  p.stats.hp = (p.stats.hp / (g.vars[key] ?? 1)) * frac;
  g.vars[key] = frac;
  p.hp = Math.min(p.hp, p.stats.hp);
}

/** Healing from relics passes a soft cap per wave (a share of max HP): sustain relics add up, then each heals less. */
export function relicHeal(g: Game, p: Player, amount: number, show = false): number {
  const max = p.stats.hp;
  const prev = g.vars.relicHeal ?? 0;
  const next = prev + amount / max;
  g.vars.relicHeal = next;
  const healed = healPlayer(g, (softCap(next, RELIC_STACKING.healCap) - softCap(prev, RELIC_STACKING.healCap)) * max, show);
  if (relicContext.acting) credit(g, p, relicContext.acting, 'healing', healed, true);
  return healed;
}

/** A tick hook's conditional bonus (a charge, a count, a missing-HP bonus): it joins the held relics' plain mods at face value. */
export function bonus(p: Player, key: keyof Mods, amount: number): void {
  if (!amount) return;
  p.relics.dyn[key] = (p.relics.dyn[key] ?? 0) + amount;
  const id = relicContext.acting;
  if (id) {
    const keys = (p.relics.raw[id] ??= {});
    keys[key] = (keys[key] ?? 0) + amount;
  }
}
