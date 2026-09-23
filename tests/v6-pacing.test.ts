import { describe, expect, it } from 'vitest';
import { WAVES } from '../src/config/waves';
import type { Game } from '../src/core/types';
import { createGame, updateGame } from '../src/game';
import { spawnEnemy } from '../src/systems/spawning';

const DT = 1 / 60;
const tick = (g: Game, seconds: number) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) updateGame(g, DT);
};

/** Wave 3 is on, every spawn is out: only what the test puts down is left. */
function tail(): Game {
  const g = createGame('paladin', 21);
  g.pendingBoard = false;
  g.wave = 3;
  g.breather = 0;
  g.spawnQueue = [];
  g.player.invulnT = 1e9;
  return g;
}

describe('stragglers (v0.6)', () => {
  it('the last few weak enemies get a short grace, then come straight at the player, faster', () => {
    const g = tail();
    const far = [spawnEnemy(g, 'crossbow', g.player.x + 600, g.player.y), spawnEnemy(g, 'peasant', g.player.x - 600, g.player.y)];
    tick(g, WAVES.stragglers.grace - 1);
    expect(far.some((e) => e.pulled)).toBe(false);
    tick(g, 1.5);
    expect(far.every((e) => e.pulled)).toBe(true);
    const before = far.map((e) => Math.hypot(e.x - g.player.x, e.y - g.player.y));
    tick(g, 1);
    far.forEach((e, i) => expect(Math.hypot(e.x - g.player.x, e.y - g.player.y)).toBeLessThan(before[i] - e.baseSpeed * 1.2)); // the crossbowman no longer keeps his distance
  });

  it('more than a handful left, or an elite among them: no pull, it is still a fight', () => {
    const many = tail();
    const crowd = Array.from({ length: WAVES.stragglers.count + 1 }, (_, i) => spawnEnemy(many, 'peasant', many.player.x + 500 + i * 30, many.player.y));
    tick(many, WAVES.stragglers.grace + 1);
    expect(crowd.some((e) => e.pulled)).toBe(false);
    const elite = tail();
    const pair = [spawnEnemy(elite, 'knight', elite.player.x + 500, elite.player.y, ['enraged']), spawnEnemy(elite, 'peasant', elite.player.x - 500, elite.player.y)];
    tick(elite, WAVES.stragglers.grace + 1);
    expect(pair[0].elite).toBe(true);
    expect(pair.some((e) => e.pulled)).toBe(false);
  });

  it('a siege structure left on its own gives up the field, and the wave ends', () => {
    const g = tail();
    const ballista = spawnEnemy(g, 'ballista', g.player.x + 700, g.player.y);
    tick(g, WAVES.stragglers.grace + 0.5);
    expect(ballista.dead).toBe(true);
    expect(g.wavesCleared).toBe(3);
  });

  it('side content is never a straggler: a quest target does not get pulled', () => {
    const g = tail();
    const camp = spawnEnemy(g, 'peasant', g.player.x + 600, g.player.y);
    camp.side = true;
    tick(g, WAVES.stragglers.grace + 1);
    expect(camp.pulled).toBe(false);
  });
});
