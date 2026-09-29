import { beforeEach, describe, expect, it } from 'vitest';
import type { ClassId } from '../src/config/classes';
import { simulateLevel } from '../src/sim/levels';

/**
 * v0.10 (#207): golden runs for the Marches' first and last level. The bot plays a first try on Knight with expected progress (its
 * inventory from the earlier levels' first clears, the loadout it fills from it; src/sim/levels.ts), and the run must match the stored
 * values: the head start, the loadout, the opening pick and the level's end all stay put unless a change means them to move.
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
const SECONDS = 900; // a 10-wave level fits with room to spare; a stuck run still ends

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
// these seeds still fall on Marches level 7 on Knight, so its runs pin the head start, the loadout and the fight up to the fall
const GOLDEN: Record<string, string> = {
  'marches 1 paladin:1': 'cleared wave 5 kills 105 level 6 loadout - relics 3 hash fdf9ffdb',
  'marches 1 archer:2': 'cleared wave 5 kills 105 level 5 loadout - relics 3 hash 3805bec1',
  'marches 1 angel:4 variant 1': 'cleared wave 5 kills 102 level 5 loadout - relics 3 hash add2be37',
  'marches 7 paladin:1': 'fell wave 32 kills 254 level 24 loadout salamanderScale+anvilHeart+berserkerTooth+tempestEye relics 5 hash e1d5adef',
  'marches 7 angel:1': 'fell wave 31 kills 221 level 24 loadout salamanderScale+anvilHeart+berserkerTooth+tempestEye relics 5 hash ca941fbf',
  'marches 7 viking:2 variant 1': 'fell wave 30 kills 90 level 24 loadout tempestEye+anvilHeart+salamanderScale+berserkerTooth relics 5 hash 963f0a60',
};

describe('v0.10 golden level runs (#207)', () => {
  // each run blocks the worker for a second or more; yield between them (see tests/v8-golden.test.ts)
  beforeEach(() => new Promise((r) => setTimeout(r, 0)));
  for (const [name, run] of Object.entries(RUNS))
    it(`${name} plays exactly as before`, () => {
      expect(golden(run)).toBe(GOLDEN[name]);
    }, 120_000);
});
