/** Global tuning: arena, combat formulas, XP curve. */
export const GAME = {
  arena: { w: 2000, h: 1400, wall: 48 },
  tickRate: 60,
  spriteScale: 3,
  spatialCell: 64,

  // stat scaling
  statDamageScale: 0.04, // +4% damage per point of the attack's scaling stat
  baseCrit: 0.05,
  critPerDex: 0.008,
  critCap: 0.6,
  critMult: 2,
  cdrPerInt: 0.015, // cooldown = base / (1 + int * cdrPerInt)
  cdrFloor: 0.4, // cooldown never drops below 40% of base

  // leveling
  xpBase: 4,
  xpExp: 1.3,

  // player
  playerRadius: 13,
  contactIFrames: 0.35, // seconds of contact-damage immunity after a contact hit
  pickupRadius: 90,
  pickupSpeed: 460,

  armorCap: 0.75,
  leechCapPerHit: 0.02, // lifesteal heals at most this fraction of max HP per hit, or it outgrows enemy damage
  maxAttackRate: 4.5, // attacks per second after all multipliers: stops attack-speed stacking from snowballing
  fieldTick: 0.5, // fire / poison / holy ground deal dps * fieldTick this often
  reviveHp: 0.5, // Phoenix Feather
  reviveGrace: 1.5, // seconds of invulnerability after any revive
  minMaxHp: 20, // tradeoffs cannot push max HP below this

  corpseLifetime: 10, // seconds a corpse stays usable for Raise Dead
  maxParticles: 800,
  maxTexts: 150,
};
