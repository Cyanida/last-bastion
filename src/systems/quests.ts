import { RUNES } from '../config/economy';
import { AFFIX_IDS, ELITES } from '../config/elites';
import { QUEST_BOARD, QUESTS, REWARDS, type QuestKind, type RewardKind } from '../config/quests';
import { ROUTES } from '../config/routes';
import { TREASURES } from '../config/treasures';
import { sfx } from '../sim/view';
import { addListener, type GameEvents } from '../core/events';
import { compact } from '../core/math';
import type { Enemy, Game, Minion, Quest } from '../core/types';
import { createMinion } from '../entities/actors';
import { enemyDmgMult } from '../logic/formulas';
import { placeRng, rollBoard } from '../logic/quests';
import { floorPoint, spawnPoint } from '../logic/regions';
import { chainStep } from '../logic/treasures';
import { nearestEnemy } from './combat';
import { floatText, ring } from './effects';
import { clearPoint } from './movement';
import { lairKind, openNextWing } from './regions';
import { offerRelics } from './relics';
import { spawnEnemy } from './spawning';
import { passTrial, takeFragment } from './treasures';

/**
 * Side quests (v0.5, config/quests.ts). Each Act's board is rolled from the seed; the quests taken run their hook until done or
 * failed. Done pays the reward and opens the next wing; failed costs nothing; whatever is still active when the Act ends fails.
 * A finished quest stays on the HUD tracker for QUEST_BOARD.linger seconds.
 */
interface QuestHooks {
  start(g: Game, q: Quest): void;
  update(g: Game, q: Quest, dt: number): void;
  onKill?(g: Game, q: Quest, e: Enemy): void;
}

const waveOn = (g: Game) => g.wave > 0 && g.breather <= 0;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/** A seeded point on the open floors, preferably at least `away` from the player. */
function openPoint(g: Game, q: Quest, away = 350): { x: number; y: number } {
  let at = floorPoint(g.openFloors, q.rng);
  for (let i = 0; i < 8 && dist(at, g.player) < away; i++) at = floorPoint(g.openFloors, q.rng);
  return clearPoint(g, at);
}

/** The caravan or the monk: passive, walks its path, HP scaled like the coming wave's damage. */
function escort(g: Game, kind: 'caravan' | 'monk', hp: number, speed: number, path: { x: number; y: number }[]): Minion {
  const big = kind === 'caravan';
  const m = createMinion(g.player.x + 60, g.player.y, { hp: Math.round(hp * enemyDmgMult(g.wave + 1) * g.tier.enemyDmg), damage: 0, speed, attackCd: 1, life: Infinity, r: big ? 22 : 11, scale: big ? 2.5 : 3 });
  Object.assign(m, { kind, passive: true, path, pathI: 0 });
  g.minions.push(m);
  return m;
}

const HOOKS: Record<QuestKind, QuestHooks> = {
  // rolls a loop of waypoints while the waves run; two cleared waves with it alive and it is through
  caravan: {
    start(g, q) {
      q.unit = escort(g, 'caravan', QUESTS.caravan.hp, QUESTS.caravan.speed, [0, 1, 2, 3].map(() => openPoint(g, q, 0)));
      q.since = g.wavesCleared;
    },
    update(g, q) {
      q.unit!.speed = waveOn(g) ? QUESTS.caravan.speed : 0;
      q.progress = g.wavesCleared - q.since;
      if (q.unit!.hp <= 0) end(g, q, false);
      else if (q.progress >= QUESTS.caravan.waves) end(g, q, true);
    },
  },

  camps: {
    start(g, q) {
      for (let i = 0; i < QUESTS.camps.count; i++) {
        const at = openPoint(g, q);
        const camp = spawnEnemy(g, 'siegeCamp', at.x, at.y);
        camp.side = true;
        q.foes.push(camp);
      }
    },
    update(g, q) {
      if (q.progress >= QUESTS.camps.count) end(g, q, true);
    },
    onKill(_g, q, e) {
      if (q.foes.includes(e)) q.progress++;
    },
  },

  // walks straight for the chapel on the far side, and stands still while anything hostile is near him
  monk: {
    start(g, q) {
      const chapel = clearPoint(g, spawnPoint(g.openFloors, q.rng, g.player.x, g.player.y, QUESTS.monk.chapelDist, 90));
      q.x = chapel.x;
      q.y = chapel.y;
      q.unit = escort(g, 'monk', QUESTS.monk.hp, QUESTS.monk.speed, [chapel]);
    },
    update(g, q) {
      const u = q.unit!;
      u.speed = nearestEnemy(g, u.x, u.y, QUESTS.monk.wait) ? 0 : QUESTS.monk.speed;
      if (u.hp <= 0) end(g, q, false);
      else if (dist(u, q) < 30) end(g, q, true);
    },
  },

  // named when taken, arrives with the next wave (never before elites do) at a far point: the strongest regular unlocked, two affixes, xHP
  elite: {
    start(g, q) {
      q.name = QUESTS.elite.names[Math.floor(q.rng() * QUESTS.elite.names.length)];
      q.since = Math.max(g.wave + 1, ELITES.fromWave); // the wave it comes with
    },
    update(g, q) {
      if (q.foes.length > 0 || g.wave < q.since) return;
      const at = spawnPoint(g.openFloors, q.rng, g.player.x, g.player.y, QUESTS.elite.dist, 60);
      const pool = [...AFFIX_IDS];
      const e = spawnEnemy(g, lairKind(g), at.x, at.y, [0, 1].map(() => pool.splice(Math.floor(q.rng() * pool.length), 1)[0]));
      e.maxHp = e.hp = Math.round(e.hp * QUESTS.elite.hpMult);
      e.side = true;
      q.foes.push(e);
      g.banner = { text: `${q.name} has come for you`, t: 2.5 };
      sfx(g, 'warn');
    },
    onKill(g, q, e) {
      if (q.foes[0] === e) end(g, q, true);
    },
  },

  shrine: {
    start(g, q) {
      Object.assign(q, openPoint(g, q, 250));
    },
    update(g, q, dt) {
      if (waveOn(g) && dist(g.player, q) < QUESTS.shrine.radius) q.progress += dt;
      if (q.progress >= QUESTS.shrine.seconds) end(g, q, true);
    },
  },

  chest: {
    start(g, q) {
      Object.assign(q, openPoint(g, q, 500));
    },
    update(g, q) {
      if (dist(g.player, q) < QUESTS.chest.reach) end(g, q, true);
    },
  },

  // v0.5 sacred treasures: the class's trial, a feat to reach this Act (config/treasures.ts; the target is in q.since)
  trial: {
    start() {},
    update(g, q) {
      q.progress = g.actFeats[TREASURES[g.player.cls.id].trial.feat] ?? 0;
      if (q.progress >= q.since) end(g, q, true);
    },
  },
};

export function payReward(g: Game, reward: RewardKind): void {
  if (reward === 'relic') offerRelics(g, 3, 'quest');
  else if (reward === 'gold') g.player.gold += REWARDS.gold.amount * g.act;
  else if (reward === 'rune') g.questRunes += RUNES.quest;
  else if (reward === 'talent') g.player.talentPoints++;
  else if (reward === 'fragment') takeFragment(g);
  else if (reward === 'trial') passTrial(g);
}

function end(g: Game, q: Quest, done: boolean): void {
  q.state = done ? 'done' : 'failed';
  q.t = QUEST_BOARD.linger;
  if (q.unit) compact(g.minions, (m) => m !== q.unit); // the caravan rolls on, the monk goes in (or they are already dead)
  if (!done) return;
  g.questsDone++;
  payReward(g, q.reward);
  const p = g.player;
  floatText(g, p.x, p.y - 64, `${REWARDS[q.reward].icon} ${REWARDS[q.reward].name}`, '#9fe07b', 16);
  ring(g, p.x, p.y, 120, '#9fe07b', 0.6);
  sfx(g, 'levelup');
  openNextWing(g);
}

/**
 * A new Act (and a new run): what is still active fails, without penalty; a new board is up. A class gathering its treasure's fragments
 * may find one in place of a Rune reward; a class at its trial gets the trial as a free extra card (v0.5 treasures).
 */
export function initQuests(g: Game): void {
  for (const q of g.quests) if (q.state === 'active') end(g, q, false);
  compact(g.quests, (q) => q.state !== 'offered');
  g.actFeats = {};
  const step = g.chain && chainStep(g.chain, g.chain.unlocked);
  const offer = (kind: QuestKind, reward: RewardKind, i: number) =>
    g.quests.push({ kind, reward, state: 'offered', name: QUESTS[kind].short, x: 0, y: 0, unit: null, foes: [], progress: 0, since: 0, t: 0, rng: placeRng(g.seed, 1000 * g.act + i) });
  const board = rollBoard(g.seed, g.act, step === 'fragments');
  for (const [i, { kind, reward }] of board.entries()) offer(kind, reward, i);
  if (step === 'trial') {
    const trial = TREASURES[g.player.cls.id].trial;
    offer('trial', 'trial', board.length);
    Object.assign(g.quests[g.quests.length - 1], { name: trial.name, since: trial.n });
  }
  g.pendingBoard = true;
}

/** v0.6: how many quests the board lets you take (the Pilgrim path, one more). */
export const questTake = (g: Game): number => QUEST_BOARD.take + (g.route?.focus === 'pilgrim' ? ROUTES.pilgrim.extraQuests : 0);

/** The board's answer: up to QUEST_BOARD.take of the offered quests, by their index on the board (the trial comes free on top). Taking none is fine. */
export function takeQuests(g: Game, picks: number[]): void {
  const offered = g.quests.filter((q) => q.state === 'offered');
  compact(g.quests, (q) => q.state !== 'offered');
  let taken = 0;
  for (const i of new Set(picks)) {
    const q = offered[i];
    if (!q || (q.kind !== 'trial' && taken++ >= questTake(g))) continue;
    q.state = 'active';
    g.quests.push(q);
    HOOKS[q.kind].start(g, q);
  }
  g.pendingBoard = false;
}

export function updateQuests(g: Game, dt: number): void {
  for (const q of g.quests) if (q.state === 'active') HOOKS[q.kind].update(g, q, dt);
  compact(g.quests, (q) => q.state === 'active' || q.state === 'offered' || (q.t -= dt) > 0);
}

addListener((g, name, ev) => {
  if (name !== 'onKill') return;
  const e = (ev as GameEvents['onKill']).enemy;
  for (const q of g.quests) if (q.state === 'active') HOOKS[q.kind].onKill?.(g, q, e);
});
