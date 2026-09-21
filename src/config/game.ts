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

/** Render quality levels. Auto starts on high and drops to low if early frames are slow (phones). */
export type QualitySetting = 'auto' | 'low' | 'high';
export const QUALITY = {
  high: { particles: 1, shake: 1, shadows: true, maxDpr: 2 },
  low: { particles: 0.35, shake: 0.4, shadows: false, maxDpr: 1.5 },
  auto: { maxFrameMs: 21, windowFrames: 240, untilWave: 4 }, // average above 21 ms (~48 fps) over 240 frames -> low
};

/** Camera zoom: the view is about VIEW.targetW x VIEW.targetH world pixels, within these bounds (phones zoom out). */
export const VIEW = { targetW: 1280, targetH: 720, minZoom: 0.6, maxZoom: 2 };
