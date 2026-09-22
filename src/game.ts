import { ARENAS, type ArenaId } from './config/arenas';
import { CLASSES, type ClassId } from './config/classes';
import type { CurseId } from './config/curses';
import { TIERS } from './config/economy';
import { ACTS } from './config/acts';
import { curseMultiplier, curseValue } from './logic/curses';
import { GAME } from './config/game';
import { relicDef, type RelicId } from './config/relics';
import { FREE_REROLLS } from './config/upgrades';
import { WAVES } from './config/waves';
import { compact, mulberry32 } from './core/math';
import { begin, end } from './core/perf';
import { SpatialHash } from './core/spatial';
import type { Game } from './core/types';
import { createPlayer } from './entities/actors';
import { accountPerks, masteryBonus, metaLoadout, startingStats, type MetaRanks } from './logic/economy';
import { TALENT_ROW_CAP } from './config/economy';
import { applyGrowth } from './logic/formulas';
import { combineMods, neutralMods } from './logic/mods';
import { relicPoolFor, rollRelics } from './logic/relics';
import type { RunSummary } from './logic/save';
import { abilityPassives, updateAbility } from './systems/abilities';
import { updateArena } from './systems/arena';
import { healPlayer, updateFields, updatePlayerAttack, updateProjectiles, updateZones } from './systems/combat';
import { updateEffects } from './systems/effects';
import { updateEnemies } from './systems/enemyAI';
import { updateMinions } from './systems/minions';
import { updateEnemyPhysics, updatePickups, updatePlayerMovement } from './systems/movement';
import { addRelic, updateRelics } from './systems/relics';
import { applyTrait, talentPassives } from './systems/talents';
import { updateUtility } from './systems/utility';
import type { TraitId } from './config/traits';
import { updateSpawning } from './systems/spawning';
import './systems/bosses'; // registers the Act bosses' scripts
import { updateSquads } from './systems/squads';
import { updateStatuses } from './systems/status';

/** Everything a run takes from outside: the player's choices on the select screen and their permanent progress. */
export interface RunOptions {
  arena?: ArenaId;
  tier?: number;
  meta?: MetaRanks; // Keep upgrades
  classXp?: number; // mastery
  lockedRelics?: RelicId[];
  curses?: CurseId[];
  trait?: TraitId; // v0.4 starting trait
  palette?: number; // v0.4 sprite palette (must be unlocked by mastery)
  accountLevel?: number; // v0.4: the sum of every class's mastery rank (account milestones)
  libraryLevel?: number; // v0.4: caps the talent rows (TALENT_ROW_CAP)
  daily?: string; // date of the Daily Trial this run is
  // simulation only (the relic power index, scripts/simulate.ts): start with these relics at this tier, or with this many pickups
  // rolled by the drop rules; noRelics stops any further drops
  relics?: RelicId[];
  relicTier?: number;
  relicPicks?: number;
  noRelics?: boolean;
}

export function createGame(classId: ClassId, seed = Date.now(), opts: RunOptions = {}): Game {
  const cls = CLASSES[classId];
  const arena = ARENAS[opts.arena ?? 'courtyard'];
  const mastery = masteryBonus(opts.classXp ?? 0);
  const loadout = metaLoadout(opts.meta ?? {});
  const account = accountPerks(opts.accountLevel ?? 0);
  const curses = [...new Set(opts.curses ?? [])];
  const g: Game = {
    player: createPlayer(cls, arena, startingStats(cls.base, opts.meta ?? {}, mastery.secondary)),
    enemies: [],
    minions: [],
    projectiles: [],
    zones: [],
    pickups: [],
    corpses: [],
    particles: [],
    texts: [],
    effects: [],
    hash: new SpatialHash(GAME.spatialCell),
    rng: mulberry32(seed),
    input: { moveX: 0, moveY: 0, aimX: 0, aimY: 0, ability: false, utility: false, showAim: false },
    wave: 0,
    waveHpMult: 1,
    waveDmgMult: 1,
    spawnQueue: [],
    spawnTimer: 0,
    spawnInterval: 1,
    breather: WAVES.firstWaveDelay,
    kills: 0,
    time: 0,
    shake: 0,
    pendingLevelUps: 0,
    arena,
    tier: TIERS[opts.tier ?? 0],
    tierIndex: opts.tier ?? 0,
    modifier: null,
    fields: [],
    timers: [],
    vars: {},
    baseMods: combineMods(combineMods(combineMods(neutralMods(), loadout.mods), account.mods), { utilityCd: 1 - mastery.utilityCd }),
    relics: [],
    relicTiers: {},
    relicStatic: {},
    relicDyn: {},
    relicTotals: {},
    relicModsDirty: true,
    synergies: [],
    relicsFound: [],
    salvage: 0,
    procDepth: 0,
    reaperMark: null,
    relicSlots: loadout.relicSlots,
    relicPool: relicPoolFor(classId, opts.lockedRelics ?? []),
    relicOffers: [],
    pendingAbilityTiers: [],
    pendingUtilityTiers: [],
    talentPoints: loadout.talentPoints + mastery.talentPoint + account.talentPoint,
    talentRowCap: TALENT_ROW_CAP[Math.min(TALENT_ROW_CAP.length - 1, opts.libraryLevel ?? TALENT_ROW_CAP.length - 1)],
    relicTierCap: loadout.relicTierCap,
    utilityTiers: mastery.utilityTier ? 2 : 1,
    eliteGold: loadout.eliteGold,
    bossGold: loadout.bossGold,
    talentModsCache: null,
    trait: 'none',
    palette: mastery.palettes.includes(opts.palette ?? 0) ? opts.palette! : 0,
    rerolls: FREE_REROLLS + loadout.rerolls + mastery.reroll + account.reroll,
    gold: loadout.gold,
    goldStart: loadout.gold,
    wavesCleared: 0,
    elitesKilled: 0,
    bossesKilled: [],
    bossHit: false,
    flawlessBosses: 0,
    wave10Time: 0,
    hazardT: 5,
    seed,
    squads: [],
    squadPlans: [],
    perf: 0,
    waveT: 0,
    commandersKilled: 0,
    levelAtWave: [],
    barriers: [],
    act: 1,
    startArena: arena.id,
    pendingMerchant: false,
    merchantSpent: 0,
    curses,
    daily: opts.daily ?? null,
    banner: { text: '', t: 0 },
    over: false,
  };
  // curses that are plain numbers live in g.vars; the rest are read where they matter (spawning, director)
  g.vars.damageTaken = curseValue(curses, 'glassBones', 'damage');
  g.vars.enemySpeed = curseValue(curses, 'frenzy', 'speed');
  g.vars.curseMult = curseMultiplier(curses);
  g.vars['keep.relicChance'] = loadout.relicChance;
  applyTrait(g, opts.trait ?? 'none');
  g.player.mods = { ...g.baseMods };
  // the Barracks' Veteran Levies and mastery's Seasoned: start a level or two up (growth, no boons)
  for (let l = 0; l < loadout.startLevel + mastery.startLevel; l++) {
    g.player.level++;
    g.player.stats = applyGrowth(g.player.stats, cls.growth);
    g.player.hp = g.player.stats.hp;
  }
  for (const id of opts.relics ?? []) for (let t = 0; t < (opts.relicTier ?? 1); t++) addRelic(g, id);
  for (let i = 0; i < (opts.relicPicks ?? 0); i++) {
    const [pick] = rollRelics(g.relicPool, g.relics, g.relicTiers, g.rng, 1);
    if (pick) addRelic(g, pick);
  }
  if (opts.noRelics) g.relicPool = [];
  if (mastery.relic) {
    const commons = g.relicPool.filter((id) => relicDef(id).rarity === 'common');
    const [gift] = rollRelics(commons, [], {}, g.rng, 1);
    if (gift) addRelic(g, gift);
  }
  return g;
}

/** What the save system needs to know about a run. Unspent gold above the starting purse is what gets banked. */
export function summarizeRun(g: Game): RunSummary {
  return {
    classId: g.player.cls.id,
    tier: g.tierIndex,
    wave: g.wave,
    wavesCleared: g.wavesCleared,
    kills: g.kills,
    time: g.time,
    level: g.player.level,
    gold: Math.max(0, g.gold - g.goldStart),
    bosses: g.bossesKilled,
    elites: g.elitesKilled,
    flawlessBosses: g.flawlessBosses,
    relics: g.relics,
    talents: g.player.talents,
    utilityUpgrades: g.player.utilityUpgrades,
    trait: g.trait,
    relicsFound: g.relicsFound,
    relicTiers: g.relicTiers,
    salvage: g.salvage,
    abilityUpgrades: g.player.upgrades.length,
    wave10Time: g.wave10Time,
    commanders: g.commandersKilled,
    seed: g.seed,
    actsCleared: Math.floor(g.wavesCleared / ACTS.length),
    curses: g.curses,
    daily: g.daily,
    levelAtWave: g.levelAtWave,
  };
}

/** One fixed simulation step. Order matters: hash and mods first, AI before physics, cleanup last. */
export function updateGame(g: Game, dt: number): void {
  g.time += dt;
  let _t = begin();
  g.hash.clear();
  for (const e of g.enemies) g.hash.insert(e);
  end('hash', _t);

  for (const t of g.timers) if ((t.t -= dt) <= 0) t.fn();
  compact(g.timers, (t) => t.t > 0);

  const p = g.player;
  p.iFrames -= dt;
  p.flash -= dt;
  p.invulnT -= dt;
  p.chillT -= dt;
  p.mods = { ...g.baseMods }; // rebuilt every tick: meta + tradeoffs, then relics, then passive ability upgrades
  updateRelics(g, dt);
  talentPassives(g);
  abilityPassives(g);
  healPlayer(g, (p.cls.regen + p.mods.regen) * dt, false);

  updatePlayerMovement(g, dt);
  updateAbility(g, dt);
  updateUtility(g, dt);
  _t = begin();
  updatePlayerAttack(g, dt);
  end('attack', _t);
  _t = begin();
  updateSquads(g, dt);
  end('squads', _t);
  _t = begin();
  updateStatuses(g, dt);
  end('statuses', _t);
  _t = begin();
  updateEnemies(g, dt);
  end('enemyAI', _t);
  _t = begin();
  updateEnemyPhysics(g, dt);
  end('physics', _t);
  _t = begin();
  updateMinions(g, dt);
  end('minions', _t);
  _t = begin();
  updateProjectiles(g, dt);
  end('projectiles', _t);
  _t = begin();
  updateZones(g, dt);
  end('zonesU', _t);
  _t = begin();
  updateFields(g, dt);
  end('fieldsU', _t);
  _t = begin();
  updatePickups(g, dt);
  end('pickupsU', _t);
  updateArena(g, dt);
  _t = begin();
  updateEffects(g, dt);
  end('effectsU', _t);

  compact(g.enemies, (e) => !e.dead);
  compact(g.barriers, (b) => (b.life -= dt) > 0);
  for (const c of g.corpses) c.t += dt;
  compact(g.corpses, (c) => c.t < GAME.corpseLifetime * g.arena.corpseLifeMult);
  _t = begin();
  updateSpawning(g, dt); // after cleanup so "no enemies left" is accurate
  end('spawning', _t);
}
