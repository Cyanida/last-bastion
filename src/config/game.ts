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
  dodgeCap: 0.5, // v0.4 talents and traits: at most this chance to ignore a hit
  critMult: 2,
  cdrPerInt: 0.015, // cooldown = base / (1 + int * cdrPerInt)
  cdrFloor: 0.4, // cooldown never drops below 40% of base

  // leveling (v0.4): XP to the next level grows almost linearly, so levels keep coming all run long
  xpBase: 0, // xpToNext(level) = xpBase + xpPerLevel * level (fitted to WAVES.pace against the director's actual waves, see BALANCE.md)
  xpPerLevel: 12,

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
  maxTexts: 150, // v0.1 value, superseded by RENDER.maxTexts
};

/**
 * v0.6 combat that asks for skill (systems/dodge.ts, systems/patterns.ts). Seconds unless noted.
 * perfect: leave a telegraphed attack in its last `window` seconds (or roll, blink or leap through it) for `damage` x damage over `time`
 *   and `refund` of the signature ability's full cooldown back; at most once every `every`. Only zones with at least `minDelay` of warning count.
 * lastStand: once a run, at 0 HP: `time` seconds untouchable at 1 HP while the signature ability cools down `cooldownRate` times as fast.
 */
export const SKILL = {
  perfect: { window: 0.25, minDelay: 0.5, damage: 1.25, time: 3, refund: 0.3, every: 1 },
  lastStand: { time: 5, cooldownRate: 1.5 },
  colors: { windup: '#ff4d3d', elite: '#e8913a', commander: '#f2c94c', hostileShot: '#ff4d3d', perfect: '#7ee0ff' },
};

/** v0.6 run log (logic/runlog.ts): how many runs the save keeps, and what counts as a quiet moment (fewer enemies alive than this). */
export const RUN_LOG = { keep: 50, quietBelow: 5, maxGap: 90 }; // maxGap: the pacing rule, never longer than this without something new (sim -- pacing)

/** Render quality levels. Auto starts on high and drops to low if early frames are slow (phones). */
export type QualitySetting = 'auto' | 'low' | 'high';
export const QUALITY = {
  high: { particles: 1, shake: 1, shadows: true, maxDpr: 2 },
  low: { particles: 0.35, shake: 0.4, shadows: false, maxDpr: 1.5 },
  auto: { maxFrameMs: 21, windowFrames: 240, untilWave: 4 }, // average above 21 ms (~48 fps) over 240 frames -> low
  // per-frame reaction: smoothed frame time above overMs lowers `detail`, below underMs raises it again
  dynamic: { overMs: 15, underMs: 9, dropPerFrame: 0.08, risePerFrame: 0.005, minDetail: 0.15 },
};

/** Render budgets: what is kept on screen at most, and how numbers are merged. */
export const RENDER = {
  maxTexts: 80, // damage numbers alive at once (the oldest go first)
  mergeNumberWindow: 0.3, // a new hit on the same enemy within this many seconds adds to its number instead of spawning one
  maxFields: 40, // lasting ground effects; beyond this the oldest expire early
  textCacheSize: 400, // pre-rendered number sprites kept
};

/** Camera zoom: the view is about VIEW.targetW x VIEW.targetH world pixels, within these bounds (phones zoom out). */
/** v0.8 (#123): Settings › Text size scales the HUD and every screen. A small screen caps it, so the HUD still fits (logic/textSize.ts). */
export type TextSize = 'normal' | 'large' | 'larger';
export const TEXT_SIZES: Record<TextSize, number> = { normal: 1, large: 1.15, larger: 1.3 };
export const TEXT_FIT = { minW: 640, minH: 320 }; // the HUD's layout needs at least this many CSS pixels once scaled

export const VIEW = { targetW: 1280, targetH: 720, minZoom: 0.6, maxZoom: 2 };
