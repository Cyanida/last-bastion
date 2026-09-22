import type { AbilityUpgradeId } from '../config/abilityUpgrades';
import type { ArenaDef, ArenaId } from '../config/arenas';
import type { CurseId } from '../config/curses';
import type { ClassDef } from '../config/classes';
import type { TierDef } from '../config/economy';
import type { AffixId } from '../config/elites';
import type { EnemyDef, EnemyId } from '../config/enemies';
import type { RelicId, SynergyId } from '../config/relics';
import type { TraitId } from '../config/traits';
import type { BlessingId, FeatureKind, Rect, RegionId, WingId } from '../config/regions';
import type { UtilityUpgradeId } from '../config/utility';
import type { QuestKind, RewardKind } from '../config/quests';
import type { RunLogDraft } from '../logic/runlog';
import type { EventKind } from '../config/events';
import type { TreasureId } from '../config/treasures';
import type { RelicTotals } from '../logic/relics';
import type { ModifierId } from '../config/waves';
import type { SpawnUnit, SquadPlan } from '../logic/director';
import type { AiState } from '../logic/fsm';
import type { Formation, Vec } from '../logic/squads';
import type { DamageType } from '../config/damage';
import type { StatusApply, StatusMap } from '../logic/status';
import type { Sprite } from '../render/sprites';
import type { SpatialHash } from './spatial';

export type StatKey = 'hp' | 'str' | 'dex' | 'int' | 'atkSpd' | 'moveSpd' | 'secondary';
export type Stats = Record<StatKey, number>;
export const STAT_KEYS: StatKey[] = ['hp', 'str', 'dex', 'int', 'atkSpd', 'moveSpd', 'secondary'];

export type Rng = () => number;
export type DamageSource = 'attack' | 'ability' | 'minion' | 'relic' | 'hazard';

/** Run-wide modifiers, rebuilt every tick from meta upgrades, tradeoffs, relics and passive ability upgrades. */
export interface Mods {
  // multipliers
  damage: number;
  atkSpd: number;
  moveSpd: number;
  cooldown: number;
  pickup: number;
  xp: number;
  gold: number;
  minionAtkSpd: number;
  minionDamage: number;
  // v0.4 talents and traits
  abilityDur: number; // signature ability duration
  abilityCd: number; // signature ability cooldown
  utilityCd: number; // utility ability cooldown
  utilityPower: number; // utility ability damage / heal / pull
  bossDamage: number; // player damage to bosses
  // additive
  armor: number;
  crit: number;
  lifesteal: number;
  regen: number;
  pierce: number;
  critDamage: number; // added to the crit multiplier
  dodge: number; // chance to ignore a hit
  thorns: number; // share of damage taken thrown back at the attacker
  onKillHeal: number; // HP per kill
  lowHpDamage: number; // damage bonus below half HP
  minionMax: number; // extra minions
}

/** Temporary combat buff owned by the signature ability. */
export interface Buff {
  damage: number;
  atkSpd: number;
  lifesteal: number;
  multishot: number; // extra projectiles per basic attack
  fullCircle: boolean; // melee hits all around
  range: number; // melee range multiplier
}

/** Debuffs an attack can put on enemies. */
export interface Status {
  slowMul?: number;
  slowT?: number;
  markMul?: number;
  markT?: number;
  apply?: StatusApply[]; // v0.3 status effects (burn, bleed, poison, stun...)
}

export interface Body {
  x: number;
  y: number;
  r: number;
}

export interface Player extends Body {
  cls: ClassDef;
  stats: Stats;
  hp: number;
  level: number;
  xp: number;
  facing: number;
  flip: boolean;
  attackTimer: number;
  abilityCd: number;
  abilityCdMax: number;
  abilityTime: number; // remaining active time of the signature ability
  abilityDur: number;
  invulnerable: boolean;
  buff: Buff;
  mods: Mods;
  upgrades: AbilityUpgradeId[]; // chosen signature-ability upgrades
  // v0.4
  talents: string[]; // taken talent node ids (config/talents.ts)
  utilityCd: number;
  utilityCdMax: number;
  utilityUpgrades: UtilityUpgradeId[];
  revives: number; // stored revive charges (Phoenix Feather)
  reviveT: number; // Guardian Angel window: dying while > 0 revives instead
  invulnT: number; // brief grace after a revive
  deathless: boolean; // HP cannot drop below 1
  absorbed: number; // damage soaked by Divine Shield this cast
  chillT: number; // slowed by a Frost Aura elite
  still: number; // seconds without moving
  statuses: StatusMap; // v0.3: burn, bleed, poison, chill, curse from enemies
  dots: Partial<Record<DamageType, number>>; // damage-over-time waiting for the next tick
  dotT: number;
  iFrames: number;
  flash: number;
}

export interface Telegraph {
  angle: number;
  length: number;
  width: number;
  t: number;
  dur: number;
}

export interface Enemy extends Body {
  def: EnemyDef;
  hp: number;
  maxHp: number;
  damage: number;
  xp: number;
  speed: number; // effective speed this tick (baseSpeed with statuses applied)
  baseSpeed: number;
  elite: boolean;
  affixes: AffixId[];
  shield: number; // Shielded affix
  shieldMax: number;
  shieldT: number; // seconds until the shield starts regenerating
  slowT: number;
  slowMul: number;
  fearT: number;
  tauntT: number; // v0.4: the Paladin's Challenge; it can only go for the player while > 0
  markT: number;
  markMul: number;
  phase: number; // bosses: 1, then 2 below half HP
  combo: number;
  // v0.3: state machine (logic/fsm.ts), squads, commander auras
  ai: AiState;
  aiT: number; // time in the current state
  thinkT: number; // countdown to the next expensive check
  born: number; // g.time at spawn
  flankDir: 1 | -1;
  flankRoll: number; // fixed 0..1, compared with the profile's flank tendency
  crowded: boolean;
  retreatT: number; // hit-and-run timer
  fleeCd: number;
  healer: Enemy | null; // where it runs to when it flees
  strafeT: number;
  squad: Squad | null;
  slot: number; // index into squad.offsets, -1 for the commander
  buffDmg: number; // commander auras, valid while buffT > 0
  buffSpd: number;
  buffT: number;
  auraT: number; // commanders: countdown to the next aura pulse
  hidden: boolean; // cannot be auto-targeted (assassins, a flying dragon)
  side: boolean; // v0.5: side content (a lair, a quest target, an event): not counted for clearing the wave
  waypoint: { x: number; y: number } | null; // v0.5: the gate to walk to when the player is on another floor (logic/regions waypoint)
  statuses: StatusMap;
  dots: Partial<Record<DamageType, number>>;
  dotT: number;
  armorHp: number; // soaks part of every hit until it breaks (config/damage.ts ARMOR)
  armorMax: number;
  lastText: FloatText | null; // the damage number hits merge into
  spr: Sprite | null; // render cache, looked up once
  kx: number; // knockback velocity
  ky: number;
  attackTimer: number;
  flash: number;
  flip: boolean;
  // AI scratch, meaning depends on the behavior hook
  state: number;
  timer: number;
  special: number;
  angle: number;
  charged: boolean;
  telegraph: Telegraph | null;
  dead: boolean;
}

/** A group that spawns together, marches in formation and shares a target until it engages. */
export interface Squad {
  formation: Formation;
  spacing: number;
  holdUntil: number; // breaks formation once this close to the target
  members: Enemy[]; // the commander is not in here
  commander: Enemy | null;
  offsets: Vec[]; // per member slot, local frame
  commanderSlot: Vec;
  x: number; // the anchor the formation is built around
  y: number;
  facing: number;
  target: Player | Minion | null;
  marching: boolean;
  retargetT: number;
}

export interface Minion extends Body {
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  attackCd: number;
  life: number;
  attackTimer: number;
  flash: number;
  flip: boolean;
  scale: number; // sprite scale (bone golems are bigger)
  volatile: number; // > 0: explodes for damage * volatile when it dies
  blessedT: number; // v0.3: blessed minions hit harder and regenerate
  status: Status | null; // applied by its hits
  // v0.5 friendly units from quests and events; a skeleton has none of these
  kind?: 'caravan' | 'monk' | 'knight' | 'hound'; // hound: the Bow of the Wild Hunt's (v0.5 treasures)
  passive?: boolean; // does not attack or chase: walks its path (if any) at `speed`
  path?: { x: number; y: number }[]; // waypoints, walked in a loop
  pathI?: number;
}

export interface Projectile extends Body {
  vx: number;
  vy: number;
  damage: number;
  crit: boolean;
  hostile: boolean;
  pierce: number;
  life: number;
  shape: 'arrow' | 'orb';
  color: string;
  hit: Enemy[];
  status: Status | null;
  source: DamageSource;
  dtype: DamageType;
}

/** Delayed area damage: boss telegraphs, cultist blasts, volley arrows. */
export interface Zone extends Body {
  delay: number;
  t: number;
  damage: number;
  crit: boolean;
  hostile: boolean;
  maxHits: number; // 0 = unlimited
  owner: Enemy | null; // cancelled if the owner dies first
  killsOwner: boolean; // suicide blasts
  arrow: boolean;
  color: string;
  status: Status | null;
  leaveField: { life: number; dps: number; color: string; dtype?: DamageType; apply?: StatusApply } | null; // what stays behind after detonation
  dtype: DamageType;
}

/** Lasting area: fire, poison, consecrated ground. Ticks every GAME.fieldTick seconds. */
export interface Field extends Body {
  life: number;
  max: number;
  dps: number;
  hostile: boolean;
  heal: number; // HP per second to the player while inside (friendly fields)
  color: string;
  tickT: number;
  dtype: DamageType;
  apply: StatusApply | null; // put on whoever stands in it, every tick
}

export interface Pickup {
  x: number;
  y: number;
  value: number;
  kind: 'xp' | 'gold' | 'relic' | 'fragment'; // fragment: a sacred treasure's (v0.5)
}

/** A wing's feature (v0.5): a shrine, a strongbox, a lair or a vent field with a cache. */
export interface Feature {
  wing: WingId;
  kind: FeatureKind;
  x: number;
  y: number;
  used: boolean; // taken, opened, woken or looted
  boss: Enemy | null; // the lair's sleeper, once woken
  t: number; // the vents' timer
}

/** A side quest (v0.5, config/quests.ts): offered on the Act's board, then active until done or failed. systems/quests.ts. */
export interface Quest {
  kind: QuestKind;
  reward: RewardKind;
  state: 'offered' | 'active' | 'done' | 'failed';
  name: string; // the named elite's name; otherwise the quest's
  x: number; // its point: the shrine, the chest, the chapel
  y: number;
  unit: Minion | null; // the caravan, the monk
  foes: Enemy[]; // the camps, the named elite
  progress: number; // waves survived, camps burnt, seconds held
  since: number; // g.wavesCleared when taken (the caravan); the wave the named elite comes with; the trial's target
  t: number; // once over: seconds left on the tracker
  rng: Rng; // its own seeded stream (logic/quests.ts placeRng), for where it puts things
}

/** v0.5 sacred treasures: the class's chain as the save had it, plus what this run added (config/treasures.ts, systems/treasures.ts). */
export interface Chain {
  fragments: number; // held: the save's plus the ones picked up this run
  trial: boolean; // passed, before or during this run
  tier: number; // the treasure's tier owned (0 = not earned yet)
  unlocked: number; // mastery's treasureStep: 1 = the chain, 2 = the tier III follow-up
  found: number; // fragments picked up this run
  passed: boolean; // the trial was passed in this run
  guardian: Enemy | null; // awake in the vault
  slain: boolean; // the guardian fell this run
}

/** This wave's event (v0.5, config/events.ts). systems/events.ts. */
export interface WaveEvent {
  kind: EventKind;
  x: number; // the peddler, the chest; the cart's destination
  y: number;
  unit: Minion | null; // the lost knight
  foe: Enemy | null; // the plague cart
  used: boolean; // the chest opened, the ambush sprung, the peddler visited (until you walk away)
  t: number; // the cart's pool timer
  wares: RelicId[]; // the peddler's
}

export interface Corpse {
  x: number;
  y: number;
  t: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}

export interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  size: number;
  value: number; // running total for merged damage numbers
  owner: Enemy | null;
  img: HTMLCanvasElement | null; // pre-rendered by the renderer, dropped when the text changes
}

export interface Effect {
  kind: 'arc' | 'ring' | 'line';
  x: number;
  y: number;
  x2: number; // line end
  y2: number;
  r: number;
  angle: number;
  arc: number;
  t: number;
  dur: number;
  color: string;
}

export interface Game {
  player: Player;
  enemies: Enemy[];
  minions: Minion[];
  projectiles: Projectile[];
  zones: Zone[];
  pickups: Pickup[];
  corpses: Corpse[];
  particles: Particle[];
  texts: FloatText[];
  effects: Effect[];
  hash: SpatialHash<Enemy>;
  rng: Rng;
  input: { moveX: number; moveY: number; aimX: number; aimY: number; ability: boolean; utility: boolean; showAim: boolean };
  wave: number;
  waveHpMult: number;
  waveDmgMult: number;
  spawnQueue: SpawnUnit[];
  spawnTimer: number;
  spawnInterval: number;
  breather: number;
  kills: number;
  time: number;
  shake: number;
  pendingLevelUps: number;
  // --- v0.2 ---
  arena: ArenaDef;
  tier: TierDef;
  tierIndex: number;
  modifier: ModifierId | null;
  fields: Field[];
  timers: { t: number; fn: () => void }[]; // delayed actions (second volley, twin pulse...)
  vars: Record<string, number>; // scratch for relics and ability upgrades
  baseMods: Mods; // meta upgrades + tradeoffs; relics are layered on top each tick
  relics: RelicId[]; // held, in pickup order (no cap since v0.4: a duplicate pickup raises the tier)
  relicTiers: Partial<Record<RelicId, number>>; // 1..RELIC_MAX_TIER per held relic
  relicStatic: RelicTotals; // held relics' plain mods summed per key; rebuilt when relicModsDirty
  relicDyn: Partial<Record<keyof Mods, number>>; // this tick's conditional bonuses from tick hooks (charges, horns, crowns)
  relicTotals: RelicTotals; // static + dynamic, soft-capped: what went into p.mods this tick (the stats panel reads it)
  relicModsDirty: boolean;
  synergies: SynergyId[]; // active positive synergies (rebuilt with relicMods)
  relicsFound: RelicId[]; // every pickup and tier-up this run, for the compendium
  salvage: number; // Rune shards from salvaged relics
  procDepth: number; // relic hooks running inside relic hooks; chains stop at RELIC_STACKING.procDepth
  reaperMark: Enemy | null; // the Reaper synergy: the enemy the Hood last found below its threshold
  relicSlots: number; // the Keep's old relic-slot ranks; no longer a cap (kept for save compatibility)
  relicPool: RelicId[]; // unlocked and allowed for this class
  relicOffers: RelicId[][]; // queued choices (boss kill: 3, elite chest: 1); a held relic in an offer means a tier up
  pendingAbilityTiers: number[];
  pendingUtilityTiers: number[]; // v0.4: utility ability choices due (UTILITY.tiers)
  talentPoints: number; // unspent
  talentRowCap: number; // v0.4: the Library's level caps the talent rows (TALENT_ROW_CAP)
  relicTierCap: number; // v0.4: the Chapel's vault: 2 until bought, then RELIC_MAX_TIER
  utilityTiers: number; // v0.4: how many utility upgrade tiers this run offers (mastery rank 5 unlocks the second)
  eliteGold: number; // v0.4 Watchtower bounties
  bossGold: number;
  talentModsCache: Mods | null; // talent mods folded together; rebuilt when a talent is taken
  trait: TraitId;
  palette: number; // v0.4: the class sprite's colours (mastery unlocks; SPRITE_PALETTES)
  rerolls: number; // free rerolls per level-up screen
  gold: number;
  goldStart: number;
  wavesCleared: number;
  elitesKilled: number;
  bossesKilled: EnemyId[];
  bossHit: boolean; // took damage while the current boss was alive
  flawlessBosses: number;
  wave10Time: number; // 0 = not reached
  hazardT: number;
  // --- v0.3 ---
  seed: number; // run seed: the director derives every wave from it
  squads: Squad[];
  squadPlans: SquadPlan[]; // this wave's squads, instantiated as their units leave the spawn queue
  perf: number; // smoothed recent performance, -1..1 (the director's rubber band)
  waveT: number; // seconds since this wave started
  commandersKilled: number;
  levelAtWave: number[]; // player level when each wave was cleared (the pace report)
  barriers: (Body & { life: number })[]; // temporary walls raised by bosses; they block everyone, like arena obstacles
  // --- v0.5 map expansion (config/regions.ts) ---
  regionOpen: Partial<Record<RegionId, boolean>>;
  regionSeen: RegionId[]; // entered at least once this Act (the minimap draws them lit)
  openRects: Rect[]; // walkable floors and corridors, for clamping and projectiles
  openFloors: Rect[]; // open floors only, for spawn points
  bounds: Rect; // bounding box of the open map (camera, the Dragon's fire)
  wingOrder: WingId[]; // the order this Act's wings open in
  features: Feature[]; // one per wing
  blessings: BlessingId[]; // shrine blessings taken this run
  pendingShrine: BlessingId[] | null; // a shrine's choice waiting for the UI (or the bot)
  // --- v0.5 side quests and wave events (config/quests.ts, config/events.ts) ---
  quests: Quest[]; // the board while pendingBoard, then the ones taken (finished ones linger for the tracker)
  pendingBoard: boolean;
  questsDone: number;
  questRunes: number;
  event: WaveEvent | null;
  eventsSeen: number;
  pendingShop: boolean; // the wandering merchant's screen is due (his wares: event.wares)
  act: number; // Acts of 10 waves: boss, Merchant, next arena
  startArena: ArenaId;
  pendingMerchant: boolean; // the Act is over: the Merchant screen is due
  merchantSpent: number;
  curses: CurseId[];
  daily: string | null; // date, when this run is a Daily Trial
  feats: Record<string, number>; // v0.4 class feats this run (config/achievements FEAT_KEYS, systems/feats.ts)
  actFeats: Record<string, number>; // v0.5: the same, this Act only (the treasure trials)
  treasure: { id: TreasureId; tier: number } | null; // v0.5: the sacred treasure equipped at run start
  chain: Chain | null; // v0.5: the treasure chain, while mastery has opened it (never in a Daily Trial)
  banner: { text: string; t: number };
  log: RunLogDraft; // v0.6 run log, recorded by systems/runlog.ts
  over: boolean;
}
