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
  'archer:98765': { cls: 'archer', seed: 98765 },
  'archer:5': { cls: 'archer', seed: 5 },
  'paladin:5 meta': { cls: 'paladin', seed: 5, opts: { meta: { hp: 3, moveSpd: 3, startLevel: 1, startGold: 5, pickup: 5, xp: 5, talentPoint: 2, rerolls: 2, utilityCd: 3 } } },
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
  'paladin:1234': 'wave 13 kills 461 level 15 gold 1636 relics 5 hash dbbbcaf1',
  'paladin:98765': 'wave 16 kills 638 level 16 gold 2428 relics 6 hash f4be516f',
  'viking:98765': 'wave 18 kills 826 level 19 gold 3181 relics 6 hash 50ec9546',
  'viking:5': 'wave 19 kills 707 level 19 gold 3181 relics 7 hash 1f5f8ab0',
  'angel:1234': 'wave 19 kills 760 level 19 gold 3764 relics 6 hash a1fb5f8f',
  'angel:98765': 'wave 17 kills 715 level 18 gold 3363 relics 6 hash 7405b9f9',
  'necromancer:1234': 'wave 18 kills 712 level 18 gold 3424 relics 6 hash 4abc7857',
  'necromancer:5': 'wave 18 kills 661 level 18 gold 2864 relics 7 hash 3e0ad7db',
  'archer:98765': 'wave 11 kills 415 level 12 gold 1830 relics 4 hash 2ad94bf9',
  'archer:5': 'wave 21 kills 898 level 20 gold 5558 relics 10 hash 74a38b97',
  'paladin:5 meta': 'wave 16 kills 555 level 19 gold 2612 relics 7 hash 390bbbc5',
  'viking:98765 curse': 'wave 17 kills 746 level 18 gold 3598 relics 7 hash 2d844b0f',
  'angel:98765 oath 3': 'wave 17 kills 717 level 17 gold 3784 relics 6 hash 1c00ed5',
  'archer:5 variant 1': 'wave 23 kills 933 level 21 gold 5440 relics 10 hash afe502d2',
};

describe('v0.8 golden runs', () => {
  for (const [name, run] of Object.entries(RUNS))
    it(`${name} plays exactly as before`, () => {
      expect(golden(run)).toBe(GOLDEN[name]);
    }, 120_000); // a few seconds alone, much longer next to the other files
});
