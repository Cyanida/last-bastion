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
  'paladin:1234': 'wave 14 kills 467 level 15 gold 2049 relics 5 hash d0020d',
  'paladin:98765': 'wave 14 kills 557 level 15 gold 1940 relics 6 hash 9c711298',
  'viking:1234': 'wave 5 kills 147 level 7 gold 591 relics 3 hash b94b4852',
  'viking:98765': 'wave 15 kills 584 level 15 gold 3016 relics 6 hash 398eb9f7',
  'angel:1234': 'wave 19 kills 754 level 19 gold 3967 relics 6 hash 6c1615cc',
  'angel:98765': 'wave 17 kills 735 level 18 gold 3678 relics 7 hash 651725c3',
  'necromancer:1234': 'wave 18 kills 709 level 18 gold 3565 relics 6 hash 7e25181',
  'necromancer:98765': 'wave 4 kills 113 level 5 gold 273 relics 1 hash f8a220c3',
  'archer:1234': 'wave 4 kills 111 level 5 gold 274 relics 2 hash 9693440f',
  'archer:98765': 'wave 11 kills 407 level 12 gold 1639 relics 4 hash d586a11c',
};

describe('v0.8 golden runs', () => {
  for (const cls of CLASS_ORDER)
    for (const seed of SEEDS)
      it(`${cls} on seed ${seed} plays exactly as before`, () => {
        expect(golden(cls, seed)).toBe(GOLDEN[`${cls}:${seed}`]);
      }, 120_000); // a few seconds alone, much longer next to the other files
});
