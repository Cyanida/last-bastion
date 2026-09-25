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
  'paladin:1234': 'wave 13 kills 464 level 15 gold 1615 relics 5 hash 63499707',
  'paladin:98765': 'wave 16 kills 699 level 17 gold 2535 relics 6 hash b350fff8',
  'viking:1234': 'wave 9 kills 281 level 11 gold 903 relics 3 hash 1e8aed1',
  'viking:98765': 'wave 14 kills 576 level 15 gold 2014 relics 5 hash e2c0ed62',
  'angel:1234': 'wave 18 kills 743 level 19 gold 3769 relics 6 hash 96c84665',
  'angel:98765': 'wave 17 kills 725 level 18 gold 3332 relics 6 hash ae9eac51',
  'necromancer:1234': 'wave 9 kills 288 level 10 gold 869 relics 4 hash 18ffd29a',
  'necromancer:98765': 'wave 9 kills 303 level 11 gold 842 relics 3 hash df63b9e5',
  'archer:1234': 'wave 4 kills 111 level 5 gold 274 relics 2 hash 9693440f',
  'archer:98765': 'wave 7 kills 209 level 8 gold 835 relics 2 hash 44afafb9',
};

describe('v0.8 golden runs', () => {
  for (const cls of CLASS_ORDER)
    for (const seed of SEEDS)
      it(`${cls} on seed ${seed} plays exactly as before`, () => {
        expect(golden(cls, seed)).toBe(GOLDEN[`${cls}:${seed}`]);
      }, 120_000); // a few seconds alone, much longer next to the other files
});
