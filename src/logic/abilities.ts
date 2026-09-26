import type { Cfg } from '../config/classes';

/** How each signature ability scales with its class's secondary stat. Pure. */

export function divineShield(c: Cfg<'divineShield'>, faith: number) {
  return {
    duration: c.duration + faith * c.durationPerFaith,
    burstDamage: c.burstDamage * (1 + faith * c.burstPerFaith),
  };
}

/** v0.7.4 (#63): the burst's share when Divine Shield ends after `up` seconds with `left` to go: `early` at the cast, 1 when it runs out. */
export function shieldBurst(early: number, up: number, left: number): number {
  return early + (1 - early) * (up + left > 0 ? up / (up + left) : 1);
}

export function berserkerRage(c: Cfg<'berserkerRage'>, rage: number, hpFrac: number) {
  const k = (1 + rage * c.bonusPerRage) * (1 + (1 - hpFrac) * c.lowHpBonus);
  return {
    duration: c.duration + rage * c.durationPerRage,
    damage: 1 + c.damageBonus * k,
    atkSpd: 1 + c.atkSpdBonus * k,
    lifesteal: c.lifesteal * k,
  };
}

/** #134: how long Dread Howl stuns the enemies around the Viking when rage starts. */
export const dreadHowlStun = (n: { time: number; perRage: number }, rage: number) => n.time + rage * n.perRage;

export function heavenlyRadiance(c: Cfg<'heavenlyRadiance'>, grace: number) {
  return {
    radius: c.radius + grace * c.radiusPerGrace,
    heal: c.heal + grace * c.healPerGrace,
  };
}

export function raiseDead(c: Cfg<'raiseDead'>, soul: number) {
  return {
    maxMinions: Math.floor(c.minions + soul * c.minionsPerSoul),
    damage: c.minionDamage * (1 + soul * c.damagePerSoul),
    lifetime: c.lifetime + soul * c.lifetimePerSoul,
  };
}

/** v0.8 the Bone Colossus: a skeleton's HP and damage times the parts fused into it, up to a cap. Recomputed on every feed, never compounded (#126). */
export function boneColossus(n: { hp: number; damage: number; maxParts: number }, each: { hp: number; damage: number }, fed: number) {
  const parts = Math.min(fed, n.maxParts);
  return { parts, hp: each.hp * parts * n.hp, damage: each.damage * parts * n.damage };
}

export function arrowVolley(c: Cfg<'arrowVolley'>, focus: number) {
  return {
    arrows: Math.floor(c.arrows + focus * c.arrowsPerFocus),
    pierce: Math.floor(c.pierce + focus * c.piercePerFocus),
  };
}
