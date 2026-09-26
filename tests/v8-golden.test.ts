import { beforeEach, describe, expect, it } from 'vitest';
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
 * Re-recorded for #101 (v0.8): Squire no longer fields Mirror Knights, Hound Masters, spearmen or siege towers, so its waves changed on purpose.
 * Re-recorded for #126 (v0.8): the Bone Colossus is capped and no longer eats the skeletons, so both Necromancer runs changed on purpose.
 * Re-recorded for #125 (v0.8 balance pass): the Necromancer's HP and skeletons and six relics' numbers changed on purpose.
 * Re-recorded for #134 (v0.8.1): Dread Howl stuns instead of scaring enemies off, so the three Viking runs changed on purpose.
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
  'archer:2027': { cls: 'archer', seed: 2027 }, // #100: 2026 dies before the Act boss
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

// v0.8 #99 + #100 + #101: re-recorded on release/0.8.0 because boss draws, boss relic families and the Squire enemy roster changed on purpose
const GOLDEN: Record<string, string> = {
  'paladin:1234': 'wave 13 kills 456 level 14 gold 1657 relics 4 hash 794bec69',
  'paladin:98765': 'wave 15 kills 622 level 16 gold 2298 relics 6 hash 2255f556',
  'viking:98765': 'wave 19 kills 838 level 18 gold 3577 relics 7 hash 35ef9aa6',
  'viking:5': 'wave 18 kills 655 level 17 gold 2872 relics 7 hash 2bb36549',
  'angel:1234': 'wave 16 kills 670 level 17 gold 2627 relics 5 hash 807696a7',
  'angel:98765': 'wave 17 kills 725 level 18 gold 3700 relics 7 hash 4b446d7d',
  'necromancer:1234': 'wave 9 kills 290 level 10 gold 864 relics 4 hash 709acac7',
  'necromancer:5': 'wave 19 kills 729 level 19 gold 3143 relics 7 hash 554228eb',
  'archer:2027': 'wave 9 kills 301 level 10 gold 883 relics 4 hash 8fc7b0c2',
  'archer:5': 'wave 19 kills 762 level 19 gold 4059 relics 6 hash e542ff2c',
  'paladin:7 meta': 'wave 14 kills 545 level 17 gold 1772 relics 6 hash d77a11a5',
  'viking:98765 curse': 'wave 18 kills 755 level 18 gold 3696 relics 7 hash 7d5b288e',
  'angel:98765 oath 3': 'wave 15 kills 650 level 16 gold 3516 relics 7 hash 2a12bca8',
  'archer:5 variant 1': 'wave 9 kills 261 level 11 gold 1115 relics 4 hash c584dc99',
};

describe('v0.8 golden runs', () => {
  // each run blocks the worker for seconds; yield between them, or vitest's 60 s worker RPC times out over the whole file
  beforeEach(() => new Promise((r) => setTimeout(r, 0)));
  for (const [name, run] of Object.entries(RUNS))
    it(`${name} plays exactly as before`, () => {
      expect(golden(run)).toBe(GOLDEN[name]);
    }, 120_000); // a few seconds alone, much longer next to the other files
});
