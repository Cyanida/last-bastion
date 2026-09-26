import { describe, expect, it } from 'vitest';
import { BOSSES } from '../src/config/bosses';
import { ENEMIES } from '../src/config/enemies';
import type { QuestKind } from '../src/config/quests';
import { mulberry32 } from '../src/core/math';
import { bossDef, bossForWave, pickMidBoss, type BossDraw } from '../src/logic/acts';
import { createGame } from '../src/game';

/** #99: a bigger boss pool, no boss twice in a run until the pool is spent, rare strong bosses and quest-gated ones. */

/** The bosses of one run's boss waves, as the game draws them. */
function runBosses(seed: number, waves: number, quests: QuestKind[] = []): string[] {
  const draw: BossDraw = { seed, arena: 'courtyard', seen: [], quests };
  for (let w = 5; w <= waves; w += 5) {
    const key = bossForWave(w, draw);
    if (key) draw.seen.push(key);
  }
  return draw.seen;
}

describe('the boss pool (#99)', () => {
  it('every entry fights as a real boss', () => {
    for (const b of Object.values(BOSSES)) expect(ENEMIES[b.from].boss).toBe(true);
  });

  it('no boss comes back in a run to the Usurper, on any seed', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const seen = runBosses(seed, 40);
      expect(seen.at(-1)).toBe('usurper');
      expect(new Set(seen).size, `seed ${seed}: ${seen.join(', ')}`).toBe(seen.length);
    }
  });

  it('once the pool is spent it refills, but never the boss just met', () => {
    const draw: BossDraw = { seed: 9, arena: 'keep', seen: [], quests: [] };
    let last = '';
    for (let i = 0; i < 40; i++) {
      const k = pickMidBoss(3, draw, mulberry32(i));
      expect(k).not.toBe(last);
      draw.seen.push((last = k));
    }
  });

  it('Act I keeps its opener; rare bosses are rare; quest bosses need their quest', () => {
    const rare = Object.keys(BOSSES).filter((k) => BOSSES[k].rare);
    const quest = Object.keys(BOSSES).filter((k) => BOSSES[k].quest);
    const counts: Record<string, number> = {};
    for (let i = 0; i < 2000; i++) {
      const k1 = pickMidBoss(1, { seed: i, arena: 'courtyard', seen: [], quests: [] }, mulberry32(i));
      expect(k1).toBe('blackKnight'); // Act I: the arena's opener
      const k2 = pickMidBoss(2, { seed: i, arena: 'courtyard', seen: [], quests: [] }, mulberry32(i));
      expect(quest).not.toContain(k2);
      counts[k2] = (counts[k2] ?? 0) + 1;
    }
    for (const k of rare) expect(counts[k] ?? 0).toBeGreaterThan(0);
    for (const k of rare) expect(counts[k]).toBeLessThan(counts.blackKnight);
    // taking the siege-camps quest makes its boss the likely answer
    let marshal = 0;
    for (let i = 0; i < 500; i++) if (pickMidBoss(2, { seed: i, arena: 'courtyard', seen: [], quests: ['camps'] }, mulberry32(i)) === 'siegeMarshal') marshal++;
    expect(marshal).toBeGreaterThan(150);
  });

  it('a variant is its base boss renamed and stronger; the game remembers who it met', () => {
    expect(bossDef('dreadKnight').from).toBe('blackKnight');
    expect(bossDef('dreadKnight').hp).toBeGreaterThan(1);
    expect(bossDef('usurper').from).toBe('usurper');
    expect(createGame('paladin', 1).bossesSeen).toEqual([]);
  });
});
