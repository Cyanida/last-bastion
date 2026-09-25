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
  'archer:2027': { cls: 'archer', seed: 2027 }, // #100: 2026 now dies before the Act boss
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

// #100: re-recorded because a boss now drops only its arena's relic families (a gameplay change on purpose)
const GOLDEN: Record<string, string> = {
  'paladin:1234': 'wave 13 kills 458 level 14 gold 1711 relics 4 hash 3517c73e',
  'paladin:98765': 'wave 15 kills 628 level 16 gold 2320 relics 5 hash 4d13e0d0',
  'viking:98765': 'wave 9 kills 309 level 10 gold 782 relics 2 hash 895078a1',
  'viking:5': 'wave 18 kills 694 level 18 gold 2818 relics 7 hash 3f80ed07',
  'angel:1234': 'wave 16 kills 627 level 17 gold 2668 relics 5 hash 3d1074d9',
  'angel:98765': 'wave 17 kills 717 level 18 gold 3703 relics 7 hash 1cd93323',
  'necromancer:1234': 'wave 19 kills 718 level 19 gold 4032 relics 6 hash 95db1fea',
  'necromancer:5': 'wave 14 kills 457 level 15 gold 1925 relics 6 hash fe1fa5c8',
  'archer:2027': 'wave 9 kills 301 level 10 gold 883 relics 4 hash 8fc7b0c2',
  'archer:5': 'wave 19 kills 734 level 19 gold 4252 relics 6 hash 9fb211a0',
  'paladin:7 meta': 'wave 14 kills 558 level 17 gold 2055 relics 7 hash eb298154',
  'viking:98765 curse': 'wave 18 kills 773 level 18 gold 3911 relics 7 hash d64a931e',
  'angel:98765 oath 3': 'wave 17 kills 754 level 18 gold 4014 relics 6 hash 2eb0893c',
  'archer:5 variant 1': 'wave 14 kills 428 level 14 gold 2224 relics 5 hash 8f4fb500',
};

describe('v0.8 golden runs', () => {
  for (const [name, run] of Object.entries(RUNS))
    it(`${name} plays exactly as before`, () => {
      expect(golden(run)).toBe(GOLDEN[name]);
    }, 120_000); // a few seconds alone, much longer next to the other files
});
