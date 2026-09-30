import { beforeEach, describe, expect, it } from 'vitest';
import type { ClassId } from '../src/config/classes';
import { simulateLevel } from '../src/sim/levels';

/**
 * v0.10 (#207): golden runs for the Marches' first and last level. The bot plays a first try on Knight with expected progress (its
 * inventory from the earlier levels' first clears, the loadout it fills from it; src/sim/levels.ts), and the run must match the stored
 * values: the champion's build (#238: the bot's, at the level enemy scaling expects), the loadout, the opening pick and the level's end
 * all stay put unless a change means them to move.
 * Update GOLDEN only in a commit that says why (a balance change, never a refactor), as tests/v8-golden.test.ts.
 */

interface GoldenLevel { cls: ClassId; seed: number; level: number; variant?: number }
const RUNS: Record<string, GoldenLevel> = {
  'marches 1 paladin:1': { cls: 'paladin', seed: 1, level: 1 },
  'marches 1 archer:2': { cls: 'archer', seed: 2, level: 1 },
  'marches 1 angel:4 variant 1': { cls: 'angel', seed: 4, level: 1, variant: 1 },
  'marches 7 paladin:1': { cls: 'paladin', seed: 1, level: 7 },
  'marches 7 angel:1': { cls: 'angel', seed: 1, level: 7 },
  'marches 7 viking:2 variant 1': { cls: 'viking', seed: 2, level: 7, variant: 1 },
};
const SECONDS = 900; // a level (4-10 minutes, #243) fits with room to spare; a stuck run still ends

/** FNV-1a over the summary's JSON, as tests/v8-golden.test.ts. */
function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16);
}

function golden({ cls, seed, level, variant = 0 }: GoldenLevel): string {
  const r = simulateLevel(cls, seed, 'marches', level, 1, variant, undefined, SECONDS);
  const s = r.summary;
  return `${r.cleared ? 'cleared' : 'fell'} wave ${s.wavesCleared} kills ${s.kills} level ${s.level} loadout ${r.loadout.join('+') || '-'} relics ${s.relicsFound?.length ?? 0} hash ${fnv(JSON.stringify(s))}`;
}

// re-recorded for #221 (rule 9's tuning: the level step on enemies, epic head-start boons from level 11; gameplay changed on purpose),
// and again on release/0.11.0 with #217's Rivet Hammer in the starter pool (level 1's relic draws changed on purpose);
// re-recorded again for #218 (v0.11): the Archer's and the Angel's Steel class relics join their pools, so their level 1 draws (and those two
// runs) moved, gameplay changed on purpose, and the Angel's once more when Iron Halo's strike moved onto the cast; these seeds still fall on Marches level 7 on Knight, so its runs pin the head start, the loadout and the fight up to the fall;
// re-recorded for #237: a realm run's loadout is 3 slots at every level (level 7 had 4), so the three level 7 runs slot one relic fewer (gameplay changed on purpose)
// re-recorded for #238: no head start and no level-up inside a level; the bot plays its champion's build (level 1 at Marches level 1, 5 at level 7,
// the cap before the crown) against enemies scaled to that level (gameplay changed on purpose)
// re-recorded for #243: longer levels. The Marches' level 1 is waves 1-6 and level 7 waves 36-40 (were 1-5 and 31-40), a level's one boss
// wave is its last, its waves bring more or fewer foes over a longer time (WORLD.levelWaves) and the level step was tuned again
// (gameplay changed on purpose); these seeds still fall on level 7 on Knight
const GOLDEN: Record<string, string> = {
  'marches 1 paladin:1': 'cleared wave 6 kills 201 level 1 loadout - relics 3 hash eb894b94',
  'marches 1 archer:2': 'cleared wave 6 kills 209 level 1 loadout - relics 3 hash cfeccc4f',
  'marches 1 angel:4 variant 1': 'cleared wave 6 kills 209 level 1 loadout - relics 3 hash d696d17b',
  'marches 7 paladin:1': 'fell wave 35 kills 85 level 5 loadout salamanderScale+anvilHeart+berserkerTooth relics 4 hash a3a595ff',
  'marches 7 angel:1': 'fell wave 35 kills 66 level 5 loadout salamanderScale+anvilHeart+berserkerTooth relics 4 hash 56a35d33',
  'marches 7 viking:2 variant 1': 'fell wave 37 kills 267 level 5 loadout tempestEye+anvilHeart+salamanderScale relics 5 hash c9f3b492',
};

describe('v0.10 golden level runs (#207)', () => {
  // each run blocks the worker for a second or more; yield between them (see tests/v8-golden.test.ts)
  beforeEach(() => new Promise((r) => setTimeout(r, 0)));
  for (const [name, run] of Object.entries(RUNS))
    it(`${name} plays exactly as before`, () => {
      expect(golden(run)).toBe(GOLDEN[name]);
    }, 120_000);
});
