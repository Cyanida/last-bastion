import type { Mods } from '../core/types';
import type { ArenaId } from './arenas';
import type { ClassId } from './classes';

/**
 * v0.7 relics (RELICS.md, approved revision 2): seven families, each with one core mechanic and set bonuses at 2, 4 and 6 relics held.
 * Every relic belongs to one family; class relics (three per class, one in each of its preferred families) are only offered to their class.
 * v0.7.1 B6: the six cursed relics are the exception: no family, far stronger, with a curse that their awakening lifts (CURSED below).
 * A relic grows by attunement (A4): tier II strengthens its numbers, tier III awakens it (an extra behaviour with its own name).
 * Numbers live here; the behaviour is in systems/relicFamilies/<family>.ts.
 */
export type Rarity = 'common' | 'rare' | 'legendary';
export type FamilyId = 'flame' | 'frost' | 'storm' | 'blood' | 'holy' | 'grave' | 'steel';

export interface RelicDef {
  name: string;
  rarity: Rarity;
  icon: string;
  family?: FamilyId; // none for a cursed relic
  cursed?: true; // v0.7.1 B6: a cursed relic (no family; offered by CURSED's rules, never from the pool)
  classId?: ClassId; // a class relic: only offered to this class
  mods?: Partial<Mods>; // a few relics also carry a plain bonus (Blood Pact's damage, Tempest Eye's crit)
  n: Record<string, number>; // tier I numbers, read by the family module
  tiers: [{ n?: Record<string, number>; mods?: Partial<Mods> }, { n?: Record<string, number>; mods?: Partial<Mods> }]; // tier II, tier III (awakened: II's numbers)
  awaken: { name: string; desc: string; n: Record<string, number> }; // n: the awakening's own numbers (tier III), read by the family module
  desc: string; // tier I text
  describe: (n: Record<string, number>) => string; // text for any tier's numbers
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Keeps each relic's numbers typed and its text in sync with them. Tier III (awakened) keeps tier II's numbers. */
function relic<N extends Record<string, number>, A extends Record<string, number> = Record<string, never>>(r: {
  name: string; rarity: Rarity; icon: string; family?: FamilyId; cursed?: true; classId?: ClassId; mods?: Partial<Mods>; mods2?: Partial<Mods>;
  n: N; n2: Partial<N>; a?: A; awaken: [string, string | ((a: A) => string)]; desc: (n: N) => string;
}): RelicDef {
  const { n2, mods2, a = {} as A, awaken, desc, ...rest } = r;
  const [name, text] = awaken;
  return { ...rest, tiers: [{ n: n2 as Record<string, number>, mods: mods2 }, {}], awaken: { name, desc: typeof text === 'string' ? text : text(a), n: a }, desc: desc(r.n), describe: desc as (n: Record<string, number>) => string };
}

export const RELIC_MAX_TIER = 3;
export const TIER_NUMERALS = ['', 'I', 'II', 'III'];
export const RELIC_WEIGHTS: Record<Rarity, number> = { common: 60, rare: 30, legendary: 2 }; // A8: legendary 10 -> 2 (a straight 6-set needs its family's legendary; 6-sets came in 60-90% of winning runs)
export const BOSS_RELIC_CHOICES = 3;

/**
 * v0.7: relics come only at fixed moments: every mid-Act and Act boss, lairs, a quest whose reward is a relic, the Merchant
 * between Acts, and the run start (Armorer's Choice). Every moment is a pick of one from `choices`, with a visible Skip (paying run gold and
 * a Rune shard) and `rerolls` rerolls. Offers lean `heldFamilyWeight` times toward the families you hold, and always show at least one relic
 * from a family you hold (once you hold one) and one from a family you don't. Target: 12-16 moments in a full four-Act run (RELICS.md).
 */
export const RELIC_MOMENTS = {
  choices: 3,
  rerolls: 1,
  skip: { gold: 30, goldPerAct: 30, shards: 1 },
  heldFamilyWeight: 1.6, // #96: a duo no longer counts toward 6-sets; 1 gave 7.7% of winning runs a 6-set, 1.6 gives ~15% (Jesse's target)
  classRelicWeight: 0.5, // A8: class relics come half as often (a straight 6-set in a preferred family needs its class relic)
  duoAt: ['boss', 'lair'] as string[], // A8: the moments that can carry a ready duo (at every moment, duos completed most 6-sets)
  merchantPerVisit: 1, // the Merchant sells one relic moment a visit between Acts (not at the Merchant path's caravan): at most 3 a run
};

/**
 * #100: the families each arena's bosses drop. A boss moment offers only relics of its arena's families (plus a cursed third card or a ready
 * duo), and so do its rerolls, so a boss can't be rerolled into any build. Lairs, quests, strongboxes, the Merchant and the run start stay
 * open, so every class can still gather a 6-set of its preferred families. Every family is some arena's; a boss falls back to the whole
 * pool when too few of its families' relics are left to fill the pick.
 */
export const ARENA_FAMILIES: Record<ArenaId, FamilyId[]> = {
  courtyard: ['steel', 'storm', 'blood'], // an open brawl
  graveyard: ['grave', 'frost', 'holy'], // the dead, the cold and the last rites
  keep: ['flame', 'holy', 'steel'], // braziers and the knights' hall
  bastion: ['flame', 'blood', 'frost'], // the Usurper's burning gate
};

/**
 * v0.7.1 B6: cursed relics (Jesse on #5: standalone, very rare, very strong, with a risk). They are never in the pool: at a moment in `at`
 * one takes the third card `chance` of the time, at most once an Act per player. Their awakening lifts the curse. `color`: their purple.
 */
export const CURSED = {
  chance: 0.1,
  at: ['boss', 'lair'] as string[],
  color: '#9b59d0',
};

/** Relic damage has no attack stat behind it, so it grows with character level instead. */
export const RELIC_DAMAGE_PER_LEVEL = 0.18; // A8: 0.09 left the relic power index at 1.35-1.6 in Act II (and runs hold fewer relics since strongboxes stopped being moments)

/**
 * v0.7 attunement (A4): a held relic grows by doing its work. Progress runs 0 to 1 toward the next tier (II strengthens, III awakens).
 * Work: damage dealt through it (as a share of the damage you dealt last wave), healing, ward or damage prevented through it (in max HP), a
 * skeleton it raised, a status or armor stack it gave, and for Grave relics a corpse walked over while Charnel holds; together at most
 * `workCap` a wave. Every held relic
 * also gains a little per wave cleared and per elite killed. Normalized so a relic picked in Act I that does its work reaches tier II in
 * Act II and tier III in Act III (four Acts of 10 waves; A8 checks it with `npm run sim -- relics`).
 */
export const ATTUNEMENT = {
  damage: 1.5, // × its share of a wave's damage
  support: 0.75, // × healing, ward or prevention, in max HP
  summon: 0.03, // a skeleton raised
  proc: 0.005, // a status it puts on an enemy (chill, burn, bleed, curse), an armor stack, a cooldown cut
  corpse: 0.005, // Charnel (Grave 2): a corpse walked over, for every Grave relic
  workCap: 0.1, // work counts up to this much a wave
  wave: 0.03, // every held relic, per wave cleared
  elite: 0.002, // every held relic, per elite killed (a maxed save meets 10+ a wave)
  refDamage: 400, // the damage a wave is measured against before the first wave has been measured
};

/** Selling and salvage at the Merchant. */
export const RELIC_DROPS = {
  sellFrac: 0.35, // of the Merchant's buy price for that rarity, per tier
  salvage: { common: 1, rare: 2, legendary: 4 } as Record<Rarity, number>, // Rune shards per tier
};

/**
 * Relic bonuses add up at face value (v0.7: no category soft caps, no proc sharing). Healing from relics still passes a soft cap per wave
 * (`healCap`, a share of max HP). Proc chains stop at `procDepth`: a relic reacting to a relic's damage is fine, a third link is not.
 */
export const RELIC_STACKING = {
  procDepth: 2,
  healCap: 1, // relic healing per wave, as a share of max HP: face value up to this, diminishing past it (never more than 1.5x)
};
/** Proc icons and damage numbers of relics without a family colour. */
export const RELIC_COLOR = '#d9a8ff';

/**
 * The families. `preferredBy`: the classes that can max it with straight pieces (5 relics any class finds + that class's own class relic).
 * Set bonus numbers are read by systems/relicFamilies/<family>.ts; `...PerS` numbers grow with the class's secondary stat.
 */
export const FAMILIES = {
  flame: {
    name: 'Flame', icon: '🔥', color: '#e8793a', mechanic: 'Burn stacks and fire bursts', preferredBy: ['paladin', 'angel', 'archer'],
    sets: {
      2: ['Stoked', 'Burns stack one higher, and burn damage grows 3% per point of your secondary stat.'],
      4: ['Pyre', 'Burning enemies explode on death: 20% of their max HP (+1% per point of your secondary stat) around them.'],
      6: ['Inferno', 'All your damage adds a burn stack, and every 2 s each burning enemy spreads a stack to its nearest neighbour.'],
    },
    n: { stacksBonus: 1, burnPerS: 0.03, pyreFrac: 0.2, pyrePerS: 0.01, pyreRadius: 90, spreadEvery: 2, spreadRange: 160 },
  },
  frost: {
    name: 'Frost', icon: '❄️', color: '#8ec9e8', mechanic: 'Chill (a relic\'s chill: +4% damage taken per stack), freeze, shatter', preferredBy: ['angel', 'necromancer', 'archer'],
    sets: {
      2: ['Biting Cold', 'Chill builds 50% faster.'],
      4: ['Shatter', 'Frozen enemies shatter when killed: 30% of their max HP (+1% per point of your secondary stat) to enemies around them.'],
      6: ['Rimewalker', 'You leave a frost trail that chills, and an enemy that touches you freezes for 0.6 s (each enemy at most every 3 s).'],
    },
    n: { chillVuln: 0.04, chillMult: 1.5, shatterFrac: 0.3, shatterPerS: 0.01, shatterRadius: 110, trailEvery: 0.3, trailLife: 2, trailRadius: 45, touchFreeze: 0.6, touchCd: 3 },
  },
  storm: {
    name: 'Storm', icon: '⚡', color: '#f2e6a0', mechanic: 'Chains and speed', preferredBy: ['viking', 'archer'],
    sets: {
      2: ['Arc', 'Every 4th hit chains to a second enemy for full damage (every 3rd from 15 in your secondary stat).'],
      4: ['Thunderstrike', 'Crits call a lightning strike: 50% of the hit to everything around the target.'],
      6: ['Tempest', 'Chains jump 50% further, and 10 kills within 5 s reset your utility cooldown.'],
    },
    n: { arcEvery: 4, arcEveryAt15: 3, arcMult: 1, arcRange: 170, strikeMult: 0.5, strikeRadius: 60, rangeMult: 1.5, streakKills: 10, streakWindow: 5 },
  },
  blood: {
    name: 'Blood', icon: '🩸', color: '#c23a2e', mechanic: 'Bleed, and HP for power', preferredBy: ['viking'],
    sets: {
      2: ['Open Wounds', 'Every bleed you apply adds two stacks more.'],
      4: ['Bloodlust', '+1% damage for every 2% of HP missing (max 50%), and killing a bleeding enemy heals 1% of your max HP.'],
      6: ['Blood Magic', 'While your signature ability cools down you can cast it anyway by paying 20% of your current HP (once per cooldown).'],
    },
    n: { extraStacks: 2, perMissing: 0.5, lustMax: 0.5, killHeal: 0.01, hpCost: 0.2 },
  },
  holy: {
    name: 'Holy', icon: '✨', color: '#f0d77a', mechanic: 'Healing, ward and blessing', preferredBy: ['paladin', 'angel', 'necromancer'],
    sets: {
      2: ['Blessed', 'Healing also grants ward: 25% of the heal (your ward holds up to 15% of your max HP, +1% per point of your secondary stat).'],
      4: ['Radiance', 'Overhealing becomes a holy pulse around you: twice the overheal as damage.'],
      6: ['Communion', "Your ward's maximum doubles, and your heals and ward also reach your minions and nearby allies at full strength."],
    },
    n: { wardShare: 0.25, wardMax: 0.15, wardMaxPerS: 0.01, pulseMult: 2, pulseRadius: 150, wardMaxMult: 2 },
  },
  grave: {
    name: 'Grave', icon: '💀', color: '#9a7fc0', mechanic: 'Corpses, summons and curse', preferredBy: ['necromancer'],
    sets: {
      2: ['Charnel', 'Corpses last twice as long, and walking over one attunes your Grave relics.'],
      4: ['Undying Host', 'Every 10th kill raises a skeleton for you, whatever your class (max 3, +1 per 10 in your secondary stat).'],
      6: ['Legion', "Your minions' hits trigger your on-hit relic effects."],
    },
    n: { corpseMult: 2, every: 10, max: 3, maxPer10S: 1, hp: 50, damage: 10, life: 20 },
  },
  steel: {
    name: 'Steel', icon: '🛡️', color: '#a8b0bc', mechanic: 'Armor stacks, block, thorns', preferredBy: ['paladin', 'viking'],
    sets: {
      2: ['Bulwark', 'Blocking or taking a hit gives an armor stack (+3% armor each, 5 at most, +1 per 10 in your secondary stat; they fade 4 s after the last).'],
      4: ['Spiked', 'Thorns: an enemy that hits you takes 4 × your armor % of the hit back.'],
      6: ['Juggernaut', 'At full armor stacks your next attack releases them all as a shockwave.'],
    },
    n: { stackArmor: 0.03, stacksMax: 5, stacksPer10S: 1, fade: 4, thornsMult: 4, quakePerStack: 20, quakeRadius: 160 },
  },
} satisfies Record<FamilyId, { name: string; icon: string; color: string; mechanic: string; preferredBy: ClassId[]; sets: Record<2 | 4 | 6, [string, string]>; n: Record<string, number> }>;
export const FAMILY_IDS = Object.keys(FAMILIES) as FamilyId[];
export const SET_LEVELS = [2, 4, 6] as const;
export type SetLevel = (typeof SET_LEVELS)[number];

export const RELICS = {
  // ---------------------------------------------------------------- 🔥 Flame
  brimstoneOil: relic({ name: 'Brimstone Oil', rarity: 'common', icon: '🔥', family: 'flame', n: { chance: 0.35, power: 0.5 }, n2: { chance: 0.5 },
    awaken: ['Hellfire', 'Ability hits add 2 burn stacks.'], desc: (n) => `Attacks have a ${pct(n.chance)} chance to add a burn stack (${pct(n.power)} of the hit per second).` }),
  emberheart: relic({ name: 'Emberheart', rarity: 'common', icon: '🧡', family: 'flame', n: { per: 0.2, max: 5, radius: 250 }, n2: { per: 0.25 },
    awaken: ['Kindled', 'While 5 or more burning enemies are near, every hit adds a burn stack.'], desc: (n) => `+${pct(n.per)} damage for each burning enemy within ${n.radius} px (up to ${n.max}).` }),
  cinderCharm: relic({ name: 'Cinder Charm', rarity: 'common', icon: '🪔', family: 'flame', n: { stacks: 2, range: 220 }, n2: { stacks: 3 },
    awaken: ['Ember Storm', 'The ember splits in three.'], desc: (n) => `A burning enemy you kill throws an ember at the nearest enemy: ${n.stacks} burn stack${n.stacks > 1 ? 's' : ''}.` }),
  salamanderScale: relic({ name: 'Salamander Scale', rarity: 'rare', icon: '🦎', family: 'flame', n: { bonus: 0.35, stacks: 3 }, n2: { bonus: 0.5 },
    awaken: ['Scorched Earth', 'An enemy that dies at full burn stacks leaves a fire patch for 3 s that adds burn stacks.'], desc: (n) => `Enemies at ${n.stacks}+ burn stacks take ${pct(n.bonus)} more damage from you.` }),
  dragonsTongue: relic({ name: "Dragon's Tongue", rarity: 'legendary', icon: '🐉', family: 'flame', n: { every: 6, stacks: 3, range: 230, arc: 0.9 }, n2: { every: 4, stacks: 4 },
    awaken: ['Wyrmfire', 'The cone detonates every burn it touches for its remaining damage at once.'], desc: (n) => `Every ${n.every} s your next attack also breathes a cone of fire: ${n.stacks} burn stacks.` }),
  fireArrows: relic({ name: 'Fire Arrows', rarity: 'rare', icon: '🏹', family: 'flame', classId: 'archer', n: { perFocus: 0.04 }, n2: { perFocus: 0.06 },
    awaken: ['Rain of Cinders', "The Volley's area keeps burning for 3 s."], desc: (n) => `Arrow Volley's arrows each add a burn stack; burn damage +${pct(n.perFocus)} per Focus.` }),
  sunfireCenser: relic({ name: 'Sunfire Censer', rarity: 'rare', icon: '🕯️', family: 'flame', classId: 'angel', n: { per: 6 }, n2: { per: 4 },
    awaken: ['Solar Flare', 'Enemies killed by Radiance burst into fire (a Pyre explosion).'], desc: (n) => `Heavenly Radiance adds 1 + Grace/${n.per} burn stacks to everything it hits.` }),
  radiantBrand: relic({ name: 'Radiant Brand', rarity: 'rare', icon: '☀️', family: 'flame', classId: 'paladin', n: { base: 2, per: 5 }, n2: { per: 4 },
    awaken: ['Pillar of Dawn', 'While the shield holds, burning enemies touching you take their burn damage again every second.'], desc: (n) => `Divine Shield's burst adds ${n.base} + Faith/${n.per} burn stacks.` }),

  // ---------------------------------------------------------------- ❄️ Frost
  frostBrand: relic({ name: 'Frost Brand', rarity: 'common', icon: '❄️', family: 'frost', n: { chance: 0.35, chill: 2 }, n2: { chance: 0.5 }, a: { reduce: 0.2 },
    awaken: ['Hoarfrost', (a) => `Chilled enemies deal ${pct(a.reduce)} less damage.`], desc: (n) => `Attacks have a ${pct(n.chance)} chance to chill.` }),
  wintersGrasp: relic({ name: "Winter's Grasp", rarity: 'common', icon: '🧤', family: 'frost', n: { chill: 3 }, n2: { chill: 5 }, a: { time: 1 },
    awaken: ['Deep Freeze', (a) => `Enemies your ability freezes stay frozen ${a.time} s longer.`], desc: (n) => `Your signature ability chills everything it hits (${n.chill} chill).` }),
  shatterglass: relic({ name: 'Shatterglass', rarity: 'rare', icon: '🔹', family: 'frost', n: { critDamage: 0.25 }, n2: { critDamage: 0.4 }, a: { shards: 3, reach: 180, damage: 10, chill: 1 },
    awaken: ['Splinter', (a) => `A crit on a frozen enemy sprays ${a.shards} ice shards that chill.`], desc: (n) => `Your hits on frozen enemies always crit, with +${pct(n.critDamage)} crit damage.` }),
  glacialHeart: relic({ name: 'Glacial Heart', rarity: 'rare', icon: '💠', family: 'frost', n: { reduce: 0.2, count: 2, radius: 260 }, n2: { reduce: 0.25 }, a: { atkSpd: 0.2, time: 2 },
    awaken: ['Cold Blood', (a) => `Every freeze near you gives +${pct(a.atkSpd)} attack speed for ${a.time} s.`], desc: (n) => `While ${n.count} or more chilled enemies are near you, you take ${pct(n.reduce)} less damage.` }),
  everfrostCrown: relic({ name: 'Everfrost Crown', rarity: 'legendary', icon: '👑', family: 'frost', n: { every: 10, radius: 200, chill: 5 }, n2: { every: 7 }, a: { life: 3, size: 0.8, dps: 6 },
    awaken: ['Blizzard', (a) => `The nova leaves a freezing field for ${a.life} s.`], desc: (n) => `Every ${n.every} s a frost nova around you chills everything within ${n.radius} px (${n.chill} chill).` }),
  rimebow: relic({ name: 'Rimebow', rarity: 'rare', icon: '🎯', family: 'frost', classId: 'archer', n: { chill: 2, perFocus: 0.03 }, n2: { perFocus: 0.04 }, a: { freeze: 0.5 },
    awaken: ['Frozen Volley', (a) => `Arrow Volley freezes what it hits for ${a.freeze} s.`], desc: (n) => `Crits chill (${n.chill} chill); your chill lasts ${pct(n.perFocus)} longer per Focus.` }),
  frostwardHalo: relic({ name: 'Frostward Halo', rarity: 'rare', icon: '🌨️', family: 'frost', classId: 'angel', n: { chill: 2, heal: 0.15, max: 3 }, n2: { heal: 0.2 }, a: { ward: 0.02 },
    awaken: ['Winter Grace', (a) => `Freezing an enemy near you grants ward (${pct(a.ward)} of your max HP).`], desc: (n) => `Heavenly Radiance chills (${n.chill} chill) and heals ${pct(n.heal)} more per frozen enemy near you (up to ${n.max}).` }),
  lichLantern: relic({ name: 'Lich Lantern', rarity: 'rare', icon: '🏮', family: 'frost', classId: 'necromancer', n: { per: 15 }, n2: { per: 10 }, a: { radius: 80, damage: 12 },
    awaken: ['Frost Legion', 'Skeletons burst in a frost nova when they expire.'], desc: (n) => `Skeletons' hits chill: 1 chill, +1 per ${n.per} Soul Power.` }),

  // ---------------------------------------------------------------- ⚡ Storm
  stormPennant: relic({ name: 'Storm Pennant', rarity: 'common', icon: '⚡', family: 'storm', n: { chance: 0.3, mult: 0.8, range: 170 }, n2: { chance: 0.4, mult: 0.9 },
    awaken: ['Thunderhead', 'Chains jump twice.'], desc: (n) => `Attacks have a ${pct(n.chance)} chance to chain to another enemy for ${pct(n.mult)} damage.` }),
  quicksilverSpurs: relic({ name: 'Quicksilver Spurs', rarity: 'common', icon: '🥾', family: 'storm', n: { per: 0.05, max: 10, time: 4 }, n2: { per: 0.07 },
    awaken: ['Blur', 'At full stacks your utility cools down 50% faster.'], desc: (n) => `Every chain or crit gives +${pct(n.per)} attack and movement speed for ${n.time} s (up to ${n.max} stacks).` }),
  tempestEye: relic({ name: 'Tempest Eye', rarity: 'rare', icon: '👁️', family: 'storm', mods: { crit: 0.1 }, mods2: { crit: 0.15 }, n: { crit: 0.1, mult: 0.6, range: 170 }, n2: { crit: 0.15, mult: 0.75 },
    awaken: ['Eye of the Storm', 'Chain hits can crit.'], desc: (n) => `+${pct(n.crit)} crit chance; crits chain to another enemy for ${pct(n.mult)}.` }),
  thunderDrum: relic({ name: 'Thunder Drum', rarity: 'rare', icon: '🥁', family: 'storm', n: { damage: 150, radius: 170, mult: 0.5, range: 170 }, n2: { damage: 220 },
    awaken: ['Rolling Thunder', 'The thunderclap sounds again 1 s later.'], desc: (n) => `Using your ability sounds a thunderclap: ${n.damage}+ damage around you (grows with level), chaining from every enemy hit.` }),
  stormcallersHorn: relic({ name: "Stormcaller's Horn", rarity: 'legendary', icon: '📯', family: 'storm', n: { every: 15, mult: 3, radius: 70, range: 400 }, n2: { every: 12 },
    awaken: ['Skyfury', 'The strike chains to 3 more enemies.'], desc: (n) => `Every ${n.every} kills a lightning strike hits the toughest enemy near you (${n.mult}× your hit).` }),
  galeforceQuiver: relic({ name: 'Galeforce Quiver', rarity: 'rare', icon: '🪶', family: 'storm', classId: 'archer', n: { per: 4, mult: 0.7, range: 170 }, n2: { per: 3, mult: 0.85 },
    awaken: ['Gale Shot', 'Every 10th arrow is a lightning bolt that chains 5 times.'], desc: (n) => `Arrows pierce one more enemy per ${n.per} Focus, and every third arrow hit chains to another enemy (${pct(n.mult)}).` }),
  stormbornPelt: relic({ name: 'Stormborn Pelt', rarity: 'rare', icon: '🌩️', family: 'storm', classId: 'viking', n: { every: 4, perRage: 0.01, range: 170 }, n2: { every: 3 },
    awaken: ['Thunder God', 'Kills during Rage extend it by 0.03 s × Rage (up to double length).'], desc: (n) => `During Berserker Rage every ${n.every}th hit chains to another enemy for 50% + ${pct(n.perRage)} per Rage.` }),

  // ---------------------------------------------------------------- 🩸 Blood
  serratedEdge: relic({ name: 'Serrated Edge', rarity: 'common', icon: '🩹', family: 'blood', n: { stacks: 2, power: 0.6 }, n2: { stacks: 3 },
    awaken: ['Haemorrhage', '+20% crit damage against bleeding enemies.'], desc: (n) => `Crits open ${n.stacks} bleed stacks (${pct(n.power)} of the hit per second each).` }),
  butchersHook: relic({ name: "Butcher's Hook", rarity: 'common', icon: '🪝', family: 'blood', n: { slow: 0.15, bonus: 0.15 }, n2: { slow: 0.2, bonus: 0.2 },
    awaken: ['Gutting', 'A bleeding enemy you kill passes its bleed to 2 enemies near it.'], desc: (n) => `Bleeding enemies are ${pct(n.slow)} slower and take ${pct(n.bonus)} more damage from your attacks.` }),
  berserkerTooth: relic({ name: 'Berserker Tooth', rarity: 'rare', icon: '🦷', family: 'blood', n: { per: 1.5, max: 0.45 }, n2: { per: 1, max: 0.6 },
    awaken: ['Last Blood', 'Below 25% HP every bleed you apply is doubled.'], desc: (n) => `+1% attack speed for every ${n.per}% of HP missing (up to ${pct(n.max)}).` }),
  vampireFang: relic({ name: 'Vampire Fang', rarity: 'rare', icon: '🧛', family: 'blood', n: { leech: 0.03 }, n2: { leech: 0.05 },
    awaken: ['Thirst', 'Below half HP it heals twice as much.'], desc: (n) => `Hits on bleeding enemies heal you ${pct(n.leech)} of the damage.` }),
  bloodPact: relic({ name: 'Blood Pact', rarity: 'legendary', icon: '🩸', family: 'blood', mods: { damage: 1.4 }, mods2: { damage: 1.55 }, n: { bonus: 0.4, hp: 0.75 }, n2: { bonus: 0.55, hp: 0.8 },
    awaken: ['Covenant', 'Below half HP kills restore 1% of your max HP.'], desc: (n) => `+${pct(n.bonus)} damage, but your max HP is cut to ${pct(n.hp)}.` }),
  wolfskin: relic({ name: 'Wolfskin Cloak', rarity: 'rare', icon: '🐺', family: 'blood', classId: 'viking', n: { per: 15 }, n2: { per: 10 },
    awaken: ['Blood Frenzy', 'Bleeding enemies you kill during Rage give +5% attack speed for the rest of it (up to 25%).'], desc: (n) => `During Berserker Rage your hits add a bleed stack, +1 per ${n.per} Rage.` }),

  // ---------------------------------------------------------------- ✨ Holy
  rallyBanner: relic({ name: 'Rally Banner', rarity: 'common', icon: '🚩', family: 'holy', n: { heal: 0.12 }, n2: { heal: 0.18 },
    awaken: ['Hymn', 'The heal also grants that much ward.'], desc: (n) => `Heal ${pct(n.heal)} of your max HP at the start of every wave.` }),
  blessedWater: relic({ name: 'Blessed Water', rarity: 'common', icon: '💧', family: 'holy', n: { bonus: 0.2 }, n2: { bonus: 0.3 },
    awaken: ['Baptism', 'Every heal also cleanses one status (poison, bleed, curse or chill).'], desc: (n) => `Your healing is ${pct(n.bonus)} stronger.` }),
  guardiansAegis: relic({ name: "Guardian's Aegis", rarity: 'rare', icon: '🔰', family: 'holy', n: { every: 15, ward: 0.05 }, n2: { every: 12 },
    awaken: ['Faithful', 'While warded, +15% damage.'], desc: (n) => `Every ${n.every} s gain ward equal to ${pct(n.ward)} of your max HP.` }),
  haloOfMercy: relic({ name: 'Halo of Mercy', rarity: 'rare', icon: '😇', family: 'holy', n: { chance: 0.08, heal: 0.05 }, n2: { chance: 0.12 },
    awaken: ['Grace', 'Mercy orbs also grant that much ward.'], desc: (n) => `Kills have a ${pct(n.chance)} chance to release a mercy orb that heals you ${pct(n.heal)} of your max HP.` }),
  phoenixFeather: relic({ name: 'Phoenix Feather', rarity: 'legendary', icon: '🪶', family: 'holy', n: { hp: 0.5, radius: 220, damage: 60 }, n2: { hp: 1 },
    awaken: ['Rebirth', 'Rising sets everything near you ablaze with holy fire.'], desc: (n) => `Once per run, rise from death with ${pct(n.hp)} of your HP.` }),
  reliquary: relic({ name: 'Reliquary of Saints', rarity: 'rare', icon: '⚱️', family: 'holy', classId: 'paladin', n: { perFaith: 0.02 }, n2: { perFaith: 0.03 },
    awaken: ["Martyr's Relic", 'Divine Shield also grants ward equal to 1% of your max HP per Faith when it ends.'], desc: (n) => `Every hit you take shaves ${n.perFaith} s × Faith off Divine Shield's cooldown.` }),
  seraphHalo: relic({ name: "Seraph's Halo", rarity: 'rare', icon: '🪽', family: 'holy', classId: 'angel', n: { base: 4, perGrace: 0.8, mult: 1.5 }, n2: { base: 6, perGrace: 1 },
    awaken: ['Choir of Light', 'The bolts heal you for 1% of your max HP each when they hit.'], desc: (n) => `Heavenly Radiance also fires ${n.base} + Grace × ${n.perGrace} light bolts in all directions.` }),
  hallowedBones: relic({ name: 'Hallowed Bones', rarity: 'rare', icon: '🦴', family: 'holy', classId: 'necromancer', n: { ward: 0.2, heal: 0.01, perSoul: 0.001 }, n2: { ward: 0.3 },
    awaken: ['Sanctified Legion', "Skeletons' hits heal you for 0.5% of the damage."], desc: (n) => `Skeletons you raise carry a ward of ${pct(n.ward)} of their HP, and a skeleton that expires heals you ${pct(n.heal)} of your max HP (+0.1% per Soul Power).` }),

  // ---------------------------------------------------------------- 💀 Grave
  soulLantern: relic({ name: 'Soul Lantern', rarity: 'legendary', icon: '🔮', family: 'grave', n: { chance: 0.1, max: 4, life: 9, hp: 40, damage: 8 }, n2: { chance: 0.15, max: 6 },
    awaken: ['Lantern of the Lost', 'Skeletons burst in shadow when they expire.'], desc: (n) => `Kills have a ${pct(n.chance)} chance to raise a skeleton ally (up to ${n.max}).` }),
  hexDoll: relic({ name: 'Hex Doll', rarity: 'rare', icon: '🪆', family: 'grave', n: { stacks: 1 }, n2: { stacks: 2 },
    awaken: ['Voodoo', 'A cursed enemy that dies passes its curse to the nearest enemy.'], desc: (n) => `Your signature ability curses what it hits: ${n.stacks} stack${n.stacks > 1 ? 's' : ''} per hit (+12% damage taken per stack, up to 3).` }),
  gravePact: relic({ name: 'Grave Pact', rarity: 'rare', icon: '🕯️', family: 'grave', n: { time: 7 }, n2: { time: 10 },
    awaken: ['Unholy Pact', "Blessed minions' hits curse."], desc: (n) => `Your ability blesses your minions for ${n.time} s (+30% damage, they mend); with no minions it raises a skeleton for that long.` }),
  gravediggersSpade: relic({ name: "Gravedigger's Spade", rarity: 'common', icon: '⚰️', family: 'grave', n: { per: 0.05, max: 5, radius: 150 }, n2: { per: 0.07 },
    awaken: ['Exhume', 'Every 20 s the oldest corpse near you rises as a skeleton.'], desc: (n) => `+${pct(n.per)} damage for every corpse within ${n.radius} px (up to ${n.max}).` }),
  deathmask: relic({ name: 'Deathmask', rarity: 'common', icon: '🎭', family: 'grave', n: { reduce: 0.15, chance: 0.2 }, n2: { reduce: 0.2 },
    awaken: ['Mark of the Grave', 'A cursed enemy you kill leaves a corpse that bursts in shadow after 1 s.'], desc: (n) => `Hits have a ${pct(n.chance)} chance to curse; cursed enemies deal ${pct(n.reduce)} less damage.` }),
  boneChime: relic({ name: 'Bone Chime', rarity: 'rare', icon: '🎐', family: 'grave', classId: 'necromancer', n: { inherit: 0.5, perSoul: 0.02 }, n2: { inherit: 0.7, perSoul: 0.03 },
    awaken: ['Death Knell', 'Every 20th minion hit tolls the chime: a shadow burst around that minion.'], desc: (n) => `Minions inherit ${pct(n.inherit)} of your attack speed, plus ${pct(n.perSoul)} per Soul Power.` }),

  // ---------------------------------------------------------------- 🛡️ Steel
  towerShield: relic({ name: 'Tower Shield', rarity: 'common', icon: '🛡️', family: 'steel', n: { chance: 0.1 }, n2: { chance: 0.14 },
    awaken: ['Shield Wall', 'A block knocks the attacker back and stuns it for 0.5 s.'], desc: (n) => `${pct(n.chance)} chance to block a hit.` }),
  thornMail: relic({ name: 'Thorn Mail', rarity: 'common', icon: '🌵', family: 'steel', n: { mult: 16 }, n2: { mult: 22 },
    awaken: ['Briar Plate', 'Blocked hits are thrown back too.'], desc: (n) => `Enemies that hit you take ${n.mult}× that damage back.` }),
  anvilHeart: relic({ name: 'Anvil Heart', rarity: 'rare', icon: '⚒️', family: 'steel', n: { per: 1.5 }, n2: { per: 1 },
    awaken: ['Forgefire', 'At full armor stacks your hits stagger (a short slow).'], desc: (n) => `+1% damage for every ${n.per}% armor you have.` }),
  shockSigil: relic({ name: 'Shockwave Sigil', rarity: 'rare', icon: '🌀', family: 'steel', n: { cooldown: 4, radius: 150, damage: 60, knockback: 380 }, n2: { cooldown: 3, damage: 90 },
    awaken: ['Quake Plate', 'The shockwave gives an armor stack for every enemy it hits.'], desc: (n) => `Taking damage releases a shockwave (${n.damage}+ damage, every ${n.cooldown} s at most).` }),
  unbreakable: relic({ name: 'Unbreakable', rarity: 'legendary', icon: '🗿', family: 'steel', n: { every: 30, over: 0.25 }, n2: { every: 20 },
    awaken: ['Adamant', 'After it blocks, +50% armor for 4 s.'], desc: (n) => `Once every ${n.every} s, a hit that would take more than ${pct(n.over)} of your HP is blocked.` }),
  aegisFaithful: relic({ name: 'Aegis of the Faithful', rarity: 'rare', icon: '⛨', family: 'steel', classId: 'paladin', n: { per: 3 }, n2: { per: 2 },
    awaken: ['Consecrated Steel', "At full armor stacks Divine Shield's burst is 50% larger."], desc: (n) => `When Divine Shield ends you gain an armor stack per ${n.per} Faith.` }),
  ironhide: relic({ name: 'Ironhide', rarity: 'rare', icon: '🐗', family: 'steel', classId: 'viking', n: { every: 2 }, n2: { every: 1.5 },
    awaken: ['Unstoppable', 'During Rage, blocked hits heal 2% of your max HP.'], desc: (n) => `Berserker Rage gives an armor stack every ${n.every} s.` }),

  // ---------------------------------------------------------------- ☠ Cursed (v0.7.1 B6): no family; the awakening lifts the curse
  hungeringBlade: relic({ name: 'Hungering Blade', rarity: 'legendary', icon: '🗡️', cursed: true, n: { per: 0.02, max: 0.6, starve: 5, bite: 0.06 }, n2: { per: 0.03, max: 0.9 },
    awaken: ['Sated', 'The curse lifts: it no longer feeds on you.'], desc: (n) => `Every kill this wave adds +${pct(n.per)} damage (up to +${pct(n.max)}). Curse: after ${n.starve} s without a kill it feeds on you, ${pct(n.bite)} of your max HP.` }),
  doomBell: relic({ name: 'Doom Bell', rarity: 'legendary', icon: '🔔', cursed: true, n: { frac: 0.25, radius: 110, speed: 0.15 }, n2: { frac: 0.35 },
    awaken: ['Last Toll', 'The curse lifts: the horde no longer hurries.'], desc: (n) => `Every kill tolls: the dead burst for ${pct(n.frac)} of their max HP around them. Curse: the horde hears it and moves ${pct(n.speed)} faster.` }),
  scepterOfRuin: relic({ name: 'Scepter of Ruin', rarity: 'legendary', icon: '🔱', cursed: true, mods: { cooldown: 0.55 }, mods2: { cooldown: 0.45 }, n: { cut: 0.45, cost: 0.1 }, n2: { cut: 0.55 },
    awaken: ['Crowned in Ruin', 'The curse lifts: casting no longer costs HP.'], desc: (n) => `Your signature ability's cooldown is ${pct(n.cut)} shorter. Curse: every cast costs ${pct(n.cost)} of your current HP.` }),
  abyssalEye: relic({ name: 'Abyssal Eye', rarity: 'legendary', icon: '🧿', cursed: true, n: { radius: 220, bonus: 0.4, taken: 0.25 }, n2: { bonus: 0.55 },
    awaken: ['Unblinking', 'The curse lifts: enemies near you no longer hit harder.'], desc: (n) => `Enemies within ${n.radius} px take ${pct(n.bonus)} more damage from you. Curse: they deal ${pct(n.taken)} more to you.` }),
  crimsonChalice: relic({ name: 'Crimson Chalice', rarity: 'legendary', icon: '🍷', cursed: true, n: { leech: 0.03, hp: 0.7 }, n2: { leech: 0.045 },
    awaken: ['Overflowing', 'The curse lifts: your max HP comes back.'], desc: (n) => `${pct(n.leech)} of all the damage you deal heals you (under the relic healing cap). Curse: your max HP is cut to ${pct(n.hp)}.` }),
  tyrantsBanner: relic({ name: "Tyrant's Banner", rarity: 'legendary', icon: '🏴', cursed: true, n: { per: 0.04, max: 0.6, elites: 1.6 }, n2: { per: 0.06, max: 0.9 },
    awaken: ['Conqueror', 'The curse lifts: elites come as often as before.'], desc: (n) => `Every elite you slay adds +${pct(n.per)} damage and attack speed for the rest of the run (up to +${pct(n.max)}). Curse: ${pct(n.elites - 1)} more elites.` }),
};

export type RelicId = keyof typeof RELICS;
export const RELIC_IDS = Object.keys(RELICS) as RelicId[];
export const relicDef = (id: RelicId): RelicDef => RELICS[id];
/** v0.7.1 B6: the cursed relics (no family), and whether a relic is one. */
export const isCursedRelic = (id: RelicId): boolean => RELICS[id].cursed === true;
export const CURSED_IDS = RELIC_IDS.filter(isCursedRelic);

/** The numbers of a relic at a tier (1..RELIC_MAX_TIER). Tier III (awakened) keeps tier II's numbers. */
export function relicN(id: RelicId, tier: number): Record<string, number> {
  const def = RELICS[id];
  return tier >= 2 ? { ...def.n, ...def.tiers[0].n } : def.n;
}

export function relicMods(id: RelicId, tier: number): Partial<Mods> | undefined {
  const def = RELICS[id];
  return tier >= 2 && def.tiers[0].mods ? { ...def.mods, ...def.tiers[0].mods } : def.mods;
}

export const relicDesc = (id: RelicId, tier: number): string => {
  const def = RELICS[id];
  const text = tier <= 1 ? def.desc : def.describe(relicN(id, tier));
  return tier >= RELIC_MAX_TIER ? `${text} Awakened, ${def.awaken.name}: ${def.awaken.desc}` : text;
};

/** The families this class prefers (it can max them with straight pieces), in the order of FAMILY_IDS. */
export const preferredFamilies = (classId: ClassId): FamilyId[] => FAMILY_IDS.filter((f) => (FAMILIES[f].preferredBy as readonly ClassId[]).includes(classId));

/**
 * v0.7 A5 duo relics (RELICS.md): hold both source relics (of two families) and a relic moment offers the duo as a gold fourth card that
 * takes the pick. v0.7.5 (#96): a formed duo combines its two sources into one relic (both effects plus its own, one shared tier up to III);
 * the families keep the sources' counts and the duo adds none. Effects: systems/relicFamilies/duos.ts.
 */
export interface DuoDef { name: string; icon: string; families: [FamilyId, FamilyId]; from: [RelicId, RelicId]; desc: string; n: Record<string, number> }
const duo = (name: string, icon: string, families: [FamilyId, FamilyId], from: [RelicId, RelicId], desc: string, n: Record<string, number> = {}): DuoDef => ({ name, icon, families, from, desc, n });
export const DUOS = {
  thermalShock: duo('Thermal Shock', '♨️', ['flame', 'frost'], ['brimstoneOil', 'frostBrand'], 'A burning enemy that freezes takes the rest of its burn damage at once, and a quarter more.', { mult: 1.25 }),
  wildfire: duo('Wildfire', '🌋', ['flame', 'storm'], ['emberheart', 'stormPennant'], 'Chains copy the burn stacks of the enemy they jump from.'),
  boilingBlood: duo('Boiling Blood', '🫕', ['flame', 'blood'], ['salamanderScale', 'serratedEdge'], 'Enemies that burn and bleed take both ticks 50% faster.', { faster: 0.5, every: 0.5 }),
  funeralPyre: duo('Funeral Pyre', '🪦', ['flame', 'grave'], ['dragonsTongue', 'gravediggersSpade'], 'Fire that touches a corpse detonates it (a Pyre explosion).', { touch: 40, damage: 40, every: 0.5 }),
  hailstorm: duo('Hailstorm', '🌪️', ['frost', 'storm'], ['everfrostCrown', 'thunderDrum'], 'Chains chill; a chain that hits a frozen enemy jumps twice more.', { chill: 1, jumps: 2, range: 170 }),
  rimeDead: duo('Rime Dead', '🧟', ['frost', 'grave'], ['wintersGrasp', 'soulLantern'], "Skeletons' hits chill, and frozen enemies you kill rise as skeletons (up to 4).", { chill: 1, max: 4, hp: 50, damage: 10, life: 15 }),
  glacierPlate: duo('Glacier Plate', '🏔️', ['frost', 'steel'], ['shatterglass', 'towerShield'], 'A block freezes the attacker.', { freeze: 1.5 }),
  redLightning: duo('Red Lightning', '💢', ['storm', 'blood'], ['tempestEye', 'butchersHook'], 'Chains add a bleed stack, and a crit on a bleeding enemy chains to two more enemies.', { bleed: 1, power: 0.1, jumps: 2, mult: 0.5, range: 170 }),
  lightningRod: duo('Lightning Rod', '🗼', ['storm', 'steel'], ['stormcallersHorn', 'shockSigil'], 'The shockwave calls a lightning strike on every enemy it hits.', { mult: 0.6, radius: 50 }),
  martyrsCovenant: duo("Martyr's Covenant", '📜', ['blood', 'holy'], ['bloodPact', 'guardiansAegis'], '30% of the damage you take comes back as ward over 3 s.', { share: 0.3, over: 3 }),
  requiem: duo('Requiem', '🎼', ['holy', 'grave'], ['haloOfMercy', 'deathmask'], 'Cursed enemies always drop a mercy orb.'),
  consecration: duo('Consecration', '⛪', ['holy', 'steel'], ['rallyBanner', 'thornMail'], 'Ward you gain also gives an armor stack, and a block heals 2% of your max HP.', { heal: 0.02 }),
} satisfies Record<string, DuoDef>;
export type DuoId = keyof typeof DUOS;
export const DUO_IDS = Object.keys(DUOS) as DuoId[];
export const DUO_COLOR = '#f2c94c';
/** Anything that does relic work: a relic or a duo (credit, contribution, proc icons). */
export type RelicKey = RelicId | DuoId | FamilyId; // a family: its set bonuses (A8: they are relic power too)
export const isDuo = (k: RelicKey): k is DuoId => k in DUOS;
export const isFamily = (k: RelicKey): k is FamilyId => k in FAMILIES;
export const keyName = (k: RelicKey): string => (isDuo(k) ? DUOS[k].name : isFamily(k) ? `${FAMILIES[k].name} set` : relicDef(k).name);
export const keyIcon = (k: RelicKey): string => (isDuo(k) ? DUOS[k].icon : isFamily(k) ? FAMILIES[k].icon : relicDef(k).icon);
export const keyColor = (k: RelicKey): string => (isDuo(k) ? DUO_COLOR : isFamily(k) ? FAMILIES[k].color : relicDef(k).family ? FAMILIES[relicDef(k).family!].color : CURSED.color);
/** The duo a relic is a source of (every source relic is in exactly one recipe). */
export const duoOf = (id: RelicId): DuoId | undefined => DUO_IDS.find((d) => DUOS[d].from.includes(id));

