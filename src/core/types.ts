import type { AbilityUpgradeId } from '../config/abilityUpgrades';
import type { ArenaDef, ArenaId } from '../config/arenas';
import type { CurseId } from '../config/curses';
import type { ClassDef } from '../config/classes';
import type { TierDef } from '../config/economy';
import type { AffixId } from '../config/elites';
import type { EnemyDef, EnemyId } from '../config/enemies';
import type { RelicId } from '../config/relics';
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
  // additive
  armor: number;
  crit: number;
  lifesteal: number;
  regen: number;
  pierce: number;
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
  kind: 'xp' | 'gold' | 'relic';
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
  input: { moveX: number; moveY: number; aimX: number; aimY: number; ability: boolean; showAim: boolean };
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
  relics: RelicId[];
  relicSlots: number;
  relicPool: RelicId[]; // unlocked and allowed for this class
  relicOffers: RelicId[][]; // queued choices (boss kill: 3, elite chest: 1)
  pendingAbilityTiers: number[];
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
  barriers: (Body & { life: number })[]; // temporary walls raised by bosses; they block everyone, like arena obstacles
  act: number; // Acts of 10 waves: boss, Merchant, next arena
  startArena: ArenaId;
  pendingMerchant: boolean; // the Act is over: the Merchant screen is due
  merchantSpent: number;
  curses: CurseId[];
  daily: string | null; // date, when this run is a Daily Trial
  banner: { text: string; t: number };
  over: boolean;
}
