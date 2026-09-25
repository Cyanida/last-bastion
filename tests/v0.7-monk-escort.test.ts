import { describe, expect, it } from 'vitest';
import { QUESTS } from '../src/config/quests';
import { createGame } from '../src/game';
import { aggroDist2, monkSpeed, questProgress } from '../src/logic/quests';
import { takeQuests, updateQuests } from '../src/systems/quests';
import { spawnEnemy } from '../src/systems/spawning';

/** #119: the monk escort was lost to enemies that stopped him dead and then all went for him. */
describe('the monk escort is winnable (#119)', () => {
  it('near enemies he slows but keeps walking, and the tracker says so', () => {
    expect(monkSpeed(false)).toBe(QUESTS.monk.speed);
    expect(monkSpeed(true)).toBeGreaterThan(0);
    expect(monkSpeed(true)).toBeLessThan(QUESTS.monk.speed);

    const g = createGame('paladin', 42);
    Object.assign(g.quests[0], { kind: 'monk', reward: 'gold', name: QUESTS.monk.short });
    takeQuests(g, [0]);
    const q = g.quests[0];
    const monk = q.unit!;
    const e = spawnEnemy(g, 'peasant', monk.x + 40, monk.y);
    g.hash.insert(e);
    updateQuests(g, 1 / 60);
    expect(monk.speed).toBeGreaterThan(0);
    expect(questProgress(q)).toMatch(/^wary · \d+ HP$/);
  });

  it('enemies go for the player at his side, and for the monk only when he is clearly the nearer', () => {
    expect(aggroDist2(100, 'monk')).toBe(100 * QUESTS.monk.lure ** 2);
    expect(aggroDist2(100, 'caravan')).toBe(100); // everything else (skeletons, the decoy) still draws aggro by plain distance
    expect(aggroDist2(100)).toBe(100);
    // 80 px from the monk, 120 from the player: the player; 40 from the monk: the monk
    expect(aggroDist2(80 ** 2, 'monk')).toBeGreaterThan(120 ** 2);
    expect(aggroDist2(40 ** 2, 'monk')).toBeLessThan(120 ** 2);
  });

  it('he is sturdier than he was (170 HP before #119)', () => {
    expect(QUESTS.monk.hp).toBeGreaterThan(170);
  });
});
