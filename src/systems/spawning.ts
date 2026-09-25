import { AFFIX_IDS } from '../config/elites';
import { routeChoices } from '../logic/routes';
import type { AffixId } from '../config/elites';
import { ENEMIES, type EnemyId } from '../config/enemies';
import { MODIFIERS, WAVES } from '../config/waves';
import { sfx } from '../sim/view';
import { emit } from '../core/events';
import type { Enemy, Game } from '../core/types';
import { createEnemy } from '../entities/actors';
import { actName, bossForWave, isActEnd, themeFor } from '../logic/acts';
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
import { actTheme } from './acts';
import { killEnemy } from './combat';
import { createSquad } from './squads';

const MIN_SPAWN_DIST = 380;

/** v0.5: enemies come from the edges of the whole open map (every open wing), not right on top of the player. */
function edgePoint(g: Game): { x: number; y: number } {
  return spawnPoint(g.openFloors, g.rng, g.player.x, g.player.y, MIN_SPAWN_DIST);
}

export function spawnEnemy(g: Game, id: EnemyId, x?: number, y?: number, affixes: AffixId[] = []): Enemy {
  const at = x === undefined || y === undefined ? edgePoint(g) : { x, y };
  if (affixes.length && affixes.length < g.oath.n.affixes) {
    // v0.6 Oath (Thrice-Marked): every elite is topped up to three affixes, never the same one twice
    const pool = AFFIX_IDS.filter((a) => !affixes.includes(a));
    affixes = [...affixes];
    while (affixes.length < g.oath.n.affixes && pool.length) affixes.push(pool.splice(Math.floor(g.rng() * pool.length), 1)[0]);
  }
  const siege = g.route?.focus === 'siege'; // v0.6 Siege path: a tougher Act
  const hp = g.waveHpMult * g.tier.enemyHp * curseValue(g.curses, 'ironHorde', 'hp') * (siege ? ROUTES.siege.hp : 1);
  const e = createEnemy(ENEMIES[id], at.x, at.y, hp, g.waveDmgMult * g.tier.enemyDmg * (siege ? ROUTES.siege.damage : 1), affixes, enemyXpMult(Math.max(1, g.wave)));
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
    sfx('warn');
  }
  return e;
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

function startWave(g: Game): void {
  g.wave++;
  const boss = bossForWave(g.wave, g.arena.id);
  const plan = directWave({
    seed: g.seed,
    wave: g.wave,
    classId: g.player.cls.id,
    performance: g.perf,
    bosses: boss ? [boss] : g.arena.bosses, // Act boss at x0, the arena's own rotation at x5
    eliteMult: g.tier.eliteMult * (g.route?.focus === 'elite' ? ROUTES.elite.eliteMult : 1) * (g.vars['relic.eliteMult'] ?? 1), // v0.6 Elite path; v0.7.1 Tyrant's Banner
    themeBias: actTheme(g).bias, // v0.6: the route's theme
    budgetMult: curseValue(g.curses, 'swarm', 'budget') * pacingBudget(g.wave), // v0.5: breathers and heavy waves (WAVES.pacing)
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
  if (g.wave === 10) g.wave10Time = g.time;
  const title = g.wave === 1 ? `${actName(1)} — ${themeFor(1, g.seed).name}` : plan.boss ? `Wave ${g.wave} — Boss` : `Wave ${g.wave}`;
  g.banner = { text: plan.modifier ? `${title} · ${MODIFIERS[plan.modifier].name}` : title, t: plan.modifier ? 3 : 2 };
  sfx('wave');
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
  if (g.pendingMerchant) return; // between Acts: nothing spawns until the Merchant has been visited
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
        spawnEnemy(g, next.id, undefined, undefined, next.affixes);
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
    if (isActEnd(g.wave)) {
      if (noMerchant) g.pendingRoute = routeChoices(g.seed, g.act, g.arena.id);
      else g.pendingMerchant = true; // the UI (or the bot) visits the Merchant, then picks a route
    } else if (g.route?.focus === 'merchant' && g.wave % ACTS.length === ROUTES.merchant.midWave && !noMerchant) (g.pendingMerchant = true), (g.midMerchant = true); // v0.6 Merchant path
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
    g.banner = { text: cleared ? 'Wave cleared' : 'They keep coming', t: 1.5 };
  }
}
