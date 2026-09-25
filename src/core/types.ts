import type { SfxName } from './audio';
import type { OathStack } from '../logic/oaths';
import type { LevelUpOption } from '../logic/upgrades';
import type { AbilityUpgradeId } from '../config/abilityUpgrades';
import type { ArenaDef, ArenaId } from '../config/arenas';
import type { CurseId } from '../config/curses';
import type { ClassDef } from '../config/classes';
import type { TierDef } from '../config/economy';
import type { AffixId } from '../config/elites';
import type { EnemyDef, EnemyId } from '../config/enemies';
import type { FamilyId, RelicId, DuoId, RelicKey } from '../config/relics';
import type { TraitId } from '../config/traits';
import type { BlessingId, FeatureKind, Rect, RegionId, WingId } from '../config/regions';
import type { UtilityUpgradeId } from '../config/utility';
import type { QuestKind, RewardKind } from '../config/quests';
import type { RunLogDraft } from '../logic/runlog';
import type { Command } from '../sim/commands';
import type { EvolutionId } from '../config/evolutions';
import type { Route } from '../logic/routes';
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
/** A stored stream: `s` is its whole state, so a snapshot copies it and a restore sets it back (#27). */
export type SeededRng = Rng & { s: number };
export type DamageSource = 'attack' | 'ability' | 'minion' | 'relic' | 'hazard';

/** Run-wide modifiers, rebuilt every tick from meta upgrades, tradeoffs, relics and passive ability upgrades. */
/** v0.7 (RELICS.md): a relic's share of the run, credited as it happens. */
export interface RelicStat { damage: number; healing: number; prevented: number }

/** v0.7: where a relic moment came from (config/relics.ts RELIC_MOMENTS). */
export type RelicSource = 'boss' | 'lair' | 'strongbox' | 'quest' | 'merchant' | 'start' | 'other';

/** v0.7: one relic moment: pick one of the options, or skip it; `rerolls` left for this moment. */
export interface RelicOffer {
  from: RelicSource;
  options: RelicId[];
  rerolls: number;
  duo?: DuoId; // v0.7 A5: a ready duo, the gold fourth card
}

/**
 * v0.7: everything relic about one player. Co-op-ready: one per player, and every relic choice is an action on it (logic stays per state,
 * never "the player"). `rng` is the player's own relic stream, split from the run seed, so offers stay the same for a seed whatever else
 * consumes randomness (the Daily Trial is identical for everyone, and a second player would not shift the first one's offers).
 */
export interface RelicState {
  held: RelicId[]; // in pickup order
  tiers: Partial<Record<RelicId, number>>; // 1..RELIC_MAX_TIER per held relic, raised only by attunement (v0.7)
  attune: Partial<Record<RelicId, number>>; // v0.7 A4: progress to the next tier, 0..1 (config ATTUNEMENT)
  work: Partial<Record<RelicId, number>>; // attunement from work this wave (capped at ATTUNEMENT.workCap)
  pool: RelicId[]; // unlocked and allowed for this class
  offers: RelicOffer[]; // queued moments, oldest first
  found: RelicId[]; // every pickup and tier-up this run, for the compendium
  from: Record<string, RelicSource>; // where each held relic came from
  stats: Record<string, RelicStat>; // what each held relic did this run (RELICS.md)
  rng: SeededRng;
  static: RelicTotals; // held relics' plain mods summed per key; rebuilt when dirty
  dyn: Partial<Record<keyof Mods, number>>; // this tick's conditional bonuses from tick hooks (charges, horns, crowns)
  totals: RelicTotals; // static + dynamic, soft-capped: what went into p.mods this tick (the stats panel reads it)
  dirty: boolean;
  sets: Partial<Record<FamilyId, { count: number; level: 0 | 2 | 4 | 6 }>>; // family counts and set levels, rebuilt with the mods
  duos: DuoId[]; // v0.7 A5: formed duos, in order (a duo counts toward both its families)
  cursedAct: number; // v0.7.1 B6: the last Act a cursed relic was offered to this player (0: none yet)
  // v0.8 (#27): per-relic state that lived in module WeakMaps, here so a snapshot carries it
  raw: Partial<Record<RelicKey, Partial<Record<keyof Mods, number>>>>; // each held relic's raw bonus per mod key this tick (the contribution weights)
  warded: Minion[]; // Hallowed Bones: the skeletons it has warded, to notice the ones that expire
  streak: number[]; // Tempest: the times of the recent kills
}

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
  relics: RelicState; // v0.7: this player's relics
  input: Game['input']; // v0.8 (#28): this player's last intent; g.input is the focused player's (logic/players.ts)
  ward: number; // v0.7: absorbs damage before HP (Holy)
  armorStacks: number; // v0.7: +3% armor each (Steel), they fade a few seconds after the last was gained
  armorStackT: number; // when the last armor stack was gained
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
  // v0.8 (#28): what was the run's and is this player's: gold, the level-up and ability queues, talents, traits, evolutions, last stand
  pendingLevelUps: number;
  levelHand: LevelUpOption[] | null; // v0.8: the level-up cards on offer, dealt on first read (levelHand in sim/commands.ts)
  levelRerolls: { free: number; paid: number } | null; // v0.8: this level-up screen's rerolls; null until the first
  rerolls: number; // free rerolls per level-up screen
  banishes: number; // v0.6: Quartermaster's Ledger: level-up cards left to strike from the run
  pendingAbilityTiers: number[];
  pendingUtilityTiers: number[]; // v0.4: utility ability choices due (UTILITY.tiers)
  talentPoints: number; // unspent
  talentModsCache: Mods | null; // talent mods folded together; rebuilt when a talent is taken
  talentRowCap: number; // v0.4: the Library's level caps the talent rows (TALENT_ROW_CAP)
  trait2: TraitId; // v0.6: the Second Banner's second trait ('none' without it)
  trait: TraitId;
  evolutions: EvolutionId[]; // v0.6: taken this run (one signature, one utility; config/evolutions.ts)
  lastStand: 'ready' | 'used' | 'off'; // v0.6: once a run at 0 HP (SKILL.lastStand); an Oath can take it away
  goldStart: number;
  gold: number;
  flash: number;
}

export interface Telegraph {
  angle: number;
  length: number;
  width: number;
  t: number;
  dur: number;
  count?: number; // v0.6: aim lines for a volley (systems/patterns.ts aimFan): this many, `spread` radians wide
  spread?: number;
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
  warded: boolean; // v0.6: takes no damage at all (the Usurper while his Royal Flames burn)
  windupT: number; // v0.6: seconds its telegraphed attack still winds up (it glows); set by addZone for zones it owns
  patternT: number; // v0.6: until its Act III pattern (config/ai.ts PATTERNS); -1 = not started
  lineIn: number; // v0.6: when the player last stood in its line or aim telegraph (perfect dodge)
  lastTele: Telegraph | null; // v0.6: the telegraph it had last tick (perfect dodge checks it when it fires)
  pulled: boolean; // v0.6: one of a wave's last stragglers, coming straight at the player (WAVES.stragglers)
  frozenT: number; // v0.7: frozen until this time (chill tipped over; Frost reads it)
  rimeT?: number; // v0.8 (#27): Rimewalker can't freeze it again before this time
  resolve: number; // v0.7.5 (#95): a boss's recent damage taken, as of resolveT (logic/status throughResolve)
  resolveT: number;
  hpFloor: number; // v0.6: damage cannot take HP below this (a boss phase that has not run its minimum time yet); 0 = none
  secondWind: number; // v0.6 Oath: a boss rises once more from the brink with this fraction of its HP; 0 = none (or spent)
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
  kind?: 'caravan' | 'monk' | 'knight' | 'hound' | 'standard' | 'decoy' | 'shade'; // hound: the Bow of the Wild Hunt's (v0.5 treasures); standard, decoy, shade: v0.6 evolutions
  cleave?: number; // v0.6: its hits land on everything within this of its target (the Bone Colossus)
  onEnd?: { radius: number; damage: number; color: string; dtype: DamageType }; // v0.6: bursts when it falls or fades
  shoot?: { every: number; damage: number; t: number }; // v0.6: a passive unit that shoots the nearest enemy (the Archer's shadow)
  passive?: boolean; // does not attack or chase: walks its path (if any) at `speed`
  path?: { x: number; y: number }[]; // waypoints, walked in a loop
  pathI?: number;
  relicBy?: RelicKey | FamilyId; // raised by this relic or set (relicCore.raiseSkeleton)
  frostLegion?: boolean; // Lich Lantern's Frost Legion has given it its burst
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
  seek?: boolean; // v0.6: turns toward the nearest enemy (Soul Harvest)
  color: string;
  hit: Enemy[];
  status: Status | null;
  source: DamageSource;
  by?: RelicKey; // v0.7: fired by this relic or duo (its damage is credited to it)
  dtype: DamageType;
}

/** Delayed area damage: boss telegraphs, cultist blasts, volley arrows. */
export interface Zone extends Body {
  delay: number;
  t: number;
  lastIn: number; // v0.6: when the player last stood in it before it struck (perfect dodge), -1 = never
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
  source: DamageSource; // a friendly zone's damage: 'ability', or 'hazard' for the arena's own (braziers, the gatehouse)
}

/** Lasting area: fire, poison, consecrated ground. Ticks every GAME.fieldTick seconds. */
export interface Field extends Body {
  follow?: boolean; // v0.6: stays centred on the player (the Aegis of Dawn)
  vx?: number; // v0.6: drifts (the Sunburst)
  vy?: number;
  life: number;
  max: number;
  dps: number;
  hostile: boolean;
  heal: number; // HP per second to the player while inside (friendly fields)
  color: string;
  tickT: number;
  dtype: DamageType;
  apply: StatusApply | null; // put on whoever stands in it, every tick
  by?: RelicKey; // v0.7: laid by this relic or duo (its damage is credited to it)
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
  rng: SeededRng; // its own seeded stream (logic/quests.ts placeRng), for where it puts things
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
  stock: number; // v0.7: the peddler's relic moments left to sell (he sells a pick of three, not loose relics)
}

/** v0.6: a light an evolution shows for one tick (render/renderer.ts draws them): a soft disc, or a ring outline. */
export interface Glow {
  x: number;
  y: number;
  r: number;
  color: string;
  ring?: boolean;
}

export interface Corpse {
  x: number;
  y: number;
  t: number;
  walked?: boolean; // Charnel: walked over already
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
  player: Player; // v0.8 (#28): the focused player, players[0] outside a player's turn (logic/players.ts)
  players: Player[]; // 1-4; players[0] is the one a single-player run always had
  enemies: Enemy[];
  minions: Minion[];
  projectiles: Projectile[];
  zones: Zone[];
  pickups: Pickup[];
  corpses: Corpse[];
  particles: Particle[];
  texts: FloatText[];
  out: SfxName[]; // v0.8 (#114): this tick's sound cues; the view plays and empties them (sim/view.ts playCues). Not hashed
  effects: Effect[];
  hash: SpatialHash<Enemy>;
  rng: SeededRng;
  input: { moveX: number; moveY: number; aimX: number; aimY: number; ability: boolean; utility: boolean; showAim: boolean; manualAim?: boolean }; // manualAim: basic attacks go toward (aimX, aimY) (v0.7.5, #81)
  wave: number;
  waveHpMult: number;
  waveDmgMult: number;
  spawnQueue: SpawnUnit[];
  spawnTimer: number;
  spawnInterval: number;
  breather: number;
  kills: number;
  time: number;
  tick: number; // v0.8: steps taken (step() in sim/commands.ts); commands carry it
  shake: number;
  // --- v0.2 ---
  arena: ArenaDef;
  tier: TierDef;
  tierIndex: number;
  modifier: ModifierId | null;
  fields: Field[];
  timers: { t: number; kind: string; a: unknown }[]; // delayed actions (second volley, twin pulse...) as data: entities/hazards.ts timer()
  vars: Record<string, number>; // scratch for relics and ability upgrades
  baseMods: Mods; // meta upgrades + tradeoffs; relics are layered on top each tick
  salvage: number; // Rune shards from salvaged relics
  procDepth: number; // relic hooks running inside relic hooks; chains stop at RELIC_STACKING.procDepth
  relicSlots: number; // the Keep's old relic-slot ranks; no longer a cap (kept for save compatibility)
  utilityTiers: number; // v0.4: how many utility upgrade tiers this run offers (mastery rank 5 unlocks the second)
  eliteGold: number; // v0.4 Watchtower bounties
  bossGold: number;
  oath: OathStack; // v0.6: the Oath sworn for this run (level 0: a custom run, nothing asked)
  bannedStats: StatKey[]; // v0.6: stat boons struck from this run's level-ups
  palette: number; // v0.4: the class sprite's colours (mastery unlocks; SPRITE_PALETTES)
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
  midMerchant: boolean; // v0.6: this Merchant visit is the Merchant path's, halfway through the Act (leaving it goes on with the Act)
  route: Route | null; // v0.6: the path chosen into this Act (null in Act I)
  pendingRoute: Route[] | null; // v0.6: the fork after an Act: the route screen is due
  merchantSpent: number;
  curses: CurseId[];
  daily: string | null; // date, when this run is a Daily Trial
  feats: Record<string, number>; // v0.4 class feats this run (config/achievements FEAT_KEYS, systems/feats.ts)
  actFeats: Record<string, number>; // v0.5: the same, this Act only (the treasure trials)
  treasure: { id: TreasureId; tier: number } | null; // v0.5: the sacred treasure equipped at run start
  chain: Chain | null; // v0.5: the treasure chain, while mastery has opened it (never in a Daily Trial)
  banner: { text: string; t: number; top?: boolean }; // top: a wing opening in the same moment does not cover it (the vault)
  log: RunLogDraft; // v0.6 run log, recorded by systems/runlog.ts
  replay: Command[]; // v0.8 (#113): every choice step() made, with its tick and player (sim/commands.ts)
  victory: 'none' | 'pending' | 'endless'; // v0.6: the Usurper fell (pending: the choice to bank or go on is up); endless: gone on past him
  victoryKills: number; // v0.6: kills when he fell (the Endless score counts from there)
  prey: Enemy | null; // v0.6: the Hunter's Mark
  glows: Glow[]; // v0.6: lights the evolutions set every tick (wisps, souls, rings); cleared at the start of each tick
  over: boolean;
}
