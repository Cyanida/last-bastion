import { describe, expect, it } from 'vitest';
import { ACT_THEMES, ACTS, FINAL } from '../src/config/acts';
import { ARENA_IDS } from '../src/config/arenas';
import { ROUTES } from '../src/config/routes';
import type { Game } from '../src/core/types';
import { createGame, updateGame } from '../src/game';
import { dailySetup } from '../src/logic/acts';
import { routeChoices, type Route } from '../src/logic/routes';
import { actTheme, chooseRoute, leaveMerchant } from '../src/systems/acts';
import { goldMult, killEnemy } from '../src/systems/combat';
import { questTake } from '../src/systems/quests';
import { spawnEnemy } from '../src/systems/spawning';

const DT = 1 / 60;

/** A run standing at the fork after `act`, the Merchant visited. */
function atFork(seed = 7, act = 1): Game {
  const g = createGame('viking', seed);
  g.pendingBoard = false;
  g.act = act;
  leaveMerchant(g);
  return g;
}

describe('route seeding (v0.6)', () => {
  it('the same seed forks the same way; three different foci; never back into the arena just left', () => {
    const a = routeChoices(1234, 1, 'courtyard');
    expect(routeChoices(1234, 1, 'courtyard')).toEqual(a);
    expect(a).toHaveLength(ROUTES.choices);
    expect(new Set(a.map((r) => r.focus)).size).toBe(ROUTES.choices);
    for (const r of a) {
      expect(ARENA_IDS).toContain(r.arena);
      expect(r.arena).not.toBe('courtyard');
      expect(r.theme).toBeGreaterThan(0); // The Levy is Act I's alone
      expect(r.theme).toBeLessThan(ACT_THEMES.length);
    }
  });

  it('different seeds and different Acts fork differently', () => {
    const forks = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((s) => JSON.stringify(routeChoices(s, 1, 'keep'))));
    expect(forks.size).toBeGreaterThan(4);
    expect(JSON.stringify(routeChoices(99, 1, 'keep'))).not.toBe(JSON.stringify(routeChoices(99, 2, 'keep')));
  });

  it('Act IV is always the Last Bastion against the Usurper’s host; only the focus changes', () => {
    for (const r of routeChoices(5, FINAL.act - 1, 'graveyard')) expect(r).toMatchObject({ arena: FINAL.arena, theme: -1 });
  });

  it('a Daily Trial offers everyone the same fork', () => {
    const d = dailySetup('2026-09-23');
    expect(routeChoices(d.seed, 2, d.arena)).toEqual(routeChoices(dailySetup('2026-09-23').seed, 2, d.arena));
  });
});

describe('the fork in the game (v0.6)', () => {
  it('leaving the Merchant after an Act brings the fork; taking a route sets the next Act’s arena and theme', () => {
    const g = atFork();
    expect(g.pendingRoute).toHaveLength(ROUTES.choices);
    const r = g.pendingRoute![1];
    chooseRoute(g, 1);
    expect(g.act).toBe(2);
    expect(g.arena.id).toBe(r.arena);
    expect(actTheme(g)).toBe(ACT_THEMES[r.theme]);
    expect(g.pendingRoute).toBeNull();
    expect(g.log.marks.at(-1)?.[1]).toBe('route');
  });

  const into = (focus: Route['focus']): Game => {
    const g = atFork();
    g.pendingRoute = [{ arena: 'keep', theme: 2, focus }];
    chooseRoute(g, 0);
    g.breather = 1e9;
    g.player.invulnT = 1e9;
    return g;
  };

  it('Merchant path: he also comes halfway through the Act, leaving him goes on with the Act, and gold drops more', () => {
    const g = into('merchant');
    const plain = into('elite');
    expect(goldMult(g)).toBeCloseTo(goldMult(plain) * ROUTES.merchant.gold);
    g.wave = ACTS.length + ROUTES.merchant.midWave;
    g.breather = 0;
    g.spawnQueue = [];
    updateGame(g, DT);
    expect(g.pendingMerchant).toBe(true);
    expect(g.midMerchant).toBe(true);
    leaveMerchant(g);
    expect(g.act).toBe(2);
    expect(g.pendingRoute).toBeNull();
  });

  it('Pilgrim path: a shrine as the Act begins, and one more quest from the board', () => {
    const g = into('pilgrim');
    expect(g.pendingShrine).not.toBeNull();
    expect(questTake(g)).toBe(questTake(into('siege')) + ROUTES.pilgrim.extraQuests);
  });

  it('Siege path: a tougher Act, and Runes when its boss falls', () => {
    const g = into('siege');
    const plain = into('elite');
    expect(spawnEnemy(g, 'knight', 0, 0).maxHp).toBeCloseTo(spawnEnemy(plain, 'knight', 0, 0).maxHp * ROUTES.siege.hp);
    g.wave = 2 * ACTS.length;
    const runes = g.questRunes;
    killEnemy(g, spawnEnemy(g, ACTS.bosses[1], 0, 0));
    expect(g.questRunes).toBe(runes + ROUTES.siege.runes);
  });

  it('Elite path: more elites in the waves', () => {
    const elites = (focus: Route['focus']) => {
      let n = 0;
      for (let s = 0; s < 20; s++) {
        const g = createGame('viking', 100 + s);
        g.pendingBoard = false;
        g.act = 1;
        leaveMerchant(g);
        g.pendingRoute = [{ arena: 'keep', theme: 2, focus }];
        chooseRoute(g, 0);
        g.wave = 13; // Act II, past the first waves
        g.breather = 0.001;
        updateGame(g, DT);
        n += g.spawnQueue.filter((u) => u.affixes.length > 0).length;
      }
      return n;
    };
    expect(elites('elite')).toBeGreaterThan(elites('siege') * 1.3);
  });
});
