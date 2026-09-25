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
  'paladin:1234': 'wave 15 kills 525 level 16 gold 2411 relics 6 hash 1e4ca0c4',
  'paladin:98765': 'wave 15 kills 636 level 16 gold 2269 relics 6 hash 833ccdec',
  'viking:1234': 'wave 5 kills 147 level 7 gold 591 relics 3 hash b94b4852',
  'viking:98765': 'wave 20 kills 866 level 20 gold 3368 relics 8 hash c4525121',
  'angel:1234': 'wave 19 kills 788 level 20 gold 3979 relics 7 hash 5e7a3245',
  'angel:98765': 'wave 17 kills 718 level 18 gold 3768 relics 7 hash d57e2d06',
  'necromancer:1234': 'wave 16 kills 608 level 17 gold 2767 relics 6 hash 1260bb8f',
  'necromancer:98765': 'wave 11 kills 388 level 12 gold 1201 relics 4 hash aa908511',
  'archer:1234': 'wave 4 kills 108 level 5 gold 273 relics 2 hash 3b73d95d',
  'archer:98765': 'wave 15 kills 566 level 15 gold 2841 relics 6 hash 7ed94750',
};

describe('v0.8 golden runs', () => {
  for (const cls of CLASS_ORDER)
    for (const seed of SEEDS)
      it(`${cls} on seed ${seed} plays exactly as before`, () => {
        expect(golden(cls, seed)).toBe(GOLDEN[`${cls}:${seed}`]);
      }, 120_000); // a few seconds alone, much longer next to the other files
});
