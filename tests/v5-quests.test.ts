import { describe, expect, it } from 'vitest';
import { CLASS_ORDER } from '../src/config/classes';
import { RUNES } from '../src/config/economy';
import { EVENTS, type EventKind } from '../src/config/events';
import { QUESTS, REWARDS, type QuestKind, type RewardKind } from '../src/config/quests';
import { WAVES } from '../src/config/waves';
import type { Game } from '../src/core/types';
import { createGame, summarizeRun, updateGame } from '../src/game';
import { withAchievements } from '../src/logic/achievements';
import { enemyCost, waveBudget } from '../src/logic/director';
import { questMarks, rollBoard, rollEvent } from '../src/logic/quests';
import { applyRun, defaultSave, type RunSummary } from '../src/logic/save';
import { pacingBudget, pacingOf } from '../src/logic/waves';
import { waypoint } from '../src/logic/regions';
import { botStep, simulateRun } from '../src/sim/bot';
import { nextAct } from '../src/systems/acts';
import { killEnemy } from '../src/systems/combat';
import { peddlerBuy, peddlerPrice } from '../src/systems/events';
import { skeletonCount } from '../src/systems/minions';
import { takeQuests, updateQuests } from '../src/systems/quests';
import { spawnEnemy } from '../src/systems/spawning';
import { openRegion } from '../src/systems/regions';

const DT = 1 / 60;
const openWings = (g: Game) => Object.keys(g.regionOpen).length;

/** A fresh game with one quest of that kind taken (the first board slot is rewritten; the board itself is seeded). */
function withQuest(kind: QuestKind, reward: RewardKind = 'gold'): Game {
  const g = createGame('paladin', 42);
  Object.assign(g.quests[0], { kind, reward, name: QUESTS[kind].short });
  takeQuests(g, [0]);
  return g;
}

/** A game whose wave 3 (a breather: always an event) brings that event. */
function withEvent(kind: EventKind): Game {
  let seed = 1;
  while (rollEvent(seed, 3) !== kind) seed++;
  const g = createGame('paladin', seed);
  takeQuests(g, []);
  g.wave = 2;
  g.breather = DT / 2;
  updateGame(g, DT);
  expect(g.event?.kind).toBe(kind);
  return g;
}

describe('the quest board and the events are seeded', () => {
  it('same seed, same board and the same events; other Acts get other boards', () => {
    expect(rollBoard(99, 1)).toEqual(rollBoard(99, 1));
    const boards = [1, 2, 3, 4, 5].map((act) => JSON.stringify(rollBoard(99, act)));
    expect(new Set(boards).size).toBeGreaterThan(1);
    for (const board of [1, 2, 3].map((act) => rollBoard(7, act))) {
      expect(board).toHaveLength(3);
      expect(new Set(board.map((q) => q.kind)).size).toBe(3); // three different quests
      for (const q of board) expect(q.reward).not.toBe('fragment'); // only a class gathering its treasure's fragments finds one (v5-treasures)
    }
    const events = (seed: number) => Array.from({ length: 40 }, (_, w) => rollEvent(seed, w + 1));
    expect(events(5)).toEqual(events(5));
    // the game's own board is the seeded one, and the board is up at the start of a run
    const g = createGame('archer', 99);
    expect(g.pendingBoard).toBe(true);
    expect(g.quests.map((q) => ({ kind: q.kind, reward: q.reward }))).toEqual(rollBoard(99, 1));
  });

  it('events: never on boss waves or before wave 3, always on breathers, about a quarter of the other waves', () => {
    let other = 0;
    let rolled = 0;
    for (let seed = 1; seed <= 60; seed++) {
      for (let w = 1; w <= 40; w++) {
        const ev = rollEvent(seed, w);
        if (w % WAVES.bossEvery === 0 || w < 3) expect(ev).toBeNull();
        else if (pacingOf(w) === 'breather') expect(ev).not.toBeNull();
        else {
          other++;
          if (ev) rolled++;
        }
      }
    }
    expect(rolled / other).toBeGreaterThan(0.15);
    expect(rolled / other).toBeLessThan(0.35);
  });
});

describe('breather pacing', () => {
  it('waves 3 and 8 of an Act are breathers, 4 and 9 heavy, boss waves neither', () => {
    expect([1, 3, 4, 5, 8, 9, 10, 13, 14, 18, 19, 20].map(pacingOf)).toEqual([null, 'breather', 'heavy', null, 'breather', 'heavy', null, 'breather', 'heavy', 'breather', 'heavy', null]);
    expect(pacingBudget(3)).toBe(WAVES.pacing.breatherBudget);
    expect(pacingBudget(9)).toBe(WAVES.pacing.heavyBudget);
    expect(pacingBudget(7)).toBe(1);
  });

  it('the director buys a lighter breather and a heavier wave after it', () => {
    const cost = (wave: number) => {
      const g = createGame('paladin', 3);
      takeQuests(g, []);
      g.wave = wave - 1;
      g.breather = DT / 2;
      updateGame(g, DT);
      return g.spawnQueue.reduce((n, u) => n + enemyCost(u.id), 0) + g.enemies.filter((e) => !e.side).reduce((n, e) => n + enemyCost(e.def.id), 0);
    };
    expect(cost(3)).toBeLessThan(waveBudget(3));
    expect(cost(3)).toBeGreaterThanOrEqual(waveBudget(3, 0, WAVES.pacing.breatherBudget));
    expect(cost(4)).toBeGreaterThanOrEqual(waveBudget(4, 0, WAVES.pacing.heavyBudget));
  });
});

describe('quests', () => {
  it('the caravan: done after two cleared waves, failed if it is destroyed; failure costs nothing', () => {
    const g = withQuest('caravan');
    const q = g.quests[0];
    expect(q.state).toBe('active');
    const cart = q.unit!;
    expect(cart.kind).toBe('caravan');
    expect(cart.passive).toBe(true);
    expect(skeletonCount(g)).toBe(0); // it does not take a Necromancer's slot
    const gold = g.gold;
    const wings = openWings(g);
    g.wavesCleared += QUESTS.caravan.waves;
    updateQuests(g, DT);
    expect(q.state).toBe('done');
    expect(g.gold).toBe(gold + REWARDS.gold.amount * g.act);
    expect(openWings(g)).toBe(wings + 1);
    expect(g.minions).not.toContain(cart);
    expect(g.questsDone).toBe(1);

    const h = withQuest('caravan');
    const before = { gold: h.gold, hp: h.player.hp, talent: h.talentPoints, wings: openWings(h) };
    h.quests[0].unit!.hp = 0;
    updateQuests(h, DT);
    expect(h.quests[0].state).toBe('failed');
    expect({ gold: h.gold, hp: h.player.hp, talent: h.talentPoints, wings: openWings(h) }).toEqual(before);
    expect(h.questsDone).toBe(0);
  });

  it('the caravan walks its waypoints only while a wave is on', () => {
    const g = withQuest('caravan');
    const cart = g.quests[0].unit!;
    const at = { x: cart.x, y: cart.y };
    for (let i = 0; i < 30; i++) updateGame(g, DT); // before the first wave
    expect(Math.hypot(cart.x - at.x, cart.y - at.y)).toBeLessThan(1);
    g.breather = 0;
    g.wave = 1;
    spawnEnemy(g, 'peasant', g.bounds.x + 30, g.bounds.y + 30); // keeps the wave on
    for (let i = 0; i < 30; i++) updateGame(g, DT);
    expect(Math.hypot(cart.x - at.x, cart.y - at.y)).toBeGreaterThan(5);
  });

  it('the siege camps: three side structures; done when all three burn', () => {
    const g = withQuest('camps', 'talent');
    const camps = g.quests[0].foes;
    expect(camps).toHaveLength(QUESTS.camps.count);
    for (const c of camps) expect(c.side && c.def.structure).toBe(true);
    const points = g.talentPoints;
    for (const c of camps) killEnemy(g, c);
    updateQuests(g, DT);
    expect(g.quests[0].state).toBe('done');
    expect(g.talentPoints).toBe(points + 1);
  });

  it('the monk: waits while enemies are near, done at the chapel, failed if he dies', () => {
    const g = withQuest('monk', 'rune');
    const q = g.quests[0];
    const monk = q.unit!;
    const e = spawnEnemy(g, 'peasant', monk.x + 40, monk.y);
    g.hash.insert(e);
    updateQuests(g, DT);
    expect(monk.speed).toBe(0);
    e.dead = true;
    g.hash.clear();
    updateQuests(g, DT);
    expect(monk.speed).toBe(QUESTS.monk.speed);
    Object.assign(monk, { x: q.x, y: q.y });
    updateQuests(g, DT);
    expect(q.state).toBe('done');
    expect(g.questRunes).toBe(RUNES.quest);

    const h = withQuest('monk');
    h.quests[0].unit!.hp = -1;
    updateQuests(h, DT);
    expect(h.quests[0].state).toBe('failed');
  });

  it('the named elite: comes with an elite wave, two affixes, x5 HP, side; done on its death', () => {
    const g = withQuest('elite', 'relic');
    const q = g.quests[0];
    expect(QUESTS.elite.names).toContain(q.name);
    g.wave = q.since - 1;
    updateQuests(g, DT);
    expect(q.foes).toHaveLength(0);
    g.wave = q.since;
    g.waveHpMult = 1;
    updateQuests(g, DT);
    const e = q.foes[0];
    expect(e.affixes).toHaveLength(2);
    expect(e.side).toBe(true);
    expect(e.maxHp).toBeGreaterThanOrEqual(e.def.hp * 5);
    killEnemy(g, e);
    expect(q.state).toBe('done');
    expect(g.relicOffers.at(-1)).toHaveLength(3);
  });

  it('the shrine counts only while a wave is on and you stand in it; the hidden chest is found by walking onto it', () => {
    const g = withQuest('shrine');
    const q = g.quests[0];
    Object.assign(g.player, { x: q.x, y: q.y });
    updateQuests(g, 30); // no wave yet
    expect(q.progress).toBe(0);
    g.wave = 1;
    g.breather = 0;
    updateQuests(g, 30);
    expect(q.state).toBe('active');
    updateQuests(g, 30);
    expect(q.state).toBe('done');

    const h = withQuest('chest');
    const c = h.quests[0];
    expect(questMarks(h).every((m) => m.hidden)).toBe(true); // marked nowhere
    updateQuests(h, DT);
    expect(c.state).toBe('active');
    Object.assign(h.player, { x: c.x, y: c.y });
    updateQuests(h, DT);
    expect(c.state).toBe('done');
  });

  it('the Act ending fails what is still open, clears its units and puts up a new board', () => {
    const g = createGame('paladin', 8);
    const board = g.quests.map((q) => q.kind);
    Object.assign(g.quests[0], { kind: 'caravan' });
    takeQuests(g, [0, 1, 2]); // only two may be taken
    expect(g.quests.filter((q) => q.state === 'active')).toHaveLength(2);
    expect(g.pendingBoard).toBe(false);
    const cart = g.quests[0].unit!;
    nextAct(g);
    expect(g.quests.filter((q) => q.state === 'failed')).toHaveLength(2);
    expect(g.minions).not.toContain(cart);
    expect(g.pendingBoard).toBe(true);
    expect(g.quests.filter((q) => q.state === 'offered').map((q) => q.kind)).toEqual(rollBoard(8, 2).map((q) => q.kind));
    expect(board).toEqual(rollBoard(8, 1).map((q) => q.kind));
  });

  it('quest Runes reach the save through applyRun, on top of the boss cap; quests and events count for the deeds', () => {
    const g = withQuest('chest', 'rune');
    Object.assign(g.player, { x: g.quests[0].x, y: g.quests[0].y });
    updateQuests(g, DT);
    g.eventsSeen = 20;
    const run: RunSummary = { ...summarizeRun(g), bosses: ['dragon', 'warden', 'dragon', 'warden', 'dragon', 'warden'] };
    expect(run.questRunes).toBe(RUNES.quest);
    const { save, runes } = applyRun(defaultSave(), run);
    expect(runes).toBe(RUNES.runCap + RUNES.quest);
    expect(save.counters.quests).toBe(1);
    expect(save.counters.events).toBe(20);
    const earned = withAchievements({ ...save, counters: { ...save.counters, quests: 5 } }).earned.map((e) => e.id);
    expect(earned).toEqual(expect.arrayContaining(['errant', 'worldly']));
  });
});

describe('events', () => {
  it('the wandering merchant: walk into him for his wares, at the Merchant prices; he leaves when the wave does', () => {
    const g = withEvent('peddler');
    const ev = g.event!;
    expect(ev.wares.length).toBeGreaterThan(0);
    Object.assign(g.player, { x: ev.x, y: ev.y });
    updateGame(g, DT);
    expect(g.pendingShop).toBe(true);
    const id = ev.wares[0];
    g.gold = 0;
    expect(peddlerBuy(g, id)).toBe(false);
    g.gold = 1000;
    expect(peddlerBuy(g, id)).toBe(true);
    expect(g.gold).toBe(1000 - peddlerPrice(g, id));
    expect(g.relics).toContain(id);
    expect(ev.wares).not.toContain(id);
    g.pendingShop = false;
    g.breather = 3; // the wave is over
    updateGame(g, DT);
    expect(g.event).toBeNull();
  });

  it('the cursed chest: three relics to choose from, and three side elites around you', () => {
    const g = withEvent('cursedChest');
    const ev = g.event!;
    Object.assign(g.player, { x: ev.x, y: ev.y });
    const offers = g.relicOffers.length;
    updateGame(g, DT);
    expect(g.relicOffers.length).toBe(offers + 1);
    const elites = g.enemies.filter((e) => e.side && e.elite);
    expect(elites).toHaveLength(EVENTS.cursedChest.elites);
  });

  it('the ambush: two squads at once, and bonus gold when the wave is cleared', () => {
    const g = withEvent('ambush');
    const squads = g.squadPlans.length;
    g.waveT = EVENTS.ambush.delay;
    updateGame(g, DT);
    expect(g.squadPlans.length).toBe(squads + 2);
    expect(g.banner.text).toBe('Ambush!');
    for (const e of g.enemies) e.dead = true;
    g.spawnQueue = [];
    const gold = g.gold;
    for (let i = 0; i < 3 && g.event; i++) updateGame(g, DT);
    expect(g.event).toBeNull();
    expect(g.gold).toBeGreaterThanOrEqual(gold + EVENTS.ambush.gold * g.act);
  });

  it('the lost knight fights for one wave', () => {
    const g = withEvent('knight');
    const knight = g.event!.unit!;
    expect(g.minions).toContain(knight);
    expect(knight.kind).toBe('knight');
    expect(knight.passive).toBeFalsy();
    g.breather = 3;
    updateGame(g, DT);
    expect(g.minions).not.toContain(knight);
  });

  it('the plague cart rolls across leaking poison, pays when burnt, and is side content', () => {
    const g = withEvent('plagueCart');
    const cart = g.event!.foe!;
    expect(cart.side).toBe(true);
    const at = { x: cart.x, y: cart.y };
    for (let i = 0; i < 120; i++) updateGame(g, DT);
    expect(Math.hypot(cart.x - at.x, cart.y - at.y)).toBeGreaterThan(30);
    expect(g.fields.some((f) => f.hostile)).toBe(true);
    const gold = g.gold;
    killEnemy(g, cart);
    expect(g.gold).toBe(gold + EVENTS.plagueCart.gold * g.act);
  });

  it('side enemies do not hold a wave open', () => {
    const g = createGame('paladin', 4);
    takeQuests(g, []);
    Object.assign(g, { wave: 1, breather: 0, spawnQueue: [] });
    spawnEnemy(g, 'siegeCamp', 400, 400).side = true;
    updateGame(g, DT);
    expect(g.wavesCleared).toBe(1);
  });
});

describe('the bot', () => {
  it('takes the first two quests, steers for them, and plays on without throwing', () => {
    const g = createGame('viking', 17);
    botStep(g);
    expect(g.pendingBoard).toBe(false);
    expect(g.quests.filter((q) => q.state === 'active')).toHaveLength(2);
    for (const cls of CLASS_ORDER) {
      const run = simulateRun(cls, 21, {}, 0, 150);
      expect(run.wave).toBeGreaterThan(0);
    }
  }, 30000); // five short bot runs: seconds, more on a busy CI runner
});

describe('navigation through gates (v0.5)', () => {
  it('an enemy on another floor heads for the gate, then reaches the player', () => {
    const g = createGame('paladin', 3);
    const east = g.arena.regions!.find((r) => r.id === 'east')!;
    const north = g.arena.regions!.find((r) => r.id === 'north')!;
    openRegion(g, 'east');
    openRegion(g, 'north');
    expect(waypoint(g.arena.regions!, east.floor.x + 100, east.floor.y + 100, g.player.x, g.player.y)).toEqual({ x: east.gate!.x + east.gate!.w / 2, y: east.gate!.y + east.gate!.h / 2 });
    expect(waypoint(g.arena.regions!, g.player.x, g.player.y, g.player.x + 10, g.player.y)).toBeNull(); // same floor
    expect(waypoint(g.arena.regions!, g.player.x, g.player.y, north.floor.x + 50, north.floor.y + 50)).toEqual({ x: north.gate!.x + north.gate!.w / 2, y: north.gate!.y + north.gate!.h / 2 });
    // a wolf in the far corner of the east wing, the player in the core: it must arrive, not press on the wall
    g.breather = 999;
    const wolf = spawnEnemy(g, 'wolf', east.floor.x + east.floor.w - 40, east.floor.y + 40);
    for (let i = 0; i < 60 * 20 && Math.hypot(wolf.x - g.player.x, wolf.y - g.player.y) > 120; i++) updateGame(g, 1 / 60);
    expect(Math.hypot(wolf.x - g.player.x, wolf.y - g.player.y)).toBeLessThan(120);
  });
});
