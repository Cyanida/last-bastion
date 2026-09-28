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
 * Re-recorded for #169 (v0.8.3): a quest-gated boss now still draws once its quest is done, even if the quest itself has since
 * lingered off the tracker; seed 98765's Act I board (monk, elite, camps) is all quest-gated kinds, so its five runs changed on purpose.
 * Re-recorded for #173 (v0.8.3): Anvil Heart and Adamant now count talent armor too, so paladin's seed 98765 run (Bulwark branch,
 * +armor talents) plays out differently on purpose.
 * Re-recorded for #182 (v0.8.3): an enemy's bolt now carries its shooter, so its hit poisons, curses and draws thorns like a blow;
 * every run with ranged enemies changed on purpose, and paladin:1234 (now short of the boss) became paladin:5.
 */

interface GoldenRun { cls: ClassId; seed: number; opts?: RunOptions; variant?: number }
const RUNS: Record<string, GoldenRun> = {
  'paladin:5': { cls: 'paladin', seed: 5 }, // #182: 1234 now dies before the Act boss
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
  'paladin:5': 'wave 15 kills 489 level 15 gold 1776 relics 6 hash 7f2b8204',
  'paladin:98765': 'wave 16 kills 646 level 17 gold 2603 relics 6 hash c21246e4',
  'viking:98765': 'wave 18 kills 753 level 18 gold 3233 relics 7 hash 1ce7baf4',
  'viking:5': 'wave 18 kills 673 level 17 gold 3602 relics 7 hash 30d45a13',
  'angel:1234': 'wave 16 kills 670 level 17 gold 2627 relics 5 hash cf01d259',
  'angel:98765': 'wave 14 kills 571 level 15 gold 2188 relics 5 hash afc6c2a8',
  'necromancer:1234': 'wave 9 kills 290 level 10 gold 864 relics 4 hash 709acac7',
  'necromancer:5': 'wave 19 kills 724 level 19 gold 3196 relics 7 hash 1ae406b6',
  'archer:2027': 'wave 9 kills 301 level 10 gold 883 relics 4 hash f502a6cf',
  'archer:5': 'wave 19 kills 762 level 19 gold 4059 relics 6 hash eefe4012',
  'paladin:7 meta': 'wave 15 kills 577 level 17 gold 2011 relics 7 hash 8a3f680a',
  'viking:98765 curse': 'wave 18 kills 808 level 18 gold 3899 relics 7 hash 2ec27a7e',
  'angel:98765 oath 3': 'wave 15 kills 658 level 16 gold 3837 relics 7 hash b499e01a',
  'archer:5 variant 1': 'wave 14 kills 452 level 14 gold 2356 relics 5 hash 6a889c6',
};

describe('v0.8 golden runs', () => {
  // each run blocks the worker for seconds; yield between them, or vitest's 60 s worker RPC times out over the whole file
  beforeEach(() => new Promise((r) => setTimeout(r, 0)));
  for (const [name, run] of Object.entries(RUNS))
    it(`${name} plays exactly as before`, () => {
      expect(golden(run)).toBe(GOLDEN[name]);
    }, 120_000); // a few seconds alone, much longer next to the other files
});
