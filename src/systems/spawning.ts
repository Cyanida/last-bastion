import { AFFIX_IDS } from '../config/elites';
import { routeChoices } from '../logic/routes';
import type { AffixId } from '../config/elites';
import { ENEMIES, type EnemyId } from '../config/enemies';
import type { QuestKind } from '../config/quests';
import { MODIFIERS, WAVES } from '../config/waves';
import { sfx } from '../sim/view';
import { emit } from '../core/events';
import type { Enemy, Game } from '../core/types';
import { createEnemy } from '../entities/actors';
import { placeName, bossDef, bossForWave, caravanSellsRelic, isActEnd, themeFor } from '../logic/acts';
import { curseValue } from '../logic/curses';
import { enemyXpMult, waveClearXp } from '../logic/formulas';
import { gainXp } from './leveling';
import { directWave, updatePerformance, type SpawnUnit } from '../logic/director';
import { waveClearGold } from '../logic/economy';
import { pacingBudget } from '../logic/waves';
import { spawnPoint } from '../logic/regions';
import { slotPosition } from '../logic/squads';
import { floatText } from './effects';
import { ROUTES } from '../config/routes';
import { ACTS } from '../config/acts';
import { actTheme, turnAct } from './acts';
import { killEnemy } from './combat';
import { createSquad } from './squads';
import { REALMS, WORLD } from '../config/world';
import { bossWaveIn, endBossStep, featuredSquads, levelBoss, levelFields, levelWaves, ownWaves, realmFoe } from '../logic/world';
import { crownHpFloor, elitePhases, isCrownFight, isEliteFight } from '../logic/crownBoss';

const MIN_SPAWN_DIST = 380;

/** v0.5: enemies come from the edges of the whole open map (every open wing), not right on top of the player. */
function edgePoint(g: Game): { x: number; y: number } {
  return spawnPoint(g.openFloors, g.rng, g.player.x, g.player.y, MIN_SPAWN_DIST);
}

export function spawnEnemy(g: Game, id: EnemyId, x?: number, y?: number, affixes: AffixId[] = [], plain = false): Enemy {
  const lw = g.level ? levelWaves(g.level.realm, g.level.level) : null;
  if (!plain) id = realmFoe(g.level?.realm, id); // #212: in a realm's levels its variants march in place of the plain foe (the Iron Hold's knights). #277: `plain` keeps a boss's own call as it is
  const at = x === undefined || y === undefined ? edgePoint(g) : { x, y };
  if (affixes.length && affixes.length < g.oath.n.affixes) {
    // v0.6 Oath (Thrice-Marked): every elite is topped up to three affixes, never the same one twice
    const pool = AFFIX_IDS.filter((a) => !affixes.includes(a));
    affixes = [...affixes];
    while (affixes.length < g.oath.n.affixes && pool.length) affixes.push(pool.splice(Math.floor(g.rng() * pool.length), 1)[0]);
  }
  const siege = g.route?.focus === 'siege'; // v0.6 Siege path: a tougher Act
  const hp = g.waveHpMult * g.tier.enemyHp * curseValue(g.curses, 'ironHorde', 'hp') * (siege ? ROUTES.siege.hp : 1);
  const e = createEnemy(ENEMIES[id], at.x, at.y, hp, g.waveDmgMult * g.tier.enemyDmg * (siege ? ROUTES.siege.damage : 1), affixes, enemyXpMult(Math.max(1, g.wave)) / (lw?.foes ?? 1)); // #243: a level's extra foes share the XP its waves pay
  e.born = g.time;
  e.flankRoll = g.rng();
  e.flankDir = g.rng() < 0.5 ? 1 : -1;
  g.enemies.push(e);
  if (e.def.boss) {
    // v0.6 Oath: tougher bosses, and bosses that rise once more
    e.maxHp = e.hp = Math.round(e.hp * g.oath.n.bossHp);
    e.secondWind = g.oath.n.secondWind;
    if (e.secondWind) e.hpFloor = 1; // it holds at 1 HP until it rises (enemyAI secondWind)
    g.bossHit = false; // "flawless" is judged per boss
    g.banner = { text: e.def.name, t: 3 };
    sfx(g, 'warn');
  }
  return e;
}

/** #99: a variant boss (config/bosses.ts) fights as its base boss, renamed, tinted and stronger, like a treasure guardian. */
function dressBoss(g: Game, e: Enemy): void {
  const b = bossDef(g.bossesSeen[g.bossesSeen.length - 1] ?? '');
  if (!b.name || b.from !== e.def.id) return;
  e.def = { ...e.def, name: b.name, palette: b.palette };
  e.maxHp = e.hp = Math.round(e.hp * (b.hp ?? 1));
  e.damage *= b.damage ?? 1;
  g.banner = { text: b.rare ? `${b.name} · Rare` : b.name, t: 3 };
}

/** #202: a level's last-wave boss is its realm's crown boss when the level says so: its phases run their minimum time (systems/enemyAI). */
function crownBoss(g: Game, e: Enemy): void {
  const lv = g.level;
  if (!lv || g.wave !== lv.last || !isCrownFight(REALMS[lv.realm].levels[lv.level - 1]?.boss)) return;
  if (bossDef(g.bossesSeen[g.bossesSeen.length - 1] ?? '').from !== e.def.id) return;
  e.crown = true;
  e.phaseAt = g.time;
  e.hpFloor = Math.max(e.hpFloor, crownHpFloor(e.maxHp, 1, e.def.phases ?? 2, 0)); // held from its first tick (enemyAI holdPhase)
  g.banner = { text: `${e.def.name} · Crown boss`, t: 3 };
}

/** #219: a level's last-wave boss comes as an elite when the level says so: more phases (logic/crownBoss elitePhases) on more HP (#220, WORLD.eliteBoss), and its name says so. */
function eliteBoss(g: Game, e: Enemy): void {
  const lv = g.level;
  if (!lv || g.wave !== lv.last || !isEliteFight(REALMS[lv.realm].levels[lv.level - 1]?.boss)) return;
  if (bossDef(g.bossesSeen[g.bossesSeen.length - 1] ?? '').from !== e.def.id) return;
  e.def = { ...e.def, name: `${e.def.name}, Elite`, phases: elitePhases(e.def.phases ?? 2) };
  e.maxHp = e.hp = Math.round(e.hp * WORLD.eliteBoss.hp);
  e.damage *= WORLD.eliteBoss.damage;
  g.banner = { text: `${e.def.name} · one phase more`, t: 3 };
}

/** #293: a level's end boss on its own step where the realm has one (WORLD.endBossStep): its HP, its blows and the ground it fouls. */
function stepBoss(g: Game, e: Enemy): void {
  const lv = g.level;
  if (!lv || g.wave !== lv.last) return;
  if (bossDef(g.bossesSeen[g.bossesSeen.length - 1] ?? '').from !== e.def.id) return;
  const s = endBossStep(lv.realm, lv.level);
  if (s.hp === 1 && s.damage === 1) return;
  e.maxHp = e.hp = Math.round(e.hp * s.hp);
  e.damage *= s.damage;
  if (e.def.poolDps) e.def = { ...e.def, poolDps: e.def.poolDps * s.damage };
}

/** A squad arrives together, already in formation, facing the player. `at`: where (the v0.5 ambush), else an edge of the map. */
export function spawnSquad(g: Game, index: number, units: SpawnUnit[], at = edgePoint(g)): void {
  const plan = g.squadPlans[index];
  const members: Enemy[] = [];
  let commander: Enemy | null = null;
  for (const u of units) {
    const e = spawnEnemy(g, u.id, at.x, at.y, u.affixes);
    if (u.commander) commander = e;
    else members.push(e);
  }
  const sq = createSquad(g, plan, members, commander, at.x, at.y);
  for (const e of [...members, ...(commander ? [commander] : [])]) {
    const slot = slotPosition(sq, sq.facing, e.slot < 0 ? sq.commanderSlot : sq.offsets[e.slot]);
    e.x = slot.x;
    e.y = slot.y;
  }
}

/** #169: quest kinds taken this Act — active now, or done even if the quest itself has since lingered out of g.quests. */
export function questsTakenThisAct(g: Game): QuestKind[] {
  return g.pendingBoard ? [] : [...g.actQuestsDone, ...g.quests.filter((q) => q.state === 'active').map((q) => q.kind)];
}

function startWave(g: Game): void {
  g.wave++;
  const draw = { seed: g.seed, arena: g.arena.id, seen: g.bossesSeen, quests: questsTakenThisAct(g) };
  const lv = g.level;
  const bossWave = bossWaveIn(lv, g.wave); // #243: a realm level's only boss wave is its last
  const lw = lv ? levelWaves(lv.realm, lv.level) : { foes: 1, pace: 1 }; // #243: a level's wave length
  const key = lv && g.wave === lv.last ? levelBoss(lv.realm, lv.level) : ownWaves(lv) ? null : bossForWave(g.wave, draw); // #191: a level ends on its realm's boss
  if (key) g.bossesSeen.push(key);
  const boss = key ? bossDef(key).from : null;
  const plan = directWave({
    seed: g.seed,
    wave: g.wave,
    classId: g.player.cls.id,
    performance: g.perf,
    bosses: boss ? [boss] : g.arena.bosses, // #99: the boss drawn above (only boss waves have one)
    eliteMult: g.tier.eliteMult * (g.route?.focus === 'elite' ? ROUTES.elite.eliteMult : 1) * (g.vars['relic.eliteMult'] ?? 1), // v0.6 Elite path; v0.7.1 Tyrant's Banner
    tier: g.tierIndex, // v0.8 (#101): the difficulty's roster
    fields: levelFields(lv), // #249: a realm's own foes come on every difficulty
    fieldsWeight: lv ? REALMS[lv.realm].fieldsWeight : undefined,
    featured: lv ? featuredSquads(lv.realm, lv.level, g.tierIndex, g.seed).filter((f) => f.wave === g.wave).map((f) => f.template) : undefined, // #259: the road's featured squad, for sure
    themeBias: actTheme(g).bias, // v0.6: the route's theme
    budgetMult: curseValue(g.curses, 'swarm', 'budget') * pacingBudget(g.wave, bossWave) * lw.foes, // v0.5: breathers and heavy waves (WAVES.pacing)
    boss: bossWave,
    pace: lw.pace,
    squadMult: curseValue(g.curses, 'eliteCommanders', 'squadWeight'),
    eliteCommanders: g.curses.includes('eliteCommanders'),
    modifierChance: g.oath.n.modifierChance,
    modifierFrom: g.oath.n.modifierFrom || undefined,
  });
  g.waveHpMult = plan.hpMult;
  g.waveDmgMult = plan.dmgMult;
  g.modifier = plan.modifier;
  g.spawnQueue = plan.units;
  g.squadPlans = plan.squads;
  g.spawnInterval = plan.spawnInterval;
  g.spawnTimer = 0;
  g.waveT = 0;
  if (g.wave === ACTS.length) g.wave10Time = g.time;
  const title = g.wave === 1 ? `${placeName(1, g.level)} — ${themeFor(1, g.seed).name}` : plan.boss ? `Wave ${g.wave} — Boss` : `Wave ${g.wave}`;
  g.banner = { text: plan.modifier ? `${title} · ${MODIFIERS[plan.modifier].name}` : title, t: plan.modifier ? 3 : 2 };
  sfx(g, 'wave');
  emit(g, 'onWaveStart', { wave: g.wave });
}

/**
 * v0.6: the last few weak enemies of a wave (WAVES.stragglers) get a short grace, then come straight at the player; siege structures
 * that cannot come give up the field. Elites and bosses are never stragglers: they are fights, not leftovers.
 */
function pullStragglers(g: Game, dt: number): void {
  const s = WAVES.stragglers;
  let left = 0;
  let strong = false;
  for (const e of g.enemies) {
    if (e.side) continue;
    left++;
    if (e.elite || e.def.boss) strong = true;
  }
  if (left === 0 || left > s.count || strong) {
    g.vars.stragglers = 0;
    return;
  }
  if ((g.vars.stragglers = (g.vars.stragglers ?? 0) + dt) < s.grace) return;
  for (const e of g.enemies) {
    if (e.side || e.pulled || e.dead) continue;
    if (e.def.structure) killEnemy(g, e, 'hazard');
    else {
      e.pulled = true;
      e.hidden = false; // the pull replaces an assassin's behaviour, the only thing that would unhide him
      e.telegraph = null;
      floatText(g, e.x, e.y - e.r - 18, '!', '#f4a595', 18);
    }
  }
}

export function updateSpawning(g: Game, dt: number): void {
  if (g.pendingMerchant || g.level?.cleared) return; // between Acts: nothing spawns until the Merchant has been visited; a cleared level is over
  if (g.breather > 0) {
    g.breather -= dt;
    if (g.breather <= 0) startWave(g);
    return;
  }
  g.waveT += dt;
  if (g.spawnQueue.length > 0) {
    g.spawnTimer -= dt;
    while (g.spawnTimer <= 0 && g.spawnQueue.length > 0) {
      const next = g.spawnQueue.shift()!;
      if (next.squad < 0) {
        const e = spawnEnemy(g, next.id, undefined, undefined, next.affixes);
        if (e.def.boss) {
          dressBoss(g, e);
          crownBoss(g, e);
          eliteBoss(g, e);
          stepBoss(g, e);
        }
        g.spawnTimer += g.spawnInterval;
      } else {
        // the rest of the squad is right behind it in the queue
        const units = [next];
        while (g.spawnQueue[0]?.squad === next.squad) units.push(g.spawnQueue.shift()!);
        spawnSquad(g, next.squad, units);
        g.spawnTimer += g.spawnInterval * units.length;
      }
    }
    return;
  }
  // wave over: everything dead, or the stragglers have had their time (no stalemates, no safe farming)
  g.vars.overtime = (g.vars.overtime ?? 0) + dt;
  pullStragglers(g, dt);
  const cleared = !g.enemies.some((e) => !e.side); // v0.5: a lair, a quest target or an event does not hold the wave open
  const limit = curseValue(g.curses, 'timedWaves', 'overtime', WAVES.overtime);
  if (cleared || (g.vars.overtime > limit && !g.enemies.some((e) => e.def.boss && !e.side))) {
    g.vars.overtime = 0;
    g.vars.stragglers = 0;
    g.breather = !cleared ? 0.01 : curseValue(g.curses, 'noRespite', 'breather', WAVES.breather);
    const noMerchant = g.oath.n.noMerchant === g.act; // v0.6 Oath (Empty Road): no Merchant in this Act, straight on to the fork
    const turned = isActEnd(g.wave) && ownWaves(g.level) && g.wave < g.level!.last;
    if (g.level && g.wave >= g.level.last && g.victory === 'none') g.level.cleared = true; // #191: the level ends here, before any Merchant or fork (the Last Bastion's win is the victory)
    else if (turned) turnAct(g); // #243: an Act ends inside a level: on with it, no Merchant and no fork
    else if (isActEnd(g.wave)) {
      if (noMerchant) g.pendingRoute = routeChoices(g.seed, g.act, g.arena.id);
      else g.pendingMerchant = true; // the UI (or the bot) visits the Merchant, then picks a route
    } else if (g.route?.focus === 'merchant' && g.wave % ACTS.length === ROUTES.merchant.midWave && !noMerchant) (g.pendingMerchant = true), (g.midMerchant = true), (g.vars.caravanRelic = caravanSellsRelic(g.player.relics.rng) ? 1 : 0); // v0.6 Merchant path; v0.8.1 #144: a relic or books
    g.wavesCleared = g.wave;
    emit(g, 'onWaveCleared', { wave: g.wave });
    g.modifier = null;
    // the director's rubber band: how much HP is left, and was the wave cleared quickly
    g.perf = updatePerformance(g.perf, g.player.hp / g.player.stats.hp, g.waveT, WAVES.spawn.maxDuration + 15);
    const bonus = waveClearGold(g.wave, g.player.mods.gold * g.tier.gold * (g.vars.curseMult ?? 1));
    g.gold += bonus;
    g.levelAtWave.push(g.player.level); // for the simulation's pace report
    gainXp(g, waveClearXp(g.wave));
    floatText(g, g.player.x, g.player.y - 60, `+${bonus} gold`, '#c9a227', 15);
    g.banner = g.level?.cleared ? { text: 'Level cleared', t: 3 } : turned ? g.banner : { text: cleared ? 'Wave cleared' : 'They keep coming', t: 1.5 }; // the new Act's name stays up
  }
}
