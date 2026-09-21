import { ARENAS, type ArenaId } from './config/arenas';
import { CLASSES, type ClassId } from './config/classes';
import { TIERS } from './config/economy';
import { GAME } from './config/game';
import { RELIC_SLOTS, relicDef, type RelicId } from './config/relics';
import { FREE_REROLLS } from './config/upgrades';
import { WAVES } from './config/waves';
import { compact, mulberry32 } from './core/math';
import { SpatialHash } from './core/spatial';
import type { Game } from './core/types';
import { createPlayer } from './entities/actors';
import { masteryBonus, metaLoadout, startingStats, type MetaRanks } from './logic/economy';
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
import { updateSpawning } from './systems/spawning';
import { updateSquads } from './systems/squads';

/** Everything a run takes from outside: the player's choices on the select screen and their permanent progress. */
export interface RunOptions {
  arena?: ArenaId;
  tier?: number;
  meta?: MetaRanks; // Keep upgrades
  classXp?: number; // mastery
  lockedRelics?: RelicId[];
}

export function createGame(classId: ClassId, seed = Date.now(), opts: RunOptions = {}): Game {
  const cls = CLASSES[classId];
  const arena = ARENAS[opts.arena ?? 'courtyard'];
  const mastery = masteryBonus(opts.classXp ?? 0);
  const loadout = metaLoadout(opts.meta ?? {});
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
    input: { moveX: 0, moveY: 0, aimX: 0, aimY: 0, ability: false, showAim: false },
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
    baseMods: combineMods(neutralMods(), loadout.mods),
    relics: [],
    relicSlots: RELIC_SLOTS + loadout.relicSlots,
    relicPool: relicPoolFor(classId, opts.lockedRelics ?? []),
    relicOffers: [],
    pendingAbilityTiers: [],
    rerolls: FREE_REROLLS + loadout.rerolls + mastery.reroll,
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
    banner: { text: '', t: 0 },
    over: false,
  };
  g.player.mods = { ...g.baseMods };
  if (mastery.relic) {
    const commons = g.relicPool.filter((id) => relicDef(id).rarity === 'common');
    const [gift] = rollRelics(commons, [], g.rng, 1);
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
    abilityUpgrades: g.player.upgrades.length,
    wave10Time: g.wave10Time,
    commanders: g.commandersKilled,
    seed: g.seed,
  };
}

/** One fixed simulation step. Order matters: hash and mods first, AI before physics, cleanup last. */
export function updateGame(g: Game, dt: number): void {
  g.time += dt;
  g.hash.clear();
  for (const e of g.enemies) g.hash.insert(e);

  for (const t of g.timers) if ((t.t -= dt) <= 0) t.fn();
  compact(g.timers, (t) => t.t > 0);

  const p = g.player;
  p.iFrames -= dt;
  p.flash -= dt;
  p.invulnT -= dt;
  p.chillT -= dt;
  p.mods = { ...g.baseMods }; // rebuilt every tick: meta + tradeoffs, then relics, then passive ability upgrades
  updateRelics(g, dt);
  abilityPassives(g);
  healPlayer(g, (p.cls.regen + p.mods.regen) * dt, false);

  updatePlayerMovement(g, dt);
  updateAbility(g, dt);
  updatePlayerAttack(g, dt);
  updateSquads(g, dt);
  updateEnemies(g, dt);
  updateEnemyPhysics(g, dt);
  updateMinions(g, dt);
  updateProjectiles(g, dt);
  updateZones(g, dt);
  updateFields(g, dt);
  updatePickups(g, dt);
  updateArena(g, dt);
  updateEffects(g, dt);

  compact(g.enemies, (e) => !e.dead);
  for (const c of g.corpses) c.t += dt;
  compact(g.corpses, (c) => c.t < GAME.corpseLifetime * g.arena.corpseLifeMult);
  updateSpawning(g, dt); // after cleanup so "no enemies left" is accurate
}
