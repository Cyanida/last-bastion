import { describe, expect, it } from 'vitest';
import { ACTS } from '../src/config/acts';
import type { ClassId } from '../src/config/classes';
import type { RunOptions } from '../src/game';
import { simulateRun } from '../src/sim/bot';

/**
 * v0.8 step 0 (ARCHITECTURE.md): golden runs. The bot plays each class on two fixed seeds, plus a run with Keep upgrades, a curse,
 * an Oath and the second bot variant, and the run summary must match the stored values. Every seed is one the bot takes past the first
 * Act boss (#115), so the boss, the Merchant and the route fork are in each run; if a change makes one die short of the boss, pick
 * another seed for it and re-record. The co-op refactor (#25-#31) must keep single-player identical, so a change here means a random
 * draw moved.
 * Update GOLDEN only in a commit that says why (a balance change, never a refactor).
 */

interface GoldenRun { cls: ClassId; seed: number; opts?: RunOptions; variant?: number }
const RUNS: Record<string, GoldenRun> = {
  'paladin:1234': { cls: 'paladin', seed: 1234 },
  'paladin:98765': { cls: 'paladin', seed: 98765 },
  'viking:98765': { cls: 'viking', seed: 98765 },
  'viking:5': { cls: 'viking', seed: 5 },
  'angel:1234': { cls: 'angel', seed: 1234 },
  'angel:98765': { cls: 'angel', seed: 98765 },
  'necromancer:1234': { cls: 'necromancer', seed: 1234 },
  'necromancer:5': { cls: 'necromancer', seed: 5 },
  'archer:2026': { cls: 'archer', seed: 2026 },
  'archer:5': { cls: 'archer', seed: 5 },
  'paladin:7 meta': { cls: 'paladin', seed: 7, opts: { meta: { hp: 3, moveSpd: 3, startLevel: 1, startGold: 5, pickup: 5, xp: 5, talentPoint: 2, rerolls: 2, utilityCd: 3 } } },
  'viking:98765 curse': { cls: 'viking', seed: 98765, opts: { curses: ['ironHorde'] } },
  'angel:98765 oath 3': { cls: 'angel', seed: 98765, opts: { oath: 3 } },
  'archer:5 variant 1': { cls: 'archer', seed: 5, variant: 1 },
};
const SECONDS = 720; // past the first Act boss, so the Merchant and the route fork are in it

/** FNV-1a over the summary's JSON: catches any difference the listed fields miss. */
function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16);
}

function golden({ cls, seed, opts = {}, variant = 0 }: GoldenRun): string {
  const r = simulateRun(cls, seed, opts, variant, SECONDS);
  expect(r.wave, 'the bot must reach the first Act boss on this seed').toBeGreaterThanOrEqual(ACTS.length);
  return `wave ${r.wavesCleared} kills ${r.kills} level ${r.level} gold ${r.gold} relics ${r.relicsFound?.length ?? 0} hash ${fnv(JSON.stringify(r))}`;
}

const GOLDEN: Record<string, string> = {
  'paladin:1234': 'wave 13 kills 464 level 15 gold 1615 relics 5 hash 63499707',
  'paladin:98765': 'wave 16 kills 699 level 17 gold 2535 relics 6 hash b350fff8',
  'viking:98765': 'wave 14 kills 576 level 15 gold 2014 relics 5 hash e2c0ed62',
  'viking:5': 'wave 18 kills 634 level 18 gold 3336 relics 7 hash c4db39c4',
  'angel:1234': 'wave 18 kills 743 level 19 gold 3769 relics 6 hash 96c84665',
  'angel:98765': 'wave 17 kills 725 level 18 gold 3332 relics 6 hash ae9eac51',
  'necromancer:1234': 'wave 9 kills 288 level 10 gold 869 relics 4 hash 18ffd29a',
  'necromancer:5': 'wave 9 kills 267 level 10 gold 757 relics 3 hash 29960912',
  'archer:2026': 'wave 10 kills 328 level 12 gold 1367 relics 3 hash cdcf075e',
  'archer:5': 'wave 22 kills 931 level 21 gold 5913 relics 10 hash d0f42d45',
  'paladin:7 meta': 'wave 14 kills 558 level 17 gold 2055 relics 7 hash eb298154',
  'viking:98765 curse': 'wave 18 kills 748 level 18 gold 3783 relics 7 hash b4875a29',
  'angel:98765 oath 3': 'wave 17 kills 732 level 18 gold 4029 relics 6 hash cb861360',
  'archer:5 variant 1': 'wave 9 kills 254 level 10 gold 1015 relics 3 hash ba8346f0',
};

describe('v0.8 golden runs', () => {
  for (const [name, run] of Object.entries(RUNS))
    it(`${name} plays exactly as before`, () => {
      expect(golden(run)).toBe(GOLDEN[name]);
    }, 120_000); // a few seconds alone, much longer next to the other files
});
