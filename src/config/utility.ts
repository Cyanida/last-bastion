import type { ClassId } from './classes';

/**
 * The second, utility ability (v0.4): unlocked at `unlockLevel`, on its own key (E / Shift, gamepad X or RB, the small touch button),
 * with a two-way upgrade choice at each level in `tiers`. Talents scale it through p.mods.utilityCd / utilityPower.
 */
export const UTILITY = {
  unlockLevel: 3,
  tiers: [8, 14],
};

export type UtilityId = 'taunt' | 'leap' | 'blink' | 'corpseExplosion' | 'dodgeRoll';

export interface UtilityDef {
  id: UtilityId;
  name: string;
  desc: string;
  icon: string;
  cooldown: number;
  color: string;
  n: Record<string, number>;
}

export const UTILITIES: Record<ClassId, UtilityDef> = {
  paladin: {
    id: 'taunt', name: 'Challenge', icon: '📣', color: '#f2d675', cooldown: 14,
    desc: 'Drag every enemy nearby toward you; for a few seconds they can think of nothing else.',
    n: { radius: 280, pull: 460, duration: 3 },
  },
  viking: {
    id: 'leap', name: 'Leap', icon: '🦵', color: '#c23a2e', cooldown: 9,
    desc: 'Leap at your aim and land hard: damage and knockback around you.',
    n: { range: 260, radius: 100, damage: 22, knockback: 380 },
  },
  angel: {
    id: 'blink', name: 'Blink', icon: '✨', color: '#f2e6a0', cooldown: 8,
    desc: 'Vanish and reappear toward your aim, untouchable for a moment.',
    n: { range: 240, invuln: 0.5 },
  },
  necromancer: {
    id: 'corpseExplosion', name: 'Corpse Explosion', icon: '☠️', color: '#8a5cc6', cooldown: 10,
    desc: 'Every corpse nearby bursts, hurting everything around it.',
    n: { radius: 240, blast: 80, damage: 26 },
  },
  archer: {
    id: 'dodgeRoll', name: 'Dodge Roll', icon: '🌀', color: '#6f8f4e', cooldown: 6,
    desc: 'Roll the way you are moving, untouchable for a moment, and drop caltrops behind you.',
    n: { range: 170, invuln: 0.35, caltropRadius: 60, caltropLife: 6, caltropDps: 6, slow: 0.6 },
  },
};

export interface UtilityUpgradeDef {
  name: string;
  desc: string;
  n: Record<string, number>;
}

export const UTILITY_UPGRADES = {
  // taunt
  ironWill: { name: 'Iron Will', desc: 'Challenged enemies deal 25% less damage.', n: { damage: 0.75 } },
  consecration: { name: 'Consecration', desc: 'The Challenge leaves holy ground that burns enemies for 4s.', n: { time: 4, dps: 12, radius: 120 } },
  rallyingCry: { name: 'Rallying Cry', desc: 'Heal 3% of max HP for every enemy pulled (up to 30%).', n: { heal: 0.03, max: 0.3 } },
  chains: { name: 'Chains of Faith', desc: 'Pulled enemies are stunned for a moment.', n: { stun: 0.8 } },
  // leap
  earthshatter: { name: 'Earthshatter', desc: 'The landing hits twice as hard over a wider area.', n: { damage: 2, radius: 1.3 } },
  warCry: { name: 'War Cry', desc: '+30% attack speed for 4s after landing.', n: { atkSpd: 0.3, time: 4 } },
  longJump: { name: 'Long Jump', desc: 'Leap 50% farther and recharge 25% faster.', n: { range: 1.5, cooldown: 0.75 } },
  bloodLanding: { name: 'Blood Landing', desc: 'Heal 3 HP for every enemy the landing hits.', n: { heal: 3 } },
  // blink
  afterimage: { name: 'Afterimage', desc: 'Leave a burst of light where you stood (40+ damage).', n: { damage: 40, radius: 110 } },
  farBlink: { name: 'Far Blink', desc: 'Blink 60% farther.', n: { range: 1.6 } },
  blessedBlink: { name: 'Blessed Blink', desc: 'Blinking heals 12% of max HP.', n: { heal: 0.12 } },
  quickBlink: { name: 'Quick Blink', desc: 'Blink recharges 35% faster and the moment lasts longer.', n: { cooldown: 0.65, invuln: 1.6 } },
  // corpse explosion
  gravedust: { name: 'Gravedust', desc: 'Every burst leaves a poison pool for 4s.', n: { time: 4, dps: 8 } },
  harvest: { name: 'Harvest', desc: 'Every corpse burst restores 2 HP.', n: { heal: 2 } },
  boneShards: { name: 'Bone Shards', desc: 'Bursts reach 40% farther and hit 30% harder.', n: { blast: 1.4, damage: 1.3 } },
  deathWave: { name: 'Death Wave', desc: 'Corpse Explosion reaches twice as far from you.', n: { radius: 2 } },
  // dodge roll
  sharpCaltrops: { name: 'Sharp Caltrops', desc: 'Caltrops hurt twice as much and make enemies bleed.', n: { dps: 2 } },
  quickRoll: { name: 'Quick Roll', desc: 'Dodge Roll recharges 30% faster.', n: { cooldown: 0.7 } },
  ghostStep: { name: 'Ghost Step', desc: 'Untouchable twice as long, and +20% movement speed for 2s after the roll.', n: { invuln: 2, moveSpd: 0.2, time: 2 } },
  scatter: { name: 'Scatter', desc: 'The caltrop field is twice as big and lasts longer.', n: { radius: 1.5, life: 1.5 } },
} satisfies Record<string, UtilityUpgradeDef>;

export type UtilityUpgradeId = keyof typeof UTILITY_UPGRADES;

/** Per class: [tier at level 8, tier at level 14], each a choice of two. */
export const UTILITY_TRACKS: Record<ClassId, readonly [readonly [UtilityUpgradeId, UtilityUpgradeId], readonly [UtilityUpgradeId, UtilityUpgradeId]]> = {
  paladin: [['ironWill', 'consecration'], ['rallyingCry', 'chains']],
  viking: [['earthshatter', 'warCry'], ['longJump', 'bloodLanding']],
  angel: [['afterimage', 'farBlink'], ['blessedBlink', 'quickBlink']],
  necromancer: [['gravedust', 'harvest'], ['boneShards', 'deathWave']],
  archer: [['sharpCaltrops', 'quickRoll'], ['ghostStep', 'scatter']],
};
