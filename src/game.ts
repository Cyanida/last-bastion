import { oathStack, type OathStack } from './logic/oaths';
import { ARENAS, type ArenaId } from './config/arenas';
import { CLASSES, type ClassId } from './config/classes';
import type { CurseId } from './config/curses';
import { TIERS, type TierDef } from './config/economy';
import { ACTS } from './config/acts';
import { curseMultiplier, curseValue } from './logic/curses';
import { GAME } from './config/game';
import { RELIC_MOMENTS, relicDef, type RelicId } from './config/relics';
import { TREASURES } from './config/treasures';
import { FREE_REROLLS } from './config/upgrades';
import { WAVES } from './config/waves';
import { compact, mulberry32 } from './core/math';
import { begin, end } from './sim/view';
import { SpatialHash } from './core/spatial';
import type { Game, Player } from './core/types';
import { focus, rollStream } from './logic/players';
import { createPlayer } from './entities/actors';
import { runTimer } from './entities/hazards';
import { accountPerks, masteryBonus, metaLoadout, startingStats, type MetaRanks } from './logic/economy';
import { TALENT_ROW_CAP } from './config/economy';
import { applyGrowth } from './logic/formulas';
import { combineMods, neutralMods } from './logic/mods';
import { relicPoolFor, relicStream, rollRelics } from './logic/relics';
import { newRunLog } from './logic/runlog';
import type { RunSummary } from './logic/save';
import type { TreasureRecord } from './logic/treasures';
import { abilityPassives, updateAbility } from './systems/abilities';
import { updateArena } from './systems/arena';
import { healPlayer, updateFields, updatePlayerAttack, updateProjectiles, updateZones } from './systems/combat';
import { updateEffects } from './systems/effects';
import { updateEnemies } from './systems/enemyAI';
import { updateMinions } from './systems/minions';
import { updateEnemyPhysics, updatePickups, updatePlayerMovement } from './systems/movement';
import { addRelic, updateRelics } from './systems/relics';
import { applyTrait, talentPassives } from './systems/talents';
import { initRegions, updateRegions } from './systems/regions';
import { initQuests, updateQuests } from './systems/quests';
import { updateEvents } from './systems/events';
import { finishRunLog, startRunLog, updateRunLog } from './systems/runlog';
import { dodgePassives } from './systems/dodge';
import { endlessScore } from './systems/victory';
import { updateTreasures } from './systems/treasures';
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
  trait2?: TraitId; // v0.6: a second one, with the Second Banner
  oath?: number; // v0.6: the Oath level sworn (it replaces the free curses)
  palette?: number; // v0.4 sprite palette (must be unlocked by mastery or an achievement)
  palettes?: number[]; // v0.4: palettes unlocked account-wide by achievements, on top of the class's mastery ones
  bonusTalentPoints?: number; // v0.4: permanent talent points from achievements (save.talentPoints)
  accountLevel?: number; // v0.4: the sum of every class's mastery rank (account milestones)
  libraryLevel?: number; // v0.4: caps the talent rows (TALENT_ROW_CAP)
  daily?: string; // date of the Daily Trial this run is
  treasure?: number; // v0.5: tier of the class's sacred treasure to equip (0 or none: not equipped)
  chain?: TreasureRecord; // v0.5: the class's treasure chain from the save (it only plays once mastery has opened it)
  // simulation only (the relic power index, scripts/simulate.ts): start with these relics at this tier, or with this many pickups
  // rolled by the drop rules; noRelics stops any further drops
  relics?: RelicId[];
  relicTier?: number;
  relicPicks?: number;
  noRelics?: boolean;
  allies?: ClassId[]; // v0.8 (#28): players 2-4 of this run, by class (up to GAME.maxPlayers in all)
}

/** The difficulty tier with an Oath's numbers folded in, so every place that reads the tier sees them. */
const withOath = (t: TierDef, o: OathStack): TierDef => (o.level ? { ...t, enemyHp: t.enemyHp * o.n.hp, enemyDmg: t.enemyDmg * o.n.damage, eliteMult: t.eliteMult * o.n.eliteMult } : t);

export function createGame(classId: ClassId, seed: number, opts: RunOptions = {}): Game {
  const cls = CLASSES[classId];
  const arena = ARENAS[opts.arena ?? 'courtyard'];
  const mastery = masteryBonus(opts.classXp ?? 0);
  const loadout = metaLoadout(opts.meta ?? {});
  const account = accountPerks(opts.accountLevel ?? 0);
  const oath = oathStack(opts.oath ?? 0);
  const curses = oath.level > 0 ? oath.curses : [...new Set(opts.curses ?? [])]; // v0.6: an Oath brings its own curses
  const chain = opts.chain && mastery.treasureStep >= 1 ? opts.chain : null;
  const player = createPlayer(cls, arena, startingStats(cls.base, opts.meta ?? {}, mastery.secondary));
  const allies = (opts.allies ?? []).slice(0, GAME.maxPlayers - 1).map((id, i) => {
    const a = createPlayer(CLASSES[id], arena, startingStats(CLASSES[id].base, opts.meta ?? {}, mastery.secondary));
    a.x += GAME.playerSpacing * (i + 1);
    Object.assign(a.relics, { pool: relicPoolFor(id, opts.lockedRelics ?? []), rng: relicStream(seed, i + 1) });
    a.rng = rollStream(seed, i + 1);
    return a;
  });
  const g: Game = {
    player,
    players: [player, ...allies],
    enemies: [],
    minions: [],
    projectiles: [],
    zones: [],
    pickups: [],
    corpses: [],
    particles: [],
    texts: [],
    out: [],
    effects: [],
    hash: new SpatialHash(GAME.spatialCell),
    rng: mulberry32(seed),
    input: player.input,
    wave: 0,
    waveHpMult: 1,
    waveDmgMult: 1,
    spawnQueue: [],
    spawnTimer: 0,
    spawnInterval: 1,
    breather: WAVES.firstWaveDelay,
    kills: 0,
    time: 0,
    tick: 0,
    shake: 0,
    arena,
    tier: withOath(TIERS[opts.tier ?? 0], oath),
    tierIndex: opts.tier ?? 0,
    modifier: null,
    fields: [],
    timers: [],
    vars: {},
    baseMods: combineMods(combineMods(combineMods(neutralMods(), loadout.mods), account.mods), { utilityCd: 1 - mastery.utilityCd }),
    salvage: 0,
    procDepth: 0,
    relicSlots: loadout.relicSlots,
    utilityTiers: mastery.utilityTier ? 2 : 1,
    eliteGold: loadout.eliteGold,
    bossGold: loadout.bossGold,
    oath,
    bannedStats: [],
    palette: [...mastery.palettes, ...(opts.palettes ?? [])].includes(opts.palette ?? 0) ? opts.palette! : 0,
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
    regionOpen: {},
    regionSeen: [],
    openRects: [],
    openFloors: [],
    bounds: { x: 0, y: 0, w: 0, h: 0 },
    wingOrder: [],
    features: [],
    blessings: [],
    pendingShrine: null,
    quests: [],
    pendingBoard: false,
    questsDone: 0,
    questRunes: 0,
    event: null,
    eventsSeen: 0,
    pendingShop: false,
    act: 1,
    startArena: arena.id,
    pendingMerchant: false,
    midMerchant: false,
    route: null,
    pendingRoute: null,
    merchantSpent: 0,
    curses,
    daily: opts.daily ?? null,
    feats: {},
    actFeats: {},
    treasure: opts.treasure ? { id: TREASURES[classId].id, tier: Math.min(3, opts.treasure) } : null,
    chain: chain && { fragments: chain.fragments, trial: chain.trial, tier: chain.tier, unlocked: mastery.treasureStep, found: 0, passed: false, guardian: null, slain: false },
    banner: { text: '', t: 0 },
    log: newRunLog(),
    replay: [],
    victory: 'none',
    victoryKills: 0,
    prey: null,
    glows: [],
    over: false,
  };
  Object.assign(g.player.relics, { pool: relicPoolFor(classId, opts.lockedRelics ?? []), rng: relicStream(seed, 0) });
  player.rng = g.rng; // P1 rolls from the run's stream, as before co-op: a solo run draws exactly what it did
  // v0.8 (#28): each player's own start (ponytail: every seat gets the host's Keep loadout; a joining player's own save is #30's)
  for (const p of g.players)
    Object.assign(p, {
      rerolls: Math.max(0, FREE_REROLLS + loadout.rerolls + mastery.reroll + account.reroll - oath.n.rerollsLess),
      banishes: loadout.banishes,
      talentPoints: loadout.talentPoints + mastery.talentPoint + account.talentPoint + (opts.bonusTalentPoints ?? 0),
      talentRowCap: TALENT_ROW_CAP[Math.min(TALENT_ROW_CAP.length - 1, opts.libraryLevel ?? TALENT_ROW_CAP.length - 1)],
      lastStand: oath.n.noLastStand ? 'off' : 'ready',
      gold: loadout.gold,
      goldStart: loadout.gold,
    });
  // curses that are plain numbers live in g.vars; the rest are read where they matter (spawning, director)
  g.vars.damageTaken = curseValue(curses, 'glassBones', 'damage');
  g.vars.enemySpeed = curseValue(curses, 'frenzy', 'speed');
  g.vars.curseMult = curseMultiplier(curses) + curses.length * loadout.curseBonus; // the Gallows, as applyRun counts it at banking
  g.vars['keep.relicRerolls'] = loadout.relicRerolls;
  g.vars['keep.bossChoices'] = loadout.bossChoices;
  initRegions(g);
  initQuests(g);
  applyTrait(g, g.players[0], opts.trait ?? 'none');
  if (loadout.traitSlots > 1 && opts.trait2 && opts.trait2 !== opts.trait) applyTrait(g, g.players[0], opts.trait2, true);
  for (const p of g.players) {
    p.mods = { ...g.baseMods };
    // the Barracks' Veteran Levies and mastery's Seasoned: start a level or two up (growth, no boons)
    for (let l = 0; l < loadout.startLevel + mastery.startLevel; l++) {
      p.level++;
      p.stats = applyGrowth(p.stats, p.cls.growth);
      p.hp = p.stats.hp;
    }
  }
  for (const id of opts.relics ?? []) addRelic(g, id, 'other', opts.relicTier ?? 1);
  for (let i = 0; i < (opts.relicPicks ?? 0); i++) {
    const [pick] = rollRelics(g.player.relics.pool, g.player.relics.held, g.player.rng, 1);
    if (pick) addRelic(g, pick, 'start');
  }
  if (opts.noRelics) g.player.relics.pool = [];
  if (loadout.startRelic) {
    // v0.6 Armorer's Choice: the run opens on a choice of three common relics
    const commons = g.player.relics.pool.filter((id) => relicDef(id).rarity === 'common');
    const choice = rollRelics(commons, [], g.player.rng, 3);
    if (choice.length) (g.player.relics.offers.push({ from: 'start', options: choice, rerolls: RELIC_MOMENTS.rerolls }), (g.vars.armorerOffer = 1));
  }
  if (mastery.relic) {
    const commons = g.player.relics.pool.filter((id) => relicDef(id).rarity === 'common');
    const [gift] = rollRelics(commons, g.player.relics.held, g.player.rng, 1);
    if (gift) addRelic(g, gift, 'start');
  }
  startRunLog(g);
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
    gold: Math.max(0, g.player.gold - g.player.goldStart),
    bosses: g.bossesKilled,
    elites: g.elitesKilled,
    flawlessBosses: g.flawlessBosses,
    relics: g.player.relics.held,
    talents: g.player.talents,
    utilityUpgrades: g.player.utilityUpgrades,
    trait: g.player.trait,
    relicsFound: g.player.relics.found,
    relicTiers: g.player.relics.tiers,
    duos: g.player.relics.duos,
    salvage: g.salvage,
    feats: g.feats,
    abilityUpgrades: g.player.upgrades.length,
    wave10Time: g.wave10Time,
    commanders: g.commandersKilled,
    seed: g.seed,
    actsCleared: Math.floor(g.wavesCleared / ACTS.length),
    curses: g.curses,
    oath: g.oath.level,
    daily: g.daily,
    levelAtWave: g.levelAtWave,
    quests: g.questsDone,
    events: g.eventsSeen,
    questRunes: g.questRunes,
    log: finishRunLog(g),
    won: g.victory !== 'none',
    evolutions: g.player.evolutions,
    endlessScore: endlessScore(g),
    treasure: g.chain || g.treasure ? { found: g.chain?.found ?? 0, passed: g.chain?.passed ?? false, slain: g.chain?.slain ?? false, carried: g.treasure?.tier ?? 0 } : undefined,
  };
}

/** One fixed simulation step. Order matters: hash and mods first, AI before physics, cleanup last. */
export function updateGame(g: Game, dt: number): void {
  g.time += dt;
  g.glows.length = 0;
  let _t = begin();
  g.hash.clear();
  for (const e of g.enemies) g.hash.insert(e);
  end('hash', _t);

  for (const t of g.timers) if ((t.t -= dt) <= 0) runTimer(g, t);
  compact(g.timers, (t) => t.t > 0);

  // v0.8 (#28): each player's own systems, with the focus on them (logic/players.ts); the world after, once
  for (const p of g.players) {
    focus(g, p);
    updatePlayer(g, p, dt);
  }
  focus(g, g.players[0]);
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
  updateRegions(g, dt);
  updateQuests(g, dt);
  updateEvents(g, dt);
  _t = begin();
  updateEffects(g, dt);
  end('effectsU', _t);

  compact(g.enemies, (e) => !e.dead);
  updateRunLog(g, dt); // after cleanup: it counts who is still alive
  compact(g.barriers, (b) => (b.life -= dt) > 0);
  for (const c of g.corpses) c.t += dt;
  compact(g.corpses, (c) => c.t < GAME.corpseLifetime * g.arena.corpseLifeMult * (g.vars['corpse.mult'] ?? 1)); // v0.7: Grave's Charnel
  _t = begin();
  updateSpawning(g, dt); // after cleanup so "no enemies left" is accurate
  end('spawning', _t);
}

/** One player's turn in a tick: timers, mods, passives, then movement, ability, utility and attack. */
function updatePlayer(g: Game, p: Player, dt: number): void {
  p.iFrames -= dt;
  p.flash -= dt;
  p.invulnT -= dt;
  p.chillT -= dt;
  p.mods = { ...g.baseMods }; // rebuilt every tick: meta + tradeoffs, then relics, then passive ability upgrades
  updateRelics(g, p, dt);
  talentPassives(p);
  updateTreasures(g, p);
  abilityPassives(g, p, dt);
  dodgePassives(g, p);
  healPlayer(g, p, (p.cls.regen + p.mods.regen) * dt, false);

  updatePlayerMovement(g, dt);
  updateAbility(g, p, dt);
  updateUtility(g, p, dt);
  const t = begin();
  updatePlayerAttack(g, dt);
  end('attack', t);
}
