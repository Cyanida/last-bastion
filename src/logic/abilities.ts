import type { Cfg } from '../config/classes';

/** How each signature ability scales with its class's secondary stat. Pure. */

export function divineShield(c: Cfg<'divineShield'>, faith: number) {
  return {
    duration: c.duration + faith * c.durationPerFaith,
    burstDamage: c.burstDamage * (1 + faith * c.burstPerFaith),
  };
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

export function arrowVolley(c: Cfg<'arrowVolley'>, focus: number) {
  return {
    arrows: Math.floor(c.arrows + focus * c.arrowsPerFocus),
    pierce: Math.floor(c.pierce + focus * c.piercePerFocus),
  };
}
