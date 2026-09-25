import { describe, expect, it } from 'vitest';
import { CLASS_ORDER } from '../src/config/classes';
import { simulateRun } from '../src/sim/bot';

/**
 * v0.8 step 0 (ARCHITECTURE.md): golden runs. The bot plays each class on two fixed seeds and the run summary must match the
 * stored values. The co-op refactor (#25-#31) must keep single-player identical, so a change here means a random draw moved.
 * Update GOLDEN only in a commit that says why (a balance change, never a refactor).
 */

const SEEDS = [1234, 98765];
const SECONDS = 720; // past the first Act boss, so the Merchant and the route fork are in it

/** FNV-1a over the summary's JSON: catches any difference the listed fields miss. */
function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16);
}

function golden(cls: (typeof CLASS_ORDER)[number], seed: number): string {
  const r = simulateRun(cls, seed, {}, 0, SECONDS);
  return `wave ${r.wavesCleared} kills ${r.kills} level ${r.level} gold ${r.gold} relics ${r.relicsFound?.length ?? 0} hash ${fnv(JSON.stringify(r))}`;
}

const GOLDEN: Record<string, string> = {
  'paladin:1234': 'wave 13 kills 461 level 15 gold 1636 relics 5 hash dbbbcaf1',
  'paladin:98765': 'wave 16 kills 638 level 16 gold 2428 relics 6 hash f4be516f',
  'viking:1234': 'wave 5 kills 147 level 7 gold 591 relics 3 hash b94b4852',
  'viking:98765': 'wave 18 kills 826 level 19 gold 3181 relics 6 hash 50ec9546',
  'angel:1234': 'wave 19 kills 760 level 19 gold 3764 relics 6 hash a1fb5f8f',
  'angel:98765': 'wave 17 kills 715 level 18 gold 3363 relics 6 hash 7405b9f9',
  'necromancer:1234': 'wave 18 kills 712 level 18 gold 3424 relics 6 hash 4abc7857',
  'necromancer:98765': 'wave 9 kills 303 level 10 gold 806 relics 3 hash 1c3b7c79',
  'archer:1234': 'wave 4 kills 111 level 5 gold 274 relics 2 hash 9693440f',
  'archer:98765': 'wave 11 kills 415 level 12 gold 1830 relics 4 hash 2ad94bf9',
};

describe('v0.8 golden runs', () => {
  for (const cls of CLASS_ORDER)
    for (const seed of SEEDS)
      it(`${cls} on seed ${seed} plays exactly as before`, () => {
        expect(golden(cls, seed)).toBe(GOLDEN[`${cls}:${seed}`]);
      }, 120_000); // a few seconds alone, much longer next to the other files
});
