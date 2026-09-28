import { describe, expect, it } from 'vitest';
import { QUEST_BOARD, QUESTS, type QuestKind, type RewardKind } from '../src/config/quests';
import type { Game } from '../src/core/types';
import { createGame } from '../src/game';
import { killEnemy } from '../src/systems/combat';
import { nextAct } from '../src/systems/acts';
import { takeQuests, updateQuests } from '../src/systems/quests';
import { questsTakenThisAct } from '../src/systems/spawning';

const DT = 1 / 60;

/** A fresh game with one quest of that kind taken (the first board slot is rewritten; the board itself is seeded). */
function withQuest(kind: QuestKind, reward: RewardKind = 'gold'): Game {
  const g = createGame('paladin', 42);
  Object.assign(g.quests[0], { kind, reward, name: QUESTS[kind].short });
  takeQuests(g, [0]);
  return g;
}

describe('#169 a quest-gated boss still comes when its quest was finished early', () => {
  it('a done quest outlives its own linger, so what it unlocked keeps gating the boss', () => {
    const g = withQuest('camps', 'talent'); // siegeMarshal (config/bosses.ts) is gated on 'camps'
    for (const c of g.quests[0].foes) killEnemy(g, c);
    updateQuests(g, DT); // all three burnt: the quest ends done
    expect(g.quests[0].state).toBe('done');
    expect(questsTakenThisAct(g)).toContain('camps');

    // let the finished quest linger out of g.quests entirely, well before any boss wave checks it
    updateQuests(g, QUEST_BOARD.linger + 1);
    expect(g.quests.some((q) => q.kind === 'camps')).toBe(false);

    // the fix: what it unlocked survives the quest object's own removal
    expect(questsTakenThisAct(g)).toEqual(['camps']);
  });

  it('a new Act clears what carried over', () => {
    const g = withQuest('camps', 'talent');
    for (const c of g.quests[0].foes) killEnemy(g, c);
    updateQuests(g, DT);
    expect(questsTakenThisAct(g)).toContain('camps');
    nextAct(g);
    expect(g.actQuestsDone).toEqual([]);
  });
});
